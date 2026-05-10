import type { NetworkOntHealth } from "@/lib/types/gpon";
import { cn } from "@/lib/utils";

interface NetworkHealthSummaryProps {
	health: NetworkOntHealth;
	compact?: boolean;
}

interface Counter {
	label: string;
	value: number;
	tone: "good" | "bad" | "warning" | "neutral";
}

const TONE_CLASSES: Record<Counter["tone"], string> = {
	good: "text-emerald-600 dark:text-emerald-400",
	bad: "text-red-600 dark:text-red-400",
	warning: "text-amber-600 dark:text-amber-400",
	neutral: "text-muted-foreground",
};

const TONE_DOT: Record<Counter["tone"], string> = {
	good: "bg-emerald-500",
	bad: "bg-red-500",
	warning: "bg-amber-500",
	neutral: "bg-muted-foreground/50",
};

export function NetworkHealthSummary({
	health,
	compact = false,
}: NetworkHealthSummaryProps) {
	const offlineLike = health.offline + health.los + health.lof;

	const counters: Counter[] = [
		{ label: "Online", value: health.online, tone: "good" },
		{ label: "Offline", value: offlineLike, tone: "bad" },
		{ label: "Alertas señal", value: health.warning_signal, tone: "warning" },
	];

	if (health.unknown > 0) {
		counters.push({
			label: "Desconocido",
			value: health.unknown,
			tone: "neutral",
		});
	}

	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs",
				compact ? "text-xs" : "text-sm",
			)}
		>
			<span className="font-medium">
				{health.total} {health.total === 1 ? "ONT" : "ONTs"}
			</span>
			{counters.map((c) => (
				<span key={c.label} className="inline-flex items-center gap-1.5">
					<span
						className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[c.tone])}
						aria-hidden
					/>
					<span className={TONE_CLASSES[c.tone]}>
						{c.value} {c.label.toLowerCase()}
					</span>
				</span>
			))}
		</div>
	);
}
