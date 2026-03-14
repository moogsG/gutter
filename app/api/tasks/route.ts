import { NextRequest, NextResponse } from "next/server";
import { getJournalDb } from "@/lib/journal-db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { validateId } from "@/lib/validation";

// Kanban status values map to journal_entries status values
const KANBAN_STATUS_MAP: Record<string, string[]> = {
  todo: ["open"],
  "in-progress": ["in-progress"],
  blocked: ["blocked"],
  done: ["done"],
};

export async function GET(req: NextRequest) {
  // Rate limit: 100 requests per minute
  const limited = rateLimitMiddleware(req, { windowMs: 60000, maxRequests: 100 });
  if (limited) return limited;
  const db = getJournalDb();
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const dateParam = searchParams.get("date");
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  // Map kanban status to journal entry statuses
  let statusValues: string[];
  if (statusParam && KANBAN_STATUS_MAP[statusParam]) {
    statusValues = KANBAN_STATUS_MAP[statusParam];
  } else if (statusParam && statusParam.includes(",")) {
    statusValues = statusParam.split(",").map((s) => s.trim());
  } else {
    statusValues = [statusParam || "open"];
  }

  const placeholders = statusValues.map(() => "?").join(", ");
  let query = `
    SELECT id, date, text, status, tags, collection_id, sort_order, created_at, updated_at
    FROM journal_entries
    WHERE signifier = 'task' AND status IN (${placeholders})`;
  const params: (string | number)[] = [...statusValues];

  if (dateParam) {
    query += ` AND date = ?`;
    params.push(dateParam);
  }

  query += `
    ORDER BY date DESC, sort_order ASC
    LIMIT ?`;
  params.push(limit);

  const tasks = db.prepare(query).all(...params);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  // Rate limit: 30 requests per minute for POST
  const limited = rateLimitMiddleware(req, { windowMs: 60000, maxRequests: 30 });
  if (limited) return limited;

  const db = getJournalDb();
  const body = await req.json();
  const { action, taskId } = body;

  // Validate action parameter
  const validActions = ["complete", "move"];
  if (!action || !validActions.includes(action)) {
    return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  }

  // Validate taskId
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const idValidation = validateId(taskId);
  if (!idValidation.valid) {
    return NextResponse.json({ error: idValidation.error }, { status: 400 });
  }

  if (action === "complete") {
    db.prepare(
      `UPDATE journal_entries SET status = 'done', updated_at = datetime('now') WHERE id = ? AND signifier = 'task'`
    ).run(taskId);
    return NextResponse.json({ ok: true });
  }

  if (action === "move") {
    const { status } = body;
    if (!status) {
      return NextResponse.json({ error: "status is required for move action" }, { status: 400 });
    }

    const allowedStatuses = ["open", "in-progress", "blocked", "done"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    db.prepare(
      `UPDATE journal_entries SET status = ?, updated_at = datetime('now') WHERE id = ? AND signifier = 'task'`
    ).run(status, taskId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
