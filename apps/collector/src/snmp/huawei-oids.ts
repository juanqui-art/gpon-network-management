// OIDs Huawei MA5600T / MA5603T / MA5608T (verificados en docs/REALTIME_MONITORING_RESEARCH.md)
//
// Las columnas se especifican como número (último segmento del OID) cuando se usa
// session.tableColumns(baseOid, columns). Para hacer un walk completo de un atributo,
// usar el OID completo con session.subtree.

export const HUAWEI_OID = {
	// Tablas: pasar a session.tableColumns(BASE, [colNumber])
	ONT_BASE: "1.3.6.1.4.1.2011.6.128.1.1.2",

	// Columnas dentro de ONT_BASE — formato: <subtree>.<column>
	STATUS: { subtree: "62", column: 22 }, // 1=online, 2=offline
	RX_POWER: { subtree: "51", column: 4 }, // INT, dividir entre 100 → dBm
	TX_POWER: { subtree: "51", column: 6 }, // INT, dividir entre 100 → dBm (OLT recibe de ONT)
	TEMPERATURE: { subtree: "51", column: 1 }, // INT en grados Celsius
	DISTANCE: { subtree: "46", column: 20 }, // INT en metros
	LAST_DISCONNECT_REASON: { subtree: "46", column: 24 }, // String
	SERIAL: { subtree: "43", column: 1 }, // String — número de serie HWTC
	DESCRIPTION: { subtree: "43", column: 9 }, // String — descripción configurada
} as const;

// Tipos de status que devuelve el OLT por SNMP
const STATUS_MAP: Record<number, "online" | "offline" | "los" | "lof"> = {
	1: "online",
	2: "offline",
	3: "los",
	4: "lof",
};

// dBm = INTEGER / 100. SNMP devuelve enteros para evitar floats.
// Ej: -1311 → -13.11 dBm
export function snmpIntToDbm(value: number): number {
	return Number((value / 100).toFixed(2));
}

// Huawei reporta 2147483647 (0x7FFFFFFF) en las columnas DDM/distancia cuando
// no hay lectura (ONT offline, sin luz, módulo sin DDM). Sin filtrar, 2147483647
// / 100 = 21474836.47 dBm desborda numeric(5,2) en ont_current_state y Postgres
// rechaza el UPSERT del lote completo — una sola ONT caída tumba toda la OLT.
export const HUAWEI_INVALID_INT = 2147483647;

// Rangos físicamente plausibles. Cualquier valor fuera se trata como "sin dato"
// (null) en lugar de persistir basura. También garantizan que el valor cabe en
// las columnas: rx/tx numeric(5,2), temperature numeric(4,1), distance integer.
const OPTICAL_POWER_DBM_RANGE = { min: -50, max: 10 } as const;
const TEMPERATURE_C_RANGE = { min: -40, max: 125 } as const;
// GPON admite hasta 60 km de distancia lógica (ITU-T G.984); margen extra.
const DISTANCE_M_RANGE = { min: 0, max: 100_000 } as const;

function inRange(
	value: number,
	range: { readonly min: number; readonly max: number },
): boolean {
	return value >= range.min && value <= range.max;
}

function isUsableRaw(raw: number | undefined): raw is number {
	return (
		typeof raw === "number" &&
		Number.isFinite(raw) &&
		raw !== HUAWEI_INVALID_INT &&
		raw !== -HUAWEI_INVALID_INT - 1
	);
}

// Potencia óptica (rx/tx) en dBm, o null si el OLT no tiene lectura válida.
export function parseOpticalPowerDbm(raw: number | undefined): number | null {
	if (!isUsableRaw(raw)) return null;
	const dbm = snmpIntToDbm(raw);
	return inRange(dbm, OPTICAL_POWER_DBM_RANGE) ? dbm : null;
}

export function parseTemperatureC(raw: number | undefined): number | null {
	if (!isUsableRaw(raw)) return null;
	return inRange(raw, TEMPERATURE_C_RANGE) ? raw : null;
}

export function parseDistanceM(raw: number | undefined): number | null {
	if (!isUsableRaw(raw)) return null;
	return Number.isInteger(raw) && inRange(raw, DISTANCE_M_RANGE) ? raw : null;
}

// Mapea el status SNMP de Huawei a nuestro ENUM de DB
export function mapHuaweiStatus(
	rawStatus: number,
): "online" | "offline" | "los" | "lof" | "unknown" {
	return STATUS_MAP[rawStatus] ?? "unknown";
}

const HUAWEI_GPON_TYPE = 125;
const HUAWEI_TYPE_SHIFT = 25;
const HUAWEI_FRAME_SHIFT = 19;
const HUAWEI_SLOT_SHIFT = 13;
const HUAWEI_PORT_SHIFT = 8;
const HUAWEI_TYPE_BLOCK = 2 ** HUAWEI_TYPE_SHIFT;
const HUAWEI_FRAME_BLOCK = 2 ** HUAWEI_FRAME_SHIFT;
const HUAWEI_SLOT_BLOCK = 2 ** HUAWEI_SLOT_SHIFT;
const HUAWEI_PORT_BLOCK = 2 ** HUAWEI_PORT_SHIFT;

// Construye el ont_logical_id a partir del index SNMP devuelto por los walks.
// Formato: "<olt_port>.<ont_id>" (ej: "4194312192.5").
// Este identificador se mantiene crudo porque es la identidad estable que usa SNMP.
export function buildLogicalId(oltPort: string, ontId: string): string {
	return `${oltPort}.${ontId}`;
}

// Decodifica el olt_port codificado a F/S/P legible.
// Huawei compone el ifIndex GPON aproximadamente así:
//   (125 << 25) + (frame << 19) + (slotIndex << 13) + (portIndex << 8)
// En la UI usamos la convención operativa documentada del proyecto:
//   4194312192 -> 0/2/1
// Por eso frame queda 0-based, y slot/port se muestran 1-based.
export function decodeOltPort(encoded: number | string): string {
	const numeric =
		typeof encoded === "number" ? encoded : Number.parseInt(encoded, 10);

	if (!Number.isSafeInteger(numeric) || numeric < 0) {
		return String(encoded);
	}

	const type = Math.floor(numeric / HUAWEI_TYPE_BLOCK);
	if (type !== HUAWEI_GPON_TYPE) {
		return String(encoded);
	}

	let remainder = numeric - type * HUAWEI_TYPE_BLOCK;
	const frame = Math.floor(remainder / HUAWEI_FRAME_BLOCK);
	remainder -= frame * HUAWEI_FRAME_BLOCK;

	const slotIndex = Math.floor(remainder / HUAWEI_SLOT_BLOCK);
	remainder -= slotIndex * HUAWEI_SLOT_BLOCK;

	const portIndex = Math.floor(remainder / HUAWEI_PORT_BLOCK);

	return `${frame}/${slotIndex + 1}/${portIndex + 1}`;
}
