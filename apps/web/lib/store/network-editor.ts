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
	modifiedElementIds: string[];
	modifiedRouteIds: string[];

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
			modifiedElementIds: [],
			modifiedRouteIds: [],

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
						modifiedElementIds: addUniqueId(s.modifiedElementIds, id),
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
						modifiedElementIds: addUniqueId(s.modifiedElementIds, id),
						modifiedRouteIds: changedRouteIds.reduce(
							(ids, routeId) => addUniqueId(ids, routeId),
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
						modifiedRouteIds: addUniqueId(s.modifiedRouteIds, id),
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
						modifiedRouteIds: addUniqueId(s.modifiedRouteIds, id),
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
						modifiedRouteIds: addUniqueId(s.modifiedRouteIds, id),
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
						modifiedRouteIds: addUniqueId(s.modifiedRouteIds, id),
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
					modifiedElementIds: [],
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
					modifiedElementIds: [],
				});

				// Reset undo history after load
				useNetworkEditorStore.temporal.getState().clear();
			},

			validate: () => {
				const { elements, routes } = get();
				const errors: ValidationError[] = [];

				for (const el of Object.values(elements)) {
					if (!el.name && el.type === "olt") {
						errors.push({
							id: el.id,
							kind: "element",
							field: "name",
							message: `${el.code}: OLT sin nombre`,
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

				for (const r of Object.values(routes)) {
					if (!r.from_element_id || !r.to_element_id) {
						errors.push({
							id: r.id,
							kind: "route",
							field: "endpoints",
							message: `${r.code ?? r.id}: Ruta sin origen o destino`,
						});
					}
				}

				set({ validationErrors: errors });
				return errors;
			},

			save: async () => {
				const { modifiedElementIds, modifiedRouteIds, networkId, validate } =
					get();
				if (!networkId) return;

				const errors = validate();
				if (errors.length > 0) {
					set({
						statusMessage: errors.map((error) => error.message).join(" · "),
					});
				}

				set({ isSaving: true });

				try {
					const { updateFiberRoute, updateInfrastructureElement } =
						await import("@/lib/queries/network-editor");

					for (const id of modifiedElementIds) {
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

					set({
						isDirty: false,
						isSaving: false,
						validationErrors: [],
						modifiedElementIds: [],
						modifiedRouteIds: [],
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
						modifiedElementIds: [],
						modifiedRouteIds: [],
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
			limit: 50,
		},
	),
);
