import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
	isValidMeetingOccurrenceDate,
	resolveMeetingOccurrenceDate,
} from "@/lib/meeting-occurrence";
import { updateMeetingPrep } from "@/lib/meeting-prep-update";
import { summarizeMeetingTranscript } from "@/lib/meeting-transcript";
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
		const { eventId, title, time, calendar, transcript, occurrenceDate } =
			await request.json();

		if (!eventId || !transcript) {
			return Response.json(
				{ error: "Missing eventId or transcript" },
				{ status: 400 },
			);
		}
		if (
			occurrenceDate !== undefined &&
			!isValidMeetingOccurrenceDate(occurrenceDate)
		) {
			return Response.json(
				{ error: "occurrenceDate must be a valid YYYY-MM-DD date" },
				{ status: 400 },
			);
		}

		const db = getDb();
		const now = new Date().toISOString();
		const normalizedOccurrenceDate = resolveMeetingOccurrenceDate({
			occurrenceDate,
			time,
		});

		// Upsert meeting prep row with transcript (keyed on event_id + occurrence_date)
		const existing = db
			.prepare(
				"SELECT id FROM meeting_prep WHERE event_id = ? AND occurrence_date = ?",
			)
			.get(eventId, normalizedOccurrenceDate) as any;

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
				normalizedOccurrenceDate,
				"none",
				transcript,
				now,
				now,
			);
		}

		// Summarization is asynchronous. The transcript is already persisted, while the
		// summary is only persisted after the agent returns valid JSON.
		void summarizeMeetingTranscript(
			{
				eventId,
				title: title || "Meeting",
				time: time || "",
				occurrenceDate: normalizedOccurrenceDate,
				transcript,
			},
			{ updateMeetingPrep },
		).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.error(
				"Transcript summarization failed; transcript remains stored without a summary:",
				message,
			);
		});

		// Fire-and-forget embedding of transcript for RAG context
		upsertMeetingTranscript({
			id,
			text: transcript,
			title: title || "Meeting",
			date: normalizedOccurrenceDate,
		}).catch((err) =>
			console.error("[vector-store] transcript upsert failed:", err),
		);

		return Response.json({ ok: true, id, summaryStatus: "pending" });
	} catch (error) {
		console.error("Transcript upload error:", error);
		return Response.json(
			{ error: "Failed to upload transcript" },
			{ status: 500 },
		);
	}
}
