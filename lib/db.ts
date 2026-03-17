/**
 * Main database connection for Gutter app
 * Manages SQLite database with all core tables
 */

import Database from "@/lib/sqlite";

const DB_PATH = process.env.TASKS_DB_PATH || "./gutter.db";

// Use globalThis to survive Next.js dev mode hot reloads
const globalForDb = globalThis as typeof globalThis & {
	_tasksDb?: Database | null;
};

let _db: Database | null = globalForDb._tasksDb || null;

/**
 * Get or create the main database connection
 * Initializes all tables on first call
 * @returns {Database} The database instance
 */
export function getDb(): Database {
	if (!_db) {
		_db = new Database(DB_PATH);
		_db.pragma("journal_mode = WAL");
		_db.pragma("wal_checkpoint(TRUNCATE)");
		
		// Enable foreign key constraints
		_db.pragma("foreign_keys = ON");
		globalForDb._tasksDb = _db;

		_db.exec(`
      CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        tags TEXT
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        sender TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meeting_prep (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        title TEXT NOT NULL,
        time TEXT NOT NULL,
        calendar TEXT NOT NULL,
        prep_notes TEXT,
        prep_status TEXT NOT NULL DEFAULT 'none',
        transcript TEXT,
        summary TEXT,
        action_items TEXT,
        occurrence_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_prep_event_date ON meeting_prep(event_id, occurrence_date);
      CREATE INDEX IF NOT EXISTS idx_meeting_prep_status ON meeting_prep(prep_status);
      CREATE INDEX IF NOT EXISTS idx_meeting_prep_date ON meeting_prep(occurrence_date);
      CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender);
      CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_notes_timestamp ON notes(timestamp);
      
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
      CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(date);
      CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
      CREATE INDEX IF NOT EXISTS idx_je_signifier ON journal_entries(signifier);
      CREATE INDEX IF NOT EXISTS idx_je_collection ON journal_entries(collection_id);
      CREATE INDEX IF NOT EXISTS idx_je_sort ON journal_entries(date, sort_order);
      
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
    `);
	}
	return _db;
}
