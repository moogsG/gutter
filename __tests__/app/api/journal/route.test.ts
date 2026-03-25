import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/journal/route";
import { getDb } from "@/lib/db";
import { clearRateLimitState } from "@/lib/rate-limit";
import { existsSync, unlinkSync } from "node:fs";

const TEST_DB_PATH = "./test-journal-api.db";
const TEST_DB_WAL = "./test-journal-api.db-wal";
const TEST_DB_SHM = "./test-journal-api.db-shm";

// Override DB path for tests
const originalDbPath = process.env.DATABASE_PATH;
process.env.DATABASE_PATH = TEST_DB_PATH;

function cleanupTestDb() {
	[TEST_DB_PATH, TEST_DB_WAL, TEST_DB_SHM].forEach((path) => {
		if (existsSync(path)) {
			try {
				unlinkSync(path);
			} catch (err) {
				// Ignore cleanup errors
			}
		}
	});
}

describe("GET /api/journal", () => {
	let db: ReturnType<typeof getDb>;

	beforeAll(() => {
		cleanupTestDb();
		db = getDb();
	});

	afterAll(() => {
		cleanupTestDb();
		if (originalDbPath) {
			process.env.DATABASE_PATH = originalDbPath;
		}
	});

	beforeEach(() => {
		// Clean up test data (using year 2099 for tests to avoid conflicts)
		db.exec("DELETE FROM journal_entries WHERE date >= '2099-01-01'");
		// Clear rate limits to avoid cross-test contamination
		clearRateLimitState();
	});

	afterEach(() => {
		db.exec("DELETE FROM journal_entries WHERE date >= '2099-01-01'");
	});

	it("returns 400 when date is missing", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal");
		const res = await GET(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Date required");
	});

	it("returns 400 when date format is invalid", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal?date=invalid-date");
		const res = await GET(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid date format. Use YYYY-MM-DD");
	});

	it("returns empty array when no entries exist", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal?date=2099-12-31");
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual([]);
	});

	it("returns entries for a given date", async () => {
		const date = "2099-01-01";
		const now = new Date().toISOString();

		// Insert test entries
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-1", date, "task", "First task", "open", 1, now, now);

		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-2", date, "note", "Second note", "open", 2, now, now);

		const req = new NextRequest(`http://localhost:3000/api/journal?date=${date}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toHaveLength(2);
		expect(body[0].id).toBe("test-1");
		expect(body[0].text).toBe("First task");
		expect(body[1].id).toBe("test-2");
		expect(body[1].text).toBe("Second note");
	});

	it("nests child entries under parents", async () => {
		const date = "2099-01-02";
		const now = new Date().toISOString();

		// Parent entry
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("parent-1", date, "task", "Parent task", "open", 1, now, now);

		// Child entry
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, parent_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run("child-1", date, "note", "Child note", "open", 1, "parent-1", now, now);

		const req = new NextRequest(`http://localhost:3000/api/journal?date=${date}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toHaveLength(1);
		expect(body[0].id).toBe("parent-1");
		expect(body[0].children).toHaveLength(1);
		expect(body[0].children[0].id).toBe("child-1");
		expect(body[0].children[0].parent_id).toBe("parent-1");
	});

	it("parses tags from JSON", async () => {
		const date = "2099-01-03";
		const now = new Date().toISOString();

		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, tags, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run("test-tags", date, "note", "Tagged entry", "open", JSON.stringify(["work", "urgent"]), 1, now, now);

		const req = new NextRequest(`http://localhost:3000/api/journal?date=${date}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body[0].tags).toEqual(["work", "urgent"]);
	});
});

describe("POST /api/journal", () => {
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

	it("returns 400 when required fields are missing", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ date: "2099-01-01" }), // missing signifier and text
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Missing required fields");
	});

	it("returns 400 when date format is invalid", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "invalid-date",
				signifier: "task",
				text: "Test",
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid date format");
	});

	it("returns 400 when signifier is invalid", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-01",
				signifier: "invalid-signifier",
				text: "Test",
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid signifier");
	});

	it("creates a journal entry successfully", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-01",
				signifier: "task",
				text: "New task",
				tags: ["work"],
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.id).toMatch(/^je-/);
		expect(body.date).toBe("2099-01-01");
		expect(body.signifier).toBe("task");
		expect(body.text).toBe("New task");
		expect(body.tags).toEqual(["work"]);
		expect(body.status).toBe("open");
		expect(body.sort_order).toBe(0);
	});

	it("assigns correct sort_order for top-level entries", async () => {
		// Create first entry
		const req1 = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-02",
				signifier: "task",
				text: "First task",
			}),
		});
		const res1 = await POST(req1);
		const body1 = await res1.json();
		expect(body1.sort_order).toBe(0);

		// Create second entry
		const req2 = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-02",
				signifier: "note",
				text: "Second note",
			}),
		});
		const res2 = await POST(req2);
		const body2 = await res2.json();
		expect(body2.sort_order).toBe(1);
	});

	it("assigns correct sort_order for child entries", async () => {
		const now = new Date().toISOString();

		// Create parent entry
		db.prepare(`
			INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run("parent-test", "2099-01-03", "task", "Parent", "open", 0, now, now);

		// Create first child
		const req1 = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-03",
				signifier: "note",
				text: "First child",
				parent_id: "parent-test",
			}),
		});
		const res1 = await POST(req1);
		const body1 = await res1.json();
		expect(body1.sort_order).toBe(0);

		// Create second child
		const req2 = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-03",
				signifier: "note",
				text: "Second child",
				parent_id: "parent-test",
			}),
		});
		const res2 = await POST(req2);
		const body2 = await res2.json();
		expect(body2.sort_order).toBe(1);
	});

	it("sanitizes text content", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-04",
				signifier: "note",
				text: '<script>alert("xss")</script>Safe text',
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		// DOMPurify should strip the script tag
		expect(body.text).not.toContain("<script>");
		expect(body.text).toContain("Safe text");
	});

	it("validates and sanitizes tags", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-05",
				signifier: "note",
				text: "Tagged note",
				tags: ["valid-tag", "a".repeat(100)], // second tag exceeds 50 char limit
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.tags[0]).toBe("valid-tag");
		expect(body.tags[1].length).toBe(50); // truncated
	});

	it("rejects entries with more than 20 tags", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-06",
				signifier: "note",
				text: "Over-tagged note",
				tags: Array(21).fill("tag"), // 21 tags
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Validation failed");
	});

	it("rejects text exceeding 50000 characters", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				date: "2099-01-07",
				signifier: "note",
				text: "x".repeat(50001),
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Validation failed");
	});
});
