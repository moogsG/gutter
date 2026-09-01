import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabaseBackup, initializeDatabase } from "@/lib/db";
import Database from "@/lib/sqlite";

const directories: string[] = [];

afterEach(() => {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("database backup and restore", () => {
	it("creates a WAL-consistent SQLite snapshot whose comments restore cleanly", () => {
		const directory = mkdtempSync(join(tmpdir(), "gutter-backup-"));
		directories.push(directory);
		const sourcePath = join(directory, "source.db");
		const backupDir = join(directory, "backups");
		const source = initializeDatabase(sourcePath);
		source.pragma("wal_autocheckpoint = 0");
		source.prepare(
			`INSERT INTO journal_entries
			 (id, date, signifier, text, status, sort_order)
			 VALUES ('backup-task', '2026-09-01', 'task', 'Back me up', 'open', 0)`,
		).run();
		source.prepare(
			`INSERT INTO task_comments
			 (id, task_id, body, actor_type, actor_id, idempotency_key)
			 VALUES ('backup-comment', 'backup-task', 'Survives restore', 'agent', 'jynx', 'backup-key')`,
		).run();

		const backupPath = createDatabaseBackup(source, backupDir);
		expect(existsSync(backupPath)).toBe(true);
		source.close();

		const restored = new Database(backupPath);
		expect(restored.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
		expect(
			restored.prepare("SELECT task_id, body, actor_type, actor_id FROM task_comments").get(),
		).toEqual({
			task_id: "backup-task",
			body: "Survives restore",
			actor_type: "agent",
			actor_id: "jynx",
		});
		restored.close();
	});
});