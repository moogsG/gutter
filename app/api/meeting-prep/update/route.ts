import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";

// POST: Update prep data for a meeting (called by Jynx after processing)
export async function POST(request: Request) {
	// Rate limit: 20 requests per minute (write operation)
	const limited = rateLimitMiddleware(request, {
		windowMs: 60000,
		maxRequests: 20,
	});
	if (limited) return limited;

	try {
		const {
			eventId,
			occurrenceDate,
			title,
			time,
			calendar,
			prepNotes,
			summary,
			actionItems,
		} = await request.json();

		if (!eventId) {
			return Response.json({ error: "Missing eventId" }, { status: 400 });
		}

		const db = getDb();
		const now = new Date().toISOString();

		// Match by event_id + occurrence_date if provided, otherwise fall back to event_id only (for backwards compat)
		const normalizedOccurrenceDate =
			occurrenceDate ||
			(time ? new Date(time).toISOString().split("T")[0] : undefined) ||
			new Date().toISOString().split("T")[0];

		const existing = normalizedOccurrenceDate
			? (db
					.prepare(
						"SELECT id, title, time, occurrence_date FROM meeting_prep WHERE event_id = ? AND occurrence_date = ?",
					)
					.get(eventId, normalizedOccurrenceDate) as any)
			: (db
					.prepare(
						"SELECT id, title, time, occurrence_date FROM meeting_prep WHERE event_id = ? ORDER BY time DESC LIMIT 1",
					)
					.get(eventId) as any);

		let meetingId = existing?.id as string | undefined;

		if (!meetingId) {
			meetingId = randomUUID();
			db.prepare(
				`INSERT INTO meeting_prep (
					id,
					event_id,
					occurrence_date,
					title,
					time,
					calendar,
					prep_notes,
					prep_status,
					summary,
					action_items,
					created_at,
					updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				meetingId,
				eventId,
				normalizedOccurrenceDate,
				title || "Untitled meeting",
				time || "",
				calendar || "",
				prepNotes ?? null,
				prepNotes !== undefined ? "ready" : "none",
				summary ?? null,
				actionItems !== undefined ? JSON.stringify(actionItems) : null,
				now,
				now,
			);

			return Response.json({ ok: true, id: meetingId });
		}

		// Build dynamic update
		const updates: string[] = ["updated_at = ?"];
		const values: any[] = [now];

		if (title !== undefined) {
			updates.push("title = ?");
			values.push(title);
		}
		if (time !== undefined) {
			updates.push("time = ?");
			values.push(time);
		}
		if (calendar !== undefined) {
			updates.push("calendar = ?");
			values.push(calendar);
		}
		if (prepNotes !== undefined) {
			updates.push("prep_notes = ?", "prep_status = ?");
			values.push(prepNotes, "ready");
		}
		if (summary !== undefined) {
			updates.push("summary = ?");
			values.push(summary);
		}
		if (actionItems !== undefined) {
			updates.push("action_items = ?");
			values.push(JSON.stringify(actionItems));
		}

		values.push(meetingId);
		db.prepare(
			`UPDATE meeting_prep SET ${updates.join(", ")} WHERE id = ?`,
		).run(...values);

		return Response.json({ ok: true, id: meetingId });
	} catch (error) {
		console.error("Meeting prep update error:", error);
		return Response.json(
			{ error: "Failed to update meeting prep" },
			{ status: 500 },
		);
	}
}
