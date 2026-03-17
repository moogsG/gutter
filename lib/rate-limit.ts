/**
 * Simple in-memory rate limiter
 * For production with multiple instances, consider Redis-backed implementation
 */

import { getClientIp, logRateLimitExceeded } from "./security-logger";

interface RateLimitConfig {
	windowMs: number; // Time window in milliseconds
	maxRequests: number; // Max requests per window
}

interface RequestLog {
	count: number;
	resetTime: number;
}

const requestLogs = new Map<string, RequestLog>();

// Cleanup old entries every 5 minutes
setInterval(
	() => {
		const now = Date.now();
		for (const [key, log] of requestLogs.entries()) {
			if (log.resetTime < now) {
				requestLogs.delete(key);
			}
		}
	},
	5 * 60 * 1000,
);

export function checkRateLimit(
	identifier: string,
	config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 },
): { allowed: boolean; resetTime: number; remaining: number } {
	const now = Date.now();
	const log = requestLogs.get(identifier);

	// No existing log or window expired
	if (!log || log.resetTime < now) {
		const resetTime = now + config.windowMs;
		requestLogs.set(identifier, { count: 1, resetTime });
		return {
			allowed: true,
			resetTime,
			remaining: config.maxRequests - 1,
		};
	}

	// Within existing window
	if (log.count >= config.maxRequests) {
		return {
			allowed: false,
			resetTime: log.resetTime,
			remaining: 0,
		};
	}

	// Increment count
	log.count++;
	requestLogs.set(identifier, log);

	return {
		allowed: true,
		resetTime: log.resetTime,
		remaining: config.maxRequests - log.count,
	};
}

/**
 * Rate limit middleware for Next.js API routes
 * Usage:
 *
 * export async function POST(req: NextRequest) {
 *   const limited = rateLimitMiddleware(req, { windowMs: 60000, maxRequests: 10 });
 *   if (limited) return limited;
 *
 *   // ... your handler logic
 * }
 */
export function rateLimitMiddleware(
	req: Request,
	config?: RateLimitConfig,
): Response | null {
	// Use IP address as identifier (fallback to a default if not available)
	const ip = getClientIp(req);

	const { allowed, resetTime, remaining } = checkRateLimit(ip, config);

	if (!allowed) {
		// Log rate limit exceeded event
		const url = new URL(req.url);
		logRateLimitExceeded(req, url.pathname, {
			limit: config?.maxRequests,
			windowMs: config?.windowMs,
		}).catch((err) => console.error("[rate-limit] Failed to log event:", err));

		return new Response(
			JSON.stringify({
				error: "Too many requests",
				retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
			}),
			{
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"Retry-After": Math.ceil((resetTime - Date.now()) / 1000).toString(),
					"X-RateLimit-Limit": config?.maxRequests.toString() || "100",
					"X-RateLimit-Remaining": "0",
					"X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
				},
			},
		);
	}

	// Add rate limit headers to response (caller should copy these to their response)
	return null;
}
