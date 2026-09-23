import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getProfitAndLoss, getReconciliation, getTrialBalance } from "@/lib/db/reports";
import { businessToday, monthStart, parseDay } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** One CSV field, quoted when it needs to be; formula-looking text is defused. */
function field(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

/**
 * Statements as CSV, for the accountant's own tools (audit L-05). Runs as the
 * signed-in person, so the database's permission checks apply exactly as on
 * screen: a report someone may not see, they may not download either.
 */
export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s.profile) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const today = businessToday(s.profile.timezone);
  const from = parseDay(q.get("from") ?? undefined, monthStart(today));
  const to = parseDay(q.get("to") ?? undefined, today);
  const report = q.get("report");

  let body: string;
  let name: string;
  try {
    if (report === "trial_balance") {
      const rows = await getTrialBalance(from, to);
      body = csv(
        ["code", "account", "type", "opening", "debit", "credit", "closing"],
        rows.map((r) => [r.code, r.name, r.type, r.opening, r.debit, r.credit, r.closing]),
      );
      name = `trial-balance_${from}_${to}.csv`;
    } else if (report === "pnl") {
      const rows = await getProfitAndLoss(from, to);
      body = csv(
        ["code", "account", "section", "amount"],
        rows.map((r) => [r.code, r.name, r.section, r.amount]),
      );
      name = `profit-and-loss_${from}_${to}.csv`;
    } else if (report === "reconciliation") {
      const rows = await getReconciliation(to);
      body = csv(
        ["check", "label", "subledger", "ledger", "difference"],
        rows.map((r) => [r.key, r.label, r.subledger, r.ledger, r.difference]),
      );
      name = `reconciliation_${to}.csv`;
    } else {
      return NextResponse.json({ error: "Unknown report" }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not produce the report";
    const denied = /permission/i.test(message);
    return NextResponse.json(
      { error: denied ? "You do not have permission to see this report" : message },
      {
        status: denied ? 403 : 500,
      },
    );
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
