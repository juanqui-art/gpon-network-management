"use client";

import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useQueryClient } from "@tanstack/react-query";
import turfDistance from "@turf/distance";
import turfLength from "@turf/length";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Layers,
	MapPin,
	Network,
	Route,
	Save,
	Search,
	Siren,
	Trash2,
	X,
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { OltModelSelector } from "@/components/map/olt-model-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Toast,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@/components/ui/toast";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DEFAULT_NAP_PROPERTIES,
	getNapMode,
	hasInternalSplitter,
	NAP_MODE_LABEL,
	type NapMode,
	napPropertyLabel,
} from "@/lib/gpon/nap-config";
import {
	formatMapLabel,
	generateDraftCode,
	nextSequence,
	operativeCodeMatches,
} from "@/lib/gpon/operative-code";
import { SPLITTER_LOSS_DB } from "@/lib/gpon/optical-budget";
import {
	EQUIPMENT_MARKER_SIZE,
	EQUIPMENT_STATUS_MARK,
	equipmentSymbolSvg,
} from "@/lib/gpon/symbology";
import {
	CABLE_COLOR,
	DATA_QUALITY_COLOR,
	SEVERITY_COLOR,
	STATUS_COLOR,
	TYPE_COLOR,
} from "@/lib/map/palette";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE } from "@/lib/mapbox/config";
import {
	createFiberRoute,
	createInfrastructureElement,
	createRoutePoint,
	deleteMapFeature,
	networkEditorKeys,
	updateFiberRoute,
	updateInfrastructureElement,
} from "@/lib/queries/network-editor";
import type {
	ActiveDraft,
	EditorTool,
	Selection,
	ValidationError,
} from "@/lib/store/network-editor";
import type {
	ElementStatus,
	ElementType,
	NetworkZone,
	UserRole,
} from "@/lib/types/gpon";
import {
	canDeleteInfrastructure,
	canWriteInfrastructure,
} from "@/lib/types/gpon";
import { NapCapacity } from "./nap-capacity";
import { OpticalBudgetPanel } from "./optical-budget-panel";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	FiberRoute,
	IncidentMapItem,
	InfrastructureElement,
	LngLat,
	RoutePoint,
} from "./types";

interface Props {
	token: string;
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	routePoints?: RoutePoint[];
	incidents: IncidentMapItem[];
	zones?: NetworkZone[]; // Available zones for the network
	validationErrors?: ValidationError[];
	userRole?: UserRole | null;
	editorMode?: EditorMode;
	onEditorModeChange?: (mode: EditorMode) => void;
	editorTool?: EditorTool;
	onEditorToolChange?: (tool: EditorTool) => void;
	editorSelection?: Selection | null;
	onEditorSelectionChange?: (selection: Selection | null) => void;
	onEditorDraftChange?: (draft: ActiveDraft | null) => void;
	editorStatusMessage?: string;
	onEditorStatusMessageChange?: (message: string) => void;
	// v2 network editor integration
	networkId?: string | null;
	externalTool?: EditorTool;
	onElementSaved?: (element: InfrastructureElement) => void;
	onRouteSaved?: (route: FiberRoute) => void;
	onElementDeleted?: (id: string) => void;
	onRouteDeleted?: (id: string) => void;
	onSaveDraftElement?: (draft: DraftElement) => void;
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

const ROUTE_POINT_COLOR: Record<string, string> = {
	crossing: "#d7d7d7",
	reserve: "#f6c768",
	splice: "#fb7185",
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
	updateMarkerLabel(outerEl, zoom);
}

function updateMarkerLabel(outerEl: HTMLElement, zoom: number) {
	const label = outerEl.querySelector(
		'[data-role="marker-label"]',
	) as HTMLElement | null;
	if (!label) return;

	const code = outerEl.dataset.code ?? "";
	const type = outerEl.dataset.type ?? "";
	const shouldShow =
		(type === "olt" && zoom >= 10) ||
		(type === "splitter" && zoom >= 12) ||
		(type === "nap" && zoom >= 14);

	label.textContent = formatMapLabel(code, zoom);
	label.style.opacity = shouldShow ? "1" : "0";
	label.style.transform = shouldShow
		? "translate(-50%, 0)"
		: "translate(-50%, -2px)";
}

function createMarkerEl(
	eq: EquipmentMapItem,
	incident: IncidentMapItem | null,
): HTMLElement {
	const typeColor = TYPE_COLOR[eq.type] ?? TYPE_COLOR.unknown;
	const statusColor = STATUS_COLOR[eq.status] ?? STATUS_COLOR.unknown;
	const size = EQUIPMENT_MARKER_SIZE[eq.type] ?? 22;
	const ringSize = size + 8;
	const showStatusBadge = eq.status !== "online";

	// ── DOM hierarchy ─────────────────────────────────────────────────────────
	// outer  → owned by Mapbox: it injects transform:translate() for positioning.
	//          NEVER set transform on outer — it would erase Mapbox's translation
	//          and snap the marker to the viewport origin (top-left corner).
	// wrapper → owned by us: receives scale() on hover without touching outer.
	// inner   → SVG icon + drop-shadow + pulse.

	const outer = document.createElement("div");
	outer.dataset.code = eq.code;
	outer.dataset.type = eq.type;
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

	// Quality ring — shows data trustworthiness (outer, dotted)
	const qualityColor =
		DATA_QUALITY_COLOR[eq.location_quality] ?? DATA_QUALITY_COLOR.unknown;
	const qualityRingSize = ringSize + 6;
	const qualityRing = document.createElement("div");
	qualityRing.dataset.role = "quality-ring";
	qualityRing.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    width: ${qualityRingSize}px;
    height: ${qualityRingSize}px;
    border-radius: 999px;
    border: 1.5px dashed ${qualityColor};
    opacity: 0.65;
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;
	wrapper.appendChild(qualityRing);

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
		statusBadge.textContent =
			EQUIPMENT_STATUS_MARK[eq.status] ?? EQUIPMENT_STATUS_MARK.unknown;
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
	inner.innerHTML = equipmentSymbolSvg(eq.type, typeColor, {
		hasInternalSplitter: hasInternalSplitter(eq),
	});

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

	const label = document.createElement("div");
	label.dataset.role = "marker-label";
	label.textContent = formatMapLabel(eq.code, 14);
	label.style.cssText = `
    position: absolute;
    left: 50%;
    top: calc(100% + 8px);
    max-width: 150px;
    transform: translate(-50%, -2px);
    border: 1px solid rgba(164,164,164,0.18);
    border-radius: 5px;
    background: rgba(27,28,29,0.88);
    padding: 2px 5px;
    color: #e6e6e6;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease, transform 0.15s ease;
    box-shadow: 0 6px 16px rgba(0,0,0,0.28);
  `;
	outer.appendChild(label);
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

type EditorMode = "view" | "design" | "edit";
type LeftPanelTab = "tree" | "layers" | "quality";
type SelectedFeature =
	| { kind: "element"; element: EquipmentMapItem }
	| { kind: "route"; route: ConnectionMapItem }
	| { kind: "routePoint"; point: RoutePoint };
type DraftElement = EquipmentMapItem & { isDraft: true; selectedZone?: string };
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
		| "optical_class"
		| "total_pon_ports"
		| "split_ratio"
		| "insertion_loss_db"
		| "total_ports"
		| "address_reference"
		| "properties"
		| "selectedZone"
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

// ── MapboxDraw dark-theme styles ─────────────────────────────────────────────
const DRAW_STYLES: object[] = [
	{
		id: "draw-line-active",
		type: "line",
		filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			"line-color": "#38bdf8",
			"line-width": 2.5,
			"line-dasharray": [2, 1.5],
		},
	},
	{
		id: "draw-vertex-halo",
		type: "circle",
		filter: [
			"all",
			["==", "meta", "vertex"],
			["==", "$type", "Point"],
			["!=", "mode", "static"],
		],
		paint: { "circle-radius": 7, "circle-color": "#1b1c1d" },
	},
	{
		id: "draw-vertex",
		type: "circle",
		filter: [
			"all",
			["==", "meta", "vertex"],
			["==", "$type", "Point"],
			["!=", "mode", "static"],
		],
		paint: { "circle-radius": 4.5, "circle-color": "#38bdf8" },
	},
	{
		id: "draw-midpoint",
		type: "circle",
		filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
		paint: { "circle-radius": 3.5, "circle-color": "#a78bfa" },
	},
];

// Returns the nearest element within thresholdM meters, or null.
function nearestElementTo(
	point: LngLat,
	elements: EquipmentMapItem[],
	thresholdM = 40,
): EquipmentMapItem | null {
	let best: EquipmentMapItem | null = null;
	let bestDist = thresholdM;
	for (const eq of elements) {
		const d = distanceMeters(point, [eq.lng, eq.lat]);
		if (d < bestDist) {
			best = eq;
			bestDist = d;
		}
	}
	return best;
}

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
	zone?: string,
): DraftElement {
	const codeZone = zone ?? "Z05";
	const code = generateDraftCode(type, index, codeZone);

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
		optical_class: null,
		split_ratio: type === "splitter" ? "1:8" : type === "nap" ? "1:16" : null,
		insertion_loss_db:
			type === "splitter"
				? SPLITTER_LOSS_DB["1:8"]
				: type === "nap"
					? SPLITTER_LOSS_DB["1:16"]
					: null,
		total_ports: type === "nap" ? 16 : null,
		ports_used: null,
		ports_reserved: null,
		properties: type === "nap" ? { ...DEFAULT_NAP_PROPERTIES } : {},
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
		selectedZone: codeZone, // Track selected zone for regenerating codes
	} as DraftElement & { selectedZone: string };
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
	if (coordinates.length < 2) return 0;
	const line: GeoJSON.Feature<GeoJSON.LineString> = {
		type: "Feature",
		geometry: { type: "LineString", coordinates },
		properties: {},
	};
	// turfLength returns km by default; convert to meters
	return turfLength(line, { units: "kilometers" }) * 1000;
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
	const routeType = fromElement.type === "olt" ? "feeder" : "distribution";
	const code = generateDraftCode(routeType, index);
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

function nextElementSequence(
	equipment: EquipmentMapItem[],
	type: "olt" | "splitter" | "nap",
	offset: number,
	zone?: string,
) {
	const codes = equipment
		.filter((element) => {
			if (element.type !== type) return false;
			// If zone is specified, only count elements in that zone
			if (zone && !element.code?.includes(zone)) return false;
			return true;
		})
		.map((element) => element.code);
	return nextSequence(codes) + offset - 1;
}

function nextRouteSequence(
	connections: ConnectionMapItem[],
	type: "feeder" | "distribution",
	offset: number,
) {
	const codes = connections
		.filter((connection) => connection.type === type)
		.map((connection) => connection.code)
		.filter((code): code is string => Boolean(code));
	return nextSequence(codes) + offset - 1;
}

// ── Component ────────────────────────────────────────────────────────────────

export function MapView({
	token,
	equipment,
	connections,
	routePoints = [],
	incidents,
	zones = [],
	validationErrors = [],
	userRole = null,
	editorMode,
	onEditorModeChange,
	editorTool,
	onEditorToolChange,
	onEditorSelectionChange,
	onEditorDraftChange,
	editorStatusMessage,
	onEditorStatusMessageChange,
	networkId = null,
	onSaveDraftElement,
}: Props) {
	const canEdit = canWriteInfrastructure(userRole);
	const canDelete = canDeleteInfrastructure(userRole);
	const router = useRouter();
	const queryClient = useQueryClient();
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
	const modeRef = useRef<EditorMode>("view");
	const drawRef = useRef<MapboxDraw | null>(null);
	const draftRouteCountRef = useRef(1);
	const lastToastMessageRef = useRef("");
	// Stable ref so dragend listeners always call the latest save fn
	const saveExistingElementRef = useRef<
		(el: EquipmentMapItem, patch: Partial<EquipmentMapItem>) => void
	>(() => {});
	const [selectedFeature, setSelectedFeature] =
		useState<AnySelectedFeature | null>(null);
	const [draftCount, setDraftCount] = useState(1);
	const [draftRouteCount, setDraftRouteCount] = useState(1);
	const [filterType, setFilterType] = useState("all");
	const [filterStatus, setFilterStatus] = useState("all");
	const [zoom, setZoom] = useState(DEFAULT_ZOOM); // matches map constructor zoom
	const [internalActiveTool, setInternalActiveTool] =
		useState<EditorTool>("select");
	const [internalMode, setInternalMode] = useState<EditorMode>("view");
	const [leftTab, setLeftTab] = useState<LeftPanelTab>("tree");
	const [commandOpen, setCommandOpen] = useState(false);
	const [toastOpen, setToastOpen] = useState(false);
	const [toastMessage, setToastMessage] = useState(
		"Modo infraestructura listo.",
	);
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		feature: SelectedFeature;
	} | null>(null);
	const [internalStatusMessage, setInternalStatusMessage] = useState(
		"Modo infraestructura listo.",
	);
	const [measureFirstPoint, setMeasureFirstPoint] = useState<{
		lng: number;
		lat: number;
	} | null>(null);

	const incidentByEquipment = Object.fromEntries(
		incidents.map((i) => [i.equipment_id, i]),
	);
	const mode = editorMode ?? internalMode;
	const activeTool = editorTool ?? internalActiveTool;
	const setMode = useCallback(
		(nextMode: EditorMode) => {
			setInternalMode(nextMode);
			onEditorModeChange?.(nextMode);
		},
		[onEditorModeChange],
	);
	const setActiveTool = useCallback(
		(nextTool: EditorTool) => {
			setInternalActiveTool(nextTool);
			onEditorToolChange?.(nextTool);
			// Reset measure state when switching tools
			if (nextTool !== "measure") {
				setMeasureFirstPoint(null);
			}
		},
		[onEditorToolChange],
	);
	const setSelected = useCallback(
		(nextFeature: AnySelectedFeature | null) => {
			setSelectedFeature(nextFeature);
			if (
				nextFeature?.kind === "element" ||
				nextFeature?.kind === "route" ||
				nextFeature?.kind === "routePoint"
			) {
				onEditorSelectionChange?.({
					id:
						nextFeature.kind === "element"
							? nextFeature.element.id
							: nextFeature.kind === "route"
								? nextFeature.route.id
								: nextFeature.point.id,
					kind: nextFeature.kind,
				});
				onEditorDraftChange?.(null);
				return;
			}
			if (nextFeature?.kind === "draftElement") {
				onEditorSelectionChange?.(null);
				onEditorDraftChange?.({
					kind: "element",
					id: nextFeature.element.id,
					elementType: nextFeature.element.type,
					code: nextFeature.element.code,
				});
				return;
			}
			if (nextFeature?.kind === "draftRoute") {
				onEditorSelectionChange?.(null);
				onEditorDraftChange?.({
					kind: "route",
					id: nextFeature.route.id,
					routeType: nextFeature.route.type,
					code: nextFeature.route.code,
				});
				return;
			}
			if (nextFeature?.kind === "draftRoutePoint") {
				onEditorSelectionChange?.(null);
				onEditorDraftChange?.({
					kind: "routePoint",
					id: nextFeature.point.id,
					pointType: nextFeature.point.type,
					code: nextFeature.point.code,
				});
				return;
			}
			onEditorSelectionChange?.(null);
			onEditorDraftChange?.(null);
		},
		[onEditorDraftChange, onEditorSelectionChange],
	);
	const statusMessage = editorStatusMessage ?? internalStatusMessage;
	const setStatusMessage = useCallback(
		(nextMessage: string) => {
			setInternalStatusMessage(nextMessage);
			onEditorStatusMessageChange?.(nextMessage);
		},
		[onEditorStatusMessageChange],
	);
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setCommandOpen((open) => !open);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
	useEffect(() => {
		if (!statusMessage || lastToastMessageRef.current === statusMessage) return;
		lastToastMessageRef.current = statusMessage;
		if (
			statusMessage.includes("listo") ||
			statusMessage.includes("guardad") ||
			statusMessage.includes("actualizad") ||
			statusMessage.includes("eliminad") ||
			statusMessage.includes("Error") ||
			statusMessage.includes("No se pudo")
		) {
			setToastMessage(statusMessage);
			setToastOpen(false);
			window.setTimeout(() => setToastOpen(true), 0);
		}
	}, [statusMessage]);
	const refreshEditorData = useCallback(() => {
		if (networkId) {
			void queryClient.invalidateQueries({
				queryKey: networkEditorKeys.detail(networkId),
			});
			return;
		}
		router.refresh();
	}, [networkId, queryClient, router]);
	const routePointCount = routePoints.length;
	const activeToolLabel =
		EDITOR_TOOLS.find((tool) => tool.value === activeTool)?.label ??
		"Seleccionar";
	const isEditing = mode === "edit"; // modifying / deleting existing elements
	const isActive = mode !== "view"; // any non-read-only mode

	// Real-time non-blocking warnings derived from current map data
	const mapWarnings = (() => {
		const warnings: string[] = [];
		for (const eq of equipment) {
			if (eq.type === "splitter" && !eq.split_ratio) {
				warnings.push(`${eq.code}: sin ratio de división`);
			}
			if (
				eq.type === "nap" &&
				getNapMode(eq) === "with_splitter" &&
				!eq.split_ratio
			) {
				warnings.push(`${eq.code}: NAP con PLC sin ratio`);
			}
			if (eq.type === "nap" && eq.total_ports) {
				const used = eq.ports_used ?? 0;
				if (used >= eq.total_ports) warnings.push(`${eq.code}: NAP saturada`);
				else if (used / eq.total_ports >= 0.8)
					warnings.push(`${eq.code}: NAP casi llena`);
			}
		}
		for (const conn of connections) {
			if (!conn.from_element_id || !conn.to_element_id) {
				warnings.push(`${conn.code ?? "Ruta"}: sin origen o destino`);
			}
		}
		return warnings;
	})();
	const focusEquipment = useCallback(
		(eq: EquipmentMapItem) => {
			setSelected({ kind: "element", element: eq });
			setLeftTab("tree");
			mapRef.current?.flyTo({
				center: [eq.lng, eq.lat],
				zoom: Math.max(mapRef.current.getZoom(), 16),
				duration: 650,
			});
			setStatusMessage(`Elemento seleccionado: ${eq.name ?? eq.code}.`);
		},
		[setSelected, setStatusMessage],
	);
	const clearDraft = useCallback(() => {
		draftMarkerRef.current?.remove();
		draftMarkerRef.current = null;
		fiberDrawingRef.current = null;
		const drawingSource = mapRef.current?.getSource(
			"fiber-draft",
		) as mapboxgl.GeoJSONSource | null;
		drawingSource?.setData(buildDrawingGeoJSON([]));
		setSelectedFeature((current) => {
			if (current?.kind === "draftElement" || current?.kind === "draftRoute") {
				return null;
			}
			return current;
		});
		// Notify parent AFTER state update (avoid setState-during-render)
		onEditorSelectionChange?.(null);
		onEditorDraftChange?.(null);
	}, [onEditorDraftChange, onEditorSelectionChange]);
	const createElementDraftAt = useCallback(
		(type: "olt" | "splitter" | "nap", lngLat: mapboxgl.LngLat) => {
			const map = mapRef.current;
			if (!map) return;
			const defaultZone = zones.length > 0 ? zones[0]?.zone_code : "Z05";
			const draftSequence = nextElementSequence(
				equipmentRef.current,
				type,
				draftCount,
				defaultZone,
			);
			const draft = createDraftElement(
				type,
				lngLat,
				draftSequence,
				defaultZone,
			);
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
			setSelected({ kind: "draftElement", element: draft });
			setStatusMessage(`${draft.code} provisional. Completa datos y guarda.`);
		},
		[draftCount, setSelected, setStatusMessage, zones],
	);
	const saveDraftElement = useCallback(
		(draft: DraftElement) => {
			if (onSaveDraftElement) {
				// Usa callback para agregar al store (sin RPC inmediato)
				onSaveDraftElement(draft);
			} else {
				// Fallback: RPC directo (compatible con implementaciones que no usan callback)
				(async () => {
					setStatusMessage(`Guardando ${draft.code}...`);
					try {
						await createInfrastructureElement({
							type: draft.type as ElementType,
							code: draft.code,
							name: draft.name,
							lng: draft.lng,
							lat: draft.lat,
							status: draft.status as ElementStatus,
							location_quality: draft.location_quality,
							pon_standard: draft.pon_standard,
							total_pon_ports: draft.total_pon_ports,
							optical_class: draft.optical_class,
							split_ratio: draft.split_ratio,
							insertion_loss_db: draft.insertion_loss_db,
							total_ports: draft.total_ports,
							properties: draft.properties,
							address_reference: draft.address_reference,
							notes: draft.notes,
						});
					} catch (error) {
						const message =
							error instanceof Error ? error.message : "Error desconocido";
						setStatusMessage(`No se pudo guardar ${draft.code}: ${message}`);
						return;
					}
					refreshEditorData();
				})();
			}

			// Fly to the new element position
			mapRef.current?.flyTo({
				center: [draft.lng, draft.lat],
				zoom: Math.max(mapRef.current.getZoom(), 16),
				duration: 400,
				essential: true,
			});
			clearDraft();
			setActiveTool("select");
			setStatusMessage(
				`${draft.code} agregado — click "Guardar" para persistir.`,
			);
		},
		[
			clearDraft,
			refreshEditorData,
			setActiveTool,
			setStatusMessage,
			onSaveDraftElement,
		],
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
		[updateFiberDraftSource, setStatusMessage],
	);
	const handleFiberElementClick = useCallback(
		(element: EquipmentMapItem) => {
			const drawing = fiberDrawingRef.current;
			if (!drawing) {
				const coordinates: LngLat[] = [[element.lng, element.lat]];
				fiberDrawingRef.current = { fromElement: element, coordinates };
				updateFiberDraftSource(coordinates);
				setSelected({ kind: "element", element });
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
				nextRouteSequence(
					connectionsRef.current,
					drawing.fromElement.type === "olt" ? "feeder" : "distribution",
					draftRouteCount,
				),
			);
			setDraftRouteCount((current) => current + 1);
			updateFiberDraftSource(coordinates);
			fiberDrawingRef.current = null;
			setSelected({ kind: "draftRoute", route: draftRoute });
			setStatusMessage(
				`${draftRoute.code} provisional. Revisa datos y guarda la ruta.`,
			);
		},
		[draftRouteCount, updateFiberDraftSource, setSelected, setStatusMessage],
	);
	const saveDraftRoute = useCallback(
		async (draft: DraftRoute) => {
			setStatusMessage(`Guardando ${draft.code ?? "ruta"}...`);
			try {
				await createFiberRoute(draft);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Error desconocido";
				setStatusMessage(`No se pudo guardar la ruta: ${message}`);
				return;
			}

			// Fly to the midpoint of the route
			const coords = draft.geojson_coordinates;
			const mid = coords[Math.floor(coords.length / 2)];
			if (mid) {
				mapRef.current?.flyTo({
					center: mid,
					zoom: Math.max(mapRef.current?.getZoom() ?? 14, 14),
					duration: 400,
					essential: true,
				});
			}
			clearDraft();
			setActiveTool("select");
			setStatusMessage(
				`${draft.code ?? "Ruta"} guardada — visible en el mapa.`,
			);
			refreshEditorData();
		},
		[clearDraft, refreshEditorData, setActiveTool, setStatusMessage],
	);

	const saveRoutePointDraft = useCallback(
		async (draft: DraftRoutePoint) => {
			setStatusMessage("Guardando punto...");
			try {
				await createRoutePoint(draft);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Error desconocido";
				setStatusMessage(`No se pudo guardar el punto: ${message}`);
				return;
			}
			setSelected(null);
			setActiveTool("select");
			setStatusMessage("Punto guardado.");
			refreshEditorData();
		},
		[refreshEditorData, setActiveTool, setSelected, setStatusMessage],
	);

	const deleteFeature = useCallback(
		async (feature: SelectedFeature) => {
			const deleteInput =
				feature.kind === "element"
					? ({ kind: "element", id: feature.element.id } as const)
					: feature.kind === "route"
						? ({ kind: "route", id: feature.route.id } as const)
						: ({ kind: "routePoint", id: feature.point.id } as const);

			setStatusMessage(
				feature.kind === "element"
					? `Eliminando ${feature.element.code}...`
					: "Eliminando elemento...",
			);

			try {
				await deleteMapFeature(deleteInput);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Error desconocido";
				setStatusMessage(`No se pudo eliminar: ${message}`);
				return;
			}
			setSelected(null);
			setActiveTool("select");
			setStatusMessage("Elemento eliminado.");
			refreshEditorData();
		},
		[refreshEditorData, setActiveTool, setSelected, setStatusMessage],
	);

	const saveExistingElement = useCallback(
		async (element: EquipmentMapItem, patch: Partial<EquipmentMapItem>) => {
			setStatusMessage(`Guardando ${element.code}…`);

			try {
				// Asegura que lng/lat se incluyen en el patch si se pasaron
				const fullPatch = {
					...patch,
					lng: patch.lng ?? element.lng,
					lat: patch.lat ?? element.lat,
				};
				await updateInfrastructureElement({ element, patch: fullPatch });
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Error desconocido";
				setStatusMessage(`Error al guardar: ${message}`);
				return;
			}
			setStatusMessage(`${element.code} actualizado.`);
			setActiveTool("select");
			refreshEditorData();
		},
		[refreshEditorData, setActiveTool, setStatusMessage],
	);

	const saveExistingRoute = useCallback(
		async (route: ConnectionMapItem, patch: Partial<ConnectionMapItem>) => {
			setStatusMessage("Guardando ruta…");

			try {
				await updateFiberRoute({ route, patch });
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Error desconocido";
				setStatusMessage(`Error al guardar: ${message}`);
				return;
			}
			setStatusMessage("Ruta actualizada.");
			refreshEditorData();
		},
		[refreshEditorData, setStatusMessage],
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
	modeRef.current = mode;
	draftRouteCountRef.current = draftRouteCount;
	saveExistingElementRef.current = saveExistingElement;

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
	}, [activeTool, mode, setStatusMessage]);

	// Enable / disable marker drag when mode changes
	useEffect(() => {
		const draggable = mode === "edit";
		for (const { marker, outerEl } of markersByEqId.current.values()) {
			marker.setDraggable(draggable);
			outerEl.style.cursor = draggable ? "grab" : "pointer";
		}
	}, [mode]);

	// Activate / deactivate mapbox-gl-draw based on active tool
	useEffect(() => {
		const draw = drawRef.current;
		if (!draw) return;
		if (mode === "design" && activeTool === "fiber") {
			draw.changeMode("draw_line_string");
		} else {
			try {
				if (draw.getMode() !== "simple_select")
					draw.changeMode("simple_select");
			} catch {
				// map may not be fully loaded yet
			}
			draw.deleteAll();
		}
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

			// Ctrl/Cmd+Z — undo last action
			if ((event.ctrlKey || event.metaKey) && key === "z") {
				event.preventDefault();
				const draw = drawRef.current;
				if (draw?.getMode() === "draw_line_string") {
					const all = draw.getAll();
					const feat = all.features[0];
					if (feat?.geometry?.type === "LineString") {
						const coords = feat.geometry.coordinates as LngLat[];
						if (coords.length <= 1) {
							draw.deleteAll();
							draw.changeMode("draw_line_string");
							setStatusMessage("Trazo reiniciado. Haz click para empezar.");
						} else {
							draw.set({
								type: "FeatureCollection",
								features: [
									{
										...feat,
										geometry: {
											type: "LineString",
											coordinates: coords.slice(0, -1),
										},
									},
								],
							});
							setStatusMessage(
								`Vértice eliminado — ${coords.length - 1} puntos restantes.`,
							);
						}
					}
					return;
				}
				const cur = selectedFeatureRef.current;
				if (
					cur?.kind === "draftElement" ||
					cur?.kind === "draftRoute" ||
					cur?.kind === "draftRoutePoint"
				) {
					clearDraft();
					setStatusMessage("Borrador eliminado.");
					return;
				}
				setStatusMessage("Nada que deshacer.");
				return;
			}

			if (modeRef.current === "view") return;
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
	}, [clearDraft, setActiveTool, setStatusMessage]);

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
						refreshEditorData,
					)
					.on(
						"postgres_changes",
						{ event: "*", schema: "public", table: "fiber_routes" },
						refreshEditorData,
					)
					.on(
						"postgres_changes",
						{ event: "*", schema: "public", table: "route_points" },
						refreshEditorData,
					)
					.subscribe();
				removeChannel = () => supabase.removeChannel(channel);
			})
			.catch(() => {});

		return () => {
			unmounted = true;
			removeChannel?.();
		};
	}, [refreshEditorData]);

	// ── Sync marker DOM when props update (after router.refresh) ──────────────
	useEffect(() => {
		const incidentMap = Object.fromEntries(
			incidents.map((i) => [i.equipment_id, i]),
		);

		for (const eq of equipment) {
			const entry = markersByEqId.current.get(eq.id);
			if (!entry) continue;

			entry.outerEl.dataset.code = eq.code;
			entry.outerEl.dataset.type = eq.type;
			updateMarkerLabel(entry.outerEl, mapRef.current?.getZoom() ?? zoom);

			// Update quality ring
			const qualityRing = entry.outerEl.querySelector(
				'[data-role="quality-ring"]',
			) as HTMLElement | null;
			if (qualityRing) {
				const qualityColor =
					DATA_QUALITY_COLOR[eq.location_quality] ?? DATA_QUALITY_COLOR.unknown;
				qualityRing.style.borderColor = qualityColor;
			}

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
					badge.textContent =
						EQUIPMENT_STATUS_MARK[eq.status] ?? EQUIPMENT_STATUS_MARK.unknown;
					wrapper.appendChild(badge);
				} else if (!showBadge && existingBadge) {
					existingBadge.remove();
				} else if (showBadge && existingBadge) {
					existingBadge.style.background = statusColor;
					existingBadge.textContent =
						EQUIPMENT_STATUS_MARK[eq.status] ?? EQUIPMENT_STATUS_MARK.unknown;
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

		// Add markers for elements that arrived after router.refresh() but aren't on the map yet
		const map = mapRef.current;
		if (!map) return;
		for (const eq of equipment) {
			if (markersByEqId.current.has(eq.id)) continue;
			const el = createMarkerEl(eq, incidentMap[eq.id] ?? null);
			const marker = new mapboxgl.Marker({
				element: el,
				anchor: "center",
				draggable: modeRef.current === "edit",
			})
				.setLngLat([eq.lng, eq.lat])
				.addTo(map);
			setMarkerZoomScale(el, eq.type, map.getZoom());

			marker.on("dragstart", () => {
				// Visual feedback during drag
				el.style.opacity = "0.7";
				el.style.cursor = "grabbing";
			});
			marker.on("dragend", () => {
				el.style.opacity = "1";
				el.style.cursor = "pointer";
				const { lng, lat } = marker.getLngLat();
				saveExistingElementRef.current(eq, { lng, lat });
			});

			el.addEventListener("click", (e) => {
				e.stopPropagation();
				popupRef.current?.remove();
				popupRef.current = null;
				if (activeToolRef.current === "fiber") {
					if (drawRef.current?.getMode() !== "draw_line_string") {
						handleFiberElementClick(eq);
					}
					return;
				}
				setSelected({ kind: "element", element: eq });
			});
			el.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				e.stopPropagation();
				setContextMenu({
					x: e.clientX,
					y: e.clientY,
					feature: { kind: "element", element: eq },
				});
				setSelected({ kind: "element", element: eq });
			});
			el.addEventListener("dblclick", (e) => {
				e.stopPropagation();
				setSelected({ kind: "element", element: eq });
				setMode("edit");
			});
			markersByEqId.current.set(eq.id, {
				marker,
				outerEl: el,
				type: eq.type,
				status: eq.status,
			});
		}
	}, [
		equipment,
		incidents,
		handleFiberElementClick,
		setMode,
		setSelected,
		zoom,
	]);

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
			if (typeOk && statusOk && zoomOk) return prev;
			onEditorSelectionChange?.(null);
			onEditorDraftChange?.(null);
			return null;
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
				mode === "design" ? routePointTools[activeTool] : undefined;
			const showRoutePoints =
				mode === "design"
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
	}, [
		filterType,
		filterStatus,
		zoom,
		mode,
		activeTool,
		onEditorDraftChange,
		onEditorSelectionChange,
	]);

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
					setSelected({ kind: "route", route });
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

				setSelected(null);
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
					setSelected({ kind: "routePoint", point });
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

				setSelected(null);
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
						if (drawRef.current?.getMode() !== "draw_line_string") {
							handleFiberElementClick(eq);
						}
						return;
					}
					if (activeToolRef.current !== "select") {
						setStatusMessage(
							`${TOOL_HELP[activeToolRef.current]} Elemento elegido: ${eq.name}.`,
						);
					}
					setSelected({ kind: "element", element: eq });
				});

				outerEl.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					e.stopPropagation();
					setContextMenu({
						x: e.clientX,
						y: e.clientY,
						feature: { kind: "element", element: eq },
					});
					setSelected({ kind: "element", element: eq });
				});

				outerEl.addEventListener("dblclick", (e) => {
					e.stopPropagation();
					setSelected({ kind: "element", element: eq });
					setMode("edit");
				});
			}

			// Fit the initial view to all equipment so neither cluster is cut off
			if (equipment.length > 0) {
				const bounds = new mapboxgl.LngLatBounds();
				for (const eq of equipment) bounds.extend([eq.lng, eq.lat]);
				map.fitBounds(bounds, { padding: 100, maxZoom: 15, animate: false });
			}

			// Right-click on route → context menu
			map.on("contextmenu", "connections-line", (e) => {
				const props = e.features?.[0]?.properties;
				if (!props) return;
				const route = routesByIdRef.current.get(props.connection_id);
				if (!route) return;
				e.preventDefault?.();
				setContextMenu({
					x: e.originalEvent.clientX,
					y: e.originalEvent.clientY,
					feature: { kind: "route", route },
				});
				setSelected({ kind: "route", route });
			});

			// Click on empty map area → deselect + close cable popup + close context menu
			map.on("click", (event) => {
				setContextMenu(null);
				const tool = activeToolRef.current;
				if (tool === "select" || tool === "pan") {
					setSelected(null);
				} else if (tool === "olt" || tool === "splitter" || tool === "nap") {
					createElementDraftAt(tool, event.lngLat);
				} else if (tool === "fiber") {
					// draw_line_string mode captures its own clicks; skip manual handler
					if (drawRef.current?.getMode() !== "draw_line_string") {
						addFiberVertex(event.lngLat);
					}
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
						setSelected({ kind: "draftRoutePoint", point: draft });
						setStatusMessage(
							`Punto de ${tool} provisional. Completa datos y guarda.`,
						);
					}
				} else if (tool === "measure") {
					const currentPoint = { lng: event.lngLat.lng, lat: event.lngLat.lat };

					if (!measureFirstPoint) {
						setMeasureFirstPoint(currentPoint);
						setStatusMessage(
							"Primer punto marcado. Haz click en el segundo punto.",
						);
					} else {
						const distance = turfDistance(
							[measureFirstPoint.lng, measureFirstPoint.lat],
							[currentPoint.lng, currentPoint.lat],
							{ units: "kilometers" },
						);

						const meters = distance * 1000;
						const displayKm =
							distance > 1
								? `${distance.toFixed(2)} km`
								: `${meters.toFixed(0)} m`;

						setStatusMessage(
							`Distancia: ${displayKm} (${meters.toFixed(0)}m). Click nuevamente para otra medida.`,
						);

						setMeasureFirstPoint(null);
					}
				} else {
					setStatusMessage(TOOL_HELP[tool]);
				}
				popupRef.current?.remove();
				popupRef.current = null;
			});
		});

		// ── MapboxDraw (fiber route editing) ────────────────────────────────
		const draw = new MapboxDraw({
			displayControlsDefault: false,
			styles: DRAW_STYLES,
		});
		map.addControl(draw);
		drawRef.current = draw;

		map.on("draw.create", (event: { features: GeoJSON.Feature[] }) => {
			const feature = event.features[0];
			if (feature?.geometry?.type !== "LineString") return;
			const coords = feature.geometry.coordinates as LngLat[];
			if (coords.length < 2) return;

			const allEq = equipmentRef.current;
			const from = nearestElementTo(coords[0], allEq);
			const to = nearestElementTo(coords[coords.length - 1], allEq);
			const routeType = from?.type === "olt" ? "feeder" : "distribution";
			const idx = nextRouteSequence(
				connectionsRef.current,
				routeType,
				draftRouteCountRef.current,
			);
			const code = generateDraftCode(routeType, idx);

			const draftRoute: DraftRoute = {
				isDraft: true,
				id: `draft-route-${Date.now()}-${idx}`,
				organization_id: null,
				code,
				type: routeType,
				status: "planned",
				from_element_id: from?.id ?? null,
				to_element_id: to?.id ?? null,
				from_element_type:
					(from?.type as ConnectionMapItem["from_element_type"]) ?? null,
				to_element_type:
					(to?.type as ConnectionMapItem["to_element_type"]) ?? null,
				cable_type: routeType,
				from_equipment_id: from?.id ?? "",
				to_equipment_id: to?.id ?? "",
				from_equipment_type:
					(from?.type as ConnectionMapItem["from_equipment_type"]) ?? "olt",
				to_equipment_type:
					(to?.type as ConnectionMapItem["to_equipment_type"]) ?? "nap",
				geojson_coordinates: coords,
				route_quality: "approximate",
				installation_type: "aerial",
				fiber_type: "g652d",
				fiber_count: 6,
				length_meters: Math.round(polylineLengthMeters(coords)),
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
			};

			setDraftRouteCount((n) => n + 1);
			draw.deleteAll();
			setSelected({ kind: "draftRoute", route: draftRoute });
			setActiveTool("select");
			setStatusMessage(
				from && to
					? `${code} listo — origen y destino detectados. Guarda la ruta.`
					: `${code} dibujado. Revisa origen/destino en el panel y guarda.`,
			);
		});

		return () => {
			popupRef.current?.remove();
			popupRef.current = null;
			draftMarkerRef.current?.remove();
			draftMarkerRef.current = null;
			for (const { marker } of markersByEqId.current.values()) marker.remove();
			markersByEqId.current.clear();
			if (drawRef.current) {
				map.removeControl(drawRef.current);
				drawRef.current = null;
			}
			map.remove();
			mapRef.current = null;
		};
	}, []);

	return (
		<ToastProvider>
			<TooltipProvider>
				<div className="relative h-full w-full">
					<style>{`
        @keyframes gpon-pulse {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.35; }
          70%  { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-role="pulse"] { animation: none !important; opacity: 0.25 !important; }
        }
      `}</style>

					<div ref={containerRef} className="h-full w-full" />

					{/* Mode indicator border — green in design, amber in edit */}
					{isActive && (
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 z-30"
							style={{
								boxShadow: isEditing
									? "inset 0 0 0 2px rgba(245,158,11,0.55)"
									: "inset 0 0 0 2px rgba(52,211,153,0.45)",
							}}
						/>
					)}

					{canEdit && (
						<EditorTopBar
							activeToolLabel={activeToolLabel}
							mode={mode}
							onModeChange={(nextMode) => {
								setMode(nextMode);
								// Reset to default tool for each mode
								if (nextMode === "view") setActiveTool("select");
								if (nextMode === "design") setActiveTool("olt");
								if (nextMode === "edit") setActiveTool("select");
							}}
						/>
					)}

					{canEdit && isActive && (
						<EditorToolbar
							activeTool={activeTool}
							onToolChange={setActiveTool}
							mode={mode}
						/>
					)}

					<InfrastructurePanel
						tab={leftTab}
						onTabChange={setLeftTab}
						mode={mode}
						allEquipment={equipment}
						connections={connections}
						routePointCount={routePointCount}
						incidents={incidents}
						mapWarnings={mapWarnings}
						filterType={filterType}
						filterStatus={filterStatus}
						onTypeChange={setFilterType}
						onStatusChange={setFilterStatus}
						onSelectEquipment={focusEquipment}
						onOpenCommand={() => setCommandOpen(true)}
					/>

					<SearchCommandPalette
						open={commandOpen}
						onOpenChange={setCommandOpen}
						equipment={equipment}
						incidents={incidents}
						onSelectEquipment={focusEquipment}
					/>

					<PropertiesPanel
						selectedFeature={selectedFeature}
						incident={
							selectedFeature?.kind === "element"
								? (incidentByEquipment[selectedFeature.element.id] ?? null)
								: null
						}
						mode={mode}
						validationErrors={validationErrors}
						onClose={() => setSelected(null)}
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
						onSaveElement={saveExistingElement}
						onSaveRoute={saveExistingRoute}
						zones={zones}
						equipment={equipment}
					/>

					{mode === "view" && <Legend />}

					{contextMenu && (
						<ContextMenu
							menu={contextMenu}
							canDelete={canDelete}
							onSelect={() => {
								setSelected(contextMenu.feature);
								setContextMenu(null);
							}}
							onDelete={() => {
								deleteFeature(contextMenu.feature);
								setContextMenu(null);
							}}
							onClose={() => setContextMenu(null)}
						/>
					)}

					<MapControls
						mode={mode}
						hasRightPanel={isActive || selectedFeature !== null}
						onZoomIn={() => mapRef.current?.zoomIn()}
						onZoomOut={() => mapRef.current?.zoomOut()}
						onResetNorth={() => mapRef.current?.resetNorth()}
						onFit={() => {
							const map = mapRef.current;
							if (!map || equipment.length === 0) return;
							const bounds = new mapboxgl.LngLatBounds();
							for (const eq of equipment) bounds.extend([eq.lng, eq.lat]);
							map.fitBounds(bounds, {
								padding: 120,
								maxZoom: 15,
								duration: 650,
							});
						}}
					/>
					<EditorStatusBar
						activeToolLabel={activeToolLabel}
						statusMessage={statusMessage}
						zoom={zoom}
						mode={mode}
						warnings={mapWarnings}
					/>
					<Toast open={toastOpen} onOpenChange={setToastOpen}>
						<ToastTitle>GPON</ToastTitle>
						<ToastDescription>{toastMessage}</ToastDescription>
					</Toast>
					<ToastViewport />
				</div>
			</TooltipProvider>
		</ToastProvider>
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
				{(
					[
						["view", "Vista", "#38bdf8"],
						["design", "Crear", "#34d399"],
						["edit", "Editar", "#f59e0b"],
					] as const
				).map(([value, label, accent]) => (
					<button
						key={value}
						type="button"
						aria-pressed={mode === value}
						onClick={() => onModeChange(value)}
						className="rounded px-3 py-1.5 text-[11px] font-medium transition-colors"
						style={{
							background: mode === value ? `${accent}28` : "transparent",
							color: mode === value ? accent : "#a4a4a4",
						}}
					>
						{label}
					</button>
				))}
			</div>
			{mode !== "view" && (
				<span
					className="rounded-md border px-2.5 py-1.5 text-[11px] transition-colors"
					style={{
						borderColor:
							mode === "edit"
								? "rgba(245,158,11,0.4)"
								: "rgba(52,211,153,0.35)",
						background:
							mode === "edit"
								? "rgba(245,158,11,0.12)"
								: "rgba(52,211,153,0.1)",
						color: mode === "edit" ? "#fbbf24" : "#34d399",
					}}
				>
					{activeToolLabel}
				</span>
			)}
		</div>
	);
}

// Tools available per mode
const TOOLS_BY_MODE: Record<EditorMode, EditorTool[]> = {
	view: [],
	design: ["olt", "splitter", "nap", "fiber", "crossing", "reserve", "splice"],
	edit: ["select", "pan", "measure", "delete"],
};

function EditorToolbar({
	activeTool,
	onToolChange,
	mode,
}: {
	activeTool: EditorTool;
	onToolChange: (tool: EditorTool) => void;
	mode: EditorMode;
}) {
	const allowedTools = TOOLS_BY_MODE[mode];
	const visibleTools = EDITOR_TOOLS.filter((t) =>
		allowedTools.includes(t.value),
	);
	const visibleGroups = [...new Set(visibleTools.map((t) => t.group))];

	if (mode === "view" || visibleTools.length === 0) return null;

	const accentColor = mode === "design" ? "#34d399" : "#f59e0b";

	return (
		<div
			className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-lg border bg-[rgba(34,35,36,0.92)] p-2 shadow-2xl backdrop-blur-md"
			style={{ borderColor: `${accentColor}33` }}
		>
			{visibleGroups.map((group) => (
				<div
					key={group}
					className="flex items-center gap-1"
					title={TOOL_GROUP_LABEL[group]}
				>
					{group !== visibleGroups[0] && (
						<div className="mx-1 h-8 w-px bg-[rgba(164,164,164,0.14)]" />
					)}
					{visibleTools
						.filter((tool) => tool.group === group)
						.map((tool) => (
							<Tooltip key={tool.value}>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={() => onToolChange(tool.value)}
										aria-label={tool.label}
										aria-pressed={activeTool === tool.value}
										className="flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-[11px] font-semibold transition-colors"
										style={{
											background:
												activeTool === tool.value
													? `${accentColor}22`
													: "rgba(164,164,164,0.06)",
											borderColor:
												activeTool === tool.value
													? `${accentColor}66`
													: "rgba(164,164,164,0.12)",
											color:
												activeTool === tool.value ? accentColor : "#a4a4a4",
										}}
									>
										<ToolGlyph tool={tool.value} />
									</button>
								</TooltipTrigger>
								<TooltipContent>
									{tool.label} ({tool.shortcut})
								</TooltipContent>
							</Tooltip>
						))}
				</div>
			))}
		</div>
	);
}

// Wrapper so Biome's noSvgWithoutTitle rule sees aria-hidden directly, not via spread.
function Ico({
	viewBox,
	fill,
	stroke,
	strokeWidth,
	strokeLinecap,
	children,
}: {
	viewBox: string;
	fill?: string;
	stroke?: string;
	strokeWidth?: number | string;
	strokeLinecap?: "round" | "butt" | "square";
	children: ReactNode;
}) {
	return (
		<svg
			aria-hidden="true"
			width={15}
			height={15}
			viewBox={viewBox}
			fill={fill}
			stroke={stroke}
			strokeWidth={strokeWidth}
			strokeLinecap={strokeLinecap}
		>
			{children}
		</svg>
	);
}

function ToolGlyph({ tool }: { tool: EditorTool }) {
	switch (tool) {
		case "select":
			return (
				<Ico viewBox="0 0 16 16" fill="currentColor">
					<path d="M3 2L3 13L6 10L8.2 14.5L10.3 13.5L8.1 9L12.5 9Z" />
				</Ico>
			);
		case "pan":
			return (
				<Ico viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 1.5L6 4H7.5V7.5H4V5.5L1.5 8L4 10.5V8.5H7.5V12H6L8 14.5L10 12H8.5V8.5H12V10.5L14.5 8L12 5.5V7.5H8.5V4H10Z" />
				</Ico>
			);
		case "olt":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<rect x="2" y="2.5" width="12" height="4" rx="1" />
					<rect x="2" y="9.5" width="12" height="4" rx="1" />
					<circle cx="12" cy="4.5" r="0.75" fill="currentColor" />
					<circle cx="12" cy="11.5" r="0.75" fill="currentColor" />
					<line x1="4" y1="4.5" x2="8" y2="4.5" />
					<line x1="4" y1="11.5" x2="8" y2="11.5" />
				</Ico>
			);
		case "splitter":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<path d="M8 2.5V7.5" />
					<path d="M8 7.5L4 13.5" />
					<path d="M8 7.5L12 13.5" />
					<circle cx="8" cy="7.5" r="1.5" fill="currentColor" />
				</Ico>
			);
		case "nap":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<rect x="3" y="3" width="10" height="10" rx="1.5" />
					<path d="M5.5 8H10.5" />
					<path d="M8 5.5V10.5" />
				</Ico>
			);
		case "fiber":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<path d="M2 13C4 13 4 3 8 3C12 3 12 13 14 13" />
					<circle cx="2" cy="13" r="1.5" fill="currentColor" />
					<circle cx="14" cy="13" r="1.5" fill="currentColor" />
				</Ico>
			);
		case "crossing":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<line x1="1.5" y1="12" x2="14.5" y2="12" />
					<path d="M4.5 12 Q8 4 11.5 12" />
					<line x1="6" y1="6" x2="10" y2="10" />
					<line x1="10" y1="6" x2="6" y2="10" />
				</Ico>
			);
		case "reserve":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<line x1="1" y1="12" x2="3.5" y2="12" />
					<path d="M3.5 12 C3.5 12 3.5 4 8 4 C12.5 4 12.5 12 12.5 12" />
					<line x1="12.5" y1="12" x2="15" y2="12" />
				</Ico>
			);
		case "splice":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<line x1="1.5" y1="8" x2="5.5" y2="8" />
					<line x1="10.5" y1="8" x2="14.5" y2="8" />
					<rect x="5.5" y="5.5" width="5" height="5" rx="1" />
					<line x1="5.5" y1="8" x2="10.5" y2="8" strokeDasharray="1.5 1" />
				</Ico>
			);
		case "measure":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<line x1="2" y1="8" x2="14" y2="8" />
					<line x1="2" y1="5.5" x2="2" y2="10.5" />
					<line x1="14" y1="5.5" x2="14" y2="10.5" />
					<line x1="6" y1="7" x2="6" y2="9" />
					<line x1="10" y1="7" x2="10" y2="9" />
				</Ico>
			);
		case "delete":
			return (
				<Ico
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				>
					<path d="M3 4.5H13" />
					<path d="M6 4.5V3H10V4.5" />
					<path d="M4.5 4.5L5 13.5H11L11.5 4.5" />
					<line x1="7" y1="7" x2="7" y2="11" />
					<line x1="9" y1="7" x2="9" y2="11" />
				</Ico>
			);
	}
}

function InfrastructurePanel({
	tab,
	onTabChange,
	mode,
	allEquipment,
	connections,
	routePointCount,
	incidents,
	mapWarnings,
	filterType,
	filterStatus,
	onTypeChange,
	onStatusChange,
	onSelectEquipment,
	onOpenCommand,
}: {
	tab: LeftPanelTab;
	onTabChange: (tab: LeftPanelTab) => void;
	mode: EditorMode;
	allEquipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	routePointCount: number;
	incidents: IncidentMapItem[];
	mapWarnings: string[];
	filterType: string;
	filterStatus: string;
	onTypeChange: (v: string) => void;
	onStatusChange: (v: string) => void;
	onSelectEquipment: (eq: EquipmentMapItem) => void;
	onOpenCommand: () => void;
}) {
	const [expandedTreeItems, setExpandedTreeItems] = useState<Set<string>>(
		() =>
			new Set(
				allEquipment
					.filter((element) => element.type === "olt")
					.map((element) => element.id),
			),
	);
	const toggleTreeItem = (id: string) => {
		setExpandedTreeItems((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};
	useEffect(() => {
		setExpandedTreeItems((current) => {
			const next = new Set(current);
			for (const element of allEquipment) {
				if (element.type === "olt") next.add(element.id);
			}
			return next;
		});
	}, [allEquipment]);

	// Network stats for header
	const olts = allEquipment.filter((e) => e.type === "olt").length;
	const splitters = allEquipment.filter((e) => e.type === "splitter").length;
	const naps = allEquipment.filter((e) => e.type === "nap").length;
	const totalKm =
		connections.reduce((sum, c) => sum + (c.length_meters ?? 0), 0) / 1000;
	const saturatedNaps = allEquipment.filter(
		(e) =>
			e.type === "nap" && e.total_ports && (e.ports_used ?? 0) >= e.total_ports,
	).length;
	const tabs = [
		{ value: "tree", label: "Árbol", icon: Network },
		{ value: "layers", label: "Capas", icon: Layers },
		{ value: "quality", label: "Alertas", icon: Siren },
	] as const;

	return (
		<div
			className={`absolute left-4 top-4 z-20 flex max-h-[calc(100%-5rem)] flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md ${mode !== "view" ? "w-80" : "w-72"}`}
		>
			<Tabs
				value={tab}
				onValueChange={(value) => onTabChange(value as LeftPanelTab)}
				className="min-h-0 flex-1 gap-0"
			>
				<div className="border-b border-[rgba(164,164,164,0.12)] px-3 py-2.5">
					{/* Network stats header */}
					<div className="grid grid-cols-4 gap-1.5 mb-2.5">
						<StatChip label="OLT" value={olts} color={TYPE_COLOR.olt} />
						<StatChip
							label="SPL"
							value={splitters}
							color={TYPE_COLOR.splitter}
						/>
						<StatChip label="NAP" value={naps} color={TYPE_COLOR.nap} />
						<StatChip label="km" value={totalKm.toFixed(1)} color="#a4a4a4" />
					</div>
					{saturatedNaps > 0 && (
						<div className="mb-2 flex items-center gap-2 rounded-md border border-[rgba(251,77,109,0.28)] bg-[rgba(251,77,109,0.08)] px-2 py-1 text-[10px] text-[#fb7185]">
							<AlertTriangle className="size-3" aria-hidden="true" />
							<span>
								{saturatedNaps} NAP{saturatedNaps > 1 ? "s" : ""} saturada
								{saturatedNaps > 1 ? "s" : ""}
							</span>
						</div>
					)}

					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onOpenCommand}
						className="mb-2 h-8 w-full justify-between border-[rgba(164,164,164,0.16)] bg-[rgba(27,28,29,0.62)] text-xs text-[#d7d7d7] hover:bg-[rgba(164,164,164,0.1)]"
					>
						<span className="flex items-center gap-2">
							<Search className="size-3.5" aria-hidden="true" />
							Buscar red
						</span>
						<kbd className="rounded border border-[rgba(164,164,164,0.18)] bg-[rgba(164,164,164,0.08)] px-1.5 py-0.5 font-mono text-[10px] text-[#858585]">
							⌘K
						</kbd>
					</Button>

					<TabsList className="grid w-full grid-cols-3 bg-[rgba(164,164,164,0.05)]">
						{tabs.map(({ value, label, icon: Icon }) => (
							<TabsTrigger
								key={value}
								value={value}
								className="relative px-1 text-[10px]"
							>
								<Icon className="size-3" aria-hidden="true" />
								<span className="hidden sm:inline">{label}</span>
								{value === "quality" && mapWarnings.length > 0 && (
									<Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-[#f59e0b] px-1 text-[9px] text-[#1b1c1d]">
										{mapWarnings.length}
									</Badge>
								)}
							</TabsTrigger>
						))}
					</TabsList>
				</div>

				<TabsContent value="layers" className="overflow-hidden">
					<ScrollArea className="h-full px-3 py-3">
						<p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Filtros de visibilidad
						</p>
						<FilterBar
							filterType={filterType}
							filterStatus={filterStatus}
							onTypeChange={onTypeChange}
							onStatusChange={onStatusChange}
						/>
						<p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Capas de red
						</p>
						<div className="space-y-2">
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
					</ScrollArea>
				</TabsContent>

				<TabsContent value="tree" className="overflow-hidden">
					<ScrollArea className="h-full px-3 py-3">
						<div className="space-y-2">
							<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879] mb-2">
								Topología OLT → Splitter → NAP
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={onOpenCommand}
								className="mb-3 h-8 w-full justify-start border-[rgba(164,164,164,0.14)] bg-[rgba(164,164,164,0.05)] text-xs text-[#a4a4a4]"
							>
								<Search className="size-3.5" aria-hidden="true" />
								Buscar equipo por código o cliente
							</Button>
							{allEquipment.filter((e) => e.type === "olt").length === 0 ? (
								<p className="text-[11px] text-[#5c5d5f] text-center py-4">
									Sin elementos en la red
								</p>
							) : (
								allEquipment
									.filter((e) => e.type === "olt")
									.map((olt) => {
										const feederRoutes = connections.filter(
											(c) =>
												c.from_element_id === olt.id ||
												c.to_element_id === olt.id,
										);
										const connectedSplitters = allEquipment.filter(
											(e) =>
												e.type === "splitter" &&
												feederRoutes.some(
													(r) =>
														r.from_element_id === e.id ||
														r.to_element_id === e.id,
												),
										);
										const isOltExpanded = expandedTreeItems.has(olt.id);
										return (
											<div
												key={olt.id}
												className="rounded-md border border-[rgba(56,189,248,0.2)] bg-[rgba(56,189,248,0.05)] p-2"
											>
												<div className="flex items-center gap-1.5">
													<button
														type="button"
														onClick={() => toggleTreeItem(olt.id)}
														aria-label={
															isOltExpanded
																? `Contraer ${olt.name ?? olt.code}`
																: `Expandir ${olt.name ?? olt.code}`
														}
														aria-expanded={isOltExpanded}
														className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#a4a4a4] transition-colors hover:bg-white/10 hover:text-[#e6e6e6]"
													>
														{isOltExpanded ? (
															<ChevronDown
																className="size-3.5"
																aria-hidden="true"
															/>
														) : (
															<ChevronRight
																className="size-3.5"
																aria-hidden="true"
															/>
														)}
													</button>
													<button
														type="button"
														onClick={() => onSelectEquipment(olt)}
														className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
													>
														<span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8] shrink-0" />
														<span className="truncate text-xs font-semibold text-[#e6e6e6]">
															{olt.name ?? olt.code}
														</span>
														<span className="ml-auto shrink-0 text-[10px] text-[#777879]">
															{connectedSplitters.length} splitters
														</span>
														{olt.total_pon_ports && (
															<span className="shrink-0 text-[10px] text-[#777879]">
																{olt.total_pon_ports}P
															</span>
														)}
													</button>
												</div>
												{isOltExpanded &&
													connectedSplitters.map((spl) => {
														const distRoutes = connections.filter(
															(c) =>
																c.from_element_id === spl.id ||
																c.to_element_id === spl.id,
														);
														const connectedNaps = allEquipment.filter(
															(e) =>
																e.type === "nap" &&
																distRoutes.some(
																	(r) =>
																		r.from_element_id === e.id ||
																		r.to_element_id === e.id,
																),
														);
														const isSplitterExpanded = expandedTreeItems.has(
															spl.id,
														);
														return (
															<div
																key={spl.id}
																className="ml-3 mt-1.5 border-l border-[rgba(167,139,250,0.3)] pl-2.5"
															>
																<div className="flex items-center gap-1.5">
																	<button
																		type="button"
																		onClick={() => toggleTreeItem(spl.id)}
																		aria-label={
																			isSplitterExpanded
																				? `Contraer ${spl.name ?? spl.code}`
																				: `Expandir ${spl.name ?? spl.code}`
																		}
																		aria-expanded={isSplitterExpanded}
																		className="flex size-5 shrink-0 items-center justify-center rounded text-[#858585] transition-colors hover:bg-white/10 hover:text-[#d7d7d7]"
																	>
																		{isSplitterExpanded ? (
																			<ChevronDown
																				className="size-3"
																				aria-hidden="true"
																			/>
																		) : (
																			<ChevronRight
																				className="size-3"
																				aria-hidden="true"
																			/>
																		)}
																	</button>
																	<button
																		type="button"
																		onClick={() => onSelectEquipment(spl)}
																		className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
																	>
																		<span className="h-2 w-2 rounded-full bg-[#a78bfa] shrink-0" />
																		<span className="truncate text-[11px] text-[#d7d7d7]">
																			{spl.name ?? spl.code}
																		</span>
																		<span className="ml-auto shrink-0 text-[10px] text-[#777879]">
																			{connectedNaps.length} NAPs
																		</span>
																		{spl.split_ratio && (
																			<span className="shrink-0 text-[10px] text-[#777879]">
																				{spl.split_ratio}
																			</span>
																		)}
																	</button>
																</div>
																{isSplitterExpanded &&
																	connectedNaps.map((nap) => {
																		const pct = nap.total_ports
																			? (nap.ports_used ?? 0) / nap.total_ports
																			: 0;
																		const napColor =
																			pct >= 0.9
																				? "#fb4d6d"
																				: pct >= 0.7
																					? "#f59e0b"
																					: "#34d399";
																		return (
																			<div
																				key={nap.id}
																				className="ml-3 mt-1 border-l border-[rgba(245,158,11,0.2)] pl-2.5"
																			>
																				<button
																					type="button"
																					onClick={() => onSelectEquipment(nap)}
																					className="flex w-full items-center gap-1.5 text-left hover:opacity-80"
																				>
																					<span
																						className="h-1.5 w-1.5 rounded-full shrink-0"
																						style={{ background: napColor }}
																					/>
																					<span className="text-[10px] text-[#a4a4a4] truncate">
																						{nap.name ?? nap.code}
																					</span>
																					{nap.total_ports && (
																						<span
																							className="ml-auto text-[9px] shrink-0"
																							style={{ color: napColor }}
																						>
																							{nap.ports_used ?? 0}/
																							{nap.total_ports}
																						</span>
																					)}
																					{hasInternalSplitter(nap) &&
																						nap.split_ratio && (
																							<span className="shrink-0 text-[9px] text-[#777879]">
																								{nap.split_ratio}
																							</span>
																						)}
																				</button>
																			</div>
																		);
																	})}
																{isSplitterExpanded &&
																	connectedNaps.length === 0 && (
																		<p className="ml-3 text-[10px] text-[#5c5d5f] mt-0.5">
																			Sin NAPs conectadas
																		</p>
																	)}
															</div>
														);
													})}
												{isOltExpanded && connectedSplitters.length === 0 && (
													<p className="ml-3 mt-1 text-[10px] text-[#5c5d5f]">
														Sin splitters conectados
													</p>
												)}
											</div>
										);
									})
							)}
						</div>
					</ScrollArea>
				</TabsContent>

				<TabsContent value="quality" className="overflow-hidden">
					<ScrollArea className="h-full px-3 py-3">
						<div className="space-y-1.5">
							<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879] mb-2">
								Alertas de red — {mapWarnings.length} activas
							</p>
							{mapWarnings.length === 0 ? (
								<div className="rounded-md border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.08)] px-3 py-2.5">
									<p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#34d399]">
										<CheckCircle2 className="size-3" aria-hidden="true" />
										Red sin alertas
									</p>
									<p className="mt-0.5 text-[10px] text-[#9ee8c9]">
										Todos los elementos tienen datos técnicos válidos.
									</p>
								</div>
							) : (
								mapWarnings.map((w) => (
									<div
										key={w}
										className="flex items-start gap-2 rounded-md border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-2.5 py-2"
									>
										<AlertTriangle
											className="mt-0.5 size-3 shrink-0 text-[#f59e0b]"
											aria-hidden="true"
										/>
										<p className="text-[11px] text-[#f6c768] leading-snug">
											{w}
										</p>
									</div>
								))
							)}
							{incidents.length > 0 && (
								<>
									<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879] mt-3 mb-1">
										Incidentes activos — {incidents.length}
									</p>
									{incidents.map((inc) => (
										<div
											key={inc.id}
											className="rounded-md border border-[rgba(251,77,109,0.22)] bg-[rgba(251,77,109,0.08)] px-2.5 py-1.5"
										>
											<p className="text-[11px] text-[#fb7185]">{inc.title}</p>
										</div>
									))}
								</>
							)}
						</div>
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function SearchCommandPalette({
	open,
	onOpenChange,
	equipment,
	incidents,
	onSelectEquipment,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	equipment: EquipmentMapItem[];
	incidents: IncidentMapItem[];
	onSelectEquipment: (eq: EquipmentMapItem) => void;
}) {
	const [query, setQuery] = useState("");
	const normalizedQuery = query.trim().toLowerCase();
	const incidentEquipmentIds = new Set(
		incidents.map((incident) => incident.equipment_id),
	);
	const results = normalizedQuery
		? equipment.filter((eq) => {
				const searchable = [
					eq.name,
					eq.code,
					eq.type,
					eq.status,
					eq.customer_name,
					eq.address,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				return (
					searchable.includes(normalizedQuery) ||
					operativeCodeMatches(eq.code, normalizedQuery)
				);
			})
		: equipment.slice(0, 12);
	const limitedResults = results.slice(0, 24);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="overflow-hidden border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.97)] shadow-2xl backdrop-blur-xl">
				<div className="flex items-start justify-between gap-4 border-b border-[rgba(164,164,164,0.12)] px-4 py-3">
					<div>
						<DialogTitle className="text-sm text-[#e6e6e6]">
							Búsqueda GPON
						</DialogTitle>
						<DialogDescription className="mt-1 text-xs">
							Busca OLT, splitter, NAP, ONT, cliente o código operativo.
						</DialogDescription>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={() => onOpenChange(false)}
						aria-label="Cerrar búsqueda"
					>
						<X className="size-4" aria-hidden="true" />
					</Button>
				</div>
				<div className="px-4 pt-3">
					<div className="relative">
						<Search
							className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							autoFocus
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Ej. NAP-Z05-012, ONT, cliente..."
							className="h-10 bg-[rgba(27,28,29,0.82)] pl-9"
						/>
					</div>
				</div>
				<ScrollArea className="max-h-[22rem] px-2 py-3">
					<div className="space-y-1 px-2">
						{limitedResults.length === 0 ? (
							<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] px-3 py-8 text-center">
								<p className="text-sm font-medium text-[#d7d7d7]">
									Sin resultados
								</p>
								<p className="mt-1 text-xs text-[#777879]">
									Prueba con código, nombre, estado o cliente.
								</p>
							</div>
						) : (
							limitedResults.map((eq) => {
								const hasIncident = incidentEquipmentIds.has(eq.id);
								return (
									<button
										key={eq.id}
										type="button"
										onClick={() => {
											onSelectEquipment(eq);
											onOpenChange(false);
											setQuery("");
										}}
										className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[rgba(164,164,164,0.18)] hover:bg-[rgba(164,164,164,0.08)]"
									>
										<span
											className="h-3 w-3 shrink-0 rounded-full"
											style={{
												backgroundColor:
													TYPE_COLOR[eq.type] ?? TYPE_COLOR.unknown,
											}}
										/>
										<span className="min-w-0 flex-1">
											<span className="flex items-center gap-2">
												<span className="truncate text-sm font-medium text-[#e6e6e6]">
													{eq.name ?? eq.code}
												</span>
												{hasIncident && (
													<Badge
														variant="destructive"
														className="h-4 px-1.5 text-[9px]"
													>
														Incidente
													</Badge>
												)}
											</span>
											<span className="mt-0.5 flex items-center gap-2 text-[11px] text-[#777879]">
												<span className="font-mono">{eq.code}</span>
												<span>{eq.type.toUpperCase()}</span>
												{eq.customer_name && <span>{eq.customer_name}</span>}
											</span>
										</span>
										<span className="flex shrink-0 items-center gap-1.5 text-[11px] text-[#858585]">
											<span
												className="h-2 w-2 rounded-full"
												style={{
													backgroundColor:
														STATUS_COLOR[eq.status] ?? STATUS_COLOR.unknown,
												}}
											/>
											{eq.status}
										</span>
									</button>
								);
							})
						)}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

function StatChip({
	label,
	value,
	color,
}: {
	label: string;
	value: number | string;
	color: string;
}) {
	return (
		<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] px-2 py-1.5 text-center">
			<p className="font-mono text-xs font-bold" style={{ color }}>
				{value}
			</p>
			<p className="text-[9px] font-semibold uppercase text-[#777879]">
				{label}
			</p>
		</div>
	);
}

function LayerToggle({ label, color }: { label: string; color: string }) {
	return (
		<div className="flex items-center gap-2 rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(164,164,164,0.05)] px-2.5 py-2 text-xs text-[#d7d7d7]">
			<span
				className="h-2 w-2 shrink-0 rounded-full"
				style={{ backgroundColor: color }}
			/>
			<span>{label}</span>
		</div>
	);
}

function PropertiesPanel({
	selectedFeature,
	incident,
	mode,
	validationErrors,
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
	onSaveElement,
	onSaveRoute,
	zones,
	equipment,
}: {
	selectedFeature: AnySelectedFeature | null;
	incident: IncidentMapItem | null;
	mode: EditorMode;
	validationErrors: ValidationError[];
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
	onSaveElement: (
		element: EquipmentMapItem,
		patch: Partial<EquipmentMapItem>,
	) => void | Promise<void>;
	onSaveRoute: (
		route: ConnectionMapItem,
		patch: Partial<ConnectionMapItem>,
	) => void | Promise<void>;
	zones: NetworkZone[];
	equipment: EquipmentMapItem[];
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
	const selectionMeta = getSelectionMeta(selectedFeature);

	if (mode === "view" && !selectedFeature) return null;

	return (
		<div className="absolute right-4 top-4 z-20 flex max-h-[calc(100%-5rem)] w-80 flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			<div className="h-1 w-full" style={{ backgroundColor: accentColor }} />
			<div className="border-b border-[rgba(164,164,164,0.12)] px-4 py-3">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex items-center gap-1.5">
							<Badge
								variant="outline"
								className="h-5 border-[rgba(164,164,164,0.18)] px-1.5 text-[10px] text-[#a4a4a4]"
							>
								{selectionMeta.kindLabel}
							</Badge>
							{selectionMeta.statusLabel && (
								<Badge
									variant="secondary"
									className="h-5 px-1.5 text-[10px]"
									style={{
										color: selectionMeta.statusColor,
										backgroundColor: `${selectionMeta.statusColor}18`,
									}}
								>
									{selectionMeta.statusLabel}
								</Badge>
							)}
						</div>
						<h2 className="mt-2 truncate text-sm font-semibold text-[#e6e6e6]">
							{title}
						</h2>
					</div>
					{selectedFeature && (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={onClose}
							aria-label="Cerrar propiedades"
							className="text-[#a4a4a4] hover:text-[#e6e6e6]"
						>
							<X className="size-4" aria-hidden="true" />
						</Button>
					)}
				</div>
			</div>

			<ScrollArea className="min-h-0 flex-1 px-4 py-3">
				{selectedFeature ? (
					<SelectedFeatureProperties
						selectedFeature={selectedFeature}
						incident={incident}
						mode={mode}
						validationErrors={validationErrors}
						isDeleting={isDeleting}
						onCancelDraft={onCancelDraft}
						onDraftChange={onDraftChange}
						onDraftRouteChange={onDraftRouteChange}
						onDraftRoutePointChange={onDraftRoutePointChange}
						onDelete={onDelete}
						onSaveDraft={onSaveDraft}
						onSaveDraftRoute={onSaveDraftRoute}
						onSaveRoutePointDraft={onSaveRoutePointDraft}
						onSaveElement={onSaveElement}
						onSaveRoute={onSaveRoute}
						zones={zones}
						equipment={equipment}
					/>
				) : (
					<div className="space-y-3 text-xs text-[#a4a4a4]">
						<p>
							{mode === "design"
								? "Usa las herramientas para crear OLT, splitter, NAP o rutas de fibra."
								: mode === "edit"
									? "Selecciona un elemento para editar o eliminar."
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
			</ScrollArea>
		</div>
	);
}

function getSelectionMeta(selectedFeature: AnySelectedFeature | null): {
	kindLabel: string;
	statusLabel: string | null;
	statusColor: string;
} {
	if (!selectedFeature) {
		return {
			kindLabel: "Inspector",
			statusLabel: null,
			statusColor: STATUS_COLOR.unknown,
		};
	}
	if (selectedFeature.kind === "element") {
		const { element } = selectedFeature;
		return {
			kindLabel: element.type.toUpperCase(),
			statusLabel: element.status,
			statusColor: STATUS_COLOR[element.status] ?? STATUS_COLOR.unknown,
		};
	}
	if (selectedFeature.kind === "draftElement") {
		return {
			kindLabel: selectedFeature.element.type.toUpperCase(),
			statusLabel: "Provisional",
			statusColor:
				TYPE_COLOR[selectedFeature.element.type] ?? TYPE_COLOR.unknown,
		};
	}
	if (
		selectedFeature.kind === "route" ||
		selectedFeature.kind === "draftRoute"
	) {
		const route =
			selectedFeature.kind === "route"
				? selectedFeature.route
				: selectedFeature.route;
		return {
			kindLabel: "Ruta",
			statusLabel: route.status,
			statusColor: CABLE_COLOR[route.type] ?? CABLE_COLOR.default,
		};
	}
	const point =
		selectedFeature.kind === "routePoint"
			? selectedFeature.point
			: selectedFeature.point;
	return {
		kindLabel: "Punto",
		statusLabel:
			selectedFeature.kind === "draftRoutePoint" ? "Provisional" : point.status,
		statusColor: ROUTE_POINT_COLOR[point.type] ?? TYPE_COLOR.unknown,
	};
}

function SelectedFeatureProperties({
	selectedFeature,
	incident,
	mode,
	validationErrors,
	isDeleting,
	onCancelDraft,
	onDraftChange,
	onDraftRouteChange,
	onDraftRoutePointChange,
	onDelete,
	onSaveDraft,
	onSaveDraftRoute,
	onSaveRoutePointDraft,
	onSaveElement,
	onSaveRoute,
	zones,
	equipment,
}: {
	selectedFeature: AnySelectedFeature;
	incident: IncidentMapItem | null;
	mode: EditorMode;
	validationErrors: ValidationError[];
	isDeleting: boolean;
	onCancelDraft: () => void;
	onDraftChange: (patch: DraftElementPatch) => void;
	onDraftRouteChange: (patch: DraftRoutePatch) => void;
	onDraftRoutePointChange: (patch: DraftRoutePointPatch) => void;
	onDelete: (feature: SelectedFeature) => void | Promise<void>;
	onSaveDraft: (draft: DraftElement) => void | Promise<void>;
	onSaveDraftRoute: (draft: DraftRoute) => void | Promise<void>;
	onSaveRoutePointDraft: (draft: DraftRoutePoint) => void | Promise<void>;
	onSaveElement: (
		element: EquipmentMapItem,
		patch: Partial<EquipmentMapItem>,
	) => void | Promise<void>;
	onSaveRoute: (
		route: ConnectionMapItem,
		patch: Partial<ConnectionMapItem>,
	) => void | Promise<void>;
	zones: NetworkZone[];
	equipment: EquipmentMapItem[];
}) {
	// Helper: find validation error for a specific field
	const getFieldError = (
		elementId: string,
		fieldName: string,
	): string | undefined => {
		return validationErrors.find(
			(e) => e.id === elementId && e.field === fieldName,
		)?.message;
	};

	if (selectedFeature.kind === "draftElement") {
		const draft = selectedFeature.element;
		const draftNapMode = draft.type === "nap" ? getNapMode(draft) : null;
		const selectedZone = draft.selectedZone ?? "Z05";
		const zoneOptions: Array<[value: string, label: string]> =
			zones.length > 0
				? zones.map((z) => [z.zone_code, `${z.zone_code} — ${z.zone_name}`])
				: [["Z05", "Z05"]];

		// Calculate next sequence for this type + zone
		const codesByTypeAndZone = equipment
			.filter((e) => e.type === draft.type && e.code?.includes(selectedZone))
			.map((e) => e.code);
		const nextSeq = nextSequence(codesByTypeAndZone);

		return (
			<div className="space-y-3">
				<PropertyRow label="Entidad" value="Elemento provisional" />
				<PropertyRow label="Tipo" value={draft.type.toUpperCase()} />
				<PropertyRow label="Estado" value={draft.status} />

				{/* Zone selector */}
				<DraftSelectField
					label="Zona"
					value={selectedZone}
					options={zoneOptions}
					onChange={(zone) => {
						const newCode = generateDraftCode(draft.type, nextSeq, zone);
						onDraftChange({
							code: newCode,
							selectedZone: zone,
						} as DraftElementPatch);
					}}
				/>

				<DraftTextField
					label="Código"
					value={draft.code}
					onChange={(code) => onDraftChange({ code })}
				/>
				<DraftTextField
					label="Nombre"
					value={draft.name ?? ""}
					error={getFieldError(draft.id, "name")}
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
					<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] p-3">
						<OltModelSelector
							selectedOpticalClass={draft.optical_class ?? null}
							onSelect={(model) => {
								onDraftChange({
									optical_class: model.opticalClass,
									total_pon_ports: model.maxPonPorts,
								});
							}}
						/>
					</div>
				)}
				{draft.type === "splitter" && (
					<>
						<DraftSelectField
							label="Ratio"
							value={draft.split_ratio ?? "1:8"}
							error={getFieldError(draft.id, "split_ratio")}
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
									insertion_loss_db:
										SPLITTER_LOSS_DB[split_ratio] ?? draft.insertion_loss_db,
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
					<>
						<DraftSelectField
							label="Tipo de NAP"
							value={draftNapMode ?? "with_splitter"}
							options={[
								["terminal", NAP_MODE_LABEL.terminal],
								["with_splitter", NAP_MODE_LABEL.with_splitter],
								["prepared", NAP_MODE_LABEL.prepared],
							]}
							onChange={(mode) => {
								const napMode = mode as NapMode;
								onDraftChange({
									properties: {
										...draft.properties,
										nap_mode: napMode,
									},
									split_ratio:
										napMode === "with_splitter"
											? (draft.split_ratio ?? "1:16")
											: null,
									insertion_loss_db:
										napMode === "with_splitter"
											? (SPLITTER_LOSS_DB[draft.split_ratio ?? "1:16"] ??
												draft.insertion_loss_db)
											: null,
								});
							}}
						/>
						<DraftSelectField
							label="Conector"
							value={napPropertyLabel(draft, "connector_type", "SC/APC")}
							options={[
								["SC/APC", "SC/APC"],
								["SC/UPC", "SC/UPC"],
								["Mini SC/APC", "Mini SC/APC"],
							]}
							onChange={(connectorType) =>
								onDraftChange({
									properties: {
										...draft.properties,
										connector_type: connectorType,
									},
								})
							}
						/>
						<DraftSelectField
							label="Protección"
							value={napPropertyLabel(draft, "protection_rating", "IP65")}
							options={[
								["IP65", "IP65"],
								["IP68", "IP68"],
							]}
							onChange={(protectionRating) =>
								onDraftChange({
									properties: {
										...draft.properties,
										protection_rating: protectionRating,
									},
								})
							}
						/>
						{draftNapMode === "with_splitter" && (
							<DraftSelectField
								label="Splitter interno"
								value={draft.split_ratio ?? "1:16"}
								options={[
									["1:8", "1:8"],
									["1:16", "1:16"],
									["1:32", "1:32"],
								]}
								onChange={(split_ratio) =>
									onDraftChange({
										split_ratio: split_ratio as DraftElement["split_ratio"],
										insertion_loss_db:
											SPLITTER_LOSS_DB[split_ratio] ?? draft.insertion_loss_db,
									})
								}
							/>
						)}
						<DraftNumberField
							label="Puertos"
							value={draft.total_ports}
							error={getFieldError(draft.id, "capacity")}
							onChange={(total_ports) => onDraftChange({ total_ports })}
						/>
					</>
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
					<Button
						type="button"
						onClick={onCancelDraft}
						variant="outline"
						size="sm"
						className="border-[rgba(164,164,164,0.16)] bg-transparent text-[#a4a4a4]"
					>
						Cancelar
					</Button>
					<Button
						type="button"
						onClick={() => onSaveDraft(draft)}
						size="sm"
						className="border border-[rgba(56,189,248,0.32)] bg-[rgba(56,189,248,0.14)] text-[#bdeafe] hover:bg-[rgba(56,189,248,0.22)]"
					>
						<Save className="size-3.5" aria-hidden="true" />
						Guardar
					</Button>
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
					<Button
						type="button"
						onClick={onCancelDraft}
						variant="outline"
						size="sm"
						className="border-[rgba(164,164,164,0.16)] bg-transparent text-[#a4a4a4]"
					>
						Cancelar
					</Button>
					<Button
						type="button"
						onClick={() => onSaveDraftRoute(draft)}
						size="sm"
						className="border border-[rgba(56,189,248,0.32)] bg-[rgba(56,189,248,0.14)] text-[#bdeafe] hover:bg-[rgba(56,189,248,0.22)]"
					>
						<Route className="size-3.5" aria-hidden="true" />
						Guardar
					</Button>
				</div>
				<PendingMutationNotice />
			</div>
		);
	}

	if (selectedFeature.kind === "route") {
		const route = selectedFeature.route;
		return (
			<ExistingRoutePanel
				route={route}
				mode={mode}
				isDeleting={isDeleting}
				onDelete={() => onDelete(selectedFeature)}
				onSave={(patch) => onSaveRoute(route, patch)}
			/>
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
					<Button
						type="button"
						onClick={onCancelDraft}
						variant="outline"
						size="sm"
						className="border-[rgba(164,164,164,0.16)] bg-transparent text-[#a4a4a4]"
					>
						Cancelar
					</Button>
					<Button
						type="button"
						onClick={() => onSaveRoutePointDraft(draft)}
						size="sm"
						className="border border-[rgba(56,189,248,0.32)] bg-[rgba(56,189,248,0.14)] text-[#bdeafe] hover:bg-[rgba(56,189,248,0.22)]"
					>
						<MapPin className="size-3.5" aria-hidden="true" />
						Guardar
					</Button>
				</div>
				<PendingMutationNotice />
			</div>
		);
	}

	const element = selectedFeature.element;
	return (
		<ExistingElementPanel
			element={element}
			incident={incident}
			mode={mode}
			isDeleting={isDeleting}
			onDelete={() => onDelete(selectedFeature)}
			onSave={(patch) => onSaveElement(element, patch)}
		/>
	);
}

function ExistingElementPanel({
	element,
	incident,
	mode,
	isDeleting,
	onDelete,
	onSave,
}: {
	element: EquipmentMapItem;
	incident: IncidentMapItem | null;
	mode: EditorMode;
	isDeleting: boolean;
	onDelete: () => void;
	onSave: (patch: Partial<EquipmentMapItem>) => void;
}) {
	const [patch, setPatch] = useState<Partial<EquipmentMapItem>>({});
	const isDirty = Object.keys(patch).length > 0;

	const field = <K extends keyof EquipmentMapItem>(
		key: K,
		val: EquipmentMapItem[K],
	) => setPatch((p) => ({ ...p, [key]: val }));

	const currentValue = <K extends keyof EquipmentMapItem>(
		key: K,
	): EquipmentMapItem[K] =>
		(patch[key] !== undefined
			? patch[key]
			: element[key]) as EquipmentMapItem[K];
	const currentElement = { ...element, ...patch };
	const currentNapMode =
		element.type === "nap" ? getNapMode(currentElement) : null;
	const setProperty = (key: string, value: string) => {
		field("properties", {
			...currentElement.properties,
			[key]: value,
		});
	};

	if (mode !== "edit") {
		// View / design → read-only
		return (
			<div className="space-y-3">
				<PropertyRow label="Tipo" value={element.type.toUpperCase()} />
				<PropertyRow label="Código" value={element.code} />
				<PropertyRow label="Estado" value={element.status} />
				<PropertyRow label="Calidad" value={element.location_quality} />
				{element.type === "olt" && (
					<>
						<PropertyRow
							label="Puertos PON"
							value={element.total_pon_ports?.toString() ?? "—"}
						/>
						<div className="flex justify-between text-xs py-0.5">
							<span className="text-[#777879]">Clase óptica</span>
							<span
								className="font-semibold"
								style={{ color: element.optical_class ? "#34d399" : "#777879" }}
							>
								{element.optical_class ?? "Sin definir"}
							</span>
						</div>
					</>
				)}
				{element.type === "splitter" && (
					<PropertyRow label="Ratio" value={element.split_ratio ?? "—"} />
				)}
				{element.type === "nap" && (
					<>
						<PropertyRow
							label="Tipo de NAP"
							value={NAP_MODE_LABEL[getNapMode(element)]}
						/>
						<PropertyRow
							label="Conector"
							value={napPropertyLabel(element, "connector_type", "SC/APC")}
						/>
						<PropertyRow
							label="Protección"
							value={napPropertyLabel(element, "protection_rating", "IP65")}
						/>
						<PropertyRow
							label="Splitter interno"
							value={
								getNapMode(element) === "with_splitter"
									? (element.split_ratio ?? "Sin ratio")
									: "No instalado"
							}
						/>
					</>
				)}
				{element.type === "nap" && element.total_ports != null && (
					<NapCapacity element={element} size="sm" />
				)}
				<PropertyRow
					label="Coordenadas"
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
			</div>
		);
	}

	// Edit mode → editable fields
	return (
		<div className="space-y-3">
			<PropertyRow label="Tipo" value={element.type.toUpperCase()} />
			<DraftTextField
				label="Código"
				value={currentValue("code") as string}
				onChange={(v) => field("code", v as EquipmentMapItem["code"])}
			/>
			<DraftTextField
				label="Nombre"
				value={(currentValue("name") as string | null) ?? ""}
				onChange={(v) => field("name", (v || null) as EquipmentMapItem["name"])}
			/>
			<DraftSelectField
				label="Estado"
				value={currentValue("status") as string}
				options={[
					["planned", "Planificado"],
					["active", "Activo"],
					["inactive", "Inactivo"],
					["faulty", "Averiado"],
					["retired", "Retirado"],
				]}
				onChange={(v) => field("status", v as EquipmentMapItem["status"])}
			/>
			<DraftSelectField
				label="Calidad"
				value={currentValue("location_quality") as string}
				options={[
					["unknown", "Desconocida"],
					["approximate", "Aproximada"],
					["drawn", "Dibujada"],
					["gps_captured", "GPS"],
					["verified", "Verificada"],
				]}
				onChange={(v) =>
					field("location_quality", v as EquipmentMapItem["location_quality"])
				}
			/>
			{element.type === "olt" && (
				<>
					<DraftNumberField
						label="Puertos PON"
						value={currentValue("total_pon_ports") as number | null}
						onChange={(v) =>
							field("total_pon_ports", v as EquipmentMapItem["total_pon_ports"])
						}
					/>
					<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] p-3">
						<OltModelSelector
							selectedOpticalClass={
								currentValue("optical_class") as string | null
							}
							onSelect={(model) => {
								field(
									"optical_class",
									model.opticalClass as EquipmentMapItem["optical_class"],
								);
								field(
									"total_pon_ports",
									model.maxPonPorts as EquipmentMapItem["total_pon_ports"],
								);
							}}
						/>
					</div>
				</>
			)}
			{element.type === "splitter" && (
				<DraftSelectField
					label="Ratio"
					value={(currentValue("split_ratio") as string | null) ?? "1:8"}
					options={[
						["1:2", "1:2"],
						["1:4", "1:4"],
						["1:8", "1:8"],
						["1:16", "1:16"],
						["1:32", "1:32"],
						["1:64", "1:64"],
					]}
					onChange={(v) =>
						field("split_ratio", v as EquipmentMapItem["split_ratio"])
					}
				/>
			)}
			{element.type === "nap" && (
				<>
					<DraftSelectField
						label="Tipo de NAP"
						value={currentNapMode ?? "with_splitter"}
						options={[
							["terminal", NAP_MODE_LABEL.terminal],
							["with_splitter", NAP_MODE_LABEL.with_splitter],
							["prepared", NAP_MODE_LABEL.prepared],
						]}
						onChange={(v) => {
							const napMode = v as NapMode;
							setProperty("nap_mode", napMode);
							field(
								"split_ratio",
								(napMode === "with_splitter"
									? ((currentValue("split_ratio") as string | null) ?? "1:16")
									: null) as EquipmentMapItem["split_ratio"],
							);
							field(
								"insertion_loss_db",
								(napMode === "with_splitter"
									? (SPLITTER_LOSS_DB[
											(currentValue("split_ratio") as string | null) ?? "1:16"
										] ?? null)
									: null) as EquipmentMapItem["insertion_loss_db"],
							);
						}}
					/>
					<DraftSelectField
						label="Conector"
						value={napPropertyLabel(currentElement, "connector_type", "SC/APC")}
						options={[
							["SC/APC", "SC/APC"],
							["SC/UPC", "SC/UPC"],
							["Mini SC/APC", "Mini SC/APC"],
						]}
						onChange={(v) => setProperty("connector_type", v)}
					/>
					<DraftSelectField
						label="Protección"
						value={napPropertyLabel(
							currentElement,
							"protection_rating",
							"IP65",
						)}
						options={[
							["IP65", "IP65"],
							["IP68", "IP68"],
						]}
						onChange={(v) => setProperty("protection_rating", v)}
					/>
					{currentNapMode === "with_splitter" && (
						<DraftSelectField
							label="Splitter interno"
							value={(currentValue("split_ratio") as string | null) ?? "1:16"}
							options={[
								["1:8", "1:8"],
								["1:16", "1:16"],
								["1:32", "1:32"],
							]}
							onChange={(v) => {
								field("split_ratio", v as EquipmentMapItem["split_ratio"]);
								field(
									"insertion_loss_db",
									(SPLITTER_LOSS_DB[v] ??
										null) as EquipmentMapItem["insertion_loss_db"],
								);
							}}
						/>
					)}
					<DraftNumberField
						label="Puertos totales"
						value={currentValue("total_ports") as number | null}
						onChange={(v) =>
							field("total_ports", v as EquipmentMapItem["total_ports"])
						}
					/>
				</>
			)}
			<DraftTextField
				label="Referencia"
				value={(currentValue("address_reference") as string | null) ?? ""}
				onChange={(v) =>
					field(
						"address_reference",
						(v || null) as EquipmentMapItem["address_reference"],
					)
				}
			/>
			<DraftTextField
				label="Notas"
				value={(currentValue("notes") as string | null) ?? ""}
				onChange={(v) =>
					field("notes", (v || null) as EquipmentMapItem["notes"])
				}
			/>
			{isDirty && (
				<Button
					type="button"
					onClick={() => {
						onSave(patch);
						setPatch({});
					}}
					size="sm"
					className="w-full border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.14)] text-[#fbbf24] hover:bg-[rgba(245,158,11,0.24)]"
				>
					<Save className="size-3.5" aria-hidden="true" />
					Guardar cambios
				</Button>
			)}
			{isDeleting && <DeleteConfirm onConfirm={onDelete} />}
		</div>
	);
}

function ExistingRoutePanel({
	route,
	mode,
	isDeleting,
	onDelete,
	onSave,
}: {
	route: ConnectionMapItem;
	mode: EditorMode;
	isDeleting: boolean;
	onDelete: () => void;
	onSave: (patch: Partial<ConnectionMapItem>) => void;
}) {
	const [patch, setPatch] = useState<Partial<ConnectionMapItem>>({});
	const isDirty = Object.keys(patch).length > 0;
	const field = <K extends keyof ConnectionMapItem>(
		key: K,
		val: ConnectionMapItem[K],
	) => setPatch((p) => ({ ...p, [key]: val }));
	const cur = <K extends keyof ConnectionMapItem>(
		key: K,
	): ConnectionMapItem[K] =>
		(patch[key] !== undefined
			? patch[key]
			: route[key]) as ConnectionMapItem[K];

	const lengthLabel =
		route.length_meters != null
			? `${route.length_meters.toFixed(0)} m`
			: "Sin calcular";

	if (mode !== "edit") {
		return (
			<div className="space-y-3">
				<PropertyRow label="Tipo" value={route.type} />
				{route.code && <PropertyRow label="Código" value={route.code} />}
				<PropertyRow label="Estado" value={route.status} />
				<PropertyRow label="Calidad" value={route.route_quality} />
				<PropertyRow label="Longitud" value={lengthLabel} />
				<PropertyRow label="Fibra" value={route.fiber_type ?? "—"} />
				{route.total_loss_db != null && (
					<PropertyRow
						label="Pérdida medida"
						value={`${route.total_loss_db.toFixed(2)} dB`}
					/>
				)}
				<div className="h-px bg-[rgba(164,164,164,0.1)]" />
				<OpticalBudgetPanel route={route} />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<PropertyRow label="Tipo actual" value={route.type} />
			<DraftTextField
				label="Código"
				value={(cur("code") as string | null) ?? ""}
				onChange={(v) =>
					field("code", (v || null) as ConnectionMapItem["code"])
				}
			/>
			<DraftSelectField
				label="Tipo de ruta"
				value={cur("type") as string}
				options={[
					["feeder", "Feeder"],
					["distribution", "Distribution"],
					["other", "Otro"],
				]}
				onChange={(v) => field("type", v as ConnectionMapItem["type"])}
			/>
			<DraftSelectField
				label="Estado"
				value={cur("status") as string}
				options={[
					["planned", "Planificado"],
					["installed", "Instalado"],
					["active", "Activo"],
					["damaged", "Averiado"],
					["retired", "Retirado"],
				]}
				onChange={(v) => field("status", v as ConnectionMapItem["status"])}
			/>
			<DraftSelectField
				label="Fibra"
				value={(cur("fiber_type") as string | null) ?? "g652d"}
				options={[
					["g652d", "G.652D — Feeder"],
					["g657a1", "G.657A1 — Distribution"],
					["g657a2", "G.657A2 — Drop"],
				]}
				onChange={(v) =>
					field("fiber_type", v as ConnectionMapItem["fiber_type"])
				}
			/>
			<DraftNumberField
				label="Hilos"
				value={cur("fiber_count") as number | null}
				onChange={(v) =>
					field("fiber_count", v as ConnectionMapItem["fiber_count"])
				}
			/>
			<PropertyRow label="Longitud" value={lengthLabel} />
			<DraftTextField
				label="Notas"
				value={(cur("notes") as string | null) ?? ""}
				onChange={(v) =>
					field("notes", (v || null) as ConnectionMapItem["notes"])
				}
			/>
			{isDirty && (
				<Button
					type="button"
					onClick={() => {
						onSave(patch);
						setPatch({});
					}}
					size="sm"
					className="w-full border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.14)] text-[#fbbf24] hover:bg-[rgba(245,158,11,0.24)]"
				>
					<Save className="size-3.5" aria-hidden="true" />
					Guardar cambios
				</Button>
			)}
			{isDeleting && <DeleteConfirm onConfirm={onDelete} />}
		</div>
	);
}

function DeleteConfirm({ onConfirm }: { onConfirm: () => void }) {
	return (
		<div className="rounded-md border border-[rgba(251,77,109,0.28)] bg-[rgba(251,77,109,0.09)] px-3 py-2.5">
			<p className="flex items-center gap-1.5 text-xs font-semibold text-[#fb7185]">
				<Trash2 className="size-3.5" aria-hidden="true" />
				Herramienta eliminar activa
			</p>
			<p className="mt-1 text-[11px] text-[#f0b2bf]">
				Esta acción no se puede deshacer. Solo admin puede eliminar.
			</p>
			<Button
				type="button"
				onClick={onConfirm}
				variant="destructive"
				size="sm"
				className="mt-2 w-full border border-[rgba(251,77,109,0.45)] bg-[rgba(251,77,109,0.2)] text-[#fb7185] hover:bg-[rgba(251,77,109,0.3)]"
			>
				Confirmar eliminación
			</Button>
		</div>
	);
}

function PendingMutationNotice() {
	return null;
}

function DraftTextField({
	label,
	value,
	onChange,
	error,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
}) {
	const inputId = useId();

	return (
		<label className="block" htmlFor={inputId}>
			<span className="mb-1 block text-xs text-[#777879]">{label}</span>
			<Input
				id={inputId}
				type="text"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className={`h-9 bg-[rgba(27,28,29,0.82)] text-xs ${
					error
						? "border-[rgba(239,68,68,0.4)] focus-visible:border-[rgba(239,68,68,0.6)]"
						: "border-[rgba(164,164,164,0.16)]"
				}`}
			/>
			{error && (
				<span className="mt-1 block text-[10px] text-[#ef4444]">{error}</span>
			)}
		</label>
	);
}

function DraftNumberField({
	label,
	value,
	step = "1",
	onChange,
	error,
}: {
	label: string;
	value: number | null;
	step?: string;
	onChange: (value: number | null) => void;
	error?: string;
}) {
	const inputId = useId();

	return (
		<label className="block" htmlFor={inputId}>
			<span className="mb-1 block text-xs text-[#777879]">{label}</span>
			<Input
				id={inputId}
				type="number"
				step={step}
				value={value ?? ""}
				onChange={(event) =>
					onChange(
						event.target.value === "" ? null : Number(event.target.value),
					)
				}
				className={`h-9 bg-[rgba(27,28,29,0.82)] text-xs ${
					error
						? "border-[rgba(239,68,68,0.4)] focus-visible:border-[rgba(239,68,68,0.6)]"
						: "border-[rgba(164,164,164,0.16)]"
				}`}
			/>
			{error && (
				<span className="mt-1 block text-[10px] text-[#ef4444]">{error}</span>
			)}
		</label>
	);
}

function DraftSelectField({
	label,
	value,
	options,
	onChange,
	error,
}: {
	label: string;
	value: string;
	options: Array<[value: string, label: string]>;
	onChange: (value: string) => void;
	error?: string;
}) {
	return (
		<label className="block">
			<span className="mb-1 block text-xs text-[#777879]">{label}</span>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className={`w-full rounded-md border bg-[rgba(27,28,29,0.82)] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[rgba(56,189,248,0.45)] ${
					error
						? "border-[rgba(239,68,68,0.4)] focus:border-[rgba(239,68,68,0.6)]"
						: "border-[rgba(164,164,164,0.16)]"
				}`}
			>
				{options.map(([optionValue, optionLabel]) => (
					<option key={optionValue} value={optionValue}>
						{optionLabel}
					</option>
				))}
			</select>
			{error && (
				<span className="mt-1 block text-[10px] text-[#ef4444]">{error}</span>
			)}
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
			className={`absolute z-20 flex flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md ${mode !== "view" ? "bottom-28" : "bottom-16"} ${hasRightPanel ? "right-86" : "right-4"}`}
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
	mode,
	warnings,
}: {
	activeToolLabel: string;
	statusMessage: string;
	zoom: number;
	mode: EditorMode;
	warnings: string[];
}) {
	const [showWarnings, setShowWarnings] = useState(false);
	const hasWarnings = warnings.length > 0;

	return (
		<div className="absolute bottom-3 left-4 right-4 z-20 rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			{/* Warning list (expandible) */}
			{showWarnings && hasWarnings && (
				<div className="border-b border-[rgba(164,164,164,0.14)] px-3 py-2 space-y-1">
					{warnings.map((w) => (
						<p
							key={w}
							className="text-[10px] text-[#f59e0b] flex items-start gap-1.5"
						>
							<span className="shrink-0">⚠</span>
							{w}
						</p>
					))}
				</div>
			)}

			{/* Main bar */}
			<div className="flex min-h-10 items-center justify-between gap-4 px-3 py-2 text-xs text-[#a4a4a4]">
				<div className="flex min-w-0 items-center gap-2">
					<span className="shrink-0 rounded-md border border-[rgba(56,189,248,0.24)] bg-[rgba(56,189,248,0.1)] px-2 py-1 font-medium text-[#bdeafe]">
						{activeToolLabel}
					</span>
					<span className="truncate">{statusMessage}</span>
				</div>
				<div className="flex shrink-0 items-center gap-3">
					{hasWarnings && (
						<button
							type="button"
							onClick={() => setShowWarnings((v) => !v)}
							className="flex items-center gap-1.5 rounded-md border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-2 py-1 text-[11px] font-medium text-[#f59e0b] transition-colors hover:bg-[rgba(245,158,11,0.18)]"
						>
							⚠ {warnings.length}
						</button>
					)}
					<div className="hidden font-mono text-[11px] text-[#777879] sm:flex items-center gap-3">
						<span>zoom {zoom.toFixed(1)}</span>
						{mode !== "view" && <span>Esc cancela</span>}
					</div>
				</div>
			</div>
		</div>
	);
}

function ContextMenu({
	menu,
	canDelete,
	onSelect,
	onDelete,
	onClose,
}: {
	menu: { x: number; y: number; feature: SelectedFeature };
	canDelete: boolean;
	onSelect: () => void;
	onDelete: () => void;
	onClose: () => void;
}) {
	const label =
		menu.feature.kind === "element"
			? (menu.feature.element.name ?? menu.feature.element.code)
			: menu.feature.kind === "route"
				? (menu.feature.route.code ?? "Ruta")
				: menu.feature.kind === "routePoint"
					? (menu.feature.point.code ?? menu.feature.point.type)
					: "Elemento";

	useEffect(() => {
		const close = () => onClose();
		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape") close();
		});
		return () => window.removeEventListener("keydown", close);
	}, [onClose]);

	return (
		<div
			role="menu"
			className="absolute z-50 min-w-44 overflow-hidden rounded-lg border border-[rgba(164,164,164,0.2)] bg-[rgba(27,28,29,0.97)] shadow-2xl backdrop-blur-md"
			style={{ left: menu.x, top: menu.y }}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
		>
			<div className="border-b border-[rgba(164,164,164,0.12)] px-3 py-2">
				<p className="truncate text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
					{label}
				</p>
			</div>
			<div className="py-1">
				<button
					type="button"
					onClick={onSelect}
					className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#d7d7d7] transition-colors hover:bg-white/8"
				>
					Ver propiedades
				</button>
				{canDelete && (
					<button
						type="button"
						onClick={onDelete}
						className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#fb7185] transition-colors hover:bg-[rgba(251,77,109,0.12)]"
					>
						Eliminar
					</button>
				)}
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
