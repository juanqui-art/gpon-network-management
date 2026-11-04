import { describe, expect, it } from "vitest";
import type { OntReading } from "../parser/ont-parser.js";
import { HistoryDecider } from "./history-trigger.js";

function reading(overrides: Partial<OntReading> = {}): OntReading {
	return {
		ontLogicalId: "4194312192.1",
		ontSerial: "HWTC00000001",
		ontDescription: "CLIENTE-1",
		pon_port: "0/2/1",
		rxPowerDbm: -18,
		txPowerDbm: 2,
		temperatureC: 35,
		status: "online",
		distanceM: 850,
		lastDisconnectReason: null,
		...overrides,
	};
}

function decider(sampleEveryNPolls = 10): HistoryDecider {
	return new HistoryDecider({ degradationThresholdDb: 1.5, sampleEveryNPolls });
}

describe("HistoryDecider", () => {
	it("registra el primer encuentro como change", () => {
		expect(decider().decide(reading())).toBe("change");
	});

	it("registra cambios de status", () => {
		const d = decider();
		d.decide(reading());
		expect(d.decide(reading({ status: "los", rxPowerDbm: null }))).toBe(
			"change",
		);
		expect(d.decide(reading())).toBe("change");
	});

	it("registra degradación cuando |Δrx| alcanza el umbral", () => {
		const d = decider();
		d.decide(reading());
		expect(d.decide(reading({ rxPowerDbm: -19.4 }))).toBeNull();
		expect(d.decide(reading({ rxPowerDbm: -19.5 }))).toBe("degradation");
	});

	it("no evalúa degradación si falta una de las dos lecturas", () => {
		const d = decider();
		d.decide(reading({ rxPowerDbm: null }));
		expect(d.decide(reading({ rxPowerDbm: -25 }))).toBeNull();
	});

	it("con una ONT estable guarda exactamente 1 de cada N polls", () => {
		// Documenta el piso real de volumen: con N=10 se guarda ≥10% de los
		// polls por ONT, así que la reducción máxima es 90% (no ~94%).
		const d = decider(10);
		d.decide(reading()); // primer encuentro
		const triggers = Array.from({ length: 100 }, () => d.decide(reading()));
		expect(triggers.filter((t) => t === "sample")).toHaveLength(10);
		expect(triggers.filter((t) => t !== null)).toHaveLength(10);
	});

	it("un change reinicia el contador de muestra", () => {
		const d = decider(3);
		d.decide(reading());
		d.decide(reading()); // 1
		d.decide(reading()); // 2
		expect(d.decide(reading({ status: "offline" }))).toBe("change");
		expect(d.decide(reading({ status: "offline" }))).toBeNull();
		expect(d.decide(reading({ status: "offline" }))).toBeNull();
		expect(d.decide(reading({ status: "offline" }))).toBe("sample");
	});

	it("mantiene memoria independiente por ONT", () => {
		const d = decider();
		d.decide(reading({ ontLogicalId: "a" }));
		expect(d.decide(reading({ ontLogicalId: "b" }))).toBe("change");
		expect(d.decide(reading({ ontLogicalId: "a" }))).toBeNull();
	});
});
