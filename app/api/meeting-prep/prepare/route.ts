import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { generateMeetingPrep } from "@/lib/ollama-prep";
import { rateLimitMiddleware } from "@/lib/rate-limit";

// POST: Request prep for a meeting — generates via Ollama with tool calling
export async function POST(request: NextRequest) {
	// Tight rate limit for expensive LLM operations (10 per minute)
	const limited = rateLimitMiddleware(request, {
		windowMs: 60000,
		maxRequests: 10,
	});
	if (limited) return limited;

	try {
		const { eventId, title, time, calendar, context } = await request.json();

		if (!eventId || !title || !time) {
			return Response.json(
				{ error: "Missing eventId, title, or time" },
				{ status: 400 },
			);
		}

		const db = getDb();
		const now = new Date().toISOString();
		const occurrenceDate = time
			? new Date(time).toISOString().split("T")[0]
			: new Date().toISOString().split("T")[0];

		// Upsert meeting prep row
		const existing = db
			.prepare(
				"SELECT id FROM meeting_prep WHERE event_id = ? AND occurrence_date = ?",
			)
			.get(eventId, occurrenceDate) as any;

		let id: string;
		if (existing) {
			id = existing.id;
			db.prepare(
				"UPDATE meeting_prep SET prep_status = ?, updated_at = ? WHERE id = ?",
			).run("preparing", now, id);
		} else {
			id = randomUUID();
			db.prepare(
				`INSERT INTO meeting_prep (id, event_id, title, time, calendar, occurrence_date, prep_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				id,
				eventId,
				title,
				time,
				calendar || "",
				occurrenceDate,
				"preparing",
				now,
				now,
			);
		}

		// Fire and forget — generate prep in background, update DB when done
		(async () => {
			try {
				const prepNotes = await generateMeetingPrep(
					title,
					time,
					calendar,
					context,
				);

				db.prepare(
					"UPDATE meeting_prep SET prep_notes = ?, prep_status = ?, updated_at = ? WHERE id = ?",
				).run(prepNotes, "ready", new Date().toISOString(), id);
			} catch (err: any) {
				console.error(
					`[meeting-prep] Failed to generate prep for "${title}":`,
					err.message,
				);
				db.prepare(
					"UPDATE meeting_prep SET prep_status = ?, updated_at = ? WHERE id = ?",
				).run("failed", new Date().toISOString(), id);
			}
		})();

		return Response.json({ ok: true, id, status: "preparing" });
	} catch (_error) {
		return Response.json({ error: "Failed to request prep" }, { status: 500 });
	}
}
