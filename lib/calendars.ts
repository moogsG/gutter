/**
 * Shared calendar list — reads from CALENDARS env var.
 * Format: comma-separated calendar names
 * Example: CALENDARS=Calendar,Family Calendar,Home,JW,School
 */
export function getCalendarNames(): string[] {
	const raw =
		process.env.CALENDARS || "Calendar,Family Calendar,Home,JW,School";
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}
