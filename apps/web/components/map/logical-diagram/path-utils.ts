import type { LayoutNode, TreeNode } from "./types";

// Returns the set of element IDs on the path from any root down to targetId
// (ancestors inclusive of target). Returns empty set if not found.
export function findAncestorChain(
	roots: TreeNode[],
	targetId: string,
): Set<string> {
	const chain = new Set<string>();

	function dfs(node: TreeNode, path: string[]): boolean {
		const curr = [...path, node.element.id];
		if (node.element.id === targetId) {
			for (const id of curr) chain.add(id);
			return true;
		}
		for (const child of node.children) {
			if (dfs(child, curr)) return true;
		}
		return false;
	}

	for (const root of roots) {
		if (dfs(root, [])) break;
	}

	return chain;
}

// Returns the set of route IDs that connect consecutive elements in the chain.
export function findRouteIdsOnPath(
	chain: Set<string>,
	layoutNodes: LayoutNode[],
): Set<string> {
	const result = new Set<string>();
	for (const node of layoutNodes) {
		const route = node.tree.routeFromParent;
		if (!route) continue;
		if (
			chain.has(route.from_element_id ?? "") &&
			chain.has(node.tree.element.id)
		) {
			result.add(route.id);
		}
	}
	return result;
}

// Walk a subtree and collect every element ID within it.
export function collectDescendants(
	node: TreeNode,
	out: Set<string> = new Set(),
): Set<string> {
	out.add(node.element.id);
	for (const child of node.children) collectDescendants(child, out);
	return out;
}

// Find a node by ID anywhere in the forest.
export function findNodeById(roots: TreeNode[], id: string): TreeNode | null {
	for (const root of roots) {
		const found = findInSubtree(root, id);
		if (found) return found;
	}
	return null;
}

function findInSubtree(node: TreeNode, id: string): TreeNode | null {
	if (node.element.id === id) return node;
	for (const child of node.children) {
		const found = findInSubtree(child, id);
		if (found) return found;
	}
	return null;
}
