/**
 * Calendar color mapping — uses CSS variables so colors adapt to the active theme.
 * Returns Tailwind class fragments (e.g. "cal-gradient") for use with
 * bg-cal-*, text-cal-*, border-cal-* utilities.
 */

const CALENDAR_COLOR_MAP: Record<string, string> = {
	Gradient: "cal-gradient",
	Work: "cal-gradient",
	Calendar: "cal-gradient",
	"Family Calendar": "cal-family",
	Family: "cal-family",
	Home: "cal-home",
	Personal: "cal-home",
	JW: "cal-jw",
	School: "cal-school",
	Birthdays: "cal-birthdays",
	"Canadian Holidays": "cal-holidays",
	Holidays: "cal-holidays",
};

/**
 * Get the Tailwind color token for a calendar name.
 * Returns e.g. "cal-gradient" — use as `bg-cal-gradient`, `text-cal-gradient`, etc.
 */
export function getCalendarColorToken(calendarName: string): string {
	return CALENDAR_COLOR_MAP[calendarName] || "cal-home";
}

/**
 * All known calendar tokens for rendering legends.
 */
export const CALENDAR_TOKENS = [
	{ name: "Gradient", token: "cal-gradient" },
	{ name: "Family", token: "cal-family" },
	{ name: "Home", token: "cal-home" },
	{ name: "JW", token: "cal-jw" },
	{ name: "School", token: "cal-school" },
	{ name: "Birthdays", token: "cal-birthdays" },
	{ name: "Holidays", token: "cal-holidays" },
] as const;
