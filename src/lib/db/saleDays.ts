import "server-only";
/** Sale days (0106): "N% off, from this day to that day". Empty or null before 0106. */
import { db } from "./client";

export type SaleDayStatus = "planned" | "on" | "between" | "ended" | "stopped";

export interface SaleDay {
  id: string;
  name: string;
  percent: number;
  startsOn: string;
  endsOn: string;
  fromTime: string | null;
  toTime: string | null;
  excludedCategories: string[];
  excludedNames: string[];
  status: SaleDayStatus;
}

/** The sale day on now, as the till takes it: also when it ends. */
export interface SaleDayNow extends SaleDay {
  endsAt: string | null;
}

export interface SaleDayWindow {
  bills: number;
  fullPrice: number;
  discount: number;
  saleDayDiscount: number;
  saleDayBills: number;
  sales: number;
  cost: number;
  profit: number;
}

export interface SaleDayReport {
  saleDay: SaleDay;
  begun: boolean;
  from: string | null;
  to: string | null;
  weeksBefore: number;
  during: SaleDayWindow | null;
  before: SaleDayWindow | null;
  salesChange: number;
  billsChange: number;
  profitChange: number;
}

const STATUSES: SaleDayStatus[] = ["planned", "on", "between", "ended", "stopped"];

export function toSaleDay(d: Record<string, unknown>): SaleDay {
  const status = String(d.status ?? "planned") as SaleDayStatus;
  return {
    id: String(d.id),
    name: String(d.name ?? ""),
    percent: Number(d.percent ?? 0),
    startsOn: String(d.starts_on ?? ""),
    endsOn: String(d.ends_on ?? ""),
    fromTime: typeof d.from_time === "string" ? d.from_time : null,
    toTime: typeof d.to_time === "string" ? d.to_time : null,
    excludedCategories: Array.isArray(d.excluded_categories)
      ? d.excluded_categories.map(String)
      : [],
    excludedNames: Array.isArray(d.excluded_names) ? d.excluded_names.map(String) : [],
    status: STATUSES.includes(status) ? status : "planned",
  };
}

function toWindow(d: unknown): SaleDayWindow | null {
  if (!d || typeof d !== "object") return null;
  const w = d as Record<string, unknown>;
  const n = (k: string) => Number(w[k] ?? 0);
  return {
    bills: n("bills"),
    fullPrice: n("full_price"),
    discount: n("discount"),
    saleDayDiscount: n("sale_day_discount"),
    saleDayBills: n("sale_day_bills"),
    sales: n("sales"),
    cost: n("cost"),
    profit: n("profit"),
  };
}

export async function getSaleDays(): Promise<SaleDay[] | null> {
  const c = await db();
  const r = await c.rpc("sale_days");
  if (r.error || !Array.isArray(r.data)) return null;
  return (r.data as Record<string, unknown>[]).map(toSaleDay);
}

export function toSaleDayNow(d: unknown): SaleDayNow | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (!o.id) return null;
  return { ...toSaleDay(o), endsAt: typeof o.ends_at === "string" ? o.ends_at : null };
}

export async function getSaleDayNow(): Promise<SaleDayNow | null> {
  const c = await db();
  const r = await c.rpc("sale_day_now");
  if (r.error) return null;
  return toSaleDayNow(r.data);
}

export async function getSaleDayReport(id: string): Promise<SaleDayReport | null> {
  const c = await db();
  const r = await c.rpc("report_sale_day", { p_id: id });
  if (r.error || !r.data) return null;
  const d = r.data as Record<string, unknown>;
  return {
    saleDay: toSaleDay((d.sale_day ?? {}) as Record<string, unknown>),
    begun: d.begun === true,
    from: typeof d.from === "string" ? d.from : null,
    to: typeof d.to === "string" ? d.to : null,
    weeksBefore: Number(d.weeks_before ?? 1),
    during: toWindow(d.during),
    before: toWindow(d.before),
    salesChange: Number(d.sales_change ?? 0),
    billsChange: Number(d.bills_change ?? 0),
    profitChange: Number(d.profit_change ?? 0),
  };
}

/** The café's categories, to leave some out of a sale day. */
export async function getSaleDayCategories(): Promise<{ id: string; name: string }[]> {
  const c = await db();
  const r = await c.from("product_category").select("id,name").order("name");
  if (r.error || !r.data) return [];
  return (r.data as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name }));
}
