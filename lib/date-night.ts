import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { DateNightData, DateNightEvent, DateNightLastGesture, DateNightPrep, OptionalSourceState } from "@/types";
import { fetchCalendarEvents, type CalendarEvent } from "@/lib/calendar";
import { shiftJournalDate } from "@/lib/journal-date";
import { getOpenClawWorkspacePath } from "@/lib/paths";

const CALENDARS = ["Family Calendar", "Home"];
const PARTNER_FAVORITES = ["Flowers", "Quality time", "Jewelry", "Surprises", "Thoughtful gifts"];
const PARTNER_TOKENS = ["jess", "jessica", "moogs", "morgan"];
const GENERIC_RELATIONSHIP_PHRASES = [
  "date night",
  "our anniversary",
];
const PARTNER_SCOPED_DATE_PHRASES = [
  "moogs & jess",
  "moogs and jess",
  "dinner with jess",
  "dinner - jess",
  "jess dinner",
  "dinner out",
  "romantic",
  "couples",
  "us time",
  "jess -",
  "- jess",
];
const CHECK_IN_PHRASES = [
  "check-in",
  "check in",
  "monthly check-in",
  "monthly check in",
];

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T12:00:00`).getTime();
  const to = new Date(`${toDate}T12:00:00`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function hasPartnerToken(title: string): boolean {
  const lower = title.toLowerCase();
  return PARTNER_TOKENS.some((token) => lower.includes(token));
}

function isDateRelated(title: string): boolean {
  const lower = title.toLowerCase();

  if (GENERIC_RELATIONSHIP_PHRASES.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  if (PARTNER_SCOPED_DATE_PHRASES.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  if (CHECK_IN_PHRASES.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  return lower.includes("anniversary") && hasPartnerToken(title);
}

function isPartnerScopedEvent(title: string): boolean {
  const lower = title.toLowerCase();
  const partnerTagged = hasPartnerToken(title);

  if (!isDateRelated(title)) {
    return false;
  }

  if (CHECK_IN_PHRASES.some((keyword) => lower.includes(keyword))) {
    return partnerTagged;
  }

  if (lower.includes("anniversary")) {
    return partnerTagged || lower.includes("our anniversary");
  }

  if (partnerTagged) {
    return true;
  }

  return GENERIC_RELATIONSHIP_PHRASES.some((keyword) => lower.includes(keyword));
}

function isCheckInOnly(title: string): boolean {
  const lower = title.toLowerCase();
  return CHECK_IN_PHRASES.some((keyword) => lower.includes(keyword)) && !lower.includes("date");
}

function formatDisplayDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function loadDateEvents(requestedDate: string, calendarEvents: CalendarEvent[]): DateNightEvent[] {
  return calendarEvents
    .filter((event) => CALENDARS.includes(event.calendar) && isPartnerScopedEvent(event.summary))
    .map((event) => ({
      title: event.summary,
      start: event.startDate,
      end: event.endDate || event.startDate,
      calendar: event.calendar,
      isCheckInOnly: isCheckInOnly(event.summary),
      daysUntil: daysBetween(requestedDate, event.startDate.split("T")[0]),
    }))
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function loadLastGesture(path: string, warnings: string[]): Promise<DateNightLastGesture | null> {
  try {
    const raw = await readFile(path, "utf8");
    const lines = raw.split("\n").filter((line) => line.startsWith("| 20") || line.startsWith("| ~20"));
    const line = lines.at(-1);
    if (!line) return null;

    const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 4) return null;
    return {
      date: parts[0].replace(/^~/, ""),
      gesture: parts[1],
      cost: parts[2],
      notes: parts[3],
    };
  } catch (error) {
    if (!isMissingFile(error)) warnings.push("Romance log could not be read.");
    return null;
  }
}

async function loadGiftIdeas(path: string, warnings: string[]): Promise<string[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as { jess?: { ideas?: string[] } };
    return parsed.jess?.ideas || [];
  } catch (error) {
    if (!isMissingFile(error)) warnings.push("Gift ideas could not be read.");
    return [];
  }
}

async function loadLatestPrep(directory: string, warnings: string[]): Promise<DateNightPrep | null> {
  try {
    const files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort();
    const latest = files.at(-1);
    if (!latest) return null;

    const raw = await readFile(join(directory, latest), "utf8");
    const lines = raw.split("\n");
    const eventTitle = lines.find((line) => line.startsWith("**Event:**"))?.replace("**Event:**", "").trim() || null;
    const date = lines.find((line) => line.startsWith("**Date:**"))?.replace("**Date:**", "").trim() || null;

    const questions = lines
      .filter((line) => /^\d+\.\s+/.test(line))
      .map((line) => line.replace(/^\d+\.\s+/, "").trim());

    const tipsStart = lines.findIndex((line) => line.startsWith("### Tips for Moogs"));
    const tips = tipsStart >= 0
      ? lines.slice(tipsStart + 1).filter((line) => line.startsWith("- ")).map((line) => line.slice(2).trim())
      : [];

    return { eventTitle, date, questions, tips };
  } catch (error) {
    if (!isMissingFile(error)) warnings.push("Date-night prep could not be read.");
    return null;
  }
}

function buildNextMoves(input: {
  realDateNight: DateNightEvent | null;
  checkInOnly: DateNightEvent | null;
  lastGesture: DateNightLastGesture | null;
  staleGestureDays: number | null;
  giftIdeas: string[];
  calendarUsable: boolean;
}): string[] {
  const moves: string[] = [];

  if (input.calendarUsable && !input.realDateNight) {
    moves.push("Put one casual date on the calendar this week so the relationship is not running on fumes and vibes.");
  }
  if (input.calendarUsable && input.checkInOnly) {
    moves.push("Rename or replace the stray check-in so it happens inside a real date night instead of standing alone like a calendar scold.");
  }
  if (!input.lastGesture || (input.staleGestureDays !== null && input.staleGestureDays > 45)) {
    const nextRelationshipTouchpoint = input.realDateNight || input.checkInOnly;
    if (nextRelationshipTouchpoint && nextRelationshipTouchpoint.daysUntil >= 0) {
      moves.push(`Do one tiny gesture before ${nextRelationshipTouchpoint.title} on ${formatDisplayDate(nextRelationshipTouchpoint.start.split("T")[0])}. Flowers, a thoughtful surprise, or planned quality time all count.`);
    } else {
      moves.push("Do one tiny gesture this week. Flowers, a thoughtful surprise, or planned quality time all count.");
    }
  }
  if (input.giftIdeas.length === 0) {
    moves.push("Capture at least one fresh Jess gift idea the next time she mentions wanting something. Stop trusting your memory to grow a conscience.");
  }

  return moves.slice(0, 3);
}

export async function getDateNightData(requestedDate: string): Promise<DateNightData> {
  if (!isValidIsoDate(requestedDate)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  const workspace = getOpenClawWorkspacePath();
  const calendarResult = await fetchCalendarEvents(requestedDate, shiftDate(requestedDate, 30));
  const events = loadDateEvents(requestedDate, calendarResult.data || []);
  const warnings: string[] = [];
  let lastGesture: DateNightLastGesture | null = null;
  let giftIdeas: string[] = [];
  let prep: DateNightPrep | null = null;
  let workspaceSource: OptionalSourceState;

  try {
    await readdir(workspace);
    [lastGesture, giftIdeas, prep] = await Promise.all([
      loadLastGesture(join(workspace, "memory", "romance-log.md"), warnings),
      loadGiftIdeas(join(workspace, "memory", "gift-ideas.json"), warnings),
      loadLatestPrep(join(workspace, "date-night-preps"), warnings),
    ]);

    if (warnings.length > 0) {
      workspaceSource = {
        state: "unavailable",
        message: "Saved date-night context could not be read. Check the workspace and retry.",
        recovery: "retry",
      };
    } else if (lastGesture || prep || giftIdeas.length > 0) {
      workspaceSource = {
        state: "ready",
        message: "Saved date-night context loaded.",
        recovery: null,
      };
    } else {
      workspaceSource = {
        state: "empty",
        message: "No saved date-night context found.",
        recovery: null,
      };
    }
  } catch (error) {
    workspaceSource = isMissingFile(error)
      ? {
          state: "not-configured",
          message: "Set OPENCLAW_WORKSPACE_PATH to load saved date-night context.",
          recovery: "configure",
        }
      : {
          state: "unavailable",
          message: "Saved date-night context could not be read. Check the workspace and retry.",
          recovery: "retry",
        };
  }

  const realDateNight = events.find((event) => !event.isCheckInOnly) || null;
  const checkInOnly = events.find((event) => event.isCheckInOnly) || null;
  const nextEvent = realDateNight || checkInOnly || null;
  const staleGestureDays = lastGesture ? daysBetween(lastGesture.date, requestedDate) : null;
  const nextMoves = buildNextMoves({
    realDateNight,
    checkInOnly,
    lastGesture,
    staleGestureDays,
    giftIdeas,
    calendarUsable: calendarResult.source.state === "ready" || calendarResult.source.state === "empty",
  });

  const status =
    !realDateNight ? "drifting" :
    realDateNight.daysUntil <= 7 ? "locked-in" :
    "scheduled";

  const headline =
    calendarResult.source.state === "not-configured" || calendarResult.source.state === "unavailable"
      ? calendarResult.source.message
      : !nextEvent
      ? "No date context found in the next 30 days."
      : nextEvent.isCheckInOnly
        ? `${nextEvent.title} is on the calendar, but it is drifting outside a real date night.`
        : `${nextEvent.title} is on deck and should stay protected.`;

  return {
    requestedDate,
    displayDate: formatDisplayDate(requestedDate),
    generatedAt: new Date().toISOString(),
    status,
    headline,
    warnings,
    sources: {
      calendar: calendarResult.source,
      workspace: workspaceSource,
    },
    nextEvent,
    counts: {
      upcomingEvents: events.length,
      giftIdeas: giftIdeas.length,
      prepQuestions: prep?.questions.length || 0,
    },
    drift: {
      hasRealDateNight: Boolean(realDateNight),
      hasCheckInOnly: Boolean(checkInOnly),
      staleGestureDays,
    },
    lastGesture,
    prep,
    partner: {
      budget: "$200/month",
      favorites: PARTNER_FAVORITES,
      nextMoves,
    },
    giftIdeas,
  };
}
