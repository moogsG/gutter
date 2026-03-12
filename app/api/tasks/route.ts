import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "open";
  const project = searchParams.get("project");
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  let query = `SELECT * FROM tasks WHERE status = ?`;
  const params: (string | number)[] = [status];

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
