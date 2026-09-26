#!/usr/bin/env node
// English written straight into a screen, instead of through t() (release G).
// Used by tests/i18n.test.ts, and from the command line to see what is left:
//
//   node scripts/i18n-scan.mjs                  # every screen, counted by file
//   node scripts/i18n-scan.mjs src/app/sales    # each finding under a path
//
// A finding is: text between tags; a string in an attribute a reader reads
// (placeholder, title, aria-label, alt, label, hint, text); a string given to a
// property that carries a message (text, title, label, hint, message,
// placeholder); a string in braces in the markup, or in a read attribute's
// braces, alone or as a branch of a ?:, && or ||, or the words of a `template`;
// or a string given to confirm(), alert() or prompt(), when it has a word of
// two or more Latin letters. Screens are the .tsx files under src/, but
// src/lib/i18n. A string inside a call (t("…"), a formatter's argument) is the
// call's business, not the markup's.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const READ = new Set(["placeholder", "title", "aria-label", "alt", "label", "hint", "text"]);
const SAID = new Set(["text", "title", "label", "hint", "message", "placeholder"]);
/** Written the same in every language: the currency's code. */
const SAME = new Set(["IQD"]);
const words = (s) => /[A-Za-z]{2,}/.test(s) && !SAME.has(s.trim());
const isStringLike = (n) => !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));
const ASKS = new Set(["confirm", "alert", "prompt"]);

/** The words a reader would see in an expression shown in the markup. */
function shown(e) {
  if (!e) return [];
  if (isStringLike(e)) return words(e.text) ? [e.text] : [];
  if (ts.isTemplateExpression(e)) {
    const text = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].join("…");
    return words(text) ? [text] : [];
  }
  if (ts.isParenthesizedExpression(e)) return shown(e.expression);
  if (ts.isConditionalExpression(e)) return [...shown(e.whenTrue), ...shown(e.whenFalse)];
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return shown(e.right);
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken)
      return [...shown(e.left), ...shown(e.right)];
    if (op === ts.SyntaxKind.PlusToken) return [...shown(e.left), ...shown(e.right)];
  }
  return [];
}

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Every screen file under a path (a file or a directory). */
export function screens(path = join(ROOT, "src")) {
  const abs = resolve(ROOT, path);
  const list = statSync(abs).isDirectory() ? files(abs) : [abs];
  return list.filter((f) => !f.includes(`${join("src", "lib", "i18n")}`));
}

/** The findings in some files: "file:line text". */
export function scan(list) {
  const bare = [];
  for (const f of list) {
    const source = readFileSync(f, "utf8");
    const sf = ts.createSourceFile(f, source, ts.ScriptTarget.Latest, true);
    const lines = source.split("\n");
    const file = relative(ROOT, f);
    const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line;
    const at = (n) => `${file}:${line(n) + 1}`;
    // "i18n-ignore" on the line, or the line before: the same in every
    // language on purpose (a brand, an example code).
    const ignored = (n) => /i18n-ignore/.test(`${lines[line(n) - 1] ?? ""}${lines[line(n)] ?? ""}`);
    const walk = (n) => {
      if (ignored(n)) {
        n.forEachChild(walk);
        return;
      }
      if (ts.isJsxText(n)) {
        const text = n.text.replace(/\s+/g, " ").trim();
        if (text && words(text)) bare.push(`${at(n)} ${text}`);
      } else if (ts.isJsxAttribute(n) && isStringLike(n.initializer)) {
        const name = n.name.getText(sf);
        if (READ.has(name) && words(n.initializer.text))
          bare.push(`${at(n)} ${name}="${n.initializer.text}"`);
      } else if (ts.isJsxAttribute(n) && n.initializer && ts.isJsxExpression(n.initializer)) {
        const name = n.name.getText(sf);
        if (READ.has(name))
          for (const w of shown(n.initializer.expression)) bare.push(`${at(n)} ${name}={"${w}"}`);
        // Its braces are done: a string in them is not shown unless read above.
        return;
      } else if (ts.isPropertyAssignment(n) && isStringLike(n.initializer)) {
        const name = n.name.getText(sf).replace(/["']/g, "");
        if (SAID.has(name) && words(n.initializer.text))
          bare.push(`${at(n)} ${name}: "${n.initializer.text}"`);
      } else if (ts.isJsxExpression(n) && n.parent && !ts.isJsxAttribute(n.parent)) {
        for (const w of shown(n.expression)) bare.push(`${at(n)} {"${w}"}`);
      } else if (ts.isCallExpression(n)) {
        const callee = ts.isIdentifier(n.expression)
          ? n.expression.text
          : ts.isPropertyAccessExpression(n.expression)
            ? n.expression.name.text
            : "";
        if (ASKS.has(callee))
          for (const w of shown(n.arguments[0])) bare.push(`${at(n)} ${callee}("${w}")`);
      }
      n.forEachChild(walk);
    };
    walk(sf);
  }
  return bare;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    const counts = new Map();
    for (const line of scan(screens())) {
      const file = line.slice(0, line.indexOf(":"));
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
    const sorted = [...counts].sort((a, b) => b[1] - a[1]);
    for (const [file, n] of sorted) console.log(String(n).padStart(4), file);
    console.log(String(sorted.reduce((s, [, n]) => s + n, 0)).padStart(4), "in all");
  } else {
    for (const p of paths) for (const line of scan(screens(p))) console.log(line);
  }
}
