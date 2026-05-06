import { hasInternalSplitter } from "@/lib/gpon/nap-config";
import {
	ATTENUATION_DB_PER_KM,
	CONNECTOR_LOSS_DB,
	type OpticalStatus,
	PON_CLASS_BUDGET,
	PON_CLASS_POWER_PROFILE,
	SAFETY_MARGIN_DB,
	SPLICE_LOSS_DB,
	SPLITTER_LOSS_DB,
} from "@/lib/gpon/optical-budget";
import type {
	BudgetLossEvent,
	LayoutNode,
	PathBudget,
	TreeNode,
} from "./types";

// ── Visual constants ──────────────────────────────────────────────────────────

export const NODE_WIDTH = 196;
export const NODE_HEIGHT = 116;
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
	headend: number;
	fiber: number;
	splitter: number;
	splice: number;
	connector: number;
	additional: number;
	length: number;
	lossEvents: BudgetLossEvent[];
	warnings: string[];
}

const CABLE_FACTOR = 1.02;

function routeLabel(route: TreeNode["routeFromParent"]): string {
	return route?.code ?? "Tramo sin codigo";
}

function numericProperty(
	properties: Record<string, unknown> | null | undefined,
	key: string,
): number | null {
	const value = properties?.[key];
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function addLossEvent(
	events: BudgetLossEvent[],
	event: BudgetLossEvent,
): BudgetLossEvent[] {
	if (Math.abs(event.loss) <= 0.01) return events;
	return [...events, { ...event, loss: round2(event.loss) }];
}

function routeEndpointSection(node: TreeNode): string {
	const to = node.element;
	if (to.type === "splitter") return "Mufa / splitter primario";
	if (to.type === "nap") return "Distribucion hacia NAP";
	return "Tramo de fibra";
}

function inferredNapSplitRatio(node: TreeNode): string | null {
	const { element } = node;
	if (element.type !== "nap" || !hasInternalSplitter(element)) return null;
	if (element.split_ratio) return element.split_ratio;
	if (element.total_ports && element.total_ports > 0) {
		return `1:${element.total_ports}`;
	}
	return null;
}

function napOutputConnectorLoss(node: TreeNode): number {
	if (node.element.type !== "nap" || !hasInternalSplitter(node.element))
		return 0;
	return (
		numericProperty(node.element.properties, "nap_output_connector_loss_db") ??
		CONNECTOR_LOSS_DB
	);
}

function napInputFusionLoss(node: TreeNode): number {
	if (node.element.type !== "nap" || !hasInternalSplitter(node.element))
		return 0;
	return (
		numericProperty(node.element.properties, "nap_input_splice_loss_db") ??
		SPLICE_LOSS_DB
	);
}

function estimateHeadendLoss(node: TreeNode): {
	loss: number;
	warnings: string[];
} {
	const { element } = node;
	if (element.type !== "olt") return { loss: 0, warnings: [] };

	const configuredLoss = numericProperty(element.properties, "headend_loss_db");
	if (configuredLoss !== null) return { loss: configuredLoss, warnings: [] };

	const connectorCount =
		numericProperty(element.properties, "headend_connector_count") ?? 2;
	const adapterCount =
		numericProperty(element.properties, "headend_adapter_count") ?? 1;
	const adapterLossDb =
		numericProperty(element.properties, "headend_adapter_loss_db") ?? 0.2;
	const loss =
		connectorCount * CONNECTOR_LOSS_DB + adapterCount * adapterLossDb;

	return {
		loss,
		warnings: [
			`${element.code ?? element.name ?? "OLT"} usa perdida de cabecera estimada`,
		],
	};
}

function resolveOltPowerProfile(
	node: TreeNode,
	oltClass: string | null,
): {
	txPowerDbm: number | null;
	rxSensitivityDbm: number | null;
	warnings: string[];
} {
	const txPowerDbm =
		numericProperty(node.element.properties, "tx_power_dbm") ??
		numericProperty(node.element.properties, "olt_tx_power_dbm") ??
		null;
	const rxSensitivityDbm =
		numericProperty(node.element.properties, "rx_sensitivity_dbm") ??
		numericProperty(node.element.properties, "ont_rx_sensitivity_dbm") ??
		numericProperty(node.element.properties, "receiver_sensitivity_dbm") ??
		null;

	if (!oltClass || !isPonClass(oltClass)) {
		return { txPowerDbm, rxSensitivityDbm, warnings: [] };
	}

	const profile = PON_CLASS_POWER_PROFILE[oltClass];
	return {
		txPowerDbm: txPowerDbm ?? profile?.defaultTxDbm ?? null,
		rxSensitivityDbm: rxSensitivityDbm ?? profile?.rxSensitivityDbm ?? null,
		warnings: [
			...(txPowerDbm === null && profile
				? [
						`${node.element.code ?? node.element.name ?? "OLT"} usa Tx estimado por clase ${oltClass}`,
					]
				: []),
			...(rxSensitivityDbm === null && profile
				? [
						`${node.element.code ?? node.element.name ?? "OLT"} usa sensibilidad Rx estimada por clase ${oltClass}`,
					]
				: []),
		],
	};
}

function buildBudgets(
	roots: TreeNode[],
	oltClasses: Map<string, string | null>,
): Map<string, PathBudget> {
	const budgets = new Map<string, PathBudget>();
	type PowerProfile = ReturnType<typeof resolveOltPowerProfile>;

	function traverse(
		node: TreeNode,
		acc: Accumulated,
		oltClass: string | null,
		powerProfile: PowerProfile,
	): void {
		let segFiber = 0;
		let segSplice = 0;
		let segConnector = 0;
		let segAdditional = 0;
		let segLength = 0;
		const segmentWarnings: string[] = [];
		const headend =
			node.depth === 0 ? estimateHeadendLoss(node) : { loss: 0, warnings: [] };

		if (node.routeFromParent) {
			const route = node.routeFromParent;
			if (route.length_meters) {
				const attenuationDbPerKm =
					route.attenuation_db_per_km ?? ATTENUATION_DB_PER_KM["1490"] ?? 0.3;
				segLength = route.length_meters * CABLE_FACTOR;
				segFiber = (segLength / 1000) * attenuationDbPerKm;
				if (route.attenuation_db_per_km == null) {
					segmentWarnings.push(
						`${routeLabel(route)} usa atenuacion 1490 nm por defecto`,
					);
				}
			} else {
				segmentWarnings.push(
					`${routeLabel(route)} no tiene longitud calculada`,
				);
			}

			if (route.splice_loss_db != null) {
				segSplice = route.splice_loss_db;
			}
			for (const sp of node.splicesOnRoute) {
				segSplice += sp.splice_loss_db ?? SPLICE_LOSS_DB;
			}
			if (node.splicesOnRoute.length > 0) {
				segmentWarnings.push(
					`${routeLabel(route)} incluye empalmes puntuales del trazado`,
				);
			}

			const routeUsesConnectors =
				node.element.type !== "splitter" &&
				!(node.element.type === "nap" && hasInternalSplitter(node.element));
			segConnector = routeUsesConnectors
				? (route.connector_loss_db ?? 2 * CONNECTOR_LOSS_DB)
				: 0;
			if (routeUsesConnectors && route.connector_loss_db == null) {
				segmentWarnings.push(
					`${routeLabel(route)} usa conectores estimados (2 x 0.5 dB)`,
				);
			}
			if (route.total_loss_db != null) {
				const itemizedRouteLoss = segFiber + segSplice + segConnector;
				segAdditional = route.total_loss_db - itemizedRouteLoss;
				if (Math.abs(segAdditional) > 0.05) {
					segmentWarnings.push(
						`${routeLabel(route)} ajusta el desglose con perdida total medida`,
					);
				}
			}

			if (segFiber > 0) {
				segmentWarnings.push(
					`${routeLabel(route)} usa factor de cable 1.02 para longitud instalada`,
				);
			}
		}

		const needsSplitterLoss =
			node.element.type === "splitter" || hasInternalSplitter(node.element);
		const splitRatio =
			node.element.type === "nap"
				? inferredNapSplitRatio(node)
				: node.element.split_ratio;
		const segSplitter =
			needsSplitterLoss && splitRatio
				? (node.element.insertion_loss_db ?? SPLITTER_LOSS_DB[splitRatio] ?? 0)
				: 0;
		const napInputFusion = napInputFusionLoss(node);
		const napOutputConnector = napOutputConnectorLoss(node);
		if (needsSplitterLoss && !splitRatio) {
			segmentWarnings.push(
				`${node.element.code ?? node.element.name ?? "Nodo"} sin ratio de splitter`,
			);
		} else if (
			needsSplitterLoss &&
			splitRatio &&
			node.element.insertion_loss_db == null &&
			SPLITTER_LOSS_DB[splitRatio] == null
		) {
			segmentWarnings.push(
				`${node.element.code ?? node.element.name ?? "Nodo"} tiene ratio sin perdida conocida`,
			);
		} else if (
			node.element.type === "nap" &&
			hasInternalSplitter(node.element) &&
			!node.element.split_ratio &&
			splitRatio
		) {
			segmentWarnings.push(
				`${node.element.code ?? node.element.name ?? "NAP"} infiere splitter interno ${splitRatio} por puertos`,
			);
		}

		let lossEvents = acc.lossEvents;
		if (headend.loss > 0) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "headend",
				label: "Cabecera OLT / ODF",
				loss: headend.loss,
				section: "Cabecera",
				shortLabel: "Cab.",
			});
		}
		if (segFiber > 0 && node.routeFromParent) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "fiber",
				label: `${routeLabel(node.routeFromParent)} fibra`,
				loss: segFiber,
				section: routeEndpointSection(node),
				shortLabel: "Fibra",
			});
		}
		if (node.routeFromParent?.splice_loss_db != null) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "fusion",
				label: `${routeLabel(node.routeFromParent)} fusion`,
				loss: node.routeFromParent.splice_loss_db,
				section: routeEndpointSection(node),
				shortLabel: "Fusion",
			});
		}
		for (const splice of node.splicesOnRoute) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "fusion",
				label: splice.code ?? `${routeLabel(node.routeFromParent)} empalme`,
				loss: splice.splice_loss_db ?? SPLICE_LOSS_DB,
				section: "Empalme puntual",
				shortLabel: "Emp.",
			});
		}
		if (segConnector > 0 && node.routeFromParent) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "connector",
				label: `${routeLabel(node.routeFromParent)} conectores`,
				loss: segConnector,
				section: routeEndpointSection(node),
				shortLabel: "Con.",
			});
		}
		if (napInputFusion > 0) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "fusion",
				label: "Fusion entrada NAP",
				loss: napInputFusion,
				section: "NAP interna",
				shortLabel: "Fusion",
			});
		}
		if (segSplitter > 0) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "splitter",
				label:
					node.element.type === "nap"
						? `Splitter NAP ${splitRatio ?? ""}`.trim()
						: `Splitter primario ${splitRatio ?? ""}`.trim(),
				loss: segSplitter,
				section:
					node.element.type === "nap"
						? "NAP interna"
						: "Mufa / splitter primario",
				shortLabel: "Split",
			});
		}
		if (napOutputConnector > 0) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "connector",
				label: "Conector salida NAP",
				loss: napOutputConnector,
				section: "Puerto NAP",
				shortLabel: "Con.",
			});
		}
		if (segAdditional !== 0 && node.routeFromParent) {
			lossEvents = addLossEvent(lossEvents, {
				kind: "adjustment",
				label: `${routeLabel(node.routeFromParent)} ajuste medido`,
				loss: segAdditional,
				section: routeEndpointSection(node),
				shortLabel: "Ajuste",
			});
		}

		const next: Accumulated = {
			headend: acc.headend + headend.loss,
			fiber: acc.fiber + segFiber,
			splitter: acc.splitter + segSplitter,
			splice: acc.splice + segSplice + napInputFusion,
			connector: acc.connector + segConnector + napOutputConnector,
			additional: acc.additional + segAdditional,
			length: acc.length + segLength,
			lossEvents,
			warnings: [...acc.warnings, ...headend.warnings, ...segmentWarnings],
		};

		const physicalLoss = round2(
			next.headend +
				next.fiber +
				next.splitter +
				next.splice +
				next.connector +
				next.additional,
		);
		const totalLoss = round2(physicalLoss + SAFETY_MARGIN_DB);
		let margin: number | null = null;
		const rxPowerDbm =
			powerProfile.txPowerDbm !== null
				? round2(powerProfile.txPowerDbm - physicalLoss)
				: null;
		const powerMarginDb =
			rxPowerDbm !== null && powerProfile.rxSensitivityDbm !== null
				? round2(rxPowerDbm - powerProfile.rxSensitivityDbm)
				: null;
		const designPowerMarginDb =
			powerMarginDb !== null ? round2(powerMarginDb - SAFETY_MARGIN_DB) : null;
		let status: OpticalStatus = "gray";

		if (designPowerMarginDb !== null) {
			margin = designPowerMarginDb;
			status =
				designPowerMarginDb > 3
					? "green"
					: designPowerMarginDb >= 1
						? "yellow"
						: "red";
		} else if (oltClass && isPonClass(oltClass)) {
			const budget = PON_CLASS_BUDGET[oltClass];
			if (budget) {
				margin = round2(budget.max - totalLoss);
				status = margin > 3 ? "green" : margin >= 1 ? "yellow" : "red";
			}
		} else if (powerProfile.txPowerDbm === null) {
			next.warnings.push(
				`${node.element.code ?? node.element.name ?? "Nodo"} sin potencia Tx para calcular potencia recibida`,
			);
		} else if (powerProfile.rxSensitivityDbm === null) {
			next.warnings.push(
				`${node.element.code ?? node.element.name ?? "Nodo"} sin sensibilidad Rx para calcular margen de potencia`,
			);
		}

		budgets.set(node.element.id, {
			headendLoss: round2(next.headend),
			fiberLoss: round2(next.fiber),
			splitterLoss: round2(next.splitter),
			spliceLoss: round2(next.splice),
			connectorLoss: round2(next.connector),
			additionalLoss: round2(next.additional),
			physicalLoss,
			safetyMargin: SAFETY_MARGIN_DB,
			totalLoss,
			margin,
			txPowerDbm: powerProfile.txPowerDbm,
			rxPowerDbm,
			rxSensitivityDbm: powerProfile.rxSensitivityDbm,
			powerMarginDb,
			designPowerMarginDb,
			status,
			cumulativeLengthMeters: Math.round(next.length),
			lossEvents: next.lossEvents,
			warnings: next.warnings,
		});

		for (const child of node.children) {
			traverse(child, next, oltClass, powerProfile);
		}
	}

	for (const root of roots) {
		const oltClass = oltClasses.get(root.element.id) ?? null;
		const powerProfile = resolveOltPowerProfile(root, oltClass);
		traverse(
			root,
			{
				headend: 0,
				fiber: 0,
				splitter: 0,
				splice: 0,
				connector: 0,
				additional: 0,
				length: 0,
				lossEvents: [],
				warnings: powerProfile.warnings,
			},
			oltClass,
			powerProfile,
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
