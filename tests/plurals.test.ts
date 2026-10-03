import { describe, expect, it } from "vitest";
import { agree, messenger, translator } from "@/lib/i18n/core";

const en = translator({});

describe("a plural a phrase leaves open agrees with its number", () => {
  it("one, or more", () => {
    const open = "{n} bill(s) still open, {amount} in all.";
    expect(en(open, { n: 1, amount: "3,000 IQD" })).toBe("1 bill still open, 3,000 IQD in all.");
    expect(en(open, { n: 3, amount: "9,000 IQD" })).toBe("3 bills still open, 9,000 IQD in all.");
    expect(en(open, { n: 0, amount: "0 IQD" })).toBe("0 bills still open, 0 IQD in all.");
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
