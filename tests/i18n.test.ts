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
import { arrows, fill, isolateDates, messenger, translator } from "@/lib/i18n/core";
import { parseRich, plain } from "@/lib/i18n/Rich";
import { LABELS } from "@/lib/format";
import { RULE_PHRASES } from "@/lib/rules";
import { parseCsv, toCsv } from "@/lib/csv";
import { briefCalculations, briefFacts, briefToDo, type DailyBrief } from "@/lib/alerts";
// @ts-expect-error: a plain script, shared with the command line
import { scan, screens } from "../scripts/i18n-scan.mjs";
// @ts-expect-error: a plain script, shared with the command line
import { raiseMessages } from "../scripts/db-messages.mjs";

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

  it("write Kurdish in Kurdish letters, and Arabic in Arabic ones", () => {
    // Sorani has its own letters where Arabic has ك ي ة ى; Arabic has none of ڕ ڵ ێ ۆ ە ڤ.
    const wrong = all.flatMap((p) => [
      ...(/[كيةى]/.test(p.t.ckb) ? [`ckb ${p.book}: ${p.en}`] : []),
      ...(/[ڕڵێۆەڤ]/.test(p.t.ar) ? [`ar ${p.book}: ${p.en}`] : []),
    ]);
    expect(wrong).toEqual([]);
  });

  it("have every phrase the café's rules show on Settings and on the loss form (0040)", () => {
    const shown = [
      ...RULE_PHRASES,
      "A loss over {limit} needs a manager's approval.",
      "A loss over {limit}, or that takes your losses today or the item's over it, needs a manager's approval.",
      "A loss over {limit}, or that takes your losses this session (or today) or the item's today over it, needs a manager's approval.",
    ];
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(shown.filter((p) => !words[p])).toEqual([]);
    }
  });

  it("have every label the app gives payments, roles, items, movements and orders", () => {
    const common = BOOKS.common ?? {};
    expect(LABELS.filter((l) => !common[l])).toEqual([]);
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

  it("translates a message with its values, each value translated too", () => {
    const msg = messenger({
      "{1} runs out in {2}: {3} left": "{1} ينفد خلال {2}: بقي {3}",
      "under a day": "أقل من يوم",
      "{1} days": "{1} أيام",
      "Waste {1}.": "هدر {1}.",
      Sep: "أيلول",
      "Card takings {1} to {2} settled": "تمت تسوية مقبوضات البطاقات من {1} إلى {2}",
    });
    expect(msg("Milk runs out in under a day: 2 L left")).toBe(
      "Milk ينفد خلال أقل من يوم: بقي 2 L",
    );
    expect(msg("Milk runs out in 3.5 days: 9 L left")).toBe("Milk ينفد خلال 3.5 أيام: بقي 9 L");
    expect(msg("Waste 12,000 IQD.")).toBe("هدر 12,000 IQD.");
    expect(msg("Card takings 01 Sep to 05 Sep settled")).toBe(
      "تمت تسوية مقبوضات البطاقات من 01 أيلول إلى 05 أيلول",
    );
    // An account by code and name, when the name is a phrase.
    expect(messenger({ Rent: "الإيجار" })("6000 Rent")).toBe("6000 الإيجار");
    expect(messenger({ Rent: "الإيجار" })("6000 Office rent")).toBe("6000 Office rent");
    // A short phrase is for values: it never takes a whole message.
    expect(msg("The count took 3 days")).toBe("The count took 3 days");
    // What has no translation stays as it is.
    expect(msg("Something new")).toBe("Something new");
  });

  it("keeps a date put in a phrase left to right for a right-to-left reader", () => {
    const [lri, pdi] = ["\u2066", "\u2069"];
    const t = translator({ "From {from} to {to}": "من {from} إلى {to}" }, "rtl");
    expect(t("From {from} to {to}", { from: "2026-09-01", to: "2026-09-30" })).toBe(
      `من ${lri}2026-09-01${pdi} إلى ${lri}2026-09-30${pdi}`,
    );
    // A month, a date and time, a date among other words; each date on its own.
    expect(isolateDates("2026-09")).toBe(`${lri}2026-09${pdi}`);
    expect(isolateDates("since 2026-09-30 14:05, open")).toBe(
      `since ${lri}2026-09-30 14:05${pdi}, open`,
    );
    expect(isolateDates("2026-09-26 — 2026-10-02")).toBe(
      `${lri}2026-09-26${pdi} — ${lri}2026-10-02${pdi}`,
    );
    // Marked once only, and never a longer number: an invoice's, a phone's.
    expect(isolateDates(isolateDates("2026-09-30"))).toBe(`${lri}2026-09-30${pdi}`);
    expect(isolateDates("INV-2026-0012 · 12026-09-30 · 0750-123-4567")).toBe(
      "INV-2026-0012 · 12026-09-30 · 0750-123-4567",
    );
    // Left to right, the words are as they were: English, and numbers alone.
    expect(translator({})("From {from} to {to}", { from: "2026-09-01", to: "2026-09-30" })).toBe(
      "From 2026-09-01 to 2026-09-30",
    );
    expect(fill("{n} left", { n: 2026 }, "rtl")).toBe("2026 left");
    // A message from the database, too.
    expect(
      messenger({ "Open since {1}": "مفتوح منذ {1}" }, "rtl")("Open since 2026-09-30 03:29"),
    ).toBe(`مفتوح منذ ${lri}2026-09-30 03:29${pdi}`);
  });

  it("points an arrow on, or back, the way the language reads", () => {
    expect(arrows("ltr")).toEqual({ on: "→", back: "←" });
    expect(arrows("rtl")).toEqual({ on: "←", back: "→" });
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

describe("a language's words in a file, for a translator", () => {
  it("come back from the file as they went out", () => {
    const rows = [
      ["Save", "Save", "حفظ", "Kaydet"],
      ['Say "yes", then go', "", "", "Evet de, sonra git\nyeni satır"],
      ["=SUM(A1)", "", "", "-1"],
    ];
    const file = toCsv(["key", "english", "built_in", "words"], rows);
    expect(file.startsWith("\uFEFF")).toBe(true);
    expect(parseCsv(file)).toEqual([["key", "english", "built_in", "words"], ...rows]);
    // As a spreadsheet saves it: line breaks as \r\n, no mark at the start.
    expect(parseCsv('key,words\r\n"a, b","x ""y"""\r\n')).toEqual([
      ["key", "words"],
      ["a, b", 'x "y"'],
    ]);
  });
});

describe("what the café is told without asking", () => {
  // Alerts as the database writes them (tests/sql/alerts.test.sql and
  // settlements.test.sql), each with the names in it that stay as they are.
  const SAID: [string, string[]][] = [
    ["Bank is -10,000 IQD: below zero", []],
    ["The drawer at Main Branch has not been counted for 05 Sep", ["Main Branch"]],
    ["The drawer at Main Branch has not been counted for 2 days, since 05 Sep", ["Main Branch"]],
    ["Session 12 at Main Branch has been open since 05 Sep 14:30", ["Main Branch"]],
    ["Session 12 at Main Branch closed 6,000 IQD short", ["Main Branch"]],
    [
      "Session 13 at Main Branch opened 9,500 IQD short of what the last session left",
      ["Main Branch"],
    ],
    [
      "Session 13 at Main Branch was closed by Demo Manager: The cashier went home",
      ["Main Branch", "Demo Manager", "The cashier went home"],
    ],
    ["A stock count has been open since 05 Sep 14:30", []],
    ["Alert milk runs out in under a day: 500 ml left, using about 1100 a day", ["Alert milk"]],
    ["Alert milk runs out in 1.5 days: 1500 ml left, using about 1000 a day", ["Alert milk"]],
    ["Milk runs out in no time: 0 ml left, using about 50 a day", ["Milk"]],
    ["Order about 3500 ml (a week of use).", []],
    ["Alert straws: 0 each on hand, below its reorder level of 50", ["Alert straws"]],
    [
      "Golden cup at 250 each is 400% above its cost now (50 each) — confirmed by Demo Manager",
      ["Golden cup", "Demo Manager"],
    ],
    [
      "Milk at 1500 a L is 30% below its cost now (2150 a L); Cups at 90 each is 50% above its cost now (60 each) — confirmed by Demo Manager",
      ["Milk", "Cups", "Demo Manager"],
    ],
    ["Alert tea is sold with no recipe: its sales are costed at nothing", ["Alert tea"]],
    ["Alert tea cannot be sold: its recipe has no version in force today", ["Alert tea"]],
    [
      "Golden espresso — Single (بلي): sold below cost at 200 IQD, costing 250",
      ["Golden espresso — Single"],
    ],
    ["Alert thin latte (Dine-in): 60% margin at 500 IQD, costing 200", ["Alert thin latte"]],
    ["Under the 70% target, the price no longer covers what the recipe costs now.", []],
    [
      "Alert vanilla has no cost yet, and 1 product uses it: Alert vanilla latte",
      ["Alert vanilla latte", "Alert vanilla"],
    ],
    [
      "Alert vanilla has no cost yet, and 5 products use it: Alert vanilla cone, Alert vanilla cup, Alert vanilla latte, Alert vanilla shake and 1 more",
      [
        "Alert vanilla cone",
        "Alert vanilla cup",
        "Alert vanilla latte",
        "Alert vanilla shake",
        "Alert vanilla",
      ],
    ],
    ["Waste of 25,000 IQD in the last 7 days, against about 3,231 in a usual week", []],
    [
      "Demo Manager: 3 void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, 5,900 IQD (59% of their sales)",
      ["Demo Manager"],
    ],
    [
      "Demo Manager: 3 void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, 5,900 IQD",
      ["Demo Manager"],
    ],
    ["2,500 IQD of card money is more than 3 days old and not yet recorded as settled", []],
    [
      "1 Talabat order, 3,000 IQD, is more than 7 days old and not yet paid out; the oldest from 05 Sep",
      ["Talabat"],
    ],
    [
      "2 Talabat orders, 6,000 IQD, are more than 7 days old and not yet paid out; the oldest from 05 Sep",
      ["Talabat"],
    ],
    ["4,000 IQD in platform receivable is matched to no order", []],
    ["Platform receivable is 2,000 IQD short of the orders waiting to be paid out", []],
    ["Sulaymaniyah Dairy Co.: 20,000 IQD overdue by 1 day(s)", ["Sulaymaniyah Dairy Co."]],
    ["Sulaymaniyah Dairy Co.: 20,000 IQD due today", ["Sulaymaniyah Dairy Co."]],
    ["A supplier: 20,000 IQD due on 05 Sep", []],
    ["Alert water is 5,000 IQD on Dine-in but 500 on Takeaway", ["Alert water"]],
    [
      "Golden espresso — Single is 3,000 IQD on Talabat but 200 on بلي",
      ["Golden espresso — Single", "Talabat"],
    ],
    ["Possible duplicate: Rent 15,000 IQD in journal 12 (05 Sep) and journal 14 (06 Sep)", []],
    [
      "Golden beans: 30 g more used than the recipes say between the counts of 20 Sep and 27 Sep (10%, 300 IQD)",
      ["Golden beans"],
    ],
    [
      "Golden cup: 5 each less used than the recipes say between the counts of 20 Sep and 27 Sep (12.5%, 250 IQD)",
      ["Golden cup"],
    ],
    ["Golden water is below zero in the books: -2 each", ["Golden water"]],
    // A batch past, or near, its use-by (0046).
    ["Golden vanilla gelato, batch 3, is past its use-by: 100 g left", ["Golden vanilla gelato"]],
    [
      "Golden vanilla gelato, batch 2, is to be used by 28 Sep 16:30: 4300 g left",
      ["Golden vanilla gelato"],
    ],
    ["2 loss(es) waiting for a manager's approval (900 IQD)", []],
    // Staff, their hours and their pay (0049): the alerts, the till's answers, the month's close.
    ["Rana has been clocked in for 17 hours, since 27 Sep 08:00", ["Rana"]],
    ["The payroll for 2026-08 is not approved: salaries were due on 01 Sep", []],
    ["Salaries for 2026-08: 450,000 IQD not paid yet", []],
    ["Rana has no PIN yet: a manager sets one on Staff", ["Rana"]],
    ["Rana is clocked in already, since 28 Sep 08:02", ["Rana"]],
    [
      "Clocking by PIN is paused for Rana after too many wrong PINs today: a manager sets a new PIN on Staff",
      ["Rana"],
    ],
    [
      "The payroll for 2026-09 is not approved: after the lock it cannot be posted into this month",
      [],
    ],
    ["That is more than is owed to Rana (240,000)", ["Rana"]],
    [
      "Costed at nothing: Alert vanilla, Alert cream; Used before it had a cost: Alert milk",
      ["Alert vanilla", "Alert cream", "Alert milk"],
    ],
    ["Margin target (%): enter a number from 0 to 95", []],
    [
      "Period 2026-09 cannot be locked yet: No draft journals — 2 draft journal(s) must be published or discarded; Every trading day's cash is counted — Not counted: 2026-09-01, 2026-09-02",
      [],
    ],
    [
      "Check the price: Milk at 1500 a L is 30% below its cost now (2150 a L); Cups at 90 each is 50% above its cost now (60 each). If it is right, confirm it and receive again",
      ["Milk", "Cups"],
    ],
  ];
  // What stays the same in every language: the currency, the units, and a PIN.
  const SAME = /\b(IQD|ml|kg|g|L|PIN)\b/g;

  for (const locale of ["ar", "ckb"] as const) {
    it(`gives every alert in ${locale === "ar" ? "Arabic" : "Kurdish"}, names and all`, () => {
      const msg = messenger(builtInWords(locale));
      const left = SAID.flatMap(([en, names]) => {
        let out = msg(en);
        for (const n of names) out = out.split(n).join("");
        return /[A-Za-z]{2,}/.test(out.replace(SAME, "")) ? [`${en} → ${msg(en)}`] : [];
      });
      expect(left).toEqual([]);
    });
  }

  it("writes the daily brief in the reader's language, and the same English as before", () => {
    const brief: DailyBrief = {
      day: "2026-09-21",
      facts: {
        sales: 12,
        netSales: 150000,
        voids: 1,
        voided: 3000,
        refunds: 2,
        refunded: 4000,
        discounts: 1,
        discounted: 1000,
        waste: 2500,
        drawerCounts: 1,
        drawerDifference: -500,
        uncostedSales: 1,
      },
      calculations: {
        costOfGoods: 50000,
        costOfGoodsPercent: 33.3,
        grossProfit: 95000,
        grossMarginPercent: 63.3,
        sameDayLastWeek: 140000,
        changeFromLastWeekPercent: 7.1,
        usualForTheWeekday: 130000,
      },
      alerts: [{ urgency: "orange", title: "x", action: null, link: null, acknowledged: false }],
      red: 0,
      orange: 1,
      recommendations: [],
    };
    expect(briefFacts(brief)).toEqual([
      "Net sales 150,000 IQD over 12 sales.",
      "1 void (3,000 IQD).",
      "2 refunds (4,000 IQD).",
      "1 discount (1,000 IQD).",
      "Waste 2,500 IQD.",
      "The drawer was counted 500 IQD short.",
      "1 sale with something costed at nothing (Reports → Uncosted sales).",
    ]);
    expect(briefCalculations(brief, "Monday")).toEqual([
      "Cost of goods 50,000 IQD, 33.3% of sales.",
      "Gross profit 95,000 IQD (63.3%), after waste and every other cost of sales.",
      "Last Monday: 140,000 IQD (+7.1% since).",
      "A usual Monday (the four before): 130,000 IQD.",
    ]);
    expect(briefToDo(brief)).toEqual(["Nothing urgent. 1 orange alert waits for a quiet moment."]);
    for (const locale of ["ar", "ckb"] as const) {
      const t = translator(builtInWords(locale));
      const lines = [
        ...briefFacts(brief, t),
        ...briefCalculations(brief, "Monday", t),
        ...briefToDo(brief, t),
      ];
      expect(lines.filter((l) => /[A-Za-z]{2,}/.test(l.replace(/\bIQD\b/g, "")))).toEqual([]);
    }
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

  it("names where each journal came from in words the books have", () => {
    // The register and an account's lines show a journal's source through t()
    // from a map, which the check above cannot see.
    const missing: string[] = [];
    for (const { file, sf } of parsed)
      walk(sf, (n) => {
        if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || n.name.text !== "SOURCE")
          return;
        if (!n.initializer || !ts.isObjectLiteralExpression(n.initializer)) return;
        for (const p of n.initializer.properties)
          if (
            ts.isPropertyAssignment(p) &&
            isStringLike(p.initializer) &&
            !known.has(p.initializer.text)
          )
            missing.push(`${file}: ${p.initializer.text}`);
      });
    expect(missing).toEqual([]);
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
      "signed",
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

  it("has every message the database refuses with", () => {
    const said = new Set((raiseMessages() as { en: string }[]).map((m) => m.en));
    expect([...said].filter((en) => !known.has(en))).toEqual([]);
  });

  it("shows no English written straight into a screen", () => {
    expect(scan(screens())).toEqual([]);
  });
});
