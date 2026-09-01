import {
	generateAgentToken,
	storeAgentCredential,
	TASK_SCOPES,
} from "@/lib/agent-credentials";
import { closeDb } from "@/lib/db";

function argument(name: string): string | null {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const actorId = argument("--actor-id")?.trim();
if (!actorId || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(actorId)) {
	console.error(
		"Usage: bun run agent-token:create -- --actor-id <stable-agent-id>\n" +
			"Actor ids may contain letters, numbers, dot, underscore, colon, and hyphen.",
	);
	process.exitCode = 1;
} else {
	const token = generateAgentToken();
	try {
		storeAgentCredential(token, actorId, TASK_SCOPES);
		// This is the only time the plaintext credential is available or printed.
		process.stdout.write(`${token}\n`);
	} finally {
		closeDb();
	}
}
