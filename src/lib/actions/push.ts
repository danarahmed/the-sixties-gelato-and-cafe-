"use server";

/**
 * Warnings on your phone (0072): the owner turns them on or off for the café;
 * a person turns them on or off on a phone, and sends it a test. Each is one
 * call to a database function that checks the person's permission.
 */
import { headers } from "next/headers";
import webpush from "web-push";
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";

/** The app's own address, where the database calls when warnings wait. */
async function siteUrl(): Promise<string> {
  // The production address, when the app runs on Vercel: never a preview's.
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function turnOnPhoneWarningsAction(
  key: string,
): Promise<ActionResult<{ canSend: boolean }>> {
  const bad = badKey(key);
  if (bad) return bad;
  // The café's pair of keys for sending; the database keeps the first pair it is given.
  const keys = webpush.generateVAPIDKeys();
  const r = await callRpc<Record<string, unknown>>("turn_on_phone_warnings", {
    p_site_url: await siteUrl(),
    p_public: keys.publicKey,
    p_private: keys.privateKey,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/settings", "/account");
  return { ok: true, data: { canSend: r.data.can_send === true } };
}

export async function turnOffPhoneWarningsAction(key: string): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const r = await callRpc("turn_off_phone_warnings", { p_idempotency_key: key });
  if (!r.ok) return r;
  refresh("/settings", "/account");
  return { ok: true, data: null };
}

const deviceInput = z.object({
  endpoint: z.string().url("This phone's browser gave no address to send to").max(1000),
  p256dh: z.string().min(20).max(200),
  auth: z.string().min(8).max(100),
  locale: z.string().max(5),
  urgentOnly: z.boolean(),
});

export async function savePushDeviceAction(
  input: z.input<typeof deviceInput>,
  key: string,
): Promise<ActionResult<{ urgentOnly: boolean }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(deviceInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_push_device", {
    p_endpoint: v.data.endpoint,
    p_push_key: v.data.p256dh,
    p_push_auth: v.data.auth,
    p_locale: v.data.locale,
    p_urgent_only: v.data.urgentOnly,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  return { ok: true, data: { urgentOnly: r.data.urgent_only === true } };
}

const endpointInput = z.string().url("This phone's browser gave no address to send to").max(1000);

export async function removePushDeviceAction(endpoint: string): Promise<ActionResult<null>> {
  const v = parse(endpointInput, endpoint);
  if (!v.ok) return v;
  const r = await callRpc("remove_push_device", { p_endpoint: v.data });
  if (!r.ok) return r;
  return { ok: true, data: null };
}

export async function sendTestWarningAction(
  endpoint: string,
): Promise<ActionResult<{ canSend: boolean }>> {
  const v = parse(endpointInput, endpoint);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("send_test_warning", { p_endpoint: v.data });
  if (!r.ok) return r;
  return { ok: true, data: { canSend: r.data.can_send === true } };
}

/** Whether warnings are on on this phone, and which: read when My account opens. */
export async function thisPhoneAction(
  endpoint: string,
): Promise<ActionResult<{ on: boolean; urgentOnly: boolean }>> {
  const v = parse(endpointInput, endpoint);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("phone_warnings", { p_endpoint: v.data });
  if (!r.ok) return r;
  const phone = r.data.this_phone as Record<string, unknown> | null;
  return { ok: true, data: { on: !!phone, urgentOnly: phone?.urgent_only === true } };
}
