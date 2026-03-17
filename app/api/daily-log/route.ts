import { promises as fs } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

interface LogRow {
	id: string;
	text: string;
	project?: string;
	completed_at?: string;
	timestamp?: string;
	type: string;
}

export async function GET() {
	const db = getDb();
	const today = new Date().toISOString().split("T")[0];

	const completed = db
		.prepare(
			`SELECT id, text, project, completed_at, 'completed' as type FROM tasks 
     WHERE status IN ('done', 'completed') AND date(completed_at) = ?
     ORDER BY completed_at DESC`,
		)
		.all(today) as LogRow[];

	const captured = db
		.prepare(
			`SELECT id, text, project, created_at as completed_at, 'captured' as type FROM tasks
     WHERE date(created_at) = ? AND tags LIKE '%captured%'
     ORDER BY created_at DESC`,
		)
		.all(today) as LogRow[];

	const notes = db
		.prepare(
			`SELECT id, text, timestamp as completed_at, 'note' as type FROM notes
     WHERE date(timestamp) = ?
     ORDER BY timestamp DESC`,
		)
		.all(today) as LogRow[];

	const entries = [...completed, ...captured, ...notes].sort((a, b) =>
		String(b.completed_at || "").localeCompare(String(a.completed_at || "")),
	);

	return Response.json(entries);
}

export async function POST(req: NextRequest) {
	const { text, type = "note" } = await req.json();

	if (!text || !text.trim()) {
		return Response.json({ error: "Empty entry" }, { status: 400 });
	}

	const db = getDb();
	const timestamp = new Date().toISOString();
	const id = `log-${Date.now()}`;

	// Save to notes table
	db.prepare(
		"INSERT INTO notes (id, text, timestamp, created_at) VALUES (?, ?, ?, ?)",
	).run(id, text.trim(), timestamp, timestamp);

	// Also append to daily notes file
	try {
		const today = new Date().toISOString().split("T")[0];
		const memoryDir = path.join(
			process.cwd(),
			"..",
			".openclaw",
			"workspace",
			"memory",
		);
		const dailyFile = path.join(memoryDir, `${today}.md`);

		// Ensure memory directory exists
		await fs.mkdir(memoryDir, { recursive: true });

		const time = new Date().toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
		const logEntry = `\n- **${time}** — ${text.trim()}`;

		// Append to daily notes
		await fs.appendFile(dailyFile, logEntry);
	} catch (error) {
		console.error("Failed to append to daily notes:", error);
	}

	return Response.json({ id, saved: true });
}
