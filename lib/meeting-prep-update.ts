import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { resolveMeetingOccurrenceDate } from "@/lib/meeting-occurrence";

export interface MeetingPrepUpdate {
	eventId: string;
	occurrenceDate?: string;
	title?: string;
	time?: string;
	calendar?: string;
	prepNotes?: string | null;
	summary?: string | null;
	actionItems?: string[] | null;
}

export function updateMeetingPrep(input: MeetingPrepUpdate): { id: string } {
	const db = getDb();
	const now = new Date().toISOString();
	const occurrenceDate = resolveMeetingOccurrenceDate(input);
	const existing = db
		.prepare(
			"SELECT id FROM meeting_prep WHERE event_id = ? AND occurrence_date = ?",
		)
		.get(input.eventId, occurrenceDate) as { id: string } | undefined;
	const meetingId = existing?.id || randomUUID();

	if (!existing) {
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
			input.eventId,
			occurrenceDate,
			input.title || "Untitled meeting",
			input.time || "",
			input.calendar || "",
			input.prepNotes ?? null,
			input.prepNotes !== undefined ? "ready" : "none",
			input.summary ?? null,
			input.actionItems !== undefined
				? JSON.stringify(input.actionItems)
				: null,
			now,
			now,
		);
		return { id: meetingId };
	}

	const updates: string[] = ["updated_at = ?"];
	const values: unknown[] = [now];

	if (input.title !== undefined) {
		updates.push("title = ?");
		values.push(input.title);
	}
	if (input.time !== undefined) {
		updates.push("time = ?");
		values.push(input.time);
	}
	if (input.calendar !== undefined) {
		updates.push("calendar = ?");
		values.push(input.calendar);
	}
	if (input.prepNotes !== undefined) {
		updates.push("prep_notes = ?", "prep_status = ?");
		values.push(input.prepNotes, "ready");
	}
	if (input.summary !== undefined) {
		updates.push("summary = ?");
		values.push(input.summary);
	}
	if (input.actionItems !== undefined) {
		updates.push("action_items = ?");
		values.push(JSON.stringify(input.actionItems));
	}

	values.push(meetingId);
	db.prepare(
		`UPDATE meeting_prep SET ${updates.join(", ")} WHERE id = ?`,
	).run(...values);
	return { id: meetingId };
}
