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

// Mapea el status SNMP de Huawei a nuestro ENUM de DB
export function mapHuaweiStatus(
	rawStatus: number,
): "online" | "offline" | "los" | "lof" | "unknown" {
	return STATUS_MAP[rawStatus] ?? "unknown";
}

// Construye el ont_logical_id a partir del index SNMP devuelto por tableColumns
// Formato: "<olt_port>.<ont_id>" (ej: "4194312192.5")
// El olt_port codifica F/S/P (frame/slot/port) — no lo decodificamos aquí,
// se queda como identificador opaco. La decodificación humana ("0/2/1") se hace
// en otro punto si hace falta.
export function buildLogicalId(oltPort: string, ontId: string): string {
	return `${oltPort}.${ontId}`;
}

// Decodifica el olt_port codificado a F/S/P legible.
// Huawei usa: base + slot * baseStep + port. baseStep ≈ 8192 entre slots.
// Esta función es heurística — para diagnóstico, no para identidad.
export function decodeOltPort(encoded: number): string {
	// Implementación pendiente: requiere validar con OLT real.
	// Por ahora retornamos el valor crudo como string.
	return String(encoded);
}
