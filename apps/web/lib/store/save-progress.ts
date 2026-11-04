import type {
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";

// Funciones puras que aplican al estado del editor el resultado de cada
// escritura confirmada por la BD durante save().
//
// Por qué existen: save() hace varias RPCs en secuencia y no es transaccional.
// Si la ruta 3 de 5 fallaba, los elementos ya estaban en la BD pero el store
// seguía con sus IDs temporales en createdElementIds, y reintentar los creaba
// de nuevo (duplicados). Aplicando cada resultado en cuanto se confirma, el
// store siempre refleja lo que ya existe en la BD y un reintento continúa donde
// quedó.

export interface SaveTrackedState {
	elements: Record<string, InfrastructureElement>;
	routes: Record<string, FiberRoute>;
	routePoints: Record<string, RoutePoint>;
	createdElementIds: string[];
	createdRouteIds: string[];
	createdRoutePointIds: string[];
	modifiedElementIds: string[];
	modifiedRouteIds: string[];
	modifiedRoutePointIds: string[];
	selection: { id: string; kind: "element" | "route" | "routePoint" } | null;
}

type Patch = Partial<SaveTrackedState>;

function withoutKey<T>(record: Record<string, T>, key: string) {
	const { [key]: _removed, ...rest } = record;
	return rest;
}

function replaceId(ids: string[], from: string, to: string) {
	return ids.includes(from) ? ids.map((id) => (id === from ? to : id)) : ids;
}

function remapSelection(
	selection: SaveTrackedState["selection"],
	from: string,
	to: string,
): SaveTrackedState["selection"] {
	return selection?.id === from ? { ...selection, id: to } : selection;
}

function addUniqueId(ids: string[], id: string) {
	return ids.includes(id) ? ids : [...ids, id];
}

// Resuelve qué versión conservar cuando la BD confirma un INSERT.
// `sent` es la referencia exacta que se envió. Si el objeto local cambió
// mientras la RPC estaba en vuelo (el mapa sigue editable durante el guardado),
// se conserva la versión local con el ID real y se encola como modificación
// para que el mismo save() la actualice. Si el usuario lo borró localmente
// mientras tanto, se conserva lo que devolvió la BD: ya existe allí y
// ocultarlo dejaría un huérfano invisible.
function resolveCreated<T extends { id: string }>(
	local: T | undefined,
	sent: T,
	saved: T,
): { value: T; changedInFlight: boolean } {
	if (local === undefined || local === sent) {
		return { value: saved, changedInFlight: false };
	}
	return { value: { ...local, id: saved.id }, changedInFlight: true };
}

function nextModifiedIds(
	ids: string[],
	tempId: string,
	realId: string,
	changedInFlight: boolean,
) {
	const remapped = replaceId(ids, tempId, realId);
	return changedInFlight ? addUniqueId(remapped, realId) : remapped;
}

// Un elemento temporal ya existe en la BD con `saved.id`. Reemplaza la clave,
// lo saca de la cola de creación y reapunta las rutas que lo referencian.
export function applyCreatedElement(
	state: SaveTrackedState,
	tempId: string,
	sent: InfrastructureElement,
	saved: InfrastructureElement,
): Patch {
	const { value, changedInFlight } = resolveCreated(
		state.elements[tempId],
		sent,
		saved,
	);

	const routes: Record<string, FiberRoute> = {};
	for (const [id, route] of Object.entries(state.routes)) {
		const from =
			route.from_element_id === tempId ? saved.id : route.from_element_id;
		const to = route.to_element_id === tempId ? saved.id : route.to_element_id;
		routes[id] =
			from === route.from_element_id && to === route.to_element_id
				? route
				: { ...route, from_element_id: from, to_element_id: to };
	}

	return {
		elements: { ...withoutKey(state.elements, tempId), [saved.id]: value },
		routes,
		createdElementIds: state.createdElementIds.filter((id) => id !== tempId),
		modifiedElementIds: nextModifiedIds(
			state.modifiedElementIds,
			tempId,
			saved.id,
			changedInFlight,
		),
		selection: remapSelection(state.selection, tempId, saved.id),
	};
}

// Una ruta temporal ya existe en la BD. Reapunta sus puntos de ruta.
export function applyCreatedRoute(
	state: SaveTrackedState,
	tempId: string,
	sent: FiberRoute,
	saved: FiberRoute,
): Patch {
	const { value, changedInFlight } = resolveCreated(
		state.routes[tempId],
		sent,
		saved,
	);

	const routePoints: Record<string, RoutePoint> = {};
	for (const [id, point] of Object.entries(state.routePoints)) {
		routePoints[id] =
			point.fiber_route_id === tempId
				? { ...point, fiber_route_id: saved.id }
				: point;
	}

	return {
		routes: { ...withoutKey(state.routes, tempId), [saved.id]: value },
		routePoints,
		createdRouteIds: state.createdRouteIds.filter((id) => id !== tempId),
		modifiedRouteIds: nextModifiedIds(
			state.modifiedRouteIds,
			tempId,
			saved.id,
			changedInFlight,
		),
		selection: remapSelection(state.selection, tempId, saved.id),
	};
}

export function applyCreatedRoutePoint(
	state: SaveTrackedState,
	tempId: string,
	sent: RoutePoint,
	saved: RoutePoint,
): Patch {
	const { value, changedInFlight } = resolveCreated(
		state.routePoints[tempId],
		sent,
		saved,
	);

	return {
		routePoints: {
			...withoutKey(state.routePoints, tempId),
			[saved.id]: value,
		},
		createdRoutePointIds: state.createdRoutePointIds.filter(
			(id) => id !== tempId,
		),
		modifiedRoutePointIds: nextModifiedIds(
			state.modifiedRoutePointIds,
			tempId,
			saved.id,
			changedInFlight,
		),
		selection: remapSelection(state.selection, tempId, saved.id),
	};
}

// Una actualización ya se persistió: sale de la cola para no reenviarla, salvo
// que el objeto haya vuelto a cambiar mientras la RPC estaba en vuelo; en ese
// caso se conserva la versión local y sigue pendiente.
export function applyUpdatedElement(
	state: SaveTrackedState,
	id: string,
	sent: InfrastructureElement,
): Patch {
	if (state.elements[id] !== sent) return {};
	return {
		modifiedElementIds: state.modifiedElementIds.filter((item) => item !== id),
	};
}

export function applyUpdatedRoute(
	state: SaveTrackedState,
	id: string,
	sent: FiberRoute,
	saved: FiberRoute,
): Patch {
	if (state.routes[id] !== sent) return {};
	return {
		routes: { ...state.routes, [id]: saved },
		modifiedRouteIds: state.modifiedRouteIds.filter((item) => item !== id),
	};
}

export function applyUpdatedRoutePoint(
	state: SaveTrackedState,
	id: string,
	sent: RoutePoint,
	saved: RoutePoint,
): Patch {
	if (state.routePoints[id] !== sent) return {};
	return {
		routePoints: { ...state.routePoints, [id]: saved },
		modifiedRoutePointIds: state.modifiedRoutePointIds.filter(
			(item) => item !== id,
		),
	};
}

// Cuenta solo IDs cuyo objeto sigue existiendo: los remove* dejan el ID en la
// cola a propósito (un undo puede restaurar el objeto), y save() los salta.
export function pendingChangeCount(state: SaveTrackedState): number {
	const count = (ids: string[], record: Record<string, unknown>) =>
		ids.filter((id) => id in record).length;
	return (
		count(state.createdElementIds, state.elements) +
		count(state.createdRouteIds, state.routes) +
		count(state.createdRoutePointIds, state.routePoints) +
		count(state.modifiedElementIds, state.elements) +
		count(state.modifiedRouteIds, state.routes) +
		count(state.modifiedRoutePointIds, state.routePoints)
	);
}
