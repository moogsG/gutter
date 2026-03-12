import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const projects = db.prepare(`
    SELECT
      project as name,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed,
      MAX(created_at) as last_activity
    FROM tasks
    GROUP BY project
    ORDER BY open DESC, last_activity DESC
  `).all();

  return NextResponse.json(projects);
}
