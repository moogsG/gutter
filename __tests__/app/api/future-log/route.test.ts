import { beforeEach, describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/future-log/route";
import { getDb } from "@/lib/db";
import { clearRateLimitState } from "@/lib/rate-limit";

describe("GET /api/future-log", () => {
	beforeEach(() => {
		// Clear database
		const db = getDb();
		db.exec("DELETE FROM future_log");

		// Clear rate limit state
		clearRateLimitState();
	});

	test("returns empty array when no entries exist", async () => {
		const req = new NextRequest("http://localhost/api/future-log");
		const response = await GET(req as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual([]);
	});

	test("returns all entries ordered by target_month then created_at", async () => {
		const db = getDb();
		const now = Date.now();

		// Insert entries in mixed order
		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run(
			"fl-1",
			"2026-05",
			"•",
			"May task",
			0,
			new Date(now - 3000).toISOString(),
		);

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run(
			"fl-2",
			"2026-04",
			"•",
			"April task",
			0,
			new Date(now - 2000).toISOString(),
		);

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run(
			"fl-3",
			"2026-04",
			"•",
			"Another April task",
			0,
			new Date(now - 1000).toISOString(),
		);

		const req = new NextRequest("http://localhost/api/future-log");
		const response = await GET(req as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(3);
		// Should be sorted by month, then by created_at
		expect(data[0].target_month).toBe("2026-04");
		expect(data[0].id).toBe("fl-2"); // Earlier created_at
		expect(data[1].target_month).toBe("2026-04");
		expect(data[1].id).toBe("fl-3"); // Later created_at
		expect(data[2].target_month).toBe("2026-05");
	});

	test("filters by month when query param provided", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("fl-1", "2026-04", "•", "April task", 0, now);

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("fl-2", "2026-05", "•", "May task", 0, now);

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("fl-3", "2026-04", "•", "Another April task", 0, now);

		const req = new NextRequest("http://localhost/api/future-log?month=2026-04");
		const response = await GET(req as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(2);
		expect(data.every((e: any) => e.target_month === "2026-04")).toBe(true);
	});

	test("converts migrated from number to boolean", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("fl-1", "2026-04", "•", "Not migrated", 0, now);

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("fl-2", "2026-04", "•", "Migrated", 1, now);

		const req = new NextRequest("http://localhost/api/future-log");
		const response = await GET(req as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data[0].migrated).toBe(false);
		expect(data[1].migrated).toBe(true);
		expect(typeof data[0].migrated).toBe("boolean");
		expect(typeof data[1].migrated).toBe("boolean");
	});

	test("includes all future log fields", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("fl-test", "2026-06", "→", "Test entry", 0, now);

		const req = new NextRequest("http://localhost/api/future-log");
		const response = await GET(req as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0]).toMatchObject({
			id: "fl-test",
			target_month: "2026-06",
			signifier: "→",
			text: "Test entry",
			migrated: false,
			created_at: now,
		});
	});

	test("respects rate limit", async () => {
		const req = new NextRequest("http://localhost/api/future-log");

		// Make 50 requests (limit)
		for (let i = 0; i < 50; i++) {
			const response = await GET(req as any);
			expect(response.status).toBe(200);
		}

		// 51st request should be rate limited
		const response = await GET(req as any);
		expect(response.status).toBe(429);
	});
});

describe("POST /api/future-log", () => {
	beforeEach(() => {
		// Clear database
		const db = getDb();
		db.exec("DELETE FROM future_log");

		// Clear rate limit state
		clearRateLimitState();
	});

	test("creates future log entry with all fields", async () => {
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target_month: "2026-07",
				signifier: "→",
				text: "Future task",
			}),
		});

		const response = await POST(req as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.id).toMatch(/^fl-\d+$/);
		expect(data.target_month).toBe("2026-07");
		expect(data.signifier).toBe("→");
		expect(data.text).toBe("Future task");
		expect(data.migrated).toBe(false);
		expect(data.created_at).toBeDefined();
	});

	test("returns 400 when target_month is missing", async () => {
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ signifier: "•", text: "Task" }),
		});

		const response = await POST(req as any);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("Missing required fields");
	});

	test("returns 400 when signifier is missing", async () => {
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ target_month: "2026-07", text: "Task" }),
		});

		const response = await POST(req as any);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("Missing required fields");
	});

	test("returns 400 when text is missing", async () => {
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ target_month: "2026-07", signifier: "•" }),
		});

		const response = await POST(req as any);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("Missing required fields");
	});

	test("returns 400 when all fields are empty strings", async () => {
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ target_month: "", signifier: "", text: "" }),
		});

		const response = await POST(req as any);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("Missing required fields");
	});

	test("defaults migrated to false", async () => {
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target_month: "2026-08",
				signifier: "•",
				text: "Not migrated yet",
			}),
		});

		const response = await POST(req as any);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.migrated).toBe(false);
	});

	test("persists entry to database", async () => {
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target_month: "2026-09",
				signifier: "!",
				text: "Important future task",
			}),
		});

		const response = await POST(req as any);
		const data = await response.json();

		// Verify it exists in database
		const db = getDb();
		const entry = db
			.prepare("SELECT * FROM future_log WHERE id = ?")
			.get(data.id);

		expect(entry).toBeDefined();
		expect((entry as any).target_month).toBe("2026-09");
		expect((entry as any).signifier).toBe("!");
		expect((entry as any).text).toBe("Important future task");
		expect((entry as any).migrated).toBe(0); // DB stores as 0/1
	});

	test("generates unique IDs for multiple entries", async () => {
		const req1 = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target_month: "2026-10",
				signifier: "•",
				text: "Entry 1",
			}),
		});

		const req2 = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target_month: "2026-10",
				signifier: "•",
				text: "Entry 2",
			}),
		});

		const response1 = await POST(req1 as any);
		const data1 = await response1.json();

		// Wait 1ms to ensure different timestamps
		await new Promise((resolve) => setTimeout(resolve, 1));

		const response2 = await POST(req2 as any);
		const data2 = await response2.json();

		expect(data1.id).not.toBe(data2.id);
	});

	test("respects rate limit", async () => {
		// Make 20 requests (limit)
		for (let i = 0; i < 20; i++) {
			const req = new NextRequest("http://localhost/api/future-log", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					target_month: "2026-11",
					signifier: "•",
					text: `Entry ${i}`,
				}),
			});
			const response = await POST(req as any);
			expect(response.status).toBe(200);

			// Wait 1ms to avoid duplicate IDs
			await new Promise((resolve) => setTimeout(resolve, 1));
		}

		// 21st request should be rate limited
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target_month: "2026-11",
				signifier: "•",
				text: "Over limit",
			}),
		});
		const response = await POST(req as any);
		expect(response.status).toBe(429);
	});

	test("handles malformed JSON gracefully", async () => {
		const req = new NextRequest("http://localhost/api/future-log", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "invalid json{",
		});

		const response = await POST(req as any);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBeDefined();
	});
});
