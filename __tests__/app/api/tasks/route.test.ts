import { beforeEach, describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/tasks/route";
import { getDb } from "@/lib/db";
import { clearRateLimitState } from "@/lib/rate-limit";

describe("GET /api/tasks", () => {
	beforeEach(() => {
		// Clear database
		const db = getDb();
		db.exec("DELETE FROM journal_entries");

		// Clear rate limit state
		clearRateLimitState();
	});

	test("returns empty array when no tasks exist", async () => {
		const req = new NextRequest("http://localhost/api/tasks");
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual([]);
	});

	test("returns only task signifier entries by default (status=open)", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		// Insert task
		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "My task", "task", "open", 1, now, now);

		// Insert note (should be excluded)
		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("n1", "2026-03-26", "My note", "note", "open", 2, now, now);

		const req = new NextRequest("http://localhost/api/tasks");
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0].id).toBe("t1");
	});

	test("filters by status=todo (maps to open)", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "Open task", "task", "open", 1, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t2", "2026-03-26", "Done task", "task", "done", 2, now, now);

		const req = new NextRequest("http://localhost/api/tasks?status=todo");
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0].status).toBe("open");
	});

	test("filters by status=in-progress", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "Open task", "task", "open", 1, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t2", "2026-03-26", "In progress", "task", "in-progress", 2, now, now);

		const req = new NextRequest(
			"http://localhost/api/tasks?status=in-progress",
		);
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0].status).toBe("in-progress");
	});

	test("filters by status=blocked", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "Blocked task", "task", "blocked", 1, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t2", "2026-03-26", "Open task", "task", "open", 2, now, now);

		const req = new NextRequest("http://localhost/api/tasks?status=blocked");
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0].status).toBe("blocked");
	});

	test("filters by status=done", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "Done task", "task", "done", 1, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t2", "2026-03-26", "Open task", "task", "open", 2, now, now);

		const req = new NextRequest("http://localhost/api/tasks?status=done");
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0].status).toBe("done");
	});

	test("filters by comma-separated statuses", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "Open task", "task", "open", 1, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t2", "2026-03-26", "Blocked task", "task", "blocked", 2, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t3", "2026-03-26", "Done task", "task", "done", 3, now, now);

		const req = new NextRequest(
			"http://localhost/api/tasks?status=open,blocked",
		);
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(2);
		expect(data.some((t: any) => t.status === "open")).toBe(true);
		expect(data.some((t: any) => t.status === "blocked")).toBe(true);
		expect(data.some((t: any) => t.status === "done")).toBe(false);
	});

	test("filters by date", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "Today task", "task", "open", 1, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t2", "2026-03-27", "Tomorrow task", "task", "open", 2, now, now);

		const req = new NextRequest(
			"http://localhost/api/tasks?status=open&date=2026-03-26",
		);
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0].date).toBe("2026-03-26");
	});

	test("respects limit parameter", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		// Insert 10 tasks
		for (let i = 1; i <= 10; i++) {
			db.prepare(
				"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			).run(`t${i}`, "2026-03-26", `Task ${i}`, "task", "open", i, now, now);
		}

		const req = new NextRequest("http://localhost/api/tasks?limit=5");
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(5);
	});

	test("sorts by date DESC, sort_order ASC", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-25", "Old task 2", "task", "open", 2, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t2", "2026-03-26", "New task 1", "task", "open", 1, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t3", "2026-03-26", "New task 2", "task", "open", 2, now, now);

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t4", "2026-03-25", "Old task 1", "task", "open", 1, now, now);

		const req = new NextRequest("http://localhost/api/tasks");
		const response = await GET(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(4);
		// Should be sorted by date DESC, then sort_order ASC
		expect(data[0].id).toBe("t2"); // 2026-03-26, sort_order 1
		expect(data[1].id).toBe("t3"); // 2026-03-26, sort_order 2
		expect(data[2].id).toBe("t4"); // 2026-03-25, sort_order 1
		expect(data[3].id).toBe("t1"); // 2026-03-25, sort_order 2
	});

	test("respects rate limit", async () => {
		const req = new NextRequest("http://localhost/api/tasks");

		// Make 100 requests (limit)
		for (let i = 0; i < 100; i++) {
			const response = await GET(req);
			expect(response.status).toBe(200);
		}

		// 101st request should be rate limited
		const response = await GET(req);
		expect(response.status).toBe(429);
	});
});

describe("POST /api/tasks", () => {
	beforeEach(() => {
		// Clear database
		const db = getDb();
		db.exec("DELETE FROM journal_entries");

		// Clear rate limit state
		clearRateLimitState();
	});

	test("completes a task (action=complete)", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "My task", "task", "open", 1, now, now);

		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "complete", taskId: "t1" }),
		});

		const response = await POST(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ok).toBe(true);

		// Verify task status updated
		const task = db
			.prepare("SELECT * FROM journal_entries WHERE id = ?")
			.get("t1") as any;
		expect(task.status).toBe("done");
	});

	test("moves task to in-progress", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "My task", "task", "open", 1, now, now);

		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "move",
				taskId: "t1",
				status: "in-progress",
			}),
		});

		const response = await POST(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ok).toBe(true);

		// Verify task status updated
		const task = db
			.prepare("SELECT * FROM journal_entries WHERE id = ?")
			.get("t1") as any;
		expect(task.status).toBe("in-progress");
	});

	test("moves task to blocked", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "My task", "task", "open", 1, now, now);

		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "move", taskId: "t1", status: "blocked" }),
		});

		const response = await POST(req);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ok).toBe(true);

		// Verify task status updated
		const task = db
			.prepare("SELECT * FROM journal_entries WHERE id = ?")
			.get("t1") as any;
		expect(task.status).toBe("blocked");
	});

	test("returns 400 when action is missing", async () => {
		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ taskId: "t1" }),
		});

		const response = await POST(req);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("Invalid or missing action");
	});

	test("returns 400 when action is invalid", async () => {
		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "delete", taskId: "t1" }),
		});

		const response = await POST(req);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("Invalid or missing action");
	});

	test("returns 400 when taskId is missing", async () => {
		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "complete" }),
		});

		const response = await POST(req);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("taskId is required");
	});

	test("returns 400 when status is missing for move action", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "My task", "task", "open", 1, now, now);

		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "move", taskId: "t1" }),
		});

		const response = await POST(req);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("status is required for move action");
	});

	test("returns 400 when status is invalid for move action", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "My task", "task", "open", 1, now, now);

		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "move",
				taskId: "t1",
				status: "invalid-status",
			}),
		});

		const response = await POST(req);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain("Invalid status");
	});

	test("updates updated_at timestamp when completing task", async () => {
		const db = getDb();
		const now = new Date(Date.now() - 10000).toISOString(); // 10s ago

		db.prepare(
			"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("t1", "2026-03-26", "My task", "task", "open", 1, now, now);

		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "complete", taskId: "t1" }),
		});

		await POST(req);

		const task = db
			.prepare("SELECT * FROM journal_entries WHERE id = ?")
			.get("t1") as any;

		// updated_at should be more recent than created_at
		expect(new Date(task.updated_at).getTime()).toBeGreaterThan(
			new Date(now).getTime(),
		);
	});

	test("respects rate limit", async () => {
		const db = getDb();
		const now = new Date().toISOString();

		// Create 30 tasks
		for (let i = 1; i <= 30; i++) {
			db.prepare(
				"INSERT INTO journal_entries (id, date, text, signifier, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			).run(`t${i}`, "2026-03-26", `Task ${i}`, "task", "open", i, now, now);
		}

		// Make 30 requests (limit)
		for (let i = 1; i <= 30; i++) {
			const req = new NextRequest("http://localhost/api/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "complete", taskId: `t${i}` }),
			});
			const response = await POST(req);
			expect(response.status).toBe(200);
		}

		// 31st request should be rate limited
		const req = new NextRequest("http://localhost/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "complete", taskId: "t1" }),
		});
		const response = await POST(req);
		expect(response.status).toBe(429);
	});
});
