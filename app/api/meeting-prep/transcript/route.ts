import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { upsertMeetingTranscript } from "@/lib/vector-store";

// POST: Upload transcript for a meeting — stores in DB and sends to Jynx for summarization
export async function POST(request: NextRequest) {
	// Rate limit transcript uploads (10 per minute)
	const limited = rateLimitMiddleware(request, {
		windowMs: 60000,
		maxRequests: 10,
	});
	if (limited) return limited;

	try {
		const { eventId, title, time, calendar, transcript } = await request.json();

		if (!eventId || !transcript) {
			return Response.json(
				{ error: "Missing eventId or transcript" },
				{ status: 400 },
			);
		}

		const db = getDb();
		const now = new Date().toISOString();
		const occurrenceDate = time
			? new Date(time).toISOString().split("T")[0]
			: new Date().toISOString().split("T")[0];

		// Upsert meeting prep row with transcript (keyed on event_id + occurrence_date)
		const existing = db
			.prepare(
				"SELECT id FROM meeting_prep WHERE event_id = ? AND occurrence_date = ?",
			)
			.get(eventId, occurrenceDate) as any;

		let id: string;
		if (existing) {
			id = existing.id;
			db.prepare(
				"UPDATE meeting_prep SET transcript = ?, updated_at = ? WHERE id = ?",
			).run(transcript, now, id);
		} else {
			id = randomUUID();
			db.prepare(
				`INSERT INTO meeting_prep (id, event_id, title, time, calendar, occurrence_date, prep_status, transcript, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				id,
				eventId,
				title || "",
				time || "",
				calendar || "",
				occurrenceDate,
				"none",
				transcript,
				now,
				now,
			);
		}

		// Send to Jynx for summarization via openclaw agent CLI
		try {
			const { exec: execCb } = await import("node:child_process");
			const { promisify } = await import("node:util");
			const execAsync = promisify(execCb);
			const gutterUrl = `http://localhost:${env.port}`;
			const summaryMessage = `Meeting transcript uploaded for "${title || "meeting"}" (${time || "unknown time"}). Summarize and extract action items. Update Gutter via: curl -sk ${gutterUrl}/api/meeting-prep/update -X POST -H "Content-Type: application/json" -d '{"eventId":"${eventId}","occurrenceDate":"${occurrenceDate}","summary":"...","actionItems":["item1","item2"]}'\n\nTranscript:\n${transcript.substring(0, 4000)}`;
			execAsync(
				`openclaw agent --agent main -m ${JSON.stringify(summaryMessage)} --json`,
				{ timeout: 120_000 },
			).catch((err: Error) =>
				console.error("Transcript summary request failed:", err.message),
			);
		} catch (err) {
			console.error("Failed to send transcript to Jynx:", err);
		}

		// Fire-and-forget embedding of transcript for RAG context
		upsertMeetingTranscript({
			id,
			text: transcript,
			title: title || "Meeting",
			date: occurrenceDate,
		}).catch((err) =>
			console.error("[vector-store] transcript upsert failed:", err),
		);

		return Response.json({ ok: true, id });
	} catch (error) {
		console.error("Transcript upload error:", error);
		return Response.json(
			{ error: "Failed to upload transcript" },
			{ status: 500 },
		);
	}
}
