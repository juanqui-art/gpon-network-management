import { Compass, Crosshair, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { FIBER_RENDER_COLOR } from "@/components/map/mapbox-shared-style";
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
			<p className="text-[9px] font-semibold uppercase text-[#777879]">
				{label}
			</p>
		</>
	);

	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				className={`rounded-md border px-2 py-1.5 text-center transition-colors hover:bg-[rgba(164,164,164,0.1)] ${
					active
						? "border-[rgba(164,164,164,0.32)] bg-[rgba(164,164,164,0.14)]"
						: "border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)]"
				}`}
			>
				{inner}
			</button>
		);
	}

	return (
		<div className="rounded-md border border-[rgba(164,164,164,0.12)] bg-[rgba(164,164,164,0.05)] px-2 py-1.5 text-center">
			{inner}
		</div>
	);
}

export function MapLegend({ compact = false }: { compact?: boolean }) {
	const wrapperClass = compact
		? "w-36 rounded-md border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.84)] p-2 text-[10px] text-[#d7d7d7] shadow-2xl backdrop-blur-md"
		: "w-44 rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.9)] p-3 text-xs text-[#d7d7d7] shadow-2xl backdrop-blur-md";
	const sectionLabelClass = compact
		? "mb-1 font-semibold uppercase tracking-widest text-[9px] text-[#777879]"
		: "mb-2 font-semibold uppercase tracking-widest text-[#777879]";
	const itemGapClass = compact
		? "mb-1 flex items-center gap-1.5"
		: "mb-1.5 flex items-center gap-2";

	return (
		<div className={wrapperClass}>
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
							? "size-2.5 rounded-full border-2 border-[#f59e0b]"
							: "size-3 rounded-full border-2 border-[#f59e0b]"
					}
				/>
				<span>Margen ajustado</span>
			</div>
			<div className={itemGapClass}>
				<span
					className={
						compact
							? "size-2.5 rounded-full border-2 border-[#fb4d6d]"
							: "size-3 rounded-full border-2 border-[#fb4d6d]"
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
}: {
	onFit: () => void;
	onResetNorth: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	compact?: boolean;
}) {
	const wrapperClass = compact
		? "flex flex-col overflow-hidden rounded-md border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.94)] shadow-xl backdrop-blur-md"
		: "flex overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md";

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
		</div>
	);
}

function IconControl({
	children,
	label,
	onClick,
	compact = false,
}: {
	children: ReactNode;
	label: string;
	onClick: () => void;
	compact?: boolean;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			className={`grid place-items-center border-r border-[rgba(164,164,164,0.12)] text-[#d7d7d7] transition-colors last:border-r-0 hover:bg-white/10 ${
				compact
					? "size-8 border-r-0 border-b last:border-b-0 last:border-r-0"
					: "size-9"
			}`}
		>
			{children}
		</button>
	);
}
