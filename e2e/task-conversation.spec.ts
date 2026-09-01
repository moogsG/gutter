import { expect, test } from "@playwright/test";

test("capture → all-task board → conversation → status persists", async ({ page }) => {
  const title = `Playwright task ${Date.now()}`;
  const comment = "**Playwright note:** persisted conversation context.";

  await page.goto("/kanban");
  await expect(page.getByText("All active task work, across capture dates.")).toBeVisible();
  await page.getByRole("link", { name: "Capture task in journal" }).click();

  const quickCapture = page.getByPlaceholder("Type / for shortcuts, ⌘K for commands");
  await expect(quickCapture).toBeVisible();
  await quickCapture.fill(title);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/journal") && response.request().method() === "POST" && response.ok()),
    page.getByRole("button", { name: "Add", exact: true }).click(),
  ]);

  await page.goto("/kanban");
  const taskButton = page.getByRole("button", { name: `Open task: ${title}` });
  await expect(taskButton).toBeVisible();
  await taskButton.click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("No comments yet")).toBeVisible();

  await page.getByLabel("Add a Markdown comment").fill(comment);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/comments") && response.request().method() === "POST" && response.status() === 201),
    page.getByRole("button", { name: "Add comment" }).click(),
  ]);
  await expect(page.getByText("Playwright note:")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: `Move ${title}` }).click();
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/tasks") && response.request().method() === "POST" && response.ok()),
    page.getByRole("menuitem", { name: "In Progress" }).click(),
  ]);

  await page.reload();
  await expect(page.getByRole("button", { name: `Open task: ${title}` })).toBeVisible();
  await page.getByRole("button", { name: `Open task: ${title}` }).click();
  const drawer = page.locator('[data-slot="sheet-content"]');
  await expect(drawer.getByText("In Progress", { exact: true })).toBeVisible();
  await expect(page.getByText("Playwright note:")).toBeVisible();
  await page.screenshot({ path: "test-results/task-conversation.png", fullPage: true });
});
