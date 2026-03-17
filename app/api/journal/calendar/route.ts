import { type NextRequest, NextResponse } from "next/server";
import {
	ACCLI,
	CACHE_DURATION_MS,
	CALENDAR_ENABLED,
	calendarCache,
	createCalendarEvent,
	DEFAULT_CALENDAR,
	RETRY_ATTEMPTS,
	RETRY_DELAY_MS,
} from "@/lib/calendar";

interface CalendarEventRequest {
	summary: string;
	date: string; // YYYY-MM-DD
	startTime?: string; // HH:mm (24h)
	endTime?: string; // HH:mm (24h)
	allDay?: boolean;
	calendar?: string;
	location?: string;
	description?: string;
}

export async function POST(req: NextRequest) {
	try {
		const body: CalendarEventRequest = await req.json();
		const {
			summary,
			date,
			startTime,
			endTime,
			allDay,
			calendar,
			location,
			description,
		} = body;

		if (!summary || !date) {
			return NextResponse.json(
				{ error: "Missing required fields: summary, date" },
				{ status: 400 },
			);
		}

		// Use shared calendar creation logic
		const result = await createCalendarEvent({
			summary,
			date,
			startTime,
			endTime,
			allDay,
			calendar,
			location,
			description,
		});

		if (!result.ok) {
			if (result.disabled) {
				return NextResponse.json(
					{
						ok: false,
						error: result.error,
						disabled: true,
					},
					{ status: 503 },
				);
			}

			// Check if it's a PATH/environment issue
			const isEnvIssue =
				result.error?.includes("command not found") ||
				result.error?.includes("npx") ||
				result.error?.includes("accli");

			return NextResponse.json(
				{
					error: "Failed to create calendar event",
					detail: result.error,
					suggestion: isEnvIssue
						? "Calendar CLI (accli) not found. Ensure it's installed and in PATH."
						: "Calendar service unavailable. Try again later.",
					cacheStatus: {
						lastSync: calendarCache.lastSync,
						lastError: calendarCache.lastError,
						lastSuccess: calendarCache.lastSuccess,
					},
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({
			ok: true,
			message: `Created "${summary}" on ${result.data?.calendar || DEFAULT_CALENDAR}`,
			event: result.data?.event,
			cacheStatus: {
				lastSync: calendarCache.lastSync,
				lastSuccess: calendarCache.lastSuccess,
			},
		});
	} catch (error) {
		console.error("[Calendar] Unexpected error:", error);
		const errMsg = error instanceof Error ? error.message : String(error);

		return NextResponse.json(
			{
				error: "Unexpected error creating calendar event",
				detail: errMsg,
			},
			{ status: 500 },
		);
	}
}

// GET endpoint for calendar status
export async function GET() {
	if (!CALENDAR_ENABLED) {
		return NextResponse.json({
			enabled: false,
			message: "Calendar integration is disabled",
		});
	}

	return NextResponse.json({
		enabled: true,
		config: {
			cli: ACCLI,
			defaultCalendar: DEFAULT_CALENDAR,
			retryAttempts: RETRY_ATTEMPTS,
			retryDelayMs: RETRY_DELAY_MS,
			cacheDurationMs: CACHE_DURATION_MS,
		},
		status: {
			lastSync: calendarCache.lastSync,
			lastSuccess: calendarCache.lastSuccess,
			lastError: calendarCache.lastError,
			timeSinceLastSync: calendarCache.lastSync
				? Date.now() - calendarCache.lastSync
				: null,
		},
	});
}
