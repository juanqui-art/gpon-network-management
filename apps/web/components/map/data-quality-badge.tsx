"use client";

import {
	DATA_QUALITY_COLOR,
	DATA_QUALITY_LABEL,
	type DataQualityLevel,
} from "@/lib/map/palette";

interface DataQualityBadgeProps {
	quality: DataQualityLevel;
	size?: "sm" | "md";
}

export function DataQualityBadge({
	quality,
	size = "md",
}: DataQualityBadgeProps) {
	const color = DATA_QUALITY_COLOR[quality];
	const label = DATA_QUALITY_LABEL[quality];
	const sizeClass = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";

	return (
		<div
			className={`inline-flex items-center gap-1.5 rounded-full ${sizeClass}`}
			style={{
				backgroundColor: `${color}22`,
				color: color,
				border: `1px solid ${color}44`,
			}}
		>
			<span
				className="w-2 h-2 rounded-full"
				style={{ backgroundColor: color }}
			/>
			<span className="font-medium">{label}</span>
		</div>
	);
}
