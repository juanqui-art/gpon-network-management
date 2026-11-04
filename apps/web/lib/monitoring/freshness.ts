import type { OntCurrentState } from "@/lib/types/gpon";

/**
 * The collector UPSERTs every ONT on each poll (POLL_INTERVAL_MS, default 60 s
 * in apps/collector/src/config.ts), which bumps `updated_at`. Three missed
 * polls means the data on screen is no longer live, even if the websocket is.
 */
export const COLLECTOR_POLL_MS = 60_000;
export const STALE_AFTER_MS = COLLECTOR_POLL_MS * 3;

/** Most recent `updated_at` among readings (ISO string) or null. */
export function latestUpdate(readings: OntCurrentState[]): string | null {
	let latest: string | null = null;
	for (const reading of readings) {
		if (reading.updated_at && (!latest || reading.updated_at > latest)) {
			latest = reading.updated_at;
		}
	}
	return latest;
}

export function isStale(iso: string | null, nowMs: number | null): boolean {
	if (!iso || nowMs === null) return false;
	const at = new Date(iso).getTime();
	return Number.isFinite(at) && nowMs - at > STALE_AFTER_MS;
}

export function formatRelative(
	iso: string | null,
	nowMs: number | null,
): string {
	if (!iso || nowMs === null) return "—";
	const target = new Date(iso).getTime();
	if (Number.isNaN(target)) return "—";
	const seconds = Math.max(0, Math.floor((nowMs - target) / 1000));
	if (seconds < 5) return "ahora";
	if (seconds < 60) return `hace ${seconds} s`;
	if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
	if (seconds < 86_400) return `hace ${Math.floor(seconds / 3600)} h`;
	return `hace ${Math.floor(seconds / 86_400)} d`;
}
