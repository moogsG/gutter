import { NextResponse, type NextRequest } from "next/server";
import {
	type TaskScope,
	verifyAgentCredential,
} from "@/lib/agent-credentials";
import { verifySessionToken } from "@/lib/session";

export type TaskActor = {
	type: "human" | "agent";
	id: string;
};

type TaskAuthResult =
	| { ok: true; actor: TaskActor }
	| { ok: false; response: NextResponse };

function unauthorized(message = "Unauthorized"): TaskAuthResult {
	return {
		ok: false,
		response: NextResponse.json({ error: message }, { status: 401 }),
	};
}

export async function authenticateTaskRequest(
	req: NextRequest,
	requiredScope: TaskScope,
): Promise<TaskAuthResult> {
	const authorization = req.headers.get("authorization");
	if (authorization !== null) {
		const match = /^Bearer ([^\s]+)$/i.exec(authorization);
		if (!match) return unauthorized("Invalid bearer credential");
		const credential = verifyAgentCredential(match[1], requiredScope);
		if (!credential) return unauthorized("Invalid credential or insufficient scope");
		return { ok: true, actor: { type: "agent", id: credential.actorId } };
	}

	// Authentication-disabled development retains the existing local-only flow.
	if (!process.env.AUTH_PASSWORD_HASH) {
		return { ok: true, actor: { type: "human", id: "morgan" } };
	}

	const session = req.cookies.get("gutter-session")?.value;
	if (!(await verifySessionToken(session))) return unauthorized();
	return { ok: true, actor: { type: "human", id: "morgan" } };
}
