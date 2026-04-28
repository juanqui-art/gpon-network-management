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

// ── Editor modes ──────────────────────────────────────────────────────────────

export type EditorMode = "view" | "design" | "edit";

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
	selection: Selection | null;
	isDirty: boolean;
	isSaving: boolean;
	validationErrors: ValidationError[];

	// ── Local mutations (instant, no DB) ─────────────────────────────────────

	setMode: (mode: EditorMode) => void;
	select: (id: string, kind: SelectionKind) => void;
	deselect: () => void;

	addElement: (element: InfrastructureElement) => void;
	updateElement: (id: string, patch: Partial<InfrastructureElement>) => void;
	moveElement: (id: string, lng: number, lat: number) => void;
	removeElement: (id: string) => void;

	addRoute: (route: FiberRoute) => void;
	updateRoute: (id: string, patch: Partial<FiberRoute>) => void;
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
			selection: null,
			isDirty: false,
			isSaving: false,
			validationErrors: [],

			// ── Session ────────────────────────────────────────────────────────

			setMode: (mode) => set({ mode }),
			select: (id, kind) => set({ selection: { id, kind } }),
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
					};
				}),

			moveElement: (id, lng, lat) =>
				set((s) => {
					const el = s.elements[id];
					if (!el) return s;
					return {
						elements: {
							...s.elements,
							[id]: { ...el, lng, lat, updated_at: new Date().toISOString() },
						},
						isDirty: true,
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
				const { elements, routes, routePoints, networkId, validate } = get();
				if (!networkId) return;

				const errors = validate();
				if (errors.length > 0) return;

				set({ isSaving: true });

				try {
					const { createClient } = await import("@/lib/supabase/client");
					const supabase = createClient();

					// Upsert elements
					for (const el of Object.values(elements)) {
						await supabase.rpc("create_infrastructure_element_draft", {
							p_network_id: networkId,
							p_type: el.type,
							p_code: el.code,
							p_name: el.name,
							p_lng: el.lng,
							p_lat: el.lat,
							p_status: el.status,
							p_location_quality: el.location_quality,
							p_total_pon_ports: el.total_pon_ports,
							p_split_ratio: el.split_ratio,
							p_total_ports: el.total_ports,
							p_notes: el.notes,
						});
					}

					// Upsert routes
					for (const r of Object.values(routes)) {
						await supabase.rpc("create_fiber_route_draft", {
							p_network_id: networkId,
							p_code: r.code,
							p_type: r.type,
							p_from_element_id: r.from_element_id,
							p_to_element_id: r.to_element_id,
							p_geojson_coordinates: r.geojson_coordinates as unknown,
							p_fiber_type: r.fiber_type,
							p_fiber_count: r.fiber_count,
							p_length_meters: r.length_meters,
							p_notes: r.notes,
						});
					}

					set({ isDirty: false, isSaving: false });
					useNetworkEditorStore.temporal.getState().clear();
				} catch {
					set({ isSaving: false });
				}
			},

			discard: () => {
				const { networkId, loadNetwork } = get();
				if (networkId) loadNetwork(networkId);
				else set({ elements: {}, routes: {}, routePoints: {}, isDirty: false });
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
