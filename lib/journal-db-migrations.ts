/**
 * Database migrations for journal features
 * Run these migrations to add new tables/columns
 */

import { getDb } from "./db";

export function runMorningViewMigration() {
  const db = getDb();

  // Create morning_view_prompts table
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
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mvp_active ON morning_view_prompts(active);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mvp_frequency ON morning_view_prompts(frequency);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mvp_sort ON morning_view_prompts(sort_order);
  `);

  // Create conversation_history table for Talk mode
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_history (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conv_session ON conversation_history(session_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conv_date ON conversation_history(date);
  `);

  console.log("✓ Morning view migrations completed");
}
