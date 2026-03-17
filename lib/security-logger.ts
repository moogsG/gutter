/**
 * Security event logger
 * Logs rate limit hits, validation failures, and authentication failures
 * to gutter-security.log for audit and monitoring purposes.
 */

import { appendFile } from "node:fs/promises";
import { join } from "node:path";

const LOG_FILE = join(process.cwd(), "gutter-security.log");

export type SecurityEventType =
	| "rate_limit_exceeded"
	| "validation_failure"
	| "auth_failure"
	| "suspicious_activity";

export interface SecurityEvent {
	timestamp: string;
	type: SecurityEventType;
	ip: string;
	endpoint: string;
	details?: Record<string, unknown>;
}

/**
 * Log a security event to the security log file
 */
export async function logSecurityEvent(
	type: SecurityEventType,
	ip: string,
	endpoint: string,
	details?: Record<string, unknown>,
): Promise<void> {
	const event: SecurityEvent = {
		timestamp: new Date().toISOString(),
		type,
		ip,
		endpoint,
		details,
	};

	const logLine = `${JSON.stringify(event)}\n`;

	try {
		await appendFile(LOG_FILE, logLine, "utf-8");
	} catch (error) {
		// Fallback to console if file write fails
		console.error("[security-logger] Failed to write to log file:", error);
		console.error("[security-logger] Event:", event);
	}
}

/**
 * Extract IP address from Next.js request
 */
export function getClientIp(req: Request): string {
	const forwardedFor = req.headers.get("x-forwarded-for");
	const ip =
		forwardedFor?.split(",")[0]?.trim() ||
		req.headers.get("x-real-ip") ||
		"unknown";
	return ip;
}

/**
 * Log rate limit exceeded event
 */
export async function logRateLimitExceeded(
	req: Request,
	endpoint: string,
	details?: Record<string, unknown>,
): Promise<void> {
	const ip = getClientIp(req);
	await logSecurityEvent("rate_limit_exceeded", ip, endpoint, details);
}

/**
 * Log validation failure event
 */
export async function logValidationFailure(
	req: Request,
	endpoint: string,
	details?: Record<string, unknown>,
): Promise<void> {
	const ip = getClientIp(req);
	await logSecurityEvent("validation_failure", ip, endpoint, details);
}

/**
 * Log authentication failure event
 */
export async function logAuthFailure(
	req: Request,
	endpoint: string,
	details?: Record<string, unknown>,
): Promise<void> {
	const ip = getClientIp(req);
	await logSecurityEvent("auth_failure", ip, endpoint, details);
}

/**
 * Log suspicious activity event
 */
export async function logSuspiciousActivity(
	req: Request,
	endpoint: string,
	details?: Record<string, unknown>,
): Promise<void> {
	const ip = getClientIp(req);
	await logSecurityEvent("suspicious_activity", ip, endpoint, details);
}
