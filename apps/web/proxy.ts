import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request });

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabasePublishableKey =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

	if (!supabaseUrl || !supabasePublishableKey) {
		return supabaseResponse;
	}

	const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				for (const { name, value } of cookiesToSet) {
					request.cookies.set(name, value);
				}
				supabaseResponse = NextResponse.next({ request });
				for (const { name, value, options } of cookiesToSet) {
					supabaseResponse.cookies.set(name, value, options);
				}
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { pathname } = request.nextUrl;
	// Paths accessible without a session (no guard, no redirect to /map when authenticated).
	const isPublicOnlyPath =
		pathname === "/login" || pathname === "/forgot-password";
	// Paths that must not redirect to /map even when authenticated.
	const isPublicPath =
		isPublicOnlyPath ||
		pathname.startsWith("/auth/") ||
		pathname === "/reset-password";
	const isApiPath = pathname.startsWith("/api/");

	if (!user && !isPublicPath) {
		// API routes get 401 — not an HTML redirect (callers expect JSON).
		if (isApiPath) {
			return new NextResponse(null, { status: 401 });
		}
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		const redirectResponse = NextResponse.redirect(url);
		// Carry over any refreshed Supabase cookies so the session isn't lost.
		for (const cookie of supabaseResponse.cookies.getAll()) {
			redirectResponse.cookies.set(cookie.name, cookie.value);
		}
		return redirectResponse;
	}

	if (user && isPublicOnlyPath) {
		const url = request.nextUrl.clone();
		url.pathname = "/dashboard";
		const redirectResponse = NextResponse.redirect(url);
		for (const cookie of supabaseResponse.cookies.getAll()) {
			redirectResponse.cookies.set(cookie.name, cookie.value);
		}
		return redirectResponse;
	}

	return supabaseResponse;
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
