import { test, expect, type Page } from "@playwright/test";

async function openSection(page: Page, name: string) {
  await page.getByRole("navigation", { name: "App sections" }).getByRole("button", { name, exact: true }).click();
}

async function savedLedger(page: Page) {
  await expect(page.getByText("All changes saved locally", { exact: true })).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem("tally.v1")!));
}

async function addAccount(page: Page, name: string, type = "checking", balance = "") {
  await openSection(page, "Accounts");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add account", exact: true });
  await dialog.getByLabel("Account name", { exact: true }).fill(name);
  await dialog.getByRole("combobox", { name: "Account type", exact: true }).selectOption(type);
  await dialog.getByLabel(/^(Current balance|Amount owed)/).fill(balance);
  await dialog.getByRole("button", { name: "Add account", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function chooseCSV(page: Page, contents: string) {
  await page.getByRole("button", { name: "Import CSV", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Import transactions", exact: true });
  await dialog.getByLabel("Bank CSV file", { exact: true }).setInputFiles({
    name: "bank-statement.csv", mimeType: "text/csv", buffer: Buffer.from(contents),
  });
  await expect(dialog.getByRole("heading", { name: "Match your columns", exact: true })).toBeVisible();
  return dialog;
}

test("custom bank mapping survives reload and applies dates, debit/credit signs and the destination account", async ({ page }) => {
  await page.goto("/app.html");
  await addAccount(page, "Statement checking");
  let dialog = await chooseCSV(page, "Recorded,Narrative,Outflow,Inflow\n04/05/2026,Corner supplies,18.50,\n06/05/2026,Client deposit,,400\n");
  await dialog.getByRole("combobox", { name: "Date column", exact: true }).selectOption("0");
  await dialog.getByRole("combobox", { name: "Description column", exact: true }).selectOption("1");
  await dialog.getByRole("combobox", { name: "Amount layout", exact: true }).selectOption("separate");
  await dialog.getByRole("combobox", { name: "Debit / money out (optional)", exact: true }).selectOption("2");
  await dialog.getByRole("combobox", { name: "Credit / money in (optional)", exact: true }).selectOption("3");
  await dialog.getByRole("combobox", { name: "Date order", exact: true }).selectOption("dmy");
  await dialog.getByRole("combobox", { name: "Import into account", exact: true }).selectOption({ label: "Statement checking" });
  await expect(dialog.getByRole("row", { name: /2026-05-04 Corner supplies/ })).toContainText("-$18.50");
  await expect(dialog.getByRole("row", { name: /2026-05-06 Client deposit/ })).toContainText("$400.00");
  await dialog.getByLabel("Remember this bank layout", { exact: true }).fill("Everyday bank");
  await dialog.getByRole("button", { name: "Save new preset", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Everyday bank saved.");
  await dialog.getByRole("button", { name: "Import 2 transactions", exact: true }).click();
  await expect(page.getByRole("row", { name: /Corner supplies/ })).toContainText("Statement checking");
  const initial = await savedLedger(page);
  const accountId = initial.accounts.find((account: { name: string }) => account.name === "Statement checking").id;
  expect(initial.transactions.map(({ date, amount, accountId }: { date: string; amount: number; accountId: string }) => ({ date, amount, accountId }))).toEqual([
    { date: "2026-05-04", amount: -18.5, accountId },
    { date: "2026-05-06", amount: 400, accountId },
  ]);

  await page.reload();
  dialog = await chooseCSV(page, "Recorded,Narrative,Outflow,Inflow\n05/06/2026,June supplies,27.25,\n");
  await expect(dialog.getByText("Applied Everyday bank. Review the preview before importing.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Date order", exact: true })).toHaveValue("dmy");
  await expect(dialog.getByRole("combobox", { name: "Amount layout", exact: true })).toHaveValue("separate");
  await dialog.getByRole("combobox", { name: "Bank preset", exact: true }).selectOption("");
  await dialog.getByRole("combobox", { name: "Date order", exact: true }).selectOption("mdy");
  await expect(dialog.getByRole("row", { name: /2026-05-06 June supplies/ })).toBeVisible();
  await dialog.getByRole("combobox", { name: "Bank preset", exact: true }).selectOption({ label: "Everyday bank" });
  await expect(dialog.getByRole("combobox", { name: "Date order", exact: true })).toHaveValue("dmy");
  await expect(dialog.getByRole("row", { name: /2026-06-05 June supplies/ })).toBeVisible();
  await dialog.getByRole("combobox", { name: "Import into account", exact: true }).selectOption({ label: "Statement checking" });
  await dialog.getByRole("button", { name: "Import 1 transactions", exact: true }).click();
  await expect(page.getByRole("row", { name: /June supplies/ })).toContainText("Statement checking");
  const final = await savedLedger(page);
  expect(final.importPresets).toHaveLength(1);
  expect(final.importPresets[0].mapping).toEqual({ date: 0, description: 1, amount: -1, debit: 2, credit: 3, dateFormat: "dmy", invertAmounts: false });
  expect(final.transactions).toHaveLength(3);
  expect(final.transactions.find((transaction: { desc: string }) => transaction.desc === "June supplies")).toMatchObject({ date: "2026-06-05", amount: -27.25, accountId });
});

test("account snapshots, debt editing and net worth stay correct after a transaction and reload", async ({ page }) => {
  await page.goto("/app.html");
  await addAccount(page, "Everyday checking", "checking", "1000");
  await addAccount(page, "Travel card", "credit", "400");
  await expect(page.getByRole("region", { name: "Assets", exact: true })).toContainText("$1,000.00");
  await expect(page.getByRole("region", { name: "Debts", exact: true })).toContainText("$400.00");
  await expect(page.getByRole("region", { name: "Net worth", exact: true })).toContainText("$600.00");
  await page.getByRole("button", { name: "Edit Travel card", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit account", exact: true });
  await expect(edit.getByLabel(/^Amount owed/)).toHaveValue("400");
  await edit.getByLabel("Account name", { exact: true }).fill("Rewards card");
  await edit.getByLabel(/^Amount owed/).fill("250");
  await edit.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Net worth", exact: true })).toContainText("$750.00");

  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  const transaction = page.getByRole("dialog", { name: "Add transaction", exact: true });
  await transaction.getByLabel("Description", { exact: true }).fill("Snapshot history expense");
  await transaction.getByLabel(/^Amount/).fill("-25");
  await transaction.getByRole("combobox", { name: "Account", exact: true }).selectOption({ label: "Everyday checking" });
  await transaction.getByRole("button", { name: "Save transaction", exact: true }).click();
  await openSection(page, "Accounts");
  await expect(page.getByRole("region", { name: "Cash available", exact: true })).toContainText("$1,000.00");
  await expect(page.getByRole("region", { name: "Net worth", exact: true })).toContainText("$750.00");
  const persisted = await savedLedger(page);
  expect(persisted.accounts.find((account: { name: string }) => account.name === "Rewards card")).toMatchObject({ type: "credit", balance: -250 });
  await page.reload();
  await openSection(page, "Accounts");
  await expect(page.getByRole("region", { name: "Debts", exact: true })).toContainText("$250.00");
  await expect(page.getByRole("region", { name: "Net worth", exact: true })).toContainText("$750.00");
  await expect(page.getByRole("button", { name: "Edit Rewards card", exact: true })).toBeVisible();
});

test("manual entries can remember a category, be edited, persist and be deleted", async ({ page }) => {
  await page.goto("/app.html?action=add");
  let dialog = page.getByRole("dialog", { name: "Add transaction", exact: true });
  await dialog.getByLabel("Date", { exact: true }).fill("2026-08-10");
  await dialog.getByLabel("Description", { exact: true }).fill("Northstar supplies");
  await dialog.getByLabel(/^Amount/).fill("-45.25");
  await dialog.getByRole("combobox", { name: "Category", exact: true }).selectOption("Shopping");
  await dialog.getByLabel("Remember this category for matching descriptions", { exact: true }).check();
  await dialog.getByRole("textbox", { name: /^Matching keyword/ }).fill("northstar");
  await dialog.getByRole("button", { name: "Save transaction", exact: true }).click();
  await expect(page.getByRole("row", { name: /Northstar supplies/ })).toContainText("Shopping");

  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Add transaction", exact: true });
  await dialog.getByLabel("Description", { exact: true }).fill("Northstar lens");
  await dialog.getByLabel(/^Amount/).fill("-90");
  await expect(dialog.getByRole("combobox", { name: "Category", exact: true }).locator("option:checked")).toHaveText("Automatic · Shopping");
  await dialog.getByRole("button", { name: "Save transaction", exact: true }).click();
  await page.getByRole("button", { name: "Edit Northstar lens", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit transaction", exact: true });
  await dialog.getByLabel("Description", { exact: true }).fill("Northstar camera");
  await dialog.getByLabel("Date", { exact: true }).fill("2026-08-11");
  await dialog.getByLabel(/^Amount/).fill("-80.5");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("row", { name: /Northstar camera/ })).toContainText("-$80.50");
  const persisted = await savedLedger(page);
  expect(persisted.rules).toContainEqual(["northstar", "Shopping"]);
  expect(persisted.transactions).toHaveLength(2);
  expect(persisted.transactions.find((transaction: { desc: string }) => transaction.desc === "Northstar camera")).toMatchObject({ date: "2026-08-11", amount: -80.5, category: "Shopping" });
  await page.reload();
  await openSection(page, "Transactions");
  await expect(page.getByRole("row", { name: /Northstar camera/ })).toContainText("Shopping");
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Delete Northstar supplies", exact: true }).click();
  await expect(page.getByRole("row", { name: /Northstar supplies/ })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /Northstar camera/ })).toBeVisible();
  expect((await savedLedger(page)).transactions).toHaveLength(1);
});

test("saved manual income drives the forecast without counting earmarked reserves twice", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-20T12:00:00Z"));
  await page.goto("/app.html");
  const dialog = await chooseCSV(page, "Date,Description,Amount\n2026-06-02,June client income,1000\n2026-06-03,June rent,-300\n2026-07-02,July client income,2000\n2026-07-03,July rent,-300\n2026-08-02,August client income,3000\n2026-08-03,August rent,-300\n");
  await dialog.getByRole("button", { name: "Import 6 transactions", exact: true }).click();
  await openSection(page, "Income plan");
  await page.getByRole("combobox", { name: "Planning method", exact: true }).selectOption("manual");
  await page.getByRole("combobox", { name: "History window", exact: true }).selectOption("3");
  await page.getByLabel(/^Desired monthly draw/).fill("2500");
  await page.getByLabel(/^Reserve already earmarked/).fill("5000");
  await page.getByRole("button", { name: "Save income plan", exact: true }).click();
  await expect(page.getByText("Income plan saved on this device.", { exact: true })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Observed average income" })).toContainText("$2,000.00");
  await expect(page.locator("article").filter({ hasText: "Planning income / month" })).toContainText("$2,500.00");
  expect((await savedLedger(page)).settings.incomePlan).toEqual({ mode: "manual", windowMonths: 3, monthlyTarget: 2500, reserveBalance: 5000 });

  await page.reload();
  await openSection(page, "Income plan");
  await expect(page.getByRole("combobox", { name: "Planning method", exact: true })).toHaveValue("manual");
  await expect(page.getByRole("combobox", { name: "History window", exact: true })).toHaveValue("3");
  await expect(page.getByLabel(/^Desired monthly draw/)).toHaveValue("2500");
  await expect(page.getByLabel(/^Reserve already earmarked/)).toHaveValue("5000");
  await openSection(page, "Forecast");
  await expect(page.locator("article").filter({ hasText: "Starting liquid balance" })).toContainText("$5,100.00");
  await expect(page.locator("article").filter({ hasText: "Scenario income / month" })).toContainText("$2,500.00");
  await expect(page.locator("article").filter({ hasText: "Scenario spending / month" })).toContainText("$300.00");
  await expect(page.locator("article").filter({ hasText: "Monthly cash change" })).toContainText("+$2,200.00");
  const forecast = page.getByRole("region", { name: "Twelve-month forecast details", exact: true });
  await expect(forecast.locator("tbody tr")).toHaveCount(12);
  await expect(forecast.locator("tbody tr").first()).toContainText("Oct 2026");
  await expect(forecast.locator("tbody tr").first()).toContainText("$7,300.00");
  await expect(forecast.locator("tbody tr").last()).toContainText("$31,500.00");
});
