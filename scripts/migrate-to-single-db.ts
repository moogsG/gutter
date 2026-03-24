#!/usr/bin/env bun
/**
 * Migrate data from gutter.db (legacy) to gutter-journal.db (primary)
 * Run once to consolidate databases
 *
 * Usage:
 *   bun run scripts/migrate-to-single-db.ts [--dry-run]
 */

import Database from "../lib/sqlite";
import { existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const LEGACY_DB = "./gutter.db";
const PRIMARY_DB = "./gutter-journal.db";
const BACKUP_DIR = "./backups";

const DRY_RUN = process.argv.includes("--dry-run");

interface TableStats {
	table: string;
	legacy_count: number;
	primary_count: number;
	migrated: number;
}

function backup(dbPath: string) {
	if (!existsSync(dbPath)) return null;

	const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
	const filename = dbPath.replace("./", "").replace(".db", "");
	const backupPath = join(BACKUP_DIR, `${filename}-pre-migration-${timestamp}.db`);

	copyFileSync(dbPath, backupPath);
	return backupPath;
}

function getTableCount(db: Database, table: string): number {
	try {
		const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
			count: number;
		};
		return result.count;
	} catch {
		return 0;
	}
}

function migrate() {
	if (!existsSync(LEGACY_DB)) {
		console.log("✅ No legacy database found (gutter.db). Nothing to migrate.");
		console.log("   This is expected for fresh installs or already-migrated setups.");
		return;
	}

	console.log("🔄 Database Migration: gutter.db → gutter-journal.db");
	console.log("================================================\n");

	if (DRY_RUN) {
		console.log("🔍 DRY RUN MODE — No changes will be made\n");
	}

	// Backup both databases
	console.log("📦 Creating backups...");
	const legacyBackup = backup(LEGACY_DB);
	const primaryBackup = backup(PRIMARY_DB);

	if (legacyBackup) {
		console.log(`   ✅ Legacy DB backed up to: ${legacyBackup}`);
	}
	if (primaryBackup) {
		console.log(`   ✅ Primary DB backed up to: ${primaryBackup}`);
	}
	console.log("");

	// Open databases
	const legacyDb = new Database(LEGACY_DB);
	const primaryDb = new Database(PRIMARY_DB);

	const stats: TableStats[] = [];

	// Disable foreign keys during migration
	if (!DRY_RUN) {
		primaryDb.pragma("foreign_keys = OFF");
	}

	try {
		// 1. Migrate collections
		console.log("📚 Migrating collections...");
		const legacyCollections = getTableCount(legacyDb, "collections");
		const primaryCollectionsBefore = getTableCount(primaryDb, "collections");

		if (!DRY_RUN && legacyCollections > 0) {
			const collections = legacyDb
				.prepare("SELECT * FROM collections")
				.all() as Array<{
				id: string;
				title: string;
				icon?: string;
				created_at: string;
			}>;

			for (const col of collections) {
				primaryDb
					.prepare(
						`INSERT OR IGNORE INTO collections (id, title, icon, created_at)
           VALUES (?, ?, ?, ?)`,
					)
					.run(col.id, col.title, col.icon || null, col.created_at);
			}
		}

		const primaryCollectionsAfter = getTableCount(primaryDb, "collections");
		const collectionsMigrated = primaryCollectionsAfter - primaryCollectionsBefore;

		console.log(
			`   ✅ ${collectionsMigrated} new collections (${legacyCollections} in legacy, ${primaryCollectionsAfter} total in primary)`,
		);
		stats.push({
			table: "collections",
			legacy_count: legacyCollections,
			primary_count: primaryCollectionsAfter,
			migrated: collectionsMigrated,
		});

		// 2. Migrate journal_entries
		console.log("📝 Migrating journal entries...");
		const legacyEntries = getTableCount(legacyDb, "journal_entries");
		const primaryEntriesBefore = getTableCount(primaryDb, "journal_entries");

		if (!DRY_RUN && legacyEntries > 0) {
			const entries = legacyDb
				.prepare("SELECT * FROM journal_entries")
				.all() as Array<{
				id: string;
				date: string;
				signifier: string;
				text: string;
				status: string;
				migrated_to?: string;
				migrated_from?: string;
				collection_id?: string;
				tags: string;
				sort_order: number;
				created_at: string;
				updated_at: string;
			}>;

			for (const entry of entries) {
				// Use INSERT OR REPLACE to merge entries (prefer newer based on updated_at)
				primaryDb
					.prepare(
						`INSERT OR REPLACE INTO journal_entries 
             (id, date, signifier, text, status, migrated_to, migrated_from, 
              collection_id, tags, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.run(
						entry.id,
						entry.date,
						entry.signifier,
						entry.text,
						entry.status,
						entry.migrated_to || null,
						entry.migrated_from || null,
						entry.collection_id || null,
						entry.tags,
						entry.sort_order,
						entry.created_at,
						entry.updated_at,
					);
			}
		}

		const primaryEntriesAfter = getTableCount(primaryDb, "journal_entries");
		const entriesMigrated = primaryEntriesAfter - primaryEntriesBefore;

		console.log(
			`   ✅ ${entriesMigrated} new entries (${legacyEntries} in legacy, ${primaryEntriesAfter} total in primary)`,
		);
		stats.push({
			table: "journal_entries",
			legacy_count: legacyEntries,
			primary_count: primaryEntriesAfter,
			migrated: entriesMigrated,
		});

		// 3. Migrate future_log
		console.log("📅 Migrating future log...");
		const legacyFutureLog = getTableCount(legacyDb, "future_log");
		const primaryFutureLogBefore = getTableCount(primaryDb, "future_log");

		if (!DRY_RUN && legacyFutureLog > 0) {
			const futureLog = legacyDb.prepare("SELECT * FROM future_log").all() as Array<{
				id: string;
				target_month: string;
				signifier: string;
				text: string;
				migrated: number;
				created_at: string;
			}>;

			for (const fl of futureLog) {
				primaryDb
					.prepare(
						`INSERT OR REPLACE INTO future_log 
             (id, target_month, signifier, text, migrated, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
					)
					.run(
						fl.id,
						fl.target_month,
						fl.signifier,
						fl.text,
						fl.migrated,
						fl.created_at,
					);
			}
		}

		const primaryFutureLogAfter = getTableCount(primaryDb, "future_log");
		const futureLogMigrated = primaryFutureLogAfter - primaryFutureLogBefore;

		console.log(
			`   ✅ ${futureLogMigrated} new entries (${legacyFutureLog} in legacy, ${primaryFutureLogAfter} total in primary)`,
		);
		stats.push({
			table: "future_log",
			legacy_count: legacyFutureLog,
			primary_count: primaryFutureLogAfter,
			migrated: futureLogMigrated,
		});

		// 4. Migrate meeting_prep
		console.log("🤝 Migrating meeting prep...");
		const legacyMeetingPrep = getTableCount(legacyDb, "meeting_prep");
		const primaryMeetingPrepBefore = getTableCount(primaryDb, "meeting_prep");

		if (!DRY_RUN && legacyMeetingPrep > 0) {
			const meetingPrep = legacyDb.prepare("SELECT * FROM meeting_prep").all() as Array<{
				id: string;
				event_id: string;
				occurrence_date?: string;
				title: string;
				time?: string;
				calendar?: string;
				prep_notes?: string;
				prep_status: string;
				transcript?: string;
				summary?: string;
				action_items?: string;
				created_at: string;
				updated_at: string;
			}>;

			for (const mp of meetingPrep) {
				primaryDb
					.prepare(
						`INSERT OR REPLACE INTO meeting_prep 
             (id, event_id, occurrence_date, title, time, calendar, 
              prep_notes, prep_status, transcript, summary, action_items, 
              created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.run(
						mp.id,
						mp.event_id,
						mp.occurrence_date || null,
						mp.title,
						mp.time || null,
						mp.calendar || null,
						mp.prep_notes || null,
						mp.prep_status,
						mp.transcript || null,
						mp.summary || null,
						mp.action_items || null,
						mp.created_at,
						mp.updated_at,
					);
			}
		}

		const primaryMeetingPrepAfter = getTableCount(primaryDb, "meeting_prep");
		const meetingPrepMigrated = primaryMeetingPrepAfter - primaryMeetingPrepBefore;

		console.log(
			`   ✅ ${meetingPrepMigrated} new entries (${legacyMeetingPrep} in legacy, ${primaryMeetingPrepAfter} total in primary)`,
		);
		stats.push({
			table: "meeting_prep",
			legacy_count: legacyMeetingPrep,
			primary_count: primaryMeetingPrepAfter,
			migrated: meetingPrepMigrated,
		});

		// 5. Migrate projects (if exists)
		console.log("📂 Migrating projects...");
		const legacyProjects = getTableCount(legacyDb, "projects");
		const primaryProjectsBefore = getTableCount(primaryDb, "projects");

		if (!DRY_RUN && legacyProjects > 0) {
			try {
				const projects = legacyDb.prepare("SELECT * FROM projects").all() as Array<{
					id: string;
					name: string;
					description?: string;
					color?: string;
					icon?: string;
					active: number;
					created_at: string;
					updated_at: string;
				}>;

				for (const proj of projects) {
					primaryDb
						.prepare(
							`INSERT OR REPLACE INTO projects 
               (id, name, description, color, icon, active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
						)
						.run(
							proj.id,
							proj.name,
							proj.description || null,
							proj.color || null,
							proj.icon || null,
							proj.active,
							proj.created_at,
							proj.updated_at,
						);
				}
			} catch {
				console.log("   ⚠️  No projects table in legacy DB (skipping)");
			}
		}

		const primaryProjectsAfter = getTableCount(primaryDb, "projects");
		const projectsMigrated = primaryProjectsAfter - primaryProjectsBefore;

		console.log(
			`   ✅ ${projectsMigrated} new projects (${legacyProjects} in legacy, ${primaryProjectsAfter} total in primary)`,
		);
		if (legacyProjects > 0) {
			stats.push({
				table: "projects",
				legacy_count: legacyProjects,
				primary_count: primaryProjectsAfter,
				migrated: projectsMigrated,
			});
		}
	} finally {
		// Re-enable foreign keys
		if (!DRY_RUN) {
			primaryDb.pragma("foreign_keys = ON");
		}
	}

	// Summary
	console.log("\n================================================");
	console.log("📊 Migration Summary\n");

	for (const stat of stats) {
		console.log(`${stat.table}:`);
		console.log(`  Legacy DB: ${stat.legacy_count} rows`);
		console.log(`  Primary DB: ${stat.primary_count} rows (after migration)`);
		console.log(`  Migrated: ${stat.migrated} new rows`);
		console.log("");
	}

	const totalMigrated = stats.reduce((sum, s) => sum + s.migrated, 0);

	if (DRY_RUN) {
		console.log("🔍 DRY RUN COMPLETE — No changes were made");
		console.log("   Run without --dry-run to perform actual migration");
	} else if (totalMigrated > 0) {
		console.log(`✅ Migration successful! ${totalMigrated} total rows migrated.`);
		console.log("\n⚠️  IMPORTANT:");
		console.log("   1. Test the app thoroughly: bun run dev");
		console.log("   2. Verify your data in the UI");
		console.log("   3. After confirming everything works:");
		console.log("      rm gutter.db  # Delete legacy database");
	} else {
		console.log("✅ No new data to migrate. Databases already in sync.");
		console.log("\nYou can safely delete gutter.db:");
		console.log("   rm gutter.db");
	}

	legacyDb.close();
	primaryDb.close();
}

// Run migration
try {
	migrate();
} catch (error) {
	console.error("\n❌ Migration failed:", error);
	console.error("\nYour data is safe! Backups are in ./backups/");
	process.exit(1);
}
