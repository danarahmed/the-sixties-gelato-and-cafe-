import "server-only";
/**
 * The café's details and its places, as Settings changes them (0095). The
 * details are null before 0095, when the database has no screen for them.
 */
import { db } from "./client";

const missing = (code: string | undefined) => code === "PGRST202" || code === "42883";

export interface BusinessDetails {
  name: string;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  timezone: string;
  defaultLocale: string;
  billPrefix: string;
  /** The café has sold or posted something: the currency, the time zone and bill numbers stay. */
  fixed: boolean;
  /** Only the owner changes them. */
  owner: boolean;
}

export function businessDetailsFrom(x: unknown): BusinessDetails | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, unknown>;
  return {
    name: String(d.name ?? ""),
    currencyCode: String(d.currency_code ?? ""),
    currencySymbol: String(d.currency_symbol ?? ""),
    currencyDecimals: Number(d.currency_decimals ?? 0),
    timezone: String(d.timezone ?? ""),
    defaultLocale: String(d.default_locale ?? "en"),
    billPrefix: String(d.bill_prefix ?? ""),
    fixed: d.fixed === true,
    owner: d.owner === true,
  };
}

/** The café's details and which may still change; null before 0095. */
export async function getBusinessDetails(): Promise<BusinessDetails | null> {
  const c = await db();
  const r = await c.rpc("business_details");
  if (r.error) {
    if (missing(r.error.code)) return null;
    throw new Error(`Could not load business_details: ${r.error.message}`);
  }
  return businessDetailsFrom(r.data);
}

export interface PlaceRow {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  kind: string;
  isActive: boolean;
}

/** Every place, open or closed, with its names in the three languages. */
export async function getPlaces(): Promise<PlaceRow[]> {
  const c = await db();
  const r = await c
    .from("location")
    .select("id,name,name_ar,name_ckb,kind,is_active")
    .order("created_at");
  if (r.error) throw new Error(`Could not load the places: ${r.error.message}`);
  return (r.data ?? []).map((l: Record<string, unknown>) => ({
    id: String(l.id),
    name: String(l.name),
    nameAr: (l.name_ar as string | null) ?? null,
    nameCkb: (l.name_ckb as string | null) ?? null,
    kind: String(l.kind),
    isActive: Boolean(l.is_active),
  }));
}
