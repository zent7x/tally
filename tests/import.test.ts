import test from "node:test";
import assert from "node:assert/strict";
import { importCSV, inspectCSV, matchingPreset, matchingPresets, parseAmount, parseCSV, parseDate, previewCSV } from "../src/lib/finance/csv.ts";
import type { ImportPreset } from "../src/lib/finance/types.ts";

const basic = "Date,Description,Amount\n2024-02-29,Paycheck,2500\n2024-03-01,Coffee,-4.50";

test("CSV handles BOM, CRLF, escaped quotes, delimiters and quoted newlines", () => {
  assert.deepEqual(parseCSV('\uFEFFDate;Description;Amount\r\n2024-02-29;"A; \"\"quoted\"\"\nshop";-12.50'), [
    ["Date", "Description", "Amount"], ["2024-02-29", 'A; "quoted"\nshop', "-12.50"],
  ]);
  assert.deepEqual(parseCSV("sep=;\nDate;Amount\n2024-01-01;12"), [["Date", "Amount"], ["2024-01-01", "12"]]);
  assert.equal(parseCSV("Date\tDescription\tAmount\n2024-01-01\tCoffee\t-5")[1]?.[2], "-5");
  assert.throws(() => parseCSV('Date,Description\n2024-01-01,"unclosed'));
  assert.throws(() => parseCSV('Date,Description\n2024-01-01,"closed"junk'));
});

test("calendar dates are validated without timezone or rollover surprises", () => {
  assert.equal(parseDate("2024-02-29"), "2024-02-29");
  assert.equal(parseDate("29/02/2024", "dmy"), "2024-02-29");
  assert.equal(parseDate("03/04/24", "dmy"), "2024-04-03");
  assert.equal(parseDate("03/04/24"), "2024-03-04");
  assert.equal(parseDate("13/04/2024"), "2024-04-13");
  assert.equal(parseDate("5 March 2024"), "2024-03-05");
  for (const date of ["2023-02-29", "2024-04-31", "2024-13-01", "0/1/2024", "2024-00-10", "2024-01-00", "not a date"]) assert.equal(parseDate(date), null, date);
  assert.equal(parseDate("03/04/2024", "ymd"), null);
});

test("amounts accept complete formatted numbers and reject malformed values", () => {
  assert.equal(parseAmount("$1,234.56"), 1234.56);
  assert.equal(parseAmount("₹1,23,456.78"), 123456.78);
  assert.equal(parseAmount("(45.00)"), -45);
  assert.equal(parseAmount("-$12.30"), -12.3);
  assert.equal(parseAmount("$-12.30"), -12.3);
  assert.equal(parseAmount("1 234.56 EUR"), 1234.56);
  for (const amount of ["", "12oops", "1,2", "1 2", "1.2.3", "--10", "(12", "(-12)", "Infinity", "1e9"]) assert.equal(parseAmount(amount), null, amount);
});

test("default mapping stays backwards compatible and preserves account assignment", () => {
  const imported = importCSV(basic, [["paycheck", "Income"]], undefined, "checking");
  assert.equal(imported.length, 2);
  assert.equal(imported[0]?.category, "Income");
  assert.equal(imported[0]?.accountId, "checking");
  assert.equal(imported[1]?.amount, -4.5);
});

test("split debit and credit columns preserve cashflow signs", () => {
  const csv = "Posted Date,Details,Debit Amount,Credit Amount\n01/03/2024,Rent,1200,\n02/03/2024,Paycheck,,2000\n03/03/2024,Zero,0,\n04/03/2024,Both,100,50\n05/03/2024,Neither,,";
  const inspected = inspectCSV(csv);
  assert.equal(inspected.mapping.amount, -1);
  const mapping = { ...inspected.mapping, dateFormat: "dmy" as const };
  const preview = previewCSV(csv, [], mapping);
  assert.deepEqual(preview.transactions.map((transaction) => transaction.amount), [-1200, 2000, 0]);
  assert.equal(preview.transactions[0]?.date, "2024-03-01");
  assert.equal(preview.skipped, 2);
  assert.equal(preview.errors.length, 2);
});

test("custom mapping, sign inversion and malformed row reporting", () => {
  const csv = "Text,Value,When\nCoffee,4.5,01/03/2024\nBad date,20,2024-02-30\nBad amount,12oops,2024-01-02\nMissing cell,2\nExtra,3,2024-01-01,unexpected";
  const mapping = { date: 2, description: 0, amount: 1, debit: -1, credit: -1, dateFormat: "dmy" as const, invertAmounts: true };
  const preview = previewCSV(csv, [], mapping);
  assert.equal(preview.transactions.length, 1);
  assert.equal(preview.transactions[0]?.amount, -4.5);
  assert.equal(preview.skipped, 4);
  assert.match(preview.errors[0]!, /Row 3: invalid date/);
  assert.equal(previewCSV(csv, [], { ...mapping, description: 2 }).transactions.length, 0);
  assert.equal(previewCSV('Date,Description,Amount\n2024-01-01,"Oops,2', [], inspectCSV(basic).mapping).errors.length, 1);
});

test("saved presets require the same complete ordered layout", () => {
  const { headers, mapping } = inspectCSV(basic);
  const preset: ImportPreset = { id: "bank", name: "My bank", headers, mapping };
  assert.equal(matchingPreset([" date ", "DESCRIPTION", "Amount"], [preset]), preset);
  assert.equal(matchingPreset(["Description", "Date", "Amount"], [preset]), undefined);
  assert.equal(matchingPreset(["Date", "Description", "Amount", "Balance"], [preset]), undefined);
  assert.equal(matchingPreset(headers, [{ ...preset, mapping: { ...mapping, amount: 9 } }]), undefined);
});

test("banks with identical headers require an explicit preset choice", () => {
  const csv = "Date,Description,Amount\n03/04/2024,Coffee,4.50";
  const { headers, mapping } = inspectCSV(csv);
  const first: ImportPreset = { id: "first", name: "First bank", headers, mapping };
  const second: ImportPreset = { id: "second", name: "Second bank", headers, mapping: { ...mapping, dateFormat: "dmy", invertAmounts: true } };
  assert.deepEqual(matchingPresets(headers, [first, second]), [first, second]);
  assert.equal(matchingPreset(headers, [first, second]), undefined);
  assert.equal(matchingPreset(headers, [second, first]), undefined);
  const selected = previewCSV(csv, [], second.mapping, "checking").transactions;
  assert.equal(selected[0]?.date, "2024-04-03");
  assert.equal(selected[0]?.amount, -4.5);
  assert.deepEqual(importCSV(csv, [], second.mapping, "checking").map(({ id: _id, ...transaction }) => transaction), selected.map(({ id: _id, ...transaction }) => transaction));
});

test("ambiguous amount headers require explicit column mapping", () => {
  for (const columns of ["Amount,Amount", "Fee Amount,Tax Amount"]) {
    const csv = `Date,Description,${columns}\n2024-03-01,Coffee,5,2`;
    const { mapping } = inspectCSV(csv);
    assert.equal(mapping.amount, -1);
    assert.equal(importCSV(csv, []).length, 0);
    assert.equal(previewCSV(csv, [], { ...mapping, amount: 3 }).transactions[0]?.amount, 2);
  }
  assert.equal(inspectCSV("Date,Date,Description,Amount\n2024-03-01,2024-03-02,Coffee,-5").mapping.date, -1);
});

test("invalid mappings cannot match saved presets or produce importable rows", () => {
  const { headers, mapping } = inspectCSV(basic);
  for (const invalid of [
    { ...mapping, description: mapping.date },
    { ...mapping, amount: -1, debit: 2, credit: 2 },
    { ...mapping, date: 99 },
  ]) {
    assert.deepEqual(matchingPresets(headers, [{ id: "bad", name: "Invalid bank", headers, mapping: invalid }]), []);
    assert.equal(previewCSV(basic, [], invalid).transactions.length, 0);
  }
});

test("legitimate repeated transactions remain separate imported rows", () => {
  const csv = "Date,Description,Amount\n2024-03-01,Coffee,-5\n2024-03-01,Coffee,-5";
  const transactions = importCSV(csv, []);
  assert.equal(transactions.length, 2);
  assert.notEqual(transactions[0]?.id, transactions[1]?.id);
});
