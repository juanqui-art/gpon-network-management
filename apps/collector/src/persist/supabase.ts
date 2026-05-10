import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HistoryTrigger } from "../decide/history-trigger.js";
import type { OntReading } from "../parser/ont-parser.js";

interface PersistOptions {
	url: string;
	serviceKey: string;
	networkId: string;
	oltHost: string;
}

// Fila a upsertar en ont_current_state. Coincide 1:1 con la tabla.
interface CurrentStateRow {
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
	last_seen_at: string | null;
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
	// correspondiente en ont_signal_history. Hace 2 round-trips a Supabase.
	async persist(items: OntWithTrigger[]): Promise<{
		upserted: number;
		historyInserted: number;
	}> {
		if (items.length === 0) return { upserted: 0, historyInserted: 0 };

		const now = new Date().toISOString();

		const stateRows: CurrentStateRow[] = items.map(({ reading }) => ({
			network_id: this.opts.networkId,
			ont_serial: reading.ontSerial,
			ont_logical_id: reading.ontLogicalId,
			ont_description: reading.ontDescription,
			olt_host: this.opts.oltHost,
			pon_port: reading.pon_port || null,
			rx_power_dbm: reading.rxPowerDbm,
			tx_power_dbm: reading.txPowerDbm,
			temperature_c: reading.temperatureC,
			status: reading.status,
			distance_m: reading.distanceM,
			last_disconnect_reason: reading.lastDisconnectReason,
			last_seen_at: reading.status === "online" ? now : null,
		}));

		const { data: upserted, error: upsertError } = await this.client
			.from("ont_current_state")
			.upsert(stateRows, { onConflict: "network_id,ont_logical_id" })
			.select("id, ont_logical_id");

		if (upsertError) {
			throw new Error(`upsert ont_current_state failed: ${upsertError.message}`);
		}

		// Mapa logical_id → id para construir las filas de historia
		const idByLogicalId = new Map<string, string>();
		for (const row of upserted ?? []) {
			idByLogicalId.set(row.ont_logical_id, row.id);
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
			upserted: upserted?.length ?? 0,
			historyInserted: historyRows.length,
		};
	}
}
