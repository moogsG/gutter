import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as authRoute from "@/app/api/auth/route";
import { createSessionToken, verifySessionToken } from "@/lib/session";
import { middleware } from "@/middleware";

const originalAuthHash = process.env.AUTH_PASSWORD_HASH;
const originalAuthSecret = process.env.AUTH_SECRET;

beforeEach(() => {
	process.env.AUTH_PASSWORD_HASH = "configured";
	process.env.AUTH_SECRET = "test-session-secret-that-is-not-public";
});

afterEach(() => {
	if (originalAuthHash === undefined) delete process.env.AUTH_PASSWORD_HASH;
	else process.env.AUTH_PASSWORD_HASH = originalAuthHash;
	if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
	else process.env.AUTH_SECRET = originalAuthSecret;
});

describe("browser session verification", () => {
	it("rejects a forged 64-character cookie", async () => {
		const request = new NextRequest("http://localhost/api/tasks");
		request.cookies.set("gutter-session", "a".repeat(64));
		const response = await middleware(request);
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
	});

	it("accepts a valid signed, unexpired session", async () => {
		const token = await createSessionToken(60);
		expect(await verifySessionToken(token)).toBe(true);
		const request = new NextRequest("http://localhost/api/tasks");
		request.cookies.set("gutter-session", token);
		expect(request.cookies.get("gutter-session")?.value).toBe(token);
		const response = await middleware(request);
		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-next")).toBe("1");
	});

	it("rejects a signed token after its payload is modified", async () => {
		const token = await createSessionToken(60);
		const forged = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
		expect(await verifySessionToken(forged)).toBe(false);
	});

	it("does not expose the former auth credential-debug GET handler", () => {
		expect("GET" in authRoute).toBe(false);
	});
});
