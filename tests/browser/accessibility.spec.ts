import { test, expect } from "@playwright/test";

test("transaction dialogs wrap keyboard focus, close with Escape and restore the trigger", async ({ page }) => {
  await page.goto("/app.html?action=demo");
  const trigger = page.getByRole("button", { name: "Add transaction", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Add transaction", exact: true });
  const close = dialog.getByRole("button", { name: "Close dialog", exact: true });
  const save = dialog.getByRole("button", { name: "Save transaction", exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(save).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

for (const width of [320, 390]) {
  test(`all ledger sections and forms fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/app.html?action=demo");
    const navigation = page.getByRole("navigation", { name: "App sections" });
    for (const name of ["Overview", "Accounts", "Income plan", "Forecast", "Transactions", "Categories", "Recurring", "Budgets", "Data & privacy"]) {
      await navigation.getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("heading", { name, exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name} should scroll tables inside the page`).toBeLessThanOrEqual(width);
    }
    await page.getByRole("button", { name: "Add transaction", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction", exact: true });
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await dialog.getByLabel("Description", { exact: true }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await page.keyboard.press("Escape");
  });
}

test("reduced-motion charts render without advancing animation time and expose keyboard values", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const now = new Date("2026-09-20T12:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await page.goto("/app.html?action=demo");
  const spend = page.getByRole("region", { name: "Daily spend", exact: true });
  const income = page.getByRole("region", { name: "Daily income", exact: true });
  for (const region of [spend, income]) {
    await expect(region.locator(".recharts-area-curve")).toHaveAttribute("d", /^M.+/);
  }
  const chart = spend.getByRole("application", { name: /^Daily spend\./ });
  await chart.focus();
  const announcedValue = spend.locator('[aria-live="polite"]');
  const firstValue = await announcedValue.textContent();
  await page.keyboard.press("ArrowRight");
  await expect(announcedValue).not.toHaveText(firstValue!);
  await spend.getByRole("button", { name: "Bar view", exact: true }).click();
  expect(await spend.locator(".recharts-bar-rectangle path").count()).toBeGreaterThan(0);
  await expect(spend.locator(".recharts-bar-rectangle path").first()).toHaveAttribute("d", /^M.+/);
});
