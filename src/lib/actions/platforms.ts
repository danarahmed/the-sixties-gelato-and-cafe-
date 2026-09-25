"use server";
/**
 * The café's delivery platforms (0031): added with their names in other
 * languages, given the packaging (and prices) of a channel they work like,
 * renamed, taken out of use and brought back. Each is a database function
 * that checks the person may (the owner or the general manager) and puts
 * itself on the audit trail.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { CHANNEL_CODE } from "@/lib/channels";
import { salesChannel } from "@/lib/validation";

// A platform shows on the till, the menu's prices, the reports and the trail.
const PLATFORM_PATHS = [
  "/platforms",
  "/pos",
  "/products",
  "/orders",
  "/reports",
  "/sales",
  "/dashboard",
  "/audit",
];

const platformName = z
  .string()
  .trim()
  .min(1, "Name the platform as its customers know it")
  .max(60, "Name the platform in up to 60 letters");

/** Its names in other languages, by language code; a blank one is left out. */
const otherNames = z
  .record(
    z.string().regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/, "A language code (ar, ckb)"),
    z.string().trim().max(60, "A name in another language is up to 60 letters"),
  )
  .default({})
  .transform((n) => Object.fromEntries(Object.entries(n).filter(([, v]) => v !== "")));

const addInput = z.object({
  name: platformName,
  /** Made from the name when left empty. */
  code: z
    .string()
    .trim()
    .toLowerCase()
    .refine((c) => c === "" || CHANNEL_CODE.test(c), {
      message: "A short name is small Latin letters, digits and _, starting with a letter (lezzoo)",
    })
    .nullish(),
  names: otherNames,
  /** The channel it works like: its orders take that channel's packaging. None: set up later. */
  like: salesChannel.nullish(),
  /** And that channel's prices, from today. */
  copyPrices: z.boolean().default(true),
});

export interface PlatformAdded {
  code: string;
  name: string;
  /** Recipe lines given its packaging, and prices copied. */
  lines: number;
  prices: number;
  /** Added, but not set up: why. */
  setupError: string | null;
}

/**
 * A platform added, then set up like the channel it works like. Two calls: a
 * new platform's code can be used once the call adding it is over.
 */
export async function addPlatformAction(
  input: z.input<typeof addInput>,
): Promise<ActionResult<PlatformAdded>> {
  const v = parse(addInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("add_delivery_platform", {
    p_name: v.data.name,
    p_code: v.data.code || null,
    p_names: v.data.names,
  });
  if (!r.ok) return r;
  const code = String(r.data.code);
  const added: PlatformAdded = {
    code,
    name: String(r.data.name ?? v.data.name),
    lines: 0,
    prices: 0,
    setupError: null,
  };
  if (v.data.like) {
    const s = await callRpc<Record<string, unknown>>("copy_platform_setup", {
      p_platform: code,
      p_like: v.data.like,
      p_prices: v.data.copyPrices,
    });
    if (s.ok) {
      added.lines = Number(s.data.lines ?? 0);
      added.prices = Number(s.data.prices ?? 0);
    } else added.setupError = s.error;
  }
  refresh(...PLATFORM_PATHS);
  return { ok: true, data: added };
}

const setupInput = z.object({
  code: salesChannel,
  like: salesChannel,
  copyPrices: z.boolean().default(true),
});

/** A platform given the packaging, and the prices it has none of, of a channel it works like. */
export async function copyPlatformSetupAction(
  input: z.input<typeof setupInput>,
): Promise<ActionResult<{ lines: number; prices: number }>> {
  const v = parse(setupInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("copy_platform_setup", {
    p_platform: v.data.code,
    p_like: v.data.like,
    p_prices: v.data.copyPrices,
  });
  if (!r.ok) return r;
  refresh(...PLATFORM_PATHS);
  return {
    ok: true,
    data: { lines: Number(r.data.lines ?? 0), prices: Number(r.data.prices ?? 0) },
  };
}

const updateInput = z.object({
  code: salesChannel,
  name: platformName,
  names: otherNames,
  /** Out of use: it leaves the till and sells nothing more; what it owes stays. */
  active: z.boolean(),
});

/** A platform renamed, named in other languages, taken out of use or brought back. */
export async function updatePlatformAction(
  input: z.input<typeof updateInput>,
): Promise<ActionResult<null>> {
  const v = parse(updateInput, input);
  if (!v.ok) return v;
  const r = await callRpc("update_delivery_platform", {
    p_platform: v.data.code,
    p_name: v.data.name,
    p_names: v.data.names,
    p_active: v.data.active,
  });
  if (!r.ok) return r;
  refresh(...PLATFORM_PATHS);
  return { ok: true, data: null };
}
