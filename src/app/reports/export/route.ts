import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getExceptions,
  getJournalLines,
  getProfitAndLoss,
  getReconciliation,
  getTrialBalance,
} from "@/lib/db/reports";
import { getAuditTrail } from "@/lib/db/books";
import { auditGroup } from "@/lib/audit";
import { EXCEPTION_LABEL } from "@/lib/exceptions";
import { getPurchases, getSalesAnalysis, getStockValue } from "@/lib/db/analysis";
import { isSalesDimension, type SalesDimension } from "@/lib/analysis";
import { getBalanceSheet, getCashFlow } from "@/lib/db/statements";
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
    } else if (report === "exceptions") {
      // Voids, refunds, discounts, cancelled bills, lines taken off and wrong
      // PINs, by person (0028); report_exceptions checks audit.view itself.
      const rows = await getExceptions(from, to, 1_000_000);
      const tz = s.profile.timezone;
      body = csv(
        [
          "when",
          "kind",
          "what",
          "person",
          "amount",
          "reason",
          "approved_by",
          "needs_review",
          "reference",
          "detail",
        ],
        rows.map((e) => [
          dateTimeIn(tz, e.at),
          e.kind,
          EXCEPTION_LABEL[e.kind] ?? e.kind,
          e.person ?? "",
          e.amount ?? "",
          e.reason ?? "",
          e.approvedBy ?? "",
          e.needsReview ? "yes" : "no",
          e.reference,
          e.detail ?? "",
        ]),
      );
      name = `exceptions_${from}_${to}.csv`;
    } else if (report === "reconciliation") {
      const rows = await getReconciliation(to);
      body = csv(
        ["check", "label", "subledger", "ledger", "difference"],
        rows.map((r) => [r.key, r.label, r.subledger, r.ledger, r.difference]),
      );
      name = `reconciliation_${to}.csv`;
    } else if (report === "sales_analysis") {
      // The sales analysis (0051), as the screen shows it: English column names,
      // the keys as the database gives them, beside the names.
      const by: SalesDimension = isSalesDimension(q.get("by"))
        ? (q.get("by") as SalesDimension)
        : "product";
      const thenRaw = q.get("then");
      const then: SalesDimension | null =
        isSalesDimension(thenRaw) && thenRaw !== by ? thenRaw : null;
      const uuid = (k: string) => {
        const v = q.get(k);
        return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
      };
      const a = await getSalesAnalysis({
        from,
        to,
        by,
        then,
        channel: q.get("channel") || null,
        location: uuid("location"),
        category: uuid("category"),
        cashier: uuid("cashier"),
      });
      const keys = (r: (typeof a.rows)[number]) =>
        then ? [r.key, r.names.en, r.key2 ?? "", r.names2?.en ?? ""] : [r.key, r.names.en];
      const head = then ? [by, `${by}_name`, then, `${then}_name`] : [by, `${by}_name`];
      if (a.grain === "payment") {
        body = csv(
          [...head, "sales", "paid", "refunded", "kept"],
          a.rows.map((r) => [...keys(r), r.orders, r.paid, r.refunded, r.kept]),
        );
      } else if (a.grain === "addon") {
        body = csv(
          [...head, "lines", "orders", "qty", "gross", "discount", "net", "cost", "margin"],
          a.rows.map((r) => [
            ...keys(r),
            r.lines,
            r.orders,
            r.qty,
            r.gross,
            r.discount,
            r.net,
            r.cost,
            r.margin,
          ]),
        );
      } else {
        body = csv(
          [
            ...head,
            "orders",
            "qty",
            "gross",
            "discount",
            "net",
            "cost",
            "margin",
            "refunded",
            "cost_back",
            "kept",
            "margin_kept",
          ],
          a.rows.map((r) => [
            ...keys(r),
            r.orders,
            r.qty,
            r.gross,
            r.discount,
            r.net,
            r.cost,
            r.margin,
            r.refunded,
            r.costBack,
            r.kept,
            r.marginKept,
          ]),
        );
      }
      name = `sales-analysis_${by}${then ? `-${then}` : ""}_${from}_${to}.csv`;
    } else if (report === "stock_value") {
      // The stock's value at the end of a day (0051), item by item.
      const on = parseDay(q.get("on") ?? undefined, today);
      const v = await getStockValue(on, null);
      body = csv(
        ["item", "type", "unit", "qty", "unit_cost", "value"],
        v.items.map((i) => [i.name, i.type, i.unit, i.qty, i.unitCost ?? "", i.value]),
      );
      name = `stock-value_${on}.csv`;
    } else if (report === "purchases") {
      // What came in, by supplier then by item (0051).
      const b = await getPurchases(from, to);
      body = csv(
        [
          "kind",
          "name",
          "deliveries",
          "qty",
          "unit",
          "received",
          "returned",
          "price_credits",
          "net",
          "billed",
        ],
        [
          ...b.suppliers.map((x) => [
            "supplier",
            x.name,
            x.deliveries,
            "",
            "",
            x.received,
            x.returned,
            x.priceCredits,
            x.net,
            x.billed,
          ]),
          ...b.items.map((i) => [
            "item",
            i.name,
            "",
            i.qty,
            i.unit,
            i.received,
            i.returned,
            "",
            i.net,
            "",
          ]),
        ],
      );
      name = `purchases_${from}_${to}.csv`;
    } else if (report === "balance_sheet") {
      // The balance sheet at the end of a day (0052): each account, then the totals.
      const on = parseDay(q.get("on") ?? undefined, today);
      const b = await getBalanceSheet(on);
      body = csv(
        ["section", "group", "code", "account", "amount"],
        [
          ...b.lines.map((l) => [l.section, l.group, l.code, l.name, l.amount]),
          ["total", "assets", "", "Total assets", b.assets],
          ["total", "liabilities", "", "Total owed", b.liabilities],
          [
            "equity",
            "profit_earlier",
            "",
            "Profit of earlier years, not yet closed",
            b.profitEarlier,
          ],
          ["equity", "profit_this_year", "", "Profit this year, not yet closed", b.profitThisYear],
          ["total", "equity", "", "Total equity", b.equityTotal],
          ["total", "difference", "", "Difference", b.difference],
        ],
      );
      name = `balance-sheet_${on}.csv`;
    } else if (report === "cash_flow") {
      // The cash flow of the dates (0052): each line with the accounts that moved its cash.
      const f = await getCashFlow(from, to);
      body = csv(
        ["section", "line", "code", "account", "in", "out", "amount"],
        [
          ["cash", "opening", "", "Cash at the start", "", "", f.opening],
          ...f.lines.flatMap((l) => [
            [l.section, l.line, "", "", l.cameIn, l.wentOut, l.amount],
            ...l.accounts.map((a) => [l.section, l.line, a.code, a.name, "", "", a.amount]),
          ]),
          ["cash", "net", "", "Net change in cash", "", "", f.net],
          ["cash", "closing", "", "Cash at the end", "", "", f.closing],
          ["cash", "difference", "", "Difference", "", "", f.difference],
        ],
      );
      name = `cash-flow_${from}_${to}.csv`;
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
