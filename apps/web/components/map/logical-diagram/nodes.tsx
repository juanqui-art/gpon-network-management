"use client";

import type React from "react";
import {
	OPTICAL_STATUS_COLOR,
	SPLITTER_LOSS_DB,
} from "@/lib/gpon/optical-budget";
import { TYPE_COLOR } from "@/lib/map/palette";
import type { LayoutNode } from "./types";

// ── Shared sub-components ─────────────────────────────────────────────────────

function truncateSvgText(value: string | null | undefined, maxLength: number) {
	if (!value) return "";
	if (value.length <= maxLength) return value;
	return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function LossBar({
	x,
	y,
	w,
	node,
}: {
	x: number;
	y: number;
	w: number;
	node: LayoutNode;
}) {
	const { margin, totalLoss, status } = node.budget;
	if (margin === null) return null;
	const maxBudget = totalLoss + margin;
	if (maxBudget <= 0) return null;
	const fillW = Math.max(1, Math.round(w * Math.min(totalLoss / maxBudget, 1)));
	return (
		<g>
			<rect
				x={x}
				y={y}
				width={w}
				height={3}
				rx={1.5}
				fill="rgba(255,255,255,0.07)"
			/>
			<rect
				x={x}
				y={y}
				width={fillW}
				height={3}
				rx={1.5}
				fill={OPTICAL_STATUS_COLOR[status]}
				fillOpacity={0.85}
			/>
		</g>
	);
}

function CapacityBar({
	x,
	y,
	w,
	total,
	used,
	reserved,
}: {
	x: number;
	y: number;
	w: number;
	total: number | null;
	used: number | null;
	reserved: number | null;
}) {
	if (!total || total <= 0) return null;
	const u = Math.min((used ?? 0) / total, 1);
	const r = Math.min((reserved ?? 0) / total, 1 - u);
	const uw = Math.round(w * u);
	const rw = Math.round(w * r);
	const usedColor = u > 0.9 ? "#fb4d6d" : u > 0.7 ? "#f59e0b" : "#34d399";
	return (
		<g>
			<rect
				x={x}
				y={y}
				width={w}
				height={4}
				rx={2}
				fill="rgba(255,255,255,0.07)"
			/>
			{uw > 0 && (
				<rect x={x} y={y} width={uw} height={4} rx={2} fill={usedColor} />
			)}
			{rw > 0 && (
				<rect
					x={x + uw}
					y={y}
					width={rw}
					height={4}
					rx={0}
					fill="#f59e0b"
					fillOpacity={0.6}
				/>
			)}
		</g>
	);
}

function FanIcon({ cx, cy, color }: { cx: number; cy: number; color: string }) {
	return (
		<g stroke={color} strokeWidth={1} strokeOpacity={0.5} fill="none">
			<line x1={cx} y1={cy} x2={cx + 9} y2={cy - 5} />
			<line x1={cx} y1={cy} x2={cx + 9} y2={cy} />
			<line x1={cx} y1={cy} x2={cx + 9} y2={cy + 5} />
			<circle cx={cx} cy={cy} r={1.5} fill={color} />
		</g>
	);
}

// ── Shared node shell ─────────────────────────────────────────────────────────

function NodeShell({
	x,
	y,
	w,
	h,
	color,
	isSelected,
	onClick,
	onMouseEnter,
	onMouseLeave,
	onKeyDown,
	children,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	color: string;
	isSelected: boolean;
	onClick: () => void;
	onMouseEnter: () => void;
	onMouseLeave: () => void;
	onKeyDown: (e: React.KeyboardEvent<SVGGElement>) => void;
	children: React.ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: SVG group acting as interactive button
		<g
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onKeyDown={onKeyDown}
			role="button"
			tabIndex={0}
			style={{ cursor: "pointer" }}
		>
			{/* Selection ring */}
			{isSelected && (
				<rect
					x={x - 2}
					y={y - 2}
					width={w + 4}
					height={h + 4}
					rx={5}
					fill="none"
					stroke="rgba(255,255,255,0.4)"
					strokeWidth={1.5}
				/>
			)}

			{/* Card background */}
			<rect
				x={x}
				y={y}
				width={w}
				height={h}
				rx={4}
				fill="#1c2023"
				stroke={isSelected ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}
				strokeWidth={1}
			/>

			{/* Left accent bar */}
			<rect x={x} y={y + 5} width={3} height={h - 10} rx={1.5} fill={color} />

			{children}
		</g>
	);
}

// ── OLT node ──────────────────────────────────────────────────────────────────

function OLTNode({
	node,
	isSelected,
	onSelect,
	onMouseEnter,
	onMouseLeave,
}: NodeProps) {
	const el = node.tree.element;
	const color = TYPE_COLOR.olt;
	const { x, y, width: w, height: h } = node;

	const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onSelect();
		}
	};

	return (
		<NodeShell
			{...{ x, y, w, h, color, isSelected }}
			onClick={onSelect}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onKeyDown={handleKeyDown}
		>
			{/* Type label */}
			<text
				x={x + 12}
				y={y + 15}
				fontSize={7.5}
				fontWeight={700}
				fill={color}
				letterSpacing={1}
			>
				OLT
			</text>

			{/* Optical status badge */}
			{node.budget.margin !== null && (
				<circle
					cx={x + w - 11}
					cy={y + 11}
					r={4.5}
					fill={OPTICAL_STATUS_COLOR[node.budget.status]}
				/>
			)}

			{/* Code */}
			<text
				x={x + 12}
				y={y + 32}
				fontSize={10.5}
				fontWeight={600}
				fill="#e6e6e6"
			>
				{el.code ?? el.name}
			</text>

			{/* Class + ports */}
			<text x={x + 12} y={y + 48} fontSize={8} fill="#6b7280">
				{el.optical_class ? `Clase ${el.optical_class}` : "sin clase óptica"}
				{el.total_pon_ports ? ` · ${el.total_pon_ports} PON` : ""}
			</text>

			{/* Loss bar (OLT is root: always 0 dB, bar empty) */}
			<LossBar x={x + 12} y={y + h - 7} w={w - 20} node={node} />
		</NodeShell>
	);
}

// ── Splitter node ─────────────────────────────────────────────────────────────

function SplitterNode({
	node,
	isSelected,
	isExpanded,
	onSelect,
	onToggle,
	onMouseEnter,
	onMouseLeave,
}: NodeProps) {
	const el = node.tree.element;
	const color = TYPE_COLOR.splitter;
	const { x, y, width: w, height: h } = node;
	const hasChildren = node.tree.children.length > 0;
	const ownLoss = el.split_ratio
		? (el.insertion_loss_db ?? SPLITTER_LOSS_DB[el.split_ratio] ?? 0)
		: null;

	const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onSelect();
		}
	};
	const handleToggleClick = (e: React.MouseEvent<SVGGElement>) => {
		e.stopPropagation();
		onToggle();
	};
	const handleToggleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			e.stopPropagation();
			onToggle();
		}
	};

	return (
		<NodeShell
			{...{ x, y, w, h, color, isSelected }}
			onClick={onSelect}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onKeyDown={handleKeyDown}
		>
			{/* Type label */}
			<text
				x={x + 12}
				y={y + 15}
				fontSize={7.5}
				fontWeight={700}
				fill={color}
				letterSpacing={1}
			>
				SPLITTER
			</text>

			{/* Fan icon */}
			<FanIcon cx={x + w - 24} cy={y + 10} color={color} />

			{/* Status badge */}
			{node.budget.margin !== null && (
				<circle
					cx={x + w - 11}
					cy={y + 11}
					r={4.5}
					fill={OPTICAL_STATUS_COLOR[node.budget.status]}
				/>
			)}

			{/* Code */}
			<text
				x={x + 12}
				y={y + 32}
				fontSize={10.5}
				fontWeight={600}
				fill="#e6e6e6"
			>
				{el.code ?? el.name}
			</text>

			{/* Ratio + own loss */}
			<text x={x + 12} y={y + 48} fontSize={8} fill="#6b7280">
				{el.split_ratio ?? "−"}
				{ownLoss !== null ? ` · −${ownLoss} dB` : ""}
			</text>

			{/* Expand/collapse indicator */}
			{hasChildren && (
				// biome-ignore lint/a11y/useSemanticElements: SVG group acting as an interactive disclosure control
				<g
					onClick={handleToggleClick}
					onKeyDown={handleToggleKeyDown}
					role="button"
					tabIndex={0}
					aria-label={
						isExpanded
							? `Contraer ${el.code ?? el.name ?? "splitter"}`
							: `Expandir ${el.code ?? el.name ?? "splitter"}`
					}
					aria-expanded={isExpanded}
					style={{ cursor: "pointer" }}
				>
					<rect
						x={x + w - 25}
						y={y + h - 22}
						width={22}
						height={16}
						rx={3}
						fill="rgba(255,255,255,0.04)"
						stroke="rgba(255,255,255,0.08)"
					/>
					<text
						x={x + w - 14}
						y={y + h - 11}
						fontSize={8.5}
						fill="#6b7280"
						textAnchor="middle"
					>
						{isExpanded ? "−" : `+${node.tree.children.length}`}
					</text>
				</g>
			)}

			{/* Loss bar */}
			<LossBar x={x + 12} y={y + h - 7} w={w - 20} node={node} />
		</NodeShell>
	);
}

// ── NAP node ──────────────────────────────────────────────────────────────────

function NAPNode({
	node,
	isSelected,
	onSelect,
	onMouseEnter,
	onMouseLeave,
}: NodeProps) {
	const el = node.tree.element;
	const color = TYPE_COLOR.nap;
	const { x, y, width: w, height: h } = node;

	const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onSelect();
		}
	};

	const used = el.ports_used ?? 0;
	const reserved = el.ports_reserved ?? 0;
	const total = el.total_ports ?? 0;
	const free = Math.max(0, total - used - reserved);
	const usedPct = total > 0 ? Math.round((used / total) * 100) : 0;
	const capacityText =
		total > 0 ? `${used}/${total} puertos · ${free} libres` : "Sin puertos";
	const usageText =
		total > 0
			? `${usedPct}% usado${reserved > 0 ? ` · ${reserved} reservado` : ""}`
			: "Capacidad no definida";
	const distKm =
		node.budget.cumulativeLengthMeters > 0
			? `${(node.budget.cumulativeLengthMeters / 1000).toFixed(2)} km`
			: null;
	const ownLoss =
		el.split_ratio && el.insertion_loss_db != null
			? `${el.insertion_loss_db} dB`
			: el.split_ratio
				? `${SPLITTER_LOSS_DB[el.split_ratio] ?? 0} dB`
				: null;

	return (
		<NodeShell
			{...{ x, y, w, h, color, isSelected }}
			onClick={onSelect}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onKeyDown={handleKeyDown}
		>
			{/* Type label */}
			<text
				x={x + 12}
				y={y + 15}
				fontSize={7.5}
				fontWeight={700}
				fill={color}
				letterSpacing={1}
			>
				NAP
			</text>

			{/* Status badge */}
			{node.budget.margin !== null && (
				<circle
					cx={x + w - 11}
					cy={y + 11}
					r={4.5}
					fill={OPTICAL_STATUS_COLOR[node.budget.status]}
				/>
			)}

			{/* Code */}
			<text
				x={x + 12}
				y={y + 32}
				fontSize={10.5}
				fontWeight={600}
				fill="#e6e6e6"
			>
				{truncateSvgText(el.code ?? el.name, 24)}
			</text>

			{/* Capacity bar */}
			<CapacityBar
				x={x + 12}
				y={y + 42}
				w={w - 20}
				total={el.total_ports}
				used={el.ports_used}
				reserved={el.ports_reserved}
			/>

			{/* Port count */}
			<text x={x + 12} y={y + 58} fontSize={7.5} fill="#8a8f95">
				{truncateSvgText(capacityText, 30)}
			</text>

			{/* Usage + distance */}
			<text x={x + 12} y={y + 72} fontSize={7.5} fill="#6b7280">
				{truncateSvgText(
					`${usageText}${ownLoss ? ` · ${ownLoss}` : ""}${
						distKm ? ` · ${distKm}` : ""
					}`,
					34,
				)}
			</text>

			{/* Loss bar */}
			<LossBar x={x + 12} y={y + h - 6} w={w - 20} node={node} />
		</NodeShell>
	);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export interface NodeProps {
	node: LayoutNode;
	isSelected: boolean;
	isExpanded: boolean;
	dimmed: boolean;
	onSelect: () => void;
	onToggle: () => void;
	onMouseEnter: () => void;
	onMouseLeave: () => void;
}

export function DiagramNode(props: NodeProps) {
	const type = props.node.tree.element.type;
	return (
		<g
			style={{
				opacity: props.dimmed ? 0.18 : 1,
				transition: "opacity 0.15s ease",
			}}
		>
			{type === "olt" && <OLTNode {...props} />}
			{type === "splitter" && <SplitterNode {...props} />}
			{type === "nap" && <NAPNode {...props} />}
		</g>
	);
}
