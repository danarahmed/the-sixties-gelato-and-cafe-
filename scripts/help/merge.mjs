#!/usr/bin/env node
// The help's translations, part by part (src/lib/help/parts/<lang>.<n>.json,
// each checked by check-part.mjs), joined into src/lib/help/<lang>.json in
// the order of en.json.
//
//   node scripts/help/merge.mjs ar ckb
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const DIR = "src/lib/help/parts";
const parts = readdirSync(DIR)
  .map((f) => /^en\.(\d+)\.json$/.exec(f)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b);
for (const lang of process.argv.slice(2)) {
  const out = { screens: [], tasks: [] };
  for (const n of parts) {
    const f = `${DIR}/${lang}.${n}.json`;
    if (!existsSync(f)) throw new Error(`${f} is missing`);
    execFileSync("node", ["scripts/help/check-part.mjs", String(n), lang], { stdio: "inherit" });
    const part = JSON.parse(readFileSync(f, "utf8"));
    for (const k of Object.keys(part)) out[k].push(...part[k]);
  }
  // Read right to left: "Menu → Reports" points the way the eye goes, as the app's own labels do.
  let text = JSON.stringify(out, null, 1).replace(/→/g, "←");
  // The cashier is کاشێر on every screen (common.ts): the help says the same.
  if (lang === "ckb") text = text.replace(/فرۆشیار/g, "کاشێر");
  writeFileSync(`src/lib/help/${lang}.json`, text + "\n");
  console.log(`${lang}: ${out.screens.length} screens, ${out.tasks.length} tasks`);
}
