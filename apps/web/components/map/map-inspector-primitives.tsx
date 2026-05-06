import type { ReactNode } from "react";

type InspectorValue = number | string | null | undefined;

export function InspectorSection({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	return (
		<section className="space-y-2">
			<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777879]">
				{title}
			</h3>
			<div className="space-y-2">{children}</div>
		</section>
	);
}

export function InspectorRow({
	label,
	value,
}: {
	label: string;
	value: InspectorValue;
}) {
	return (
		<div className="flex items-start justify-between gap-3 rounded-md border border-[rgba(164,164,164,0.08)] bg-[rgba(164,164,164,0.04)] px-2.5 py-2 text-xs">
			<span className="shrink-0 text-[#777879]">{label}</span>
			<span className="min-w-0 truncate text-right font-medium text-[#e6e6e6]">
				{formatInspectorValue(value)}
			</span>
		</div>
	);
}

export function DetailSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<div className="border-t border-[rgba(164,164,164,0.12)] pt-3">
			<p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{title}
			</p>
			<div className="space-y-2">{children}</div>
		</div>
	);
}

export function RouteMetric({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-md border border-[rgba(164,164,164,0.1)] bg-[rgba(27,28,29,0.42)] px-2 py-2">
			<p className="text-[10px] uppercase tracking-wider text-[#777879]">
				{label}
			</p>
			<p className="mt-1 truncate font-mono text-[12px] font-semibold text-[#e6e6e6]">
				{value}
			</p>
		</div>
	);
}

export function Property({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-[#777879]">{label}</span>
			<span className="truncate text-right font-mono text-[#d7d7d7]">
				{value}
			</span>
		</div>
	);
}

export function TextBlock({ label, value }: { label: string; value: string }) {
	return (
		<div className="border-t border-[rgba(164,164,164,0.12)] pt-3">
			<p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#777879]">
				{label}
			</p>
			<p className="leading-relaxed text-[#d7d7d7]">{value}</p>
		</div>
	);
}

function formatInspectorValue(value: InspectorValue) {
	if (value === null || value === undefined || value === "") return "-";
	if (typeof value === "number")
		return Number.isInteger(value) ? value : value.toFixed(2);
	return value;
}
