/**
 * The system speaks (0029, the audit's P1-8): alerts and the daily brief as the
 * dashboard shows them. The rules live in the database (alert_conditions); this
 * only reads what they say. Pure: the dashboard, Settings and the tests read
 * through here.
 */
import { addDays } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import { fill, type T } from "@/lib/i18n/core";

/** The brief in English, when no translator is given (the tests, the server's logs). */
const english: T = (key, vars) => fill(key, vars);

export type Urgency = "red" | "orange";
export type Confidence = "high" | "medium" | "low";

/** Every rule of the audit's §7 the system checks today. */
export const RULE_LABEL: Record<string, string> = {
  cash_negative: "Cash below zero",
  drawer_uncounted: "Drawer not counted",
  count_stale: "Stock count left open",
  running_out: "Running out",
  below_minimum: "Below its reorder level",
  price_confirmed: "Delivery price confirmed",
  no_recipe: "Sold with no recipe",
  no_cost: "No cost yet",
  margin: "Margin",
  waste_spike: "Waste above its usual",
  exceptions_person: "Exceptions by one person",
  card_not_banked: "Card money not banked",
  platform_not_received: "Platform money not received",
  bill_due: "Supplier bill due",
  price_typo: "Possible price typo",
  duplicate_payment: "Possible duplicate payment",
};

export function ruleLabel(rule: string): string {
  return RULE_LABEL[rule] ?? rule;
}

/** How sure a rule is: a ledger fact, a judgement on some history, or an early sign. */
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Sure",
  medium: "Fairly sure",
  low: "Early sign",
};

/** An alert as the dashboard reads it (current_alerts). */
export interface Alert {
  id: string;
  rule: string;
  subject: string;
  urgency: Urgency;
  title: string;
  why: string | null;
  action: string | null;
  confidence: Confidence;
  link: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  ackNote: string | null;
  /** Set only while the snooze lasts. */
  snoozedUntil: string | null;
  snoozedBy: string | null;
  snoozeReason: string | null;
}

const byUrgency = (a: Alert, b: Alert) =>
  a.urgency === b.urgency
    ? a.firstSeenAt.localeCompare(b.firstSeenAt) || a.title.localeCompare(b.title)
    : a.urgency === "red"
      ? -1
      : 1;

/**
 * 🔴 and 🟠: waiting for someone, red first. 🔵: answered with a note, or
 * snoozed with a reason — still open until the condition clears.
 */
export function sortAlerts(list: Alert[]): { needsYou: Alert[]; answered: Alert[] } {
  const waiting = (a: Alert) => !a.acknowledgedAt && !a.snoozedUntil;
  return {
    needsYou: list.filter(waiting).sort(byUrgency),
    answered: list.filter((a) => !waiting(a)).sort(byUrgency),
  };
}

/**
 * Orange alerts of one rule, together once there are two or more — twenty
 * ingredients without a cost read as one row to open, not twenty. Red ones
 * are never folded away. In the order the rules first appear.
 */
export function groupByRule(list: Alert[]): { rule: string; alerts: Alert[] }[] {
  const groups: { rule: string; alerts: Alert[] }[] = [];
  for (const a of list) {
    const g = groups.find((x) => x.rule === a.rule);
    if (g) g.alerts.push(a);
    else groups.push({ rule: a.rule, alerts: [a] });
  }
  return groups;
}

/** 🔴 when anything red waits, 🟠 when only orange does, 🟢 when nothing does. */
export function overall(list: Alert[]): "red" | "orange" | "green" {
  const { needsYou } = sortAlerts(list);
  if (needsYou.some((a) => a.urgency === "red")) return "red";
  return needsYou.length ? "orange" : "green";
}

/** Nobody answers, or snoozes, an alert about their own exceptions (the database refuses it too). */
export function canAnswer(a: Alert, myId: string): boolean {
  return !(a.rule === "exceptions_person" && a.subject === myId);
}

/** A snooze runs to a day from tomorrow to 30 days ahead; a week is offered. */
export function snoozeRange(today: string): { min: string; max: string; suggested: string } {
  return { min: addDays(today, 1), max: addDays(today, 30), suggested: addDays(today, 7) };
}

// ------------------------------------------------------------ thresholds

export interface Threshold {
  key: string;
  label: string;
  value: number;
  default: number;
  min: number;
  max: number;
  whole: boolean;
}

/** The thresholds in the order Settings shows them. */
export const THRESHOLD_ORDER = [
  "margin_target_percent",
  "lead_time_days",
  "count_stale_hours",
  "card_days",
  "platform_days",
  "bill_due_days",
  "waste_spike_factor",
  "waste_spike_min",
  "exceptions_count",
  "exceptions_share_percent",
  "price_typo_factor",
] as const;

/** What each threshold is, for the audit trail's words. */
export const THRESHOLD_LABEL: Record<string, string> = {
  lead_time_days: "Days a delivery takes (vendors without their own)",
  margin_target_percent: "Margin target (%)",
  count_stale_hours: "Hours a stock count may stay open",
  waste_spike_factor: "Waste spike: times a usual week",
  waste_spike_min: "Waste spike: at least (IQD)",
  exceptions_count: "Exceptions by one person in 7 days",
  exceptions_share_percent: "Exceptions as a share of their sales (%)",
  card_days: "Days card money takes to reach the bank",
  platform_days: "Days a delivery platform takes to pay",
  bill_due_days: "Days before a bill is due to warn",
  price_typo_factor: "Price typo: times another channel's price",
};

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const nOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : n(v));

/** alert_thresholds(), in Settings' order. */
export function parseThresholds(raw: unknown): Threshold[] {
  const o = (raw ?? {}) as Record<string, Record<string, unknown>>;
  const keys = [
    ...THRESHOLD_ORDER.filter((k) => k in o),
    ...Object.keys(o).filter((k) => !(THRESHOLD_ORDER as readonly string[]).includes(k)),
  ];
  return keys.map((key) => {
    const x = o[key] ?? {};
    return {
      key,
      label: String(x.label ?? THRESHOLD_LABEL[key] ?? key),
      value: n(x.value),
      default: n(x.default),
      min: n(x.min),
      max: n(x.max),
      whole: Boolean(x.whole),
    };
  });
}

/**
 * What the owner typed, checked as the database will check it: empty is the
 * default again. Returns the changes to send, or the first problem.
 */
export function thresholdChanges(
  list: Threshold[],
  typed: Record<string, string>,
): { ok: true; changes: Record<string, number | null> } | { ok: false; error: string } {
  const changes: Record<string, number | null> = {};
  for (const t of list) {
    const raw = (typed[t.key] ?? "").trim();
    if (raw === "") {
      if (t.value !== t.default) changes[t.key] = null;
      continue;
    }
    const v = Number(raw);
    if (!Number.isFinite(v)) return { ok: false, error: `${t.label}: enter a number` };
    if (v < t.min || v > t.max || (t.whole && !Number.isInteger(v))) {
      return {
        ok: false,
        error: `${t.label}: enter a ${t.whole ? "whole number" : "number"} from ${t.min} to ${t.max}`,
      };
    }
    if (v !== t.value) changes[t.key] = v;
  }
  return { ok: true, changes };
}

// ---------------------------------------------------------- the daily brief

export interface DailyBrief {
  day: string;
  facts: {
    sales: number;
    netSales: number;
    voids: number;
    voided: number;
    refunds: number;
    refunded: number;
    discounts: number;
    discounted: number;
    waste: number;
    drawerCounts: number;
    drawerDifference: number;
    uncostedSales: number;
  };
  calculations: {
    costOfGoods: number;
    costOfGoodsPercent: number | null;
    grossProfit: number;
    grossMarginPercent: number | null;
    sameDayLastWeek: number;
    changeFromLastWeekPercent: number | null;
    usualForTheWeekday: number | null;
  };
  alerts: {
    urgency: Urgency;
    title: string;
    action: string | null;
    link: string | null;
    acknowledged: boolean;
  }[];
  red: number;
  orange: number;
  recommendations: string[];
}

/** daily_brief()'s JSON, as the screen reads it. */
export function parseBrief(raw: unknown): DailyBrief {
  const o = (raw ?? {}) as Record<string, unknown>;
  const f = (o.facts ?? {}) as Record<string, unknown>;
  const c = (o.calculations ?? {}) as Record<string, unknown>;
  const alerts = Array.isArray(o.alerts) ? (o.alerts as Record<string, unknown>[]) : [];
  return {
    day: String(o.day ?? ""),
    facts: {
      sales: n(f.sales),
      netSales: n(f.net_sales),
      voids: n(f.voids),
      voided: n(f.voided),
      refunds: n(f.refunds),
      refunded: n(f.refunded),
      discounts: n(f.discounts),
      discounted: n(f.discounted),
      waste: n(f.waste),
      drawerCounts: n(f.drawer_counts),
      drawerDifference: n(f.drawer_difference),
      uncostedSales: n(f.uncosted_sales),
    },
    calculations: {
      costOfGoods: n(c.cost_of_goods),
      costOfGoodsPercent: nOrNull(c.cost_of_goods_percent),
      grossProfit: n(c.gross_profit),
      grossMarginPercent: nOrNull(c.gross_margin_percent),
      sameDayLastWeek: n(c.same_day_last_week),
      changeFromLastWeekPercent: nOrNull(c.change_from_last_week_percent),
      usualForTheWeekday: nOrNull(c.usual_for_the_weekday),
    },
    alerts: alerts.map((a) => ({
      urgency: a.urgency === "red" ? "red" : "orange",
      title: String(a.title ?? ""),
      action: a.action == null ? null : String(a.action),
      link: a.link == null ? null : String(a.link),
      acknowledged: Boolean(a.acknowledged),
    })),
    red: n(o.red),
    orange: n(o.orange),
    recommendations: Array.isArray(o.recommendations) ? o.recommendations.map(String) : [],
  };
}

/** What happened, and nothing else: the brief's facts as lines, in the reader's language. */
export function briefFacts(b: DailyBrief, t: T = english): string[] {
  const f = b.facts;
  if (f.sales === 0 && f.netSales === 0 && f.voids === 0 && f.refunds === 0) {
    return [
      t("No sales."),
      ...(f.waste ? [t("Waste {amount}.", { amount: fmtIQD(f.waste) })] : []),
      ...(f.drawerCounts ? [drawerLine(f.drawerDifference, t)] : []),
    ];
  }
  const out = [
    f.sales === 1
      ? t("Net sales {amount} over 1 sale.", { amount: fmtIQD(f.netSales) })
      : t("Net sales {amount} over {n} sales.", { amount: fmtIQD(f.netSales), n: f.sales }),
  ];
  if (f.voids)
    out.push(
      f.voids === 1
        ? t("1 void ({amount}).", { amount: fmtIQD(f.voided) })
        : t("{n} voids ({amount}).", { n: f.voids, amount: fmtIQD(f.voided) }),
    );
  if (f.refunds)
    out.push(
      f.refunds === 1
        ? t("1 refund ({amount}).", { amount: fmtIQD(f.refunded) })
        : t("{n} refunds ({amount}).", { n: f.refunds, amount: fmtIQD(f.refunded) }),
    );
  if (f.discounts)
    out.push(
      f.discounts === 1
        ? t("1 discount ({amount}).", { amount: fmtIQD(f.discounted) })
        : t("{n} discounts ({amount}).", { n: f.discounts, amount: fmtIQD(f.discounted) }),
    );
  if (f.waste) out.push(t("Waste {amount}.", { amount: fmtIQD(f.waste) }));
  out.push(f.drawerCounts ? drawerLine(f.drawerDifference, t) : t("The drawer was not counted."));
  if (f.uncostedSales)
    out.push(
      f.uncostedSales === 1
        ? t("1 sale with something costed at nothing (Reports → Uncosted sales).")
        : t("{n} sales with something costed at nothing (Reports → Uncosted sales).", {
            n: f.uncostedSales,
          }),
    );
  return out;
}

function drawerLine(difference: number, t: T): string {
  if (difference === 0) return t("The drawer was counted, and was right.");
  const amount = fmtIQD(Math.abs(difference));
  return difference < 0
    ? t("The drawer was counted {amount} short.", { amount })
    : t("The drawer was counted {amount} over.", { amount });
}

const pct = (v: number) => `${Number(v.toFixed(1))}%`;

/**
 * What follows from the facts: the brief's calculations as lines, in the
 * reader's language. `weekday` is the day's English name ("Monday").
 */
export function briefCalculations(b: DailyBrief, weekday: string, t: T = english): string[] {
  const c = b.calculations;
  const day = t(weekday);
  const out: string[] = [];
  if (b.facts.netSales > 0) {
    out.push(
      c.costOfGoodsPercent === null
        ? t("Cost of goods {amount}.", { amount: fmtIQD(c.costOfGoods) })
        : t("Cost of goods {amount}, {pct} of sales.", {
            amount: fmtIQD(c.costOfGoods),
            pct: pct(c.costOfGoodsPercent),
          }),
    );
    out.push(
      c.grossMarginPercent === null
        ? t("Gross profit {amount}, after waste and every other cost of sales.", {
            amount: fmtIQD(c.grossProfit),
          })
        : t("Gross profit {amount} ({pct}), after waste and every other cost of sales.", {
            amount: fmtIQD(c.grossProfit),
            pct: pct(c.grossMarginPercent),
          }),
    );
  }
  if (c.sameDayLastWeek > 0) {
    const ch = c.changeFromLastWeekPercent;
    out.push(
      ch === null
        ? t("Last {weekday}: {amount}.", { weekday: day, amount: fmtIQD(c.sameDayLastWeek) })
        : t("Last {weekday}: {amount} ({change} since).", {
            weekday: day,
            amount: fmtIQD(c.sameDayLastWeek),
            change: `${ch > 0 ? "+" : ""}${pct(ch)}`,
          }),
    );
  }
  if (c.usualForTheWeekday !== null) {
    out.push(
      t("A usual {weekday} (the four before): {amount}.", {
        weekday: day,
        amount: fmtIQD(c.usualForTheWeekday),
      }),
    );
  }
  if (!out.length) out.push(t("Nothing to calculate: there were no sales."));
  return out;
}

/**
 * What to do: the red alerts nobody has answered yet (as the database words
 * them: shown through msg()), or that nothing is urgent.
 */
export function briefToDo(b: DailyBrief, t: T = english): string[] {
  if (b.recommendations.length) return b.recommendations;
  const orange = b.alerts.filter((a) => a.urgency === "orange" && !a.acknowledged).length;
  if (orange === 1) return [t("Nothing urgent. 1 orange alert waits for a quiet moment.")];
  if (orange)
    return [t("Nothing urgent. {n} orange alerts wait for a quiet moment.", { n: orange })];
  return [t("Nothing to do.")];
}
