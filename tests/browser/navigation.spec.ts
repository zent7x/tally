import { test, expect } from "@playwright/test";

test("demo opens every section, persists, and keeps the dark theme", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith("http://127.0.0.1:4173/")) external.push(request.url());
  });
  await page.goto("/app.html?action=demo");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.getByText("Demo ledger loaded.", { exact: false })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "App sections" });
  for (const name of ["Accounts", "Income plan", "Forecast", "Transactions", "Categories", "Recurring", "Budgets", "Data & privacy"]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: /Switch to (black|dark)/ }).click();
  await nav.getByRole("button", { name: "Categories", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await nav.getByRole("button", { name: "Budgets", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(nav.getByRole("button", { name: "Transactions", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("mobile navigation and ledger fit a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app.html?action=demo");
  const nav = page.getByRole("navigation", { name: "App sections" });
  for (const name of ["Overview", "Accounts", "Income plan", "Forecast", "Transactions", "Data & privacy"]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `${name} overflows viewport`).toBe(false);
  }
});

test("landing add and import links open useful dialogs without creating a transaction", async ({ page }) => {
  await page.goto("/app.html?action=add");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tally.v1") || '{"transactions":[]}').transactions.length)).toBe(0);
  await page.goto("/app.html?action=import");
  await expect(page.getByRole("dialog", { name: "Import transactions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose CSV file" })).toBeVisible();
});

test("the loaded ledger stays usable without a network connection", async ({ page, context }) => {
  await page.goto("/app.html?action=demo");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Description", { exact: true }).fill("Offline cash entry");
  await dialog.getByLabel(/^Amount/).fill("-12.50");
  await dialog.getByRole("button", { name: "Save transaction", exact: true }).click();
  await expect(page.getByText("Offline cash entry", { exact: true })).toBeVisible();
  await expect(page.getByText("All changes saved locally", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "App sections" }).getByRole("button", { name: "Forecast", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Forecast", exact: true })).toBeVisible();
});

test("demo replacement asks before discarding configuration without transactions", async ({ page }) => {
  await page.goto("/app.html");
  const nav = page.getByRole("navigation", { name: "App sections" });
  await nav.getByRole("button", { name: "Budgets", exact: true }).click();
  await page.getByRole("spinbutton", { name: /Budget limit for Groceries/ }).fill("123");
  await expect(page.getByText("All changes saved locally", { exact: true })).toBeVisible();
  let confirmations = 0;
  page.on("dialog", async (dialog) => { confirmations++; await dialog.dismiss(); });
  await nav.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: /demo data/ }).click();
  expect(confirmations).toBe(1);
  await page.goto("/app.html?action=demo");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  expect(confirmations).toBe(2);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tally.v1")!));
  expect(saved.budgets.Groceries).toBe(123);
  expect(saved.transactions).toHaveLength(0);
});
