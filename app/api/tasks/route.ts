import { type NextRequest, NextResponse } from "next/server";
import {
	handleApiError,
	handleValidationError,
} from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import { getJournalDate } from "@/lib/journal-date";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logValidationFailure } from "@/lib/security-logger";
import { authenticateTaskRequest } from "@/lib/task-auth";
import { validateId, validateTask } from "@/lib/validation";

// Kanban status values map to journal_entries status values
const KANBAN_STATUS_MAP: Record<string, string[]> = {
	todo: ["open"],
	"in-progress": ["in-progress"],
	blocked: ["blocked"],
	done: ["done"],
};

type TaskRow = {
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

function normalizeTaskRow(task: TaskRow) {
	return {
		...task,
		title: task.text,
	};
}

function getLocalTaskDate() {
	return getJournalDate();
}

export async function GET(req: NextRequest) {
	// Rate limit: 100 requests per minute
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 100,
	});
	if (limited) return limited;
	const auth = await authenticateTaskRequest(req, "tasks:read");
	if (!auth.ok) return auth.response;
	const db = getDb();
	const { searchParams } = new URL(req.url);
	const statusParam = searchParams.get("status");
	const dateParam = searchParams.get("date");
	const limit = parseInt(searchParams.get("limit") || "100", 10);

	// Map kanban status to journal entry statuses
	let statusValues: string[];
	if (statusParam && KANBAN_STATUS_MAP[statusParam]) {
		statusValues = KANBAN_STATUS_MAP[statusParam];
	} else if (statusParam?.includes(",")) {
		statusValues = statusParam.split(",").map((s) => s.trim());
	} else {
		statusValues = [statusParam || "open"];
	}

	const placeholders = statusValues.map(() => "?").join(", ");
	let query = `
	    SELECT je.id, je.date, je.text, je.status, je.lane, je.priority,
	      je.waiting_on, je.tags, je.collection_id, je.sort_order, je.created_at,
	      je.updated_at, COUNT(tc.id) AS comment_count, MAX(tc.created_at) AS last_comment_at
	    FROM journal_entries je
	    LEFT JOIN task_comments tc ON tc.task_id = je.id
	    WHERE je.signifier = 'task' AND je.status IN (${placeholders})`;
	const params: (string | number)[] = [...statusValues];

	if (dateParam) {
		query += ` AND je.date = ?`;
		params.push(dateParam);
	}

	query += `
	    GROUP BY je.id
	    ORDER BY je.date DESC, je.sort_order ASC
	    LIMIT ?`;
	params.push(limit);

	const tasks = db.prepare(query).all(...params) as TaskRow[];
	return NextResponse.json(tasks.map(normalizeTaskRow));
}

export async function POST(req: NextRequest) {
	// Rate limit: 30 requests per minute for POST
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 30,
	});
	if (limited) return limited;
	const auth = await authenticateTaskRequest(req, "tasks:read");
	if (!auth.ok) return auth.response;
	if (auth.actor.type === "agent") {
		return NextResponse.json({ error: "Agent task mutation is not permitted" }, { status: 403 });
	}

	const db = getDb();
	const body = await req.json();
	const { action, taskId } = body;

	// Validate action parameter
	const validActions = ["add", "complete", "move"];
	if (!action || !validActions.includes(action)) {
		return handleValidationError("Invalid or missing action");
	}

	if (action === "add") {
		const incomingPriority =
			typeof body.task?.priority === "number"
				? body.task.priority >= 3
					? "high"
					: body.task.priority <= 1
						? "low"
						: "medium"
				: body.task?.priority === "normal"
					? "medium"
					: body.task?.priority;
		const date =
			typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
				? body.date
				: getLocalTaskDate();
		const validation = validateTask({
			title: body.task?.title ?? body.task?.text,
			priority: incomingPriority,
			status: body.task?.status,
		});
		if (!validation.valid) {
			await logValidationFailure(req, "/api/tasks", {
				field: "task",
				error: validation.errors.join(", "),
			});
			return handleValidationError(
				"Invalid task payload",
				validation.errors.join(", "),
			);
		}

		const title = validation.sanitized?.title;
		if (!title) {
			return handleValidationError("task.title or task.text is required");
		}

		const priority =
			validation.sanitized?.priority === "medium"
				? "normal"
				: validation.sanitized?.priority === "urgent"
					? "high"
					: validation.sanitized?.priority ?? "normal";
		const status = validation.sanitized?.status ?? "open";
		const lane =
			typeof body.task?.lane === "string" &&
			["work", "personal", "family", "jw", "petalz"].includes(body.task.lane)
				? body.task.lane
				: null;
		const waitingOn =
			typeof body.task?.waiting_on === "string"
				? body.task.waiting_on.trim() || null
				: typeof body.task?.waitingOn === "string"
					? body.task.waitingOn.trim() || null
					: null;
		const tags = Array.isArray(body.task?.tags)
			? body.task.tags.filter((tag: unknown): tag is string => typeof tag === "string")
			: [];
		const maxOrder = db
			.prepare(
				"SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ? AND signifier = 'task'",
			)
			.get(date) as { max: number | null };
		const sortOrder = (maxOrder?.max ?? -1) + 1;
		const id = `je-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		const now = new Date().toISOString();

		db.prepare(
			`INSERT INTO journal_entries
			 (id, date, signifier, text, status, lane, priority, waiting_on, tags, sort_order, created_at, updated_at)
			 VALUES (?, ?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			id,
			date,
			title,
			status,
			lane,
			priority,
			waitingOn,
			JSON.stringify(tags),
			sortOrder,
			now,
			now,
		);

		const created = db
			.prepare(
				`SELECT je.id, je.date, je.text, je.status, je.lane, je.priority,
				 je.waiting_on, je.tags, je.collection_id, je.sort_order, je.created_at,
				 je.updated_at, COUNT(tc.id) AS comment_count, MAX(tc.created_at) AS last_comment_at
				 FROM journal_entries je LEFT JOIN task_comments tc ON tc.task_id = je.id
				 WHERE je.id = ? GROUP BY je.id`,
			)
			.get(id) as TaskRow;

		return NextResponse.json({ ok: true, task: normalizeTaskRow(created) });
	}

	// Validate taskId
	if (!taskId) {
		return handleValidationError("taskId is required");
	}

	const idValidation = validateId(taskId);
	if (!idValidation.valid) {
		await logValidationFailure(req, "/api/tasks", {
			field: "taskId",
			error: idValidation.error,
		});
		return handleValidationError(idValidation.error || "Invalid taskId");
	}

	if (action === "complete") {
		db.prepare(
			`UPDATE journal_entries SET status = 'done', updated_at = datetime('now') WHERE id = ? AND signifier = 'task'`,
		).run(taskId);
		return NextResponse.json({ ok: true });
	}

	if (action === "move") {
		const { status } = body;
		if (!status) {
			return handleValidationError("status is required for move action");
		}

		const allowedStatuses = ["open", "in-progress", "blocked", "done"];
		if (!allowedStatuses.includes(status)) {
			return handleValidationError("Invalid status");
		}

		db.prepare(
			`UPDATE journal_entries SET status = ?, updated_at = datetime('now') WHERE id = ? AND signifier = 'task'`,
		).run(status, taskId);
		return NextResponse.json({ ok: true });
	}

	return handleValidationError("Invalid action");
}
