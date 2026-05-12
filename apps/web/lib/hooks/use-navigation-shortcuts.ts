"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName.toLowerCase();
	return (
		target.isContentEditable ||
		tag === "input" ||
		tag === "textarea" ||
		tag === "select"
	);
}

const CHORD_ROUTES: Record<string, string> = {
	n: "/networks",
	m: "/map",
	s: "/monitoring",
	d: "/dashboard",
};

/**
 * Global navigation shortcuts:
 *   g → n   go to /networks
 *   g → m   go to /map
 *   g → s   go to /monitoring
 *   g → d   go to /dashboard
 *   ?       toggle shortcuts overlay (dispatches 'gpon:shortcuts' event)
 *
 * Uses a 750ms chord window: press g, then the second key within 750ms.
 */
export function useNavigationShortcuts() {
	const router = useRouter();
	const gPressedAt = useRef<number | null>(null);

	const toggle = useCallback(() => {
		window.dispatchEvent(new Event("gpon:shortcuts"));
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			if (isEditableTarget(event.target)) return;

			const key = event.key;

			// ? → shortcuts overlay
			if (key === "?") {
				event.preventDefault();
				toggle();
				return;
			}

			const now = Date.now();

			// Start chord on 'g'
			if (key === "g") {
				event.preventDefault();
				gPressedAt.current = now;
				return;
			}

			// Complete chord if 'g' was pressed within 750ms
			if (gPressedAt.current && now - gPressedAt.current < 750) {
				const route = CHORD_ROUTES[key.toLowerCase()];
				if (route) {
					event.preventDefault();
					gPressedAt.current = null;
					router.push(route);
					return;
				}
			}

			gPressedAt.current = null;
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [router, toggle]);
}
