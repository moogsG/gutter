import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
	// Rate limit: 50 requests per minute (read operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	const db = getDb();

	// Collections are the canonical project relationship for journal_entries.
	const projects = db
		.prepare(`
      SELECT
        p.id,
        p.title AS name,
        NULL AS description,
        NULL AS color,
        p.icon,
        1 AS active,
        COUNT(je.id) as total,
        SUM(CASE WHEN je.status IN ('open', 'in-progress') THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN je.status = 'done' THEN 1 ELSE 0 END) as completed,
        MAX(je.updated_at) as last_activity
      FROM collections p
      LEFT JOIN journal_entries je ON je.collection_id = p.id
      GROUP BY p.id
      ORDER BY open DESC, last_activity DESC
    `)
		.all();

	return NextResponse.json(projects);
}
