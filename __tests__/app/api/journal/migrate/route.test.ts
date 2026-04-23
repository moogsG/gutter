import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/journal/migrate/route";
import { getDb } from "@/lib/db";
import { clearRateLimitState } from "@/lib/rate-limit";

describe("POST /api/journal/migrate", () => {
	let db: ReturnType<typeof getDb>;

	beforeAll(() => {
		db = getDb();
	});

	beforeEach(() => {
		db.prepare("DELETE FROM journal_entries WHERE id LIKE 'migrate-test-%'").run();
		db.prepare("DELETE FROM journal_entries WHERE text LIKE 'migrate-test-%'").run();
		clearRateLimitState();
	});

	afterEach(() => {
		db.prepare("DELETE FROM journal_entries WHERE id LIKE 'migrate-test-%'").run();
		db.prepare("DELETE FROM journal_entries WHERE text LIKE 'migrate-test-%'").run();
	});

	it("migrates to the provided targetDate", async () => {
		const now = new Date().toISOString();
		const targetDate = "2099-12-31";

		db.prepare(
			`INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"migrate-test-source-1",
			"2099-01-01",
			"task",
			"migrate-test-source-1",
			"open",
			0,
			now,
			now,
		);

		const req = new NextRequest("http://localhost:3000/api/journal/migrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entryIds: ["migrate-test-source-1"],
				targetDate,
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.targetDate).toBe(targetDate);
		expect(body.requestedCount).toBe(1);
		expect(body.migratedCount).toBe(1);
		expect(body.skippedCount).toBe(0);

		const original = db
			.prepare("SELECT status, migrated_to FROM journal_entries WHERE id = ?")
			.get("migrate-test-source-1") as any;
		expect(original.status).toBe("migrated");
		expect(original.migrated_to).toBe(targetDate);

		const migratedEntries = db
			.prepare(
				"SELECT date, status, text, signifier, migrated_from FROM journal_entries WHERE text = ? AND id != ?",
			)
			.all("migrate-test-source-1", "migrate-test-source-1") as any[];

		expect(migratedEntries).toHaveLength(1);
		expect(migratedEntries[0].date).toBe(targetDate);
		expect(migratedEntries[0].status).toBe("open");
		expect(migratedEntries[0].text).toBe("migrate-test-source-1");
		expect(migratedEntries[0].signifier).toBe("task");
		expect(migratedEntries[0].migrated_from).toBe("2099-01-01");
	});

	it("rejects invalid payloads", async () => {
		const missingEntryIdsReq = new NextRequest("http://localhost:3000/api/journal/migrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		const missingEntryIdsRes = await POST(missingEntryIdsReq);
		expect(missingEntryIdsRes.status).toBe(400);
		const missingEntryIdsBody = await missingEntryIdsRes.json();
		expect(missingEntryIdsBody.error).toBe("entryIds must be a non-empty array");

		const req = new NextRequest("http://localhost:3000/api/journal/migrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ entryIds: ["valid-id", "", 123], targetDate: "2099-01-01" }),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);

		const body = await res.json();
		expect(body.error).toBe("entryIds must contain valid string IDs");

		const missingTargetDateReq = new NextRequest("http://localhost:3000/api/journal/migrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ entryIds: ["valid-id"] }),
		});

		const missingTargetDateRes = await POST(missingTargetDateReq);
		expect(missingTargetDateRes.status).toBe(400);
		const missingTargetDateBody = await missingTargetDateRes.json();
		expect(missingTargetDateBody.error).toBe(
			"targetDate must be a valid YYYY-MM-DD date",
		);

		const invalidTargetDateReq = new NextRequest("http://localhost:3000/api/journal/migrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ entryIds: ["valid-id"], targetDate: "01-01-2099" }),
		});

		const invalidTargetDateRes = await POST(invalidTargetDateReq);
		expect(invalidTargetDateRes.status).toBe(400);
		const invalidTargetDateBody = await invalidTargetDateRes.json();
		expect(invalidTargetDateBody.error).toBe(
			"targetDate must be a valid YYYY-MM-DD date",
		);
	});

	it("rejects duplicate entry IDs", async () => {
		const req = new NextRequest("http://localhost:3000/api/journal/migrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entryIds: ["migrate-test-source-dup", "migrate-test-source-dup"],
				targetDate: "2099-01-01",
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(400);

		const body = await res.json();
		expect(body.error).toBe("entryIds must not contain duplicates");
	});

	it("skips entries already on targetDate and returns accurate counts", async () => {
		const now = new Date().toISOString();
		const targetDate = "2099-01-10";

		db.prepare(
			`INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"migrate-test-source-2",
			"2099-01-02",
			"note",
			"migrate-test-source-2",
			"open",
			0,
			now,
			now,
		);

		db.prepare(
			`INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"migrate-test-source-tomorrow",
			targetDate,
			"task",
			"migrate-test-source-tomorrow",
			"open",
			1,
			now,
			now,
		);

		const req = new NextRequest("http://localhost:3000/api/journal/migrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entryIds: [
					"migrate-test-source-2",
					"migrate-test-source-tomorrow",
					"migrate-test-missing",
				],
				targetDate,
			}),
		});

		const res = await POST(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.requestedCount).toBe(3);
		expect(body.migratedCount).toBe(1);
		expect(body.skippedCount).toBe(2);
		expect(body.targetDate).toBe(targetDate);

		const migratedOriginal = db
			.prepare("SELECT status, migrated_to FROM journal_entries WHERE id = ?")
			.get("migrate-test-source-2") as any;
		expect(migratedOriginal.status).toBe("migrated");
		expect(migratedOriginal.migrated_to).toBe(targetDate);

		const tomorrowOriginal = db
			.prepare("SELECT status, migrated_to FROM journal_entries WHERE id = ?")
			.get("migrate-test-source-tomorrow") as any;
		expect(tomorrowOriginal.status).toBe("open");
		expect(tomorrowOriginal.migrated_to).toBeNull();

		const createdEntries = db
			.prepare("SELECT date, status FROM journal_entries WHERE text = ? AND id != ?")
			.all("migrate-test-source-2", "migrate-test-source-2") as any[];
		expect(createdEntries).toHaveLength(1);
		expect(createdEntries[0].date).toBe(targetDate);
		expect(createdEntries[0].status).toBe("open");
	});

	it("preserves task metadata when migrating", async () => {
		const now = new Date().toISOString();
		const targetDate = "2099-01-11";

		db.prepare(
			`INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, lane, priority, waiting_on, parent_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"migrate-test-source-meta",
			"2099-01-03",
			"task",
			"migrate-test-source-meta",
			"open",
			0,
			"work",
			"high",
			"Alex",
			null,
			now,
			now,
		);

		const req = new NextRequest("http://localhost:3000/api/journal/migrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ entryIds: ["migrate-test-source-meta"], targetDate }),
		});

		const res = await POST(req);
		expect(res.status).toBe(200);

		const migrated = db
			.prepare(
				"SELECT date, status, lane, priority, waiting_on, parent_id FROM journal_entries WHERE text = ? AND id != ?",
			)
			.get("migrate-test-source-meta", "migrate-test-source-meta") as any;

		expect(migrated.date).toBe(targetDate);
		expect(migrated.status).toBe("open");
		expect(migrated.lane).toBe("work");
		expect(migrated.priority).toBe("high");
		expect(migrated.waiting_on).toBe("Alex");
		expect(migrated.parent_id).toBeNull();
	});
});
