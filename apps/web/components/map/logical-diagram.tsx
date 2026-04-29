"use client";

import { useMemo, useState } from "react";
import type {
	FiberRoute,
	InfrastructureElement,
	RoutePoint,
} from "@/components/map/types";
import {
	ATTENUATION_DB_PER_KM,
	OPTICAL_STATUS_COLOR,
	type OpticalStatus,
	PON_CLASS_BUDGET,
	type PonClass,
	SPLITTER_LOSS_DB,
} from "@/lib/gpon/optical-budget";
import { useNetworkEditorStore } from "@/lib/store/network-editor";

// ── Types ────────────────────────────────────────────────────────────────────

interface TreeNode {
	element: InfrastructureElement;
	routeFromParent: FiberRoute | null;
	splicesOnRoute: RoutePoint[];
	children: TreeNode[];
	depth: number;
}

interface PathBudget {
	fiberLoss: number;
	splitterLoss: number;
	spliceLoss: number;
	connectorLoss: number;
	totalLoss: number;
	margin: number | null;
	status: OpticalStatus;
}

interface LayoutNode {
	tree: TreeNode;
	budget: PathBudget;
	x: number;
	y: number;
	collapsed?: boolean;
}

const PON_CLASSES = new Set<PonClass>([
	"B+",
	"C+",
	"C++",
	"N1",
	"N2",
	"E1",
	"E2",
]);

function isPonClass(value: string): value is PonClass {
	return PON_CLASSES.has(value as PonClass);
}

// ── Build network tree from routes ───────────────────────────────────────────

function buildNetworkTree(
	elements: Record<string, InfrastructureElement>,
	routes: Record<string, FiberRoute>,
	routePoints: Record<string, RoutePoint>,
): TreeNode[] {
	// Map: from_element_id → [{element, route, to_id}]
	const childrenMap = new Map<
		string,
		Array<{ element: InfrastructureElement; route: FiberRoute }>
	>();

	// Build adjacency
	for (const route of Object.values(routes)) {
		if (!route.from_element_id || !route.to_element_id) continue;
		const toEl = elements[route.to_element_id];
		if (!toEl) continue;

		if (!childrenMap.has(route.from_element_id)) {
			childrenMap.set(route.from_element_id, []);
		}
		childrenMap.get(route.from_element_id)?.push({
			element: toEl,
			route,
		});
	}

	// Recursively build tree from each OLT
	function buildSubtree(elementId: string, depth: number): TreeNode | null {
		const element = elements[elementId];
		if (!element) return null;

		const children: TreeNode[] = [];
		const childrenData = childrenMap.get(elementId) ?? [];

		for (const { element: childEl, route } of childrenData) {
			const splices = Object.values(routePoints).filter(
				(rp) => rp.fiber_route_id === route.id && rp.type === "splice",
			);

			const childNode = buildSubtree(childEl.id, depth + 1);
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

	const roots: TreeNode[] = [];
	for (const el of Object.values(elements)) {
		if (el.type === "olt") {
			const node = buildSubtree(el.id, 0);
			if (node) roots.push(node);
		}
	}

	return roots;
}

// ── Calculate optical budget for a path ──────────────────────────────────────

function calculatePathBudget(
	node: TreeNode,
	oltOpticalClass: string | null,
): PathBudget {
	const accumulatePath = (n: TreeNode): PathBudget => {
		let fiberLoss = 0;
		let splitterLoss = 0;
		let spliceLoss = 0;
		let connectorLoss = 0;

		if (n.routeFromParent) {
			const route = n.routeFromParent;

			// Fiber loss
			if (route.length_meters) {
				const wavelength = "1490"; // GPON downstream
				const dbPerKm = ATTENUATION_DB_PER_KM[wavelength] ?? 0.3;
				fiberLoss = (route.length_meters / 1000) * dbPerKm;
			}

			// Splices on this route segment
			for (const splice of n.splicesOnRoute) {
				spliceLoss += splice.splice_loss_db ?? 0.1;
			}

			// Connectors: 2 pairs per segment × 0.25 dB
			connectorLoss = 2 * 0.25;
		}

		// Splitter loss
		if (n.element.type === "splitter" && n.element.split_ratio) {
			splitterLoss = SPLITTER_LOSS_DB[n.element.split_ratio] ?? 0;
		}

		const totalLoss = fiberLoss + splitterLoss + spliceLoss + connectorLoss;

		// Margin from OLT class
		let margin: number | null = null;
		let status: OpticalStatus = "gray";

		if (oltOpticalClass && isPonClass(oltOpticalClass)) {
			const budget = PON_CLASS_BUDGET[oltOpticalClass];
			if (budget) {
				margin = budget.max - totalLoss;

				if (margin > 3) {
					status = "green";
				} else if (margin >= 1) {
					status = "yellow";
				} else if (margin < 1) {
					status = "red";
				}
			}
		}

		return {
			fiberLoss: Math.round(fiberLoss * 100) / 100,
			splitterLoss,
			spliceLoss: Math.round(spliceLoss * 100) / 100,
			connectorLoss,
			totalLoss: Math.round(totalLoss * 100) / 100,
			margin: margin !== null ? Math.round(margin * 100) / 100 : null,
			status,
		};
	};

	return accumulatePath(node);
}

// ── Layout tree nodes ────────────────────────────────────────────────────────

function layoutTree(
	roots: TreeNode[],
	oltClasses: Map<string, string | null>,
	panelHeight: number,
): LayoutNode[] {
	const nodeHeight = 56;
	const colSpacing = 190;
	const rowGap = 14;

	const colX = new Map<number, number>();
	colX.set(0, 20);

	let maxDepth = 0;

	function traverse(node: TreeNode) {
		maxDepth = Math.max(maxDepth, node.depth);
		for (const child of node.children) {
			traverse(child);
		}
	}

	for (const root of roots) {
		traverse(root);
	}

	for (let depth = 1; depth <= maxDepth; depth++) {
		colX.set(depth, 20 + depth * colSpacing);
	}

	const nodesByCol = new Map<number, TreeNode[]>();

	function collectNodes(node: TreeNode) {
		if (!nodesByCol.has(node.depth)) {
			nodesByCol.set(node.depth, []);
		}
		nodesByCol.get(node.depth)?.push(node);

		for (const child of node.children) {
			collectNodes(child);
		}
	}

	for (const root of roots) {
		collectNodes(root);
	}

	const result: LayoutNode[] = [];

	for (const root of roots) {
		const oltClass = oltClasses.get(root.element.id);

		function layoutSubtree(
			node: TreeNode,
			nodeIndex: number,
			colNodes: number,
		) {
			const x = colX.get(node.depth) ?? 0;
			const totalHeight = colNodes * (nodeHeight + rowGap) - rowGap;
			const startY =
				Math.max(0, (panelHeight - totalHeight) / 2) +
				nodeIndex * (nodeHeight + rowGap);

			const budget = calculatePathBudget(node, oltClass ?? null);

			result.push({
				tree: node,
				budget,
				x,
				y: startY,
			});

			let childIndex = 0;
			for (const child of node.children) {
				const childColNodes = nodesByCol.get(child.depth)?.length ?? 1;
				layoutSubtree(child, childIndex, childColNodes);
				childIndex++;
			}
		}

		const colNodes = nodesByCol.get(0)?.length ?? 1;
		layoutSubtree(root, 0, colNodes);
	}

	return result;
}

// ── LogicalDiagram component ─────────────────────────────────────────────────

interface LogicalDiagramProps {
	height: number;
	onSelectElement?: (id: string) => void;
	selectedId?: string | null;
}

function LogicalDiagram({
	height,
	onSelectElement,
	selectedId,
}: LogicalDiagramProps) {
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

	const { elements, routes, routePoints } = useNetworkEditorStore((s) => ({
		elements: s.elements,
		routes: s.routes,
		routePoints: s.routePoints,
	}));

	const toggleGroupExpanded = (splitterId: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(splitterId)) {
				next.delete(splitterId);
			} else {
				next.add(splitterId);
			}
			return next;
		});
	};

	const { roots, layoutNodes } = useMemo(() => {
		const tree = buildNetworkTree(elements, routes, routePoints);
		const oltMap = new Map<string, string | null>();

		for (const root of tree) {
			oltMap.set(root.element.id, root.element.optical_class ?? null);
		}

		const layout = layoutTree(tree, oltMap, height);

		return {
			roots: tree,
			layoutNodes: layout,
		};
	}, [elements, routes, routePoints, height]);

	if (roots.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-[#777879]">
				Sin elementos en la red
			</div>
		);
	}

	const svgWidth = Math.max(600, 20 + Object.keys(elements).length * 60);

	return (
		<svg
			viewBox={`0 0 ${svgWidth} ${height}`}
			className="h-full w-full"
			style={{ background: "transparent" }}
			role="img"
			aria-label="Diagrama lógico de la red GPON"
		>
			{/* Render edges first */}
			{layoutNodes.map((node) => {
				if (!node.tree.routeFromParent) return null;

				const x1 = node.x + 150;
				const y1 = node.y + 28;

				const parentNode = layoutNodes.find(
					(ln) =>
						ln.tree.element.id === node.tree.routeFromParent?.from_element_id,
				);
				if (!parentNode) return null;

				const x2 = parentNode.x;
				const y2 = parentNode.y + 28;

				const cx1 = x1 + (x2 - x1) * 0.4;
				const cx2 = x2 - (x2 - x1) * 0.4;

				const worstStatus = node.budget.status;
				const edgeColor = OPTICAL_STATUS_COLOR[worstStatus];

				return (
					<g key={`edge-${node.tree.element.id}`}>
						<path
							d={`M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
							stroke={edgeColor}
							strokeWidth="2"
							fill="none"
						/>

						{/* Edge label */}
						<text
							x={(x1 + x2) / 2}
							y={y1 - 8}
							textAnchor="middle"
							fontSize="9"
							fill="#a4a4a4"
						>
							{node.tree.routeFromParent?.length_meters
								? `${(node.tree.routeFromParent.length_meters / 1000).toFixed(1)}km`
								: "−"}{" "}
							· −{node.budget.totalLoss.toFixed(1)}dB
						</text>
					</g>
				);
			})}

			{/* Render nodes */}
			{layoutNodes
				.filter((node) => {
					// Hide NAPs if their splitter parent is collapsed
					if (node.tree.element.type === "nap" && node.tree.routeFromParent) {
						const parentId = node.tree.routeFromParent.from_element_id;
						if (parentId && !expandedGroups.has(parentId)) {
							return false;
						}
					}
					return true;
				})
				.map((node) => {
					const isSelected = selectedId === node.tree.element.id;
					const nodeX = node.x;
					const nodeY = node.y;
					const el = node.tree.element;
					const napChildren = node.tree.children;
					const hasCollapsibleNaps =
						el.type === "splitter" && napChildren.length > 0;
					const isGroupCollapsed =
						hasCollapsibleNaps && !expandedGroups.has(el.id);

					let color = "#38bdf8";
					let label = "OLT";

					if (el.type === "splitter") {
						color = "#4ade80";
						label = `${el.split_ratio ?? "−"}\n${node.budget.splitterLoss}dB`;
					} else if (el.type === "nap") {
						color = "#f59e0b";
						label = `${el.total_ports ?? 0}p`;
					}

					return (
						<g key={node.tree.element.id}>
							{/* Collapsed NAP group box */}
							{isGroupCollapsed && (
								// biome-ignore lint/a11y/useSemanticElements: SVG groups cannot be replaced with HTML buttons inside an SVG tree.
								<g
									onClick={() => toggleGroupExpanded(el.id)}
									role="button"
									tabIndex={0}
									style={{ cursor: "pointer" }}
								>
									<rect
										x={nodeX}
										y={nodeY}
										width="150"
										height="56"
										rx="4"
										fill={color}
										opacity="0.1"
										stroke={color}
										strokeWidth="1.5"
										strokeDasharray="4,2"
									/>
									<text
										x={nodeX + 8}
										y={nodeY + 16}
										fontSize="9"
										fill="#a4a4a4"
									>
										{napChildren.length} NAPs
									</text>
									<text
										x={nodeX + 8}
										y={nodeY + 32}
										fontSize="8"
										fill="#777879"
									>
										[+] Ver lista
									</text>
								</g>
							)}

							{/* Regular node */}
							{!isGroupCollapsed && (
								// biome-ignore lint/a11y/useSemanticElements: SVG groups cannot be replaced with HTML buttons inside an SVG tree.
								<g
									onClick={() => {
										if (hasCollapsibleNaps) {
											toggleGroupExpanded(el.id);
										} else {
											onSelectElement?.(el.id);
											useNetworkEditorStore.getState().select(el.id, "element");
										}
									}}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											if (hasCollapsibleNaps) {
												toggleGroupExpanded(el.id);
											} else {
												onSelectElement?.(el.id);
												useNetworkEditorStore
													.getState()
													.select(el.id, "element");
											}
										}
									}}
									role="button"
									tabIndex={0}
									style={{ cursor: "pointer" }}
								>
									{/* Node box */}
									<rect
										x={nodeX}
										y={nodeY}
										width="150"
										height="56"
										rx="4"
										fill={color}
										opacity="0.15"
										stroke={color}
										strokeWidth="1.5"
									/>

									{/* Selection ring */}
									{isSelected && (
										<rect
											x={nodeX - 2}
											y={nodeY - 2}
											width="154"
											height="60"
											rx="4"
											fill="none"
											stroke="#ffffff"
											strokeWidth="2"
										/>
									)}

									{/* Code */}
									<text
										x={nodeX + 75}
										y={nodeY + 14}
										textAnchor="middle"
										fontSize="10"
										fontWeight="600"
										fill="#e6e6e6"
									>
										{el.code}
									</text>

									{/* Label */}
									<text
										x={nodeX + 75}
										y={nodeY + 32}
										textAnchor="middle"
										fontSize="9"
										fill="#a4a4a4"
									>
										{label}
									</text>

									{/* Toggle indicator for splitters with NAPs */}
									{hasCollapsibleNaps && (
										<text
											x={nodeX + 140}
											y={nodeY + 36}
											textAnchor="middle"
											fontSize="8"
											fill="#a4a4a4"
										>
											−
										</text>
									)}

									{/* Status badge */}
									{node.budget.margin !== null && (
										<circle
											cx={nodeX + 140}
											cy={nodeY + 8}
											r="6"
											fill={OPTICAL_STATUS_COLOR[node.budget.status]}
										/>
									)}
								</g>
							)}
						</g>
					);
				})}
		</svg>
	);
}

// ── DiagramPanel component ───────────────────────────────────────────────────

interface DiagramPanelProps {
	isOpen: boolean;
	onToggle: () => void;
}

export function DiagramPanel({ isOpen, onToggle }: DiagramPanelProps) {
	const elements = useNetworkEditorStore((s) => s.elements);
	const routes = useNetworkEditorStore((s) => s.routes);
	const routePoints = useNetworkEditorStore((s) => s.routePoints);
	const selection = useNetworkEditorStore((s) => s.selection);

	const panelHeight = isOpen ? 224 : 32;

	// Calculate global status: worst status among all paths
	const roots = useMemo(
		() => buildNetworkTree(elements, routes, routePoints),
		[elements, routes, routePoints],
	);

	const allBudgets = useMemo(() => {
		const budgets: PathBudget[] = [];
		const oltMap = new Map<string, string | null>();

		for (const root of roots) {
			oltMap.set(root.element.id, root.element.optical_class ?? null);
		}

		const traverse = (node: TreeNode, oltClass: string | null) => {
			budgets.push(calculatePathBudget(node, oltClass));
			for (const child of node.children) {
				traverse(child, oltClass);
			}
		};

		for (const root of roots) {
			traverse(root, root.element.optical_class ?? null);
		}

		return budgets;
	}, [roots]);

	const worstStatus = useMemo(() => {
		const statusOrder: Record<OpticalStatus, number> = {
			red: 0,
			yellow: 1,
			green: 2,
			gray: 3,
		};
		if (allBudgets.length === 0) return "gray";
		return allBudgets.reduce((worst, b) => {
			return statusOrder[b.status] < statusOrder[worst] ? b.status : worst;
		}, allBudgets[0].status);
	}, [allBudgets]);

	const globalColor = OPTICAL_STATUS_COLOR[worstStatus];

	return (
		<div
			className="shrink-0 border-t border-[rgba(164,164,164,0.12)] bg-[#111213] transition-all duration-200"
			style={{ height: `${panelHeight}px` }}
		>
			{/* Header */}
			<div className="flex h-8 shrink-0 items-center justify-between px-4">
				<div className="flex items-center gap-2">
					<span className="text-xs font-medium text-[#e6e6e6]">
						Diagrama lógico
					</span>
					{allBudgets.length > 0 && (
						<>
							<span className="text-[rgba(164,164,164,0.3)]">•</span>
							<span
								className="text-[9px] font-semibold px-2 py-0.5 rounded"
								style={{
									backgroundColor: `${globalColor}22`,
									color: globalColor,
								}}
							>
								{allBudgets.filter((b) => b.status === "red").length > 0
									? "Riesgo"
									: allBudgets.filter((b) => b.status === "yellow").length > 0
										? "Margen ajustado"
										: "Óptimo"}
							</span>
						</>
					)}
				</div>
				<button
					type="button"
					onClick={onToggle}
					className="text-xs text-[#777879] transition-colors hover:text-[#a4a4a4]"
				>
					{isOpen ? "↓" : "↑"}
				</button>
			</div>

			{/* Content */}
			{isOpen && (
				<div className="h-56 overflow-x-auto px-4 pb-4">
					<LogicalDiagram
						height={200}
						selectedId={selection?.type === "element" ? selection.id : null}
					/>
				</div>
			)}
		</div>
	);
}
