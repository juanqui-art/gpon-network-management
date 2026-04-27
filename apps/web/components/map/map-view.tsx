"use client";

import mapboxgl from "mapbox-gl";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
	CABLE_COLOR,
	SEVERITY_COLOR,
	STATUS_COLOR,
	TYPE_COLOR,
} from "@/lib/map/palette";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE } from "@/lib/mapbox/config";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	IncidentMapItem,
	LngLat,
	RoutePoint,
} from "./types";

interface Props {
	token: string;
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	routePoints?: RoutePoint[];
	incidents: IncidentMapItem[];
}

// ── Connection GeoJSON builder ────────────────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
	alarm: 0,
	faulty: 0,
	offline: 1,
	damaged: 1,
	maintenance: 2,
	planned: 2,
	installed: 3,
	decommissioned: 3,
	retired: 3,
	online: 4,
	active: 4,
	inactive: 5,
	unknown: 5,
};

function worstStatus(a: string, b: string): string {
	return (STATUS_PRIORITY[a] ?? 5) <= (STATUS_PRIORITY[b] ?? 5) ? a : b;
}

function buildConnectionsGeoJSON(
	connections: ConnectionMapItem[],
	equipment: EquipmentMapItem[],
): GeoJSON.FeatureCollection {
	const equipmentById = new Map(equipment.map((e) => [e.id, e]));
	const statusById = Object.fromEntries(equipment.map((e) => [e.id, e.status]));
	return {
		type: "FeatureCollection",
		features: connections.map((c) => ({
			type: "Feature" as const,
			id: c.id,
			geometry: {
				type: "LineString" as const,
				coordinates: snapConnectionEndpoints(c, equipmentById),
			},
			properties: {
				connection_id: c.id,
				cable_type: c.cable_type,
				fiber_type: c.fiber_type,
				length_meters: c.length_meters,
				from_equipment_type: c.from_equipment_type,
				to_equipment_type: c.to_equipment_type,
				worst_status: worstStatus(
					statusById[c.from_equipment_id] ?? "unknown",
					statusById[c.to_equipment_id] ?? "unknown",
				),
			},
		})),
	};
}

function snapConnectionEndpoints(
	connection: ConnectionMapItem,
	equipmentById: Map<string, EquipmentMapItem>,
): [number, number][] {
	const from = equipmentById.get(connection.from_equipment_id);
	const to = equipmentById.get(connection.to_equipment_id);
	const coordinates = connection.geojson_coordinates ?? [];

	if (!from || !to) return coordinates;

	if (coordinates.length <= 2) {
		return [
			[from.lng, from.lat],
			[to.lng, to.lat],
		];
	}

	return [[from.lng, from.lat], ...coordinates.slice(1, -1), [to.lng, to.lat]];
}

function buildRoutePointsGeoJSON(
	routePoints: RoutePoint[],
): GeoJSON.FeatureCollection {
	return {
		type: "FeatureCollection",
		features: routePoints.map((point) => ({
			type: "Feature" as const,
			id: point.id,
			geometry: {
				type: "Point" as const,
				coordinates: [point.lng, point.lat],
			},
			properties: {
				route_point_id: point.id,
				fiber_route_id: point.fiber_route_id,
				type: point.type,
				code: point.code,
				status: point.status,
				location_quality: point.location_quality,
				position_on_route_m: point.position_on_route_m,
				reserve_length_m: point.reserve_length_m,
				splice_loss_db: point.splice_loss_db,
				crossing_type: point.crossing_type,
				risk_level: point.risk_level,
				reference_text: point.reference_text,
				notes: point.notes,
			},
		})),
	};
}

// ── GPON symbology ───────────────────────────────────────────────────────────

const STATUS_MARK: Record<string, string> = {
	online: "",
	active: "",
	planned: "P",
	inactive: "–",
	faulty: "!",
	retired: "×",
	alarm: "!",
	offline: "×",
	maintenance: "•",
	decommissioned: "–",
	unknown: "?",
};

const ROUTE_POINT_COLOR: Record<string, string> = {
	crossing: "#d7d7d7",
	reserve: "#f6c768",
	splice: "#fb7185",
};

// ── SVG icons per equipment type ─────────────────────────────────────────────

function markerSVG(type: string, color: string): string {
	const c = color;
	switch (type) {
		case "olt":
			return `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
        <rect x="4" y="5" width="30" height="28" rx="4" fill="${c}"/>
        <rect x="8" y="9" width="22" height="5" rx="1.5" fill="white" opacity="0.18"/>
        <rect x="8" y="17" width="22" height="5" rx="1.5" fill="white" opacity="0.18"/>
        <rect x="8" y="25" width="22" height="4" rx="1.5" fill="white" opacity="0.18"/>
        <rect x="10" y="11" width="12" height="1.6" rx="0.8" fill="white" opacity="0.88"/>
        <rect x="10" y="19" width="12" height="1.6" rx="0.8" fill="white" opacity="0.88"/>
        <rect x="10" y="26.2" width="12" height="1.6" rx="0.8" fill="white" opacity="0.88"/>
        <circle cx="27" cy="11.8" r="1.5" fill="white" opacity="0.95"/>
        <circle cx="27" cy="19.8" r="1.5" fill="white" opacity="0.95"/>
      </svg>`;

		case "splitter":
			// Triangle pointing right = passive 1:N fan-out.
			return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <path d="M4 5.5 Q4 4.3 5.1 4.9 L25.4 14 Q27 14.8 25.4 16 L5.1 25.1 Q4 25.7 4 24.5 Z" fill="${c}"/>
        <circle cx="8.2" cy="15" r="2" fill="white" opacity="0.95"/>
        <path d="M14 15 H24" stroke="white" stroke-width="1.7" stroke-linecap="round" opacity="0.82"/>
        <path d="M17 15 L23.2 9" stroke="white" stroke-width="1.7" stroke-linecap="round" opacity="0.62"/>
        <path d="M17 15 L23.2 21" stroke="white" stroke-width="1.7" stroke-linecap="round" opacity="0.62"/>
      </svg>`;

		case "nap":
			// Distribution box with port grid (4 ports = typical NAP 4-16p).
			return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <rect x="3" y="5" width="22" height="18" rx="3" fill="${c}"/>
        <rect x="6" y="8" width="16" height="3" rx="1.2" fill="white" opacity="0.2"/>
        <rect x="6" y="13" width="4" height="4" rx="1" fill="white" opacity="0.9"/>
        <rect x="12" y="13" width="4" height="4" rx="1" fill="white" opacity="0.9"/>
        <rect x="18" y="13" width="4" height="4" rx="1" fill="white" opacity="0.9"/>
        <rect x="6" y="19" width="7" height="1.8" rx="0.9" fill="white" opacity="0.36"/>
        <rect x="15" y="19" width="7" height="1.8" rx="0.9" fill="white" opacity="0.36"/>
      </svg>`;

		default: // ont — small gateway with wifi arc (customer-side terminal)
			return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <rect x="3" y="8" width="16" height="11" rx="2.5" fill="${c}"/>
        <path d="M6.5 6.2 Q11 2.9 15.5 6.2" stroke="white" stroke-width="1.45" fill="none" stroke-linecap="round" opacity="0.75"/>
        <path d="M8.3 8 Q11 6.1 13.7 8" stroke="white" stroke-width="1.35" fill="none" stroke-linecap="round" opacity="0.9"/>
        <circle cx="7.2" cy="13.5" r="1.1" fill="white" opacity="0.95"/>
        <circle cx="11" cy="13.5" r="1.1" fill="white" opacity="0.95"/>
        <circle cx="14.8" cy="13.5" r="1.1" fill="white" opacity="0.95"/>
        <rect x="6" y="16.4" width="10" height="1.4" rx="0.7" fill="white" opacity="0.26"/>
      </svg>`;
	}
}

const MARKER_SIZE: Record<string, number> = {
	olt: 38,
	splitter: 30,
	nap: 28,
	ont: 22,
};

function interpolateZoomScale(
	zoom: number,
	stops: Array<[zoom: number, scale: number]>,
) {
	if (zoom <= stops[0][0]) return stops[0][1];
	const last = stops.at(-1);
	if (!last || zoom >= last[0]) return last?.[1] ?? 1;

	for (let i = 1; i < stops.length; i++) {
		const [z1, s1] = stops[i];
		const [z0, s0] = stops[i - 1];
		if (zoom <= z1) {
			const t = (zoom - z0) / (z1 - z0);
			return s0 + (s1 - s0) * t;
		}
	}

	return 1;
}

function markerScaleForZoom(type: string, zoom: number) {
	const stops: Array<[number, number]> =
		type === "ont"
			? [
					[13, 1],
					[15, 1.06],
					[17, 1.14],
					[19, 1.22],
				]
			: [
					[13, 1],
					[15, 1.12],
					[17, 1.26],
					[19, 1.36],
				];

	return interpolateZoomScale(zoom, stops);
}

function updateMarkerTransform(wrapper: HTMLElement) {
	const zoomScale = Number(wrapper.dataset.zoomScale ?? "1");
	const hoverScale = Number(wrapper.dataset.hoverScale ?? "1");
	wrapper.style.transform = `scale(${zoomScale * hoverScale})`;
}

function setMarkerZoomScale(outerEl: HTMLElement, type: string, zoom: number) {
	const wrapper = outerEl.querySelector(
		'[data-role="wrapper"]',
	) as HTMLElement | null;
	if (!wrapper) return;

	wrapper.dataset.zoomScale = markerScaleForZoom(type, zoom).toFixed(3);
	updateMarkerTransform(wrapper);
}

function createMarkerEl(
	eq: EquipmentMapItem,
	incident: IncidentMapItem | null,
): HTMLElement {
	const typeColor = TYPE_COLOR[eq.type] ?? TYPE_COLOR.unknown;
	const statusColor = STATUS_COLOR[eq.status] ?? STATUS_COLOR.unknown;
	const size = MARKER_SIZE[eq.type] ?? 22;
	const ringSize = size + 8;
	const showStatusBadge = eq.status !== "online";

	// ── DOM hierarchy ─────────────────────────────────────────────────────────
	// outer  → owned by Mapbox: it injects transform:translate() for positioning.
	//          NEVER set transform on outer — it would erase Mapbox's translation
	//          and snap the marker to the viewport origin (top-left corner).
	// wrapper → owned by us: receives scale() on hover without touching outer.
	// inner   → SVG icon + drop-shadow + pulse.

	const outer = document.createElement("div");
	outer.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    cursor: pointer;
  `;

	// wrapper: scales coherently on hover (ring + badges + icon move together)
	const wrapper = document.createElement("div");
	wrapper.dataset.role = "wrapper";
	wrapper.dataset.zoomScale = "1";
	wrapper.dataset.hoverScale = "1";
	wrapper.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
    transform-origin: center center;
    transition: transform 0.15s ease;
  `;

	const statusRing = document.createElement("div");
	statusRing.dataset.role = "status-ring";
	statusRing.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    width: ${ringSize}px;
    height: ${ringSize}px;
    border-radius: 999px;
    border: 2px solid ${statusColor};
    opacity: ${eq.status === "online" ? "0.42" : "0.85"};
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;
	wrapper.appendChild(statusRing);

	if (showStatusBadge) {
		const statusBadge = document.createElement("div");
		statusBadge.dataset.role = "status-badge";
		statusBadge.style.cssText = `
      position: absolute;
      left: -5px;
      bottom: -5px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: ${statusColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 800;
      color: #1b1c1d;
      border: 1.5px solid #1b1c1d;
      z-index: 10;
      pointer-events: none;
      font-family: system-ui, sans-serif;
      line-height: 1;
    `;
		statusBadge.textContent = STATUS_MARK[eq.status] ?? STATUS_MARK.unknown;
		wrapper.appendChild(statusBadge);
	}

	// Incident badge — top-right corner
	if (incident) {
		const badgeColor = SEVERITY_COLOR[incident.severity] ?? SEVERITY_COLOR.low;
		const badge = document.createElement("div");
		badge.dataset.role = "incident-badge";
		badge.style.cssText = `
      position: absolute;
      top: -5px;
      right: -5px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: ${badgeColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 800;
      color: white;
      border: 1.5px solid #1b1c1d;
      z-index: 10;
      pointer-events: none;
      font-family: system-ui, sans-serif;
      line-height: 1;
    `;
		badge.textContent = "!";
		wrapper.appendChild(badge);
	}

	const inner = document.createElement("div");
	inner.dataset.role = "inner";
	inner.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: filter 0.15s ease;
    filter: drop-shadow(0 0 5px rgba(0,0,0,0.65));
  `;
	inner.innerHTML = markerSVG(eq.type, typeColor);

	if (eq.status === "alarm") {
		const pulse = document.createElement("div");
		pulse.dataset.role = "pulse";
		const pulseRadius = eq.type === "olt" ? "4px" : "50%";
		pulse.style.cssText = `
      position: absolute;
      inset: 0;
      border-radius: ${pulseRadius};
      background: ${STATUS_COLOR.alarm};
      opacity: 0.35;
      animation: gpon-pulse 1.8s ease-out infinite;
      pointer-events: none;
      z-index: -1;
    `;
		inner.appendChild(pulse);
	}

	// Scale wrapper (not outer) — outer's transform is owned by Mapbox
	wrapper.addEventListener("mouseenter", () => {
		wrapper.dataset.hoverScale = "1.1";
		updateMarkerTransform(wrapper);
		inner.style.filter =
			"drop-shadow(0 0 8px rgba(0,0,0,0.75)) brightness(1.12)";
	});
	wrapper.addEventListener("mouseleave", () => {
		wrapper.dataset.hoverScale = "1";
		updateMarkerTransform(wrapper);
		inner.style.filter = "drop-shadow(0 0 5px rgba(0,0,0,0.65))";
	});

	wrapper.appendChild(inner);
	outer.appendChild(wrapper);
	return outer;
}

// Basemap layer categories to silence (common across Mapbox styles)
const NOISE_LAYERS = [
	"poi-label",
	"transit-label",
	"airport-label",
	"natural-point-label",
	"settlement-subdivision-label",
	"waterway-label",
	"road-label",
	"path-pedestrian-label",
];

// ── Filter bar ───────────────────────────────────────────────────────────────

type MarkerEntry = {
	marker: mapboxgl.Marker;
	outerEl: HTMLElement;
	type: string;
	status: string;
};

type EditorTool =
	| "select"
	| "pan"
	| "olt"
	| "splitter"
	| "nap"
	| "fiber"
	| "crossing"
	| "reserve"
	| "splice"
	| "measure"
	| "delete";

type EditorMode = "view" | "edit";
type LeftPanelTab = "layers" | "elements" | "quality";
type SelectedFeature =
	| { kind: "element"; element: EquipmentMapItem }
	| { kind: "route"; route: ConnectionMapItem }
	| { kind: "routePoint"; point: RoutePoint };
type DraftElement = EquipmentMapItem & { isDraft: true };
type DraftRoute = ConnectionMapItem & { isDraft: true };
type DraftRoutePoint = RoutePoint & { isDraft: true };
type SelectedDraftFeature = { kind: "draftElement"; element: DraftElement };
type SelectedDraftRouteFeature = { kind: "draftRoute"; route: DraftRoute };
type SelectedDraftRoutePointFeature = {
	kind: "draftRoutePoint";
	point: DraftRoutePoint;
};
type AnySelectedFeature =
	| SelectedFeature
	| SelectedDraftFeature
	| SelectedDraftRouteFeature
	| SelectedDraftRoutePointFeature;
type FiberDrawing = {
	fromElement: EquipmentMapItem;
	coordinates: LngLat[];
};
type DraftElementPatch = Partial<
	Pick<
		DraftElement,
		| "code"
		| "name"
		| "location_quality"
		| "total_pon_ports"
		| "split_ratio"
		| "insertion_loss_db"
		| "total_ports"
		| "address_reference"
		| "notes"
	>
>;
type DraftRoutePatch = Partial<
	Pick<
		DraftRoute,
		| "code"
		| "type"
		| "route_quality"
		| "installation_type"
		| "fiber_type"
		| "fiber_count"
		| "attenuation_db_per_km"
		| "splice_loss_db"
		| "connector_loss_db"
		| "notes"
	>
>;
type DraftRoutePointPatch = Partial<
	Pick<
		DraftRoutePoint,
		| "code"
		| "location_quality"
		| "crossing_type"
		| "risk_level"
		| "reserve_length_m"
		| "splice_loss_db"
		| "reference_text"
		| "notes"
	>
>;

const TYPE_FILTERS = [
	{ value: "all", label: "Todos" },
	{ value: "olt", label: "OLT" },
	{ value: "splitter", label: "Splitter" },
	{ value: "nap", label: "NAP" },
	{ value: "ont", label: "ONT" },
];

const STATUS_FILTERS = [
	{ value: "all", label: "Todos" },
	{ value: "online", label: "En línea", color: STATUS_COLOR.online },
	{ value: "alarm", label: "Alarma", color: STATUS_COLOR.alarm },
	{ value: "offline", label: "Fuera de línea", color: STATUS_COLOR.offline },
	{
		value: "maintenance",
		label: "Mantenimiento",
		color: STATUS_COLOR.maintenance,
	},
];

const EDITOR_TOOLS: Array<{
	value: EditorTool;
	label: string;
	shortcut: string;
	group: "navigate" | "create" | "route" | "inspect";
}> = [
	{ value: "select", label: "Seleccionar", shortcut: "V", group: "navigate" },
	{ value: "pan", label: "Mover mapa", shortcut: "H", group: "navigate" },
	{ value: "olt", label: "Crear OLT", shortcut: "O", group: "create" },
	{
		value: "splitter",
		label: "Crear splitter",
		shortcut: "S",
		group: "create",
	},
	{ value: "nap", label: "Crear NAP", shortcut: "N", group: "create" },
	{ value: "fiber", label: "Dibujar fibra", shortcut: "F", group: "route" },
	{ value: "crossing", label: "Marcar cruce", shortcut: "C", group: "route" },
	{ value: "reserve", label: "Marcar reserva", shortcut: "R", group: "route" },
	{ value: "splice", label: "Marcar empalme", shortcut: "E", group: "route" },
	{
		value: "measure",
		label: "Medir distancia",
		shortcut: "M",
		group: "inspect",
	},
	{ value: "delete", label: "Eliminar", shortcut: "Del", group: "inspect" },
];

const TOOL_HELP: Record<EditorTool, string> = {
	select: "Selecciona elementos o rutas para ver propiedades.",
	pan: "Arrastra el mapa para moverte por la red.",
	olt: "Click en el mapa para preparar una nueva OLT.",
	splitter: "Click en el mapa para preparar un splitter.",
	nap: "Click en el mapa para preparar una NAP.",
	fiber: "Click en origen, agrega vertices y cierra en destino.",
	crossing: "Selecciona una ruta y marca el cruce sobre la fibra.",
	reserve: "Selecciona una ruta y marca la reserva de cable.",
	splice: "Selecciona una ruta y marca el empalme.",
	measure: "Mide distancia sobre el mapa.",
	delete: "Selecciona un elemento para eliminarlo si tu rol lo permite.",
};

const TOOL_GROUP_LABEL: Record<(typeof EDITOR_TOOLS)[number]["group"], string> =
	{
		navigate: "Navegacion",
		create: "Elementos",
		route: "Rutas",
		inspect: "Revision",
	};

interface FilterBarProps {
	filterType: string;
	filterStatus: string;
	onTypeChange: (v: string) => void;
	onStatusChange: (v: string) => void;
}

function FilterBar({
	filterType,
	filterStatus,
	onTypeChange,
	onStatusChange,
}: FilterBarProps) {
	return (
		<div
			className="flex flex-col gap-1.5 select-none"
			style={{
				borderRadius: "10px",
			}}
		>
			{/* Type row */}
			<div className="flex items-center gap-1">
				{TYPE_FILTERS.map(({ value, label }) => (
					<button
						key={value}
						type="button"
						onClick={() => onTypeChange(value)}
						className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors"
						style={{
							background:
								filterType === value
									? "rgba(164,164,164,0.18)"
									: "rgba(164,164,164,0.07)",
							color: filterType === value ? "#e6e6e6" : "#858585",
							border:
								filterType === value
									? "1px solid rgba(164,164,164,0.28)"
									: "1px solid transparent",
						}}
					>
						{label}
					</button>
				))}
			</div>

			{/* Status row */}
			<div className="flex items-center gap-1">
				{STATUS_FILTERS.map(({ value, label, color }) => (
					<button
						key={value}
						type="button"
						onClick={() => onStatusChange(value)}
						className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors"
						style={{
							background:
								filterStatus === value
									? "rgba(164,164,164,0.14)"
									: "rgba(164,164,164,0.05)",
							color: filterStatus === value ? "#e6e6e6" : "#777879",
							border:
								filterStatus === value
									? "1px solid rgba(164,164,164,0.22)"
									: "1px solid transparent",
						}}
					>
						{color && (
							<span
								className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
								style={{ backgroundColor: color }}
							/>
						)}
						{label}
					</button>
				))}
			</div>
		</div>
	);
}

// ── Zoom-based hierarchy ─────────────────────────────────────────────────────
// Returns null when all types are visible (no zoom restriction).
// Thresholds reflect GPON depth: OLT (city) → Splitter (neighbourhood) → ONT (block).
function zoomTypes(zoom: number): Set<string> | null {
	if (zoom >= 14) return null;
	if (zoom >= 12) return new Set(["olt", "splitter", "nap"]);
	return new Set(["olt"]);
}

function zoomCableTypes(zoom: number): Set<string> | null {
	if (zoom >= 14) return null;
	if (zoom >= 12) return new Set(["feeder", "distribution"]);
	return new Set(["feeder"]);
}

function createDraftElement(
	type: "olt" | "splitter" | "nap",
	lngLat: mapboxgl.LngLat,
	index: number,
): DraftElement {
	const codePrefix =
		type === "olt" ? "OLT" : type === "splitter" ? "SPL" : "NAP";
	const code = `${codePrefix}-DRAFT-${String(index).padStart(3, "0")}`;

	return {
		id: `draft-${type}-${Date.now()}-${index}`,
		organization_id: null,
		type,
		code,
		name: code,
		status: "planned",
		lng: lngLat.lng,
		lat: lngLat.lat,
		location_quality: "approximate",
		address_reference: null,
		pon_standard: type === "olt" ? "gpon" : null,
		total_pon_ports: type === "olt" ? 8 : null,
		split_ratio: type === "splitter" ? "1:8" : null,
		insertion_loss_db: type === "splitter" ? 10.5 : null,
		total_ports: type === "nap" ? 8 : null,
		properties: {},
		notes: null,
		created_by: null,
		updated_by: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		vendor: null,
		model: null,
		address: null,
		service_status: null,
		plan_name: null,
		download_mbps: null,
		upload_mbps: null,
		customer_name: null,
		customer_phone: null,
		rx_power_dbm: null,
		tx_power_dbm: null,
		signal_recorded_at: null,
		isDraft: true,
	};
}

function distanceMeters(a: LngLat, b: LngLat): number {
	const earthRadiusM = 6371000;
	const toRad = (degrees: number) => (degrees * Math.PI) / 180;
	const dLat = toRad(b[1] - a[1]);
	const dLng = toRad(b[0] - a[0]);
	const lat1 = toRad(a[1]);
	const lat2 = toRad(b[1]);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

function polylineLengthMeters(coordinates: LngLat[]): number {
	return coordinates.reduce((total, coordinate, index) => {
		if (index === 0) return total;
		return total + distanceMeters(coordinates[index - 1], coordinate);
	}, 0);
}

function buildDrawingGeoJSON(coordinates: LngLat[]): GeoJSON.FeatureCollection {
	return {
		type: "FeatureCollection",
		features:
			coordinates.length >= 2
				? [
						{
							type: "Feature" as const,
							geometry: {
								type: "LineString" as const,
								coordinates,
							},
							properties: {},
						},
					]
				: [],
	};
}

function createDraftRoute(
	fromElement: EquipmentMapItem,
	toElement: EquipmentMapItem,
	coordinates: LngLat[],
	index: number,
): DraftRoute {
	const code = `R-DRAFT-${String(index).padStart(3, "0")}`;
	const length = polylineLengthMeters(coordinates);
	const fromElementType =
		fromElement.type === "olt" ||
		fromElement.type === "splitter" ||
		fromElement.type === "nap"
			? fromElement.type
			: "olt";
	const toElementType =
		toElement.type === "olt" ||
		toElement.type === "splitter" ||
		toElement.type === "nap"
			? toElement.type
			: "nap";

	return {
		id: `draft-route-${Date.now()}-${index}`,
		organization_id: null,
		code,
		type: fromElement.type === "olt" ? "feeder" : "distribution",
		status: "planned",
		from_element_id: fromElement.id,
		to_element_id: toElement.id,
		from_element_type: fromElementType,
		to_element_type: toElementType,
		geojson_coordinates: coordinates,
		route_quality: "approximate",
		installation_type: "aerial",
		fiber_type: "g652d",
		fiber_count: 6,
		length_meters: Math.round(length),
		attenuation_db_per_km: 0.35,
		splice_loss_db: 0.1,
		connector_loss_db: 0.3,
		total_loss_db: null,
		properties: {},
		notes: null,
		created_by: null,
		updated_by: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		cable_type: fromElement.type === "olt" ? "feeder" : "distribution",
		from_equipment_id: fromElement.id,
		to_equipment_id: toElement.id,
		from_equipment_type: fromElementType,
		to_equipment_type: toElementType,
		isDraft: true,
	};
}

// ── Component ────────────────────────────────────────────────────────────────

export function MapView({
	token,
	equipment,
	connections,
	routePoints = [],
	incidents,
}: Props) {
	const router = useRouter();
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	// Keyed by equipment_id for O(1) updates and lookups
	const markersByEqId = useRef<Map<string, MarkerEntry>>(new Map());
	// Keep latest props accessible in effects without re-running them
	const equipmentRef = useRef(equipment);
	const connectionsRef = useRef(connections);
	const routePointsRef = useRef(routePoints);
	const routesByIdRef = useRef<Map<string, ConnectionMapItem>>(new Map());
	const routePointsByIdRef = useRef<Map<string, RoutePoint>>(new Map());
	const popupRef = useRef<mapboxgl.Popup | null>(null);
	const draftMarkerRef = useRef<mapboxgl.Marker | null>(null);
	const fiberDrawingRef = useRef<FiberDrawing | null>(null);
	const activeToolRef = useRef<EditorTool>("select");
	const selectedFeatureRef = useRef<AnySelectedFeature | null>(null);
	const [selectedFeature, setSelectedFeature] =
		useState<AnySelectedFeature | null>(null);
	const [draftCount, setDraftCount] = useState(1);
	const [draftRouteCount, setDraftRouteCount] = useState(1);
	const [filterType, setFilterType] = useState("all");
	const [filterStatus, setFilterStatus] = useState("all");
	const [zoom, setZoom] = useState(DEFAULT_ZOOM); // matches map constructor zoom
	const [activeTool, setActiveTool] = useState<EditorTool>("select");
	const [mode, setMode] = useState<EditorMode>("edit");
	const [leftTab, setLeftTab] = useState<LeftPanelTab>("layers");
	const [statusMessage, setStatusMessage] = useState(
		"Modo infraestructura listo.",
	);

	const incidentByEquipment = Object.fromEntries(
		incidents.map((i) => [i.equipment_id, i]),
	);
	const routePointCount = routePoints.length;
	const activeToolLabel =
		EDITOR_TOOLS.find((tool) => tool.value === activeTool)?.label ??
		"Seleccionar";
	const isEditing = mode === "edit";
	const visibleEquipment = equipment.filter((eq) => {
		const typeOk = filterType === "all" || eq.type === filterType;
		const statusOk = filterStatus === "all" || eq.status === filterStatus;
		return typeOk && statusOk;
	});
	const clearDraft = useCallback(() => {
		draftMarkerRef.current?.remove();
		draftMarkerRef.current = null;
		fiberDrawingRef.current = null;
		const drawingSource = mapRef.current?.getSource(
			"fiber-draft",
		) as mapboxgl.GeoJSONSource | null;
		drawingSource?.setData(buildDrawingGeoJSON([]));
		setSelectedFeature((current) =>
			current?.kind === "draftElement" || current?.kind === "draftRoute"
				? null
				: current,
		);
	}, []);
	const createElementDraftAt = useCallback(
		(type: "olt" | "splitter" | "nap", lngLat: mapboxgl.LngLat) => {
			const map = mapRef.current;
			if (!map) return;
			const draft = createDraftElement(type, lngLat, draftCount);
			setDraftCount((current) => current + 1);
			draftMarkerRef.current?.remove();
			const markerEl = createMarkerEl(draft, null);
			markerEl.style.opacity = "0.78";
			markerEl.style.filter = "saturate(0.9)";
			draftMarkerRef.current = new mapboxgl.Marker({
				element: markerEl,
				anchor: "center",
			})
				.setLngLat([draft.lng, draft.lat])
				.addTo(map);
			setMarkerZoomScale(markerEl, draft.type, map.getZoom());
			setSelectedFeature({ kind: "draftElement", element: draft });
			setStatusMessage(`${draft.code} provisional. Completa datos y guarda.`);
		},
		[draftCount],
	);
	const saveDraftElement = useCallback(
		async (draft: DraftElement) => {
			setStatusMessage(`Guardando ${draft.code}...`);
			const { createClient } = await import("@/lib/supabase/client");
			const supabase = createClient();
			const { error } = await supabase.rpc(
				"create_infrastructure_element_draft",
				{
					p_type: draft.type,
					p_code: draft.code,
					p_name: draft.name,
					p_lng: draft.lng,
					p_lat: draft.lat,
					p_status: draft.status,
					p_location_quality: draft.location_quality,
					p_pon_standard: draft.pon_standard,
					p_total_pon_ports: draft.total_pon_ports,
					p_split_ratio: draft.split_ratio,
					p_insertion_loss_db: draft.insertion_loss_db,
					p_total_ports: draft.total_ports,
					p_address_reference: draft.address_reference,
					p_notes: draft.notes,
				},
			);

			if (error) {
				setStatusMessage(`No se pudo guardar ${draft.code}: ${error.message}`);
				return;
			}

			clearDraft();
			setActiveTool("select");
			setStatusMessage(`${draft.code} guardado como borrador.`);
			router.refresh();
		},
		[clearDraft, router],
	);
	const updateFiberDraftSource = useCallback((coordinates: LngLat[]) => {
		const source = mapRef.current?.getSource(
			"fiber-draft",
		) as mapboxgl.GeoJSONSource | null;
		source?.setData(buildDrawingGeoJSON(coordinates));
	}, []);
	const addFiberVertex = useCallback(
		(lngLat: mapboxgl.LngLat) => {
			const drawing = fiberDrawingRef.current;
			if (!drawing) {
				setStatusMessage("Selecciona un elemento origen para dibujar fibra.");
				return;
			}
			const nextCoordinates: LngLat[] = [
				...drawing.coordinates,
				[lngLat.lng, lngLat.lat],
			];
			fiberDrawingRef.current = {
				...drawing,
				coordinates: nextCoordinates,
			};
			updateFiberDraftSource(nextCoordinates);
			setStatusMessage(
				`Vértice agregado. Longitud parcial ${polylineLengthMeters(nextCoordinates).toFixed(0)} m.`,
			);
		},
		[updateFiberDraftSource],
	);
	const handleFiberElementClick = useCallback(
		(element: EquipmentMapItem) => {
			const drawing = fiberDrawingRef.current;
			if (!drawing) {
				const coordinates: LngLat[] = [[element.lng, element.lat]];
				fiberDrawingRef.current = { fromElement: element, coordinates };
				updateFiberDraftSource(coordinates);
				setSelectedFeature({ kind: "element", element });
				setStatusMessage(
					`Origen seleccionado: ${element.name ?? element.code}. Agrega vértices o selecciona destino.`,
				);
				return;
			}

			if (drawing.fromElement.id === element.id) {
				setStatusMessage("Selecciona un destino diferente al origen.");
				return;
			}

			const coordinates: LngLat[] = [
				...drawing.coordinates,
				[element.lng, element.lat],
			];
			const draftRoute = createDraftRoute(
				drawing.fromElement,
				element,
				coordinates,
				draftRouteCount,
			);
			setDraftRouteCount((current) => current + 1);
			updateFiberDraftSource(coordinates);
			fiberDrawingRef.current = null;
			setSelectedFeature({ kind: "draftRoute", route: draftRoute });
			setStatusMessage(
				`${draftRoute.code} provisional. Revisa datos y guarda la ruta.`,
			);
		},
		[draftRouteCount, updateFiberDraftSource],
	);
	const saveDraftRoute = useCallback(
		async (draft: DraftRoute) => {
			setStatusMessage(`Guardando ${draft.code ?? "ruta"}...`);
			const { createClient } = await import("@/lib/supabase/client");
			const supabase = createClient();
			const { error } = await supabase.rpc("create_fiber_route_draft", {
				p_code: draft.code,
				p_type: draft.type,
				p_status: draft.status,
				p_from_element_id: draft.from_element_id,
				p_to_element_id: draft.to_element_id,
				p_geojson_coordinates: draft.geojson_coordinates,
				p_route_quality: draft.route_quality,
				p_installation_type: draft.installation_type,
				p_fiber_type: draft.fiber_type,
				p_fiber_count: draft.fiber_count,
				p_length_meters: draft.length_meters,
				p_attenuation_db_per_km: draft.attenuation_db_per_km,
				p_splice_loss_db: draft.splice_loss_db,
				p_connector_loss_db: draft.connector_loss_db,
				p_notes: draft.notes,
			});

			if (error) {
				setStatusMessage(`No se pudo guardar la ruta: ${error.message}`);
				return;
			}

			clearDraft();
			setActiveTool("select");
			setStatusMessage(`${draft.code ?? "Ruta"} guardada como borrador.`);
			router.refresh();
		},
		[clearDraft, router],
	);

	const saveRoutePointDraft = useCallback(
		async (draft: DraftRoutePoint) => {
			setStatusMessage("Guardando punto...");
			const { createClient } = await import("@/lib/supabase/client");
			const supabase = createClient();
			const { error } = await supabase.rpc("create_route_point_draft", {
				p_fiber_route_id: draft.fiber_route_id,
				p_type: draft.type,
				p_lng: draft.lng,
				p_lat: draft.lat,
				p_code: draft.code,
				p_location_quality: draft.location_quality,
				p_crossing_type: draft.crossing_type,
				p_risk_level: draft.risk_level,
				p_reserve_length_m: draft.reserve_length_m,
				p_splice_loss_db: draft.splice_loss_db,
				p_reference_text: draft.reference_text,
				p_notes: draft.notes,
			});
			if (error) {
				setStatusMessage(`No se pudo guardar el punto: ${error.message}`);
				return;
			}
			setSelectedFeature(null);
			setActiveTool("select");
			setStatusMessage("Punto guardado.");
			router.refresh();
		},
		[router],
	);

	const deleteFeature = useCallback(
		async (feature: SelectedFeature) => {
			const { createClient } = await import("@/lib/supabase/client");
			const supabase = createClient();
			let error: { message: string } | null = null;

			if (feature.kind === "element") {
				setStatusMessage(`Eliminando ${feature.element.code}...`);
				({ error } = await supabase.rpc("delete_infrastructure_element", {
					p_id: feature.element.id,
				}));
			} else if (feature.kind === "route") {
				setStatusMessage("Eliminando ruta...");
				({ error } = await supabase.rpc("delete_fiber_route", {
					p_id: feature.route.id,
				}));
			} else if (feature.kind === "routePoint") {
				setStatusMessage("Eliminando punto...");
				({ error } = await supabase.rpc("delete_route_point", {
					p_id: feature.point.id,
				}));
			}

			if (error) {
				setStatusMessage(`No se pudo eliminar: ${error.message}`);
				return;
			}
			setSelectedFeature(null);
			setActiveTool("select");
			setStatusMessage("Elemento eliminado.");
			router.refresh();
		},
		[router],
	);

	// Keep refs in sync so Mapbox effects can access latest props without deps
	equipmentRef.current = equipment;
	connectionsRef.current = connections;
	routePointsRef.current = routePoints;
	routesByIdRef.current = new Map(
		connections.map((route) => [route.id, route]),
	);
	routePointsByIdRef.current = new Map(
		routePoints.map((point) => [point.id, point]),
	);
	activeToolRef.current = activeTool;
	selectedFeatureRef.current = selectedFeature;

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		map.getCanvas().style.cursor =
			mode === "view"
				? ""
				: activeTool === "pan"
					? "grab"
					: activeTool === "select"
						? ""
						: "crosshair";
		setStatusMessage(
			mode === "view"
				? "Explora la red. La visibilidad se adapta al zoom."
				: TOOL_HELP[activeTool],
		);
	}, [activeTool, mode]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement ||
				event.target instanceof HTMLSelectElement
			) {
				return;
			}

			const key = event.key.toLowerCase();
			const shortcutMap: Partial<Record<string, EditorTool>> = {
				v: "select",
				h: "pan",
				o: "olt",
				s: "splitter",
				n: "nap",
				f: "fiber",
				c: "crossing",
				r: "reserve",
				e: "splice",
				m: "measure",
			};

			if (key === "escape") {
				setActiveTool("select");
				clearDraft();
				setStatusMessage("Seleccion cancelada.");
				return;
			}

			const nextTool = shortcutMap[key];
			if (nextTool) {
				setActiveTool(nextTool);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [clearDraft]);

	// ── Sync connections source when equipment status changes (realtime) ───────
	useEffect(() => {
		const map = mapRef.current;
		if (!map?.getSource("connections")) return;
		const src = map.getSource("connections") as mapboxgl.GeoJSONSource;
		src.setData(buildConnectionsGeoJSON(connectionsRef.current, equipment));
	}, [equipment]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map?.getSource("route-points")) return;
		const src = map.getSource("route-points") as mapboxgl.GeoJSONSource;
		src.setData(buildRoutePointsGeoJSON(routePoints));
	}, [routePoints]);

	// ── Realtime: re-fetch server data on equipment/incident changes ───────────
	// Dynamic import keeps env.ts out of SSR module evaluation
	useEffect(() => {
		let unmounted = false;
		let removeChannel: (() => void) | undefined;

		import("@/lib/supabase/client")
			.then(({ createClient }) => {
				if (unmounted) return;
				const supabase = createClient();
				const channel = supabase
					.channel("map-realtime")
					.on(
						"postgres_changes",
						{
							event: "*",
							schema: "public",
							table: "infrastructure_elements",
						},
						() => router.refresh(),
					)
					.on(
						"postgres_changes",
						{ event: "*", schema: "public", table: "fiber_routes" },
						() => router.refresh(),
					)
					.on(
						"postgres_changes",
						{ event: "*", schema: "public", table: "route_points" },
						() => router.refresh(),
					)
					.subscribe();
				removeChannel = () => supabase.removeChannel(channel);
			})
			.catch(() => {});

		return () => {
			unmounted = true;
			removeChannel?.();
		};
	}, [router]);

	// ── Sync marker DOM when props update (after router.refresh) ──────────────
	useEffect(() => {
		const incidentMap = Object.fromEntries(
			incidents.map((i) => [i.equipment_id, i]),
		);

		for (const eq of equipment) {
			const entry = markersByEqId.current.get(eq.id);
			if (!entry) continue;

			if (entry.status !== eq.status) {
				const statusColor = STATUS_COLOR[eq.status] ?? STATUS_COLOR.unknown;
				const showBadge = eq.status !== "online";

				// Update ring
				const ring = entry.outerEl.querySelector(
					'[data-role="status-ring"]',
				) as HTMLElement | null;
				if (ring) {
					ring.style.borderColor = statusColor;
					ring.style.opacity = eq.status === "online" ? "0.42" : "0.85";
				}

				// Update status badge (lives inside wrapper, not outer)
				const wrapper = entry.outerEl.querySelector(
					'[data-role="wrapper"]',
				) as HTMLElement | null;
				const existingBadge = entry.outerEl.querySelector(
					'[data-role="status-badge"]',
				) as HTMLElement | null;
				if (showBadge && !existingBadge && wrapper) {
					const badge = document.createElement("div");
					badge.dataset.role = "status-badge";
					badge.style.cssText = `position:absolute;left:-5px;bottom:-5px;width:14px;height:14px;border-radius:50%;background:${statusColor};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#1b1c1d;border:1.5px solid #1b1c1d;z-index:10;pointer-events:none;font-family:system-ui,sans-serif;line-height:1;`;
					badge.textContent = STATUS_MARK[eq.status] ?? STATUS_MARK.unknown;
					wrapper.appendChild(badge);
				} else if (!showBadge && existingBadge) {
					existingBadge.remove();
				} else if (showBadge && existingBadge) {
					existingBadge.style.background = statusColor;
					existingBadge.textContent =
						STATUS_MARK[eq.status] ?? STATUS_MARK.unknown;
				}

				// Update pulse
				const inner = entry.outerEl.querySelector(
					'[data-role="inner"]',
				) as HTMLElement | null;
				const existingPulse = inner?.querySelector(
					'[data-role="pulse"]',
				) as HTMLElement | null;
				if (eq.status === "alarm" && !existingPulse && inner) {
					const pulse = document.createElement("div");
					pulse.dataset.role = "pulse";
					const r = eq.type === "olt" ? "4px" : "50%";
					pulse.style.cssText = `position:absolute;inset:0;border-radius:${r};background:${STATUS_COLOR.alarm};opacity:0.35;animation:gpon-pulse 1.8s ease-out infinite;pointer-events:none;z-index:-1;`;
					inner.appendChild(pulse);
				} else if (eq.status !== "alarm" && existingPulse) {
					existingPulse.remove();
				}

				entry.status = eq.status;
			}

			// Update incident badge
			const incident = incidentMap[eq.id] ?? null;
			const existingIncident = entry.outerEl.querySelector(
				'[data-role="incident-badge"]',
			) as HTMLElement | null;
			const wrapperEl = entry.outerEl.querySelector(
				'[data-role="wrapper"]',
			) as HTMLElement | null;
			if (incident && !existingIncident && wrapperEl) {
				const badgeColor =
					SEVERITY_COLOR[incident.severity] ?? SEVERITY_COLOR.low;
				const badge = document.createElement("div");
				badge.dataset.role = "incident-badge";
				badge.style.cssText = `position:absolute;top:-5px;right:-5px;width:14px;height:14px;border-radius:50%;background:${badgeColor};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:white;border:1.5px solid #1b1c1d;z-index:10;pointer-events:none;font-family:system-ui,sans-serif;line-height:1;`;
				badge.textContent = "!";
				wrapperEl.appendChild(badge);
			} else if (!incident && existingIncident) {
				existingIncident.remove();
			} else if (incident && existingIncident) {
				existingIncident.style.background =
					SEVERITY_COLOR[incident.severity] ?? SEVERITY_COLOR.low;
			}
		}
	}, [equipment, incidents]);

	// ── Unified visibility: user filters + zoom hierarchy ────────────────────
	useEffect(() => {
		// When user picks a specific type, it overrides zoom hiding for that type
		// so a technician can inspect ONTs even when zoomed out.
		const zoomT = filterType !== "all" ? null : zoomTypes(zoom);
		const zoomC = filterType !== "all" ? null : zoomCableTypes(zoom);

		// Markers
		for (const { marker, type, status } of markersByEqId.current.values()) {
			const visible =
				(filterType === "all" || type === filterType) &&
				(filterStatus === "all" || status === filterStatus) &&
				(zoomT === null || zoomT.has(type));
			marker.getElement().style.display = visible ? "" : "none";
		}

		setSelectedFeature((prev) => {
			if (!prev || prev.kind !== "element") return prev;
			const typeOk = filterType === "all" || prev.element.type === filterType;
			const statusOk =
				filterStatus === "all" || prev.element.status === filterStatus;
			const zoomOk = zoomT === null || zoomT.has(prev.element.type);
			return typeOk && statusOk && zoomOk ? prev : null;
		});

		// Cable layers
		const map = mapRef.current;
		if (!map?.getLayer("connections-line")) return;

		const parts: mapboxgl.FilterSpecification[] = [];

		if (filterType !== "all") {
			parts.push([
				"any",
				["==", ["get", "from_equipment_type"], filterType],
				["==", ["get", "to_equipment_type"], filterType],
			]);
		} else if (zoomC !== null) {
			parts.push(["in", ["get", "cable_type"], ["literal", [...zoomC]]]);
		}

		if (filterStatus !== "all") {
			parts.push(["==", ["get", "worst_status"], filterStatus]);
		}

		const combined: mapboxgl.FilterSpecification | null =
			parts.length === 0
				? null
				: parts.length === 1
					? parts[0]
					: ["all", ...parts];

		for (const layerId of [
			"connections-casing",
			"connections-line",
			"connections-hover",
		] as const) {
			map.setFilter(layerId, combined);
		}

		if (map.getLayer("route-points-circle")) {
			const routePointTools: Partial<Record<EditorTool, string>> = {
				crossing: "crossing",
				reserve: "reserve",
				splice: "splice",
			};
			const activeRoutePointType =
				mode === "edit" ? routePointTools[activeTool] : undefined;
			const showRoutePoints =
				mode === "edit"
					? activeTool !== "olt" && activeTool !== "nap"
					: zoom >= 15;
			const routePointFilter: mapboxgl.FilterSpecification = !showRoutePoints
				? ["==", ["get", "route_point_id"], ""]
				: activeRoutePointType
					? ["==", ["get", "type"], activeRoutePointType]
					: ["!=", ["get", "route_point_id"], ""];

			map.setFilter("route-points-circle", routePointFilter);
			map.setFilter("route-points-label", routePointFilter);
		}
	}, [filterType, filterStatus, zoom, mode, activeTool]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Mapbox map initializes once at mount; props are static server data
	useEffect(() => {
		if (!containerRef.current || mapRef.current) return;

		mapboxgl.accessToken = token;

		const map = new mapboxgl.Map({
			container: containerRef.current,
			style: MAP_STYLE,
			center: DEFAULT_CENTER,
			zoom: DEFAULT_ZOOM,
		});

		mapRef.current = map;
		map.on("zoomend", () => setZoom(map.getZoom()));
		map.on("zoom", () => {
			const currentZoom = map.getZoom();
			for (const { outerEl, type } of markersByEqId.current.values()) {
				setMarkerZoomScale(outerEl, type, currentZoom);
			}
		});
		// offsetWidth/Height can be 0 when Mapbox computes the "center" anchor
		// before the browser runs a first layout pass on the custom elements.
		// Re-snapping on every camera stop forces a reflow and corrects the
		// resulting pixel drift at all zoom levels (not just on zoom changes).
		map.on("moveend", () => {
			for (const { marker } of markersByEqId.current.values()) {
				marker.setLngLat(marker.getLngLat());
			}
		});

		map.on("load", () => {
			// Silence noisy basemap label layers
			for (const id of NOISE_LAYERS) {
				if (map.getLayer(id)) {
					map.setLayoutProperty(id, "visibility", "none");
				}
			}

			// ── Fiber connections ──────────────────────────────────────────────
			map.addSource("connections", {
				type: "geojson",
				data: buildConnectionsGeoJSON(connections, equipment),
			});
			map.addSource("fiber-draft", {
				type: "geojson",
				data: buildDrawingGeoJSON([]),
			});

			// Width by cable type, scaled by zoom — feeder is widest, drop thinnest.
			// Mapbox interpolates line-width per zoom level; the inner ["match"]
			// expression returns the *base* width that gets multiplied by zoom factor.
			const cableWidthByType: mapboxgl.ExpressionSpecification = [
				"match",
				["get", "cable_type"],
				"feeder",
				1.7,
				"distribution",
				1.25,
				"drop",
				0.85,
				0.85,
			];

			// Status opacity — only applied to the main line, not the casing.
			// Casing is always opaque so it provides contrast regardless of status.
			const lineOpacityByStatus: mapboxgl.ExpressionSpecification = [
				"match",
				["get", "worst_status"],
				"offline",
				0.22,
				"maintenance",
				0.6,
				0.92,
			];

			// Light casing keeps fibers legible on the dark Mapbox style while the
			// colored core still communicates cable type.
			map.addLayer({
				id: "connections-casing",
				type: "line",
				source: "connections",
				layout: {
					"line-cap": "round",
					"line-join": "round",
				},
				paint: {
					"line-color": [
						"match",
						["get", "cable_type"],
						"feeder",
						"rgba(56,189,248,0.55)",
						"distribution",
						"rgba(167,139,250,0.55)",
						"drop",
						"rgba(52,211,153,0.55)",
						"rgba(164,164,164,0.55)",
					] as mapboxgl.ExpressionSpecification,
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						10,
						["*", cableWidthByType, 2.1],
						14,
						["*", cableWidthByType, 4.2],
						18,
						["*", cableWidthByType, 8.4],
					],
					"line-opacity": 1,
					"line-blur": 2.2,
					"line-emissive-strength": 0.35,
				},
			});

			// Main line — drop uses butt cap so dasharray produces clean dashes,
			// not rounded blobs. Feeder and distribution keep round for smooth joins.
			map.addLayer({
				id: "connections-line",
				type: "line",
				source: "connections",
				layout: {
					"line-cap": [
						"match",
						["get", "cable_type"],
						"drop",
						"butt",
						"round",
					] as mapboxgl.ExpressionSpecification,
					"line-join": "round",
				},
				paint: {
					"line-color": [
						"match",
						["get", "cable_type"],
						"feeder",
						CABLE_COLOR.feeder,
						"distribution",
						CABLE_COLOR.distribution,
						"drop",
						CABLE_COLOR.drop,
						CABLE_COLOR.default,
					],
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						10,
						["*", cableWidthByType, 1.05],
						14,
						["*", cableWidthByType, 2.1],
						18,
						["*", cableWidthByType, 4.2],
					],
					"line-opacity": [
						"interpolate",
						["linear"],
						["zoom"],
						10,
						["*", lineOpacityByStatus, 0.75],
						14,
						lineOpacityByStatus,
					],
					"line-dasharray": [
						"match",
						["get", "cable_type"],
						"drop",
						["literal", [4, 3]],
						["literal", [1]],
					],
					"line-emissive-strength": 0.65,
				},
			});

			// ── Cable hover highlight layer ────────────────────────────────────
			// Invisible by default (filter matches nothing); shown on mouseenter
			// via setFilter. No feature-state needed — uses property equality.
			map.addLayer({
				id: "connections-hover",
				type: "line",
				source: "connections",
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": "rgba(255,255,255,0.28)",
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						10,
						["*", cableWidthByType, 1.8],
						14,
						["*", cableWidthByType, 3],
						18,
						["*", cableWidthByType, 4.2],
					],
					"line-blur": 1.2,
					"line-emissive-strength": 0.8,
				},
				filter: ["==", ["get", "connection_id"], ""],
			});

			map.addLayer({
				id: "fiber-draft-line",
				type: "line",
				source: "fiber-draft",
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": "#e6e6e6",
					"line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 16, 5],
					"line-dasharray": ["literal", [2, 2]],
					"line-opacity": 0.88,
					"line-emissive-strength": 0.8,
				},
			});

			// ── Route points: crossings, cable reserves, splices ────────────────
			map.addSource("route-points", {
				type: "geojson",
				data: buildRoutePointsGeoJSON(routePointsRef.current),
			});

			map.addLayer({
				id: "route-points-circle",
				type: "circle",
				source: "route-points",
				paint: {
					"circle-radius": [
						"interpolate",
						["linear"],
						["zoom"],
						13,
						4,
						16,
						6,
						19,
						8,
					],
					"circle-color": [
						"match",
						["get", "type"],
						"crossing",
						ROUTE_POINT_COLOR.crossing,
						"reserve",
						ROUTE_POINT_COLOR.reserve,
						"splice",
						ROUTE_POINT_COLOR.splice,
						"#a4a4a4",
					],
					"circle-stroke-color": "rgba(27,28,29,0.95)",
					"circle-stroke-width": 2,
					"circle-opacity": 0.95,
					"circle-emissive-strength": 0.65,
				},
				filter: ["==", ["get", "route_point_id"], ""],
			});

			map.addLayer({
				id: "route-points-label",
				type: "symbol",
				source: "route-points",
				layout: {
					"text-field": [
						"match",
						["get", "type"],
						"crossing",
						"×",
						"reserve",
						"R",
						"splice",
						"E",
						"•",
					],
					"text-size": 10,
					"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
					"text-allow-overlap": true,
					"text-ignore-placement": true,
				},
				paint: {
					"text-color": "#1b1c1d",
					"text-halo-color": "rgba(255,255,255,0.12)",
					"text-halo-width": 0.5,
				},
				filter: ["==", ["get", "route_point_id"], ""],
			});

			// ── Cable mouse interactions ───────────────────────────────────────
			map.on("mouseenter", "connections-line", (e) => {
				map.getCanvas().style.cursor = "pointer";
				const id = e.features?.[0]?.properties?.connection_id ?? "";
				map.setFilter("connections-hover", [
					"==",
					["get", "connection_id"],
					id,
				]);
			});

			map.on("mouseleave", "connections-line", () => {
				map.getCanvas().style.cursor = "";
				map.setFilter("connections-hover", [
					"==",
					["get", "connection_id"],
					"",
				]);
			});

			map.on("click", "connections-line", (e) => {
				const props = e.features?.[0]?.properties;
				if (!props) return;

				popupRef.current?.remove();
				popupRef.current = null;

				const route = routesByIdRef.current.get(props.connection_id);
				if (route) {
					setSelectedFeature({ kind: "route", route });
					setStatusMessage(`Ruta seleccionada: ${route.code ?? route.id}.`);
					return;
				}

				const cableLabel: Record<string, string> = {
					feeder: "Feeder",
					distribution: "Distribución",
					drop: "Drop",
				};
				const fiberLabel: Record<string, string> = {
					"single-mode": "SM",
					"multi-mode": "MM",
				};

				const rows: Array<[string, string]> = [
					["Tipo", cableLabel[props.cable_type] ?? props.cable_type ?? "—"],
					[
						"Fibra",
						props.fiber_type
							? (fiberLabel[props.fiber_type] ?? props.fiber_type)
							: "—",
					],
					[
						"Longitud",
						props.length_meters != null
							? `${Number(props.length_meters).toFixed(0)} m`
							: "—",
					],
				];

				const rowsHtml = rows
					.map(
						([label, value]) =>
							`<div style="display:flex;justify-content:space-between;gap:20px;padding:2px 0">
              <span style="color:#777879">${label}</span>
              <span style="font-family:ui-monospace,monospace;font-size:11px">${value}</span>
            </div>`,
					)
					.join("");

				const html = `
          <div style="background:rgba(34,35,36,0.95);border:1px solid rgba(164,164,164,0.18);border-radius:10px;padding:10px 14px;font-family:system-ui,sans-serif;font-size:12px;color:#e6e6e6;min-width:148px;backdrop-filter:blur(12px)">
            <p style="margin:0 0 7px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#777879">Fibra óptica</p>
            ${rowsHtml}
          </div>`;

				popupRef.current = new mapboxgl.Popup({
					closeButton: false,
					closeOnClick: false,
					maxWidth: "none",
					offset: 8,
					className: "gpon-cable-popup",
				})
					.setLngLat(e.lngLat)
					.setHTML(html)
					.addTo(map);

				setSelectedFeature(null);
			});

			map.on("mouseenter", "route-points-circle", () => {
				map.getCanvas().style.cursor = "pointer";
			});

			map.on("mouseleave", "route-points-circle", () => {
				map.getCanvas().style.cursor = "";
			});

			map.on("click", "route-points-circle", (e) => {
				e.preventDefault();
				const props = e.features?.[0]?.properties;
				if (!props) return;

				popupRef.current?.remove();
				popupRef.current = null;

				const point = routePointsByIdRef.current.get(props.route_point_id);
				if (point) {
					setSelectedFeature({ kind: "routePoint", point });
					setStatusMessage(
						`Punto de ruta seleccionado: ${point.code ?? point.type}.`,
					);
					return;
				}

				const pointLabel: Record<string, string> = {
					crossing: "Cruce",
					reserve: "Reserva",
					splice: "Empalme",
				};
				const rows: Array<[string, string]> = [
					["Tipo", pointLabel[props.type] ?? props.type ?? "—"],
					["Código", props.code ?? "—"],
					["Calidad", props.location_quality ?? "—"],
				];

				if (props.position_on_route_m != null) {
					rows.push([
						"Posición",
						`${Number(props.position_on_route_m).toFixed(0)} m`,
					]);
				}
				if (props.reserve_length_m != null) {
					rows.push([
						"Reserva",
						`${Number(props.reserve_length_m).toFixed(0)} m`,
					]);
				}
				if (props.splice_loss_db != null) {
					rows.push([
						"Pérdida",
						`${Number(props.splice_loss_db).toFixed(2)} dB`,
					]);
				}
				if (props.risk_level) {
					rows.push(["Riesgo", props.risk_level]);
				}

				const rowsHtml = rows
					.map(
						([label, value]) =>
							`<div style="display:flex;justify-content:space-between;gap:20px;padding:2px 0">
              <span style="color:#777879">${label}</span>
              <span style="font-family:ui-monospace,monospace;font-size:11px">${value}</span>
            </div>`,
					)
					.join("");

				const html = `
          <div style="background:rgba(34,35,36,0.95);border:1px solid rgba(164,164,164,0.18);border-radius:10px;padding:10px 14px;font-family:system-ui,sans-serif;font-size:12px;color:#e6e6e6;min-width:168px;backdrop-filter:blur(12px)">
            <p style="margin:0 0 7px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#777879">Punto de ruta</p>
            ${rowsHtml}
          </div>`;

				const lngLat = e.lngLat;
				popupRef.current = new mapboxgl.Popup({
					closeButton: false,
					closeOnClick: false,
					maxWidth: "none",
					offset: 8,
					className: "gpon-cable-popup",
				})
					.setLngLat(lngLat)
					.setHTML(html)
					.addTo(map);

				setSelectedFeature(null);
			});

			// ── Equipment HTML markers ─────────────────────────────────────────
			for (const eq of equipment) {
				const outerEl = createMarkerEl(eq, incidentByEquipment[eq.id] ?? null);

				const marker = new mapboxgl.Marker({
					element: outerEl,
					anchor: "center",
				})
					.setLngLat([eq.lng, eq.lat])
					.addTo(map);
				setMarkerZoomScale(outerEl, eq.type, map.getZoom());

				markersByEqId.current.set(eq.id, {
					marker,
					outerEl,
					type: eq.type,
					status: eq.status,
				});

				outerEl.addEventListener("click", (e) => {
					e.stopPropagation();
					popupRef.current?.remove();
					popupRef.current = null;
					if (activeToolRef.current === "fiber") {
						handleFiberElementClick(eq);
						return;
					}
					if (activeToolRef.current !== "select") {
						setStatusMessage(
							`${TOOL_HELP[activeToolRef.current]} Elemento elegido: ${eq.name}.`,
						);
					}
					setSelectedFeature({ kind: "element", element: eq });
				});
			}

			// Fit the initial view to all equipment so neither cluster is cut off
			if (equipment.length > 0) {
				const bounds = new mapboxgl.LngLatBounds();
				for (const eq of equipment) bounds.extend([eq.lng, eq.lat]);
				map.fitBounds(bounds, { padding: 100, maxZoom: 15, animate: false });
			}

			// Click on empty map area → deselect + close cable popup
			map.on("click", (event) => {
				const tool = activeToolRef.current;
				if (tool === "select" || tool === "pan") {
					setSelectedFeature(null);
				} else if (tool === "olt" || tool === "splitter" || tool === "nap") {
					createElementDraftAt(tool, event.lngLat);
				} else if (tool === "fiber") {
					addFiberVertex(event.lngLat);
				} else if (
					tool === "crossing" ||
					tool === "reserve" ||
					tool === "splice"
				) {
					const selected = selectedFeatureRef.current;
					if (selected?.kind !== "route") {
						setStatusMessage(
							"Selecciona una ruta primero, luego marca el punto sobre el mapa.",
						);
					} else {
						const draft: DraftRoutePoint = {
							isDraft: true,
							id: crypto.randomUUID(),
							organization_id: null,
							fiber_route_id: selected.route.id,
							type: tool,
							code: null,
							status: null,
							lng: event.lngLat.lng,
							lat: event.lngLat.lat,
							location_quality: "approximate",
							position_on_route_m: null,
							reserve_length_m: null,
							splice_loss_db: null,
							crossing_type: null,
							risk_level: null,
							reference_text: null,
							properties: {},
							notes: null,
							created_by: null,
							updated_by: null,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
						};
						setSelectedFeature({ kind: "draftRoutePoint", point: draft });
						setStatusMessage(
							`Punto de ${tool} provisional. Completa datos y guarda.`,
						);
					}
				} else {
					setStatusMessage(TOOL_HELP[tool]);
				}
				popupRef.current?.remove();
				popupRef.current = null;
			});
		});

		return () => {
			popupRef.current?.remove();
			popupRef.current = null;
			draftMarkerRef.current?.remove();
			draftMarkerRef.current = null;
			for (const { marker } of markersByEqId.current.values()) marker.remove();
			markersByEqId.current.clear();
			map.remove();
			mapRef.current = null;
		};
	}, []);

	return (
		<div className="relative h-full w-full">
			<style>{`
        @keyframes gpon-pulse {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.35; }
          70%  { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
      `}</style>

			<div ref={containerRef} className="h-full w-full" />

			<EditorTopBar
				activeToolLabel={activeToolLabel}
				mode={mode}
				onModeChange={(nextMode) => {
					setMode(nextMode);
					if (nextMode === "view") {
						setActiveTool("select");
					}
				}}
			/>

			{isEditing && (
				<EditorToolbar activeTool={activeTool} onToolChange={setActiveTool} />
			)}

			<InfrastructurePanel
				tab={leftTab}
				onTabChange={setLeftTab}
				mode={mode}
				equipment={visibleEquipment}
				totalEquipment={equipment.length}
				connections={connections}
				routePointCount={routePointCount}
				incidents={incidents}
				filterType={filterType}
				filterStatus={filterStatus}
				onTypeChange={setFilterType}
				onStatusChange={setFilterStatus}
				onSelectEquipment={(eq) => {
					setSelectedFeature({ kind: "element", element: eq });
					mapRef.current?.flyTo({
						center: [eq.lng, eq.lat],
						zoom: Math.max(mapRef.current.getZoom(), 16),
						duration: 650,
					});
				}}
			/>

			<PropertiesPanel
				selectedFeature={selectedFeature}
				incident={
					selectedFeature?.kind === "element"
						? (incidentByEquipment[selectedFeature.element.id] ?? null)
						: null
				}
				mode={mode}
				onClose={() => setSelectedFeature(null)}
				onCancelDraft={clearDraft}
				onDraftChange={(patch) => {
					setSelectedFeature((current) => {
						if (current?.kind !== "draftElement") return current;
						const nextElement = { ...current.element, ...patch };
						return { kind: "draftElement", element: nextElement };
					});
				}}
				onDraftRouteChange={(patch) => {
					setSelectedFeature((current) => {
						if (current?.kind !== "draftRoute") return current;
						const nextRoute = {
							...current.route,
							...patch,
							cable_type: patch.type ?? current.route.type,
						};
						return { kind: "draftRoute", route: nextRoute };
					});
				}}
				onDraftRoutePointChange={(patch) => {
					setSelectedFeature((current) => {
						if (current?.kind !== "draftRoutePoint") return current;
						return {
							kind: "draftRoutePoint",
							point: { ...current.point, ...patch },
						};
					});
				}}
				isDeleting={activeTool === "delete"}
				onDelete={deleteFeature}
				onSaveDraft={saveDraftElement}
				onSaveDraftRoute={saveDraftRoute}
				onSaveRoutePointDraft={saveRoutePointDraft}
			/>

			{mode === "view" && <Legend />}
			<MapControls
				mode={mode}
				hasRightPanel={mode === "edit" || selectedFeature !== null}
				onZoomIn={() => mapRef.current?.zoomIn()}
				onZoomOut={() => mapRef.current?.zoomOut()}
				onResetNorth={() => mapRef.current?.resetNorth()}
				onFit={() => {
					const map = mapRef.current;
					if (!map || equipment.length === 0) return;
					const bounds = new mapboxgl.LngLatBounds();
					for (const eq of equipment) bounds.extend([eq.lng, eq.lat]);
					map.fitBounds(bounds, { padding: 120, maxZoom: 15, duration: 650 });
				}}
			/>
			<EditorStatusBar
				activeToolLabel={activeToolLabel}
				statusMessage={statusMessage}
				zoom={zoom}
			/>
		</div>
	);
}

function EditorTopBar({
	activeToolLabel,
	mode,
	onModeChange,
}: {
	activeToolLabel: string;
	mode: EditorMode;
	onModeChange: (mode: EditorMode) => void;
}) {
	return (
		<div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.9)] p-1 shadow-2xl backdrop-blur-md">
			<div className="flex rounded-md bg-[rgba(164,164,164,0.06)] p-0.5">
				{[
					["view", "Visualizar"],
					["edit", "Editar"],
				].map(([value, label]) => (
					<button
						key={value}
						type="button"
						onClick={() => onModeChange(value as EditorMode)}
						className="rounded px-3 py-1.5 text-[11px] font-medium transition-colors"
						style={{
							background:
								mode === value ? "rgba(56,189,248,0.16)" : "transparent",
							color: mode === value ? "#bdeafe" : "#a4a4a4",
						}}
					>
						{label}
					</button>
				))}
			</div>
			<span className="rounded-md border border-[rgba(56,189,248,0.24)] bg-[rgba(56,189,248,0.1)] px-2.5 py-1.5 text-[11px] text-[#bdeafe]">
				{mode === "edit" ? activeToolLabel : "Capas por zoom"}
			</span>
		</div>
	);
}

function EditorToolbar({
	activeTool,
	onToolChange,
}: {
	activeTool: EditorTool;
	onToolChange: (tool: EditorTool) => void;
}) {
	const groups = ["navigate", "create", "route", "inspect"] as const;

	return (
		<div className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] p-2 shadow-2xl backdrop-blur-md">
			{groups.map((group) => (
				<div
					key={group}
					className="flex items-center gap-1"
					title={TOOL_GROUP_LABEL[group]}
				>
					{group !== "navigate" && (
						<div className="mx-1 h-8 w-px bg-[rgba(164,164,164,0.14)]" />
					)}
					{EDITOR_TOOLS.filter((tool) => tool.group === group).map((tool) => (
						<button
							key={tool.value}
							type="button"
							onClick={() => onToolChange(tool.value)}
							title={`${tool.label} (${tool.shortcut})`}
							aria-label={tool.label}
							aria-pressed={activeTool === tool.value}
							className="flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-[11px] font-semibold transition-colors"
							style={{
								background:
									activeTool === tool.value
										? "rgba(56,189,248,0.18)"
										: "rgba(164,164,164,0.06)",
								borderColor:
									activeTool === tool.value
										? "rgba(56,189,248,0.45)"
										: "rgba(164,164,164,0.12)",
								color: activeTool === tool.value ? "#bdeafe" : "#a4a4a4",
							}}
						>
							<ToolGlyph tool={tool.value} />
						</button>
					))}
				</div>
			))}
		</div>
	);
}

function ToolGlyph({ tool }: { tool: EditorTool }) {
	const label: Record<EditorTool, string> = {
		select: "V",
		pan: "H",
		olt: "OLT",
		splitter: "SPL",
		nap: "NAP",
		fiber: "F",
		crossing: "X",
		reserve: "R",
		splice: "E",
		measure: "M",
		delete: "DEL",
	};

	return (
		<span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono">
			{label[tool]}
		</span>
	);
}

function InfrastructurePanel({
	tab,
	onTabChange,
	mode,
	equipment,
	totalEquipment,
	connections,
	routePointCount,
	incidents,
	filterType,
	filterStatus,
	onTypeChange,
	onStatusChange,
	onSelectEquipment,
}: {
	tab: LeftPanelTab;
	onTabChange: (tab: LeftPanelTab) => void;
	mode: EditorMode;
	equipment: EquipmentMapItem[];
	totalEquipment: number;
	connections: ConnectionMapItem[];
	routePointCount: number;
	incidents: IncidentMapItem[];
	filterType: string;
	filterStatus: string;
	onTypeChange: (v: string) => void;
	onStatusChange: (v: string) => void;
	onSelectEquipment: (eq: EquipmentMapItem) => void;
}) {
	const counts = equipment.reduce<Record<string, number>>((acc, eq) => {
		acc[eq.type] = (acc[eq.type] ?? 0) + 1;
		return acc;
	}, {});
	const warnings = [
		...equipment
			.filter(
				(eq) =>
					(eq.type === "olt" && eq.total_pon_ports == null) ||
					(eq.type === "splitter" && !eq.split_ratio) ||
					(eq.type === "nap" && eq.total_ports == null),
			)
			.slice(0, 4)
			.map((eq) => `${eq.name}: dato tecnico pendiente`),
		...connections
			.filter((connection) => connection.length_meters == null)
			.slice(0, 2)
			.map(() => "Ruta sin longitud registrada"),
	];

	return (
		<div
			className={`absolute left-4 top-4 z-20 flex max-h-[calc(100%-5rem)] flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md ${mode === "edit" ? "w-80" : "w-72"}`}
		>
			<div className="border-b border-[rgba(164,164,164,0.12)] px-3 py-2.5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Infraestructura
						</p>
						<p className="mt-1 text-sm font-semibold text-[#e6e6e6]">
							{totalEquipment} elementos
						</p>
					</div>
					<div className="rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(164,164,164,0.07)] px-2 py-1 text-right">
						<p className="font-mono text-xs text-[#e6e6e6]">
							{connections.length}
						</p>
						<p className="text-[10px] text-[#777879]">rutas</p>
					</div>
				</div>

				<div className="mt-3 flex rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] p-0.5">
					{[
						["layers", "Capas"],
						["elements", "Elementos"],
						["quality", "Calidad"],
					].map(([value, label]) => (
						<button
							key={value}
							type="button"
							onClick={() => onTabChange(value as LeftPanelTab)}
							className="flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors"
							style={{
								background:
									tab === value ? "rgba(164,164,164,0.16)" : "transparent",
								color: tab === value ? "#e6e6e6" : "#858585",
							}}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{tab === "layers" && (
				<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
					<div className="mb-3 grid grid-cols-3 gap-2">
						<Metric
							label="OLT"
							value={counts.olt ?? 0}
							color={TYPE_COLOR.olt}
						/>
						<Metric
							label="SPL"
							value={counts.splitter ?? 0}
							color={TYPE_COLOR.splitter}
						/>
						<Metric
							label="NAP"
							value={counts.nap ?? 0}
							color={TYPE_COLOR.nap}
						/>
					</div>
					<FilterBar
						filterType={filterType}
						filterStatus={filterStatus}
						onTypeChange={onTypeChange}
						onStatusChange={onStatusChange}
					/>
					<div className="mt-4 space-y-2">
						<LayerToggle label="Rutas feeder" color={CABLE_COLOR.feeder} />
						<LayerToggle
							label="Rutas distribución"
							color={CABLE_COLOR.distribution}
						/>
						<LayerToggle label="Cruces" color="#d7d7d7" />
						<LayerToggle label="Reservas" color="#f6c768" />
						<LayerToggle label="Empalmes" color="#fb7185" />
					</div>
					<p className="mt-3 text-[11px] text-[#777879]">
						{routePointCount} puntos relevantes cargados
					</p>
				</div>
			)}

			{tab === "elements" && (
				<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
					<div className="mb-3 flex items-center justify-between">
						<p className="text-xs font-semibold uppercase tracking-widest text-[#777879]">
							Listado
						</p>
						<p className="text-[11px] text-[#777879]">
							{equipment.length} visibles
						</p>
					</div>
					<div className="space-y-1.5">
						{equipment.slice(0, 12).map((eq) => (
							<button
								key={eq.id}
								type="button"
								onClick={() => onSelectEquipment(eq)}
								className="flex w-full items-center justify-between gap-3 rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(164,164,164,0.05)] px-2.5 py-2 text-left transition-colors hover:border-[rgba(164,164,164,0.24)] hover:bg-[rgba(164,164,164,0.1)]"
							>
								<span className="flex min-w-0 items-center gap-2">
									<span
										className="h-2.5 w-2.5 shrink-0 rounded-full"
										style={{
											backgroundColor:
												TYPE_COLOR[eq.type] ?? TYPE_COLOR.unknown,
										}}
									/>
									<span className="min-w-0">
										<span className="block truncate text-xs font-medium text-[#d7d7d7]">
											{eq.name}
										</span>
										<span className="block text-[10px] uppercase tracking-wide text-[#777879]">
											{eq.type}
										</span>
									</span>
								</span>
								<span
									className="h-2 w-2 shrink-0 rounded-full"
									style={{
										backgroundColor:
											STATUS_COLOR[eq.status] ?? STATUS_COLOR.unknown,
									}}
								/>
							</button>
						))}
					</div>
				</div>
			)}

			{tab === "quality" && (
				<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
					<div className="mb-3 flex items-center justify-between">
						<p className="text-xs font-semibold uppercase tracking-widest text-[#777879]">
							Advertencias
						</p>
						<p className="text-[11px] text-[#777879]">
							{incidents.length} incidentes
						</p>
					</div>
					{warnings.length > 0 ? (
						<div className="space-y-1.5">
							{warnings.slice(0, 3).map((warning) => (
								<p
									key={warning}
									className="rounded-md border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.09)] px-2 py-1.5 text-[11px] leading-snug text-[#f6c768]"
								>
									{warning}
								</p>
							))}
						</div>
					) : (
						<p className="rounded-md border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.08)] px-2 py-1.5 text-[11px] text-[#9ee8c9]">
							Sin advertencias basicas en la vista actual.
						</p>
					)}
				</div>
			)}
		</div>
	);
}

function Metric({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: string;
}) {
	return (
		<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] px-2 py-1.5">
			<div className="flex items-center gap-1.5">
				<span
					className="h-1.5 w-1.5 rounded-full"
					style={{ backgroundColor: color }}
				/>
				<span className="text-[10px] font-semibold text-[#777879]">
					{label}
				</span>
			</div>
			<p className="mt-1 font-mono text-sm text-[#e6e6e6]">{value}</p>
		</div>
	);
}

function LayerToggle({ label, color }: { label: string; color: string }) {
	return (
		<label className="flex cursor-pointer items-center justify-between rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(164,164,164,0.05)] px-2.5 py-2 text-xs text-[#d7d7d7]">
			<span className="flex items-center gap-2">
				<span
					className="h-2 w-2 rounded-full"
					style={{ backgroundColor: color }}
				/>
				{label}
			</span>
			<input
				type="checkbox"
				defaultChecked
				className="h-3.5 w-3.5 accent-[#38bdf8]"
			/>
		</label>
	);
}

function PropertiesPanel({
	selectedFeature,
	incident,
	mode,
	isDeleting,
	onClose,
	onCancelDraft,
	onDraftChange,
	onDraftRouteChange,
	onDraftRoutePointChange,
	onDelete,
	onSaveDraft,
	onSaveDraftRoute,
	onSaveRoutePointDraft,
}: {
	selectedFeature: AnySelectedFeature | null;
	incident: IncidentMapItem | null;
	mode: EditorMode;
	isDeleting: boolean;
	onClose: () => void;
	onCancelDraft: () => void;
	onDraftChange: (patch: DraftElementPatch) => void;
	onDraftRouteChange: (patch: DraftRoutePatch) => void;
	onDraftRoutePointChange: (patch: DraftRoutePointPatch) => void;
	onDelete: (feature: SelectedFeature) => void | Promise<void>;
	onSaveDraft: (draft: DraftElement) => void | Promise<void>;
	onSaveDraftRoute: (draft: DraftRoute) => void | Promise<void>;
	onSaveRoutePointDraft: (draft: DraftRoutePoint) => void | Promise<void>;
}) {
	const title =
		selectedFeature?.kind === "draftElement"
			? `${selectedFeature.element.code} (provisional)`
			: selectedFeature?.kind === "draftRoutePoint"
				? `${selectedFeature.point.type} (provisional)`
				: selectedFeature?.kind === "element"
					? (selectedFeature.element.name ?? selectedFeature.element.code)
					: selectedFeature?.kind === "route"
						? (selectedFeature.route.code ?? "Ruta sin código")
						: selectedFeature?.kind === "routePoint"
							? (selectedFeature.point.code ?? selectedFeature.point.type)
							: "Sin selección";
	const accentColor =
		selectedFeature?.kind === "draftElement"
			? (TYPE_COLOR[selectedFeature.element.type] ?? TYPE_COLOR.unknown)
			: selectedFeature?.kind === "draftRoutePoint"
				? (ROUTE_POINT_COLOR[selectedFeature.point.type] ?? TYPE_COLOR.unknown)
				: selectedFeature?.kind === "element"
					? (TYPE_COLOR[selectedFeature.element.type] ?? TYPE_COLOR.unknown)
					: selectedFeature?.kind === "route"
						? (CABLE_COLOR[selectedFeature.route.type] ?? CABLE_COLOR.default)
						: selectedFeature?.kind === "routePoint"
							? (ROUTE_POINT_COLOR[selectedFeature.point.type] ??
								TYPE_COLOR.unknown)
							: "transparent";

	if (mode === "view" && !selectedFeature) return null;

	return (
		<div className="absolute right-4 top-4 z-20 flex max-h-[calc(100%-5rem)] w-80 flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			<div className="h-1 w-full" style={{ backgroundColor: accentColor }} />
			<div className="border-b border-[rgba(164,164,164,0.12)] px-4 py-3">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Propiedades
						</p>
						<h2 className="mt-1 text-sm font-semibold text-[#e6e6e6]">
							{title}
						</h2>
					</div>
					{selectedFeature && (
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-[rgba(164,164,164,0.14)] px-2 py-1 text-xs text-[#a4a4a4] transition-colors hover:bg-white/10"
						>
							Cerrar
						</button>
					)}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				{selectedFeature ? (
					<SelectedFeatureProperties
						selectedFeature={selectedFeature}
						incident={incident}
						isDeleting={isDeleting}
						onCancelDraft={onCancelDraft}
						onDraftChange={onDraftChange}
						onDraftRouteChange={onDraftRouteChange}
						onDraftRoutePointChange={onDraftRoutePointChange}
						onDelete={onDelete}
						onSaveDraft={onSaveDraft}
						onSaveDraftRoute={onSaveDraftRoute}
						onSaveRoutePointDraft={onSaveRoutePointDraft}
					/>
				) : (
					<div className="space-y-3 text-xs text-[#a4a4a4]">
						<p>
							{mode === "edit"
								? "Selecciona o crea un elemento para editar sus datos mínimos."
								: "Selecciona un elemento para consultar sus detalles."}
						</p>
						<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] px-3 py-2">
							<p className="font-semibold text-[#d7d7d7]">Flujo MVP</p>
							<p className="mt-1 text-[#858585]">
								OLT, splitter, NAP, rutas y puntos relevantes con calidad de
								dato.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function SelectedFeatureProperties({
	selectedFeature,
	incident,
	isDeleting,
	onCancelDraft,
	onDraftChange,
	onDraftRouteChange,
	onDraftRoutePointChange,
	onDelete,
	onSaveDraft,
	onSaveDraftRoute,
	onSaveRoutePointDraft,
}: {
	selectedFeature: AnySelectedFeature;
	incident: IncidentMapItem | null;
	isDeleting: boolean;
	onCancelDraft: () => void;
	onDraftChange: (patch: DraftElementPatch) => void;
	onDraftRouteChange: (patch: DraftRoutePatch) => void;
	onDraftRoutePointChange: (patch: DraftRoutePointPatch) => void;
	onDelete: (feature: SelectedFeature) => void | Promise<void>;
	onSaveDraft: (draft: DraftElement) => void | Promise<void>;
	onSaveDraftRoute: (draft: DraftRoute) => void | Promise<void>;
	onSaveRoutePointDraft: (draft: DraftRoutePoint) => void | Promise<void>;
}) {
	if (selectedFeature.kind === "draftElement") {
		const draft = selectedFeature.element;
		return (
			<div className="space-y-3">
				<PropertyRow label="Entidad" value="Elemento provisional" />
				<PropertyRow label="Tipo" value={draft.type.toUpperCase()} />
				<PropertyRow label="Estado" value={draft.status} />
				<DraftTextField
					label="Código"
					value={draft.code}
					onChange={(code) => onDraftChange({ code })}
				/>
				<DraftTextField
					label="Nombre"
					value={draft.name ?? ""}
					onChange={(name) => onDraftChange({ name: name || null })}
				/>
				<DraftSelectField
					label="Calidad"
					value={draft.location_quality}
					options={[
						["unknown", "Desconocida"],
						["approximate", "Aproximada"],
						["gps_captured", "GPS"],
						["verified", "Verificada"],
					]}
					onChange={(location_quality) =>
						onDraftChange({
							location_quality:
								location_quality as DraftElement["location_quality"],
						})
					}
				/>
				{draft.type === "olt" && (
					<DraftNumberField
						label="Puertos PON"
						value={draft.total_pon_ports}
						onChange={(total_pon_ports) => onDraftChange({ total_pon_ports })}
					/>
				)}
				{draft.type === "splitter" && (
					<>
						<DraftSelectField
							label="Ratio"
							value={draft.split_ratio ?? "1:8"}
							options={[
								["1:2", "1:2"],
								["1:4", "1:4"],
								["1:8", "1:8"],
								["1:16", "1:16"],
								["1:32", "1:32"],
								["1:64", "1:64"],
							]}
							onChange={(split_ratio) =>
								onDraftChange({
									split_ratio: split_ratio as DraftElement["split_ratio"],
								})
							}
						/>
						<DraftNumberField
							label="Pérdida"
							value={draft.insertion_loss_db}
							step="0.1"
							onChange={(insertion_loss_db) =>
								onDraftChange({ insertion_loss_db })
							}
						/>
					</>
				)}
				{draft.type === "nap" && (
					<DraftNumberField
						label="Puertos"
						value={draft.total_ports}
						onChange={(total_ports) => onDraftChange({ total_ports })}
					/>
				)}
				<DraftTextField
					label="Referencia"
					value={draft.address_reference ?? ""}
					onChange={(address_reference) =>
						onDraftChange({ address_reference: address_reference || null })
					}
				/>
				<PropertyRow
					label="Ubicación"
					value={`${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`}
				/>
				<div className="grid grid-cols-2 gap-2 pt-2">
					<button
						type="button"
						onClick={onCancelDraft}
						className="rounded-md border border-[rgba(164,164,164,0.16)] px-3 py-2 text-xs text-[#a4a4a4] transition-colors hover:bg-white/10"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={() => onSaveDraft(draft)}
						className="rounded-md border border-[rgba(56,189,248,0.32)] bg-[rgba(56,189,248,0.14)] px-3 py-2 text-xs font-medium text-[#bdeafe] transition-colors hover:bg-[rgba(56,189,248,0.22)]"
					>
						Guardar
					</button>
				</div>
				<PendingMutationNotice />
			</div>
		);
	}

	if (selectedFeature.kind === "draftRoute") {
		const draft = selectedFeature.route;
		return (
			<div className="space-y-3">
				<PropertyRow label="Entidad" value="Ruta provisional" />
				<DraftTextField
					label="Código"
					value={draft.code ?? ""}
					onChange={(code) => onDraftRouteChange({ code: code || null })}
				/>
				<DraftSelectField
					label="Tipo"
					value={draft.type}
					options={[
						["feeder", "Feeder"],
						["distribution", "Distribución"],
						["other", "Otra"],
					]}
					onChange={(type) =>
						onDraftRouteChange({ type: type as DraftRoute["type"] })
					}
				/>
				<DraftSelectField
					label="Calidad"
					value={draft.route_quality}
					options={[
						["unknown", "Desconocida"],
						["approximate", "Aproximada"],
						["drawn", "Dibujada"],
						["gps_captured", "GPS"],
						["verified", "Verificada"],
					]}
					onChange={(route_quality) =>
						onDraftRouteChange({
							route_quality: route_quality as DraftRoute["route_quality"],
						})
					}
				/>
				<PropertyRow
					label="Longitud"
					value={
						draft.length_meters != null
							? `${draft.length_meters.toFixed(0)} m`
							: "Pendiente"
					}
				/>
				<DraftSelectField
					label="Fibra"
					value={draft.fiber_type ?? "g652d"}
					options={[
						["g652d", "G.652D"],
						["g657a1", "G.657A1"],
						["g657a2", "G.657A2"],
					]}
					onChange={(fiber_type) =>
						onDraftRouteChange({
							fiber_type: fiber_type as DraftRoute["fiber_type"],
						})
					}
				/>
				<DraftNumberField
					label="Hilos"
					value={draft.fiber_count}
					onChange={(fiber_count) => onDraftRouteChange({ fiber_count })}
				/>
				<div className="grid grid-cols-2 gap-2 pt-2">
					<button
						type="button"
						onClick={onCancelDraft}
						className="rounded-md border border-[rgba(164,164,164,0.16)] px-3 py-2 text-xs text-[#a4a4a4] transition-colors hover:bg-white/10"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={() => onSaveDraftRoute(draft)}
						className="rounded-md border border-[rgba(56,189,248,0.32)] bg-[rgba(56,189,248,0.14)] px-3 py-2 text-xs font-medium text-[#bdeafe] transition-colors hover:bg-[rgba(56,189,248,0.22)]"
					>
						Guardar
					</button>
				</div>
				<PendingMutationNotice />
			</div>
		);
	}

	if (selectedFeature.kind === "route") {
		const route = selectedFeature.route;
		return (
			<div className="space-y-3">
				<PropertyRow label="Entidad" value="Ruta de fibra" />
				<PropertyRow label="Tipo" value={route.type} />
				<PropertyRow label="Estado" value={route.status} />
				<PropertyRow label="Calidad" value={route.route_quality} />
				<PropertyRow
					label="Longitud"
					value={
						route.length_meters != null
							? `${route.length_meters.toFixed(0)} m`
							: "Pendiente"
					}
				/>
				<PropertyRow label="Fibra" value={route.fiber_type ?? "Pendiente"} />
				<PropertyRow
					label="Pérdida total"
					value={
						route.total_loss_db != null
							? `${route.total_loss_db.toFixed(2)} dB`
							: "Pendiente"
					}
				/>
				<PendingMutationNotice />
				{isDeleting && (
					<DeleteConfirm onConfirm={() => onDelete(selectedFeature)} />
				)}
			</div>
		);
	}

	if (selectedFeature.kind === "routePoint") {
		const point = selectedFeature.point;
		return (
			<div className="space-y-3">
				<PropertyRow label="Entidad" value="Punto de ruta" />
				<PropertyRow label="Tipo" value={point.type} />
				<PropertyRow label="Estado" value={point.status ?? "Pendiente"} />
				<PropertyRow label="Calidad" value={point.location_quality} />
				<PropertyRow
					label="Posición"
					value={
						point.position_on_route_m != null
							? `${point.position_on_route_m.toFixed(0)} m`
							: "Pendiente"
					}
				/>
				{point.type === "reserve" && (
					<PropertyRow
						label="Reserva"
						value={
							point.reserve_length_m != null
								? `${point.reserve_length_m.toFixed(0)} m`
								: "Pendiente"
						}
					/>
				)}
				{point.type === "splice" && (
					<PropertyRow
						label="Pérdida"
						value={
							point.splice_loss_db != null
								? `${point.splice_loss_db.toFixed(2)} dB`
								: "Pendiente"
						}
					/>
				)}
				{point.type === "crossing" && (
					<>
						<PropertyRow
							label="Cruce"
							value={point.crossing_type ?? "Pendiente"}
						/>
						<PropertyRow
							label="Riesgo"
							value={point.risk_level ?? "Pendiente"}
						/>
					</>
				)}
				<PropertyRow
					label="Ubicación"
					value={`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
				/>
				<PendingMutationNotice />
				{isDeleting && (
					<DeleteConfirm onConfirm={() => onDelete(selectedFeature)} />
				)}
			</div>
		);
	}

	if (selectedFeature.kind === "draftRoutePoint") {
		const draft = selectedFeature.point;
		const TYPE_LABELS: Record<string, string> = {
			crossing: "Cruce",
			reserve: "Reserva",
			splice: "Empalme",
		};
		return (
			<div className="space-y-3">
				<PropertyRow
					label="Entidad"
					value={`${TYPE_LABELS[draft.type] ?? draft.type} provisional`}
				/>
				<DraftTextField
					label="Código"
					value={draft.code ?? ""}
					onChange={(code) => onDraftRoutePointChange({ code: code || null })}
				/>
				<DraftSelectField
					label="Calidad"
					value={draft.location_quality}
					options={[
						["unknown", "Desconocida"],
						["approximate", "Aproximada"],
						["gps_captured", "GPS"],
						["verified", "Verificada"],
					]}
					onChange={(location_quality) =>
						onDraftRoutePointChange({
							location_quality:
								location_quality as DraftRoutePoint["location_quality"],
						})
					}
				/>
				{draft.type === "crossing" && (
					<>
						<DraftSelectField
							label="Tipo cruce"
							value={draft.crossing_type ?? "underground"}
							options={[
								["underground", "Subterráneo"],
								["aerial", "Aéreo"],
								["wall", "Pared"],
								["bridge", "Puente"],
								["other", "Otro"],
							]}
							onChange={(crossing_type) =>
								onDraftRoutePointChange({
									crossing_type:
										crossing_type as DraftRoutePoint["crossing_type"],
								})
							}
						/>
						<DraftSelectField
							label="Riesgo"
							value={draft.risk_level ?? "low"}
							options={[
								["low", "Bajo"],
								["medium", "Medio"],
								["high", "Alto"],
								["critical", "Crítico"],
							]}
							onChange={(risk_level) =>
								onDraftRoutePointChange({
									risk_level: risk_level as DraftRoutePoint["risk_level"],
								})
							}
						/>
					</>
				)}
				{draft.type === "reserve" && (
					<DraftNumberField
						label="Reserva (m)"
						value={draft.reserve_length_m}
						onChange={(reserve_length_m) =>
							onDraftRoutePointChange({ reserve_length_m })
						}
					/>
				)}
				{draft.type === "splice" && (
					<DraftNumberField
						label="Pérdida (dB)"
						value={draft.splice_loss_db}
						step="0.01"
						onChange={(splice_loss_db) =>
							onDraftRoutePointChange({ splice_loss_db })
						}
					/>
				)}
				<PropertyRow
					label="Ubicación"
					value={`${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`}
				/>
				<div className="grid grid-cols-2 gap-2 pt-2">
					<button
						type="button"
						onClick={onCancelDraft}
						className="rounded-md border border-[rgba(164,164,164,0.16)] px-3 py-2 text-xs text-[#a4a4a4] transition-colors hover:bg-white/10"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={() => onSaveRoutePointDraft(draft)}
						className="rounded-md border border-[rgba(56,189,248,0.32)] bg-[rgba(56,189,248,0.14)] px-3 py-2 text-xs font-medium text-[#bdeafe] transition-colors hover:bg-[rgba(56,189,248,0.22)]"
					>
						Guardar
					</button>
				</div>
				<PendingMutationNotice />
			</div>
		);
	}

	const element = selectedFeature.element;
	return (
		<div className="space-y-3">
			<PropertyRow label="Entidad" value="Elemento" />
			<PropertyRow label="Tipo" value={element.type.toUpperCase()} />
			<PropertyRow label="Estado" value={element.status} />
			<PropertyRow label="Calidad" value={element.location_quality} />
			{element.type === "olt" && (
				<PropertyRow
					label="Puertos PON"
					value={element.total_pon_ports?.toString() ?? "Pendiente"}
				/>
			)}
			{element.type === "splitter" && (
				<PropertyRow label="Ratio" value={element.split_ratio ?? "Pendiente"} />
			)}
			{element.type === "nap" && (
				<PropertyRow
					label="Puertos"
					value={element.total_ports?.toString() ?? "Pendiente"}
				/>
			)}
			<PropertyRow
				label="Ubicación"
				value={`${element.lat.toFixed(5)}, ${element.lng.toFixed(5)}`}
			/>
			{incident && (
				<div className="rounded-md border border-[rgba(251,77,109,0.22)] bg-[rgba(251,77,109,0.09)] px-3 py-2">
					<p className="text-[10px] font-semibold uppercase tracking-widest text-[#fb7185]">
						Incidente activo
					</p>
					<p className="mt-1 text-xs text-[#f0b2bf]">{incident.title}</p>
				</div>
			)}
			<PendingMutationNotice />
			{isDeleting && (
				<DeleteConfirm onConfirm={() => onDelete(selectedFeature)} />
			)}
		</div>
	);
}

function DeleteConfirm({ onConfirm }: { onConfirm: () => void }) {
	return (
		<div className="rounded-md border border-[rgba(251,77,109,0.28)] bg-[rgba(251,77,109,0.09)] px-3 py-2.5">
			<p className="text-xs font-semibold text-[#fb7185]">
				Herramienta eliminar activa
			</p>
			<p className="mt-1 text-[11px] text-[#f0b2bf]">
				Esta acción no se puede deshacer. Solo admin puede eliminar.
			</p>
			<button
				type="button"
				onClick={onConfirm}
				className="mt-2 w-full rounded-md border border-[rgba(251,77,109,0.45)] bg-[rgba(251,77,109,0.2)] px-3 py-1.5 text-xs font-medium text-[#fb7185] transition-colors hover:bg-[rgba(251,77,109,0.3)]"
			>
				Confirmar eliminación
			</button>
		</div>
	);
}

function PendingMutationNotice() {
	return (
		<div className="rounded-md border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-xs text-[#f6c768]">
			Los campos editables se conectarán a las mutaciones del modelo MVP.
		</div>
	);
}

function DraftTextField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1 block text-xs text-[#777879]">{label}</span>
			<input
				type="text"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(27,28,29,0.82)] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors placeholder:text-[#5c5d5f] focus:border-[rgba(56,189,248,0.45)]"
			/>
		</label>
	);
}

function DraftNumberField({
	label,
	value,
	step = "1",
	onChange,
}: {
	label: string;
	value: number | null;
	step?: string;
	onChange: (value: number | null) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1 block text-xs text-[#777879]">{label}</span>
			<input
				type="number"
				step={step}
				value={value ?? ""}
				onChange={(event) =>
					onChange(
						event.target.value === "" ? null : Number(event.target.value),
					)
				}
				className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(27,28,29,0.82)] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[rgba(56,189,248,0.45)]"
			/>
		</label>
	);
}

function DraftSelectField({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: Array<[value: string, label: string]>;
	onChange: (value: string) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1 block text-xs text-[#777879]">{label}</span>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[rgba(27,28,29,0.82)] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[rgba(56,189,248,0.45)]"
			>
				{options.map(([optionValue, optionLabel]) => (
					<option key={optionValue} value={optionValue}>
						{optionLabel}
					</option>
				))}
			</select>
		</label>
	);
}

function PropertyRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-[rgba(164,164,164,0.08)] pb-2">
			<span className="text-xs text-[#777879]">{label}</span>
			<span className="min-w-0 truncate text-right font-mono text-xs text-[#d7d7d7]">
				{value}
			</span>
		</div>
	);
}

function MapControls({
	mode,
	hasRightPanel,
	onZoomIn,
	onZoomOut,
	onResetNorth,
	onFit,
}: {
	mode: EditorMode;
	hasRightPanel: boolean;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onResetNorth: () => void;
	onFit: () => void;
}) {
	return (
		<div
			className={`absolute z-20 flex flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md ${mode === "edit" ? "bottom-28" : "bottom-16"} ${hasRightPanel ? "right-86" : "right-4"}`}
		>
			<MapControlButton label="Acercar" onClick={onZoomIn}>
				+
			</MapControlButton>
			<MapControlButton label="Alejar" onClick={onZoomOut}>
				-
			</MapControlButton>
			<MapControlButton label="Centrar red" onClick={onFit}>
				□
			</MapControlButton>
			<MapControlButton label="Reset norte" onClick={onResetNorth}>
				N
			</MapControlButton>
		</div>
	);
}

function MapControlButton({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			className="flex h-9 w-9 items-center justify-center border-b border-[rgba(164,164,164,0.12)] font-mono text-xs font-semibold text-[#d7d7d7] transition-colors last:border-b-0 hover:bg-white/10"
		>
			{children}
		</button>
	);
}

function EditorStatusBar({
	activeToolLabel,
	statusMessage,
	zoom,
}: {
	activeToolLabel: string;
	statusMessage: string;
	zoom: number;
}) {
	return (
		<div className="absolute bottom-3 left-4 right-4 z-20 flex min-h-10 items-center justify-between gap-4 rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] px-3 py-2 text-xs text-[#a4a4a4] shadow-2xl backdrop-blur-md">
			<div className="flex min-w-0 items-center gap-2">
				<span className="shrink-0 rounded-md border border-[rgba(56,189,248,0.24)] bg-[rgba(56,189,248,0.1)] px-2 py-1 font-medium text-[#bdeafe]">
					{activeToolLabel}
				</span>
				<span className="truncate">{statusMessage}</span>
			</div>
			<div className="hidden shrink-0 items-center gap-3 font-mono text-[11px] text-[#777879] sm:flex">
				<span>zoom {zoom.toFixed(1)}</span>
				<span>Esc selecciona</span>
			</div>
		</div>
	);
}

const LEGEND_TYPES: Array<[string, string]> = [
	[TYPE_COLOR.olt, "OLT"],
	[TYPE_COLOR.splitter, "Splitter"],
	[TYPE_COLOR.nap, "NAP"],
	[TYPE_COLOR.ont, "ONT"],
];

const LEGEND_STATUS: Array<[string, string]> = [
	[STATUS_COLOR.online, "En línea"],
	[STATUS_COLOR.alarm, "Alarma"],
	[STATUS_COLOR.offline, "Fuera de línea"],
	[STATUS_COLOR.maintenance, "Mantenimiento"],
];

const LEGEND_CABLES: Array<[string, string, boolean]> = [
	[CABLE_COLOR.feeder, "Feeder", false],
	[CABLE_COLOR.distribution, "Distribución", false],
	[CABLE_COLOR.drop, "Drop", true], // dashed
];

function Legend() {
	return (
		<div className="absolute bottom-16 right-4 z-20 select-none rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.9)] p-3 text-xs text-[#d7d7d7] backdrop-blur-md">
			<p className="mb-2 font-semibold uppercase tracking-widest text-[#777879]">
				Equipos
			</p>
			{LEGEND_TYPES.map(([color, label]) => (
				<div key={label} className="mb-1.5 flex items-center gap-2">
					<span
						className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: color }}
					/>
					<span>{label}</span>
				</div>
			))}
			<p className="mb-2 mt-3 font-semibold uppercase tracking-widest text-[#777879]">
				Estado
			</p>
			{LEGEND_STATUS.map(([color, label]) => (
				<div key={label} className="mb-1.5 flex items-center gap-2">
					<span
						className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: color }}
					/>
					<span>{label}</span>
				</div>
			))}
			<p className="mb-2 mt-3 font-semibold uppercase tracking-widest text-[#777879]">
				Fibra
			</p>
			{LEGEND_CABLES.map(([color, label, dashed]) => (
				<div key={label} className="mb-1.5 flex items-center gap-2">
					<span
						className="inline-block h-0 w-5 shrink-0"
						style={{
							borderTop: dashed
								? `1.5px dashed ${color}`
								: `1.5px solid ${color}`,
						}}
					/>
					<span>{label}</span>
				</div>
			))}
		</div>
	);
}
