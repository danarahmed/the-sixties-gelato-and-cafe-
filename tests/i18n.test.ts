/**
 * Every screen in English, Arabic and Kurdish (release G). The phrases are
 * kept by their English text in src/lib/i18n/phrases; these checks keep the
 * translation whole:
 *  - every phrase has its Arabic and its Kurdish, with the same {placeholders}
 *    and <tags> as the English, and one translation wherever it is repeated;
 *  - every t("…") in the code is a phrase or a dotted key the dictionaries have;
 *  - no screen shows English written straight into it: its words go through t().
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { BOOKS } from "@/lib/i18n/phrases";
import { getDictionary, builtInWords } from "@/lib/i18n/dictionaries";
import { fill, translator } from "@/lib/i18n/core";
import { parseRich, plain } from "@/lib/i18n/Rich";
import { LABELS } from "@/lib/format";
// @ts-expect-error: a plain script, shared with the command line
import { scan, screens } from "../scripts/i18n-scan.mjs";

const ROOT = join(__dirname, "..");
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?([a-z][a-z0-9]*)>/gi)].map((m) => m[0]).sort();

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, ext));
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

describe("the phrase books", () => {
  const all = Object.entries(BOOKS).flatMap(([book, phrases]) =>
    Object.entries(phrases).map(([en, t]) => ({ book, en, t })),
  );

  it("give every phrase in Arabic and in Kurdish", () => {
    const missing = all.filter((p) => !p.t.ar?.trim() || !p.t.ckb?.trim()).map((p) => p.en);
    expect(missing).toEqual([]);
  });

  it("keep every {placeholder} and <tag> of the English", () => {
    const wrong = all.flatMap((p) =>
      (["ar", "ckb"] as const)
        .filter(
          (l) =>
            placeholders(p.t[l]).join() !== placeholders(p.en).join() ||
            tags(p.t[l]).join() !== tags(p.en).join(),
        )
        .map((l) => `${p.book} ${l}: ${p.en}`),
    );
    expect(wrong).toEqual([]);
  });

  it("translate a phrase the same wherever it is repeated", () => {
    const seen = new Map<string, { book: string; ar: string; ckb: string }>();
    const clashes: string[] = [];
    for (const p of all) {
      const before = seen.get(p.en);
      if (before && (before.ar !== p.t.ar || before.ckb !== p.t.ckb))
        clashes.push(`${p.en} (${before.book}, ${p.book})`);
      else seen.set(p.en, { book: p.book, ...p.t });
    }
    expect(clashes).toEqual([]);
  });

  it("have every label the app gives payments, roles, items, movements and orders", () => {
    const common = BOOKS.common ?? {};
    expect(LABELS.filter((l) => !common[l])).toEqual([]);
  });

  it("match a message with values only by words of its own", () => {
    // A message the database sends with values in it is matched by its words
    // around {1}, {2}…; too few, and it would swallow other messages.
    const loose = all
      .filter((p) => /\{\d+\}/.test(p.en))
      .filter((p) => (p.en.replace(/\{\d+\}/g, "").match(/[A-Za-z]/g) ?? []).length < 6)
      .map((p) => p.en);
    expect(loose).toEqual([]);
  });

  it("reach the screens: a page in Arabic or Kurdish is given them", () => {
    for (const p of all.slice(0, 50)) {
      expect(builtInWords("ar")[p.en]).toBe(p.t.ar);
      expect(builtInWords("ckb")[p.en]).toBe(p.t.ckb);
    }
    // A dotted key missing in a language falls back to its English.
    expect(builtInWords("ar")["app.name"]).toBeTruthy();
  });
});

describe("the translator", () => {
  it("fills placeholders, and leaves one with no value as it is", () => {
    expect(fill("{n} order(s) for {name}", { n: 2, name: "Lezzoo" })).toBe("2 order(s) for Lezzoo");
    expect(fill("{n} left", {})).toBe("{n} left");
    const t = translator({ "Hello {name}": "مرحبا {name}" });
    expect(t("Hello {name}", { name: "Dana" })).toBe("مرحبا Dana");
    expect(t("Not translated {x}", { x: 1 })).toBe("Not translated 1");
  });

  it("marks words in a sentence without splitting it", () => {
    const tree = parseRich("Sits in <b>1100</b> until <guide>paid out</guide>.");
    expect(JSON.stringify(tree)).toBe(
      JSON.stringify({
        tag: null,
        children: [
          "Sits in ",
          { tag: "b", children: ["1100"] },
          " until ",
          { tag: "guide", children: ["paid out"] },
          ".",
        ],
      }),
    );
    expect(plain("Sits in <b>1100</b>.")).toBe("Sits in 1100.");
    // A closing tag with no opening one is text.
    expect(JSON.stringify(parseRich("a </b> b").children)).toBe(
      JSON.stringify(["a ", "</b>", " b"]),
    );
  });
});

// ------------------------------------------------------------------ the code
const SOURCES = files(join(ROOT, "src"), /\.(ts|tsx)$/).filter((f) => !f.includes("/i18n/"));
const parsed = SOURCES.map((f) => ({
  file: relative(ROOT, f),
  sf: ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true),
}));

function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node);
  node.forEachChild((c) => walk(c, visit));
}

const isStringLike = (
  n: ts.Node | undefined,
): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

/** The name a call is made by: t(…), tr(…), x.t(…). */
function callee(n: ts.CallExpression): string | null {
  if (ts.isIdentifier(n.expression)) return n.expression.text;
  if (ts.isPropertyAccessExpression(n.expression)) return n.expression.name.text;
  return null;
}

describe("the code", () => {
  const known = new Set<string>([
    ...Object.keys(getDictionary("en")),
    ...Object.values(BOOKS).flatMap((b) => Object.keys(b)),
  ]);

  it("translates only phrases the books have", () => {
    const unknown: string[] = [];
    for (const { file, sf } of parsed)
      walk(sf, (n) => {
        if (!ts.isCallExpression(n) || !["t", "tr"].includes(callee(n) ?? "")) return;
        const arg = n.arguments[0];
        if (isStringLike(arg) && !known.has(arg.text)) unknown.push(`${file}: ${arg.text}`);
      });
    expect(unknown).toEqual([]);
  });

  it("gives every message of a form or an action as a phrase", () => {
    // What an action answers ({ error }, { message }), what its checks say
    // (zod), and the names of the fields they check: shown through msg().
    const MESSAGE_FILES =
      /^src\/lib\/(actions\/|auth\/actions|validation|db\/rpc|supabase\/server)/;
    const LABELLED = [
      "positive",
      "nonNegative",
      "optionalNonNegative",
      "signedNonZero",
      "id",
      "day",
      "text",
    ];
    const CHECKS = [
      "min",
      "max",
      "length",
      "email",
      "uuid",
      "regex",
      "refine",
      "nonempty",
      "int",
      "positive",
    ];
    const said = (e: ts.Expression | undefined): string[] => {
      if (!e) return [];
      if (isStringLike(e)) return [e.text];
      if (ts.isTemplateExpression(e))
        return [
          e.head.text + e.templateSpans.map((sp, i) => `{${i + 1}}${sp.literal.text}`).join(""),
        ];
      if (ts.isParenthesizedExpression(e)) return said(e.expression);
      if (ts.isConditionalExpression(e)) return [...said(e.whenTrue), ...said(e.whenFalse)];
      if (ts.isBinaryExpression(e) && e.operatorToken.kind !== ts.SyntaxKind.PlusToken)
        return said(e.right);
      return [];
    };
    const unknown: string[] = [];
    const check = (file: string, texts: string[]) => {
      for (const x of texts)
        if (/[A-Za-z]{2,}/.test(x) && !known.has(x)) unknown.push(`${file}: ${x}`);
    };
    for (const { file, sf } of parsed.filter((p) => MESSAGE_FILES.test(p.file)))
      walk(sf, (n) => {
        if (ts.isPropertyAssignment(n) && ["error", "message"].includes(n.name.getText(sf)))
          check(file, said(n.initializer));
        else if (ts.isReturnStatement(n) && n.expression && ts.isStringLiteral(n.expression))
          check(file, said(n.expression));
        else if (ts.isVariableDeclaration(n) && /MESSAGE$/.test(n.name.getText(sf)))
          check(file, said(n.initializer));
        else if (ts.isCallExpression(n)) {
          const name = callee(n) ?? "";
          if (n.expression.kind === ts.SyntaxKind.SuperKeyword) check(file, said(n.arguments[0]));
          else if (LABELLED.includes(name) && ts.isIdentifier(n.expression))
            check(file, said(n.arguments[0]));
          else if (CHECKS.includes(name) && ts.isPropertyAccessExpression(n.expression))
            check(file, said(n.arguments[n.arguments.length - 1]));
        } else if (ts.isNewExpression(n) && n.arguments?.length) check(file, said(n.arguments[0]));
      });
    expect(unknown).toEqual([]);
  });

  it("shows no English written straight into a screen", () => {
    expect(scan(screens())).toEqual([]);
  });
});
