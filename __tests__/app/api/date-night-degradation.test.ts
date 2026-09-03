import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const workspaces: string[] = [];

function makeWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "gutter-date-night-"));
  workspaces.push(workspace);
  return workspace;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/calendar");
  vi.resetModules();
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("Date Night optional integration degradation", () => {
  it("does not invoke Calendar when disabled and returns typed source recovery", async () => {
    const fetchCalendarEvents = vi.fn().mockResolvedValue({
      ok: false,
      error: "Calendar integration disabled",
      source: {
        state: "not-configured",
        message: "Calendar is disabled. Enable it to load meetings.",
        recovery: "configure",
      },
    });
    vi.doMock("@/lib/calendar", () => ({ fetchCalendarEvents }));
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", join(tmpdir(), `missing-date-night-${process.pid}`));

    const { GET } = await import("@/app/api/date-night/route");
    const response = await GET(new NextRequest("http://localhost/api/date-night?date=2026-09-02"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchCalendarEvents).toHaveBeenCalledWith("2026-09-02", "2026-10-02");
    expect(payload.sources).toEqual({
      calendar: {
        state: "not-configured",
        message: "Calendar is disabled. Enable it to load meetings.",
        recovery: "configure",
      },
      workspace: {
        state: "not-configured",
        message: "Set OPENCLAW_WORKSPACE_PATH to load saved date-night context.",
        recovery: "configure",
      },
    });
    expect(payload.nextEvent).toBeNull();
    expect(payload.giftIdeas).toEqual([]);
  });

  it("uses the configured workspace and shared Calendar events while preserving relationship filtering", async () => {
    const workspace = makeWorkspace();
    mkdirSync(join(workspace, "memory"), { recursive: true });
    mkdirSync(join(workspace, "date-night-preps"), { recursive: true });
    writeFileSync(join(workspace, "memory", "gift-ideas.json"), JSON.stringify({ jess: { ideas: ["Concert tickets"] } }));
    writeFileSync(join(workspace, "memory", "romance-log.md"), "| 2026-08-30 | Flowers | $20 | Surprise |\n");
    writeFileSync(join(workspace, "date-night-preps", "2026-09-01.md"), "**Event:** Dinner with Jess\n**Date:** 2026-09-05\n1. What felt good?\n");
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
    const fetchCalendarEvents = vi.fn().mockResolvedValue({
      ok: true,
      source: { state: "ready", message: "Calendar events loaded.", recovery: null },
      data: [
        {
          id: "date-1",
          summary: "Dinner with Jess",
          startDate: "2026-09-05T18:00:00",
          endDate: "2026-09-05T20:00:00",
          allDay: false,
          calendar: "Family Calendar",
        },
        {
          id: "work-1",
          summary: "Quarterly planning",
          startDate: "2026-09-06T09:00:00",
          endDate: "2026-09-06T10:00:00",
          allDay: false,
          calendar: "Calendar",
        },
      ],
    });
    vi.doMock("@/lib/calendar", () => ({ fetchCalendarEvents }));

    const { getDateNightData } = await import("@/lib/date-night");
    const data = await getDateNightData("2026-09-02");

    expect(fetchCalendarEvents).toHaveBeenCalledOnce();
    expect(data.sources.calendar.state).toBe("ready");
    expect(data.sources.workspace.state).toBe("ready");
    expect(data.nextEvent?.title).toBe("Dinner with Jess");
    expect(data.counts.upcomingEvents).toBe(1);
    expect(data.giftIdeas).toEqual(["Concert tickets"]);
    expect(data.lastGesture?.gesture).toBe("Flowers");
    expect(data.prep?.eventTitle).toBe("Dinner with Jess");
  });

  it("distinguishes an unavailable Calendar from a true empty result", async () => {
    const workspace = makeWorkspace();
    vi.stubEnv("OPENCLAW_WORKSPACE_PATH", workspace);
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

    const { getDateNightData } = await import("@/lib/date-night");
    const data = await getDateNightData("2026-09-02");

    expect(data.sources.calendar.state).toBe("unavailable");
    expect(data.sources.calendar.recovery).toBe("retry");
    expect(data.sources.workspace.state).toBe("empty");
    expect(data.nextEvent).toBeNull();
  });
});
