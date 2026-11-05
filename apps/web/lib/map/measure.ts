import { calculateRouteLengthMeters } from "@/lib/map/route-geometry-editor";

/**
 * Ruler for the network editor: same haversine as fiber route lengths
 * (calculateRouteLengthMeters), so a measured span matches what a route drawn
 * over it would report.
 */
export type MeasurePoint = [lng: number, lat: number];

export interface MeasureSummary {
	totalMeters: number;
	lastSegmentMeters: number | null;
	segments: number;
}

export function summarizeMeasure(points: MeasurePoint[]): MeasureSummary {
	const segments = Math.max(0, points.length - 1);
	return {
		totalMeters: calculateRouteLengthMeters(points),
		lastSegmentMeters:
			segments > 0 ? calculateRouteLengthMeters(points.slice(-2)) : null,
		segments,
	};
}

/**
 * Adds a point unless it repeats the previous one (a double click fires two
 * clicks on the same spot, which would add a 0 m segment).
 */
export function appendMeasurePoint(
	points: MeasurePoint[],
	point: MeasurePoint,
	minMeters = 0.5,
): MeasurePoint[] {
	const last = points.at(-1);
	if (last && calculateRouteLengthMeters([last, point]) < minMeters) {
		return points;
	}
	return [...points, point];
}

/** "345 m" below 1 km, "1.24 km" above. */
export function formatDistance(meters: number): string {
	if (!Number.isFinite(meters)) return "—";
	if (meters < 1000) return `${Math.round(meters)} m`;
	return `${(meters / 1000).toFixed(meters < 10_000 ? 2 : 1)} km`;
}

export function buildMeasureGeoJson(
	points: MeasurePoint[],
): GeoJSON.FeatureCollection {
	const features: GeoJSON.Feature[] = points.map((point, index) => ({
		type: "Feature",
		properties: { index, kind: "vertex" },
		geometry: { type: "Point", coordinates: point },
	}));
	if (points.length >= 2) {
		features.unshift({
			type: "Feature",
			properties: { kind: "line" },
			geometry: { type: "LineString", coordinates: points },
		});
	}
	return { type: "FeatureCollection", features };
}
