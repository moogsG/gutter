import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { updateMeetingPrep } from "@/lib/meeting-prep-update";

const EVENT_ID = "meeting-prep-update-test-event";

function cleanup() {
	getDb().prepare("DELETE FROM meeting_prep WHERE event_id = ?").run(EVENT_ID);
}

describe("updateMeetingPrep", () => {
	beforeEach(cleanup);
	afterEach(cleanup);

	it("persists a transcript summary for the exact meeting occurrence", () => {
		const db = getDb();
		const now = new Date().toISOString();
		db.prepare(
			`INSERT INTO meeting_prep (
				id, event_id, occurrence_date, title, time, calendar, prep_status, transcript, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"meeting-prep-update-test-id",
			EVENT_ID,
			"2026-09-01",
			"Security review",
			"2026-09-01T23:30:00-05:00",
			"Work",
			"none",
			"Transcript",
			now,
			now,
		);

		updateMeetingPrep({
			eventId: EVENT_ID,
			occurrenceDate: "2026-09-01",
			summary: "A safely persisted summary.",
			actionItems: ["Keep the callback in-process"],
		});

		const row = db
			.prepare(
				"SELECT summary, action_items FROM meeting_prep WHERE event_id = ? AND occurrence_date = ?",
			)
			.get(EVENT_ID, "2026-09-01") as {
			summary: string;
			action_items: string;
		};
		expect(row.summary).toBe("A safely persisted summary.");
		expect(JSON.parse(row.action_items)).toEqual(["Keep the callback in-process"]);
	});
});
