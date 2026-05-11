import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

// Fail open when Upstash isn't configured (dev/preview without env vars).
// Production must set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
function makeRedis(): Redis | null {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) return null;
	return new Redis({ url, token });
}

const redis = makeRedis();

function makeLimiter(
	prefix: string,
	limit: number,
	window: Parameters<typeof Ratelimit.slidingWindow>[1],
) {
	if (!redis) return null;
	return new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(limit, window),
		analytics: false,
		prefix,
	});
}

const signInLimiter = makeLimiter("rl:signin", 5, "15 m");
const passwordResetLimiter = makeLimiter("rl:pwreset", 3, "1 h");

async function clientIp(): Promise<string> {
	const h = await headers();
	const forwarded = h.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0].trim();
	return h.get("x-real-ip") ?? "anonymous";
}

export interface RateLimitResult {
	ok: boolean;
	retryAfterSeconds: number;
}

async function check(
	limiter: Ratelimit | null,
	key: string,
): Promise<RateLimitResult> {
	if (!limiter) {
		if (process.env.NODE_ENV === "production") {
			console.warn(
				"[rate-limit] Upstash not configured — auth endpoints unprotected",
			);
		}
		return { ok: true, retryAfterSeconds: 0 };
	}
	const { success, reset } = await limiter.limit(key);
	return {
		ok: success,
		retryAfterSeconds: Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
	};
}

export async function checkSignInRateLimit(
	email: string,
): Promise<RateLimitResult> {
	const ip = await clientIp();
	return check(signInLimiter, `${ip}:${email.toLowerCase()}`);
}

export async function checkPasswordResetRateLimit(): Promise<RateLimitResult> {
	const ip = await clientIp();
	return check(passwordResetLimiter, ip);
}
