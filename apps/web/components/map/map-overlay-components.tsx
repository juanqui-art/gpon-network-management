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

export function MapLegend() {
	return (
		<div className="w-44 rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.9)] p-3 text-xs text-[#d7d7d7] shadow-2xl backdrop-blur-md">
			<p className="mb-2 font-semibold uppercase tracking-widest text-[#777879]">
				Fibra
			</p>
			{(["feeder", "distribution", "drop"] as const).map((type) => (
				<div key={type} className="mb-1.5 flex items-center gap-2">
					<span
						className="h-px w-7"
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
			<p className="mb-2 mt-3 font-semibold uppercase tracking-widest text-[#777879]">
				Elementos
			</p>
			{(["olt", "splitter", "nap"] as const).map((type) => (
				<div key={type} className="mb-1.5 flex items-center gap-2">
					<span
						className="size-2.5 rounded-full"
						style={{ backgroundColor: TYPE_COLOR[type] }}
					/>
					<span>{ELEMENT_LABELS[type]}</span>
				</div>
			))}
		</div>
	);
}

export function MapControls({
	onFit,
	onResetNorth,
	onZoomIn,
	onZoomOut,
}: {
	onFit: () => void;
	onResetNorth: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
}) {
	return (
		<div className="flex overflow-hidden rounded-lg border border-[rgba(164,164,164,0.18)] bg-[rgba(34,35,36,0.92)] shadow-2xl backdrop-blur-md">
			<IconControl label="Acercar" onClick={onZoomIn}>
				<Plus className="size-4" />
			</IconControl>
			<IconControl label="Alejar" onClick={onZoomOut}>
				<Minus className="size-4" />
			</IconControl>
			<IconControl label="Centrar red" onClick={onFit}>
				<Crosshair className="size-4" />
			</IconControl>
			<IconControl label="Reset norte" onClick={onResetNorth}>
				<Compass className="size-4" />
			</IconControl>
		</div>
	);
}

function IconControl({
	children,
	label,
	onClick,
}: {
	children: ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			className="grid size-9 place-items-center border-r border-[rgba(164,164,164,0.12)] text-[#d7d7d7] transition-colors last:border-r-0 hover:bg-white/10"
		>
			{children}
		</button>
	);
}
