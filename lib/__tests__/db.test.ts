import { existsSync, unlinkSync } from "node:fs";
import Database from "@/lib/sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DB_PATH = "./test-tasks.db";

describe("Database operations", () => {
	let db: Database;

	beforeAll(() => {
		db = new Database(TEST_DB_PATH);
		db.pragma("journal_mode = WAL");

		// Create tables
		db.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        signifier TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        migrated_to TEXT,
        migrated_from TEXT,
        collection_id TEXT,
        tags TEXT DEFAULT '[]',
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        icon TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
	});

	afterAll(() => {
		// Close this test's isolated DB instance (not the global singleton)
		db.close();
		if (existsSync(TEST_DB_PATH)) {
			unlinkSync(TEST_DB_PATH);
		}
		// Clean up WAL files
		[`${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach((f) => {
			if (existsSync(f)) unlinkSync(f);
		});
	});

	describe("journal_entries CRUD", () => {
		it("creates a new journal entry", () => {
			const id = "test-1";
			const stmt = db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			);

			stmt.run(id, "2026-03-10", "task", "Test task", "open", 0);

			const entry = db
				.prepare("SELECT * FROM journal_entries WHERE id = ?")
				.get(id);
			expect(entry).toBeDefined();
			expect(entry).toMatchObject({
				id: "test-1",
				text: "Test task",
				signifier: "task",
				status: "open",
			});
		});

		it("retrieves entries by date", () => {
			db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			).run("test-2", "2026-03-11", "note", "Daily note", "open", 0);

			const entries = db
				.prepare(
					"SELECT * FROM journal_entries WHERE date = ? ORDER BY sort_order",
				)
				.all("2026-03-11");

			expect(entries).toHaveLength(1);
			expect(entries[0].text).toBe("Daily note");
		});

		it("updates entry status", () => {
			const id = "test-3";
			db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			).run(id, "2026-03-10", "task", "Completeable task", "open", 1);

			db.prepare("UPDATE journal_entries SET status = ? WHERE id = ?").run(
				"complete",
				id,
			);

			const entry = db
				.prepare("SELECT * FROM journal_entries WHERE id = ?")
				.get(id);
			expect(entry).toMatchObject({ status: "complete" });
		});

		it("deletes an entry", () => {
			const id = "test-4";
			db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			).run(id, "2026-03-10", "event", "Deletable event", "open", 2);

			db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);

			const entry = db
				.prepare("SELECT * FROM journal_entries WHERE id = ?")
				.get(id);
			// Bun's sqlite returns null, better-sqlite3 returns undefined
			expect(entry).toBeFalsy();
		});

		it("filters entries by signifier", () => {
			db.exec("DELETE FROM journal_entries");

			db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			).run("task-1", "2026-03-12", "task", "Task 1", "open", 0);

			db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			).run("note-1", "2026-03-12", "note", "Note 1", "open", 1);

			const tasks = db
				.prepare("SELECT * FROM journal_entries WHERE signifier = ?")
				.all("task");

			expect(tasks).toHaveLength(1);
			expect(tasks[0].text).toBe("Task 1");
		});
	});

	describe("collections", () => {
		it("creates a collection", () => {
			const id = "coll-1";
			db.prepare(
				"INSERT INTO collections (id, title, icon) VALUES (?, ?, ?)",
			).run(id, "Work", "💼");

			const collection = db
				.prepare("SELECT * FROM collections WHERE id = ?")
				.get(id);
			expect(collection).toMatchObject({
				id: "coll-1",
				title: "Work",
				icon: "💼",
			});
		});

		it("links entry to collection", () => {
			const collId = "coll-2";
			const entryId = "entry-coll-1";

			db.prepare("INSERT INTO collections (id, title) VALUES (?, ?)").run(
				collId,
				"Projects",
			);
			db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, collection_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
			).run(entryId, "2026-03-10", "task", "Project task", "open", collId, 0);

			const entry = db
				.prepare("SELECT * FROM journal_entries WHERE id = ?")
				.get(entryId);
			expect(entry.collection_id).toBe(collId);
		});
	});

	describe("migration", () => {
		it("migrates entry to another date", () => {
			const srcId = "mig-src-1";
			const destId = "mig-dest-1";

			db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
			).run(srcId, "2026-03-10", "task", "Migrate me", "open", 0);

			// Mark source as migrated
			db.prepare(
				"UPDATE journal_entries SET status = ?, migrated_to = ? WHERE id = ?",
			).run("migrated", destId, srcId);

			// Create destination entry
			db.prepare(
				"INSERT INTO journal_entries (id, date, signifier, text, status, migrated_from, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
			).run(destId, "2026-03-11", "task", "Migrate me", "open", srcId, 0);

			const src = db
				.prepare("SELECT * FROM journal_entries WHERE id = ?")
				.get(srcId);
			const dest = db
				.prepare("SELECT * FROM journal_entries WHERE id = ?")
				.get(destId);

			expect(src.status).toBe("migrated");
			expect(src.migrated_to).toBe(destId);
			expect(dest.migrated_from).toBe(srcId);
		});
	});
});
