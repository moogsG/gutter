import { type NextRequest, NextResponse } from "next/server";
import {
	handleApiError,
	handleValidationError,
} from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import type { JournalEntry } from "@/types/journal";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
	// Rate limit: 50 requests per minute (read operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	const before = req.nextUrl.searchParams.get("before");

	if (!before) {
		return handleValidationError("before date required (YYYY-MM-DD)");
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) {
		return handleValidationError("Invalid before date format. Use YYYY-MM-DD");
	}

	try {
		const db = getDb();

		// Get unresolved tasks and appointments from any previous day.
		const entries = db
			.prepare(
				`SELECT id, date, signifier, text, status, migrated_to, migrated_from, 
                collection_id, tags, sort_order, created_at, updated_at 
         FROM journal_entries 
         WHERE date < ?
           AND (signifier = 'task' OR signifier = 'appointment')
           AND status IN ('open', 'in-progress', 'blocked')
         ORDER BY date ASC, sort_order ASC`,
			)
			.all(before) as JournalEntry[];

		// Parse tags JSON
		const parsed = entries.map((e) => ({
			...e,
			tags: e.tags ? JSON.parse(e.tags as unknown as string) : [],
		}));

		return NextResponse.json(parsed);
	} catch (error) {
		return handleApiError("fetch unresolved entries", error);
	}
}
