import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logAuthFailure } from "@/lib/security-logger";
import { createSessionToken } from "@/lib/session";

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

		const token = await createSessionToken(sessionMaxAge);
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

// DELETE: logout
export async function DELETE(req: NextRequest) {
	const response = NextResponse.json({ ok: true });
	response.cookies.delete("gutter-session");
	return response;
}
