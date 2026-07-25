/**
 * Plain ESM mirror of src/lib/finance for Node tests (test.cjs).
 * Keep in sync with the TypeScript modules.
 */

const DEFAULT_RULES = [
  ["salary", "Income"], ["payroll", "Income"], ["deposit", "Income"], ["refund", "Income"], ["interest", "Income"],
  ["rent", "Housing"], ["mortgage", "Housing"], ["landlord", "Housing"],
  ["whole foods", "Groceries"], ["trader joe", "Groceries"], ["safeway", "Groceries"], ["grocery", "Groceries"], ["aldi", "Groceries"], ["kroger", "Groceries"], ["market", "Groceries"],
  ["starbucks", "Dining"], ["mcdonald", "Dining"], ["restaurant", "Dining"], ["cafe", "Dining"], ["coffee", "Dining"], ["pizza", "Dining"], ["chipotle", "Dining"], ["doordash", "Dining"], ["uber eats", "Dining"],
  ["uber", "Transport"], ["lyft", "Transport"], ["shell", "Transport"], ["chevron", "Transport"], ["gas", "Transport"], ["transit", "Transport"], ["parking", "Transport"], ["metro", "Transport"],
  ["electric", "Utilities"], ["water", "Utilities"], ["comcast", "Utilities"], ["at&t", "Utilities"], ["verizon", "Utilities"], ["internet", "Utilities"], ["utility", "Utilities"],
  ["netflix", "Subscriptions"], ["spotify", "Subscriptions"], ["hulu", "Subscriptions"], ["disney", "Subscriptions"], ["youtube premium", "Subscriptions"], ["icloud", "Subscriptions"], ["adobe", "Subscriptions"], ["prime", "Subscriptions"], ["gym", "Subscriptions"], ["patreon", "Subscriptions"],
  ["amazon", "Shopping"], ["target", "Shopping"], ["walmart", "Shopping"], ["etsy", "Shopping"], ["best buy", "Shopping"], ["ikea", "Shopping"],
  ["pharmacy", "Health"], ["cvs", "Health"], ["walgreens", "Health"], ["doctor", "Health"], ["dental", "Health"], ["clinic", "Health"],
  ["cinema", "Entertainment"], ["movie", "Entertainment"], ["steam", "Entertainment"], ["playstation", "Entertainment"], ["concert", "Entertainment"], ["ticket", "Entertainment"],
  ["transfer", "Transfers"], ["venmo", "Transfers"], ["zelle", "Transfers"], ["paypal", "Transfers"],
  ["fee", "Fees"], ["atm", "Fees"], ["overdraft", "Fees"],
];

export function norm(desc) {
  return desc
    .toLowerCase()
    .replace(/[0-9]/g, " ")
    .replace(/[^a-z& ]/g, " ")
    .replace(/\b(pos|purchase|debit|card|payment|recurring|ach|xxx|ref|id|no)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function categorize(desc, rules = DEFAULT_RULES) {
  const d = desc.toLowerCase();
  for (const [kw, cat] of rules) {
    if (d.includes(kw)) return cat;
  }
  return "Uncategorized";
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

export function parseNum(v) {
  if (v == null) return NaN;
  v = String(v).trim();
  const parenNeg = /^\(.*\)$/.test(v);
  v = v.replace(/[^0-9.,\-]/g, "");
  const ld = v.lastIndexOf(".");
  const lc = v.lastIndexOf(",");
  if (ld > -1 && lc > -1) {
    if (ld > lc) v = v.replace(/,/g, "");
    else v = v.replace(/\./g, "").replace(",", ".");
  } else if (lc > -1) {
    const parts = v.split(",");
    if (parts.length > 2) v = v.replace(/,/g, "");
    else v = parts[1].length === 3 ? v.replace(/,/g, "") : v.replace(",", ".");
  }
  const n = parseFloat(v);
  return isNaN(n) ? NaN : parenNeg ? -Math.abs(n) : n;
}

const p2 = (n) => String(n).padStart(2, "0");
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function parseDate(s) {
  s = s.trim();
  if (!s) return null;
  let m;
  const pivot = (y) => {
    y = +y;
    if (y < 100) {
      const nextYY = (new Date().getFullYear() + 1) % 100;
      y = y <= nextYY ? 2000 + y : 1900 + y;
    }
    return y;
  };
  const valid = (y, mo, d) => y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    const [, y, a, b] = m;
    if (valid(+y, +a, +b)) return `${y}-${p2(a)}-${p2(b)}`;
    return null;
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let [, a, b, y] = m;
    y = String(pivot(y));
    a = +a;
    b = +b;
    if (a > 12 && b <= 12) [a, b] = [b, a];
    if (valid(+y, a, b)) return `${y}-${p2(a)}-${p2(b)}`;
    return null;
  }
  const d = new Date(s);
  return isNaN(d) ? null : isoLocal(d);
}

export function detectRecurring(transactions, sign) {
  const groups = {};
  for (const t of transactions) {
    if (Math.sign(t.amount) !== sign) continue;
    const k = norm(t.desc);
    if (k.length < 3) continue;
    (groups[k] ||= []).push(t);
  }
  const out = [];
  for (const k in groups) {
    const g = groups[k].slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (g.length < 2) continue;
    const gaps = [];
    for (let i = 1; i < g.length; i++) {
      gaps.push((new Date(g[i].date) - new Date(g[i - 1].date)) / 86400000);
    }
    const med = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    let cadence = null;
    let perMonth = 1;
    if (med >= 6 && med <= 8) {
      cadence = "weekly";
      perMonth = 4.33;
    } else if (med >= 13 && med <= 16) {
      cadence = "biweekly";
      perMonth = 2.17;
    } else if (med >= 26 && med <= 35) {
      cadence = "monthly";
      perMonth = 1;
    } else if (med >= 85 && med <= 95) {
      cadence = "quarterly";
      perMonth = 1 / 3;
    } else if (med >= 350 && med <= 380) {
      cadence = "yearly";
      perMonth = 1 / 12;
    }
    if (!cadence) continue;
    const amts = g.map((t) => Math.abs(t.amount));
    const avg = amts.reduce((a, b) => a + b, 0) / amts.length;
    const spread = (Math.max(...amts) - Math.min(...amts)) / (avg || 1);
    if (spread > 0.35) continue;
    out.push({
      key: k,
      name: g[g.length - 1].desc,
      category: g[g.length - 1].category,
      cadence,
      amount: avg,
      monthly: avg * perMonth,
      count: g.length,
      last: g[g.length - 1].date,
    });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

const _enc = new TextEncoder();
const _dec = new TextDecoder();

function _b64(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function _unb64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey("raw", _enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptWith(key, salt, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, _enc.encode(JSON.stringify(obj)));
  return JSON.stringify({ v: 1, enc: true, salt: _b64(salt), iv: _b64(iv), ct: _b64(ct) });
}

export async function decryptWith(key, envelope) {
  const iv = _unb64(envelope.iv);
  const ct = _unb64(envelope.ct);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(_dec.decode(pt));
}

export { DEFAULT_RULES, _b64, _unb64 };
