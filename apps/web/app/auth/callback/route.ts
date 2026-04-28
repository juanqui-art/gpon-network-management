import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Handles Supabase PKCE redirects (email confirmation, password reset).
// Supabase links to: /auth/callback?code=<pkce_code>[&next=<path>]
export async function GET(request: NextRequest) {
	const { searchParams, origin } = request.nextUrl;
	const code = searchParams.get("code");
	const next = searchParams.get("next") ?? "/map";

	if (!code) {
		return NextResponse.redirect(`${origin}/login`);
	}

	const cookieStore = await cookies();
	const supabase = createServerClient(
		env.supabaseUrl,
		env.supabasePublishableKey,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet) {
					try {
						for (const { name, value, options } of cookiesToSet) {
							cookieStore.set(name, value, options);
						}
					} catch {}
				},
			},
		},
	);

	const { error } = await supabase.auth.exchangeCodeForSession(code);
	if (error) {
		return NextResponse.redirect(`${origin}/login`);
	}

	return NextResponse.redirect(`${origin}${next}`);
}
