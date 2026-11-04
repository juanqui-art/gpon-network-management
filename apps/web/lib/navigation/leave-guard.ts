import { confirmAction } from "@/lib/feedback/confirm";

/**
 * Single active "unsaved changes" guard. Registered by editor screens while
 * they hold dirty state; consulted by every in-app navigation entry point
 * (links, command palette, keyboard chords, sign-out).
 */
export interface LeaveGuard {
	message: string;
	/** Paths that keep the editing session alive (e.g. editor ↔ capture). */
	allowPath?: (pathname: string) => boolean;
	/** Persist changes; return true when it is safe to leave. */
	onSave?: () => Promise<boolean>;
	/** Called after the user chose to leave (saved or discarded). */
	onLeave?: () => void;
}

let activeGuard: LeaveGuard | null = null;

export function setLeaveGuard(guard: LeaveGuard) {
	activeGuard = guard;
}

export function clearLeaveGuard(guard: LeaveGuard) {
	if (activeGuard === guard) activeGuard = null;
}

export function isLeaveBlocked(pathname?: string): boolean {
	if (!activeGuard) return false;
	if (pathname && activeGuard.allowPath?.(pathname)) return false;
	return true;
}

/**
 * Runs `proceed` immediately when nothing blocks; otherwise asks the user.
 * Resolves true when navigation went ahead.
 */
export async function requestNavigation(
	pathname: string | undefined,
	proceed: () => void,
): Promise<boolean> {
	const guard = activeGuard;
	if (!guard || !isLeaveBlocked(pathname)) {
		proceed();
		return true;
	}

	const confirmed = await confirmAction({
		title: "Tienes cambios sin guardar",
		description: guard.message,
		confirmLabel: "Salir sin guardar",
		cancelLabel: "Seguir editando",
		tone: "danger",
		extraAction: guard.onSave
			? {
					label: "Guardar y salir",
					pendingLabel: "Guardando…",
					run: guard.onSave,
				}
			: undefined,
	});
	if (!confirmed) return false;

	// Clear first so the navigation we trigger below is not intercepted again.
	clearLeaveGuard(guard);
	guard.onLeave?.();
	proceed();
	return true;
}
