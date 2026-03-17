/**
 * Tests for lib/security-logger.ts
 */

import { readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
	getClientIp,
	logAuthFailure,
	logRateLimitExceeded,
	logSecurityEvent,
	logSuspiciousActivity,
	logValidationFailure,
	type SecurityEvent,
} from "@/lib/security-logger";

const TEST_LOG_FILE = join(process.cwd(), "gutter-security.log");

describe("getClientIp()", () => {
	it("extracts IP from x-forwarded-for header", () => {
		const req = new Request("http://localhost", {
			headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
		});

		const ip = getClientIp(req);
		expect(ip).toBe("192.168.1.1");
	});

	it("extracts IP from x-real-ip header", () => {
		const req = new Request("http://localhost", {
			headers: { "x-real-ip": "192.168.1.2" },
		});

		const ip = getClientIp(req);
		expect(ip).toBe("192.168.1.2");
	});

	it("prefers x-forwarded-for over x-real-ip", () => {
		const req = new Request("http://localhost", {
			headers: {
				"x-forwarded-for": "192.168.1.3",
				"x-real-ip": "10.0.0.1",
			},
		});

		const ip = getClientIp(req);
		expect(ip).toBe("192.168.1.3");
	});

	it("returns 'unknown' when no IP headers present", () => {
		const req = new Request("http://localhost");

		const ip = getClientIp(req);
		expect(ip).toBe("unknown");
	});

	it("handles x-forwarded-for with multiple IPs", () => {
		const req = new Request("http://localhost", {
			headers: { "x-forwarded-for": "192.168.1.4, 10.0.0.2, 172.16.0.1" },
		});

		const ip = getClientIp(req);
		expect(ip).toBe("192.168.1.4");
	});

	it("trims whitespace from IP addresses", () => {
		const req = new Request("http://localhost", {
			headers: { "x-forwarded-for": "  192.168.1.5  , 10.0.0.3" },
		});

		const ip = getClientIp(req);
		expect(ip).toBe("192.168.1.5");
	});
});

describe("logSecurityEvent()", () => {
	beforeEach(async () => {
		// Clean up test log file before each test
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	afterAll(async () => {
		// Clean up test log file after all tests
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	it("writes security event to log file", async () => {
		await logSecurityEvent(
			"rate_limit_exceeded",
			"192.168.1.1",
			"/api/test",
			{ limit: 100 },
		);

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		expect(logContent).toBeTruthy();

		const event = JSON.parse(logContent.trim()) as SecurityEvent;
		expect(event.type).toBe("rate_limit_exceeded");
		expect(event.ip).toBe("192.168.1.1");
		expect(event.endpoint).toBe("/api/test");
		expect(event.details?.limit).toBe(100);
		expect(event.timestamp).toBeTruthy();
	});

	it("appends multiple events to log file", async () => {
		await logSecurityEvent("validation_failure", "192.168.1.2", "/api/test1");
		await logSecurityEvent("auth_failure", "192.168.1.3", "/api/test2");

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		const lines = logContent.trim().split("\n");

		expect(lines).toHaveLength(2);

		const event1 = JSON.parse(lines[0]) as SecurityEvent;
		const event2 = JSON.parse(lines[1]) as SecurityEvent;

		expect(event1.type).toBe("validation_failure");
		expect(event2.type).toBe("auth_failure");
	});

	it("formats event as valid JSON", async () => {
		await logSecurityEvent("suspicious_activity", "192.168.1.4", "/api/test", {
			reason: "unusual pattern",
			count: 42,
		});

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		expect(() => JSON.parse(logContent.trim())).not.toThrow();
	});

	it("includes ISO timestamp", async () => {
		const beforeTime = new Date();
		await logSecurityEvent("rate_limit_exceeded", "192.168.1.5", "/api/test");
		const afterTime = new Date();

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		const event = JSON.parse(logContent.trim()) as SecurityEvent;

		const eventTime = new Date(event.timestamp);
		expect(eventTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
		expect(eventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
	});

	it("handles missing details parameter", async () => {
		await logSecurityEvent("validation_failure", "192.168.1.6", "/api/test");

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		const event = JSON.parse(logContent.trim()) as SecurityEvent;

		expect(event.details).toBeUndefined();
	});

	it("handles complex details object", async () => {
		const details = {
			nested: { key: "value" },
			array: [1, 2, 3],
			string: "test",
			number: 42,
			boolean: true,
		};

		await logSecurityEvent("suspicious_activity", "192.168.1.7", "/api/test", details);

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		const event = JSON.parse(logContent.trim()) as SecurityEvent;

		expect(event.details).toEqual(details);
	});
});

describe("logRateLimitExceeded()", () => {
	beforeEach(async () => {
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	afterAll(async () => {
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	it("logs rate limit event with client IP", async () => {
		const req = new Request("http://localhost/api/test", {
			headers: { "x-forwarded-for": "192.168.1.10" },
		});

		await logRateLimitExceeded(req, "/api/test", { limit: 100 });

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		const event = JSON.parse(logContent.trim()) as SecurityEvent;

		expect(event.type).toBe("rate_limit_exceeded");
		expect(event.ip).toBe("192.168.1.10");
		expect(event.endpoint).toBe("/api/test");
	});
});

describe("logValidationFailure()", () => {
	beforeEach(async () => {
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	afterAll(async () => {
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	it("logs validation failure with client IP", async () => {
		const req = new Request("http://localhost/api/test", {
			headers: { "x-real-ip": "192.168.1.11" },
		});

		await logValidationFailure(req, "/api/test", { field: "email" });

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		const event = JSON.parse(logContent.trim()) as SecurityEvent;

		expect(event.type).toBe("validation_failure");
		expect(event.ip).toBe("192.168.1.11");
		expect(event.details?.field).toBe("email");
	});
});

describe("logAuthFailure()", () => {
	beforeEach(async () => {
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	afterAll(async () => {
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	it("logs auth failure with client IP", async () => {
		const req = new Request("http://localhost/api/auth", {
			headers: { "x-forwarded-for": "192.168.1.12" },
		});

		await logAuthFailure(req, "/api/auth", { username: "test" });

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		const event = JSON.parse(logContent.trim()) as SecurityEvent;

		expect(event.type).toBe("auth_failure");
		expect(event.ip).toBe("192.168.1.12");
		expect(event.endpoint).toBe("/api/auth");
	});
});

describe("logSuspiciousActivity()", () => {
	beforeEach(async () => {
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	afterAll(async () => {
		if (existsSync(TEST_LOG_FILE)) {
			await unlink(TEST_LOG_FILE);
		}
	});

	it("logs suspicious activity with client IP", async () => {
		const req = new Request("http://localhost/api/test", {
			headers: { "x-forwarded-for": "192.168.1.13" },
		});

		await logSuspiciousActivity(req, "/api/test", { reason: "sql injection attempt" });

		const logContent = await readFile(TEST_LOG_FILE, "utf-8");
		const event = JSON.parse(logContent.trim()) as SecurityEvent;

		expect(event.type).toBe("suspicious_activity");
		expect(event.ip).toBe("192.168.1.13");
		expect(event.details?.reason).toBe("sql injection attempt");
	});
});
