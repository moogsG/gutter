import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { authenticateTaskRequest } from "@/lib/task-auth";
import { validateId } from "@/lib/validation";

type TaskDetailRow = {
	id: string;
	date: string;
	text: string;
	status: string;
	lane: string | null;
	priority: string | null;
	waiting_on: string | null;
	tags: string | null;
	collection_id: string | null;
	sort_order: number;
	created_at: string;
	updated_at: string;
	comment_count: number;
	last_comment_at: string | null;
};

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const limited = rateLimitMiddleware(req, { windowMs: 60_000, maxRequests: 100 });
	if (limited) return limited;
	const auth = await authenticateTaskRequest(req, "tasks:read");
	if (!auth.ok) return auth.response;

	const { id } = await params;
	if (!validateId(id).valid) {
		return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
	}
	const task = getDb()
		.prepare(
			`SELECT je.id, je.date, je.text, je.status, je.lane, je.priority,
			 je.waiting_on, je.tags, je.collection_id, je.sort_order, je.created_at,
			 je.updated_at, COUNT(tc.id) AS comment_count, MAX(tc.created_at) AS last_comment_at
			 FROM journal_entries je LEFT JOIN task_comments tc ON tc.task_id = je.id
			 WHERE je.id = ? AND je.signifier = 'task' GROUP BY je.id`,
		)
		.get(id) as TaskDetailRow | undefined;
	if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
	return NextResponse.json({ ...task, title: task.text });
}
