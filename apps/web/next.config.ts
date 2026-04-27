import type { NextConfig } from "next";

// CSP notes:
// - 'unsafe-inline' in script-src: required by Next.js App Router hydration.
//   Upgrade path: use nonces via proxy.ts once the team is ready.
// - 'unsafe-eval' in script-src: required by Mapbox GL JS shader compilation.
// - 'unsafe-inline' in style-src: Mapbox and Next.js inject dynamic inline styles.
// - worker-src blob: required by Mapbox GL JS web workers.
const csp = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https://*.mapbox.com",
	"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.mapbox.com https://events.mapbox.com",
	"worker-src blob:",
	"child-src blob:",
	"font-src 'self'",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
].join("; ");

const securityHeaders = [
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=()",
	},
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{ key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
	async headers() {
		return [{ source: "/(.*)", headers: securityHeaders }];
	},
};

export default nextConfig;
