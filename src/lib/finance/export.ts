import type { FinanceState } from "./types";

function csvCell(value: string | number): string {
  // Spreadsheet formulas must remain text when a bank description is exported.
  let text = String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportCSV(state: FinanceState): string {
  const names = new Map(state.accounts.map((account) => [account.id, account.name]));
  const rows: (string | number)[][] = [["Date", "Description", "Amount", "Category", "Account"]];
  for (const tx of state.transactions) {
    rows.push([tx.date, tx.desc, tx.amount, tx.category, names.get(tx.accountId || "default") || "Main account"]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadFile(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
