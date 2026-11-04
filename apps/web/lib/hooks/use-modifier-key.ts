"use client";

import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/** Primary shortcut modifier label: "⌘" on Apple platforms, "Ctrl" elsewhere. */
export function useModifierKey(): "⌘" | "Ctrl" {
	return useSyncExternalStore(
		subscribeNoop,
		() =>
			/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
				? "⌘"
				: "Ctrl",
		() => "Ctrl",
	);
}
