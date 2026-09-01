import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { getChoreBoardData } from "@/lib/chores";
import { getDateNightData } from "@/lib/date-night";
import { getDb } from "@/lib/db";
import { getMealPlanData } from "@/lib/meal-plan";
import { fetchCalendarEvents } from "@/lib/calendar";
import type { TomorrowLaunchpadData, TomorrowLaunchpadMeeting } from "@/types";

const WORKSPACE_ROOT = join(homedir(), ".openclaw", "workspace");

function getCancunDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number.parseInt(lookup.year, 10),
    month: Number.parseInt(lookup.month, 10),
    day: Number.parseInt(lookup.day, 10),
  };
}

export function getDefaultTodayDate(): string {
  const today = getCancunDateParts(new Date());
  return `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
}

export function shiftIsoDate(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().split("T")[0];
}

export function getDefaultTomorrowDate(): string {
  return shiftIsoDate(getDefaultTodayDate(), 1);
}

export function getRequestedDate(rawDate: string | null, fallback: "today" | "tomorrow" = "today"): string {
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  return fallback === "tomorrow" ? getDefaultTomorrowDate() : getDefaultTodayDate();
}

export function getDisplayDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function getWeekStart(date: string): string {
  const base = new Date(`${date}T12:00:00`);
  const offset = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - offset);
  return base.toISOString().split("T")[0];
}

export function findSectionLines(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return [];
  const collected: string[] = [];

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) break;
    if (line.trim()) collected.push(line);
  }

  return collected;
}

async function readLatestReport(dirName: string): Promise<string | null> {
  const dir = join(WORKSPACE_ROOT, dirName, "reports");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  const latest = files.at(-1);
  if (!latest) return null;
  return readFile(join(dir, latest), "utf8");
}

export async function getFamilyData(requestedDate: string): Promise<TomorrowLaunchpadData["family"]> {
  const familyReportPromise = readLatestReport("family-ops");
  const mealPlanPromise = getMealPlanData(requestedDate).catch(() => null);
  const dateNightPromise = getDateNightData(requestedDate).catch(() => null);
  const familyReport = await familyReportPromise;

  let choreBoard: ReturnType<typeof getChoreBoardData> | null = null;
  try {
    choreBoard = getChoreBoardData();
  } catch {
    choreBoard = null;
  }

  const [mealPlan, dateNight] = await Promise.all([mealPlanPromise, dateNightPromise]);

  const relationshipFallback = familyReport
    ?.split("\n")
    .find((line) => line.startsWith("Relationship:"))
    ?.replace("Relationship:", "")
    .trim() || null;
  const reportNextMove = familyReport
    ? findSectionLines(familyReport, "Recommended next move:")
        .find((line) => line.startsWith("- "))
        ?.replace(/^- /, "")
        .trim() || null
    : null;

  return {
    dinner: mealPlan?.highlight
      ? {
          day: mealPlan.highlight.day,
          mealName: mealPlan.highlight.mealName,
          prepTime: mealPlan.highlight.prepTime,
          notes: mealPlan.highlight.notes,
        }
      : null,
    mealPlan: {
      displayRange: mealPlan?.displayRange || null,
      source: mealPlan?.source || "missing",
      updatedAt: mealPlan?.planUpdatedAt || null,
    },
    grocery: {
      itemCount: mealPlan?.groceryItemCount || 0,
      sections: mealPlan?.grocerySections || [],
    },
    relationship: {
      status: dateNight?.status || "unknown",
      headline: dateNight?.headline || relationshipFallback,
      nextEventTitle: dateNight?.nextEvent?.title || null,
      nextEventDate: dateNight?.nextEvent?.start || null,
      nextMove: dateNight?.partner.nextMoves[0] || reportNextMove,
    },
    chores: {
      cycleNumber: choreBoard?.cycleNumber || null,
      remaining: choreBoard?.counts.remaining || null,
      suggestedChoices: choreBoard?.suggestedChoices || [],
      nextMove: choreBoard?.nextMove || null,
    },
    nextMove: dateNight?.partner.nextMoves[0] || choreBoard?.nextMove || reportNextMove,
  };
}

export async function getMeetings(requestedDate: string): Promise<TomorrowLaunchpadMeeting[]> {
  const calendarResult = await fetchCalendarEvents(requestedDate, requestedDate);
  if (!calendarResult.ok) return [];

  const db = getDb();
  const rows = db
    .prepare("SELECT event_id, occurrence_date, prep_status FROM meeting_prep WHERE occurrence_date = ?")
    .all(requestedDate) as Array<{ event_id: string; occurrence_date: string; prep_status: "none" | "preparing" | "ready" }>;

  const prepByKey = new Map(
    rows.map((row) => [`${row.event_id}::${row.occurrence_date}`, row.prep_status]),
  );

  return (calendarResult.data || [])
    .filter((event) => !event.allDay)
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    .map((event) => ({
      id: event.id,
      title: event.summary,
      startDate: event.startDate,
      endDate: event.endDate,
      calendar: event.calendar,
      location: event.location,
      prepStatus: prepByKey.get(`${event.id}::${requestedDate}`) || "none",
    }));
}
