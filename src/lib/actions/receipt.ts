"use server";
/**
 * The café's own receipt (0091), set on Settings (settings.manage), and the
 * reports each person opens, counted so Reports puts them first. The database
 * checks the person may.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { receiptSetupFrom, receiptSetupToDb, type ReceiptSetup } from "@/lib/receipt";

const RECEIPT_PATHS = ["/settings", "/pos", "/orders", "/devices"];

const line = (max: number) =>
  z.string().trim().max(max, `A line of the receipt is at most ${max} letters`).nullable();
const link = line(300).refine((v) => !v || /^https:\/\/[^\s/$.?#]\S*$/i.test(v), {
  message: "A link starts with https:// and has no spaces",
});

const setupInput = z.object({
  nameAr: line(60),
  nameCkb: line(60),
  thanksEn: line(120),
  thanksAr: line(120),
  thanksCkb: line(120),
  instagram: line(60),
  facebook: line(80),
  tiktok: line(60),
  wifiName: line(60),
  wifiPassword: line(60),
  qr: z.enum(["none", "menu", "review"], {
    message: "The QR code leads to the menu, to the reviews, or nowhere",
  }),
  menuUrl: link,
  reviewUrl: link,
  footer: line(200),
});

export async function setReceiptSetupAction(
  input: z.input<typeof setupInput>,
): Promise<ActionResult<ReceiptSetup>> {
  const v = parse(setupInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("set_receipt_setup", { p_setup: receiptSetupToDb(v.data) });
  if (!r.ok) return r;
  refresh(...RECEIPT_PATHS);
  return { ok: true, data: receiptSetupFrom(r.data) };
}

const logoInput = z.object({
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"], {
    message: "Use a PNG, JPEG or WebP picture",
  }),
  /** The logo, already made small by the browser, as base64. */
  data: z
    .string()
    .min(1, "Choose a picture")
    .max(82_000, "The logo must be smaller than 60 KB")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "The picture could not be read"),
});

export async function setReceiptLogoAction(
  input: z.input<typeof logoInput>,
): Promise<ActionResult<ReceiptSetup>> {
  const v = parse(logoInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("set_receipt_logo", {
    p_content_type: v.data.contentType,
    p_data: v.data.data,
  });
  if (!r.ok) return r;
  refresh(...RECEIPT_PATHS);
  return { ok: true, data: receiptSetupFrom(r.data) };
}

export async function clearReceiptLogoAction(): Promise<ActionResult<ReceiptSetup>> {
  const r = await callRpc<unknown>("clear_receipt_logo");
  if (!r.ok) return r;
  refresh(...RECEIPT_PATHS);
  return { ok: true, data: receiptSetupFrom(r.data) };
}

const visitInput = z.object({
  path: z.string().regex(/^\/reports(\/[a-z-]{1,30})?$/, "That is not one of the reports"),
});

/**
 * A report opened: counted for the person, so Reports puts it first for them.
 * Nothing on the screen waits for it; before 0091 nothing is counted.
 */
export async function noteReportVisitAction(
  input: z.input<typeof visitInput>,
): Promise<ActionResult<null>> {
  const v = parse(visitInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("note_report_visit", { p_path: v.data.path });
  if (!r.ok) return r;
  return { ok: true, data: null };
}
