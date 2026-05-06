/**
 * Calculadora de presupuesto óptico GPON/XGS-PON
 * Valores conservadores para Ecuador (humedad, UV, reparaciones frecuentes)
 * Basado en: docs/GPON_FTTH_ECUADOR_RESEARCH.md
 */

// ── Atenuación por tipo de fibra y longitud de onda ───────────────────────────

export type FiberStandard = "g652d" | "g657a1" | "g657a2";
export type Wavelength = "1310" | "1490" | "1550" | "1270" | "1577";
export type PonClass = "B+" | "C+" | "C++" | "N1" | "N2" | "E1" | "E2";

// dB/km — valores conservadores Ecuador
export const ATTENUATION_DB_PER_KM: Record<Wavelength, number> = {
	"1270": 0.45, // upstream XGS-PON
	"1310": 0.4, // upstream GPON
	"1490": 0.3, // downstream GPON
	"1550": 0.25, // video overlay
	"1577": 0.28, // downstream XGS-PON
};

// ── Pérdida de splitters balanceados ─────────────────────────────────────────

export const SPLITTER_LOSS_DB: Record<string, number> = {
	"1:2": 3.5,
	"1:4": 7.2,
	"1:8": 10.5,
	"1:16": 13.8,
	"1:32": 17.0,
	"1:64": 20.5,
	"1:128": 24.0,
};

// ── Pérdida de splitters asimétricos (Bus desbalanceado) ──────────────────────
// Formato: "RATIO rama-minoritaria" → [pérdida rama minoritaria, pérdida rama mayoritaria]

export const ASYMMETRIC_SPLITTER_LOSS_DB: Record<
	string,
	{ minority: number; majority: number }
> = {
	"5/95": { minority: 13.0, majority: 0.2 },
	"10/90": { minority: 10.0, majority: 0.4 },
	"20/80": { minority: 7.0, majority: 0.9 },
	"30/70": { minority: 5.2, majority: 1.5 },
	"50/50": { minority: 3.5, majority: 3.5 }, // equals 1:2 balanced
};

export const CONNECTOR_LOSS_DB = 0.5;
export const SPLICE_LOSS_DB = 0.1;
export const SAFETY_MARGIN_DB = 3.0; // Margen de diseño base; la documentación recomienda 3-5 dB.

// ── Clase óptica y rango de pérdida ─────────────────────────────────────────

export const PON_CLASS_BUDGET: Record<PonClass, { min: number; max: number }> =
	{
		"B+": { min: 13, max: 28 },
		"C+": { min: 17, max: 32 },
		"C++": { min: 20, max: 35 },
		N1: { min: 14, max: 29 },
		N2: { min: 16, max: 31 },
		E1: { min: 18, max: 33 },
		E2: { min: 20, max: 35 },
	};

export const PON_CLASS_POWER_PROFILE: Record<
	PonClass,
	{ defaultTxDbm: number; rxSensitivityDbm: number }
> = {
	"B+": { defaultTxDbm: 3, rxSensitivityDbm: -28 },
	"C+": { defaultTxDbm: 5, rxSensitivityDbm: -30 },
	"C++": { defaultTxDbm: 7, rxSensitivityDbm: -32 },
	N1: { defaultTxDbm: 4, rxSensitivityDbm: -28 },
	N2: { defaultTxDbm: 5, rxSensitivityDbm: -30 },
	E1: { defaultTxDbm: 4, rxSensitivityDbm: -30 },
	E2: { defaultTxDbm: 6, rxSensitivityDbm: -32 },
};

// ── Resultado del cálculo ─────────────────────────────────────────────────────

export type OpticalStatus = "green" | "yellow" | "red" | "gray";

export interface OpticalBudgetResult {
	fiberLoss: number; // dB — pérdida por distancia
	splitterLoss: number; // dB — pérdida del splitter
	connectorLoss: number; // dB — estimado por conectores
	spliceLoss: number; // dB — empalmes por fusión
	safetyMargin: number; // dB — reserva de ingeniería
	totalLoss: number; // dB — pérdida total
	margin: number | null; // dB — margen restante (null si falta clase óptica)
	status: OpticalStatus;
	statusLabel: string;
	warnings: string[];
}

// ── Calculadora principal ─────────────────────────────────────────────────────

export interface OpticalBudgetInput {
	lengthMeters: number | null;
	attenuationDbPerKm?: number | null; // usa valor de BD si disponible; si null usa tabla por wavelength
	fiberType: FiberStandard | null;
	splitRatio: string | null; // "1:8", "1:16", etc.
	connectorCount?: number; // ignorado si connectorLossDb está definido; default 2
	connectorLossDb?: number | null; // valor directo de BD; toma prioridad sobre connectorCount
	spliceCount?: number; // ignorado si totalSpliceLossDb está definido
	totalSpliceLossDb?: number | null; // valor directo de BD; toma prioridad sobre spliceCount
	safetyMarginDb?: number; // default 3 dB
	ponClass?: PonClass | null; // clase del OLT (opcional)
	wavelength?: Wavelength; // default "1490" (downstream GPON)
}

export function calculateOpticalBudget(
	input: OpticalBudgetInput,
): OpticalBudgetResult {
	const warnings: string[] = [];

	// Factor de trenzado: el cable instalado es ~2% más largo que la ruta GIS
	const CABLE_FACTOR = 1.02;

	// Atenuación por longitud
	const wavelength = input.wavelength ?? "1490";
	const dbPerKm = input.attenuationDbPerKm ?? ATTENUATION_DB_PER_KM[wavelength];
	let fiberLoss = 0;

	if (!input.lengthMeters) {
		warnings.push("Longitud de ruta no calculada");
	} else {
		fiberLoss = ((input.lengthMeters * CABLE_FACTOR) / 1000) * dbPerKm;
	}

	// Pérdida del splitter
	let splitterLoss = 0;
	if (!input.splitRatio) {
		warnings.push("Splitter sin ratio definido");
	} else {
		splitterLoss = SPLITTER_LOSS_DB[input.splitRatio] ?? 0;
		if (!SPLITTER_LOSS_DB[input.splitRatio]) {
			warnings.push(`Ratio ${input.splitRatio} desconocido`);
		}
	}

	// Conectores: usa dato BD si disponible, si no 2 × 0.5 dB por defecto
	const connectorLoss =
		input.connectorLossDb != null
			? input.connectorLossDb
			: (input.connectorCount ?? 2) * CONNECTOR_LOSS_DB;

	// Empalmes: usa dato BD si disponible, si no spliceCount × 0.1 dB
	const spliceLoss =
		input.totalSpliceLossDb != null
			? input.totalSpliceLossDb
			: (input.spliceCount ?? 0) * SPLICE_LOSS_DB;

	const safetyMargin = input.safetyMarginDb ?? SAFETY_MARGIN_DB;

	const totalLoss =
		fiberLoss + splitterLoss + connectorLoss + spliceLoss + safetyMargin;

	// Margen y semáforo
	let margin: number | null = null;
	let status: OpticalStatus = "gray";
	let statusLabel = "Datos incompletos";

	if (warnings.length === 0 && input.ponClass) {
		const budget = PON_CLASS_BUDGET[input.ponClass];
		margin = budget.max - totalLoss;

		if (margin > 4) {
			status = "green";
			statusLabel = "Margen holgado (>4 dB)";
		} else if (margin >= 2) {
			status = "yellow";
			statusLabel = "Margen ajustado (2-4 dB)";
		} else {
			status = "red";
			statusLabel = "Fuera de presupuesto";
			warnings.push(
				`Margen insuficiente (${margin.toFixed(1)} dB) — revisar diseño`,
			);
		}
	} else if (warnings.length === 0) {
		// Tenemos todos los datos de pérdida pero no la clase del OLT
		status = "gray";
		statusLabel = "Clase óptica del OLT no definida";
	}

	// Advertencias adicionales
	if (input.lengthMeters && input.lengthMeters > 20000) {
		warnings.push("Distancia mayor a 20 km — verificar ranging del equipo");
	}
	if (margin !== null && margin < 4 && margin >= 0) {
		warnings.push("Margen < 4 dB — vulnerable a degradación en clima tropical");
	}

	return {
		fiberLoss: Math.round(fiberLoss * 100) / 100,
		splitterLoss,
		connectorLoss,
		spliceLoss: Math.round(spliceLoss * 100) / 100,
		safetyMargin,
		totalLoss: Math.round(totalLoss * 100) / 100,
		margin: margin !== null ? Math.round(margin * 100) / 100 : null,
		status,
		statusLabel,
		warnings,
	};
}

// ── Colores del semáforo ───────────────────────────────────────────────────────

export const OPTICAL_STATUS_COLOR: Record<OpticalStatus, string> = {
	green: "#34d399",
	yellow: "#f59e0b",
	red: "#fb4d6d",
	gray: "#777879",
};

export const OPTICAL_STATUS_BG: Record<OpticalStatus, string> = {
	green: "rgba(52,211,153,0.1)",
	yellow: "rgba(245,158,11,0.1)",
	red: "rgba(251,77,109,0.1)",
	gray: "rgba(164,164,164,0.08)",
};
