"use client";

import { LocateFixed, Minus, MousePointer2, Plus, X } from "lucide-react";
import mapboxgl from "mapbox-gl";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
	addEquipmentSourceAndLayers,
	buildEquipmentGeoJson,
	readonlyEquipmentZoomFilters,
	setEquipmentLayersFilter,
} from "@/components/map/equipment-layers";
import {
	FIBER_RENDER_COLOR,
	hideNoisyMapLabels,
} from "@/components/map/mapbox-shared-style";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	FiberRoute,
	IncidentMapItem,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import { ROUTE_POINT_COLOR, TYPE_COLOR } from "@/lib/map/palette";
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
	FiberType,
	InstallationType,
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
	onMoveRouteVertex?: (
		id: string,
		vertexIndex: number,
		coordinate: RouteCoordinate,
	) => void;
	onMoveElement?: (id: string, lng: number, lat: number) => void;
}

type LeftPanelTab = "tools" | "layers";
type SelectedFeature =
	| { kind: "element"; item: EquipmentMapItem }
	| { kind: "route"; item: ConnectionMapItem }
	| { kind: "routePoint"; item: RoutePoint };
type InspectorMode = "view" | "edit";
type ElementContextMenu = {
	element: EquipmentMapItem;
	connectedRoutes: number;
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
	fiber: "Fibra",
	crossing: "Cruce",
	reserve: "Reserva",
	splice: "Empalme",
	measure: "Medir",
	delete: "Eliminar",
};

const ZOOM_ROUTE_POINTS = 15;
const EMPTY_INCIDENTS: IncidentMapItem[] = [];

function scheduleMapResize(map: mapboxgl.Map) {
	requestAnimationFrame(() => {
		map.resize();
		requestAnimationFrame(() => map.resize());
	});
}

export function NetworkEditorMap({
	token,
	equipment,
	connections,
	routePoints = [],
	incidents = EMPTY_INCIDENTS,
	mode,
	activeTool,
	selection,
	onSelectionChange,
	onStatusMessageChange,
	onUpdateElement,
	onUpdateRoute,
	onInsertRouteVertex,
	onMoveRouteVertex,
	onMoveElement,
}: NetworkEditorMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const equipmentRef = useRef(equipment);
	const connectionsRef = useRef(connections);
	const routePointsRef = useRef(routePoints);
	const onSelectionChangeRef = useRef(onSelectionChange);
	const onStatusMessageChangeRef = useRef(onStatusMessageChange);
	const onInsertRouteVertexRef = useRef(onInsertRouteVertex);
	const onMoveRouteVertexRef = useRef(onMoveRouteVertex);
	const onMoveElementRef = useRef(onMoveElement);
	const [isReady, setIsReady] = useState(false);
	const [filterType, setFilterType] = useState("all");
	const [filterStatus, setFilterStatus] = useState("all");
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
	const filterTypeRef = useRef(filterType);
	const filterStatusRef = useRef(filterStatus);

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
			connections.filter((route) => {
				if (route.geojson_coordinates.length < 2) return false;
				if (filterType === "all" && filterStatus === "all") return true;
				return (
					visibleEquipmentIds.has(route.from_equipment_id) ||
					visibleEquipmentIds.has(route.to_equipment_id)
				);
			}),
		[connections, filterStatus, filterType, visibleEquipmentIds],
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

	equipmentRef.current = visibleEquipment;
	connectionsRef.current = visibleConnections;
	routePointsRef.current = routePoints;
	onSelectionChangeRef.current = onSelectionChange;
	onStatusMessageChangeRef.current = onStatusMessageChange;
	onInsertRouteVertexRef.current = onInsertRouteVertex;
	onMoveRouteVertexRef.current = onMoveRouteVertex;
	onMoveElementRef.current = onMoveElement;
	filterTypeRef.current = filterType;
	filterStatusRef.current = filterStatus;
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

		const resizeObserver = new ResizeObserver(() => {
			scheduleMapResize(map);
		});
		resizeObserver.observe(containerRef.current);

		map.on("load", () => {
			scheduleMapResize(map);
			hideNoisyMapLabels(map);
			map.addSource("editor-routes-v2", {
				type: "geojson",
				data: buildRoutesGeoJson(connectionsRef.current, equipmentRef.current),
			});
			addRouteLayers(map);
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
				data: buildEquipmentGeoJson(equipmentRef.current, incidentsByEquipment),
			});
			setIsReady(true);
			requestAnimationFrame(() => {
				scheduleMapResize(map);
				fitToEquipment(map, equipmentRef.current, false);
				updateVisibility(map, filterTypeRef.current, filterStatusRef.current);
			});
		});

		const onZoom = () =>
			updateVisibility(map, filterTypeRef.current, filterStatusRef.current);
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
			if (!draggingRouteVertexRef.current) return;
			const canvas = map.getCanvas();
			canvas.style.cursor = "grabbing";
			onMoveRouteVertexRef.current?.(
				draggingRouteVertexRef.current.routeId,
				draggingRouteVertexRef.current.vertexIndex,
				[event.lngLat.lng, event.lngLat.lat],
			);
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
			if (next?.kind !== "element") {
				setContextMenu(null);
				return;
			}
			const element = equipmentRef.current.find((item) => item.id === next.id);
			if (!element) {
				setContextMenu(null);
				return;
			}
			setContextMenu({
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
			buildEquipmentGeoJson(visibleEquipment, incidentsByEquipment),
		);
		updateVisibility(mapRef.current, filterType, filterStatus);
	}, [
		filterStatus,
		filterType,
		incidentsByEquipment,
		isReady,
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
		mapRef.current.getCanvas().style.cursor = movingElement ? "crosshair" : "";
		return () => {
			if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
		};
	}, [movingElement]);

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
			className={`relative h-full min-h-0 overflow-hidden bg-[#1b1c1d] ${movingElement ? "cursor-crosshair" : ""}`}
		>
			<div ref={containerRef} className="absolute inset-0 h-full w-full" />
			<div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-[#1b1c1d]/70 to-transparent" />
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
					<button
						type="button"
						onClick={() => setContextMenu(null)}
						className="block w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-[rgba(164,164,164,0.08)]"
					>
						Cancelar
					</button>
				</div>
			)}
			<div className="absolute left-4 top-4 z-20">
				<EditorLeftPanel
					activeTool={activeTool}
					counts={counts}
					filterStatus={filterStatus}
					filterType={filterType}
					mode={mode}
					onFit={() => fitToEquipment(mapRef.current, visibleEquipment, true)}
					onStatusChange={setFilterStatus}
					onTabChange={setLeftTab}
					onTypeChange={setFilterType}
					tab={leftTab}
				/>
			</div>
			<div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
				<div className="rounded-lg border border-[rgba(164,164,164,0.16)] bg-[rgba(34,35,36,0.9)] px-3 py-2 text-xs text-[#a4a4a4] shadow-2xl backdrop-blur-md">
					{mode === "view" ? "Vista" : mode === "design" ? "Crear" : "Editar"} ·{" "}
					{TOOL_LABELS[activeTool]}
				</div>
				<div className="flex overflow-hidden rounded-lg border border-[rgba(164,164,164,0.16)] bg-[rgba(34,35,36,0.9)] shadow-2xl backdrop-blur-md">
					<IconButton label="Acercar" onClick={() => mapRef.current?.zoomIn()}>
						<Plus className="size-4" />
					</IconButton>
					<IconButton label="Alejar" onClick={() => mapRef.current?.zoomOut()}>
						<Minus className="size-4" />
					</IconButton>
					<IconButton
						label="Ajustar"
						onClick={() =>
							fitToEquipment(mapRef.current, visibleEquipment, true)
						}
					>
						<LocateFixed className="size-4" />
					</IconButton>
				</div>
			</div>
			{selectedFeature && (
				<SelectionInspector
					key={`${selectedFeature.kind}:${selectedFeature.item.id}`}
					feature={selectedFeature}
					equipment={equipment}
					onClose={() => onSelectionChange(null)}
					onFocus={focusSelectedFeature}
					onUpdateElement={onUpdateElement}
					onUpdateRoute={onUpdateRoute}
				/>
			)}
		</div>
	);
}

function EditorLeftPanel({
	activeTool,
	counts,
	filterStatus,
	filterType,
	mode,
	onFit,
	onStatusChange,
	onTabChange,
	onTypeChange,
	tab,
}: {
	activeTool: EditorTool;
	counts: {
		olts: number;
		splitters: number;
		naps: number;
		routes: number;
		routePoints: number;
		totalKm: number;
	};
	filterStatus: string;
	filterType: string;
	mode: EditorMode;
	onFit: () => void;
	onStatusChange: (status: string) => void;
	onTabChange: (tab: LeftPanelTab) => void;
	onTypeChange: (type: string) => void;
	tab: LeftPanelTab;
}) {
	return (
		<div className="flex w-72 flex-col overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			<div className="border-b border-[rgba(164,164,164,0.12)] px-3 py-3">
				<div className="mb-3 flex items-center justify-between">
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
							Editor GPON
						</p>
						<p className="mt-1 text-sm font-semibold text-[#e6e6e6]">
							{mode === "view"
								? "Inspección"
								: mode === "design"
									? "Diseño"
									: "Edición"}
						</p>
					</div>
					<MousePointer2 className="size-4 text-[#38d8ff]" />
				</div>
				<div className="grid grid-cols-4 gap-1.5">
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
			</div>
			<div className="grid grid-cols-2 gap-1 border-b border-[rgba(164,164,164,0.12)] p-2">
				<button
					type="button"
					onClick={() => onTabChange("tools")}
					className={tabButtonClass(tab === "tools")}
				>
					Herramienta
				</button>
				<button
					type="button"
					onClick={() => onTabChange("layers")}
					className={tabButtonClass(tab === "layers")}
				>
					Capas
				</button>
			</div>
			<div className="space-y-3 p-3">
				{tab === "tools" ? (
					<div className="space-y-3">
						<div className="rounded-md border border-[rgba(56,216,255,0.2)] bg-[rgba(56,216,255,0.08)] p-3">
							<p className="text-[10px] uppercase tracking-widest text-[#7ddfff]">
								Activa
							</p>
							<p className="mt-1 text-sm font-semibold text-[#dff8ff]">
								{TOOL_LABELS[activeTool]}
							</p>
						</div>
						<button
							type="button"
							onClick={onFit}
							className="flex w-full items-center justify-center gap-2 rounded-md border border-[rgba(164,164,164,0.14)] bg-[rgba(164,164,164,0.06)] px-3 py-2 text-xs text-[#d7d7d7] transition-colors hover:bg-[rgba(164,164,164,0.1)]"
						>
							<LocateFixed className="size-3.5" /> Ajustar vista
						</button>
					</div>
				) : (
					<div className="space-y-3">
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
						<div className="space-y-1.5 rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(164,164,164,0.04)] p-2.5 text-xs">
							<StatRow label="Rutas" value={counts.routes} />
							<StatRow label="Puntos de ruta" value={counts.routePoints} />
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function SelectionInspector({
	equipment,
	feature,
	onClose,
	onFocus,
	onUpdateElement,
	onUpdateRoute,
}: {
	equipment: EquipmentMapItem[];
	feature: SelectedFeature;
	onClose: () => void;
	onFocus: () => void;
	onUpdateElement?: (id: string, patch: Partial<InfrastructureElement>) => void;
	onUpdateRoute?: (id: string, patch: Partial<FiberRoute>) => void;
}) {
	const title = getFeatureTitle(feature);
	const subtitle = selectionLabel(feature.kind);
	const [inspectorMode, setInspectorMode] = useState<InspectorMode>("view");

	return (
		<aside className="absolute right-4 top-4 z-20 w-80 overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.94)] text-[#d7d7d7] shadow-2xl backdrop-blur-md">
			<header className="flex items-start justify-between gap-3 border-b border-[rgba(164,164,164,0.12)] px-4 py-3">
				<div className="min-w-0">
					<p className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
						{subtitle}
					</p>
					<h2 className="mt-1 truncate text-sm font-semibold text-[#e6e6e6]">
						{title}
					</h2>
				</div>
				<button
					type="button"
					aria-label="Cerrar inspector"
					onClick={onClose}
					className="rounded-md p-1 text-[#777879] transition-colors hover:bg-[rgba(164,164,164,0.08)] hover:text-[#e6e6e6]"
				>
					<X className="size-4" />
				</button>
			</header>
			<div className="space-y-3 p-4">
				{feature.kind === "element" && (
					<ElementInspectorDetails
						element={feature.item}
						isEditing={inspectorMode === "edit"}
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
				{inspectorMode === "view" && (
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
				)}
			</div>
		</aside>
	);
}

function ElementInspectorDetails({
	element,
	isEditing,
	onCancelEdit,
	onStartEdit,
	onUpdateElement,
}: {
	element: EquipmentMapItem;
	isEditing: boolean;
	onCancelEdit: () => void;
	onStartEdit: () => void;
	onUpdateElement?: (id: string, patch: Partial<InfrastructureElement>) => void;
}) {
	const [name, setName] = useState(element.name ?? "");
	const [status, setStatus] = useState<ElementStatus>(
		normalizeElementStatus(element.status),
	);
	const [addressReference, setAddressReference] = useState(
		element.address_reference ?? "",
	);
	const [notes, setNotes] = useState(element.notes ?? "");

	useEffect(() => {
		setName(element.name ?? "");
		setStatus(normalizeElementStatus(element.status));
		setAddressReference(element.address_reference ?? "");
		setNotes(element.notes ?? "");
	}, [element]);

	const applyChanges = () => {
		onUpdateElement?.(element.id, {
			name: emptyToNull(name),
			status,
			address_reference: emptyToNull(addressReference),
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
			<InspectorSection title="Identificación">
				<InspectorRow label="Tipo" value={formatElementType(element.type)} />
				<InspectorRow
					label="Estado"
					value={formatElementStatus(element.status)}
				/>
				<InspectorRow label="Nombre" value={element.name} />
			</InspectorSection>
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
	const [notes, setNotes] = useState(route.notes ?? "");

	useEffect(() => {
		setCode(route.code ?? "");
		setType(route.type);
		setStatus(route.status);
		setRouteQuality(route.route_quality);
		setInstallationType(route.installation_type ?? "");
		setFiberType(route.fiber_type ?? "");
		setFiberCount(route.fiber_count == null ? "" : String(route.fiber_count));
		setNotes(route.notes ?? "");
	}, [route]);

	const applyChanges = () => {
		onUpdateRoute?.(route.id, {
			code: emptyToNull(code),
			type,
			status,
			route_quality: routeQuality,
			installation_type: installationType === "" ? null : installationType,
			fiber_type: fiberType === "" ? null : fiberType,
			fiber_count: fiberCount.trim() === "" ? null : Number(fiberCount),
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
	return (
		<div className="space-y-2">
			<InspectorRow label="Tipo" value={point.type} />
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
		</div>
	);
}

function InspectorRow({
	label,
	value,
}: {
	label: string;
	value: number | string | null | undefined;
}) {
	return (
		<div className="flex items-start justify-between gap-3 rounded-md border border-[rgba(164,164,164,0.08)] bg-[rgba(164,164,164,0.04)] px-2.5 py-2 text-xs">
			<span className="shrink-0 text-[#777879]">{label}</span>
			<span className="min-w-0 truncate text-right font-medium text-[#e6e6e6]">
				{formatInspectorValue(value)}
			</span>
		</div>
	);
}

function InspectorSection({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) {
	return (
		<section className="space-y-2">
			<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777879]">
				{title}
			</h3>
			<div className="space-y-2">{children}</div>
		</section>
	);
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
				"#d7d7d7",
			],
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 6],
			"circle-stroke-color": "#1b1c1d",
			"circle-stroke-width": 1.5,
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
				},
			})),
	};
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
) {
	const zoom = map.getZoom();
	const filters = readonlyEquipmentZoomFilters(zoom);
	if (filterType !== "all") filters.push(["==", "type", filterType]);
	if (filterStatus !== "all") filters.push(["==", "status", filterStatus]);
	setEquipmentLayersFilter(map, "editor-v2", filters);
	if (map.getLayer("editor-route-points-v2-circle")) {
		map.setLayoutProperty(
			"editor-route-points-v2-circle",
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
		[point.x - 6, point.y - 6],
		[point.x + 6, point.y + 6],
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

	const routePointLayers = ["editor-route-points-v2-circle"].filter((layerId) =>
		map.getLayer(layerId),
	);
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

	const routeLayers = ["editor-routes-v2-hitbox"].filter((layerId) =>
		map.getLayer(layerId),
	);
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
		return feature.item.code || feature.item.name || feature.item.id;
	}
	if (feature.kind === "route") {
		return feature.item.code || feature.item.id;
	}
	return feature.item.code || feature.item.id;
}

function formatCoordinate(value: number) {
	return value.toFixed(6);
}

function formatInspectorValue(value: number | string | null | undefined) {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "number")
		return Number.isInteger(value) ? value : value.toFixed(2);
	return value;
}

function formatElementType(type: EquipmentMapItem["type"]) {
	const labels: Record<string, string> = {
		olt: "OLT",
		nap: "NAP",
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

function tabButtonClass(active: boolean) {
	return `rounded px-2 py-1.5 text-xs font-medium transition-colors ${active ? "bg-[rgba(56,216,255,0.14)] text-[#bdeafe]" : "text-[#777879] hover:bg-[rgba(164,164,164,0.06)] hover:text-[#d7d7d7]"}`;
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
		<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] px-2 py-1.5">
			<p className="text-[9px] text-[#777879]">{label}</p>
			<p className="font-mono text-sm font-semibold" style={{ color }}>
				{value}
			</p>
		</div>
	);
}

function StatRow({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-[#777879]">{label}</span>
			<span className="font-mono text-[#e6e6e6]">{value}</span>
		</div>
	);
}

function IconButton({
	children,
	label,
	onClick,
}: {
	children: ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="border-r border-[rgba(164,164,164,0.1)] p-2 text-[#d7d7d7] transition-colors last:border-r-0 hover:bg-[rgba(164,164,164,0.08)]"
		>
			{children}
		</button>
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
