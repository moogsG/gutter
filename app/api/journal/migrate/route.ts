import { type NextRequest, NextResponse } from "next/server";
import { getJournalDb } from "@/lib/journal-db";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
	// Rate limit: 20 requests per minute (write operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 20,
	});
	if (limited) return limited;

	try {
		const { entryIds, targetDate } = await req.json();

		if (!entryIds || !Array.isArray(entryIds) || !targetDate) {
			return NextResponse.json(
				{ error: "entryIds (array) and targetDate required" },
				{ status: 400 },
			);
		}

		const db = getJournalDb();
		const now = new Date().toISOString();

		// Get max sort_order for target date
		const maxOrder = db
			.prepare(
				"SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ?",
			)
			.get(targetDate) as { max: number | null };

		let sortOrder = (maxOrder?.max ?? -1) + 1;

		// For each entry, create a new entry on target date and mark original as migrated
		for (const entryId of entryIds) {
			const original = db
				.prepare("SELECT * FROM journal_entries WHERE id = ?")
				.get(entryId) as any;

			if (!original) continue;

			const newId = `je-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			// Create new entry on target date
			db.prepare(
				`INSERT INTO journal_entries 
         (id, date, signifier, text, status, migrated_from, collection_id, tags, sort_order, created_at, updated_at) 
         VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`,
			).run(
				newId,
				targetDate,
				original.signifier,
				original.text,
				original.date,
				original.collection_id,
				original.tags,
				sortOrder++,
				now,
				now,
			);

			// Mark original as migrated
			db.prepare(
				"UPDATE journal_entries SET status = 'migrated', migrated_to = ?, updated_at = ? WHERE id = ?",
			).run(targetDate, now, entryId);
		}

		return NextResponse.json({ success: true, count: entryIds.length });
	} catch (error) {
		console.error("Error migrating entries:", error);
		return NextResponse.json(
			{ error: "Failed to migrate entries" },
			{ status: 500 },
		);
	}
}
