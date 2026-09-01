import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
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
      DATABASE_PATH: "./gutter-playwright.test.db",
      BACKUP_DIR: "./playwright-backups",
      CALENDAR_ENABLED: "false",
    },
  },
});
