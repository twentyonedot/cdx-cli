import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const blocked = [
  /krishna/i,
  /hwyhaul/i,
  /codex-account-switcher/,
  /\/Users\/twentyonedot/,
  /sk-[A-Za-z0-9_-]{12,}/,
  /"refresh_token"\s*:\s*"[^"]+"/i,
  /"access_token"\s*:\s*"[^"]+"/i
];
const ignored = new Set(["node_modules", "dist", ".git"]);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && path.relative(root, full) !== "scripts/scan-private.mjs") files.push(full);
  }
}

walk(root);

const failures = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of blocked) {
    if (pattern.test(text)) failures.push(`${path.relative(root, file)} matched ${pattern}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
