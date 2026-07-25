import { categorize } from "./categories";
import type { FinanceState, Transaction } from "./types";
import { uid } from "./types";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]!;
    if (q) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') {
      q = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function findColumn(header: string[], ...names: string[]): number {
  for (const name of names) {
    const i = header.findIndex((h) => h.includes(name));
    if (i >= 0) return i;
  }
  return -1;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").replace(/[()]/g, "");
  if (!cleaned) return null;
  const neg = cleaned.startsWith("-") || (raw.includes("(") && raw.includes(")"));
  const n = parseFloat(cleaned.replace(/^-/, ""));
  if (!isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

function parseDate(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${year}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

export function importCSV(text: string, rules: FinanceState["rules"]): Transaction[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const di = findColumn(header, "date", "posted", "time");
  const desci = findColumn(header, "description", "name", "payee", "merchant", "memo", "details", "narration");
  const amti = findColumn(header, "amount", "debit", "credit", "value");

  if (di < 0 || desci < 0 || amti < 0) {
    // TODO: smarter column detection / mapping UI
    return [];
  }

  const parsed: Transaction[] = [];
  for (const row of rows.slice(1)) {
    const date = parseDate(row[di] ?? "");
    const desc = (row[desci] ?? "").trim();
    const amount = parseAmount(row[amti] ?? "");
    if (!date || !desc || amount === null) continue;
    parsed.push({ id: uid(), date, desc, amount, category: categorize(desc, rules) });
  }
  return parsed;
}
