import { describe, expect, it } from "vitest";
import type { OntReading } from "../parser/ont-parser.js";
import { StateChangeTracker } from "./state-change.js";

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

function tracker(): StateChangeTracker {
	return new StateChangeTracker({ powerDeltaDb: 0.5, temperatureDeltaC: 2 });
}

describe("StateChangeTracker", () => {
	it("escribe una ONT vista por primera vez", () => {
		expect(tracker().hasMaterialChange(reading())).toBe(true);
	});

	it("omite una lectura idéntica a la última escrita", () => {
		const t = tracker();
		t.commit([reading()]);
		expect(t.hasMaterialChange(reading())).toBe(false);
	});

	it("omite fluctuaciones de potencia por debajo del umbral", () => {
		const t = tracker();
		t.commit([reading()]);
		expect(t.hasMaterialChange(reading({ rxPowerDbm: -18.4 }))).toBe(false);
		expect(t.hasMaterialChange(reading({ temperatureC: 36 }))).toBe(false);
	});

	it("escribe cuando la potencia o la temperatura superan el umbral", () => {
		const t = tracker();
		t.commit([reading()]);
		expect(t.hasMaterialChange(reading({ rxPowerDbm: -18.5 }))).toBe(true);
		expect(t.hasMaterialChange(reading({ txPowerDbm: 1.5 }))).toBe(true);
		expect(t.hasMaterialChange(reading({ temperatureC: 37 }))).toBe(true);
	});

	it("compara contra lo último escrito, así la deriva acumulada se detecta", () => {
		const t = tracker();
		t.commit([reading()]);
		// Tres polls de -0.2 dB: ninguno solo supera 0.5, pero la deriva sí.
		expect(t.hasMaterialChange(reading({ rxPowerDbm: -18.2 }))).toBe(false);
		expect(t.hasMaterialChange(reading({ rxPowerDbm: -18.4 }))).toBe(false);
		expect(t.hasMaterialChange(reading({ rxPowerDbm: -18.6 }))).toBe(true);
	});

	it("escribe cambios de status y de telemetría que pasa a null", () => {
		const t = tracker();
		t.commit([reading()]);
		expect(
			t.hasMaterialChange(
				reading({
					status: "los",
					rxPowerDbm: null,
					txPowerDbm: null,
					temperatureC: null,
					lastDisconnectReason: "los",
				}),
			),
		).toBe(true);
		expect(t.hasMaterialChange(reading({ rxPowerDbm: null }))).toBe(true);
	});

	it("escribe cambios de identidad o posición", () => {
		const t = tracker();
		t.commit([reading()]);
		expect(t.hasMaterialChange(reading({ distanceM: 900 }))).toBe(true);
		expect(t.hasMaterialChange(reading({ ontDescription: "OTRO" }))).toBe(true);
	});

	it("hasMaterialChange no modifica la memoria (commit solo tras persistir)", () => {
		const t = tracker();
		const changed = reading({ status: "offline" });
		t.commit([reading()]);
		expect(t.hasMaterialChange(changed)).toBe(true);
		// Si el persist falló y no hubo commit, el cambio se reintenta.
		expect(t.hasMaterialChange(changed)).toBe(true);
		t.commit([changed]);
		expect(t.hasMaterialChange(changed)).toBe(false);
	});
});
