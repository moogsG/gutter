#!/usr/bin/env bun
/** Consolidate the legacy Gutter database into the primary journal database. */

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Database from "../lib/sqlite";
import { getJournalDate } from "../lib/journal-date";

interface MigrationOptions {
	legacyPath?: string;
	primaryPath?: string;
	backupDir?: string;
	dryRun?: boolean;
}

interface TableStats {
	table: string;
	legacyCount: number;
	primaryCount: number;
	migrated: number;
}

interface MigrationResult {
	backups: string[];
	stats: TableStats[];
	dryRun: boolean;
}

type Row = Record<string, unknown> & { id: string };

const TABLES = ["collections", "journal_entries", "future_log", "meeting_prep", "projects"];

function hasTable(db: Database, table: string): boolean {
	return Boolean(
		db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
	);
}

function tableColumns(db: Database, table: string): string[] {
	return (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
}

function rowTimestamp(row: Row): number {
	for (const field of ["updated_at", "completed_at", "created_at"]) {
		const value = row[field];
		if (typeof value === "string") {
			const parsed = Date.parse(value);
			if (!Number.isNaN(parsed)) return parsed;
		}
	}
	return 0;
}

function verifiedBackup(dbPath: string, backupDir: string): string | null {
	if (!existsSync(dbPath)) return null;
	mkdirSync(backupDir, { recursive: true });

	const source = new Database(dbPath);
	try {
		source.pragma("wal_checkpoint(FULL)");
	} finally {
		source.close();
	}

	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = join(backupDir, `${basename(dbPath, ".db")}-pre-migration-${stamp}.db`);
	copyFileSync(dbPath, backupPath);
	if (statSync(backupPath).size !== statSync(dbPath).size || statSync(backupPath).size === 0) {
		throw new Error(`Backup verification failed for ${dbPath}`);
	}

	const backup = new Database(backupPath);
	try {
		const integrity = backup.pragma("integrity_check") as Array<Record<string, string>>;
		if (!integrity.some((row) => Object.values(row).includes("ok"))) {
			throw new Error(`Backup integrity check failed for ${dbPath}`);
		}
	} finally {
		backup.close();
	}
	return backupPath;
}

function upsertIfNewer(primary: Database, table: string, row: Row): boolean {
	const existing = primary.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(row.id) as Row | undefined;
	if (existing && rowTimestamp(existing) >= rowTimestamp(row)) return false;

	const columns = Object.keys(row);
	const placeholders = columns.map(() => "?").join(", ");
	const assignments = columns
		.filter((column) => column !== "id")
		.map((column) => `${column} = excluded.${column}`)
		.join(", ");
	primary
		.prepare(
			`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
			 ON CONFLICT(id) DO UPDATE SET ${assignments}`,
		)
		.run(...columns.map((column) => row[column]));
	return true;
}

function migrateMatchingTable(legacy: Database, primary: Database, table: string): TableStats {
	if (!hasTable(legacy, table) || !hasTable(primary, table)) {
		return { table, legacyCount: 0, primaryCount: 0, migrated: 0 };
	}
	const primaryColumns = new Set(tableColumns(primary, table));
	const rows = legacy.prepare(`SELECT * FROM ${table}`).all() as Row[];
	let migrated = 0;
	for (const source of rows) {
		const row = Object.fromEntries(
			Object.entries(source).filter(([column]) => primaryColumns.has(column)),
		) as Row;
		if (upsertIfNewer(primary, table, row)) migrated++;
	}
	const primaryCount = (
		primary.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
	).count;
	return { table, legacyCount: rows.length, primaryCount, migrated };
}

function mapTaskStatus(status: unknown): string {
	if (["done", "complete", "completed"].includes(String(status))) return "done";
	if (["review", "testing", "in-progress"].includes(String(status))) return "in-progress";
	return status === "blocked" ? "blocked" : "open";
}

function mapTaskLane(project: unknown): string | null {
	switch (String(project).trim().toLowerCase()) {
		case "gradient": return "work";
		case "jw": return "jw";
		case "petalz": return "petalz";
		case "home": return "family";
		case "personal":
		case "inbox":
		case "ideas":
		case "general":
		case "infra":
		case "mission control": return "personal";
		default: return null;
	}
}

function taskTags(task: Row): string {
	let existing: string[] = [];
	if (typeof task.tags === "string") {
		try {
			const parsed = JSON.parse(task.tags);
			if (Array.isArray(parsed)) existing = parsed.filter((tag): tag is string => typeof tag === "string");
		} catch {
			// Ignore malformed legacy tags while retaining generated provenance tags.
		}
	}
	return JSON.stringify(Array.from(new Set([
		...existing,
		"legacy-task",
		`legacy-project:${String(task.project)}`,
		task.jira_key ? `jira:${String(task.jira_key)}` : null,
	].filter((tag): tag is string => Boolean(tag)))));
}

function migrateLegacyTasks(legacy: Database, primary: Database): TableStats {
	if (!hasTable(legacy, "tasks") || !hasTable(primary, "journal_entries")) {
		return { table: "legacy_tasks", legacyCount: 0, primaryCount: 0, migrated: 0 };
	}
	const targetColumns = new Set(tableColumns(primary, "journal_entries"));
	const tasks = legacy.prepare("SELECT * FROM tasks ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, created_at, id").all() as Row[];
	const sortOrderByDate = new Map(
		(primary.prepare("SELECT date, MAX(sort_order) AS max_sort_order FROM journal_entries GROUP BY date").all() as Array<{ date: string; max_sort_order: number | null }>)
			.map((row) => [row.date, row.max_sort_order ?? -1]),
	);
	let migrated = 0;
	for (const task of tasks) {
		const createdAt = String(task.created_at || new Date().toISOString());
		const rawDate = String(task.due_date || createdAt);
		const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : getJournalDate(new Date(rawDate));
		const sortOrder = (sortOrderByDate.get(date) ?? -1) + 1;
		sortOrderByDate.set(date, sortOrder);
		const row: Row = {
			id: task.id,
			date,
			signifier: "task",
			text: task.text,
			status: mapTaskStatus(task.status),
			created_at: createdAt,
			updated_at: task.completed_at || createdAt,
			lane: mapTaskLane(task.project),
			parent_id: task.parent_id || null,
			waiting_on: typeof task.blocked_by === "string" && task.blocked_by.trim() ? task.blocked_by.trim() : null,
			tags: taskTags(task),
			sort_order: sortOrder,
			collection_id: null,
			priority: ["high", "low"].includes(String(task.priority).toLowerCase())
				? String(task.priority).toLowerCase()
				: "normal",
		};
		const compatible = Object.fromEntries(
			Object.entries(row).filter(([column]) => targetColumns.has(column)),
		) as Row;
		if (upsertIfNewer(primary, "journal_entries", compatible)) migrated++;
	}
	const primaryCount = (
		primary.prepare("SELECT COUNT(*) AS count FROM journal_entries WHERE signifier = 'task'").get() as { count: number }
	).count;
	return { table: "legacy_tasks", legacyCount: tasks.length, primaryCount, migrated };
}

export function migrateDatabases(options: MigrationOptions = {}): MigrationResult {
	const legacyPath = options.legacyPath || "./gutter.db";
	const primaryPath = options.primaryPath || "./gutter-journal.db";
	const backupDir = options.backupDir || "./backups";
	const dryRun = options.dryRun ?? false;

	if (!existsSync(legacyPath)) return { backups: [], stats: [], dryRun };
	const backups = dryRun
		? []
		: [verifiedBackup(legacyPath, backupDir), verifiedBackup(primaryPath, backupDir)].filter(
			(value): value is string => Boolean(value),
		);
	const legacy = new Database(legacyPath);
	const primary = new Database(primaryPath);
	const stats: TableStats[] = [];

	try {
		if (dryRun) {
			for (const table of TABLES) {
				stats.push({
					table,
					legacyCount: hasTable(legacy, table)
						? (legacy.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
						: 0,
					primaryCount: hasTable(primary, table)
						? (primary.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
						: 0,
					migrated: 0,
				});
			}
			return { backups, stats, dryRun };
		}

		primary.pragma("foreign_keys = OFF");
		primary.exec("BEGIN IMMEDIATE");
		try {
			for (const table of TABLES) stats.push(migrateMatchingTable(legacy, primary, table));
			stats.push(migrateLegacyTasks(legacy, primary));
			primary.exec("COMMIT");
		} catch (error) {
			primary.exec("ROLLBACK");
			throw error;
		} finally {
			primary.pragma("foreign_keys = ON");
		}
		return { backups, stats, dryRun };
	} finally {
		legacy.close();
		primary.close();
	}
}

function printResult(result: MigrationResult) {
	for (const stat of result.stats) {
		console.log(`${stat.table}: ${stat.migrated} migrated; ${stat.primaryCount} in primary`);
	}
	console.log(result.dryRun ? "Dry run complete; no changes made." : "Database consolidation complete.");
}

const isMain = process.argv[1]
	? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
	: false;
if (isMain) {
	try {
		printResult(migrateDatabases({ dryRun: process.argv.includes("--dry-run") }));
	} catch (error) {
		console.error("Database consolidation failed:", error);
		process.exitCode = 1;
	}
}
