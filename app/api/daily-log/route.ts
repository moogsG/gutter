import { constants as fsConstants, existsSync, promises as fs } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { getJournalDate } from "@/lib/journal-date";
import { getOpenClawWorkspacePath } from "@/lib/paths";
import type { OptionalSourceState } from "@/types";

interface LogRow {
	id: string;
	text: string;
	project?: string;
	completed_at?: string;
	timestamp?: string;
	type: string;
}

async function mirrorDailyLog(today: string, text: string): Promise<OptionalSourceState> {
	let workspace: string;
	try {
		workspace = getOpenClawWorkspacePath();
	} catch {
		return {
			state: "not-configured",
			message: "OPENCLAW_WORKSPACE_PATH must be an absolute path to mirror daily notes.",
			recovery: "configure",
		};
	}

	if (!existsSync(workspace)) {
		return {
			state: "not-configured",
			message: "Set OPENCLAW_WORKSPACE_PATH to mirror entries into daily notes.",
			recovery: "configure",
		};
	}

	try {
		const memoryDir = path.join(workspace, "memory");
		await fs.access(memoryDir, fsConstants.W_OK);
		const dailyFile = path.join(memoryDir, `${today}.md`);
		const time = new Date().toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
		await fs.appendFile(dailyFile, `\n- **${time}** — ${text}`);
		return {
			state: "ready",
			message: "Entry mirrored into the daily note.",
			recovery: null,
		};
	} catch (error) {
		console.error("Failed to append to daily notes:", error);
		return {
			state: "unavailable",
			message: "Daily-note mirroring is unavailable. Check the workspace and retry.",
			recovery: "retry",
		};
	}
}

export async function GET(req: NextRequest) {
	// Rate limit: 50 requests per minute (read operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	const db = getDb();
	const today = getJournalDate();

	// Completed tasks (journal entries with status 'done')
	const completed = db
		.prepare(
			`SELECT id, text, collection_id as project, updated_at as completed_at, 'completed' as type 
       FROM journal_entries 
       WHERE status = 'done' AND date(updated_at) = ?
       ORDER BY updated_at DESC`,
		)
		.all(today) as LogRow[];

	// Notes (journal entries with signifier 'note')
	const notes = db
		.prepare(
			`SELECT id, text, created_at as completed_at, 'note' as type 
       FROM journal_entries
       WHERE signifier = 'note' AND date = ?
       ORDER BY created_at DESC`,
		)
		.all(today) as LogRow[];

	const entries = [...completed, ...notes].sort((a, b) =>
		String(b.completed_at || "").localeCompare(String(a.completed_at || "")),
	);

	return Response.json(entries);
}

export async function POST(req: NextRequest) {
	// Rate limit: 30 requests per minute (write operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 30,
	});
	if (limited) return limited;

	const { text, type = "note" } = await req.json();

	if (!text || !text.trim()) {
		return Response.json({ error: "Empty entry" }, { status: 400 });
	}

	const db = getDb();
	const timestamp = new Date().toISOString();
	const today = getJournalDate();
	const id = `je-${Date.now()}`;

	// Get next sort order for today
	const lastEntry = db
		.prepare("SELECT MAX(sort_order) as max_order FROM journal_entries WHERE date = ?")
		.get(today) as { max_order: number | null };
	const sortOrder = (lastEntry?.max_order || 0) + 1;

	// Save to journal_entries table as a note
	db.prepare(
		`INSERT INTO journal_entries 
     (id, date, signifier, text, status, sort_order, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(id, today, "note", text.trim(), "open", sortOrder, timestamp, timestamp);

	// Also append to the optional daily notes file when its workspace exists.
	const mirror = await mirrorDailyLog(today, text.trim());

	return Response.json({ id, saved: true, mirror });
}
