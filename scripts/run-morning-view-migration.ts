#!/usr/bin/env bun

/**
 * Run morning view database migration
 * Creates morning_view_prompts and conversation_history tables
 */

import { runMorningViewMigration } from "../lib/journal-db-migrations";

console.log("Starting morning view migration...");

try {
  runMorningViewMigration();
  console.log("✓ Migration completed successfully");
  process.exit(0);
} catch (error) {
  console.error("✗ Migration failed:", error);
  process.exit(1);
}
