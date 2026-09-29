import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Permission } from "@domain/auth/permissions.js";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { homeFor } from "./routes";

/** Who is signed in, as the database knows them (my_profile()). */
export interface Profile {
  id: string;
  name: string;
  email: string | null;
  businessId: string;
  businessName: string;
  timezone: string;
  currency: string;
  currencyDecimals: number;
  /** A percentage discount comes to the nearest multiple of this (500 IQD). */
  discountRoundTo: number;
  /** Above this share of the bill a discount needs a manager's approval (0028; per role, 0040). */
  discountCap: number;
  /** A refund over this needs a second person (0040); null before the rules. */
  refundApprovalOver: number | null;
  /** A loss over this, alone or added up, needs a manager (0040); null before the rules. */
  wasteApprovalOver: number | null;
  /** What one person's losses are added up over: "entry", "session" or "day" (0040). */
  wasteApprovalWindow: string | null;
  /** Whether they have set the PIN they approve with. */
  hasPin: boolean;
  roles: string[];
  permissions: string[];
  /** The place they work at (0055); null when they work everywhere. */
  worksAt: string | null;
  worksAtName: string | null;
}

export interface SessionState {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  profile: Profile | null;
}

/**
 * The session for this request, looked up once per render. The identity comes
 * from a verified token; the roles and permissions come from the database,
 * which is what actually enforces them.
 */
export const getSession = cache(async (): Promise<SessionState> => {
  if (!supabaseConfig()) return { configured: false, signedIn: false, email: null, profile: null };
  const db = await createServerSupabase();
  const { data: claims } = await db.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) return { configured: true, signedIn: false, email: null, profile: null };
  const email = typeof claims.claims.email === "string" ? claims.claims.email : null;

  const { data, error } = await db.rpc("my_profile");
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  if (!data) return { configured: true, signedIn: true, email, profile: null };
  const p = data as Record<string, unknown>;
  return {
    configured: true,
    signedIn: true,
    email,
    profile: {
      id: String(p.id),
      name: String(p.name),
      email,
      businessId: String(p.business_id),
      businessName: String(p.business_name ?? ""),
      timezone: String(p.timezone ?? "Asia/Baghdad"),
      currency: String(p.currency ?? "IQD"),
      currencyDecimals: Number(p.currency_decimals ?? 0),
      discountRoundTo: Number(p.discount_round_to ?? 0),
      // Before 0028 there was no cap: every discount was the cashier's own.
      discountCap: p.discount_cap_percent == null ? 100 : Number(p.discount_cap_percent),
      refundApprovalOver: p.refund_approval_over == null ? null : Number(p.refund_approval_over),
      wasteApprovalOver: p.waste_approval_over == null ? null : Number(p.waste_approval_over),
      wasteApprovalWindow: p.waste_approval_window == null ? null : String(p.waste_approval_window),
      hasPin: Boolean(p.has_pin),
      roles: Array.isArray(p.roles) ? p.roles.map(String) : [],
      permissions: Array.isArray(p.permissions) ? p.permissions.map(String) : [],
      // Before 0055 everyone worked everywhere.
      worksAt: p.works_at == null ? null : String(p.works_at),
      worksAtName: p.works_at_name == null ? null : String(p.works_at_name),
    },
  };
});

/** The signed-in, active member — or off to sign in / the no-access page. */
export async function requireMember(): Promise<Profile> {
  const s = await getSession();
  if (!s.configured) redirect("/setup");
  if (!s.signedIn) redirect("/login");
  if (!s.profile) redirect("/account");
  return s.profile;
}

/**
 * The member, provided they hold at least one of the permissions; anyone else
 * is sent to their own starting screen. The database checks again on every
 * read and write — this only keeps people out of screens that would be empty.
 */
export async function requirePermission(...anyOf: Permission[]): Promise<Profile> {
  const profile = await requireMember();
  if (!anyOf.some((p) => profile.permissions.includes(p))) redirect(homeFor(profile.permissions));
  return profile;
}

export function has(profile: Profile, permission: Permission): boolean {
  return profile.permissions.includes(permission);
}
