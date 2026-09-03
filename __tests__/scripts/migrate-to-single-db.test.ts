import { existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Database from "@/lib/sqlite";
import { migrateDatabases } from "@/scripts/migrate-to-single-db";

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "gutter-consolidation-"));
	const legacyPath = join(root, "gutter.db");
	const primaryPath = join(root, "gutter-journal.db");
	const backupDir = join(root, "nested", "backups");
	const legacy = new Database(legacyPath);
	const primary = new Database(primaryPath);
	legacy.exec(`
			CREATE TABLE collections (id TEXT PRIMARY KEY, title TEXT NOT NULL, icon TEXT, created_at TEXT NOT NULL);
			CREATE TABLE journal_entries (id TEXT PRIMARY KEY, date TEXT NOT NULL, signifier TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
			CREATE TABLE future_log (id TEXT PRIMARY KEY, target_month TEXT NOT NULL, signifier TEXT NOT NULL, text TEXT, migrated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
		`);
	primary.exec(`
			CREATE TABLE collections (id TEXT PRIMARY KEY, title TEXT NOT NULL, icon TEXT, created_at TEXT NOT NULL);
			CREATE TABLE journal_entries (id TEXT PRIMARY KEY, date TEXT NOT NULL, signifier TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
			CREATE TABLE future_log (id TEXT PRIMARY KEY, target_month TEXT NOT NULL, signifier TEXT NOT NULL, text TEXT NOT NULL, migrated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
		`);
	return { root, legacyPath, primaryPath, backupDir, legacy, primary };
}

describe("single database consolidation", () => {
	it("creates and verifies backups before migrating", () => {
		const f = fixture();
		f.legacy.prepare("INSERT INTO collections VALUES (?, ?, ?, ?)").run("c1", "Legacy", null, "2026-01-01T00:00:00Z");
		f.legacy.close();
		f.primary.close();

		const result = migrateDatabases({ legacyPath: f.legacyPath, primaryPath: f.primaryPath, backupDir: f.backupDir });

		expect(existsSync(f.backupDir)).toBe(true);
		expect(result.backups).toHaveLength(2);
		expect(result.backups.every(existsSync)).toBe(true);
		for (const backup of result.backups) {
			const db = new Database(backup);
			expect(db.pragma("integrity_check")).toEqual(expect.arrayContaining([expect.objectContaining({ integrity_check: "ok" })]));
			db.close();
		}
	});

	it("keeps newer primary rows and is idempotent when rerun", () => {
		const f = fixture();
		f.legacy.prepare("INSERT INTO journal_entries VALUES (?, ?, ?, ?, ?, ?, ?)").run(
			"shared", "2026-01-01", "task", "older legacy", "open", "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z",
		);
		f.legacy.prepare("INSERT INTO journal_entries VALUES (?, ?, ?, ?, ?, ?, ?)").run(
			"legacy-only", "2026-01-01", "note", "copy me", "open", "2026-01-01T00:00:00Z", "2026-01-01T02:00:00Z",
		);
		f.primary.prepare("INSERT INTO journal_entries VALUES (?, ?, ?, ?, ?, ?, ?)").run(
			"shared", "2026-01-02", "task", "newer primary", "done", "2026-01-02T00:00:00Z", "2026-01-02T03:00:00Z",
		);
		f.legacy.close();
		f.primary.close();

		migrateDatabases({ legacyPath: f.legacyPath, primaryPath: f.primaryPath, backupDir: f.backupDir });
		migrateDatabases({ legacyPath: f.legacyPath, primaryPath: f.primaryPath, backupDir: f.backupDir });

		const db = new Database(f.primaryPath);
		expect(db.prepare("SELECT text FROM journal_entries WHERE id = ?").get("shared")).toEqual({ text: "newer primary" });
		expect(db.prepare("SELECT COUNT(*) AS count FROM journal_entries").get()).toEqual({ count: 2 });
		db.close();
	});

	it("rolls back all table mutations when a later table fails", () => {
		const f = fixture();
		f.legacy.prepare("INSERT INTO collections VALUES (?, ?, ?, ?)").run("rollback", "Must rollback", null, "2026-01-01T00:00:00Z");
		f.legacy.prepare("INSERT INTO future_log VALUES (?, ?, ?, ?, ?, ?)").run("bad", "2026-10", "task", null, 0, "2026-01-01T00:00:00Z");
		f.legacy.close();
		f.primary.close();

		expect(() => migrateDatabases({ legacyPath: f.legacyPath, primaryPath: f.primaryPath, backupDir: f.backupDir })).toThrow();

		const db = new Database(f.primaryPath);
		expect(db.prepare("SELECT id FROM collections WHERE id = ?").get("rollback")).toBeUndefined();
		db.close();
	});

	it("preserves legacy task lane, blocker, tags, and ordering metadata", () => {
		const f = fixture();
		f.legacy.exec(`
			CREATE TABLE tasks (
				id TEXT PRIMARY KEY, text TEXT NOT NULL, project TEXT NOT NULL, priority TEXT NOT NULL,
				status TEXT NOT NULL, owner TEXT NOT NULL, due_date TEXT, blocked_by TEXT, jira_key TEXT,
				created_at TEXT NOT NULL, completed_at TEXT, tags TEXT, parent_id TEXT
			);
		`);
		for (const definition of [
			"lane TEXT", "priority TEXT", "waiting_on TEXT", "parent_id TEXT", "tags TEXT",
			"sort_order INTEGER", "collection_id TEXT",
		]) {
			f.primary.exec(`ALTER TABLE journal_entries ADD COLUMN ${definition}`);
		}
		f.legacy.prepare(
			`INSERT INTO tasks
			 (id, text, project, priority, status, owner, due_date, blocked_by, jira_key, created_at, tags)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"legacy-task-1", "Ship it", "Gradient", "HIGH", "blocked", "Morgan", "2026-01-03",
			"API access", "GUT-42", "2026-01-01T00:00:00Z", JSON.stringify(["release"]),
		);
		f.legacy.close();
		f.primary.close();

		migrateDatabases({ legacyPath: f.legacyPath, primaryPath: f.primaryPath, backupDir: f.backupDir });

		const db = new Database(f.primaryPath);
		expect(db.prepare(
			"SELECT lane, priority, waiting_on, tags, sort_order FROM journal_entries WHERE id = ?",
		).get("legacy-task-1")).toEqual({
			lane: "work",
			priority: "high",
			waiting_on: "API access",
			tags: JSON.stringify(["release", "legacy-task", "legacy-project:Gradient", "jira:GUT-42"]),
			sort_order: 0,
		});
		db.close();
	});
});
