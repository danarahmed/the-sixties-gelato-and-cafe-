"use server";
/**
 * What a till still keeps (0101): said whenever it changes while the till is
 * online, so a manager is told when one has kept sales half an hour or more.
 * Never in the way: a database before 0101, or a failure, is left unsaid.
 */
import { callRpc } from "@/lib/db/rpc";

export async function noteTillKeptAction(input: {
  till: string;
  place: string | null;
  waiting: number;
  attention: number;
  oldest: string | null;
}): Promise<void> {
  if (typeof input?.till !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(input.till)) return;
  const n = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, 10000) : 0;
  const oldest =
    typeof input.oldest === "string" && !Number.isNaN(Date.parse(input.oldest))
      ? input.oldest
      : null;
  const place =
    typeof input.place === "string" && /^[0-9a-f-]{36}$/i.test(input.place) ? input.place : null;
  await callRpc("note_till_kept", {
    p_till: input.till,
    p_location: place,
    p_waiting: n(input.waiting),
    p_attention: n(input.attention),
    p_oldest: oldest,
  });
}
