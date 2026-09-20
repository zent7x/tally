import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";

const passphrase = "test-only persistence password";

async function openData(page: Page) {
  await page.getByRole("navigation", { name: "App sections" }).getByRole("button", { name: "Data & privacy" }).click();
}

async function enableEncryption(page: Page) {
  await openData(page);
  await page.getByLabel("New passphrase", { exact: true }).fill(passphrase);
  await page.getByLabel("Confirm passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Enable encryption", exact: true }).click();
}

async function addTransaction(page: Page, description: string) {
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Description", { exact: true }).fill(description);
  await dialog.getByLabel(/^Amount/).fill("-17.25");
  await dialog.getByRole("button", { name: "Save transaction", exact: true }).click();
}

async function downloadBackup(page: Page) {
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download .*JSON backup/ }).click();
  const download = await downloaded;
  return { raw: await readFile((await download.path())!, "utf8"), name: download.suggestedFilename() };
}

async function decryptBackup(page: Page, raw: string) {
  return page.evaluate(async ({ raw, passphrase }) => {
    const envelope = JSON.parse(raw);
    const bytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: bytes(envelope.salt), iterations: 250000, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
    );
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(envelope.iv) }, key, bytes(envelope.ct));
    return JSON.parse(new TextDecoder().decode(decrypted));
  }, { raw, passphrase });
}

test("a stale plaintext tab cannot overwrite another tab's encrypted store, even without storage events", async ({ page, context }) => {
  await page.goto("/app.html?action=demo");
  await expect(page.getByText("All changes saved locally", { exact: true })).toBeVisible();
  const stale = await context.newPage();
  // Reproduce a suspended/missed storage event: the write-time check must still protect the store.
  await stale.addInitScript(() => window.addEventListener("storage", (event) => event.stopImmediatePropagation()));
  await stale.goto("/app.html");
  await expect(stale.getByRole("button", { name: "Add transaction", exact: true })).toBeVisible();
  await enableEncryption(page);
  await expect(page.getByText("Your local data is encrypted. Keep your passphrase safe.", { exact: true })).toBeVisible();
  const protectedRaw = await page.evaluate(() => localStorage.getItem("tally.v1"));

  await addTransaction(stale, "Only in the stale tab");
  await expect(stale.getByRole("alert").first()).toContainText("Another tab changed your ledger");
  await expect(stale.getByRole("alert").first()).toContainText("reload before continuing");
  expect(await stale.evaluate(() => localStorage.getItem("tally.v1"))).toBe(protectedRaw);
  expect(JSON.parse(protectedRaw!).enc).toBe(true);
  await openData(stale);
  const backup = await downloadBackup(stale);
  expect(JSON.parse(backup.raw).transactions.some((transaction: { desc: string }) => transaction.desc === "Only in the stale tab")).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("tally.v1"))).toBe(protectedRaw);
});

test("encrypted backups include unsaved edits when browser storage is full", async ({ page }) => {
  await page.goto("/app.html?action=demo");
  await enableEncryption(page);
  await expect(page.getByText("Your local data is encrypted. Keep your passphrase safe.", { exact: true })).toBeVisible();
  const protectedRaw = await page.evaluate(() => localStorage.getItem("tally.v1"));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "tally.v1") throw new DOMException("Storage is full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await addTransaction(page, "Unsaved but recoverable");
  await expect(page.getByRole("alert").first()).toContainText("Export a backup before closing");
  await expect(page.getByText("Unsaved but recoverable", { exact: true })).toBeVisible();
  await openData(page);
  const backup = await downloadBackup(page);
  expect(backup.name).toMatch(/^tally-encrypted-.*\.json$/);
  expect(JSON.parse(backup.raw).enc).toBe(true);
  expect(backup.raw).not.toContain("Unsaved but recoverable");
  const recovered = await decryptBackup(page, backup.raw);
  expect(recovered.transactions.some((transaction: { desc: string }) => transaction.desc === "Unsaved but recoverable")).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("tally.v1"))).toBe(protectedRaw);
  await expect(page.getByRole("alert").first()).toContainText("Export a backup before closing");
});

test("edits made during asynchronous encryption are queued and protected from page exit", async ({ page }) => {
  await page.goto("/app.html?action=demo");
  await page.evaluate(() => {
    const original = crypto.subtle.deriveKey.bind(crypto.subtle);
    const control = window as typeof window & { releaseDerivation?: () => void };
    crypto.subtle.deriveKey = async (...args) => {
      const key = await original(...args);
      await new Promise<void>((resolve) => { control.releaseDerivation = resolve; });
      return key;
    };
  });
  await enableEncryption(page);
  await page.waitForFunction(() => Boolean((window as typeof window & { releaseDerivation?: () => void }).releaseDerivation));
  await addTransaction(page, "Saved during encryption");
  await expect(page.getByText("Saved during encryption", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  await page.evaluate(() => {
    (window as typeof window & { releaseDerivation?: () => void }).releaseDerivation?.();
    // Later backup decryption uses the native implementation.
    crypto.subtle.deriveKey = SubtleCrypto.prototype.deriveKey;
  });
  await expect(page.getByText("All changes saved locally", { exact: true })).toBeVisible();
  const raw = await page.evaluate(() => localStorage.getItem("tally.v1")!);
  expect(JSON.parse(raw).enc).toBe(true);
  expect((await decryptBackup(page, raw)).transactions.some((transaction: { desc: string }) => transaction.desc === "Saved during encryption")).toBe(true);
});

test("an unreadable ledger is not overwritten when its recovery copy cannot be saved", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    original.call(localStorage, "tally.v1", '{"transactions":');
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("tally.v1.corrupt-")) throw new DOMException("Recovery copy quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/app.html");
  await expect(page.getByRole("alert").first()).toContainText("could not create a recovery copy");
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Description", { exact: true }).fill("Unsaved replacement");
  await dialog.getByLabel(/^Amount/).fill("-15");
  await dialog.getByRole("button", { name: "Save transaction", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("preserve the original data");
  expect(await page.evaluate(() => localStorage.getItem("tally.v1"))).toBe('{"transactions":');
});
