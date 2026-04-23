import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logAuthFailure } from "@/lib/security-logger";

function readEnvFileValue(key: string): string {
	try {
		const envPath = join(process.cwd(), ".env");
		const envContent = readFileSync(envPath, "utf8");
		const line = envContent
			.split(/\r?\n/)
			.find((entry) => entry.startsWith(`${key}=`));

		if (!line) return "";
		return line.slice(key.length + 1).trim();
	} catch {
		return "";
	}
}

function looksLikeBcryptHash(value: string): boolean {
	return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

function getAuthPasswordHash(): string {
	const envValue = process.env.AUTH_PASSWORD_HASH || "";
	const fileValue = readEnvFileValue("AUTH_PASSWORD_HASH");

	if (looksLikeBcryptHash(fileValue)) {
		return fileValue;
	}

	if (looksLikeBcryptHash(envValue)) {
		return envValue;
	}

	return fileValue || envValue;
}

function getSessionMaxAge(): number {
	const rawValue =
		process.env.SESSION_MAX_AGE_DAYS ||
		readEnvFileValue("SESSION_MAX_AGE_DAYS") ||
		"30";

	return parseInt(rawValue, 10) * 86400;
}

// Simple in-memory session store (use Redis in production with multiple instances)
const activeSessions = new Set<string>();

/**
 * Generate a cryptographically secure session token
 */
function makeToken(): string {
	const token = randomBytes(32).toString("hex");
	activeSessions.add(token);
	return token;
}

/**
 * Verify a session token is valid and active
 */
export function verifyToken(token: string): boolean {
	return (
		typeof token === "string" &&
		token.length === 64 &&
		/^[a-f0-9]+$/.test(token) &&
		activeSessions.has(token)
	);
}

/**
 * Revoke a session token
 */
export function revokeToken(token: string): void {
	activeSessions.delete(token);
}

// Cleanup expired sessions periodically (every hour)
// In production, use Redis with TTL
setInterval(() => {
	// For now, we rely on cookie expiry
	// In a real system, store token creation time and clean up based on that
}, 3600000);

// POST: login
export async function POST(req: NextRequest) {
	// Strict rate limit for login attempts (5 attempts per minute per IP)
	const limited = rateLimitMiddleware(req, { windowMs: 60000, maxRequests: 5 });
	if (limited) return limited;

	try {
		const { password } = await req.json();

		const authPasswordHash = getAuthPasswordHash();
		const sessionMaxAge = getSessionMaxAge();

		if (!authPasswordHash) {
			return NextResponse.json(
				{ error: "Auth not configured" },
				{ status: 500 },
			);
		}

		// Use bcrypt to compare password with hash
		const isValid = await bcrypt.compare(password, authPasswordHash);

		if (!isValid) {
			// Log authentication failure
			await logAuthFailure(req, "/api/auth", { reason: "invalid_password" });
			return NextResponse.json({ error: "Wrong password" }, { status: 401 });
		}

		const token = makeToken();
		const response = NextResponse.json({ ok: true });

		response.cookies.set("gutter-session", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: sessionMaxAge,
			path: "/",
		});

		return response;
	} catch {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}
}

// GET: temporary debug for auth source inspection
export async function GET() {
	const authPasswordHash = getAuthPasswordHash();
	const envPasswordHash = process.env.AUTH_PASSWORD_HASH || "";
	const filePasswordHash = readEnvFileValue("AUTH_PASSWORD_HASH");

	return NextResponse.json({
		envHashPreview: envPasswordHash.slice(0, 12),
		fileHashPreview: filePasswordHash.slice(0, 12),
		resolvedHashPreview: authPasswordHash.slice(0, 12),
		matchesEnv: authPasswordHash === envPasswordHash,
		matchesFile: authPasswordHash === filePasswordHash,
		envLooksValid: looksLikeBcryptHash(envPasswordHash),
		fileLooksValid: looksLikeBcryptHash(filePasswordHash),
		resolvedLooksValid: looksLikeBcryptHash(authPasswordHash),
	});
}

// DELETE: logout
export async function DELETE(req: NextRequest) {
	const token = req.cookies.get("gutter-session")?.value;

	// Revoke the session token
	if (token) {
		revokeToken(token);
	}

	const response = NextResponse.json({ ok: true });
	response.cookies.delete("gutter-session");
	return response;
}
