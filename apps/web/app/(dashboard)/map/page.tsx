import { MapView } from "@/components/map/map-view";
import type {
	ConnectionMapItem,
	EquipmentMapItem,
	FiberRoute,
	IncidentMapItem,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import { MAPBOX_TOKEN } from "@/lib/mapbox/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mapa GPON" };

export default async function MapPage() {
	const supabase = await createClient();

	const [
		{ data: elements },
		{ data: routes },
		{ data: routePoints },
		{ data: incidents },
	] = await Promise.all([
		supabase.rpc("infrastructure_elements_for_map"),
		supabase.rpc("fiber_routes_for_map"),
		supabase.rpc("route_points_for_map"),
		Promise.resolve({ data: [] as IncidentMapItem[] }),
	]);

	const equipment = ((elements ?? []) as InfrastructureElement[]).map(
		(element) =>
			({
				...element,
				vendor: null,
				model: null,
				address: element.address_reference,
				service_status: null,
				plan_name: null,
				download_mbps: null,
				upload_mbps: null,
				customer_name: null,
				customer_phone: null,
				rx_power_dbm: null,
				tx_power_dbm: null,
				signal_recorded_at: null,
			}) satisfies EquipmentMapItem,
	);

	const connections = ((routes ?? []) as FiberRoute[]).map((route) => {
		const fallbackElementId = "";
		const fallbackElementType = "olt";

		return {
			...route,
			cable_type: route.type,
			from_equipment_id: route.from_element_id ?? fallbackElementId,
			to_equipment_id: route.to_element_id ?? fallbackElementId,
			from_equipment_type: route.from_element_type ?? fallbackElementType,
			to_equipment_type: route.to_element_type ?? fallbackElementType,
		} satisfies ConnectionMapItem;
	});

	return (
		<MapView
			token={MAPBOX_TOKEN}
			equipment={equipment}
			connections={connections}
			routePoints={(routePoints ?? []) as RoutePoint[]}
			incidents={(incidents ?? []) as IncidentMapItem[]}
		/>
	);
}
