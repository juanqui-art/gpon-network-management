import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HistoryTrigger } from "../decide/history-trigger.js";
import type { OntReading } from "../parser/ont-parser.js";

interface PersistOptions {
	url: string;
	serviceKey: string;
	networkId: string;
	oltHost: string;
}

// Fila a upsertar en ont_current_state. `last_seen_at` solo va presente en
// ONTs online: si se omite, PostgREST no incluye la columna en el
// ON CONFLICT DO UPDATE y el valor previo se conserva.
export interface CurrentStateRow {
	network_id: string;
	ont_serial: string | null;
	ont_logical_id: string;
	ont_description: string | null;
	olt_host: string;
	pon_port: string | null;
	rx_power_dbm: number | null;
	tx_power_dbm: number | null;
	temperature_c: number | null;
	status: OntReading["status"];
	distance_m: number | null;
	last_disconnect_reason: string | null;
	last_seen_at?: string;
}

export interface StateBatches {
	// ONTs online: actualizan last_seen_at.
	seen: CurrentStateRow[];
	// ONTs no online: last_seen_at omitido para no borrar la última conexión
	// conocida (es justo el dato que se necesita cuando la ONT está caída).
	unseen: CurrentStateRow[];
}

// Separa las filas en dos lotes de columnas homogéneas. Un UPSERT bulk de
// PostgREST usa la unión de claves de todas las filas, así que mezclar filas
// con y sin last_seen_at haría que las offline lo sobrescriban con NULL.
export function buildStateBatches(
	items: OntWithTrigger[],
	ctx: { networkId: string; oltHost: string; now: string },
): StateBatches {
	const batches: StateBatches = { seen: [], unseen: [] };
	for (const { reading } of items) {
		const row: CurrentStateRow = {
			network_id: ctx.networkId,
			ont_serial: reading.ontSerial,
			ont_logical_id: reading.ontLogicalId,
			ont_description: reading.ontDescription,
			olt_host: ctx.oltHost,
			pon_port: reading.pon_port || null,
			rx_power_dbm: reading.rxPowerDbm,
			tx_power_dbm: reading.txPowerDbm,
			temperature_c: reading.temperatureC,
			status: reading.status,
			distance_m: reading.distanceM,
			last_disconnect_reason: reading.lastDisconnectReason,
		};
		if (reading.status === "online") {
			row.last_seen_at = ctx.now;
			batches.seen.push(row);
		} else {
			batches.unseen.push(row);
		}
	}
	return batches;
}

interface HistoryRow {
	ont_current_state_id: string;
	network_id: string;
	ont_logical_id: string;
	rx_power_dbm: number | null;
	tx_power_dbm: number | null;
	status: OntReading["status"];
	trigger: Exclude<HistoryTrigger, null>;
}

export interface OntWithTrigger {
	reading: OntReading;
	trigger: HistoryTrigger;
}

export class SupabasePersister {
	private readonly client: SupabaseClient;

	constructor(private readonly opts: PersistOptions) {
		this.client = createClient(opts.url, opts.serviceKey, {
			auth: { persistSession: false, autoRefreshToken: false },
		});
	}

	// Upserta el estado actual y, para los que tengan trigger, inserta la fila
	// correspondiente en ont_signal_history. Hasta 3 round-trips a Supabase
	// (upsert online, upsert no-online, insert historia).
	async persist(items: OntWithTrigger[]): Promise<{
		upserted: number;
		historyInserted: number;
	}> {
		if (items.length === 0) return { upserted: 0, historyInserted: 0 };

		const { seen, unseen } = buildStateBatches(items, {
			networkId: this.opts.networkId,
			oltHost: this.opts.oltHost,
			now: new Date().toISOString(),
		});

		// Mapa logical_id → id para construir las filas de historia
		const idByLogicalId = new Map<string, string>();
		for (const batch of [seen, unseen]) {
			if (batch.length === 0) continue;
			const { data, error } = await this.client
				.from("ont_current_state")
				.upsert(batch, { onConflict: "network_id,ont_logical_id" })
				.select("id, ont_logical_id");
			if (error) {
				throw new Error(`upsert ont_current_state failed: ${error.message}`);
			}
			for (const row of data ?? []) {
				idByLogicalId.set(row.ont_logical_id, row.id);
			}
		}

		const historyRows: HistoryRow[] = [];
		for (const { reading, trigger } of items) {
			if (trigger === null) continue;
			const stateId = idByLogicalId.get(reading.ontLogicalId);
			if (!stateId) continue;
			historyRows.push({
				ont_current_state_id: stateId,
				network_id: this.opts.networkId,
				ont_logical_id: reading.ontLogicalId,
				rx_power_dbm: reading.rxPowerDbm,
				tx_power_dbm: reading.txPowerDbm,
				status: reading.status,
				trigger,
			});
		}

		if (historyRows.length > 0) {
			const { error: historyError } = await this.client
				.from("ont_signal_history")
				.insert(historyRows);
			if (historyError) {
				throw new Error(
					`insert ont_signal_history failed: ${historyError.message}`,
				);
			}
		}

		return {
			upserted: idByLogicalId.size,
			historyInserted: historyRows.length,
		};
	}
}
