import { createClient } from "@supabase/supabase-js";

// Admin client uses SUPABASE_SECRET_KEY (service_role) — server-only.
// Only import this file from server actions or route handlers, never from client components.
export function createAdminClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SECRET_KEY;
	if (!url || !key) throw new Error("Missing Supabase admin credentials");
	return createClient(url, key, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
}
