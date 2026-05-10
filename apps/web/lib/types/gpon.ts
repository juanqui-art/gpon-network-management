// Domain types for the GPON Infrastructure Editor (MVP).
// Schema: database/migrations/001_initial_schema.sql
// Decisions: docs/adr/0001..0003

// ─── ENUMs ────────────────────────────────────────────────────────────────────

export type UserRole =
	| "admin"
	| "network_engineer"
	| "outside_plant"
	| "installer"
	| "support";

export type ElementType = "olt" | "splitter" | "nap" | "closure";

export type ElementStatus =
	| "planned"
	| "active"
	| "inactive"
	| "faulty"
	| "retired";

export type DataQuality =
	| "unknown"
	| "approximate"
	| "drawn"
	| "gps_captured"
	| "verified";

export type PonStandard = "gpon" | "xgs_pon" | "xg_pon" | "epon";

export type SplitRatio = "1:2" | "1:4" | "1:8" | "1:16" | "1:32" | "1:64";

export type RouteType = "feeder" | "distribution" | "other";

export type RouteStatus =
	| "planned"
	| "installed"
	| "active"
	| "damaged"
	| "retired";

export type InstallationType = "aerial" | "underground" | "duct" | "facade";

export type FiberType = "g652d" | "g657a1" | "g657a2";

export type RoutePointType = "crossing" | "reserve" | "splice" | "mufa";

export type CrossingType = "avenue" | "river" | "railway" | "highway" | "other";

export type RiskLevel = "low" | "medium" | "high" | "critical";

// ─── GeoJSON (PostGIS returns GeoJSON via ST_AsGeoJSON) ───────────────────────

export interface GeoPoint {
	type: "Point";
	coordinates: [longitude: number, latitude: number];
}

export interface GeoLineString {
	type: "LineString";
	coordinates: Array<[longitude: number, latitude: number]>;
}

// ─── INFRASTRUCTURE ELEMENT (OLT / Splitter / NAP / Closure) ─────────────────

export interface InfrastructureElement {
	id: string;
	type: ElementType;
	code: string;
	name: string | null;
	status: ElementStatus;

	location: GeoPoint;
	location_quality: DataQuality;
	address_reference: string | null;

	// type-specific (nullable; split fields apply to standalone splitters or NAPs with internal splitter)
	pon_standard: PonStandard | null;
	total_pon_ports: number | null;
	split_ratio: SplitRatio | null;
	insertion_loss_db: number | null;
	total_ports: number | null;

	// SNMP/CLI management address — solo aplica a OLTs en MVP.
	// Se enlaza con ont_current_state.olt_host en la sección /monitoring.
	management_ip: string | null;

	properties: Record<string, unknown>;
	notes: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
}

// ─── FIBER ROUTE ──────────────────────────────────────────────────────────────

export interface FiberRoute {
	id: string;
	code: string | null;
	type: RouteType;
	status: RouteStatus;

	from_element_id: string | null;
	to_element_id: string | null;

	geometry: GeoLineString;
	route_quality: DataQuality;

	installation_type: InstallationType | null;
	fiber_type: FiberType | null;
	fiber_count: number | null;
	length_meters: number | null;
	reservation_m: number;

	attenuation_db_per_km: number | null;
	splice_loss_db: number | null;
	connector_loss_db: number | null;
	total_loss_db: number | null;

	properties: Record<string, unknown>;
	notes: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
}

// ─── ROUTE POINT (crossing / reserve / splice) ────────────────────────────────

export interface RoutePoint {
	id: string;
	fiber_route_id: string;
	type: RoutePointType;
	code: string | null;
	status: string | null;

	location: GeoPoint;
	location_quality: DataQuality;
	position_on_route_m: number | null;

	// type-specific
	reserve_length_m: number | null;
	splice_loss_db: number | null;
	crossing_type: CrossingType | null;
	risk_level: RiskLevel | null;
	reference_text: string | null;

	properties: Record<string, unknown>;
	notes: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
}

// ─── NETWORK ZONE ─────────────────────────────────────────────────────────────

export interface NetworkZone {
	id: string;
	network_id: string;
	zone_code: string; // Z01, Z05, Z10, Z20
	zone_name: string; // "Sector norte", "Centro", "Zona sur"
	description: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

// ─── OPTICAL REFERENCE VALUES ────────────────────────────────────────────────

// Splitter insertion loss in dB (industry typical values).
// Used as default when the operator does not provide a measured value.
export const SPLITTER_INSERTION_LOSS_DB: Record<SplitRatio, number> = {
	"1:2": 3.5,
	"1:4": 7.2,
	"1:8": 10.5,
	"1:16": 13.8,
	"1:32": 17.1,
	"1:64": 20.5,
};

// GPON operating range at the ONT (rx_power_dbm).
// ITU-T G.984 reference: -8 dBm (saturation) to -28 dBm (sensitivity).
export const GPON_OPERATING_RANGE_DBM = {
	max: -8,
	good: -20,
	warning: -25,
	min: -28,
} as const;

export type SignalClassification = "good" | "warning" | "critical" | "unknown";

export function classifySignal(
	rx_power_dbm: number | null,
): SignalClassification {
	if (rx_power_dbm === null) return "unknown";
	if (rx_power_dbm >= GPON_OPERATING_RANGE_DBM.good) return "good";
	if (rx_power_dbm >= GPON_OPERATING_RANGE_DBM.warning) return "warning";
	return "critical";
}

// ─── PERMISSIONS ──────────────────────────────────────────────────────────────

// Roles that can create/edit infrastructure directly (matches RLS).
// outside_plant verifies/proposes field corrections, but does not write the
// source-of-truth infrastructure tables directly in the current flow.
export const INFRASTRUCTURE_WRITE_ROLES: ReadonlyArray<UserRole> = [
	"admin",
	"network_engineer",
];

export function canWriteInfrastructure(
	role: UserRole | null | undefined,
): boolean {
	return (
		role !== null &&
		role !== undefined &&
		INFRASTRUCTURE_WRITE_ROLES.includes(role)
	);
}

export function canDeleteInfrastructure(
	role: UserRole | null | undefined,
): boolean {
	return role === "admin";
}

// ─── ONT MONITORING (telemetría en tiempo real, migración 021) ───────────────

export type OntStatus = "online" | "offline" | "los" | "lof" | "unknown";

export type OntHistoryTrigger = "change" | "degradation" | "sample";

// Espejo de ont_current_state — estado vivo de cada ONT.
export interface OntCurrentState {
	id: string;
	network_id: string;
	ont_serial: string | null;
	ont_logical_id: string;
	ont_description: string | null;
	olt_host: string;
	pon_port: string | null;
	rx_power_dbm: number | null;
	tx_power_dbm: number | null;
	temperature_c: number | null;
	status: OntStatus;
	distance_m: number | null;
	last_disconnect_reason: string | null;
	last_seen_at: string | null;
	created_at: string;
	updated_at: string;
}

// Fila individual de ont_signal_history.
export interface OntSignalHistoryEntry {
	id: string;
	ont_current_state_id: string;
	network_id: string;
	ont_logical_id: string;
	rx_power_dbm: number | null;
	tx_power_dbm: number | null;
	status: OntStatus;
	trigger: OntHistoryTrigger;
	recorded_at: string;
}

// Resumen agregado de salud — usado en /monitoring tanto a nivel global (por OLT)
// como dentro del detalle. Los conteos son los mismos sin importar cómo se agrupe;
// el contexto del agrupador (OLT, red) se mantiene fuera del struct.
export interface OntHealthSummary {
	total: number;
	online: number;
	offline: number;
	los: number;
	lof: number;
	unknown: number;
	warning_signal: number; // ONTs online pero con rx_power en zona de alerta
	last_update: string | null;
}

// Entrada del índice /monitoring — una OLT con su contexto (red(es) a las que sirve)
// y, cuando el match con infrastructure_elements existe, su nombre/código humano.
export interface OltMonitorEntry {
	olt_host: string;
	// Match con infrastructure_elements.management_ip (null si no hay match)
	element_id: string | null;
	element_code: string | null;
	element_name: string | null;
	element_model: string | null; // "Huawei MA5608T", etc.
	element_total_pon_ports: number | null;
	network_ids: string[]; // normalmente 1, soporta caso de OLT que sirve a varias redes
	network_names: string[];
	health: OntHealthSummary;
}

export const ONT_STATUS_LABELS: Record<OntStatus, string> = {
	online: "Online",
	offline: "Offline",
	los: "Pérdida de señal",
	lof: "Pérdida de trama",
	unknown: "Desconocido",
};

// Considera una ONT "saludable" si está online Y la señal no está en warning/critical.
export function isOntHealthy(reading: OntCurrentState): boolean {
	if (reading.status !== "online") return false;
	const signal = classifySignal(reading.rx_power_dbm);
	return signal === "good";
}

// Calcula los segundos transcurridos desde el último contacto reportado.
export function secondsSinceLastSeen(
	lastSeenAt: string | null,
	now: Date = new Date(),
): number | null {
	if (!lastSeenAt) return null;
	const seen = new Date(lastSeenAt).getTime();
	if (Number.isNaN(seen)) return null;
	return Math.floor((now.getTime() - seen) / 1000);
}
