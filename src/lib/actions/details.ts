"use server";
/**
 * The café's details and its places, on Settings (0095). Each action is one
 * database function, which checks the person may and writes the audit row.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, optionalText, text } from "@/lib/validation";

/** Every screen shows the café's name, its places and its money. */
const EVERYWHERE = ["/", "/settings", "/dashboard", "/pos", "/reports", "/inventory", "/staff"];

const detailsInput = z.object({
  name: text("The café's name", 80).nullish(),
  defaultLocale: z.string().min(2).max(10).nullish(),
  currencyCode: z.string().trim().toUpperCase().nullish(),
  currencySymbol: z.string().trim().nullish(),
  currencyDecimals: z.number().int().nullish(),
  timezone: z.string().trim().nullish(),
  billPrefix: z.string().trim().toUpperCase().nullish(),
});

/** (owner) The café's details; a value left out stays as it is. */
export async function updateBusinessDetailsAction(
  input: z.input<typeof detailsInput>,
): Promise<ActionResult<null>> {
  const v = parse(detailsInput, input);
  if (!v.ok) return v;
  const d = v.data;
  const r = await callRpc("update_business_details", {
    p_name: d.name ?? null,
    p_default_locale: d.defaultLocale ?? null,
    p_currency_code: d.currencyCode || null,
    p_currency_symbol: d.currencySymbol || null,
    p_currency_decimals: d.currencyDecimals ?? null,
    p_timezone: d.timezone || null,
    p_bill_prefix: d.billPrefix || null,
  });
  if (!r.ok) return r;
  refresh(...EVERYWHERE);
  return { ok: true, data: null };
}

const KINDS = ["branch", "central_kitchen", "warehouse"] as const;

const placeInput = z.object({
  kind: z
    .string()
    .refine((k) => (KINDS as readonly string[]).includes(k), "Choose what kind of place it is"),
  name: text("The place's name", 60),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
});

/** A new branch, central kitchen or store, with its till drawer. */
export async function addPlaceAction(
  input: z.input<typeof placeInput>,
  key: string,
): Promise<ActionResult<{ id: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(placeInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("add_place", {
    p_kind: v.data.kind,
    p_name: v.data.name,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...EVERYWHERE);
  return { ok: true, data: { id: String(r.data) } };
}

const renameInput = z.object({
  place: id("a place"),
  name: text("The place's name", 60),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
});

/** A place's names in the three languages. */
export async function renamePlaceAction(
  input: z.input<typeof renameInput>,
): Promise<ActionResult<null>> {
  const v = parse(renameInput, input);
  if (!v.ok) return v;
  const r = await callRpc("rename_place", {
    p_place: v.data.place,
    p_name: v.data.name,
    p_name_ar: v.data.nameAr,
    p_name_ckb: v.data.nameCkb,
  });
  if (!r.ok) return r;
  refresh(...EVERYWHERE);
  return { ok: true, data: null };
}

const activeInput = z.object({
  place: id("a place"),
  active: z.boolean(),
  reason: optionalText(300),
});

/** A place closed (with why), or open again. */
export async function setPlaceActiveAction(
  input: z.input<typeof activeInput>,
): Promise<ActionResult<null>> {
  const v = parse(activeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_place_active", {
    p_place: v.data.place,
    p_active: v.data.active,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...EVERYWHERE);
  return { ok: true, data: null };
}
