import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
  getDisplayDate,
  getFamilyData,
  getMeetings,
  getRequestedDate,
  shiftIsoDate,
} from "@/lib/launchpad-data";
import type { EveningResetData, EveningResetTask } from "@/types";

type ResetRow = {
  id: string;
  date: string;
  text: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waiting_on: string | null;
  tags: string | null;
};

function parseTags(rawTags: string | null): string[] {
  if (!rawTags) return [];
  try {
    const parsed = JSON.parse(rawTags);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function mapTask(row: ResetRow): EveningResetTask {
  return {
    id: row.id,
    date: row.date,
    title: row.text,
    status: row.status,
    lane: row.lane,
    priority: row.priority,
    waitingOn: row.waiting_on,
    tags: parseTags(row.tags),
  };
}

function buildChecklist(data: {
  leftovers: EveningResetTask[];
  carryoverCount: number;
  tomorrowNonHealthCount: number;
  tomorrowMeetings: number;
  meetingsNeedingPrep: number;
  dinnerName: string | null;
  groceryItemCount: number;
}): string[] {
  const checklist = [
    data.leftovers.length
      ? `Close or migrate ${data.leftovers.length} leftover task${data.leftovers.length === 1 ? "" : "s"} before tomorrow starts bluffing at you.`
      : "No open leftovers in Gutter tonight. Suspicious, but nice.",
    data.carryoverCount
      ? `${data.carryoverCount} older unresolved task${data.carryoverCount === 1 ? "" : "s"} are still haunting the board.`
      : "No older carryover is clogging tomorrow before it begins.",
    data.tomorrowNonHealthCount
      ? `Tomorrow already has ${data.tomorrowNonHealthCount} non-health task${data.tomorrowNonHealthCount === 1 ? "" : "s"} seeded.`
      : "Seed one real non-health task for tomorrow so morning-you has something better than vibes.",
  ];

  if (data.tomorrowMeetings > 0) {
    checklist.push(
      data.meetingsNeedingPrep > 0
        ? `${data.meetingsNeedingPrep} of tomorrow's ${data.tomorrowMeetings} meeting${data.tomorrowMeetings === 1 ? "" : "s"} still need prep.`
        : `Tomorrow's ${data.tomorrowMeetings} meeting${data.tomorrowMeetings === 1 ? "" : "s"} already have prep or don't need it.`,
    );
  }

  if (data.dinnerName || data.groceryItemCount > 0) {
    checklist.push(
      data.dinnerName
        ? `Dinner is ${data.dinnerName}; grocery list still has ${data.groceryItemCount} open item${data.groceryItemCount === 1 ? "" : "s"}.`
        : `Family dinner is still unplanned, and the grocery list has ${data.groceryItemCount} open item${data.groceryItemCount === 1 ? "" : "s"}.`,
    );
  }

  return checklist;
}

export async function GET(request: NextRequest) {
  try {
    const requestedDate = getRequestedDate(new URL(request.url).searchParams.get("date"), "today");
    const tomorrowDate = shiftIsoDate(requestedDate, 1);
    const db = getDb();

    const wins = db
      .prepare(`
        SELECT id, date, text, status, lane, priority, waiting_on, tags
        FROM journal_entries
        WHERE signifier = 'task'
          AND date = ?
          AND status = 'done'
        ORDER BY updated_at DESC, sort_order ASC
        LIMIT 6
      `)
      .all(requestedDate) as ResetRow[];

    const leftovers = db
      .prepare(`
        SELECT id, date, text, status, lane, priority, waiting_on, tags
        FROM journal_entries
        WHERE signifier = 'task'
          AND date = ?
          AND status IN ('open', 'in-progress', 'blocked')
        ORDER BY
          CASE status
            WHEN 'blocked' THEN 0
            WHEN 'in-progress' THEN 1
            ELSE 2
          END,
          CASE priority
            WHEN 'high' THEN 0
            WHEN 'normal' THEN 1
            WHEN 'low' THEN 2
            ELSE 3
          END,
          sort_order ASC
        LIMIT 8
      `)
      .all(requestedDate) as ResetRow[];

    const [{ total: completedCount }] = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM journal_entries
        WHERE signifier = 'task'
          AND date = ?
          AND status = 'done'
      `)
      .all(requestedDate) as Array<{ total: number }>;

    const [{ total: leftoverCount }] = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM journal_entries
        WHERE signifier = 'task'
          AND date = ?
          AND status IN ('open', 'in-progress', 'blocked')
      `)
      .all(requestedDate) as Array<{ total: number }>;

    const [{ total: carryoverCount }] = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM journal_entries
        WHERE signifier = 'task'
          AND date < ?
          AND status IN ('open', 'in-progress', 'blocked')
      `)
      .all(requestedDate) as Array<{ total: number }>;

    const tomorrowRows = db
      .prepare(`
        SELECT id, date, text, status, lane, priority, waiting_on, tags
        FROM journal_entries
        WHERE signifier = 'task'
          AND date = ?
          AND status IN ('open', 'in-progress', 'blocked', 'done')
        ORDER BY
          CASE
            WHEN tags LIKE '%health-cut%' THEN 1
            ELSE 0
          END,
          CASE priority
            WHEN 'high' THEN 0
            WHEN 'normal' THEN 1
            WHEN 'low' THEN 2
            ELSE 3
          END,
          sort_order ASC
        LIMIT 8
      `)
      .all(tomorrowDate) as ResetRow[];

    const tomorrowHealthCount = tomorrowRows.filter((row) => parseTags(row.tags).some((tag) => tag.startsWith("health-cut"))).length;
    const tomorrowNonHealthCount = tomorrowRows.length - tomorrowHealthCount;
    const meetings = await getMeetings(tomorrowDate);
    const family = await getFamilyData(tomorrowDate);
    const meetingsNeedingPrep = meetings.filter((meeting) => meeting.prepStatus !== "ready").length;

    const payload: EveningResetData = {
      requestedDate,
      tomorrowDate,
      displayDate: getDisplayDate(requestedDate),
      generatedAt: new Date().toISOString(),
      checklist: buildChecklist({
        leftovers: leftovers.map(mapTask),
        carryoverCount,
        tomorrowNonHealthCount,
        tomorrowMeetings: meetings.length,
        meetingsNeedingPrep,
        dinnerName: family.dinner?.mealName || null,
        groceryItemCount: family.grocery.itemCount,
      }),
      today: {
        completedCount,
        leftoverCount,
        carryoverCount,
        wins: wins.map(mapTask),
        leftovers: leftovers.map(mapTask),
      },
      tomorrow: {
        seededCount: tomorrowRows.length,
        nonHealthCount: tomorrowNonHealthCount,
        healthCount: tomorrowHealthCount,
        topTasks: tomorrowRows.map(mapTask),
        meetings,
        dinner: family.dinner
          ? {
              mealName: family.dinner.mealName,
              prepTime: family.dinner.prepTime,
            }
          : null,
        groceryItemCount: family.grocery.itemCount,
      },
    };

    return Response.json(payload);
  } catch (error) {
    console.error("[evening-reset] failed to build payload", error);
    return Response.json(
      { error: "Failed to build evening reset" },
      { status: 500 },
    );
  }
}
