"use client";

import {
	type KeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	OPTICAL_STATUS_COLOR,
	type OpticalStatus,
} from "@/lib/gpon/optical-budget";
import { useNetworkEditorStore } from "@/lib/store/network-editor";
import { LogicalDiagram } from "./diagram";
import { layoutTree } from "./layout-engine";
import { buildNetworkTree } from "./tree-builder";
import type { LayoutNode, NetworkStats, PathBudget, TreeNode } from "./types";

// ── Stats helpers ─────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<OpticalStatus, number> = {
	red: 0,
	yellow: 1,
	green: 2,
	gray: 3,
};

function computeStats(layoutNodes: LayoutNode[]): NetworkStats {
	let oltCount = 0;
	let splitterCount = 0;
	let napCount = 0;
	let totalLengthMeters = 0;
	let totalPorts = 0;
	let usedPorts = 0;
	let reservedPorts = 0;
	let worstStatus: OpticalStatus = "gray";
	let worstMargin: number | null = null;

	for (const node of layoutNodes) {
		const el = node.tree.element;
		if (el.type === "olt") oltCount++;
		else if (el.type === "splitter") splitterCount++;
		else if (el.type === "nap") {
			napCount++;
			totalPorts += el.total_ports ?? 0;
			usedPorts += el.ports_used ?? 0;
			reservedPorts += el.ports_reserved ?? 0;
		}

		if (node.tree.routeFromParent?.length_meters) {
			totalLengthMeters += node.tree.routeFromParent.length_meters;
		}

		if (STATUS_ORDER[node.budget.status] < STATUS_ORDER[worstStatus]) {
			worstStatus = node.budget.status;
		}
		if (node.budget.margin !== null) {
			if (worstMargin === null || node.budget.margin < worstMargin) {
				worstMargin = node.budget.margin;
			}
		}
	}

	return {
		oltCount,
		splitterCount,
		napCount,
		totalLengthMeters,
		worstStatus,
		worstMargin,
		totalPorts,
		usedPorts,
		reservedPorts,
	};
}

function collectBudgets(
	roots: TreeNode[],
	budgetMap: Map<string, PathBudget>,
): PathBudget[] {
	const result: PathBudget[] = [];
	function walk(node: TreeNode) {
		const b = budgetMap.get(node.element.id);
		if (b) result.push(b);
		for (const child of node.children) walk(child);
	}
	for (const root of roots) walk(root);
	return result;
}

function worstOf(budgets: PathBudget[]): OpticalStatus {
	if (budgets.length === 0) return "gray";
	return budgets.reduce(
		(worst, b) =>
			STATUS_ORDER[b.status] < STATUS_ORDER[worst] ? b.status : worst,
		budgets[0].status,
	);
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: NetworkStats }) {
	const km = (stats.totalLengthMeters / 1000).toFixed(2);
	const freePorts = Math.max(
		0,
		stats.totalPorts - stats.usedPorts - stats.reservedPorts,
	);
	const freePct =
		stats.totalPorts > 0
			? Math.round((freePorts / stats.totalPorts) * 100)
			: null;
	const freePctColor =
		freePct === null
			? "#6b7280"
			: freePct < 10
				? "#fb4d6d"
				: freePct < 30
					? "#f59e0b"
					: "#6b7280";

	return (
		<div className="flex shrink-0 items-center gap-2 px-4 pb-1.5 text-[10px]">
			<span className="font-medium" style={{ color: "#38bdf8" }}>
				{stats.oltCount} OLT
			</span>
			<span className="text-[rgba(164,164,164,0.3)]">·</span>
			<span className="font-medium" style={{ color: "#a78bfa" }}>
				{stats.splitterCount} SPL
			</span>
			<span className="text-[rgba(164,164,164,0.3)]">·</span>
			<span className="font-medium" style={{ color: "#f59e0b" }}>
				{stats.napCount} NAP
			</span>
			<span className="text-[rgba(164,164,164,0.3)]">·</span>
			<span className="text-[#6b7280]">{km} km</span>
			{freePct !== null && (
				<>
					<span className="text-[rgba(164,164,164,0.3)]">·</span>
					<span style={{ color: freePctColor }}>{freePct}% puertos libres</span>
				</>
			)}
		</div>
	);
}

// ── DiagramPanel ──────────────────────────────────────────────────────────────

const COLLAPSED_HEIGHT = 32;
const DEFAULT_PANEL_HEIGHT = 360;
const MIN_PANEL_HEIGHT = 180;
const MAX_PANEL_HEIGHT = 720;
const MIN_MAP_HEIGHT = 220;

function clampPanelHeight(height: number): number {
	const maxHeight =
		typeof window === "undefined"
			? 720
			: Math.max(MIN_PANEL_HEIGHT, window.innerHeight - MIN_MAP_HEIGHT);
	return Math.min(Math.max(height, MIN_PANEL_HEIGHT), maxHeight);
}

interface DiagramPanelProps {
	isOpen: boolean;
	onToggle: () => void;
}

export function DiagramPanel({ isOpen, onToggle }: DiagramPanelProps) {
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
	const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
	const [isResizing, setIsResizing] = useState(false);

	const elements = useNetworkEditorStore((s) => s.elements);
	const routes = useNetworkEditorStore((s) => s.routes);
	const routePoints = useNetworkEditorStore((s) => s.routePoints);
	const selection = useNetworkEditorStore((s) => s.selection);

	const toggleGroup = (id: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const { roots, layoutNodes, totalWidth, totalHeight, stats, allBudgets } =
		useMemo(() => {
			const tree = buildNetworkTree(elements, routes, routePoints);
			const oltMap = new Map<string, string | null>();
			for (const root of tree) {
				oltMap.set(root.element.id, root.element.optical_class ?? null);
			}

			const { nodes, totalHeight: h, totalWidth: w } = layoutTree(tree, oltMap);

			const budgetMap = new Map<string, PathBudget>();
			for (const n of nodes) budgetMap.set(n.tree.element.id, n.budget);

			return {
				roots: tree,
				layoutNodes: nodes,
				totalWidth: w,
				totalHeight: h,
				stats: computeStats(nodes),
				allBudgets: collectBudgets(tree, budgetMap),
			};
		}, [elements, routes, routePoints]);

	useEffect(() => {
		const expandableIds = layoutNodes
			.filter((node) => node.tree.children.length > 0)
			.map((node) => node.tree.element.id);
		if (expandableIds.length === 0) return;

		setExpandedGroups((current) => {
			let changed = false;
			const next = new Set(current);
			for (const id of expandableIds) {
				if (!next.has(id)) {
					next.add(id);
					changed = true;
				}
			}
			return changed ? next : current;
		});
	}, [layoutNodes]);

	const globalStatus = worstOf(allBudgets);
	const globalColor = OPTICAL_STATUS_COLOR[globalStatus];
	const hasRed = allBudgets.some((b) => b.status === "red");
	const hasYellow = allBudgets.some((b) => b.status === "yellow");
	const statusLabel = hasRed
		? "Riesgo óptico"
		: hasYellow
			? "Margen ajustado"
			: allBudgets.length === 0
				? ""
				: "Óptimo";

	const collapseAll = () => setExpandedGroups(new Set());
	const expandAll = () => {
		const ids = layoutNodes
			.filter((n) => n.tree.children.length > 0)
			.map((n) => n.tree.element.id);
		setExpandedGroups(new Set(ids));
	};

	const onSelectElement = (id: string) => {
		useNetworkEditorStore.getState().select(id, "element");
	};

	const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!isOpen) return;
		event.preventDefault();

		const startY = event.clientY;
		const startHeight = panelHeight;
		setIsResizing(true);
		document.body.style.cursor = "ns-resize";
		document.body.style.userSelect = "none";

		const onPointerMove = (moveEvent: PointerEvent) => {
			const delta = startY - moveEvent.clientY;
			setPanelHeight(clampPanelHeight(startHeight + delta));
		};

		const onPointerUp = () => {
			setIsResizing(false);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp, { once: true });
	};

	const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!isOpen) return;

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setPanelHeight((height) => clampPanelHeight(height + 24));
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			setPanelHeight((height) => clampPanelHeight(height - 24));
		} else if (event.key === "Home") {
			event.preventDefault();
			setPanelHeight(MIN_PANEL_HEIGHT);
		} else if (event.key === "End") {
			event.preventDefault();
			setPanelHeight(clampPanelHeight(MAX_PANEL_HEIGHT));
		}
	};

	return (
		<div
			className={`relative flex shrink-0 flex-col border-t border-[rgba(164,164,164,0.12)] bg-[#111213] ${
				isResizing ? "" : "transition-[height] duration-200"
			}`}
			style={{ height: isOpen ? `${panelHeight}px` : `${COLLAPSED_HEIGHT}px` }}
		>
			{isOpen && (
				// biome-ignore lint/a11y/useSemanticElements: This separator is an interactive drag handle, not a static horizontal rule.
				<div
					onPointerDown={startResize}
					onKeyDown={resizeWithKeyboard}
					className="group absolute -top-1 left-0 z-10 flex h-2 w-full cursor-ns-resize items-center justify-center"
					role="separator"
					aria-orientation="horizontal"
					aria-label="Redimensionar diagrama lógico"
					aria-valuemin={MIN_PANEL_HEIGHT}
					aria-valuemax={MAX_PANEL_HEIGHT}
					aria-valuenow={panelHeight}
					tabIndex={0}
				>
					<div className="h-px w-16 rounded-full bg-[rgba(164,164,164,0.22)] transition-colors group-hover:bg-[#38bdf8]" />
				</div>
			)}

			{/* ── Header ── */}
			<div className="flex h-8 shrink-0 items-center justify-between px-4">
				<div className="flex items-center gap-2">
					<span className="text-xs font-medium text-[#e6e6e6]">
						Diagrama lógico
					</span>
					{statusLabel && (
						<>
							<span className="text-[rgba(164,164,164,0.3)]">•</span>
							<span
								className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
								style={{
									backgroundColor: `${globalColor}1a`,
									color: globalColor,
								}}
							>
								<span
									className="inline-block h-1.5 w-1.5 rounded-full"
									style={{ backgroundColor: globalColor }}
								/>
								{statusLabel}
							</span>
						</>
					)}
				</div>

				<div className="flex items-center gap-2">
					{isOpen && roots.length > 0 && (
						<>
							<button
								type="button"
								onClick={collapseAll}
								className="text-[10px] text-[#6b7280] transition-colors hover:text-[#a4a4a4]"
								title="Colapsar todo"
							>
								⊖
							</button>
							<button
								type="button"
								onClick={expandAll}
								className="text-[10px] text-[#6b7280] transition-colors hover:text-[#a4a4a4]"
								title="Expandir todo"
							>
								⊕
							</button>
						</>
					)}
					<button
						type="button"
						onClick={onToggle}
						className="text-xs text-[#6b7280] transition-colors hover:text-[#a4a4a4]"
					>
						{isOpen ? "↓" : "↑"}
					</button>
				</div>
			</div>

			{/* ── Content ── */}
			{isOpen &&
				(roots.length === 0 ? (
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
						<span className="text-2xl opacity-20">⬡</span>
						<span className="text-xs text-[#6b7280]">
							Sin elementos en la red
						</span>
						<span className="text-[10px] text-[#4b4d4f]">
							Agrega una OLT para ver el árbol lógico
						</span>
					</div>
				) : (
					<div className="flex min-h-0 flex-1 flex-col">
						{/* Stats bar */}
						<StatsBar stats={stats} />

						{/* Diagram scroll area */}
						<div className="min-h-0 flex-1 overflow-hidden px-4 pb-3">
							<LogicalDiagram
								layoutNodes={layoutNodes}
								roots={roots}
								totalWidth={totalWidth}
								totalHeight={totalHeight}
								selectedId={selection?.kind === "element" ? selection.id : null}
								selectedRouteId={
									selection?.kind === "route" ? selection.id : null
								}
								expandedGroups={expandedGroups}
								onSelectElement={onSelectElement}
								onToggleGroup={toggleGroup}
							/>
						</div>
					</div>
				))}
		</div>
	);
}
