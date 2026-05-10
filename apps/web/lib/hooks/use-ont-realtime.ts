"use client";

import type {
	RealtimeChannel,
	RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OntCurrentState } from "@/lib/types/gpon";

interface UseOntRealtimeArgs {
	oltHost: string;
	initialReadings: OntCurrentState[];
}

export interface OntRealtimeState {
	readings: OntCurrentState[];
	connected: boolean;
	lastEventAt: Date | null;
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
	const [connected, setConnected] = useState(false);
	const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

	const setByIdRef = useRef(setById);
	setByIdRef.current = setById;

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
					setConnected(true);
					void refetch(supabase, oltHost).then((rows) => {
						if (cancelled) return;
						setByIdRef.current(buildMap(rows));
					});
				} else if (status === "CHANNEL_ERROR" || status === "CLOSED") {
					setConnected(false);
				}
			});

		return () => {
			cancelled = true;
			void supabase.removeChannel(channel);
		};
	}, [supabase, oltHost]);

	const readings = useMemo(() => {
		return Array.from(byId.values()).sort((a, b) =>
			a.ont_logical_id.localeCompare(b.ont_logical_id, undefined, {
				numeric: true,
			}),
		);
	}, [byId]);

	return { readings, connected, lastEventAt };
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
