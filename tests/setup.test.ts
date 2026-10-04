import { describe, expect, it } from "vitest";
import {
  NEW_FOR_DAYS,
  SETUP,
  SETUP_PHRASES,
  setupShown,
  setupSteps,
  skippedFrom,
  type SetupCounts,
  type SetupKey,
} from "@/lib/setup";
import { PASTE_PROBLEMS } from "@/lib/itemPaste";
import { builtInWords } from "@/lib/i18n/dictionaries";

const EMPTY: SetupCounts = {
  items: 0,
  suppliers: 0,
  recipes: 0,
  products: 0,
  tables: 0,
  staff: 0,
  staffWithoutPin: 0,
  sales: 0,
  firstSaleOn: null,
};
const ALL: Record<SetupKey, boolean> = {
  items: true,
  suppliers: true,
  recipes: true,
  products: true,
  tables: true,
  staff: true,
  sale: true,
};
const none = new Set<string>();
const state = (c: SetupCounts, skip = none, can = ALL) =>
  setupSteps(c, can, skip).map(
    (s) => `${s.key}:${s.done ? "done" : s.skipped ? "skipped" : s.next ? "next" : "todo"}`,
  );

describe("getting set up (round seven)", () => {
  it("the steps in the order each needs the one before, the first sale last", () => {
    expect(SETUP.map((s) => s.key)).toEqual([
      "items",
      "suppliers",
      "recipes",
      "products",
      "tables",
      "staff",
      "sale",
    ]);
    // A café may do without suppliers, a kitchen, tables or staff; not without stock, a menu or a sale.
    expect(SETUP.filter((s) => s.optional).map((s) => s.key)).toEqual([
      "suppliers",
      "recipes",
      "tables",
      "staff",
    ]);
    // Each opens the form it is added in.
    expect(Object.fromEntries(SETUP.map((s) => [s.key, s.href]))).toEqual({
      items: "/inventory#paste-items",
      suppliers: "/vendors",
      recipes: "/production#new-recipe",
      products: "/products#add-product",
      tables: "/pos#tables",
      staff: "/staff#add-person",
      sale: "/pos",
    });
  });

  it("a café with nothing: every step to do, the stock items next", () => {
    expect(state(EMPTY)).toEqual([
      "items:next",
      "suppliers:todo",
      "recipes:todo",
      "products:todo",
      "tables:todo",
      "staff:todo",
      "sale:todo",
    ]);
  });

  it("a step is done once the café has one; the next is the first neither done nor put aside", () => {
    const c = { ...EMPTY, items: 12, suppliers: 3 };
    expect(state(c, new Set(["recipes"]))).toEqual([
      "items:done",
      "suppliers:done",
      "recipes:skipped",
      "products:next",
      "tables:todo",
      "staff:todo",
      "sale:todo",
    ]);
    const steps = setupSteps(c, ALL, none);
    expect(steps.find((s) => s.key === "items")?.count).toBe(12);
  });

  it("only a step a café may do without is put aside, and one done is done", () => {
    expect(state({ ...EMPTY, tables: 4 }, new Set(["items", "tables", "sale"]))).toEqual([
      "items:next",
      "suppliers:todo",
      "recipes:todo",
      "products:todo",
      "tables:done",
      "staff:todo",
      "sale:todo",
    ]);
  });

  it("the first sale is done with the café's first sale", () => {
    const s = setupSteps({ ...EMPTY, sales: 1, firstSaleOn: "2026-10-04" }, ALL, none);
    expect(s.find((x) => x.key === "sale")).toMatchObject({ done: true, count: 1 });
  });

  it("says which steps the person may do", () => {
    const branch = { ...ALL, recipes: false, products: false };
    const s = setupSteps(EMPTY, branch, none);
    expect(s.filter((x) => !x.can).map((x) => x.key)).toEqual(["recipes", "products"]);
  });

  it("shown while the café is new and a step is left that the person may do", () => {
    const today = "2026-10-04";
    expect(setupShown(setupSteps(EMPTY, ALL, none), EMPTY, today, false)).toBe(true);
    // Hidden on this device.
    expect(setupShown(setupSteps(EMPTY, ALL, none), EMPTY, today, true)).toBe(false);
    // Everything done, or put aside.
    const all = {
      ...EMPTY,
      items: 1,
      suppliers: 1,
      recipes: 1,
      products: 1,
      staff: 1,
      sales: 3,
      firstSaleOn: today,
    };
    expect(setupShown(setupSteps(all, ALL, none), all, today, false)).toBe(true); // the tables are left
    expect(setupShown(setupSteps(all, ALL, new Set(["tables"])), all, today, false)).toBe(false);
    // Nothing left that this person may do (an accountant).
    const nobody = Object.fromEntries(SETUP.map((s) => [s.key, false])) as Record<
      SetupKey,
      boolean
    >;
    expect(setupShown(setupSteps(EMPTY, nobody, none), EMPTY, today, false)).toBe(false);
  });

  it("a café trading for more than a month is not new: what it does without is its choice", () => {
    const c = { ...EMPTY, items: 30, products: 12, sales: 900, firstSaleOn: "2026-08-01" };
    const steps = setupSteps(c, ALL, none);
    expect(setupShown(steps, c, "2026-10-04", false)).toBe(false);
    expect(setupShown(steps, { ...c, firstSaleOn: "2026-09-10" }, "2026-10-04", false)).toBe(true);
    expect(NEW_FOR_DAYS).toBe(30);
    // The month is whole: the thirtieth day still counts.
    expect(setupShown(steps, { ...c, firstSaleOn: "2026-09-04" }, "2026-10-04", false)).toBe(true);
    expect(setupShown(steps, { ...c, firstSaleOn: "2026-09-03" }, "2026-10-04", false)).toBe(false);
  });

  it("reads the steps a device put aside from its cookie, and nothing else", () => {
    expect([...skippedFrom("tables,staff")]).toEqual(["tables", "staff"]);
    expect([...skippedFrom("tables,nonsense,,")]).toEqual(["tables"]);
    expect([...skippedFrom(undefined)]).toEqual([]);
  });

  it("every word of Getting set up and of the paste in Arabic and in Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect([...SETUP_PHRASES, ...PASTE_PROBLEMS].filter((p) => !words[p])).toEqual([]);
    }
  });
});
