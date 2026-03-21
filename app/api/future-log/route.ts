import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { FutureLogEntry } from "@/types/journal";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
	// Rate limit: 50 requests per minute (read operation)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 50,
	});
	if (limited) return limited;

	const month = req.nextUrl.searchParams.get("month");

	try {
		const db = getDb();
		let query = "SELECT * FROM future_log";
		const params: string[] = [];

		if (month) {
			query += " WHERE target_month = ?";
			params.push(month);
		}

		query += " ORDER BY target_month ASC, created_at ASC";

		const entries = db.prepare(query).all(...params) as Array<
			Omit<FutureLogEntry, "migrated"> & { migrated: number }
		>;

		// Convert migrated number to boolean
		const parsed: FutureLogEntry[] = entries.map((e) => ({
			...e,
			migrated: e.migrated === 1,
		}));

		return NextResponse.json(parsed);
	} catch (error) {
		console.error("Error fetching future log:", error);
		return NextResponse.json(
			{ error: "Failed to fetch future log" },
			{ status: 500 },
		);
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
		const { target_month, signifier, text } = await req.json();

		if (!target_month || !signifier || !text) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}

		const db = getDb();
		const id = `fl-${Date.now()}`;
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO future_log (id, target_month, signifier, text, migrated, created_at) VALUES (?, ?, ?, ?, 0, ?)",
		).run(id, target_month, signifier, text, now);

		const entry = db
			.prepare("SELECT * FROM future_log WHERE id = ?")
			.get(id) as Omit<FutureLogEntry, "migrated"> & { migrated: number };

		return NextResponse.json({
			...entry,
			migrated: entry.migrated === 1,
		} as FutureLogEntry);
	} catch (error) {
		console.error("Error creating future log entry:", error);
		return NextResponse.json(
			{ error: "Failed to create entry" },
			{ status: 500 },
		);
	}
}
