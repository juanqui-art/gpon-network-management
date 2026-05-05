"use client";

import {
	calculateOpticalBudget,
	type FiberStandard,
	OPTICAL_STATUS_BG,
	OPTICAL_STATUS_COLOR,
	type PonClass,
} from "@/lib/gpon/optical-budget";
import type { ConnectionMapItem } from "./types";

interface OpticalBudgetPanelProps {
	route: ConnectionMapItem;
	splitterRatio?: string | null;
	oltPonClass?: PonClass | null;
}

export function OpticalBudgetPanel({
	route,
	splitterRatio,
	oltPonClass,
}: OpticalBudgetPanelProps) {
	const result = calculateOpticalBudget({
		lengthMeters: route.length_meters,
		attenuationDbPerKm: route.attenuation_db_per_km ?? null,
		fiberType: route.fiber_type as FiberStandard | null,
		splitRatio: splitterRatio ?? null,
		connectorLossDb: route.connector_loss_db ?? null,
		totalSpliceLossDb: route.splice_loss_db ?? null,
		ponClass: oltPonClass ?? null,
	});

	const accentColor = OPTICAL_STATUS_COLOR[result.status];
	const bg = OPTICAL_STATUS_BG[result.status];

	return (
		<div
			className="rounded-lg border p-3 space-y-2.5"
			style={{ borderColor: `${accentColor}44`, background: bg }}
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
					Presupuesto óptico
				</span>
				<div
					className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
					style={{ background: `${accentColor}22`, color: accentColor }}
				>
					<span
						className="w-2 h-2 rounded-full"
						style={{ background: accentColor }}
					/>
					<span className="text-[10px] font-semibold">
						{result.statusLabel}
					</span>
				</div>
			</div>

			{/* Loss breakdown */}
			<div className="space-y-1">
				<BudgetRow
					label="Fibra"
					value={`${result.fiberLoss.toFixed(2)} dB`}
					sub={
						route.length_meters
							? `${(route.length_meters / 1000).toFixed(2)} km ×1.02`
							: "—"
					}
				/>
				<BudgetRow
					label="Splitter"
					value={`${result.splitterLoss.toFixed(1)} dB`}
					sub={splitterRatio ?? "sin ratio"}
				/>
				<BudgetRow
					label="Conectores"
					value={`${result.connectorLoss.toFixed(2)} dB`}
					sub={route.connector_loss_db != null ? "dato BD" : "2 × 0.5 dB"}
				/>
				<BudgetRow
					label="Empalmes"
					value={`${result.spliceLoss.toFixed(2)} dB`}
					sub={route.splice_loss_db != null ? "dato BD" : "0.1 dB/evento"}
				/>
				<BudgetRow
					label="Reserva"
					value={`${result.safetyMargin.toFixed(2)} dB`}
					sub="margen diseño"
				/>
				<div className="h-px bg-[rgba(164,164,164,0.14)]" />
				<BudgetRow
					label="Total"
					value={`${result.totalLoss.toFixed(2)} dB`}
					bold
				/>
				{result.margin !== null && (
					<BudgetRow
						label="Margen"
						value={`${result.margin.toFixed(2)} dB`}
						bold
						color={accentColor}
					/>
				)}
			</div>

			{/* Warnings */}
			{result.warnings.length > 0 && (
				<div className="space-y-1">
					{result.warnings.map((w) => (
						<p
							key={w}
							className="text-[10px] text-[#f59e0b] flex items-start gap-1"
						>
							<span className="shrink-0">⚠</span>
							{w}
						</p>
					))}
				</div>
			)}

			{result.status === "gray" && (
				<p className="text-[10px] text-[#777879]">
					Define la clase óptica del OLT para calcular el margen de la ruta.
				</p>
			)}
		</div>
	);
}

function BudgetRow({
	label,
	value,
	sub,
	bold,
	color,
}: {
	label: string;
	value: string;
	sub?: string;
	bold?: boolean;
	color?: string;
}) {
	return (
		<div className="flex items-baseline justify-between">
			<span
				className={`text-[11px] ${bold ? "font-semibold text-[#d7d7d7]" : "text-[#a4a4a4]"}`}
			>
				{label}
				{sub && (
					<span className="ml-1.5 text-[10px] text-[#5c5d5f]">{sub}</span>
				)}
			</span>
			<span
				className={`font-mono text-[11px] ${bold ? "font-bold" : ""}`}
				style={{ color: color ?? (bold ? "#e6e6e6" : "#d7d7d7") }}
			>
				{value}
			</span>
		</div>
	);
}
