import { describe, expect, it } from "vitest";
import { CALENDAR_TOKENS, getCalendarColorToken } from "../calendar-colors";

describe("getCalendarColorToken", () => {
	it("returns correct token for known calendars", () => {
		expect(getCalendarColorToken("Gradient")).toBe("cal-gradient");
		expect(getCalendarColorToken("Work")).toBe("cal-gradient");
		expect(getCalendarColorToken("Family Calendar")).toBe("cal-family");
		expect(getCalendarColorToken("JW")).toBe("cal-jw");
		expect(getCalendarColorToken("School")).toBe("cal-school");
	});

	it("returns default token for unknown calendar", () => {
		expect(getCalendarColorToken("Unknown Calendar")).toBe("cal-home");
		expect(getCalendarColorToken("")).toBe("cal-home");
	});

	it("is case-sensitive", () => {
		expect(getCalendarColorToken("gradient")).toBe("cal-home");
		expect(getCalendarColorToken("Gradient")).toBe("cal-gradient");
	});
});

describe("CALENDAR_TOKENS", () => {
	it("exports all known calendar tokens", () => {
		expect(CALENDAR_TOKENS).toHaveLength(7);
		expect(CALENDAR_TOKENS[0]).toEqual({
			name: "Gradient",
			token: "cal-gradient",
		});
	});

	it("tokens are valid CSS variable names", () => {
		CALENDAR_TOKENS.forEach(({ token }) => {
			expect(token).toMatch(/^cal-[a-z]+$/);
		});
	});
});
