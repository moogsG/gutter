import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getDb } from "@/lib/db";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";
import type {
  HabitsLegacySnapshotItem,
  HabitsMomentumData,
  HabitsMomentumHabit,
  HabitsMomentumStatus,
} from "@/types";

const WINDOW_DAYS = 14;
const WORKSPACE_ROOT = resolve(process.cwd(), "..", "..", ".openclaw", "workspace");
const TRACKER_PATH = resolve(WORKSPACE_ROOT, "memory", "habit-tracker.json");
const MEMORY_DIR = resolve(WORKSPACE_ROOT, "memory");

const HABIT_DEFS = [
  { id: "omad", label: "Protein-First", description: "One clean protein-first meal with measured damage.", tag: "health-cut:omad" },
  { id: "workout", label: "Workout / Walk", description: "Lift if scheduled, walk if life gets stupid.", tag: "health-cut:workout" },
  { id: "alcohol", label: "No Alcohol", description: "Weekdays are for the cut, not liquid sabotage.", tag: "health-cut:alcohol" },
  { id: "prep", label: "Tomorrow Protein", description: "Choose tomorrow's protein before panic-order brain takes over.", tag: "health-cut:prep" },
  { id: "mealLog", label: "Food Check-In", description: "Daily note or journal proof that the food confession actually happened.", tag: "health-log:meal" },
] as const;

type HabitId = (typeof HABIT_DEFS)[number]["id"];

const MEMORY_PATTERNS: Record<HabitId, RegExp> = {
  omad: /✅\s+(OMAD cut|Balanced meals today)/i,
  workout: /✅\s+(Train or brisk-walk|Move for 30 minutes)/i,
  alcohol: /✅\s+(No alcohol tonight|If you drink tonight, cap it at 2)/i,
  prep: /✅\s+(Choose tomorrow's protein|Before bed, lock in the next lean protein)/i,
  mealLog: /✅\s+Log what you actually ate today/i,
};

interface HabitRow {
  date: string;
  status: string;
  tags: string | null;
}

interface MealLogRow {
  date: string;
}

interface TrackerFile {
  date?: string;
  notes?: string;
  habits?: Record<string, boolean>;
}

export function formatCancunIsoDate(date = new Date()): string {
  return getJournalDate(date);
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function formatRange(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const startLabel = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function toLegacySnapshot(tracker: TrackerFile | null): HabitsLegacySnapshotItem[] {
  const habits = tracker?.habits ?? {};
  return [
    { id: "gym", label: "Gym", value: habits.gym ?? null },
    { id: "reading", label: "Reading", value: habits.reading ?? null },
    { id: "spanish", label: "Spanish", value: habits.spanish ?? null },
    { id: "spiritual", label: "Spiritual", value: habits.spiritual ?? null },
    { id: "meds_am", label: "AM Meds", value: habits.meds_am ?? null },
    { id: "meds_pm", label: "PM Meds", value: habits.meds_pm ?? null },
  ];
}

async function readTrackerFile(): Promise<TrackerFile | null> {
  try {
    const raw = await readFile(TRACKER_PATH, "utf8");
    return JSON.parse(raw) as TrackerFile;
  } catch {
    return null;
  }
}

async function readMemorySignals(dates: string[]): Promise<Map<string, Partial<Record<HabitId, boolean>>>> {
  const entries = await Promise.all(dates.map(async (date) => {
    try {
      const raw = await readFile(resolve(MEMORY_DIR, `${date}.md`), "utf8");
      const signals = Object.fromEntries(
        Object.entries(MEMORY_PATTERNS).map(([habitId, pattern]) => [habitId, pattern.test(raw)]),
      ) as Partial<Record<HabitId, boolean>>;
      return [date, signals] as const;
    } catch {
      return [date, {}] as const;
    }
  }));

  return new Map(entries);
}

function buildHabitSummary(id: HabitId, statuses: HabitsMomentumStatus[]): HabitsMomentumHabit {
  const def = HABIT_DEFS.find((habit) => habit.id === id)!;
  const tracked = statuses.filter((status) => status !== "off" && status !== "untracked");
  const hits = tracked.filter((status) => status === "hit").length;
  let currentStreak = 0;
  let bestStreak = 0;
  let running = 0;

  for (const status of tracked) {
    if (status === "hit") {
      running += 1;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }

  for (let index = tracked.length - 1; index >= 0; index -= 1) {
    if (tracked[index] === "hit") {
      currentStreak += 1;
      continue;
    }
    break;
  }

  return {
    id,
    label: def.label,
    description: def.description,
    hits,
    trackedDays: tracked.length,
    currentStreak,
    bestStreak,
    hitRate: tracked.length ? Math.round((hits / tracked.length) * 100) : 0,
    lastHitDate: null,
  };
}

export async function getHabitsMomentumData(requestedDate = formatCancunIsoDate()): Promise<HabitsMomentumData> {
  const endDate = requestedDate;
  const startDate = shiftDate(requestedDate, -(WINDOW_DAYS - 1));
  const db = getDb();
  const tracker = await readTrackerFile();
  const windowDates = Array.from({ length: WINDOW_DAYS }, (_, index) => shiftDate(startDate, index));
  const memorySignals = await readMemorySignals(windowDates);

  const habitRows = db.prepare(`
    SELECT date, status, tags
    FROM journal_entries
    WHERE signifier = 'task'
      AND date >= ?
      AND date <= ?
      AND tags LIKE '%health-cut:%'
    ORDER BY date ASC, sort_order ASC
  `).all(startDate, endDate) as HabitRow[];

  const mealRows = db.prepare(`
    SELECT DISTINCT date
    FROM journal_entries
    WHERE date >= ?
      AND date <= ?
      AND tags LIKE '%health-log:meal%'
    ORDER BY date ASC
  `).all(startDate, endDate) as MealLogRow[];

  const rowsByDate = new Map<string, HabitRow[]>();
  for (const row of habitRows) {
    const bucket = rowsByDate.get(row.date) ?? [];
    bucket.push(row);
    rowsByDate.set(row.date, bucket);
  }

  const mealDates = new Set(mealRows.map((row) => row.date));
  const dayStatuses = new Map<string, Record<HabitId, HabitsMomentumStatus>>();
  const habitStatusLists = new Map<HabitId, HabitsMomentumStatus[]>(
    HABIT_DEFS.map((habit) => [habit.id, []]),
  );

  for (const date of windowDates) {
    const rows = rowsByDate.get(date) ?? [];
    const memory = memorySignals.get(date) ?? {};
    const isCurrentDay = date === requestedDate;
    const statuses: Record<HabitId, HabitsMomentumStatus> = {
      omad: isCurrentDay ? "off" : "untracked",
      workout: isCurrentDay ? "off" : "untracked",
      alcohol: isCurrentDay ? "off" : "untracked",
      prep: isCurrentDay ? "off" : "untracked",
      mealLog: isCurrentDay ? "off" : "untracked",
    };

    for (const habit of HABIT_DEFS.filter((entry) => entry.id !== "mealLog")) {
      const row = rows.find((candidate) => parseTags(candidate.tags).includes(habit.tag));
      if (row) {
        statuses[habit.id] = memory[habit.id]
          ? "hit"
          : isCurrentDay
            ? "off"
            : row.status === "done"
              ? "hit"
              : "miss";
        continue;
      }

      if (memory[habit.id]) {
        statuses[habit.id] = "hit";
      }
    }

    const trackedToday = rows.length > 0 || mealDates.has(date) || Object.values(memory).some(Boolean);
    if (trackedToday) {
      statuses.mealLog = memory.mealLog || mealDates.has(date)
        ? "hit"
        : isCurrentDay
          ? "off"
          : "miss";
    }

    dayStatuses.set(date, statuses);
    for (const habit of HABIT_DEFS) {
      habitStatusLists.get(habit.id)!.push(statuses[habit.id]);
    }
  }

  const habits = HABIT_DEFS.map((habit) => {
    const statuses = habitStatusLists.get(habit.id)!;
    const summary = buildHabitSummary(habit.id, statuses);
    const lastHitIndex = statuses.lastIndexOf("hit");
    return {
      ...summary,
      lastHitDate: lastHitIndex >= 0 ? shiftDate(startDate, lastHitIndex) : null,
    };
  });

  const days = Array.from(dayStatuses.entries()).map(([date, statuses]) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    weekday: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
    statuses,
  }));

  const trackerDate = tracker?.date ?? null;
  const daysStale = trackerDate
    ? Math.floor((new Date(`${requestedDate}T12:00:00`).getTime() - new Date(`${trackerDate}T12:00:00`).getTime()) / 86_400_000)
    : null;
  const trackerHealth: HabitsMomentumData["trackerHealth"] = trackerDate
    ? {
        mode: daysStale !== null && daysStale > 14 ? "stale" : "healthy",
        lastUpdated: trackerDate,
        daysStale,
        note: tracker?.notes ?? null,
      }
    : {
        mode: "missing" as const,
        lastUpdated: null,
        daysStale: null,
        note: "Legacy passive tracker file missing.",
      };

  const trackedDays = days.filter((day) =>
    Object.values(day.statuses).some((status) => status !== "off" && status !== "untracked"),
  ).length;
  const missingDays = days.filter((day) =>
    Object.values(day.statuses).every((status) => status === "untracked"),
  ).length;
  const coveragePercent = Math.round((trackedDays / WINDOW_DAYS) * 100);
  const strongHabits = habits.filter(
    (habit) => habit.hitRate >= 70 && habit.trackedDays >= Math.ceil(WINDOW_DAYS * 0.7),
  ).length;
  const slippingHabits = habits.filter((habit) => habit.trackedDays >= 3 && habit.hitRate < 50).length;
  const nextMove =
    missingDays >= Math.ceil(WINDOW_DAYS / 2)
      ? "Most of this window is missing proof, not failure. Open Health today and log the food confession so this board has something real to judge."
      : slippingHabits > 0
        ? "You have enough signal now. Close the slipping habits before they become another fake story you tell yourself."
        : "Signal coverage is finally decent. Keep feeding the board honest daily wins instead of leaving it to guess.";

  return {
    requestedDate,
    generatedAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    displayRange: formatRange(startDate, endDate),
    trackerHealth,
    summary: {
      trackedDays,
      missingDays,
      coveragePercent,
      strongHabits,
      slippingHabits,
    },
    nextMove,
    habits,
    days,
    legacySnapshot: toLegacySnapshot(tracker),
  };
}
