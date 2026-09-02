import { getJournalDate } from "@/lib/journal-date";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidMeetingOccurrenceDate(value: unknown): value is string {
	if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
	const [year, month, day] = value.split("-").map(Number);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	return (
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day
	);
}

export function resolveMeetingOccurrenceDate({
	occurrenceDate,
	time,
	now = new Date(),
}: {
	occurrenceDate?: unknown;
	time?: unknown;
	now?: Date;
}): string {
	if (occurrenceDate !== undefined) {
		if (!isValidMeetingOccurrenceDate(occurrenceDate)) {
			throw new Error("occurrenceDate must be a valid YYYY-MM-DD date");
		}
		return occurrenceDate;
	}

	if (typeof time === "string") {
		const parsedTime = new Date(time);
		if (!Number.isNaN(parsedTime.getTime())) {
			return getJournalDate(parsedTime);
		}
	}

	return getJournalDate(now);
}
