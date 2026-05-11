function requireEnv(key: string, value: string | undefined): string {
	if (!value) throw new Error(`Missing required environment variable: ${key}`);
	return value;
}

export const env = {
	supabaseUrl: requireEnv(
		"NEXT_PUBLIC_SUPABASE_URL",
		process.env.NEXT_PUBLIC_SUPABASE_URL,
	),
	supabasePublishableKey: requireEnv(
		"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	),
	mapboxToken: requireEnv(
		"NEXT_PUBLIC_MAPBOX_TOKEN",
		process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
	),
	siteUrl: requireEnv("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL),
} as const;
