import type { OntReading } from "../parser/ont-parser.js";

// Decide si una lectura amerita reescribir su fila en ont_current_state.
//
// Por qué existe: cada UPSERT dispara un evento de Supabase Realtime
// (postgres_changes), que se evalúa contra RLS por cada suscriptor. Reescribir
// todas las ONTs en cada poll inunda el canal aunque nada haya cambiado.
// Con este filtro solo se escriben las ONTs con cambios relevantes; el resto
// se refresca cuando el HistoryDecider emite su muestra periódica.

export interface StateChangeConfig {
	// Variación mínima de rx/tx (dB) frente al último valor escrito.
	powerDeltaDb: number;
	// Variación mínima de temperatura (°C) frente al último valor escrito.
	temperatureDeltaC: number;
}

export class StateChangeTracker {
	private readonly lastWritten = new Map<string, OntReading>();

	constructor(private readonly config: StateChangeConfig) {}

	// Puro: no modifica memoria. Llamar a commit() solo después de persistir
	// con éxito, para que un fallo de red no "olvide" un cambio pendiente.
	hasMaterialChange(reading: OntReading): boolean {
		const previous = this.lastWritten.get(reading.ontLogicalId);
		if (!previous) return true;

		if (
			previous.status !== reading.status ||
			previous.lastDisconnectReason !== reading.lastDisconnectReason ||
			previous.distanceM !== reading.distanceM ||
			previous.ontSerial !== reading.ontSerial ||
			previous.ontDescription !== reading.ontDescription ||
			previous.pon_port !== reading.pon_port
		) {
			return true;
		}

		return (
			exceeds(
				previous.rxPowerDbm,
				reading.rxPowerDbm,
				this.config.powerDeltaDb,
			) ||
			exceeds(
				previous.txPowerDbm,
				reading.txPowerDbm,
				this.config.powerDeltaDb,
			) ||
			exceeds(
				previous.temperatureC,
				reading.temperatureC,
				this.config.temperatureDeltaC,
			)
		);
	}

	commit(readings: OntReading[]): void {
		for (const reading of readings) {
			this.lastWritten.set(reading.ontLogicalId, reading);
		}
	}
}

function exceeds(
	previous: number | null,
	current: number | null,
	delta: number,
): boolean {
	if (previous === null || current === null) return previous !== current;
	return Math.abs(current - previous) >= delta;
}
