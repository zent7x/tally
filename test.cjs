/* Tally test suite — runs the pure finance engine (and the real crypto)
   headless, and statically enforces the core promise: the offline app makes
   ZERO network calls. Run with: npm test (uses the actual TypeScript engine) */
"use strict";
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

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

const REMOTE = /^(?:https?|wss?|ftp):|^\/\//i;
const NETWORK_APIS = new Set([
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon",
  "WebTransport", "RTCPeerConnection", "webkitRTCPeerConnection", "importScripts",
]);
const RESOURCE_ATTRIBUTES = new Set(["src", "srcset", "poster", "data", "background", "action", "formaction", "ping", "xlinkhref", "xlink:href"]);

/** Check resource strings before any literal stripping: URLs are precisely what matter here. */
function privacyViolations(filename, source) {
  const failures = new Set();
  const report = (message) => failures.add(`${filename}: ${message}`);
  const resource = (value, context) => {
    if (REMOTE.test(value.trim()) || /(?:^|[,\s])(?:https?:)?\/\//i.test(value)) report(`external ${context}`);
  };
  const styles = (text) => {
    for (const match of text.matchAll(/url\(\s*["']?([^\s"')]+)|@import\s+["']([^"']+)/gi)) {
      resource(match[1] || match[2], "CSS resource");
    }
  };
  styles(source);
  if (/\.(?:css|svg|html)$/.test(filename)) {
    const markup = source.replace(/<!--[\s\S]*?-->/g, "");
    for (const match of markup.matchAll(/<([\w:-]+)\b([^>]*?)>/g)) {
      const tag = match[1].toLowerCase();
      const attrs = new Map();
      for (const attr of match[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
        attrs.set(attr[1].toLowerCase(), attr[2] ?? attr[3] ?? attr[4]);
      }
      for (const [name, value] of attrs) {
        if (RESOURCE_ATTRIBUTES.has(name) || (name === "href" && tag !== "a")) resource(value, `${tag} ${name}`);
        if (name.startsWith("on")) scanScript(value, `${filename} inline handler`);
      }
      if (tag === "meta" && attrs.get("http-equiv")?.toLowerCase() === "refresh") {
        const destination = attrs.get("content")?.match(/url\s*=\s*(.*)/i)?.[1];
        if (destination) resource(destination, "automatic navigation");
      }
    }
    for (const match of markup.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) scanScript(match[1], `${filename} inline script`);
  } else scanScript(source, filename);

  function scanScript(code, label) {
    const file = ts.createSourceFile(label, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const bindings = new Map();
    const collect = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) bindings.set(node.name.text, node.initializer);
      ts.forEachChild(node, collect);
    };
    collect(file);
    const literal = (node, seen = new Set()) => {
      if (!node) return "";
      if (ts.isStringLiteralLike(node)) return node.text;
      if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression, seen);
      if (ts.isIdentifier(node) && bindings.has(node.text) && !seen.has(node.text)) {
        return literal(bindings.get(node.text), new Set([...seen, node.text]));
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return literal(node.left, seen) + literal(node.right, seen);
      if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => literal(span.expression, seen) + span.literal.text).join("");
      if (ts.isNewExpression(node) && node.expression.getText(file) === "URL") return literal(node.arguments?.[0], seen);
      return "";
    };
    const visit = (node) => {
      if (ts.isIdentifier(node) && NETWORK_APIS.has(node.text)) report(`network API ${node.text}`);
      if (ts.isElementAccessExpression(node) && NETWORK_APIS.has(literal(node.argumentExpression))) report(`network API ${literal(node.argumentExpression)}`);
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) resource(literal(node.moduleSpecifier), "module import");
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const name = node.expression.getText(file);
        if (["import", "require", "Worker", "SharedWorker", "window.Worker", "window.SharedWorker"].includes(name)) resource(literal(node.arguments?.[0]), "module or worker import");
        if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "setAttribute") {
          const attribute = literal(node.arguments?.[0]).toLowerCase();
          if (RESOURCE_ATTRIBUTES.has(attribute) || attribute === "href") resource(literal(node.arguments?.[1]), `assigned ${attribute}`);
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left)) {
        const name = node.left.name.text.toLowerCase();
        if (RESOURCE_ATTRIBUTES.has(name) || name === "href") resource(literal(node.right), `assigned ${name}`);
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(file).toLowerCase();
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const name = attr.name.getText(file).toLowerCase();
          if (RESOURCE_ATTRIBUTES.has(name) || (name === "href" && tag !== "a")) resource(literal(attr.initializer), `${tag} ${name}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return [...failures];
}

function collectOfflineSources(root) {
  const files = new Set([
    path.join(root, "lib", "finance-core.mjs"),
    ...walk(path.join(root, "src"), [".ts", ".tsx", ".css", ".html", ".svg"]),
    ...walk(path.join(root, "public"), [".html", ".css", ".js", ".svg"]),
    ...fs.readdirSync(root).filter((name) => name.endsWith(".html")).map((name) => path.join(root, name)),
  ]);
  return [...files].filter((file) => fs.existsSync(file)).map((file) => ({
    filename: path.relative(root, file), source: fs.readFileSync(file, "utf8"),
  }));
}

(async function main() {
  const root = __dirname;

  /* ---- 1. static privacy guarantee: the app must never touch the network ---- */
  const sources = collectOfflineSources(root);
  const violations = sources.flatMap(({ filename, source }) => privacyViolations(filename, source));
  ok(`no automatic network APIs or external resources across ${sources.length} application sources`, violations.length === 0);
  for (const violation of violations) console.error("  " + violation);
  for (const [name, filename, source] of [
    ["external JSX image", "probe.tsx", '<img src="https://example.test/pixel" />'],
    ["variable-backed JSX resource", "probe.tsx", 'const REMOTE = "https://example.test/pixel"; const view = <img src={REMOTE} />;'],
    ["external font", "probe.css", '@font-face { src: url(https://example.test/font.woff2); }'],
    ["CSS import", "probe.css", '@import "https://example.test/theme.css";'],
    ["remote dynamic import", "probe.ts", 'import("https://example.test/module.js")'],
    ["remote static import", "probe.ts", 'import thing from "https://example.test/module.js"'],
    ["protocol-relative script", "probe.html", '<script src="//example.test/script.js"></script>'],
    ["image assignment", "probe.ts", 'image.src = "https://example.test/pixel"'],
    ["fetch call", "probe.ts", 'fetch("/upload", {method: "POST"})'],
    ["computed fetch", "probe.ts", 'window["fetch"]("/upload")'],
    ["beacon", "probe.ts", 'navigator.sendBeacon("/upload", data)'],
    ["event stream", "probe.ts", 'new EventSource("/events")'],
    ["websocket", "probe.ts", 'new WebSocket("wss://example.test")'],
    ["XMLHttpRequest", "probe.ts", 'new XMLHttpRequest()'],
    ["remote worker", "probe.ts", 'new window.Worker("https://example.test/worker.js")'],
    ["automatic refresh", "probe.html", '<meta http-equiv="refresh" content="0;url=https://example.test/">'],
    ["inline HTML network call", "probe.html", '<script>fetch("/upload")</script>'],
  ]) ok(`privacy scanner detects ${name}`, privacyViolations(filename, source).length > 0);
  eq("privacy scanner allows explicit links and SVG namespaces", privacyViolations("probe.tsx", `
    const REPO = "https://github.com/zent7x/tally";
    const view = <a href={REPO}><svg xmlns="http://www.w3.org/2000/svg" /></a>;
    const copy = "Tally never calls fetch() or XMLHttpRequest";
  `), []);
  eq("privacy scanner allows HTML metadata and local resources", privacyViolations("probe.html", '<meta property="og:url" content="https://example.test/"><a href="https://example.test/">Source</a><script src="./app.js"></script>'), []);

  /* ---- 2. load the actual finance engine used by the app ---- */
  const {
    parseCSV,
    parseDate,
    parseAmount: parseNum,
    categorize,
    detectRecurring,
    deriveKey,
    encryptWith,
    decryptWith,
  } = await import("./src/lib/finance/index.ts");

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
