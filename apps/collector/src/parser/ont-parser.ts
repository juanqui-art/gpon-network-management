import {
	decodeOltPort,
	mapHuaweiStatus,
	snmpIntToDbm,
} from "../snmp/huawei-oids.js";
import type { RawOntRow } from "../snmp/types.js";

// Lectura ya tipada y convertida — lista para persistir en Supabase.
// Coincide 1:1 con las columnas de ont_current_state.
export interface OntReading {
	ontLogicalId: string;
	ontSerial: string | null;
	ontDescription: string | null;
	pon_port: string; // legible si lo decodificamos, o el raw oltPort por ahora
	rxPowerDbm: number | null;
	txPowerDbm: number | null;
	temperatureC: number | null;
	status: "online" | "offline" | "los" | "lof" | "unknown";
	distanceM: number | null;
	lastDisconnectReason: string | null;
}

export function parseOntRows(rows: RawOntRow[]): OntReading[] {
	return rows.map((row) => ({
		ontLogicalId: row.logicalId,
		ontSerial: row.serial ?? null,
		ontDescription: row.description ?? null,
		pon_port: decodeOltPort(row.oltPort),
		rxPowerDbm:
			typeof row.rxPowerRaw === "number" ? snmpIntToDbm(row.rxPowerRaw) : null,
		txPowerDbm:
			typeof row.txPowerRaw === "number" ? snmpIntToDbm(row.txPowerRaw) : null,
		temperatureC:
			typeof row.temperatureRaw === "number" ? row.temperatureRaw : null,
		status:
			typeof row.statusRaw === "number"
				? mapHuaweiStatus(row.statusRaw)
				: "unknown",
		distanceM: typeof row.distanceM === "number" ? row.distanceM : null,
		lastDisconnectReason: row.lastDisconnectReason ?? null,
	}));
}
