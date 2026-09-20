import { categorize } from "./categories";
import type { FinanceState, ImportMapping, ImportPreset, Transaction } from "./types";
import { uid } from "./types";

type DateFormat = ImportMapping["dateFormat"];

function delimiterFor(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (c === "\n") break;
      if (c in counts) counts[c]!++;
    }
  }
  return Object.keys(counts).sort((a, b) => counts[b]! - counts[a]!)[0]!;
}

/** Read common bank CSV, semicolon and tab-separated exports without losing quoted cells. */
export function parseCSV(text: string): string[][] {
  let normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  // Excel sometimes writes an explicit separator before the header row.
  const separator = normalized.match(/^sep=([,;\t])\n/i);
  if (separator) normalized = normalized.slice(separator[0].length);
  normalized = normalized.replace(/^(?:[ \t]*\n)+/, "");
  const delimiter = separator?.[1] ?? delimiterFor(normalized);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  const finishCell = () => {
    row.push(cell);
    cell = "";
    closedQuote = false;
  };
  const finishRow = () => {
    finishCell();
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]!;
    if (quoted) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else cell += c;
    } else if (c === delimiter) finishCell();
    else if (c === "\n") finishRow();
    else if (closedQuote) {
      if (!/[ \t]/.test(c)) throw new Error("Unexpected text after a quoted CSV field.");
    } else if (c === '"') {
      if (cell.trim() !== "") throw new Error("Unexpected quote in an unquoted CSV field.");
      cell = "";
      quoted = true;
    } else cell += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (cell !== "" || row.length || closedQuote) finishRow();
  return rows;
}

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findColumn(header: string[], names: string[]): number {
  for (const name of names) {
    const matches = header.flatMap((value, index) => value === name ? [index] : []);
    if (matches.length) return matches.length === 1 ? matches[0]! : -1;
  }
  for (const name of names) {
    const matches = header.flatMap((value, index) => value.split(/[^a-z0-9]+/).includes(name) ? [index] : []);
    if (matches.length) return matches.length === 1 ? matches[0]! : -1;
  }
  return -1;
}

/** Parse a complete amount; never silently accept a numeric prefix of malformed data. */
export function parseAmount(raw: string): number | null {
  let value = raw.trim();
  if (!value) return null;
  let negative = false;
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1).trim();
  }
  if (/[()]/.test(value)) return null;
  const currency = /^(?:[$€£₹¥₩₽]|USD|EUR|GBP|INR|JPY|CAD|AUD|NZD|CHF|CNY)\s*|\s*(?:[$€£₹¥₩₽]|USD|EUR|GBP|INR|JPY|CAD|AUD|NZD|CHF|CNY)$/gi;
  // A sign may precede or follow the currency symbol, but there can only be one.
  let sign = "";
  if (/^[+-]/.test(value)) {
    sign = value[0]!;
    value = value.slice(1).trim();
  }
  value = value.replace(currency, "").trim();
  if (/^[+-]/.test(value)) {
    if (sign) return null;
    sign = value[0]!;
    value = value.slice(1).trim();
  }
  if (negative && sign) return null;
  if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3}|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:\.\d+)?|\.\d+)$/.test(value)) return null;
  const amount = Number(value.replace(/[, \u00a0\u202f]/g, ""));
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER) return null;
  return negative || sign === "-" ? -amount : amount;
}

function calendarDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]!) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Ambiguous automatic dates use month/day/year; choose dmy for day-first bank exports. */
export function parseDate(raw: string, format: DateFormat = "auto"): string | null {
  const value = raw.trim();
  const yearFirst = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yearFirst) return calendarDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  if (format === "ymd") return null;
  const numeric = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]) + (numeric[3]!.length === 2 ? 2000 : 0);
    const dayFirst = format === "dmy" || (format === "auto" && first > 12);
    return calendarDate(year, dayFirst ? second : first, dayFirst ? first : second);
  }
  // Month names are unambiguous and avoid the rollover behavior of Date.parse.
  const named = value.match(/^(?:(\d{1,2})[ -]([a-z]+)|([a-z]+) (\d{1,2}),?)[ -](\d{4})$/i);
  if (!named) return null;
  const names = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthName = (named[2] ?? named[3])!.toLowerCase();
  const month = names.findIndex((name) => name === monthName || name.slice(0, 3) === monthName) + 1;
  return calendarDate(Number(named[5]), month, Number(named[1] ?? named[4]));
}

export function inspectCSV(text: string): { headers: string[]; rows: string[][]; mapping: ImportMapping } {
  const parsed = parseCSV(text);
  const headers = (parsed[0] ?? []).map((header) => header.trim());
  const normalized = headers.map(normalizeHeader);
  const date = findColumn(normalized, ["date", "transaction date", "posted date", "posting date", "value date", "posted", "time"]);
  const debit = findColumn(normalized, ["debit", "debit amount", "withdrawal", "withdrawals", "money out", "paid out"]);
  const credit = findColumn(normalized, ["credit", "credit amount", "deposit", "deposits", "money in", "paid in"]);
  const amountHeaders = normalized.map((header, index) => index === debit || index === credit || index === date || header.includes("balance") ? "" : header);
  return {
    headers,
    rows: parsed.slice(1),
    mapping: {
      date,
      description: findColumn(normalized, ["description", "transaction description", "name", "payee", "merchant", "memo", "details", "narration", "particulars"]),
      amount: findColumn(amountHeaders, ["amount", "transaction amount", "net amount", "value"]),
      debit,
      credit,
      dateFormat: "auto",
      invertAmounts: false,
    },
  };
}

function mappingError(mapping: ImportMapping, width: number): string | null {
  const valid = (index: number) => Number.isInteger(index) && index >= 0 && index < width;
  if (!valid(mapping.date) || !valid(mapping.description)) return "Choose valid date and description columns.";
  if (!valid(mapping.amount) && !valid(mapping.debit) && !valid(mapping.credit)) return "Choose an amount column or debit/credit columns.";
  const selected = [mapping.date, mapping.description, ...(mapping.amount >= 0 ? [mapping.amount] : [mapping.debit, mapping.credit].filter((index) => index >= 0))];
  if (selected.some((index) => !valid(index))) return "The selected columns do not exist in this file.";
  if (new Set(selected).size !== selected.length) return "Choose a different column for each mapped field.";
  if (!["auto", "mdy", "dmy", "ymd"].includes(mapping.dateFormat)) return "Choose a valid date format.";
  return null;
}

export function previewCSV(
  text: string,
  rules: FinanceState["rules"],
  mapping: ImportMapping,
  accountId?: string,
): { transactions: Transaction[]; skipped: number; errors: string[] } {
  let inspected: ReturnType<typeof inspectCSV>;
  try { inspected = inspectCSV(text); }
  catch (error) { return { transactions: [], skipped: 0, errors: [error instanceof Error ? error.message : "Unable to read this CSV file."] }; }
  const { headers, rows } = inspected;
  const invalid = mappingError(mapping, headers.length);
  if (invalid) return { transactions: [], skipped: rows.length, errors: [invalid] };
  const transactions: Transaction[] = [];
  const errors: string[] = [];
  let skipped = 0;
  for (const [index, row] of rows.entries()) {
    const date = parseDate(row[mapping.date] ?? "", mapping.dateFormat);
    const desc = (row[mapping.description] ?? "").trim();
    let amount: number | null;
    if (mapping.amount >= 0) amount = parseAmount(row[mapping.amount] ?? "");
    else {
      const debitRaw = mapping.debit >= 0 ? (row[mapping.debit] ?? "").trim() : "";
      const creditRaw = mapping.credit >= 0 ? (row[mapping.credit] ?? "").trim() : "";
      const debit = debitRaw ? parseAmount(debitRaw) : 0;
      const credit = creditRaw ? parseAmount(creditRaw) : 0;
      // Both nonzero is ambiguous: do not manufacture a net transaction.
      amount = (!debitRaw && !creditRaw) || debit === null || credit === null || (debit !== 0 && credit !== 0)
        ? null : Math.abs(credit) - Math.abs(debit);
    }
    const reason = row.length !== headers.length ? "column count does not match the header" : !date ? "invalid date" : !desc ? "missing description" : amount === null ? "invalid or ambiguous amount" : null;
    if (reason) {
      skipped++;
      if (errors.length < 20) errors.push(`Row ${index + 2}: ${reason}.`);
      continue;
    }
    transactions.push({ id: uid(), date: date!, desc, amount: mapping.invertAmounts ? -amount! : amount!, category: categorize(desc, rules), ...(accountId ? { accountId } : {}) });
  }
  if (skipped > errors.length) errors.push(`${skipped - errors.length} additional rows could not be imported.`);
  return { transactions, skipped, errors };
}

export function importCSV(text: string, rules: FinanceState["rules"], mapping?: ImportMapping, accountId?: string): Transaction[] {
  try {
    const selected = mapping ?? inspectCSV(text).mapping;
    return previewCSV(text, rules, selected, accountId).transactions;
  } catch { return []; }
}

/** Layout compatibility does not imply that two banks use the same signs or date order. */
export function matchingPresets(headers: string[], presets: ImportPreset[]): ImportPreset[] {
  if (!headers.length) return [];
  const normalized = headers.map(normalizeHeader);
  return presets.filter((preset) => preset.headers.length === headers.length
    && preset.headers.every((header, index) => normalizeHeader(header) === normalized[index])
    && mappingError(preset.mapping, headers.length) === null);
}

/** Only a unique compatible preset can be applied without choosing the bank. */
export function matchingPreset(headers: string[], presets: ImportPreset[]): ImportPreset | undefined {
  const matches = matchingPresets(headers, presets);
  return matches.length === 1 ? matches[0] : undefined;
}
