import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const screenshotDirectory = join(tmpdir(), "gutter-remediation-screenshots");
mkdirSync(screenshotDirectory, { recursive: true });

for (const width of [375, 768, 1024, 1440]) {
	test(`navigation is reachable without horizontal overflow at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "Navigation-only fixture" } }));
		await page.goto("/");
		await expect(page.locator("header")).toBeVisible();

		if (width < 1024) {
			const menu = page.getByRole("button", { name: "Open navigation" });
			await menu.focus();
			await page.keyboard.press("Enter");
			await expect(page.getByRole("menuitem", { name: "Review" })).toBeVisible();
			await expect(page.getByRole("menuitem", { name: "Open tomorrow" })).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(menu).toBeFocused();
		} else {
			const primary = page.getByRole("navigation", { name: "Primary" });
			await expect(primary).toBeVisible();
			await expect(primary.locator("a, button")).toHaveCount(4);
		}

		const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
		expect(hasHorizontalOverflow).toBe(false);
		await page.screenshot({ path: join(screenshotDirectory, `navigation-${width}.png`), fullPage: true });
	});
}

test("legacy daily-loop routes remain available", async ({ page }) => {
	await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "Navigation-only fixture" } }));
	for (const route of ["/tomorrow", "/reset"]) {
		const response = await page.goto(route);
		expect(response?.status()).toBe(200);
		await expect(page.locator("header")).toBeVisible();
	}
});
