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

/**
 * Clear all rate limit state (for testing only)
 */
export function clearRateLimitState() {
	requestLogs.clear();
}

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
	_req: Request,
	_config?: RateLimitConfig,
): Response | null {
	// Rate limiting disabled — single-user local app
	return null;
}
