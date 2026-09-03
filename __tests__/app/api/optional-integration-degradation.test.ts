import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const missingWorkspace = join(tmpdir(), `gutter-missing-openclaw-${process.pid}`);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/calendar");
  vi.doUnmock("@/lib/calendars");
  vi.doUnmock("@/lib/db");
  vi.resetModules();
});

describe("optional integration degradation", () => {
  it("serves a typed not-configured Chores state without creating external files", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", missingWorkspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/chores/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toEqual({
      state: "not-configured",
      message: "Chores needs an OpenClaw workspace before it can store a cycle.",
      recovery: "configure",
    });
    expect(payload.chores).toEqual([]);
    expect(existsSync(missingWorkspace)).toBe(false);
  });

  it("serves a typed not-configured Meals state when the planner is absent", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", missingWorkspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/meal-plan/route");

    const response = await GET(
      new NextRequest("http://localhost/api/meal-plan?date=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toEqual({
      state: "not-configured",
      message: "Meals needs the optional meal-planner workspace.",
      recovery: "configure",
    });
    expect(payload.meals).toEqual([]);
    expect(payload.grocerySections).toEqual([]);
  });

  it("serves a typed unavailable Meals state when a configured planner is broken", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "gutter-broken-planner-"));
    mkdirSync(join(workspace, "meal-planner"));
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/meal-plan/route");

    try {
      const response = await GET(
        new NextRequest("http://localhost/api/meal-plan?date=2026-09-02"),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.source.state).toBe("unavailable");
      expect(payload.source.recovery).toBe("retry");
      expect(payload.meals).toEqual([]);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("serves a typed not-configured Meetings state when Calendar is disabled", async () => {
    vi.stubEnv("CALENDAR_ENABLED", "false");
    vi.resetModules();
    const { GET } = await import("@/app/api/meeting-prep/queue/route");

    const response = await GET(
      new NextRequest("http://localhost/api/meeting-prep/queue?date=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toEqual({
      state: "not-configured",
      message: "Calendar is disabled. Enable it to load meetings.",
      recovery: "configure",
    });
    expect(payload.counts.total).toBe(0);
    expect(payload.groups).toEqual({ redZone: [], ready: [], later: [] });
  });

  it("keeps stored meeting prep usable when the meeting-prep Calendar source is disabled", async () => {
    const fetchCalendarEvents = vi.fn().mockResolvedValue({
      ok: false,
      error: "Calendar integration disabled",
      source: {
        state: "not-configured",
        message: "Calendar is disabled. Enable it to load meetings.",
        recovery: "configure",
      },
    });
    const storedPrep = {
      id: "prep-1",
      event_id: "event-1",
      occurrence_date: "2026-09-01",
      title: "Stored planning session",
      time: "2026-09-01T15:00:00.000Z",
      calendar: "Work",
      prep_notes: "Review the release gate",
      prep_status: "ready",
      transcript: null,
      summary: null,
      action_items: '["Run verification"]',
    };
    vi.doMock("@/lib/calendar", () => ({ fetchCalendarEvents }));
    vi.doMock("@/lib/db", () => ({
      getDb: () => ({
        prepare: () => ({ all: () => [storedPrep] }),
      }),
    }));
    vi.doMock("@/lib/calendars", () => ({ getCalendarNames: () => [] }));
    const { GET } = await import("@/app/api/meeting-prep/route");

    const response = await GET(new NextRequest("http://localhost/api/meeting-prep"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchCalendarEvents).toHaveBeenCalledOnce();
    expect(payload.source).toEqual({
      state: "not-configured",
      message: "Calendar is disabled. Enable it to load meetings.",
      recovery: "configure",
    });
    expect(payload.meetings).toEqual([
      expect.objectContaining({
        id: "prep-1",
        eventId: "event-1",
        title: "Stored planning session",
        prepNotes: "Review the release gate",
        actionItems: ["Run verification"],
      }),
    ]);
  });

  it("serves typed retry recovery when the meeting-prep Calendar source is unavailable", async () => {
    const fetchCalendarEvents = vi.fn().mockResolvedValue({
      ok: false,
      error: "accli failed",
      source: {
        state: "unavailable",
        message: "Calendar could not be reached. Check the CLI and retry.",
        recovery: "retry",
      },
    });
    vi.doMock("@/lib/calendar", () => ({ fetchCalendarEvents }));
    vi.doMock("@/lib/db", () => ({
      getDb: () => ({
        prepare: () => ({ all: () => [] }),
      }),
    }));
    vi.doMock("@/lib/calendars", () => ({ getCalendarNames: () => [] }));
    const { GET } = await import("@/app/api/meeting-prep/route");

    const response = await GET(new NextRequest("http://localhost/api/meeting-prep"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchCalendarEvents).toHaveBeenCalledOnce();
    expect(payload.source).toEqual({
      state: "unavailable",
      message: "Calendar could not be reached. Check the CLI and retry.",
      recovery: "retry",
    });
    expect(payload.meetings).toEqual([]);
  });

  it("serves a typed unavailable Calendar state instead of a route error", async () => {
    vi.doMock("@/lib/calendar", () => ({
      fetchCalendarEvents: vi.fn().mockResolvedValue({
        ok: false,
        error: "accli failed",
        source: {
          state: "unavailable",
          message: "Calendar could not be reached. Check the CLI and retry.",
          recovery: "retry",
        },
      }),
    }));
    const { GET } = await import("@/app/api/calendar/events/route");

    const response = await GET(
      new NextRequest("http://localhost/api/calendar/events?from=2026-09-02&to=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source.state).toBe("unavailable");
    expect(payload.source.recovery).toBe("retry");
    expect(payload.events).toEqual([]);
  });

  it("keeps the month calendar usable when Calendar is not configured", async () => {
    vi.doMock("@/lib/calendar", () => ({
      fetchCalendarEvents: vi.fn().mockResolvedValue({
        ok: false,
        error: "Calendar integration disabled",
        source: {
          state: "not-configured",
          message: "Calendar is disabled. Enable it to load meetings.",
          recovery: "configure",
        },
      }),
    }));
    const { GET } = await import("@/app/api/calendar/route");

    const response = await GET(
      new NextRequest("http://localhost/api/calendar?month=2026-09"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.events).toEqual([]);
    expect(payload.source).toEqual({
      state: "not-configured",
      message: "Calendar is disabled. Enable it to load meetings.",
      recovery: "configure",
    });
  });

  it("keeps the calendar runway usable when Calendar is unavailable", async () => {
    vi.doMock("@/lib/calendar", () => ({
      calendarCache: { lastError: "Calendar: accli failed" },
      fetchCalendarEvents: vi.fn().mockResolvedValue({
        ok: false,
        error: "accli failed",
        source: {
          state: "unavailable",
          message: "Calendar could not be reached. Check the CLI and retry.",
          recovery: "retry",
        },
      }),
    }));
    const { GET } = await import("@/app/api/calendar/runway/route");

    const response = await GET(
      new NextRequest("http://localhost/api/calendar/runway?date=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toEqual({
      state: "unavailable",
      message: "Calendar could not be reached. Check the CLI and retry.",
      recovery: "retry",
    });
    expect(payload.totalEvents).toBe(0);
    expect(payload.upcomingDays).toHaveLength(7);
  });

  it("keeps a successful Calendar query with no events distinct from an unavailable source", async () => {
    vi.doMock("@/lib/calendar", () => ({
      fetchCalendarEvents: vi.fn().mockResolvedValue({
        ok: true,
        events: [],
        source: {
          state: "empty",
          message: "No calendar events in this range.",
          recovery: null,
        },
      }),
    }));
    const { GET } = await import("@/app/api/calendar/events/route");

    const response = await GET(
      new NextRequest("http://localhost/api/calendar/events?from=2026-09-02&to=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source.state).toBe("empty");
    expect(payload.source.recovery).toBeNull();
    expect(payload.events).toEqual([]);
  });

  it("keeps live Projects data usable when OpenClaw truth sources are not configured", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", missingWorkspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/truth/route");

    const response = await GET(
      new NextRequest("http://localhost/api/truth?date=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources.projectDocument.state).toBe("not-configured");
    expect(payload.sources.dailyMemory.state).toBe("not-configured");
    expect(payload.projectDoc.projects).toEqual([]);
    expect(payload.recurringTasks).toEqual([]);
    expect(payload.counts.staleWorkCount).toEqual(expect.any(Number));
  });

  it("keeps live project runway data usable when PROJECTS.md is not configured", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", missingWorkspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/project-runway/route");

    const response = await GET(
      new NextRequest("http://localhost/api/project-runway?date=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toEqual({
      state: "not-configured",
      message: "Set OPENCLAW_WORKSPACE_PATH to load PROJECTS.md.",
      recovery: "configure",
    });
    expect(payload.document).toEqual({
      lastUpdated: null,
      staleDays: null,
      activeProjects: 0,
      blockerCount: 0,
    });
    expect(payload.documentedProjects).toEqual([]);
    expect(payload.truthGap.liveInProgressCount).toEqual(expect.any(Number));
  });

  it("serves typed LinkedIn degradation when its OpenClaw files are not configured", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", missingWorkspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/linkedin/route");

    const response = await GET(
      new NextRequest("http://localhost/api/linkedin?date=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toEqual({
      state: "not-configured",
      message: "Set OPENCLAW_WORKSPACE_PATH to load LinkedIn planning data.",
      recovery: "configure",
    });
    expect(payload.drafts).toEqual([]);
    expect(payload.postLog).toEqual([]);
    expect(payload.analyticsPosts).toEqual([]);
  });

  it("serves typed retry recovery when configured LinkedIn analytics are invalid", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "gutter-broken-linkedin-"));
    writeFileSync(join(workspace, "linkedin-post-ideas.md"), "");
    writeFileSync(join(workspace, "linkedin-post-log.md"), "");
    writeFileSync(join(workspace, "linkedin-analytics.json"), "not-json");
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/linkedin/route");

    try {
      const response = await GET(
        new NextRequest("http://localhost/api/linkedin?date=2026-09-02"),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.source.state).toBe("unavailable");
      expect(payload.source.recovery).toBe("retry");
      expect(payload.analyticsPosts).toEqual([]);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("keeps live radar tasks distinct from an unconfigured promises source", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", missingWorkspace);
    vi.resetModules();
    const { GET } = await import("@/app/api/radar/route");

    const response = await GET(
      new NextRequest("http://localhost/api/radar?date=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toEqual({
      state: "not-configured",
      message: "Set OPENCLAW_WORKSPACE_PATH to load tracked promises.",
      recovery: "configure",
    });
    expect(payload.sections.promises).toEqual([]);
    expect(payload.sections.stuck).toEqual(expect.any(Array));
    expect(payload.sections.carryover).toEqual(expect.any(Array));
  });

  it("keeps Tomorrow usable with typed degraded optional sources", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", missingWorkspace);
    vi.stubEnv("CALENDAR_ENABLED", "false");
    vi.resetModules();
    const { GET } = await import("@/app/api/tomorrow/route");

    const response = await GET(
      new NextRequest("http://localhost/api/tomorrow?date=2026-09-03"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources.focus.state).toBe("not-configured");
    expect(payload.sources.calendar.state).toBe("not-configured");
    expect(payload.focus.topThree).toEqual([]);
    expect(payload.meetings).toEqual([]);
    expect(payload.family.mealPlan.source).toBe("missing");
  }, 15_000);

  it("keeps partial family configuration actionable across Tomorrow and Reset", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "gutter-partial-family-"));
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.stubEnv("CALENDAR_ENABLED", "false");
    vi.resetModules();

    try {
      const { GET: getTomorrow } = await import("@/app/api/tomorrow/route");
      const tomorrowResponse = await getTomorrow(
        new NextRequest("http://localhost/api/tomorrow?date=2026-09-03"),
      );
      const tomorrowPayload = await tomorrowResponse.json();

      expect(tomorrowResponse.status).toBe(200);
      expect(tomorrowPayload.sources.family).toEqual({
        state: "not-configured",
        message: "Family planning is partially configured. Add meal-planner to OPENCLAW_WORKSPACE_PATH to load meals.",
        recovery: "configure",
      });
      expect(tomorrowPayload.family.mealPlan.source).toBe("missing");
      expect(tomorrowPayload.family.chores.remaining).toBeGreaterThan(0);
      expect(tomorrowPayload.family.chores.suggestedChoices).toHaveLength(2);

      const { GET: getReset } = await import("@/app/api/reset/route");
      const resetResponse = await getReset(
        new NextRequest("http://localhost/api/reset?date=2026-09-02"),
      );
      const resetPayload = await resetResponse.json();

      expect(resetResponse.status).toBe(200);
      expect(resetPayload.sources.family).toEqual({
        state: "not-configured",
        message: "Family planning is partially configured. Add meal-planner to OPENCLAW_WORKSPACE_PATH to load meals.",
        recovery: "configure",
      });
      expect(resetPayload.today.completedCount).toEqual(expect.any(Number));
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }, 15_000);

  it("keeps Tomorrow usable when configured focus reports cannot be traversed", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "gutter-unavailable-tomorrow-"));
    mkdirSync(join(workspace, "focus-reset"));
    mkdirSync(join(workspace, "family-ops"));
    writeFileSync(join(workspace, "focus-reset", "reports"), "not a directory");
    writeFileSync(join(workspace, "family-ops", "reports"), "not a directory");
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.stubEnv("CALENDAR_ENABLED", "false");
    vi.resetModules();
    const { GET } = await import("@/app/api/tomorrow/route");

    try {
      const response = await GET(
        new NextRequest("http://localhost/api/tomorrow?date=2026-09-03"),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.sources.focus).toEqual({
        state: "unavailable",
        message: "Focus reports are unavailable. Check OPENCLAW_WORKSPACE_PATH and retry.",
        recovery: "retry",
      });
      expect(payload.focus.topThree).toEqual([]);
      expect(payload.sources.calendar.state).toBe("not-configured");
      expect(payload.sources.family).toEqual({
        state: "unavailable",
        message: "Family planning data is unavailable. Check OPENCLAW_WORKSPACE_PATH and retry.",
        recovery: "retry",
      });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }, 15_000);

  it("keeps Reset journal data usable when tomorrow integrations are absent", async () => {
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", missingWorkspace);
    vi.stubEnv("CALENDAR_ENABLED", "false");
    vi.resetModules();
    const { GET } = await import("@/app/api/reset/route");

    const response = await GET(
      new NextRequest("http://localhost/api/reset?date=2026-09-02"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sources.calendar.state).toBe("not-configured");
    expect(payload.sources.family.state).toBe("not-configured");
    expect(payload.today.completedCount).toEqual(expect.any(Number));
    expect(payload.tomorrow.meetings).toEqual([]);
  }, 15_000);

  it("keeps Reset journal data usable when configured family reports cannot be traversed", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "gutter-unavailable-reset-"));
    mkdirSync(join(workspace, "family-ops"));
    writeFileSync(join(workspace, "family-ops", "reports"), "not a directory");
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    vi.stubEnv("CALENDAR_ENABLED", "false");
    vi.resetModules();
    const { GET } = await import("@/app/api/reset/route");

    try {
      const response = await GET(
        new NextRequest("http://localhost/api/reset?date=2026-09-02"),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.sources.family).toEqual({
        state: "unavailable",
        message: "Family planning data is unavailable. Check OPENCLAW_WORKSPACE_PATH and retry.",
        recovery: "retry",
      });
      expect(payload.today.completedCount).toEqual(expect.any(Number));
      expect(payload.tomorrow.meetings).toEqual([]);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }, 15_000);
});
