import { execSync } from "node:child_process";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";

interface CalendarEvent {
	id: string;
	summary: string;
	startDate: string; // ISO string
	endDate: string;
	allDay: boolean;
	calendar: string;
	location?: string;
}

// Simple in-memory cache
let eventCache: {
	data: CalendarEvent[];
	timestamp: number;
	key: string;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

import { getCalendarNames } from "@/lib/calendars";

const CALENDARS_TO_FETCH = getCalendarNames().map((name, i) => ({
	name,
	index: String(i),
}));

export async function GET(req: NextRequest) {
	// Rate limit: 30 requests per minute (calendar fetch)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 30,
	});
	if (limited) return limited;

	const from = req.nextUrl.searchParams.get("from");
	const to = req.nextUrl.searchParams.get("to");

	if (!from || !to) {
		return NextResponse.json(
			{ error: "Missing required params: from, to (YYYY-MM-DD)" },
			{ status: 400 },
		);
	}

	// Check cache
	const cacheKey = `${from}-${to}`;
	if (
		eventCache &&
		eventCache.key === cacheKey &&
		Date.now() - eventCache.timestamp < CACHE_TTL
	) {
		return NextResponse.json(eventCache.data);
	}

	try {
		const allEvents: CalendarEvent[] = [];

		// Fetch events from each calendar separately using accli
		for (const cal of CALENDARS_TO_FETCH) {
			try {
				const cmd = `npx @joargp/accli events "${cal.name}" --from ${from}T00:00:00 --to ${to}T23:59:59 --json`;

				const output = execSync(cmd, {
					timeout: 15000,
					encoding: "utf-8",
					env: { ...process.env, PATH: process.env.PATH },
				});

				const parsed = JSON.parse(output.trim());
				const events = parsed.events || parsed || [];

				for (const e of events) {
					allEvents.push({
						id: e.id || `${e.title || e.summary}-${e.startDate || e.start}`,
						summary: e.title || e.summary || "Untitled Event",
						startDate: e.startDate || e.start || "",
						endDate: e.endDate || e.end || "",
						allDay: e.allDay || e.isAllDay || false,
						calendar: cal.name,
						location: e.location,
					});
				}
			} catch (_calError) {}
		}

		const filteredEvents = allEvents;

		// Update cache
		eventCache = {
			data: filteredEvents,
			timestamp: Date.now(),
			key: cacheKey,
		};

		return NextResponse.json(filteredEvents);
	} catch (_error) {
		// If we have stale cache, return that instead of erroring
		if (eventCache && eventCache.key === cacheKey) {
			return NextResponse.json(eventCache.data);
		}

		return NextResponse.json(
			{ error: "Failed to fetch calendar events" },
			{ status: 500 },
		);
	}
}
