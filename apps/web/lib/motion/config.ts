import { useReducedMotion } from "motion/react";

export const SPRING_SNAPPY = {
	type: "spring",
	stiffness: 420,
	damping: 36,
} as const;
export const SPRING_GENTLE = {
	type: "spring",
	stiffness: 280,
	damping: 32,
} as const;
export const EASE_OUT = { duration: 0.18, ease: [0.22, 1, 0.36, 1] } as const;

/** Slide-in from right (inspector panel) */
export const INSPECTOR_VARIANTS = {
	hidden: { x: 24, opacity: 0, scale: 0.98 },
	visible: { x: 0, opacity: 1, scale: 1 },
	exit: { x: 16, opacity: 0, scale: 0.98 },
} as const;

/** Fade crossfade (mode labels, status text) */
export const CROSSFADE_VARIANTS = {
	hidden: { opacity: 0, y: -4 },
	visible: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: 4 },
} as const;

/** Fade-in only (toasts, overlays) */
export const FADE_VARIANTS = {
	hidden: { opacity: 0, y: 6 },
	visible: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -4 },
} as const;

export { useReducedMotion };
