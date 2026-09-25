import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getJournalLines,
  getProfitAndLoss,
  getReconciliation,
  getTrialBalance,
} from "@/lib/db/reports";
import { getAuditTrail } from "@/lib/db/books";
import { auditGroup } from "@/lib/audit";
import { addDays, businessToday, dateTimeIn, dayStart, monthStart, parseDay } from "@/lib/dates";

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
    } else if (report === "journal_lines") {
      // Every published line in the dates, or an account's (0026): the whole
      // ledger for the accountant's own tools.
      const accounts = (q.get("account") ?? "").split(",").filter((c) => /^\d{4}$/.test(c));
      const { lines } = await getJournalLines(from, to, {
        accounts,
        excludeYearEnd: q.get("pnl") === "1",
      });
      body = csv(
        [
          "journal_no",
          "when",
          "day",
          "account",
          "account_name",
          "debit",
          "credit",
          "narration",
          "memo",
          "source",
          "reference",
          "posted_by",
          "reverses_journal_no",
        ],
        lines.map((l) => [
          l.journalNo ?? "",
          dateTimeIn(s.profile!.timezone, l.occurredAt),
          l.day,
          l.accountCode,
          l.accountName,
          l.debit,
          l.credit,
          l.description,
          l.memo ?? "",
          l.referenceType ?? "",
          l.referenceNo ?? "",
          l.postedBy ?? "",
          l.reversesJournalNo ?? "",
        ]),
      );
      name = `journal-lines_${from}_${to}${accounts.length ? `_${accounts.join("-")}` : ""}.csv`;
    } else if (report === "audit") {
      // Who changed what (0027): every row in the dates, however many.
      if (!s.profile.permissions.includes("audit.view")) {
        return NextResponse.json(
          { error: "You do not have permission to see the audit trail" },
          { status: 403 },
        );
      }
      const tz = s.profile.timezone;
      const group = auditGroup(q.get("group") ?? undefined)?.key ?? null;
      const person = q.get("person");
      const { entries } = await getAuditTrail(
        {
          fromTs: dayStart(from, tz),
          toTs: dayStart(addDays(to, 1), tz),
          group,
          person: person === "none" || /^[0-9a-f-]{36}$/i.test(person ?? "") ? person : null,
        },
        1_000_000,
      );
      body = csv(
        [
          "when",
          "person",
          "action",
          "what_happened",
          "about",
          "changes",
          "reason",
          "before",
          "after",
        ],
        entries.map((e) => [
          dateTimeIn(tz, e.at),
          e.by ?? "no one signed in",
          e.action,
          e.label,
          e.subject,
          e.changes
            .map((c) =>
              c.before === ""
                ? `${c.field}: ${c.after}`
                : c.after === ""
                  ? `${c.field}: ${c.before} (removed)`
                  : `${c.field}: ${c.before} → ${c.after}`,
            )
            .join("; "),
          e.reason ?? "",
          e.before === null ? "" : JSON.stringify(e.before),
          e.after === null ? "" : JSON.stringify(e.after),
        ]),
      );
      name = `audit-trail_${from}_${to}.csv`;
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
