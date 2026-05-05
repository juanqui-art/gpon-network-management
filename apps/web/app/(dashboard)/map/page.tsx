import { ReadonlyMapViewer } from "@/components/map/readonly-map-viewer";
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
		{ data: elements, error: elementsError },
		{ data: routes, error: routesError },
		{ data: routePoints, error: routePointsError },
	] = await Promise.all([
		supabase.rpc("infrastructure_elements_for_map"),
		supabase.rpc("fiber_routes_for_map"),
		supabase.rpc("route_points_for_map"),
	]);

	if (elementsError || routesError || routePointsError) {
		return (
			<MapLoadError
				message={
					elementsError?.message ??
					routesError?.message ??
					routePointsError?.message ??
					"No se pudo cargar el mapa."
				}
			/>
		);
	}

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

	const warnings: string[] = [];

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
		<ReadonlyMapViewer
			token={MAPBOX_TOKEN}
			equipment={equipment}
			connections={connections}
			routePoints={(routePoints ?? []) as RoutePoint[]}
			incidents={[] as IncidentMapItem[]}
			warnings={warnings}
		/>
	);
}

function MapLoadError({ message }: { message: string }) {
	return (
		<div className="fixed inset-x-0 bottom-0 top-12 flex items-center justify-center bg-[#1b1c1d] p-6">
			<div className="max-w-md rounded-lg border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
				<p className="font-semibold">No se pudo cargar el mapa GPON</p>
				<p className="mt-2 text-red-100/80">{message}</p>
			</div>
		</div>
	);
}
