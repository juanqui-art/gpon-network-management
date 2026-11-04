import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import {
	applyCreatedElement,
	applyCreatedRoute,
	applyCreatedRoutePoint,
	applyUpdatedElement,
	applyUpdatedRoute,
	pendingChangeCount,
	type SaveTrackedState,
} from "./save-progress";

const element = (id: string, extra: Partial<InfrastructureElement> = {}) =>
	({ id, code: id, lng: 0, lat: 0, ...extra }) as InfrastructureElement;

const route = (id: string, from: string | null, to: string | null) =>
	({ id, from_element_id: from, to_element_id: to }) as FiberRoute;

const point = (id: string, routeId: string) =>
	({ id, fiber_route_id: routeId }) as RoutePoint;

function draftState(): SaveTrackedState {
	return {
		elements: { "tmp-olt": element("tmp-olt"), "tmp-nap": element("tmp-nap") },
		routes: { "tmp-r1": route("tmp-r1", "tmp-olt", "tmp-nap") },
		routePoints: { "tmp-p1": point("tmp-p1", "tmp-r1") },
		createdElementIds: ["tmp-olt", "tmp-nap"],
		createdRouteIds: ["tmp-r1"],
		createdRoutePointIds: ["tmp-p1"],
		modifiedElementIds: [],
		modifiedRouteIds: [],
		modifiedRoutePointIds: [],
		selection: { id: "tmp-nap", kind: "element" },
	};
}

function apply(
	state: SaveTrackedState,
	patch: Partial<SaveTrackedState>,
): SaveTrackedState {
	return { ...state, ...patch };
}

describe("applyCreatedElement", () => {
	it("rekeys the element, dequeues it and repoints routes and selection", () => {
		let s = draftState();
		const sent = s.elements["tmp-nap"];
		s = apply(s, applyCreatedElement(s, "tmp-nap", sent, element("db-nap")));

		assert.deepEqual(Object.keys(s.elements).sort(), ["db-nap", "tmp-olt"]);
		assert.deepEqual(s.createdElementIds, ["tmp-olt"]);
		assert.equal(s.routes["tmp-r1"].to_element_id, "db-nap");
		assert.equal(s.routes["tmp-r1"].from_element_id, "tmp-olt");
		assert.deepEqual(s.selection, { id: "db-nap", kind: "element" });
	});

	it("keeps an edit made while the INSERT was in flight and queues it", () => {
		let s = draftState();
		const sent = s.elements["tmp-nap"];
		// El usuario mueve la NAP mientras la RPC está en vuelo.
		s = apply(s, {
			elements: { ...s.elements, "tmp-nap": element("tmp-nap", { lng: 5 }) },
		});
		s = apply(s, applyCreatedElement(s, "tmp-nap", sent, element("db-nap")));

		assert.equal(s.elements["db-nap"].lng, 5);
		assert.equal(s.elements["db-nap"].id, "db-nap");
		assert.deepEqual(s.modifiedElementIds, ["db-nap"]);
	});

	it("keeps the DB row when the element was deleted locally in flight", () => {
		let s = draftState();
		const sent = s.elements["tmp-nap"];
		const { "tmp-nap": _gone, ...rest } = s.elements;
		s = apply(s, { elements: rest });
		s = apply(s, applyCreatedElement(s, "tmp-nap", sent, element("db-nap")));

		assert.ok(s.elements["db-nap"], "exists in DB, must stay visible");
		assert.deepEqual(s.modifiedElementIds, []);
	});
});

describe("partial save and retry", () => {
	it("does not recreate rows that were persisted before a failure", () => {
		let s = draftState();
		const inserts: string[] = [];

		// Intento 1: ambos elementos se guardan y la ruta falla.
		for (const tempId of [...s.createdElementIds]) {
			const sent = s.elements[tempId];
			inserts.push(tempId);
			s = apply(
				s,
				applyCreatedElement(
					s,
					tempId,
					sent,
					element(tempId.replace("tmp", "db")),
				),
			);
		}
		// (createFiberRoute lanza error aquí)

		assert.deepEqual(s.createdElementIds, []);
		assert.deepEqual(s.createdRouteIds, ["tmp-r1"]);
		assert.equal(pendingChangeCount(s), 2);

		// Intento 2: solo lo que falta.
		for (const tempId of [...s.createdElementIds]) inserts.push(tempId);
		const r = s.routes["tmp-r1"];
		assert.equal(r.from_element_id, "db-olt");
		assert.equal(r.to_element_id, "db-nap");
		s = apply(
			s,
			applyCreatedRoute(s, "tmp-r1", r, route("db-r1", "db-olt", "db-nap")),
		);
		const p = s.routePoints["tmp-p1"];
		assert.equal(p.fiber_route_id, "db-r1");
		s = apply(
			s,
			applyCreatedRoutePoint(s, "tmp-p1", p, point("db-p1", "db-r1")),
		);

		assert.deepEqual(inserts, ["tmp-olt", "tmp-nap"], "no duplicate inserts");
		assert.equal(pendingChangeCount(s), 0);
		assert.deepEqual(Object.keys(s.routePoints), ["db-p1"]);
	});
});

describe("updates", () => {
	it("dequeues an update once persisted", () => {
		const e = element("db-1");
		const s: SaveTrackedState = {
			...draftState(),
			elements: { "db-1": e },
			modifiedElementIds: ["db-1"],
		};
		assert.deepEqual(applyUpdatedElement(s, "db-1", e).modifiedElementIds, []);
	});

	it("keeps the update queued and the local version if it changed in flight", () => {
		const sent = route("db-r", "a", "b");
		const local = route("db-r", "a", "c");
		const s: SaveTrackedState = {
			...draftState(),
			routes: { "db-r": local },
			modifiedRouteIds: ["db-r"],
		};
		const patch = applyUpdatedRoute(s, "db-r", sent, route("db-r", "a", "b"));
		assert.deepEqual(patch, {});
	});
});

describe("pendingChangeCount", () => {
	it("ignores queued ids whose object was removed locally", () => {
		const s = draftState();
		const { "tmp-p1": _gone, ...routePoints } = s.routePoints;
		assert.equal(pendingChangeCount(s), 4);
		assert.equal(pendingChangeCount({ ...s, routePoints }), 3);
	});
});
