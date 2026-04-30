/**
 * GPON map palette — single source of truth for runtime color values.
 *
 * Mapbox `paint` expressions cannot read CSS custom properties, so the
 * palette lives in TS. Values must mirror the tokens declared in
 * `app/globals.css` (`--gpon-*`, `--status-*`, `--cable-*`, `--severity-*`).
 * If you change a value here, update `globals.css` in the same change.
 */

// ── Equipment types ─────────────────────────────────────────────────────────
export type EquipmentType =
	| "olt"
	| "splitter"
	| "nap"
	| "ont"
	| "amplifier"
	| "wdm"
	| "unknown";

export const TYPE_COLOR: Record<string, string> = {
	olt: "#38bdf8",
	splitter: "#a78bfa",
	nap: "#f59e0b",
	ont: "#34d399",
	amplifier: "#fde047",
	wdm: "#22d3ee",
	unknown: "#a4a4a4",
};

// ── Status ──────────────────────────────────────────────────────────────────
export type EquipmentStatus =
	| "online"
	| "alarm"
	| "offline"
	| "maintenance"
	| "decommissioned"
	| "unknown";

export const STATUS_COLOR: Record<string, string> = {
	online: "#34d399",
	alarm: "#fb4d6d",
	offline: "#858585",
	maintenance: "#f59e0b",
	decommissioned: "#5c5d5f",
	unknown: "#a4a4a4",
};

// ── Cables ──────────────────────────────────────────────────────────────────
// Each cable shares hue with its endpoint family — feeder→OLT, dist→splitter,
// drop→ONT — so a route can be read at a glance.
export type CableType = "feeder" | "distribution" | "drop" | "default";

export const CABLE_COLOR: Record<string, string> = {
	feeder: TYPE_COLOR.olt,
	distribution: TYPE_COLOR.splitter,
	drop: TYPE_COLOR.ont,
	default: "#858585",
};

export const CABLE_CASING = "rgba(0, 0, 0, 0.55)";

export const CABLE_LABEL: Record<string, string> = {
	feeder: "Feeder",
	distribution: "Distribución",
	drop: "Drop",
	default: "Fibra",
};

// ── Route points ────────────────────────────────────────────────────────────
export type RoutePointVisualType = "crossing" | "reserve" | "splice";

export const ROUTE_POINT_COLOR: Record<RoutePointVisualType, string> = {
	crossing: "#d7d7d7",
	reserve: "#f6c768",
	splice: "#fb7185",
};

export const ROUTE_POINT_LABEL: Record<RoutePointVisualType, string> = {
	crossing: "Cruce",
	reserve: "Reserva",
	splice: "Empalme",
};

// ── Incident severity ───────────────────────────────────────────────────────
export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export const SEVERITY_COLOR: Record<string, string> = {
	critical: "#fb4d6d",
	high: "#f59e0b",
	medium: "#fde047",
	low: "#38bdf8",
};

// ── Optical signal (ITU-T G.984 thresholds) ─────────────────────────────────
export type SignalClass = "good" | "warning" | "critical" | "unknown";

export const SIGNAL_COLOR: Record<SignalClass, string> = {
	good: "#34d399",
	warning: "#f59e0b",
	critical: "#fb4d6d",
	unknown: "#858585",
};

// ── Data quality ────────────────────────────────────────────────────────────
export type DataQualityLevel =
	| "unknown"
	| "approximate"
	| "drawn"
	| "gps_captured"
	| "verified";

export const DATA_QUALITY_COLOR: Record<DataQualityLevel, string> = {
	unknown: "#777879", // muted gray
	approximate: "#f59e0b", // amber
	drawn: "#a78bfa", // purple
	gps_captured: "#38bdf8", // sky blue
	verified: "#34d399", // emerald (most trusted)
};

export const DATA_QUALITY_LABEL: Record<DataQualityLevel, string> = {
	unknown: "Sin información",
	approximate: "Aproximado",
	drawn: "Dibujado",
	gps_captured: "Capturado por GPS",
	verified: "Verificado",
};

// ── Surface (matches globals.css) ───────────────────────────────────────────
export const SURFACE = {
	bg: "#1b1c1d",
	panel: "rgba(34,35,36,0.9)",
	border: "rgba(164,164,164,0.18)",
	textPrimary: "#e6e6e6",
	textSecondary: "#a4a4a4",
	textMuted: "#777879",
} as const;
