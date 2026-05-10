import type { OntReading } from "../parser/ont-parser.js";

export type HistoryTrigger = "change" | "degradation" | "sample" | null;

// Memoria por ONT: último estado guardado en historia + contador de polls.
interface OntMemory {
	lastStatus: OntReading["status"];
	lastRxPowerDbm: number | null;
	pollsSinceSample: number;
}

export interface HistoryDecisionConfig {
	degradationThresholdDb: number;
	sampleEveryNPolls: number;
}

export class HistoryDecider {
	private readonly memory = new Map<string, OntMemory>();

	constructor(private readonly config: HistoryDecisionConfig) {}

	// Devuelve el trigger si vale la pena guardar en signal_history, o null
	// si no hay nada relevante. Mutaciones de memoria ocurren acá.
	decide(reading: OntReading): HistoryTrigger {
		const previous = this.memory.get(reading.ontLogicalId);

		// Primer encuentro de esta ONT — guardar como "change" (estado inicial)
		if (!previous) {
			this.memory.set(reading.ontLogicalId, {
				lastStatus: reading.status,
				lastRxPowerDbm: reading.rxPowerDbm,
				pollsSinceSample: 0,
			});
			return "change";
		}

		previous.pollsSinceSample += 1;

		// Cambio de status: prioridad alta
		if (previous.lastStatus !== reading.status) {
			previous.lastStatus = reading.status;
			previous.lastRxPowerDbm = reading.rxPowerDbm;
			previous.pollsSinceSample = 0;
			return "change";
		}

		// Degradación de señal: solo aplica si tenemos lecturas en ambos polls
		if (
			previous.lastRxPowerDbm !== null &&
			reading.rxPowerDbm !== null &&
			Math.abs(reading.rxPowerDbm - previous.lastRxPowerDbm) >=
				this.config.degradationThresholdDb
		) {
			previous.lastRxPowerDbm = reading.rxPowerDbm;
			previous.pollsSinceSample = 0;
			return "degradation";
		}

		// Muestra periódica
		if (previous.pollsSinceSample >= this.config.sampleEveryNPolls) {
			previous.lastRxPowerDbm = reading.rxPowerDbm;
			previous.pollsSinceSample = 0;
			return "sample";
		}

		return null;
	}
}
