/**
 * Every box, list and tick box in the app has a name a screen reader can say
 * (AJ). A name is one of:
 *  - a <label> round it, or pointing at it (htmlFor); a Field is a label;
 *  - aria-label, aria-labelledby or title.
 * A placeholder is not a name. It goes once something is typed, and it is
 * more often an example than a name.
 *
 * A label names only the first box inside it, so a second box inside it
 * needs a name of its own. A component that is only a box (a list of units)
 * is named where it is used.
 *
 * The browser suite (pages) checks every screen as it is drawn. This check
 * also finds the boxes that only a click opens, in a dialog or a form.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

type Source = { file: string; sf: ts.SourceFile };

function files(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, ext));
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

const source = (file: string, text: string): Source => ({
  file,
  sf: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
});

function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node);
  node.forEachChild((c) => walk(c, visit));
}

/** What a label is written as: the element itself, and the app's Field. */
const LABELS = new Set(["label", "Field"]);
/** The elements a label can name (HTML's "labelable" elements). */
const LABELLABLE = new Set([
  "input",
  "select",
  "textarea",
  "button",
  "meter",
  "output",
  "progress",
]);
/** Controls that need a name. */
const CONTROLS = new Set(["input", "select", "textarea"]);
/** Inputs named by what they show (a button's value), or not shown at all. */
const SELF_NAMED = new Set(["hidden", "submit", "button", "reset", "image"]);

const opening = (n: ts.Node): ts.JsxOpeningLikeElement | undefined =>
  ts.isJsxSelfClosingElement(n) ? n : ts.isJsxElement(n) ? n.openingElement : undefined;
const tagOf = (el: ts.JsxOpeningLikeElement) => el.tagName.getText();

function attribute(el: ts.JsxOpeningLikeElement, name: string) {
  for (const a of el.attributes.properties)
    if (ts.isJsxAttribute(a) && a.name.getText() === name) return a;
  return undefined;
}

/** An attribute's value as written: a string's text, or an expression's source. */
function valueOf(a: ts.JsxAttribute | undefined): string | undefined {
  if (!a) return undefined;
  if (!a.initializer) return "true";
  if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
  if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
    const e = a.initializer.expression;
    return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : e.getText();
  }
  return undefined;
}

const lineOf = (sf: ts.SourceFile, n: ts.Node) =>
  sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** Whether a and b sit in the two branches of one `? :`, so only one is drawn. */
function eitherOr(a: ts.Node, b: ts.Node): boolean {
  const branchesOf = (n: ts.Node) => {
    const out = new Map<ts.Node, ts.Node>();
    for (let c: ts.Node = n; c.parent; c = c.parent)
      if (ts.isConditionalExpression(c.parent) && c !== c.parent.condition) out.set(c.parent, c);
    return out;
  };
  const inA = branchesOf(a);
  for (const [cond, branch] of branchesOf(b))
    if (inA.has(cond) && inA.get(cond) !== branch) return true;
  return false;
}

/**
 * Why the label round n, if any, does not name it: null when it does.
 * Undefined when n has no label round it.
 */
function labelFails(n: ts.Node, sf: ts.SourceFile): string | null | undefined {
  let label: ts.JsxElement | undefined;
  for (let p = n.parent; p && !label; p = p.parent)
    if (ts.isJsxElement(p) && LABELS.has(tagOf(p.openingElement))) label = p;
  if (!label) return undefined;
  if (attribute(label.openingElement, "htmlFor")) return "its label points at another";
  const before: ts.Node[] = [];
  label.children.forEach((c) =>
    walk(c, (m) => {
      const el = opening(m);
      if (!el || !LABELLABLE.has(tagOf(el)) || m.getStart(sf) >= n.getStart(sf)) return;
      if (tagOf(el) === "input" && valueOf(attribute(el, "type")) === "hidden") return;
      if (!eitherOr(m, n)) before.push(m);
    }),
  );
  const [named] = before;
  if (!named) return null;
  const first = opening(named)!;
  return `second in its label (the label names the ${tagOf(first)} on line ${lineOf(sf, first)})`;
}

/** The component n is the whole of (`function UnitSelect() { return <select…/> }`). */
function componentOf(n: ts.Node): string | undefined {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isJsxElement(p) || ts.isJsxFragment(p) || ts.isJsxSelfClosingElement(p))
      return undefined;
    if (ts.isFunctionDeclaration(p)) return p.name?.text;
    if (ts.isArrowFunction(p) || ts.isFunctionExpression(p))
      return ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)
        ? p.parent.name.text
        : undefined;
  }
  return undefined;
}

type Finding = { at: string; control: string; why: string };

function unnamed(sources: Source[]): Finding[] {
  const uses = new Map<string, { file: string; sf: ts.SourceFile; n: ts.Node }[]>();
  for (const { file, sf } of sources)
    walk(sf, (n) => {
      const el = opening(n);
      if (!el || !/^[A-Z]/.test(tagOf(el))) return;
      uses.set(tagOf(el), [...(uses.get(tagOf(el)) ?? []), { file, sf, n }]);
    });

  const found: Finding[] = [];
  for (const { file, sf } of sources) {
    const pointedAt = new Set<string>();
    walk(sf, (n) => {
      const el = opening(n);
      const target = el && valueOf(attribute(el, "htmlFor"));
      if (target) pointedAt.add(target);
    });
    walk(sf, (n) => {
      const el = opening(n);
      if (!el || !CONTROLS.has(tagOf(el))) return;
      const type = valueOf(attribute(el, "type")) ?? "";
      if (tagOf(el) === "input" && SELF_NAMED.has(type)) return;
      if (attribute(el, "hidden")) return;
      const own = ["aria-label", "aria-labelledby", "title"].some((a) => {
        const v = valueOf(attribute(el, a));
        return v !== undefined && v.trim() !== "";
      });
      if (own) return;
      const id = valueOf(attribute(el, "id"));
      if (id && pointedAt.has(id)) return;
      const at = `${file}:${lineOf(sf, el)}`;
      const control = `${tagOf(el)}${type ? `[${type}]` : ""}`;
      const why = labelFails(n, sf);
      if (why === null) return;
      if (why) {
        found.push({ at, control, why });
        return;
      }
      // No label round it here: a component that is only this box is named
      // where it is used, each time.
      const component = componentOf(n);
      const used = component ? (uses.get(component) ?? []) : [];
      const unlabelled = used.filter((u) => labelFails(u.n, u.sf) !== null);
      if (used.length > 0 && unlabelled.length === 0) return;
      const spread = el.attributes.properties.some((a) => ts.isJsxSpreadAttribute(a));
      found.push({
        at,
        control,
        why:
          used.length > 0
            ? `<${component}> with no label at ${unlabelled
                .map((u) => `${u.file}:${lineOf(u.sf, u.n)}`)
                .join(", ")}`
            : spread
              ? "no label (its attributes spread from elsewhere)"
              : "no label",
      });
    });
  }
  return found;
}

/**
 * What a button shows, when the check can read it: its text, each side of a
 * `? :` too. Null when it shows something the check cannot read (a phrase
 * through t(), a name), which is taken as saying something.
 */
function shown(children: readonly ts.Node[]): string | null {
  let out = "";
  const add = (e: ts.Expression): boolean => {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) out += e.text;
    else if (ts.isParenthesizedExpression(e)) return add(e.expression);
    else if (ts.isConditionalExpression(e)) return add(e.whenTrue) && add(e.whenFalse);
    else if (
      ts.isBinaryExpression(e) &&
      e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    )
      return add(e.right);
    else return false;
    return true;
  };
  for (const c of children) {
    if (ts.isJsxText(c)) out += c.text;
    else if (ts.isJsxExpression(c)) {
      if (c.expression && !add(c.expression)) return null;
    } else {
      const el = opening(c);
      if (!el) return null;
      if (valueOf(attribute(el, "aria-hidden")) === "true") continue;
      if (ts.isJsxSelfClosingElement(c)) return null;
      const inner = shown((c as ts.JsxElement).children);
      if (inner === null) return null;
      out += inner;
    }
  }
  return out;
}

/** Buttons that show only a sign (×, ✎, −) and have no name of their own. */
function signOnly(sources: Source[]): string[] {
  const found: string[] = [];
  for (const { file, sf } of sources)
    walk(sf, (n) => {
      if (!ts.isJsxElement(n) || !["button", "a", "Link"].includes(tagOf(n.openingElement))) return;
      const el = n.openingElement;
      if (["aria-label", "aria-labelledby"].some((a) => (valueOf(attribute(el, a)) ?? "").trim()))
        return;
      const text = shown(n.children);
      if (text === null || /[\p{L}\p{N}]/u.test(text)) return;
      found.push(`${file}:${lineOf(sf, el)} ${tagOf(el)} “${text.trim()}”`);
    });
  return found;
}

describe("the screens", () => {
  const sources = files(join(ROOT, "src"), /\.tsx$/).map((f) =>
    source(relative(ROOT, f), readFileSync(f, "utf8")),
  );

  it("name every box, list and tick box for a screen reader", () => {
    expect(unnamed(sources).map((f) => `${f.at} ${f.control}: ${f.why}`)).toEqual([]);
  });

  it("name every button that shows only a sign", () => {
    // A title is not enough: a button is named by what it shows first, and
    // "×" is said as "multiplication sign".
    expect(signOnly(sources)).toEqual([]);
  });
});

describe("the check for a name", () => {
  const whys = (text: string) => unnamed([source("x.tsx", text)]).map((f) => f.why);

  it("takes a label round it, a Field, one pointing at it, or a name of its own", () => {
    expect(whys(`const A = () => <label>Name <input /></label>;`)).toEqual([]);
    expect(whys(`const A = () => <Field label="Name"><select /></Field>;`)).toEqual([]);
    expect(
      whys(`const A = () => <div><label htmlFor="n">Name</label><input id="n" /></div>;`),
    ).toEqual([]);
    expect(
      whys(`const A = () => <div><input aria-label={t("Name")} /><textarea title="Why" /></div>;`),
    ).toEqual([]);
    expect(
      whys(`const A = () => <div><input type="hidden" /><input type="submit" /></div>;`),
    ).toEqual([]);
  });

  it("does not take a placeholder, or an empty name", () => {
    expect(whys(`const A = () => <div><input placeholder="e.g. 5" /></div>;`)).toEqual([
      "no label",
    ]);
    expect(whys(`const A = () => <div><input aria-label="" /></div>;`)).toEqual(["no label"]);
  });

  it("names only the first box in a label, unless the two are either-or", () => {
    expect(whys(`const A = () => <label>From <input /> to <input /></label>;`)).toEqual([
      "second in its label (the label names the input on line 1)",
    ]);
    expect(whys(`const A = () => <label>Pay {cash ? <input /> : <select />}</label>;`)).toEqual([]);
    expect(whys(`const A = () => <label>Pay <button>?</button><input /></label>;`)).toEqual([
      "second in its label (the label names the button on line 1)",
    ]);
  });

  it("finds a button that shows only a sign, and not one that says something", () => {
    const signs = (text: string) => signOnly([source("x.tsx", text)]);
    expect(signs(`const A = () => <button title="Remove line">×</button>;`)).toEqual([
      "x.tsx:1 button “×”",
    ]);
    expect(signs(`const A = () => <button>{busy ? "…" : "✎"}</button>;`)).toEqual([
      "x.tsx:1 button “…✎”",
    ]);
    expect(signs(`const A = () => <button aria-label={t("Remove line")}>×</button>;`)).toEqual([]);
    expect(signs(`const A = () => <button>＋ {t("Add")}</button>;`)).toEqual([]);
    expect(signs(`const A = () => <button>{entry.journalNo}</button>;`)).toEqual([]);
    expect(signs(`const A = () => <button>2</button>;`)).toEqual([]);
  });

  it("follows a component that is only a box to where it is used", () => {
    const unit = `function UnitSelect() { return <select />; }\n`;
    expect(whys(`${unit}const A = () => <Field label="Unit"><UnitSelect /></Field>;`)).toEqual([]);
    expect(whys(`${unit}const A = () => <div><UnitSelect /></div>;`)).toEqual([
      "<UnitSelect> with no label at x.tsx:2",
    ]);
    expect(whys(unit)).toEqual(["no label"]);
  });
});
