import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

const passphrase = "test-only ledger password";

test("protection survives reload, wrong passwords, edits, backups and explicit locking", async ({ page }) => {
  await page.goto("/app.html?action=demo");
  await page.getByRole("navigation", { name: "App sections" }).getByRole("button", { name: "Data & privacy" }).click();
  await page.getByLabel("New passphrase", { exact: true }).fill(passphrase);
  await page.getByLabel("Confirm passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Enable encryption", exact: true }).click();
  await expect(page.getByText("Your local data is encrypted. Keep your passphrase safe.", { exact: true })).toBeVisible();
  const protectedRaw = await page.evaluate(() => localStorage.getItem("tally.v1")!);
  expect(JSON.parse(protectedRaw).enc).toBe(true);
  expect(protectedRaw).not.toContain("Payroll");
  await page.reload();
  await expect(page.getByLabel("Passphrase", { exact: true })).toBeVisible();
  await page.getByLabel("Passphrase", { exact: true }).fill("wrong password");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Wrong passphrase");
  expect(await page.evaluate(() => localStorage.getItem("tally.v1"))).toBe(protectedRaw);
  await page.getByLabel("Passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("tally.v1")!)).enc).toBe(true);
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Description", { exact: true }).fill("Private regression entry");
  await dialog.getByLabel(/^Amount/).fill("-42.75");
  await dialog.getByRole("button", { name: "Save transaction", exact: true }).click();
  await expect(page.getByText("Private regression entry", { exact: true })).toBeVisible();
  await expect(page.getByText("All changes saved locally", { exact: true })).toBeVisible();
  const editedRaw = await page.evaluate(() => localStorage.getItem("tally.v1")!);
  expect(JSON.parse(editedRaw).enc).toBe(true);
  expect(editedRaw).not.toContain("Private regression entry");
  await page.getByRole("navigation", { name: "App sections" }).getByRole("button", { name: "Data & privacy" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download encrypted JSON backup" }).click();
  const download = await downloadEvent;
  const backup = await readFile((await download.path())!, "utf8");
  expect(JSON.parse(backup).enc).toBe(true);
  expect(backup).not.toContain("Private regression entry");
  await page.getByRole("button", { name: "Lock now", exact: true }).click();
  await expect(page.getByLabel("Passphrase", { exact: true })).toBeVisible();
  await page.getByLabel("Passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await page.getByRole("navigation", { name: "App sections" }).getByRole("button", { name: "Transactions", exact: true }).click();
  await expect(page.getByText("Private regression entry", { exact: true })).toBeVisible();
});

test("invalid backups leave the active ledger intact", async ({ page }) => {
  await page.goto("/app.html?action=demo");
  await page.getByRole("navigation", { name: "App sections" }).getByRole("button", { name: "Data & privacy" }).click();
  const previous = await page.evaluate(() => localStorage.getItem("tally.v1"));
  await page.getByLabel("Select Tally JSON backup").setInputFiles({ name: "wrong.json", mimeType: "application/json", buffer: Buffer.from('{"unrelated":"data"}') });
  await expect(page.getByRole("alert")).toContainText("Tally JSON backup");
  expect(await page.evaluate(() => localStorage.getItem("tally.v1"))).toBe(previous);
});
