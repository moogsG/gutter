import { afterEach, describe, expect, it, vi } from "vitest";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

describe("journal date authority", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("defaults the journal timezone to America/Cancun", async () => {
		vi.stubEnv("NEXT_PUBLIC_JOURNAL_TIME_ZONE", "");

		const { JOURNAL_TIME_ZONE } = await import("@/lib/journal-date");

		expect(JOURNAL_TIME_ZONE).toBe("America/Cancun");
	});

	it("accepts a valid configured IANA journal timezone", async () => {
		vi.stubEnv("NEXT_PUBLIC_JOURNAL_TIME_ZONE", " Asia/Tokyo ");
		vi.resetModules();

		const { getJournalDate: getConfiguredJournalDate, JOURNAL_TIME_ZONE } = await import("@/lib/journal-date");

		expect(JOURNAL_TIME_ZONE).toBe("Asia/Tokyo");
		expect(getConfiguredJournalDate(new Date("2026-09-02T16:00:00.000Z"))).toBe("2026-09-03");
	});

	it("rejects an invalid configured journal timezone with a stable configuration error", async () => {
		vi.stubEnv("NEXT_PUBLIC_JOURNAL_TIME_ZONE", "Definitely/Not_A_Zone");
		vi.resetModules();

		await expect(import("@/lib/journal-date")).rejects.toThrow(
			"Invalid NEXT_PUBLIC_JOURNAL_TIME_ZONE: Definitely/Not_A_Zone is not an IANA time zone",
		);
	});

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
