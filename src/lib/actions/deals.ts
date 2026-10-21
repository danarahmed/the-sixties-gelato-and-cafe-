"use server";
/**
 * Meal deals and prices by the time of day (0089), set on Products & Recipes.
 * The database checks the person may change the menu (recipe.edit) and that
 * what is asked makes sense; it keeps what each sale was sold at.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, salesChannel } from "@/lib/validation";

const PATHS = ["/products", "/pos", "/reports/sales"];
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Give the hours as 08:00");
const days = z.array(z.number().int().min(1).max(7)).min(1, "Choose the days").max(7).nullish();

const dealInput = z.object({
  id: id("a deal").nullish(),
  name: z.string().trim().min(1, "Name the deal").max(60, "A deal's name is at most 60 letters"),
  nameAr: z.string().max(60).nullish(),
  nameCkb: z.string().max(60).nullish(),
  prices: z.record(salesChannel, z.number().min(0)),
  slots: z
    .array(
      z.object({
        label: z.string().max(40).nullish(),
        categoryId: id("a category").nullish(),
        variants: z.array(id("a product")).max(50),
      }),
    )
    .min(2, "A deal has at least two things in it")
    .max(8, "A deal has at most eight things in it"),
  days,
  starts: hhmm.nullish(),
  ends: hhmm.nullish(),
  active: z.boolean(),
});

export async function saveDealAction(
  input: z.input<typeof dealInput>,
  key: string,
): Promise<ActionResult<{ id: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(dealInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("save_deal", {
    p_id: v.data.id ?? null,
    p_name: v.data.name,
    p_prices: v.data.prices,
    p_slots: v.data.slots.map((s) => ({
      label: s.label ?? null,
      category_id: s.categoryId ?? null,
      variants: s.variants,
    })),
    p_name_ar: v.data.nameAr ?? null,
    p_name_ckb: v.data.nameCkb ?? null,
    p_days: v.data.days ?? null,
    p_starts: v.data.starts ?? null,
    p_ends: v.data.ends ?? null,
    p_active: v.data.active,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: { id: String(r.data) } };
}

const timePriceInput = z.object({
  variantId: id("a product"),
  price: z.number().min(0, "Enter a price"),
  starts: hhmm,
  ends: hhmm,
  days,
  channel: salesChannel.nullish(),
  locationId: id("a branch").nullish(),
});

export async function setTimePriceAction(
  input: z.input<typeof timePriceInput>,
  key: string,
): Promise<ActionResult<{ id: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(timePriceInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("set_time_price", {
    p_variant: v.data.variantId,
    p_price: v.data.price,
    p_starts: v.data.starts,
    p_ends: v.data.ends,
    p_days: v.data.days ?? null,
    p_channel: v.data.channel ?? null,
    p_location: v.data.locationId ?? null,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: { id: String(r.data) } };
}

export async function stopTimePriceAction(input: { id: string }): Promise<ActionResult<null>> {
  const v = parse(z.object({ id: id("a price") }), input);
  if (!v.ok) return v;
  const r = await callRpc("stop_time_price", { p_id: v.data.id });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}

const sectionHoursInput = z.object({
  sectionId: id("a section"),
  from: hhmm.nullish(),
  until: hhmm.nullish(),
  days,
});

export async function setSectionHoursAction(
  input: z.input<typeof sectionHoursInput>,
): Promise<ActionResult<null>> {
  const v = parse(sectionHoursInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_section_hours", {
    p_section: v.data.sectionId,
    p_from: v.data.from ?? null,
    p_until: v.data.until ?? null,
    p_days: v.data.days ?? null,
  });
  if (!r.ok) return r;
  refresh(...PATHS, "/settings");
  return { ok: true, data: null };
}
