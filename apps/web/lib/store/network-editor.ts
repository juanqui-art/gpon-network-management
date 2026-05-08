"use client";

import { temporal } from "zundo";
import { create } from "zustand";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import {
	calculateRouteLengthMeters,
	insertRouteVertex,
	moveRouteVertex,
	type RouteCoordinate,
	removeRouteVertex,
} from "@/lib/map/route-geometry-editor";

function getSaveErrorMessage(error: unknown) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "object" && error !== null) {
		const record = error as Record<string, unknown>;
		const message =
			record.message ?? record.details ?? record.hint ?? record.code;
		if (typeof message === "string" && message.length > 0) return message;
		try {
			return JSON.stringify(record);
		} catch {
			return "Error desconocido";
		}
	}
	return String(error);
}

function addUniqueId(ids: string[], id: string) {
	return ids.includes(id) ? ids : [...ids, id];
}

// ── Editor modes ──────────────────────────────────────────────────────────────

export type EditorMode = "view" | "design" | "edit";

export type EditorTool =
	| "select"
	| "pan"
	| "olt"
	| "splitter"
	| "nap"
	| "closure"
	| "fiber"
	| "crossing"
	| "reserve"
	| "splice"
	| "measure"
	| "delete";

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationError {
	id: string;
	kind: "element" | "route" | "routePoint" | "network";
	field: string;
	message: string;
}

// ── Selection ─────────────────────────────────────────────────────────────────

export type SelectionKind = "element" | "route" | "routePoint";

export interface Selection {
	id: string;
	kind: SelectionKind;
}

// ── Active draft (lightweight session state) ─────────────────────────────────

export type ActiveDraft =
	| {
			kind: "element";
			id: string;
			elementType: string;
			code: string;
			selectedZone?: string; // Zone for code generation (Z01, Z05, etc.)
	  }
	| {
			kind: "route";
			id: string;
			routeType: string;
			code: string | null;
	  }
	| {
			kind: "routePoint";
			id: string;
			pointType: string;
			code: string | null;
	  };

// ── Temporal state (tracked by undo/redo) ────────────────────────────────────

export interface TemporalState {
	elements: Record<string, InfrastructureElement>;
	routes: Record<string, FiberRoute>;
	routePoints: Record<string, RoutePoint>;
}

// ── Full store ────────────────────────────────────────────────────────────────

export interface NetworkEditorStore extends TemporalState {
	// Network context
	networkId: string | null;
	networkName: string | null;

	// Editor session (NOT in undo history)
	mode: EditorMode;
	activeTool: EditorTool;
	selection: Selection | null;
	activeDraft: ActiveDraft | null;
	statusMessage: string;
	isDirty: boolean;
	isSaving: boolean;
	validationErrors: ValidationError[];
	createdElementIds: string[];
	createdRouteIds: string[];
	createdRoutePointIds: string[];
	modifiedElementIds: string[];
	modifiedRouteIds: string[];
	modifiedRoutePointIds: string[];

	// ── Local mutations (instant, no DB) ─────────────────────────────────────

	setMode: (mode: EditorMode) => void;
	setActiveTool: (tool: EditorTool) => void;
	setActiveDraft: (draft: ActiveDraft | null) => void;
	clearActiveDraft: () => void;
	setStatusMessage: (message: string) => void;
	select: (id: string, kind: SelectionKind) => void;
	deselect: () => void;

	addElement: (element: InfrastructureElement) => void;
	updateElement: (id: string, patch: Partial<InfrastructureElement>) => void;
	moveElement: (id: string, lng: number, lat: number) => void;
	removeElement: (id: string) => void;

	addRoute: (route: FiberRoute) => void;
	updateRoute: (id: string, patch: Partial<FiberRoute>) => void;
	insertRouteVertex: (
		id: string,
		afterIndex: number,
		coordinate: RouteCoordinate,
	) => void;
	moveRouteVertex: (
		id: string,
		vertexIndex: number,
		coordinate: RouteCoordinate,
	) => void;
	removeRouteVertex: (id: string, vertexIndex: number) => void;
	removeRoute: (id: string) => void;

	addRoutePoint: (point: RoutePoint) => void;
	updateRoutePoint: (id: string, patch: Partial<RoutePoint>) => void;
	removeRoutePoint: (id: string) => void;

	// ── Derived (computed from store, no DB needed) ───────────────────────────

	getElement: (id: string) => InfrastructureElement | undefined;
	getRoute: (id: string) => FiberRoute | undefined;
	getElementsArray: () => EquipmentMapItem[];
	getRoutesArray: () => ConnectionMapItem[];
	getRoutePointsArray: () => RoutePoint[];

	// ── Persistence ───────────────────────────────────────────────────────────

	hydrateNetwork: (
		id: string,
		data: {
			elements: InfrastructureElement[];
			routes: FiberRoute[];
			routePoints: RoutePoint[];
		},
	) => void;
	loadNetwork: (id: string) => Promise<void>;
	validate: () => ValidationError[];
	save: () => Promise<void>;
	discard: () => void;
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useNetworkEditorStore = create<NetworkEditorStore>()(
	temporal(
		(set, get) => ({
			// Initial state
			elements: {},
			routes: {},
			routePoints: {},
			networkId: null,
			networkName: null,
			mode: "view",
			activeTool: "select",
			selection: null,
			activeDraft: null,
			statusMessage: "Modo infraestructura listo.",
			isDirty: false,
			isSaving: false,
			validationErrors: [],
			createdElementIds: [],
			createdRouteIds: [],
			createdRoutePointIds: [],
			modifiedElementIds: [],
			modifiedRouteIds: [],
			modifiedRoutePointIds: [],

			// ── Session ────────────────────────────────────────────────────────

			setMode: (mode) => set({ mode }),
			setActiveTool: (activeTool) => set({ activeTool }),
			setActiveDraft: (activeDraft) => set({ activeDraft }),
			clearActiveDraft: () => set({ activeDraft: null }),
			setStatusMessage: (statusMessage) => set({ statusMessage }),
			select: (id, kind) => set({ selection: { id, kind }, activeDraft: null }),
			deselect: () => set({ selection: null }),

			// ── Elements ──────────────────────────────────────────────────────

			addElement: (element) =>
				set((s) => ({
					elements: { ...s.elements, [element.id]: element },
					createdElementIds: addUniqueId(s.createdElementIds, element.id),
					isDirty: true,
				})),

			updateElement: (id, patch) =>
				set((s) => {
					const el = s.elements[id];
					if (!el) return s;
					return {
						elements: {
							...s.elements,
							[id]: {
								...el,
								...patch,
								updated_at: new Date().toISOString(),
							},
						},
						isDirty: true,
						modifiedElementIds: s.createdElementIds.includes(id)
							? s.modifiedElementIds
							: addUniqueId(s.modifiedElementIds, id),
					};
				}),

			moveElement: (id, lng, lat) =>
				set((s) => {
					const el = s.elements[id];
					if (!el) return s;
					const now = new Date().toISOString();
					const nextCoordinate: [number, number] = [lng, lat];
					const changedRouteIds: string[] = [];
					const routes = Object.fromEntries(
						Object.entries(s.routes).map(([routeId, route]) => {
							const coordinates = route.geojson_coordinates;
							if (coordinates.length === 0) return [routeId, route];

							if (route.from_element_id === id) {
								const geojsonCoordinates = [
									nextCoordinate,
									...coordinates.slice(1),
								];
								changedRouteIds.push(routeId);
								return [
									routeId,
									{
										...route,
										geojson_coordinates: geojsonCoordinates,
										length_meters:
											calculateRouteLengthMeters(geojsonCoordinates),
										updated_at: now,
									},
								];
							}

							if (route.to_element_id === id) {
								const geojsonCoordinates = [
									...coordinates.slice(0, -1),
									nextCoordinate,
								];
								changedRouteIds.push(routeId);
								return [
									routeId,
									{
										...route,
										geojson_coordinates: geojsonCoordinates,
										length_meters:
											calculateRouteLengthMeters(geojsonCoordinates),
										updated_at: now,
									},
								];
							}

							return [routeId, route];
						}),
					);
					return {
						elements: {
							...s.elements,
							[id]: { ...el, lng, lat, updated_at: now },
						},
						routes,
						isDirty: true,
						modifiedElementIds: s.createdElementIds.includes(id)
							? s.modifiedElementIds
							: addUniqueId(s.modifiedElementIds, id),
						modifiedRouteIds: changedRouteIds.reduce(
							(ids, routeId) =>
								s.createdRouteIds.includes(routeId)
									? ids
									: addUniqueId(ids, routeId),
							s.modifiedRouteIds,
						),
					};
				}),

			removeElement: (id) =>
				set((s) => {
					const { [id]: _, ...rest } = s.elements;
					return { elements: rest, isDirty: true };
				}),

			// ── Routes ────────────────────────────────────────────────────────

			addRoute: (route) =>
				set((s) => ({
					routes: { ...s.routes, [route.id]: route },
					createdRouteIds: addUniqueId(s.createdRouteIds, route.id),
					isDirty: true,
				})),

			updateRoute: (id, patch) =>
				set((s) => {
					const r = s.routes[id];
					if (!r) return s;
					return {
						routes: {
							...s.routes,
							[id]: { ...r, ...patch, updated_at: new Date().toISOString() },
						},
						isDirty: true,
						modifiedRouteIds: s.createdRouteIds.includes(id)
							? s.modifiedRouteIds
							: addUniqueId(s.modifiedRouteIds, id),
					};
				}),

			insertRouteVertex: (id, afterIndex, coordinate) =>
				set((s) => {
					const route = s.routes[id];
					if (!route) return s;
					const geojsonCoordinates = insertRouteVertex(
						route.geojson_coordinates,
						afterIndex,
						coordinate,
					);
					if (geojsonCoordinates === route.geojson_coordinates) return s;
					return {
						routes: {
							...s.routes,
							[id]: {
								...route,
								geojson_coordinates: geojsonCoordinates,
								length_meters: calculateRouteLengthMeters(geojsonCoordinates),
								updated_at: new Date().toISOString(),
							},
						},
						isDirty: true,
						modifiedRouteIds: s.createdRouteIds.includes(id)
							? s.modifiedRouteIds
							: addUniqueId(s.modifiedRouteIds, id),
					};
				}),

			moveRouteVertex: (id, vertexIndex, coordinate) =>
				set((s) => {
					const route = s.routes[id];
					if (!route) return s;
					const geojsonCoordinates = moveRouteVertex(
						route.geojson_coordinates,
						vertexIndex,
						coordinate,
					);
					if (geojsonCoordinates === route.geojson_coordinates) return s;
					return {
						routes: {
							...s.routes,
							[id]: {
								...route,
								geojson_coordinates: geojsonCoordinates,
								length_meters: calculateRouteLengthMeters(geojsonCoordinates),
								updated_at: new Date().toISOString(),
							},
						},
						isDirty: true,
						modifiedRouteIds: s.createdRouteIds.includes(id)
							? s.modifiedRouteIds
							: addUniqueId(s.modifiedRouteIds, id),
					};
				}),

			removeRouteVertex: (id, vertexIndex) =>
				set((s) => {
					const route = s.routes[id];
					if (!route) return s;
					const geojsonCoordinates = removeRouteVertex(
						route.geojson_coordinates,
						vertexIndex,
					);
					if (geojsonCoordinates === route.geojson_coordinates) return s;
					return {
						routes: {
							...s.routes,
							[id]: {
								...route,
								geojson_coordinates: geojsonCoordinates,
								length_meters: calculateRouteLengthMeters(geojsonCoordinates),
								updated_at: new Date().toISOString(),
							},
						},
						isDirty: true,
						modifiedRouteIds: s.createdRouteIds.includes(id)
							? s.modifiedRouteIds
							: addUniqueId(s.modifiedRouteIds, id),
					};
				}),

			removeRoute: (id) =>
				set((s) => {
					const { [id]: _, ...rest } = s.routes;
					// Also remove route points that belonged to this route
					const routePoints = Object.fromEntries(
						Object.entries(s.routePoints).filter(
							([, rp]) => rp.fiber_route_id !== id,
						),
					);
					return { routes: rest, routePoints, isDirty: true };
				}),

			// ── Route points ──────────────────────────────────────────────────

			addRoutePoint: (point) =>
				set((s) => ({
					routePoints: { ...s.routePoints, [point.id]: point },
					createdRoutePointIds: addUniqueId(s.createdRoutePointIds, point.id),
					isDirty: true,
				})),

			updateRoutePoint: (id, patch) =>
				set((s) => {
					const rp = s.routePoints[id];
					if (!rp) return s;
					return {
						routePoints: {
							...s.routePoints,
							[id]: { ...rp, ...patch, updated_at: new Date().toISOString() },
						},
						isDirty: true,
						modifiedRoutePointIds: s.createdRoutePointIds.includes(id)
							? s.modifiedRoutePointIds
							: addUniqueId(s.modifiedRoutePointIds, id),
					};
				}),

			removeRoutePoint: (id) =>
				set((s) => {
					const { [id]: _, ...rest } = s.routePoints;
					return { routePoints: rest, isDirty: true };
				}),

			// ── Derived ───────────────────────────────────────────────────────

			getElement: (id) => get().elements[id],
			getRoute: (id) => get().routes[id],

			getElementsArray: () =>
				Object.values(get().elements).map((el) => ({
					...el,
					vendor: null,
					model: null,
					address: el.address_reference,
					service_status: null,
					plan_name: null,
					download_mbps: null,
					upload_mbps: null,
					customer_name: null,
					customer_phone: null,
					rx_power_dbm: null,
					tx_power_dbm: null,
					signal_recorded_at: null,
				})) as EquipmentMapItem[],

			getRoutesArray: () =>
				Object.values(get().routes).map((r) => ({
					...r,
					cable_type: r.type,
					from_equipment_id: r.from_element_id ?? "",
					to_equipment_id: r.to_element_id ?? "",
					from_equipment_type: r.from_element_type ?? "olt",
					to_equipment_type: r.to_element_type ?? "nap",
				})) as ConnectionMapItem[],

			getRoutePointsArray: () => Object.values(get().routePoints),

			// ── Persistence ───────────────────────────────────────────────────

			hydrateNetwork: (id, data) => {
				const toRecord = <T extends { id: string }>(arr: T[]) =>
					Object.fromEntries(arr.map((x) => [x.id, x]));

				set({
					networkId: id,
					elements: toRecord(data.elements),
					routes: toRecord(data.routes),
					routePoints: toRecord(data.routePoints),
					isDirty: false,
					validationErrors: [],
					createdElementIds: [],
					createdRouteIds: [],
					createdRoutePointIds: [],
					modifiedElementIds: [],
					modifiedRouteIds: [],
					modifiedRoutePointIds: [],
				});

				useNetworkEditorStore.temporal.getState().clear();
			},

			loadNetwork: async (id) => {
				const { createClient } = await import("@/lib/supabase/client");
				const supabase = createClient();
				const [{ data: elements }, { data: routes }, { data: routePoints }] =
					await Promise.all([
						supabase.rpc("infrastructure_elements_for_map", {
							p_network_id: id,
						}),
						supabase.rpc("fiber_routes_for_map", { p_network_id: id }),
						supabase.rpc("route_points_for_map", { p_network_id: id }),
					]);

				const toRecord = <T extends { id: string }>(arr: T[] | null) =>
					Object.fromEntries((arr ?? []).map((x) => [x.id, x]));

				set({
					networkId: id,
					elements: toRecord(elements as InfrastructureElement[]),
					routes: toRecord(routes as FiberRoute[]),
					routePoints: toRecord(routePoints as RoutePoint[]),
					isDirty: false,
					validationErrors: [],
					createdElementIds: [],
					createdRouteIds: [],
					createdRoutePointIds: [],
					modifiedElementIds: [],
					modifiedRouteIds: [],
					modifiedRoutePointIds: [],
				});

				// Reset undo history after load
				useNetworkEditorStore.temporal.getState().clear();
			},

			validate: () => {
				const { elements, routePoints, routes } = get();
				const errors: ValidationError[] = [];
				const elementList = Object.values(elements);
				const routeList = Object.values(routes);

				if (
					elementList.length > 0 &&
					!elementList.some((element) => element.type === "olt")
				) {
					errors.push({
						id: "network",
						kind: "network",
						field: "olt",
						message: "La captura necesita al menos una OLT antes de guardar",
					});
				}

				for (const el of elementList) {
					if (!el.code.trim()) {
						errors.push({
							id: el.id,
							kind: "element",
							field: "code",
							message: `${el.type}: elemento sin código`,
						});
					}
					if (el.type === "splitter" && !el.split_ratio) {
						errors.push({
							id: el.id,
							kind: "element",
							field: "split_ratio",
							message: `${el.code}: Splitter sin relación de división`,
						});
					}
					if (
						el.type === "closure" &&
						el.properties.has_splitter === true &&
						!el.split_ratio
					) {
						errors.push({
							id: el.id,
							kind: "element",
							field: "split_ratio",
							message: `${el.code}: Mufa con splitter sin ratio`,
						});
					}
					if (el.type === "nap" && el.split_ratio && !el.total_ports) {
						errors.push({
							id: el.id,
							kind: "element",
							field: "total_ports",
							message: `${el.code}: NAP con splitter sin capacidad de puertos`,
						});
					}

					// Capacity validation for NAPs
					if (el.type === "nap" && el.total_ports) {
						const used = el.ports_used ?? 0;
						const reserved = el.ports_reserved ?? 0;
						const available = el.total_ports - (used + reserved);

						if (available <= 0) {
							errors.push({
								id: el.id,
								kind: "element",
								field: "capacity",
								message: `${el.code}: NAP SATURADA — sin puertos disponibles`,
							});
						} else if (used / el.total_ports >= 0.9) {
							errors.push({
								id: el.id,
								kind: "element",
								field: "capacity",
								message: `${el.code}: NAP casi llena (${available} puerto${available !== 1 ? "s" : ""} disponible${available !== 1 ? "s" : ""})`,
							});
						}
					}
				}

				for (const r of routeList) {
					if (!r.from_element_id || !r.to_element_id) {
						errors.push({
							id: r.id,
							kind: "route",
							field: "endpoints",
							message: `${r.code ?? r.id}: Ruta sin origen o destino`,
						});
					}
					if (
						r.from_element_id &&
						r.to_element_id &&
						(!elements[r.from_element_id] || !elements[r.to_element_id])
					) {
						errors.push({
							id: r.id,
							kind: "route",
							field: "endpoints",
							message: `${r.code ?? r.id}: Ruta conectada a un elemento inexistente`,
						});
					}
					if (r.geojson_coordinates.length < 2) {
						errors.push({
							id: r.id,
							kind: "route",
							field: "geometry",
							message: `${r.code ?? r.id}: Ruta sin trazado válido`,
						});
					}
					if (!r.fiber_count || r.fiber_count <= 0) {
						errors.push({
							id: r.id,
							kind: "route",
							field: "fiber_count",
							message: `${r.code ?? r.id}: Fibra sin cantidad de hilos`,
						});
					}
				}

				for (const point of Object.values(routePoints)) {
					if (!routes[point.fiber_route_id]) {
						errors.push({
							id: point.id,
							kind: "routePoint",
							field: "fiber_route_id",
							message: `${point.code ?? point.id}: Punto físico sin ruta asociada`,
						});
					}
					if (
						point.type === "mufa" &&
						point.properties.has_splitter === true &&
						!point.properties.split_ratio
					) {
						errors.push({
							id: point.id,
							kind: "routePoint",
							field: "split_ratio",
							message: `${point.code ?? point.id}: Mufa sobre ruta con splitter sin ratio`,
						});
					}
				}

				set({ validationErrors: errors });
				return errors;
			},

			save: async () => {
				const {
					createdElementIds,
					createdRouteIds,
					createdRoutePointIds,
					modifiedElementIds,
					modifiedRouteIds,
					modifiedRoutePointIds,
					networkId,
					validate,
				} = get();
				if (!networkId) return;

				const errors = validate();
				if (errors.length > 0) {
					set({
						isSaving: false,
						statusMessage: `No se guardó: ${errors.map((error) => error.message).join(" · ")}`,
					});
					return;
				}

				set({ isSaving: true });

				try {
					const {
						createFiberRoute,
						createInfrastructureElement,
						createRoutePoint,
						updateFiberRoute,
						updateInfrastructureElement,
						updateRoutePoint,
					} = await import("@/lib/queries/network-editor");

					const elementIdMap = new Map<string, string>();
					const routeIdMap = new Map<string, string>();
					const nextElements = { ...get().elements };
					const nextRoutes = { ...get().routes };
					const nextRoutePoints = { ...get().routePoints };

					for (const id of createdElementIds) {
						const element = nextElements[id];
						if (!element) continue;
						const savedElement = await createInfrastructureElement({
							type: element.type,
							code: element.code,
							name: element.name,
							lng: element.lng,
							lat: element.lat,
							status: element.status,
							location_quality: element.location_quality,
							pon_standard: element.pon_standard,
							total_pon_ports: element.total_pon_ports,
							optical_class: element.optical_class,
							split_ratio: element.split_ratio,
							insertion_loss_db: element.insertion_loss_db,
							total_ports: element.total_ports,
							properties: element.properties,
							address_reference: element.address_reference,
							notes: element.notes,
						});
						elementIdMap.set(id, savedElement.id);
						delete nextElements[id];
						nextElements[savedElement.id] = savedElement;
					}

					for (const id of createdRouteIds) {
						const route = nextRoutes[id];
						if (!route) continue;
						const savedRoute = await createFiberRoute({
							code: route.code,
							type: route.type,
							status: route.status,
							from_element_id: route.from_element_id
								? (elementIdMap.get(route.from_element_id) ??
									route.from_element_id)
								: null,
							to_element_id: route.to_element_id
								? (elementIdMap.get(route.to_element_id) ?? route.to_element_id)
								: null,
							geojson_coordinates: route.geojson_coordinates,
							route_quality: route.route_quality,
							installation_type: route.installation_type,
							fiber_type: route.fiber_type,
							fiber_count: route.fiber_count,
							length_meters: route.length_meters,
							attenuation_db_per_km: route.attenuation_db_per_km,
							splice_loss_db: route.splice_loss_db,
							connector_loss_db: route.connector_loss_db,
							notes: route.notes,
						});
						routeIdMap.set(id, savedRoute.id);
						delete nextRoutes[id];
						nextRoutes[savedRoute.id] = savedRoute;
					}

					for (const id of createdRoutePointIds) {
						const point = nextRoutePoints[id];
						if (!point) continue;
						const savedPoint = await createRoutePoint({
							fiber_route_id:
								routeIdMap.get(point.fiber_route_id) ?? point.fiber_route_id,
							type: point.type,
							lng: point.lng,
							lat: point.lat,
							code: point.code,
							status: point.status,
							location_quality: point.location_quality,
							crossing_type: point.crossing_type,
							risk_level: point.risk_level,
							reserve_length_m: point.reserve_length_m,
							splice_loss_db: point.splice_loss_db,
							reference_text: point.reference_text,
							properties: point.properties,
							notes: point.notes,
						});
						delete nextRoutePoints[id];
						nextRoutePoints[savedPoint.id] = savedPoint;
					}

					const currentSelection = get().selection;
					set({
						elements: nextElements,
						routes: nextRoutes,
						routePoints: nextRoutePoints,
						selection: currentSelection
							? {
									...currentSelection,
									id:
										elementIdMap.get(currentSelection.id) ??
										routeIdMap.get(currentSelection.id) ??
										currentSelection.id,
								}
							: null,
					});

					for (const id of modifiedElementIds) {
						if (createdElementIds.includes(id)) continue;
						const element = get()
							.getElementsArray()
							.find((item) => item.id === id);
						if (!element) continue;
						await updateInfrastructureElement({
							element,
							patch: element,
						});
					}

					for (const id of modifiedRouteIds) {
						if (createdRouteIds.includes(id)) continue;
						const route = get()
							.getRoutesArray()
							.find((item) => item.id === id);
						if (!route) continue;
						const savedRoute = await updateFiberRoute({
							route,
							patch: route,
						});
						set((s) => ({
							routes: {
								...s.routes,
								[id]: savedRoute,
							},
						}));
					}

					for (const id of modifiedRoutePointIds) {
						if (createdRoutePointIds.includes(id)) continue;
						const point = get().routePoints[id];
						if (!point) continue;
						const savedPoint = await updateRoutePoint({
							point,
							patch: point,
						});
						set((s) => ({
							routePoints: {
								...s.routePoints,
								[id]: savedPoint,
							},
						}));
					}

					set({
						isDirty: false,
						isSaving: false,
						validationErrors: [],
						createdElementIds: [],
						createdRouteIds: [],
						createdRoutePointIds: [],
						modifiedElementIds: [],
						modifiedRouteIds: [],
						modifiedRoutePointIds: [],
						statusMessage: "Cambios guardados.",
					});
					useNetworkEditorStore.temporal.getState().clear();
				} catch (error) {
					const errorMessage = getSaveErrorMessage(error);
					set({
						isSaving: false,
						statusMessage: `No se pudo guardar: ${errorMessage}`,
					});
					console.error("Save failed:", errorMessage, error);
				}
			},

			discard: () => {
				const { networkId, loadNetwork } = get();
				if (networkId) loadNetwork(networkId);
				else
					set({
						elements: {},
						routes: {},
						routePoints: {},
						isDirty: false,
						createdElementIds: [],
						createdRouteIds: [],
						createdRoutePointIds: [],
						modifiedElementIds: [],
						modifiedRouteIds: [],
						modifiedRoutePointIds: [],
					});
				useNetworkEditorStore.temporal.getState().clear();
			},
		}),
		{
			// Only track data mutations in undo/redo, not UI state
			partialize: (state) => ({
				elements: state.elements,
				routes: state.routes,
				routePoints: state.routePoints,
			}),
			equality: (pastState, currentState) =>
				pastState.elements === currentState.elements &&
				pastState.routes === currentState.routes &&
				pastState.routePoints === currentState.routePoints,
			limit: 50,
		},
	),
);
