import { type Config, loadConfig } from "./config.js";
import { HistoryDecider } from "./decide/history-trigger.js";
import { parseOntRows } from "./parser/ont-parser.js";
import { SupabasePersister, type OntWithTrigger } from "./persist/supabase.js";
import { createMockSession } from "./snmp/mock-session.js";
import { createRealSession } from "./snmp/session.js";
import type { SnmpSession } from "./snmp/types.js";

function log(level: "info" | "warn" | "error", message: string, meta?: object): void {
	const entry = {
		ts: new Date().toISOString(),
		level,
		message,
		...meta,
	};
	console.log(JSON.stringify(entry));
}

function buildSession(config: Config): SnmpSession {
	if (config.mockMode) {
		log("info", "starting in MOCK mode — no real OLT connection");
		return createMockSession();
	}
	log("info", "starting in REAL SNMP mode", {
		host: config.olt.host,
		port: config.olt.port,
	});
	return createRealSession({
		host: config.olt.host,
		community: config.olt.community,
		port: config.olt.port,
		timeoutMs: config.olt.timeoutMs,
		retries: config.olt.retries,
	});
}

async function runOnce(
	session: SnmpSession,
	decider: HistoryDecider,
	persister: SupabasePersister,
): Promise<void> {
	const startedAt = Date.now();

	const rawRows = await session.pollOnts();
	const readings = parseOntRows(rawRows);

	const items: OntWithTrigger[] = readings.map((reading) => ({
		reading,
		trigger: decider.decide(reading),
	}));

	const { upserted, historyInserted } = await persister.persist(items);

	log("info", "poll completed", {
		durationMs: Date.now() - startedAt,
		ontCount: readings.length,
		upserted,
		historyInserted,
	});
}

async function main(): Promise<void> {
	const config = loadConfig();
	const session = buildSession(config);
	const decider = new HistoryDecider({
		degradationThresholdDb: config.poll.degradationThresholdDb,
		sampleEveryNPolls: config.poll.sampleEveryNPolls,
	});
	const persister = new SupabasePersister({
		url: config.supabase.url,
		serviceKey: config.supabase.serviceKey,
		networkId: config.network.id,
		oltHost: config.olt.host,
	});

	let stopping = false;
	const stop = (signal: string): void => {
		if (stopping) return;
		stopping = true;
		log("info", `received ${signal}, shutting down`);
		session.close();
		// Dejamos que el setTimeout termine naturalmente; process exits cuando
		// se vacía el event loop.
	};
	process.on("SIGTERM", () => stop("SIGTERM"));
	process.on("SIGINT", () => stop("SIGINT"));

	log("info", "collector started", {
		intervalMs: config.poll.intervalMs,
		networkId: config.network.id,
	});

	while (!stopping) {
		try {
			await runOnce(session, decider, persister);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			log("error", "poll failed", { error: message });
		}

		if (stopping) break;
		await new Promise((resolve) => setTimeout(resolve, config.poll.intervalMs));
	}

	log("info", "collector stopped");
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	log("error", "fatal error", { error: message });
	process.exit(1);
});
