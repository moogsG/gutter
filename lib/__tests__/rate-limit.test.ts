/**
 * Tests for lib/rate-limit.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, rateLimitMiddleware } from "@/lib/rate-limit";

// Mock security-logger module
vi.mock("@/lib/security-logger", () => ({
	getClientIp: vi.fn((req: Request) => {
		// Extract IP from test request or use default
		const url = new URL(req.url);
		return url.searchParams.get("test-ip") || "127.0.0.1";
	}),
	logRateLimitExceeded: vi.fn().mockResolvedValue(undefined),
}));

describe("checkRateLimit()", () => {
	beforeEach(() => {
		// Clear all rate limit logs between tests
		vi.clearAllMocks();
	});

	it("allows first request", () => {
		const result = checkRateLimit("test-user-1", {
			windowMs: 60000,
			maxRequests: 5,
		});

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(4);
		expect(result.resetTime).toBeGreaterThan(Date.now());
	});

	it("tracks request count within window", () => {
		const config = { windowMs: 60000, maxRequests: 3 };

		// First request
		let result = checkRateLimit("test-user-2", config);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(2);

		// Second request
		result = checkRateLimit("test-user-2", config);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(1);

		// Third request
		result = checkRateLimit("test-user-2", config);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(0);
	});

	it("blocks requests exceeding limit", () => {
		const config = { windowMs: 60000, maxRequests: 2 };

		// First two requests allowed
		checkRateLimit("test-user-3", config);
		checkRateLimit("test-user-3", config);

		// Third request should be blocked
		const result = checkRateLimit("test-user-3", config);
		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it("resets after window expires", async () => {
		const config = { windowMs: 100, maxRequests: 2 }; // Short window for testing

		// Use up the limit
		checkRateLimit("test-user-4", config);
		checkRateLimit("test-user-4", config);

		// Should be blocked
		let result = checkRateLimit("test-user-4", config);
		expect(result.allowed).toBe(false);

		// Wait for window to expire
		await new Promise((resolve) => setTimeout(resolve, 150));

		// Should be allowed again
		result = checkRateLimit("test-user-4", config);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(1);
	});

	it("uses default config when not provided", () => {
		const result = checkRateLimit("test-user-5");

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(99); // Default is 100 requests
	});

	it("isolates different identifiers", () => {
		const config = { windowMs: 60000, maxRequests: 2 };

		// User A uses up their limit
		checkRateLimit("user-a", config);
		checkRateLimit("user-a", config);
		const resultA = checkRateLimit("user-a", config);
		expect(resultA.allowed).toBe(false);

		// User B should still be allowed
		const resultB = checkRateLimit("user-b", config);
		expect(resultB.allowed).toBe(true);
	});

	it("returns consistent resetTime within window", () => {
		const config = { windowMs: 60000, maxRequests: 5 };

		const result1 = checkRateLimit("test-user-6", config);
		const result2 = checkRateLimit("test-user-6", config);

		expect(result1.resetTime).toBe(result2.resetTime);
	});

	it("handles rapid sequential requests", () => {
		const config = { windowMs: 60000, maxRequests: 10 };

		// Make 10 rapid requests
		for (let i = 0; i < 10; i++) {
			const result = checkRateLimit("test-user-7", config);
			expect(result.allowed).toBe(true);
		}

		// 11th request should be blocked
		const result = checkRateLimit("test-user-7", config);
		expect(result.allowed).toBe(false);
	});
});

describe("rateLimitMiddleware()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns null when under limit", () => {
		const req = new Request("http://localhost/api/test?test-ip=192.168.1.1");

		const response = rateLimitMiddleware(req, {
			windowMs: 60000,
			maxRequests: 10,
		});

		expect(response).toBeNull();
	});

	it("returns 429 response when over limit", () => {
		const config = { windowMs: 60000, maxRequests: 2 };

		// Use up the limit
		const req1 = new Request("http://localhost/api/test?test-ip=192.168.1.2");
		rateLimitMiddleware(req1, config);
		rateLimitMiddleware(req1, config);

		// Third request should get 429
		const response = rateLimitMiddleware(req1, config);

		expect(response).not.toBeNull();
		expect(response?.status).toBe(429);
	});

	it("includes rate limit headers in 429 response", async () => {
		const config = { windowMs: 60000, maxRequests: 1 };

		const req1 = new Request("http://localhost/api/test?test-ip=192.168.1.3");
		rateLimitMiddleware(req1, config);

		const response = rateLimitMiddleware(req1, config);

		expect(response?.headers.get("X-RateLimit-Limit")).toBe("1");
		expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0");
		expect(response?.headers.get("X-RateLimit-Reset")).toBeTruthy();
		expect(response?.headers.get("Retry-After")).toBeTruthy();
	});

	it("includes error message in 429 response body", async () => {
		const config = { windowMs: 60000, maxRequests: 1 };

		const req1 = new Request("http://localhost/api/test?test-ip=192.168.1.4");
		rateLimitMiddleware(req1, config);

		const response = rateLimitMiddleware(req1, config);
		const body = await response?.json();

		expect(body?.error).toBe("Too many requests");
		expect(body?.retryAfter).toBeGreaterThan(0);
	});

	it("uses getClientIp to identify requests", async () => {
		const { getClientIp } = await import("../security-logger");

		const req = new Request("http://localhost/api/test?test-ip=10.0.0.1");
		rateLimitMiddleware(req, { windowMs: 60000, maxRequests: 10 });

		expect(getClientIp).toHaveBeenCalledWith(req);
	});

	it("logs rate limit exceeded events", async () => {
		const { logRateLimitExceeded } = await import("../security-logger");
		const config = { windowMs: 60000, maxRequests: 1 };

		const req1 = new Request("http://localhost/api/test?test-ip=192.168.1.5");
		rateLimitMiddleware(req1, config);
		rateLimitMiddleware(req1, config);

		// Wait for async logging to complete
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(logRateLimitExceeded).toHaveBeenCalled();
	});

	it("handles different IPs independently", () => {
		const config = { windowMs: 60000, maxRequests: 1 };

		const req1 = new Request("http://localhost/api/test?test-ip=192.168.1.10");
		const req2 = new Request("http://localhost/api/test?test-ip=192.168.1.11");

		// First IP uses up limit
		rateLimitMiddleware(req1, config);
		const response1 = rateLimitMiddleware(req1, config);
		expect(response1?.status).toBe(429);

		// Second IP should still be allowed
		const response2 = rateLimitMiddleware(req2, config);
		expect(response2).toBeNull();
	});

	it("uses default config when not provided", () => {
		const req = new Request("http://localhost/api/test?test-ip=192.168.1.20");

		const response = rateLimitMiddleware(req);
		expect(response).toBeNull();
	});

	it("calculates retryAfter correctly", async () => {
		const config = { windowMs: 5000, maxRequests: 1 };

		const req = new Request("http://localhost/api/test?test-ip=192.168.1.30");
		rateLimitMiddleware(req, config);

		const response = rateLimitMiddleware(req, config);
		const body = await response?.json();

		expect(body?.retryAfter).toBeGreaterThan(0);
		expect(body?.retryAfter).toBeLessThanOrEqual(5);
	});
});
