import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "@/lib/sqlite";

// Read from environment variables with fallback
const DB_PATH = process.env.DATABASE_PATH || "./gutter-journal.db";
const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";
const DB_DIR = dirname(DB_PATH);

// Use globalThis to survive Next.js dev mode hot reloads
// Without this, each hot reload creates a new connection and orphans the old WAL
const globalForDb = globalThis as typeof globalThis & {
	_db?: Database | null;
};

let _db: Database | null = globalForDb._db || null;

function ensureDirs() {
	if (!existsSync(DB_DIR)) {
		mkdirSync(DB_DIR, { recursive: true });
	}
	if (!existsSync(BACKUP_DIR)) {
		mkdirSync(BACKUP_DIR, { recursive: true });
	}
}

function backupDatabase() {
	if (!existsSync(DB_PATH)) return;

	const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
	const backupPath = join(BACKUP_DIR, `journal-${timestamp}.db`);

	try {
		copyFileSync(DB_PATH, backupPath);

		// Keep only last 7 daily backups
		const fs = require("node:fs");
		const backups = fs
			.readdirSync(BACKUP_DIR)
			.filter((f: string) => f.startsWith("journal-"))
			.sort()
			.reverse();

		if (backups.length > 7) {
			backups.slice(7).forEach((f: string) => {
				fs.unlinkSync(join(BACKUP_DIR, f));
			});
		}
	} catch (err) {
		console.error("Backup failed:", err);
	}
}

export function getDb(): Database {
	if (!_db) {
		ensureDirs();

		const _isNew = !existsSync(DB_PATH);
		_db = new Database(DB_PATH);

		// WAL mode for better concurrency and crash resistance
		_db.pragma("journal_mode = WAL");
		_db.pragma("synchronous = NORMAL");
		_db.pragma("cache_size = 10000");

		// Checkpoint WAL on connection to ensure data is flushed to main DB
		// This prevents data loss when Next.js dev mode hot-reloads modules
		_db.pragma("wal_checkpoint(TRUNCATE)");
		
		// Enable foreign key constraints
		_db.pragma("foreign_keys = ON");

		// Create tables
		_db.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        signifier TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        lane TEXT,
        priority TEXT,
        waiting_on TEXT,
        migrated_to TEXT,
        migrated_from TEXT,
        collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
        tags TEXT DEFAULT '[]',
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(date);
      CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
      CREATE INDEX IF NOT EXISTS idx_je_signifier ON journal_entries(signifier);
      CREATE INDEX IF NOT EXISTS idx_je_collection ON journal_entries(collection_id);
      CREATE INDEX IF NOT EXISTS idx_je_parent ON journal_entries(parent_id);
      CREATE INDEX IF NOT EXISTS idx_je_sort ON journal_entries(date, sort_order);
      CREATE INDEX IF NOT EXISTS idx_je_updated ON journal_entries(updated_at);
      
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        icon TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS future_log (
        id TEXT PRIMARY KEY,
        target_month TEXT NOT NULL,
        signifier TEXT NOT NULL,
        text TEXT NOT NULL,
        migrated INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_fl_month ON future_log(target_month);
      
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        icon TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(active);

      CREATE TABLE IF NOT EXISTS meeting_prep (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        occurrence_date TEXT,
        title TEXT NOT NULL,
        time TEXT,
        calendar TEXT,
        prep_notes TEXT,
        prep_status TEXT DEFAULT 'none',
        transcript TEXT,
        summary TEXT,
        action_items TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS jira_issues (
        id TEXT PRIMARY KEY,
        issue_key TEXT NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT,
        assignee TEXT,
        url TEXT,
        updated TEXT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_prep_event ON meeting_prep(event_id, occurrence_date);
      CREATE INDEX IF NOT EXISTS idx_meeting_prep_status ON meeting_prep(prep_status);
      CREATE INDEX IF NOT EXISTS idx_meeting_prep_date ON meeting_prep(occurrence_date);
      CREATE INDEX IF NOT EXISTS idx_jira_issue_key ON jira_issues(issue_key);
      CREATE INDEX IF NOT EXISTS idx_jira_status ON jira_issues(status);
      CREATE INDEX IF NOT EXISTS idx_jira_priority ON jira_issues(priority);
      CREATE INDEX IF NOT EXISTS idx_jira_synced_at ON jira_issues(synced_at);
      CREATE INDEX IF NOT EXISTS idx_fl_migrated ON future_log(migrated);
      
      -- Metadata table to track schema version and backups
      CREATE TABLE IF NOT EXISTS _meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      
      INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '1');
      INSERT OR IGNORE INTO _meta (key, value) VALUES ('created_at', datetime('now'));
    `);

		// Migrations
		const schemaVersion =
			(
				_db
					.prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
					.get() as { value: string }
			)?.value || "1";
		if (parseInt(schemaVersion, 10) < 2) {
			// Add parent_id column for subtasks
			const columns = _db
				.prepare("PRAGMA table_info(journal_entries)")
				.all() as Array<{ name: string }>;
			if (!columns.some((c) => c.name === "parent_id")) {
				_db.exec(
					"ALTER TABLE journal_entries ADD COLUMN parent_id TEXT REFERENCES journal_entries(id)",
				);
			}
			_db
				.prepare(
					"INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '2')",
				)
				.run();
		}

		if (parseInt(schemaVersion, 10) < 3) {
			const columns = _db
				.prepare("PRAGMA table_info(journal_entries)")
				.all() as Array<{ name: string }>;
			if (!columns.some((c) => c.name === "lane")) {
				_db.exec("ALTER TABLE journal_entries ADD COLUMN lane TEXT");
			}
			if (!columns.some((c) => c.name === "priority")) {
				_db.exec("ALTER TABLE journal_entries ADD COLUMN priority TEXT");
			}
			if (!columns.some((c) => c.name === "waiting_on")) {
				_db.exec("ALTER TABLE journal_entries ADD COLUMN waiting_on TEXT");
			}
			_db
				.prepare(
					"INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '3')",
				)
				.run();
		}

		if (parseInt(schemaVersion, 10) < 4) {
			_db.exec(`
				CREATE TABLE IF NOT EXISTS jira_issues (
					id TEXT PRIMARY KEY,
					issue_key TEXT NOT NULL UNIQUE,
					summary TEXT NOT NULL,
					status TEXT NOT NULL,
					priority TEXT,
					assignee TEXT,
					url TEXT,
					updated TEXT,
					synced_at TEXT NOT NULL DEFAULT (datetime('now'))
				);
				CREATE INDEX IF NOT EXISTS idx_jira_issue_key ON jira_issues(issue_key);
				CREATE INDEX IF NOT EXISTS idx_jira_status ON jira_issues(status);
				CREATE INDEX IF NOT EXISTS idx_jira_priority ON jira_issues(priority);
				CREATE INDEX IF NOT EXISTS idx_jira_synced_at ON jira_issues(synced_at);
			`);
			_db
				.prepare(
					"INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '4')",
				)
				.run();
		}

		if (parseInt(schemaVersion, 10) < 5) {
			// Add ui_config column to morning_view_prompts for editable widget display config
			const tableExists = _db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='morning_view_prompts'")
				.get();
			if (tableExists) {
				const mvpCols = _db
					.prepare("PRAGMA table_info(morning_view_prompts)")
					.all() as Array<{ name: string }>;
				if (!mvpCols.some((c) => c.name === "ui_config")) {
					_db.exec("ALTER TABLE morning_view_prompts ADD COLUMN ui_config TEXT");
				}
			}
			_db
				.prepare(
					"INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '5')",
				)
				.run();
		}

		// Data repair for legacy/capture-created rows that ended up with blank IDs.
		// Without stable IDs, PATCH/DELETE appear to succeed but do nothing.
		const rowsMissingIds = _db
			.prepare(
				"SELECT rowid FROM journal_entries WHERE id IS NULL OR TRIM(id) = ''",
			)
			.all() as Array<{ rowid: number }>;

		if (rowsMissingIds.length > 0) {
			for (const row of rowsMissingIds) {
				const repairedId = `je-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
				_db
					.prepare("UPDATE journal_entries SET id = ? WHERE rowid = ?")
					.run(repairedId, row.rowid);
			}
			console.warn(
				`[db] Repaired ${rowsMissingIds.length} journal entries with missing IDs`,
			);
		}

		// Backup on first connection of the day
		const lastBackup = _db
			.prepare("SELECT value FROM _meta WHERE key = 'last_backup'")
			.get() as { value: string } | undefined;
		const today = new Date().toISOString().split("T")[0];

		if (!lastBackup || !lastBackup.value.startsWith(today)) {
			backupDatabase();
			_db
				.prepare(
					"INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_backup', ?)",
				)
				.run(new Date().toISOString());
		}

		// Persist to globalThis so hot reloads reuse the same connection
		globalForDb._db = _db;
	}

	return _db;
}

// Manual backup trigger (can be called from API or UI)
export function triggerBackup() {
	backupDatabase();
}
