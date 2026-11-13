import { describe, expect, it } from "vitest";
import { NAV, mayOpen, offered, partOn } from "@/lib/auth/routes";

const owner = [
  "cost.view",
  "profit.view",
  "sale.create",
  "payroll.view",
  "stock.transfer",
  "settings.manage",
];

describe("plans and parts (0108)", () => {
  it("a profile from before 0108 names no part off: every part is on", () => {
    expect(partOn(owner, "accounting")).toBe(true);
    expect(mayOpen(owner, "/journals")).toBe(true);
  });

  it("a part that is off hides its screens, whatever the permissions", () => {
    const starter = [...owner, "off:accounting", "off:staff", "off:branches"];
    expect(mayOpen(starter, "/journals")).toBe(false);
    expect(mayOpen(starter, "/accounting")).toBe(false);
    expect(mayOpen(starter, "/payroll")).toBe(false);
    expect(mayOpen(starter, "/inventory/transfers")).toBe(false);
    expect(mayOpen(starter, "/reports")).toBe(true);
    expect(mayOpen(starter, "/pos")).toBe(true);
  });

  it("a supplier with the till off has no till on the menu", () => {
    const supplier = [...owner, "off:till"];
    const menu = NAV.filter((n) => offered(supplier, n)).map((n) => n.href);
    expect(menu).not.toContain("/pos");
    expect(menu).toContain("/inventory");
  });
});
