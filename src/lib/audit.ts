/**
 * The audit trail in words (0027, the audit's P1-1): what happened, what it
 * was about, and each value before and after, with ids given their names.
 * Pure: the screen and the CSV both read through here, and the tests too.
 *
 * The words are English, and each is a phrase of src/lib/i18n/phrases/reports.ts
 * (the groups, what happened, the fields, the values and subjects written
 * here): the CSV keeps the English, and the screen says them in the reader's
 * language through t(), subjectIn() and valueIn().
 */
import { BUILT_IN_LANGUAGES, type Msg, type T } from "@/lib/i18n/core";
import { itemTypeLabel, roleLabel } from "@/lib/format";
import { SHOP_CHANNELS, channelName } from "@/lib/channels";
import { RULE_LABEL, THRESHOLD_LABEL, ruleLabel } from "@/lib/alerts";

/** A stored JSON value, as the database wrote it. */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

/** Names for the ids the trail refers to: items, products, suppliers, people… */
export type Names = ReadonlyMap<string, string>;

/**
 * What the trail can be narrowed to: each group is a set of action prefixes.
 * Each label is a phrase, which the screen says through t() (i18n-ignore: the
 * checker would take it for English written into a screen).
 */
export const AUDIT_GROUPS = [
  { key: "prices", label: "Prices", prefixes: ["price."] }, // i18n-ignore
  {
    key: "menu",
    label: "Products & recipes", // i18n-ignore
    prefixes: ["product.", "product_variant.", "product_category.", "recipe."],
  },
  {
    key: "items",
    label: "Stock items & opening stock", // i18n-ignore
    prefixes: ["item.", "item_unit.", "inventory.opening"],
  },
  { key: "suppliers", label: "Suppliers & deliveries", prefixes: ["supplier.", "purchase."] }, // i18n-ignore
  {
    key: "stock",
    label: "Counts, corrections & batches", // i18n-ignore
    prefixes: ["inventory.adjust", "inventory.count.", "production."],
  },
  {
    key: "sales",
    label: "Sales, bills, discounts & approvals", // i18n-ignore
    prefixes: ["sale.", "bill.", "approval."],
  },
  { key: "cash", label: "Cash & the drawer", prefixes: ["cash.", "drawer."] }, // i18n-ignore
  {
    key: "settlements",
    label: "Card & platform settlements", // i18n-ignore
    prefixes: ["card.", "platform.settlement", "platform.settlement_cancel"],
  },
  { key: "books", label: "Books & periods", prefixes: ["journal.", "period.", "legacy."] }, // i18n-ignore
  { key: "alerts", label: "Alerts answered", prefixes: ["alert."] }, // i18n-ignore
  {
    key: "settings",
    label: "Settings, places, platforms & people", // i18n-ignore
    prefixes: [
      "business.",
      "location.",
      "member.",
      "platform.create",
      "platform.setup",
      "platform.update",
      "language.",
    ],
  },
] as const;

export type AuditGroupKey = (typeof AUDIT_GROUPS)[number]["key"];

export function auditGroup(key: string | undefined) {
  return AUDIT_GROUPS.find((g) => g.key === key) ?? null;
}

const ACTION_LABEL: Record<string, string> = {
  "price.set": "Price set",
  "price.update": "Price changed in the database",
  "price.cancel": "Scheduled price withdrawn",
  "product.no_stock": "Marked as using no stock",
  "recipe.change": "Recipe changed",
  "recipe.cancel": "Scheduled recipe withdrawn",
  "recipe.batch.create": "Batch recipe added",
  "recipe.batch.change": "Batch recipe changed",
  "inventory.opening": "Opening stock recorded",
  "inventory.adjust": "Stock corrected",
  "inventory.count.approve": "Stock count approved",
  "inventory.count.cancel": "Stock count cancelled",
  "production.cancel": "Batch cancelled",
  "purchase.price_confirmed": "Delivery price confirmed",
  "sale.void": "Sale voided",
  "sale.refund": "Sale refunded",
  "sale.discount": "Discount given",
  "bill.cancel": "Open bill cancelled",
  "bill.discount": "Discount on an open bill",
  "bill.reduce": "Printed bill reduced",
  "bill.line_remove": "Items taken off an open bill",
  "bill.split": "Open bill split",
  "approval.granted": "Approved with a manager's PIN",
  "approval.refused": "Wrong PIN for an approval",
  "cash.move": "Cash moved",
  "drawer.count": "Drawer counted",
  "card.settlement": "Card takings settled",
  "card.settlement_cancel": "Card settlement cancelled",
  "platform.settlement": "Platform payout recorded",
  "platform.settlement_cancel": "Platform payout cancelled",
  "platform.create": "Delivery platform added",
  "platform.setup": "Delivery platform's packaging and prices copied",
  "platform.update": "Delivery platform changed",
  "language.add": "Language added",
  "language.update": "Language changed",
  "language.words": "The café's words for phrases changed",
  "journal.reverse": "Journal reversed",
  "journal.control_correction": "Owner's correction posted",
  "legacy.post_unposted": "Old record posted",
  "period.locked": "Period locked",
  "period.open": "Period reopened",
  "member.invite": "Person invited",
  "member.roles": "Roles changed",
  "member.activate": "Person given access again",
  "member.deactivate": "Person's access removed",
  "member.pin_set": "Approval PIN set",
  "alert.acknowledge": "Alert answered",
  "alert.snooze": "Alert snoozed",
  "business.clean_start": "Trial records cleared (clean start)",
  "business.reset_test_data": "Test records cleared",
};

/**
 * What each table is, for the changes the database records itself. Each
 * "{table} {verb}" it makes ("Stock item changed") is a phrase in full.
 */
const TABLE_LABEL: Record<string, string> = {
  product: "Product",
  product_variant: "What the till sells",
  product_category: "Category",
  item: "Stock item",
  item_unit: "Pack unit",
  supplier: "Supplier",
  business: "Business settings",
  location: "Location",
};
const VERB: Record<string, string> = { create: "added", update: "changed", delete: "deleted" };

/** "Price set", "Stock item changed", or the action itself when it is new. */
export function actionLabel(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const dot = action.lastIndexOf(".");
  const table = TABLE_LABEL[action.slice(0, dot)];
  const verb = VERB[action.slice(dot + 1)];
  return table && verb ? `${table} ${verb}` : action;
}

const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  name_ar: "Arabic name",
  name_ckb: "Kurdish name",
  price: "Price",
  channel: "Channel",
  variant: "Product",
  product_variant_id: "Product",
  product_id: "Product",
  effective_from: "From",
  effective_to: "Until",
  location_id: "Location",
  is_active: "In use",
  is_favourite: "Favourite",
  item_type: "Type",
  base_unit_code: "Base unit",
  dimension: "Measured by",
  min_level_base: "Reorder level",
  par_level_base: "Par level",
  max_level_base: "Most to hold",
  safety_stock_base: "Safety stock",
  returnable_to_stock: "Back on the shelf when refunded",
  contact: "What they supply",
  phone: "Phone",
  code: "Unit",
  label: "Label", // i18n-ignore: a phrase, like every field's name here
  factor_to_base: "Holds (base units)",
  item_id: "Item",
  item: "Item",
  category_id: "Category",
  sort_order: "Order on the till",
  image_url: "Photo",
  description: "Description",
  resale_item_id: "Sold as bought",
  no_stock_reason: "Uses no stock because",
  lines: "Ingredients",
  yield: "One batch makes",
  unit: "Unit",
  qty: "Quantity",
  value: "Value",
  receipt_no: "Receipt",
  discount_round_to: "Round % discounts to",
  discount_cap_percent: "Discounts a manager approves, over (%)",
  bill_prefix: "Bill numbers start",
  waste_approval_threshold: "Waste needs approval over",
  prevent_negative_stock: "Refuse sales below zero stock",
  timezone: "Time zone",
  currency_code: "Currency",
  default_locale: "Language",
  kind: "Kind",
  roles: "Roles",
  reason: "Reason",
  alert_settings: "Alert thresholds",
  lead_time_days: "Days a delivery takes",
  rule: "Alert",
  title: "What it said", // i18n-ignore: a phrase, like every field's name here
  until: "Until",
  from: "From",
  to: "To",
  till: "Taken by card at the till",
  terminal: "The terminal's total",
  received: "Reached the bank",
  fee: "Card fee",
  difference: "Difference",
  platform: "Platform",
  reference: "Statement",
  order_count: "Orders paid out",
  orders: "Their value",
  payout: "Paid out",
  commission: "Commission",
  fees: "Fees",
  not_posted: "On lines not posted",
  platform_code: "Short name",
  names: "In other languages",
  set_up_like: "Set up like",
  packaging_lines: "Recipe lines given its packaging",
  prices_copied: "Prices copied",
};

/**
 * Keys that are bookkeeping, not what anyone changed. (A key not named above
 * reads as itself, "Track expiry"; those the trail records are phrases too.)
 */
const NOISE = new Set(["id", "business_id", "created_at", "created_by", "updated_at"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fieldLabel(key: string): string {
  if (FIELD_LABEL[key]) return FIELD_LABEL[key];
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const isObj = (v: Json | undefined): v is Obj =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** A stored value, as a person reads it. */
export function showValue(v: Json | undefined, key: string, names: Names): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  if (typeof v === "string") {
    if (UUID.test(v)) return names.get(v) ?? `${v.slice(0, 8)}…`;
    if (key === "channel") return names.get(`channel:${v}`) ?? channelName([], v);
    if (key === "rule") return ruleLabel(v);
    if (key === "item_type") return itemTypeLabel(v);
    return v;
  }
  if (Array.isArray(v)) {
    // A recipe's ingredients: "Golden beans 100 g, Golden cup 1 each".
    if (v.every((x) => isObj(x) && ("item" in x || "item_id" in x))) {
      return v
        .map((x) => {
          const o = x as Obj;
          const item = showValue(o.item ?? o.item_id, "item", names);
          const unit =
            typeof (o.unit ?? o.unit_code) === "string" ? ` ${o.unit ?? o.unit_code}` : "";
          const qty = o.qty ?? o.quantity;
          const only = Array.isArray(o.channels)
            ? ` (${o.channels.map((c) => showValue(c, "channel", names)).join(", ")})`
            : "";
          return `${item} ${showValue(qty, "qty", names)}${unit}${only}`;
        })
        .join(", ");
    }
    if (key === "roles") return v.map((r) => roleLabel(String(r))).join(", ");
    return v.map((x) => showValue(x, key, names)).join(", ");
  }
  // A platform's names in other languages (0031): "ar ليزو, ckb لێزۆ".
  if (key === "names") {
    const set = Object.entries(v);
    return set.length ? set.map(([k, x]) => `${k} ${String(x)}`).join(", ") : "—";
  }
  // The alert thresholds the owner set (0029): "Margin target (%) 65"; none, the defaults.
  if (key === "alert_settings") {
    const set = Object.entries(v);
    return set.length
      ? set.map(([k, x]) => `${THRESHOLD_LABEL[k] ?? k} ${showValue(x, k, names)}`).join(", ")
      : "the defaults";
  }
  return JSON.stringify(v);
}

export interface Change {
  field: string;
  /** Empty for a record added: there was nothing before. */
  before: string;
  /** Empty for a record deleted or withdrawn. */
  after: string;
}

/**
 * Each value that changed, before and after. A record added lists what it was
 * given; one deleted, what it held; one changed, only what changed.
 */
export function describeChanges(
  before: Json | undefined,
  after: Json | undefined,
  names: Names,
): Change[] {
  const b = isObj(before) ? before : null;
  const a = isObj(after) ? after : null;
  if (!b && !a) return [];
  const out: Change[] = [];
  const keys = [...new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])].filter(
    (k) => !NOISE.has(k),
  );
  for (const k of keys) {
    const bv = b?.[k];
    const av = a?.[k];
    if (b && a) {
      if (JSON.stringify(bv ?? null) === JSON.stringify(av ?? null)) continue;
      out.push({
        field: fieldLabel(k),
        before: showValue(bv, k, names),
        after: showValue(av, k, names),
      });
    } else if (a) {
      if (av === null || av === false || av === "") continue;
      out.push({ field: fieldLabel(k), before: "", after: showValue(av, k, names) });
    } else {
      if (bv === null || bv === false || bv === "") continue;
      out.push({ field: fieldLabel(k), before: showValue(bv, k, names), after: "" });
    }
  }
  return out;
}

const short = (id: string | null) => (id ? `${id.slice(0, 8)}…` : "");
const str = (v: Json | undefined): string | null =>
  typeof v === "string" || typeof v === "number" ? String(v) : null;

/** What a row is about, by name where the trail can tell. */
export function subjectOf(
  entityType: string,
  entityId: string | null,
  before: Json | undefined,
  after: Json | undefined,
  names: Names,
): string {
  const b = isObj(before) ? before : {};
  const a = isObj(after) ? after : {};
  const pick = (k: string) => str(a[k]) ?? str(b[k]);
  const named = (id: string | null) => (id ? (names.get(id) ?? null) : null);
  switch (entityType) {
    case "channel_price": {
      const variant = pick("variant") ?? pick("product_variant_id");
      const channel = pick("channel");
      const what = named(variant) ?? "A price";
      return channel ? `${what}, ${showValue(channel, "channel", names)}` : what;
    }
    case "item_unit": {
      const item = named(pick("item_id")) ?? "An item";
      return `${item}: ${pick("code") ?? "a unit"}`;
    }
    case "business":
      return "Business settings";
    case "inventory_movement":
      return named(pick("item")) ?? "Stock";
    case "goods_receipt":
      return pick("receipt_no") ? `Receipt ${pick("receipt_no")}` : "A delivery";
    case "recipe_version":
      return named(pick("recipe_id")) ?? "A recipe";
    case "sales_order":
      return `Sale ${short(entityId)}`;
    case "pos_tab":
      return `Open bill ${short(entityId)}`;
    case "purchase_invoice":
      return `Supplier bill ${pick("invoice_no") ?? short(entityId)}`;
    case "journal_entry":
      return pick("journal_no") ? `Journal ${pick("journal_no")}` : `Journal ${short(entityId)}`;
    case "alert":
      return pick("rule") ? ruleLabel(pick("rule") as string) : "An alert";
    case "card_settlement":
      return pick("from") && pick("to")
        ? `Card takings ${pick("from")} to ${pick("to")}`
        : "Card takings";
    case "app_language":
      return pick("name") ?? `Language ${entityId ?? ""}`.trim();
    case "platform_settlement":
      return pick("reference")
        ? `${pick("platform") ?? "Platform"} statement ${pick("reference")}`
        : "A platform statement";
    default:
      return (
        named(entityId) ??
        pick("name") ??
        `${fieldLabel(entityType)}${entityId ? ` ${short(entityId)}` : ""}`
      );
  }
}

// ------------------------------------------- in the reader's language

/** What subjectOf says where it has no name to give. */
const SUBJECT_WORDS = new Set([
  "A price",
  "An item",
  "Business settings",
  "Stock",
  "A delivery",
  "A recipe",
  "An alert",
  "Card takings",
  "A platform statement",
]);

/** An id shown short, as subjectOf shows it: "1a2b3c4d…". */
const SHORT_ID = "[0-9a-f]{8}…";

/** subjectOf's sentences with a value in them: how each reads, its phrase, and its values' names. */
const SUBJECTS: [RegExp, string, string[]][] = [
  [new RegExp(`^Sale (${SHORT_ID})$`), "Sale {id}", ["id"]],
  [new RegExp(`^Open bill (${SHORT_ID})$`), "Open bill {id}", ["id"]],
  [/^Receipt (\S*\d\S*)$/, "Receipt {no}", ["no"]],
  [/^Supplier bill (.+)$/, "Supplier bill {no}", ["no"]],
  [new RegExp(`^Journal (\\d+|${SHORT_ID})$`), "Journal {no}", ["no"]],
  [/^Language ([a-z]{2,3}(?:-[a-z0-9]{2,8})?)$/, "Language {code}", ["code"]],
  [
    /^Card takings (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/,
    "Card takings {from} to {to}",
    ["from", "to"],
  ],
];

/** One of the shop's own channels, by the English name the trail gives it, as the reader calls it. */
function channelIn(name: string, t: T): string {
  const code = SHOP_CHANNELS.find((c) => channelName([], c) === name);
  return code ? channelName([], code, "en", t) : name;
}

/**
 * What a line of the trail is about, as the screen shows it: subjectOf's own
 * words in the reader's language, and a name, a number or a code as it is.
 */
export function subjectIn(subject: string, action: string, t: T, msg: Msg): string {
  if (SUBJECT_WORDS.has(subject)) return t(subject);
  if (action.startsWith("alert.")) return msg(subject);
  for (const [re, phrase, keys] of SUBJECTS) {
    const m = re.exec(subject);
    if (m) return t(phrase, Object.fromEntries(keys.map((k, i) => [k, m[i + 1] ?? ""])));
  }
  if (action.startsWith("platform.settlement")) {
    const m = /^(.+) statement (.+)$/.exec(subject);
    // A statement whose platform the trail could not name says "Platform".
    if (m)
      return t("{platform} statement {reference}", {
        platform: m[1] === "Platform" ? t("Platform") : m[1]!,
        reference: m[2]!,
      });
  }
  // A price: the product (or "A price") and the channel.
  if (action.startsWith("price.") && subject.includes(", ")) {
    const at = subject.lastIndexOf(", ");
    const what = subject.slice(0, at);
    return `${what === "A price" ? t(what) : what}, ${channelIn(subject.slice(at + 2), t)}`;
  }
  // A pack unit: the item (or "An item") and its code (or "a unit").
  if (action.startsWith("item_unit.") && subject.includes(": ")) {
    const at = subject.indexOf(": ");
    const item = subject.slice(0, at);
    const code = subject.slice(at + 2);
    return `${item === "An item" ? t(item) : item}: ${code === "a unit" ? t(code) : code}`;
  }
  // A record with no name: what it is ("Stock count"), and its id shown short.
  const m = new RegExp(`^(.+) (${SHORT_ID})$`).exec(subject);
  if (m) return `${t(m[1]!)} ${m[2]}`;
  return subject;
}

const RULES = new Set(Object.values(RULE_LABEL));
const THRESHOLDS = Object.values(THRESHOLD_LABEL);

/**
 * A value as the screen shows it: the words this file writes (yes and no, an
 * item type, the roles, an alert's rule, the thresholds' names, the shop's
 * own channels), a sale's state and an approval's kind, and what an alert
 * said, in the reader's language; a name, a number or a code as it is. The
 * field is the English name fieldLabel gives it.
 */
export function valueIn(value: string, field: string, t: T, msg: Msg): string {
  if (value === "yes" || value === "no") return t(value);
  switch (field) {
    case FIELD_LABEL.item_type:
    case FIELD_LABEL.kind:
    case FIELD_LABEL.dimension:
    case fieldLabel("status"):
      return t(value);
    case FIELD_LABEL.title:
      return msg(value);
    case FIELD_LABEL.roles:
      return value
        .split(", ")
        .map((r) => t(r))
        .join(", ");
    case FIELD_LABEL.rule:
      return RULES.has(value) ? msg(value) : value;
    case FIELD_LABEL.channel:
      return channelIn(value, t);
    case FIELD_LABEL.timezone:
      return t(value);
    case FIELD_LABEL.default_locale:
      // A language by its own name: English, العربية, کوردی.
      return BUILT_IN_LANGUAGES.find((l) => l.code === value)?.label ?? value;
    case FIELD_LABEL.alert_settings:
      if (value === "the defaults") return t(value);
      // "Margin target (%) 65, …": each threshold's name, then what it was set to.
      return value
        .split(", ")
        .map((s) => {
          const label = THRESHOLDS.find((l) => s.startsWith(`${l} `));
          return label ? `${msg(label)}${s.slice(label.length)}` : s;
        })
        .join(", ");
  }
  return value;
}
