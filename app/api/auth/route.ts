import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logAuthFailure } from "@/lib/security-logger";

// Store password hash instead of plaintext
// In production, this should be in a database
// For setup: use bcrypt.hashSync("your-password", 10) to generate hash
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || "";
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE_DAYS || "30", 10) * 86400;

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
  return typeof token === "string" && 
         token.length === 64 && 
         /^[a-f0-9]+$/.test(token) &&
         activeSessions.has(token);
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

    if (!AUTH_PASSWORD_HASH) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }

    // Use bcrypt to compare password with hash
    const isValid = await bcrypt.compare(password, AUTH_PASSWORD_HASH);

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
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
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
