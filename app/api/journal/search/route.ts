import { type NextRequest, NextResponse } from "next/server";
import { getJournalDb } from "@/lib/journal-db";
import type { JournalEntry } from "@/types/journal";

export async function GET(req: NextRequest) {
	const query = req.nextUrl.searchParams.get("q");
	const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);

	if (!query || query.trim().length < 2) {
		return NextResponse.json([]);
	}

	try {
		const db = getJournalDb();
		const searchTerm = `%${query.trim()}%`;

		const entries = db
			.prepare(
				`SELECT id, date, signifier, text, status, migrated_to, migrated_from,
                collection_id, tags, sort_order, created_at, updated_at
         FROM journal_entries
         WHERE text LIKE ? AND status != 'killed'
         ORDER BY date DESC, sort_order ASC
         LIMIT ?`,
			)
			.all(searchTerm, limit) as JournalEntry[];

		const parsed = entries.map((e) => ({
			...e,
			tags: e.tags ? JSON.parse(e.tags as unknown as string) : [],
		}));

		return NextResponse.json(parsed);
	} catch (error) {
		console.error("Error searching journal entries:", error);
		return NextResponse.json(
			{ error: "Failed to search entries" },
			{ status: 500 },
		);
	}
}
