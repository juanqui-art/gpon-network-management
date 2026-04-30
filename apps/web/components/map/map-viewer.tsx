"use client";

import mapboxgl from "mapbox-gl";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasInternalSplitter } from "@/lib/gpon/nap-config";
import { formatMapLabel } from "@/lib/gpon/operative-code";
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
import { NapCapacity } from "./nap-capacity";
import { OpticalBudgetPanel } from "./optical-budget-panel";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	IncidentMapItem,
	RoutePoint,
} from "./types";

interface Props {
	token: string;
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	routePoints?: RoutePoint[];
	incidents?: IncidentMapItem[];
}

// ── GeoJSON builders ─────────────────────────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
	alarm: 0,
	faulty: 0,
	offline: 1,
	maintenance: 2,
	online: 3,
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

// ── Marker helpers ───────────────────────────────────────────────────────────

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

	const outer = document.createElement("div");
	outer.dataset.code = eq.code;
	outer.dataset.type = eq.type;
	outer.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    cursor: pointer;
  `;

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

// ── Zoom visibility thresholds (spec: EDITOR_UI_UX_SPEC.md §Visibilidad por zoom) ──
const ZOOM_SPLITTER = 10; // splitters appear at zoom ≥ 10
const ZOOM_NAP = 13; // NAPs appear at zoom ≥ 13
const ZOOM_DISTRIBUTION = 13; // distribution routes appear at zoom ≥ 13
const ZOOM_ROUTE_POINTS = 15; // crossing/reserve/splice appear at zoom ≥ 15

function markerVisibleAtZoom(type: string, zoom: number): boolean {
	if (type === "splitter") return zoom >= ZOOM_SPLITTER;
	if (type === "nap") return zoom >= ZOOM_NAP;
	return true; // OLT always visible
}

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

// ── Types ────────────────────────────────────────────────────────────────────

type LeftPanelTab = "filters" | "tree" | "alerts";
type SelectedFeature =
	| { kind: "element"; element: EquipmentMapItem }
	| { kind: "route"; route: ConnectionMapItem }
	| { kind: "routePoint"; point: RoutePoint };

type MarkerEntry = {
	marker: mapboxgl.Marker;
	outerEl: HTMLElement;
	type: string;
	status: string;
};

// ── Filter & legend helpers ──────────────────────────────────────────────────

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
	{ value: "unknown", label: "Desconocido", color: STATUS_COLOR.unknown },
];

const LEGEND_TYPES = [
	[TYPE_COLOR.olt, "OLT"],
	[TYPE_COLOR.splitter, "Splitter"],
	[TYPE_COLOR.nap, "NAP"],
	[TYPE_COLOR.ont, "ONT"],
];

const LEGEND_STATUS = [
	[STATUS_COLOR.online, "En línea"],
	[STATUS_COLOR.alarm, "Alarma"],
	[STATUS_COLOR.offline, "Fuera de línea"],
	[STATUS_COLOR.maintenance, "Mantenimiento"],
	[STATUS_COLOR.unknown, "Desconocido"],
];

const LEGEND_CABLES: Array<[color: string, label: string, dashed: boolean]> = [
	[CABLE_COLOR.feeder, "Feeder", false],
	[CABLE_COLOR.distribution, "Distribution", true],
];

// ── Main component ──────────────────────────────────────────────────────────

export function MapViewer({
	token,
	equipment,
	connections,
	routePoints = [],
	incidents = [],
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<Map<string, MarkerEntry>>(new Map());

	const [selectedFeature, setSelectedFeature] =
		useState<SelectedFeature | null>(null);
	const [filterType, setFilterType] = useState<string>("all");
	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [leftTab, setLeftTab] = useState<LeftPanelTab>("filters");

	const incidentByEquipment = Object.fromEntries(
		incidents.map((inc) => [inc.equipment_id, inc]),
	);

	// Compute warnings
	const mapWarnings: string[] = [];

	// Filter helpers
	const visibleEquipment = equipment.filter((eq) => {
		if (filterType !== "all" && eq.type !== filterType) return false;
		if (filterStatus !== "all" && eq.status !== filterStatus) return false;
		return true;
	});

	const visibleConnections = connections.filter((conn) => {
		const fromEq = equipment.find((e) => e.id === conn.from_equipment_id);
		const toEq = equipment.find((e) => e.id === conn.to_equipment_id);
		if (!fromEq || !toEq) return false;
		if (filterType !== "all") {
			if (fromEq.type !== filterType && toEq.type !== filterType) return false;
		}
		if (filterStatus !== "all") {
			if (fromEq.status !== filterStatus && toEq.status !== filterStatus)
				return false;
		}
		return true;
	});

	const routePointCount = routePoints.length;
	const visibleEquipmentRef = useRef(visibleEquipment);
	const visibleConnectionsRef = useRef(visibleConnections);
	const routePointsRef = useRef(routePoints);
	visibleEquipmentRef.current = visibleEquipment;
	visibleConnectionsRef.current = visibleConnections;
	routePointsRef.current = routePoints;

	// Map initialization & updates
	useEffect(() => {
		if (!containerRef.current) return;

		const map = new mapboxgl.Map({
			container: containerRef.current,
			style: MAP_STYLE,
			center: DEFAULT_CENTER,
			zoom: DEFAULT_ZOOM,
			accessToken: token,
		});

		mapRef.current = map;

		// Silence noise layers
		map.on("load", () => {
			for (const layer of NOISE_LAYERS) {
				if (map.getLayer(layer)) {
					map.setLayoutProperty(layer, "visibility", "none");
				}
			}

			// Add route lines layer
			map.addSource("routes-source", {
				type: "geojson",
				data: buildConnectionsGeoJSON(
					visibleConnectionsRef.current,
					visibleEquipmentRef.current,
				),
			});

			// Casing — dark outline behind lines for contrast on dark map
			// zoom must be top-level; match inside stop values (camera+data expression)
			map.addLayer({
				id: "route-lines-casing",
				type: "line",
				source: "routes-source",
				paint: {
					"line-width": 5,
					"line-color": "rgba(0,0,0,0.55)",
					"line-opacity": [
						"interpolate",
						["linear"],
						["zoom"],
						ZOOM_DISTRIBUTION - 0.5,
						["match", ["get", "cable_type"], "distribution", 0, 1],
						ZOOM_DISTRIBUTION,
						1,
					],
				},
			});

			// Main route lines
			map.addLayer({
				id: "route-lines",
				type: "line",
				source: "routes-source",
				paint: {
					"line-width": 3,
					"line-color": [
						"match",
						["get", "cable_type"],
						"feeder",
						CABLE_COLOR.feeder,
						"distribution",
						CABLE_COLOR.distribution,
						CABLE_COLOR.default,
					],
					"line-opacity": [
						"interpolate",
						["linear"],
						["zoom"],
						ZOOM_DISTRIBUTION - 0.5,
						["match", ["get", "cable_type"], "distribution", 0, 1],
						ZOOM_DISTRIBUTION,
						1,
					],
					"line-dasharray": [
						"match",
						["get", "cable_type"],
						"distribution",
						["literal", [2, 1.5]],
						["literal", [1, 0]],
					],
				},
			});

			// Add route points layer
			map.addSource("route-points-source", {
				type: "geojson",
				data: buildRoutePointsGeoJSON(routePointsRef.current),
			});

			map.addLayer({
				id: "route-points",
				type: "circle",
				source: "route-points-source",
				layout: {
					visibility: "none", // hidden until zoom >= ZOOM_ROUTE_POINTS
				},
				paint: {
					"circle-radius": 4,
					"circle-color": [
						"match",
						["get", "type"],
						"crossing",
						ROUTE_POINT_COLOR.crossing,
						"reserve",
						ROUTE_POINT_COLOR.reserve,
						"splice",
						ROUTE_POINT_COLOR.splice,
						"#ccc",
					],
					"circle-opacity": 0.8,
				},
			});
		});

		// Zoom listener — progressive visibility
		const onZoom = () => {
			const z = map.getZoom();

			// Markers
			markersRef.current.forEach((entry) => {
				const visible = markerVisibleAtZoom(entry.type, z);
				entry.outerEl.style.visibility = visible ? "visible" : "hidden";
				if (visible) setMarkerZoomScale(entry.outerEl, entry.type, z);
			});

			// Route points (lines are handled by Mapbox opacity expressions)
			if (map.getLayer("route-points"))
				map.setLayoutProperty(
					"route-points",
					"visibility",
					z >= ZOOM_ROUTE_POINTS ? "visible" : "none",
				);
		};

		map.on("zoom", onZoom);

		// Click handler
		const onClick = (e: mapboxgl.MapMouseEvent) => {
			// Try to click an element
			const elemFeature = map.queryRenderedFeatures(e.point).find((f) => {
				const sourceId = f.source;
				return sourceId === "equipment-markers";
			});

			if (elemFeature) {
				const eq = visibleEquipmentRef.current.find(
					(e) => e.id === elemFeature.id,
				);
				if (eq) {
					setSelectedFeature({ kind: "element", element: eq });
					return;
				}
			}

			// Try to click a route
			const routeFeature = map.queryRenderedFeatures(e.point).find((f) => {
				return f.source === "routes-source";
			});

			if (routeFeature?.properties?.connection_id) {
				const connectionId = routeFeature.properties.connection_id;
				const route = visibleConnectionsRef.current.find(
					(r) => r.id === connectionId,
				);
				if (route) {
					setSelectedFeature({ kind: "route", route });
					return;
				}
			}

			// Try to click a route point
			const pointFeature = map.queryRenderedFeatures(e.point).find((f) => {
				return f.source === "route-points-source";
			});

			if (pointFeature?.properties?.route_point_id) {
				const pointId = pointFeature.properties.route_point_id;
				const point = routePointsRef.current.find((p) => p.id === pointId);
				if (point) {
					setSelectedFeature({ kind: "routePoint", point });
					return;
				}
			}
		};

		map.on("click", onClick);

		return () => {
			map.off("zoom", onZoom);
			map.off("click", onClick);
			map.remove();
			mapRef.current = null;
		};
	}, [token]);

	// Update markers when equipment or filter changes
	useEffect(() => {
		if (!mapRef.current) return;
		const map = mapRef.current;

		for (const entry of markersRef.current.values()) entry.marker.remove();
		markersRef.current.clear();

		const z = map.getZoom();
		visibleEquipment.forEach((eq) => {
			const incident = incidentByEquipment[eq.id] ?? null;
			const markerEl = createMarkerEl(eq, incident);
			const marker = new mapboxgl.Marker({ element: markerEl })
				.setLngLat([eq.lng, eq.lat])
				.addTo(map);

			const wrapper = markerEl.querySelector(
				'[data-role="wrapper"]',
			) as HTMLElement;
			wrapper?.addEventListener("click", () => {
				setSelectedFeature({ kind: "element", element: eq });
			});

			markersRef.current.set(eq.id, {
				marker,
				outerEl: markerEl,
				type: eq.type,
				status: eq.status,
			});

			const visible = markerVisibleAtZoom(eq.type, z);
			markerEl.style.visibility = visible ? "visible" : "hidden";
			if (visible) setMarkerZoomScale(markerEl, eq.type, z);
		});
	}, [visibleEquipment, incidentByEquipment]);

	// Update GeoJSON when connections/points change
	useEffect(() => {
		if (!mapRef.current) return;
		const map = mapRef.current;

		const source = map.getSource("routes-source") as
			| mapboxgl.GeoJSONSource
			| undefined;
		if (source) {
			source.setData(
				buildConnectionsGeoJSON(visibleConnections, visibleEquipment),
			);
		}
	}, [visibleConnections, visibleEquipment]);

	useEffect(() => {
		if (!mapRef.current) return;
		const source = mapRef.current.getSource("route-points-source") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(buildRoutePointsGeoJSON(routePoints));
	}, [routePoints]);

	return (
		<div ref={containerRef} className="relative h-full w-full bg-[#1b1c1d]">
			<style>{`
            @keyframes gpon-pulse {
              0% { transform: scale(1); opacity: 0.35; }
              100% { transform: scale(1.8); opacity: 0; }
            }
          `}</style>

			{/* Left panel — floats over the map, top-left */}
			<div className="absolute top-4 left-4 z-20">
				<LeftPanel
					tab={leftTab}
					onTabChange={setLeftTab}
					filterType={filterType}
					filterStatus={filterStatus}
					onTypeChange={setFilterType}
					onStatusChange={setFilterStatus}
					equipment={visibleEquipment}
					connections={visibleConnections}
					routePointCount={routePointCount}
					warnings={mapWarnings}
				/>
			</div>

			{/* Controls + legend — bottom-right */}
			<div className="absolute right-4 bottom-4 z-20 flex flex-col items-end gap-2">
				<Legend />
				<MapControls
					onZoomIn={() => mapRef.current?.zoomIn()}
					onZoomOut={() => mapRef.current?.zoomOut()}
					onResetNorth={() => mapRef.current?.resetNorth()}
					onFit={() => {
						const map = mapRef.current;
						if (!map || visibleEquipment.length === 0) return;
						const bounds = new mapboxgl.LngLatBounds();
						for (const eq of visibleEquipment) bounds.extend([eq.lng, eq.lat]);
						map.fitBounds(bounds, {
							padding: 120,
							maxZoom: 15,
							duration: 650,
						});
					}}
				/>
			</div>

			{selectedFeature && (
				<RightPanel
					feature={selectedFeature}
					equipment={equipment}
					onClose={() => setSelectedFeature(null)}
				/>
			)}
		</div>
	);
}

// ── Left Panel ───────────────────────────────────────────────────────────────

interface LeftPanelProps {
	tab: LeftPanelTab;
	onTabChange: (tab: LeftPanelTab) => void;
	filterType: string;
	filterStatus: string;
	onTypeChange: (type: string) => void;
	onStatusChange: (status: string) => void;
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	routePointCount: number;
	warnings: string[];
}

function LeftPanel({
	tab,
	onTabChange,
	filterType,
	filterStatus,
	onTypeChange,
	onStatusChange,
	equipment,
	connections,
	routePointCount,
	warnings,
}: LeftPanelProps) {
	const typeFilterId = "map-type-filter";
	const statusFilterId = "map-status-filter";

	return (
		<div className="w-64 rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] flex flex-col max-h-[calc(100%-2rem)] shadow-2xl backdrop-blur-md overflow-hidden">
			<Tabs
				value={tab}
				onValueChange={(v) => onTabChange(v as LeftPanelTab)}
				className="flex flex-col flex-1 min-h-0"
			>
				<TabsList className="w-full rounded-none border-b border-[rgba(164,164,164,0.12)] bg-transparent p-0 shrink-0">
					<TabsTrigger
						value="filters"
						className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#38bdf8]"
					>
						Filtros
					</TabsTrigger>
					<TabsTrigger
						value="tree"
						className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#38bdf8]"
					>
						Árbol
					</TabsTrigger>
					<TabsTrigger
						value="alerts"
						className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#38bdf8]"
					>
						Alertas
					</TabsTrigger>
				</TabsList>

				<ScrollArea className="flex-1 min-h-0">
					<TabsContent value="filters" className="space-y-4 p-4">
						<div>
							<label
								htmlFor={typeFilterId}
								className="block text-xs font-semibold text-[#a4a4a4] mb-2"
							>
								Tipo
							</label>
							<select
								id={typeFilterId}
								value={filterType}
								onChange={(e) => onTypeChange(e.target.value)}
								className="w-full rounded px-2 py-1 text-sm bg-[rgba(164,164,164,0.08)] border border-[rgba(164,164,164,0.18)] text-[#d7d7d7]"
							>
								{TYPE_FILTERS.map((f) => (
									<option key={f.value} value={f.value}>
										{f.label}
									</option>
								))}
							</select>
						</div>

						<div>
							<label
								htmlFor={statusFilterId}
								className="block text-xs font-semibold text-[#a4a4a4] mb-2"
							>
								Estado
							</label>
							<select
								id={statusFilterId}
								value={filterStatus}
								onChange={(e) => onStatusChange(e.target.value)}
								className="w-full rounded px-2 py-1 text-sm bg-[rgba(164,164,164,0.08)] border border-[rgba(164,164,164,0.18)] text-[#d7d7d7]"
							>
								{STATUS_FILTERS.map((f) => (
									<option key={f.value} value={f.value}>
										{f.label}
									</option>
								))}
							</select>
						</div>

						<div className="space-y-2 text-xs text-[#a4a4a4]">
							<div className="flex justify-between">
								<span>OLTs:</span>
								<span className="font-semibold">
									{equipment.filter((e) => e.type === "olt").length}
								</span>
							</div>
							<div className="flex justify-between">
								<span>Splitters:</span>
								<span className="font-semibold">
									{equipment.filter((e) => e.type === "splitter").length}
								</span>
							</div>
							<div className="flex justify-between">
								<span>NAPs:</span>
								<span className="font-semibold">
									{equipment.filter((e) => e.type === "nap").length}
								</span>
							</div>
							<div className="flex justify-between border-t border-[rgba(164,164,164,0.12)] pt-2 mt-2">
								<span>Rutas:</span>
								<span className="font-semibold">{connections.length}</span>
							</div>
							<div className="flex justify-between">
								<span>Puntos ruta:</span>
								<span className="font-semibold">{routePointCount}</span>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="tree" className="space-y-2 p-4">
						<NetworkTree equipment={equipment} connections={connections} />
					</TabsContent>

					<TabsContent value="alerts" className="space-y-2 p-4">
						{warnings.length === 0 ? (
							<p className="text-xs text-[#777879]">Sin alertas</p>
						) : (
							warnings.map((w) => (
								<div
									key={w}
									className="flex gap-2 rounded-md bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] p-2 text-xs text-[#f59e0b]"
								>
									<AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
									<span>{w}</span>
								</div>
							))
						)}
					</TabsContent>
				</ScrollArea>
			</Tabs>
		</div>
	);
}

// ── Network Tree ─────────────────────────────────────────────────────────────

interface NetworkTreeProps {
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
}

function NetworkTree({ equipment, connections }: NetworkTreeProps) {
	const olts = equipment.filter((e) => e.type === "olt");

	if (olts.length === 0) {
		return <p className="text-xs text-[#777879]">Sin OLTs</p>;
	}

	return (
		<div className="space-y-2">
			{olts.map((olt) => (
				<OltNode
					key={olt.id}
					olt={olt}
					equipment={equipment}
					connections={connections}
				/>
			))}
		</div>
	);
}

interface OltNodeProps {
	olt: EquipmentMapItem;
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
}

function OltNode({ olt, equipment, connections }: OltNodeProps) {
	const [expanded, setExpanded] = useState(true);

	const children = equipment.filter((e) =>
		connections.some(
			(c) => c.from_element_id === olt.id && c.to_element_id === e.id,
		),
	);

	const typeColor = TYPE_COLOR[olt.type] ?? TYPE_COLOR.unknown;

	return (
		<div className="space-y-1">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-2 w-full text-left p-1 rounded hover:bg-[rgba(164,164,164,0.08)] text-xs"
			>
				{children.length > 0 &&
					(expanded ? (
						<ChevronDown className="size-3" />
					) : (
						<ChevronRight className="size-3" />
					))}
				<div
					className="size-2 rounded-full shrink-0"
					style={{ backgroundColor: typeColor }}
				/>
				<span className="truncate font-mono text-[#d7d7d7]">{olt.code}</span>
			</button>

			{expanded && children.length > 0 && (
				<div className="ml-4 space-y-1 border-l border-[rgba(164,164,164,0.12)]">
					{children.map((child) => (
						<div key={child.id} className="pl-2 py-1 text-xs">
							<div className="flex items-center gap-2">
								<div
									className="size-1.5 rounded-full"
									style={{ backgroundColor: TYPE_COLOR[child.type] ?? "#ccc" }}
								/>
								<span className="truncate font-mono text-[#a4a4a4]">
									{child.code}
								</span>
								{child.type === "nap" && child.ports_used !== undefined && (
									<span className="text-[#777879] ml-auto shrink-0">
										{child.ports_used}/{child.total_ports}
									</span>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ── Right Panel (Properties) ─────────────────────────────────────────────────

interface RightPanelProps {
	feature: SelectedFeature;
	equipment: EquipmentMapItem[];
	onClose: () => void;
}

function RightPanel({ feature, equipment, onClose }: RightPanelProps) {
	const typeColor =
		feature.kind === "element"
			? (TYPE_COLOR[feature.element.type] ?? TYPE_COLOR.unknown)
			: feature.kind === "route"
				? (CABLE_COLOR[feature.route.cable_type ?? "default"] ??
					CABLE_COLOR.default)
				: (ROUTE_POINT_COLOR[feature.point.type] ?? "#ccc");

	const title =
		feature.kind === "element"
			? feature.element.name || feature.element.code
			: feature.kind === "route"
				? feature.route.code || "Ruta"
				: feature.point.code || feature.point.type;

	return (
		<div className="absolute right-4 top-4 z-20 flex max-h-[calc(100%-2rem)] w-80 flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			<div className="h-1 w-full" style={{ backgroundColor: typeColor }} />

			<div className="border-b border-[rgba(164,164,164,0.12)] px-4 py-3">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-sm font-semibold text-[#e6e6e6] truncate">
							{title}
						</p>
						<p className="text-xs text-[#777879] mt-0.5">
							{feature.kind === "element"
								? `${feature.element.type.toUpperCase()} · ${feature.element.status}`
								: feature.kind === "route"
									? `Ruta · ${feature.route.type}`
									: feature.point.type}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded p-1 hover:bg-[rgba(164,164,164,0.1)]"
					>
						<X className="size-4 text-[#a4a4a4]" />
					</button>
				</div>
			</div>

			<ScrollArea className="flex-1 p-4">
				{feature.kind === "element" && (
					<ElementProperties element={feature.element} />
				)}
				{feature.kind === "route" && (
					<RouteProperties route={feature.route} equipment={equipment} />
				)}
				{feature.kind === "routePoint" && (
					<RoutePointProperties point={feature.point} />
				)}
			</ScrollArea>
		</div>
	);
}

interface ElementPropertiesProps {
	element: EquipmentMapItem;
}

function ElementProperties({ element }: ElementPropertiesProps) {
	return (
		<div className="space-y-3 text-sm">
			<PropertyRow label="Tipo" value={element.type.toUpperCase()} />
			<PropertyRow label="Estado" value={element.status} />
			<PropertyRow label="Código" value={element.code} />
			<PropertyRow
				label="Posición"
				value={`${element.lat.toFixed(5)}, ${element.lng.toFixed(5)}`}
			/>
			<PropertyRow label="Calidad" value={element.location_quality} />

			{element.type === "nap" && element.total_ports && (
				<div className="border-t border-[rgba(164,164,164,0.12)] pt-3 mt-3">
					<NapCapacity element={element} />
				</div>
			)}

			{element.notes && (
				<div className="pt-3 border-t border-[rgba(164,164,164,0.12)]">
					<p className="text-xs text-[#777879] mb-1">Notas</p>
					<p className="text-xs text-[#d7d7d7]">{element.notes}</p>
				</div>
			)}
		</div>
	);
}

interface RoutePropertiesProps {
	route: ConnectionMapItem;
	equipment: EquipmentMapItem[];
}

function RouteProperties({ route, equipment }: RoutePropertiesProps) {
	const from = equipment.find((e) => e.id === route.from_equipment_id);
	const to = equipment.find((e) => e.id === route.to_equipment_id);

	return (
		<div className="space-y-3 text-sm">
			<PropertyRow label="Tipo" value={route.cable_type ?? "N/A"} />
			<PropertyRow label="Fibra" value={route.fiber_type || "N/A"} />
			<PropertyRow
				label="Longitud"
				value={
					route.length_meters
						? `${route.length_meters.toFixed(0)} m`
						: "Sin medir"
				}
			/>

			<div className="border-t border-[rgba(164,164,164,0.12)] pt-3 mt-3">
				<p className="text-xs text-[#777879] mb-2">Conexión</p>
				<div className="text-xs space-y-1">
					<div className="text-[#a4a4a4]">
						{from ? `De: ${from.code}` : "De: Desconocido"}
					</div>
					<div className="text-[#a4a4a4]">
						{to ? `A: ${to.code}` : "A: Desconocido"}
					</div>
				</div>
			</div>

			<div className="border-t border-[rgba(164,164,164,0.12)] pt-3 mt-3">
				<OpticalBudgetPanel route={route} />
			</div>

			{route.notes && (
				<div className="pt-3 border-t border-[rgba(164,164,164,0.12)]">
					<p className="text-xs text-[#777879] mb-1">Notas</p>
					<p className="text-xs text-[#d7d7d7]">{route.notes}</p>
				</div>
			)}
		</div>
	);
}

interface RoutePointPropertiesProps {
	point: RoutePoint;
}

function RoutePointProperties({ point }: RoutePointPropertiesProps) {
	return (
		<div className="space-y-3 text-sm">
			<PropertyRow label="Tipo" value={point.type} />
			<PropertyRow label="Código" value={point.code || "Sin código"} />
			<PropertyRow label="Estado" value={point.status || "Pendiente"} />
			<PropertyRow label="Calidad" value={point.location_quality} />

			{point.type === "reserve" && (
				<PropertyRow
					label="Longitud reserva"
					value={
						point.reserve_length_m
							? `${point.reserve_length_m.toFixed(0)} m`
							: "Pendiente"
					}
				/>
			)}

			{point.type === "splice" && (
				<PropertyRow
					label="Pérdida"
					value={
						point.splice_loss_db
							? `${point.splice_loss_db.toFixed(2)} dB`
							: "Pendiente"
					}
				/>
			)}

			{point.type === "crossing" && (
				<>
					<PropertyRow
						label="Cruce"
						value={point.crossing_type || "Pendiente"}
					/>
					<PropertyRow label="Riesgo" value={point.risk_level || "Pendiente"} />
				</>
			)}

			<PropertyRow
				label="Posición"
				value={`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
			/>

			{point.notes && (
				<div className="pt-3 border-t border-[rgba(164,164,164,0.12)]">
					<p className="text-xs text-[#777879] mb-1">Notas</p>
					<p className="text-xs text-[#d7d7d7]">{point.notes}</p>
				</div>
			)}
		</div>
	);
}

function PropertyRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex justify-between text-xs">
			<span className="text-[#777879]">{label}</span>
			<span className="text-[#d7d7d7] font-mono">{value}</span>
		</div>
	);
}

// ── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
	return (
		<div className="select-none rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.9)] p-3 text-xs text-[#d7d7d7] backdrop-blur-md">
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

// ── Map Controls ─────────────────────────────────────────────────────────────

interface MapControlsProps {
	onZoomIn: () => void;
	onZoomOut: () => void;
	onResetNorth: () => void;
	onFit: () => void;
}

function MapControls({
	onZoomIn,
	onZoomOut,
	onResetNorth,
	onFit,
}: MapControlsProps) {
	return (
		<div className="flex flex-row overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
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

interface MapControlButtonProps {
	label: string;
	onClick: () => void;
	children: ReactNode;
}

function MapControlButton({ label, onClick, children }: MapControlButtonProps) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			className="flex h-9 w-9 items-center justify-center border-r border-[rgba(164,164,164,0.12)] font-mono text-xs font-semibold text-[#d7d7d7] transition-colors last:border-r-0 hover:bg-white/10"
		>
			{children}
		</button>
	);
}
