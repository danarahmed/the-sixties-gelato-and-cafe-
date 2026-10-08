import { describe, expect, it } from "vitest";
import {
  agree,
  flatPlurals,
  keptMarks,
  keptWords,
  messenger,
  pluralsWhole,
  translator,
  writtenWords,
} from "@/lib/i18n/core";
import { BOOKS } from "@/lib/i18n/phrases";

const en = translator({});

describe("a plural a phrase leaves open agrees with its number", () => {
  it("one, or more", () => {
    const open = "{n} bill(s) still open, {amount} in all.";
    expect(en(open, { n: 1, amount: "3,000 IQD" })).toBe("1 bill still open, 3,000 IQD in all.");
    expect(en(open, { n: 3, amount: "9,000 IQD" })).toBe("3 bills still open, 9,000 IQD in all.");
    expect(en(open, { n: 0, amount: "0 IQD" })).toBe("0 bills still open, 0 IQD in all.");
  });

  it("the till's order and the receipt: 1 item, 3 items, 1.5 items", () => {
    expect(en("{n} item(s)", { n: "1" })).toBe("1 item");
    expect(en("{n} item(s)", { n: "3" })).toBe("3 items");
    expect(en("{n} item(s)", { n: "1,250" })).toBe("1,250 items");
    expect(en("{n} item(s)", { n: "1.5" })).toBe("1.5 items");
  });

  it("the verb right after it agrees too", () => {
    expect(en("{n} red alert(s) wait for an answer.", { n: 1 })).toBe(
      "1 red alert waits for an answer.",
    );
    expect(en("{n} red alert(s) wait for an answer.", { n: 20 })).toBe(
      "20 red alerts wait for an answer.",
    );
    expect(en("{n} loss(es) wait for a manager.", { n: 1 })).toBe("1 loss waits for a manager.");
    expect(en("{n} loss(es) wait for a manager.", { n: 2 })).toBe("2 losses wait for a manager.");
    expect(en("{n} item(s) have no stock recorded yet.", { n: 1 })).toBe(
      "1 item has no stock recorded yet.",
    );
    expect(en("{n} item(s) differ; net value {value}.", { n: 1, value: "50 IQD" })).toBe(
      "1 item differs; net value 50 IQD.",
    );
  });

  it("whose: a month's share, three months' share", () => {
    const share = "{n} month(s)' share posted as an expense of its month.";
    expect(en(share, { n: 1 })).toBe("1 month's share posted as an expense of its month.");
    expect(en(share, { n: 3 })).toBe("3 months' share posted as an expense of its month.");
  });

  it("each word with the number nearest before it", () => {
    expect(
      en("Card takings still to reach the bank: {amount} over {n} day(s).", {
        amount: "266,550 IQD",
        n: 1,
      }),
    ).toBe("Card takings still to reach the bank: 266,550 IQD over 1 day.");
    expect(en("{n} point(s) less than the {days} day(s) before", { n: 1, days: 3 })).toBe(
      "1 point less than the 3 days before",
    );
    expect(
      en("Left out: {n} voided sale(s), {amount}; {m} bill(s) cancelled.", {
        n: 2,
        amount: "4,000 IQD",
        m: 1,
      }),
    ).toBe("Left out: 2 voided sales, 4,000 IQD; 1 bill cancelled.");
    expect(agree("1,000 order(s), 1.5 day(s)")).toBe("1,000 orders, 1.5 days");
  });

  it("with no number before it, the plural", () => {
    expect(agree("Tick the line(s) to order")).toBe("Tick the lines to order");
  });

  it("a message from the database too, translated or not", () => {
    const msg = messenger({});
    expect(
      msg(
        "1 bill(s) are still open. Take payment for them or cancel them before counting the drawer",
      ),
    ).toBe("1 bill is still open. Take payment for them or cancel them before counting the drawer");
    expect(
      msg("Main Branch: 1 void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, 500 IQD"),
    ).toBe("Main Branch: 1 void, refund, discount or cancelled bill in 7 days, 500 IQD");
  });

  it("Arabic and Kurdish words are left as they are", () => {
    const ar = translator({ "{n} bill(s) still open.": "{n} فاتورة ما زالت مفتوحة." }, "rtl");
    expect(ar("{n} bill(s) still open.", { n: 1 })).toBe("1 فاتورة ما زالت مفتوحة.");
    expect(agree("٣ پسووڵە (s)")).toBe("٣ پسووڵە (s)");
  });
});

describe("a count in Arabic takes the form Arabic gives its number", () => {
  const book = (l: "ar" | "ckb") =>
    Object.fromEntries(
      Object.values(BOOKS).flatMap((b) => Object.entries(b).map(([en, t]) => [en, t[l]])),
    );
  const ar = translator(book("ar"), "rtl", "ar");
  const bills = (n: number) =>
    ar("{n} bill(s) still open, {amount} in all.", { n, amount: "3,000 IQD" });

  it("the till's item count in Arabic and Kurdish", () => {
    expect(ar("{n} item(s)", { n: "1" })).toBe("صنف واحد");
    expect(ar("{n} item(s)", { n: "2" })).toBe("صنفان");
    expect(ar("{n} item(s)", { n: "5" })).toBe("5 أصناف");
    expect(ar("{n} item(s)", { n: "12" })).toBe("12 صنفًا");
    const ckb = translator(book("ckb"), "rtl", "ckb");
    expect(ckb("{n} item(s)", { n: "1" })).toBe("1 کاڵا");
  });

  it("one, two, three to ten, eleven to ninety-nine, and a hundred", () => {
    expect(bills(1)).toBe("فاتورة واحدة ما زالت مفتوحة، بمجموع 3,000 IQD.");
    expect(bills(2)).toBe("فاتورتان ما زالتا مفتوحتين، بمجموع 3,000 IQD.");
    expect(bills(3)).toBe("3 فواتير ما زالت مفتوحة، بمجموع 3,000 IQD.");
    expect(bills(10)).toBe("10 فواتير ما زالت مفتوحة، بمجموع 3,000 IQD.");
    expect(bills(11)).toBe("11 فاتورة ما زالت مفتوحة، بمجموع 3,000 IQD.");
    expect(bills(100)).toBe("100 فاتورة ما زالت مفتوحة، بمجموع 3,000 IQD.");
    expect(bills(103)).toBe("103 فواتير ما زالت مفتوحة، بمجموع 3,000 IQD.");
  });

  it("days after a word, and the days before", () => {
    const days = (n: number) =>
      ar("Card takings still to reach the bank: {amount} over {n} day(s).", {
        n,
        amount: "500 IQD",
      });
    expect([1, 2, 5, 11, 100].map(days).map((s) => s.split("عن ")[1])).toEqual([
      "يوم واحد.",
      "يومين.",
      "5 أيام.",
      "11 يومًا.",
      "100 يوم.",
    ]);
    expect(ar("{pct}% more than the {n} day(s) before", { pct: 5, n: 1 })).toBe(
      "أكثر بـ5% من اليوم السابق",
    );
    expect(ar("{pct}% more than the {n} day(s) before", { pct: 5, n: 7 })).toBe(
      "أكثر بـ5% من الأيام الـ7 السابقة",
    );
  });

  it("a mark kept round the count, as on the till's floor", () => {
    expect(ar("<b>{n}</b> open bill(s)", { n: 2 })).toBe("<b>فاتورتان</b> مفتوحتان");
    expect(ar("<b>{n}</b> open bill(s)", { n: 4 })).toBe("<b>4</b> فواتير مفتوحة");
  });

  it("a message from the database too", () => {
    const msg = messenger(book("ar"), "rtl", "ar");
    expect(msg("2 loss(es) waiting for a manager's approval (5,000 IQD)")).toBe(
      "خسارتان تنتظران موافقة مدير (5,000 IQD)",
    );
  });

  it("Kurdish and English as they were", () => {
    const ckb = translator(book("ckb"), "rtl", "ckb");
    expect(ckb("{n} bill(s) still open, {amount} in all.", { n: 2, amount: "1 IQD" })).toBe(
      "2 پسووڵە هێشتا کراوەن، کۆی گشتی 1 IQD.",
    );
    expect(en("<b>{n}</b> open bill(s)", { n: 1 })).toBe("<b>1</b> open bill");
  });
});

describe("the café's own words may write a count's forms too", () => {
  const page = "Page {page} of {pages} · {n} phrase(s)";
  const words =
    "صفحة {page} من {pages} · {n, plural, one {عبارة واحدة} two {عبارتان} few {# عبارات} other {# عبارة}}";
  /** The database's check (0032, phrase_placeholders): each {name}, as often as it is there. */
  const dbPlaceholders = (s: string) =>
    [...s.matchAll(/\{([\p{L}\p{N}_]+)\}/gu)]
      .map((m) => m[1])
      .sort()
      .join();

  it("read as their other form, the count as its placeholder", () => {
    expect(flatPlurals(words)).toBe("صفحة {page} من {pages} · {n} عبارة");
    expect(flatPlurals("no count here")).toBe("no count here");
  });

  it("each count whole, or refused", () => {
    expect(pluralsWhole(words)).toBe(true);
    expect(pluralsWhole("{n} عبارة")).toBe(true);
    // No other form; no number in it; a form left open; a form with a mark the others lack.
    expect(pluralsWhole("{n, plural, one {عبارة واحدة}}")).toBe(false);
    expect(pluralsWhole("{n, plural, one {عبارة} other {عبارات}}")).toBe(false);
    expect(pluralsWhole("{n, plural, one {عبارة} other {# عبارات}")).toBe(false);
    expect(pluralsWhole("{n, plural, one {<b>عبارة</b>} other {# عبارات}}")).toBe(false);
  });

  it("kept so the database's check finds the English's placeholders, and read back as written", () => {
    const kept = keptWords(words);
    expect(dbPlaceholders(kept)).toBe(dbPlaceholders(page));
    expect(dbPlaceholders(words)).not.toBe(dbPlaceholders(page));
    expect(writtenWords(kept)).toBe(words);
    // A count's forms with marks and another value inside them.
    const bills =
      "{n, plural, one {<b>فاتورة واحدة</b> منذ {date}} other {<b>#</b> فاتورة منذ {date}}}";
    expect(dbPlaceholders(keptWords(bills))).toBe("date,n");
    expect(writtenWords(keptWords(bills))).toBe(bills);
  });

  it("words with no count are kept as they are", () => {
    expect(keptWords("صفحة {page} من {pages}")).toBe("صفحة {page} من {pages}");
    expect(writtenWords("صفحة {page} من {pages}")).toBe("صفحة {page} من {pages}");
  });

  it("the marks they are kept with are taken out of words as written", () => {
    expect(keptMarks("a\u2063b ⟪c⟫")).toBe("ab c");
  });

  it("and a page shows them by the count", () => {
    const ar = translator({ [page]: writtenWords(keptWords(words)) }, "rtl", "ar");
    expect([1, 2, 3, 11].map((n) => ar(page, { page: 1, pages: 9, n }))).toEqual([
      "صفحة 1 من 9 · عبارة واحدة",
      "صفحة 1 من 9 · عبارتان",
      "صفحة 1 من 9 · 3 عبارات",
      "صفحة 1 من 9 · 11 عبارة",
    ]);
  });
});
