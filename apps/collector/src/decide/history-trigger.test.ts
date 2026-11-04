import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OntReading } from "../parser/ont-parser.js";
import { HistoryDecider } from "./history-trigger.js";

function reading(
	status: OntReading["status"],
	rxPowerDbm: number | null,
): OntReading {
	return {
		ontLogicalId: "p.1",
		ontSerial: null,
		ontDescription: null,
		pon_port: "0/2/1",
		rxPowerDbm,
		txPowerDbm: null,
		temperatureC: null,
		status,
		distanceM: null,
		lastDisconnectReason: null,
	};
}

function decider() {
	return new HistoryDecider({
		degradationThresholdDb: 1.5,
		sampleEveryNPolls: 3,
	});
}

describe("HistoryDecider", () => {
	it("records the first sighting of an ONT as a change", () => {
		assert.equal(decider().decide(reading("online", -18)), "change");
	});

	it("records status transitions", () => {
		const d = decider();
		d.decide(reading("online", -18));
		assert.equal(d.decide(reading("offline", null)), "change");
		assert.equal(d.decide(reading("online", -18)), "change");
	});

	it("records rx degradation relative to the last stored value", () => {
		const d = decider();
		d.decide(reading("online", -18));
		assert.equal(d.decide(reading("online", -18.8)), null);
		// -18 → -19.6: drift acumulado de 1.6 dB respecto al último guardado
		assert.equal(d.decide(reading("online", -19.6)), "degradation");
	});

	it("does not treat a missing reading as degradation", () => {
		const d = decider();
		d.decide(reading("online", -18));
		assert.equal(d.decide(reading("online", null)), null);
	});

	it("takes a periodic sample every N quiet polls", () => {
		const d = decider();
		d.decide(reading("online", -18));
		assert.equal(d.decide(reading("online", -18)), null);
		assert.equal(d.decide(reading("online", -18)), null);
		assert.equal(d.decide(reading("online", -18)), "sample");
		assert.equal(d.decide(reading("online", -18)), null);
	});
});
