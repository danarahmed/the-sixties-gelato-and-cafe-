#!/usr/bin/env node
// Checks a translated part of the help against its English:
//   node scripts/help/check-part.mjs <n> <ar|ckb>
// The same shape; the same {placeholders}; only strings changed (paths, roles,
// ids and screens kept); Kurdish (ckb) without ك ي ة ى; no English left in a
// sentence. Prints what is wrong, and exits 1 if anything is.
import { readFileSync } from "node:fs";

const [n, lang] = process.argv.slice(2);
const dir = new URL("../../src/lib/help/parts/", import.meta.url);
const en = JSON.parse(readFileSync(new URL(`en.${n}.json`, dir), "utf8"));
const tr = JSON.parse(readFileSync(new URL(`${lang}.${n}.json`, dir), "utf8"));
const KEEP = new Set(["path", "roles", "screens", "id"]);
const ph = (s) => [...String(s).matchAll(/\{[a-zA-Z0-9_ ]+\}/g)].map((m) => m[0]).sort().join();
const bad = [];
function walk(a, b, at, key) {
  if (typeof a === "string") {
    if (typeof b !== "string") return bad.push(`${at}: not a string`);
    if (KEEP.has(key)) {
      if (a !== b) bad.push(`${at}: must stay "${a}"`);
      return;
    }
    if (a.trim() && !b.trim()) bad.push(`${at}: empty`);
    if (ph(a) !== ph(b)) bad.push(`${at}: placeholders ${ph(a)} ≠ ${ph(b)}`);
    if (lang === "ckb" && /[كيةى]/.test(b)) bad.push(`${at}: ckb has ك ي ة or ى`);
    // A sentence left in English: three English words in a row outside quotes and code.
    const bare = b.replace(/`[^`]*`/g, "").replace(/“[^”]*”/g, "").replace(/\{[^}]*\}/g, "");
    if (a.split(/\s+/).length > 3 && /\b[A-Za-z]{3,}\s+[A-Za-z]{3,}\s+[A-Za-z]{3,}\b/.test(bare))
      bad.push(`${at}: English left: ${bare.slice(0, 80)}`);
    return;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return bad.push(`${at}: list length ${a.length}`);
    a.forEach((x, i) => walk(x, b[i], `${at}[${i}]`, key));
    return;
  }
  if (a && typeof a === "object") {
    if (!b || typeof b !== "object") return bad.push(`${at}: not an object`);
    const ka = Object.keys(a).sort().join(), kb = Object.keys(b).sort().join();
    if (ka !== kb) return bad.push(`${at}: keys ${ka} ≠ ${kb}`);
    for (const k of Object.keys(a)) walk(a[k], b[k], `${at}.${k}`, KEEP.has(key) ? key : k);
    return;
  }
  if (a !== b) bad.push(`${at}: must stay ${JSON.stringify(a)}`);
}
const top = Object.keys(en)[0];
if (Object.keys(tr).join() !== top) bad.push(`${lang}.${n}: must hold "${top}" alone`);
else walk(en[top], tr[top], `${lang}.${n}.${top}`, "");
for (const b of bad.slice(0, 60)) console.log(b);
console.log(bad.length ? `${bad.length} problem(s)` : "ok");
process.exit(bad.length ? 1 : 0);
