/**
 * Use-by for everything that goes off (0098): the shapes the screens read,
 * and the words they give them. Pure: the pages, the till and the tests read
 * through here.
 */

export type ExpiryMode = "none" | "keeps_days" | "exact_date";
export type UseByStatus = "expired" | "today" | "soon" | "good";

/** Each way an item keeps, in the order the item's page offers them: phrases. */
export const EXPIRY_MODES: { mode: ExpiryMode; label: string; hint: string }[] = [
  { mode: "none", label: "It doesn't go off", hint: "Cups, sugar, bottles: no use-by." },
  {
    mode: "keeps_days",
    label: "It keeps some days from delivery",
    hint: "Each delivery is used by that many days after it comes.",
  },
  {
    mode: "exact_date",
    label: "Each delivery has its own date",
    hint: "Whoever receives it types the date printed on the pack.",
  },
];

export interface UseByLot {
  lotId: string;
  lot: string;
  itemId: string;
  item: string;
  unit: string;
  kind: "batch" | "delivery";
  batchNo: number | null;
  /** The day it came, or was made, at the café. */
  cameOn: string | null;
  useBy: string | null;
  /** The use-by as a day at the café (a delivery's date; a batch's day). */
  useByOn: string | null;
  left: number;
  status: UseByStatus;
}

export interface UseByList {
  leadHours: number;
  canEdit: boolean;
  lots: UseByLot[];
  /** Items that have not said how they keep (shown to those who set items up). */
  unsetItems: { itemId: string; name: string }[];
  /** Batch recipes with neither a shelf life nor "doesn't go off". */
  unsetRecipes: { recipeId: string; name: string }[];
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
const STATUSES: UseByStatus[] = ["expired", "today", "soon", "good"];

export function readUseByList(raw: unknown): UseByList {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    leadHours: num(r.lead_hours) || 24,
    canEdit: Boolean(r.can_edit),
    lots: arr(r.lots).map((l) => ({
      lotId: str(l.lot_id),
      lot: str(l.lot),
      itemId: str(l.item_id),
      item: str(l.item),
      unit: str(l.unit),
      kind: l.kind === "batch" ? "batch" : "delivery",
      batchNo: l.batch_no === null || l.batch_no === undefined ? null : num(l.batch_no),
      cameOn: strOrNull(l.came_on),
      useBy: strOrNull(l.use_by),
      useByOn: strOrNull(l.use_by_on),
      left: num(l.left),
      status: STATUSES.includes(l.status as UseByStatus) ? (l.status as UseByStatus) : "good",
    })),
    unsetItems: arr(r.unset_items).map((i) => ({ itemId: str(i.item_id), name: str(i.name) })),
    unsetRecipes: arr(r.unset_recipes).map((i) => ({
      recipeId: str(i.recipe_id),
      name: str(i.name),
    })),
  };
}

/** The lists Today shows: what to take off the shelf, what goes off today, what soon. */
export function groupUseBy(lots: UseByLot[]): {
  expired: UseByLot[];
  today: UseByLot[];
  soon: UseByLot[];
} {
  return {
    expired: lots.filter((l) => l.status === "expired"),
    today: lots.filter((l) => l.status === "today"),
    soon: lots.filter((l) => l.status === "soon"),
  };
}

export type TillMark = "expired" | "soon";

/** The till's marks, by product size: past its use-by, or to sell first. */
export function tillMarksFrom(raw: unknown): Map<string, { state: TillMark; item: string }> {
  const out = new Map<string, { state: TillMark; item: string }>();
  for (const m of arr(raw)) {
    const state = m.state === "expired" ? "expired" : m.state === "soon" ? "soon" : null;
    if (!state) continue;
    out.set(str(m.variant_id), { state, item: str(m.item) });
  }
  return out;
}

/** A delivery line's use-by, as the form offers it: the date its days give, from today. */
export function suggestedUseBy(
  mode: ExpiryMode | null,
  keepsDays: number | null,
  today: string,
): string {
  if (mode !== "keeps_days" || !keepsDays || keepsDays < 1) return "";
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + keepsDays);
  return d.toISOString().slice(0, 10);
}

/** What a delivery line needs before it is received: an exact-date item's date, never one past. */
export function checkUseBy(
  mode: ExpiryMode | null,
  useBy: string,
  today: string,
): "needs_date" | "past" | null {
  if (mode === "exact_date" && !useBy) return "needs_date";
  if (useBy && useBy < today) return "past";
  return null;
}

/** The database's refusal when the café refuses what is past its use-by (0098). */
export const NEEDS_EXPIRED_APPROVAL = /is past its use-by: a manager approves selling it/;

/** Each state's words on the use-by list: phrases, shown through t(). */
export const USE_BY_STATUS_LABEL: Record<UseByStatus, string> = {
  expired: "Past its use-by",
  today: "Goes off today",
  soon: "Goes off soon",
  good: "Good",
};

/** Every phrase above, for the check that each is in every language. */
export const USE_BY_PHRASES: readonly string[] = [
  ...EXPIRY_MODES.flatMap((m) => [m.label, m.hint]),
  ...Object.values(USE_BY_STATUS_LABEL),
];
