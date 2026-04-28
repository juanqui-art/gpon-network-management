"use client";

import type { EquipmentMapItem } from "./types";

interface NapCapacityProps {
	element: EquipmentMapItem;
	size?: "sm" | "md";
}

export function NapCapacity({ element, size = "md" }: NapCapacityProps) {
	// Only show capacity for NAPs
	if (!("type" in element) || element.type !== "nap" || !element.total_ports) {
		return null;
	}

	const total = element.total_ports;
	const used = element.ports_used ?? 0;
	const reserved = element.ports_reserved ?? 0;
	const available = Math.max(0, total - used - reserved);
	const percentUsed = (used / total) * 100;
	const percentReserved = (reserved / total) * 100;

	// Color logic
	const statusColor = (() => {
		if (percentUsed >= 90) return { bg: "#fb4d6d", label: "Saturada", key: "critical" };
		if (percentUsed >= 70) return { bg: "#f59e0b", label: "Capacidad limitada", key: "warning" };
		return { bg: "#34d399", label: "Disponible", key: "good" };
	})();

	const sizeClass = size === "sm" ? "text-xs" : "text-sm";
	const barHeight = size === "sm" ? "h-2" : "h-3";

	return (
		<div className="space-y-2">
			{/* Header */}
			<div className="flex items-center justify-between">
				<span className={`${sizeClass} font-semibold text-[#e6e6e6]`}>Capacidad</span>
				<span className={`${sizeClass} text-[#a4a4a4]`}>
					{used}/{total} puertos
				</span>
			</div>

			{/* Bar */}
			<div className={`${barHeight} w-full bg-[rgba(164,164,164,0.2)] rounded-full overflow-hidden`}>
				<div className="flex h-full">
					{/* Used */}
					{used > 0 && (
						<div
							className="transition-all"
							style={{
								width: `${percentUsed}%`,
								backgroundColor: statusColor.bg,
							}}
						/>
					)}

					{/* Reserved */}
					{reserved > 0 && (
						<div
							className="transition-all"
							style={{
								width: `${percentReserved}%`,
								backgroundColor: "#a78bfa",
								opacity: 0.6,
							}}
						/>
					)}
				</div>
			</div>

			{/* Labels */}
			<div className="flex items-center justify-between">
				<div className="flex gap-3 text-[10px] text-[#a4a4a4]">
					<div className="flex items-center gap-1">
						<span
							className="w-2 h-2 rounded-full"
							style={{ backgroundColor: statusColor.bg }}
						/>
						Usados: {used}
					</div>
					{reserved > 0 && (
						<div className="flex items-center gap-1">
							<span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#a78bfa", opacity: 0.6 }} />
							Reservados: {reserved}
						</div>
					)}
				</div>
				<div className="text-[10px] font-semibold text-[#d7d7d7]">
					{available} disponible{available !== 1 ? "s" : ""}
				</div>
			</div>

			{/* Status message */}
			<div
				className="px-2 py-1.5 rounded text-[10px] font-semibold"
				style={{
					backgroundColor: `${statusColor.bg}22`,
					color: statusColor.bg,
					border: `1px solid ${statusColor.bg}44`,
				}}
			>
				⚠ {statusColor.label}
			</div>
		</div>
	);
}
