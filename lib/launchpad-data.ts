import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getChoreBoardData } from "@/lib/chores";
import { getDateNightData } from "@/lib/date-night";
import { getDb } from "@/lib/db";
import { getJournalDate, JOURNAL_TIME_ZONE, shiftJournalDate } from "@/lib/journal-date";
import { getMealPlanData } from "@/lib/meal-plan";
import { fetchCalendarEvents } from "@/lib/calendar";
import { getOpenClawWorkspacePath } from "@/lib/paths";
import type { OptionalSourceState, TomorrowLaunchpadData, TomorrowLaunchpadMeeting } from "@/types";

const WORKSPACE_ROOT = getOpenClawWorkspacePath();

export function getDefaultTodayDate(): string {
  return getJournalDate();
}

export function shiftIsoDate(date: string, days: number): string {
  return shiftJournalDate(date, days);
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
    timeZone: JOURNAL_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function getWeekStart(date: string): string {
  const base = new Date(`${date}T12:00:00Z`);
  const offset = (base.getUTCDay() + 6) % 7;
  return shiftJournalDate(date, -offset);
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

type WorkspaceReportResult = {
  markdown: string | null;
  state: "ready" | "empty" | "unavailable";
};

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function readLatestWorkspaceReport(dirName: string): Promise<WorkspaceReportResult> {
  try {
    const dir = join(WORKSPACE_ROOT, dirName, "reports");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
    const latest = files.at(-1);
    if (!latest) return { markdown: null, state: "empty" };
    return { markdown: await readFile(join(dir, latest), "utf8"), state: "ready" };
  } catch (error) {
    return {
      markdown: null,
      state: isMissingPath(error) ? "empty" : "unavailable",
    };
  }
}

export async function getFamilyData(requestedDate: string): Promise<{
  data: TomorrowLaunchpadData["family"];
  source: OptionalSourceState;
}> {
  const familyReportPromise = readLatestWorkspaceReport("family-ops");
  const mealPlanPromise = getMealPlanData(requestedDate).catch(() => null);
  const dateNightPromise = getDateNightData(requestedDate).catch(() => null);
  const familyReportResult = await familyReportPromise;
  const familyReport = familyReportResult.markdown;

  let choreBoard: ReturnType<typeof getChoreBoardData> | null = null;
  let choreBoardUnavailable = false;
  try {
    choreBoard = getChoreBoardData();
  } catch {
    choreBoardUnavailable = true;
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

  const data: TomorrowLaunchpadData["family"] = {
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
      source: mealPlan?.planSource || "missing",
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

  const unavailable =
    familyReportResult.state === "unavailable" ||
    !mealPlan ||
    mealPlan.source.state === "unavailable" ||
    !dateNight ||
    dateNight.sources.workspace.state === "unavailable" ||
    choreBoardUnavailable;
  const notConfigured =
    mealPlan?.source.state === "not-configured" ||
    dateNight?.sources.workspace.state === "not-configured" ||
    choreBoard?.source.state === "not-configured";
  const hasData = Boolean(
    familyReportResult.state === "ready" ||
    mealPlan?.source.state === "ready" ||
    dateNight?.sources.workspace.state === "ready" ||
    choreBoard?.source.state === "ready" ||
    data.dinner ||
    data.grocery.itemCount > 0 ||
    data.relationship.headline ||
    data.relationship.nextMove ||
    data.chores.remaining !== null ||
    data.chores.suggestedChoices.length > 0,
  );
  const source: OptionalSourceState = !existsSync(WORKSPACE_ROOT)
    ? {
        state: "not-configured",
        message: "Set OPENCLAW_WORKSPACE_PATH to load family planning data.",
        recovery: "configure",
      }
    : unavailable
      ? {
          state: "unavailable",
          message: "Family planning data is unavailable. Check OPENCLAW_WORKSPACE_PATH and retry.",
          recovery: "retry",
        }
      : notConfigured
        ? {
            state: "not-configured",
            message: "Family planning is partially configured. Add meal-planner to OPENCLAW_WORKSPACE_PATH to load meals.",
            recovery: "configure",
          }
      : {
          state: hasData ? "ready" : "empty",
          message: hasData ? "Family planning data loaded." : "No family planning data was found.",
          recovery: null,
        };

  return { data, source };
}

export async function getMeetings(requestedDate: string): Promise<{
  meetings: TomorrowLaunchpadMeeting[];
  source: OptionalSourceState;
}> {
  const calendarResult = await fetchCalendarEvents(requestedDate, requestedDate);
  if (!calendarResult.ok) return { meetings: [], source: calendarResult.source };

  const db = getDb();
  const rows = db
    .prepare("SELECT event_id, occurrence_date, prep_status FROM meeting_prep WHERE occurrence_date = ?")
    .all(requestedDate) as Array<{ event_id: string; occurrence_date: string; prep_status: "none" | "preparing" | "ready" }>;

  const prepByKey = new Map(
    rows.map((row) => [`${row.event_id}::${row.occurrence_date}`, row.prep_status]),
  );

  const meetings = (calendarResult.data || [])
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

  return { meetings, source: calendarResult.source };
}
