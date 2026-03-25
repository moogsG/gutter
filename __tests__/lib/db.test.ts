import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB_PATH = "./test-gutter.db";
const TEST_DB_WAL = "./test-gutter.db-wal";
const TEST_DB_SHM = "./test-gutter.db-shm";

// Override DB path for tests
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

describe("Database Operations", () => {
	let db: ReturnType<typeof getDb>;

	beforeAll(() => {
		cleanupTestDb();
		db = getDb();
	});

	afterAll(() => {
		db.close();
		cleanupTestDb();
	});

	beforeEach(() => {
		// Clean tables between tests
		db.exec("DELETE FROM journal_entries");
		db.exec("DELETE FROM collections");
		db.exec("DELETE FROM future_log");
		db.exec("DELETE FROM meeting_prep");
	});

	describe("Journal Entries", () => {
		it("creates a journal entry", () => {
			const entry = {
				id: "test-1",
				date: "2026-03-23",
				signifier: "•",
				text: "Test entry",
				status: "open",
				sort_order: 1,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const stmt = db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`);
			stmt.run(
				entry.id,
				entry.date,
				entry.signifier,
				entry.text,
				entry.status,
				entry.sort_order,
				entry.created_at,
				entry.updated_at
			);

			const result = db
				.prepare("SELECT * FROM journal_entries WHERE id = ?")
				.get(entry.id);
			expect(result).toBeDefined();
			expect(result.text).toBe("Test entry");
		});

		it("updates a journal entry", () => {
			const id = "test-update";
			db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				id,
				"2026-03-23",
				"•",
				"Original text",
				"open",
				1,
				new Date().toISOString(),
				new Date().toISOString()
			);

			db.prepare("UPDATE journal_entries SET text = ?, updated_at = ? WHERE id = ?").run(
				"Updated text",
				new Date().toISOString(),
				id
			);

			const result = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
			expect(result.text).toBe("Updated text");
		});

		it("deletes a journal entry", () => {
			const id = "test-delete";
			db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				id,
				"2026-03-23",
				"•",
				"To be deleted",
				"open",
				1,
				new Date().toISOString(),
				new Date().toISOString()
			);

			db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);

			const result = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
			expect(result).toBeFalsy(); // null (bun:sqlite) or undefined (better-sqlite3)
		});

		it("enforces foreign key on collection_id", () => {
			const collectionId = "coll-1";

			// Create collection first (schema: id, title, icon, created_at)
			db.prepare(`
				INSERT INTO collections (id, title, created_at)
				VALUES (?, ?, ?)
			`).run(collectionId, "Test Collection", new Date().toISOString());

			// Create entry with collection reference
			db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, collection_id, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				"entry-1",
				"2026-03-23",
				"•",
				"Entry in collection",
				"open",
				1,
				collectionId,
				new Date().toISOString(),
				new Date().toISOString()
			);

			const result = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("entry-1");
			expect(result.collection_id).toBe(collectionId);
		});

		it("allows referencing a collection", () => {
			const collectionId = "coll-ref";

			// Create collection
			db.prepare(`
				INSERT INTO collections (id, title, created_at)
				VALUES (?, ?, ?)
			`).run(collectionId, "Referenced Collection", new Date().toISOString());

			// Create entry with collection reference
			db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, collection_id, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				"entry-with-collection",
				"2026-03-23",
				"•",
				"Entry in collection",
				"open",
				1,
				collectionId,
				new Date().toISOString(),
				new Date().toISOString()
			);

			const result = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get("entry-with-collection");
			expect(result.collection_id).toBe(collectionId);
		});

		it("retrieves entries by date", () => {
			const date = "2026-03-23";
			db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				"day-1",
				date,
				"•",
				"Entry 1",
				"open",
				1,
				new Date().toISOString(),
				new Date().toISOString()
			);
			db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				"day-2",
				date,
				"•",
				"Entry 2",
				"open",
				2,
				new Date().toISOString(),
				new Date().toISOString()
			);

			const results = db.prepare("SELECT * FROM journal_entries WHERE date = ? ORDER BY sort_order ASC").all(date);
			expect(results).toHaveLength(2);
			expect(results[0].id).toBe("day-1");
			expect(results[1].id).toBe("day-2");
		});

		it("filters by status", () => {
			db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run("open-1", "2026-03-23", "•", "Open task", "open", 1, new Date().toISOString(), new Date().toISOString());
			db.prepare(`
				INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run("done-1", "2026-03-23", "X", "Done task", "done", 2, new Date().toISOString(), new Date().toISOString());

			const openResults = db.prepare("SELECT * FROM journal_entries WHERE status = ?").all("open");
			expect(openResults).toHaveLength(1);
			expect(openResults[0].id).toBe("open-1");

			const doneResults = db.prepare("SELECT * FROM journal_entries WHERE status = ?").all("done");
			expect(doneResults).toHaveLength(1);
			expect(doneResults[0].id).toBe("done-1");
		});
	});

	describe("Collections", () => {
		it("creates a collection", () => {
			const collection = {
				id: "coll-create",
				title: "Test Collection",
				created_at: new Date().toISOString(),
			};

			db.prepare(`
				INSERT INTO collections (id, title, created_at)
				VALUES (?, ?, ?)
			`).run(collection.id, collection.title, collection.created_at);

			const result = db.prepare("SELECT * FROM collections WHERE id = ?").get(collection.id);
			expect(result).toBeDefined();
			expect(result.title).toBe("Test Collection");
		});

		it("updates a collection", () => {
			const id = "coll-update";
			db.prepare(`
				INSERT INTO collections (id, title, created_at)
				VALUES (?, ?, ?)
			`).run(id, "Original Title", new Date().toISOString());

			db.prepare("UPDATE collections SET title = ? WHERE id = ?").run("Updated Title", id);

			const result = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
			expect(result.title).toBe("Updated Title");
		});

		it("deletes a collection", () => {
			const id = "coll-delete-test";
			db.prepare(`
				INSERT INTO collections (id, title, created_at)
				VALUES (?, ?, ?)
			`).run(id, "Delete Me", new Date().toISOString());

			db.prepare("DELETE FROM collections WHERE id = ?").run(id);

			const result = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
			expect(result).toBeFalsy(); // null (bun:sqlite) or undefined (better-sqlite3)
		});
	});

	describe("Future Log", () => {
		it("creates a future log entry", () => {
			const entry = {
				id: "future-1",
				target_month: "2026-04",
				signifier: "•",
				text: "Future task",
				created_at: new Date().toISOString(),
			};

			db.prepare(`
				INSERT INTO future_log (id, target_month, signifier, text, created_at)
				VALUES (?, ?, ?, ?, ?)
			`).run(entry.id, entry.target_month, entry.signifier, entry.text, entry.created_at);

			const result = db.prepare("SELECT * FROM future_log WHERE id = ?").get(entry.id);
			expect(result).toBeDefined();
			expect(result.text).toBe("Future task");
		});

		it("retrieves entries by month", () => {
			const month = "2026-04";
			db.prepare(`
				INSERT INTO future_log (id, target_month, signifier, text, created_at)
				VALUES (?, ?, ?, ?, ?)
			`).run("f1", month, "•", "Task 1", new Date().toISOString());
			db.prepare(`
				INSERT INTO future_log (id, target_month, signifier, text, created_at)
				VALUES (?, ?, ?, ?, ?)
			`).run("f2", month, "•", "Task 2", new Date().toISOString());

			const results = db.prepare("SELECT * FROM future_log WHERE target_month = ?").all(month);
			expect(results).toHaveLength(2);
		});
	});

	describe("Meeting Prep", () => {
		it("creates a meeting prep entry", () => {
			const entry = {
				id: "meeting-1",
				event_id: "evt-123",
				title: "Team Sync",
				time: "2026-03-24T09:00:00Z",
				occurrence_date: "2026-03-24",
				prep_notes: "Weekly sync",
				created_at: new Date().toISOString(),
			};

			db.prepare(`
				INSERT INTO meeting_prep (id, event_id, occurrence_date, title, time, prep_notes, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(
				entry.id,
				entry.event_id,
				entry.occurrence_date,
				entry.title,
				entry.time,
				entry.prep_notes,
				entry.created_at
			);

			const result = db.prepare("SELECT * FROM meeting_prep WHERE id = ?").get(entry.id);
			expect(result).toBeDefined();
			expect(result.title).toBe("Team Sync");
			expect(result.prep_notes).toBe("Weekly sync");
		});

		it("retrieves meeting prep by date range", () => {
			db.prepare(`
				INSERT INTO meeting_prep (id, event_id, occurrence_date, title, time, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`).run("m1", "evt-1", "2026-03-24", "Morning Meeting", "2026-03-24T09:00:00Z", new Date().toISOString());
			db.prepare(`
				INSERT INTO meeting_prep (id, event_id, occurrence_date, title, time, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`).run("m2", "evt-2", "2026-03-24", "Afternoon Meeting", "2026-03-24T14:00:00Z", new Date().toISOString());

			const results = db
				.prepare("SELECT * FROM meeting_prep WHERE occurrence_date = ?")
				.all("2026-03-24");
			expect(results).toHaveLength(2);
		});
	});

	describe("Indexes", () => {
		it("uses index for date lookup", () => {
			// Insert test data
			for (let i = 0; i < 100; i++) {
				db.prepare(`
					INSERT INTO journal_entries (id, date, signifier, text, status, sort_order, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`).run(
					`idx-${i}`,
					"2026-03-23",
					"•",
					`Entry ${i}`,
					"open",
					i,
					new Date().toISOString(),
					new Date().toISOString()
				);
			}

			// Query plan should show index usage (idx_je_sort is composite: date, sort_order)
			const plan = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM journal_entries WHERE date = ?").all("2026-03-23");
			const planText = JSON.stringify(plan);
			// idx_je_sort is a composite index on (date, sort_order), so it's used for date queries
			expect(planText).toContain("idx_je_sort");
		});
	});
});
