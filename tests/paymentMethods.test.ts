/**
 * The café's own ways to pay (0069), as the screens work them out before the
 * database does: which common ones are offered to add, where money may be
 * moved, the answers read from the database, and a sale paid by FIB and
 * FastPay given back by each, apart.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { actionLabel, subjectOf } from "@/lib/audit";
import {
  BANK,
  SAFE,
  methodReportFrom,
  methodTakingsFrom,
  methodsToOffer,
  moneyAccountsFrom,
  moveIsAllowed,
  payMethodsFrom,
  sameName,
} from "@/lib/paymentMethods";
import {
  checkRefundSplit,
  checkSplit,
  howPaid,
  leftToGiveBack,
  paidPart,
  refundSplitMessage,
  wayKey,
} from "@/lib/payments";

const FIB = "11111111-1111-4111-8111-111111111111";
const FASTPAY = "22222222-2222-4222-8222-222222222222";

describe("the café's ways to pay (0069)", () => {
  it("reads them as the database lists them", () => {
    expect(
      payMethodsFrom([
        { id: FIB, name: "FIB", account: "1030", position: 1, active: true },
        { id: FASTPAY, name: "FastPay", account: "1031", position: 2, active: false },
      ]),
    ).toEqual([
      { id: FIB, name: "FIB", account: "1030", position: 1, active: true },
      { id: FASTPAY, name: "FastPay", account: "1031", position: 2, active: false },
    ]);
    expect(payMethodsFrom(null)).toEqual([]);
  });

  it("offers to add the common ones the café has not, however they were written", () => {
    expect(methodsToOffer([])).toEqual(["FIB", "FastPay", "ZainCash", "Qi Card"]);
    expect(methodsToOffer([{ name: " fib " }, { name: "qi  card" }])).toEqual([
      "FastPay",
      "ZainCash",
    ]);
    expect(sameName("Zain Cash", "zain cash")).toBe(true);
    expect(sameName("ZainCash", "Zain Cash")).toBe(false);
  });

  it("moves money out of a way to pay's account, or into one, and nowhere else", () => {
    const methods = [{ account: "1030" }, { account: "1031" }];
    expect(moveIsAllowed("1030", BANK, methods)).toBe(true);
    expect(moveIsAllowed("1030", SAFE, methods)).toBe(true);
    expect(moveIsAllowed("1030", "1031", methods)).toBe(true);
    expect(moveIsAllowed(BANK, "1031", methods)).toBe(true);
    // A charge alone comes out of a way to pay's account.
    expect(moveIsAllowed("1030", null, methods)).toBe(true);
    expect(moveIsAllowed(BANK, null, methods)).toBe(false);
    // The bank and the safe move cash between themselves on Move Cash.
    expect(moveIsAllowed(BANK, SAFE, methods)).toBe(false);
    expect(moveIsAllowed("1030", "1030", methods)).toBe(false);
    expect(moveIsAllowed("1000", BANK, methods)).toBe(false);
    expect(moveIsAllowed("1030", "1000", methods)).toBe(false);
  });

  it("reads what the accounts hold and the moves", () => {
    const a = moneyAccountsFrom({
      methods: [{ id: FIB, name: "FIB", account: "1030", active: true, balance: "2850" }],
      bank: 1500,
      safe: 0,
      moves: [
        {
          id: "m1",
          from: "1030",
          to: null,
          amount: 0,
          fee: 100,
          on: "2026-10-06",
          reference: null,
          note: "Monthly charge",
          journal_no: 1004,
          by: "Owner",
          at: "2026-10-06T09:00:00Z",
          cancelled_at: null,
          cancel_reason: null,
        },
      ],
    });
    expect(a?.methods[0]?.balance).toBe(2850);
    expect(a?.moves[0]).toMatchObject({
      to: null,
      fee: 100,
      journalNo: 1004,
      note: "Monthly charge",
    });
    expect(moneyAccountsFrom(null)).toBeNull();
  });

  it("reads each way to pay's takings: the café's figures only for the whole café", () => {
    expect(methodTakingsFrom([{ method: FIB, name: "FIB", amount: 9000, payments: 3 }])).toEqual([
      { method: FIB, name: "FIB", amount: 9000, payments: 3 },
    ]);
    const [place] = methodReportFrom([
      {
        method: FIB,
        name: "FIB",
        account: "1030",
        active: true,
        sales: 3,
        taken: 9000,
        refunded: 3000,
        net: 6000,
      },
    ]);
    expect(place).toMatchObject({ net: 6000, movedOut: null, fees: null, balance: null });
    const [cafe] = methodReportFrom([
      {
        method: FIB,
        name: "FIB",
        account: "1030",
        active: true,
        sales: 3,
        taken: 9000,
        refunded: 3000,
        net: 6000,
        moved_out: 2000,
        fees: 150,
        balance: 3850,
      },
    ]);
    expect(cafe).toMatchObject({ movedOut: 2000, fees: 150, balance: 3850 });
  });
});

describe("a sale paid by the café's ways to pay (0069)", () => {
  it("splits with a part by FIB, which names it", () => {
    const s = checkSplit(
      6000,
      [
        { type: "cash", amount: "1000" },
        { type: "other", amount: "3000", method: FIB },
        { type: "other", amount: "", method: FASTPAY },
      ],
      "1000",
    );
    expect(s.problem).toBeNull();
    expect(s.payments).toEqual([
      { type: "cash", amount: 1000, received: 1000 },
      { type: "other", amount: 3000, received: null, method: FIB },
      { type: "other", amount: 2000, received: null, method: FASTPAY },
    ]);
  });

  it("is sent to the database with the way to pay and the reference", () => {
    expect(
      howPaid({ tenders: [{ type: "other", amount: "2500", method: FIB, reference: "TX 77" }] }),
    ).toEqual({
      p_tender: null,
      p_tenders: [{ type: "other", amount: 2500, received: null, method: FIB, reference: "TX 77" }],
    });
  });

  it("comes back from the database with the way to pay by name", () => {
    expect(
      paidPart({
        type: "other",
        amount: 2500,
        received: null,
        change: null,
        method: FIB,
        method_name: "FIB",
        reference: "TX 77",
      }),
    ).toEqual({
      type: "other",
      amount: 2500,
      received: null,
      change: null,
      method: FIB,
      methodName: "FIB",
      reference: "TX 77",
    });
  });

  it("is given back by each way to pay apart", () => {
    const left = leftToGiveBack(
      [
        { type: "cash", amount: 1000 },
        { type: "other", amount: 3000, method: FIB, methodName: "FIB" },
        { type: "other", amount: 2000, method: FASTPAY, methodName: "FastPay" },
      ],
      [
        { type: "other", amount: 500, method: FIB },
        { type: "other", amount: 333, method: FASTPAY },
      ],
    );
    expect(left).toEqual([
      { type: "cash", paid: 1000, left: 1000 },
      { type: "other", method: FIB, name: "FIB", paid: 3000, left: 2500 },
      { type: "other", method: FASTPAY, name: "FastPay", paid: 2000, left: 1667 },
    ]);
    expect(left.map(wayKey)).toEqual(["cash", `other:${FIB}`, `other:${FASTPAY}`]);

    const ok = checkRefundSplit(left, { cash: "", [`other:${FIB}`]: "2500" }, 2500);
    expect(ok).toEqual({ parts: [{ type: "other", amount: 2500, method: FIB }], problem: null });

    const tooMuch = checkRefundSplit(left, { [`other:${FASTPAY}`]: "2500" }, 2500);
    expect(tooMuch.problem).toEqual({
      kind: "tooMuch",
      type: "other",
      left: 1667,
      name: "FastPay",
    });
    // Word for word what the database says (0069).
    expect(refundSplitMessage(tooMuch.problem!, 2500)).toBe(
      "Only 1667 of what FastPay took is left to give back",
    );
  });
});

describe("the ways to pay on the audit trail (0069)", () => {
  const migration = readFileSync(
    join(__dirname, "../supabase/migrations/0069_payment_methods.sql"),
    "utf8",
  );

  it("names each row the migration writes", () => {
    for (const a of [
      "payment_method.add",
      "payment_method.change",
      "money.move",
      "money.move_cancel",
    ]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
    }
    const none = new Map<string, string>();
    expect(subjectOf("payment_method", "x", null, { name: "FIB" }, none)).toBe("FIB");
    expect(subjectOf("money_move", "x", null, {}, none)).toBe("A move of money");
  });
});
