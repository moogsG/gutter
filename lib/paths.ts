import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

function getAbsolutePath(key: string, fallback: () => string): string {
  const configured = process.env[key]?.trim();
  if (!configured) return fallback();

  const expanded = configured === "~"
    ? homedir()
    : configured.startsWith("~/")
      ? join(homedir(), configured.slice(2))
      : configured;

  if (!isAbsolute(expanded)) {
    throw new Error(`${key} must be an absolute path`);
  }

  return expanded;
}

export function getOpenClawWorkspacePath(): string {
  return getAbsolutePath("OPENCLAW_WORKSPACE_PATH", () =>
    join(homedir(), ".openclaw", "workspace"),
  );
}

export function getOpenClawAgentsPath(): string {
  return getAbsolutePath("OPENCLAW_AGENTS_PATH", () =>
    join(homedir(), ".openclaw", "agents"),
  );
}

export function getWhisperModelPath(): string {
  return getAbsolutePath("WHISPER_MODEL_PATH", () =>
    join(homedir(), ".cache", "whisper", "ggml-base.en.bin"),
  );
}

export function getExecutable(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}
