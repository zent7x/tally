/* Tally test suite — runs the pure finance engine (and the real crypto)
   headless, and statically enforces the core promise: the offline app makes
   ZERO network calls. Run with: node test.cjs   (no dependencies) */
"use strict";
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  console.log((okk ? "✓" : "✗") + " " + name + (okk ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
  okk ? pass++ : fail++;
};
const ok = (name, cond) => { console.log((cond ? "✓" : "✗") + " " + name); cond ? pass++ : fail++; };

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => ent.name.endsWith(e))) out.push(p);
  }
  return out;
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

/** Strip string literals and comments so prose like "no analytics" does not trip checks. */
function stripLiterals(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``");
}

function collectOfflineSources(root) {
  const files = [
    path.join(root, "lib", "finance-core.mjs"),
    ...walk(path.join(root, "src", "lib", "finance"), [".ts"]),
    ...walk(path.join(root, "src", "app"), [".ts", ".tsx"]),
  ].filter((p) => fs.existsSync(p));
  return files.map((p) => fs.readFileSync(p, "utf8")).join("\n");
}

(async function main() {
  const root = __dirname;

  /* ---- 1. static privacy guarantee: the app must never touch the network ---- */
  const html = [
    readIfExists(path.join(root, "app.html")),
    readIfExists(path.join(root, "index.html")),
  ].join("\n");
  const source = stripLiterals(collectOfflineSources(root));

  ok("no external resource links", !/(src\s*=\s*["']https?:|<link[^>]+href\s*=\s*["']https?:)/i.test(html));
  ok("no fetch() calls", !/\bfetch\s*\(/.test(source));
  ok("no XMLHttpRequest", !/XMLHttpRequest/.test(source));
  ok("no WebSocket", !/WebSocket/.test(source));
  ok("no network import()", !/import\s*\(\s*["']https?:/.test(source) && !/\bfrom\s+["']https?:/.test(source));
  ok("no beacon/analytics", !/sendBeacon|googletagmanager|google-analytics|gtag\s*\(|mixpanel|segment\./i.test(source));

  /* ---- 2. load the pure logic from the extracted finance core ---- */
  const {
    parseCSV,
    parseDate,
    parseNum,
    categorize,
    detectRecurring,
    deriveKey,
    encryptWith,
    decryptWith,
  } = await import("./lib/finance-core.mjs");

  /* ---- 3. CSV parsing ---- */
  const rows = parseCSV(`Date,Description,Amount\n2024-03-05,"WHOLE FOODS, SF",-52.10\n2024-03-06,Netflix,-15.49`);
  eq("csv rowcount", rows.length, 3);
  eq("csv quoted comma", rows[1][1], "WHOLE FOODS, SF");
  eq("csv amount cell", rows[1][2], "-52.10");

  /* ---- 4. date parsing (iso / US / short year) ---- */
  eq("date iso", parseDate("2024-03-05"), "2024-03-05");
  eq("date us", parseDate("03/05/2024"), "2024-03-05");
  eq("date short-yr", parseDate("3/5/24"), "2024-03-05");
  eq("date empty", parseDate("   "), null);

  /* ---- 5. amount parsing (currency symbols, thousands, accounting negatives) ---- */
  eq("num currency", parseNum("$1,234.56"), 1234.56);
  eq("num parens-neg", parseNum("(45.00)"), -45);
  eq("num signed", parseNum("-12.30"), -12.3);

  /* ---- 6. auto-categorization ---- */
  eq("cat netflix", categorize("NETFLIX.COM"), "Subscriptions");
  eq("cat groceries", categorize("Whole Foods Market #123"), "Groceries");
  eq("cat income", categorize("ACME PAYROLL DEPOSIT"), "Income");
  eq("cat unknown", categorize("Zorblax Widgets"), "Uncategorized");

  /* ---- 7. recurring / subscription detection ---- */
  const rec = detectRecurring([
    { id: "a", date: "2024-01-04", desc: "Netflix", amount: -15.49, category: "Subscriptions" },
    { id: "b", date: "2024-02-04", desc: "Netflix", amount: -15.49, category: "Subscriptions" },
    { id: "c", date: "2024-03-04", desc: "Netflix", amount: -15.49, category: "Subscriptions" },
    { id: "d", date: "2024-01-15", desc: "Random Store 9981", amount: -8.20, category: "Shopping" },
  ], -1);
  eq("recurring count", rec.length, 1);
  eq("recurring cadence", rec[0] && rec[0].cadence, "monthly");
  eq("recurring monthly amount", rec[0] && Math.round(rec[0].monthly * 100) / 100, 15.49);

  const inc = detectRecurring([
    { id: "a", date: "2024-01-01", desc: "Payroll Acme", amount: 4200, category: "Income" },
    { id: "b", date: "2024-02-01", desc: "Payroll Acme", amount: 4200, category: "Income" },
    { id: "c", date: "2024-03-01", desc: "Payroll Acme", amount: 4200, category: "Income" },
  ], 1);
  eq("income recurring count", inc.length, 1);
  eq("income monthly", inc[0] && inc[0].monthly, 4200);

  /* ---- 8. encryption: real AES-256-GCM round-trip, wrong passphrase rejected ---- */
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey("correct horse battery", salt);
  const secret = { transactions: [{ id: "x", desc: "Rent - Oakwood", amount: -1650 }], settings: { currency: "USD" } };
  const envStr = await encryptWith(key, salt, secret);
  const env = JSON.parse(envStr);
  ok("envelope is marked encrypted", env.enc === true && !!env.ct && !!env.iv);
  ok("plaintext absent from ciphertext", !envStr.includes("Oakwood") && !envStr.includes("Rent"));
  const back = await decryptWith(key, env);
  eq("decrypt round-trip", back.transactions[0].amount, -1650);
  let rejected = false;
  try { await decryptWith(await deriveKey("wrong passphrase", salt), env); }
  catch (e) { rejected = true; }
  ok("wrong passphrase rejected", rejected);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
