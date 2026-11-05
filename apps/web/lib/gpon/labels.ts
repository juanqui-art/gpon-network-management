/**
 * Canonical user-facing labels for every ENUM shown in the UI.
 * Single source for /map, the editor, capture and the unifilar diagram:
 * inspectors must never render raw enum values or ids.
 */
import type {
	CrossingType,
	DataQuality,
	ElementStatus,
	FiberType,
	InstallationType,
	PonStandard,
	RiskLevel,
	RoutePointType,
	RouteStatus,
	RouteType,
} from "@/lib/types/gpon";

export const ELEMENT_TYPE_LABEL: Record<string, string> = {
	olt: "OLT",
	splitter: "Splitter",
	closure: "Mufa",
	nap: "NAP",
	ont: "ONT",
	amplifier: "Amplificador",
	wdm: "WDM",
	unknown: "Equipo",
};

/** Element + route statuses, plus legacy telemetry states used by the map. */
export const STATUS_LABEL: Record<
	ElementStatus | RouteStatus | string,
	string
> = {
	planned: "Planificado",
	installed: "Instalado",
	active: "Activo",
	inactive: "Inactivo",
	faulty: "Con falla",
	damaged: "Dañado",
	retired: "Retirado",
	online: "En línea",
	offline: "Fuera de línea",
	alarm: "En alarma",
	maintenance: "Mantenimiento",
	decommissioned: "Dado de baja",
	unknown: "Sin estado",
};

export const DATA_QUALITY_LABEL: Record<DataQuality, string> = {
	unknown: "Sin información",
	approximate: "Aproximada",
	drawn: "Dibujada",
	gps_captured: "Capturada por GPS",
	verified: "Verificada",
};

export const ROUTE_TYPE_LABEL: Record<RouteType, string> = {
	feeder: "Feeder",
	distribution: "Distribución",
	other: "Otra",
};

export const ROUTE_POINT_TYPE_LABEL: Record<RoutePointType, string> = {
	crossing: "Cruce",
	mufa: "Mufa",
	reserve: "Reserva",
	splice: "Empalme",
};

export const INSTALLATION_LABEL: Record<InstallationType, string> = {
	aerial: "Aérea",
	underground: "Subterránea",
	duct: "Ducto",
	facade: "Fachada",
};

export const FIBER_TYPE_LABEL: Record<FiberType, string> = {
	g652d: "G.652.D",
	g657a1: "G.657.A1",
	g657a2: "G.657.A2",
};

export const PON_STANDARD_LABEL: Record<PonStandard, string> = {
	gpon: "GPON",
	xgs_pon: "XGS-PON",
	xg_pon: "XG-PON",
	epon: "EPON",
};

export const CROSSING_TYPE_LABEL: Record<CrossingType, string> = {
	avenue: "Avenida",
	river: "Río",
	railway: "Vía férrea",
	highway: "Autopista",
	other: "Otro",
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
	low: "Bajo",
	medium: "Medio",
	high: "Alto",
	critical: "Crítico",
};

/**
 * Looks up a label. Empty values render `fallback`; a value with no label yet
 * (e.g. a new DB enum) is shown humanized rather than hidden or as snake_case.
 */
export function labelOf(
	labels: Record<string, string>,
	value: string | null | undefined,
	fallback = "—",
): string {
	if (value == null || value === "") return fallback;
	return labels[value] ?? value.replaceAll("_", " ");
}
