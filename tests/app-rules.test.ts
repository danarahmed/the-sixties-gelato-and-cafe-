/**
 * The small rules the screens depend on: who lands where, what the menu
 * offers each role, how numbers typed in three scripts are read, and when a
 * trading day starts.
 */
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions.js";
import { NAV, holdsAny, homeFor, isPublicPath } from "@/lib/auth/routes";
import { addDays, dateIn, monthEnd, monthStart, parseDay } from "@/lib/dates";
import { normaliseNumber, positive, signedNonZero } from "@/lib/validation";
import { getBookkeeper } from "@/lib/bookkeeping/rules";

const perms = (role: Role) => [...ROLE_PERMISSIONS[role]];

describe("where each role lands", () => {
  const roles = Object.keys(ROLE_PERMISSIONS) as Role[];

  it.each(roles)("%s lands on a screen they may open", (role) => {
    const home = homeFor(perms(role));
    if (home === "/account") return;
    const entry = NAV.find((n) => n.href === home);
    expect(entry, `${home} is not in the navigation`).toBeDefined();
    expect(holdsAny(perms(role), entry!.anyOf)).toBe(true);
  });

  it("a cashier starts at the till and is not offered the books", () => {
    const offered = NAV.filter((n) => holdsAny(perms("cashier"), n.anyOf)).map((n) => n.href);
    expect(homeFor(perms("cashier"))).toBe("/pos");
    expect(offered).toEqual(["/pos"]);
  });

  it("a counter is offered the count and nothing with a cost on it", () => {
    const offered = NAV.filter((n) => holdsAny(perms("inventory_counter"), n.anyOf)).map(
      (n) => n.href,
    );
    expect(offered).toEqual(["/count"]);
  });

  it("only people who manage settings see Settings", () => {
    const settings = NAV.find((n) => n.href === "/settings")!;
    for (const role of roles) {
      expect(holdsAny(perms(role), settings.anyOf)).toBe(
        ROLE_PERMISSIONS[role].has("settings.manage"),
      );
    }
  });

  it("only sign-in and setup are reachable signed out", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});

describe("numbers as staff type them", () => {
  it("reads Arabic-Indic and Eastern Arabic-Indic digits", () => {
    expect(normaliseNumber("١٢٬٥٠٠")).toBe("12500");
    expect(normaliseNumber("۲۵۰۰")).toBe("2500");
    expect(normaliseNumber("3٫5")).toBe("3.5");
    expect(normaliseNumber(" 12,500 ")).toBe("12500");
  });

  it("keeps amounts exact, as strings", () => {
    expect(positive("Amount").parse("0.1")).toBe("0.1");
    expect(positive("Amount").parse(25000)).toBe("25000");
  });

  it("refuses zero, negatives and junk where a positive amount is needed", () => {
    expect(positive("Amount").safeParse("0").success).toBe(false);
    expect(positive("Amount").safeParse("-5").success).toBe(false);
    expect(positive("Amount").safeParse("1e3").success).toBe(false);
    expect(positive("Amount").safeParse("abc").success).toBe(false);
  });

  it("takes a signed correction but never zero", () => {
    expect(signedNonZero("Change").parse("-250")).toBe("-250");
    expect(signedNonZero("Change").safeParse("0").success).toBe(false);
  });
});

describe("the business's own calendar (audit H-09)", () => {
  it("00:30 in Erbil is still the previous day in UTC, but it is today's trading", () => {
    // 2026-09-23 00:30 Asia/Baghdad = 2026-09-22 21:30 UTC.
    const at = new Date("2026-09-22T21:30:00Z");
    expect(dateIn("UTC", at)).toBe("2026-09-22");
    expect(dateIn("Asia/Baghdad", at)).toBe("2026-09-23");
  });

  it("does calendar arithmetic without a timezone", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(monthStart("2026-09-23")).toBe("2026-09-01");
    expect(monthEnd("2024-02-10")).toBe("2024-02-29");
    expect(parseDay("2026-13-99", "2026-01-01")).toBe("2026-01-01");
    expect(parseDay("not a date", "2026-01-01")).toBe("2026-01-01");
  });
});

describe("expense suggestions", () => {
  const bk = getBookkeeper();

  it("proposes the account from the narration", async () => {
    expect((await bk.categorizeExpense("September shop rent", 400000)).accountCode).toBe("6000");
    expect((await bk.categorizeExpense("generator fuel", 1000)).accountCode).toBe("6200");
  });

  it("never proposes an account an expense may not post to", async () => {
    for (const text of [
      "spoiled milk thrown away",
      "expired cream",
      "talabat commission",
      "something odd",
    ]) {
      const s = await bk.categorizeExpense(text, 1000);
      expect(["5000", "5050", "5300", "5400"]).not.toContain(s.accountCode);
    }
  });

  it("sends stock losses to Inventory instead", async () => {
    const s = await bk.categorizeExpense("spoiled milk thrown away", 1000);
    expect(s.needsReview).toBe(true);
    expect(s.explanation).toMatch(/Inventory/);
  });
});
