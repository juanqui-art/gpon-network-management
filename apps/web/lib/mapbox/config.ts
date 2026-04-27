import { env } from "@/lib/env";

export const MAPBOX_TOKEN = env.mapboxToken;

export const DEFAULT_CENTER: [number, number] = [-79.0045, -2.9006]; // Cuenca / Azuay, Ecuador
export const DEFAULT_ZOOM = 9;

export const MAP_STYLE = "mapbox://styles/juankhha/cmoeztmg9003v01qrbawcapu0";

// Power thresholds for ONT signal coloring (dBm)
export const SIGNAL_THRESHOLDS = {
	good: -20,
	warning: -25,
	critical: -28,
} as const;
