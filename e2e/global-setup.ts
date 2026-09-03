import { execFileSync } from "node:child_process";

export default function globalSetup() {
  const databasePath = process.env.GUTTER_E2E_DATABASE_PATH;
  if (!databasePath) {
    throw new Error("GUTTER_E2E_DATABASE_PATH is not configured");
  }

  process.env.GUTTER_E2E_AGENT_TOKEN = execFileSync(
    "bun",
    ["run", "agent-token:create", "--", "--actor-id", "jynx"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, DATABASE_PATH: databasePath },
    },
  ).trim();
}
