import { classifySignal, type SignalClassification } from "@/lib/types/gpon";
import { cn } from "@/lib/utils";

interface RxPowerCellProps {
	rxPowerDbm: number | null;
}

const SIGNAL_COLOR: Record<SignalClassification, string> = {
	good: "text-success",
	warning: "text-warning-fg",
	critical: "text-danger-fg",
	unknown: "text-muted-foreground",
};

const SIGNAL_BG: Record<SignalClassification, string> = {
	good: "bg-emerald-500",
	warning: "bg-amber-500",
	critical: "bg-red-500",
	unknown: "bg-muted-foreground/40",
};

export function RxPowerCell({ rxPowerDbm }: RxPowerCellProps) {
	const signal = classifySignal(rxPowerDbm);

	if (rxPowerDbm === null) {
		return <span className="text-muted-foreground">—</span>;
	}

	return (
		<span className="inline-flex items-center gap-2">
			<span
				className={cn("h-1.5 w-1.5 rounded-full", SIGNAL_BG[signal])}
				aria-hidden
			/>
			<span className={cn("font-mono tabular-nums", SIGNAL_COLOR[signal])}>
				{rxPowerDbm.toFixed(2)} dBm
			</span>
		</span>
	);
}
