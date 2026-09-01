import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { TaskActor } from "@/lib/task-auth";
import { sanitizeMarkdown } from "@/lib/validation";

export type TaskComment = {
	id: string;
	task_id: string;
	body: string;
	actor_type: "human" | "agent" | "system";
	actor_id: string;
	source_ref: string | null;
	idempotency_key: string | null;
	created_at: string;
};

export class TaskCommentError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

function requireTask(taskId: string): void {
	const task = getDb()
		.prepare("SELECT id FROM journal_entries WHERE id = ? AND signifier = 'task'")
		.get(taskId);
	if (!task) throw new TaskCommentError("Task not found", 404);
}

function sanitizeBody(value: unknown): string {
	if (typeof value !== "string") {
		throw new TaskCommentError("body must be a string", 400);
	}
	if (value.length > 50_000) {
		throw new TaskCommentError("body exceeds maximum length", 400);
	}
	const sanitized = sanitizeMarkdown(value).replace(/<[^>]*>/g, "").trim();
	if (!sanitized) throw new TaskCommentError("body is required", 400);
	return sanitized;
}

function normalizeSourceRef(value: unknown): string | null {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value !== "string" || value.length > 500 || /[\u0000-\u001f\u007f]/.test(value)) {
		throw new TaskCommentError("source_ref must be a valid string up to 500 characters", 400);
	}
	return value.trim() || null;
}

function normalizeIdempotencyKey(value: string | null, actor: TaskActor): string | null {
	if (actor.type === "human") return null;
	const key = value?.trim();
	if (!key) throw new TaskCommentError("Idempotency-Key header is required", 400);
	if (key.length > 200 || /[\u0000-\u001f\u007f]/.test(key)) {
		throw new TaskCommentError("Idempotency-Key header is invalid", 400);
	}
	return key;
}

export function listTaskComments(taskId: string): TaskComment[] {
	requireTask(taskId);
	return getDb()
		.prepare(
			`SELECT id, task_id, body, actor_type, actor_id, source_ref,
			 idempotency_key, created_at
			 FROM task_comments WHERE task_id = ?
			 ORDER BY created_at ASC, rowid ASC`,
		)
		.all(taskId) as TaskComment[];
}

export function appendTaskComment(input: {
	taskId: string;
	body: unknown;
	actor: TaskActor;
	sourceRef?: unknown;
	idempotencyKey: string | null;
}): { comment: TaskComment; created: boolean } {
	requireTask(input.taskId);
	const body = sanitizeBody(input.body);
	const sourceRef = normalizeSourceRef(input.sourceRef);
	const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey, input.actor);
	const id = randomUUID();
	const createdAt = new Date().toISOString();
	const db = getDb();

	const result = db
		.prepare(
			`INSERT INTO task_comments
			 (id, task_id, body, actor_type, actor_id, source_ref, idempotency_key, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(actor_id, idempotency_key) DO NOTHING`,
		)
		.run(
			id,
			input.taskId,
			body,
			input.actor.type,
			input.actor.id,
			sourceRef,
			idempotencyKey,
			createdAt,
		);

	const comment = db
		.prepare(
			`SELECT id, task_id, body, actor_type, actor_id, source_ref,
			 idempotency_key, created_at FROM task_comments
			 WHERE id = ? OR (actor_id = ? AND idempotency_key = ?)`,
		)
		.get(id, input.actor.id, idempotencyKey) as TaskComment;
	const created = result.changes === 1;

	if (
		!created &&
		(comment.task_id !== input.taskId || comment.body !== body || comment.source_ref !== sourceRef)
	) {
		throw new TaskCommentError("Idempotency key was already used for a different comment", 409);
	}
	return { comment, created };
}
