import Database from "@/lib/sqlite";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";

// Read from environment variables with fallback
const JOURNAL_DB_PATH = process.env.JOURNAL_DB_PATH || "./gutter-journal.db";
const BACKUP_DIR = process.env.JOURNAL_BACKUP_DIR || "./backups";
const JOURNAL_DB_DIR = dirname(JOURNAL_DB_PATH);

// Use globalThis to survive Next.js dev mode hot reloads
// Without this, each hot reload creates a new connection and orphans the old WAL
const globalForDb = globalThis as typeof globalThis & {
  _journalDb?: Database | null;
};

let _journalDb: Database | null = globalForDb._journalDb || null;

function ensureDirs() {
  if (!existsSync(JOURNAL_DB_DIR)) {
    mkdirSync(JOURNAL_DB_DIR, { recursive: true });
  }
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function backupDatabase() {
  if (!existsSync(JOURNAL_DB_PATH)) return;
  
  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
  const backupPath = join(BACKUP_DIR, `journal-${timestamp}.db`);
  
  try {
    copyFileSync(JOURNAL_DB_PATH, backupPath);
    
    // Keep only last 7 daily backups
    const fs = require("fs");
    const backups = fs.readdirSync(BACKUP_DIR)
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

export function getJournalDb(): Database {
  if (!_journalDb) {
    ensureDirs();
    
    const isNew = !existsSync(JOURNAL_DB_PATH);
    _journalDb = new Database(JOURNAL_DB_PATH);
    
    // WAL mode for better concurrency and crash resistance
    _journalDb.pragma("journal_mode = WAL");
    _journalDb.pragma("synchronous = NORMAL");
    _journalDb.pragma("cache_size = 10000");
    
    // Checkpoint WAL on connection to ensure data is flushed to main DB
    // This prevents data loss when Next.js dev mode hot-reloads modules
    _journalDb.pragma("wal_checkpoint(TRUNCATE)");
    
    // Create tables
    _journalDb.exec(`
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
      
      CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(date);
      CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
      CREATE INDEX IF NOT EXISTS idx_je_signifier ON journal_entries(signifier);
      CREATE INDEX IF NOT EXISTS idx_je_collection ON journal_entries(collection_id);
      CREATE INDEX IF NOT EXISTS idx_je_parent ON journal_entries(parent_id);
      
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

      CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_prep_event ON meeting_prep(event_id, occurrence_date);
      
      -- Metadata table to track schema version and backups
      CREATE TABLE IF NOT EXISTS _meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      
      INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '1');
      INSERT OR IGNORE INTO _meta (key, value) VALUES ('created_at', datetime('now'));
    `);
    
    // Migrations
    const schemaVersion = (_journalDb.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get() as { value: string })?.value || "1";
    if (parseInt(schemaVersion) < 2) {
      // Add parent_id column for subtasks
      const columns = _journalDb.prepare("PRAGMA table_info(journal_entries)").all() as Array<{ name: string }>;
      if (!columns.some((c) => c.name === "parent_id")) {
        _journalDb.exec("ALTER TABLE journal_entries ADD COLUMN parent_id TEXT REFERENCES journal_entries(id)");
      }
      _journalDb.prepare("INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '2')").run();
    }

    // Backup on first connection of the day
    const lastBackup = _journalDb.prepare("SELECT value FROM _meta WHERE key = 'last_backup'").get() as { value: string } | undefined;
    const today = new Date().toISOString().split("T")[0];
    
    if (!lastBackup || !lastBackup.value.startsWith(today)) {
      backupDatabase();
      _journalDb.prepare("INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_backup', ?)").run(new Date().toISOString());
    }
    
    // Persist to globalThis so hot reloads reuse the same connection
    globalForDb._journalDb = _journalDb;
  }
  
  return _journalDb;
}

// Manual backup trigger (can be called from API or UI)
export function triggerBackup() {
  backupDatabase();
}
