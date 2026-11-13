import "server-only";
/** Support access (0109): what the owner has given, and each visit. Null before 0109, or not the owner. */
import { db } from "./client";

export interface SupportAccess {
  openUntil: string | null;
  grants: {
    grantedAt: string;
    until: string;
    reason: string;
    revokedAt: string | null;
    by: string;
  }[];
  visits: string[];
}

export async function getSupportAccess(): Promise<SupportAccess | null> {
  const c = await db();
  const r = await c.rpc("support_access");
  if (r.error || !r.data) return null;
  const d = r.data as Record<string, unknown>;
  return {
    openUntil: typeof d.open_until === "string" ? d.open_until : null,
    grants: (Array.isArray(d.grants) ? (d.grants as Record<string, unknown>[]) : []).map((g) => ({
      grantedAt: String(g.granted_at),
      until: String(g.until),
      reason: String(g.reason ?? ""),
      revokedAt: typeof g.revoked_at === "string" ? g.revoked_at : null,
      by: String(g.by ?? ""),
    })),
    visits: (Array.isArray(d.visits) ? d.visits : []).map(String),
  };
}

export interface SupportProblem {
  id: string;
  business: string;
  page: string;
  what: string;
  error: string | null;
  status: string;
  at: string;
  by: string;
}

export async function getSupportProblems(): Promise<SupportProblem[] | null> {
  const c = await db();
  const r = await c.rpc("admin_problem_reports");
  if (r.error || !Array.isArray(r.data)) return null;
  return (r.data as Record<string, unknown>[]).map((p) => ({
    id: String(p.id),
    business: String(p.business ?? ""),
    page: String(p.page ?? ""),
    what: String(p.what ?? ""),
    error: typeof p.error === "string" ? p.error : null,
    status: String(p.status ?? "open"),
    at: String(p.at ?? ""),
    by: String(p.by ?? ""),
  }));
}
