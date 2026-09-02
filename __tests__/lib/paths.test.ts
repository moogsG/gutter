import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOpenClawAgentsPath,
  getOpenClawWorkspacePath,
  getWhisperModelPath,
  getExecutable,
} from "@/lib/paths";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("local integration paths", () => {
  it("keeps user-specific absolute paths out of integration sources", () => {
    const sources = [
      "lib/chores.ts",
      "lib/meal-plan.ts",
      "lib/meal-plan-checklist.ts",
      "lib/project-runway.ts",
      "lib/linkedin.ts",
      "lib/meeting-prep.ts",
      "lib/ollama-prep.ts",
      "app/api/radar/route.ts",
      "app/api/journal/transcribe/route.ts",
      "__tests__/transcribe.test.ts",
    ].map((path) => readFileSync(path, "utf8"));

    expect(sources.join("\n")).not.toMatch(/\/Users\/moogs|\/opt\/homebrew/);
  });

  it("uses an explicit absolute OpenClaw workspace path", () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", "/srv/openclaw/workspace");

    expect(getOpenClawWorkspacePath()).toBe("/srv/openclaw/workspace");
  });

  it("defaults the OpenClaw workspace beneath the current home directory", () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", "");

    expect(getOpenClawWorkspacePath()).toBe(join(homedir(), ".openclaw", "workspace"));
  });

  it("rejects a relative configured workspace path", () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", "../somewhere");

    expect(() => getOpenClawWorkspacePath()).toThrow(
      "OPENCLAW_WORKSPACE_PATH must be an absolute path",
    );
  });

  it("uses an explicit absolute OpenClaw agents path", () => {
    vi.stubEnv("OPENCLAW_AGENTS_PATH", "/srv/openclaw/agents");

    expect(getOpenClawAgentsPath()).toBe("/srv/openclaw/agents");
  });

  it("defaults the OpenClaw agents root beneath the current home directory", () => {
    vi.stubEnv("OPENCLAW_AGENTS_PATH", "");

    expect(getOpenClawAgentsPath()).toBe(join(homedir(), ".openclaw", "agents"));
  });

  it("rejects a relative configured agents path", () => {
    vi.stubEnv("OPENCLAW_AGENTS_PATH", "../agents");

    expect(() => getOpenClawAgentsPath()).toThrow(
      "OPENCLAW_AGENTS_PATH must be an absolute path",
    );
  });

  it("uses configured and home-relative Whisper model paths", () => {
    vi.stubEnv("WHISPER_MODEL_PATH", "/models/whisper.bin");
    expect(getWhisperModelPath()).toBe("/models/whisper.bin");

    vi.stubEnv("WHISPER_MODEL_PATH", "");
    expect(getWhisperModelPath()).toBe(
      join(homedir(), ".cache", "whisper", "ggml-base.en.bin"),
    );
  });

  it("uses PATH commands instead of machine-specific executable locations", () => {
    vi.stubEnv("BUN_BIN", "");
    expect(getExecutable("BUN_BIN", "bun")).toBe("bun");

    vi.stubEnv("BUN_BIN", "/usr/local/bin/bun");
    expect(getExecutable("BUN_BIN", "bun")).toBe("/usr/local/bin/bun");
  });
});
