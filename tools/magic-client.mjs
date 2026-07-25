#!/usr/bin/env node
// Minimal MCP stdio client for @21st-dev/magic
// Usage: node magic-client.mjs list
//        node magic-client.mjs call <toolName> '<jsonArgs>'
import { spawn } from "node:child_process";

const API_KEY = process.env.TWENTY_FIRST_API_KEY;
if (!API_KEY) { console.error("TWENTY_FIRST_API_KEY not set"); process.exit(1); }

const [,, cmd, toolName, argsJson] = process.argv;

const child = spawn("npx", ["-y", "@21st-dev/magic@latest", `API_KEY=${API_KEY}`], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buf = "";
const pending = new Map();
let nextId = 1;

function send(method, params) {
  const id = nextId++;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("timeout " + method)); } }, 300000);
  });
}

child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on("data", (d) => process.stderr.write("[magic] " + d));

const init = await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "tally-redesign", version: "0.1" },
});
if (init.error) { console.error("init error", init.error); process.exit(1); }
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

if (cmd === "list") {
  const tools = await send("tools/list", {});
  console.log(JSON.stringify(tools.result, null, 2));
} else if (cmd === "call") {
  const res = await send("tools/call", { name: toolName, arguments: JSON.parse(argsJson || "{}") });
  const out = res.result?.content?.map(c => c.text ?? "").join("\n") ?? JSON.stringify(res, null, 2);
  console.log(out);
}
child.kill();
process.exit(0);
