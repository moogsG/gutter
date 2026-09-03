import { expect, test } from "@playwright/test";

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

test("Today supports a persistent keyboard habit check-in without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/");

  const done = page.getByRole("button", { name: "Mark Workout / Walk done" });
  await expect(done).toBeVisible();
  await done.focus();
  await page.keyboard.press("Enter");
  await expect(done).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByRole("button", { name: "Mark Workout / Walk done" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("habit history is secondary and explains an unlogged reporting window", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/habits");

  await expect(page.getByRole("heading", { name: "Habit history" })).toBeVisible();
  await expect(page.getByText(/Today is where you check in/i)).toBeVisible();
  await expect(page.getByText("Unlogged")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("history check-in edits the selected date without changing today", async ({ page }) => {
  const todayResponse = await page.request.get("/api/habits");
  expect(todayResponse.ok()).toBe(true);
  const today = (await todayResponse.json()).requestedDate as string;
  const selectedDate = previousDate(today);

  for (const date of [today, selectedDate]) {
    const reset = await page.request.post("/api/habits", {
      data: { habitId: "omad", date, state: "unlogged" },
    });
    expect(reset.ok()).toBe(true);
  }

  await page.goto(`/habits?date=${selectedDate}`);
  await page.getByRole("link", { name: "Check in on Today" }).click();
  await expect(page).toHaveURL(`/?date=${selectedDate}`);
  await page.getByRole("button", { name: "Mark Protein-First done" }).click();

  const selectedResponse = await page.request.get(`/api/habits?date=${selectedDate}`);
  const currentResponse = await page.request.get(`/api/habits?date=${today}`);
  expect(selectedResponse.ok()).toBe(true);
  expect(currentResponse.ok()).toBe(true);
  const selected = await selectedResponse.json();
  const current = await currentResponse.json();
  expect(selected.today.find((habit: { habitId: string }) => habit.habitId === "omad").state).toBe("done");
  expect(current.today.find((habit: { habitId: string }) => habit.habitId === "omad").state).toBe("unlogged");
});
