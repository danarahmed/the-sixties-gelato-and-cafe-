/**
 * Batches, their use-by dates and lots, and the day's plan (0046): the words
 * the screens give them, and the sums they show. Pure: the pages, the forms
 * and the tests read through here.
 */

import { dateIn } from "@/lib/dates";

/** Where a lot stands against its use-by. */
export type LotStatus = "expired" | "today" | "soon" | "good";

/** What the plan says of a recipe. */
export type PlanStatus = "make" | "enough" | "no_history";

export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  expired: "Past its use-by",
  today: "Due today",
  soon: "Due within a day",
  good: "Good",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  make: "To make",
  enough: "Enough on hand",
  no_history: "Not enough history",
};

/** What became of a batch, as batch_reconciliation tells it, in the order it is read. */
export const STORY_PARTS = [
  "sold",
  "used",
  "lost",
  "moved",
  "counted",
  "corrected",
  "left",
] as const;
export type StoryPart = (typeof STORY_PARTS)[number];
export type Story = Record<StoryPart | "made", number>;

export const STORY_LABEL: Record<StoryPart | "made", string> = {
  made: "Made",
  sold: "Sold (less voids and refunds back on the shelf)",
  used: "Used in other batches",
  lost: "Lost",
  counted: "Found or missing on a count",
  // Sent to another of the café's places and not yet arrived (0054).
  moved: "On its way to another place",
  corrected: "Corrected",
  left: "Still in stock",
};

/** A lot's story from the database's JSON: every part a number. */
export function storyFrom(v: unknown): Story | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (k: string) => Number(o[k] ?? 0) || 0;
  return {
    made: n("made"),
    sold: n("sold"),
    used: n("used"),
    lost: n("lost"),
    counted: n("counted"),
    moved: n("moved"),
    corrected: n("corrected"),
    left: n("left"),
  };
}

/**
 * Whether a batch is accounted for: made = sold + used + lost + left, less
 * what counts, moves and corrections added (they are signed: a count that
 * found some missing is negative).
 */
export function storyAddsUp(s: Story): boolean {
  const out = s.sold + s.used + s.lost + s.moved - s.counted - s.corrected + s.left;
  return Math.abs(s.made - out) < 1e-6;
}

/** How long something keeps, in whole days when it is days. */
export function keepsLabel(hours: number | null): { text: string; vars: { n: number } } | null {
  if (!hours || hours <= 0) return null;
  return hours % 24 === 0
    ? { text: "keeps {n} day(s)", vars: { n: hours / 24 } }
    : { text: "keeps {n} hour(s)", vars: { n: hours } };
}

/** The hours a shelf life is, from what the form was given; null when none. */
export function keepsHours(qty: string, unit: "hours" | "days"): number | null | "bad" {
  const s = qty.trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "bad";
  const hours = unit === "days" ? n * 24 : n;
  if (!Number.isInteger(hours) || hours < 1 || hours > 8760) return "bad";
  return hours;
}

/** A shelf life as the form shows it: in days when it is whole days. */
export function keepsFields(hours: number | null): { qty: string; unit: "hours" | "days" } {
  if (!hours) return { qty: "", unit: "days" };
  return hours % 24 === 0
    ? { qty: String(hours / 24), unit: "days" }
    : { qty: String(hours), unit: "hours" };
}

/** The weekdays, Monday first (the plan's weekday 1 to 7): phrases in the books. */
export const WEEKDAY_NAME = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** The weekday a moment falls on in the café's time, by its name: a phrase in the books. */
export function weekdayOf(iso: string, timezone: string): (typeof WEEKDAY_NAME)[number] {
  const day = dateIn(timezone, new Date(iso));
  return WEEKDAY_NAME[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]!;
}

/** A movement of a batch's lot, as the batch's page names it. */
export const LOT_MOVEMENT_LABEL = {
  made: "Made",
  unmade: "Batch cancelled",
  sold: "Sale",
  unsold: "Back from a sale (void or refund)",
  used: "Used in a batch",
  unused: "Back from a batch cancelled",
  lost: "Lost",
  unlost: "Loss taken back",
  missing: "Missing on a count",
  found: "Found on a count",
  moved: "Moved",
  // Between the café's places (0054).
  sent: "Sent to another place",
  arrived: "Arrived from another place",
  returned: "Back from a transfer cancelled",
  corrected: "Corrected",
} as const;

/**
 * What a movement of a lot was, from the kind the stock card gives it, which
 * way it went, and what it was for.
 */
export function lotMovementLabel(kind: string, qty: number, referenceType?: string | null): string {
  const out = qty < 0;
  switch (kind) {
    case "made":
      return out ? LOT_MOVEMENT_LABEL.unmade : LOT_MOVEMENT_LABEL.made;
    case "sold":
      return out ? LOT_MOVEMENT_LABEL.sold : LOT_MOVEMENT_LABEL.unsold;
    case "batches":
      return out ? LOT_MOVEMENT_LABEL.used : LOT_MOVEMENT_LABEL.unused;
    case "wasted":
      return out ? LOT_MOVEMENT_LABEL.lost : LOT_MOVEMENT_LABEL.unlost;
    case "counted":
      return out ? LOT_MOVEMENT_LABEL.missing : LOT_MOVEMENT_LABEL.found;
    case "transferred":
      if (referenceType === "stock_transfer_cancel") return LOT_MOVEMENT_LABEL.returned;
      if (referenceType === "stock_transfer")
        return out ? LOT_MOVEMENT_LABEL.sent : LOT_MOVEMENT_LABEL.arrived;
      return LOT_MOVEMENT_LABEL.moved;
    default:
      return LOT_MOVEMENT_LABEL.corrected;
  }
}

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
function oneOf<K extends string>(v: unknown, keys: readonly K[], fallback: K): K {
  return keys.includes(v as K) ? (v as K) : fallback;
}

export interface PlanIngredient {
  itemId: string;
  item: string;
  baseUnit: string;
  needed: number;
  onHand: number;
  short: number;
}

export interface PlanRecipe {
  recipeId: string;
  recipe: string;
  itemId: string;
  item: string;
  baseUnit: string;
  batchYield: number;
  yieldUnit: string;
  status: PlanStatus;
  /** Days since the item's first movement; null when it has none. */
  historyDays: number | null;
  /** The weeks judged by (4 to 8); null when there are not enough. */
  weeks: number | null;
  /** Each same weekday judged by, the latest first, and what was used on it. */
  days: { day: string; used: number }[];
  /** What was used on that weekday, on average; null without enough history. */
  demand: number | null;
  onHand: number;
  /** What is in lots due before the day is out. */
  due: number;
  good: number;
  toMake: number | null;
  batches: number;
  makes: number;
  ingredients: PlanIngredient[];
}

export interface ProductionPlan {
  day: string;
  /** 1 Monday … 7 Sunday. */
  weekday: number;
  location: string;
  recipes: PlanRecipe[];
  /** What all the batches to make need together, and what is short. */
  ingredients: PlanIngredient[];
}

const ingredientsFrom = (v: unknown): PlanIngredient[] =>
  list(v).map((i) => ({
    itemId: str(i.item_id),
    item: str(i.item),
    baseUnit: str(i.base_unit),
    needed: num(i.needed),
    onHand: num(i.on_hand),
    short: num(i.short),
  }));

export function planFrom(v: unknown): ProductionPlan {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    day: str(o.day),
    weekday: num(o.weekday),
    location: str(o.location),
    recipes: list(o.recipes).map((r) => ({
      recipeId: str(r.recipe_id),
      recipe: str(r.recipe),
      itemId: str(r.item_id),
      item: str(r.item),
      baseUnit: str(r.base_unit),
      batchYield: num(r.batch_yield),
      yieldUnit: str(r.yield_unit),
      status: oneOf(r.status, ["make", "enough", "no_history"] as const, "no_history"),
      historyDays: numOrNull(r.history_days),
      weeks: numOrNull(r.weeks),
      days: list(r.days).map((d) => ({ day: str(d.day), used: num(d.used) })),
      demand: numOrNull(r.demand),
      onHand: num(r.on_hand),
      due: num(r.due),
      good: num(r.good),
      toMake: numOrNull(r.to_make),
      batches: num(r.batches),
      makes: num(r.makes),
      ingredients: ingredientsFrom(r.ingredients),
    })),
    ingredients: ingredientsFrom(o.ingredients),
  };
}

export interface ProductionLot {
  lotId: string;
  lot: string;
  itemId: string;
  item: string;
  baseUnit: string;
  batchId: string | null;
  batchNo: number | null;
  madeAt: string | null;
  useBy: string | null;
  left: number;
  status: LotStatus;
}

export function lotsFrom(v: unknown): ProductionLot[] {
  return list(v).map((l) => ({
    lotId: str(l.lot_id),
    lot: str(l.lot),
    itemId: str(l.item_id),
    item: str(l.item),
    baseUnit: str(l.base_unit),
    batchId: strOrNull(l.batch_id),
    batchNo: numOrNull(l.batch_no),
    madeAt: strOrNull(l.made_at),
    useBy: strOrNull(l.use_by),
    left: num(l.left),
    status: oneOf(l.status, ["expired", "today", "soon", "good"] as const, "good"),
  }));
}

export interface LotMovement {
  at: string;
  kind: string;
  qty: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  by: string | null;
  /** Where it happened (0054). */
  place: string | null;
}

export interface BatchReconciliation {
  batchId: string;
  batchNo: number;
  status: string;
  recipeId: string;
  recipe: string;
  itemId: string;
  item: string;
  baseUnit: string;
  enteredUnit: string;
  batches: number;
  planned: number;
  actual: number;
  madeAt: string;
  recordedAt: string;
  madeBy: string | null;
  useBy: string | null;
  lateReason: string | null;
  note: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  lot: string | null;
  /** Null for a batch made before lots (0046). */
  story: Story | null;
  movements: LotMovement[];
}

export function reconciliationFrom(v: unknown): BatchReconciliation {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    batchId: str(o.batch_id),
    batchNo: num(o.batch_no),
    status: str(o.status),
    recipeId: str(o.recipe_id),
    recipe: str(o.recipe),
    itemId: str(o.item_id),
    item: str(o.item),
    baseUnit: str(o.base_unit),
    enteredUnit: str(o.entered_unit) || str(o.base_unit),
    batches: num(o.batches),
    planned: num(o.planned),
    actual: num(o.actual),
    madeAt: str(o.made_at),
    recordedAt: str(o.recorded_at),
    madeBy: strOrNull(o.made_by),
    useBy: strOrNull(o.use_by),
    lateReason: strOrNull(o.late_reason),
    note: strOrNull(o.note),
    cancelledAt: strOrNull(o.cancelled_at),
    cancelReason: strOrNull(o.cancel_reason),
    lot: strOrNull(o.lot),
    story: storyFrom(o.story),
    movements: list(o.movements).map((m) => ({
      at: str(m.at),
      kind: str(m.kind),
      qty: num(m.qty),
      referenceType: strOrNull(m.reference_type),
      referenceId: strOrNull(m.reference_id),
      reason: strOrNull(m.reason),
      by: strOrNull(m.by),
      place: strOrNull(m.place),
    })),
  };
}

export interface ReportBatch {
  batchId: string;
  batchNo: number;
  recipe: string;
  item: string;
  baseUnit: string;
  madeAt: string;
  status: string;
  planned: number;
  actual: number;
  /** What came out of what was planned, in %; null when nothing was planned. */
  yieldPct: number | null;
  value: number;
  useBy: string | null;
  story: Story | null;
}

export function productionReportFrom(v: unknown): ReportBatch[] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return list(o.batches).map((b) => ({
    batchId: str(b.batch_id),
    batchNo: num(b.batch_no),
    recipe: str(b.recipe),
    item: str(b.item),
    baseUnit: str(b.base_unit),
    madeAt: str(b.made_at),
    status: str(b.status),
    planned: num(b.planned),
    actual: num(b.actual),
    yieldPct: numOrNull(b.yield_pct),
    value: num(b.value),
    useBy: strOrNull(b.use_by),
    story: storyFrom(b.story),
  }));
}

/** Every word this file gives a screen: each is a phrase in the books. */
export const PRODUCTION_PHRASES: readonly string[] = [
  ...Object.values(LOT_STATUS_LABEL),
  ...Object.values(PLAN_STATUS_LABEL),
  ...Object.values(STORY_LABEL),
  ...Object.values(LOT_MOVEMENT_LABEL),
  ...WEEKDAY_NAME,
  "keeps {n} day(s)",
  "keeps {n} hour(s)",
];
