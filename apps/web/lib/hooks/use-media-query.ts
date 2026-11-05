"use client";

import { useSyncExternalStore } from "react";

/** Subscribes to a CSS media query. Returns `serverValue` during SSR. */
export function useMediaQuery(query: string, serverValue = false): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const mediaQuery = window.matchMedia(query);
			mediaQuery.addEventListener("change", onChange);
			return () => mediaQuery.removeEventListener("change", onChange);
		},
		() => window.matchMedia(query).matches,
		() => serverValue,
	);
}

/** Tailwind `md` breakpoint (768px) — panels dock beside the map from here. */
export function useIsDesktop(): boolean {
	return useMediaQuery("(min-width: 768px)");
}

/** Primary input is a finger (no hover, no right-click). */
export function useIsCoarsePointer(): boolean {
	return useMediaQuery("(pointer: coarse)");
}
