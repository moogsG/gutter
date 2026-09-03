import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/lib/db";

let directory: string;
const originalDatabasePath = process.env.DATABASE_PATH;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "gutter-habits-"));
  process.env.DATABASE_PATH = join(directory, "habits.db");
});

afterEach(() => {
  vi.useRealTimers();
  closeDb();
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
  rmSync(directory, { recursive: true, force: true });
});

describe("habits API", () => {
  it("persists authoritative Done and Skipped check-ins and clears them to Unlogged", async () => {
    const { GET, POST } = await import("@/app/api/habits/route");

    for (const state of ["done", "skipped"] as const) {
      const response = await POST(new NextRequest("http://localhost/api/habits", {
        method: "POST",
        body: JSON.stringify({ habitId: "workout", date: "2026-09-02", state }),
      }));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ habitId: "workout", date: "2026-09-02", state });
    }

    let response = await GET(new NextRequest("http://localhost/api/habits?date=2026-09-02"));
    let payload = await response.json();
    expect(payload.today.find((item: { habitId: string }) => item.habitId === "workout").state).toBe("skipped");

    response = await POST(new NextRequest("http://localhost/api/habits", {
      method: "POST",
      body: JSON.stringify({ habitId: "workout", date: "2026-09-02", state: "unlogged" }),
    }));
    expect(response.status).toBe(200);

    response = await GET(new NextRequest("http://localhost/api/habits?date=2026-09-02"));
    payload = await response.json();
    expect(payload.today.find((item: { habitId: string }) => item.habitId === "workout").state).toBe("unlogged");
  });

  it("uses the journal timezone date at the UTC day boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T04:30:00.000Z"));
    const { GET } = await import("@/app/api/habits/route");

    const response = await GET(new NextRequest("http://localhost/api/habits"));
    expect(response.status).toBe(200);
    expect((await response.json()).requestedDate).toBe("2026-09-01");
  });

  it("rejects impossible dates, unknown habits, and unsupported states", async () => {
    const { GET, POST } = await import("@/app/api/habits/route");

    expect((await GET(new NextRequest("http://localhost/api/habits?date=2026-02-31"))).status).toBe(400);
    expect((await POST(new NextRequest("http://localhost/api/habits", {
      method: "POST",
      body: JSON.stringify({ habitId: "unknown", date: "2026-09-02", state: "done" }),
    }))).status).toBe(400);
    expect((await POST(new NextRequest("http://localhost/api/habits", {
      method: "POST",
      body: JSON.stringify({ habitId: "workout", date: "2026-09-02", state: "missed" }),
    }))).status).toBe(400);
  });
});
