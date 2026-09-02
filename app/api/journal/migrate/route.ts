import { type NextRequest, NextResponse } from "next/server";
import {
	handleApiError,
	handleValidationError,
} from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";

function isValidIsoDate(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(req: NextRequest) {
	// Rate limit: 20 requests per minute (write operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 20,
	});
	if (limited) return limited;

	try {
		const body = await req.json();
		const entryIds = body?.entryIds;
		const targetDate = body?.targetDate;

		if (!Array.isArray(entryIds) || entryIds.length === 0) {
			return handleValidationError("entryIds must be a non-empty array");
		}

		if (!entryIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
			return handleValidationError("entryIds must contain valid string IDs");
		}

		if (!isValidIsoDate(targetDate)) {
			return handleValidationError("targetDate must be a valid YYYY-MM-DD date");
		}

		const normalizedIds = [...new Set(entryIds.map((id) => id.trim()))];
		if (normalizedIds.length !== entryIds.length) {
			return handleValidationError("entryIds must not contain duplicates");
		}

		const db = getDb();
		const now = new Date().toISOString();
		let migratedCount = 0;
		let skippedCount = 0;

		db.exec("BEGIN");
		try {
			// Get max sort_order for target date once, then increment deterministically.
			const maxOrder = db
				.prepare(
					"SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ?",
				)
				.get(targetDate) as { max: number | null };

			let sortOrder = (maxOrder?.max ?? -1) + 1;

			const originals = normalizedIds.map((entryId) =>
				db
					.prepare("SELECT * FROM journal_entries WHERE id = ?")
					.get(entryId) as any,
			);
			const migratable = originals.filter(
				(original) =>
					original && isValidIsoDate(original.date) && original.date !== targetDate,
			);
			skippedCount = originals.length - migratable.length;
			const idMap = new Map(
				migratable.map((original) => [
					original.id as string,
					`je-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
				]),
			);
			const depth = (entry: any): number => {
				const visited = new Set<string>();
				let current = entry;
				let result = 0;
				while (current?.parent_id && idMap.has(current.parent_id) && !visited.has(current.id)) {
					visited.add(current.id);
					current = migratable.find((candidate) => candidate.id === current.parent_id);
					result++;
				}
				return result;
			};
			migratable.sort((left, right) => depth(left) - depth(right));

			for (const original of migratable) {
				const newId = idMap.get(original.id)!;

				db.prepare(
					`INSERT INTO journal_entries 
         (id, date, signifier, text, status, migrated_from, collection_id, tags, sort_order, lane, priority, waiting_on, parent_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				).run(
					newId,
					targetDate,
					original.signifier,
					original.text,
					original.date,
					original.collection_id,
					original.tags,
					sortOrder++,
					original.lane ?? null,
					original.priority ?? null,
					original.waiting_on ?? null,
					original.parent_id ? idMap.get(original.parent_id) ?? null : null,
					now,
					now,
				);

				db.prepare(
					"UPDATE journal_entries SET status = 'migrated', migrated_to = ?, updated_at = ? WHERE id = ?",
				).run(targetDate, now, original.id);

				migratedCount++;
			}
			db.exec("COMMIT");
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}

		return NextResponse.json({
			success: true,
			targetDate,
			requestedCount: entryIds.length,
			migratedCount,
			skippedCount,
		});
	} catch (error) {
		return handleApiError("migrate entries", error);
	}
}
