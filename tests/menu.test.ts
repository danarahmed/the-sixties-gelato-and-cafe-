/**
 * The menu cut for each person's daily work (the simplification round): every
 * screen they may open is still in it, the daily ones first, the rest under
 * More.
 */
import { describe, expect, it } from "vitest";
import { NAV, holdsAny, offered, menuLead, splitMenu } from "@/lib/auth/routes";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions";

const perms = (role: Role) => [...ROLE_PERMISSIONS[role]] as string[];
const menuOf = (role: Role) => {
  const nav = NAV.filter((n) => offered(perms(role), n));
  return { nav, ...splitMenu(perms(role), nav) };
};

describe("the menu cut for each person's daily work", () => {
  it("is cut for the most senior work a person does", () => {
    expect(menuLead(perms("owner"))).toBe("owner");
    expect(menuLead(perms("general_manager"))).toBe("owner");
    expect(menuLead(perms("branch_manager"))).toBe("branch");
    expect(menuLead(perms("accountant"))).toBe("books");
    expect(menuLead(perms("auditor"))).toBe("audit");
    expect(menuLead(perms("purchasing"))).toBe("buying");
    expect(menuLead(perms("cashier"))).toBe("floor");
  });

  it("keeps every screen a person may open, each once", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
      const { nav, daily, more } = menuOf(role);
      expect([...daily, ...more].map((n) => n.href).sort()).toEqual(nav.map((n) => n.href).sort());
    }
  });

  it("shows few screens at first: Today, then at most 16 for the owner, 12 for a branch manager", () => {
    const besidesToday = (role: Role) => menuOf(role).daily.filter((n) => n.href !== "/today");
    expect(besidesToday("owner").length).toBeLessThanOrEqual(16);
    expect(besidesToday("branch_manager").length).toBeLessThanOrEqual(12);
    expect(menuOf("purchasing").daily.map((n) => n.href)).toEqual([
      "/today",
      "/vendors",
      "/purchasing",
      "/inventory",
      "/inventory/transfers",
      "/reports",
    ]);
  });

  it("puts the books under More for a branch manager, and Settings never there for the owner", () => {
    const branch = menuOf("branch_manager").more.map((n) => n.href);
    expect(branch).toContain("/journals");
    expect(branch).toContain("/accounting");
    expect(menuOf("owner").daily.map((n) => n.href)).toContain("/settings");
  });

  it("has no More for a short menu: the cashier, the barista, the counter", () => {
    for (const role of ["cashier", "barista", "inventory_counter"] as Role[])
      expect(menuOf(role).more).toEqual([]);
  });

  it("puts Today first for everyone, and never under More", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
      const { daily, more } = menuOf(role);
      expect(daily[0]?.href, role).toBe("/today");
      expect(more.map((n) => n.href)).not.toContain("/today");
    }
  });

  it("keeps one screen alone out of More", () => {
    const entries = [{ href: "/dashboard" }, { href: "/journals" }];
    expect(splitMenu(perms("owner"), entries).more).toEqual([]);
  });
});
