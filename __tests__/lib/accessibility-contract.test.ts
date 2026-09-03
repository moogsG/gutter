import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("accessibility contract", () => {
	it("keeps browser zoom available", () => {
		const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
		expect(layout).not.toContain("maximumScale");
	});
});