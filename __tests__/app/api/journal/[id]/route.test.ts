import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/journal/[id]/route";
import { getDb } from "@/lib/db";
import { clearRateLimitState } from "@/lib/rate-limit";

describe("PATCH /api/journal/[id]", () => {
	let db: ReturnType<typeof getDb>;

	beforeAll(() => {
		db = getDb();
	});

	beforeEach(() => {
		db.exec("DELETE FROM journal_entries WHERE date >= '2099-01-01'");
		clearRateLimitState();
	});

	afterEach(() => {
		db.exec("DELETE FROM journal_entries WHERE date >= '2099-01-01'");
	});

	it("returns 400 when ID is invalid", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal/invalid-id", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "done" }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "'; DROP TABLE journal_entries; --" }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Invalid");
	});

	it("returns 400 when status is invalid", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-1", "2099-01-01", "task", "Test task", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-1", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "invalid-status" }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-1" }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid status value");
	});

	it("returns 400 when signifier is invalid", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-2", "2099-01-01", "task", "Test task", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-2", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ signifier: "invalid-signifier" }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-2" }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid signifier");
	});

	it("returns 400 when text is not a string", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-3", "2099-01-01", "task", "Test task", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-3", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: 12345 }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-3" }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Text must be a string");
	});

	it("returns 400 when text exceeds 50000 characters", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-4", "2099-01-01", "task", "Test task", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-4", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "x".repeat(50001) }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-4" }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Text exceeds maximum length");
	});

	it("updates status successfully", async () => {
		const now = new Date().toISOString();
		const insertResult = db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-5", "2099-01-01", "task", "Test task", "open", 1, now, now);
		
		expect(insertResult.changes).toBe(1);

		// Verify insert worked
		const before = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-patch-5") as any;
		expect(before).toBeTruthy();
		expect(before.status).toBe("open");

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-5", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "done" }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-5" }) });
		expect(res.status).toBe(200);

		const updated = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-patch-5") as any;
		expect(updated).toBeTruthy();
		expect(updated.status).toBe("done");
	});

	it("updates text and sanitizes it", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-6", "2099-01-01", "task", "Old text", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-6", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: '<script>alert("xss")</script>New text' }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-6" }) });
		expect(res.status).toBe(200);

		const updated = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-patch-6") as any;
		expect(updated.text).not.toContain("<script>");
		expect(updated.text).toContain("New text");
	});

	it("updates multiple fields at once", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-7", "2099-01-01", "task", "Old text", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-7", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				status: "in-progress",
				text: "Updated text",
				signifier: "○",
			}),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-7" }) });
		expect(res.status).toBe(200);

		const updated = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-patch-7") as any;
		expect(updated.status).toBe("in-progress");
		expect(updated.text).toBe("Updated text");
		expect(updated.signifier).toBe("○");
	});

	it("updates sort_order", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-8", "2099-01-01", "task", "Test task", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-8", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sort_order: 5 }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-8" }) });
		expect(res.status).toBe(200);

		const updated = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-patch-8") as any;
		expect(updated.sort_order).toBe(5);
	});

	it("updates updated_at timestamp", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-patch-9", "2099-01-01", "task", "Test task", "open", 1, now, now);

		// Wait a bit to ensure timestamp changes
		await new Promise((resolve) => setTimeout(resolve, 10));

		const req = new NextRequest("http://localhost:3000/api/journal/test-patch-9", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "done" }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "test-patch-9" }) });
		expect(res.status).toBe(200);

		const updated = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-patch-9") as any;
		expect(updated.updated_at).not.toBe(now);
		expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(new Date(now).getTime());
	});
});

describe("DELETE /api/journal/[id]", () => {
	let db: ReturnType<typeof getDb>;

	beforeAll(() => {
		db = getDb();
	});

	beforeEach(() => {
		db.exec("DELETE FROM journal_entries WHERE date >= '2099-01-01'");
		clearRateLimitState();
	});

	afterEach(() => {
		db.exec("DELETE FROM journal_entries WHERE date >= '2099-01-01'");
	});

	it("returns 400 when ID is invalid", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal/invalid-id", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "'; DROP TABLE journal_entries; --" }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Invalid");
	});

	it("soft deletes by default (sets status to killed)", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-del-1", "2099-01-01", "task", "Test task", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-del-1", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "test-del-1" }) });
		expect(res.status).toBe(200);

		const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-del-1") as any;
		expect(entry).toBeTruthy();
		expect(entry.status).toBe("killed");
	});

	it("hard deletes when ?hard=true", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-del-2", "2099-01-01", "task", "Test task", "open", 1, now, now);

		const req = new NextRequest("http://localhost:3000/api/journal/test-del-2?hard=true", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "test-del-2" }) });
		expect(res.status).toBe(200);

		const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-del-2");
		expect(entry).toBeFalsy(); // null or undefined
	});

	it("updates updated_at when soft deleting", async () => {
		const now = new Date().toISOString();
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-del-3", "2099-01-01", "task", "Test task", "open", 1, now, now);

		// Wait a bit to ensure timestamp changes
		await new Promise((resolve) => setTimeout(resolve, 10));

		const req = new NextRequest("http://localhost:3000/api/journal/test-del-3", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "test-del-3" }) });
		expect(res.status).toBe(200);

		const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("test-del-3") as any;
		expect(entry.updated_at).not.toBe(now);
		expect(new Date(entry.updated_at).getTime()).toBeGreaterThan(new Date(now).getTime());
	});

	it("returns success even if entry doesn't exist (idempotent soft delete)", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal/nonexistent-id", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "nonexistent-id" }) });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("returns success even if entry doesn't exist (idempotent hard delete)", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal/nonexistent-id?hard=true", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "nonexistent-id" }) });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});
});
