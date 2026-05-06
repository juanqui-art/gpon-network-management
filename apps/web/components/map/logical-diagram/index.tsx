"use client";

import {
	BarChart3,
	Network,
	PanelRightClose,
	PanelRightOpen,
} from "lucide-react";
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
import { EQUIPMENT_TYPE_LABEL } from "@/lib/gpon/symbology";
import { TYPE_COLOR } from "@/lib/map/palette";
import { useNetworkEditorStore } from "@/lib/store/network-editor";
import { LogicalDiagram } from "./diagram";
import { layoutTree } from "./layout-engine";
import { OpticalPowerBudgetChart } from "./optical-power-budget-chart";
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

function formatLoss(value: number): string {
	return `${value.toFixed(2)} dB`;
}

function HeaderStatPill({
	label,
	value,
	color = "#d7d7d7",
}: {
	label: string;
	value: string | number;
	color?: string;
}) {
	return (
		<div className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.035] px-2 py-1">
			<span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#777879]">
				{label}
			</span>
			<span className="font-mono text-[10px] font-bold" style={{ color }}>
				{value}
			</span>
		</div>
	);
}

function HeaderStats({ stats }: { stats: NetworkStats }) {
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

	const marginColor =
		stats.worstStatus === "red"
			? "#fb4d6d"
			: stats.worstStatus === "yellow"
				? "#f59e0b"
				: "#34d399";

	return (
		<div className="hidden min-w-0 items-center gap-1.5 xl:flex">
			<HeaderStatPill
				label="OLT"
				value={stats.oltCount}
				color={TYPE_COLOR.olt}
			/>
			<HeaderStatPill
				label="SPL"
				value={stats.splitterCount}
				color={TYPE_COLOR.splitter}
			/>
			<HeaderStatPill
				label="NAP"
				value={stats.napCount}
				color={TYPE_COLOR.nap}
			/>
			<HeaderStatPill label="Fibra" value={`${km} km`} color="#a4a4a4" />
			<HeaderStatPill
				label="Margen"
				value={
					stats.worstMargin !== null
						? `${stats.worstMargin.toFixed(1)} dB`
						: "N/D"
				}
				color={stats.worstMargin !== null ? marginColor : "#777879"}
			/>
			<HeaderStatPill
				label="Libre"
				value={freePct !== null ? `${freePct}%` : "N/D"}
				color={freePctColor}
			/>
		</div>
	);
}

function BudgetRow({
	label,
	value,
	color = "#d7d7d7",
}: {
	label: string;
	value: string;
	color?: string;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded border border-white/10 bg-white/[0.035] px-2 py-1.5 text-[10px]">
			<span className="text-[#858585]">{label}</span>
			<span className="font-mono font-semibold" style={{ color }}>
				{value}
			</span>
		</div>
	);
}

type DiagramView = "budget" | "diagram";

function DiagramViewToggle({
	value,
	onChange,
}: {
	value: DiagramView;
	onChange: (value: DiagramView) => void;
}) {
	return (
		<div className="flex rounded-md border border-white/10 bg-white/[0.035] p-0.5">
			<button
				type="button"
				onClick={() => onChange("diagram")}
				className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors"
				style={{
					backgroundColor:
						value === "diagram" ? "rgba(56,216,255,0.14)" : "transparent",
					color: value === "diagram" ? "#8bdff4" : "#858585",
				}}
			>
				<Network className="size-3" aria-hidden="true" />
				Diagrama
			</button>
			<button
				type="button"
				onClick={() => onChange("budget")}
				className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors"
				style={{
					backgroundColor:
						value === "budget" ? "rgba(52,211,153,0.16)" : "transparent",
					color: value === "budget" ? "#34d399" : "#858585",
				}}
			>
				<BarChart3 className="size-3" aria-hidden="true" />
				Presupuesto
			</button>
		</div>
	);
}

function BudgetGraphView({
	node,
	stats,
}: {
	node: LayoutNode | null;
	stats: NetworkStats;
}) {
	if (!node) {
		return (
			<div className="flex h-full min-h-0 items-center justify-center p-4">
				<div className="max-w-md rounded-lg border border-dashed border-white/12 bg-white/[0.025] px-5 py-4 text-center text-xs">
					<div className="min-w-0">
						<p className="font-semibold text-[#d7d7d7]">Presupuesto óptico</p>
						<p className="mt-1 text-[#858585]">
							Selecciona una OLT, splitter o NAP en el diagrama o en el mapa
							para ver la curva completa.
						</p>
					</div>
					<span
						className="mt-3 inline-flex rounded border px-2 py-1 font-mono text-[10px]"
						style={{
							backgroundColor: `${OPTICAL_STATUS_COLOR[stats.worstStatus]}14`,
							borderColor: `${OPTICAL_STATUS_COLOR[stats.worstStatus]}35`,
							color: OPTICAL_STATUS_COLOR[stats.worstStatus],
						}}
					>
						{stats.worstMargin !== null
							? `Peor ${stats.worstMargin.toFixed(1)} dB`
							: "N/D"}
					</span>
				</div>
			</div>
		);
	}

	const el = node.tree.element;
	const budget = node.budget;
	const accent = TYPE_COLOR[el.type] ?? "#38d8ff";
	const marginColor =
		budget.margin === null
			? "#858585"
			: budget.margin < 1
				? "#fb4d6d"
				: budget.margin < 3
					? "#f59e0b"
					: "#34d399";

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#111213]/96 p-3">
			<div className="mb-3 flex shrink-0 items-center justify-between gap-3">
				<div className="min-w-0">
					<p
						className="text-[9px] font-bold uppercase tracking-[0.16em]"
						style={{ color: accent }}
					>
						Presupuesto óptico seleccionado
					</p>
					<p className="truncate text-[11px] font-semibold text-[#e6e6e6]">
						{el.code ?? el.name} · {EQUIPMENT_TYPE_LABEL[el.type] ?? el.type}
					</p>
				</div>
				<div className="grid shrink-0 grid-cols-3 gap-1.5 text-[10px]">
					<BudgetRow label="Pérdida" value={formatLoss(budget.physicalLoss)} />
					<BudgetRow
						label="Rx"
						value={
							budget.rxPowerDbm !== null
								? `${budget.rxPowerDbm.toFixed(1)} dBm`
								: "N/D"
						}
						color={marginColor}
					/>
					<BudgetRow
						label="Margen"
						value={budget.margin !== null ? formatLoss(budget.margin) : "N/D"}
						color={marginColor}
					/>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<OpticalPowerBudgetChart
					budget={budget}
					chartType="curve"
					height={360}
					variant="full"
				/>
			</div>
		</div>
	);
}

// ── DiagramPanel ──────────────────────────────────────────────────────────────

const COLLAPSED_HEIGHT = 32;
const DEFAULT_PANEL_HEIGHT = 640;
const MIN_PANEL_HEIGHT = 320;
const MAX_PANEL_HEIGHT = 940;
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
	const [diagramView, setDiagramView] = useState<DiagramView>("diagram");

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
	const selectedDiagramNode =
		selection?.kind === "element"
			? (layoutNodes.find((node) => node.tree.element.id === selection.id) ??
				null)
			: null;
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
			className={`relative flex shrink-0 flex-col overflow-hidden border-t border-[rgba(164,164,164,0.18)] bg-[#111213] shadow-[0_-18px_40px_rgba(0,0,0,0.32)] ${
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
					<div className="flex h-2.5 w-24 items-center justify-center rounded-full border border-white/10 bg-[#1b1c1d] shadow-lg transition-colors group-hover:border-[#38d8ff]/40">
						<div className="h-0.5 w-12 rounded-full bg-[rgba(164,164,164,0.34)] transition-colors group-hover:bg-[#38d8ff]" />
					</div>
				</div>
			)}

			{/* ── Header ── */}
			<header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[rgba(164,164,164,0.12)] bg-[#111213]/96 px-4">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#38d8ff]/20 bg-[#38d8ff]/10 text-[#38d8ff]">
						<Network className="size-4" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<div className="flex min-w-0 items-center gap-2">
							<span className="truncate text-sm font-semibold text-[#e6e6e6]">
								Diagrama unifilar
							</span>
							<span className="hidden rounded-full border border-[rgba(56,216,255,0.22)] bg-[rgba(56,216,255,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#8bdff4] sm:inline-flex">
								Editor óptico
							</span>
						</div>
						<p className="mt-0.5 truncate text-[11px] text-[#777879]">
							Topología, cascada de splitters y presupuesto acumulado
						</p>
					</div>
					{statusLabel && (
						<span
							className="hidden items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold md:flex"
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
					)}
					<HeaderStats stats={stats} />
				</div>

				<div className="flex items-center gap-2">
					{isOpen && roots.length > 0 && (
						<DiagramViewToggle value={diagramView} onChange={setDiagramView} />
					)}
					{isOpen && roots.length > 0 && diagramView === "diagram" && (
						<>
							<button
								type="button"
								onClick={collapseAll}
								className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] text-[#858585] transition-colors hover:bg-white/10 hover:text-[#e6e6e6]"
								title="Colapsar todo"
							>
								⊖
							</button>
							<button
								type="button"
								onClick={expandAll}
								className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] text-[#858585] transition-colors hover:bg-white/10 hover:text-[#e6e6e6]"
								title="Expandir todo"
							>
								⊕
							</button>
						</>
					)}
					<button
						type="button"
						onClick={onToggle}
						className="grid size-8 place-items-center rounded-md border border-white/10 bg-white/[0.035] text-[#858585] transition-colors hover:bg-white/10 hover:text-[#e6e6e6]"
						aria-label={isOpen ? "Ocultar unifilar" : "Abrir unifilar"}
					>
						{isOpen ? (
							<PanelRightClose
								className="size-4 rotate-90"
								aria-hidden="true"
							/>
						) : (
							<PanelRightOpen className="size-4 rotate-90" aria-hidden="true" />
						)}
					</button>
				</div>
			</header>

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
					<div className="flex min-h-0 flex-1 flex-col gap-2.5 bg-[#151617] p-2.5">
						{/* Diagram scroll area */}
						<div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-[#1b1c1d] ring-1 ring-white/8">
							{diagramView === "budget" ? (
								<BudgetGraphView node={selectedDiagramNode} stats={stats} />
							) : (
								<div className="h-full min-h-0">
									<LogicalDiagram
										layoutNodes={layoutNodes}
										roots={roots}
										totalWidth={totalWidth}
										totalHeight={totalHeight}
										selectedId={
											selection?.kind === "element" ? selection.id : null
										}
										selectedRouteId={
											selection?.kind === "route" ? selection.id : null
										}
										showActivePanel={false}
										expandedGroups={expandedGroups}
										onSelectElement={onSelectElement}
										onToggleGroup={toggleGroup}
									/>
								</div>
							)}
						</div>
					</div>
				))}
		</div>
	);
}
