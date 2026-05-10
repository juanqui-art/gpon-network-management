import type {
	CrossingType,
	DataQuality,
	ElementStatus,
	ElementType,
	FiberType,
	InstallationType,
	PonStandard,
	RiskLevel,
	RoutePointType,
	RouteStatus,
	RouteType,
	SplitRatio,
} from "@/lib/types/gpon";

export type LngLat = [longitude: number, latitude: number];

export type MapFeatureStatus =
	| ElementStatus
	| RouteStatus
	| "online"
	| "offline"
	| "alarm"
	| "maintenance"
	| "decommissioned"
	| "unknown";

export type LegacyEquipmentType =
	| ElementType
	| "ont"
	| "amplifier"
	| "wdm"
	| "unknown";

export interface InfrastructureElement {
	id: string;
	organization_id: string | null;
	type: ElementType;
	code: string;
	name: string | null;
	status: ElementStatus;

	lng: number;
	lat: number;
	location_quality: DataQuality;
	address_reference: string | null;

	pon_standard: PonStandard | null;
	total_pon_ports: number | null;
	optical_class: string | null; // "B+" | "C+" | "C++" | "N1" | "N2" | "E1" | "E2"
	split_ratio: SplitRatio | null;
	insertion_loss_db: number | null;
	total_ports: number | null;
	ports_used: number | null;
	ports_reserved: number | null;

	properties: Record<string, unknown>;
	notes: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface FiberRoute {
	id: string;
	organization_id: string | null;
	code: string | null;
	type: RouteType;
	status: RouteStatus;

	from_element_id: string | null;
	to_element_id: string | null;
	from_element_type: ElementType | null;
	to_element_type: ElementType | null;

	geojson_coordinates: LngLat[];
	route_quality: DataQuality;

	installation_type: InstallationType | null;
	fiber_type: FiberType | null;
	fiber_count: number | null;
	length_meters: number | null;
	reservation_m: number;

	attenuation_db_per_km: number | null;
	splice_loss_db: number | null;
	connector_loss_db: number | null;
	total_loss_db: number | null;

	properties: Record<string, unknown>;
	notes: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface RoutePoint {
	id: string;
	organization_id: string | null;
	fiber_route_id: string;
	type: RoutePointType;
	code: string | null;
	status: string | null;

	lng: number;
	lat: number;
	location_quality: DataQuality;
	position_on_route_m: number | null;

	reserve_length_m: number | null;
	splice_loss_db: number | null;
	crossing_type: CrossingType | null;
	risk_level: RiskLevel | null;
	reference_text: string | null;

	properties: Record<string, unknown>;
	notes: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
}

export type IncidentMapItem = {
	id: string;
	title: string;
	severity: string;
	status: string;
	equipment_id: string;
};

// Map-facing aliases used by the read-only map and network editor. They keep
// legacy ONT/customer fields available while infrastructure RPCs remain focused
// on OLT/Splitter/NAP/fiber data.
export type EquipmentMapItem = Omit<
	InfrastructureElement,
	"type" | "status"
> & {
	type: LegacyEquipmentType;
	vendor: string | null;
	model: string | null;
	address: string | null;
	status: MapFeatureStatus;
	service_status: string | null;
	plan_name: string | null;
	download_mbps: number | null;
	upload_mbps: number | null;
	customer_name: string | null;
	customer_phone: string | null;
	rx_power_dbm: number | null;
	tx_power_dbm: number | null;
	signal_recorded_at: string | null;
};

export type ConnectionMapItem = FiberRoute & {
	cable_type: RouteType | null;
	from_equipment_id: string;
	to_equipment_id: string;
	from_equipment_type: ElementType;
	to_equipment_type: ElementType;
};
