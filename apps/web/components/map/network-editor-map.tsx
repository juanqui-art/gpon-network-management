"use client";

import { AlertTriangle, Layers, ListChecks, LocateFixed } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
	addEquipmentSourceAndLayers,
	buildEquipmentGeoJson,
	readonlyEquipmentZoomFilters,
	setEquipmentLayersFilter,
} from "@/components/map/equipment-layers";
import {
	ALERT_LEVEL_STYLES,
	buildOpticalBudgetAlerts,
	type OpticalBudgetAlert,
	type OpticalBudgetAlertLevel,
} from "@/components/map/logical-diagram/budget-alerts";
import { layoutTree } from "@/components/map/logical-diagram/layout-engine";
import { buildNetworkTree } from "@/components/map/logical-diagram/tree-builder";
import {
	InspectorRow,
	InspectorSection,
} from "@/components/map/map-inspector-primitives";
import { MapInspectorShell } from "@/components/map/map-inspector-shell";
import {
	MapControls,
	MapLegend,
	MapStatChip,
} from "@/components/map/map-overlay-components";
import {
	FIBER_RENDER_COLOR,
	hideNoisyMapLabels,
} from "@/components/map/mapbox-shared-style";
import { OltModelSelector } from "@/components/map/olt-model-selector";
import { OltTechnicalEditor } from "@/components/map/olt-technical-editor";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	FiberRoute,
	IncidentMapItem,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import { AppDrawer } from "@/components/ui/app-drawer";
import {
	buildOltModelProperties,
	propertyNumber,
	propertyString,
	withDefaultOltProperties,
} from "@/lib/gpon/olt-properties";
import { CABLE_LABEL, ROUTE_POINT_COLOR, TYPE_COLOR } from "@/lib/map/palette";
import {
	getRouteMidpoints,
	getRouteVertices,
	type RouteCoordinate,
} from "@/lib/map/route-geometry-editor";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE } from "@/lib/mapbox/config";
import type {
	EditorMode,
	EditorTool,
	Selection,
} from "@/lib/store/network-editor";
import type {
	DataQuality,
	ElementStatus,
	ElementType,
	FiberType,
	InstallationType,
	PonStandard,
	RoutePointType,
	RouteStatus,
	RouteType,
} from "@/lib/types/gpon";

interface NetworkEditorMapProps {
	token: string;
	equipment: EquipmentMapItem[];
	connections: ConnectionMapItem[];
	routePoints?: RoutePoint[];
	incidents?: IncidentMapItem[];
	mode: EditorMode;
	activeTool: EditorTool;
	chrome?: "full" | "minimal";
	createElementTypes?: ElementType[];
	draftRouteSourceId?: string | null;
	selection: Selection | null;
	onSelectionChange: (selection: Selection | null) => void;
	onStatusMessageChange?: (message: string) => void;
	onUpdateElement?: (id: string, patch: Partial<InfrastructureElement>) => void;
	onUpdateRoute?: (id: string, patch: Partial<FiberRoute>) => void;
	onInsertRouteVertex?: (
		id: string,
		afterIndex: number,
		coordinate: RouteCoordinate,
	) => void;
	onMapPlacement?: (position: { lng: number; lat: number }) => void;
	onMapElementCreate?: (
		type: ElementType,
		position: { lng: number; lat: number },
	) => void;
	onMapToolSelect?: (type: ElementType) => void;
	onMapClosureToolSelect?: (
		properties: Record<string, unknown>,
		label: string,
	) => void;
	onStartRouteFromElement?: (element: EquipmentMapItem) => void;
	onCreateRoutePoint?: (input: {
		route: ConnectionMapItem;
		type: RoutePointType;
		position: { lng: number; lat: number };
		properties?: Record<string, unknown>;
	}) => void;
	onMoveRouteVertex?: (
		id: string,
		vertexIndex: number,
		coordinate: RouteCoordinate,
	) => void;
	onMoveElement?: (id: string, lng: number, lat: number) => void;
}

type LeftPanelTab = "tools" | "layers" | "alerts";
type OpticalFilter = "all" | "alerts";
type SelectedFeature =
	| { kind: "element"; item: EquipmentMapItem }
	| { kind: "route"; item: ConnectionMapItem }
	| { kind: "routePoint"; item: RoutePoint };
type InspectorMode = "view" | "edit";
type ElementContextMenu =
	| {
			kind: "element";
			element: EquipmentMapItem;
			connectedRoutes: number;
			x: number;
			y: number;
	  }
	| {
			kind: "route";
			route: ConnectionMapItem;
			lng: number;
			lat: number;
			x: number;
			y: number;
	  }
	| {
			kind: "create";
			lng: number;
			lat: number;
			x: number;
			y: number;
	  };
type DraggingRouteVertex = {
	routeId: string;
	vertexIndex: number;
};

const TOOL_LABELS: Record<EditorTool, string> = {
	select: "Seleccionar",
	pan: "Mover mapa",
	olt: "OLT",
	splitter: "Splitter",
	nap: "NAP",
	closure: "Mufa",
	fiber: "Fibra",
	crossing: "Cruce",
	reserve: "Reserva",
	splice: "Empalme",
	measure: "Medir",
	delete: "Eliminar",
};

const ZOOM_ROUTE_POINTS = 15;
const EMPTY_INCIDENTS: IncidentMapItem[] = [];
const EDITOR_PANEL_TABS = [
	{ value: "tools" as const, label: "Resumen", icon: ListChecks },
	{ value: "layers" as const, label: "Capas", icon: Layers },
	{ value: "alerts" as const, label: "Alertas", icon: AlertTriangle },
];

function scheduleMapResize(map: mapboxgl.Map, shouldResize: () => boolean) {
	const frameIds = new Set<number>();
	const cancel = () => {
		for (const frameId of frameIds) cancelAnimationFrame(frameId);
		frameIds.clear();
	};
	const resizeIfCurrent = () => {
		if (shouldResize()) map.resize();
	};

	const firstFrameId = requestAnimationFrame(() => {
		frameIds.delete(firstFrameId);
		resizeIfCurrent();

		const secondFrameId = requestAnimationFrame(() => {
			frameIds.delete(secondFrameId);
			resizeIfCurrent();
		});
		frameIds.add(secondFrameId);
	});
	frameIds.add(firstFrameId);

	return cancel;
}

export function NetworkEditorMap({
	token,
	equipment,
	connections,
	routePoints = [],
	incidents = EMPTY_INCIDENTS,
	mode,
	activeTool,
	chrome = "full",
	createElementTypes = ["olt", "splitter", "nap"],
	draftRouteSourceId = null,
	selection,
	onSelectionChange,
	onStatusMessageChange,
	onUpdateElement,
	onUpdateRoute,
	onInsertRouteVertex,
	onMapElementCreate,
	onMapPlacement,
	onMapToolSelect,
	onMapClosureToolSelect,
	onStartRouteFromElement,
	onCreateRoutePoint,
	onMoveRouteVertex,
	onMoveElement,
}: NetworkEditorMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const equipmentRef = useRef(equipment);
	const connectionsRef = useRef(connections);
	const routePointsRef = useRef(routePoints);
	const draftRouteSourceIdRef = useRef(draftRouteSourceId);
	const opticalAlertsByEquipmentRef = useRef<
		Map<string, OpticalBudgetAlertLevel>
	>(new Map());
	const onSelectionChangeRef = useRef(onSelectionChange);
	const onStatusMessageChangeRef = useRef(onStatusMessageChange);
	const onInsertRouteVertexRef = useRef(onInsertRouteVertex);
	const onMapElementCreateRef = useRef(onMapElementCreate);
	const onMapPlacementRef = useRef(onMapPlacement);
	const onMapToolSelectRef = useRef(onMapToolSelect);
	const onMapClosureToolSelectRef = useRef(onMapClosureToolSelect);
	const onStartRouteFromElementRef = useRef(onStartRouteFromElement);
	const onCreateRoutePointRef = useRef(onCreateRoutePoint);
	const onMoveRouteVertexRef = useRef(onMoveRouteVertex);
	const onMoveElementRef = useRef(onMoveElement);
	const [isReady, setIsReady] = useState(false);
	const [filterType, setFilterType] = useState("all");
	const [filterStatus, setFilterStatus] = useState("all");
	const [filterOptical, setFilterOptical] = useState<OpticalFilter>("all");
	const [leftTab, setLeftTab] = useState<LeftPanelTab>("tools");
	const [contextMenu, setContextMenu] = useState<ElementContextMenu | null>(
		null,
	);
	const [movingElement, setMovingElement] = useState<EquipmentMapItem | null>(
		null,
	);
	const [draggingRouteVertex, setDraggingRouteVertex] =
		useState<DraggingRouteVertex | null>(null);
	const movingElementRef = useRef<EquipmentMapItem | null>(null);
	const draggingRouteVertexRef = useRef<DraggingRouteVertex | null>(null);
	const activeToolRef = useRef(activeTool);
	const filterTypeRef = useRef(filterType);
	const filterStatusRef = useRef(filterStatus);
	const filterOpticalRef = useRef<OpticalFilter>(filterOptical);

	const incidentsByEquipment = useMemo(
		() => new Map(incidents.map((item) => [item.equipment_id, item])),
		[incidents],
	);

	const opticalAlerts = useMemo(() => {
		const infrastructureElements = equipment.filter(
			(item): item is EquipmentMapItem & InfrastructureElement =>
				item.type === "olt" || item.type === "splitter" || item.type === "nap",
		);
		const elementRecords = Object.fromEntries(
			infrastructureElements.map((item) => [item.id, item]),
		) as Record<string, InfrastructureElement>;
		const routeRecords = Object.fromEntries(
			connections.map((item) => [item.id, item]),
		) as Record<string, FiberRoute>;
		const routePointRecords = Object.fromEntries(
			routePoints.map((item) => [item.id, item]),
		) as Record<string, RoutePoint>;
		const tree = buildNetworkTree(
			elementRecords,
			routeRecords,
			routePointRecords,
		);
		const oltClasses = new Map<string, string | null>(
			tree.map((root) => [root.element.id, root.element.optical_class ?? null]),
		);
		const { nodes } = layoutTree(tree, oltClasses);
		return buildOpticalBudgetAlerts(nodes);
	}, [connections, equipment, routePoints]);
	const opticalAlertsByEquipment = useMemo(
		() =>
			new Map<string, OpticalBudgetAlertLevel>(
				opticalAlerts.map((alert) => [alert.id, alert.level]),
			),
		[opticalAlerts],
	);

	const visibleEquipment = useMemo(
		() =>
			equipment.filter((item) => {
				if (filterType !== "all" && item.type !== filterType) return false;
				if (filterStatus !== "all" && item.status !== filterStatus)
					return false;
				if (
					filterOptical === "alerts" &&
					!opticalAlertsByEquipment.has(item.id)
				)
					return false;
				return true;
			}),
		[
			equipment,
			filterOptical,
			filterStatus,
			filterType,
			opticalAlertsByEquipment,
		],
	);

	const visibleEquipmentIds = useMemo(
		() => new Set(visibleEquipment.map((item) => item.id)),
		[visibleEquipment],
	);

	const visibleConnections = useMemo(
		() =>
			connections.filter((route) => {
				if (route.geojson_coordinates.length < 2) return false;
				if (
					filterType === "all" &&
					filterStatus === "all" &&
					filterOptical === "all"
				)
					return true;
				return (
					visibleEquipmentIds.has(route.from_equipment_id) ||
					visibleEquipmentIds.has(route.to_equipment_id)
				);
			}),
		[connections, filterOptical, filterStatus, filterType, visibleEquipmentIds],
	);

	const counts = useMemo(
		() => ({
			olts: visibleEquipment.filter((item) => item.type === "olt").length,
			splitters: visibleEquipment.filter((item) => item.type === "splitter")
				.length,
			naps: visibleEquipment.filter((item) => item.type === "nap").length,
			routes: visibleConnections.length,
			routePoints: routePoints.length,
			totalKm:
				visibleConnections.reduce(
					(sum, item) => sum + (item.length_meters ?? 0),
					0,
				) / 1000,
		}),
		[routePoints.length, visibleConnections, visibleEquipment],
	);

	const selectedFeature = useMemo<SelectedFeature | null>(() => {
		if (!selection) return null;
		if (selection.kind === "element") {
			const item = equipment.find((candidate) => candidate.id === selection.id);
			return item ? { kind: "element", item } : null;
		}
		if (selection.kind === "route") {
			const item = connections.find(
				(candidate) => candidate.id === selection.id,
			);
			return item ? { kind: "route", item } : null;
		}
		const item = routePoints.find((candidate) => candidate.id === selection.id);
		return item ? { kind: "routePoint", item } : null;
	}, [connections, equipment, routePoints, selection]);
	const isPlacementTool =
		activeTool === "olt" ||
		activeTool === "splitter" ||
		activeTool === "nap" ||
		activeTool === "closure";
	const showEditorChrome = chrome === "full";

	equipmentRef.current = visibleEquipment;
	connectionsRef.current = visibleConnections;
	routePointsRef.current = routePoints;
	draftRouteSourceIdRef.current = draftRouteSourceId;
	opticalAlertsByEquipmentRef.current = opticalAlertsByEquipment;
	onSelectionChangeRef.current = onSelectionChange;
	onStatusMessageChangeRef.current = onStatusMessageChange;
	onInsertRouteVertexRef.current = onInsertRouteVertex;
	onMapElementCreateRef.current = onMapElementCreate;
	onMapPlacementRef.current = onMapPlacement;
	onMapToolSelectRef.current = onMapToolSelect;
	onMapClosureToolSelectRef.current = onMapClosureToolSelect;
	onStartRouteFromElementRef.current = onStartRouteFromElement;
	onCreateRoutePointRef.current = onCreateRoutePoint;
	onMoveRouteVertexRef.current = onMoveRouteVertex;
	onMoveElementRef.current = onMoveElement;
	activeToolRef.current = activeTool;
	filterTypeRef.current = filterType;
	filterStatusRef.current = filterStatus;
	filterOpticalRef.current = filterOptical;
	movingElementRef.current = movingElement;
	draggingRouteVertexRef.current = draggingRouteVertex;

	useEffect(() => {
		if (!containerRef.current) return;

		mapboxgl.accessToken = token;

		const map = new mapboxgl.Map({
			center: DEFAULT_CENTER,
			container: containerRef.current,
			style: MAP_STYLE,
			zoom: DEFAULT_ZOOM,
		});
		mapRef.current = map;
		const resizeCancelers = new Set<() => void>();
		const queueMapResize = () => {
			const cancelResize = scheduleMapResize(
				map,
				() =>
					mapRef.current === map && containerRef.current?.isConnected === true,
			);
			resizeCancelers.add(cancelResize);
			return cancelResize;
		};

		const resizeObserver = new ResizeObserver(() => {
			queueMapResize();
		});
		resizeObserver.observe(containerRef.current);

		map.on("load", () => {
			queueMapResize();
			hideNoisyMapLabels(map);
			map.addSource("editor-routes-v2", {
				type: "geojson",
				data: buildRoutesGeoJson(connectionsRef.current, equipmentRef.current),
			});
			addRouteLayers(map);
			map.addSource("editor-draft-route-v2", {
				type: "geojson",
				data: emptyFeatureCollection(),
			});
			addDraftRouteLayers(map);
			map.addSource("editor-route-points-v2", {
				type: "geojson",
				data: buildRoutePointsGeoJson(routePointsRef.current),
			});
			addRoutePointLayers(map);
			map.addSource("editor-route-geometry-v2", {
				type: "geojson",
				data: emptyFeatureCollection(),
			});
			addRouteGeometryEditLayers(map);
			void addEquipmentSourceAndLayers({
				map,
				sourceId: "editor-equipment-v2",
				layerPrefix: "editor-v2",
				data: buildEquipmentGeoJson(
					equipmentRef.current,
					incidentsByEquipment,
					opticalAlertsByEquipmentRef.current,
				),
			});
			setIsReady(true);
			requestAnimationFrame(() => {
				queueMapResize();
				fitToEquipment(map, equipmentRef.current, false);
				updateVisibility(
					map,
					filterTypeRef.current,
					filterStatusRef.current,
					filterOpticalRef.current,
				);
			});
		});

		const onZoom = () =>
			updateVisibility(
				map,
				filterTypeRef.current,
				filterStatusRef.current,
				filterOpticalRef.current,
			);
		const onRouteVertexMouseDown = (event: mapboxgl.MapLayerMouseEvent) => {
			const vertex = queryRouteGeometryVertex(event);
			if (!vertex || vertex.isLocked) return;
			event.preventDefault();
			map.dragPan.disable();
			setDraggingRouteVertex({
				routeId: vertex.routeId,
				vertexIndex: vertex.vertexIndex,
			});
			onStatusMessageChangeRef.current?.(
				"Arrastra el vértice y suelta para actualizar el trazado.",
			);
		};
		const onMouseMove = (event: mapboxgl.MapMouseEvent) => {
			if (draggingRouteVertexRef.current) {
				const canvas = map.getCanvas();
				canvas.style.cursor = "grabbing";
				onMoveRouteVertexRef.current?.(
					draggingRouteVertexRef.current.routeId,
					draggingRouteVertexRef.current.vertexIndex,
					[event.lngLat.lng, event.lngLat.lat],
				);
				return;
			}
			updateDraftRouteGuide(map, {
				activeTool: activeToolRef.current,
				equipment: equipmentRef.current,
				sourceId: draftRouteSourceIdRef.current,
				target: [event.lngLat.lng, event.lngLat.lat],
			});
		};
		const onMouseUp = () => {
			if (!draggingRouteVertexRef.current) return;
			setDraggingRouteVertex(null);
			map.dragPan.enable();
			map.getCanvas().style.cursor = "";
			onStatusMessageChangeRef.current?.(
				"Vértice actualizado. Guarda para persistir.",
			);
		};
		const onMidpointMouseEnter = () => {
			map.getCanvas().style.cursor = "copy";
			onStatusMessageChangeRef.current?.(
				"Click en punto medio para insertar un nuevo vértice.",
			);
		};
		const onMidpointMouseLeave = () => {
			if (!draggingRouteVertexRef.current) map.getCanvas().style.cursor = "";
		};
		const onVertexMouseEnter = (event: mapboxgl.MapLayerMouseEvent) => {
			const vertex = queryRouteGeometryVertex(event);
			map.getCanvas().style.cursor = vertex?.isLocked ? "not-allowed" : "grab";
			onStatusMessageChangeRef.current?.(
				vertex?.isLocked
					? "Extremo bloqueado: mueve el equipo conectado para cambiarlo."
					: "Arrastra el vértice para ajustar el trazado.",
			);
		};
		const onVertexMouseLeave = () => {
			if (!draggingRouteVertexRef.current) map.getCanvas().style.cursor = "";
		};
		const onClick = (event: mapboxgl.MapMouseEvent) => {
			setContextMenu(null);
			if (draggingRouteVertexRef.current) return;
			if (movingElementRef.current) {
				const element = movingElementRef.current;
				onMoveElementRef.current?.(
					element.id,
					event.lngLat.lng,
					event.lngLat.lat,
				);
				onSelectionChangeRef.current({ id: element.id, kind: "element" });
				onStatusMessageChangeRef.current?.(
					`${element.code}: ubicación actualizada. Guarda para persistir.`,
				);
				setMovingElement(null);
				return;
			}

			if (
				onMapPlacementRef.current &&
				(activeToolRef.current === "olt" ||
					activeToolRef.current === "splitter" ||
					activeToolRef.current === "nap" ||
					activeToolRef.current === "closure")
			) {
				onMapPlacementRef.current({
					lng: event.lngLat.lng,
					lat: event.lngLat.lat,
				});
				return;
			}

			const midpoint = queryRouteGeometryMidpoint(map, event.point);
			if (midpoint) {
				onInsertRouteVertexRef.current?.(
					midpoint.routeId,
					midpoint.insertAfterIndex,
					midpoint.coordinate,
				);
				onSelectionChangeRef.current({ id: midpoint.routeId, kind: "route" });
				onStatusMessageChangeRef.current?.(
					"Vértice agregado al trazado. Guarda para persistir.",
				);
				return;
			}

			const next = querySelection(
				map,
				event.point,
				equipmentRef.current,
				connectionsRef.current,
				routePointsRef.current,
			);
			onSelectionChangeRef.current(next);
			onStatusMessageChangeRef.current?.(
				next
					? `${selectionLabel(next.kind)} seleccionado.`
					: "Seleccion cancelada.",
			);
		};
		const onContextMenu = (event: mapboxgl.MapMouseEvent) => {
			event.originalEvent.preventDefault();
			const next = querySelection(
				map,
				event.point,
				equipmentRef.current,
				connectionsRef.current,
				routePointsRef.current,
			);
			if (next?.kind === "route") {
				const route = connectionsRef.current.find(
					(item) => item.id === next.id,
				);
				if (route && onCreateRoutePointRef.current) {
					setContextMenu({
						kind: "route",
						route,
						lng: event.lngLat.lng,
						lat: event.lngLat.lat,
						x: event.point.x,
						y: event.point.y,
					});
				} else {
					setContextMenu(null);
				}
				return;
			}
			if (next?.kind !== "element") {
				if (onMapElementCreateRef.current || onMapToolSelectRef.current) {
					setContextMenu({
						kind: "create",
						lng: event.lngLat.lng,
						lat: event.lngLat.lat,
						x: event.point.x,
						y: event.point.y,
					});
				} else {
					setContextMenu(null);
				}
				return;
			}
			const element = equipmentRef.current.find((item) => item.id === next.id);
			if (!element) {
				setContextMenu(null);
				return;
			}
			setContextMenu({
				kind: "element",
				element,
				connectedRoutes: connectionsRef.current.filter(
					(route) =>
						route.from_equipment_id === element.id ||
						route.to_equipment_id === element.id,
				).length,
				x: event.point.x,
				y: event.point.y,
			});
		};

		map.on("zoom", onZoom);
		map.on("click", onClick);
		map.on(
			"mousedown",
			"editor-route-geometry-v2-vertices",
			onRouteVertexMouseDown,
		);
		map.on("mousemove", onMouseMove);
		map.on("mouseup", onMouseUp);
		map.on(
			"mouseenter",
			"editor-route-geometry-v2-midpoints",
			onMidpointMouseEnter,
		);
		map.on(
			"mouseleave",
			"editor-route-geometry-v2-midpoints",
			onMidpointMouseLeave,
		);
		map.on(
			"mouseenter",
			"editor-route-geometry-v2-vertices",
			onVertexMouseEnter,
		);
		map.on(
			"mouseleave",
			"editor-route-geometry-v2-vertices",
			onVertexMouseLeave,
		);
		map.on("contextmenu", onContextMenu);

		return () => {
			resizeObserver.disconnect();
			for (const cancelResize of resizeCancelers) cancelResize();
			resizeCancelers.clear();
			map.off("zoom", onZoom);
			map.off("click", onClick);
			map.off(
				"mousedown",
				"editor-route-geometry-v2-vertices",
				onRouteVertexMouseDown,
			);
			map.off("mousemove", onMouseMove);
			map.off("mouseup", onMouseUp);
			map.off(
				"mouseenter",
				"editor-route-geometry-v2-midpoints",
				onMidpointMouseEnter,
			);
			map.off(
				"mouseleave",
				"editor-route-geometry-v2-midpoints",
				onMidpointMouseLeave,
			);
			map.off(
				"mouseenter",
				"editor-route-geometry-v2-vertices",
				onVertexMouseEnter,
			);
			map.off(
				"mouseleave",
				"editor-route-geometry-v2-vertices",
				onVertexMouseLeave,
			);
			map.off("contextmenu", onContextMenu);
			map.remove();
			mapRef.current = null;
			setIsReady(false);
		};
	}, [incidentsByEquipment, token]);

	useEffect(() => {
		if (!isReady || !mapRef.current) return;
		const source = mapRef.current.getSource("editor-routes-v2") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(buildRoutesGeoJson(visibleConnections, visibleEquipment));
	}, [isReady, visibleConnections, visibleEquipment]);

	useEffect(() => {
		if (!isReady || !mapRef.current || draftRouteSourceId) return;
		const source = mapRef.current.getSource("editor-draft-route-v2") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(emptyFeatureCollection());
	}, [draftRouteSourceId, isReady]);

	useEffect(() => {
		if (!isReady || !mapRef.current) return;
		const source = mapRef.current.getSource("editor-route-points-v2") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(buildRoutePointsGeoJson(routePoints));
	}, [isReady, routePoints]);

	useEffect(() => {
		if (!isReady || !mapRef.current) return;
		const source = mapRef.current.getSource("editor-equipment-v2") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(
			buildEquipmentGeoJson(
				visibleEquipment,
				incidentsByEquipment,
				opticalAlertsByEquipment,
			),
		);
		updateVisibility(mapRef.current, filterType, filterStatus, filterOptical);
	}, [
		filterOptical,
		filterStatus,
		filterType,
		incidentsByEquipment,
		isReady,
		opticalAlertsByEquipment,
		visibleEquipment,
	]);

	useEffect(() => {
		if (!isReady || !mapRef.current) return;
		updateSelectionLayers(
			mapRef.current,
			selection,
			visibleEquipment,
			visibleConnections,
			routePoints,
		);
	}, [isReady, selection, visibleConnections, visibleEquipment, routePoints]);

	useEffect(() => {
		if (!isReady || !mapRef.current) return;
		const source = mapRef.current.getSource("editor-route-geometry-v2") as
			| mapboxgl.GeoJSONSource
			| undefined;
		source?.setData(
			buildSelectedRouteGeometryEditGeoJson(
				selection,
				visibleConnections,
				visibleEquipment,
			),
		);
	}, [isReady, selection, visibleConnections, visibleEquipment]);

	useEffect(() => {
		if (!mapRef.current) return;
		mapRef.current.getCanvas().style.cursor = movingElement
			? "crosshair"
			: isPlacementTool
				? "copy"
				: "";
		return () => {
			if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
		};
	}, [isPlacementTool, movingElement]);

	useEffect(() => {
		if (!movingElement) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setMovingElement(null);
			onStatusMessageChange?.("Movimiento cancelado.");
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [movingElement, onStatusMessageChange]);

	const focusSelectedFeature = () => {
		if (!mapRef.current || !selectedFeature) return;
		focusFeature(mapRef.current, selectedFeature);
	};

	const selectOpticalAlert = (alert: OpticalBudgetAlert) => {
		const element = equipment.find((item) => item.id === alert.id);
		if (!element) return;
		onSelectionChange({ id: alert.id, kind: "element" });
		if (mapRef.current) {
			focusFeature(mapRef.current, { kind: "element", item: element });
		}
	};
	const startMovingElement = (element: EquipmentMapItem) => {
		setContextMenu(null);
		setMovingElement(element);
		onStatusMessageChange?.(
			`${element.code}: haz click en el mapa para elegir la nueva ubicación. Esc para cancelar.`,
		);
	};
	const cancelMovingElement = () => {
		setMovingElement(null);
		onStatusMessageChange?.("Movimiento cancelado.");
	};

	return (
		<div
			className={`relative h-full min-h-0 overflow-hidden bg-[#1b1c1d] ${movingElement ? "cursor-crosshair" : ""} ${isPlacementTool ? "cursor-copy" : ""}`}
		>
			<div ref={containerRef} className="absolute inset-0 h-full w-full" />
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-[#1b1c1d]/70 to-transparent" />
			{isPlacementTool && !movingElement && (
				<div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border border-[rgba(52,211,153,0.3)] bg-[rgba(34,35,36,0.94)] px-3 py-2 text-xs text-[#86efac] shadow-2xl backdrop-blur-md">
					<span className="font-medium">
						Colocando {TOOL_LABELS[activeTool]}
					</span>
					: click izquierdo en el mapa para crear
				</div>
			)}
			{movingElement && (
				<div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(34,35,36,0.94)] px-3 py-2 text-xs text-[#fbbf24] shadow-2xl backdrop-blur-md">
					<span className="font-medium">{movingElement.code}</span>: click en el
					mapa para reubicar · Esc para cancelar ·{" "}
					<button
						type="button"
						onClick={cancelMovingElement}
						className="text-[#d7d7d7] underline-offset-2 hover:underline"
					>
						Cancelar
					</button>
				</div>
			)}
			{contextMenu && (
				<div
					className="absolute z-40 min-w-44 overflow-hidden rounded-lg border border-[rgba(164,164,164,0.16)] bg-[rgba(34,35,36,0.96)] p-1 text-xs text-[#d7d7d7] shadow-2xl backdrop-blur-md"
					style={{ left: contextMenu.x, top: contextMenu.y }}
				>
					{contextMenu.kind === "element" ? (
						<>
							<div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#777879]">
								{contextMenu.element.code}
							</div>
							<div className="border-[rgba(164,164,164,0.1)] border-b px-3 pb-2 text-[11px] text-[#a4a4a4]">
								{contextMenu.connectedRoutes === 0
									? "Sin fibras conectadas."
									: `${contextMenu.connectedRoutes} fibra${
											contextMenu.connectedRoutes === 1 ? "" : "s"
										} conectada${
											contextMenu.connectedRoutes === 1 ? "" : "s"
										} se actualizará${
											contextMenu.connectedRoutes === 1 ? "" : "n"
										}.`}
							</div>
							<button
								type="button"
								onClick={() => startMovingElement(contextMenu.element)}
								className="block w-full rounded-md px-3 py-2 text-left text-[#fbbf24] transition-colors hover:bg-[rgba(245,158,11,0.12)]"
							>
								Mover elemento
							</button>
							{onStartRouteFromElementRef.current && (
								<button
									type="button"
									onClick={() => {
										onStartRouteFromElementRef.current?.(contextMenu.element);
										setContextMenu(null);
									}}
									className="block w-full rounded-md px-3 py-2 text-left text-[#8bdff4] transition-colors hover:bg-[rgba(56,216,255,0.12)]"
								>
									Crear fibra desde aquí
								</button>
							)}
						</>
					) : contextMenu.kind === "route" ? (
						<>
							<div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#777879]">
								{contextMenu.route.code ?? "Ruta de fibra"}
							</div>
							<button
								type="button"
								onClick={() => {
									onCreateRoutePointRef.current?.({
										route: contextMenu.route,
										type: "mufa",
										position: { lng: contextMenu.lng, lat: contextMenu.lat },
										properties: { closure_type: "mufa" },
									});
									setContextMenu(null);
								}}
								className="block w-full rounded-md px-3 py-2 text-left text-[#8bdff4] transition-colors hover:bg-[rgba(56,216,255,0.12)]"
							>
								Agregar mufa
							</button>
							<button
								type="button"
								onClick={() => {
									onCreateRoutePointRef.current?.({
										route: contextMenu.route,
										type: "mufa",
										position: { lng: contextMenu.lng, lat: contextMenu.lat },
										properties: {
											closure_type: "mufa",
											has_midspan_access: true,
										},
									});
									setContextMenu(null);
								}}
								className="block w-full rounded-md px-3 py-2 text-left text-[#f6c768] transition-colors hover:bg-[rgba(246,199,104,0.12)]"
							>
								Agregar mufa + sangrado
							</button>
							<button
								type="button"
								onClick={() => {
									onCreateRoutePointRef.current?.({
										route: contextMenu.route,
										type: "mufa",
										position: { lng: contextMenu.lng, lat: contextMenu.lat },
										properties: {
											closure_type: "mufa",
											has_splice: true,
										},
									});
									setContextMenu(null);
								}}
								className="block w-full rounded-md px-3 py-2 text-left text-[#a7f3d0] transition-colors hover:bg-[rgba(52,211,153,0.12)]"
							>
								Agregar mufa + empalme
							</button>
							<button
								type="button"
								onClick={() => {
									onCreateRoutePointRef.current?.({
										route: contextMenu.route,
										type: "mufa",
										position: { lng: contextMenu.lng, lat: contextMenu.lat },
										properties: {
											closure_type: "mufa",
											has_splitter: true,
											split_ratio: "1:4",
										},
									});
									setContextMenu(null);
								}}
								className="block w-full rounded-md px-3 py-2 text-left text-[#a7f3d0] transition-colors hover:bg-[rgba(52,211,153,0.12)]"
							>
								Agregar mufa + splitter
							</button>
							<button
								type="button"
								onClick={() => {
									onCreateRoutePointRef.current?.({
										route: contextMenu.route,
										type: "mufa",
										position: { lng: contextMenu.lng, lat: contextMenu.lat },
										properties: {
											closure_type: "mufa",
											has_midspan_access: true,
											has_splitter: true,
											split_ratio: "1:4",
										},
									});
									setContextMenu(null);
								}}
								className="block w-full rounded-md px-3 py-2 text-left text-[#a7f3d0] transition-colors hover:bg-[rgba(52,211,153,0.12)]"
							>
								Agregar mufa + sangrado + splitter
							</button>
						</>
					) : (
						<>
							<div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#777879]">
								Crear elemento
							</div>
							{createElementTypes.map((elementType) => (
								<button
									key={elementType}
									type="button"
									onClick={() => {
										if (onMapToolSelectRef.current) {
											onMapToolSelectRef.current(elementType);
										} else {
											onMapElementCreateRef.current?.(elementType, {
												lng: contextMenu.lng,
												lat: contextMenu.lat,
											});
										}
										setContextMenu(null);
									}}
									className="block w-full rounded-md px-3 py-2 text-left text-[#d7d7d7] transition-colors hover:bg-[rgba(52,211,153,0.1)] hover:text-[#34d399]"
								>
									Crear {TOOL_LABELS[elementType]}
								</button>
							))}
							{onMapClosureToolSelectRef.current && (
								<>
									<div className="my-1 border-t border-white/10" />
									<button
										type="button"
										onClick={() => {
											onMapClosureToolSelectRef.current?.(
												{ closure_type: "mufa" },
												"Mufa",
											);
											setContextMenu(null);
										}}
										className="block w-full rounded-md px-3 py-2 text-left text-[#8bdff4] transition-colors hover:bg-[rgba(56,216,255,0.12)]"
									>
										Crear mufa
									</button>
									<button
										type="button"
										onClick={() => {
											onMapClosureToolSelectRef.current?.(
												{ closure_type: "mufa", has_midspan_access: true },
												"Mufa + sangrado",
											);
											setContextMenu(null);
										}}
										className="block w-full rounded-md px-3 py-2 text-left text-[#f6c768] transition-colors hover:bg-[rgba(246,199,104,0.12)]"
									>
										Crear mufa + sangrado
									</button>
									<button
										type="button"
										onClick={() => {
											onMapClosureToolSelectRef.current?.(
												{ closure_type: "mufa", has_splice: true },
												"Mufa + empalme",
											);
											setContextMenu(null);
										}}
										className="block w-full rounded-md px-3 py-2 text-left text-[#a7f3d0] transition-colors hover:bg-[rgba(52,211,153,0.12)]"
									>
										Crear mufa + empalme
									</button>
									<button
										type="button"
										onClick={() => {
											onMapClosureToolSelectRef.current?.(
												{
													closure_type: "mufa",
													has_splitter: true,
													split_ratio: "1:4",
												},
												"Mufa + splitter",
											);
											setContextMenu(null);
										}}
										className="block w-full rounded-md px-3 py-2 text-left text-[#a7f3d0] transition-colors hover:bg-[rgba(52,211,153,0.12)]"
									>
										Crear mufa + splitter
									</button>
									<button
										type="button"
										onClick={() => {
											onMapClosureToolSelectRef.current?.(
												{
													closure_type: "mufa",
													has_midspan_access: true,
													has_splitter: true,
													split_ratio: "1:4",
												},
												"Mufa + sangrado + splitter",
											);
											setContextMenu(null);
										}}
										className="block w-full rounded-md px-3 py-2 text-left text-[#a7f3d0] transition-colors hover:bg-[rgba(52,211,153,0.12)]"
									>
										Crear mufa + sangrado + splitter
									</button>
								</>
							)}
						</>
					)}
					<button
						type="button"
						onClick={() => setContextMenu(null)}
						className="block w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-[rgba(164,164,164,0.08)]"
					>
						Cancelar
					</button>
				</div>
			)}
			{showEditorChrome && (
				<>
					<div className="absolute left-4 top-4 z-20">
						<EditorLeftPanel
							activeTool={activeTool}
							alerts={opticalAlerts}
							counts={counts}
							filterOptical={filterOptical}
							filterStatus={filterStatus}
							filterType={filterType}
							mode={mode}
							onAlertSelect={selectOpticalAlert}
							onFit={() =>
								fitToEquipment(mapRef.current, visibleEquipment, true)
							}
							onOpticalChange={setFilterOptical}
							onStatusChange={setFilterStatus}
							onTabChange={setLeftTab}
							onTypeChange={setFilterType}
							tab={leftTab}
						/>
					</div>
					<div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
						<EditorMapStatus activeTool={activeTool} mode={mode} />
						<MapLegend />
						<MapControls
							onFit={() =>
								fitToEquipment(mapRef.current, visibleEquipment, true)
							}
							onResetNorth={() => mapRef.current?.resetNorth()}
							onZoomIn={() => mapRef.current?.zoomIn()}
							onZoomOut={() => mapRef.current?.zoomOut()}
						/>
					</div>
				</>
			)}
			<AnimatePresence mode="wait">
				{showEditorChrome && selectedFeature && (
					<SelectionInspector
						key={`${selectedFeature.kind}:${selectedFeature.item.id}`}
						feature={selectedFeature}
						equipment={equipment}
						opticalAlert={
							selectedFeature.kind === "element"
								? (opticalAlerts.find(
										(alert) => alert.id === selectedFeature.item.id,
									) ?? null)
								: null
						}
						onClose={() => onSelectionChange(null)}
						onFocus={focusSelectedFeature}
						onUpdateElement={onUpdateElement}
						onUpdateRoute={onUpdateRoute}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

function EditorLeftPanel({
	activeTool,
	alerts,
	counts,
	filterOptical,
	filterStatus,
	filterType,
	mode,
	onAlertSelect,
	onFit,
	onOpticalChange,
	onStatusChange,
	onTabChange,
	onTypeChange,
	tab,
}: {
	activeTool: EditorTool;
	alerts: OpticalBudgetAlert[];
	counts: {
		olts: number;
		splitters: number;
		naps: number;
		routes: number;
		routePoints: number;
		totalKm: number;
	};
	filterOptical: OpticalFilter;
	filterStatus: string;
	filterType: string;
	mode: EditorMode;
	onAlertSelect: (alert: OpticalBudgetAlert) => void;
	onFit: () => void;
	onOpticalChange: (filter: OpticalFilter) => void;
	onStatusChange: (status: string) => void;
	onTabChange: (tab: LeftPanelTab) => void;
	onTypeChange: (type: string) => void;
	tab: LeftPanelTab;
}) {
	return (
		<div className="hidden md:block">
			<AppDrawer
				open
				onOpenChange={() => {}}
				title="Editor de red"
				description="Herramientas, filtros y alertas del lienzo operativo."
				direction="left"
				modal={false}
				dismissible={false}
				showOverlay={false}
				showClose={false}
				size="md"
				className="md:!left-4 md:!right-auto md:!top-4 md:!bottom-4 md:!w-72 bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md"
				contentClassName="space-y-3"
			>
				<div className="border-b border-[rgba(164,164,164,0.12)] px-3 py-2.5">
					<div className="mb-2.5 grid grid-cols-4 gap-1.5">
						<MapStatChip
							label="OLT"
							value={counts.olts}
							color={TYPE_COLOR.olt}
						/>
						<MapStatChip
							label="SPL"
							value={counts.splitters}
							color={TYPE_COLOR.splitter}
						/>
						<MapStatChip
							label="NAP"
							value={counts.naps}
							color={TYPE_COLOR.nap}
						/>
						<MapStatChip
							label="km"
							value={counts.totalKm.toFixed(1)}
							color="#a4a4a4"
						/>
					</div>
					<div className="grid grid-cols-3 gap-1 rounded-md bg-[rgba(164,164,164,0.05)] p-1">
						{EDITOR_PANEL_TABS.map(({ value, label, icon: Icon }) => (
							<button
								key={value}
								type="button"
								onClick={() => onTabChange(value)}
								className={tabButtonClass(tab === value)}
							>
								<Icon className="size-3" aria-hidden="true" />
								<span>{label}</span>
								{value === "alerts" && alerts.length > 0 && (
									<span className="rounded bg-[#f59e0b]/20 px-1 font-mono text-[9px] text-[#fbbf24]">
										{alerts.length}
									</span>
								)}
							</button>
						))}
					</div>
				</div>
				<div className="space-y-3 p-3">
					{tab === "tools" ? (
						<div className="space-y-3">
							<div className="flex items-center justify-between rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.04)] px-3 py-2">
								<div>
									<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
										Área
									</p>
									<p className="mt-0.5 text-xs font-semibold text-[#e6e6e6]">
										{formatEditorMode(mode)}
									</p>
								</div>
								<ListChecks className="size-4 text-[#fbbf24]" />
							</div>
							<div className="space-y-1.5 rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(164,164,164,0.04)] p-2.5 text-xs">
								<StatRow label="Rutas" value={counts.routes} />
								<StatRow label="Puntos de ruta" value={counts.routePoints} />
								<StatRow label="Herramienta" value={TOOL_LABELS[activeTool]} />
							</div>
							<button
								type="button"
								onClick={onFit}
								className="flex w-full items-center justify-center gap-2 rounded-md border border-[rgba(164,164,164,0.14)] bg-[rgba(164,164,164,0.06)] px-3 py-2 text-xs text-[#d7d7d7] transition-colors hover:bg-[rgba(164,164,164,0.1)]"
							>
								<LocateFixed className="size-3.5" /> Ajustar vista
							</button>
						</div>
					) : tab === "layers" ? (
						<div className="space-y-3">
							<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
								Filtros de visibilidad
							</p>
							<label className="block">
								<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
									Tipo
								</span>
								<select
									value={filterType}
									onChange={(event) => onTypeChange(event.target.value)}
									className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2 py-2 text-xs text-[#e6e6e6] outline-none"
								>
									<option value="all">Todos</option>
									<option value="olt">OLT</option>
									<option value="splitter">Splitter</option>
									<option value="nap">NAP</option>
								</select>
							</label>
							<label className="block">
								<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
									Estado
								</span>
								<select
									value={filterStatus}
									onChange={(event) => onStatusChange(event.target.value)}
									className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2 py-2 text-xs text-[#e6e6e6] outline-none"
								>
									<option value="all">Todos</option>
									<option value="planned">Planificado</option>
									<option value="active">Activo</option>
									<option value="inactive">Inactivo</option>
									<option value="faulty">Con falla</option>
								</select>
							</label>
							<label className="block">
								<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
									Óptico
								</span>
								<select
									value={filterOptical}
									onChange={(event) =>
										onOpticalChange(event.target.value as OpticalFilter)
									}
									className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2 py-2 text-xs text-[#e6e6e6] outline-none"
								>
									<option value="all">Todos</option>
									<option value="alerts">Solo alertas</option>
								</select>
							</label>
							<div className="space-y-1.5 rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(164,164,164,0.04)] p-2.5 text-xs">
								<StatRow label="Rutas" value={counts.routes} />
								<StatRow label="Puntos de ruta" value={counts.routePoints} />
							</div>
						</div>
					) : (
						<MapOpticalAlerts
							alerts={alerts}
							filterOptical={filterOptical}
							onFilterChange={onOpticalChange}
							onSelect={onAlertSelect}
						/>
					)}
				</div>
			</AppDrawer>
		</div>
	);
}

function MapOpticalAlerts({
	alerts,
	filterOptical,
	onFilterChange,
	onSelect,
}: {
	alerts: OpticalBudgetAlert[];
	filterOptical: OpticalFilter;
	onFilterChange: (filter: OpticalFilter) => void;
	onSelect: (alert: OpticalBudgetAlert) => void;
}) {
	if (alerts.length === 0) {
		return (
			<div className="rounded-md border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.08)] p-3 text-xs">
				<p className="font-semibold text-[#86efac]">Sin alertas ópticas</p>
				<p className="mt-1 text-[11px] leading-4 text-[#8f969e]">
					Los elementos calculados mantienen margen suficiente.
				</p>
			</div>
		);
	}

	const deficientCount = alerts.filter(
		(alert) => alert.level === "deficient",
	).length;
	const tightCount = alerts.length - deficientCount;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
					Presupuesto óptico
				</p>
				<span className="font-mono text-[10px] text-[#fbbf24]">
					{alerts.length}
				</span>
			</div>
			<div className="grid grid-cols-2 gap-1.5">
				<OpticalAlertCountPill
					color="#fb4d6d"
					label="Deficientes"
					value={deficientCount}
				/>
				<OpticalAlertCountPill
					color="#f59e0b"
					label="Ajustadas"
					value={tightCount}
				/>
			</div>
			<button
				type="button"
				onClick={() =>
					onFilterChange(filterOptical === "alerts" ? "all" : "alerts")
				}
				className="flex w-full items-center justify-between rounded-md border border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.08)] px-2.5 py-2 text-left text-xs text-[#fbbf24] transition-colors hover:bg-[rgba(245,158,11,0.13)]"
			>
				<span>
					{filterOptical === "alerts"
						? "Mostrar toda la red"
						: "Ver solo alertas"}
				</span>
				<span className="font-mono text-[10px]">
					{filterOptical === "alerts" ? "ON" : "OFF"}
				</span>
			</button>
			<button
				type="button"
				onClick={() => onSelect(alerts[0])}
				className="flex w-full items-center justify-between rounded-md border border-[rgba(251,77,109,0.24)] bg-[rgba(251,77,109,0.08)] px-2.5 py-2 text-left text-xs text-[#fb7185] transition-colors hover:bg-[rgba(251,77,109,0.13)]"
			>
				<span>Ir al peor margen</span>
				<span className="font-mono text-[10px]">
					{alerts[0].margin?.toFixed(1)} dB
				</span>
			</button>
			<div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
				{alerts.map((alert) => {
					const style = ALERT_LEVEL_STYLES[alert.level];
					return (
						<button
							key={alert.id}
							type="button"
							onClick={() => onSelect(alert)}
							className="w-full rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
							style={{
								backgroundColor: style.bg,
								borderColor: style.border,
							}}
							title={alert.reason}
						>
							<span
								className="text-[9px] font-bold uppercase tracking-[0.12em]"
								style={{ color: style.color }}
							>
								{style.label}
							</span>
							<span className="mt-0.5 block truncate text-xs font-semibold text-[#e6e6e6]">
								{alert.code} · {alert.type}
							</span>
							<span className="mt-1 block font-mono text-[10px] text-[#a4a4a4]">
								Margen {alert.margin?.toFixed(1)} dB
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function OpticalAlertCountPill({
	color,
	label,
	value,
}: {
	color: string;
	label: string;
	value: number;
}) {
	return (
		<div className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1.5">
			<p className="font-mono text-xs font-bold" style={{ color }}>
				{value}
			</p>
			<p className="text-[9px] font-semibold uppercase text-[#777879]">
				{label}
			</p>
		</div>
	);
}

function SelectionInspector({
	equipment,
	feature,
	opticalAlert,
	onClose,
	onFocus,
	onUpdateElement,
	onUpdateRoute,
}: {
	equipment: EquipmentMapItem[];
	feature: SelectedFeature;
	opticalAlert: OpticalBudgetAlert | null;
	onClose: () => void;
	onFocus: () => void;
	onUpdateElement?: (id: string, patch: Partial<InfrastructureElement>) => void;
	onUpdateRoute?: (id: string, patch: Partial<FiberRoute>) => void;
}) {
	const title = getFeatureTitle(feature);
	const subtitle = getFeatureSubtitle(feature);
	const accent = getFeatureAccent(feature);
	const [inspectorMode, setInspectorMode] = useState<InspectorMode>("view");

	return (
		<MapInspectorShell
			accent={accent}
			actions={
				inspectorMode === "view" ? (
					<div className="grid grid-cols-2 gap-2 pt-1">
						<button
							type="button"
							onClick={onFocus}
							className="flex items-center justify-center gap-2 rounded-md border border-[rgba(56,216,255,0.25)] bg-[rgba(56,216,255,0.1)] px-3 py-2 text-xs font-medium text-[#bdeafe] transition-colors hover:bg-[rgba(56,216,255,0.16)]"
						>
							<LocateFixed className="size-3.5" />
							Centrar
						</button>
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-[rgba(164,164,164,0.14)] bg-[rgba(164,164,164,0.06)] px-3 py-2 text-xs font-medium text-[#d7d7d7] transition-colors hover:bg-[rgba(164,164,164,0.1)]"
						>
							Cerrar
						</button>
					</div>
				) : null
			}
			onClose={onClose}
			subtitle={subtitle}
			title={title}
		>
			{feature.kind === "element" && (
				<ElementInspectorDetails
					element={feature.item}
					isEditing={inspectorMode === "edit"}
					opticalAlert={opticalAlert}
					onCancelEdit={() => setInspectorMode("view")}
					onStartEdit={() => setInspectorMode("edit")}
					onUpdateElement={onUpdateElement}
				/>
			)}
			{feature.kind === "route" && (
				<RouteInspectorDetails
					equipment={equipment}
					isEditing={inspectorMode === "edit"}
					onCancelEdit={() => setInspectorMode("view")}
					onStartEdit={() => setInspectorMode("edit")}
					onUpdateRoute={onUpdateRoute}
					route={feature.item}
				/>
			)}
			{feature.kind === "routePoint" && (
				<RoutePointInspectorDetails point={feature.item} />
			)}
		</MapInspectorShell>
	);
}

function ElementInspectorDetails({
	element,
	isEditing,
	opticalAlert,
	onCancelEdit,
	onStartEdit,
	onUpdateElement,
}: {
	element: EquipmentMapItem;
	isEditing: boolean;
	opticalAlert: OpticalBudgetAlert | null;
	onCancelEdit: () => void;
	onStartEdit: () => void;
	onUpdateElement?: (id: string, patch: Partial<InfrastructureElement>) => void;
}) {
	const [name, setName] = useState(element.name ?? "");
	const [status, setStatus] = useState<ElementStatus>(
		normalizeElementStatus(element.status),
	);
	const [ponStandard, setPonStandard] = useState<PonStandard | null>(
		element.pon_standard,
	);
	const [opticalClass, setOpticalClass] = useState(element.optical_class);
	const [totalPonPorts, setTotalPonPorts] = useState(element.total_pon_ports);
	const [properties, setProperties] = useState<Record<string, unknown>>(
		element.type === "olt"
			? withDefaultOltProperties(element.properties)
			: element.properties,
	);
	const [addressReference, setAddressReference] = useState(
		element.address_reference ?? "",
	);
	const [notes, setNotes] = useState(element.notes ?? "");
	const [managementIp, setManagementIp] = useState(element.management_ip ?? "");

	useEffect(() => {
		setName(element.name ?? "");
		setStatus(normalizeElementStatus(element.status));
		setPonStandard(element.pon_standard);
		setOpticalClass(element.optical_class);
		setTotalPonPorts(element.total_pon_ports);
		setProperties(
			element.type === "olt"
				? withDefaultOltProperties(element.properties)
				: element.properties,
		);
		setAddressReference(element.address_reference ?? "");
		setNotes(element.notes ?? "");
		setManagementIp(element.management_ip ?? "");
	}, [element]);

	const applyChanges = () => {
		const patch: Partial<InfrastructureElement> = {
			name: emptyToNull(name),
			status,
			address_reference: emptyToNull(addressReference),
			notes: emptyToNull(notes),
		};
		if (element.type === "olt") {
			patch.pon_standard = ponStandard;
			patch.optical_class = emptyToNull(opticalClass ?? "");
			patch.total_pon_ports = totalPonPorts;
			patch.properties = properties;
			patch.management_ip = emptyToNull(managementIp);
		}
		onUpdateElement?.(element.id, patch);
		onCancelEdit();
	};

	if (isEditing) {
		return (
			<div className="space-y-3">
				<div className="rounded-md border border-[rgba(56,216,255,0.18)] bg-[rgba(56,216,255,0.07)] px-3 py-2 text-[11px] leading-4 text-[#bdeafe]">
					Aplicar actualiza el borrador local. Usa Guardar en la barra superior
					para persistir en Supabase.
				</div>
				<InspectorSection title="Identificación">
					<InspectorRow label="Tipo" value={formatElementType(element.type)} />
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Nombre
						</span>
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						/>
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Estado
						</span>
						<select
							value={status}
							onChange={(event) =>
								setStatus(event.target.value as ElementStatus)
							}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						>
							<option value="planned">Planificado</option>
							<option value="active">Activo</option>
							<option value="inactive">Inactivo</option>
							<option value="faulty">Con falla</option>
							<option value="retired">Retirado</option>
						</select>
					</label>
				</InspectorSection>
				{element.type === "olt" && (
					<InspectorSection title="OLT técnica">
						<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] p-3">
							<OltModelSelector
								selectedModelId={propertyString(properties, "olt_model_id")}
								selectedOpticalClass={opticalClass}
								onSelect={(model) => {
									const next = buildOltModelProperties(model, properties);
									setProperties(next.properties);
									setPonStandard(model.ponStandard);
									setOpticalClass(model.opticalClass);
									setTotalPonPorts(next.totalPonPorts);
								}}
							/>
						</div>
						<label className="block">
							<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
								IP de gestión (SNMP)
							</span>
							<input
								value={managementIp}
								onChange={(event) => setManagementIp(event.target.value)}
								placeholder="192.168.1.100"
								className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 font-mono text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
							/>
							<span className="mt-1 block text-[10px] leading-4 text-[#777879]">
								Se enlaza con el colector SNMP. Aparecerá como nombre del OLT en
								/monitoring cuando llegue telemetría.
							</span>
						</label>
						<OltTechnicalEditor
							properties={properties}
							totalPonPorts={totalPonPorts}
							onPropertiesChange={setProperties}
							onTotalPonPortsChange={setTotalPonPorts}
						/>
					</InspectorSection>
				)}
				<InspectorSection title="Ubicación">
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Referencia de dirección
						</span>
						<input
							value={addressReference}
							onChange={(event) => setAddressReference(event.target.value)}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						/>
					</label>
				</InspectorSection>
				<InspectorSection title="Notas">
					<label className="block">
						<textarea
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							rows={3}
							className="w-full resize-none rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						/>
					</label>
				</InspectorSection>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={applyChanges}
						className="rounded-md border border-[rgba(52,211,153,0.35)] bg-[rgba(52,211,153,0.12)] px-3 py-2 text-xs font-medium text-[#34d399] transition-colors hover:bg-[rgba(52,211,153,0.18)]"
					>
						Aplicar cambios
					</button>
					<button
						type="button"
						onClick={onCancelEdit}
						className="rounded-md border border-[rgba(164,164,164,0.14)] bg-[rgba(164,164,164,0.06)] px-3 py-2 text-xs font-medium text-[#d7d7d7] transition-colors hover:bg-[rgba(164,164,164,0.1)]"
					>
						Descartar edición
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{opticalAlert && <OpticalAlertInspectorCard alert={opticalAlert} />}
			<InspectorSection title="Identificación">
				<InspectorRow label="Tipo" value={formatElementType(element.type)} />
				<InspectorRow
					label="Estado"
					value={formatElementStatus(element.status)}
				/>
				<InspectorRow label="Nombre" value={element.name} />
			</InspectorSection>
			{element.type === "olt" && (
				<InspectorSection title="OLT técnica">
					<InspectorRow
						label="Modelo"
						value={propertyString(
							element.properties,
							"olt_model",
							"Sin modelo",
						)}
					/>
					<InspectorRow label="IP gestión" value={element.management_ip} />
					<InspectorRow label="Clase óptica" value={element.optical_class} />
					<InspectorRow
						label="PON instalados"
						value={element.total_pon_ports}
					/>
					<InspectorRow
						label="Tarjetas"
						value={`${propertyNumber(element.properties, "service_cards_installed") ?? "—"} / ${propertyNumber(element.properties, "service_slots_total") ?? "—"}`}
					/>
					<InspectorRow
						label="Split diseño"
						value={propertyString(
							element.properties,
							"design_split_ratio",
							"—",
						)}
					/>
					<InspectorRow
						label="Clientes estimados"
						value={propertyNumber(element.properties, "estimated_subscribers")}
					/>
					<InspectorRow
						label="Cabecera"
						value={`${propertyNumber(element.properties, "headend_loss_db")?.toFixed(1) ?? "—"} dB`}
					/>
					<InspectorRow
						label="Patchcord"
						value={propertyString(
							element.properties,
							"headend_patchcord_type",
							"—",
						)}
					/>
				</InspectorSection>
			)}
			<InspectorSection title="Ubicación">
				<InspectorRow
					label="Calidad"
					value={formatDataQuality(element.location_quality)}
				/>
				<InspectorRow
					label="Coordenadas"
					value={`${formatCoordinate(element.lat)}, ${formatCoordinate(element.lng)}`}
				/>
				<InspectorRow label="Referencia" value={element.address_reference} />
			</InspectorSection>
			<InspectorSection title="Capacidad">
				<InspectorRow label="Puertos totales" value={element.total_ports} />
				<InspectorRow label="Puertos usados" value={element.ports_used} />
				<InspectorRow label="Split ratio" value={element.split_ratio} />
			</InspectorSection>
			<InspectorSection title="Notas">
				<InspectorRow label="Notas" value={element.notes} />
			</InspectorSection>
			{onUpdateElement && (
				<button
					type="button"
					onClick={onStartEdit}
					className="mt-1 w-full rounded-md border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-3 py-2 text-xs font-medium text-[#fbbf24] transition-colors hover:bg-[rgba(245,158,11,0.16)]"
				>
					Editar propiedades
				</button>
			)}
		</div>
	);
}

function OpticalAlertInspectorCard({ alert }: { alert: OpticalBudgetAlert }) {
	const style = ALERT_LEVEL_STYLES[alert.level];
	const recommendation =
		alert.level === "deficient"
			? "Revisar split ratio, pérdida medida del tramo y clase óptica antes de activar nuevos clientes."
			: "Priorizar verificación de empalmes, conectores y reservas antes de ampliar cobertura.";

	return (
		<div
			className="rounded-md border px-3 py-2 text-xs"
			style={{ backgroundColor: style.bg, borderColor: style.border }}
		>
			<div className="flex items-center justify-between gap-3">
				<span
					className="text-[10px] font-bold uppercase tracking-[0.12em]"
					style={{ color: style.color }}
				>
					Presupuesto {style.label.toLowerCase()}
				</span>
				<span className="font-mono text-[11px]" style={{ color: style.color }}>
					{alert.margin?.toFixed(1)} dB
				</span>
			</div>
			<p className="mt-1 text-[11px] leading-4 text-[#c8c8c8]">
				{alert.reason}.
			</p>
			<p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-4 text-[#a4a4a4]">
				{recommendation}
			</p>
		</div>
	);
}

function RouteInspectorDetails({
	equipment,
	isEditing,
	onCancelEdit,
	onStartEdit,
	onUpdateRoute,
	route,
}: {
	equipment: EquipmentMapItem[];
	isEditing: boolean;
	onCancelEdit: () => void;
	onStartEdit: () => void;
	onUpdateRoute?: (id: string, patch: Partial<FiberRoute>) => void;
	route: ConnectionMapItem;
}) {
	const from = equipment.find((item) => item.id === route.from_equipment_id);
	const to = equipment.find((item) => item.id === route.to_equipment_id);
	const [code, setCode] = useState(route.code ?? "");
	const [type, setType] = useState<RouteType>(route.type);
	const [status, setStatus] = useState<RouteStatus>(route.status);
	const [routeQuality, setRouteQuality] = useState<DataQuality>(
		route.route_quality,
	);
	const [installationType, setInstallationType] = useState<
		InstallationType | ""
	>(route.installation_type ?? "");
	const [fiberType, setFiberType] = useState<FiberType | "">(
		route.fiber_type ?? "",
	);
	const [fiberCount, setFiberCount] = useState(
		route.fiber_count == null ? "" : String(route.fiber_count),
	);
	const [reservation, setReservation] = useState(
		route.reservation_m == null ? "" : String(route.reservation_m),
	);
	const [notes, setNotes] = useState(route.notes ?? "");

	useEffect(() => {
		setCode(route.code ?? "");
		setType(route.type);
		setStatus(route.status);
		setRouteQuality(route.route_quality);
		setInstallationType(route.installation_type ?? "");
		setFiberType(route.fiber_type ?? "");
		setFiberCount(route.fiber_count == null ? "" : String(route.fiber_count));
		setReservation(
			route.reservation_m == null ? "" : String(route.reservation_m),
		);
		setNotes(route.notes ?? "");
	}, [route]);

	const applyChanges = () => {
		const reservationTrim = reservation.trim();
		const reservationValue =
			reservationTrim === "" ? 0 : Math.max(0, Number(reservationTrim));
		onUpdateRoute?.(route.id, {
			code: emptyToNull(code),
			type,
			status,
			route_quality: routeQuality,
			installation_type: installationType === "" ? null : installationType,
			fiber_type: fiberType === "" ? null : fiberType,
			fiber_count: fiberCount.trim() === "" ? null : Number(fiberCount),
			reservation_m: Number.isFinite(reservationValue) ? reservationValue : 0,
			notes: emptyToNull(notes),
		});
		onCancelEdit();
	};

	if (isEditing) {
		return (
			<div className="space-y-3">
				<div className="rounded-md border border-[rgba(56,216,255,0.18)] bg-[rgba(56,216,255,0.07)] px-3 py-2 text-[11px] leading-4 text-[#bdeafe]">
					Aplicar actualiza el borrador local. Usa Guardar en la barra superior
					para persistir en Supabase.
				</div>
				<InspectorSection title="Identificación">
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Código
						</span>
						<input
							value={code}
							onChange={(event) => setCode(event.target.value)}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						/>
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Tipo
						</span>
						<select
							value={type}
							onChange={(event) => setType(event.target.value as RouteType)}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						>
							<option value="feeder">Feeder</option>
							<option value="distribution">Distribución</option>
							<option value="other">Otra</option>
						</select>
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Estado
						</span>
						<select
							value={status}
							onChange={(event) => setStatus(event.target.value as RouteStatus)}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						>
							<option value="planned">Planificada</option>
							<option value="installed">Instalada</option>
							<option value="active">Activa</option>
							<option value="damaged">Dañada</option>
							<option value="retired">Retirada</option>
						</select>
					</label>
				</InspectorSection>
				<InspectorSection title="Cable">
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Instalación
						</span>
						<select
							value={installationType}
							onChange={(event) =>
								setInstallationType(event.target.value as InstallationType | "")
							}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						>
							<option value="">Sin definir</option>
							<option value="aerial">Aérea</option>
							<option value="underground">Subterránea</option>
							<option value="duct">Ducto</option>
							<option value="facade">Fachada</option>
						</select>
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Tipo de fibra
						</span>
						<select
							value={fiberType}
							onChange={(event) =>
								setFiberType(event.target.value as FiberType | "")
							}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						>
							<option value="">Sin definir</option>
							<option value="g652d">G.652D</option>
							<option value="g657a1">G.657A1</option>
							<option value="g657a2">G.657A2</option>
						</select>
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Hilos
						</span>
						<input
							min={0}
							type="number"
							value={fiberCount}
							onChange={(event) => setFiberCount(event.target.value)}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						/>
					</label>
				</InspectorSection>
				<InspectorSection title="Geometría">
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Calidad de ruta
						</span>
						<select
							value={routeQuality}
							onChange={(event) =>
								setRouteQuality(event.target.value as DataQuality)
							}
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						>
							<option value="verified">Verificada</option>
							<option value="gps_captured">GPS</option>
							<option value="drawn">Dibujada</option>
							<option value="approximate">Aproximada</option>
							<option value="unknown">Desconocida</option>
						</select>
					</label>
					<InspectorRow
						label="Longitud"
						value={
							route.length_meters == null
								? null
								: `${route.length_meters.toFixed(1)} m`
						}
					/>
					<label className="block">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Reserva (m)
						</span>
						<input
							min={0}
							step={0.1}
							type="number"
							value={reservation}
							onChange={(event) => setReservation(event.target.value)}
							placeholder="0"
							className="w-full rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
						/>
						<span className="mt-1 block text-[10px] text-[#777879]">
							Slack físico (bucles, holgura). Suma a la pérdida óptica del
							tramo.
						</span>
					</label>
				</InspectorSection>
				<InspectorSection title="Notas">
					<textarea
						value={notes}
						onChange={(event) => setNotes(event.target.value)}
						rows={3}
						className="w-full resize-none rounded-md border border-[rgba(164,164,164,0.16)] bg-[#1b1c1d] px-2.5 py-2 text-xs text-[#e6e6e6] outline-none transition-colors focus:border-[#38d8ff]/40"
					/>
				</InspectorSection>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={applyChanges}
						className="rounded-md border border-[rgba(52,211,153,0.35)] bg-[rgba(52,211,153,0.12)] px-3 py-2 text-xs font-medium text-[#34d399] transition-colors hover:bg-[rgba(52,211,153,0.18)]"
					>
						Aplicar cambios
					</button>
					<button
						type="button"
						onClick={onCancelEdit}
						className="rounded-md border border-[rgba(164,164,164,0.14)] bg-[rgba(164,164,164,0.06)] px-3 py-2 text-xs font-medium text-[#d7d7d7] transition-colors hover:bg-[rgba(164,164,164,0.1)]"
					>
						Descartar edición
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<InspectorSection title="Identificación">
				<InspectorRow label="Código" value={route.code} />
				<InspectorRow label="Tipo" value={route.type} />
				<InspectorRow label="Estado" value={route.status} />
			</InspectorSection>
			<InspectorSection title="Cable">
				<InspectorRow label="Cable" value={route.cable_type ?? route.type} />
				<InspectorRow label="Fibra" value={route.fiber_type} />
				<InspectorRow label="Hilos" value={route.fiber_count} />
				<InspectorRow
					label="Longitud"
					value={
						route.length_meters == null
							? null
							: `${route.length_meters.toFixed(1)} m`
					}
				/>
				<InspectorRow
					label="Reserva"
					value={
						route.reservation_m > 0
							? `${route.reservation_m.toFixed(1)} m`
							: "—"
					}
				/>
			</InspectorSection>
			<InspectorSection title="Topología">
				<InspectorRow
					label="Origen"
					value={from?.code ?? route.from_equipment_id}
				/>
				<InspectorRow
					label="Destino"
					value={to?.code ?? route.to_equipment_id}
				/>
				<InspectorRow
					label="Vértices"
					value={route.geojson_coordinates.length}
				/>
			</InspectorSection>
			<InspectorSection title="Notas">
				<InspectorRow label="Notas" value={route.notes} />
			</InspectorSection>
			{onUpdateRoute && (
				<button
					type="button"
					onClick={onStartEdit}
					className="mt-1 w-full rounded-md border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-3 py-2 text-xs font-medium text-[#fbbf24] transition-colors hover:bg-[rgba(245,158,11,0.16)]"
				>
					Editar propiedades
				</button>
			)}
		</div>
	);
}

function RoutePointInspectorDetails({ point }: { point: RoutePoint }) {
	const mufaDescription =
		point.type === "mufa" ? describeMufaProperties(point.properties) : null;

	return (
		<div className="space-y-2">
			<InspectorRow label="Tipo" value={point.type} />
			{mufaDescription && (
				<InspectorRow label="Configuración" value={mufaDescription} />
			)}
			<InspectorRow label="Estado" value={point.status} />
			<InspectorRow label="Ruta" value={point.fiber_route_id} />
			<InspectorRow label="Calidad ubicación" value={point.location_quality} />
			<InspectorRow
				label="Coordenadas"
				value={`${formatCoordinate(point.lat)}, ${formatCoordinate(point.lng)}`}
			/>
			<InspectorRow
				label="Posición"
				value={
					point.position_on_route_m == null
						? null
						: `${point.position_on_route_m.toFixed(1)} m`
				}
			/>
			<InspectorRow label="Reserva" value={point.reserve_length_m} />
			<InspectorRow label="Riesgo" value={point.risk_level} />
			<InspectorRow label="Referencia" value={point.reference_text} />
			{point.type === "mufa" && (
				<>
					<InspectorRow
						label="Sangrado"
						value={point.properties.has_midspan_access === true ? "Sí" : "No"}
					/>
					<InspectorRow
						label="Empalme"
						value={point.properties.has_splice === true ? "Sí" : "No"}
					/>
					<InspectorRow
						label="Splitter"
						value={
							point.properties.has_splitter === true
								? `Sí (${String(point.properties.split_ratio ?? "sin ratio")})`
								: "No"
						}
					/>
				</>
			)}
		</div>
	);
}

function describeMufaProperties(properties: Record<string, unknown>) {
	const details = [];
	if (properties.has_midspan_access === true) details.push("sangrado");
	if (properties.has_splice === true) details.push("empalme");
	if (properties.has_splitter === true) details.push("splitter");
	return details.length > 0 ? `Mufa + ${details.join(" + ")}` : "Mufa simple";
}

function mufaVariant(properties: Record<string, unknown>) {
	if (
		properties.has_midspan_access === true &&
		properties.has_splitter === true
	) {
		return "midspan_splitter";
	}
	if (properties.has_midspan_access === true) return "midspan";
	if (properties.has_splice === true) return "splice";
	if (properties.has_splitter === true) return "splitter";
	return "simple";
}

function addRouteLayers(map: mapboxgl.Map) {
	map.addLayer({
		id: "editor-routes-v2-halo",
		type: "line",
		source: "editor-routes-v2",
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			"line-color": "rgba(8,13,24,0.72)",
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				9,
				4.4,
				14,
				6.2,
				18,
				8.8,
			],
			"line-opacity": 0.58,
			"line-blur": 0.2,
			"line-emissive-strength": 0.35,
		},
	});
	map.addLayer({
		id: "editor-routes-v2-glow",
		type: "line",
		source: "editor-routes-v2",
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			"line-color": routeColorExpression(),
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				9,
				3.2,
				14,
				5.2,
				18,
				7.8,
			],
			"line-opacity": 0.24,
			"line-blur": 1.6,
			"line-emissive-strength": 0.75,
		},
	});
	map.addLayer({
		id: "editor-routes-v2-line",
		type: "line",
		source: "editor-routes-v2",
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			"line-color": routeColorExpression(),
			"line-width": [
				"interpolate",
				["linear"],
				["zoom"],
				9,
				1.7,
				14,
				2.9,
				18,
				4.4,
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
			"line-opacity": 0.82,
			"line-emissive-strength": 0.85,
		},
	});
	map.addLayer({
		id: "editor-routes-v2-hitbox",
		type: "line",
		source: "editor-routes-v2",
		layout: { "line-cap": "round", "line-join": "round" },
		paint: { "line-color": "rgba(255,255,255,0)", "line-width": 18 },
	});
	map.addLayer({
		id: "editor-routes-v2-labels",
		type: "symbol",
		source: "editor-routes-v2",
		layout: {
			"symbol-placement": "line-center",
			"text-allow-overlap": false,
			"text-field": ["coalesce", ["get", "label"], ["get", "code"], ""],
			"text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
			"text-letter-spacing": 0.04,
			"text-offset": [0, -0.7],
			"text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 17, 12],
		},
		paint: {
			"text-color": "#dff8ff",
			"text-halo-color": "rgba(17,18,19,0.92)",
			"text-halo-width": 1.6,
			"text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 0.92],
		},
	});
	map.addSource("editor-selection-v2", {
		type: "geojson",
		data: emptyFeatureCollection(),
	});
	map.addLayer({
		id: "editor-selection-v2-halo",
		type: "line",
		source: "editor-selection-v2",
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			"line-color": "rgba(2,6,23,0.86)",
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 7.5, 16, 12],
			"line-opacity": 0.95,
			"line-blur": 0.4,
			"line-emissive-strength": 0.55,
		},
	});
	map.addLayer({
		id: "editor-selection-v2-line",
		type: "line",
		source: "editor-selection-v2",
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			"line-color": "#f59e0b",
			"line-width": ["interpolate", ["linear"], ["zoom"], 9, 4.2, 16, 7],
			"line-opacity": 0.98,
			"line-emissive-strength": 1,
		},
	});
	map.addLayer({
		id: "editor-selection-v2-point",
		type: "circle",
		source: "editor-selection-v2",
		paint: {
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 20, 16, 34],
			"circle-color": "rgba(245,158,11,0.14)",
			"circle-stroke-color": "#fbbf24",
			"circle-stroke-width": 1.8,
		},
	});
}

function addDraftRouteLayers(map: mapboxgl.Map) {
	map.addLayer({
		id: "editor-draft-route-v2-glow",
		type: "line",
		source: "editor-draft-route-v2",
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			"line-color": "#38d8ff",
			"line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 18, 9],
			"line-opacity": 0.22,
			"line-blur": 2.2,
			"line-emissive-strength": 0.95,
		},
	});
	map.addLayer({
		id: "editor-draft-route-v2-line",
		type: "line",
		source: "editor-draft-route-v2",
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			"line-color": "#8bdff4",
			"line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 18, 4],
			"line-dasharray": ["literal", [1.4, 1.2]],
			"line-opacity": 0.9,
			"line-emissive-strength": 0.95,
		},
	});
}

function addRoutePointLayers(map: mapboxgl.Map) {
	map.addLayer({
		id: "editor-route-points-v2-circle",
		type: "circle",
		source: "editor-route-points-v2",
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
				"mufa",
				[
					"match",
					["get", "mufa_variant"],
					"midspan_splitter",
					"#34d399",
					"midspan",
					"#f6c768",
					"splice",
					"#fb7185",
					"splitter",
					"#a7f3d0",
					ROUTE_POINT_COLOR.mufa,
				],
				"#d7d7d7",
			],
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				14,
				["case", ["==", ["get", "type"], "mufa"], 4, 3],
				18,
				["case", ["==", ["get", "type"], "mufa"], 8, 6],
			],
			"circle-stroke-color": "#1b1c1d",
			"circle-stroke-width": 1.5,
		},
	});
	map.addLayer({
		id: "editor-route-points-v2-labels",
		type: "symbol",
		source: "editor-route-points-v2",
		layout: {
			"text-allow-overlap": false,
			"text-field": ["coalesce", ["get", "label"], ["get", "code"], ""],
			"text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
			"text-offset": [0, 1.25],
			"text-size": ["interpolate", ["linear"], ["zoom"], 14, 9, 18, 11],
			visibility: "none",
		},
		paint: {
			"text-color": "#dff8ff",
			"text-halo-color": "rgba(17,18,19,0.92)",
			"text-halo-width": 1.4,
			"text-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.9],
		},
	});
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
					fiber_count: route.fiber_count,
					label: formatRouteMapLabel(route),
				},
			})),
	};
}

function formatRouteMapLabel(route: ConnectionMapItem) {
	const fiberLabel = route.fiber_count == null ? null : `${route.fiber_count}F`;
	return [route.code, fiberLabel].filter(Boolean).join(" · ");
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
					fiber_route_id: point.fiber_route_id,
					type: point.type,
					code: point.code,
					label:
						point.type === "mufa"
							? describeMufaProperties(point.properties)
							: point.code,
					mufa_variant:
						point.type === "mufa" ? mufaVariant(point.properties) : null,
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
	if (coordinates.length <= 2)
		return [
			[from.lng, from.lat],
			[to.lng, to.lat],
		];
	return [[from.lng, from.lat], ...coordinates.slice(1, -1), [to.lng, to.lat]];
}

function updateVisibility(
	map: mapboxgl.Map,
	filterType: string,
	filterStatus: string,
	filterOptical: OpticalFilter,
) {
	const zoom = map.getZoom();
	const filters = readonlyEquipmentZoomFilters(zoom);
	if (filterType !== "all") filters.push(["==", "type", filterType]);
	if (filterStatus !== "all") filters.push(["==", "status", filterStatus]);
	if (filterOptical === "alerts")
		filters.push(["!=", "optical_alert_level", "none"]);
	setEquipmentLayersFilter(map, "editor-v2", filters);
	if (map.getLayer("editor-route-points-v2-circle")) {
		map.setLayoutProperty(
			"editor-route-points-v2-circle",
			"visibility",
			zoom >= ZOOM_ROUTE_POINTS ? "visible" : "none",
		);
	}
	if (map.getLayer("editor-route-points-v2-labels")) {
		map.setLayoutProperty(
			"editor-route-points-v2-labels",
			"visibility",
			zoom >= ZOOM_ROUTE_POINTS ? "visible" : "none",
		);
	}
}

function querySelection(
	map: mapboxgl.Map,
	point: mapboxgl.Point,
	equipment: EquipmentMapItem[],
	routes: ConnectionMapItem[],
	routePoints: RoutePoint[],
): Selection | null {
	const bbox: [[number, number], [number, number]] = [
		[point.x - 10, point.y - 10],
		[point.x + 10, point.y + 10],
	];

	const equipmentLayers = [
		"editor-v2-equipment-icons",
		"editor-equipment-v2-core",
		"editor-v2-equipment-core",
		"editor-v2-equipment-halo",
		"editor-v2-equipment-labels",
		"editor-v2-equipment-label-backing",
	].filter((layerId) => map.getLayer(layerId));
	if (equipmentLayers.length > 0) {
		const equipmentFeature = map
			.queryRenderedFeatures(bbox, { layers: equipmentLayers })
			.find((feature) => feature.properties?.equipment_id);
		if (
			equipmentFeature?.properties?.equipment_id &&
			equipment.some(
				(item) => item.id === equipmentFeature.properties?.equipment_id,
			)
		) {
			return { id: equipmentFeature.properties.equipment_id, kind: "element" };
		}
	}

	const routePointLayers = [
		"editor-route-points-v2-circle",
		"editor-route-points-v2-labels",
	].filter((layerId) => map.getLayer(layerId));
	if (routePointLayers.length > 0) {
		const routePointFeature = map
			.queryRenderedFeatures(bbox, { layers: routePointLayers })
			.find((feature) => feature.properties?.route_point_id);
		if (
			routePointFeature?.properties?.route_point_id &&
			routePoints.some(
				(item) => item.id === routePointFeature.properties?.route_point_id,
			)
		) {
			return {
				id: routePointFeature.properties.route_point_id,
				kind: "routePoint",
			};
		}
	}

	const routeLayers = [
		"editor-selection-v2-line",
		"editor-selection-v2-halo",
		"editor-routes-v2-labels",
		"editor-routes-v2-hitbox",
		"editor-routes-v2-line",
		"editor-routes-v2-glow",
		"editor-routes-v2-halo",
	].filter((layerId) => map.getLayer(layerId));
	if (routeLayers.length > 0) {
		const routeFeature = map
			.queryRenderedFeatures(bbox, { layers: routeLayers })
			.find((feature) => feature.properties?.connection_id);
		if (
			routeFeature?.properties?.connection_id &&
			routes.some((item) => item.id === routeFeature.properties?.connection_id)
		) {
			return { id: routeFeature.properties.connection_id, kind: "route" };
		}
	}

	return null;
}

function updateDraftRouteGuide(
	map: mapboxgl.Map,
	{
		activeTool,
		equipment,
		sourceId,
		target,
	}: {
		activeTool: EditorTool;
		equipment: EquipmentMapItem[];
		sourceId: string | null;
		target: [number, number];
	},
) {
	const source = map.getSource("editor-draft-route-v2") as
		| mapboxgl.GeoJSONSource
		| undefined;
	if (!source) return;
	if (activeTool !== "fiber" || !sourceId) {
		source.setData(emptyFeatureCollection());
		return;
	}
	const origin = equipment.find((item) => item.id === sourceId);
	if (!origin) {
		source.setData(emptyFeatureCollection());
		return;
	}
	source.setData({
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				geometry: {
					type: "LineString",
					coordinates: [[origin.lng, origin.lat], target],
				},
				properties: {
					source_id: sourceId,
				},
			},
		],
	});
}

function queryRouteGeometryMidpoint(
	map: mapboxgl.Map,
	point: mapboxgl.Point,
): {
	coordinate: RouteCoordinate;
	insertAfterIndex: number;
	routeId: string;
} | null {
	const layerId = "editor-route-geometry-v2-midpoints";
	if (!map.getLayer(layerId)) return null;
	const bbox: [[number, number], [number, number]] = [
		[point.x - 8, point.y - 8],
		[point.x + 8, point.y + 8],
	];
	const feature = map
		.queryRenderedFeatures(bbox, { layers: [layerId] })
		.find((candidate) => candidate.properties?.connection_id);
	if (
		!feature ||
		feature.geometry.type !== "Point" ||
		!feature.properties?.connection_id ||
		typeof feature.properties.insert_after_index !== "number"
	) {
		return null;
	}
	const [lng, lat] = feature.geometry.coordinates as [number, number];
	return {
		coordinate: [lng, lat],
		insertAfterIndex: feature.properties.insert_after_index,
		routeId: feature.properties.connection_id,
	};
}

function queryRouteGeometryVertex(event: mapboxgl.MapLayerMouseEvent): {
	isLocked: boolean;
	routeId: string;
	vertexIndex: number;
} | null {
	const feature = event.features?.find(
		(candidate) => candidate.properties?.connection_id,
	);
	if (
		!feature?.properties?.connection_id ||
		typeof feature.properties.index !== "number"
	) {
		return null;
	}
	return {
		isLocked: Boolean(feature.properties.isLocked),
		routeId: feature.properties.connection_id,
		vertexIndex: feature.properties.index,
	};
}

function updateSelectionLayers(
	map: mapboxgl.Map,
	selection: Selection | null,
	equipment: EquipmentMapItem[],
	routes: ConnectionMapItem[],
	routePoints: RoutePoint[],
) {
	const source = map.getSource("editor-selection-v2") as
		| mapboxgl.GeoJSONSource
		| undefined;
	if (!source || !selection) {
		source?.setData(emptyFeatureCollection());
		return;
	}

	if (selection.kind === "route") {
		const route = routes.find((item) => item.id === selection.id);
		if (!route) {
			source.setData(emptyFeatureCollection());
			return;
		}
		const equipmentById = new Map(equipment.map((item) => [item.id, item]));
		source.setData({
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					id: route.id,
					geometry: {
						type: "LineString",
						coordinates: snapConnectionEndpoints(route, equipmentById),
					},
					properties: {
						connection_id: route.id,
					},
				},
			],
		});
		return;
	}

	if (selection.kind === "routePoint") {
		const point = routePoints.find((item) => item.id === selection.id);
		source.setData(
			point
				? {
						type: "FeatureCollection",
						features: [
							{
								type: "Feature",
								id: point.id,
								geometry: {
									type: "Point",
									coordinates: [point.lng, point.lat],
								},
								properties: {
									route_point_id: point.id,
								},
							},
						],
					}
				: emptyFeatureCollection(),
		);
		return;
	}

	const element = equipment.find((item) => item.id === selection.id);
	source.setData(
		element
			? {
					type: "FeatureCollection",
					features: [
						{
							type: "Feature",
							id: element.id,
							geometry: {
								type: "Point",
								coordinates: [element.lng, element.lat],
							},
							properties: {
								equipment_id: element.id,
							},
						},
					],
				}
			: emptyFeatureCollection(),
	);
}

function fitToEquipment(
	map: mapboxgl.Map | null,
	equipment: EquipmentMapItem[],
	animate: boolean,
) {
	if (!map || equipment.length === 0) return;
	const bounds = new mapboxgl.LngLatBounds();
	for (const item of equipment) {
		if (Number.isFinite(item.lng) && Number.isFinite(item.lat))
			bounds.extend([item.lng, item.lat]);
	}
	if (bounds.isEmpty()) return;
	map.fitBounds(bounds, {
		duration: animate ? 650 : 0,
		maxZoom: 15,
		padding: { bottom: 96, left: 344, right: 96, top: 96 },
	});
}

function focusFeature(map: mapboxgl.Map, feature: SelectedFeature) {
	if (feature.kind === "element") {
		map.flyTo({
			center: [feature.item.lng, feature.item.lat],
			duration: 650,
			zoom: Math.max(map.getZoom(), 16),
		});
		return;
	}

	if (feature.kind === "routePoint") {
		map.flyTo({
			center: [feature.item.lng, feature.item.lat],
			duration: 650,
			zoom: Math.max(map.getZoom(), 17),
		});
		return;
	}

	const bounds = new mapboxgl.LngLatBounds();
	for (const coordinate of feature.item.geojson_coordinates) {
		bounds.extend(coordinate);
	}
	if (bounds.isEmpty()) return;
	map.fitBounds(bounds, {
		duration: 650,
		maxZoom: 16,
		padding: { bottom: 96, left: 344, right: 384, top: 96 },
	});
}

function getFeatureTitle(feature: SelectedFeature) {
	if (feature.kind === "element") {
		return feature.item.name || feature.item.code || feature.item.id;
	}
	if (feature.kind === "route") {
		return feature.item.code || "Ruta de fibra";
	}
	return feature.item.code || getRoutePointLabel(feature.item.type);
}

function getFeatureSubtitle(feature: SelectedFeature) {
	if (feature.kind === "element") {
		return `${formatElementType(feature.item.type)} · ${formatElementStatus(
			feature.item.status,
		)}`;
	}
	if (feature.kind === "route") {
		return CABLE_LABEL[feature.item.cable_type ?? feature.item.type] ?? "Fibra";
	}
	return getRoutePointLabel(feature.item.type);
}

function getFeatureAccent(feature: SelectedFeature) {
	if (feature.kind === "element") {
		return TYPE_COLOR[feature.item.type] ?? TYPE_COLOR.unknown;
	}
	if (feature.kind === "route") {
		return (
			FIBER_RENDER_COLOR[feature.item.cable_type ?? feature.item.type] ??
			FIBER_RENDER_COLOR.default
		);
	}
	return ROUTE_POINT_COLOR[feature.item.type] ?? "#d7d7d7";
}

function getRoutePointLabel(type: RoutePoint["type"]) {
	const labels: Record<string, string> = {
		crossing: "Cruce",
		reserve: "Reserva",
		splice: "Empalme",
	};
	return labels[type] ?? type;
}

function formatCoordinate(value: number) {
	return value.toFixed(6);
}

function formatElementType(type: EquipmentMapItem["type"]) {
	const labels: Record<string, string> = {
		olt: "OLT",
		nap: "NAP",
		closure: "Mufa",
		splitter: "Splitter",
		ont: "ONT",
	};
	return labels[type] ?? type;
}

function formatElementStatus(status: EquipmentMapItem["status"]) {
	const labels: Record<string, string> = {
		active: "Activo",
		alarm: "En alarma",
		faulty: "Con falla",
		inactive: "Inactivo",
		online: "En línea",
		planned: "Planificado",
		retired: "Retirado",
	};
	return labels[status] ?? status;
}

function formatDataQuality(quality: EquipmentMapItem["location_quality"]) {
	const labels: Record<string, string> = {
		approximate: "Aproximada",
		estimated: "Estimada",
		gps: "GPS",
		manual: "Manual",
		surveyed: "Levantada",
		unknown: "Desconocida",
		verified: "Verificada",
	};
	return labels[quality] ?? quality;
}

function emptyToNull(value: string) {
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function normalizeElementStatus(
	status: EquipmentMapItem["status"],
): ElementStatus {
	if (
		status === "planned" ||
		status === "active" ||
		status === "inactive" ||
		status === "faulty" ||
		status === "retired"
	) {
		return status;
	}
	return "active";
}

function routeColorExpression() {
	return [
		"match",
		["get", "cable_type"],
		"feeder",
		FIBER_RENDER_COLOR.feeder,
		"distribution",
		FIBER_RENDER_COLOR.distribution,
		"drop",
		FIBER_RENDER_COLOR.drop,
		FIBER_RENDER_COLOR.default,
	] as mapboxgl.ExpressionSpecification;
}

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
	return { type: "FeatureCollection", features: [] };
}

function selectionLabel(kind: Selection["kind"]) {
	if (kind === "element") return "Elemento";
	if (kind === "route") return "Ruta";
	return "Punto de ruta";
}

function formatEditorMode(mode: EditorMode) {
	if (mode === "view") return "Consulta";
	if (mode === "design") return "Captura";
	return "Edición de inventario";
}

function tabButtonClass(active: boolean) {
	return `flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[10px] font-medium transition-colors ${active ? "bg-[rgba(56,216,255,0.14)] text-[#bdeafe]" : "text-[#777879] hover:bg-[rgba(164,164,164,0.06)] hover:text-[#d7d7d7]"}`;
}

function StatRow({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-[#777879]">{label}</span>
			<span className="font-mono text-[#e6e6e6]">{value}</span>
		</div>
	);
}

function EditorMapStatus({
	activeTool,
	mode,
}: {
	activeTool: EditorTool;
	mode: EditorMode;
}) {
	return (
		<div className="rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.9)] px-3 py-2 text-xs text-[#a4a4a4] shadow-2xl backdrop-blur-md">
			<AnimatePresence mode="wait" initial={false}>
				<motion.span
					key={mode}
					initial={{ opacity: 0, y: -3 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 3 }}
					transition={{ duration: 0.14 }}
					className="inline-block"
				>
					{formatEditorMode(mode)}
				</motion.span>
			</AnimatePresence>
			{" · "}
			{TOOL_LABELS[activeTool]}
		</div>
	);
}

function addRouteGeometryEditLayers(map: mapboxgl.Map) {
	map.addLayer({
		id: "editor-route-geometry-v2-midpoint-halo",
		type: "circle",
		source: "editor-route-geometry-v2",
		filter: ["==", ["get", "kind"], "midpoint"],
		paint: {
			"circle-color": "rgba(245,158,11,0.18)",
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 7, 18, 11],
			"circle-stroke-color": "rgba(251,191,36,0.42)",
			"circle-stroke-width": 1,
		},
	});
	map.addLayer({
		id: "editor-route-geometry-v2-midpoints",
		type: "circle",
		source: "editor-route-geometry-v2",
		filter: ["==", ["get", "kind"], "midpoint"],
		paint: {
			"circle-color": "#fef3c7",
			"circle-opacity": 0.98,
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3.5, 18, 5.5],
			"circle-stroke-color": "#f59e0b",
			"circle-stroke-width": 1.6,
		},
	});
	map.addLayer({
		id: "editor-route-geometry-v2-vertex-halo",
		type: "circle",
		source: "editor-route-geometry-v2",
		filter: ["==", ["get", "kind"], "vertex"],
		paint: {
			"circle-color": [
				"case",
				["get", "isLocked"],
				"rgba(251,191,36,0.2)",
				"rgba(56,216,255,0.22)",
			],
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				12,
				["case", ["get", "isLocked"], 9, 8],
				18,
				["case", ["get", "isLocked"], 13, 12],
			],
			"circle-stroke-color": [
				"case",
				["get", "isLocked"],
				"rgba(251,191,36,0.5)",
				"rgba(56,216,255,0.56)",
			],
			"circle-stroke-width": 1,
		},
	});
	map.addLayer({
		id: "editor-route-geometry-v2-vertices",
		type: "circle",
		source: "editor-route-geometry-v2",
		filter: ["==", ["get", "kind"], "vertex"],
		paint: {
			"circle-color": ["case", ["get", "isLocked"], "#fbbf24", "#67e8f9"],
			"circle-opacity": 0.98,
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				12,
				["case", ["get", "isLocked"], 5.8, 5.2],
				18,
				["case", ["get", "isLocked"], 8, 7.2],
			],
			"circle-stroke-color": [
				"case",
				["get", "isLocked"],
				"#78350f",
				"#083344",
			],
			"circle-stroke-width": ["case", ["get", "isLocked"], 2.2, 2],
		},
	});
}

function buildSelectedRouteGeometryEditGeoJson(
	selection: Selection | null,
	connections: ConnectionMapItem[],
	equipment: EquipmentMapItem[],
): GeoJSON.FeatureCollection {
	if (selection?.kind !== "route") return emptyFeatureCollection();
	const route = connections.find((item) => item.id === selection.id);
	if (!route) return emptyFeatureCollection();
	const equipmentById = new Map(equipment.map((item) => [item.id, item]));
	const coordinates = snapConnectionEndpoints(
		route,
		equipmentById,
	) as RouteCoordinate[];
	const vertices = getRouteVertices(coordinates);
	const midpoints = getRouteMidpoints(coordinates);
	return {
		type: "FeatureCollection",
		features: [
			...vertices.map((vertex) => ({
				type: "Feature" as const,
				id: `${route.id}:vertex:${vertex.index}`,
				geometry: {
					type: "Point" as const,
					coordinates: vertex.coordinate,
				},
				properties: {
					connection_id: route.id,
					index: vertex.index,
					isLocked: vertex.isLocked,
					kind: "vertex",
					role: vertex.role,
				},
			})),
			...midpoints.map((midpoint) => ({
				type: "Feature" as const,
				id: `${route.id}:midpoint:${midpoint.insertAfterIndex}`,
				geometry: {
					type: "Point" as const,
					coordinates: midpoint.coordinate,
				},
				properties: {
					connection_id: route.id,
					insert_after_index: midpoint.insertAfterIndex,
					isLocked: false,
					kind: "midpoint",
					role: "insert",
				},
			})),
		],
	};
}
