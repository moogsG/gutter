import { execSync } from "node:child_process";
import { env } from "@/lib/env";

// Configuration
export const CALENDAR_ENABLED = env.calendarEnabled;
export const ACCLI = env.calendarCli;
export const RETRY_ATTEMPTS = parseInt(
	process.env.CALENDAR_RETRY_ATTEMPTS || "3",
	10,
);
export const RETRY_DELAY_MS = parseInt(
	process.env.CALENDAR_RETRY_DELAY_MS || "1000",
	10,
);
export const CACHE_DURATION_MS = parseInt(
	process.env.CALENDAR_CACHE_DURATION_MS || "300000",
	10,
);
export const DEFAULT_CALENDAR = process.env.CALENDAR_DEFAULT_NAME || "Home";

// Map friendly names to calendar names
export const CALENDAR_ALIASES: Record<string, string> = {
	work: "Gradient",
	gradient: "Gradient",
	family: "Family Calendar",
	home: "Home",
	jw: "JW",
	school: "School",
	personal: "Home",
};

// Simple in-memory cache for calendar sync status
interface CalendarCache {
	lastSync: number | null;
	lastError: string | null;
	lastSuccess: boolean;
}

export const calendarCache: CalendarCache = {
	lastSync: null,
	lastError: null,
	lastSuccess: false,
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWithRetry(
	cmd: string,
	attempts = RETRY_ATTEMPTS,
): Promise<string> {
	for (let i = 0; i < attempts; i++) {
		try {
			const output = execSync(cmd, {
				timeout: 15000,
				encoding: "utf-8",
				env: { ...process.env, PATH: process.env.PATH },
			});

			// Log success
			calendarCache.lastSync = Date.now();
			calendarCache.lastSuccess = true;
			calendarCache.lastError = null;

			return output;
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			console.error(`[Calendar] Attempt ${i + 1}/${attempts} failed:`, errMsg);

			// Update cache
			calendarCache.lastSync = Date.now();
			calendarCache.lastSuccess = false;
			calendarCache.lastError = errMsg;

			// If this is the last attempt, throw
			if (i === attempts - 1) {
				throw error;
			}

			// Wait before retrying (exponential backoff)
			await sleep(RETRY_DELAY_MS * (i + 1));
		}
	}

	throw new Error("Retry logic failed unexpectedly");
}

export interface CalendarEvent {
	id: string;
	summary: string;
	startDate: string; // ISO string
	endDate: string;
	allDay: boolean;
	calendar: string;
	location?: string;
}

export interface CalendarEventParams {
	summary: string;
	date: string; // YYYY-MM-DD
	startTime?: string; // HH:mm (24h)
	endTime?: string; // HH:mm (24h)
	allDay?: boolean;
	calendar?: string;
	location?: string;
	description?: string;
}

// Event cache
let eventCache: {
	data: CalendarEvent[];
	timestamp: number;
	key: string;
} | null = null;

const EVENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch calendar events for a date range from all configured calendars
 */
export async function fetchCalendarEvents(
	from: string,
	to: string,
): Promise<{ ok: boolean; data?: CalendarEvent[]; error?: string }> {
	if (!CALENDAR_ENABLED) {
		return {
			ok: false,
			error: "Calendar integration disabled",
		};
	}

	// Check cache
	const cacheKey = `${from}-${to}`;
	if (
		eventCache &&
		eventCache.key === cacheKey &&
		Date.now() - eventCache.timestamp < EVENT_CACHE_TTL
	) {
		return { ok: true, data: eventCache.data };
	}

	try {
		const { getCalendarNames } = await import("@/lib/calendars");
		const calendarNames = getCalendarNames();
		const allEvents: CalendarEvent[] = [];

		// Fetch events from each calendar
		for (let i = 0; i < calendarNames.length; i++) {
			const calName = calendarNames[i];
			try {
				const cmd = `${ACCLI} events "${calName}" --from ${from}T00:00:00 --to ${to}T23:59:59 --json`;
				const output = await executeWithRetry(cmd);
				const parsed = JSON.parse(output.trim());
				const events = parsed.events || parsed || [];

				for (const e of events) {
					allEvents.push({
						id: e.id || `${e.title || e.summary}-${e.startDate || e.start}`,
						summary: e.title || e.summary || "Untitled Event",
						startDate: e.startDate || e.start || "",
						endDate: e.endDate || e.end || "",
						allDay: e.allDay || e.isAllDay || false,
						calendar: calName,
						location: e.location,
					});
				}
			} catch (_calError) {
				// Skip calendar on error
			}
		}

		// Update cache
		eventCache = {
			data: allEvents,
			timestamp: Date.now(),
			key: cacheKey,
		};

		return { ok: true, data: allEvents };
	} catch (error) {
		// If we have stale cache, return that
		if (eventCache && eventCache.key === cacheKey) {
			return { ok: true, data: eventCache.data };
		}

		const errMsg = error instanceof Error ? error.message : String(error);
		return { ok: false, error: errMsg };
	}
}

/**
 * Get today's calendar events
 */
export async function getTodayEvents(): Promise<CalendarEvent[]> {
	const today = new Date().toISOString().split('T')[0];
	const result = await fetchCalendarEvents(today, today);
	return result.data || [];
}

export async function createCalendarEvent(
	params: CalendarEventParams,
): Promise<{
	ok: boolean;
	data?: any;
	error?: string;
	disabled?: boolean;
}> {
	// Check if calendar integration is enabled
	if (!CALENDAR_ENABLED) {
		return {
			ok: false,
			error: "Calendar integration disabled",
			disabled: true,
		};
	}

	const {
		summary,
		date,
		startTime,
		endTime,
		allDay,
		calendar,
		location,
		description,
	} = params;

	if (!summary || !date) {
		return {
			ok: false,
			error: "Missing required fields: summary, date",
		};
	}

	try {
		// Resolve calendar name
		const calName = calendar
			? CALENDAR_ALIASES[calendar.toLowerCase()] || calendar
			: DEFAULT_CALENDAR;

		// Build accli command
		const args: string[] = [
			ACCLI,
			"create",
			`--calendar-name "${calName}"`,
			`--summary "${summary.replace(/"/g, '\\"')}"`,
		];

		if (allDay || !startTime) {
			args.push(`--start "${date}"`);
			args.push(`--end "${date}"`);
			args.push("--all-day");
		} else {
			args.push(`--start "${date}T${startTime}"`);
			// Default to 1 hour if no end time
			if (endTime) {
				args.push(`--end "${date}T${endTime}"`);
			} else {
				// Parse start and add 1 hour
				const [h, m] = startTime.split(":").map(Number);
				const endH = String(h + 1).padStart(2, "0");
				args.push(`--end "${date}T${endH}:${String(m).padStart(2, "0")}"`);
			}
		}

		if (location) {
			args.push(`--location "${location.replace(/"/g, '\\"')}"`);
		}
		if (description) {
			args.push(`--description "${description.replace(/"/g, '\\"')}"`);
		}

		args.push("--json");

		const cmd = args.join(" ");

		// Execute with retry logic
		const output = await executeWithRetry(cmd);

		let result;
		try {
			result = JSON.parse(output.trim());
		} catch {
			result = { raw: output.trim() };
		}

		return {
			ok: true,
			data: {
				calendar: calName,
				event: result,
			},
		};
	} catch (error) {
		console.error("[Calendar] Failed to create event after retries:", error);
		const errMsg = error instanceof Error ? error.message : String(error);

		// Check if it's a PATH/environment issue
		const _isEnvIssue =
			errMsg.includes("command not found") ||
			errMsg.includes("npx") ||
			errMsg.includes("accli");

		return {
			ok: false,
			error: errMsg,
		};
	}
}
