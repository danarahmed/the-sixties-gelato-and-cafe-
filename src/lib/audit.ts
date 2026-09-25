/**
 * The audit trail in words (0027, the audit's P1-1): what happened, what it
 * was about, and each value before and after, with ids given their names.
 * Pure: the screen and the CSV both read through here, and the tests too.
 */
import { channelLabel, itemTypeLabel, roleLabel } from "@/lib/format";

/** A stored JSON value, as the database wrote it. */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

/** Names for the ids the trail refers to: items, products, suppliers, people… */
export type Names = ReadonlyMap<string, string>;

/** What the trail can be narrowed to: each group is a set of action prefixes. */
export const AUDIT_GROUPS = [
  { key: "prices", label: "Prices", prefixes: ["price."] },
  {
    key: "menu",
    label: "Products & recipes",
    prefixes: ["product.", "product_variant.", "product_category.", "recipe."],
  },
  {
    key: "items",
    label: "Stock items & opening stock",
    prefixes: ["item.", "item_unit.", "inventory.opening"],
  },
  { key: "suppliers", label: "Suppliers & deliveries", prefixes: ["supplier.", "purchase."] },
  {
    key: "stock",
    label: "Counts, corrections & batches",
    prefixes: ["inventory.adjust", "inventory.count.", "production."],
  },
  {
    key: "sales",
    label: "Sales, bills, discounts & approvals",
    prefixes: ["sale.", "bill.", "approval."],
  },
  { key: "cash", label: "Cash & the drawer", prefixes: ["cash.", "drawer."] },
  { key: "books", label: "Books & periods", prefixes: ["journal.", "period.", "legacy."] },
  {
    key: "settings",
    label: "Settings, places & people",
    prefixes: ["business.", "location.", "member."],
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
  "business.clean_start": "Trial records cleared (clean start)",
  "business.reset_test_data": "Test records cleared",
};

/** What each table is, for the changes the database records itself. */
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
  label: "Label",
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
};

/** Keys that are bookkeeping, not what anyone changed. */
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
    if (key === "channel") return channelLabel[v as keyof typeof channelLabel] ?? v;
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
    default:
      return (
        named(entityId) ??
        pick("name") ??
        `${fieldLabel(entityType)}${entityId ? ` ${short(entityId)}` : ""}`
      );
  }
}
