"use client";

import type {
	RealtimeChannel,
	RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { latestUpdate } from "@/lib/monitoring/freshness";
import { createClient } from "@/lib/supabase/client";
import type { OntCurrentState } from "@/lib/types/gpon";

interface UseOntRealtimeArgs {
	oltHost: string;
	initialReadings: OntCurrentState[];
}

/**
 * connecting   → first subscription in progress
 * live         → channel subscribed
 * reconnecting → was live, channel dropped; Supabase is retrying
 * offline      → subscription failed/closed; `retry()` resubscribes
 * Channel state says nothing about data age: combine with `dataUpdatedAt`.
 */
export type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline";

export interface OntRealtimeState {
	readings: OntCurrentState[];
	connected: boolean;
	status: RealtimeStatus;
	lastEventAt: Date | null;
	/** Most recent `updated_at` among readings: when the collector last wrote. */
	dataUpdatedAt: string | null;
	retry: () => void;
}

// Mantiene el estado vivo de las ONTs de una OLT. Carga inicial via SSR
// (initialReadings), después escucha cambios por Realtime filtrando por olt_host.
//
// Política frente a desconexión: la suscripción de Supabase reintenta sola.
// Cuando el canal vuelve a SUBSCRIBED, hacemos un refetch completo para
// recuperar cualquier evento perdido durante el corte.
export function useOntRealtime({
	oltHost,
	initialReadings,
}: UseOntRealtimeArgs): OntRealtimeState {
	const supabase = useMemo(() => createClient(), []);

	const [byId, setById] = useState<Map<string, OntCurrentState>>(() =>
		buildMap(initialReadings),
	);
	const [status, setStatus] = useState<RealtimeStatus>("connecting");
	const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
	const [attempt, setAttempt] = useState(0);
	const everLiveRef = useRef(false);

	const setByIdRef = useRef(setById);
	setByIdRef.current = setById;

	// biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the manual retry trigger; changing it must resubscribe.
	useEffect(() => {
		let cancelled = false;
		const channel: RealtimeChannel = supabase
			.channel(`ont-monitoring:olt:${oltHost}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "ont_current_state",
					filter: `olt_host=eq.${oltHost}`,
				},
				(payload: RealtimePostgresChangesPayload<OntCurrentState>) => {
					setLastEventAt(new Date());
					setByIdRef.current((prev) => applyChange(prev, payload));
				},
			)
			.subscribe((status) => {
				if (cancelled) return;
				if (status === "SUBSCRIBED") {
					everLiveRef.current = true;
					setStatus("live");
					void refetch(supabase, oltHost).then((rows) => {
						if (cancelled) return;
						setByIdRef.current(buildMap(rows));
					});
				} else if (status === "CHANNEL_ERROR") {
					// supabase-js keeps retrying after a channel error. If we were never
					// live, say so instead of "connecting" forever.
					setStatus(everLiveRef.current ? "reconnecting" : "offline");
				} else if (status === "TIMED_OUT" || status === "CLOSED") {
					setStatus("offline");
				}
			});

		return () => {
			cancelled = true;
			void supabase.removeChannel(channel);
		};
		// `attempt` re-runs the effect: tears the channel down and resubscribes.
	}, [supabase, oltHost, attempt]);

	const retry = useCallback(() => {
		setStatus(everLiveRef.current ? "reconnecting" : "connecting");
		setAttempt((n) => n + 1);
	}, []);

	const readings = useMemo(() => {
		return Array.from(byId.values()).sort((a, b) =>
			a.ont_logical_id.localeCompare(b.ont_logical_id, undefined, {
				numeric: true,
			}),
		);
	}, [byId]);

	const dataUpdatedAt = useMemo(() => latestUpdate(readings), [readings]);

	return {
		readings,
		connected: status === "live",
		status,
		lastEventAt,
		dataUpdatedAt,
		retry,
	};
}

function buildMap(rows: OntCurrentState[]): Map<string, OntCurrentState> {
	const map = new Map<string, OntCurrentState>();
	for (const row of rows) {
		map.set(row.id, row);
	}
	return map;
}

function applyChange(
	prev: Map<string, OntCurrentState>,
	payload: RealtimePostgresChangesPayload<OntCurrentState>,
): Map<string, OntCurrentState> {
	const next = new Map(prev);
	const eventType = payload.eventType;

	if (eventType === "DELETE") {
		const oldRow = payload.old as Partial<OntCurrentState>;
		if (oldRow?.id) {
			next.delete(oldRow.id);
		}
		return next;
	}

	const newRow = payload.new as OntCurrentState | undefined;
	if (newRow?.id) {
		next.set(newRow.id, newRow);
	}
	return next;
}

async function refetch(
	supabase: ReturnType<typeof createClient>,
	oltHost: string,
): Promise<OntCurrentState[]> {
	const { data, error } = await supabase
		.from("ont_current_state")
		.select("*")
		.eq("olt_host", oltHost);
	if (error) {
		console.error("ont_current_state refetch failed", error);
		return [];
	}
	return (data ?? []) as OntCurrentState[];
}
