import { type NextRequest, NextResponse } from "next/server";
import {
	handleApiError,
	handleValidationError,
} from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logValidationFailure } from "@/lib/security-logger";
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
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 100,
	});
	if (limited) return limited;
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
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 30,
	});
	if (limited) return limited;

	const db = getDb();
	const body = await req.json();
	const { action, taskId } = body;

	// Validate action parameter
	const validActions = ["complete", "move"];
	if (!action || !validActions.includes(action)) {
		return handleValidationError("Invalid or missing action");
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
