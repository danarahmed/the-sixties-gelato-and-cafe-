"use server";
/**
 * People: the owner and general manager add staff by email and role. A person
 * becomes a member only when they sign in with that email, confirmed; roles
 * decide what they can see and do, everywhere, enforced by the database.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, text } from "@/lib/validation";

const ROLES = [
  "owner",
  "general_manager",
  "branch_manager",
  "cashier",
  "barista",
  "inventory_counter",
  "purchasing",
  "accountant",
  "auditor",
] as const;

const inviteInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter the person's email"),
  name: text("Their name", 120),
  roles: z.array(z.enum(ROLES)).min(1, "Give the person at least one role"),
});

export async function inviteMemberAction(
  input: z.input<typeof inviteInput>,
): Promise<ActionResult<null>> {
  const v = parse(inviteInput, input);
  if (!v.ok) return v;
  const r = await callRpc("invite_member", {
    p_email: v.data.email,
    p_name: v.data.name,
    p_roles: v.data.roles,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: null };
}

const rolesInput = z.object({
  memberId: id("a person"),
  roles: z.array(z.enum(ROLES)).min(1, "Give the person at least one role"),
});

export async function setMemberRolesAction(
  input: z.input<typeof rolesInput>,
): Promise<ActionResult<null>> {
  const v = parse(rolesInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_member_roles", { p_member: v.data.memberId, p_roles: v.data.roles });
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: null };
}

const activeInput = z.object({ memberId: id("a person"), active: z.boolean() });

/** Deactivating takes effect on the person's very next request — they read and do nothing. */
export async function setMemberActiveAction(
  input: z.input<typeof activeInput>,
): Promise<ActionResult<null>> {
  const v = parse(activeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_member_active", {
    p_member: v.data.memberId,
    p_active: v.data.active,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: null };
}
