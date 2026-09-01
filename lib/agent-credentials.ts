import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

export const TASK_SCOPES = ["tasks:read", "comments:read", "comments:write"] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

export type AgentCredential = {
	actorId: string;
	scopes: TaskScope[];
};

export function hashAgentToken(token: string): string {
	return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateAgentToken(): string {
	return `gutter_agent_${randomBytes(32).toString("base64url")}`;
}

export function storeAgentCredential(
	token: string,
	actorId: string,
	scopes: readonly TaskScope[] = TASK_SCOPES,
): void {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(actorId)) {
		throw new Error("Invalid agent actor id");
	}
	if (scopes.length === 0 || !scopes.every((scope) => TASK_SCOPES.includes(scope))) {
		throw new Error("Invalid agent credential scopes");
	}
	getDb()
		.prepare(
			`INSERT INTO agent_credentials (token_hash, actor_id, scopes)
			 VALUES (?, ?, ?)`,
		)
		.run(hashAgentToken(token), actorId, JSON.stringify(scopes));
}

export function verifyAgentCredential(
	token: string,
	requiredScope: TaskScope,
): AgentCredential | null {
	const row = getDb()
		.prepare(
			`SELECT actor_id, scopes FROM agent_credentials
			 WHERE token_hash = ? AND revoked_at IS NULL`,
		)
		.get(hashAgentToken(token)) as { actor_id: string; scopes: string } | undefined;
	if (!row) return null;

	let scopes: unknown;
	try {
		scopes = JSON.parse(row.scopes);
	} catch {
		return null;
	}
	if (!Array.isArray(scopes) || !scopes.every((scope) => TASK_SCOPES.includes(scope))) {
		return null;
	}
	if (!scopes.includes(requiredScope)) return null;
	return { actorId: row.actor_id, scopes: scopes as TaskScope[] };
}
