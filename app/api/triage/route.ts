import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getJournalDate } from "@/lib/journal-date";
import { handleApiError, handleValidationError } from "@/lib/api-error-handler";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import type { BacklogTriageData, BacklogTriageItem } from "@/types";

type TriageRow = {
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
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function ageInDays(date: string, requestedDate: string) {
  const start = new Date(`${date}T12:00:00`);
  const end = new Date(`${requestedDate}T12:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function normalizeTask(row: TriageRow, requestedDate: string): BacklogTriageItem {
  const tags = parseTags(row.tags);
  return {
    id: row.id,
    date: row.date,
    title: row.text,
    text: row.text,
    status: row.status,
    lane: row.lane,
    priority: row.priority,
    waiting_on: row.waiting_on,
    tags,
    updated_at: row.updated_at,
    ageDays: ageInDays(row.date, requestedDate),
    isLegacy: tags.includes("legacy-task"),
  };
}

function sortTasks(items: BacklogTriageItem[]) {
  return items.sort((a, b) => {
    if (b.ageDays !== a.ageDays) return b.ageDays - a.ageDays;
    return a.date.localeCompare(b.date);
  });
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 50,
  });
  if (limited) return limited;

  const requestedDate = req.nextUrl.searchParams.get("date") ?? getLocalDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return handleValidationError("Invalid date format. Use YYYY-MM-DD");
  }

  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT id, date, text, status, lane, priority, waiting_on, tags, updated_at
       FROM journal_entries
       WHERE signifier = 'task'
         AND date < ?
         AND status IN ('open', 'in-progress', 'blocked')
       ORDER BY date ASC, sort_order ASC`
    ).all(requestedDate) as TriageRow[];

    const items = rows.map((row) => normalizeTask(row, requestedDate));
    const blockers = sortTasks(items.filter((item) => item.status === "blocked"));
    const staleActive = sortTasks(
      items.filter(
        (item) =>
          !item.isLegacy &&
          item.status !== "blocked" &&
          item.ageDays >= 3 &&
          !(item.status === "open" && item.ageDays >= 30)
      )
    );
    const legacy = sortTasks(items.filter((item) => item.isLegacy));
    const deepArchive = sortTasks(
      items.filter((item) => item.ageDays >= 30 && !item.isLegacy && item.status === "open")
    );

    const data: BacklogTriageData = {
      requestedDate,
      generatedAt: new Date().toISOString(),
      buckets: {
        blockers,
        staleActive,
        legacy,
        deepArchive,
      },
      counts: {
        total: items.length,
        blockers: blockers.length,
        staleActive: staleActive.length,
        legacy: legacy.length,
        deepArchive: deepArchive.length,
      },
    };

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError("load backlog triage", error);
  }
}
