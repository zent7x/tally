/* Tally test suite — runs the pure finance engine (and the real crypto)
   headless, and statically enforces the core promise: index.html makes
   ZERO network calls. Run with: node test.js   (no dependencies) */
"use strict";
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  console.log((okk ? "✓" : "✗") + " " + name + (okk ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
  okk ? pass++ : fail++;
};
const ok = (name, cond) => { console.log((cond ? "✓" : "✗") + " " + name); cond ? pass++ : fail++; };

(async function main(){
  /* ---- 1. static privacy guarantee: the app must never touch the network ---- */
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  ok("no external resource links", !/(src|href)\s*=\s*["']https?:/i.test(html));
  ok("no fetch() calls",           !/\bfetch\s*\(/.test(script));
  ok("no XMLHttpRequest",          !/XMLHttpRequest/.test(script));
  ok("no WebSocket",               !/WebSocket/.test(script));
  ok("no network import()",        !/import\s*\(\s*["']https?:/.test(script));
  ok("no beacon/analytics",        !/sendBeacon|googletagmanager|analytics/i.test(script));

  /* ---- 2. load the pure logic (everything before the DOM wiring section) ---- */
  const core = script.slice(0, script.indexOf("/* ---------- wiring ---------- */"));
  const doc = { createElement: () => ({ append(){}, setAttribute(){}, addEventListener(){}, classList:{add(){},remove(){}}, style:{} }),
    querySelector: () => ({ append(){}, addEventListener(){}, replaceChildren(){}, classList:{add(){},remove(){}} }),
    querySelectorAll: () => [], addEventListener(){}, documentElement:{setAttribute(){},removeAttribute(){}}, body:{append(){}} };
  const api = new Function("document", "localStorage", "matchMedia",
    core + "\n; return {parseCSV,parseDate,parseNum,categorize,detectRecurring,deriveKey,encryptWith,decryptWith,setTx:(a)=>{S.transactions=a;}};"
  )(doc, { getItem: () => null, setItem: () => {} }, () => ({ matches: false }));

  /* ---- 3. CSV parsing ---- */
  const rows = api.parseCSV(`Date,Description,Amount\n2024-03-05,"WHOLE FOODS, SF",-52.10\n2024-03-06,Netflix,-15.49`);
  eq("csv rowcount", rows.length, 3);
  eq("csv quoted comma", rows[1][1], "WHOLE FOODS, SF");
  eq("csv amount cell", rows[1][2], "-52.10");

  /* ---- 4. date parsing (iso / US / short year) ---- */
  eq("date iso",      api.parseDate("2024-03-05"), "2024-03-05");
  eq("date us",       api.parseDate("03/05/2024"), "2024-03-05");
  eq("date short-yr", api.parseDate("3/5/24"),     "2024-03-05");
  eq("date empty",    api.parseDate("   "),        null);

  /* ---- 5. amount parsing (currency symbols, thousands, accounting negatives) ---- */
  eq("num currency",   api.parseNum("$1,234.56"), 1234.56);
  eq("num parens-neg", api.parseNum("(45.00)"),   -45);
  eq("num signed",     api.parseNum("-12.30"),    -12.3);

  /* ---- 6. auto-categorization ---- */
  eq("cat netflix",   api.categorize("NETFLIX.COM"),            "Subscriptions");
  eq("cat groceries", api.categorize("Whole Foods Market #123"), "Groceries");
  eq("cat income",    api.categorize("ACME PAYROLL DEPOSIT"),    "Income");
  eq("cat unknown",   api.categorize("Zorblax Widgets"),         "Uncategorized");

  /* ---- 7. recurring / subscription detection ---- */
  api.setTx([
    { id:"a", date:"2024-01-04", desc:"Netflix", amount:-15.49, category:"Subscriptions" },
    { id:"b", date:"2024-02-04", desc:"Netflix", amount:-15.49, category:"Subscriptions" },
    { id:"c", date:"2024-03-04", desc:"Netflix", amount:-15.49, category:"Subscriptions" },
    { id:"d", date:"2024-01-15", desc:"Random Store 9981", amount:-8.20, category:"Shopping" },
  ]);
  const rec = api.detectRecurring(-1);
  eq("recurring count", rec.length, 1);
  eq("recurring cadence", rec[0] && rec[0].cadence, "monthly");
  eq("recurring monthly amount", rec[0] && Math.round(rec[0].monthly * 100) / 100, 15.49);

  api.setTx([
    { id:"a", date:"2024-01-01", desc:"Payroll Acme", amount:4200, category:"Income" },
    { id:"b", date:"2024-02-01", desc:"Payroll Acme", amount:4200, category:"Income" },
    { id:"c", date:"2024-03-01", desc:"Payroll Acme", amount:4200, category:"Income" },
  ]);
  const inc = api.detectRecurring(1);
  eq("income recurring count", inc.length, 1);
  eq("income monthly", inc[0] && inc[0].monthly, 4200);

  /* ---- 8. encryption: real AES-256-GCM round-trip, wrong passphrase rejected ---- */
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await api.deriveKey("correct horse battery", salt);
  const secret = { transactions: [{ id:"x", desc:"Rent - Oakwood", amount:-1650 }], settings:{ currency:"USD" } };
  const envStr = await api.encryptWith(key, salt, secret);
  const env = JSON.parse(envStr);
  ok("envelope is marked encrypted", env.enc === true && !!env.ct && !!env.iv);
  ok("plaintext absent from ciphertext", !envStr.includes("Oakwood") && !envStr.includes("Rent"));
  const back = await api.decryptWith(key, env);
  eq("decrypt round-trip", back.transactions[0].amount, -1650);
  let rejected = false;
  try { await api.decryptWith(await api.deriveKey("wrong passphrase", salt), env); }
  catch (e) { rejected = true; }
  ok("wrong passphrase rejected", rejected);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
