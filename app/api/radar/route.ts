import { readFile, writeFile } from "node:fs/promises";
import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import type { FollowThroughRadarData, FollowThroughPromise, FollowThroughTask } from "@/types";

const PROMISES_PATH = "/Users/moogs/.openclaw/workspace/memory/promises.json";

type TaskRow = {
  id: string;
  date: string;
  text: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waiting_on: string | null;
  tags: string | null;
  updated_at: string;
  created_at: string;
};

type PromiseStatus = "pending" | "resolved" | "dropped";

type PromiseRecord = {
  id: string;
  text: string;
  context?: string | null;
  deadline?: string | null;
  madeAt?: string | null;
  status?: PromiseStatus;
  resolvedAt?: string | null;
};

function getRequestedDate(input: string | null): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function normalizeTask(row: TaskRow, requestedDate: string): FollowThroughTask {
  const tags = row.tags ? JSON.parse(row.tags) : [];
  return {
    id: row.id,
    date: row.date,
    title: row.text,
    status: row.status,
    lane: row.lane,
    priority: row.priority,
    waitingOn: row.waiting_on,
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [],
    ageDays: daysBetween(row.date, requestedDate),
    updatedAt: row.updated_at,
  };
}

async function loadPromises(requestedDate: string): Promise<FollowThroughPromise[]> {
  try {
    const promises = await readPromiseRecords();

    return promises
      .filter((promise) => promise.status === "pending" && typeof promise.text === "string")
      .map((promise) => {
        const deadline = typeof promise.deadline === "string" ? promise.deadline : null;
        const madeAt = typeof promise.madeAt === "string" ? promise.madeAt : null;
        const madeDate = madeAt ? madeAt.slice(0, 10) : null;
        const staleDays = deadline
          ? daysBetween(deadline, requestedDate)
          : madeDate
            ? daysBetween(madeDate, requestedDate)
            : 0;

        return {
          id: typeof promise.id === "string" ? promise.id : `promise-${Math.random().toString(36).slice(2, 8)}`,
          text: promise.text as string,
          context: typeof promise.context === "string" ? promise.context : null,
          deadline,
          madeAt,
          staleDays,
          overdue: Boolean(deadline && deadline < requestedDate),
        };
      })
      .sort((a, b) => b.staleDays - a.staleDays);
  } catch {
    return [];
  }
}

async function readPromiseRecords(): Promise<PromiseRecord[]> {
  const raw = await readFile(PROMISES_PATH, "utf8");
  const parsed = JSON.parse(raw) as { promises?: PromiseRecord[] };
  return Array.isArray(parsed.promises) ? parsed.promises : [];
}

async function writePromiseRecords(promises: PromiseRecord[]) {
  await writeFile(
    PROMISES_PATH,
    `${JSON.stringify({ promises }, null, 2)}\n`,
    "utf8",
  );
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 60,
  });
  if (limited) return limited;

  try {
    const requestedDate = getRequestedDate(req.nextUrl.searchParams.get("date"));
    const db = getDb();

    const stuckRows = db.prepare(`
      SELECT id, date, text, status, lane, priority, waiting_on, tags, updated_at, created_at
      FROM journal_entries
      WHERE signifier = 'task'
        AND status IN ('open', 'in-progress', 'blocked', 'review')
        AND (
          status = 'blocked'
          OR (waiting_on IS NOT NULL AND trim(waiting_on) <> '')
        )
      ORDER BY
        CASE WHEN status = 'blocked' THEN 0 ELSE 1 END,
        date ASC,
        updated_at ASC
    `).all() as TaskRow[];

    const carryoverRows = db.prepare(`
      SELECT id, date, text, status, lane, priority, waiting_on, tags, updated_at, created_at
      FROM journal_entries
      WHERE signifier = 'task'
        AND date < ?
        AND status IN ('open', 'in-progress', 'blocked')
      ORDER BY date ASC, sort_order ASC
      LIMIT 12
    `).all(requestedDate) as TaskRow[];

    const promises = await loadPromises(requestedDate);
    const stuck = stuckRows.map((row) => normalizeTask(row, requestedDate));
    const carryover = carryoverRows.map((row) => normalizeTask(row, requestedDate));

    const overduePromises = promises.filter((promise) => promise.overdue).length;
    const blockedCount = stuck.filter((task) => task.status === "blocked").length;
    const waitingCount = stuck.filter((task) => Boolean(task.waitingOn)).length;
    const oldestCarryover = carryover.reduce((max, task) => Math.max(max, task.ageDays), 0);

    const nextMove =
      overduePromises > 0
        ? "Start by killing, rewriting, or recommitting the oldest broken promise so it stops leaking shame into the room."
        : blockedCount > 0
          ? "Pick one blocked task and either unblock it, split it down, or admit it belongs in the graveyard."
          : carryover.length > 0
            ? "Trim the oldest carryover first. Old open loops are stealing attention from real work."
            : "Nothing major is rotting here. Miracles happen.";

    const response: FollowThroughRadarData = {
      requestedDate,
      generatedAt: new Date().toISOString(),
      nextMove,
      counts: {
        pendingPromises: promises.length,
        overduePromises,
        blocked: blockedCount,
        waiting: waitingCount,
        unresolvedCarryover: carryover.length,
        oldestCarryoverDays: oldestCarryover,
      },
      sections: {
        promises,
        stuck,
        carryover,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError("build follow-through radar", error);
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 20,
  });
  if (limited) return limited;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      promiseId?: string;
      taskId?: string;
      status?: string;
    };

    if (body.action === "promise-status") {
      if (!body.promiseId || !["resolved", "dropped"].includes(body.status || "")) {
        return NextResponse.json({ error: "Invalid promise status request" }, { status: 400 });
      }

      const promises = await readPromiseRecords();
      const index = promises.findIndex((promise) => promise.id === body.promiseId);
      if (index === -1) {
        return NextResponse.json({ error: "Promise not found" }, { status: 404 });
      }

      promises[index] = {
        ...promises[index],
        status: body.status as PromiseStatus,
        resolvedAt: new Date().toISOString(),
      };
      await writePromiseRecords(promises);

      return NextResponse.json({
        ok: true,
        targetType: "promise",
        id: body.promiseId,
        status: body.status,
      });
    }

    if (body.action === "task-status") {
      if (!body.taskId || !["open", "in-progress", "blocked", "done", "killed"].includes(body.status || "")) {
        return NextResponse.json({ error: "Invalid task status request" }, { status: 400 });
      }

      const db = getDb();
      const result = db.prepare(`
        UPDATE journal_entries
        SET status = ?, updated_at = ?
        WHERE id = ? AND signifier = 'task'
      `).run(body.status, new Date().toISOString(), body.taskId);

      if (!result.changes) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        targetType: "task",
        id: body.taskId,
        status: body.status,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return handleApiError("update follow-through radar", error);
  }
}
