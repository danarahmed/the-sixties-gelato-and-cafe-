/**
 * The café's rules (0040, release O), as Settings → Rules shows them: what
 * each is for, in the café's words, and how a value typed for one is read.
 * The database keeps the rules, checks every value again, and applies them.
 */

export const RULE_ORDER = [
  "daily_sales_target",
  "labour_target_percent",
  "discount_cap_percent",
  "discount_round_to",
  "refund_approval_over",
  "waste_approval_over",
  "waste_approval_window",
  "negative_stock",
  "usd_rate_max_age_hours",
  "usd_round_to",
  "po_approve_up_to",
  "overtime_percent",
  "late_after_minutes",
  "clocked_in_alert_hours",
  "payday",
  "loyalty",
  "loyalty_point_per",
  "loyalty_reward_points",
  "loyalty_reward_value",
] as const;
export type RuleKey = (typeof RULE_ORDER)[number];
export type ScopeType = "business" | "role" | "location" | "item_type" | "item";

/** Each rule's name: a phrase, shown through t(). */
export const RULE_LABEL: Record<RuleKey, string> = {
  daily_sales_target: "A day's net sales target",
  labour_target_percent: "Labour cost the café aims for (% of net sales)",
  discount_cap_percent: "Discounts a manager approves",
  discount_round_to: "Discounts rounded to",
  refund_approval_over: "Refunds a second person approves",
  waste_approval_over: "Losses a manager approves",
  waste_approval_window: "One person's losses are added up over",
  negative_stock: "Using more stock than the books hold",
  usd_rate_max_age_hours: "A dollar rate is used for",
  usd_round_to: "Dollars are counted in dinars to the nearest",
  po_approve_up_to: "Purchase orders a manager approves, up to",
  overtime_percent: "Overtime is paid at (% of an hour's pay)",
  late_after_minutes: "Late, or leaving early, by more than",
  clocked_in_alert_hours: "Someone still clocked in after",
  payday: "Salaries are paid on the day of the month",
  loyalty: "Customers earn points, and take rewards",
  loyalty_point_per: "A customer earns a point for every",
  loyalty_reward_points: "A reward takes",
  loyalty_reward_value: "A reward is worth",
};

/** What each rule does: a phrase, shown through t(). */
export const RULE_HELP: Record<RuleKey, string> = {
  daily_sales_target:
    "The net sales the café aims to make in a day, after discounts and refunds. The dashboard measures today against it, and says where today should be by now from how a usual day of its kind sells. 0 is no target.",
  labour_target_percent:
    "The share of net sales the café means to pay its people. Staff checks the week's schedule against it, and Reports → Staffed when busy? shows each week's and each part of the day's, from the hours on the clock at each person's pay. Only those who see pay see it. 0 is no target.",
  discount_cap_percent:
    "Over this share of the bill, a discount needs a manager's name and PIN on the till; a manager gives it themselves. Set it for a role to let that role give more, or less.",
  discount_round_to:
    "A discount given as a percentage is rounded to the nearest step (half-way rounds up); an amount is taken as typed.",
  refund_approval_over:
    "A refund of more than this needs a second person's name and PIN. Set it for a role to trust that role with more.",
  waste_approval_over:
    "A loss over this — on its own, added to the person's other losses, or to the item's losses today — needs a manager: their PIN on the spot, or it waits for their approval under Needs you.",
  waste_approval_window:
    "An item's losses by anyone are always added up over the day. A person's are added up as chosen here.",
  negative_stock:
    "When a sale, a loss, a batch or a correction would use more than the books hold. By default, what is made here is refused and everything else is allowed with a red alert. “Allowed, with no alert” is for chosen items only.",
  usd_rate_max_age_hours:
    "The till takes dollars at the rate a manager set, for this many hours after it was set. Older, dollars are refused until a manager sets today's on Sales → Dollars.",
  usd_round_to:
    "Dollars handed over are worth their number times the rate, rounded to the nearest step (half-way rounds up). The change is given in dinars.",
  po_approve_up_to:
    "A purchase order is approved by an owner or manager whose limit covers its total. Set it for a role: by default a branch manager approves up to 250,000, and the owner and the general manager any order.",
  overtime_percent:
    "Hours beyond a person's standard hours in a day are paid at this share of their hour's pay: 150% is half as much again. Set on Staff for one person, it is theirs instead.",
  late_after_minutes:
    "Clocking in this long after the shift starts is late, and clocking out this long before it ends is leaving early. Both are shown on Staff and Payroll; pay is deducted only when a manager says so.",
  clocked_in_alert_hours:
    "Someone still clocked in after this many hours is an alert: they may have forgotten to clock out. A manager corrects the hours on Staff.",
  payday:
    "The day of the month salaries are due for the month before. From then, a payroll not approved or not paid is an alert, and red a week later.",
  loyalty:
    "A customer on a sale earns points on what it comes to, once paid, and takes a reward off a bill at the till. Off, customers are still kept, and their points too, but none are earned or taken.",
  loyalty_point_per:
    "A point for every this many dinars a sale comes to, after its discount; a void takes them back, and a refund those of what it gives back.",
  loyalty_reward_points:
    "The points one reward takes. A customer takes as many rewards as their points come to, if the bill comes to at least what they take off.",
  loyalty_reward_value:
    "What one reward takes off a bill: it is the bill's discount (4100), taken whole.",
};

/** The choices of a choice rule: phrases, shown through t(). */
export const CHOICE_LABEL: Record<string, string> = {
  block: "Refused",
  approve: "A manager approves it",
  alert: "Allowed, with a red alert",
  allow: "Allowed, with no alert",
  entry: "Each loss on its own",
  session: "Their cash session, or their day",
  day: "The day",
  on: "On",
  off: "Off",
};

/** What a row of a rule applies to: phrases, shown through t(). */
export const SCOPE_LABEL: Record<ScopeType, string> = {
  business: "The whole café",
  role: "A role",
  location: "A branch",
  item_type: "A kind of item",
  item: "One item",
};

/** Every phrase above, for the check that each is in every language. */
export const RULE_PHRASES: readonly string[] = [
  ...Object.values(RULE_LABEL),
  ...Object.values(RULE_HELP),
  ...Object.values(CHOICE_LABEL),
  ...Object.values(SCOPE_LABEL),
];

export interface RuleDefinition {
  key: RuleKey;
  /** hours: how long something lasts (0043); minutes, and a day of the month (0049); points (0050). */
  kind: "percent" | "amount" | "choice" | "hours" | "minutes" | "day" | "points";
  min: number | null;
  max: number | null;
  whole: boolean;
  choices: string[];
  scopes: ScopeType[];
}

export interface RuleRow {
  key: RuleKey;
  scopeType: ScopeType;
  scopeId: string;
  /** An item's or a branch's name; a role and a kind of item are named by the screen. */
  scopeName: string | null;
  value: number | string;
  /** Nobody has set it: the café's default. */
  isDefault: boolean;
  reason: string | null;
  setBy: string | null;
  setAt: string | null;
}

export interface RuleChange {
  key: RuleKey;
  scopeType: ScopeType;
  scopeId: string;
  scopeName: string | null;
  /** Null: it was not set before. */
  oldValue: number | string | null;
  /** Null: back to the default. */
  newValue: number | string | null;
  reason: string;
  changedBy: string | null;
  changedAt: string;
}

export interface BusinessRules {
  definitions: RuleDefinition[];
  rows: RuleRow[];
  history: RuleChange[];
}

const isKey = (k: unknown): k is RuleKey => RULE_ORDER.includes(k as RuleKey);
const RULE_KINDS: readonly RuleDefinition["kind"][] = [
  "percent",
  "amount",
  "choice",
  "hours",
  "minutes",
  "day",
  "points",
];
const scalar = (v: unknown): number | string | null =>
  v === null || v === undefined ? null : typeof v === "number" ? v : String(v);

/** The rules as list_business_rules returns them, in the order the screen shows them. */
export function parseBusinessRules(raw: unknown): BusinessRules {
  const d = (raw ?? {}) as Record<string, unknown>;
  const defs = (d.definitions ?? {}) as Record<string, Record<string, unknown>>;
  const definitions: RuleDefinition[] = RULE_ORDER.filter((k) => defs[k]).map((key) => {
    const x = defs[key] ?? {};
    return {
      key,
      kind: RULE_KINDS.includes(x.kind as RuleDefinition["kind"])
        ? (x.kind as RuleDefinition["kind"])
        : "amount",
      min: x.min == null ? null : Number(x.min),
      max: x.max == null ? null : Number(x.max),
      whole: Boolean(x.whole),
      choices: Array.isArray(x.choices) ? x.choices.map(String) : [],
      scopes: Array.isArray(x.scopes) ? (x.scopes.map(String) as ScopeType[]) : ["business"],
    };
  });
  const rows: RuleRow[] = ((d.rows ?? []) as Record<string, unknown>[])
    .filter((r) => isKey(r.key))
    .map((r) => ({
      key: r.key as RuleKey,
      scopeType: String(r.scope_type) as ScopeType,
      scopeId: String(r.scope_id ?? ""),
      scopeName: r.scope_name == null ? null : String(r.scope_name),
      value: scalar(r.value) ?? "",
      isDefault: Boolean(r.is_default),
      reason: r.reason == null ? null : String(r.reason),
      setBy: r.set_by == null ? null : String(r.set_by),
      setAt: r.set_at == null ? null : String(r.set_at),
    }));
  const history: RuleChange[] = ((d.history ?? []) as Record<string, unknown>[])
    .filter((r) => isKey(r.key))
    .map((r) => ({
      key: r.key as RuleKey,
      scopeType: String(r.scope_type) as ScopeType,
      scopeId: String(r.scope_id ?? ""),
      scopeName: r.scope_name == null ? null : String(r.scope_name),
      oldValue: scalar(r.old_value),
      newValue: scalar(r.new_value),
      reason: String(r.reason ?? ""),
      changedBy: r.changed_by == null ? null : String(r.changed_by),
      changedAt: String(r.changed_at),
    }));
  return { definitions, rows, history };
}

/** A value typed for a rule, as the database takes it, or what is wrong with it. */
export function typedRuleValue(
  def: RuleDefinition,
  typed: string,
): { ok: true; value: number | string } | { ok: false; error: string } {
  const s = typed.trim();
  if (def.kind === "choice") {
    return def.choices.includes(s)
      ? { ok: true, value: s }
      : { ok: false, error: "That is not one of this rule's choices" };
  }
  const n = Number(s.replace(/,/g, ""));
  if (s === "" || !Number.isFinite(n)) return { ok: false, error: "Enter a number" };
  if ((def.min !== null && n < def.min) || (def.max !== null && n > def.max))
    return { ok: false, error: "Enter a number within the rule's limits" };
  if (def.whole && !Number.isInteger(n)) return { ok: false, error: "Enter a whole number" };
  return { ok: true, value: n };
}
