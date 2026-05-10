function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function optionalNumber(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const parsed = Number(raw);
	if (Number.isNaN(parsed)) {
		throw new Error(`Invalid number for ${name}: ${raw}`);
	}
	return parsed;
}

function optionalBoolean(name: string, fallback: boolean): boolean {
	const raw = process.env[name];
	if (raw === undefined) return fallback;
	return raw === "true" || raw === "1";
}

export interface Config {
	mockMode: boolean;

	olt: {
		host: string;
		community: string;
		port: number;
		timeoutMs: number;
		retries: number;
	};

	supabase: {
		url: string;
		serviceKey: string;
	};

	poll: {
		intervalMs: number;
		degradationThresholdDb: number;
		sampleEveryNPolls: number;
	};

	network: {
		id: string;
	};
}

export function loadConfig(): Config {
	const mockMode = optionalBoolean("MOCK_MODE", false);

	return {
		mockMode,
		olt: {
			host: mockMode ? "mock" : required("OLT_HOST"),
			community: mockMode ? "mock" : required("OLT_COMMUNITY"),
			port: optionalNumber("OLT_SNMP_PORT", 161),
			timeoutMs: optionalNumber("OLT_SNMP_TIMEOUT_MS", 5000),
			retries: optionalNumber("OLT_SNMP_RETRIES", 1),
		},
		supabase: {
			url: required("SUPABASE_URL"),
			serviceKey: required("SUPABASE_SERVICE_KEY"),
		},
		poll: {
			intervalMs: optionalNumber("POLL_INTERVAL_MS", 60_000),
			degradationThresholdDb: Number(
				process.env.DEGRADATION_THRESHOLD_DB ?? "1.5",
			),
			sampleEveryNPolls: optionalNumber("SAMPLE_EVERY_N_POLLS", 10),
		},
		network: {
			id: required("NETWORK_ID"),
		},
	};
}
