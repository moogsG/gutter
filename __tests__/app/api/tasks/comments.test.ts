import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { GET as getTask } from "@/app/api/tasks/[id]/route";
import {
	GET as getComments,
	POST as postComment,
} from "@/app/api/tasks/[id]/comments/route";
import { GET as getTasks, POST as postTask } from "@/app/api/tasks/route";
import {
	hashAgentToken,
	storeAgentCredential,
} from "@/lib/agent-credentials";
import { getDb } from "@/lib/db";
import { clearRateLimitState } from "@/lib/rate-limit";
import { createSessionToken } from "@/lib/session";

const originalPasswordHash = process.env.AUTH_PASSWORD_HASH;
const originalSecret = process.env.AUTH_SECRET;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function taskRow(id: string, signifier = "task") {
	const now = new Date().toISOString();
	getDb()
		.prepare(
			`INSERT INTO journal_entries
			 (id, date, signifier, text, status, sort_order, created_at, updated_at)
			 VALUES (?, '2026-09-01', ?, 'Test task', 'open', 0, ?, ?)`,
		)
		.run(id, signifier, now, now);
}

function request(
	url: string,
	options: { method?: string; token?: string; cookie?: string; key?: string; body?: unknown } = {},
) {
	const headers = new Headers();
	if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
	if (options.key) headers.set("Idempotency-Key", options.key);
	if (options.body !== undefined) headers.set("Content-Type", "application/json");
	const req = new NextRequest(url, {
		method: options.method,
		headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	});
	if (options.cookie) req.cookies.set("gutter-session", options.cookie);
	return req;
}

beforeEach(() => {
	process.env.AUTH_PASSWORD_HASH = "enabled-for-test";
	process.env.AUTH_SECRET = "task-comments-test-secret-that-is-long-enough";
	clearRateLimitState();
	const db = getDb();
	db.exec("DELETE FROM task_comments; DELETE FROM agent_credentials; DELETE FROM journal_entries;");
});

afterAll(() => {
	if (originalPasswordHash === undefined) delete process.env.AUTH_PASSWORD_HASH;
	else process.env.AUTH_PASSWORD_HASH = originalPasswordHash;
	if (originalSecret === undefined) delete process.env.AUTH_SECRET;
	else process.env.AUTH_SECRET = originalSecret;
});

describe("task comment authentication and persistence", () => {
	test("rejects missing, malformed, invalid, and under-scoped credentials", async () => {
		taskRow("task-auth");
		const missing = await getComments(
			request("http://localhost/api/tasks/task-auth/comments"),
			params("task-auth"),
		);
		expect(missing.status).toBe(401);

		const malformed = await getComments(
			request("http://localhost/api/tasks/task-auth/comments", { token: "missing" }),
			params("task-auth"),
		);
		expect(malformed.status).toBe(401);

		storeAgentCredential("read-tasks-only", "limited-agent", ["tasks:read"]);
		const taskRead = await getTasks(
			request("http://localhost/api/tasks", { token: "read-tasks-only" }),
		);
		expect(taskRead.status).toBe(200);
		const underScoped = await getComments(
			request("http://localhost/api/tasks/task-auth/comments", { token: "read-tasks-only" }),
			params("task-auth"),
		);
		expect(underScoped.status).toBe(401);
	});

	test("derives agent identity from the credential and ignores spoofed provenance", async () => {
		taskRow("task-provenance");
		storeAgentCredential("agent-secret", "jynx");
		const response = await postComment(
			request("http://localhost/api/tasks/task-provenance/comments", {
				method: "POST",
				token: "agent-secret",
				key: "run-1-comment-1",
				body: {
					body: "Agent update",
					actor_id: "morgan",
					actor_type: "human",
					source_ref: "run:1",
				},
			}),
			params("task-provenance"),
		);
		const comment = await response.json();
		expect(response.status).toBe(201);
		expect(comment).toMatchObject({
			actor_type: "agent",
			actor_id: "jynx",
			source_ref: "run:1",
		});
	});

	test("requires an idempotency key for agent writes", async () => {
		taskRow("task-key");
		storeAgentCredential("agent-secret", "jynx");
		const response = await postComment(
			request("http://localhost/api/tasks/task-key/comments", {
				method: "POST",
				token: "agent-secret",
				body: { body: "No key" },
			}),
			params("task-key"),
		);
		expect(response.status).toBe(400);
		expect((await response.json()).error).toContain("Idempotency-Key");
	});

	test("sanitizes comment markdown and validates that the target is a task", async () => {
		taskRow("note-target", "note");
		const cookie = await createSessionToken(60);
		const missingTask = await postComment(
			request("http://localhost/api/tasks/note-target/comments", {
				method: "POST",
				cookie,
				body: { body: "Not allowed" },
			}),
			params("note-target"),
		);
		expect(missingTask.status).toBe(404);

		taskRow("task-sanitize");
		const response = await postComment(
			request("http://localhost/api/tasks/task-sanitize/comments", {
				method: "POST",
				cookie,
				body: { body: "**safe** <img src=x onerror=alert(1)> javascript:bad" },
			}),
			params("task-sanitize"),
		);
		const comment = await response.json();
		expect(response.status).toBe(201);
		expect(comment.body).toBe("**safe**  bad");
		expect(comment.actor_id).toBe("morgan");
	});

	test("deduplicates exact retries and rejects changed payloads for a used key", async () => {
		taskRow("task-retry");
		storeAgentCredential("agent-secret", "jynx");
		const makeRequest = (body: string) =>
			request("http://localhost/api/tasks/task-retry/comments", {
				method: "POST",
				token: "agent-secret",
				key: "stable-key",
				body: { body, source_ref: "run:retry" },
			});
		const first = await postComment(makeRequest("Exactly once"), params("task-retry"));
		const retry = await postComment(makeRequest("Exactly once"), params("task-retry"));
		expect(first.status).toBe(201);
		expect(retry.status).toBe(200);
		expect((await retry.json()).id).toBe((await first.json()).id);
		expect(
			getDb().prepare("SELECT COUNT(*) AS count FROM task_comments").get(),
		).toEqual({ count: 1 });

		const conflict = await postComment(makeRequest("Changed"), params("task-retry"));
		expect(conflict.status).toBe(409);
	});

	test("concurrent same-key writes atomically produce one comment", async () => {
		taskRow("task-concurrent");
		storeAgentCredential("agent-secret", "jynx");
		const write = () =>
			postComment(
				request("http://localhost/api/tasks/task-concurrent/comments", {
					method: "POST",
					token: "agent-secret",
					key: "concurrent-key",
					body: { body: "One result" },
				}),
				params("task-concurrent"),
			);
		const responses = await Promise.all([write(), write(), write(), write()]);
		expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 201]);
		const ids = await Promise.all(responses.map(async (response) => (await response.json()).id));
		expect(new Set(ids).size).toBe(1);
		expect(
			getDb().prepare("SELECT COUNT(*) AS count FROM task_comments").get(),
		).toEqual({ count: 1 });
	});

	test("orders comments chronologically and cascades them when the task is deleted", async () => {
		taskRow("task-order");
		const cookie = await createSessionToken(60);
		for (const body of ["First", "Second", "Third"]) {
			await postComment(
				request("http://localhost/api/tasks/task-order/comments", {
					method: "POST",
					cookie,
					body: { body },
				}),
				params("task-order"),
			);
		}
		const comments = await getComments(
			request("http://localhost/api/tasks/task-order/comments", { cookie }),
			params("task-order"),
		);
		expect((await comments.json()).map((comment: { body: string }) => comment.body)).toEqual([
			"First",
			"Second",
			"Third",
		]);

		getDb().prepare("DELETE FROM journal_entries WHERE id = ?").run("task-order");
		expect(
			getDb().prepare("SELECT COUNT(*) AS count FROM task_comments").get(),
		).toEqual({ count: 0 });
	});

	test("enforces the task comment foreign key", () => {
		expect(() =>
			getDb()
				.prepare(
					`INSERT INTO task_comments
					 (id, task_id, body, actor_type, actor_id, created_at)
					 VALUES ('comment-fk', 'missing', 'body', 'human', 'morgan', datetime('now'))`,
				)
				.run(),
		).toThrow();
	});
});

describe("task comment API composition", () => {
	test("creates a task, appends human and agent comments, retries, and reads two comments", async () => {
		const cookie = await createSessionToken(60);
		const createResponse = await postTask(
			request("http://localhost/api/tasks", {
				method: "POST",
				cookie,
				body: { action: "add", date: "2026-09-01", task: { title: "Composition task" } },
			}),
		);
		expect(createResponse.status).toBe(200);
		const task = (await createResponse.json()).task;

		const human = await postComment(
			request(`http://localhost/api/tasks/${task.id}/comments`, {
				method: "POST",
				cookie,
				body: { body: "Morgan comment" },
			}),
			params(task.id),
		);
		expect(human.status).toBe(201);

		storeAgentCredential("composition-agent-token", "jynx");
		const agentWrite = () =>
			postComment(
				request(`http://localhost/api/tasks/${task.id}/comments`, {
					method: "POST",
					token: "composition-agent-token",
					key: "composition-run-1",
					body: { body: "Jynx comment", source_ref: "run:composition" },
				}),
				params(task.id),
			);
		expect((await agentWrite()).status).toBe(201);
		expect((await agentWrite()).status).toBe(200);

		const listResponse = await getComments(
			request(`http://localhost/api/tasks/${task.id}/comments`, { cookie }),
			params(task.id),
		);
		const comments = await listResponse.json();
		expect(comments).toHaveLength(2);
		expect(comments.map((comment: { actor_type: string; actor_id: string }) => [
			comment.actor_type,
			comment.actor_id,
		])).toEqual([
			["human", "morgan"],
			["agent", "jynx"],
		]);

		const detailResponse = await getTask(
			request(`http://localhost/api/tasks/${task.id}`, { cookie }),
			params(task.id),
		);
		const detail = await detailResponse.json();
		expect(detail.comment_count).toBe(2);
		expect(detail.last_comment_at).toBe(comments[1].created_at);

		const boardResponse = await getTasks(
			request("http://localhost/api/tasks?status=open", { cookie }),
		);
		const boardTask = (await boardResponse.json()).find(
			(candidate: { id: string }) => candidate.id === task.id,
		);
		expect(boardTask).toMatchObject({ comment_count: 2, last_comment_at: comments[1].created_at });
	});

	test("stores only token hashes", () => {
		storeAgentCredential("plaintext-must-not-be-stored", "jynx");
		const credential = getDb()
			.prepare("SELECT token_hash, actor_id FROM agent_credentials")
			.get() as { token_hash: string; actor_id: string };
		expect(credential).toEqual({
			token_hash: hashAgentToken("plaintext-must-not-be-stored"),
			actor_id: "jynx",
		});
		expect(JSON.stringify(credential)).not.toContain("plaintext-must-not-be-stored");
	});
});
