import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import Database from "@/lib/sqlite";

const CURRENT_SCHEMA_VERSION = 8;

type Migration = {
	version: number;
	up: (db: Database) => void;
};

const globalForDb = globalThis as typeof globalThis & {
	_db?: Database | null;
	_dbPath?: string | null;
};

let dbInstance: Database | null = globalForDb._db || null;
let dbPath: string | null = globalForDb._dbPath || null;

function hasColumn(db: Database, table: string, column: string): boolean {
	return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(
		(item) => item.name === column,
	);
}

function hasTable(db: Database, table: string): boolean {
	return Boolean(
		db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
			.get(table),
	);
}

const migrations: Migration[] = [
	{
		version: 1,
		up(db) {
			db.exec(`
				CREATE TABLE IF NOT EXISTS _meta (
					key TEXT PRIMARY KEY,
					value TEXT NOT NULL
				);
				CREATE TABLE IF NOT EXISTS collections (
					id TEXT PRIMARY KEY,
					title TEXT NOT NULL,
					icon TEXT,
					created_at TEXT NOT NULL DEFAULT (datetime('now'))
				);
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
				CREATE TABLE IF NOT EXISTS journal_entries (
					id TEXT PRIMARY KEY,
					date TEXT NOT NULL,
					signifier TEXT NOT NULL,
					text TEXT NOT NULL,
					status TEXT NOT NULL DEFAULT 'open',
					migrated_to TEXT,
					migrated_from TEXT,
					collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
					tags TEXT DEFAULT '[]',
					sort_order INTEGER NOT NULL,
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					updated_at TEXT NOT NULL DEFAULT (datetime('now'))
				);
				CREATE TABLE IF NOT EXISTS future_log (
					id TEXT PRIMARY KEY,
					target_month TEXT NOT NULL,
					signifier TEXT NOT NULL,
					text TEXT NOT NULL,
					migrated INTEGER DEFAULT 0,
					created_at TEXT NOT NULL DEFAULT (datetime('now'))
				);
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
				CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(date);
				CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
				CREATE INDEX IF NOT EXISTS idx_je_signifier ON journal_entries(signifier);
				CREATE INDEX IF NOT EXISTS idx_je_collection ON journal_entries(collection_id);
				CREATE INDEX IF NOT EXISTS idx_je_sort ON journal_entries(date, sort_order);
				CREATE INDEX IF NOT EXISTS idx_je_updated ON journal_entries(updated_at);
				CREATE INDEX IF NOT EXISTS idx_fl_month ON future_log(target_month);
				CREATE INDEX IF NOT EXISTS idx_fl_migrated ON future_log(migrated);
				CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(active);
				CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_prep_event ON meeting_prep(event_id, occurrence_date);
				CREATE INDEX IF NOT EXISTS idx_meeting_prep_status ON meeting_prep(prep_status);
				CREATE INDEX IF NOT EXISTS idx_meeting_prep_date ON meeting_prep(occurrence_date);
				INSERT OR IGNORE INTO _meta (key, value) VALUES ('created_at', datetime('now'));
			`);
		},
	},
	{
		version: 2,
		up(db) {
			if (!hasColumn(db, "journal_entries", "parent_id")) {
				db.exec(
					"ALTER TABLE journal_entries ADD COLUMN parent_id TEXT REFERENCES journal_entries(id)",
				);
			}
			db.exec("CREATE INDEX IF NOT EXISTS idx_je_parent ON journal_entries(parent_id)");
		},
	},
	{
		version: 3,
		up(db) {
			for (const column of ["lane", "priority", "waiting_on"]) {
				if (!hasColumn(db, "journal_entries", column)) {
					db.exec(`ALTER TABLE journal_entries ADD COLUMN ${column} TEXT`);
				}
			}
		},
	},
	{
		version: 4,
		up(db) {
			db.exec(`
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
		},
	},
	{
		version: 5,
		up(db) {
			if (
				hasTable(db, "morning_view_prompts") &&
				!hasColumn(db, "morning_view_prompts", "ui_config")
			) {
				db.exec("ALTER TABLE morning_view_prompts ADD COLUMN ui_config TEXT");
			}
		},
	},
	{
		version: 6,
		up(db) {
			db.exec(`
				CREATE TABLE IF NOT EXISTS morning_view_prompts (
					id TEXT PRIMARY KEY,
					title TEXT NOT NULL,
					prompt_text TEXT NOT NULL,
					source_type TEXT NOT NULL,
					source_config TEXT,
					frequency TEXT NOT NULL,
					last_run TEXT,
					active INTEGER DEFAULT 1,
					sort_order INTEGER NOT NULL,
					ui_config TEXT,
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					updated_at TEXT NOT NULL DEFAULT (datetime('now'))
				);
				CREATE TABLE IF NOT EXISTS conversation_history (
					id TEXT PRIMARY KEY,
					date TEXT NOT NULL,
					session_id TEXT NOT NULL,
					role TEXT NOT NULL,
					content TEXT NOT NULL,
					created_at TEXT NOT NULL DEFAULT (datetime('now'))
				);
				CREATE INDEX IF NOT EXISTS idx_mvp_active ON morning_view_prompts(active);
				CREATE INDEX IF NOT EXISTS idx_mvp_frequency ON morning_view_prompts(frequency);
				CREATE INDEX IF NOT EXISTS idx_mvp_sort ON morning_view_prompts(sort_order);
				CREATE INDEX IF NOT EXISTS idx_conv_session ON conversation_history(session_id);
				CREATE INDEX IF NOT EXISTS idx_conv_date ON conversation_history(date);
			`);
		},
	},
	{
		version: 7,
		up(db) {
			// collection_id is the journal entry relationship, so preserve legacy projects
			// by materializing them as collections before project reads switch to collections.
			if (hasTable(db, "projects")) {
				db.exec(`
					INSERT OR IGNORE INTO collections (id, title, icon, created_at)
					SELECT id, name, icon, created_at FROM projects
				`);
			}
			db.exec(`
				UPDATE journal_entries SET status = 'done' WHERE status = 'complete';
				UPDATE journal_entries SET status = 'in-progress' WHERE status = 'in_progress';
			`);
		},
	},
	{
		version: 8,
		up(db) {
			db.exec(`
				CREATE TABLE IF NOT EXISTS agent_credentials (
					token_hash TEXT PRIMARY KEY,
					actor_id TEXT NOT NULL,
					scopes TEXT NOT NULL,
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					revoked_at TEXT
				);
				CREATE TABLE IF NOT EXISTS task_comments (
					id TEXT PRIMARY KEY,
					task_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
					body TEXT NOT NULL,
					actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
					actor_id TEXT NOT NULL,
					source_ref TEXT,
					idempotency_key TEXT,
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					CHECK (actor_type != 'agent' OR idempotency_key IS NOT NULL),
					UNIQUE (actor_id, idempotency_key)
				);
				CREATE INDEX IF NOT EXISTS idx_task_comments_task_created
					ON task_comments(task_id, created_at, id);
				CREATE INDEX IF NOT EXISTS idx_agent_credentials_actor
					ON agent_credentials(actor_id);
			`);
		},
	},
];

export function getSchemaVersion(db: Database): number {
	if (!hasTable(db, "_meta")) return 0;
	const row = db
		.prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
		.get() as { value: string } | undefined;
	return row ? Number.parseInt(row.value, 10) || 0 : 0;
}

export function runMigrations(db: Database): number {
	let version = getSchemaVersion(db);

	for (const migration of migrations) {
		if (migration.version <= version) continue;
		db.exec("BEGIN IMMEDIATE");
		try {
			migration.up(db);
			db
				.prepare("INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)")
				.run(String(migration.version));
			db.exec("COMMIT");
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
		version = getSchemaVersion(db);
		if (version !== migration.version) {
			throw new Error(`Migration ${migration.version} did not persist its schema version`);
		}
	}

	return version;
}

function backupDatabase(path: string) {
	if (!existsSync(path) || process.env.NODE_ENV === "test") return;
	const backupDir = process.env.BACKUP_DIR || "./backups";
	mkdirSync(backupDir, { recursive: true });
	const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
	copyFileSync(path, join(backupDir, `journal-${timestamp}.db`));
	const backups = readdirSync(backupDir)
		.filter((file) => file.startsWith("journal-"))
		.sort()
		.reverse();
	for (const file of backups.slice(7)) unlinkSync(join(backupDir, file));
}

function repairMissingIds(db: Database) {
	const rows = db
		.prepare("SELECT rowid FROM journal_entries WHERE id IS NULL OR TRIM(id) = ''")
		.all() as Array<{ rowid: number }>;
	for (const row of rows) {
		db
			.prepare("UPDATE journal_entries SET id = ? WHERE rowid = ?")
			.run(`je-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, row.rowid);
	}
	if (rows.length > 0) console.warn(`[db] Repaired ${rows.length} journal entries with missing IDs`);
}

export function initializeDatabase(path: string): Database {
	mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path);
	db.pragma("journal_mode = WAL");
	db.pragma("synchronous = NORMAL");
	db.pragma("cache_size = 10000");
	db.pragma("foreign_keys = ON");
	runMigrations(db);
	repairMissingIds(db);
	return db;
}

export function closeDb() {
	dbInstance?.close();
	dbInstance = null;
	dbPath = null;
	globalForDb._db = null;
	globalForDb._dbPath = null;
}

export function getDb(): Database {
	const requestedPath = process.env.DATABASE_PATH || "./gutter-journal.db";
	if (dbInstance && dbPath !== requestedPath) closeDb();
	if (!dbInstance) {
		const existed = existsSync(requestedPath);
		dbInstance = initializeDatabase(requestedPath);
		dbPath = requestedPath;
		globalForDb._db = dbInstance;
		globalForDb._dbPath = dbPath;

		const lastBackup = dbInstance
			.prepare("SELECT value FROM _meta WHERE key = 'last_backup'")
			.get() as { value: string } | undefined;
		const today = new Date().toISOString().split("T")[0];
		if (existed && (!lastBackup || !lastBackup.value.startsWith(today))) {
			backupDatabase(requestedPath);
			dbInstance
				.prepare("INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_backup', ?)")
				.run(new Date().toISOString());
		}
	}
	return dbInstance;
}

export function triggerBackup() {
	backupDatabase(process.env.DATABASE_PATH || "./gutter-journal.db");
}

export { CURRENT_SCHEMA_VERSION };
