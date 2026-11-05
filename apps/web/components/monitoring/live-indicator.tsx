"use client";

import { RotateCw } from "lucide-react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import type { RealtimeStatus } from "@/lib/hooks/use-ont-realtime";
import { formatRelative, isStale } from "@/lib/monitoring/freshness";
import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
	status: RealtimeStatus;
	/** When the collector last wrote data (max `updated_at`). */
	dataUpdatedAt: string | null;
	lastEventAt: Date | null;
	/** Ticking clock from the page; null before hydration. */
	nowMs: number | null;
	onRetry?: () => void;
}

type Tone = "live" | "warn" | "down" | "idle";

const TONE_CLASS: Record<Tone, { chip: string; dot: string }> = {
	live: {
		chip: "border-success/25 bg-success/10 text-success",
		dot: "bg-success",
	},
	warn: {
		chip: "border-warning/30 bg-warning/10 text-warning-fg",
		dot: "bg-warning",
	},
	down: {
		chip: "border-danger/30 bg-danger/10 text-danger-fg",
		dot: "bg-danger",
	},
	idle: {
		chip: "border-border bg-tint/6 text-fg-secondary",
		dot: "bg-fg-muted",
	},
};

/**
 * Realtime status that never presents old data as live: the websocket can be
 * connected while the collector is down, so freshness comes from the data.
 */
export function LiveIndicator({
	status,
	dataUpdatedAt,
	lastEventAt,
	nowMs,
	onRetry,
}: LiveIndicatorProps) {
	const controls = useAnimation();
	const reduceMotion = useReducedMotion();
	const age = formatRelative(dataUpdatedAt, nowMs);
	const stale = isStale(dataUpdatedAt, nowMs);

	useEffect(() => {
		if (!lastEventAt || reduceMotion) return;
		void controls.start({
			scale: [1, 1.8, 1],
			opacity: [1, 0.6, 1],
			transition: { duration: 0.35, ease: "easeOut" },
		});
	}, [lastEventAt, controls, reduceMotion]);

	let tone: Tone;
	let label: string;
	let detail: string | null;
	if (status === "connecting") {
		tone = stale ? "warn" : "idle";
		label = "Conectando…";
		detail = dataUpdatedAt ? `datos de ${age}` : null;
	} else if (status === "reconnecting") {
		tone = "warn";
		label = "Reconectando…";
		detail = dataUpdatedAt ? `último dato ${age}` : null;
	} else if (status === "offline") {
		tone = "down";
		label = "Sin conexión en vivo";
		detail = dataUpdatedAt ? `último dato ${age}` : null;
	} else if (!dataUpdatedAt) {
		tone = "idle";
		label = "En vivo";
		detail = "sin lecturas todavía";
	} else if (stale) {
		tone = "warn";
		label = "Sin datos nuevos";
		detail = `último dato ${age}`;
	} else {
		tone = "live";
		label = "En vivo";
		detail = `actualizado ${age}`;
	}

	const pulsing = tone === "live" && !reduceMotion;
	const title =
		tone === "warn" && status === "live"
			? "El canal está conectado pero el colector no escribe hace más de 3 ciclos. Revisa el colector SNMP."
			: tone === "down"
				? "La suscripción en tiempo real se cerró. Los datos en pantalla no se actualizan."
				: undefined;

	return (
		<div className="flex flex-wrap items-center gap-2 text-xs">
			<span
				role="status"
				aria-live="polite"
				title={title}
				className={cn(
					"inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium",
					TONE_CLASS[tone].chip,
				)}
			>
				<motion.span
					animate={controls}
					className="relative flex size-1.5 shrink-0"
					aria-hidden="true"
				>
					{pulsing && (
						<span
							className={cn(
								"absolute inline-flex size-full animate-ping rounded-full opacity-60",
								TONE_CLASS[tone].dot,
							)}
						/>
					)}
					<span
						className={cn(
							"relative inline-flex size-1.5 rounded-full",
							TONE_CLASS[tone].dot,
						)}
					/>
				</motion.span>
				{label}
				{detail && <span className="font-normal opacity-80">· {detail}</span>}
			</span>
			{status === "offline" && onRetry && (
				<button
					type="button"
					onClick={onRetry}
					className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-fg-secondary transition-colors hover:bg-tint/10 hover:text-fg"
				>
					<RotateCw className="size-3.5" aria-hidden="true" />
					Reintentar
				</button>
			)}
		</div>
	);
}
