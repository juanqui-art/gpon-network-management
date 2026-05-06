import type {
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import type { TreeNode } from "./types";

const TYPE_RANK: Record<InfrastructureElement["type"], number> = {
	olt: 0,
	splitter: 1,
	nap: 2,
};

function normalizeRouteDirection(
	route: FiberRoute,
	elements: Record<string, InfrastructureElement>,
): {
	parent: InfrastructureElement;
	child: InfrastructureElement;
	route: FiberRoute;
} | null {
	if (!route.from_element_id || !route.to_element_id) return null;

	const from = elements[route.from_element_id];
	const to = elements[route.to_element_id];
	if (!from || !to) return null;

	const fromRank = TYPE_RANK[from.type];
	const toRank = TYPE_RANK[to.type];
	if (fromRank === toRank) {
		return { parent: from, child: to, route };
	}

	if (fromRank < toRank) {
		return { parent: from, child: to, route };
	}

	return {
		parent: to,
		child: from,
		route: {
			...route,
			from_element_id: to.id,
			to_element_id: from.id,
			from_element_type: to.type,
			to_element_type: from.type,
		},
	};
}

export function buildNetworkTree(
	elements: Record<string, InfrastructureElement>,
	routes: Record<string, FiberRoute>,
	routePoints: Record<string, RoutePoint>,
): TreeNode[] {
	const childrenMap = new Map<
		string,
		Array<{ element: InfrastructureElement; route: FiberRoute }>
	>();

	for (const route of Object.values(routes)) {
		const normalized = normalizeRouteDirection(route, elements);
		if (!normalized) continue;

		if (!childrenMap.has(normalized.parent.id)) {
			childrenMap.set(normalized.parent.id, []);
		}
		childrenMap.get(normalized.parent.id)?.push({
			element: normalized.child,
			route: normalized.route,
		});
	}

	function buildSubtree(
		elementId: string,
		depth: number,
		path: Set<string>,
	): TreeNode | null {
		const element = elements[elementId];
		if (!element) return null;

		const children: TreeNode[] = [];
		for (const { element: childEl, route } of childrenMap.get(elementId) ??
			[]) {
			if (path.has(childEl.id)) continue;

			const splices = Object.values(routePoints).filter(
				(rp) => rp.fiber_route_id === route.id && rp.type === "splice",
			);
			const nextPath = new Set(path);
			nextPath.add(childEl.id);
			const childNode = buildSubtree(childEl.id, depth + 1, nextPath);
			if (childNode) {
				childNode.routeFromParent = route;
				childNode.splicesOnRoute = splices;
				children.push(childNode);
			}
		}

		return {
			element,
			routeFromParent: null,
			splicesOnRoute: [],
			children,
			depth,
		};
	}

	return Object.values(elements)
		.filter((el) => el.type === "olt")
		.map((el) => buildSubtree(el.id, 0, new Set([el.id])))
		.filter((n): n is TreeNode => n !== null);
}
