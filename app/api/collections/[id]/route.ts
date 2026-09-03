import { type NextRequest, NextResponse } from "next/server";
import { handleApiError, handleNotFoundError, handleValidationError } from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { validateId } from "@/lib/validation";
import type { Collection, JournalEntry } from "@/types/journal";

type CollectionRow = Collection & { icon: string | null };
type EntryRow = Omit<JournalEntry, "tags" | "children"> & { tags: string | null };

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const limited = rateLimitMiddleware(req, { windowMs: 60_000, maxRequests: 50 });
	if (limited) return limited;

	try {
		const { id } = await params;
		const validation = validateId(id);
		if (!validation.valid) {
			return handleValidationError(validation.error || "Invalid ID");
		}

		const db = getDb();
		const collection = db
			.prepare("SELECT id, title, icon, created_at FROM collections WHERE id = ?")
			.get(id) as CollectionRow | undefined;
		if (!collection) return handleNotFoundError("Collection");

		const rows = db
			.prepare(
				`SELECT id, date, signifier, text, status, lane, priority, waiting_on,
				 migrated_to, migrated_from, collection_id, parent_id, tags, sort_order,
				 created_at, updated_at
				 FROM journal_entries
				 WHERE collection_id = ?
				 ORDER BY date DESC, sort_order ASC`,
			)
			.all(id) as EntryRow[];
		const entries = rows.map((entry) => ({
			...entry,
			tags: entry.tags ? JSON.parse(entry.tags) : [],
			children: [],
		}));

		return NextResponse.json({ ...collection, entries });
	} catch (error) {
		return handleApiError("fetch collection", error);
	}
}
