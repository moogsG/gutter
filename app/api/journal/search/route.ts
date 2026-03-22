import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { getJournalDb } from "@/lib/journal-db";
import type { JournalEntry } from "@/types/journal";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
	// Rate limit: 30 requests per minute (search operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 30,
	});
	if (limited) return limited;

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
		return handleApiError("search journal entries", error);
	}
}
