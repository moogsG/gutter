import { getDb } from "@/lib/db";

// POST: Update prep data for a meeting (called by Jynx after processing)
export async function POST(request: Request) {
	try {
		const { eventId, occurrenceDate, prepNotes, summary, actionItems } =
			await request.json();

		if (!eventId) {
			return Response.json({ error: "Missing eventId" }, { status: 400 });
		}

		const db = getDb();
		const now = new Date().toISOString();

		// Match by event_id + occurrence_date if provided, otherwise fall back to event_id only (for backwards compat)
		const existing = occurrenceDate
			? (db
					.prepare(
						"SELECT id, title, time, occurrence_date FROM meeting_prep WHERE event_id = ? AND occurrence_date = ?",
					)
					.get(eventId, occurrenceDate) as any)
			: (db
					.prepare(
						"SELECT id, title, time, occurrence_date FROM meeting_prep WHERE event_id = ? ORDER BY time DESC LIMIT 1",
					)
					.get(eventId) as any);
		if (!existing) {
			return Response.json({ error: "Meeting not found" }, { status: 404 });
		}

		// Build dynamic update
		const updates: string[] = ["updated_at = ?"];
		const values: any[] = [now];

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

		values.push(existing.id);
		db.prepare(
			`UPDATE meeting_prep SET ${updates.join(", ")} WHERE id = ?`,
		).run(...values);

		return Response.json({ ok: true });
	} catch (error) {
		console.error("Meeting prep update error:", error);
		return Response.json(
			{ error: "Failed to update meeting prep" },
			{ status: 500 },
		);
	}
}
