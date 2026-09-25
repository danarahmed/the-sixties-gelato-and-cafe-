#!/usr/bin/env node
// What the database says to a person (release G): the messages its functions
// refuse with, in their English, with {1}, {2}… where a value goes. Read from
// the migrations, the latest definition of each function that still exists.
// Used by tests/i18n.test.ts to check each is translated, and from the command
// line to see them:
//
//   node scripts/db-messages.mjs            # every message, one a line
//   node scripts/db-messages.mjs --by-fn    # with the function that says it
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MIGRATIONS = join(ROOT, "supabase", "migrations");

/** Each function's body, as its latest migration defines it; dropped ones left out. */
export function functionBodies() {
  const bodies = new Map();
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), "utf8");
    const events = [];
    const def = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?\s*\(/gi;
    for (let m = def.exec(sql); m; m = def.exec(sql)) {
      const open = sql.indexOf("$$", m.index);
      const close = open < 0 ? -1 : sql.indexOf("$$", open + 2);
      if (close < 0) continue;
      events.push({ at: m.index, name: m[1].toLowerCase(), body: sql.slice(open + 2, close) });
      def.lastIndex = close + 2;
    }
    const drop = /drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi;
    for (let m = drop.exec(sql); m; m = drop.exec(sql))
      events.push({ at: m.index, name: m[1].toLowerCase(), body: null });
    events.sort((a, b) => a.at - b.at);
    for (const e of events) {
      if (e.body === null) bodies.delete(e.name);
      else bodies.set(e.name, e.body);
    }
  }
  return bodies;
}

/**
 * The code of a body with its comments blanked and its strings pulled out:
 * `code` has each string replaced by '#n', `strings[n]` is its text.
 */
export function tokens(body) {
  const strings = [];
  let code = "";
  for (let i = 0; i < body.length; ) {
    const c = body[i];
    if (c === "-" && body[i + 1] === "-") {
      const end = body.indexOf("\n", i);
      i = end < 0 ? body.length : end;
    } else if (c === "/" && body[i + 1] === "*") {
      const end = body.indexOf("*/", i + 2);
      i = end < 0 ? body.length : end + 2;
    } else if (c === "'") {
      let j = i + 1;
      let text = "";
      for (; j < body.length; j++) {
        if (body[j] === "'" && body[j + 1] === "'") {
          text += "'";
          j++;
        } else if (body[j] === "'") break;
        else text += body[j];
      }
      code += `'#${strings.length}'`;
      strings.push(text);
      i = j + 1;
    } else {
      code += c;
      i++;
    }
  }
  return { code, strings };
}

/** A raise's text as a phrase: each % a numbered slot, %% a percent sign. */
export function raisePattern(text) {
  let n = 0;
  return text.replace(/%%|%/g, (m) => (m === "%%" ? "%" : `{${++n}}`));
}

/** A format() string as a phrase: %s, %L, %I, %1$s a numbered slot, %% a percent sign. */
export function formatPattern(text) {
  let n = 0;
  return text.replace(/%%|%(\d+\$)?[sIL]/g, (m) => (m === "%%" ? "%" : `{${++n}}`));
}

/** Every message the database refuses with: { fn, en }, en the phrase to translate. */
export function raiseMessages() {
  const out = [];
  for (const [fn, body] of functionBodies()) {
    const { code, strings } = tokens(body);
    const raise = /raise\s+exception\s+'#(\d+)'\s*(,\s*format\s*\(\s*'#(\d+)')?/gi;
    for (let m = raise.exec(code); m; m = raise.exec(code)) {
      const text = strings[Number(m[1])] ?? "";
      if (text.trim() === "%" && m[3] !== undefined)
        out.push({ fn, en: formatPattern(strings[Number(m[3])] ?? "") });
      else out.push({ fn, en: raisePattern(text) });
    }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const byFn = process.argv.includes("--by-fn");
  const seen = new Set();
  for (const { fn, en } of raiseMessages()) {
    if (byFn) console.log(`${fn}\t${en}`);
    else if (!seen.has(en)) {
      seen.add(en);
      console.log(en);
    }
  }
}
