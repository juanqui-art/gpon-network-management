"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
	clearLeaveGuard,
	isLeaveBlocked,
	type LeaveGuard,
	requestNavigation,
	setLeaveGuard,
} from "@/lib/navigation/leave-guard";

interface Options {
	enabled: boolean;
	message: string;
	/** Navigation inside this path prefix keeps the session (no prompt). */
	allowPathPrefix?: string;
	onSave?: () => Promise<boolean>;
	onLeave?: () => void;
}

/**
 * Protects dirty editor state from:
 *  - tab close / reload / external navigation (beforeunload)
 *  - in-app <a>/<Link> clicks (intercepted in capture phase on window)
 *  - router.push calls that go through `requestNavigation`
 *
 * Browser back/forward is not intercepted (App Router exposes no blocking API).
 */
export function useUnsavedChangesGuard({
	enabled,
	message,
	allowPathPrefix,
	onSave,
	onLeave,
}: Options) {
	const router = useRouter();
	const callbacks = useRef({ onSave, onLeave });
	callbacks.current = { onSave, onLeave };

	useEffect(() => {
		if (!enabled) return;

		const guard: LeaveGuard = {
			message,
			allowPath: allowPathPrefix
				? (pathname) =>
						pathname === allowPathPrefix ||
						pathname.startsWith(`${allowPathPrefix}/`)
				: undefined,
			onSave: callbacks.current.onSave
				? () => callbacks.current.onSave?.() ?? Promise.resolve(false)
				: undefined,
			onLeave: () => callbacks.current.onLeave?.(),
		};
		setLeaveGuard(guard);

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			// Legacy browsers require a returnValue to show the prompt.
			event.returnValue = "";
		};

		const handleClick = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return;
			}
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest("a[href]");
			if (!(anchor instanceof HTMLAnchorElement)) return;
			if (anchor.target && anchor.target !== "_self") return;
			if (anchor.hasAttribute("download")) return;

			const url = new URL(anchor.href, window.location.href);
			if (url.origin !== window.location.origin) return;
			if (
				url.pathname === window.location.pathname &&
				url.search === window.location.search
			) {
				return;
			}
			if (!isLeaveBlocked(url.pathname)) return;

			event.preventDefault();
			event.stopPropagation();
			void requestNavigation(url.pathname, () =>
				router.push(`${url.pathname}${url.search}${url.hash}`),
			);
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		window.addEventListener("click", handleClick, true);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			window.removeEventListener("click", handleClick, true);
			clearLeaveGuard(guard);
		};
	}, [enabled, message, allowPathPrefix, router]);
}
