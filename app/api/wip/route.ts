import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getJournalDate } from "@/lib/journal-date";
import { handleApiError, handleValidationError } from "@/lib/api-error-handler";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import type { WipLimitData, WipLimitItem } from "@/types";

type WipRow = {
  id: string;
  date: string;
  text: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waiting_on: string | null;
  tags: string | null;
  updated_at: string;
};

function getLocalDateString() {
  return getJournalDate();
}

function parseTags(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

function ageInDays(date: string, requestedDate: string) {
  const start = new Date(`${date}T12:00:00`);
  const end = new Date(`${requestedDate}T12:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function daysSinceTimestamp(value: string | null, requestedDate: string) {
  if (!value) return 999;
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return 999;
  const end = new Date(`${requestedDate}T12:00:00`);
  return Math.max(0, Math.round((end.getTime() - parsed.getTime()) / 86400000));
}

function priorityWeight(priority: string | null) {
  if (priority === "high") return 3;
  if (priority === "normal") return 2;
  if (priority === "low") return 1;
  return 2;
}

function laneWeight(lane: string | null) {
  switch (lane) {
    case "work":
      return 5;
    case "family":
      return 4;
    case "personal":
      return 3;
    case "jw":
      return 2;
    case "petalz":
      return 1;
    default:
      return 2;
  }
}

function normalizeTask(row: WipRow, requestedDate: string): WipLimitItem {
  const tags = parseTags(row.tags);
  const isLegacy = tags.includes("legacy-task");
  const ageDays = ageInDays(row.date, requestedDate);
  const updatedDays = daysSinceTimestamp(row.updated_at, requestedDate);
  const keepScore =
    Math.max(0, 30 - Math.min(updatedDays, 30)) * 3 +
    Math.max(0, 14 - Math.min(ageDays, 14)) * 2 +
    (isLegacy ? -40 : 20) +
    laneWeight(row.lane) * 4 +
    priorityWeight(row.priority) * 4 -
    (row.waiting_on ? 10 : 0);

  return {
    id: row.id,
    date: row.date,
    title: row.text,
    status: row.status,
    lane: row.lane,
    priority: row.priority,
    waitingOn: row.waiting_on,
    tags,
    updatedAt: row.updated_at,
    ageDays,
    isLegacy,
    keepScore,
  };
}

function sortForKeep(left: WipLimitItem, right: WipLimitItem) {
  if (right.keepScore !== left.keepScore) return right.keepScore - left.keepScore;
  if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
  if (left.ageDays !== right.ageDays) return left.ageDays - right.ageDays;
  return right.date.localeCompare(left.date);
}

function sortForCoolDown(left: WipLimitItem, right: WipLimitItem) {
  if (left.isLegacy !== right.isLegacy) return left.isLegacy ? -1 : 1;
  if (right.ageDays !== left.ageDays) return right.ageDays - left.ageDays;
  return left.title.localeCompare(right.title);
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 50,
  });
  if (limited) return limited;

  const today = getLocalDateString();
  const requestedDate = req.nextUrl.searchParams.get("date") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return handleValidationError("Invalid date format. Use YYYY-MM-DD");
  }
  if (requestedDate !== today) {
    return handleValidationError("Historical WIP snapshots are not supported yet. Use today's date.");
  }

  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, date, text, status, lane, priority, waiting_on, tags, updated_at
         FROM journal_entries
         WHERE signifier = 'task'
           AND status = 'in-progress'
         ORDER BY date DESC, sort_order ASC`,
      )
      .all() as WipRow[];

    const items = rows.map((row) => normalizeTask(row, requestedDate));
    const nonLegacy = items.filter((item) => !item.isLegacy).sort(sortForKeep);
    const legacy = items.filter((item) => item.isLegacy).sort(sortForKeep);
    const keepFocus = [...nonLegacy, ...legacy].slice(0, 3);
    const keepIds = new Set(keepFocus.map((item) => item.id));
    const coolDownQueue = items.filter((item) => !keepIds.has(item.id)).sort(sortForCoolDown);
    const legacyCount = items.filter((item) => item.isLegacy).length;
    const staleCount = items.filter((item) => item.ageDays >= 3).length;
    const laneCounts = new Map<string, number>();

    for (const item of items) {
      const lane = item.lane || "personal";
      laneCounts.set(lane, (laneCounts.get(lane) ?? 0) + 1);
    }

    const laneBreakdown = [...laneCounts.entries()]
      .map(([lane, count]) => ({ lane, count }))
      .sort((left, right) => right.count - left.count || left.lane.localeCompare(right.lane));

    const data: WipLimitData = {
      requestedDate,
      generatedAt: new Date().toISOString(),
      headline:
        items.length <= 3
          ? "WIP is inside the limit. Miracles do happen."
          : `${items.length} active tasks is not a focus system. It is a stress collection.`,
      nextMove:
        coolDownQueue.length > 0
          ? `Keep ${keepFocus.length} best candidates active and demote or block the other ${coolDownQueue.length} so tomorrow has a spine.`
          : "You only have a few in-progress tasks left. Finish one before adopting another stray.",
      counts: {
        total: items.length,
        keep: keepFocus.length,
        coolDown: coolDownQueue.length,
        stale: staleCount,
        legacy: legacyCount,
      },
      laneBreakdown,
      keepFocus,
      coolDownQueue,
    };

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError("load wip limit board", error);
  }
}
