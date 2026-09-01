import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const testDatabaseDirectory = mkdtempSync(join(tmpdir(), "gutter-vitest-"));
process.env.DATABASE_PATH = join(testDatabaseDirectory, "gutter.db");
process.env.BACKUP_DIR = join(testDatabaseDirectory, "backups");

afterAll(async () => {
  const { closeDb } = await import("@/lib/db");
  closeDb();
  rmSync(testDatabaseDirectory, { recursive: true, force: true });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
