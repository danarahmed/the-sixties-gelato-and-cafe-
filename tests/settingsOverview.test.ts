/**
 * Settings at a glance (the simplification round): each group says what it
 * has turned on, and what is not set up yet is listed with what it gives.
 */
import { describe, expect, it } from "vitest";
import {
  notSetUp,
  peopleStatus,
  placesStatus,
  receiptIsOwn,
  rulesStatus,
  sellingStatus,
  type SettingsFacts,
} from "@/lib/settingsOverview";
import { receiptSetupFrom } from "@/lib/receipt";
import { BOOKS } from "@/lib/i18n/phrases";

const blankReceipt = receiptSetupFrom({ name: "The Sixty's", qr: "none" });
const fresh: SettingsFacts = {
  waysToPay: 0,
  serviceCharges: [],
  receipt: blankReceipt,
  phoneWarnings: false,
  people: 1,
  branches: 1,
  places: 2,
};
const busy: SettingsFacts = {
  waysToPay: 2,
  serviceCharges: [{ name: "Dine-in", percent: 10 }],
  receipt: receiptSetupFrom({ name: "The Sixty's", thanks_en: "Thanks", qr: "none" }),
  phoneWarnings: true,
  people: 6,
  branches: 2,
  places: 2,
};
const known = new Set(Object.values(BOOKS).flatMap((b) => Object.keys(b)));

describe("Settings at a glance", () => {
  it("says what each group has on", () => {
    expect(sellingStatus(busy)).toEqual([
      ["Service charge on {ways}", { ways: "Dine-in 10%" }],
      ["{n} way(s) to pay besides cash and card", { n: 2 }],
      ["Your own receipt"],
    ]);
    expect(sellingStatus(fresh).map(([p]) => p)).toEqual([
      "No service charge",
      "Cash and card only",
      "The app's own receipt",
    ]);
    expect(rulesStatus(busy)).toEqual([["Phone warnings on"]]);
    expect(placesStatus(fresh)).toEqual([
      ["{n} branch(es)", { n: 1 }],
      ["{n} other place(s)", { n: 1 }],
    ]);
  });

  it("lists what is not set up, and nothing once it is", () => {
    expect(notSetUp(fresh).map((x) => x.anchor)).toEqual([
      "receipt",
      "ways-to-pay",
      "phone-warnings",
      "service-charge",
    ]);
    expect(notSetUp(busy)).toEqual([]);
  });

  it("says nothing of what the database does not have yet", () => {
    const before: SettingsFacts = {
      ...fresh,
      waysToPay: null,
      serviceCharges: null,
      receipt: null,
      phoneWarnings: null,
    };
    expect(sellingStatus(before)).toEqual([]);
    expect(rulesStatus(before)).toEqual([]);
    expect(notSetUp(before)).toEqual([]);
  });

  it("counts a receipt as the café's own once anything of it is given", () => {
    expect(receiptIsOwn(blankReceipt)).toBe(false);
    expect(receiptIsOwn(receiptSetupFrom({ name: "x", qr: "menu", menu_url: "https://a.b" }))).toBe(
      true,
    );
    expect(receiptIsOwn(null)).toBe(false);
  });

  it("has every phrase it says in the phrase books", () => {
    const said = [
      ...[fresh, busy]
        .flatMap((f) => [
          ...sellingStatus(f),
          ...rulesStatus(f),
          ...peopleStatus(f),
          ...placesStatus(f),
        ])
        .map(([p]) => p),
      ...notSetUp(fresh).flatMap((x) => [x.title, x.why]),
    ];
    expect(said.filter((p) => !known.has(p))).toEqual([]);
  });
});
