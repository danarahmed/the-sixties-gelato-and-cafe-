import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { NAV } from "@/lib/auth/routes";
import { barePath, helpFor, screenPattern, type HelpContent } from "@/lib/help/match";

const read = (l: string) =>
  JSON.parse(readFileSync(`src/lib/help/${l}.json`, "utf8")) as HelpContent;
const en = read("en");

describe("the ? help (G3)", () => {
  it("knows a screen by its address, whatever the id in it", () => {
    expect(
      screenPattern("/inventory/[itemId]")!.test("/inventory/c0000000-0000-0000-0000-000000000001"),
    ).toBe(true);
    expect(screenPattern("/reports#g-sales")!.test("/reports")).toBe(true);
    expect(screenPattern("/reports")!.test("/reports/sales")).toBe(false);
    expect(screenPattern("(every screen)")).toBeNull();
    expect(barePath("/orders/?q=1")).toBe("/orders");
  });

  it("gives the till's help to a cashier: its parts, what a cashier may do, and the cashier's tasks", () => {
    const h = helpFor("/pos", ["cashier"], en, null);
    expect(h.screens.length).toBeGreaterThan(1);
    expect(h.screens.every((s) => s.summary.length > 0)).toBe(true);
    expect(h.screens.some((s) => s.you.length > 0)).toBe(true);
    expect(h.tasks.length).toBeGreaterThan(0);
    expect(h.tasks.every((t) => t.roles.includes("cashier"))).toBe(true);
    // No owner-only task on the cashier's till.
    const owner = helpFor("/pos", ["owner"], en, null);
    expect(owner.tasks.length).toBeGreaterThanOrEqual(h.tasks.length);
  });

  it("has help for every screen on the menu", () => {
    const without = NAV.map((n) => n.href).filter(
      (href) => helpFor(href, ["owner"], en, null).screens.length === 0,
    );
    expect(without).toEqual([]);
  });

  it("shows a translation entry by entry, and English where there is none yet", () => {
    const local: HelpContent = {
      screens: en.screens.map((s) => ({ ...s, summary: `AR ${s.summary}` })),
      tasks: [],
    };
    const h = helpFor("/pos", ["cashier"], en, local);
    expect(h.screens.every((s) => s.summary.startsWith("AR "))).toBe(true);
    expect(h.tasks.every((t) => !t.title.startsWith("AR "))).toBe(true);
  });

  for (const lang of ["ar", "ckb"]) {
    it(`${lang}: once translated, the same entries in the same order and shape as English`, () => {
      const tr = read(lang);
      if (tr.screens.length === 0 && tr.tasks.length === 0) return;
      expect(tr.screens.map((s) => s.path)).toEqual(en.screens.map((s) => s.path));
      expect(tr.tasks.map((t) => t.id)).toEqual(en.tasks.map((t) => t.id));
      tr.screens.forEach((s, i) =>
        expect(Object.keys(s.who).sort()).toEqual(Object.keys(en.screens[i]!.who).sort()),
      );
      if (lang === "ckb") expect(JSON.stringify(tr)).not.toMatch(/[كيةى]/);
    });
  }
});
