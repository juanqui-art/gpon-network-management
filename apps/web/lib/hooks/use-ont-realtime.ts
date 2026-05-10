"use client";

import type {
	RealtimeChannel,
	RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OntCurrentState } from "@/lib/types/gpon";

interface UseOntRealtimeArgs {
	networkId: string;
	initialReadings: OntCurrentState[];
}

export interface OntRealtimeState {
	readings: OntCurrentState[];
	connected: boolean;
	lastEventAt: Date | null;
}

// Mantiene el estado vivo de las ONTs de una red. Carga inicial via SSR
// (initialReadings), después escucha cambios por Realtime.
//
// Política frente a desconexión: la suscripción de Supabase reintenta sola.
// Cuando el canal vuelve a SUBSCRIBED, hacemos un refetch completo para
// recuperar cualquier evento perdido durante el corte.
export function useOntRealtime({
	networkId,
	initialReadings,
}: UseOntRealtimeArgs): OntRealtimeState {
	const supabase = useMemo(() => createClient(), []);

	const [byLogicalId, setByLogicalId] = useState<Map<string, OntCurrentState>>(
		() => buildMap(initialReadings),
	);
	const [connected, setConnected] = useState(false);
	const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

	// Stable ref con el setter para que el callback de Supabase no necesite
	// dependencias dinámicas
	const setByLogicalIdRef = useRef(setByLogicalId);
	setByLogicalIdRef.current = setByLogicalId;

	useEffect(() => {
		let cancelled = false;
		const channel: RealtimeChannel = supabase
			.channel(`ont-monitoring:${networkId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "ont_current_state",
					filter: `network_id=eq.${networkId}`,
				},
				(payload: RealtimePostgresChangesPayload<OntCurrentState>) => {
					setLastEventAt(new Date());
					setByLogicalIdRef.current((prev) => applyChange(prev, payload));
				},
			)
			.subscribe((status) => {
				if (cancelled) return;
				if (status === "SUBSCRIBED") {
					setConnected(true);
					// Refetch para reconciliar después de (re)conectar
					void refetch(supabase, networkId).then((rows) => {
						if (cancelled) return;
						setByLogicalIdRef.current(buildMap(rows));
					});
				} else if (status === "CHANNEL_ERROR" || status === "CLOSED") {
					setConnected(false);
				}
			});

		return () => {
			cancelled = true;
			void supabase.removeChannel(channel);
		};
	}, [supabase, networkId]);

	// Convertimos el Map a array ordenado por logical_id solo cuando cambia.
	const readings = useMemo(() => {
		return Array.from(byLogicalId.values()).sort((a, b) =>
			a.ont_logical_id.localeCompare(b.ont_logical_id, undefined, {
				numeric: true,
			}),
		);
	}, [byLogicalId]);

	return { readings, connected, lastEventAt };
}

function buildMap(rows: OntCurrentState[]): Map<string, OntCurrentState> {
	const map = new Map<string, OntCurrentState>();
	for (const row of rows) {
		map.set(row.ont_logical_id, row);
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
		if (oldRow?.ont_logical_id) {
			next.delete(oldRow.ont_logical_id);
		}
		return next;
	}

	const newRow = payload.new as OntCurrentState | undefined;
	if (newRow?.ont_logical_id) {
		next.set(newRow.ont_logical_id, newRow);
	}
	return next;
}

async function refetch(
	supabase: ReturnType<typeof createClient>,
	networkId: string,
): Promise<OntCurrentState[]> {
	const { data, error } = await supabase
		.from("ont_current_state")
		.select("*")
		.eq("network_id", networkId);
	if (error) {
		console.error("ont_current_state refetch failed", error);
		return [];
	}
	return (data ?? []) as OntCurrentState[];
}
