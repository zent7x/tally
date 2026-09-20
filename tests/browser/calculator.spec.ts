import { test, expect } from "@playwright/test";

test("3D calculator supports its keys, decimal arithmetic, and error recovery", async ({ page }) => {
  await page.goto("/");
  const calculator = page.getByRole("region", { name: "Quick calculator" });
  const result = calculator.getByLabel("Calculator result", { exact: true });
  for (const name of ["7", "Multiply", "8", "Add", "4", "Equals"]) await calculator.getByRole("button", { name, exact: true }).click();
  await expect(result).toHaveText("60");
  await calculator.getByRole("button", { name: "Clear", exact: true }).click();
  await calculator.focus();
  await page.keyboard.type("0.1+0.2");
  await page.keyboard.press("Enter");
  await expect(result).toHaveText("0.3");
  await page.keyboard.press("Escape");
  await page.keyboard.type("9/0=");
  await expect(result).toHaveText("Error");
  await page.keyboard.type("5");
  await expect(result).toHaveText("5");
  await calculator.getByRole("button", { name: "Change sign", exact: true }).click();
  await calculator.getByRole("button", { name: "Delete digit", exact: true }).click();
  await expect(result).toHaveText("0");
});

for (const width of [320, 390]) {
  test(`landing calculator and navigation fit ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your accounts. Stored locally." })).toBeVisible();
    const calculator = page.getByRole("region", { name: "Quick calculator" });
    await expect(calculator.getByRole("button", { name: "Equals", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Front view", exact: true }).click();
    await expect(page.getByRole("button", { name: "3D view", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await calculator.evaluate(element => getComputedStyle(element).transform)).toBe("none");
    await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByText("Can I encrypt my ledger?", { exact: true }).click();
    await expect(page.getByText(/Set a passphrase in Data & privacy/)).toBeVisible();
    await page.getByRole("link", { name: "Open your ledger", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  });
}
