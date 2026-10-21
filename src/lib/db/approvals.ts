import "server-only";
/**
 * One approvals inbox (0088, E5): what waits for a manager — stock counts,
 * losses saved to wait, purchase orders drafted and left, the month's pay —
 * each with who asked, when, why and how much, and whether the reader may
 * decide it. The database gives each reader only what their permissions and
 * place allow; each is decided by the function that decides it today.
 */
import { db, num, numOrNull, str, strOrNull, type Row } from "./client";

export type ApprovalKind = "count" | "loss" | "order" | "payroll";

export interface Approval {
  kind: ApprovalKind;
  id: string;
  at: string;
  by: string | null;
  mine: boolean;
  what: string;
  detail: Record<string, unknown>;
  value: number | null;
  reason: string | null;
  mayApprove: boolean;
  mayReject: boolean;
  href: string;
}

const KINDS: ApprovalKind[] = ["count", "loss", "order", "payroll"];

export function approvalsFrom(data: unknown): Approval[] {
  return (Array.isArray(data) ? (data as Row[]) : [])
    .filter((r) => KINDS.includes(str(r.kind) as ApprovalKind))
    .map((r) => ({
      kind: str(r.kind) as ApprovalKind,
      id: str(r.id),
      at: str(r.at),
      by: strOrNull(r.by),
      mine: r.mine === true,
      what: str(r.what),
      detail: (r.detail && typeof r.detail === "object" ? r.detail : {}) as Record<string, unknown>,
      value: numOrNull(r.value),
      reason: strOrNull(r.reason),
      mayApprove: r.may_approve === true,
      mayReject: r.may_reject === true,
      href: str(r.href),
    }));
}

/** The list; null before 0088, when the database does not have it yet. */
export async function getApprovals(): Promise<Approval[] | null> {
  const c = await db();
  const r = await c.rpc("approvals_waiting");
  if (r.error) {
    if (r.error.code === "PGRST202" || r.error.code === "42883") return null;
    throw new Error(`Could not load the approvals: ${r.error.message}`);
  }
  return approvalsFrom(r.data);
}

/** How many, for the menu: none when it cannot be read. */
export async function getApprovalsCount(): Promise<number> {
  try {
    const c = await db();
    const r = await c.rpc("approvals_waiting_count");
    return r.error ? 0 : num(r.data);
  } catch {
    return 0;
  }
}
