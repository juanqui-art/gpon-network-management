import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function createClient() {
	// Next.js 16: cookies() must be awaited
	const cookieStore = await cookies();

	return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				try {
					for (const { name, value, options } of cookiesToSet) {
						cookieStore.set(name, value, options);
					}
				} catch {
					// Server Component — cookies can't be set here; handled by proxy
				}
			},
		},
	});
}
