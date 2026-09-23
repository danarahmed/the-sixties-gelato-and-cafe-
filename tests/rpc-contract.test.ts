/**
 * The app talks to the database only through named functions. A call whose
 * name or parameters do not match a function a signed-in person may execute
 * would only fail at runtime, on the till. This test reads every call in
 * src/ and every function definition and grant in the migrations, and fails
 * if they disagree.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

/** The text between a bracket at `open` and its match. */
function balanced(text: string, open: number): string {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const stack: string[] = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i]!;
    if (pairs[c]) stack.push(pairs[c]!);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced bracket at ${open}`);
}

interface SqlFunction {
  params: { name: string; required: boolean }[];
}

/** The last definition of every function across the migrations, in order. */
function sqlFunctions(): Map<string, SqlFunction> {
  const fns = new Map<string, SqlFunction>();
  for (const file of readdirSync(MIGRATIONS).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    const re = /create or replace function\s+([a-z_]+)\s*\(/gi;
    for (let m = re.exec(sql); m; m = re.exec(sql)) {
      const inner = balanced(sql, m.index + m[0].length - 1);
      const params: { name: string; required: boolean }[] = [];
      let depth = 0;
      let cur = "";
      for (const ch of inner) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (ch === "," && depth === 0) {
          params.push(parse(cur));
          cur = "";
        } else cur += ch;
      }
      if (cur.trim()) params.push(parse(cur));
      fns.set(m[1]!.toLowerCase(), { params: params.filter((p) => p.name.startsWith("p_")) });
    }
  }
  return fns;
  function parse(decl: string) {
    const d = decl.trim().replace(/\s+/g, " ");
    const name = d
      .replace(/^(in|out|inout|variadic) /i, "")
      .split(" ")[0]!
      .toLowerCase();
    return { name: /^out /i.test(d) ? "" : name, required: !/ default |=/i.test(d) };
  }
}

/** Every function granted to signed-in users, by name. */
function grantedToAuthenticated(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(MIGRATIONS).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    const re = /grant execute on function([\s\S]*?)to authenticated/gi;
    for (let m = re.exec(sql); m; m = re.exec(sql)) {
      for (const n of m[1]!.matchAll(/([a-z_]+)\s*\(/gi)) names.add(n[1]!.toLowerCase());
    }
  }
  return names;
}

interface Call {
  file: string;
  fn: string;
  keys: string[];
}

function appCalls(): Call[] {
  const calls: Call[] = [];
  for (const file of walk(join(ROOT, "src"))) {
    const text = readFileSync(file, "utf8");
    const re = /(?:callRpc(?:<.*?>)?|\.rpc)\(\s*"([a-z_]+)"/g;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const after = m.index + m[0].length;
      const rest = text.slice(after);
      const brace = rest.match(/^\s*,\s*\{/);
      const keys = brace
        ? [...balanced(text, after + brace[0].length - 1).matchAll(/\b(p_[a-z_]+)\s*:/g)].map(
            (k) => k[1]!,
          )
        : [];
      calls.push({ file: file.slice(ROOT.length + 1), fn: m[1]!, keys });
    }
  }
  return calls;
}

describe("app ↔ database function contract", () => {
  const fns = sqlFunctions();
  const granted = grantedToAuthenticated();
  const calls = appCalls();

  it("finds the app's database calls", () => {
    expect(calls.length).toBeGreaterThan(30);
  });

  for (const c of calls) {
    it(`${c.fn}() from ${c.file}`, () => {
      const fn = fns.get(c.fn);
      expect(fn, `${c.fn} is not defined in any migration`).toBeDefined();
      expect(granted.has(c.fn), `${c.fn} is not granted to signed-in users`).toBe(true);
      const names = fn!.params.map((p) => p.name);
      for (const k of c.keys) expect(names, `${c.fn} has no parameter ${k}`).toContain(k);
      for (const p of fn!.params.filter((x) => x.required)) {
        expect(c.keys, `${c.fn} is called without its required ${p.name}`).toContain(p.name);
      }
    });
  }
});
