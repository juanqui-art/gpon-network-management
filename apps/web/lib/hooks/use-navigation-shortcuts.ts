"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { isEditableTarget } from "@/lib/dom/is-editable-target";
import { requestNavigation } from "@/lib/navigation/leave-guard";

const CHORD_WINDOW_MS = 750;

const CHORD_ROUTES: Record<string, string> = {
	n: "/networks",
	m: "/map",
	s: "/monitoring",
	d: "/dashboard",
};

// Module-level so other single-key handlers (editor modes) can tell that the
// current keystroke is the second half of a `g → x` chord and stand down.
let chordStartedAt: number | null = null;

export function isNavigationChordPending(now = Date.now()): boolean {
	return chordStartedAt !== null && now - chordStartedAt < CHORD_WINDOW_MS;
}

/**
 * Global navigation shortcuts:
 *   g → n   go to /networks
 *   g → m   go to /map
 *   g → s   go to /monitoring
 *   g → d   go to /dashboard
 *   ?       toggle shortcuts overlay (dispatches 'gpon:shortcuts' event)
 *
 * Navigation goes through the unsaved-changes guard.
 */
export function useNavigationShortcuts() {
	const router = useRouter();

	const toggle = useCallback(() => {
		window.dispatchEvent(new Event("gpon:shortcuts"));
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			if (isEditableTarget(event.target)) return;

			const key = event.key;

			if (key === "?") {
				event.preventDefault();
				toggle();
				return;
			}

			if (key === "g") {
				event.preventDefault();
				chordStartedAt = Date.now();
				return;
			}

			if (isNavigationChordPending()) {
				// Defer the reset so every keydown listener sees the chord as
				// pending for this same event, regardless of registration order.
				setTimeout(() => {
					chordStartedAt = null;
				}, 0);
				const route = CHORD_ROUTES[key.toLowerCase()];
				if (route) {
					event.preventDefault();
					void requestNavigation(route, () => router.push(route));
				}
				return;
			}

			chordStartedAt = null;
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [router, toggle]);
}
