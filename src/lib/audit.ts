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
import { itemTypeLabel, movementLabel, roleLabel } from "@/lib/format";
import { SHOP_CHANNELS, channelName } from "@/lib/channels";
import { RULE_LABEL, THRESHOLD_LABEL, ruleLabel } from "@/lib/alerts";
import { CHOICE_LABEL, RULE_LABEL as BUSINESS_RULE_LABEL } from "@/lib/rules";
import { PAY_BASIS_LABEL } from "@/lib/staff";

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
  { key: "prices", label: "Prices", prefixes: ["price.", "modifier_price."] }, // i18n-ignore
  {
    key: "menu",
    label: "Products & recipes", // i18n-ignore
    prefixes: [
      "product.",
      "product_variant.",
      "product_category.",
      "recipe.",
      "modifier_group.",
      "modifier.",
    ],
  },
  {
    key: "items",
    label: "Stock items & opening stock", // i18n-ignore
    prefixes: ["item.", "item_unit.", "inventory.opening"],
  },
  { key: "suppliers", label: "Suppliers & deliveries", prefixes: ["supplier.", "purchase."] }, // i18n-ignore
  {
    key: "stock",
    label: "Counts, corrections, batches & transfers", // i18n-ignore
    prefixes: [
      "inventory.adjust",
      "inventory.waste",
      "inventory.loss",
      "inventory.count.",
      "production.",
      "stock.",
    ],
  },
  {
    key: "sales",
    label: "Sales, bills, discounts & approvals", // i18n-ignore
    prefixes: ["sale.", "bill.", "approval."],
  },
  { key: "cash", label: "Cash & the drawer", prefixes: ["cash.", "drawer.", "fx."] }, // i18n-ignore
  {
    key: "settlements",
    label: "Card & platform settlements", // i18n-ignore
    prefixes: ["card.", "platform.settlement", "platform.settlement_cancel"],
  },
  {
    key: "books",
    label: "Books & periods", // i18n-ignore
    prefixes: ["journal.", "period.", "legacy.", "expense."],
  },
  { key: "alerts", label: "Alerts answered", prefixes: ["alert."] }, // i18n-ignore
  {
    key: "staff",
    label: "Staff, hours & payroll", // i18n-ignore
    prefixes: ["staff.", "attendance.", "payroll."],
  },
  {
    key: "customers",
    label: "Customers and points", // i18n-ignore
    prefixes: ["customer.", "loyalty."],
  },
  {
    key: "documents",
    label: "Documents kept with records", // i18n-ignore
    prefixes: ["document."],
  },
  {
    key: "settings",
    label: "Settings, places, platforms & people", // i18n-ignore
    prefixes: [
      "business.",
      "rule.",
      "location.",
      "member.",
      "table.",
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
  "product.modifiers": "Add-ons offered changed",
  "modifier_price.set": "Add-on price set",
  "modifier.recipe": "What an add-on uses changed",
  "recipe.change": "Recipe changed",
  "recipe.cancel": "Scheduled recipe withdrawn",
  "recipe.batch.create": "Batch recipe added",
  "recipe.batch.change": "Batch recipe changed",
  "inventory.opening": "Opening stock recorded",
  "inventory.adjust": "Stock corrected",
  "inventory.count.start": "Stock count started",
  "inventory.count.submit": "Stock count handed in",
  "inventory.count.reject": "Stock count sent back",
  "inventory.count.approve": "Stock count approved",
  "inventory.count.cancel": "Stock count cancelled",
  "inventory.waste": "Loss recorded",
  "inventory.loss": "Loss recorded",
  "inventory.loss_approve": "Loss approved",
  "inventory.loss_reverse": "Loss reversed",
  "stock.below_zero": "Stock used beyond the books, approved",
  "rule.set": "Rule changed",
  "production.record": "Batch recorded",
  "production.cancel": "Batch cancelled",
  "production.use_by": "Batch use-by changed",
  "purchase.receive": "Delivery received",
  "purchase.bill": "Supplier bill recorded",
  "purchase.pay": "Supplier bill paid",
  "expense.record": "Expense recorded",
  "table.save": "Table saved",
  "purchase.price_confirmed": "Delivery price confirmed",
  "purchase.correct": "Delivery corrected",
  "purchase.reverse": "Delivery reversed",
  // Purchasing (0044): orders, returns and the suppliers' credits.
  "purchase.order.create": "Purchase order drafted",
  "purchase.order.change": "Purchase order changed",
  "purchase.order.approve": "Purchase order approved",
  "purchase.order.send": "Purchase order sent",
  "purchase.order.close": "Purchase order closed",
  "purchase.order.cancel": "Purchase order cancelled",
  // Who an item is bought from (0045).
  "item.supplier.set": "Item's supplier set",
  "item.supplier.remove": "Item's supplier removed",
  "purchase.quantity_confirmed": "More than ordered, confirmed",
  "purchase.return": "Goods returned to a supplier",
  "purchase.credit": "Supplier's credit note recorded",
  "purchase.credit.note": "Supplier's note matched to a credit",
  "purchase.credit.allocate": "Credit set against a bill",
  "sale.void": "Sale voided",
  "sale.refund": "Sale refunded",
  "sale.discount": "Discount given",
  "sale.giveaway": "Given away at the till",
  "bill.cancel": "Open bill cancelled",
  "bill.discount": "Discount on an open bill",
  "bill.reduce": "Printed bill reduced",
  "bill.line_remove": "Items taken off an open bill",
  "bill.split": "Open bill split",
  "approval.granted": "Approved with a manager's PIN",
  "approval.refused": "Wrong PIN for an approval",
  "cash.move": "Cash moved",
  "drawer.count": "Drawer counted",
  "cash.session.open": "Drawer opened",
  "cash.session.close": "Drawer closed",
  "cash.session.hand_over": "Drawer handed over",
  "cash.session.force_close": "Drawer closed by a manager",
  "fx.rate.set": "Dollar rate set",
  "fx.exchange": "Dollars exchanged for dinars",
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
  "journal.save": "Journal saved",
  "journal.publish": "Journal published",
  "journal.discard": "Draft journal discarded",
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
  // Staff, their hours and their pay (0049).
  "staff.save": "Person who works here saved",
  "staff.pay": "Pay set",
  "staff.left": "Last day set",
  "staff.clock_pin": "Clock-in PIN set",
  "staff.schedule": "Schedule saved",
  "attendance.correct": "Hours corrected",
  "attendance.add": "Hours added",
  "attendance.cancel": "Hours cancelled",
  "payroll.draft": "Payroll drafted",
  "payroll.adjust": "Payroll adjusted",
  "payroll.approve": "Payroll approved",
  "payroll.reopen": "Payroll reopened",
  "payroll.pay": "Salary paid",
  "payroll.pay_all": "Salaries paid",
  "payroll.advance": "Advance given",
  "payroll.advance_cancel": "Advance cancelled",
  "payroll.payment_cancel": "Salary payment cancelled",
  // Customers and their points (0050).
  "customer.save": "Customer saved",
  "customer.address": "Customer's address saved",
  "loyalty.adjust": "Points given or taken by hand",
  // Documents kept with the records (0053): the record is named by its number.
  "document.attach": "Document attached",
  "document.detach": "Document taken off",
  // Stock sent between the café's places (0054): the transfer is named by its number.
  "stock.transfer_send": "Stock sent to another place",
  "stock.transfer_receive": "Transfer received",
  "stock.transfer_cancel": "Transfer cancelled",
};

/**
 * What each table is, for the changes the database records itself. Each
 * "{table} {verb}" it makes ("Stock item changed") is a phrase in full.
 */
const TABLE_LABEL: Record<string, string> = {
  product: "Product",
  product_variant: "What the till sells",
  product_category: "Category",
  modifier_group: "Group of add-ons",
  modifier: "Add-on",
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
  // An item's supplier (0045): the pack it comes in, a pack's price, the usual one.
  pack_unit: "Pack",
  last_price: "Price of a pack",
  usual: "The usual supplier",
  instead_of: "In place of",
  returnable_to_stock: "Back on the shelf when refunded",
  contact: "What they supply",
  phone: "Phone",
  // A customer and their points (0050).
  customer: "Customer",
  customer_notes: "Notes about them",
  kept_as_customer: "Kept as a customer",
  address: "Address",
  directions: "How to find it",
  put_away: "Put away",
  points: "Points",
  change: "Change in points",
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
  supplier: "Supplier",
  items: "Items",
  amount: "Amount",
  account: "Account",
  paid_from: "Paid from",
  journal_no: "Journal",
  invoice_no: "Bill",
  recipe: "Batch recipe",
  batches: "Batches",
  // Batches and their lots (0046).
  batch_no: "Batch",
  // A giveaway at the till (0048): its number for the bar, how many products.
  turn_no: "Number",
  products: "Products",
  what: "What",
  use_by: "Use by",
  made_at: "Made",
  keeps_hours: "Keeps (hours)",
  track_lot: "Kept apart by batch",
  note: "Note",
  area: "Area",
  seats: "Seats",
  movement: "Kind of loss",
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
  session_no: "Session",
  counted: "Counted",
  expected: "Should hold",
  variance: "Over / short",
  left: "Stays in the drawer",
  taken: "Taken out",
  taken_to: "Taken to",
  took_over: "Took over from the drawer counts",
  float_from_safe: "Put in from the safe",
  notes: "Notes counted",
  next_session_no: "Next session",
  next_cashier: "Taken over by",
  refund_no: "Refund",
  refunded: "Refunded so far",
  returned_to_stock: "Back on the shelf, at cost",
  correction_no: "Correction",
  kinds: "What was corrected",
  received_on: "The day it came",
  delivery_lines: "On the delivery",
  stock_change: "Stock value changed by",
  grni_change: "Owed for it (2050) changed by",
  price_variance: "Price variance (5050)",
  business_rule: "Rule",
  applies_to: "Applies to",
  approved_by: "Approved by",
  min_select: "Fewest to choose",
  max_select: "Most to choose",
  group_id: "Group of add-ons",
  modifier: "Add-on",
  size: "Size",
  groups: "Groups of add-ons",
  copied_from: "Copied from",
  // US dollars (0043): the rate, an exchange, and the dollars counted at a close.
  rate: "Dinars a dollar",
  set_at: "Set",
  currency: "Currency",
  usd: "Dollars",
  dinars: "Dinars received",
  usd_expected: "Dollars it should hold",
  usd_counted: "Dollars counted",
  usd_variance: "Dollars over / short",
  usd_carried: "Dollars left uncounted",
  usd_notes: "Dollar notes counted",
  // Purchasing (0044).
  po_no: "Order",
  total: "Total",
  expected_on: "Expected",
  limit: "Approves up to",
  return_no: "Return",
  stock_value: "Stock value",
  against: "Owed back",
  credit_no: "Credit note",
  set_against_bill: "Set against the bill",
  supplier_ref: "Their note",
  bill: "Bill",
  order_lines: "Order lines",
  short: "Closed short of the order",
  // Stock sent between the café's places (0054).
  transfer_no: "Transfer",
  lost: "Lost on the way",
  returned: "Returned",
  credit_kind: "For",
  // Staff, their hours and their pay (0049).
  job_title: "Job",
  location: "Branch",
  hired_on: "Started",
  login: "Their login",
  pay_basis: "How they are paid",
  pay_rate: "Pay",
  standard_hours: "Hours in a day",
  overtime_percent: "Overtime (% of an hour's pay)",
  left_on: "Last day",
  shifts_removed: "Shifts taken off",
  shifts: "Shifts",
  clock_in: "Clocked in",
  clock_out: "Clocked out",
  run_no: "Payroll",
  month: "Month",
  people: "People",
  gross: "Gross pay",
  net: "To be paid",
  advances_recovered: "Advances taken back",
  advance_recovered: "Advance taken back",
  additions: "Added",
  additions_note: "What was added for",
  deductions: "Deducted",
  deductions_note: "What was deducted for",
  owed: "Still owed",
};

/**
 * Words for the purchasing trail's values (0044): phrases, shown through t().
 * An order's status keeps the trail's own "Status" and its words (draft,
 * approved, sent), as a sale's does.
 */
const PURCHASING_VALUE: Record<string, Record<string, string>> = {
  credit_kind: { goods_return: "Goods returned", price: "A lower price", other: "Other" },
  against: { delivery: "Off the delivery's bill", account: "On the account" },
  // How someone is paid (0049).
  pay_basis: PAY_BASIS_LABEL,
};

/** What a delivery's correction changed (0038), as the trail names it. */
const CORRECTION_KIND: Record<string, string> = {
  quantity: "the quantity",
  price: "the price",
  item: "the item",
  supplier: "the supplier",
  date: "the date",
  reversed: "reversed",
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
    if (key === "movement") return movementLabel(v);
    // A rule of the café (0040): its name, what it applies to, a choice's words.
    if (key === "business_rule")
      return BUSINESS_RULE_LABEL[v as keyof typeof BUSINESS_RULE_LABEL] ?? v;
    if (key === "applies_to") return roleLabel(v) !== v ? roleLabel(v) : itemTypeLabel(v);
    if (key === "value" && CHOICE_LABEL[v]) return CHOICE_LABEL[v];
    if (PURCHASING_VALUE[key]?.[v]) return PURCHASING_VALUE[key]![v]!;
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
          // A delivery's line (0038): what it cost, too.
          const cost =
            typeof o.goods_value === "number"
              ? ` (${showValue(o.goods_value, "value", names)})`
              : "";
          return `${item} ${showValue(qty, "qty", names)}${unit}${only}${cost}`;
        })
        .join(", ");
    }
    // The groups of add-ons a product offers (0041): "Milk, Extras (Double)".
    if (key === "groups" && v.every(isObj))
      return (
        v
          .map((x) => {
            const o = x as Obj;
            return typeof o.size === "string" ? `${String(o.group)} (${o.size})` : String(o.group);
          })
          .join(", ") || "—"
      );
    if (key === "roles") return v.map((r) => roleLabel(String(r))).join(", ");
    if (key === "kinds") return v.map((k) => CORRECTION_KIND[String(k)] ?? String(k)).join(", ");
    return v.map((x) => showValue(x, key, names)).join(", ");
  }
  // The notes counted in the drawer (0036): "25,000 × 2, 1,000 × 3".
  if (key === "notes") {
    const set = Object.entries(v).sort((x, y) => Number(y[0]) - Number(x[0]));
    return set.length
      ? set.map(([k, x]) => `${Number(k).toLocaleString("en-US")} × ${String(x)}`).join(", ")
      : "—";
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
    case "modifier_price": {
      // An add-on's price (0041): the add-on and the channel.
      const channel = pick("channel");
      const what = named(pick("modifier")) ?? "An add-on";
      return channel ? `${what}, ${showValue(channel, "channel", names)}` : what;
    }
    case "item_unit": {
      const item = named(pick("item_id")) ?? "An item";
      return `${item}: ${pick("code") ?? "a unit"}`;
    }
    case "business":
      return "Business settings";
    case "business_rule": {
      // "Discounts a manager approves: Cashier"; the whole café's has nothing after it.
      const rule = pick("business_rule");
      const what = rule ? showValue(rule, "business_rule", names) : "A rule";
      const to = pick("applies_to");
      return to ? `${what}: ${showValue(to, "applies_to", names)}` : what;
    }
    case "stock":
      return "Stock";
    case "inventory_movement":
      return named(pick("item")) ?? "Stock";
    case "stock_loss":
      // A loss recorded whole (0048): what was lost, when the trail says.
      return pick("what") ?? named(pick("item")) ?? named(pick("product_variant_id")) ?? "A loss";
    case "expense":
      return pick("description") ?? "An expense";
    case "production_batch":
      return pick("recipe") ?? "A batch";
    case "stock_count":
      return "A stock count";
    case "dining_table":
      return pick("name") ?? "A table";
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
    case "work_shift":
      return pick("session_no") ? `Session ${pick("session_no")}` : "A drawer count";
    case "fx_rate":
      return "The dollar rate";
    case "fx_exchange":
      return "An exchange of dollars";
    case "purchase_order":
      return pick("po_no") ? `Purchase order ${pick("po_no")}` : "A purchase order";
    case "supplier_return":
      return pick("return_no") ? `Return ${pick("return_no")}` : "A return to a supplier";
    case "supplier_credit":
      return pick("credit_no") ? `Credit ${pick("credit_no")}` : "A supplier's credit";
    // Stock sent between the café's places (0054), by its number.
    case "stock_transfer":
      return pick("transfer_no") ? `Transfer ${pick("transfer_no")}` : "A transfer";
    // Staff, their hours and their pay (0049): the person, or the payroll by its number.
    case "employee":
      return pick("name") ?? "Someone who works here";
    case "attendance":
      return pick("name") ?? "A record of hours";
    case "employee_advance":
      return pick("name") ?? "An advance";
    case "payroll_run":
      return pick("run_no") ? `Payroll ${pick("run_no")}` : (pick("name") ?? "A payroll");
    case "salary_payment":
      return pick("name") ?? (pick("run_no") ? `Payroll ${pick("run_no")}` : "A salary payment");
    // A customer (0050): by name, as their details, address or points say.
    case "customer":
      return pick("name") ?? pick("customer") ?? "A customer";
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
  "A customer",
  "A price",
  "An item",
  "Business settings",
  "Stock",
  "A delivery",
  "A recipe",
  "An alert",
  "Card takings",
  "A platform statement",
  "An expense",
  "A batch",
  "A stock count",
  "A table",
  "A drawer count",
  "An add-on",
  "The dollar rate",
  "An exchange of dollars",
  "A purchase order",
  "A return to a supplier",
  "A supplier's credit",
  "A transfer",
  "Someone who works here",
  "A record of hours",
  "An advance",
  "A payroll",
  "A salary payment",
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
  [/^Session (\d+)$/, "Session {no}", ["no"]],
  [/^Purchase order (\d+)$/, "Purchase order {no}", ["no"]],
  [/^Return (\d+)$/, "Return {no}", ["no"]],
  [/^Credit (\d+)$/, "Credit {no}", ["no"]],
  [/^Transfer (\d+)$/, "Transfer {no}", ["no"]],
  [/^Payroll (\d+)$/, "Payroll {no}", ["no"]],
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
  // A rule (0040): its name, then a role or a kind of item (phrases), or an item's name.
  if (action === "rule.set") {
    const at = subject.indexOf(": ");
    return at < 0 ? t(subject) : `${t(subject.slice(0, at))}: ${t(subject.slice(at + 2))}`;
  }
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
  // A price: the product or the add-on (or "A price", "An add-on") and the channel.
  if (
    (action.startsWith("price.") || action.startsWith("modifier_price.")) &&
    subject.includes(", ")
  ) {
    const at = subject.lastIndexOf(", ");
    const what = subject.slice(0, at);
    return `${SUBJECT_WORDS.has(what) ? t(what) : what}, ${channelIn(subject.slice(at + 2), t)}`;
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
const CHOICES = new Set(Object.values(CHOICE_LABEL));

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
    case FIELD_LABEL.movement:
    case FIELD_LABEL.kind:
    case FIELD_LABEL.dimension:
    case fieldLabel("status"):
    case FIELD_LABEL.credit_kind:
    case FIELD_LABEL.against:
    case FIELD_LABEL.pay_basis:
      return t(value);
    case FIELD_LABEL.title:
      return msg(value);
    case FIELD_LABEL.roles:
    case FIELD_LABEL.kinds:
      return value
        .split(", ")
        .map((r) => t(r))
        .join(", ");
    case FIELD_LABEL.rule:
      return RULES.has(value) ? msg(value) : value;
    case FIELD_LABEL.business_rule:
    case FIELD_LABEL.applies_to:
      return t(value);
    case FIELD_LABEL.value:
      return CHOICES.has(value) ? t(value) : value;
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
