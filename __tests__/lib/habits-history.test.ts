import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import {
  getHabitsMomentumData,
  resolveHabitHistoryState,
  setHabitCheckIn,
} from "@/lib/habits";

let directory: string;
const originalDatabasePath = process.env.DATABASE_PATH;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "gutter-habit-history-"));
  process.env.DATABASE_PATH = join(directory, "history.db");
});

afterEach(() => {
  closeDb();
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
  rmSync(directory, { recursive: true, force: true });
});

describe("habit history policy", () => {
  it("shows authoritative Done and Skipped records while absence remains Unlogged", async () => {
    setHabitCheckIn("workout", "2026-08-31", "done");
    setHabitCheckIn("workout", "2026-09-01", "skipped");

    const data = await getHabitsMomentumData("2026-09-02");
    const stateOn = (date: string) => data.days.find((day) => day.date === date)?.statuses.workout;

    expect(stateOn("2026-08-31")).toBe("done");
    expect(stateOn("2026-09-01")).toBe("skipped");
    expect(stateOn("2026-09-02")).toBe("unlogged");
  });

  it("keeps passive evidence as a suggestion instead of turning it into completion or a miss", async () => {
    getDb().prepare(`
      INSERT INTO journal_entries (id, date, signifier, text, status, tags, sort_order)
      VALUES ('signal-1', '2026-09-02', 'task', 'Workout', 'done', '["health-cut:workout"]', 0)
    `).run();

    const data = await getHabitsMomentumData("2026-09-02");
    const workout = data.today.find((habit) => habit.habitId === "workout");

    expect(workout?.state).toBe("unlogged");
    expect(workout?.suggestion).toMatch(/confirm/i);
  });

  it("uses Missed only when an explicit policy opts in for a past scheduled day", () => {
    expect(resolveHabitHistoryState(undefined, { isPast: true, missedWhenUnlogged: false })).toBe("unlogged");
    expect(resolveHabitHistoryState(undefined, { isPast: true, missedWhenUnlogged: true })).toBe("missed");
    expect(resolveHabitHistoryState(undefined, { isPast: false, missedWhenUnlogged: true })).toBe("unlogged");
  });
});
