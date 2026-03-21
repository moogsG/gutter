import { type NextRequest, NextResponse } from "next/server";
import { getJournalDb } from "@/lib/journal-db";
import type { JournalEntry } from "@/types/journal";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
	// Rate limit: 50 requests per minute (read operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	const month = req.nextUrl.searchParams.get("month");

	if (!month) {
		return NextResponse.json(
			{ error: "Month required (YYYY-MM)" },
			{ status: 400 },
		);
	}

	try {
		const db = getJournalDb();

		// Get all unresolved tasks and appointments from the month
		const entries = db
			.prepare(
				`SELECT id, date, signifier, text, status, migrated_to, migrated_from, 
                collection_id, tags, sort_order, created_at, updated_at 
         FROM journal_entries 
         WHERE date LIKE ? 
           AND (signifier = 'task' OR signifier = 'appointment')
           AND status = 'open'
         ORDER BY date ASC, sort_order ASC`,
			)
			.all(`${month}%`) as JournalEntry[];

		// Parse tags JSON
		const parsed = entries.map((e) => ({
			...e,
			tags: e.tags ? JSON.parse(e.tags as unknown as string) : [],
		}));

		return NextResponse.json(parsed);
	} catch (error) {
		console.error("Error fetching unresolved entries:", error);
		return NextResponse.json(
			{ error: "Failed to fetch entries" },
			{ status: 500 },
		);
	}
}
