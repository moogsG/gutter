import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const cleanupPaths: string[] = [];

afterEach(() => {
  for (const path of cleanupPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/db");
  vi.resetModules();
});

function mockDailyLogDb() {
  const run = vi.fn();
  vi.doMock("@/lib/db", () => ({
    getDb: () => ({
      prepare: vi.fn((sql: string) => ({
        get: () => ({ max_order: 0 }),
        run: sql.includes("INSERT INTO journal_entries") ? run : vi.fn(),
      })),
    }),
  }));
  return run;
}

describe("OpenClaw route degradation", () => {
  it("returns an empty typed Sessions board when transcript and memory roots are not configured", async () => {
    const root = join(tmpdir(), `gutter-missing-sessions-${process.pid}`);
    vi.stubEnv("OPENCLAW_AGENTS_PATH", join(root, "agents"));
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", join(root, "workspace"));
    vi.resetModules();
    const { GET } = await import("@/app/api/sessions/route");

    const response = await GET(new NextRequest("http://localhost/api/sessions?date=2026-09-02"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources).toEqual({
      transcripts: {
        state: "not-configured",
        message: "Set OPENCLAW_AGENTS_PATH to load agent transcripts.",
        recovery: "configure",
      },
      memory: {
        state: "not-configured",
        message: "Set OPENCLAW_WORKSPACE_PATH to load session activity notes.",
        recovery: "configure",
      },
    });
    expect(payload.days).toHaveLength(7);
    expect(payload.recentSessions).toEqual([]);
    expect(payload.activityReport).toBeNull();
    expect(existsSync(root)).toBe(false);
  });

  it("distinguishes configured empty Sessions sources from degraded sources", async () => {
    const root = mkdtempSync(join(tmpdir(), "gutter-empty-sessions-"));
    cleanupPaths.push(root);
    const agents = join(root, "agents");
    const workspace = join(root, "workspace");
    mkdirSync(join(agents, "demo"), { recursive: true });
    mkdirSync(join(workspace, "memory"), { recursive: true });
    vi.stubEnv("OPENCLAW_AGENTS_PATH", agents);
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/sessions/route");

    const response = await GET(new NextRequest("http://localhost/api/sessions?date=2026-09-02"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources.transcripts.state).toBe("empty");
    expect(payload.sources.transcripts.recovery).toBeNull();
    expect(payload.sources.memory.state).toBe("empty");
    expect(payload.sources.memory.recovery).toBeNull();
  });

  it("returns a typed unavailable Sessions board when nested transcript paths cannot be read", async () => {
    const root = mkdtempSync(join(tmpdir(), "gutter-nested-unavailable-sessions-"));
    cleanupPaths.push(root);
    const agents = join(root, "agents");
    const workspace = join(root, "workspace");
    const malformedDatePath = join(agents, "demo", "agent", "codex-home", "sessions", "2026", "09", "02");
    mkdirSync(join(malformedDatePath, ".."), { recursive: true });
    writeFileSync(malformedDatePath, "not a directory");
    mkdirSync(join(workspace, "memory"), { recursive: true });
    vi.stubEnv("OPENCLAW_AGENTS_PATH", agents);
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.resetModules();
    const { GET } = await import("@/app/api/sessions/route");

    const response = await GET(new NextRequest("http://localhost/api/sessions?date=2026-09-02"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources.transcripts).toEqual({
      state: "unavailable",
      message: "Agent transcripts are unavailable. Check the agents path and retry.",
      recovery: "retry",
    });
    expect(payload.sources.memory.state).toBe("empty");
    expect(payload.days).toHaveLength(7);
    expect(payload.recentSessions).toEqual([]);
  });

  it.runIf(typeof process.getuid !== "function" || process.getuid() !== 0)(
    "returns a typed unavailable Sessions board when a transcript ancestor is unreadable",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "gutter-unreadable-sessions-"));
      cleanupPaths.push(root);
      const agents = join(root, "agents");
      const workspace = join(root, "workspace");
      const unreadableYear = join(agents, "demo", "agent", "codex-home", "sessions", "2026");
      mkdirSync(join(unreadableYear, "09", "02"), { recursive: true });
      mkdirSync(join(workspace, "memory"), { recursive: true });
      vi.stubEnv("OPENCLAW_AGENTS_PATH", agents);
      vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
      chmodSync(unreadableYear, 0o000);
      vi.resetModules();
      const { GET } = await import("@/app/api/sessions/route");

      let response: Response;
      try {
        response = await GET(new NextRequest("http://localhost/api/sessions?date=2026-09-02"));
      } finally {
        chmodSync(unreadableYear, 0o700);
      }
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.sources.transcripts).toEqual({
        state: "unavailable",
        message: "Agent transcripts are unavailable. Check the agents path and retry.",
        recovery: "retry",
      });
      expect(payload.sources.memory.state).toBe("empty");
      expect(payload.days).toHaveLength(7);
      expect(payload.recentSessions).toEqual([]);
    },
  );

  it.runIf(typeof process.getuid !== "function" || process.getuid() !== 0)(
    "returns a typed unavailable Sessions board when a transcript file is unreadable",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "gutter-unreadable-session-file-"));
      cleanupPaths.push(root);
      const agents = join(root, "agents");
      const workspace = join(root, "workspace");
      const transcript = join(
        agents,
        "demo",
        "agent",
        "codex-home",
        "sessions",
        "2026",
        "09",
        "02",
        "session.jsonl",
      );
      mkdirSync(join(transcript, ".."), { recursive: true });
      writeFileSync(transcript, '{"payload":{"session_id":"session-1"}}\n');
      mkdirSync(join(workspace, "memory"), { recursive: true });
      vi.stubEnv("OPENCLAW_AGENTS_PATH", agents);
      vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
      chmodSync(transcript, 0o000);
      vi.resetModules();
      const { GET } = await import("@/app/api/sessions/route");

      let response: Response;
      try {
        response = await GET(new NextRequest("http://localhost/api/sessions?date=2026-09-02"));
      } finally {
        chmodSync(transcript, 0o600);
      }
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.sources.transcripts).toEqual({
        state: "unavailable",
        message: "Agent transcripts are unavailable. Check the agents path and retry.",
        recovery: "retry",
      });
      expect(payload.sources.memory.state).toBe("empty");
      expect(payload.days).toHaveLength(7);
      expect(payload.recentSessions).toEqual([]);
      expect(payload.nextMove).not.toBe("Session load looks readable. Use this board when the support stack starts waving fake huge numbers around again.");
    },
  );

  it.runIf(typeof process.getuid !== "function" || process.getuid() !== 0)(
    "returns a typed unavailable Sessions memory source when an activity note is unreadable",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "gutter-unreadable-memory-note-"));
      cleanupPaths.push(root);
      const agents = join(root, "agents");
      const workspace = join(root, "workspace");
      const note = join(workspace, "memory", "2026-09-02.md");
      mkdirSync(agents, { recursive: true });
      mkdirSync(join(note, ".."), { recursive: true });
      writeFileSync(note, "### Activity\n3 active session(s)\n");
      vi.stubEnv("OPENCLAW_AGENTS_PATH", agents);
      vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
      chmodSync(note, 0o000);
      vi.resetModules();
      const { GET } = await import("@/app/api/sessions/route");

      let response: Response;
      try {
        response = await GET(new NextRequest("http://localhost/api/sessions?date=2026-09-02"));
      } finally {
        chmodSync(note, 0o600);
      }
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.sources.transcripts.state).toBe("empty");
      expect(payload.sources.memory).toEqual({
        state: "unavailable",
        message: "Session activity notes are unavailable. Check the workspace and retry.",
        recovery: "retry",
      });
      expect(payload.days).toHaveLength(7);
      expect(payload.activityReport).toBeNull();
      expect(payload.nextMove).toBe(
        "Session activity notes are unavailable. Check the workspace and retry before trusting activity comparisons.",
      );
    },
  );

  it("returns typed unavailable Sessions sources when configured roots cannot be read", async () => {
    const root = mkdtempSync(join(tmpdir(), "gutter-unavailable-sessions-"));
    cleanupPaths.push(root);
    const agents = join(root, "agents-file");
    const workspace = join(root, "workspace");
    writeFileSync(agents, "not a directory");
    mkdirSync(workspace);
    vi.stubEnv("OPENCLAW_AGENTS_PATH", agents);
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/sessions/route");

    const response = await GET(new NextRequest("http://localhost/api/sessions?date=2026-09-02"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources.transcripts.state).toBe("unavailable");
    expect(payload.sources.transcripts.recovery).toBe("retry");
    expect(payload.sources.memory.state).toBe("unavailable");
    expect(payload.sources.memory.recovery).toBe("retry");
  });

  it("saves the core daily log while reporting an unconfigured optional mirror without creating it", async () => {
    const workspace = join(tmpdir(), `gutter-missing-daily-log-${process.pid}`);
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    const insert = mockDailyLogDb();
    vi.resetModules();
    const { POST } = await import("@/app/api/daily-log/route");

    const response = await POST(new NextRequest("http://localhost/api/daily-log", {
      method: "POST",
      body: JSON.stringify({ text: "Release gate verified" }),
      headers: { "content-type": "application/json" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledOnce();
    expect(payload.saved).toBe(true);
    expect(payload.mirror).toEqual({
      state: "not-configured",
      message: "Set OPENCLAW_WORKSPACE_PATH to mirror entries into daily notes.",
      recovery: "configure",
    });
    expect(existsSync(workspace)).toBe(false);
  });

  it("preserves the core daily-log save when the optional mirror path is invalid", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", "../invalid-workspace");
    const insert = mockDailyLogDb();
    vi.resetModules();
    const { POST } = await import("@/app/api/daily-log/route");

    const response = await POST(new NextRequest("http://localhost/api/daily-log", {
      method: "POST",
      body: JSON.stringify({ text: "Core save survives mirror configuration" }),
      headers: { "content-type": "application/json" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledOnce();
    expect(payload.saved).toBe(true);
    expect(payload.mirror.state).toBe("not-configured");
    expect(payload.mirror.recovery).toBe("configure");
  });

  it("does not create a missing memory directory inside a configured workspace", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "gutter-daily-log-no-memory-"));
    cleanupPaths.push(workspace);
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const insert = mockDailyLogDb();
    vi.resetModules();
    const { POST } = await import("@/app/api/daily-log/route");

    const response = await POST(new NextRequest("http://localhost/api/daily-log", {
      method: "POST",
      body: JSON.stringify({ text: "Do not create optional directories" }),
      headers: { "content-type": "application/json" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledOnce();
    expect(payload.mirror.state).toBe("unavailable");
    expect(payload.mirror.recovery).toBe("retry");
    expect(existsSync(join(workspace, "memory"))).toBe(false);
  });
});
