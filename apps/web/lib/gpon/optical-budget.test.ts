import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	calculateOpticalBudget,
	classifyMargin,
	getMarginColor,
	OPTICAL_STATUS_COLOR,
	type OpticalBudgetInput,
} from "./optical-budget";

// Fibra a 0.3 dB/km (1490 nm), 2 conectores × 0.5 dB, sin empalmes,
// margen de seguridad 3 dB. Pérdida física = fibra + splitter + 1.0 dB.
function budget(overrides: Partial<OpticalBudgetInput>) {
	return calculateOpticalBudget({
		lengthMeters: 1000,
		fiberType: null,
		splitRatio: "1:32",
		ponClass: "B+",
		...overrides,
	});
}

describe("classifyMargin (GPON_FTTH_ECUADOR_RESEARCH.md §Semaforo)", () => {
	it("green above 3 dB, yellow from 1 to 3 dB inclusive, red below 1 dB", () => {
		assert.equal(classifyMargin(3.01), "green");
		assert.equal(classifyMargin(3), "yellow");
		assert.equal(classifyMargin(1), "yellow");
		assert.equal(classifyMargin(0.99), "red");
		assert.equal(classifyMargin(-4), "red");
	});

	it("getMarginColor follows the same thresholds", () => {
		assert.equal(getMarginColor(5), OPTICAL_STATUS_COLOR.green);
		assert.equal(getMarginColor(2), OPTICAL_STATUS_COLOR.yellow);
		assert.equal(getMarginColor(0.5), OPTICAL_STATUS_COLOR.red);
		assert.equal(getMarginColor(null), "#858585");
	});
});

describe("calculateOpticalBudget", () => {
	it("includes the 3 dB safety margin in total loss", () => {
		const r = budget({ lengthMeters: 2000, splitRatio: "1:32" });
		// 0.6 fibra + 17.0 splitter + 1.0 conectores + 3.0 seguridad
		assert.equal(r.totalLoss, 21.6);
		assert.equal(r.safetyMargin, 3);
		assert.equal(r.margin, 6.4); // B+ 28 dB
		assert.equal(r.status, "green");
	});

	it("is yellow with 2 dB margin", () => {
		// 1.5 fibra + 20.5 splitter + 1.0 conectores + 3.0 = 26 → margen 2
		const r = budget({ lengthMeters: 5000, splitRatio: "1:64" });
		assert.equal(r.margin, 2);
		assert.equal(r.status, "yellow");
		assert.equal(r.statusLabel, "Margen ajustado (1-3 dB)");
		assert.ok(r.warnings.some((w) => w.includes("clima tropical")));
	});

	it("is green above 3 dB margin", () => {
		const r = budget({
			lengthMeters: 10000,
			splitRatio: "1:64",
			ponClass: "C+",
		});
		// 3.0 + 20.5 + 1.0 + 3.0 = 27.5 → margen 4.5 con C+ (32 dB)
		assert.equal(r.margin, 4.5);
		assert.equal(r.status, "green");
	});

	it("red but still linking: says margen insuficiente, not fuera de presupuesto", () => {
		// 3.0 fibra + 20.5 + 1.0 + 3.0 = 27.5 → margen 0.5; física 24.5 ≤ 28
		const r = budget({ lengthMeters: 10000, splitRatio: "1:64" });
		assert.equal(r.margin, 0.5);
		assert.equal(r.status, "red");
		assert.equal(r.statusLabel, "Margen insuficiente (<1 dB)");
		assert.ok(!r.warnings.some((w) => w.includes("supera el máximo")));
	});

	it("is out of budget only when physical loss alone exceeds the class", () => {
		// 4.5 fibra + 24.0 + 1.0 = 29.5 física > 28
		const r = budget({ lengthMeters: 15000, splitRatio: "1:128" });
		assert.equal(r.status, "red");
		assert.equal(r.statusLabel, "Fuera de presupuesto");
		assert.ok(r.warnings.some((w) => w.includes("supera el máximo")));
	});

	it("warns about receiver overload when loss is below the class minimum", () => {
		// 0.09 fibra + 10.5 + 1.0 = 11.59 física < 17 (mínimo C+)
		const r = budget({ lengthMeters: 300, splitRatio: "1:8", ponClass: "C+" });
		assert.equal(r.status, "green");
		assert.ok(r.warnings.some((w) => w.includes("saturar el receptor")));
	});

	it("does not warn about overload inside the class window", () => {
		const r = budget({ lengthMeters: 2000, splitRatio: "1:32" });
		assert.ok(!r.warnings.some((w) => w.includes("saturar")));
	});

	it("is gray without the OLT optical class", () => {
		const r = budget({ ponClass: null });
		assert.equal(r.status, "gray");
		assert.equal(r.margin, null);
	});

	it("is gray with incomplete data", () => {
		const r = budget({ splitRatio: null });
		assert.equal(r.status, "gray");
		assert.equal(r.statusLabel, "Datos incompletos");
	});
});
