// Lectura cruda de SNMP — antes de aplicar conversiones (rx_power /100, status mapping).
// Cada fila representa una ONT. Los campos son opcionales porque el OLT puede no
// devolver todas las columnas en cada fila (ej: ONT offline puede no tener rx_power).
export interface RawOntRow {
	logicalId: string; // "<olt_port>.<ont_id>" — identificador SNMP
	oltPort: string; // primera parte del index
	ontId: string; // segunda parte del index
	statusRaw?: number;
	rxPowerRaw?: number; // INT antes de dividir entre 100
	txPowerRaw?: number;
	temperatureRaw?: number;
	distanceM?: number;
	lastDisconnectReason?: string;
	serial?: string;
	description?: string;
}

export interface SnmpSession {
	pollOnts(): Promise<RawOntRow[]>;
	close(): void;
}
