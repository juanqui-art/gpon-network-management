"use client";

import { MotionConfig } from "motion/react";

/** Every motion animation honours the OS "reduce motion" setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
	return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
