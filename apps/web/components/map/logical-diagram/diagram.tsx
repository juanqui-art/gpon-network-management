"use client";

import {
	Background,
	BaseEdge,
	Controls,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getSmoothStepPath,
	Handle,
	MiniMap,
	type Node,
	type NodeProps,
	Panel,
	Position,
	ReactFlow,
	useReactFlow,
} from "@xyflow/react";
import {
	BadgeInfo,
	Cable,
	MapIcon,
	Maximize2,
	Tags,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useMemo, useState } from "react";
import { getNapMode, hasInternalSplitter } from "@/lib/gpon/nap-config";
import {
	OPTICAL_STATUS_COLOR,
	SPLITTER_LOSS_DB,
} from "@/lib/gpon/optical-budget";
import {
	EQUIPMENT_STATUS_LABEL,
	EQUIPMENT_STATUS_MARK,
	EQUIPMENT_TYPE_LABEL,
	EquipmentSymbol,
} from "@/lib/gpon/symbology";
import {
	CABLE_CASING,
	CABLE_COLOR,
	STATUS_COLOR,
	TYPE_COLOR,
} from "@/lib/map/palette";
import {
	collectDescendants,
	findAncestorChain,
	findNodeById,
	findRouteIdsOnPath,
} from "./path-utils";
import type { LayoutNode, TreeNode } from "./types";

interface LogicalDiagramProps {
	layoutNodes: LayoutNode[];
	roots: TreeNode[];
	totalWidth: number;
	totalHeight: number;
	selectedId: string | null;
	expandedGroups: Set<string>;
	onSelectElement: (id: string) => void;
	onToggleGroup: (id: string) => void;
}

type GponNodeData = {
	layout: LayoutNode;
	isExpanded: boolean;
	dimmed: boolean;
	onSelectElement: (id: string) => void;
	onToggleGroup: (id: string) => void;
};

type GponFlowNode = Node<GponNodeData, "gponNode">;
type GponCableData = {
	color: string;
	strokeWidth: number;
	opacity: number;
	active: boolean;
	statusColor: string;
	label?: string;
};
type GponCableEdge = Edge<GponCableData, "gponCable">;
type ActiveSummary = {
	code: string;
	type: string;
	status: string;
	loss: number;
	margin: number | null;
	lengthKm: string;
};

const nodeTypes = {
	gponNode: GponFlowNodeComponent,
};

const edgeTypes = {
	gponCable: GponCableEdgeComponent,
};

function MetricPill({
	label,
	value,
	color,
}: {
	label: string;
	value: string;
	color?: string;
}) {
	return (
		<span className="inline-flex h-4 min-w-0 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 text-[7.5px] leading-none text-[#858585]">
			<span className="text-[#5c5d5f]">{label}</span>
			<span className="truncate font-medium" style={{ color }}>
				{value}
			</span>
		</span>
	);
}

function LossBar({ node }: { node: LayoutNode }) {
	const { margin, totalLoss, status } = node.budget;
	if (margin === null) return null;
	const maxBudget = totalLoss + margin;
	if (maxBudget <= 0) return null;
	const widthPct = Math.min((totalLoss / maxBudget) * 100, 100);

	return (
		<div className="h-[3px] w-full overflow-hidden rounded-full bg-white/7">
			<div
				className="h-full rounded-full"
				style={{
					width: `${Math.max(3, widthPct)}%`,
					backgroundColor: OPTICAL_STATUS_COLOR[status],
				}}
			/>
		</div>
	);
}

function CapacityBar({
	total,
	used,
	reserved,
}: {
	total: number | null;
	used: number | null;
	reserved: number | null;
}) {
	if (!total || total <= 0) return null;

	const usedRatio = Math.min((used ?? 0) / total, 1);
	const reservedRatio = Math.min((reserved ?? 0) / total, 1 - usedRatio);
	const usedColor =
		usedRatio > 0.9 ? "#fb4d6d" : usedRatio > 0.7 ? "#f59e0b" : "#34d399";

	return (
		<div className="flex h-1 w-full overflow-hidden rounded-full bg-white/7">
			{usedRatio > 0 && (
				<div
					className="h-full"
					style={{ width: `${usedRatio * 100}%`, backgroundColor: usedColor }}
				/>
			)}
			{reservedRatio > 0 && (
				<div
					className="h-full bg-[#f59e0b]/60"
					style={{ width: `${reservedRatio * 100}%` }}
				/>
			)}
		</div>
	);
}

function NodeMetrics({
	node,
	ownLoss,
}: {
	node: LayoutNode;
	ownLoss: number | null;
}) {
	const el = node.tree.element;

	if (el.type === "olt") {
		return (
			<div className="mt-2 flex min-w-0 flex-wrap gap-1">
				<MetricPill label="Clase" value={el.optical_class ?? "N/D"} />
				{el.total_pon_ports ? (
					<MetricPill label="PON" value={String(el.total_pon_ports)} />
				) : null}
			</div>
		);
	}

	if (el.type === "splitter") {
		return (
			<div className="mt-2 flex min-w-0 flex-wrap gap-1 pr-8">
				<MetricPill label="Ratio" value={el.split_ratio ?? "N/D"} />
				{ownLoss !== null ? (
					<MetricPill label="Ins." value={`-${ownLoss} dB`} />
				) : null}
			</div>
		);
	}

	const total = el.total_ports ?? 0;
	const used = el.ports_used ?? 0;
	const reserved = el.ports_reserved ?? 0;
	const free = Math.max(0, total - used - reserved);
	const usedPct = total > 0 ? Math.round((used / total) * 100) : 0;
	const capacityColor =
		usedPct >= 90 ? "#fb4d6d" : usedPct >= 70 ? "#f59e0b" : "#34d399";
	const distKm =
		node.budget.cumulativeLengthMeters > 0
			? `${(node.budget.cumulativeLengthMeters / 1000).toFixed(2)} km`
			: "0 km";

	return (
		<div className="mt-1.5 space-y-1.5">
			<div className="flex min-w-0 flex-wrap gap-1">
				<MetricPill
					label="Split"
					value={
						getNapMode(el) === "with_splitter"
							? (el.split_ratio ?? "Sin ratio")
							: getNapMode(el) === "prepared"
								? "PLC ready"
								: "Terminal"
					}
					color={hasInternalSplitter(el) ? TYPE_COLOR.nap : undefined}
				/>
				{ownLoss !== null ? (
					<MetricPill label="Ins." value={`-${ownLoss} dB`} />
				) : null}
			</div>
			<CapacityBar
				total={el.total_ports}
				used={el.ports_used}
				reserved={el.ports_reserved}
			/>
			<div className="flex min-w-0 flex-wrap gap-1">
				<MetricPill
					label="Uso"
					value={`${used}/${total}`}
					color={capacityColor}
				/>
				<MetricPill label="Libre" value={String(free)} />
				<MetricPill label="Dist." value={distKm} />
			</div>
		</div>
	);
}

function GponFlowNodeComponent({ data, selected }: NodeProps<GponFlowNode>) {
	const {
		layout: node,
		isExpanded,
		dimmed,
		onSelectElement,
		onToggleGroup,
	} = data;
	const el = node.tree.element;
	const color = TYPE_COLOR[el.type];
	const statusColor = STATUS_COLOR[el.status] ?? STATUS_COLOR.unknown;
	const statusMark = EQUIPMENT_STATUS_MARK[el.status];
	const statusLabel = EQUIPMENT_STATUS_LABEL[el.status] ?? el.status;
	const hasChildren = node.tree.children.length > 0;
	const ownLoss =
		(el.type === "splitter" || hasInternalSplitter(el)) && el.split_ratio
			? (SPLITTER_LOSS_DB[el.split_ratio] ?? 0)
			: null;

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onSelectElement(el.id);
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: React Flow nodes need a div wrapper because splitters contain a nested disclosure button.
		<div
			role="button"
			tabIndex={0}
			onClick={() => onSelectElement(el.id)}
			onKeyDown={handleKeyDown}
			className="relative h-[92px] w-[196px] rounded-md border bg-[#1c2023] px-3 py-2 text-left shadow-lg transition-[opacity,border-color,box-shadow]"
			style={{
				borderColor: selected ? color : "rgba(255,255,255,0.08)",
				boxShadow: selected
					? `0 0 0 2px ${color}55, 0 12px 30px rgba(0,0,0,0.28)`
					: "0 10px 22px rgba(0,0,0,0.18)",
				opacity: dimmed ? 0.18 : 1,
			}}
		>
			<Handle
				type="target"
				position={Position.Left}
				className="!h-2 !w-2 !border !border-[#111213] !bg-[#858585]"
				isConnectable={false}
			/>
			<Handle
				type="source"
				position={Position.Right}
				className="!h-2 !w-2 !border !border-[#111213]"
				style={{ backgroundColor: color }}
				isConnectable={false}
			/>

			<div
				className="absolute left-0 top-2 h-[76px] w-[3px] rounded-full"
				style={{ backgroundColor: color }}
			/>

			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div
						className="text-[7.5px] font-bold uppercase leading-none tracking-[1px]"
						style={{ color }}
					>
						{el.type === "splitter"
							? "SPLITTER"
							: hasInternalSplitter(el)
								? "NAP + PLC"
								: el.type.toUpperCase()}
					</div>
					<div className="mt-2 truncate text-[10.5px] font-semibold leading-none text-[#e6e6e6]">
						{el.code ?? el.name}
					</div>
					<div className="mt-1 truncate text-[7.5px] leading-none text-[#5c5d5f]">
						{el.name ?? EQUIPMENT_TYPE_LABEL[el.type]}
					</div>
				</div>

				<div className="relative shrink-0">
					<EquipmentSymbol
						type={el.type}
						color={color}
						hasInternalSplitter={hasInternalSplitter(el)}
					/>
					<span
						className="absolute -right-1 -bottom-1 flex size-3 items-center justify-center rounded-full border border-[#111213] text-[7px] font-bold leading-none text-[#111213]"
						style={{ backgroundColor: statusColor }}
						title={statusLabel}
						aria-hidden="true"
					>
						{statusMark}
					</span>
					{node.budget.margin !== null && (
						<span
							className="absolute -right-1 -top-1 block size-2.5 rounded-full border border-[#111213]"
							style={{
								backgroundColor: OPTICAL_STATUS_COLOR[node.budget.status],
							}}
						/>
					)}
				</div>
			</div>

			<NodeMetrics node={node} ownLoss={ownLoss} />

			{el.type === "splitter" && (
				<div className="absolute right-3 bottom-4">
					{hasChildren && (
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								onToggleGroup(el.id);
							}}
							className="nodrag nopan h-4 min-w-6 rounded border border-white/10 bg-white/5 px-1 text-[8px] text-[#6b7280] hover:bg-white/10 hover:text-[#a4a4a4]"
							aria-label={
								isExpanded
									? `Contraer ${el.code ?? el.name ?? "splitter"}`
									: `Expandir ${el.code ?? el.name ?? "splitter"}`
							}
							aria-expanded={isExpanded}
						>
							{isExpanded ? "-" : `+${node.tree.children.length}`}
						</button>
					)}
				</div>
			)}

			<div className="absolute inset-x-3 bottom-1.5">
				<LossBar node={node} />
			</div>
		</div>
	);
}

function GponCableEdgeComponent({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
}: EdgeProps<GponCableEdge>) {
	const [edgePath, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		borderRadius: 18,
	});
	const opacity = data?.opacity ?? 1;
	const strokeWidth = data?.strokeWidth ?? 2;
	const color = data?.color ?? CABLE_COLOR.default;
	const active = data?.active ?? false;

	return (
		<>
			<BaseEdge
				id={`${id}-casing`}
				path={edgePath}
				style={{
					stroke: CABLE_CASING,
					strokeWidth: strokeWidth + (active ? 5 : 4),
					opacity: opacity * 0.95,
				}}
			/>
			<BaseEdge
				id={id}
				path={edgePath}
				style={{
					stroke: color,
					strokeWidth: active ? strokeWidth + 0.9 : strokeWidth,
					opacity,
				}}
			/>
			{active && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan absolute size-2 rounded-full border border-[#111213]"
						style={{
							backgroundColor: data?.statusColor ?? color,
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
						}}
					/>
				</EdgeLabelRenderer>
			)}
			{data?.label && opacity > 0.2 && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan absolute rounded border border-white/10 bg-[#111213]/95 px-1.5 py-0.5 text-[8px] text-[#858585] shadow-sm"
						style={{
							transform: `translate(-50%, calc(-50% - 13px)) translate(${labelX}px, ${labelY}px)`,
						}}
					>
						{data.label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}

function FlowButton({
	label,
	children,
	onClick,
	active,
}: {
	label: string;
	children: ReactNode;
	onClick: () => void;
	active?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex size-7 items-center justify-center rounded border border-white/10 bg-[#1b1c1d]/90 text-[#858585] shadow-sm transition-colors hover:bg-white/10 hover:text-[#e6e6e6] aria-pressed:border-[#38bdf8]/40 aria-pressed:text-[#38bdf8]"
			aria-label={label}
			aria-pressed={active}
			title={label}
		>
			{children}
		</button>
	);
}

function DiagramToolbar({
	showLabels,
	onToggleLabels,
	showMiniMap,
	onToggleMiniMap,
}: {
	showLabels: boolean;
	onToggleLabels: () => void;
	showMiniMap: boolean;
	onToggleMiniMap: () => void;
}) {
	const { fitView, zoomIn, zoomOut } = useReactFlow();

	return (
		<Panel position="top-left" className="!m-3">
			<div className="flex items-center gap-1 rounded-md border border-white/10 bg-[#111213]/90 p-1 shadow-xl backdrop-blur">
				<FlowButton
					label="Ajustar vista"
					onClick={() => fitView({ padding: 0.16, duration: 240 })}
				>
					<Maximize2 className="size-3.5" aria-hidden="true" />
				</FlowButton>
				<FlowButton label="Acercar" onClick={() => zoomIn({ duration: 160 })}>
					<ZoomIn className="size-3.5" aria-hidden="true" />
				</FlowButton>
				<FlowButton label="Alejar" onClick={() => zoomOut({ duration: 160 })}>
					<ZoomOut className="size-3.5" aria-hidden="true" />
				</FlowButton>
				<span className="mx-1 h-5 w-px bg-white/10" />
				<FlowButton
					label="Mostrar distancias"
					onClick={onToggleLabels}
					active={showLabels}
				>
					<Tags className="size-3.5" aria-hidden="true" />
				</FlowButton>
				<FlowButton
					label="Mostrar minimapa"
					onClick={onToggleMiniMap}
					active={showMiniMap}
				>
					<MapIcon className="size-3.5" aria-hidden="true" />
				</FlowButton>
			</div>
		</Panel>
	);
}

function DiagramLegend() {
	return (
		<Panel position="bottom-left" className="!m-3">
			<div className="flex items-center gap-3 rounded-md border border-white/10 bg-[#111213]/86 px-2.5 py-1.5 text-[10px] text-[#858585] shadow-xl backdrop-blur">
				<span className="inline-flex items-center gap-1">
					<span
						className="size-2 rounded-full"
						style={{ backgroundColor: TYPE_COLOR.olt }}
					/>
					OLT
				</span>
				<span className="inline-flex items-center gap-1">
					<span
						className="size-2 rounded-full"
						style={{ backgroundColor: TYPE_COLOR.splitter }}
					/>
					Splitter
				</span>
				<span className="inline-flex items-center gap-1">
					<span
						className="size-2 rounded-full"
						style={{ backgroundColor: TYPE_COLOR.nap }}
					/>
					NAP
				</span>
				<span className="inline-flex items-center gap-1">
					<Cable className="size-3" aria-hidden="true" />
					Feeder / distribución
				</span>
			</div>
		</Panel>
	);
}

function ActivePathPanel({ summary }: { summary: ActiveSummary | null }) {
	if (!summary) return null;

	return (
		<Panel position="top-right" className="!m-3">
			<div className="w-60 rounded-md border border-white/10 bg-[#111213]/92 p-3 text-xs shadow-xl backdrop-blur">
				<div className="mb-2 flex items-center gap-2 text-[#d7d7d7]">
					<BadgeInfo className="size-3.5 text-[#38bdf8]" aria-hidden="true" />
					<span className="truncate font-medium">{summary.code}</span>
				</div>
				<div className="grid grid-cols-2 gap-1.5 text-[10px]">
					<MetricPill label="Tipo" value={summary.type} />
					<MetricPill label="Estado" value={summary.status} />
					<MetricPill label="Pérdida" value={`${summary.loss} dB`} />
					<MetricPill
						label="Margen"
						value={summary.margin === null ? "N/D" : `${summary.margin} dB`}
						color={
							summary.margin === null
								? "#858585"
								: summary.margin < 1
									? "#fb4d6d"
									: summary.margin < 3
										? "#f59e0b"
										: "#34d399"
						}
					/>
					<MetricPill label="Long." value={summary.lengthKm} />
				</div>
			</div>
		</Panel>
	);
}

export function LogicalDiagram({
	layoutNodes,
	roots,
	totalWidth,
	totalHeight,
	selectedId,
	expandedGroups,
	onSelectElement,
	onToggleGroup,
}: LogicalDiagramProps) {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [showLabels, setShowLabels] = useState(true);
	const [showMiniMap, setShowMiniMap] = useState(true);

	const visibleIds = useMemo(() => {
		const nodeMap = new Map<string, LayoutNode>(
			layoutNodes.map((n) => [n.tree.element.id, n]),
		);

		function isVisible(nodeId: string): boolean {
			const node = nodeMap.get(nodeId);
			if (!node) return false;
			const parentId = node.tree.routeFromParent?.from_element_id;
			if (!parentId) return true;
			const parent = nodeMap.get(parentId);
			if (!parent) return true;
			if (
				parent.tree.element.type === "splitter" &&
				parent.tree.children.length > 0 &&
				!expandedGroups.has(parentId)
			) {
				return false;
			}
			return isVisible(parentId);
		}

		const ids = new Set<string>();
		for (const node of layoutNodes) {
			if (isVisible(node.tree.element.id)) ids.add(node.tree.element.id);
		}
		return ids;
	}, [layoutNodes, expandedGroups]);

	const { highlightedNodes, highlightedRouteIds } = useMemo(() => {
		const activeId = hoveredId ?? selectedId;
		if (!activeId) return { highlightedNodes: null, highlightedRouteIds: null };

		const chain = findAncestorChain(roots, activeId);
		const activeNode = findNodeById(roots, activeId);
		if (activeNode) collectDescendants(activeNode, chain);

		const routeIds = findRouteIdsOnPath(chain, layoutNodes);
		return { highlightedNodes: chain, highlightedRouteIds: routeIds };
	}, [hoveredId, selectedId, roots, layoutNodes]);

	const activeSummary = useMemo<ActiveSummary | null>(() => {
		const activeId = hoveredId ?? selectedId;
		if (!activeId) return null;
		const node = layoutNodes.find((item) => item.tree.element.id === activeId);
		if (!node) return null;

		const el = node.tree.element;
		return {
			code: el.code ?? el.name ?? el.id,
			type: EQUIPMENT_TYPE_LABEL[el.type] ?? el.type,
			status: EQUIPMENT_STATUS_LABEL[el.status] ?? el.status,
			loss: node.budget.totalLoss,
			margin: node.budget.margin,
			lengthKm: `${(node.budget.cumulativeLengthMeters / 1000).toFixed(2)} km`,
		};
	}, [hoveredId, selectedId, layoutNodes]);

	const flowNodes = useMemo<GponFlowNode[]>(
		() =>
			layoutNodes
				.filter((node) => visibleIds.has(node.tree.element.id))
				.map((node) => ({
					id: node.tree.element.id,
					type: "gponNode",
					position: { x: node.x, y: node.y },
					sourcePosition: Position.Right,
					targetPosition: Position.Left,
					selected: selectedId === node.tree.element.id,
					draggable: false,
					data: {
						layout: node,
						isExpanded: expandedGroups.has(node.tree.element.id),
						dimmed:
							highlightedNodes !== null &&
							!highlightedNodes.has(node.tree.element.id),
						onSelectElement,
						onToggleGroup,
					},
				})),
		[
			layoutNodes,
			visibleIds,
			selectedId,
			expandedGroups,
			highlightedNodes,
			onSelectElement,
			onToggleGroup,
		],
	);

	const flowEdges = useMemo<GponCableEdge[]>(
		() =>
			layoutNodes.flatMap((node) => {
				const route = node.tree.routeFromParent;
				if (!route?.from_element_id) return [];
				if (!visibleIds.has(node.tree.element.id)) return [];
				if (!visibleIds.has(route.from_element_id)) return [];

				const routeType = route.type ?? "distribution";
				const isFeeder = routeType === "feeder";
				const color = isFeeder ? CABLE_COLOR.feeder : CABLE_COLOR.distribution;
				const isOnPath =
					!highlightedRouteIds || highlightedRouteIds.has(route.id);
				const isActivePath = highlightedRouteIds?.has(route.id) ?? false;
				const km = route.length_meters
					? `${(route.length_meters / 1000).toFixed(2)} km`
					: undefined;

				return [
					{
						id: `edge-${route.id}-${node.tree.element.id}`,
						source: route.from_element_id,
						target: node.tree.element.id,
						type: "gponCable",
						animated: isOnPath && hoveredId !== null,
						data: {
							color,
							strokeWidth: isFeeder ? 2.8 : 2,
							opacity: isOnPath ? (isActivePath ? 1 : 0.82) : 0.1,
							active: isActivePath,
							statusColor: OPTICAL_STATUS_COLOR[node.budget.status],
							label: showLabels || isActivePath ? km : undefined,
						},
					},
				];
			}),
		[layoutNodes, visibleIds, highlightedRouteIds, hoveredId, showLabels],
	);

	return (
		<div
			className="h-full w-full"
			style={{
				minWidth: Math.max(totalWidth, 420),
				minHeight: Math.max(totalHeight, 160),
			}}
		>
			<ReactFlow
				nodes={flowNodes}
				edges={flowEdges}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				colorMode="dark"
				fitView
				fitViewOptions={{ padding: 0.12 }}
				minZoom={0.25}
				maxZoom={1.8}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable
				proOptions={{ hideAttribution: true }}
				onNodeClick={(_, node) => onSelectElement(node.id)}
				onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
				onNodeMouseLeave={() => setHoveredId(null)}
				aria-label="Diagrama lógico de la red GPON"
			>
				<Background color="rgba(164,164,164,0.12)" gap={18} size={1} />
				<DiagramToolbar
					showLabels={showLabels}
					onToggleLabels={() => setShowLabels((current) => !current)}
					showMiniMap={showMiniMap}
					onToggleMiniMap={() => setShowMiniMap((current) => !current)}
				/>
				<ActivePathPanel summary={activeSummary} />
				<DiagramLegend />
				<Controls
					showInteractive={false}
					className="!border !border-white/10 !bg-[#1b1c1d]/90 !shadow-xl"
				/>
				{showMiniMap && (
					<MiniMap
						pannable
						zoomable
						nodeColor={(node) => {
							const layout = (node as GponFlowNode).data.layout;
							return TYPE_COLOR[layout.tree.element.type];
						}}
						className="!h-20 !w-32 !border !border-white/10 !bg-[#111213]/90"
						maskColor="rgba(17,18,19,0.62)"
					/>
				)}
			</ReactFlow>
		</div>
	);
}
