import { hasInternalSplitter } from "@/lib/gpon/nap-config";
import {
	ATTENUATION_DB_PER_KM,
	type OpticalStatus,
	PON_CLASS_BUDGET,
	SAFETY_MARGIN_DB,
	SPLICE_LOSS_DB,
	SPLITTER_LOSS_DB,
} from "@/lib/gpon/optical-budget";
import type { LayoutNode, PathBudget, TreeNode } from "./types";

// ── Visual constants ──────────────────────────────────────────────────────────

export const NODE_WIDTH = 196;
export const NODE_HEIGHT = 108;
export const COL_GAP = 112; // horizontal gap between columns
export const ROW_GAP = 18; // minimum vertical gap between sibling nodes
export const LEAF_SLOT = NODE_HEIGHT + ROW_GAP;
const PADDING_X = 16;
const PADDING_Y = 16;

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

const PON_CLASS_SET = new Set(["B+", "C+", "C++", "N1", "N2", "E1", "E2"]);

function isPonClass(v: string): v is keyof typeof PON_CLASS_BUDGET {
	return PON_CLASS_SET.has(v);
}

// ── Reingold-Tilford layout ───────────────────────────────────────────────────
// Each branch node centers vertically at the midpoint of its first and last
// child centers. Leaves are stacked consecutively. Pure function.

function buildPositions(roots: TreeNode[]): {
	positions: Map<string, { x: number; y: number }>;
	maxDepth: number;
	totalHeight: number;
} {
	const positions = new Map<string, { x: number; y: number }>();
	let maxDepth = 0;

	function placeSubtree(
		node: TreeNode,
		cursor: number,
	): { centerY: number; nextCursor: number } {
		maxDepth = Math.max(maxDepth, node.depth);
		const x = PADDING_X + node.depth * (NODE_WIDTH + COL_GAP);

		if (node.children.length === 0) {
			const center = cursor + NODE_HEIGHT / 2;
			positions.set(node.element.id, { x, y: cursor });
			return { centerY: center, nextCursor: cursor + LEAF_SLOT };
		}

		let cur = cursor;
		let firstCenter: number | null = null;
		let lastCenter = 0;

		for (const child of node.children) {
			const r = placeSubtree(child, cur);
			if (firstCenter === null) firstCenter = r.centerY;
			lastCenter = r.centerY;
			cur = r.nextCursor;
		}

		const myCenter =
			((firstCenter ?? cursor + NODE_HEIGHT / 2) + lastCenter) / 2;
		const myTopY = Math.round(myCenter - NODE_HEIGHT / 2);
		positions.set(node.element.id, { x, y: myTopY });
		return { centerY: myCenter, nextCursor: cur };
	}

	let cursor = PADDING_Y;
	for (const root of roots) {
		const r = placeSubtree(root, cursor);
		cursor = r.nextCursor;
	}

	return { positions, maxDepth, totalHeight: cursor + PADDING_Y - ROW_GAP };
}

// ── Cumulative optical budget ─────────────────────────────────────────────────
// Walks the tree top-down, accumulating fiber/splitter/splice/connector losses
// from the OLT to each node. Status is computed against the full PON class budget.

interface Accumulated {
	fiber: number;
	splitter: number;
	splice: number;
	connector: number;
	length: number;
}

function buildBudgets(
	roots: TreeNode[],
	oltClasses: Map<string, string | null>,
): Map<string, PathBudget> {
	const budgets = new Map<string, PathBudget>();

	function traverse(
		node: TreeNode,
		acc: Accumulated,
		oltClass: string | null,
	): void {
		let segFiber = 0;
		let segSplice = 0;
		let segConnector = 0;
		let segLength = 0;

		if (node.routeFromParent) {
			if (node.routeFromParent.length_meters) {
				segLength = node.routeFromParent.length_meters * 1.02;
				segFiber = (segLength / 1000) * (ATTENUATION_DB_PER_KM["1490"] ?? 0.3);
			}
			for (const sp of node.splicesOnRoute) {
				segSplice += sp.splice_loss_db ?? SPLICE_LOSS_DB;
			}
			segConnector = 2 * 0.5;
		}

		const segSplitter =
			(node.element.type === "splitter" || hasInternalSplitter(node.element)) &&
			node.element.split_ratio
				? (SPLITTER_LOSS_DB[node.element.split_ratio] ?? 0)
				: 0;

		const next: Accumulated = {
			fiber: acc.fiber + segFiber,
			splitter: acc.splitter + segSplitter,
			splice: acc.splice + segSplice,
			connector: acc.connector + segConnector,
			length: acc.length + segLength,
		};

		const totalLoss = round2(
			next.fiber +
				next.splitter +
				next.splice +
				next.connector +
				SAFETY_MARGIN_DB,
		);
		let margin: number | null = null;
		let status: OpticalStatus = "gray";

		if (oltClass && isPonClass(oltClass)) {
			const budget = PON_CLASS_BUDGET[oltClass];
			if (budget) {
				margin = round2(budget.max - totalLoss);
				status = margin > 3 ? "green" : margin >= 1 ? "yellow" : "red";
			}
		}

		budgets.set(node.element.id, {
			fiberLoss: round2(next.fiber),
			splitterLoss: round2(next.splitter),
			spliceLoss: round2(next.splice),
			connectorLoss: round2(next.connector),
			safetyMargin: SAFETY_MARGIN_DB,
			totalLoss,
			margin,
			status,
			cumulativeLengthMeters: Math.round(next.length),
		});

		for (const child of node.children) {
			traverse(child, next, oltClass);
		}
	}

	for (const root of roots) {
		const oltClass = oltClasses.get(root.element.id) ?? null;
		traverse(
			root,
			{ fiber: 0, splitter: 0, splice: 0, connector: 0, length: 0 },
			oltClass,
		);
	}

	return budgets;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface LayoutResult {
	nodes: LayoutNode[];
	totalHeight: number;
	totalWidth: number;
}

export function layoutTree(
	roots: TreeNode[],
	oltClasses: Map<string, string | null>,
): LayoutResult {
	if (roots.length === 0) return { nodes: [], totalHeight: 0, totalWidth: 0 };

	const { positions, maxDepth, totalHeight } = buildPositions(roots);
	const budgets = buildBudgets(roots, oltClasses);

	const nodes: LayoutNode[] = [];
	function walk(node: TreeNode): void {
		const pos = positions.get(node.element.id);
		const budget = budgets.get(node.element.id);
		if (pos && budget) {
			nodes.push({
				tree: node,
				budget,
				x: pos.x,
				y: pos.y,
				width: NODE_WIDTH,
				height: NODE_HEIGHT,
			});
		}
		for (const child of node.children) walk(child);
	}
	for (const root of roots) walk(root);

	const totalWidth =
		PADDING_X * 2 + maxDepth * (NODE_WIDTH + COL_GAP) + NODE_WIDTH;

	return { nodes, totalHeight, totalWidth };
}
