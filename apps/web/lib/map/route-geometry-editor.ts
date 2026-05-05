export type RouteCoordinate = [longitude: number, latitude: number];

export type RouteVertexRole = "start" | "intermediate" | "end";

export interface RouteVertex {
	coordinate: RouteCoordinate;
	index: number;
	isLocked: boolean;
	role: RouteVertexRole;
}

export interface RouteMidpoint {
	coordinate: RouteCoordinate;
	insertAfterIndex: number;
}

export function getRouteVertices(
	coordinates: RouteCoordinate[],
): RouteVertex[] {
	return coordinates.map((coordinate, index) => {
		const isFirst = index === 0;
		const isLast = index === coordinates.length - 1;
		return {
			coordinate,
			index,
			isLocked: isFirst || isLast,
			role: isFirst ? "start" : isLast ? "end" : "intermediate",
		};
	});
}

export function getRouteMidpoints(
	coordinates: RouteCoordinate[],
): RouteMidpoint[] {
	const midpoints: RouteMidpoint[] = [];
	for (let index = 0; index < coordinates.length - 1; index += 1) {
		const from = coordinates[index];
		const to = coordinates[index + 1];
		midpoints.push({
			coordinate: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
			insertAfterIndex: index,
		});
	}
	return midpoints;
}

export function insertRouteVertex(
	coordinates: RouteCoordinate[],
	afterIndex: number,
	coordinate: RouteCoordinate,
): RouteCoordinate[] {
	if (afterIndex < 0 || afterIndex >= coordinates.length - 1)
		return coordinates;
	return [
		...coordinates.slice(0, afterIndex + 1),
		coordinate,
		...coordinates.slice(afterIndex + 1),
	];
}

export function moveRouteVertex(
	coordinates: RouteCoordinate[],
	vertexIndex: number,
	coordinate: RouteCoordinate,
): RouteCoordinate[] {
	if (vertexIndex <= 0 || vertexIndex >= coordinates.length - 1)
		return coordinates;
	return coordinates.map((current, index) =>
		index === vertexIndex ? coordinate : current,
	);
}

export function removeRouteVertex(
	coordinates: RouteCoordinate[],
	vertexIndex: number,
): RouteCoordinate[] {
	if (vertexIndex <= 0 || vertexIndex >= coordinates.length - 1)
		return coordinates;
	return coordinates.filter((_, index) => index !== vertexIndex);
}

export function calculateRouteLengthMeters(coordinates: RouteCoordinate[]) {
	const earthRadiusMeters = 6371008.8;
	const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
	let total = 0;
	for (let index = 1; index < coordinates.length; index += 1) {
		const [previousLng, previousLat] = coordinates[index - 1];
		const [currentLng, currentLat] = coordinates[index];
		const previousLatRad = toRadians(previousLat);
		const currentLatRad = toRadians(currentLat);
		const deltaLat = toRadians(currentLat - previousLat);
		const deltaLng = toRadians(currentLng - previousLng);
		const a =
			Math.sin(deltaLat / 2) ** 2 +
			Math.cos(previousLatRad) *
				Math.cos(currentLatRad) *
				Math.sin(deltaLng / 2) ** 2;
		total += 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}
	return Math.round(total * 100) / 100;
}
