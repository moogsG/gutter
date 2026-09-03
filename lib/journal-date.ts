const configuredJournalTimeZone =
	process.env.NEXT_PUBLIC_JOURNAL_TIME_ZONE?.trim() || "America/Cancun";

try {
	new Intl.DateTimeFormat("en-US", {
		timeZone: configuredJournalTimeZone,
	}).format();
} catch {
	throw new Error(
		`Invalid NEXT_PUBLIC_JOURNAL_TIME_ZONE: ${configuredJournalTimeZone} is not an IANA time zone`,
	);
}

export const JOURNAL_TIME_ZONE = configuredJournalTimeZone;

export function getJournalDate(
	instant: Date = new Date(),
	timeZone: string = JOURNAL_TIME_ZONE,
): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(instant);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

export function isValidJournalDate(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year
		&& date.getUTCMonth() === month - 1
		&& date.getUTCDate() === day;
}

export function shiftJournalDate(date: string, days: number): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) throw new Error("Invalid journal date. Use YYYY-MM-DD.");

	const shifted = new Date(
		Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
	);
	return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}
