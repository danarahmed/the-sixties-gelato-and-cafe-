/**
 * The kinds of loss, their accounts, the giveaways at the till, and the loss
 * report (0047–0048, release V): the words the screens give them and the
 * shapes they read. Pure: the pages, the forms and the tests read through here.
 */

/** Each kind of loss, what it means in a few words, and the account it is charged to. */
export const LOSS_KINDS = [
  {
    kind: "waste",
    label: "Waste",
    explain: "Thrown away: made wrong, or not fit to sell.",
    account: "5300",
  },
  {
    kind: "spoilage",
    label: "Spoilage",
    explain: "Gone off before its time: milk turned, fruit bruised.",
    account: "5300",
  },
  {
    kind: "expired",
    label: "Expired",
    explain: "Past its use-by: it is not to be sold.",
    account: "5300",
  },
  {
    kind: "damaged",
    label: "Damaged",
    explain: "Broken, spilt or dropped.",
    account: "5300",
  },
  {
    kind: "melt_evaporation",
    label: "Melt / evaporation",
    explain: "Melted in the display, or dried out.",
    account: "5300",
  },
  {
    kind: "production_waste",
    label: "Production waste",
    explain: "Lost making a batch: a base spilt, a pan burnt.",
    account: "5310",
  },
  {
    kind: "preparation_waste",
    label: "Preparation waste",
    explain: "Lost preparing to sell: fruit trimmed, milk left in the jug.",
    account: "5310",
  },
  {
    kind: "staff_consumption",
    label: "Staff consumption",
    explain: "Eaten or drunk by the staff.",
    account: "6110",
  },
  {
    kind: "complimentary",
    label: "Complimentary",
    explain: "Given to a customer free, on the house.",
    account: "6610",
  },
  {
    kind: "sampling",
    label: "Sampling",
    explain: "Given to taste, to sell more.",
    account: "6620",
  },
] as const;

export type LossKind = (typeof LOSS_KINDS)[number]["kind"];
export const LOSS_KIND_KEYS = LOSS_KINDS.map((k) => k.kind) as unknown as readonly [
  LossKind,
  ...LossKind[],
];

/** The accounts losses are charged to, as the chart names them. */
export const LOSS_ACCOUNT_NAME: Record<string, string> = {
  "5300": "Waste & spoilage",
  "5310": "Production and preparation loss",
  "6110": "Staff meals",
  "6610": "Complimentary items",
  "6620": "Marketing samples",
};

export function lossKind(kind: string) {
  return LOSS_KINDS.find((k) => k.kind === kind) ?? null;
}

/** What is given away at the till, as the till names it. */
export const GIVEAWAY_KINDS = [
  {
    kind: "staff_consumption",
    label: "Staff meal",
    explain: "For the staff, eaten or drunk here.",
  },
  { kind: "complimentary", label: "On the house", explain: "Free for a customer." },
  { kind: "sampling", label: "Sample", explain: "A taste, to sell more." },
] as const;
export type GiveawayKind = (typeof GIVEAWAY_KINDS)[number]["kind"];

export function giveawayLabel(kind: string): string {
  return GIVEAWAY_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

/** Whether a failure asks for a manager: now, with their PIN, or by saving it to wait (0040). */
export const NEEDS_APPROVAL = /needs a manager's approval: ask one to approve it now/;
/** Or a manager's approval of taking more than the books hold (0040). */
export const NEEDS_STOCK_APPROVAL = /is in stock: a manager approves using more than that/;

/** A loss waiting for a manager, whole (0048), or one movement from before. */
export interface LossWaiting {
  movementId: string;
  lossId: string | null;
  at: string;
  itemId: string | null;
  /** The item, or the product (with its size when it has several). */
  item: string;
  kind: string;
  qty: number;
  /** The unit an item was lost in; none for a product. */
  unit: string | null;
  /** Only for those who see costs. */
  value: number | null;
  account: string | null;
  batchNo: number | null;
  reason: string | null;
  recordedById: string | null;
  recordedBy: string | null;
}

export function lossesWaitingFrom(v: unknown): LossWaiting[] {
  return list(v).map((r) => ({
    movementId: str(r.movement_id),
    lossId: strOrNull(r.loss_id),
    at: str(r.at),
    itemId: strOrNull(r.item_id),
    item: str(r.item),
    kind: str(r.kind),
    qty: num(r.qty),
    unit: strOrNull(r.unit),
    value: numOrNull(r.value),
    account: strOrNull(r.account),
    batchNo: numOrNull(r.batch_no),
    reason: strOrNull(r.reason),
    recordedById: strOrNull(r.recorded_by_id),
    recordedBy: strOrNull(r.recorded_by),
  }));
}

/** What a loss took, as it was given: an item or a product, with its add-ons or batch. */
export interface LossWhat {
  name: string;
  size: string | null;
  qty: number;
  unit: string | null;
  batchNo: number | null;
  addons: string[];
}

export interface LossRow {
  lossId: string | null;
  movementId: string | null;
  at: string;
  kind: string;
  account: string;
  value: number;
  reason: string | null;
  person: string | null;
  approvedBy: string | null;
  pending: boolean;
  reversed: boolean;
  atTill: boolean;
  turnNo: number | null;
  what: LossWhat[];
}

export interface LossReport {
  from: string;
  to: string;
  total: {
    value: number;
    count: number;
    pendingCount: number;
    pendingValue: number;
    reversedCount: number;
    reversedValue: number;
  };
  byKind: {
    kind: string;
    account: string;
    accountName: string | null;
    count: number;
    value: number;
  }[];
  byItem: {
    itemId: string;
    item: string;
    unit: string;
    qty: number;
    value: number;
    count: number;
  }[];
  byPerson: { personId: string | null; person: string | null; count: number; value: number }[];
  byDay: { day: string; count: number; value: number }[];
  giveaways: { kind: string; count: number; value: number }[];
  losses: LossRow[];
}

export function lossReportFrom(v: unknown): LossReport {
  const o = obj(v);
  const t = obj(o.total);
  return {
    from: str(o.from),
    to: str(o.to),
    total: {
      value: num(t.value),
      count: num(t.count),
      pendingCount: num(t.pending_count),
      pendingValue: num(t.pending_value),
      reversedCount: num(t.reversed_count),
      reversedValue: num(t.reversed_value),
    },
    byKind: list(o.by_kind).map((k) => ({
      kind: str(k.kind),
      account: str(k.account),
      accountName: strOrNull(k.account_name),
      count: num(k.count),
      value: num(k.value),
    })),
    byItem: list(o.by_item).map((k) => ({
      itemId: str(k.item_id),
      item: str(k.item),
      unit: str(k.unit),
      qty: num(k.qty),
      value: num(k.value),
      count: num(k.count),
    })),
    byPerson: list(o.by_person).map((k) => ({
      personId: strOrNull(k.person_id),
      person: strOrNull(k.person),
      count: num(k.count),
      value: num(k.value),
    })),
    byDay: list(o.by_day).map((k) => ({
      day: str(k.day),
      count: num(k.count),
      value: num(k.value),
    })),
    giveaways: list(o.giveaways).map((k) => ({
      kind: str(k.kind),
      count: num(k.count),
      value: num(k.value),
    })),
    losses: list(o.losses).map((l) => ({
      lossId: strOrNull(l.loss_id),
      movementId: strOrNull(l.movement_id),
      at: str(l.at),
      kind: str(l.kind),
      account: str(l.account),
      value: num(l.value),
      reason: strOrNull(l.reason),
      person: strOrNull(l.person),
      approvedBy: strOrNull(l.approved_by),
      pending: l.pending === true,
      reversed: l.reversed === true,
      atTill: l.at_till === true,
      turnNo: numOrNull(l.turn_no),
      what: list(l.what).map((w) => ({
        name: str(w.name),
        size: strOrNull(w.size),
        qty: num(w.qty),
        unit: strOrNull(w.unit),
        batchNo: numOrNull(w.batch_no),
        addons: Array.isArray(w.addons) ? (w.addons as unknown[]).map((a) => str(a)) : [],
      })),
    })),
  };
}

/** The share of a report's losses each kind makes, in whole percent (0 when nothing was lost). */
export function kindShare(value: number, total: number): number {
  return total > 0 ? Math.round((100 * value) / total) : 0;
}

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Every word this file gives a screen: each is a phrase in the books. */
export const LOSS_PHRASES: readonly string[] = [
  ...LOSS_KINDS.flatMap((k) => [k.label, k.explain]),
  ...Object.values(LOSS_ACCOUNT_NAME),
  ...GIVEAWAY_KINDS.flatMap((k) => [k.label, k.explain]),
];
