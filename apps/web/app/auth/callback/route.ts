import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const RECOVERY_TARGET = "/reset-password";
const RECOVERY_COOKIE = "pw-recovery";

// Only accept relative paths starting with a single "/"; reject "//" and "/\"
// to avoid open-redirect attacks via the `next` query param.
function safeNext(raw: string | null): string {
	if (!raw) return "/dashboard";
	if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
		return "/dashboard";
	}
	return raw;
}

// Handles Supabase PKCE redirects (email confirmation, password reset).
// Supabase links to: /auth/callback?code=<pkce_code>[&next=<path>]
export async function GET(request: NextRequest) {
	const { searchParams, origin } = request.nextUrl;
	const code = searchParams.get("code");
	const next = safeNext(searchParams.get("next"));

	if (!code) {
		return NextResponse.redirect(`${origin}/login?error=missing_code`);
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
		return NextResponse.redirect(`${origin}/login?error=link_invalid`);
	}

	// Mark this session as a recovery/invite flow so /reset-password can
	// distinguish it from a regular signed-in user navigating to the page.
	if (next === RECOVERY_TARGET) {
		cookieStore.set(RECOVERY_COOKIE, "1", {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: 60 * 15,
		});
	}

	return NextResponse.redirect(`${origin}${next}`);
}
