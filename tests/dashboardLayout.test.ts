import { describe, expect, it } from "vitest";
import { dashLayout, dashLead, inOrder } from "@/lib/dashboardLayout";

describe("the Dashboard arranged for each role (F4)", () => {
  it("is arranged for the most senior role a person has", () => {
    expect(dashLead(["owner"])).toBe("owner");
    expect(dashLead(["general_manager"])).toBe("owner");
    expect(dashLead(["accountant", "branch_manager"])).toBe("branch");
    expect(dashLead(["auditor"])).toBe("books");
    expect(dashLead(["accountant"])).toBe("books");
  });

  it("puts today first for the owner, and sales first among the figures", () => {
    const l = dashLayout(["owner"], 0);
    expect(l.blocks).toEqual(["today", "needs", "more"]);
    expect(l.figures[0]).toBe("net");
    expect(l.urgent).toBe(false);
  });

  it("puts what needs them first for a branch manager, the hour by hour and the stock ahead", () => {
    const l = dashLayout(["branch_manager"], 0);
    expect(l.blocks[0]).toBe("needs");
    expect(l.main[0]).toBe("hours");
    expect(l.side[0]).toBe("stock");
    expect(l.urgent).toBe(false);
  });

  it("leads with gross profit and yesterday's brief for the books", () => {
    const l = dashLayout(["accountant"], 0);
    expect(l.figures[0]).toBe("profit");
    expect(l.main[0]).toBe("brief");
    expect(l.side[0]).toBe("recent");
  });

  it("brings what needs them to the top for anyone when something is red", () => {
    for (const roles of [["owner"], ["accountant"], ["auditor"]]) {
      const l = dashLayout(roles, 2);
      expect(l.blocks).toEqual(["needs", "today", "more"]);
      expect(l.urgent).toBe(true);
    }
  });

  it("shows every part, each once", () => {
    for (const roles of [["owner"], ["branch_manager"], ["auditor"]]) {
      const l = dashLayout(roles, 1);
      expect([...l.blocks].sort()).toEqual(["more", "needs", "today"]);
      expect([...l.main].sort()).toEqual(["brief", "fortnight", "hours"]);
      expect([...l.side].sort()).toEqual(["recent", "sells", "stock"]);
      expect([...l.figures].sort()).toEqual(["average", "net", "orders", "profit"]);
    }
    expect(inOrder(["b", "a"], { a: 1, b: 2 })).toEqual([2, 1]);
  });
});
