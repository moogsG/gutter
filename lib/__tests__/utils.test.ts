import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn utility", () => {
	it("merges class names correctly", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	it("handles conditional classes", () => {
		expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
	});

	it("deduplicates Tailwind classes", () => {
		expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
	});

	it("handles empty input", () => {
		expect(cn()).toBe("");
	});

	it("handles arrays", () => {
		expect(cn(["foo", "bar"])).toBe("foo bar");
	});

	it("handles objects", () => {
		expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
	});
});
