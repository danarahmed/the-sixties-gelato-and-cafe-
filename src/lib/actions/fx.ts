"use server";
/**
 * US dollars (0043, release R): a manager sets the day's rate, with where it
 * comes from; dollars held in the safe or the till are exchanged for dinars.
 * Each is one database function, keyed like every other write (0035), which
 * checks the person may do it and records it with its journal.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { tillForWrite } from "@/lib/place";

const rateInput = z.object({
  rate: z
    .number({ message: "A dollar is a whole number of dinars, from 100 to 100,000" })
    .int("A dollar is a whole number of dinars, from 100 to 100,000")
    .min(100, "A dollar is a whole number of dinars, from 100 to 100,000")
    .max(100000, "A dollar is a whole number of dinars, from 100 to 100,000"),
  reason: z
    .string()
    .trim()
    .min(1, "Say where the rate comes from")
    .max(300, "Keep the reason under 300 characters"),
});

/** Set the dollar's rate: dinars a dollar, and where it comes from. */
export async function setFxRateAction(
  input: z.input<typeof rateInput>,
  key: string,
): Promise<ActionResult<{ rate: number; was: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(rateInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_fx_rate", {
    p_currency: "USD",
    p_rate: v.data.rate,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  // The till takes dollars at it; Settings and Sales show it.
  refresh("/settings", "/settings/rate", "/pos", "/sales", "/reports");
  return {
    ok: true,
    data: { rate: Number(r.data.rate), was: r.data.was == null ? null : Number(r.data.was) },
  };
}

const exchangeInput = z.object({
  from: z.enum(["till", "safe"], {
    message: "Say where the dollars come from: the till or the safe",
  }),
  usd: z
    .number({ message: "Enter the dollars exchanged, in whole dollars" })
    .int("Enter the dollars exchanged, in whole dollars")
    .positive("Enter the dollars exchanged, in whole dollars"),
  received: z
    .number({ message: "Enter the dinars received for them" })
    .int("Enter the dinars received for them")
    .positive("Enter the dinars received for them"),
  to: z.enum(["till", "safe", "bank"], {
    message: "Say where the dinars go: the till, the safe or the bank",
  }),
  note: z.string().trim().max(300, "Keep the note under 300 characters").nullish(),
});

export interface ExchangeResult {
  usd: number;
  value: number;
  received: number;
  difference: number;
  rate: number;
  leftUsd: number;
  journalNo: number | null;
}

/** Exchange dollars for dinars: from the safe or the till, into the till, the safe or the bank. */
export async function exchangeDollarsAction(
  input: z.input<typeof exchangeInput>,
  key: string,
): Promise<ActionResult<ExchangeResult>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(exchangeInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("exchange_dollars", {
    p_from: v.data.from,
    p_usd: v.data.usd,
    p_received: v.data.received,
    p_to: v.data.to,
    p_note: v.data.note?.trim() || null,
    p_location: await tillForWrite(),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/sales", "/pos", "/journals", "/accounting", "/reports", "/dashboard");
  return {
    ok: true,
    data: {
      usd: Number(r.data.usd),
      value: Number(r.data.value),
      received: Number(r.data.received),
      difference: Number(r.data.difference),
      rate: Number(r.data.rate),
      leftUsd: Number(r.data.left_usd),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}
