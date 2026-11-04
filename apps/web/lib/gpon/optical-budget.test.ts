import { describe, expect, it } from "vitest";
import { calculateOpticalBudget } from "./optical-budget";

// Casos de referencia: lo que un ingeniero del ISP puede verificar a mano.
// Valores por defecto del código: 1490 nm = 0.3 dB/km, 2 conectores × 0.5 dB,
// empalme 0.1 dB, margen de seguridad 3 dB.

describe("calculateOpticalBudget — suma de pérdidas", () => {
	it("calcula un enlace típico Star 1:16 a 2 km", () => {
		const result = calculateOpticalBudget({
			lengthMeters: 2000,
			fiberType: "g652d",
			splitRatio: "1:16",
			ponClass: "C+",
		});
		expect(result.fiberLoss).toBe(0.6);
		expect(result.splitterLoss).toBe(13.8);
		expect(result.connectorLoss).toBe(1);
		expect(result.spliceLoss).toBe(0);
		expect(result.safetyMargin).toBe(3);
		expect(result.totalLoss).toBe(18.4);
		expect(result.margin).toBe(13.6); // C+ = 32 dB
		expect(result.status).toBe("green");
		expect(result.warnings).toEqual([]);
	});

	it("suma la reserva física a la longitud GIS", () => {
		const result = calculateOpticalBudget({
			lengthMeters: 1000,
			reservationMeters: 1000,
			fiberType: "g652d",
			splitRatio: "1:8",
		});
		expect(result.fiberLoss).toBe(0.6);
	});

	it("usa la atenuación de la longitud de onda indicada", () => {
		const result = calculateOpticalBudget({
			lengthMeters: 10000,
			fiberType: "g652d",
			splitRatio: "1:8",
			wavelength: "1310",
		});
		expect(result.fiberLoss).toBe(4); // 0.4 dB/km upstream
	});

	it("prioriza los valores de BD sobre los conteos", () => {
		const result = calculateOpticalBudget({
			lengthMeters: 5000,
			attenuationDbPerKm: 0.22,
			fiberType: "g652d",
			splitRatio: "1:32",
			connectorCount: 6,
			connectorLossDb: 0.8,
			spliceCount: 20,
			totalSpliceLossDb: 0.35,
			safetyMarginDb: 4,
		});
		expect(result.fiberLoss).toBe(1.1);
		expect(result.connectorLoss).toBe(0.8);
		expect(result.spliceLoss).toBe(0.35);
		expect(result.safetyMargin).toBe(4);
		expect(result.totalLoss).toBe(23.25);
	});

	it("cuenta empalmes a 0.1 dB cada uno", () => {
		const result = calculateOpticalBudget({
			lengthMeters: 1000,
			fiberType: "g652d",
			splitRatio: "1:8",
			spliceCount: 7,
		});
		expect(result.spliceLoss).toBe(0.7);
	});
});

describe("calculateOpticalBudget — semáforo", () => {
	it("amarillo con margen entre 2 y 4 dB, y avisa por clima tropical", () => {
		// B+ = 28 dB. 15 km (4.5) + 1:32 (17) + 1 + 3 = 25.5 → margen 2.5
		const result = calculateOpticalBudget({
			lengthMeters: 15000,
			fiberType: "g652d",
			splitRatio: "1:32",
			ponClass: "B+",
		});
		expect(result.margin).toBe(2.5);
		expect(result.status).toBe("yellow");
		expect(result.warnings).toContain(
			"Margen < 4 dB — vulnerable a degradación en clima tropical",
		);
	});

	it("margen exactamente 4 dB no es verde", () => {
		// B+ = 28. 10 km (3) + 1:32 (17) + 1 + 3 = 24 → margen 4
		const result = calculateOpticalBudget({
			lengthMeters: 10000,
			fiberType: "g652d",
			splitRatio: "1:32",
			ponClass: "B+",
		});
		expect(result.margin).toBe(4);
		expect(result.status).toBe("yellow");
	});

	it("rojo cuando el margen cae bajo 2 dB", () => {
		// B+ = 28. 10 km (3) + 1:64 (20.5) + 1 + 3 = 27.5 → margen 0.5
		const result = calculateOpticalBudget({
			lengthMeters: 10000,
			fiberType: "g652d",
			splitRatio: "1:64",
			ponClass: "B+",
		});
		expect(result.margin).toBe(0.5);
		expect(result.status).toBe("red");
		expect(result.statusLabel).toBe("Fuera de presupuesto");
	});

	it("margen negativo sigue siendo rojo y no dispara el aviso de < 4 dB", () => {
		const result = calculateOpticalBudget({
			lengthMeters: 20000,
			fiberType: "g652d",
			splitRatio: "1:128",
			ponClass: "B+",
		});
		expect(result.margin).toBeLessThan(0);
		expect(result.status).toBe("red");
		expect(result.warnings).not.toContain(
			"Margen < 4 dB — vulnerable a degradación en clima tropical",
		);
	});

	it("gris sin clase óptica del OLT", () => {
		const result = calculateOpticalBudget({
			lengthMeters: 2000,
			fiberType: "g652d",
			splitRatio: "1:16",
		});
		expect(result.status).toBe("gray");
		expect(result.margin).toBeNull();
		expect(result.statusLabel).toBe("Clase óptica del OLT no definida");
	});
});

describe("calculateOpticalBudget — datos incompletos", () => {
	it("sin longitud: gris aunque haya clase óptica", () => {
		const result = calculateOpticalBudget({
			lengthMeters: null,
			fiberType: "g652d",
			splitRatio: "1:16",
			ponClass: "C+",
		});
		expect(result.status).toBe("gray");
		expect(result.statusLabel).toBe("Datos incompletos");
		expect(result.warnings).toContain("Longitud de ruta no calculada");
	});

	it("sin ratio o con ratio desconocido avisa y no inventa pérdida", () => {
		const sinRatio = calculateOpticalBudget({
			lengthMeters: 1000,
			fiberType: "g652d",
			splitRatio: null,
		});
		expect(sinRatio.warnings).toContain("Splitter sin ratio definido");

		const desconocido = calculateOpticalBudget({
			lengthMeters: 1000,
			fiberType: "g652d",
			splitRatio: "1:3",
		});
		expect(desconocido.splitterLoss).toBe(0);
		expect(desconocido.warnings).toContain("Ratio 1:3 desconocido");
		expect(desconocido.status).toBe("gray");
	});

	it("avisa cuando la distancia supera 20 km", () => {
		const result = calculateOpticalBudget({
			lengthMeters: 21000,
			fiberType: "g652d",
			splitRatio: "1:8",
			ponClass: "C++",
		});
		expect(result.warnings).toContain(
			"Distancia mayor a 20 km — verificar ranging del equipo",
		);
	});
});
