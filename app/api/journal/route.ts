import { type NextRequest, NextResponse } from "next/server";
import { getJournalDb } from "@/lib/journal-db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { validateJournalEntry } from "@/lib/validation";
import { upsertJournalEntry } from "@/lib/vector-store";
import type { JournalEntry, NewEntry } from "@/types/journal";

export async function GET(req: NextRequest) {
	// Rate limit: 100 requests per minute for GET
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 100,
	});
	if (limited) return limited;

	const date = req.nextUrl.searchParams.get("date");

	if (!date) {
		return NextResponse.json({ error: "Date required" }, { status: 400 });
	}

	// Validate date format (YYYY-MM-DD)
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return NextResponse.json(
			{ error: "Invalid date format. Use YYYY-MM-DD" },
			{ status: 400 },
		);
	}

	try {
		const db = getJournalDb();
		const entries = db
			.prepare(
				`SELECT id, date, signifier, text, status, migrated_to, migrated_from, 
                collection_id, parent_id, tags, sort_order, created_at, updated_at 
         FROM journal_entries 
         WHERE date = ? 
         ORDER BY sort_order ASC`,
			)
			.all(date) as JournalEntry[];

		// Parse tags JSON
		const parsed = entries.map((e) => ({
			...e,
			tags: e.tags ? JSON.parse(e.tags as unknown as string) : [],
			children: [] as JournalEntry[],
		}));

		// Nest children under parents
		const entryMap = new Map(parsed.map((e) => [e.id, e]));
		const topLevel: JournalEntry[] = [];

		for (const entry of parsed) {
			if (entry.parent_id && entryMap.has(entry.parent_id)) {
				entryMap.get(entry.parent_id)?.children?.push(entry);
			} else {
				topLevel.push(entry);
			}
		}

		return NextResponse.json(topLevel);
	} catch (error) {
		console.error("Error fetching journal entries:", error);
		return NextResponse.json(
			{ error: "Failed to fetch entries" },
			{ status: 500 },
		);
	}
}

export async function POST(req: NextRequest) {
	// Rate limit: 30 requests per minute for POST (more restrictive)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 30,
	});
	if (limited) return limited;

	try {
		const body: NewEntry = await req.json();
		const { date, signifier, text, tags = [], parent_id } = body;

		if (!date || !signifier || !text) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Validate date format
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return NextResponse.json(
				{ error: "Invalid date format" },
				{ status: 400 },
			);
		}

		// Validate signifier (should be one of the allowed types)
		const validSignifiers = ["•", "○", "×", "—", ">", "<", "*", "!", "?"];
		if (!validSignifiers.includes(signifier)) {
			return NextResponse.json({ error: "Invalid signifier" }, { status: 400 });
		}

		// Validate and sanitize entry content
		const validation = validateJournalEntry({ content: text, tags });
		if (!validation.valid) {
			return NextResponse.json(
				{ error: "Validation failed", details: validation.errors },
				{ status: 400 },
			);
		}

		// Use sanitized values
		const sanitizedText = validation.sanitized?.content || text;
		const sanitizedTags = validation.sanitized?.tags || tags;

		const db = getJournalDb();

		// Get max sort_order — scoped to siblings (same parent or top-level)
		const maxOrder = parent_id
			? (db
					.prepare(
						"SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ? AND parent_id = ?",
					)
					.get(date, parent_id) as { max: number | null })
			: (db
					.prepare(
						"SELECT MAX(sort_order) as max FROM journal_entries WHERE date = ? AND parent_id IS NULL",
					)
					.get(date) as { max: number | null });

		const sortOrder = (maxOrder?.max ?? -1) + 1;
		const id = `je-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		const now = new Date().toISOString();

		db.prepare(
			`INSERT INTO journal_entries 
       (id, date, signifier, text, status, tags, sort_order, parent_id, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
		).run(
			id,
			date,
			signifier,
			sanitizedText,
			JSON.stringify(sanitizedTags),
			sortOrder,
			parent_id || null,
			now,
			now,
		);

		const entry = db
			.prepare("SELECT * FROM journal_entries WHERE id = ?")
			.get(id) as JournalEntry;

		// Fire-and-forget embedding — don't block the response
		upsertJournalEntry({
			id: entry.id,
			text: entry.text,
			date: entry.date,
			signifier: entry.signifier,
			collection_id: entry.collection_id,
		}).catch((err) => console.error("[vector-store] upsert failed:", err));

		return NextResponse.json({
			...entry,
			tags: JSON.parse(entry.tags as unknown as string),
		});
	} catch (error) {
		console.error("Error creating journal entry:", error);
		return NextResponse.json(
			{ error: "Failed to create entry" },
			{ status: 500 },
		);
	}
}
