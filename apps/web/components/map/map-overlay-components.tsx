"use client";

import { Compass, Crosshair, List, Minus, Plus, Ruler, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { FIBER_RENDER_COLOR } from "@/components/map/mapbox-shared-style";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { CABLE_LABEL, TYPE_COLOR } from "@/lib/map/palette";

const ELEMENT_LABELS = {
	nap: "NAP",
	olt: "OLT",
	splitter: "Splitter",
} as const;

export function MapStatChip({
	label,
	value,
	color,
	onClick,
	active = false,
}: {
	label: string;
	value: number | string;
	color: string;
	onClick?: () => void;
	active?: boolean;
}) {
	const inner = (
		<>
			<p className="font-mono text-xs font-bold" style={{ color }}>
				{value}
			</p>
			<p className="text-[10px] font-semibold uppercase text-fg-muted">
				{label}
			</p>
		</>
	);

	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				className={`rounded-md border px-2 py-1.5 text-center transition-colors hover:bg-tint/10 ${
					active
						? "border-tint/32 bg-tint/14"
						: "border-border-subtle bg-tint/5"
				}`}
			>
				{inner}
			</button>
		);
	}

	return (
		<div className="rounded-md border border-border-subtle bg-tint/5 px-2 py-1.5 text-center">
			{inner}
		</div>
	);
}

export function MapLegend({ compact = false }: { compact?: boolean }) {
	const wrapperClass = compact
		? "w-36 rounded-md border border-border bg-surface-panel/84 p-2 text-[10px] text-fg-soft shadow-2xl backdrop-blur-md"
		: "w-44 rounded-lg border border-border bg-surface-panel/90 p-3 text-xs text-fg-soft shadow-2xl backdrop-blur-md";
	const sectionLabelClass = compact
		? "mb-1 font-semibold uppercase tracking-widest text-[10px] text-fg-muted"
		: "mb-2 font-semibold uppercase tracking-widest text-fg-muted";
	const itemGapClass = compact
		? "mb-1 flex items-center gap-1.5"
		: "mb-1.5 flex items-center gap-2";
	// Expanded by default on desktop; on phones it would cover a third of the
	// map, so it starts collapsed. A user choice overrides the default.
	const isDesktop = useIsDesktop();
	const [userOpen, setUserOpen] = useState<boolean | null>(null);
	const open = userOpen ?? isDesktop;

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setUserOpen(true)}
				aria-expanded={false}
				className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-panel/90 px-3 text-xs text-fg-soft shadow-2xl backdrop-blur-md transition-colors hover:bg-surface-panel/98"
			>
				<List className="size-3.5" aria-hidden="true" />
				Leyenda
			</button>
		);
	}

	return (
		<div className={`relative ${wrapperClass}`}>
			<button
				type="button"
				onClick={() => setUserOpen(false)}
				aria-expanded={true}
				aria-label="Ocultar leyenda"
				className="absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-tint/10 hover:text-fg"
			>
				<X className="size-3.5" aria-hidden="true" />
			</button>
			<p className={sectionLabelClass}>Fibra</p>
			{(["feeder", "distribution", "drop"] as const).map((type) => (
				<div key={type} className={itemGapClass}>
					<span
						className={compact ? "h-px w-5 shrink-0" : "h-px w-7"}
						style={{
							borderTop:
								type === "feeder"
									? `2px solid ${FIBER_RENDER_COLOR[type]}`
									: `2px dashed ${FIBER_RENDER_COLOR[type]}`,
						}}
					/>
					<span>{CABLE_LABEL[type]}</span>
				</div>
			))}
			<p className={`${sectionLabelClass} mt-2`}>Elementos</p>
			{(["olt", "splitter", "nap"] as const).map((type) => (
				<div key={type} className={itemGapClass}>
					<span
						className={
							compact ? "size-2 rounded-full shrink-0" : "size-2.5 rounded-full"
						}
						style={{ backgroundColor: TYPE_COLOR[type] }}
					/>
					<span>{ELEMENT_LABELS[type]}</span>
				</div>
			))}
			<p className={`${sectionLabelClass} mt-2`}>Óptico</p>
			<div className={itemGapClass}>
				<span
					className={
						compact
							? "size-2.5 rounded-full border-2 border-warning"
							: "size-3 rounded-full border-2 border-warning"
					}
				/>
				<span>Margen ajustado</span>
			</div>
			<div className={itemGapClass}>
				<span
					className={
						compact
							? "size-2.5 rounded-full border-2 border-danger"
							: "size-3 rounded-full border-2 border-danger"
					}
				/>
				<span>Deficiente</span>
			</div>
		</div>
	);
}

export function MapControls({
	onFit,
	onResetNorth,
	onZoomIn,
	onZoomOut,
	compact = false,
	measuring = false,
	onToggleMeasure,
}: {
	onFit: () => void;
	onResetNorth: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	compact?: boolean;
	/** When provided, shows a ruler toggle (Medir, shortcut M). */
	measuring?: boolean;
	onToggleMeasure?: () => void;
}) {
	const wrapperClass = compact
		? "flex flex-col overflow-hidden rounded-md border border-border bg-surface-panel/94 shadow-xl backdrop-blur-md"
		: "flex overflow-hidden rounded-lg border border-border bg-surface-panel/92 shadow-2xl backdrop-blur-md";

	return (
		<div className={wrapperClass}>
			<IconControl label="Acercar" onClick={onZoomIn} compact={compact}>
				<Plus className={compact ? "size-3.5" : "size-4"} />
			</IconControl>
			<IconControl label="Alejar" onClick={onZoomOut} compact={compact}>
				<Minus className={compact ? "size-3.5" : "size-4"} />
			</IconControl>
			<IconControl label="Centrar red" onClick={onFit} compact={compact}>
				<Crosshair className={compact ? "size-3.5" : "size-4"} />
			</IconControl>
			<IconControl label="Reset norte" onClick={onResetNorth} compact={compact}>
				<Compass className={compact ? "size-3.5" : "size-4"} />
			</IconControl>
			{onToggleMeasure && (
				<IconControl
					label={measuring ? "Terminar medición (M)" : "Medir distancia (M)"}
					onClick={onToggleMeasure}
					compact={compact}
					pressed={measuring}
				>
					<Ruler className={compact ? "size-3.5" : "size-4"} />
				</IconControl>
			)}
		</div>
	);
}

function IconControl({
	children,
	label,
	onClick,
	compact = false,
	pressed,
}: {
	children: ReactNode;
	label: string;
	onClick: () => void;
	compact?: boolean;
	/** Toggle controls only. */
	pressed?: boolean;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={pressed}
			title={label}
			onClick={onClick}
			className={`grid place-items-center border-r border-border-subtle transition-colors last:border-r-0 hover:bg-white/10 ${pressed ? "bg-info/16 text-info-fg" : "text-fg-soft"} ${
				compact
					? "size-8 border-r-0 border-b last:border-b-0 last:border-r-0"
					: "size-9"
			}`}
		>
			{children}
		</button>
	);
}
