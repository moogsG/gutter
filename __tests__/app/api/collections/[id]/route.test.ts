import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/collections/[id]/route";
import { getDb } from "@/lib/db";
import { clearRateLimitState } from "@/lib/rate-limit";

describe("GET /api/collections/[id]", () => {
	beforeEach(() => {
		const db = getDb();
		db.exec("DELETE FROM journal_entries");
		db.exec("DELETE FROM collections");
		clearRateLimitState();
	});

	it("returns the collection and its projected entries newest day first", async () => {
		const db = getDb();
		const now = "2026-09-02T12:00:00.000Z";
		db.prepare("INSERT INTO collections (id, title, icon, created_at) VALUES (?, ?, ?, ?)")
			.run("col-reading", "Reading", "book", now);
		db.prepare(`INSERT INTO journal_entries
			(id, date, signifier, text, status, tags, sort_order, collection_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
			.run("entry-2", "2026-09-02", "note", "Second", "open", "[]", 2, "col-reading", now, now);
		db.prepare(`INSERT INTO journal_entries
			(id, date, signifier, text, status, tags, sort_order, collection_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
			.run("entry-1", "2026-09-01", "task", "First", "done", '["books"]', 1, "col-reading", now, now);

		const response = await GET(
			new Request("http://localhost/api/collections/col-reading") as any,
			{ params: Promise.resolve({ id: "col-reading" }) },
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({ id: "col-reading", title: "Reading", icon: "book" });
		expect(body.entries).toEqual([
			expect.objectContaining({ id: "entry-2", text: "Second", tags: [] }),
			expect.objectContaining({ id: "entry-1", text: "First", tags: ["books"] }),
		]);
	});

	it("returns 404 when the collection does not exist", async () => {
		const response = await GET(
			new Request("http://localhost/api/collections/col-missing") as any,
			{ params: Promise.resolve({ id: "col-missing" }) },
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Collection not found" });
	});

	it("rejects unsafe collection ids before querying", async () => {
		const response = await GET(
			new Request("http://localhost/api/collections/bad") as any,
			{ params: Promise.resolve({ id: "col'; DROP TABLE collections;--" }) },
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Invalid ID format" });
	});
});
