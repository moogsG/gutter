import { execSync } from "node:child_process";
import { env } from "@/lib/env";
import { getJournalDate } from "@/lib/journal-date";
import type { OptionalSourceState } from "@/types";

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
export const COMMAND_TIMEOUT_MS = parseInt(
	process.env.CALENDAR_COMMAND_TIMEOUT_MS || "15000",
	10,
);
export const READ_RETRY_ATTEMPTS = parseInt(
	process.env.CALENDAR_READ_RETRY_ATTEMPTS || "1",
	10,
);
export const READ_TIMEOUT_MS = parseInt(
	process.env.CALENDAR_READ_TIMEOUT_MS || "5000",
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

interface RetryOptions {
	attempts?: number;
	timeoutMs?: number;
	updateStatus?: boolean;
}

export async function executeWithRetry(
	cmd: string,
	options: RetryOptions = {},
): Promise<string> {
	const attempts = options.attempts ?? RETRY_ATTEMPTS;
	const timeoutMs = options.timeoutMs ?? COMMAND_TIMEOUT_MS;
	const updateStatus = options.updateStatus ?? true;

	for (let i = 0; i < attempts; i++) {
		try {
			const output = execSync(cmd, {
				timeout: timeoutMs,
				encoding: "utf-8",
				env: { ...process.env, PATH: process.env.PATH },
			});

			if (updateStatus) {
				calendarCache.lastSync = Date.now();
				calendarCache.lastSuccess = true;
				calendarCache.lastError = null;
			}

			return output;
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			console.error(`[Calendar] Attempt ${i + 1}/${attempts} failed:`, errMsg);

			if (updateStatus) {
				calendarCache.lastSync = Date.now();
				calendarCache.lastSuccess = false;
				calendarCache.lastError = errMsg;
			}

			if (i === attempts - 1) {
				throw error;
			}

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

export function buildCalendarEventsCommand(
	cli: string,
	calendarName: string,
	from: string,
	to: string,
): string {
	return `${cli} events "${calendarName}" --from ${from}T00:00:00 --to ${to}T23:59:59 --json`;
}

export function buildCreateCalendarEventCommand(
	cli: string,
	params: CalendarEventParams,
): string {
	const calName = params.calendar
		? CALENDAR_ALIASES[params.calendar.toLowerCase()] || params.calendar
		: DEFAULT_CALENDAR;
	const args: string[] = [
		cli,
		"create",
		`--calendar-name "${calName}"`,
		`--summary "${params.summary.replace(/"/g, '\\"')}"`,
	];

	if (params.allDay || !params.startTime) {
		args.push(`--start "${params.date}"`);
		args.push(`--end "${params.date}"`);
		args.push("--all-day");
	} else {
		args.push(`--start "${params.date}T${params.startTime}"`);
		if (params.endTime) {
			args.push(`--end "${params.date}T${params.endTime}"`);
		} else {
			const [h, m] = params.startTime.split(":").map(Number);
			const endH = String(h + 1).padStart(2, "0");
			args.push(`--end "${params.date}T${endH}:${String(m).padStart(2, "0")}"`);
		}
	}

	if (params.location) {
		args.push(`--location "${params.location.replace(/"/g, '\\"')}"`);
	}
	if (params.description) {
		args.push(`--description "${params.description.replace(/"/g, '\\"')}"`);
	}
	args.push("--json");

	return args.join(" ");
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
): Promise<{ ok: boolean; data?: CalendarEvent[]; error?: string; source: OptionalSourceState }> {
	if (!CALENDAR_ENABLED) {
		return {
			ok: false,
			error: "Calendar integration disabled",
			source: {
				state: "not-configured",
				message: "Calendar is disabled. Enable it to load meetings.",
				recovery: "configure",
			},
		};
	}

	// Check cache
	const cacheKey = `${from}-${to}`;
	if (
		eventCache &&
		eventCache.key === cacheKey &&
		Date.now() - eventCache.timestamp < EVENT_CACHE_TTL
	) {
		return {
			ok: true,
			data: eventCache.data,
			source: {
				state: eventCache.data.length > 0 ? "ready" : "empty",
				message: eventCache.data.length > 0 ? "Calendar events loaded." : "No calendar events in this range.",
				recovery: null,
			},
		};
	}

	try {
		const { getCalendarNames } = await import("@/lib/calendars");
		const calendarNames = getCalendarNames();
		const previousCache =
			eventCache && eventCache.key === cacheKey ? eventCache : null;
		const settledCalendars = await Promise.all(
			calendarNames.map(async (calName) => {
				try {
					const cmd = buildCalendarEventsCommand(ACCLI, calName, from, to);
					const output = await executeWithRetry(cmd, {
						attempts: READ_RETRY_ATTEMPTS,
						timeoutMs: READ_TIMEOUT_MS,
						updateStatus: false,
					});
					const parsed = JSON.parse(output.trim());
					const events = parsed.events || parsed || [];

					return {
						calName,
						ok: true as const,
						events: events.map((e: any) => ({
							id: e.id || `${e.title || e.summary}-${e.startDate || e.start}`,
							summary: e.title || e.summary || "Untitled Event",
							startDate: e.startDate || e.start || "",
							endDate: e.endDate || e.end || "",
							allDay: e.allDay || e.isAllDay || false,
							calendar: calName,
							location: e.location,
						})),
					};
				} catch (error) {
					const errMsg = error instanceof Error ? error.message : String(error);
					console.error(`[Calendar] Skipping ${calName}:`, errMsg);
					return {
						calName,
						ok: false as const,
						events: [] as CalendarEvent[],
						error: errMsg,
					};
				}
			}),
		);

		const allEvents = settledCalendars.flatMap((result) => result.events);
		const failedCalendars = settledCalendars.filter((result) => !result.ok);

		calendarCache.lastSync = Date.now();
		calendarCache.lastSuccess = failedCalendars.length < calendarNames.length;
		calendarCache.lastError =
			failedCalendars.length > 0
				? failedCalendars
						.map((result) => `${result.calName}: ${result.error}`)
						.join(" | ")
				: null;

		if (allEvents.length === 0 && failedCalendars.length === calendarNames.length) {
			if (previousCache) {
				return {
					ok: true,
					data: previousCache.data,
					source: {
						state: "unavailable",
						message: "Calendar is unavailable; showing cached events.",
						recovery: "retry",
					},
				};
			}
			return {
				ok: false,
				error: calendarCache.lastError || "Calendar unavailable",
				source: {
					state: "unavailable",
					message: "Calendar could not be reached. Check the CLI and retry.",
					recovery: "retry",
				},
			};
		}

		eventCache = {
			data: allEvents,
			timestamp: Date.now(),
			key: cacheKey,
		};

		return {
			ok: true,
			data: allEvents,
			source: {
				state: allEvents.length > 0 ? "ready" : "empty",
				message: allEvents.length > 0 ? "Calendar events loaded." : "No calendar events in this range.",
				recovery: null,
			},
		};
	} catch (error) {
		// If we have stale cache, return that
		if (eventCache && eventCache.key === cacheKey) {
			return {
				ok: true,
				data: eventCache.data,
				source: {
					state: "unavailable",
					message: "Calendar is unavailable; showing cached events.",
					recovery: "retry",
				},
			};
		}

		const errMsg = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: errMsg,
			source: {
				state: "unavailable",
				message: "Calendar could not be reached. Check the CLI and retry.",
				recovery: "retry",
			},
		};
	}
}

/**
 * Get today's calendar events
 */
export async function getTodayEvents(): Promise<CalendarEvent[]> {
	const today = getJournalDate();
	const result = await fetchCalendarEvents(today, today);
	return result.data || [];
}

export async function getEventsForDate(date: string): Promise<CalendarEvent[]> {
	const result = await fetchCalendarEvents(date, date);
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

	if (!params.summary || !params.date) {
		return {
			ok: false,
			error: "Missing required fields: summary, date",
		};
	}

	try {
		// Resolve calendar name
		const calName = params.calendar
			? CALENDAR_ALIASES[params.calendar.toLowerCase()] || params.calendar
			: DEFAULT_CALENDAR;
		const cmd = buildCreateCalendarEventCommand(ACCLI, params);

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
