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
			<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
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
		<div className="flex items-start justify-between gap-3 rounded-md border border-tint/8 bg-tint/4 px-2.5 py-2 text-xs">
			<span className="shrink-0 text-fg-muted">{label}</span>
			<span className="min-w-0 truncate text-right font-medium text-fg">
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
		<div className="border-t border-border-subtle pt-3">
			<p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
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
		<div className="rounded-md border border-border-subtle bg-surface/42 px-2 py-2">
			<p className="text-[10px] uppercase tracking-wider text-fg-muted">
				{label}
			</p>
			<p className="mt-1 truncate font-mono text-[12px] font-semibold text-fg">
				{value}
			</p>
		</div>
	);
}

export function Property({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-fg-muted">{label}</span>
			<span className="truncate text-right font-mono text-fg-soft">
				{value}
			</span>
		</div>
	);
}

export function TextBlock({ label, value }: { label: string; value: string }) {
	return (
		<div className="border-t border-border-subtle pt-3">
			<p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
				{label}
			</p>
			<p className="leading-relaxed text-fg-soft">{value}</p>
		</div>
	);
}

function formatInspectorValue(value: InspectorValue) {
	if (value === null || value === undefined || value === "") return "-";
	if (typeof value === "number")
		return Number.isInteger(value) ? value : value.toFixed(2);
	return value;
}
