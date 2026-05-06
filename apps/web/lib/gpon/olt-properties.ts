import type { OltModel } from "@/lib/gpon/olt-catalog";

export const DEFAULT_OLT_PROPERTIES: Record<string, unknown> = {
	olt_model_id: "zte_c300",
	olt_model: "ZTE C300",
	olt_manufacturer: "ZTE",
	service_slots_total: 14,
	control_slots_total: 2,
	service_cards_installed: 7,
	pon_ports_per_card: 16,
	max_pon_ports: 224,
	design_split_ratio: "1:128",
	estimated_subscribers: 14336,
	tx_power_dbm: 5,
	rx_sensitivity_dbm: -30,
	headend_loss_db: 1.2,
	headend_connector_count: 2,
	headend_adapter_count: 1,
	headend_adapter_loss_db: 0.2,
	pon_port_connector_type: "SC/UPC",
	odf_feeder_connector_type: "SC/APC",
	headend_patchcord_type: "SC/UPC -> SC/APC",
};

export function withDefaultOltProperties(
	properties: Record<string, unknown> | null | undefined,
) {
	return { ...DEFAULT_OLT_PROPERTIES, ...(properties ?? {}) };
}

export function propertyNumber(
	properties: Record<string, unknown> | null | undefined,
	key: string,
): number | null {
	const value = properties?.[key];
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export function propertyString(
	properties: Record<string, unknown> | null | undefined,
	key: string,
	fallback = "",
): string {
	const value = properties?.[key];
	return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

export function splitRatioCapacity(
	ratio: string | null | undefined,
): number | null {
	if (!ratio) return null;
	const [, capacity] = ratio.split(":");
	const parsed = Number(capacity);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function buildOltModelProperties(
	model: OltModel,
	currentProperties: Record<string, unknown> | null | undefined,
) {
	const serviceCardsInstalled =
		propertyNumber(currentProperties, "service_cards_installed") ??
		(model.id === "zte_c300" ? 7 : Math.min(model.serviceSlotsTotal ?? 1, 1));
	const ponPortsPerCard = model.ponPortsPerCard ?? 16;
	const installedPonPorts = serviceCardsInstalled * ponPortsPerCard;
	const designSplitRatio =
		propertyString(currentProperties, "design_split_ratio") || "1:128";
	const splitCapacity = splitRatioCapacity(designSplitRatio) ?? 128;

	return {
		properties: {
			...currentProperties,
			olt_model_id: model.id,
			olt_model: `${model.manufacturer} ${model.model}`,
			olt_manufacturer: model.manufacturer,
			service_slots_total: model.serviceSlotsTotal ?? null,
			control_slots_total: model.controlSlotsTotal ?? null,
			service_cards_installed: serviceCardsInstalled,
			pon_ports_per_card: ponPortsPerCard,
			max_pon_ports: model.maxPonPorts,
			tx_power_dbm:
				propertyNumber(currentProperties, "tx_power_dbm") ??
				model.defaultTxPowerDbm ??
				null,
			rx_sensitivity_dbm:
				propertyNumber(currentProperties, "rx_sensitivity_dbm") ??
				model.rxSensitivityDbm ??
				null,
			design_split_ratio: designSplitRatio,
			estimated_subscribers: installedPonPorts * splitCapacity,
		},
		totalPonPorts: installedPonPorts,
	};
}
