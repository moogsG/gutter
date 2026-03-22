import { type NextRequest, NextResponse } from "next/server";
import {
	handleApiError,
	handleValidationError,
} from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import type { Collection } from "@/types/journal";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
	// Rate limit: 50 requests per minute (read operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	try {
		const db = getDb();
		const collections = db
			.prepare(
				`SELECT c.*, 
                (SELECT COUNT(*) FROM journal_entries WHERE collection_id = c.id) as entry_count
         FROM collections c
         ORDER BY c.created_at DESC`,
			)
			.all() as Collection[];

		return NextResponse.json(collections);
	} catch (error) {
		return handleApiError("fetch collections", error);
	}
}

export async function POST(req: NextRequest) {
	// Rate limit: 20 requests per minute (write operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 20,
	});
	if (limited) return limited;

	try {
		const { title, icon } = await req.json();

		if (!title) {
			return handleValidationError("Title required");
		}

		const db = getDb();
		const id = `col-${Date.now()}`;
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO collections (id, title, icon, created_at) VALUES (?, ?, ?, ?)",
		).run(id, title, icon || null, now);

		const collection = db
			.prepare("SELECT * FROM collections WHERE id = ?")
			.get(id) as Collection;

		return NextResponse.json(collection);
	} catch (error) {
		return handleApiError("create collection", error);
	}
}
