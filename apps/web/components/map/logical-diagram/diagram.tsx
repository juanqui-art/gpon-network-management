"use client";

import {
	Background,
	BaseEdge,
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
import { BadgeInfo, MapIcon, Maximize2, Tags } from "lucide-react";
import {
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { InfrastructureElement } from "@/components/map/types";
import {
	getNapMode,
	hasInternalSplitter,
	NAP_MODE_LABEL,
} from "@/lib/gpon/nap-config";
import { getOltModel } from "@/lib/gpon/olt-catalog";
import {
	ATTENUATION_DB_PER_KM,
	CONNECTOR_LOSS_DB,
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
import { OpticalPowerBudgetChart } from "./optical-power-budget-chart";
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
	selectedRouteId?: string | null;
	showActivePanel?: boolean;
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
	physicalLoss: number;
	txPowerDbm: number | null;
	rxPowerDbm: number | null;
	rxSensitivityDbm: number | null;
	powerMarginDb: number | null;
	lengthKm: string;
	budget: LayoutNode["budget"];
	pathLabel: string;
	isEndpoint: boolean;
	confidence: "complete" | "assumed" | "incomplete";
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
		<span className="inline-flex h-5 min-w-0 items-center gap-1 rounded border border-white/14 bg-white/7 px-1.5 text-[8px] leading-none text-[#a4a4a4]">
			<span className="shrink-0 text-[#7b8086]">{label}</span>
			<span className="min-w-0 truncate font-semibold" style={{ color }}>
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

function stringProperty(
	properties: Record<string, unknown> | null | undefined,
	key: string,
): string | null {
	const value = properties?.[key];
	return typeof value === "string" && value.trim() !== "" ? value : null;
}

function splitRatioSize(ratio: string | null): number | null {
	if (!ratio) return null;
	const [, size] = ratio.split(":");
	const parsed = Number(size);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getOltCapacity(element: InfrastructureElement) {
	const modelId = stringProperty(element.properties, "olt_model_id");
	const model = modelId ? getOltModel(modelId) : undefined;
	const modelLabel =
		stringProperty(element.properties, "olt_model") ??
		(model ? `${model.manufacturer} ${model.model}` : null);
	const serviceSlotsTotal =
		numericProperty(element.properties, "service_slots_total") ??
		model?.serviceSlotsTotal ??
		null;
	const serviceCardsInstalled =
		numericProperty(element.properties, "service_cards_installed") ??
		numericProperty(element.properties, "service_slots_used");
	const ponPortsPerCard =
		numericProperty(element.properties, "pon_ports_per_card") ??
		model?.ponPortsPerCard ??
		null;
	const installedPonPorts =
		element.total_pon_ports ??
		(serviceCardsInstalled !== null && ponPortsPerCard !== null
			? serviceCardsInstalled * ponPortsPerCard
			: null);
	const maxPonPorts =
		numericProperty(element.properties, "max_pon_ports") ??
		(serviceSlotsTotal !== null && ponPortsPerCard !== null
			? serviceSlotsTotal * ponPortsPerCard
			: (model?.maxPonPorts ?? null));
	const designSplitRatio =
		stringProperty(element.properties, "design_split_ratio") ??
		stringProperty(element.properties, "split_ratio_design");
	const splitSize = splitRatioSize(designSplitRatio);
	const estimatedSubscribers =
		numericProperty(element.properties, "estimated_subscribers") ??
		(installedPonPorts !== null && splitSize !== null
			? installedPonPorts * splitSize
			: null);

	return {
		estimatedSubscribers,
		installedPonPorts,
		maxPonPorts,
		modelLabel,
		ponPortsPerCard,
		serviceCardsInstalled,
		serviceSlotsTotal,
		designSplitRatio,
	};
}

function OltCapacityStage({ element }: { element: InfrastructureElement }) {
	const capacity = getOltCapacity(element);
	const hasSlotData =
		capacity.serviceCardsInstalled !== null &&
		capacity.serviceSlotsTotal !== null;
	const hasPonData =
		capacity.installedPonPorts !== null && capacity.maxPonPorts !== null;
	const slotRatio = hasSlotData
		? Math.min(
				(capacity.serviceCardsInstalled ?? 0) /
					Math.max(capacity.serviceSlotsTotal ?? 1, 1),
				1,
			)
		: 0;
	const ponRatio = hasPonData
		? Math.min(
				(capacity.installedPonPorts ?? 0) /
					Math.max(capacity.maxPonPorts ?? 1, 1),
				1,
			)
		: 0;

	return (
		<div className="mt-1.5 space-y-1.5">
			<div className="flex min-w-0 items-center justify-between gap-2">
				<span className="truncate text-[8px] font-semibold leading-none text-[#d7d7d7]">
					{capacity.modelLabel ?? element.pon_standard?.toUpperCase() ?? "OLT"}
				</span>
				<span className="shrink-0 text-[8px] font-bold leading-none text-[#38bdf8]">
					{element.optical_class ?? "N/D"}
				</span>
			</div>
			<div className="grid min-w-0 grid-cols-2 gap-1">
				<MetricPill
					label="Cards"
					value={
						hasSlotData
							? `${capacity.serviceCardsInstalled}/${capacity.serviceSlotsTotal}`
							: "N/D"
					}
				/>
				<MetricPill
					label="PON"
					value={
						hasPonData
							? `${capacity.installedPonPorts}/${capacity.maxPonPorts}`
							: String(element.total_pon_ports ?? "N/D")
					}
				/>
			</div>
			<div className="flex h-[3px] overflow-hidden rounded-full bg-white/8">
				<div
					className="h-full bg-[#38bdf8]"
					style={{ width: `${Math.max(4, slotRatio * 100)}%` }}
				/>
				<div
					className="h-full bg-[#34d399]"
					style={{ width: `${Math.max(0, (ponRatio - slotRatio) * 100)}%` }}
				/>
			</div>
			<div className="grid min-w-0 grid-cols-2 gap-1">
				<MetricPill label="Split" value={capacity.designSplitRatio ?? "N/D"} />
				<MetricPill
					label="Clientes"
					value={
						capacity.estimatedSubscribers !== null
							? capacity.estimatedSubscribers.toLocaleString("en-US")
							: "N/D"
					}
				/>
				<MetricPill
					label="Tx"
					value={
						numericProperty(element.properties, "tx_power_dbm") !== null
							? `${numericProperty(element.properties, "tx_power_dbm")} dBm`
							: "N/D"
					}
					color="#38d8ff"
				/>
				<MetricPill
					label="Sens."
					value={
						numericProperty(element.properties, "rx_sensitivity_dbm") !== null
							? `${numericProperty(element.properties, "rx_sensitivity_dbm")} dBm`
							: "N/D"
					}
				/>
			</div>
		</div>
	);
}

function NapOpticalStage({
	mode,
	ratio,
	loss,
}: {
	mode: ReturnType<typeof getNapMode>;
	ratio: string | null;
	loss: number | null;
}) {
	const isSplitter = mode === "with_splitter";
	const isPrepared = mode === "prepared";
	const accent = isSplitter
		? TYPE_COLOR.nap
		: isPrepared
			? "#38bdf8"
			: "#777879";
	const label = isSplitter
		? `PLC interno ${ratio ?? "sin ratio"}`
		: NAP_MODE_LABEL[mode];

	return (
		<div
			className="rounded border px-1.5 py-1"
			style={{
				backgroundColor: `${accent}10`,
				borderColor: `${accent}35`,
			}}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="truncate text-[8px] font-semibold leading-none text-[#d7d7d7]">
					{label}
				</span>
				<span
					className="shrink-0 text-[8px] font-bold leading-none"
					style={{ color: accent }}
				>
					{loss !== null ? `-${loss} dB` : isSplitter ? "N/D" : "0 dB"}
				</span>
			</div>
			<div className="mt-1 flex h-[3px] overflow-hidden rounded-full bg-white/8">
				<div
					className="h-full rounded-full"
					style={{
						width: isSplitter ? "78%" : isPrepared ? "38%" : "16%",
						backgroundColor: accent,
						opacity: isSplitter ? 0.95 : 0.55,
					}}
				/>
			</div>
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
		return <OltCapacityStage element={el} />;
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
	const napMode = getNapMode(el);

	return (
		<div className="mt-1.5 space-y-1.5 overflow-hidden">
			<NapOpticalStage mode={napMode} ratio={el.split_ratio} loss={ownLoss} />
			<CapacityBar
				total={el.total_ports}
				used={el.ports_used}
				reserved={el.ports_reserved}
			/>
			<div className="grid min-w-0 grid-cols-3 gap-1">
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
			? (el.insertion_loss_db ?? SPLITTER_LOSS_DB[el.split_ratio] ?? 0)
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
			className="relative h-[116px] w-[196px] overflow-hidden rounded-md border bg-[#202529] px-3 py-2 text-left shadow-lg transition-[opacity,border-color,box-shadow]"
			style={{
				borderColor: selected ? color : "rgba(255,255,255,0.13)",
				boxShadow: selected
					? `0 0 0 2px ${color}55, 0 12px 30px rgba(0,0,0,0.28)`
					: "0 12px 28px rgba(0,0,0,0.24)",
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
				className="absolute left-0 top-2 h-[100px] w-[3px] rounded-full"
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
					<div className="mt-2 truncate text-[11px] font-semibold leading-none text-[#f3f4f6]">
						{el.code ?? el.name}
					</div>
					<div className="mt-1 truncate text-[8px] leading-none text-[#8b9096]">
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
	const { fitView } = useReactFlow();

	return (
		<Panel position="top-left" className="!m-3">
			<div className="flex items-center gap-1 rounded-md border border-white/10 bg-[#111213]/90 p-1 shadow-xl backdrop-blur">
				<FlowButton
					label="Ajustar vista"
					onClick={() => fitView({ padding: 0.16, duration: 240 })}
				>
					<Maximize2 className="size-3.5" aria-hidden="true" />
				</FlowButton>
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

function confidenceLabel(confidence: ActiveSummary["confidence"]) {
	if (confidence === "complete") return "Completo";
	if (confidence === "assumed") return "Con supuestos";
	return "Sin clase";
}

function confidenceColor(confidence: ActiveSummary["confidence"]) {
	if (confidence === "complete") return "#34d399";
	if (confidence === "assumed") return "#f59e0b";
	return "#858585";
}

function findPathNodes(roots: TreeNode[], targetId: string): TreeNode[] {
	function walk(node: TreeNode, path: TreeNode[]): TreeNode[] | null {
		const nextPath = [...path, node];
		if (node.element.id === targetId) return nextPath;
		for (const child of node.children) {
			const found = walk(child, nextPath);
			if (found) return found;
		}
		return null;
	}

	for (const root of roots) {
		const found = walk(root, []);
		if (found) return found;
	}
	return [];
}

function getRouteLossLabel(
	route: LayoutNode["tree"]["routeFromParent"],
): string {
	if (!route) return "";
	const fiberLoss =
		route.length_meters != null
			? ((route.length_meters + (route.reservation_m ?? 0)) / 1000) *
				(route.attenuation_db_per_km ?? ATTENUATION_DB_PER_KM["1490"])
			: 0;
	const routeLoss =
		route.total_loss_db ??
		fiberLoss +
			(route.splice_loss_db ?? 0) +
			(route.connector_loss_db ?? 2 * CONNECTOR_LOSS_DB);
	return `${routeLoss.toFixed(2)} dB`;
}

function ActivePathPanel({ summary }: { summary: ActiveSummary | null }) {
	if (!summary) return null;
	const warnings = Array.from(new Set(summary.budget.warnings)).slice(0, 4);
	const confidence = {
		color: confidenceColor(summary.confidence),
		label: confidenceLabel(summary.confidence),
	};

	return (
		<Panel position="bottom-right" className="!m-3">
			<div className="w-[min(760px,calc(100vw-360px))] rounded-lg border border-white/10 bg-[#0d0f10]/94 p-2.5 text-xs shadow-[0_20px_70px_rgba(0,0,0,0.46)] backdrop-blur">
				<div className="mb-2 flex items-center justify-between gap-3 text-[#d7d7d7]">
					<div className="flex min-w-0 items-center gap-2">
						<BadgeInfo className="size-3.5 text-[#38bdf8]" aria-hidden="true" />
						<div className="min-w-0">
							<p className="truncate font-semibold">
								Presupuesto en ruta: {summary.code}
							</p>
							<p className="mt-0.5 truncate text-[10px] text-[#858585]">
								{summary.pathLabel}
							</p>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<MetricPill label="Fisica" value={`${summary.physicalLoss} dB`} />
						<MetricPill
							label="Rx"
							value={
								summary.rxPowerDbm === null
									? "N/D"
									: `${summary.rxPowerDbm.toFixed(1)} dBm`
							}
						/>
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
						<span
							className="rounded border px-1.5 py-0.5 text-[9px] font-semibold"
							style={{
								backgroundColor: `${confidence.color}18`,
								borderColor: `${confidence.color}44`,
								color: confidence.color,
							}}
						>
							{confidence.label}
						</span>
					</div>
				</div>
				<OpticalPowerBudgetChart budget={summary.budget} height={135} />
				{warnings.length > 0 && (
					<p
						className="mt-1.5 truncate rounded border border-[#f59e0b]/20 bg-[#f59e0b]/8 px-2 py-1 text-[10px] text-[#f6c768]"
						title={warnings.join(" · ")}
					>
						Supuestos: {warnings.join(" · ")}
					</p>
				)}
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
	selectedRouteId = null,
	showActivePanel = true,
	expandedGroups,
	onSelectElement,
	onToggleGroup,
}: LogicalDiagramProps) {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [showLabels, setShowLabels] = useState(true);
	const [showMiniMap, setShowMiniMap] = useState(false);
	const hoverClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearHoverTimer = useCallback(() => {
		if (hoverClearTimerRef.current) {
			clearTimeout(hoverClearTimerRef.current);
			hoverClearTimerRef.current = null;
		}
	}, []);

	const handleNodeMouseEnter = useCallback(
		(id: string) => {
			clearHoverTimer();
			setHoveredId((current) => (current === id ? current : id));
		},
		[clearHoverTimer],
	);

	const handleNodeMouseLeave = useCallback(() => {
		clearHoverTimer();
		hoverClearTimerRef.current = setTimeout(() => {
			setHoveredId(null);
			hoverClearTimerRef.current = null;
		}, 90);
	}, [clearHoverTimer]);

	useEffect(() => clearHoverTimer, [clearHoverTimer]);

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
		if (!activeId && selectedRouteId) {
			return {
				highlightedNodes: null,
				highlightedRouteIds: new Set([selectedRouteId]),
			};
		}
		if (!activeId) return { highlightedNodes: null, highlightedRouteIds: null };

		const chain = findAncestorChain(roots, activeId);
		const activeNode = findNodeById(roots, activeId);
		if (activeNode) collectDescendants(activeNode, chain);

		const routeIds = findRouteIdsOnPath(chain, layoutNodes);
		return { highlightedNodes: chain, highlightedRouteIds: routeIds };
	}, [hoveredId, selectedId, selectedRouteId, roots, layoutNodes]);

	const activeSummary = useMemo<ActiveSummary | null>(() => {
		const activeId = hoveredId ?? selectedId;
		if (!activeId) return null;
		const node = layoutNodes.find((item) => item.tree.element.id === activeId);
		if (!node) return null;

		const el = node.tree.element;
		const pathNodes = findPathNodes(roots, activeId);
		const pathLabel =
			pathNodes
				.map(
					(item) => item.element.code ?? item.element.name ?? item.element.id,
				)
				.join(" -> ") ||
			(el.code ?? el.name ?? el.id);
		const confidence =
			node.budget.margin === null
				? "incomplete"
				: node.budget.warnings.length > 0
					? "assumed"
					: "complete";
		return {
			code: el.code ?? el.name ?? el.id,
			type: EQUIPMENT_TYPE_LABEL[el.type] ?? el.type,
			status: EQUIPMENT_STATUS_LABEL[el.status] ?? el.status,
			loss: node.budget.totalLoss,
			margin: node.budget.margin,
			physicalLoss: node.budget.physicalLoss,
			txPowerDbm: node.budget.txPowerDbm,
			rxPowerDbm: node.budget.rxPowerDbm,
			rxSensitivityDbm: node.budget.rxSensitivityDbm,
			powerMarginDb: node.budget.powerMarginDb,
			lengthKm: `${(node.budget.cumulativeLengthMeters / 1000).toFixed(2)} km`,
			budget: node.budget,
			pathLabel,
			isEndpoint: el.type === "nap",
			confidence,
		};
	}, [hoveredId, selectedId, layoutNodes, roots]);

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
				const routeLoss = getRouteLossLabel(route);
				const routeLabel = isActivePath && km ? `${km} · ${routeLoss}` : km;

				return [
					{
						id: `edge-${route.id}-${node.tree.element.id}`,
						source: route.from_element_id,
						target: node.tree.element.id,
						type: "gponCable",
						animated: false,
						data: {
							color,
							strokeWidth: isFeeder ? 2.8 : 2,
							opacity: isOnPath ? (isActivePath ? 1 : 0.82) : 0.1,
							active: isActivePath,
							statusColor: OPTICAL_STATUS_COLOR[node.budget.status],
							label: showLabels || isActivePath ? routeLabel : undefined,
						},
					},
				];
			}),
		[layoutNodes, visibleIds, highlightedRouteIds, showLabels],
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
				onNodeMouseEnter={(_, node) => handleNodeMouseEnter(node.id)}
				onNodeMouseLeave={handleNodeMouseLeave}
				aria-label="Diagrama lógico de la red GPON"
			>
				<Background color="rgba(164,164,164,0.12)" gap={18} size={1} />
				<DiagramToolbar
					showLabels={showLabels}
					onToggleLabels={() => setShowLabels((current) => !current)}
					showMiniMap={showMiniMap}
					onToggleMiniMap={() => setShowMiniMap((current) => !current)}
				/>
				{showActivePanel && <ActivePathPanel summary={activeSummary} />}
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
