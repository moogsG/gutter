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

  const tasksResponse = await page.request.get("/api/tasks");
  expect(tasksResponse.ok()).toBe(true);
  const task = (await tasksResponse.json()).find(
    (candidate: { text: string }) => candidate.text === title,
  );
  expect(task).toBeDefined();

  const rejected = await page.request.get(`/api/tasks/${task.id}/comments`, {
    headers: { Authorization: "Bearer invalid-agent-token" },
  });
  expect(rejected.status()).toBe(401);

  const agentToken = process.env.GUTTER_E2E_AGENT_TOKEN;
  if (!agentToken) throw new Error("GUTTER_E2E_AGENT_TOKEN is not configured");
  const agentComment = {
    body: "Agent verification comment",
    source_ref: "playwright:task-conversation",
  };
  const agentHeaders = {
    Authorization: `Bearer ${agentToken}`,
    "Idempotency-Key": "playwright-agent-comment-1",
  };
  const firstAgentWrite = await page.request.post(`/api/tasks/${task.id}/comments`, {
    headers: agentHeaders,
    data: agentComment,
  });
  expect(firstAgentWrite.status()).toBe(201);
  const retryAgentWrite = await page.request.post(`/api/tasks/${task.id}/comments`, {
    headers: agentHeaders,
    data: agentComment,
  });
  expect(retryAgentWrite.status()).toBe(200);
  expect((await retryAgentWrite.json()).id).toBe((await firstAgentWrite.json()).id);

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
  await expect(page.getByText("Agent verification comment")).toBeVisible();
  await expect(page.getByText("Jynx", { exact: true })).toBeVisible();
  await page.getByText("Provenance", { exact: true }).click();
  await expect(page.getByText("playwright:task-conversation")).toBeVisible();
  await page.screenshot({ path: "test-results/task-conversation.png", fullPage: true });
});
