/**
 * Which screens each person may open, by the permissions their roles grant.
 *
 * This decides what the navigation shows and where a person lands. It is a
 * convenience, not the control: every read is filtered by row-level security
 * and every write is re-checked by the database function that performs it,
 * so a hidden screen reached by typing its address shows nothing it should not.
 */
import type { Permission } from "@domain/auth/permissions.js";

export interface NavEntry {
  href: string;
  key: string;
  /** Dictionary key of the heading the entry sits under (none for the first). */
  group: string | null;
  /** The screen is offered to anyone holding at least one of these. */
  anyOf: Permission[];
}

const REVENUE = "nav.group.revenue";
const SPENDING = "nav.group.spending";
const OPERATIONS = "nav.group.operations";
const BOOKS = "nav.group.books";

export const NAV: NavEntry[] = [
  { group: null, href: "/dashboard", key: "nav.dashboard", anyOf: ["profit.view"] },

  { group: REVENUE, href: "/sales", key: "nav.sales", anyOf: ["cost.view"] },
  { group: REVENUE, href: "/platforms", key: "nav.platforms", anyOf: ["cost.view"] },
  // Who buys from the café, and their points (0050).
  { group: REVENUE, href: "/customers", key: "nav.customers", anyOf: ["customer.view"] },

  { group: SPENDING, href: "/vendors", key: "nav.vendors", anyOf: ["cost.view"] },
  { group: SPENDING, href: "/expenses", key: "nav.expenses", anyOf: ["cost.view"] },
  { group: SPENDING, href: "/purchasing", key: "nav.purchasing", anyOf: ["cost.view"] },
  // Salaries, a month at a time, and advances (0049).
  { group: SPENDING, href: "/payroll", key: "nav.payroll", anyOf: ["payroll.view"] },

  { group: OPERATIONS, href: "/pos", key: "nav.pos", anyOf: ["sale.create"] },
  // The start and the end of the day, step by step: whoever opens and closes the day.
  { group: OPERATIONS, href: "/start-of-day", key: "nav.startOfDay", anyOf: ["day.close"] },
  { group: OPERATIONS, href: "/end-of-day", key: "nav.endOfDay", anyOf: ["day.close"] },
  { group: OPERATIONS, href: "/orders", key: "nav.orders", anyOf: ["cost.view"] },
  { group: OPERATIONS, href: "/products", key: "nav.products", anyOf: ["cost.view"] },
  {
    group: OPERATIONS,
    href: "/inventory",
    key: "nav.inventory",
    anyOf: ["cost.view", "waste.record"],
  },
  {
    group: OPERATIONS,
    href: "/count",
    key: "nav.count",
    anyOf: ["inventory.count", "inventory.count.view_expected", "inventory.adjust.approve"],
  },
  // What each item used against its recipes, between two counts (0039).
  { group: OPERATIONS, href: "/inventory/usage", key: "nav.usage", anyOf: ["cost.view"] },
  // Stock sent between the café's places (0054).
  {
    group: OPERATIONS,
    href: "/inventory/transfers",
    key: "nav.transfers",
    anyOf: ["stock.transfer"],
  },
  {
    group: OPERATIONS,
    href: "/production",
    key: "nav.production",
    anyOf: ["cost.view", "production.record"],
  },
  // Who works here, the schedule and the hours (0049).
  {
    group: OPERATIONS,
    href: "/staff",
    key: "nav.staff",
    anyOf: ["staff.manage", "attendance.edit", "payroll.view"],
  },

  { group: BOOKS, href: "/journals", key: "nav.journals", anyOf: ["cost.view"] },
  { group: BOOKS, href: "/accounting", key: "nav.chart", anyOf: ["cost.view"] },
  { group: BOOKS, href: "/reports", key: "nav.reports", anyOf: ["cost.view"] },
  { group: BOOKS, href: "/audit", key: "nav.audit", anyOf: ["audit.view"] },
  { group: BOOKS, href: "/settings", key: "nav.settings", anyOf: ["settings.manage"] },
];

export function holdsAny(permissions: readonly string[], anyOf: readonly string[]): boolean {
  return anyOf.some((p) => permissions.includes(p));
}

/**
 * The menu's entry for the screen open: the one whose address is the screen's
 * or the nearest one above it, so Usage (/inventory/usage) lights Usage alone,
 * not Inventory too, and What to buy (/purchasing/buying-list) lights
 * Purchasing.
 */
export function activeHref(pathname: string | null, hrefs: readonly string[]): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const h of hrefs) {
    if ((pathname === h || pathname.startsWith(`${h}/`)) && h.length > (best?.length ?? 0)) {
      best = h;
    }
  }
  return best;
}

/** Where a person starts: the first screen their work begins on. */
export function homeFor(permissions: readonly string[]): string {
  if (permissions.includes("profit.view")) return "/dashboard";
  if (permissions.includes("sale.create")) return "/pos";
  if (permissions.includes("inventory.count")) return "/count";
  if (permissions.includes("waste.record")) return "/inventory";
  if (permissions.includes("cost.view")) return "/reports";
  return "/account";
}

/** Addresses anyone may open without signing in. */
export const PUBLIC_PATHS = ["/login", "/auth", "/setup"];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
