import type mapboxgl from "mapbox-gl";
import { formatMapLabel } from "@/lib/gpon/operative-code";
import { STATUS_COLOR, TYPE_COLOR } from "@/lib/map/palette";
import {
	EQUIPMENT_ICON_BY_TYPE,
	registerEquipmentIcons,
} from "./mapbox-shared-style";
import type { EquipmentMapItem, IncidentMapItem } from "./types";

export const EQUIPMENT_ZOOM_SPLITTER = 10;
export const EQUIPMENT_ZOOM_NAP = 12;

export const EQUIPMENT_LAYER_SUFFIXES = [
	"halo",
	"core",
	"icons",
	"incident",
	"label-backing",
	"labels",
] as const;

export type EquipmentLayerSuffix = (typeof EQUIPMENT_LAYER_SUFFIXES)[number];

export function equipmentLayerId(prefix: string, suffix: EquipmentLayerSuffix) {
	return `${prefix}-equipment-${suffix}`;
}

export function equipmentLayerIds(prefix: string) {
	return EQUIPMENT_LAYER_SUFFIXES.map((suffix) =>
		equipmentLayerId(prefix, suffix),
	);
}

export function buildEquipmentGeoJson(
	equipment: EquipmentMapItem[],
	incidentsByEquipment:
		| Map<string, IncidentMapItem>
		| Record<string, IncidentMapItem>,
): GeoJSON.FeatureCollection {
	const hasIncident = (id: string) =>
		incidentsByEquipment instanceof Map
			? incidentsByEquipment.has(id)
			: Boolean(incidentsByEquipment[id]);

	return {
		type: "FeatureCollection",
		features: equipment
			.filter((item) => Number.isFinite(item.lng) && Number.isFinite(item.lat))
			.map((item) => ({
				type: "Feature" as const,
				id: item.id,
				geometry: {
					type: "Point" as const,
					coordinates: [item.lng, item.lat],
				},
				properties: {
					equipment_id: item.id,
					type: item.type,
					status: item.status,
					code: item.code,
					label: formatMapLabel(item.code, 14),
					has_incident: hasIncident(item.id),
				},
			})),
	};
}

export async function addEquipmentSourceAndLayers({
	map,
	sourceId,
	layerPrefix,
	data,
	visible = true,
}: {
	map: mapboxgl.Map;
	sourceId: string;
	layerPrefix: string;
	data: GeoJSON.FeatureCollection;
	visible?: boolean;
}) {
	map.addSource(sourceId, { type: "geojson", data });
	await registerEquipmentIcons(map);

	const visibility = visible ? "visible" : "none";

	map.addLayer({
		id: equipmentLayerId(layerPrefix, "halo"),
		type: "circle",
		source: sourceId,
		layout: { visibility },
		paint: {
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				10,
				["match", ["get", "type"], "olt", 22, "splitter", 18, "nap", 18, 16],
				14,
				["match", ["get", "type"], "olt", 30, "splitter", 25, "nap", 25, 21],
				16,
				["match", ["get", "type"], "olt", 38, "splitter", 31, "nap", 31, 26],
				18,
				["match", ["get", "type"], "olt", 46, "splitter", 38, "nap", 38, 31],
			],
			"circle-color": [
				"match",
				["get", "status"],
				"online",
				STATUS_COLOR.online,
				"active",
				STATUS_COLOR.online,
				"alarm",
				STATUS_COLOR.alarm,
				"offline",
				STATUS_COLOR.offline,
				"maintenance",
				STATUS_COLOR.maintenance,
				STATUS_COLOR.unknown,
			],
			"circle-opacity": 0.22,
			"circle-stroke-color": "rgba(230,230,230,0.28)",
			"circle-stroke-width": 0.8,
			"circle-emissive-strength": 0.45,
		},
	});

	map.addLayer({
		id: equipmentLayerId(layerPrefix, "core"),
		type: "circle",
		source: sourceId,
		layout: { visibility },
		paint: {
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				10,
				["match", ["get", "type"], "olt", 18, "splitter", 15, "nap", 15, 13],
				14,
				["match", ["get", "type"], "olt", 25, "splitter", 21, "nap", 21, 17],
				16,
				["match", ["get", "type"], "olt", 33, "splitter", 27, "nap", 27, 22],
				18,
				["match", ["get", "type"], "olt", 41, "splitter", 34, "nap", 34, 27],
			],
			"circle-color": [
				"match",
				["get", "type"],
				"olt",
				TYPE_COLOR.olt,
				"splitter",
				TYPE_COLOR.splitter,
				"nap",
				TYPE_COLOR.nap,
				"ont",
				TYPE_COLOR.ont,
				TYPE_COLOR.unknown,
			],
			"circle-opacity": 0.88,
			"circle-stroke-color": "rgba(230,230,230,0.38)",
			"circle-stroke-width": 1.25,
			"circle-emissive-strength": 0.35,
		},
	});

	map.addLayer({
		id: equipmentLayerId(layerPrefix, "icons"),
		type: "symbol",
		source: sourceId,
		layout: {
			visibility,
			"icon-image": [
				"match",
				["get", "type"],
				"olt",
				EQUIPMENT_ICON_BY_TYPE.olt,
				"splitter",
				EQUIPMENT_ICON_BY_TYPE.splitter,
				"nap",
				EQUIPMENT_ICON_BY_TYPE.nap,
				"ont",
				EQUIPMENT_ICON_BY_TYPE.ont,
				EQUIPMENT_ICON_BY_TYPE.ont,
			],
			"icon-size": [
				"interpolate",
				["linear"],
				["zoom"],
				10,
				1.3,
				14,
				1.85,
				16,
				2.3,
				18,
				2.8,
			],
			"icon-allow-overlap": true,
			"icon-ignore-placement": true,
		},
	});

	map.addLayer({
		id: equipmentLayerId(layerPrefix, "incident"),
		type: "circle",
		source: sourceId,
		layout: { visibility },
		filter: ["==", "has_incident", true],
		paint: {
			"circle-radius": 4,
			"circle-color": "#fb4d6d",
			"circle-stroke-color": "#1b1c1d",
			"circle-stroke-width": 1.5,
			"circle-translate": [8, -8],
		},
	});

	const labelLayout: mapboxgl.SymbolLayerSpecification["layout"] = {
		visibility,
		"text-field": ["get", "label"],
		"text-size": ["interpolate", ["linear"], ["zoom"], 10, 11.5, 16, 14],
		"text-offset": [
			"interpolate",
			["linear"],
			["zoom"],
			10,
			["literal", [0, 2.75]],
			16,
			["literal", [0, 3.5]],
			18,
			["literal", [0, 4]],
		],
		"text-anchor": "top",
		"text-allow-overlap": true,
		"text-ignore-placement": true,
	};

	map.addLayer({
		id: equipmentLayerId(layerPrefix, "label-backing"),
		type: "symbol",
		source: sourceId,
		layout: labelLayout,
		paint: {
			"text-color": "rgba(15,23,42,0.72)",
			"text-halo-color": "rgba(15,23,42,0.78)",
			"text-halo-width": 3,
			"text-halo-blur": 0.9,
			"text-opacity": 0.9,
			"text-emissive-strength": 0.1,
		},
	});

	map.addLayer({
		id: equipmentLayerId(layerPrefix, "labels"),
		type: "symbol",
		source: sourceId,
		layout: labelLayout,
		paint: {
			"text-color": [
				"match",
				["get", "type"],
				"olt",
				"#38d8ff",
				"splitter",
				"#b8a2ff",
				"nap",
				"#fbbf24",
				"ont",
				"#5ee6a8",
				"#f1f5f9",
			],
			"text-halo-color": "rgba(15,23,42,0.92)",
			"text-halo-width": 1.45,
			"text-halo-blur": 0.35,
			"text-opacity": 0.98,
			"text-emissive-strength": 0.55,
		},
	});
}

export function setEquipmentLayersVisibility(
	map: mapboxgl.Map,
	layerPrefix: string,
	visible: boolean,
) {
	for (const layerId of equipmentLayerIds(layerPrefix)) {
		if (map.getLayer(layerId)) {
			map.setLayoutProperty(
				layerId,
				"visibility",
				visible ? "visible" : "none",
			);
		}
	}
}

export function setEquipmentLayersFilter(
	map: mapboxgl.Map,
	layerPrefix: string,
	filters: mapboxgl.FilterSpecification[],
) {
	const filter: mapboxgl.FilterSpecification =
		filters.length === 0 ? ["all"] : ["all", ...filters];

	for (const suffix of EQUIPMENT_LAYER_SUFFIXES) {
		const layerId = equipmentLayerId(layerPrefix, suffix);
		if (!map.getLayer(layerId)) continue;
		if (suffix === "incident") {
			map.setFilter(layerId, ["all", ...filters, ["==", "has_incident", true]]);
		} else {
			map.setFilter(layerId, filter);
		}
	}
}

export function readonlyEquipmentZoomFilters(zoom: number, filterType = "all") {
	const filters: mapboxgl.FilterSpecification[] = [];
	if (zoom < EQUIPMENT_ZOOM_SPLITTER && filterType !== "splitter")
		filters.push(["!=", "type", "splitter"]);
	if (zoom < EQUIPMENT_ZOOM_NAP && filterType !== "nap")
		filters.push(["!=", "type", "nap"]);
	return filters;
}
