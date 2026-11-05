import type { ReactNode } from "react";

/**
 * Single set of building blocks for every map inspector (/map and the
 * editor). Feature-level blocks built on these live in inspector-sections.tsx.
 */

export type InspectorValue = ReactNode | number | string | null | undefined;

/** Titled group of rows. Sections after the first get a divider. */
export function InspectorSection({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	return (
		<section className="space-y-2 border-t border-border-subtle pt-3 first:border-t-0 first:pt-0">
			<h3 className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted">
				{title}
			</h3>
			<div className="space-y-1.5">{children}</div>
		</section>
	);
}

/** Label / value pair. Empty values render as an em dash. */
export function InspectorRow({
	label,
	value,
}: {
	label: string;
	value: InspectorValue;
}) {
	return (
		<div className="flex items-start justify-between gap-3 text-xs">
			<span className="shrink-0 text-fg-muted">{label}</span>
			<span className="min-w-0 truncate text-right font-medium tabular-nums text-fg-soft">
				{formatInspectorValue(value)}
			</span>
		</div>
	);
}

/** Free text (notes, references) that must wrap instead of truncating. */
export function InspectorText({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="space-y-1 text-xs">
			<p className="text-fg-muted">{label}</p>
			<p className="leading-relaxed whitespace-pre-line text-fg-soft">
				{value}
			</p>
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

function formatInspectorValue(value: InspectorValue): ReactNode {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "number")
		return Number.isInteger(value) ? value : value.toFixed(2);
	return value;
}
