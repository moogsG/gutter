import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET as getTasks } from "@/app/api/tasks/route";
import {
	CURRENT_SCHEMA_VERSION,
	closeDb,
	getSchemaVersion,
	initializeDatabase,
	runMigrations,
} from "@/lib/db";
import Database from "@/lib/sqlite";

const directories: string[] = [];

function temporaryDatabase(name: string) {
	const directory = mkdtempSync(join(tmpdir(), "gutter-migration-"));
	directories.push(directory);
	return { directory, path: join(directory, name) };
}

afterEach(() => {
	closeDb();
	for (const directory of directories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("database migrations", () => {
	it("bootstraps a fresh database before creating parent_id indexes", () => {
		const { path } = temporaryDatabase("fresh.db");
		const db = initializeDatabase(path);

		expect(getSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
		const columns = db.prepare("PRAGMA table_info(journal_entries)").all() as Array<{
			name: string;
		}>;
		expect(columns.map((column) => column.name)).toContain("parent_id");
		const parentIndex = db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_je_parent'")
			.get();
		expect(parentIndex).toBeDefined();
		const commentTable = db
			.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'task_comments'")
			.get() as { sql: string } | undefined;
		expect(commentTable?.sql).toContain("ON DELETE CASCADE");
		expect(commentTable?.sql).toContain("UNIQUE (actor_id, idempotency_key)");
		expect(
			db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_credentials'").get(),
		).toBeDefined();
		const habitCheckIns = db
			.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'habit_check_ins'")
			.get() as { sql: string } | undefined;
		expect(habitCheckIns?.sql).toContain("UNIQUE (habit_id, date)");
		expect(habitCheckIns?.sql).toContain("state IN ('done', 'skipped')");
		db.close();
	});

	it("migrates legacy data without loss and normalizes explicit legacy statuses", () => {
		const { path } = temporaryDatabase("legacy.db");
		const db = new Database(path);
		db.exec(`
			CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
			INSERT INTO _meta (key, value) VALUES ('schema_version', '1');
			CREATE TABLE collections (
				id TEXT PRIMARY KEY, title TEXT NOT NULL, icon TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			);
			CREATE TABLE projects (
				id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, color TEXT,
				icon TEXT, active INTEGER DEFAULT 1,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);
			CREATE TABLE journal_entries (
				id TEXT PRIMARY KEY, date TEXT NOT NULL, signifier TEXT NOT NULL,
				text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
				migrated_to TEXT, migrated_from TEXT, collection_id TEXT,
				tags TEXT DEFAULT '[]', sort_order INTEGER NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);
			INSERT INTO projects (id, name) VALUES ('project-1', 'Legacy project');
			INSERT INTO journal_entries
				(id, date, signifier, text, status, sort_order)
			VALUES ('entry-1', '2026-08-01', 'task', 'Keep me', 'complete', 0);
		`);

		expect(runMigrations(db)).toBe(CURRENT_SCHEMA_VERSION);
		expect(runMigrations(db)).toBe(CURRENT_SCHEMA_VERSION);
		expect(db.prepare("SELECT text, status FROM journal_entries WHERE id = 'entry-1'").get()).toEqual({
			text: "Keep me",
			status: "done",
		});
		expect(db.prepare("SELECT title FROM collections WHERE id = 'project-1'").get()).toEqual({
			title: "Legacy project",
		});
		expect(
			db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'task_comments'").get(),
		).toBeDefined();
		db.close();
	});

	it("rolls back a failed migration without advancing the schema version", () => {
		const { path } = temporaryDatabase("rollback.db");
		const db = new Database(path);
		db.exec(`
			CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
			INSERT INTO _meta (key, value) VALUES ('schema_version', '7');
			CREATE TABLE task_comments (id TEXT PRIMARY KEY);
		`);

		expect(() => runMigrations(db)).toThrow();
		expect(getSchemaVersion(db)).toBe(7);
		expect(
			db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_credentials'").get(),
		).toBeUndefined();
		db.close();
	});

	it("serves an empty task list from a newly bootstrapped database", async () => {
		const { path } = temporaryDatabase("api.db");
		const originalPath = process.env.DATABASE_PATH;
		process.env.DATABASE_PATH = path;
		try {
			const response = await getTasks(new NextRequest("http://localhost/api/tasks"));
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual([]);
		} finally {
			closeDb();
			process.env.DATABASE_PATH = originalPath;
		}
	});
});
