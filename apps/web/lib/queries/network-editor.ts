"use client";

import type {
	ConnectionMapItem,
	EquipmentMapItem,
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import { createClient } from "@/lib/supabase/client";
import type {
	DataQuality,
	ElementStatus,
	ElementType,
	FiberType,
	InstallationType,
	NetworkZone,
	PonStandard,
	RiskLevel,
	RoutePointType,
	RouteStatus,
	RouteType,
	SplitRatio,
} from "@/lib/types/gpon";

export interface NetworkEditorData {
	elements: InfrastructureElement[];
	routes: FiberRoute[];
	routePoints: RoutePoint[];
}

export const networkEditorKeys = {
	all: ["network-editor"] as const,
	detail: (networkId: string) => [...networkEditorKeys.all, networkId] as const,
	zones: (networkId: string) =>
		[...networkEditorKeys.all, "zones", networkId] as const,
};

export async function fetchNetworkEditorData(
	networkId: string,
): Promise<NetworkEditorData> {
	const supabase = createClient();

	const [
		{ data: elements, error: elementsError },
		{ data: routes, error: routesError },
		{ data: routePoints, error: routePointsError },
	] = await Promise.all([
		supabase.rpc("infrastructure_elements_for_map", {
			p_network_id: networkId,
		}),
		supabase.rpc("fiber_routes_for_map", { p_network_id: networkId }),
		supabase.rpc("route_points_for_map", { p_network_id: networkId }),
	]);

	if (elementsError) throw elementsError;
	if (routesError) throw routesError;
	if (routePointsError) throw routePointsError;

	return {
		elements: (elements ?? []) as InfrastructureElement[],
		routes: (routes ?? []) as FiberRoute[],
		routePoints: (routePoints ?? []) as RoutePoint[],
	};
}

export interface CreateElementInput {
	type: ElementType;
	code: string;
	name: string | null;
	lng: number;
	lat: number;
	status: ElementStatus;
	location_quality: DataQuality;
	pon_standard: PonStandard | null;
	total_pon_ports: number | null;
	optical_class: string | null;
	split_ratio: SplitRatio | null;
	insertion_loss_db: number | null;
	total_ports: number | null;
	properties: Record<string, unknown>;
	address_reference: string | null;
	notes: string | null;
}

export async function createInfrastructureElement(
	input: CreateElementInput,
): Promise<InfrastructureElement> {
	const supabase = createClient();
	const { data, error } = await supabase.rpc(
		"create_infrastructure_element_draft",
		{
			p_type: input.type,
			p_code: input.code,
			p_name: input.name,
			p_lng: input.lng,
			p_lat: input.lat,
			p_status: input.status,
			p_location_quality: input.location_quality,
			p_pon_standard: input.pon_standard,
			p_total_pon_ports: input.total_pon_ports,
			p_optical_class: input.optical_class,
			p_split_ratio: input.split_ratio,
			p_insertion_loss_db: input.insertion_loss_db,
			p_total_ports: input.total_ports,
			p_properties: input.properties,
			p_address_reference: input.address_reference,
			p_notes: input.notes,
		},
	);

	if (error) throw error;
	return (data?.[0] ?? data) as InfrastructureElement;
}

export interface CreateRouteInput {
	code: string | null;
	type: RouteType;
	status: RouteStatus;
	from_element_id: string | null;
	to_element_id: string | null;
	geojson_coordinates: Array<[number, number]>;
	route_quality: DataQuality;
	installation_type: InstallationType | null;
	fiber_type: FiberType | null;
	fiber_count: number | null;
	length_meters: number | null;
	attenuation_db_per_km: number | null;
	splice_loss_db: number | null;
	connector_loss_db: number | null;
	notes: string | null;
}

export async function createFiberRoute(
	input: CreateRouteInput,
): Promise<FiberRoute> {
	const supabase = createClient();
	const { data, error } = await supabase.rpc("create_fiber_route_draft", {
		p_code: input.code,
		p_type: input.type,
		p_status: input.status,
		p_from_element_id: input.from_element_id,
		p_to_element_id: input.to_element_id,
		p_geojson_coordinates: input.geojson_coordinates,
		p_route_quality: input.route_quality,
		p_installation_type: input.installation_type,
		p_fiber_type: input.fiber_type,
		p_fiber_count: input.fiber_count,
		p_length_meters: input.length_meters,
		p_attenuation_db_per_km: input.attenuation_db_per_km,
		p_splice_loss_db: input.splice_loss_db,
		p_connector_loss_db: input.connector_loss_db,
		p_notes: input.notes,
	});

	if (error) throw error;
	return (data?.[0] ?? data) as FiberRoute;
}

export interface CreateRoutePointInput {
	fiber_route_id: string;
	type: RoutePointType;
	lng: number;
	lat: number;
	code: string | null;
	status: string | null;
	location_quality: DataQuality;
	crossing_type: string | null;
	risk_level: RiskLevel | null;
	reserve_length_m: number | null;
	splice_loss_db: number | null;
	reference_text: string | null;
	properties: Record<string, unknown>;
	notes: string | null;
}

export async function createRoutePoint(
	input: CreateRoutePointInput,
): Promise<RoutePoint> {
	const supabase = createClient();
	const { data, error } = await supabase.rpc("create_route_point_draft", {
		p_fiber_route_id: input.fiber_route_id,
		p_type: input.type,
		p_lng: input.lng,
		p_lat: input.lat,
		p_code: input.code,
		p_location_quality: input.location_quality,
		p_crossing_type: input.crossing_type,
		p_risk_level: input.risk_level,
		p_reserve_length_m: input.reserve_length_m,
		p_splice_loss_db: input.splice_loss_db,
		p_reference_text: input.reference_text,
		p_notes: input.notes,
		p_status: input.status,
		p_properties: input.properties,
	});

	if (error) throw error;
	return (data?.[0] ?? data) as RoutePoint;
}

export async function updateInfrastructureElement(input: {
	element: EquipmentMapItem;
	patch: Partial<EquipmentMapItem>;
}): Promise<InfrastructureElement> {
	const { element, patch } = input;
	const hasPatch = <K extends keyof EquipmentMapItem>(key: K): boolean =>
		Object.hasOwn(patch, key);
	const supabase = createClient();
	const { data, error } = await supabase.rpc("update_infrastructure_element", {
		p_id: element.id,
		p_code: patch.code ?? element.code,
		p_name: patch.name ?? element.name,
		p_status: patch.status ?? element.status,
		p_location_quality: patch.location_quality ?? element.location_quality,
		p_lng: patch.lng ?? element.lng,
		p_lat: patch.lat ?? element.lat,
		p_total_pon_ports: patch.total_pon_ports ?? element.total_pon_ports,
		p_split_ratio: hasPatch("split_ratio")
			? patch.split_ratio
			: element.split_ratio,
		p_insertion_loss_db: hasPatch("insertion_loss_db")
			? patch.insertion_loss_db
			: element.insertion_loss_db,
		p_total_ports: patch.total_ports ?? element.total_ports,
		p_optical_class: patch.optical_class ?? element.optical_class,
		p_properties: patch.properties ?? element.properties,
		p_address_reference: patch.address_reference ?? element.address_reference,
		p_notes: patch.notes ?? element.notes,
	});

	if (error) throw error;
	return (data?.[0] ?? data) as InfrastructureElement;
}

export async function updateFiberRoute(input: {
	route: ConnectionMapItem;
	patch: Partial<ConnectionMapItem>;
}): Promise<FiberRoute> {
	const { route, patch } = input;
	const supabase = createClient();
	const { data, error } = await supabase.rpc("update_fiber_route", {
		p_id: route.id,
		p_code: patch.code ?? route.code,
		p_type: patch.type ?? route.type,
		p_status: patch.status ?? route.status,
		p_route_quality: patch.route_quality ?? route.route_quality,
		p_geojson_coordinates: {
			type: "LineString",
			coordinates: patch.geojson_coordinates ?? route.geojson_coordinates,
		},
		p_installation_type: patch.installation_type ?? route.installation_type,
		p_fiber_type: patch.fiber_type ?? route.fiber_type,
		p_fiber_count: patch.fiber_count ?? route.fiber_count,
		p_length_meters: patch.length_meters ?? route.length_meters,
		p_notes: patch.notes ?? route.notes,
	});

	if (error) throw error;
	return (data?.[0] ?? data) as FiberRoute;
}

export async function updateRoutePoint(input: {
	point: RoutePoint;
	patch: Partial<RoutePoint>;
}): Promise<RoutePoint> {
	const { patch, point } = input;
	const supabase = createClient();
	const { data, error } = await supabase
		.from("route_points")
		.update({
			code: patch.code ?? point.code,
			status: patch.status ?? point.status,
			location_quality: patch.location_quality ?? point.location_quality,
			reserve_length_m: patch.reserve_length_m ?? point.reserve_length_m,
			splice_loss_db: patch.splice_loss_db ?? point.splice_loss_db,
			crossing_type: patch.crossing_type ?? point.crossing_type,
			risk_level: patch.risk_level ?? point.risk_level,
			reference_text: patch.reference_text ?? point.reference_text,
			properties: patch.properties ?? point.properties,
			notes: patch.notes ?? point.notes,
		})
		.eq("id", point.id)
		.select()
		.single();

	if (error) throw error;
	return {
		...(data as Record<string, unknown>),
		lng: point.lng,
		lat: point.lat,
	} as RoutePoint;
}

export async function deleteMapFeature(
	input:
		| { kind: "element"; id: string }
		| { kind: "route"; id: string }
		| { kind: "routePoint"; id: string },
): Promise<void> {
	const supabase = createClient();
	const rpc =
		input.kind === "element"
			? "delete_infrastructure_element"
			: input.kind === "route"
				? "delete_fiber_route"
				: "delete_route_point";
	const { error } = await supabase.rpc(rpc, { p_id: input.id });
	if (error) throw error;
}

// ── Zone queries ──────────────────────────────────────────────────────────────

export async function fetchNetworkZones(
	networkId: string,
): Promise<NetworkZone[]> {
	const supabase = createClient();
	const { data, error } = await supabase.rpc("network_zones_for_network", {
		p_network_id: networkId,
	});

	if (error) throw error;
	return (data ?? []) as NetworkZone[];
}

export async function createNetworkZone(input: {
	networkId: string;
	zoneCode: string;
	zoneName: string;
	description?: string;
}): Promise<NetworkZone> {
	const supabase = createClient();
	const { data, error } = await supabase.rpc("create_network_zone", {
		p_network_id: input.networkId,
		p_zone_code: input.zoneCode,
		p_zone_name: input.zoneName,
		p_description: input.description ?? null,
	});

	if (error) throw error;
	return (data?.[0] ?? data) as NetworkZone;
}
