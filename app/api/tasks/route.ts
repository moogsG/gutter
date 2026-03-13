import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Kanban status values map to DB status values
const KANBAN_STATUS_MAP: Record<string, string[]> = {
  todo: ["open"],
  "in-progress": ["in-progress", "in_progress"],
  blocked: ["blocked"],
  done: ["complete", "done"],
};

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const project = searchParams.get("project");
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  // Support kanban status filters (comma-separated or single value)
  let statusValues: string[];
  if (statusParam && KANBAN_STATUS_MAP[statusParam]) {
    statusValues = KANBAN_STATUS_MAP[statusParam];
  } else if (statusParam && statusParam.includes(",")) {
    statusValues = statusParam.split(",").map((s) => s.trim());
  } else {
    statusValues = [statusParam || "open"];
  }

  const placeholders = statusValues.map(() => "?").join(", ");
  let query = `SELECT * FROM tasks WHERE status IN (${placeholders})`;
  const params: (string | number)[] = [...statusValues];

  if (project) {
    query += ` AND project = ?`;
    params.push(project);
  }

  query += ` ORDER BY
    CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
    created_at DESC
    LIMIT ?`;
  params.push(limit);

  const tasks = db.prepare(query).all(...params);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { action, taskId, task } = body;

  if (action === "complete" && taskId) {
    db.prepare(`UPDATE tasks SET status = 'complete', completed_at = datetime('now') WHERE id = ?`).run(taskId);
    return NextResponse.json({ ok: true });
  }

  if (action === "move" && taskId && body.status) {
    const allowedStatuses = ["open", "in-progress", "blocked", "complete"];
    if (!allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const completedAt = body.status === "complete" ? "datetime('now')" : "NULL";
    db.prepare(
      `UPDATE tasks SET status = ?, completed_at = ${completedAt} WHERE id = ?`
    ).run(body.status, taskId);
    return NextResponse.json({ ok: true });
  }

  if (action === "add" && task) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO tasks (id, text, project, priority, status, owner, due_date, tags, context_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      task.text,
      task.project || "General",
      task.priority || "medium",
      task.status || "open",
      task.owner || "jynx",
      task.due_date || null,
      JSON.stringify(task.tags || []),
      task.context_notes || null
    );
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
