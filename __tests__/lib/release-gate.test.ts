import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import config from "@/vitest.config";

describe("canonical test discovery", () => {
  it("excludes tests from nested git worktrees", () => {
    expect(config.test?.exclude).toContain("**/.worktrees/**");
  });

  it("runs Vitest with the active PATH Node used for native dependency installation", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.test).toBe("bunx --bun vitest run");
  });
});
