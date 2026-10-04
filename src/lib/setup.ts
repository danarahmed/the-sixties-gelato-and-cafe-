/**
 * Getting set up (round seven): what a café starting from nothing adds, in the
 * order each needs the one before — what it keeps in stock, who it buys from,
 * what it makes, what it sells, where guests sit, who works there — and then
 * its first sale. Each step is done once the café has one; the steps a café
 * does without (no tables, nothing made in the kitchen) can be put aside on
 * the device. The list is the dashboard's while the café is new. Pure: the
 * dashboard and the tests read through here.
 */

export type SetupKey = "items" | "suppliers" | "recipes" | "products" | "tables" | "staff" | "sale";

/** What the café has of each, as the person sees it. */
export interface SetupCounts {
  items: number;
  suppliers: number;
  recipes: number;
  products: number;
  tables: number;
  /** Those working now; and of them, those with no PIN to clock in with. */
  staff: number;
  staffWithoutPin: number;
  sales: number;
  /** The day of the café's first sale, if it has had one. */
  firstSaleOn: string | null;
}

export interface SetupDef {
  key: SetupKey;
  title: string;
  text: string;
  /** The button, and where it opens the form. */
  action: string;
  href: string;
  /** A café may do without it. */
  optional: boolean;
}

export const SETUP: readonly SetupDef[] = [
  {
    key: "items",
    title: "Stock items",
    text: "What you buy and keep, such as milk, sugar and cups, with what is on the shelf today. Paste the whole list from a spreadsheet.",
    action: "Add stock items",
    href: "/inventory#paste-items",
    optional: false,
  },
  {
    key: "suppliers",
    title: "Suppliers",
    text: "Who you buy from, so each delivery and bill has its supplier.",
    action: "Add suppliers",
    href: "/vendors",
    optional: true,
  },
  {
    key: "recipes",
    title: "Recipes",
    text: "What you make in the kitchen, such as a gelato base, and what goes into it.",
    action: "Add recipes",
    href: "/production#new-recipe",
    optional: true,
  },
  {
    key: "products",
    title: "Menu and prices",
    text: "What you sell, at what price, and what each one uses from stock.",
    action: "Add products",
    href: "/products#add-product",
    optional: false,
  },
  {
    key: "tables",
    title: "Tables",
    text: "The tables guests sit at, so a bill stays open while they eat.",
    action: "Add tables",
    href: "/pos#tables",
    optional: true,
  },
  {
    key: "staff",
    title: "Staff and their PINs",
    text: "Who works here, then a PIN for each, to clock in and out at the till.",
    action: "Add staff",
    href: "/staff#add-person",
    optional: true,
  },
  {
    key: "sale",
    title: "The first sale",
    text: "Open the drawer with the money it starts with, and ring up the first order.",
    action: "Open the till",
    href: "/pos",
    optional: false,
  },
];

/** A café is new until a month after its first sale: after that, a step not done is the café's choice. */
export const NEW_FOR_DAYS = 30;

export interface SetupStep extends SetupDef {
  /** How many it has: items, suppliers… (sales for the first sale). */
  count: number;
  done: boolean;
  /** Put aside on this device: the café does without it. */
  skipped: boolean;
  /** The person may add these; if not, someone else does. */
  can: boolean;
  /** The first step neither done nor put aside. */
  next: boolean;
}

const countOf = (c: SetupCounts, key: SetupKey): number => (key === "sale" ? c.sales : c[key]);

/** Each step, as far as the café has come; `can` says which the person may do. */
export function setupSteps(
  counts: SetupCounts,
  can: Record<SetupKey, boolean>,
  skipped: ReadonlySet<string>,
): SetupStep[] {
  let found = false;
  return SETUP.map((d) => {
    const count = countOf(counts, d.key);
    const done = count > 0;
    const off = d.optional && !done && skipped.has(d.key);
    const next = !found && !done && !off;
    if (next) found = true;
    return { ...d, count, done, skipped: off, can: can[d.key], next };
  });
}

/** Whole days from one day to another (YYYY-MM-DD). */
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Whether the dashboard shows the list: while the café is new (no sale yet,
 * or its first within the month), until every step is done or put aside, to
 * someone who may do at least one of the steps left — and not once they have
 * hidden it on this device.
 */
export function setupShown(
  steps: readonly SetupStep[],
  counts: SetupCounts,
  today: string,
  hidden: boolean,
): boolean {
  if (hidden) return false;
  if (counts.firstSaleOn && daysBetween(counts.firstSaleOn, today) > NEW_FOR_DAYS) return false;
  const left = steps.filter((s) => !s.done && !s.skipped);
  return left.length > 0 && left.some((s) => s.can);
}

/** The cookies a device keeps its choices in (read on the server, so the list draws as it stays). */
export const SETUP_SKIP_COOKIE = "setup_skip";
export const SETUP_HIDE_COOKIE = "setup_hidden";

/** The steps a device put aside, from its cookie. */
export function skippedFrom(cookie: string | undefined): Set<string> {
  const keys = new Set<string>(SETUP.map((d) => d.key));
  return new Set((cookie ?? "").split(",").filter((k) => keys.has(k)));
}

/** Every phrase Getting set up shows: each is in the books. */
export const SETUP_PHRASES: readonly string[] = [
  ...SETUP.flatMap((d) => [d.title, d.text, d.action]),
  "Getting set up",
  "Add these in order, and the café is ready to sell.",
  "{done} of {total} done",
  "{n} added",
  "Done",
  "Next",
  "Not needed",
  "Put back",
  "Not needed here",
  "Hide this list",
  "The owner or a manager adds these.",
  "{n} without a PIN yet",
];
