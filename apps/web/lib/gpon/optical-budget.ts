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
	"1310": 0.40, // upstream GPON
	"1490": 0.30, // downstream GPON
	"1550": 0.25, // video overlay
	"1577": 0.28, // downstream XGS-PON
};

// ── Pérdida de splitters balanceados ─────────────────────────────────────────

export const SPLITTER_LOSS_DB: Record<string, number> = {
	"1:2":  3.5,
	"1:4":  7.2,
	"1:8":  10.5,
	"1:16": 13.5,
	"1:32": 17.0,
	"1:64": 20.5,
	"1:128": 24.0,
};

// ── Clase óptica y rango de pérdida ─────────────────────────────────────────

export const PON_CLASS_BUDGET: Record<PonClass, { min: number; max: number }> = {
	"B+":  { min: 13, max: 28 },
	"C+":  { min: 17, max: 32 },
	"C++": { min: 20, max: 35 },
	"N1":  { min: 14, max: 29 },
	"N2":  { min: 16, max: 31 },
	"E1":  { min: 18, max: 33 },
	"E2":  { min: 20, max: 35 },
};

// ── Resultado del cálculo ─────────────────────────────────────────────────────

export type OpticalStatus = "green" | "yellow" | "red" | "gray";

export interface OpticalBudgetResult {
	fiberLoss: number;         // dB — pérdida por distancia
	splitterLoss: number;      // dB — pérdida del splitter
	connectorLoss: number;     // dB — estimado por conectores
	totalLoss: number;         // dB — pérdida total
	margin: number | null;     // dB — margen restante (null si falta clase óptica)
	status: OpticalStatus;
	statusLabel: string;
	warnings: string[];
}

// ── Calculadora principal ─────────────────────────────────────────────────────

export interface OpticalBudgetInput {
	lengthMeters: number | null;
	fiberType: FiberStandard | null;
	splitRatio: string | null;       // "1:8", "1:16", etc.
	connectorCount?: number;          // pares de conectores, default 2
	ponClass?: PonClass | null;       // clase del OLT (opcional)
	wavelength?: Wavelength;          // default "1490" (downstream GPON)
}

export function calculateOpticalBudget(input: OpticalBudgetInput): OpticalBudgetResult {
	const warnings: string[] = [];

	// Atenuación por longitud
	const wavelength = input.wavelength ?? "1490";
	const dbPerKm = ATTENUATION_DB_PER_KM[wavelength];
	let fiberLoss = 0;

	if (!input.lengthMeters) {
		warnings.push("Longitud de ruta no calculada");
	} else {
		fiberLoss = (input.lengthMeters / 1000) * dbPerKm;
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

	// Pérdida de conectores (0.25 dB/par, conservador)
	const connectorPairs = input.connectorCount ?? 2;
	const connectorLoss = connectorPairs * 0.25;

	const totalLoss = fiberLoss + splitterLoss + connectorLoss;

	// Margen y semáforo
	let margin: number | null = null;
	let status: OpticalStatus = "gray";
	let statusLabel = "Datos incompletos";

	if (warnings.length === 0 && input.ponClass) {
		const budget = PON_CLASS_BUDGET[input.ponClass];
		margin = budget.max - totalLoss;

		if (margin > 3) {
			status = "green";
			statusLabel = "Margen holgado";
		} else if (margin >= 1) {
			status = "yellow";
			statusLabel = "Margen ajustado";
		} else {
			status = "red";
			statusLabel = "Fuera de presupuesto";
			warnings.push(`Margen negativo (${margin.toFixed(1)} dB) — revisar diseño`);
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
	if (margin !== null && margin < 3 && margin >= 0) {
		warnings.push("Margen < 3 dB — vulnerable a degradación");
	}

	return {
		fiberLoss: Math.round(fiberLoss * 100) / 100,
		splitterLoss,
		connectorLoss,
		totalLoss: Math.round(totalLoss * 100) / 100,
		margin: margin !== null ? Math.round(margin * 100) / 100 : null,
		status,
		statusLabel,
		warnings,
	};
}

// ── Colores del semáforo ───────────────────────────────────────────────────────

export const OPTICAL_STATUS_COLOR: Record<OpticalStatus, string> = {
	green:  "#34d399",
	yellow: "#f59e0b",
	red:    "#fb4d6d",
	gray:   "#777879",
};

export const OPTICAL_STATUS_BG: Record<OpticalStatus, string> = {
	green:  "rgba(52,211,153,0.1)",
	yellow: "rgba(245,158,11,0.1)",
	red:    "rgba(251,77,109,0.1)",
	gray:   "rgba(164,164,164,0.08)",
};
