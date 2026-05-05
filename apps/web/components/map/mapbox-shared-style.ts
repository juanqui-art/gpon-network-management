import type mapboxgl from "mapbox-gl";
import { equipmentSymbolSvg } from "@/lib/gpon/symbology";
import { CABLE_COLOR, TYPE_COLOR } from "@/lib/map/palette";

export const FIBER_RENDER_COLOR: Record<string, string> = {
	feeder: CABLE_COLOR.feeder,
	distribution: CABLE_COLOR.distribution,
	drop: CABLE_COLOR.drop,
	default: "#d7d7d7",
};

export const EQUIPMENT_ICON_BY_TYPE: Record<string, string> = {
	olt: "gpon-icon-olt",
	splitter: "gpon-icon-splitter",
	nap: "gpon-icon-nap",
	ont: "gpon-icon-ont",
};

const NOISE_LAYERS = [
	"poi-label",
	"transit-label",
	"airport-label",
	"natural-point-label",
	"settlement-subdivision-label",
	"waterway-label",
	"road-label",
	"path-pedestrian-label",
];

const NOISE_LAYER_PATTERNS = [
	"poi",
	"transit",
	"airport",
	"natural",
	"waterway",
	"road",
	"street",
	"pedestrian",
	"path",
];

export function hideNoisyMapLabels(map: mapboxgl.Map) {
	for (const layer of NOISE_LAYERS) {
		if (map.getLayer(layer)) {
			map.setLayoutProperty(layer, "visibility", "none");
		}
	}

	for (const layer of map.getStyle().layers ?? []) {
		if (layer.type !== "symbol") continue;
		const layerId = layer.id.toLowerCase();
		const shouldHide = NOISE_LAYER_PATTERNS.some((pattern) =>
			layerId.includes(pattern),
		);
		if (shouldHide && map.getLayer(layer.id)) {
			map.setLayoutProperty(layer.id, "visibility", "none");
		}
	}
}

export function registerEquipmentIcons(map: mapboxgl.Map) {
	const iconEntries = [
		["olt", TYPE_COLOR.olt],
		["splitter", TYPE_COLOR.splitter],
		["nap", TYPE_COLOR.nap],
		["ont", TYPE_COLOR.ont],
	] as const;

	for (const [type, color] of iconEntries) {
		const imageId = EQUIPMENT_ICON_BY_TYPE[type];
		if (map.hasImage(imageId)) continue;

		const image = new Image();
		image.decoding = "async";
		image.onload = () => {
			if (!map.hasImage(imageId)) {
				map.addImage(imageId, image, { pixelRatio: 2 });
			}
		};
		image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
			equipmentSymbolSvg(type, color),
		)}`;
	}
}
