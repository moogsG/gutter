import { describe, expect, it } from "vitest";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

describe("journal date authority", () => {
	it("keeps the product day in Cancun before local midnight when UTC is already tomorrow", () => {
		expect(getJournalDate(new Date("2026-09-03T03:30:00.000Z"))).toBe("2026-09-02");
	});

	it("advances the product day at Cancun midnight", () => {
		expect(getJournalDate(new Date("2026-09-03T05:00:00.000Z"))).toBe("2026-09-03");
	});

	it("supports a configured journal timezone", () => {
		expect(getJournalDate(new Date("2026-09-02T16:00:00.000Z"), "Asia/Tokyo")).toBe(
			"2026-09-03",
		);
	});

	it("shifts calendar dates without depending on the runtime timezone", () => {
		expect(shiftJournalDate("2026-03-08", 1)).toBe("2026-03-09");
		expect(shiftJournalDate("2026-01-01", -1)).toBe("2025-12-31");
	});
});
