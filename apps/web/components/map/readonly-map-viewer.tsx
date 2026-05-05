"use client";

import {
	AlertTriangle,
	ChevronDown,
	ChevronRight,
	Compass,
	Crosshair,
	Layers,
	Minus,
	Network,
	Plus,
	Siren,
	X,
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import type {
	KeyboardEvent,
	ReactNode,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
	ContextMenu,
	type ContextMenuOption,
} from "@/components/map/context-menu";
import { LogicalDiagram } from "@/components/map/logical-diagram/diagram";
import { layoutTree } from "@/components/map/logical-diagram/layout-engine";
import { buildNetworkTree } from "@/components/map/logical-diagram/tree-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	NAP_MODE_LABEL,
	type NapMode,
	napPropertyLabel,
} from "@/lib/gpon/nap-config";
import {
	OPTICAL_STATUS_BG,
	OPTICAL_STATUS_COLOR,
	type PonClass,
} from "@/lib/gpon/optical-budget";
import {
	CABLE_LABEL,
	ROUTE_POINT_COLOR,
	ROUTE_POINT_LABEL,
	STATUS_COLOR,
	TYPE_COLOR,
} from "@/lib/map/palette";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE } from "@/lib/mapbox/config";
import { DataQualityBadge } from "./data-quality-badge";
import {
	addEquipmentSourceAndLayers,
	buildEquipmentGeoJson,
	readonlyEquipmentZoomFilters,
	setEquipmentLayersFilter,
} from "./equipment-layers";
import { FIBER_RENDER_COLOR, hideNoisyMapLabels } from "./mapbox-shared-style";
import { NapCapacity } from "./nap-capacity";
import { OpticalBudgetPanel } from "./optical-budget-panel";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	FiberRoute,
	IncidentMapItem,
	InfrastructureElement,
	RoutePoint,
} from "./types";

interface ReadonlyMapViewerProps {
	token: string;
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	routePoints?: RoutePoint[];
	incidents?: IncidentMapItem[];
	warnings?: string[];
}

type LeftPanelTab = "layers" | "tree" | "alerts";
type SelectedFeature =
	| { kind: "element"; element: EquipmentMapItem }
	| { kind: "route"; route: ConnectionMapItem }
	| { kind: "routePoint"; point: RoutePoint };

const TYPE_FILTERS = [
	{ value: "all", label: "Todos" },
	{ value: "olt", label: "OLT" },
	{ value: "splitter", label: "Splitter" },
	{ value: "nap", label: "NAP" },
	{ value: "ont", label: "ONT" },
];

const STATUS_FILTERS = [
	{ value: "all", label: "Todos", color: undefined },
	{ value: "online", label: "En línea", color: STATUS_COLOR.online },
	{ value: "alarm", label: "Alarma", color: STATUS_COLOR.alarm },
	{ value: "offline", label: "Fuera de línea", color: STATUS_COLOR.offline },
	{
		value: "maintenance",
		label: "Mantenimiento",
		color: STATUS_COLOR.maintenance,
	},
];

const TYPE_LABEL: Record<string, string> = {
	olt: "OLT",
	splitter: "Splitter",
	nap: "NAP",
	ont: "ONT",
	amplifier: "Amplificador",
	wdm: "WDM",
	unknown: "Equipo",
};

const STATUS_LABEL: Record<string, string> = {
	online: "En linea",
	active: "Activo",
	planned: "Planificado",
	installed: "Instalado",
	inactive: "Inactivo",
	faulty: "Con falla",
	alarm: "Alarma",
	damaged: "Danado",
	offline: "Fuera de linea",
	maintenance: "Mantenimiento",
	retired: "Retirado",
	decommissioned: "Dado de baja",
	unknown: "Desconocido",
};

const DATA_QUALITY_LABEL: Record<string, string> = {
	unknown: "Desconocida",
	approximate: "Aproximada",
	drawn: "Dibujada",
	gps_captured: "GPS",
	verified: "Verificada",
};

const INSTALLATION_LABEL: Record<string, string> = {
	aerial: "Aerea",
	underground: "Subterranea",
	duct: "Ducto",
	facade: "Fachada",
};

const FIBER_TYPE_LABEL: Record<string, string> = {
	g652d: "G.652.D",
	g657a1: "G.657.A1",
	g657a2: "G.657.A2",
};

const ZOOM_ROUTE_POINTS = 15;
const UNIFILAR_DEFAULT_HEIGHT = 420;
const UNIFILAR_MIN_HEIGHT = 260;
const UNIFILAR_MAX_HEIGHT = 760;
const UNIFILAR_MIN_MAP_HEIGHT = 220;

export function ReadonlyMapViewer({
	token,
	equipment,
	connections,
	routePoints = [],
	incidents = [],
	warnings = [],
}: ReadonlyMapViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const visibleEquipmentRef = useRef<EquipmentMapItem[]>([]);
	const visibleConnectionsRef = useRef<ConnectionMapItem[]>([]);
	const routePointsRef = useRef<RoutePoint[]>(routePoints);

	const [isMapReady, setIsMapReady] = useState(false);
	const [selectedFeature, setSelectedFeature] =
		useState<SelectedFeature | null>(null);
	const [filterType, setFilterType] = useState("all");
	const [filterStatus, setFilterStatus] = useState("all");
	const [leftTab, setLeftTab] = useState<LeftPanelTab>("layers");
	const [selectedDiagramRoot, setSelectedDiagramRoot] =
		useState<EquipmentMapItem | null>(null);
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		element: EquipmentMapItem;
	} | null>(null);

	const equipmentById = useMemo(
		() => new Map(equipment.map((item) => [item.id, item])),
		[equipment],
	);
	const incidentsByEquipment = useMemo(
		() => new Map(incidents.map((item) => [item.equipment_id, item])),
		[incidents],
	);

	const visibleEquipment = useMemo(
		() =>
			equipment.filter((item) => {
				if (filterType !== "all" && item.type !== filterType) return false;
				if (filterStatus !== "all" && item.status !== filterStatus)
					return false;
				return true;
			}),
		[equipment, filterStatus, filterType],
	);

	const visibleEquipmentIds = useMemo(
		() => new Set(visibleEquipment.map((item) => item.id)),
		[visibleEquipment],
	);

	const visibleConnections = useMemo(
		() =>
			connections.filter((connection) => {
				if (connection.geojson_coordinates.length < 2) return false;
				if (filterType === "all" && filterStatus === "all") return true;

				return (
					visibleEquipmentIds.has(connection.from_equipment_id) ||
					visibleEquipmentIds.has(connection.to_equipment_id)
				);
			}),
		[connections, filterStatus, filterType, visibleEquipmentIds],
	);

	const mapWarnings = useMemo(
		() => [
			...warnings,
			...buildDataWarnings(equipment, connections, routePoints),
		],
		[connections, equipment, routePoints, warnings],
	);

	const counts = useMemo(
		() => ({
			olts: visibleEquipment.filter((item) => item.type === "olt").length,
			splitters: visibleEquipment.filter((item) => item.type === "splitter")
				.length,
			naps: visibleEquipment.filter((item) => item.type === "nap").length,
			onts: visibleEquipment.filter((item) => item.type === "ont").length,
			routes: visibleConnections.length,
			routePoints: routePoints.length,
			saturatedNaps: visibleEquipment.filter(
				(e) =>
					e.type === "nap" &&
					e.total_ports != null &&
					(e.ports_used ?? 0) >= e.total_ports,
			).length,
			totalKm:
				visibleConnections.reduce((sum, c) => sum + (c.length_meters ?? 0), 0) /
				1000,
		}),
		[routePoints.length, visibleConnections, visibleEquipment],
	);

	visibleEquipmentRef.current = visibleEquipment;
	visibleConnectionsRef.current = visibleConnections;
	routePointsRef.current = routePoints;

	useEffect(() => {
		if (!containerRef.current) return;

		const map = new mapboxgl.Map({
			accessToken: token,
			center: DEFAULT_CENTER,
			container: containerRef.current,
			style: MAP_STYLE,
			zoom: DEFAULT_ZOOM,
		});

		mapRef.current = map;

		const forceResize = () => {
			map.resize();
		};
		const resizeFrame = () => {
			requestAnimationFrame(() => {
				forceResize();
				requestAnimationFrame(forceResize);
			});
		};
		const resizeObserver = new ResizeObserver(() => {
			resizeFrame();
		});
		resizeObserver.observe(containerRef.current);

		map.on("load", () => {
			resizeFrame();

			hideNoisyMapLabels(map);

			map.addSource("readonly-routes", {
				type: "geojson",
				data: buildRoutesGeoJson(
					visibleConnectionsRef.current,
					visibleEquipmentRef.current,
				),
			});

			map.addLayer({
				id: "readonly-routes-halo",
				type: "line",
				source: "readonly-routes",
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": "rgba(15,23,42,0.82)",
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						9,
						4.4,
						14,
						7.2,
						18,
						10.2,
					],
					"line-opacity": 0.78,
					"line-blur": 0.2,
					"line-emissive-strength": 0.35,
				},
			});

			map.addLayer({
				id: "readonly-routes-glow",
				type: "line",
				source: "readonly-routes",
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": [
						"match",
						["get", "cable_type"],
						"feeder",
						FIBER_RENDER_COLOR.feeder,
						"distribution",
						FIBER_RENDER_COLOR.distribution,
						"drop",
						FIBER_RENDER_COLOR.drop,
						FIBER_RENDER_COLOR.default,
					],
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						9,
						[
							"match",
							["get", "cable_type"],
							"feeder",
							3.8,
							"distribution",
							3.2,
							"drop",
							2.6,
							3,
						],
						14,
						[
							"match",
							["get", "cable_type"],
							"feeder",
							6.2,
							"distribution",
							5.2,
							"drop",
							4.3,
							4.8,
						],
						18,
						[
							"match",
							["get", "cable_type"],
							"feeder",
							9.2,
							"distribution",
							7.8,
							"drop",
							6.4,
							7,
						],
					],
					"line-opacity": 0.48,
					"line-blur": 1.6,
					"line-emissive-strength": 0.75,
				},
			});

			map.addLayer({
				id: "readonly-routes-line",
				type: "line",
				source: "readonly-routes",
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": [
						"match",
						["get", "cable_type"],
						"feeder",
						FIBER_RENDER_COLOR.feeder,
						"distribution",
						FIBER_RENDER_COLOR.distribution,
						"drop",
						FIBER_RENDER_COLOR.drop,
						FIBER_RENDER_COLOR.default,
					],
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						9,
						[
							"match",
							["get", "cable_type"],
							"feeder",
							2,
							"distribution",
							1.7,
							"drop",
							1.4,
							1.6,
						],
						14,
						[
							"match",
							["get", "cable_type"],
							"feeder",
							3.4,
							"distribution",
							2.9,
							"drop",
							2.3,
							2.6,
						],
						18,
						[
							"match",
							["get", "cable_type"],
							"feeder",
							5.2,
							"distribution",
							4.4,
							"drop",
							3.5,
							3.9,
						],
					],
					"line-dasharray": [
						"match",
						["get", "cable_type"],
						"distribution",
						["literal", [2.2, 1.15]],
						"drop",
						["literal", [1.2, 1.25]],
						["literal", [1, 0]],
					],
					"line-opacity": 1,
					"line-emissive-strength": 0.85,
				},
			});

			map.addSource("readonly-route-points", {
				type: "geojson",
				data: buildRoutePointsGeoJson(routePointsRef.current),
			});

			map.addLayer({
				id: "readonly-route-points",
				type: "circle",
				source: "readonly-route-points",
				layout: { visibility: "none" },
				paint: {
					"circle-color": [
						"match",
						["get", "type"],
						"crossing",
						ROUTE_POINT_COLOR.crossing,
						"reserve",
						ROUTE_POINT_COLOR.reserve,
						"splice",
						ROUTE_POINT_COLOR.splice,
						"#d7d7d7",
					],
					"circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 6],
					"circle-stroke-color": "#1b1c1d",
					"circle-stroke-width": 1.5,
				},
			});

			void addEquipmentSourceAndLayers({
				map,
				sourceId: "readonly-equipment",
				layerPrefix: "readonly",
				data: buildEquipmentGeoJson(
					visibleEquipmentRef.current,
					incidentsByEquipment,
				),
			});

			setIsMapReady(true);
			requestAnimationFrame(() => {
				forceResize();
				fitToEquipment(map, visibleEquipmentRef.current, false);
				updateMapVisibility(map);
			});
		});

		const onZoom = () => updateMapVisibility(map);
		const onClick = (event: mapboxgl.MapMouseEvent) => {
			setContextMenu(null);
			const layers = [
				"readonly-equipment-core",
				"readonly-route-points",
				"readonly-routes-line",
			].filter((layerId) => map.getLayer(layerId));
			if (layers.length === 0) return;

			const feature = map.queryRenderedFeatures(event.point, { layers })[0];
			if (!feature?.properties) return;

			if (feature.properties.equipment_id) {
				const equipment = visibleEquipmentRef.current.find(
					(item) => item.id === feature.properties?.equipment_id,
				);
				if (equipment)
					setSelectedFeature({ kind: "element", element: equipment });
				return;
			}

			if (feature.properties.route_point_id) {
				const point = routePointsRef.current.find(
					(item) => item.id === feature.properties?.route_point_id,
				);
				if (point) setSelectedFeature({ kind: "routePoint", point });
				return;
			}

			if (feature.properties.connection_id) {
				const route = visibleConnectionsRef.current.find(
					(item) => item.id === feature.properties?.connection_id,
				);
				if (route) setSelectedFeature({ kind: "route", route });
			}
		};
		const onContextMenu = (event: mapboxgl.MapMouseEvent) => {
			event.preventDefault();
			const layers = [
				"readonly-equipment-icons",
				"readonly-equipment-core",
				"readonly-equipment-halo",
			].filter((layerId) => map.getLayer(layerId));
			if (layers.length === 0) return;

			const feature = map.queryRenderedFeatures(event.point, { layers })[0];
			const equipmentId = feature?.properties?.equipment_id;
			if (!equipmentId) {
				setContextMenu(null);
				return;
			}

			const equipment = visibleEquipmentRef.current.find(
				(item) => item.id === equipmentId,
			);
			if (!equipment || equipment.type !== "olt") {
				setContextMenu(null);
				return;
			}

			setContextMenu({
				x: event.originalEvent.clientX,
				y: event.originalEvent.clientY,
				element: equipment,
			});
		};

		map.on("zoom", onZoom);
		map.on("click", onClick);
		map.on("contextmenu", onContextMenu);

		return () => {
			resizeObserver.disconnect();
			map.off("zoom", onZoom);
			map.off("click", onClick);
			map.off("contextmenu", onContextMenu);
			map.remove();
			mapRef.current = null;
			setIsMapReady(false);
		};
	}, [token, incidentsByEquipment]);

	useEffect(() => {
		if (!isMapReady || !mapRef.current) return;
		const source = mapRef.current.getSource("readonly-routes") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(buildRoutesGeoJson(visibleConnections, visibleEquipment));
	}, [isMapReady, visibleConnections, visibleEquipment]);

	useEffect(() => {
		if (!isMapReady || !mapRef.current) return;
		const source = mapRef.current.getSource("readonly-route-points") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(buildRoutePointsGeoJson(routePoints));
	}, [isMapReady, routePoints]);

	useEffect(() => {
		if (!isMapReady || !mapRef.current) return;
		const source = mapRef.current.getSource("readonly-equipment") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(
			buildEquipmentGeoJson(visibleEquipment, incidentsByEquipment),
		);
		updateMapVisibility(mapRef.current);
	}, [incidentsByEquipment, isMapReady, visibleEquipment]);

	return (
		<div className="gpon-readonly-map fixed inset-x-0 bottom-0 top-12 overflow-hidden bg-[#1b1c1d]">
			<style>{`
				.gpon-readonly-map > .gpon-mapbox-host,
				.gpon-readonly-map .mapboxgl-map {
					position: absolute !important;
					inset: 0 !important;
					width: 100% !important;
					height: 100% !important;
				}
			`}</style>
			<div ref={containerRef} className="gpon-mapbox-host absolute inset-0" />
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-[#1b1c1d]/70 to-transparent" />

			<div className="absolute left-4 top-4 z-20">
				<LeftPanel
					tab={leftTab}
					onTabChange={setLeftTab}
					filterType={filterType}
					filterStatus={filterStatus}
					onTypeChange={setFilterType}
					onStatusChange={setFilterStatus}
					counts={counts}
					equipment={visibleEquipment}
					connections={visibleConnections}
					warnings={mapWarnings}
					onSelectEquipment={(el) => {
						mapRef.current?.flyTo({
							center: [el.lng, el.lat],
							zoom: Math.max(mapRef.current.getZoom(), 16),
							duration: 650,
						});
						setSelectedFeature({ kind: "element", element: el });
					}}
				/>
			</div>

			<div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
				<Legend />
				<MapControls
					onZoomIn={() => mapRef.current?.zoomIn()}
					onZoomOut={() => mapRef.current?.zoomOut()}
					onFit={() => fitToEquipment(mapRef.current, visibleEquipment, true)}
					onResetNorth={() => mapRef.current?.resetNorth()}
				/>
			</div>

			{selectedFeature && (
				<RightPanel
					feature={selectedFeature}
					equipmentById={equipmentById}
					connections={visibleConnections}
					onClose={() => setSelectedFeature(null)}
				/>
			)}
			{selectedDiagramRoot && (
				<ReadonlyUnifilarPanel
					root={selectedDiagramRoot}
					equipment={visibleEquipment}
					connections={visibleConnections}
					routePoints={routePoints}
					onFocusElement={(element) => {
						mapRef.current?.flyTo({
							center: [element.lng, element.lat],
							zoom: Math.max(mapRef.current.getZoom(), 16),
							duration: 650,
						});
					}}
					onInspectElement={(element) => {
						setSelectedFeature({ kind: "element", element });
					}}
					onClose={() => setSelectedDiagramRoot(null)}
				/>
			)}
			<ContextMenu
				position={contextMenu}
				options={getReadonlyContextMenuOptions({
					element: contextMenu?.element ?? null,
					onOpenDiagram: (element) => setSelectedDiagramRoot(element),
				})}
				onClose={() => setContextMenu(null)}
			/>
		</div>
	);
}

function buildRoutesGeoJson(
	connections: ConnectionMapItem[],
	equipment: EquipmentMapItem[],
): GeoJSON.FeatureCollection {
	const equipmentById = new Map(equipment.map((item) => [item.id, item]));

	return {
		type: "FeatureCollection",
		features: connections
			.filter((route) => route.geojson_coordinates.length >= 2)
			.map((route) => ({
				type: "Feature" as const,
				id: route.id,
				geometry: {
					type: "LineString" as const,
					coordinates: snapConnectionEndpoints(route, equipmentById),
				},
				properties: {
					connection_id: route.id,
					cable_type: route.cable_type ?? route.type ?? "default",
					code: route.code,
					fiber_type: route.fiber_type,
					length_meters: route.length_meters,
				},
			})),
	};
}

function getReadonlyContextMenuOptions({
	element,
	onOpenDiagram,
}: {
	element: EquipmentMapItem | null;
	onOpenDiagram: (element: EquipmentMapItem) => void;
}): ContextMenuOption[] {
	if (!element || element.type !== "olt") return [];

	return [
		{
			id: "open-unifilar",
			label: "Abrir diagrama unifilar",
			icon: <Network size={14} />,
			onClick: () => onOpenDiagram(element),
		},
	];
}

function ReadonlyUnifilarPanel({
	root,
	equipment,
	connections,
	routePoints,
	onFocusElement,
	onInspectElement,
	onClose,
}: {
	root: EquipmentMapItem;
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	routePoints: RoutePoint[];
	onFocusElement: (element: EquipmentMapItem) => void;
	onInspectElement: (element: EquipmentMapItem) => void;
	onClose: () => void;
}) {
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
	const [selectedId, setSelectedId] = useState<string | null>(root.id);
	const [panelHeight, setPanelHeight] = useState(UNIFILAR_DEFAULT_HEIGHT);
	const [isResizing, setIsResizing] = useState(false);
	const { roots, layoutNodes, totalWidth, totalHeight, stats } = useMemo(() => {
		const elementsRecord = buildDiagramElementRecord(equipment);
		const routesRecord = buildDiagramRouteRecord(connections);
		const routePointsRecord = Object.fromEntries(
			routePoints.map((point) => [point.id, point]),
		);
		const allRoots = buildNetworkTree(
			elementsRecord,
			routesRecord,
			routePointsRecord,
		);
		const rootTree = allRoots.find((item) => item.element.id === root.id);
		const diagramRoots = rootTree ? [rootTree] : [];
		const layout = layoutTree(
			diagramRoots,
			new Map([[root.id, root.optical_class ?? null]]),
		);

		return {
			roots: diagramRoots,
			layoutNodes: layout.nodes,
			totalWidth: layout.totalWidth,
			totalHeight: layout.totalHeight,
			stats: collectReactFlowDiagramStats(layout.nodes),
		};
	}, [connections, equipment, root.id, root.optical_class, routePoints]);
	const selectedElement = useMemo(
		() => equipment.find((item) => item.id === selectedId) ?? root,
		[equipment, root, selectedId],
	);
	const selectedDiagramNode = useMemo(
		() =>
			layoutNodes.find((item) => item.tree.element.id === selectedElement.id) ??
			null,
		[layoutNodes, selectedElement.id],
	);
	const selectedConnections = useMemo(
		() =>
			connections.filter(
				(route) =>
					route.from_equipment_id === selectedElement.id ||
					route.to_equipment_id === selectedElement.id,
			),
		[connections, selectedElement.id],
	);

	useEffect(() => {
		setSelectedId(root.id);
	}, [root.id]);

	useEffect(() => {
		const expandableIds = layoutNodes
			.filter((node) => node.tree.children.length > 0)
			.map((node) => node.tree.element.id);
		setExpandedGroups(new Set(expandableIds));
	}, [layoutNodes]);

	const toggleGroup = (id: string) => {
		setExpandedGroups((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
		event.preventDefault();

		const startY = event.clientY;
		const startHeight = panelHeight;
		setIsResizing(true);
		document.body.style.cursor = "ns-resize";
		document.body.style.userSelect = "none";

		const onPointerMove = (moveEvent: PointerEvent) => {
			const delta = startY - moveEvent.clientY;
			setPanelHeight(clampUnifilarPanelHeight(startHeight + delta));
		};

		const onPointerUp = () => {
			setIsResizing(false);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp, { once: true });
	};

	const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setPanelHeight((height) => clampUnifilarPanelHeight(height + 24));
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			setPanelHeight((height) => clampUnifilarPanelHeight(height - 24));
		} else if (event.key === "Home") {
			event.preventDefault();
			setPanelHeight(UNIFILAR_MIN_HEIGHT);
		} else if (event.key === "End") {
			event.preventDefault();
			setPanelHeight(clampUnifilarPanelHeight(UNIFILAR_MAX_HEIGHT));
		}
	};

	return (
		<section
			className={`absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden border-t border-[rgba(164,164,164,0.18)] bg-[#111213] shadow-[0_-18px_40px_rgba(0,0,0,0.34)] ${
				isResizing ? "" : "transition-[height] duration-200"
			}`}
			style={{ height: panelHeight }}
		>
			{/* biome-ignore lint/a11y/useSemanticElements: This separator is an interactive drag handle, not a static horizontal rule. */}
			<div
				onPointerDown={startResize}
				onKeyDown={resizeWithKeyboard}
				className="group absolute -top-1 left-0 z-10 flex h-2 w-full cursor-ns-resize items-center justify-center"
				role="separator"
				aria-orientation="horizontal"
				aria-label="Redimensionar diagrama unifilar"
				aria-valuemin={UNIFILAR_MIN_HEIGHT}
				aria-valuemax={UNIFILAR_MAX_HEIGHT}
				aria-valuenow={panelHeight}
				tabIndex={0}
			>
				<div className="flex h-2.5 w-24 items-center justify-center rounded-full border border-white/10 bg-[#1b1c1d] shadow-lg transition-colors group-hover:border-[#38d8ff]/40">
					<div className="h-0.5 w-12 rounded-full bg-[rgba(164,164,164,0.34)] transition-colors group-hover:bg-[#38d8ff]" />
				</div>
			</div>
			<header className="flex shrink-0 items-center justify-between gap-4 border-b border-[rgba(164,164,164,0.12)] bg-[#111213]/96 px-4 py-2.5">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#38d8ff]/20 bg-[#38d8ff]/10 text-[#38d8ff]">
						<Network className="size-4" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<div className="flex min-w-0 items-center gap-2">
							<p className="truncate text-sm font-semibold text-[#e6e6e6]">
								Vista unifilar
							</p>
							<span className="rounded-full border border-[rgba(56,216,255,0.22)] bg-[rgba(56,216,255,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#8bdff4]">
								Solo lectura
							</span>
						</div>
						<p className="mt-0.5 truncate text-[11px] text-[#777879]">
							<span className="font-mono text-[#cfd2d4]">{root.code}</span>
							{root.name ? ` · ${root.name}` : ""}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<div className="hidden items-center gap-1.5 md:flex">
						<DiagramMetric label="Splitters" value={stats.splitters} />
						<DiagramMetric label="NAP" value={stats.naps} />
						<DiagramMetric label="Rutas" value={stats.routes} />
						<DiagramMetric label="Fibra" value={formatMeters(stats.length)} />
						<DiagramMetric
							label="Peor margen"
							value={
								stats.worstMargin != null
									? `${stats.worstMargin.toFixed(1)} dB`
									: "N/D"
							}
							color={
								OPTICAL_STATUS_COLOR[
									stats.worstStatus as keyof typeof OPTICAL_STATUS_COLOR
								]
							}
						/>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Cerrar diagrama"
						onClick={onClose}
					>
						<X className="size-4" />
					</Button>
				</div>
			</header>
			<div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 bg-[#151617] p-2.5 lg:grid-cols-[minmax(0,1fr)_280px]">
				{roots.length === 0 ? (
					<div className="flex h-full items-center justify-center rounded-md border border-dashed border-white/12 bg-white/[0.025] px-6 text-center lg:col-span-2">
						<div className="max-w-lg">
							<p className="text-sm font-medium text-[#d7d7d7]">
								Esta OLT no tiene unifilar disponible
							</p>
							<p className="mt-2 text-xs leading-5 text-[#777879]">
								No se encontraron rutas descendentes conectadas a esta OLT.
								Revisa que las rutas tengan origen y destino, y que los
								splitters o NAPs no estén ocultos por filtros del mapa.
							</p>
						</div>
					</div>
				) : (
					<>
						<div className="h-full min-h-0 overflow-hidden rounded-md bg-[#1b1c1d] ring-1 ring-white/8">
							<LogicalDiagram
								key={root.id}
								layoutNodes={layoutNodes}
								roots={roots}
								totalWidth={totalWidth}
								totalHeight={totalHeight}
								selectedId={selectedId}
								expandedGroups={expandedGroups}
								onSelectElement={setSelectedId}
								onToggleGroup={toggleGroup}
							/>
						</div>
						<UnifilarSelectionPanel
							element={selectedElement}
							node={selectedDiagramNode}
							connections={selectedConnections}
							onFocus={() => onFocusElement(selectedElement)}
							onInspect={() => onInspectElement(selectedElement)}
						/>
					</>
				)}
			</div>
		</section>
	);
}

function UnifilarSelectionPanel({
	element,
	node,
	connections,
	onFocus,
	onInspect,
}: {
	element: EquipmentMapItem;
	node: ReturnType<typeof layoutTree>["nodes"][number] | null;
	connections: ConnectionMapItem[];
	onFocus: () => void;
	onInspect: () => void;
}) {
	const accent = TYPE_COLOR[element.type] ?? TYPE_COLOR.unknown;
	const downstream = connections.filter(
		(route) => route.from_equipment_id === element.id,
	).length;
	const upstream = connections.filter(
		(route) => route.to_equipment_id === element.id,
	).length;

	return (
		<aside className="hidden min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-[#1b1c1d] lg:flex">
			<div className="h-1 shrink-0" style={{ backgroundColor: accent }} />
			<div className="border-b border-white/10 p-3">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
					Seleccionado
				</p>
				<p className="mt-2 truncate font-mono text-sm font-semibold text-[#e6e6e6]">
					{element.code}
				</p>
				<p className="mt-1 truncate text-xs text-[#858585]">
					{TYPE_LABEL[element.type] ?? element.type}
					{" · "}
					{STATUS_LABEL[element.status] ?? element.status}
				</p>
			</div>
			<div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
				<div className="grid grid-cols-2 gap-2">
					<DiagramMetric label="Entrada" value={upstream} />
					<DiagramMetric label="Salidas" value={downstream} />
					<DiagramMetric
						label="Long."
						value={formatMeters(node?.budget.cumulativeLengthMeters)}
					/>
					<DiagramMetric
						label="Pérdida"
						value={formatDb(node?.budget.totalLoss)}
					/>
				</div>
				<div className="rounded-md border border-white/8 bg-white/[0.03] p-2.5 text-xs">
					<div className="flex items-center justify-between gap-3">
						<span className="text-[#777879]">Calidad</span>
						<DataQualityBadge quality={element.location_quality} size="sm" />
					</div>
					{element.split_ratio && (
						<div className="mt-2 flex items-center justify-between gap-3">
							<span className="text-[#777879]">Split</span>
							<span className="font-mono text-[#d7d7d7]">
								{element.split_ratio}
							</span>
						</div>
					)}
					{element.total_ports != null && (
						<div className="mt-2 flex items-center justify-between gap-3">
							<span className="text-[#777879]">Puertos</span>
							<span className="font-mono text-[#d7d7d7]">
								{element.ports_used ?? 0}/{element.total_ports}
							</span>
						</div>
					)}
				</div>
				<UnifilarOpticalBudgetSummary node={node} element={element} />
			</div>
			<div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
				<Button type="button" variant="outline" size="sm" onClick={onFocus}>
					Centrar
				</Button>
				<Button type="button" size="sm" onClick={onInspect}>
					Detalles
				</Button>
			</div>
		</aside>
	);
}

function UnifilarOpticalBudgetSummary({
	node,
	element,
}: {
	node: ReturnType<typeof layoutTree>["nodes"][number] | null;
	element: EquipmentMapItem;
}) {
	if (!node) return null;

	const budget = node.budget;
	const accent = OPTICAL_STATUS_COLOR[budget.status];
	const warnings = buildPathBudgetWarnings(node, element);

	return (
		<div
			className="rounded-md border p-2.5 text-xs"
			style={{
				borderColor: `${accent}44`,
				background: OPTICAL_STATUS_BG[budget.status],
			}}
		>
			<div className="mb-2 flex items-center justify-between gap-3">
				<span className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
					Presupuesto óptico
				</span>
				<span
					className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
					style={{ backgroundColor: `${accent}22`, color: accent }}
				>
					{opticalStatusLabel(budget.status, budget.margin)}
				</span>
			</div>
			<div className="space-y-1">
				<BudgetMiniRow label="Fibra" value={formatDb(budget.fiberLoss)} />
				<BudgetMiniRow
					label="Splitters"
					value={formatDb(budget.splitterLoss)}
				/>
				<BudgetMiniRow label="Empalmes" value={formatDb(budget.spliceLoss)} />
				<BudgetMiniRow
					label="Conectores"
					value={formatDb(budget.connectorLoss)}
				/>
				<BudgetMiniRow label="Reserva" value={formatDb(budget.safetyMargin)} />
				<div className="my-1 h-px bg-white/10" />
				<BudgetMiniRow label="Total" value={formatDb(budget.totalLoss)} bold />
				<BudgetMiniRow
					label="Margen"
					value={budget.margin == null ? "Sin clase" : formatDb(budget.margin)}
					bold
					color={accent}
				/>
			</div>
			{warnings.length > 0 && (
				<div className="mt-2 space-y-1">
					{warnings.map((warning) => (
						<p key={warning} className="text-[10px] leading-4 text-[#fbbf24]">
							{warning}
						</p>
					))}
				</div>
			)}
		</div>
	);
}

function BudgetMiniRow({
	label,
	value,
	bold,
	color,
}: {
	label: string;
	value: string;
	bold?: boolean;
	color?: string;
}) {
	return (
		<div className="flex items-baseline justify-between gap-3">
			<span
				className={bold ? "font-semibold text-[#d7d7d7]" : "text-[#a4a4a4]"}
			>
				{label}
			</span>
			<span
				className={`font-mono ${bold ? "font-bold" : ""}`}
				style={{ color: color ?? (bold ? "#e6e6e6" : "#d7d7d7") }}
			>
				{value}
			</span>
		</div>
	);
}

function opticalStatusLabel(status: string, margin: number | null) {
	if (margin == null) return "Sin clase";
	if (status === "green") return "Margen sano";
	if (status === "yellow") return "Margen bajo";
	if (status === "red") return "Fuera de rango";
	return "Sin datos";
}

function buildPathBudgetWarnings(
	node: ReturnType<typeof layoutTree>["nodes"][number],
	element: EquipmentMapItem,
) {
	const warnings: string[] = [];
	if (node.budget.margin == null) {
		warnings.push("Define la clase óptica de la OLT para calcular margen.");
	}
	if (node.budget.margin != null && node.budget.margin < 3) {
		warnings.push("Margen menor a 3 dB: ruta sensible a degradación.");
	}
	if (node.budget.status === "red") {
		warnings.push("La pérdida acumulada excede el presupuesto óptico.");
	}
	if (
		(element.type === "splitter" || element.type === "nap") &&
		!element.split_ratio &&
		element.total_ports == null
	) {
		warnings.push("Sin ratio/capacidad: pérdida de splitter incompleta.");
	}
	return warnings;
}

function DiagramMetric({
	label,
	value,
	color,
}: {
	label: string;
	value: ReactNode;
	color?: string;
}) {
	return (
		<div className="flex min-w-20 items-center justify-between gap-2 rounded-md border border-white/8 bg-white/[0.035] px-2.5 py-1.5">
			<p className="text-[10px] font-medium text-[#777879]">{label}</p>
			<p
				className="font-mono text-[11px] font-semibold"
				style={{ color: color ?? "#e6e6e6" }}
			>
				{value}
			</p>
		</div>
	);
}

function clampUnifilarPanelHeight(height: number) {
	const maxHeight =
		typeof window === "undefined"
			? UNIFILAR_MAX_HEIGHT
			: Math.max(
					UNIFILAR_MIN_HEIGHT,
					window.innerHeight - UNIFILAR_MIN_MAP_HEIGHT,
				);
	return Math.min(
		Math.max(height, UNIFILAR_MIN_HEIGHT),
		Math.min(maxHeight, UNIFILAR_MAX_HEIGHT),
	);
}

function buildDiagramElementRecord(equipment: EquipmentMapItem[]) {
	const entries = equipment
		.filter(isDiagramElement)
		.map((element) => [element.id, element] as const);
	return Object.fromEntries(entries) as Record<string, InfrastructureElement>;
}

function buildDiagramRouteRecord(connections: ConnectionMapItem[]) {
	const entries: Array<readonly [string, FiberRoute]> = [];

	for (const route of connections) {
		const fromElementId = route.from_element_id ?? route.from_equipment_id;
		const toElementId = route.to_element_id ?? route.to_equipment_id;
		if (!fromElementId || !toElementId) continue;

		entries.push([
			route.id,
			{
				...route,
				type: route.type ?? route.cable_type ?? "distribution",
				from_element_id: fromElementId,
				to_element_id: toElementId,
				from_element_type:
					route.from_element_type ?? route.from_equipment_type ?? null,
				to_element_type:
					route.to_element_type ?? route.to_equipment_type ?? null,
			},
		]);
	}

	return Object.fromEntries(entries);
}

function isDiagramElement(
	element: EquipmentMapItem,
): element is EquipmentMapItem & { type: InfrastructureElement["type"] } {
	return (
		element.type === "olt" ||
		element.type === "splitter" ||
		element.type === "nap"
	);
}

const OPTICAL_STATUS_PRIORITY: Record<string, number> = {
	red: 3,
	yellow: 2,
	green: 1,
	gray: 0,
};

function collectReactFlowDiagramStats(
	layoutNodes: ReturnType<typeof layoutTree>["nodes"],
) {
	return layoutNodes.reduce(
		(stats, node) => {
			const element = node.tree.element;
			if (element.type === "splitter") stats.splitters += 1;
			if (element.type === "nap") {
				stats.naps += 1;
				const priority = OPTICAL_STATUS_PRIORITY[node.budget.status] ?? 0;
				if (priority > (OPTICAL_STATUS_PRIORITY[stats.worstStatus] ?? 0)) {
					stats.worstStatus = node.budget.status;
					stats.worstMargin = node.budget.margin;
				}
			}
			if (node.tree.routeFromParent) {
				stats.routes += 1;
				stats.length += node.tree.routeFromParent.length_meters ?? 0;
			}
			return stats;
		},
		{
			splitters: 0,
			naps: 0,
			routes: 0,
			length: 0,
			worstStatus: "gray" as string,
			worstMargin: null as number | null,
		},
	);
}

function snapConnectionEndpoints(
	connection: ConnectionMapItem,
	equipmentById: Map<string, EquipmentMapItem>,
): [number, number][] {
	const coordinates = connection.geojson_coordinates ?? [];
	const from = equipmentById.get(connection.from_equipment_id);
	const to = equipmentById.get(connection.to_equipment_id);

	if (!from || !to) return coordinates;

	if (coordinates.length <= 2) {
		return [
			[from.lng, from.lat],
			[to.lng, to.lat],
		];
	}

	return [[from.lng, from.lat], ...coordinates.slice(1, -1), [to.lng, to.lat]];
}

function buildRoutePointsGeoJson(
	routePoints: RoutePoint[],
): GeoJSON.FeatureCollection {
	return {
		type: "FeatureCollection",
		features: routePoints
			.filter(
				(point) => Number.isFinite(point.lng) && Number.isFinite(point.lat),
			)
			.map((point) => ({
				type: "Feature" as const,
				id: point.id,
				geometry: {
					type: "Point" as const,
					coordinates: [point.lng, point.lat],
				},
				properties: {
					route_point_id: point.id,
					type: point.type,
					code: point.code,
				},
			})),
	};
}

function updateMapVisibility(map: mapboxgl.Map) {
	const zoom = map.getZoom();

	setEquipmentLayersFilter(map, "readonly", readonlyEquipmentZoomFilters(zoom));

	if (map.getLayer("readonly-route-points")) {
		map.setLayoutProperty(
			"readonly-route-points",
			"visibility",
			zoom >= ZOOM_ROUTE_POINTS ? "visible" : "none",
		);
	}
}

function fitToEquipment(
	map: mapboxgl.Map | null,
	equipment: EquipmentMapItem[],
	animate: boolean,
) {
	if (!map || equipment.length === 0) return;

	const bounds = new mapboxgl.LngLatBounds();
	for (const item of equipment) {
		if (Number.isFinite(item.lng) && Number.isFinite(item.lat)) {
			bounds.extend([item.lng, item.lat]);
		}
	}
	if (bounds.isEmpty()) return;

	map.fitBounds(bounds, {
		duration: animate ? 650 : 0,
		maxZoom: 15,
		padding: { bottom: 128, left: 332, right: 128, top: 96 },
	});
}

function buildDataWarnings(
	equipment: EquipmentMapItem[],
	connections: ConnectionMapItem[],
	routePoints: RoutePoint[],
) {
	const missingGeometry = connections.filter(
		(route) => route.geojson_coordinates.length < 2,
	).length;
	const invalidEquipment = equipment.filter(
		(item) => !Number.isFinite(item.lng) || !Number.isFinite(item.lat),
	).length;
	const invalidRoutePoints = routePoints.filter(
		(item) => !Number.isFinite(item.lng) || !Number.isFinite(item.lat),
	).length;

	return [
		missingGeometry > 0
			? `${missingGeometry} rutas no tienen geometria suficiente.`
			: null,
		invalidEquipment > 0
			? `${invalidEquipment} elementos tienen coordenadas invalidas.`
			: null,
		invalidRoutePoints > 0
			? `${invalidRoutePoints} puntos de ruta tienen coordenadas invalidas.`
			: null,
	].filter(Boolean) as string[];
}

interface LeftPanelProps {
	tab: LeftPanelTab;
	onTabChange: (tab: LeftPanelTab) => void;
	filterType: string;
	filterStatus: string;
	onTypeChange: (type: string) => void;
	onStatusChange: (status: string) => void;
	counts: {
		olts: number;
		splitters: number;
		naps: number;
		onts: number;
		routes: number;
		routePoints: number;
		saturatedNaps: number;
		totalKm: number;
	};
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	warnings: string[];
	onSelectEquipment?: (el: EquipmentMapItem) => void;
}

const PANEL_TABS = [
	{ value: "layers" as const, label: "Capas", icon: Layers },
	{ value: "tree" as const, label: "Árbol", icon: Network },
	{ value: "alerts" as const, label: "Alertas", icon: Siren },
];

function LeftPanel({
	tab,
	onTabChange,
	filterType,
	filterStatus,
	onTypeChange,
	onStatusChange,
	counts,
	equipment,
	connections,
	warnings,
	onSelectEquipment,
}: LeftPanelProps) {
	return (
		<div className="flex max-h-[calc(100%-2rem)] w-72 flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			<Tabs
				value={tab}
				onValueChange={(value) => onTabChange(value as LeftPanelTab)}
				className="min-h-0 flex-1 gap-0"
			>
				<div className="border-b border-[rgba(164,164,164,0.12)] px-3 py-2.5">
					<div className="mb-2.5 grid grid-cols-4 gap-1.5">
						<StatChip label="OLT" value={counts.olts} color={TYPE_COLOR.olt} />
						<StatChip
							label="SPL"
							value={counts.splitters}
							color={TYPE_COLOR.splitter}
						/>
						<StatChip label="NAP" value={counts.naps} color={TYPE_COLOR.nap} />
						<StatChip
							label="km"
							value={counts.totalKm.toFixed(1)}
							color="#a4a4a4"
						/>
					</div>
					{counts.saturatedNaps > 0 && (
						<div className="mb-2 flex items-center gap-2 rounded-md border border-[rgba(251,77,109,0.28)] bg-[rgba(251,77,109,0.08)] px-2 py-1 text-[10px] text-[#fb7185]">
							<AlertTriangle className="size-3" aria-hidden="true" />
							<span>
								{counts.saturatedNaps} NAP
								{counts.saturatedNaps > 1 ? "s" : ""} saturada
								{counts.saturatedNaps > 1 ? "s" : ""}
							</span>
						</div>
					)}
					<TabsList className="grid w-full grid-cols-3 bg-[rgba(164,164,164,0.05)]">
						{PANEL_TABS.map(({ value, label, icon: Icon }) => (
							<TabsTrigger
								key={value}
								value={value}
								className="relative px-1 text-[10px]"
							>
								<Icon className="size-3" aria-hidden="true" />
								<span className="hidden sm:inline">{label}</span>
								{value === "alerts" && warnings.length > 0 && (
									<Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-[#f59e0b] px-1 text-[9px] text-[#1b1c1d]">
										{warnings.length}
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
						<div className="mt-4 space-y-1.5 rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(164,164,164,0.04)] p-2.5 text-xs">
							<StatRow label="ONT" value={counts.onts} />
							<StatRow label="Rutas" value={counts.routes} />
							<StatRow label="Puntos de ruta" value={counts.routePoints} />
						</div>
					</ScrollArea>
				</TabsContent>

				<TabsContent value="tree" className="overflow-hidden">
					<ScrollArea className="h-full px-3 py-3">
						<p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Topología OLT → Splitter → NAP
						</p>
						<NetworkTree
							equipment={equipment}
							connections={connections}
							onSelectEquipment={onSelectEquipment}
						/>
					</ScrollArea>
				</TabsContent>

				<TabsContent value="alerts" className="overflow-hidden">
					<ScrollArea className="h-full px-3 py-3">
						<p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Alertas de red — {warnings.length} activas
						</p>
						{warnings.length === 0 ? (
							<div className="rounded-md border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.08)] px-3 py-2.5">
								<p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#34d399]">
									Red sin alertas
								</p>
								<p className="mt-0.5 text-[10px] text-[#9ee8c9]">
									Todos los elementos tienen datos técnicos válidos.
								</p>
							</div>
						) : (
							warnings.map((warning) => (
								<div
									key={warning}
									className="mb-1.5 flex items-start gap-2 rounded-md border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-2.5 py-2"
								>
									<AlertTriangle
										className="mt-0.5 size-3 shrink-0 text-[#f59e0b]"
										aria-hidden="true"
									/>
									<p className="text-[11px] leading-snug text-[#f6c768]">
										{warning}
									</p>
								</div>
							))
						)}
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</div>
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

function FilterBar({
	filterType,
	filterStatus,
	onTypeChange,
	onStatusChange,
}: {
	filterType: string;
	filterStatus: string;
	onTypeChange: (v: string) => void;
	onStatusChange: (v: string) => void;
}) {
	return (
		<div className="flex select-none flex-col gap-1.5">
			<div className="flex flex-wrap items-center gap-1">
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
			<div className="flex flex-wrap items-center gap-1">
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

function StatRow({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-[#777879]">{label}</span>
			<span className="font-mono font-semibold text-[#d7d7d7]">{value}</span>
		</div>
	);
}

function NetworkTree({
	equipment,
	connections,
	onSelectEquipment,
}: {
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	onSelectEquipment?: (el: EquipmentMapItem) => void;
}) {
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
	const toggleItem = (id: string) => {
		setExpandedItems((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const olts = equipment.filter((e) => e.type === "olt");

	if (olts.length === 0) {
		return (
			<p className="py-4 text-center text-[11px] text-[#5c5d5f]">
				Sin OLTs visibles
			</p>
		);
	}

	return (
		<div className="space-y-2">
			{olts.map((olt) => {
				const feederRoutes = connections.filter(
					(c) => c.from_element_id === olt.id || c.to_element_id === olt.id,
				);
				const connectedSplitters = equipment.filter(
					(e) =>
						e.type === "splitter" &&
						feederRoutes.some(
							(r) => r.from_element_id === e.id || r.to_element_id === e.id,
						),
				);
				const isOltExpanded = expandedItems.has(olt.id);

				return (
					<div
						key={olt.id}
						className="rounded-md border border-[rgba(56,189,248,0.2)] bg-[rgba(56,189,248,0.05)] p-2"
					>
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={() => toggleItem(olt.id)}
								aria-label={
									isOltExpanded
										? `Contraer ${olt.name ?? olt.code}`
										: `Expandir ${olt.name ?? olt.code}`
								}
								aria-expanded={isOltExpanded}
								className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#a4a4a4] transition-colors hover:bg-white/10 hover:text-[#e6e6e6]"
							>
								{isOltExpanded ? (
									<ChevronDown className="size-3.5" aria-hidden="true" />
								) : (
									<ChevronRight className="size-3.5" aria-hidden="true" />
								)}
							</button>
							<button
								type="button"
								onClick={() => onSelectEquipment?.(olt)}
								className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
							>
								<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#38bdf8]" />
								<span className="truncate text-xs font-semibold text-[#e6e6e6]">
									{olt.name ?? olt.code}
								</span>
								<span className="ml-auto shrink-0 text-[10px] text-[#777879]">
									{connectedSplitters.length} spl
								</span>
							</button>
						</div>

						{isOltExpanded &&
							connectedSplitters.map((spl) => {
								const distRoutes = connections.filter(
									(c) =>
										c.from_element_id === spl.id || c.to_element_id === spl.id,
								);
								const connectedNaps = equipment.filter(
									(e) =>
										e.type === "nap" &&
										distRoutes.some(
											(r) =>
												r.from_element_id === e.id || r.to_element_id === e.id,
										),
								);
								const isSplExpanded = expandedItems.has(spl.id);

								return (
									<div
										key={spl.id}
										className="ml-3 mt-1.5 border-l border-[rgba(167,139,250,0.3)] pl-2.5"
									>
										<div className="flex items-center gap-1.5">
											<button
												type="button"
												onClick={() => toggleItem(spl.id)}
												aria-label={
													isSplExpanded
														? `Contraer ${spl.name ?? spl.code}`
														: `Expandir ${spl.name ?? spl.code}`
												}
												aria-expanded={isSplExpanded}
												className="flex size-5 shrink-0 items-center justify-center rounded text-[#858585] transition-colors hover:bg-white/10 hover:text-[#d7d7d7]"
											>
												{isSplExpanded ? (
													<ChevronDown className="size-3" aria-hidden="true" />
												) : (
													<ChevronRight className="size-3" aria-hidden="true" />
												)}
											</button>
											<button
												type="button"
												onClick={() => onSelectEquipment?.(spl)}
												className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
											>
												<span className="h-2 w-2 shrink-0 rounded-full bg-[#a78bfa]" />
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

										{isSplExpanded &&
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
															onClick={() => onSelectEquipment?.(nap)}
															className="flex w-full items-center gap-1.5 text-left hover:opacity-80"
														>
															<span
																className="h-1.5 w-1.5 shrink-0 rounded-full"
																style={{ background: napColor }}
															/>
															<span className="truncate text-[10px] text-[#a4a4a4]">
																{nap.name ?? nap.code}
															</span>
															{nap.total_ports && (
																<span
																	className="ml-auto shrink-0 text-[9px]"
																	style={{ color: napColor }}
																>
																	{nap.ports_used ?? 0}/{nap.total_ports}
																</span>
															)}
														</button>
													</div>
												);
											})}
										{isSplExpanded && connectedNaps.length === 0 && (
											<p className="ml-3 mt-0.5 text-[10px] text-[#5c5d5f]">
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
			})}
		</div>
	);
}

function RightPanel({
	feature,
	equipmentById,
	connections,
	onClose,
}: {
	feature: SelectedFeature;
	equipmentById: Map<string, EquipmentMapItem>;
	connections: ConnectionMapItem[];
	onClose: () => void;
}) {
	const accent =
		feature.kind === "element"
			? (TYPE_COLOR[feature.element.type] ?? TYPE_COLOR.unknown)
			: feature.kind === "route"
				? (FIBER_RENDER_COLOR[feature.route.cable_type ?? "default"] ??
					FIBER_RENDER_COLOR.default)
				: (routePointColor(feature.point.type) ?? "#d7d7d7");

	return (
		<aside className="absolute bottom-4 right-4 top-4 z-20 flex w-80 flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			<div className="h-1" style={{ backgroundColor: accent }} />
			<header className="flex items-start justify-between gap-3 border-b border-[rgba(164,164,164,0.12)] px-4 py-3">
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold text-[#e6e6e6]">
						{featureTitle(feature)}
					</p>
					<p className="mt-0.5 text-xs text-[#777879]">
						{featureSubtitle(feature)}
					</p>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Cerrar panel"
					onClick={onClose}
				>
					<X className="size-4" />
				</Button>
			</header>
			<ScrollArea className="min-h-0 flex-1">
				<div className="p-4 pr-5">
					{feature.kind === "element" && (
						<ElementDetails
							element={feature.element}
							connections={connections}
							equipmentById={equipmentById}
						/>
					)}
					{feature.kind === "route" && (
						<RouteDetails
							route={feature.route}
							equipmentById={equipmentById}
							connections={connections}
						/>
					)}
					{feature.kind === "routePoint" && (
						<RoutePointDetails point={feature.point} />
					)}
				</div>
			</ScrollArea>
		</aside>
	);
}

function featureTitle(feature: SelectedFeature) {
	if (feature.kind === "element") {
		return feature.element.name || feature.element.code;
	}
	if (feature.kind === "route") {
		return feature.route.code || "Ruta de fibra";
	}
	return feature.point.code || routePointLabel(feature.point.type);
}

function featureSubtitle(feature: SelectedFeature) {
	if (feature.kind === "element") {
		return `${TYPE_LABEL[feature.element.type] ?? feature.element.type} · ${
			STATUS_LABEL[feature.element.status] ?? feature.element.status
		}`;
	}
	if (feature.kind === "route") {
		return CABLE_LABEL[feature.route.cable_type ?? "default"] ?? "Fibra";
	}
	return routePointLabel(feature.point.type);
}

function ElementDetails({
	element,
	connections,
	equipmentById,
}: {
	element: EquipmentMapItem;
	connections: ConnectionMapItem[];
	equipmentById: Map<string, EquipmentMapItem>;
}) {
	if (element.type === "olt") {
		return (
			<OltDetails
				element={element}
				connections={connections}
				equipmentById={equipmentById}
			/>
		);
	}
	if (element.type === "splitter") {
		return (
			<SplitterDetails
				element={element}
				connections={connections}
				equipmentById={equipmentById}
			/>
		);
	}
	if (element.type === "nap") {
		return (
			<NapDetails
				element={element}
				connections={connections}
				equipmentById={equipmentById}
			/>
		);
	}

	return (
		<div className="space-y-3 text-xs">
			<Property label="Codigo" value={element.code} />
			{element.name && <Property label="Nombre" value={element.name} />}
			<Property
				label="Tipo"
				value={TYPE_LABEL[element.type] ?? element.type.toUpperCase()}
			/>
			<Property
				label="Estado"
				value={STATUS_LABEL[element.status] ?? element.status}
			/>
			<div className="flex items-center justify-between gap-3">
				<span className="text-[#777879]">Calidad</span>
				<DataQualityBadge quality={element.location_quality} size="sm" />
			</div>
			<Property
				label="Posicion"
				value={`${element.lat.toFixed(5)}, ${element.lng.toFixed(5)}`}
			/>
			{element.total_ports != null && (
				<Property label="Puertos" value={String(element.total_ports)} />
			)}
			{element.ports_reserved != null && (
				<Property label="Reservados" value={String(element.ports_reserved)} />
			)}
			{element.address_reference && (
				<TextBlock label="Referencia" value={element.address_reference} />
			)}
			{element.address && (
				<TextBlock label="Direccion" value={element.address} />
			)}
			<PropertiesBlock properties={element.properties} />
			{element.notes && <TextBlock label="Notas" value={element.notes} />}
		</div>
	);
}

function SplitterDetails({
	element,
	connections,
	equipmentById,
}: {
	element: EquipmentMapItem;
	connections: ConnectionMapItem[];
	equipmentById: Map<string, EquipmentMapItem>;
}) {
	const incomingRoutes = connections.filter(
		(route) => route.to_equipment_id === element.id,
	);
	const outgoingRoutes = connections.filter(
		(route) => route.from_equipment_id === element.id,
	);
	const upstreamElements = uniqueEquipment(
		incomingRoutes
			.map((route) => equipmentById.get(route.from_equipment_id))
			.filter((item): item is EquipmentMapItem => Boolean(item)),
	);
	const downstreamElements = uniqueEquipment(
		outgoingRoutes
			.map((route) => equipmentById.get(route.to_equipment_id))
			.filter((item): item is EquipmentMapItem => Boolean(item)),
	);
	const distributionRoutes = outgoingRoutes.filter(
		(route) =>
			route.cable_type === "distribution" || route.type === "distribution",
	);
	const measuredRoutes = [...incomingRoutes, ...outgoingRoutes].filter(
		(route) => route.length_meters != null,
	);
	const totalLengthMeters = measuredRoutes.reduce(
		(total, route) => total + (route.length_meters ?? 0),
		0,
	);
	const inferredPorts = parseSplitOutputs(element.split_ratio);
	const totalPorts = element.total_ports ?? inferredPorts;
	const usedPorts = downstreamElements.length;

	return (
		<div className="space-y-3 text-xs">
			<div className="rounded-lg border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.06)] p-3">
				<div className="mb-3 flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="truncate font-mono text-sm font-semibold text-[#e6e6e6]">
							{element.code}
						</p>
						{element.name && (
							<p className="mt-0.5 truncate text-[11px] text-[#a4a4a4]">
								{element.name}
							</p>
						)}
					</div>
					<span className="rounded-full border border-[rgba(167,139,250,0.24)] bg-[rgba(27,28,29,0.6)] px-2 py-0.5 text-[10px] font-semibold text-[#c4b5fd]">
						{element.split_ratio ?? "Ratio N/D"}
					</span>
				</div>
				<div className="grid grid-cols-3 gap-2">
					<RouteMetric label="Ratio" value={element.split_ratio ?? "-"} />
					<RouteMetric
						label="Perdida"
						value={formatDb(element.insertion_loss_db)}
					/>
					<RouteMetric
						label="Puertos"
						value={totalPorts != null ? `${usedPorts}/${totalPorts}` : "-"}
					/>
				</div>
			</div>

			<DetailSection title="Resumen">
				<Property
					label="Estado"
					value={STATUS_LABEL[element.status] ?? element.status}
				/>
				<Property label="Relacion" value={element.split_ratio ?? "Sin dato"} />
				<Property
					label="Perdida insercion"
					value={formatDb(element.insertion_loss_db)}
				/>
				<Property
					label="Puertos salida"
					value={totalPorts != null ? String(totalPorts) : "Sin dato"}
				/>
			</DetailSection>

			<DetailSection title="Conectividad">
				<Property label="Entradas" value={String(incomingRoutes.length)} />
				<Property label="Salidas" value={String(outgoingRoutes.length)} />
				<Property
					label="Distribucion"
					value={String(distributionRoutes.length)}
				/>
				<Property
					label="Fibra asociada"
					value={
						measuredRoutes.length > 0
							? formatMeters(totalLengthMeters)
							: "Sin medir"
					}
				/>
				{upstreamElements.length > 0 && (
					<TextBlock
						label="Origen"
						value={upstreamElements.map((item) => item.code).join(", ")}
					/>
				)}
				{downstreamElements.length > 0 && (
					<TextBlock
						label="Aguas abajo"
						value={downstreamElements.map((item) => item.code).join(", ")}
					/>
				)}
			</DetailSection>

			<DetailSection title="Ubicacion">
				<div className="flex items-center justify-between gap-3">
					<span className="text-[#777879]">Calidad</span>
					<DataQualityBadge quality={element.location_quality} size="sm" />
				</div>
				<Property
					label="Coordenadas"
					value={`${element.lat.toFixed(5)}, ${element.lng.toFixed(5)}`}
				/>
				{element.address_reference && (
					<TextBlock label="Referencia" value={element.address_reference} />
				)}
			</DetailSection>

			<PropertiesBlock properties={element.properties} />
			{element.notes && <TextBlock label="Notas" value={element.notes} />}
		</div>
	);
}

function NapDetails({
	element,
	connections,
	equipmentById,
}: {
	element: EquipmentMapItem;
	connections: ConnectionMapItem[];
	equipmentById: Map<string, EquipmentMapItem>;
}) {
	const incomingRoutes = connections.filter(
		(route) => route.to_equipment_id === element.id,
	);
	const outgoingRoutes = connections.filter(
		(route) => route.from_equipment_id === element.id,
	);
	const upstreamElements = uniqueEquipment(
		incomingRoutes
			.map((route) => equipmentById.get(route.from_equipment_id))
			.filter((item): item is EquipmentMapItem => Boolean(item)),
	);
	const downstreamElements = uniqueEquipment(
		outgoingRoutes
			.map((route) => equipmentById.get(route.to_equipment_id))
			.filter((item): item is EquipmentMapItem => Boolean(item)),
	);
	const distributionRoutes = incomingRoutes.filter(
		(route) =>
			route.cable_type === "distribution" || route.type === "distribution",
	);
	const dropRoutes = outgoingRoutes;
	const usedPorts = element.ports_used ?? downstreamElements.length;
	const reservedPorts = element.ports_reserved ?? 0;
	const availablePorts =
		element.total_ports != null
			? Math.max(0, element.total_ports - usedPorts - reservedPorts)
			: null;
	const occupancy =
		element.total_ports && element.total_ports > 0
			? Math.round((usedPorts / element.total_ports) * 100)
			: null;
	const napMode = getReadonlyNapMode(element);
	const hasInternalSplitter = napMode === "with_splitter";
	const splitterRatio =
		element.split_ratio ?? inferSplitRatioFromPorts(element);
	const measuredRoutes = [...incomingRoutes, ...outgoingRoutes].filter(
		(route) => route.length_meters != null,
	);
	const totalLengthMeters = measuredRoutes.reduce(
		(total, route) => total + (route.length_meters ?? 0),
		0,
	);

	return (
		<div className="space-y-3 text-xs">
			<div className="rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.06)] p-3">
				<div className="mb-3 flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="truncate font-mono text-sm font-semibold text-[#e6e6e6]">
							{element.code}
						</p>
						{element.name && (
							<p className="mt-0.5 truncate text-[11px] text-[#a4a4a4]">
								{element.name}
							</p>
						)}
					</div>
					<span className="rounded-full border border-[rgba(245,158,11,0.24)] bg-[rgba(27,28,29,0.6)] px-2 py-0.5 text-[10px] font-semibold text-[#fbbf24]">
						{NAP_MODE_LABEL[napMode]}
					</span>
				</div>
				<div className="grid grid-cols-3 gap-2">
					<RouteMetric
						label="Puertos"
						value={
							element.total_ports != null
								? `${usedPorts}/${element.total_ports}`
								: "-"
						}
					/>
					<RouteMetric
						label="Libres"
						value={availablePorts != null ? String(availablePorts) : "-"}
					/>
					<RouteMetric
						label="Ocupacion"
						value={occupancy != null ? `${occupancy}%` : "-"}
					/>
				</div>
			</div>

			{element.total_ports != null && (
				<div className="border-t border-[rgba(164,164,164,0.12)] pt-3">
					<NapCapacity element={element} />
				</div>
			)}

			<DetailSection title="Resumen">
				<Property
					label="Estado"
					value={STATUS_LABEL[element.status] ?? element.status}
				/>
				<Property label="Tipo NAP" value={NAP_MODE_LABEL[napMode]} />
				<Property
					label="Conector"
					value={napPropertyLabel(element, "connector_type", "SC/APC")}
				/>
				<Property
					label="Proteccion"
					value={napPropertyLabel(element, "protection_rating", "IP65")}
				/>
			</DetailSection>

			<DetailSection title="Capacidad">
				<Property
					label="Puertos totales"
					value={
						element.total_ports != null
							? String(element.total_ports)
							: "Sin dato"
					}
				/>
				<Property label="Usados" value={String(usedPorts)} />
				<Property label="Reservados" value={String(reservedPorts)} />
				<Property
					label="Disponibles"
					value={availablePorts != null ? String(availablePorts) : "Sin dato"}
				/>
			</DetailSection>

			{hasInternalSplitter && (
				<DetailSection title="Splitter interno">
					<Property
						label="Relacion"
						value={
							splitterRatio
								? element.split_ratio
									? splitterRatio
									: `${splitterRatio} estimado`
								: "Sin dato"
						}
					/>
					<Property
						label="Perdida insercion"
						value={
							element.insertion_loss_db != null
								? formatDb(element.insertion_loss_db)
								: splitterRatio
									? "Pendiente de registrar"
									: "Sin dato"
						}
					/>
				</DetailSection>
			)}

			<DetailSection title="Conectividad">
				<Property label="Entradas" value={String(incomingRoutes.length)} />
				<Property
					label="Entrada distribucion"
					value={String(distributionRoutes.length)}
				/>
				<Property label="Salidas drop" value={String(dropRoutes.length)} />
				<Property
					label="Fibra asociada"
					value={
						measuredRoutes.length > 0
							? formatMeters(totalLengthMeters)
							: "Sin medir"
					}
				/>
				{upstreamElements.length > 0 && (
					<TextBlock
						label="Origen"
						value={upstreamElements.map((item) => item.code).join(", ")}
					/>
				)}
				{downstreamElements.length > 0 && (
					<TextBlock
						label="Clientes/equipos"
						value={downstreamElements.map((item) => item.code).join(", ")}
					/>
				)}
			</DetailSection>

			<DetailSection title="Ubicacion">
				<div className="flex items-center justify-between gap-3">
					<span className="text-[#777879]">Calidad</span>
					<DataQualityBadge quality={element.location_quality} size="sm" />
				</div>
				<Property
					label="Coordenadas"
					value={`${element.lat.toFixed(5)}, ${element.lng.toFixed(5)}`}
				/>
				{element.address_reference && (
					<TextBlock label="Referencia" value={element.address_reference} />
				)}
			</DetailSection>

			<PropertiesBlock properties={element.properties} />
			{element.notes && <TextBlock label="Notas" value={element.notes} />}
		</div>
	);
}

function OltDetails({
	element,
	connections,
	equipmentById,
}: {
	element: EquipmentMapItem;
	connections: ConnectionMapItem[];
	equipmentById: Map<string, EquipmentMapItem>;
}) {
	const outboundRoutes = connections.filter(
		(route) => route.from_equipment_id === element.id,
	);
	const feederRoutes = outboundRoutes.filter(
		(route) => route.cable_type === "feeder" || route.type === "feeder",
	);
	const downstreamIds = new Set(
		outboundRoutes
			.map((route) => route.to_equipment_id)
			.filter((id) => id && id !== element.id),
	);
	const downstreamElements = [...downstreamIds]
		.map((id) => equipmentById.get(id))
		.filter((item): item is EquipmentMapItem => Boolean(item));
	const totalLengthMeters = outboundRoutes.reduce(
		(total, route) => total + (route.length_meters ?? 0),
		0,
	);
	const hasMeasuredLength = outboundRoutes.some(
		(route) => route.length_meters != null,
	);

	return (
		<div className="space-y-3 text-xs">
			<div className="rounded-lg border border-[rgba(56,189,248,0.18)] bg-[rgba(56,189,248,0.055)] p-3">
				<div className="mb-3 flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="truncate font-mono text-sm font-semibold text-[#e6e6e6]">
							{element.code}
						</p>
						{element.name && (
							<p className="mt-0.5 truncate text-[11px] text-[#a4a4a4]">
								{element.name}
							</p>
						)}
					</div>
					<span className="rounded-full border border-[rgba(56,189,248,0.22)] bg-[rgba(27,28,29,0.6)] px-2 py-0.5 text-[10px] font-semibold text-[#7dd3fc]">
						{element.pon_standard?.toUpperCase() ?? "PON N/D"}
					</span>
				</div>
				<div className="grid grid-cols-3 gap-2">
					<RouteMetric
						label="PON"
						value={
							element.total_pon_ports != null
								? String(element.total_pon_ports)
								: "-"
						}
					/>
					<RouteMetric label="Clase" value={element.optical_class ?? "-"} />
					<RouteMetric label="Feeder" value={String(feederRoutes.length)} />
				</div>
			</div>

			<DetailSection title="Resumen">
				<Property
					label="Estado"
					value={STATUS_LABEL[element.status] ?? element.status}
				/>
				<Property
					label="Estandar PON"
					value={element.pon_standard?.toUpperCase() ?? "Sin dato"}
				/>
				<Property
					label="Puertos PON"
					value={
						element.total_pon_ports != null
							? String(element.total_pon_ports)
							: "Sin dato"
					}
				/>
				<Property
					label="Clase optica"
					value={element.optical_class ?? "Sin definir"}
				/>
			</DetailSection>

			<DetailSection title="Conectividad">
				<Property
					label="Rutas conectadas"
					value={String(outboundRoutes.length)}
				/>
				<Property label="Rutas feeder" value={String(feederRoutes.length)} />
				<Property
					label="Aguas abajo"
					value={String(downstreamElements.length || downstreamIds.size)}
				/>
				<Property
					label="Fibra total"
					value={
						hasMeasuredLength ? formatMeters(totalLengthMeters) : "Sin medir"
					}
				/>
				{downstreamElements.length > 0 && (
					<TextBlock
						label="Elementos conectados"
						value={downstreamElements.map((item) => item.code).join(", ")}
					/>
				)}
			</DetailSection>

			<DetailSection title="Ubicacion">
				<div className="flex items-center justify-between gap-3">
					<span className="text-[#777879]">Calidad</span>
					<DataQualityBadge quality={element.location_quality} size="sm" />
				</div>
				<Property
					label="Coordenadas"
					value={`${element.lat.toFixed(5)}, ${element.lng.toFixed(5)}`}
				/>
				{element.address_reference && (
					<TextBlock label="Referencia" value={element.address_reference} />
				)}
			</DetailSection>

			<PropertiesBlock properties={element.properties} />
			{element.notes && <TextBlock label="Notas" value={element.notes} />}
		</div>
	);
}

function findUpstreamOlt(
	elementId: string,
	equipmentById: Map<string, EquipmentMapItem>,
	connections: ConnectionMapItem[],
): EquipmentMapItem | null {
	let current = equipmentById.get(elementId);
	for (let hop = 0; hop < 4; hop++) {
		if (!current || current.type === "olt") break;
		const upstream = connections.find((c) => c.to_equipment_id === current?.id);
		if (!upstream) break;
		current = equipmentById.get(upstream.from_equipment_id);
	}
	return current?.type === "olt" ? current : null;
}

function RouteDetails({
	route,
	equipmentById,
	connections,
}: {
	route: ConnectionMapItem;
	equipmentById: Map<string, EquipmentMapItem>;
	connections: ConnectionMapItem[];
}) {
	const from = equipmentById.get(route.from_equipment_id);
	const to = equipmentById.get(route.to_equipment_id);
	const fiberColor =
		FIBER_RENDER_COLOR[route.cable_type ?? "default"] ??
		FIBER_RENDER_COLOR.default;
	const routeTypeLabel =
		CABLE_LABEL[route.cable_type ?? "default"] ?? CABLE_LABEL.default;
	const endpointSummary =
		from || to
			? `${endpointLabel(from, route.from_equipment_id)} → ${endpointLabel(
					to,
					route.to_equipment_id,
				)}`
			: "Sin extremos definidos";
	const CABLE_FACTOR = 1.02;
	const fiberLoss =
		route.length_meters != null && route.attenuation_db_per_km != null
			? ((route.length_meters * CABLE_FACTOR) / 1000) *
				route.attenuation_db_per_km
			: null;
	const knownLosses = [
		route.splice_loss_db,
		route.connector_loss_db,
		fiberLoss,
	].filter((value): value is number => value != null);
	const estimatedLoss =
		route.total_loss_db ??
		(knownLosses.length > 0
			? knownLosses.reduce((total, value) => total + value, 0)
			: null);
	const lossLabel = route.total_loss_db != null ? "medida" : "estimada";
	const routeWarnings = buildRouteWarnings(route, from, to, estimatedLoss);
	const inferredSplitRatio =
		to?.type === "splitter" || to?.type === "nap" ? to.split_ratio : null;
	const inferredOlt =
		from?.type === "olt"
			? from
			: findUpstreamOlt(route.from_equipment_id, equipmentById, connections);
	const inferredOltClass = inferredOlt?.optical_class ?? null;

	return (
		<div className="space-y-3 text-xs">
			<div
				className="rounded-lg border bg-white/[0.035] p-3"
				style={{ borderColor: `${fiberColor}33` }}
			>
				<div className="mb-3 flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex min-w-0 items-center gap-2">
							<span
								className="h-2 w-8 rounded-full"
								style={{ backgroundColor: fiberColor }}
							/>
							<span className="truncate font-semibold text-[#e6e6e6]">
								{route.code ?? "Ruta sin codigo"}
							</span>
						</div>
						<p className="mt-1 truncate text-[11px] text-[#a4a4a4]">
							{endpointSummary}
						</p>
					</div>
					<span
						className="rounded-full border bg-[rgba(27,28,29,0.72)] px-2 py-0.5 text-[10px] font-semibold"
						style={{ borderColor: `${fiberColor}33`, color: fiberColor }}
					>
						{routeTypeLabel}
					</span>
				</div>
				<div className="grid grid-cols-3 gap-2">
					<RouteMetric
						label="Longitud"
						value={formatMeters(route.length_meters)}
					/>
					<RouteMetric
						label="Hilos"
						value={route.fiber_count != null ? String(route.fiber_count) : "-"}
					/>
					<RouteMetric
						label={route.total_loss_db != null ? "Perdida" : "Estimado"}
						value={estimatedLoss != null ? formatDb(estimatedLoss) : "-"}
					/>
				</div>
			</div>

			{routeWarnings.length > 0 && (
				<div className="space-y-1 rounded-lg border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.07)] px-3 py-2">
					{routeWarnings.map((warning) => (
						<div
							key={warning}
							className="flex items-start gap-2 text-[#fbbf24]"
						>
							<AlertTriangle className="mt-0.5 size-3 shrink-0" />
							<span className="leading-relaxed">{warning}</span>
						</div>
					))}
				</div>
			)}

			<DetailSection title="Operacion">
				<Property
					label="Estado"
					value={STATUS_LABEL[route.status] ?? route.status}
				/>
				<Property label="Tipo" value={routeTypeLabel} />
				<Property
					label="Instalacion"
					value={
						route.installation_type
							? (INSTALLATION_LABEL[route.installation_type] ??
								route.installation_type)
							: "Sin dato"
					}
				/>
				<Property
					label="Calidad"
					value={DATA_QUALITY_LABEL[route.route_quality] ?? route.route_quality}
				/>
				<Property
					label="Trazado"
					value={`${route.geojson_coordinates.length} punto${
						route.geojson_coordinates.length === 1 ? "" : "s"
					}`}
				/>
			</DetailSection>

			<DetailSection title="Extremos">
				<div className="space-y-2">
					<RouteEndpoint
						label="Desde"
						equipment={from}
						fallbackId={route.from_equipment_id}
					/>
					<RouteEndpoint
						label="Hasta"
						equipment={to}
						fallbackId={route.to_equipment_id}
					/>
				</div>
			</DetailSection>

			<DetailSection title="Cable y perdida">
				<Property
					label="Estandar"
					value={
						route.fiber_type
							? (FIBER_TYPE_LABEL[route.fiber_type] ?? route.fiber_type)
							: "Sin dato"
					}
				/>
				<Property
					label="Hilos"
					value={
						route.fiber_count != null ? String(route.fiber_count) : "Sin dato"
					}
				/>
				<Property
					label={`Perdida ${lossLabel}`}
					value={estimatedLoss != null ? formatDb(estimatedLoss) : "Sin dato"}
				/>
				<Property
					label="Fibra"
					value={fiberLoss != null ? formatDb(fiberLoss) : "Sin dato"}
				/>
				<Property
					label="Atenuacion"
					value={formatDbPerKm(route.attenuation_db_per_km)}
				/>
				<Property label="Empalmes" value={formatDb(route.splice_loss_db)} />
				<Property
					label="Conectores"
					value={formatDb(route.connector_loss_db)}
				/>
			</DetailSection>

			<div className="border-t border-[rgba(164,164,164,0.12)] pt-3">
				<OpticalBudgetPanel
					route={route}
					splitterRatio={inferredSplitRatio}
					oltPonClass={asPonClass(inferredOltClass)}
				/>
			</div>
			<PropertiesBlock properties={route.properties} />
			{route.notes && <TextBlock label="Notas" value={route.notes} />}
		</div>
	);
}

function RouteEndpoint({
	label,
	equipment,
	fallbackId,
}: {
	label: string;
	equipment: EquipmentMapItem | undefined;
	fallbackId: string | null | undefined;
}) {
	return (
		<div className="rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(27,28,29,0.42)] px-2.5 py-2">
			<div className="flex items-center justify-between gap-3">
				<span className="text-[10px] uppercase tracking-wider text-[#777879]">
					{label}
				</span>
				{equipment && (
					<span
						className="size-2 rounded-full"
						style={{
							backgroundColor: TYPE_COLOR[equipment.type] ?? TYPE_COLOR.unknown,
						}}
					/>
				)}
			</div>
			<p className="mt-1 truncate font-mono text-[12px] font-semibold text-[#e6e6e6]">
				{endpointLabel(equipment, fallbackId)}
			</p>
			{equipment && (
				<p className="mt-0.5 truncate text-[10px] text-[#858585]">
					{TYPE_LABEL[equipment.type] ?? equipment.type} ·{" "}
					{STATUS_LABEL[equipment.status] ?? equipment.status}
				</p>
			)}
		</div>
	);
}

function buildRouteWarnings(
	route: ConnectionMapItem,
	from: EquipmentMapItem | undefined,
	to: EquipmentMapItem | undefined,
	estimatedLoss: number | null,
) {
	const warnings: string[] = [];
	if (!from || !to) {
		warnings.push("Ruta con extremo incompleto.");
	}
	if (route.length_meters == null) {
		warnings.push("Longitud sin medir.");
	}
	if (
		route.route_quality === "unknown" ||
		route.route_quality === "approximate"
	) {
		warnings.push(
			`Trazado ${
				DATA_QUALITY_LABEL[route.route_quality] ?? route.route_quality
			}.`,
		);
	}
	if (route.fiber_count == null) {
		warnings.push("Cantidad de hilos sin definir.");
	}
	if (estimatedLoss == null) {
		warnings.push("Perdida optica sin datos suficientes.");
	}
	return warnings;
}

function RoutePointDetails({ point }: { point: RoutePoint }) {
	return (
		<div className="space-y-3 text-xs">
			<Property label="Tipo" value={routePointLabel(point.type)} />
			<Property label="Codigo" value={point.code ?? "Sin codigo"} />
			<Property label="Estado" value={point.status ?? "Sin estado"} />
			<Property label="Calidad" value={point.location_quality} />
			<Property
				label="Posicion"
				value={`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
			/>
			{point.reserve_length_m != null && (
				<Property
					label="Reserva"
					value={`${point.reserve_length_m.toFixed(0)} m`}
				/>
			)}
			{point.splice_loss_db != null && (
				<Property label="Perdida" value={`${point.splice_loss_db} dB`} />
			)}
			{point.reference_text && (
				<TextBlock label="Referencia" value={point.reference_text} />
			)}
			<PropertiesBlock properties={point.properties} />
			{point.notes && <TextBlock label="Notas" value={point.notes} />}
		</div>
	);
}

function DetailSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<div className="border-t border-[rgba(164,164,164,0.12)] pt-3">
			<p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{title}
			</p>
			<div className="space-y-2">{children}</div>
		</div>
	);
}

function RouteMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(27,28,29,0.42)] px-2 py-2">
			<p className="text-[10px] uppercase tracking-wider text-[#777879]">
				{label}
			</p>
			<p className="mt-1 truncate font-mono text-[12px] font-semibold text-[#e6e6e6]">
				{value}
			</p>
		</div>
	);
}

function Property({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-[#777879]">{label}</span>
			<span className="truncate text-right font-mono text-[#d7d7d7]">
				{value}
			</span>
		</div>
	);
}

function PropertiesBlock({
	properties,
}: {
	properties: Record<string, unknown> | null | undefined;
}) {
	const entries = Object.entries(properties ?? {}).filter(
		([, value]) => value !== null && value !== undefined && value !== "",
	);
	if (entries.length === 0) return null;

	return (
		<DetailSection title="Propiedades">
			{entries.slice(0, 8).map(([key, value]) => (
				<Property
					key={key}
					label={formatPropertyKey(key)}
					value={formatPropertyValue(value)}
				/>
			))}
			{entries.length > 8 && (
				<p className="text-right text-[10px] text-[#777879]">
					+{entries.length - 8} propiedades mas
				</p>
			)}
		</DetailSection>
	);
}

function TextBlock({ label, value }: { label: string; value: string }) {
	return (
		<div className="border-t border-[rgba(164,164,164,0.12)] pt-3">
			<p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{label}
			</p>
			<p className="leading-relaxed text-[#d7d7d7]">{value}</p>
		</div>
	);
}

function endpointLabel(
	equipment: EquipmentMapItem | undefined,
	fallbackId: string | null | undefined,
) {
	if (equipment) return equipment.code;
	return fallbackId ? `ID ${fallbackId.slice(0, 8)}` : "Sin dato";
}

function uniqueEquipment(items: EquipmentMapItem[]) {
	const seen = new Set<string>();
	const result: EquipmentMapItem[] = [];
	for (const item of items) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		result.push(item);
	}
	return result;
}

function getReadonlyNapMode(element: EquipmentMapItem): NapMode {
	const configuredMode = element.properties?.nap_mode;
	if (
		configuredMode === "terminal" ||
		configuredMode === "with_splitter" ||
		configuredMode === "prepared"
	) {
		return configuredMode;
	}
	if (element.split_ratio || element.total_ports) return "with_splitter";
	return "terminal";
}

function inferSplitRatioFromPorts(element: EquipmentMapItem) {
	if (element.split_ratio) return element.split_ratio;
	if (!element.total_ports) return null;
	return `1:${element.total_ports}`;
}

function asPonClass(value: string | null | undefined): PonClass | null {
	if (
		value === "B+" ||
		value === "C+" ||
		value === "C++" ||
		value === "N1" ||
		value === "N2" ||
		value === "E1" ||
		value === "E2"
	) {
		return value;
	}
	return null;
}

function parseSplitOutputs(splitRatio: string | null | undefined) {
	if (!splitRatio) return null;
	const [, output] = splitRatio.split(":");
	const parsed = Number(output);
	return Number.isFinite(parsed) ? parsed : null;
}

function formatMeters(value: number | null | undefined) {
	if (value == null) return "Sin medir";
	if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
	return `${value.toFixed(0)} m`;
}

function formatDb(value: number | null | undefined) {
	return value == null ? "Sin dato" : `${value.toFixed(2)} dB`;
}

function formatDbPerKm(value: number | null | undefined) {
	return value == null ? "Sin dato" : `${value.toFixed(3)} dB/km`;
}

function formatPropertyKey(key: string) {
	return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPropertyValue(value: unknown): string {
	if (typeof value === "boolean") return value ? "Si" : "No";
	if (typeof value === "number")
		return Number.isFinite(value) ? String(value) : "-";
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		return value.map((item) => formatPropertyValue(item)).join(", ");
	}
	if (typeof value === "object" && value !== null) {
		return JSON.stringify(value);
	}
	return String(value);
}

function Legend() {
	return (
		<div className="w-44 rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.9)] p-3 text-xs text-[#d7d7d7] shadow-2xl backdrop-blur-md">
			<p className="mb-2 font-semibold uppercase tracking-widest text-[#777879]">
				Fibra
			</p>
			{(["feeder", "distribution", "drop"] as const).map((type) => (
				<div key={type} className="mb-1.5 flex items-center gap-2">
					<span
						className="h-px w-7"
						style={{
							borderTop:
								type === "feeder"
									? `2px solid ${FIBER_RENDER_COLOR[type]}`
									: `2px dashed ${FIBER_RENDER_COLOR[type]}`,
						}}
					/>
					<span>{CABLE_LABEL[type]}</span>
				</div>
			))}
			<p className="mb-2 mt-3 font-semibold uppercase tracking-widest text-[#777879]">
				Elementos
			</p>
			{(["olt", "splitter", "nap"] as const).map((type) => (
				<div key={type} className="mb-1.5 flex items-center gap-2">
					<span
						className="size-2.5 rounded-full"
						style={{ backgroundColor: TYPE_COLOR[type] }}
					/>
					<span>{TYPE_LABEL[type]}</span>
				</div>
			))}
		</div>
	);
}

function MapControls({
	onZoomIn,
	onZoomOut,
	onFit,
	onResetNorth,
}: {
	onZoomIn: () => void;
	onZoomOut: () => void;
	onFit: () => void;
	onResetNorth: () => void;
}) {
	return (
		<div className="flex overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			<IconControl label="Acercar" onClick={onZoomIn}>
				<Plus className="size-4" />
			</IconControl>
			<IconControl label="Alejar" onClick={onZoomOut}>
				<Minus className="size-4" />
			</IconControl>
			<IconControl label="Centrar red" onClick={onFit}>
				<Crosshair className="size-4" />
			</IconControl>
			<IconControl label="Reset norte" onClick={onResetNorth}>
				<Compass className="size-4" />
			</IconControl>
		</div>
	);
}

function IconControl({
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
			className="grid size-9 place-items-center border-r border-[rgba(164,164,164,0.12)] text-[#d7d7d7] transition-colors last:border-r-0 hover:bg-white/10"
		>
			{children}
		</button>
	);
}

function routePointLabel(type: string) {
	return ROUTE_POINT_LABEL[type as keyof typeof ROUTE_POINT_LABEL] ?? type;
}

function routePointColor(type: string) {
	return ROUTE_POINT_COLOR[type as keyof typeof ROUTE_POINT_COLOR];
}
