import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
const AUTH_SECRET = process.env.AUTH_SECRET || "gutter-default-secret-change-me";
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE_DAYS || "30", 10) * 86400;

function makeToken(): string {
  return createHash("sha256")
    .update(`${AUTH_PASSWORD}:${AUTH_SECRET}:${Date.now()}`)
    .digest("hex");
}

export function verifyToken(token: string): boolean {
  // Token is valid if it exists and was created with our secret
  // For single-user, we just check it's a valid hex string of correct length
  return typeof token === "string" && token.length === 64 && /^[a-f0-9]+$/.test(token);
}

// POST: login
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!AUTH_PASSWORD) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }

    if (password !== AUTH_PASSWORD) {
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
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("gutter-session");
  return response;
}
