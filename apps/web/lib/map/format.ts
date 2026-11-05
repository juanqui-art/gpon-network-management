/**
 * Display formatting shared by every map inspector.
 * 6 decimals ≈ 0.1 m: enough to tell GPS-captured points apart.
 */
export function formatCoordinates(lat: number, lng: number): string {
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "—";
	return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function formatMeters(value: number | null | undefined, digits = 0) {
	return value == null || !Number.isFinite(value)
		? null
		: `${value.toFixed(digits)} m`;
}

export function formatDb(value: number | null | undefined, digits = 2) {
	return value == null || !Number.isFinite(value)
		? null
		: `${value.toFixed(digits)} dB`;
}
