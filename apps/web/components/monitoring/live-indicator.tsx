"use client";

import { motion, useAnimation } from "motion/react";
import { useEffect } from "react";

interface LiveIndicatorProps {
	connected: boolean;
	lastEventAt: Date | null;
}

export function LiveIndicator({ connected, lastEventAt }: LiveIndicatorProps) {
	const controls = useAnimation();

	// Flash the dot briefly on every new event
	useEffect(() => {
		if (!lastEventAt) return;
		void controls.start({
			scale: [1, 1.8, 1],
			opacity: [1, 0.6, 1],
			transition: { duration: 0.35, ease: "easeOut" },
		});
	}, [lastEventAt, controls]);

	if (!connected) {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
				<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
				Conectando…
			</span>
		);
	}

	return (
		<span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
			<motion.span
				animate={controls}
				className="relative flex h-1.5 w-1.5 shrink-0"
			>
				{/* Ping ring */}
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
				<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
			</motion.span>
			LIVE
		</span>
	);
}
