"use server";
/**
 * A second person on the till (0028, the audit's P1-10): a discount over the
 * cap, or a void or refund, approved by a manager's name and PIN. The PIN is
 * checked by the database in a step of its own, so a wrong one is counted
 * even though nothing else happens; five in fifteen minutes lock that
 * manager's approvals until the fifteen minutes have passed.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id } from "@/lib/validation";

const kind = z.enum(["discount", "void", "refund"], { message: "Unknown approval" });

export interface Approver {
  id: string;
  name: string;
}

/** Who else may approve this kind of exception, with a PIN set: names only. */
export async function listApproversAction(
  k: z.input<typeof kind>,
): Promise<ActionResult<Approver[]>> {
  const v = parse(kind, k);
  if (!v.ok) return v;
  const r = await callRpc<{ id: string; name: string }[]>("list_approvers", { p_kind: v.data });
  if (!r.ok) return r;
  return {
    ok: true,
    data: (r.data ?? []).map((a) => ({ id: String(a.id), name: String(a.name) })),
  };
}

const requestInput = z.object({
  kind,
  approverId: id("who approves it"),
  pin: z.string().regex(/^\d{4,8}$/, "A PIN is 4 to 8 digits"),
  /** What is approved: {percent} for a discount, {order_id} for a void or refund. */
  scope: z.union([
    z.object({ percent: z.number().positive().max(100) }),
    z.object({ order_id: z.string().uuid() }),
  ]),
});

/** The manager types their PIN: an approval, good once, for ten minutes, for the person who asked. */
export async function requestApprovalAction(
  input: z.input<typeof requestInput>,
): Promise<ActionResult<{ approvalId: string; approver: string }>> {
  const v = parse(requestInput, input);
  if (!v.ok) return v;
  const r = await callRpc<{
    ok?: boolean;
    error?: string;
    approval_id?: string;
    approver?: string;
  }>("request_approval", {
    p_kind: v.data.kind,
    p_approver: v.data.approverId,
    p_pin: v.data.pin,
    p_scope: v.data.scope,
  });
  if (!r.ok) return r;
  // A wrong PIN is an answer, not a failure: the database kept the attempt.
  if (!r.data?.ok) return { ok: false, error: r.data?.error ?? "Not approved" };
  return {
    ok: true,
    data: { approvalId: String(r.data.approval_id), approver: String(r.data.approver ?? "") },
  };
}

const pinInput = z
  .object({ pin: z.string().trim(), confirm: z.string().trim() })
  .refine((p) => p.pin === p.confirm, { message: "The two PINs are not the same" });

/** A manager sets the PIN they approve with; the database keeps only its hash. */
export async function setMyPinAction(input: z.input<typeof pinInput>): Promise<ActionResult<null>> {
  const v = parse(pinInput, input);
  if (!v.ok) return v;
  const r = await callRpc<null>("set_my_pin", { p_pin: v.data.pin });
  if (!r.ok) return r;
  refresh("/account");
  return { ok: true, data: null };
}
