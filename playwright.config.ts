import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Playwright evaluates this config in both the runner and worker processes.
// A stable OS-temp path keeps both processes and the web server on one database.
const e2eDirectory = join(tmpdir(), "gutter-playwright-task-threads");
mkdirSync(e2eDirectory, { recursive: true });
process.env.GUTTER_E2E_DIRECTORY = e2eDirectory;
process.env.GUTTER_E2E_DATABASE_PATH = join(e2eDirectory, "gutter.db");
process.env.GUTTER_E2E_AGENT_TOKEN = execFileSync(
  "bun",
  ["run", "agent-token:create", "--", "--actor-id", "jynx"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_PATH: process.env.GUTTER_E2E_DATABASE_PATH },
  },
).trim();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:3123",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev -- --hostname 127.0.0.1 --port 3123",
    url: "http://127.0.0.1:3123/kanban",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_PATH: process.env.GUTTER_E2E_DATABASE_PATH,
      BACKUP_DIR: join(e2eDirectory, "backups"),
      CALENDAR_ENABLED: "false",
    },
  },
});
