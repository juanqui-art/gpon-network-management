import { classifySignal } from "@/lib/types/gpon";

export interface SparkPoint {
	rx_power_dbm: number;
	recorded_at: string;
}

const SIGNAL_STROKE: Record<string, string> = {
	good: "var(--signal-good)",
	warning: "var(--signal-warning)",
	critical: "var(--signal-critical)",
	unknown: "var(--text-muted)",
};

interface RxSparklineProps {
	points: SparkPoint[];
	width?: number;
	height?: number;
}

export function RxSparkline({
	points,
	width = 72,
	height = 22,
}: RxSparklineProps) {
	const valid = points.filter((p) => p.rx_power_dbm !== null);
	if (valid.length < 2) {
		return (
			<span className="select-none font-mono text-[10px] text-muted-foreground">
				—
			</span>
		);
	}

	const values = valid.map((p) => p.rx_power_dbm);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 0.1;
	const pad = 2;

	const coords = valid.map((p, i) => ({
		x: (i / (valid.length - 1)) * width,
		y: height - pad - ((p.rx_power_dbm - min) / range) * (height - pad * 2),
	}));

	const d = coords
		.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
		.join(" ");

	const last = values.at(-1) ?? null;
	const signal = classifySignal(last);
	const stroke = SIGNAL_STROKE[signal] ?? SIGNAL_STROKE.unknown;

	// Gradient fill under the line
	const fillPath = `${d} L ${coords.at(-1)!.x.toFixed(1)} ${height} L 0 ${height} Z`;
	const gradId = `spark-${signal}`;

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden="true"
			style={{ overflow: "visible" }}
		>
			<defs>
				<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
					<stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
				</linearGradient>
			</defs>
			{/* Fill area */}
			<path d={fillPath} fill={`url(#${gradId})`} />
			{/* Line */}
			<path
				d={d}
				fill="none"
				stroke={stroke}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{/* Last point dot */}
			<circle cx={coords.at(-1)!.x} cy={coords.at(-1)!.y} r="2" fill={stroke} />
		</svg>
	);
}
