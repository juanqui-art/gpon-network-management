import type { OntHealthSummary } from "@/lib/types/gpon";

interface KpiStripProps {
	totals: OntHealthSummary;
	oltCount: number;
}

interface KpiChip {
	label: string;
	value: number;
	sub?: string;
	dotClass: string;
	valueClass: string;
}

export function MonitoringKpiStrip({ totals, oltCount }: KpiStripProps) {
	const offlineLike = totals.offline + totals.los + totals.lof;
	const healthy =
		totals.total > 0
			? Math.round(
					((totals.online - totals.warning_signal) / totals.total) * 100,
				)
			: 0;

	const chips: KpiChip[] = [
		{
			label: "Total ONTs",
			value: totals.total,
			sub: `${oltCount} OLT${oltCount !== 1 ? "s" : ""}`,
			dotClass: "bg-muted-foreground/50",
			valueClass: "text-foreground",
		},
		{
			label: "Online",
			value: totals.online,
			sub:
				totals.total > 0
					? `${Math.round((totals.online / totals.total) * 100)}%`
					: "—",
			dotClass: "bg-emerald-500",
			valueClass: "text-emerald-400",
		},
		{
			label: "Offline / LOS",
			value: offlineLike,
			sub: offlineLike > 0 ? "requieren atención" : "sin incidentes",
			dotClass: offlineLike > 0 ? "bg-red-500" : "bg-muted-foreground/30",
			valueClass: offlineLike > 0 ? "text-red-400" : "text-muted-foreground",
		},
		{
			label: "Señal degradada",
			value: totals.warning_signal,
			sub: totals.total > 0 ? `${healthy}% saludables` : "—",
			dotClass:
				totals.warning_signal > 0 ? "bg-amber-500" : "bg-muted-foreground/30",
			valueClass:
				totals.warning_signal > 0 ? "text-amber-400" : "text-muted-foreground",
		},
	];

	return (
		<div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
			{chips.map((chip) => (
				<div
					key={chip.label}
					className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3 shadow-(--shadow-sm)"
				>
					<div className="flex items-center gap-1.5">
						<span
							className={`h-1.5 w-1.5 shrink-0 rounded-full ${chip.dotClass}`}
							aria-hidden
						/>
						<span className="text-[11px] font-medium text-muted-foreground">
							{chip.label}
						</span>
					</div>
					<p
						className={`text-2xl font-semibold tabular-nums ${chip.valueClass}`}
					>
						{chip.value}
					</p>
					{chip.sub && (
						<p className="text-[10px] text-muted-foreground">{chip.sub}</p>
					)}
				</div>
			))}
		</div>
	);
}
