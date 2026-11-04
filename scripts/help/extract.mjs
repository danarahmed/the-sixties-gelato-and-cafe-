#!/usr/bin/env node
// The ? help inside the app (G3), taken from the guide: for each screen its
// summary, how to get there, what each role may do there, what to do when…
// and its tips; and every task, with its steps. Written to
// src/lib/help/en.json; ar.json and ckb.json are its translations, kept in
// the same shape (tests/help.test.ts checks).
//
//   node scripts/help/extract.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = "docs/guide/src";
const screens = [];
for (const f of readdirSync(join(SRC, "screens")).sort()) {
  if (!f.endsWith(".json")) continue;
  for (const s of JSON.parse(readFileSync(join(SRC, "screens", f), "utf8"))) {
    if (!String(s.path).startsWith("/")) continue;
    const who = {};
    for (const w of s.who ?? []) {
      if (!w.role) continue;
      const said = [w.can, w.cannot ? `Not: ${w.cannot}` : null].filter(Boolean).join(" ");
      // "general_manager, accountant": one line for several roles.
      for (const role of String(w.role).split(/\s*,\s*/)) if (role) who[role] = said;
    }
    screens.push({
      path: String(s.path),
      title: s.title ?? "",
      summary: s.summary ?? "",
      get_there: s.get_there ?? "",
      who,
      what_if: (s.what_if ?? []).map((x) => ({ case: x.case ?? "", do: x.do ?? "" })),
      tips: (s.tips ?? []).map(String),
    });
  }
}
const tasks = JSON.parse(readFileSync(join(SRC, "tasks.json"), "utf8")).map((t, i) => ({
  id: i,
  title: t.title ?? "",
  roles: t.roles ?? [],
  when: t.when ?? "",
  why: t.why ?? "",
  before: (t.before ?? []).map(String),
  steps: (t.steps ?? []).map((s) => (s.see ? { do: s.do ?? "", see: s.see } : { do: s.do ?? "" })),
  if: (t.if ?? []).map((x) => ({ case: x.case ?? "", do: x.do ?? "" })),
  screens: t.screens ?? [],
}));
writeFileSync("src/lib/help/en.json", JSON.stringify({ screens, tasks }, null, 1) + "\n");
console.log(`${screens.length} screen entries, ${tasks.length} tasks`);
