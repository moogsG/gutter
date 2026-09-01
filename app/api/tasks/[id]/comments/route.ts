import { type NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { authenticateTaskRequest } from "@/lib/task-auth";
import {
	appendTaskComment,
	listTaskComments,
	TaskCommentError,
} from "@/lib/task-comments";
import { validateId } from "@/lib/validation";

function commentError(error: unknown): NextResponse {
	if (error instanceof TaskCommentError) {
		return NextResponse.json({ error: error.message }, { status: error.status });
	}
	console.error("Error handling task comment:", error);
	return NextResponse.json({ error: "Unable to handle task comment" }, { status: 500 });
}

async function taskIdFrom(params: Promise<{ id: string }>): Promise<string | NextResponse> {
	const { id } = await params;
	if (!validateId(id).valid) {
		return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
	}
	return id;
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const limited = rateLimitMiddleware(req, { windowMs: 60_000, maxRequests: 100 });
	if (limited) return limited;
	const auth = await authenticateTaskRequest(req, "comments:read");
	if (!auth.ok) return auth.response;
	const taskId = await taskIdFrom(params);
	if (taskId instanceof NextResponse) return taskId;

	try {
		return NextResponse.json(listTaskComments(taskId));
	} catch (error) {
		return commentError(error);
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const limited = rateLimitMiddleware(req, { windowMs: 60_000, maxRequests: 30 });
	if (limited) return limited;
	const auth = await authenticateTaskRequest(req, "comments:write");
	if (!auth.ok) return auth.response;
	const taskId = await taskIdFrom(params);
	if (taskId instanceof NextResponse) return taskId;

	try {
		const body = (await req.json()) as { body?: unknown; source_ref?: unknown };
		const result = appendTaskComment({
			taskId,
			body: body.body,
			actor: auth.actor,
			sourceRef: body.source_ref,
			idempotencyKey: req.headers.get("idempotency-key"),
		});
		return NextResponse.json(result.comment, { status: result.created ? 201 : 200 });
	} catch (error) {
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
		}
		return commentError(error);
	}
}
