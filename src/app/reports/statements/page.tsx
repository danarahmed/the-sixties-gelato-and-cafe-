import Link from "next/link";
import { getMsg, getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getBalanceSheet, getCashFlow } from "@/lib/db/statements";
import {
  balanceRows,
  CASH_FLOW_SECTIONS,
  cashFlowLabel,
  type BalanceRow,
  type CashFlowLine,
} from "@/lib/statements";
import { fmtIQD } from "@/lib/format";
import {
  addDays,
  businessToday,
  daysBetween,
  monthEnd,
  monthStart,
  parseDay,
  yearStart,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * The balance sheet and the cash-flow statement (0052, release Z): what the
 * café owned and owed when the day before the dates ended and when they
 * ended, side by side, and where its cash came from and went in between. The
 * cash at the start and what moved come to the cash at the end.
 */
export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("profit.view");
  const [t, msg, sp] = await Promise.all([getT(), getMsg(), searchParams]);
  const today = businessToday(profile.timezone);
  const from = parseDay(sp.from, monthStart(today));
  const to = parseDay(sp.to, today);
  const problem =
    from > to
      ? "Choose the dates, the first on or before the last"
      : daysBetween(from, to) > 366
        ? "Choose at most a year of dates"
        : to > today
          ? "Choose today or a day before it"
          : null;
  const before = addDays(from, -1);
  const [start, end, flow] = problem
    ? [null, null, null]
    : await Promise.all([getBalanceSheet(before), getBalanceSheet(to), getCashFlow(from, to)]);
  const rows = start && end ? balanceRows(start, end) : null;

  const lastMonthEnd = addDays(monthStart(today), -1);
  const ranges: [string, string, string][] = [
    ["This month", monthStart(today), today],
    ["Last month", monthStart(lastMonthEnd), monthEnd(lastMonthEnd)],
    ["This year", yearStart(today), today],
  ];
  const journals = (code: string) => `/journals?account=${code}&from=${from}&to=${to}`;

  const accountRows = (list: BalanceRow[]) =>
    list.map((r) => (
      <tr
        key={r.code}
        data-testid="bs-row"
        data-code={r.code}
        data-start={r.start}
        data-end={r.end}
      >
        <td style={{ paddingInlineStart: 14 }}>
          <Link className="drill" href={journals(r.code)}>
            {r.code} {msg(r.name)}
          </Link>
        </td>
        <td className={`right money ${r.start < 0 ? "red" : ""}`}>{fmtIQD(r.start)}</td>
        <td className={`right money ${r.end < 0 ? "red" : ""}`}>{fmtIQD(r.end)}</td>
      </tr>
    ));
  const head = (label: string) => (
    <tr>
      <td colSpan={3} style={{ fontWeight: 600, paddingBlockStart: 12 }}>
        {t(label)}
      </td>
    </tr>
  );
  const total = (label: string, a: number, b: number, kind: string, grand = false) => (
    <tr
      className={grand ? "grand" : undefined}
      data-testid="bs-total"
      data-kind={kind}
      data-start={a}
      data-end={b}
    >
      <td style={{ fontWeight: 600 }}>{t(label)}</td>
      <td className="right money" style={{ fontWeight: 600 }}>
        {fmtIQD(a)}
      </td>
      <td className="right money" style={{ fontWeight: 600 }}>
        {fmtIQD(b)}
      </td>
    </tr>
  );
  const flowRow = (l: CashFlowLine) => {
    const label = cashFlowLabel(l.line);
    return [
      <tr
        key={l.line}
        data-testid="cf-line"
        data-line={l.line}
        data-amount={l.amount}
        data-in={l.cameIn}
        data-out={l.wentOut}
      >
        <td style={{ paddingInlineStart: 14 }}>{label.phrase ? t(label.text) : label.text}</td>
        <td className="right money">{l.cameIn ? fmtIQD(l.cameIn) : "—"}</td>
        <td className="right money">{l.wentOut ? fmtIQD(l.wentOut) : "—"}</td>
        <td className={`right money ${l.amount < 0 ? "red" : ""}`}>{fmtIQD(l.amount)}</td>
      </tr>,
      ...l.accounts.map((a) => (
        <tr key={`${l.line}-${a.code}`} className="muted" style={{ fontSize: ".8rem" }}>
          <td style={{ paddingInlineStart: 28 }}>
            <Link className="drill" href={journals(a.code)}>
              {a.code} {msg(a.name)}
            </Link>
          </td>
          <td />
          <td />
          <td className="right money">{fmtIQD(a.amount)}</td>
        </tr>
      )),
    ];
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Balance sheet and cash flow")}</h1>
        <span className="sc">
          <Link className="drill" href={`/reports?from=${from}&to=${to}`}>
            {t("← Reports")}
          </Link>
        </span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem", lineHeight: 1.6 }}>
        {t(
          "What the café owned and owed when the day before the dates ended and when they ended, and where its cash came from and went in between: from the published journals, as the trial balance has them.",
        )}
      </p>
      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
        data-testid="statements-form"
      >
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={to} max={today} />
        </label>
        <button type="submit" className="btn-primary">
          {t("Show")}
        </button>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ranges.map(([label, f, tt]) => (
            <Link key={label} className="badge" href={`/reports/statements?from=${f}&to=${tt}`}>
              {t(label)}
            </Link>
          ))}
        </span>
      </form>

      {problem && (
        <p className="badge err" style={{ whiteSpace: "normal" }} data-testid="statements-problem">
          {t(problem)}
        </p>
      )}

      {start && end && rows && (
        <section className="panel" data-testid="balance-sheet">
          <div className="panel-h">
            <h3>{t("Balance sheet")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              <a href={`/reports/export?report=balance_sheet&on=${to}`}>{t("CSV")}</a>
            </span>
          </div>
          <div className="panel-b">
            <p className="muted" style={{ margin: "0 0 8px", fontSize: ".8rem", lineHeight: 1.6 }}>
              {t(
                "Each account's balance from the published journals when the day ended. Revenue and expenses not yet closed into Retained earnings (on locking December) are the owner's profit.",
              )}
            </p>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Account")}</th>
                  <th className="right">{t("End of {day}", { day: before })}</th>
                  <th className="right">{t("End of {day}", { day: to })}</th>
                </tr>
              </thead>
              <tbody>
                {head("What the café owns")}
                {accountRows(rows.cash)}
                {total("Cash in hand and at the bank", start.cash, end.cash, "cash")}
                {accountRows(rows.current)}
                {total("Current assets", start.currentAssets, end.currentAssets, "current")}
                {accountRows(rows.fixed)}
                {total("Fixed assets", start.fixedAssets, end.fixedAssets, "fixed")}
                {total("Total assets", start.assets, end.assets, "assets", true)}
                {head("What the café owes")}
                {accountRows(rows.liability)}
                {total("Total owed", start.liabilities, end.liabilities, "liabilities")}
                {head("The owner's")}
                {accountRows(rows.equity)}
                {(start.profitEarlier !== 0 || end.profitEarlier !== 0) && (
                  <tr
                    data-testid="bs-profit-earlier"
                    data-start={start.profitEarlier}
                    data-end={end.profitEarlier}
                  >
                    <td style={{ paddingInlineStart: 14 }}>
                      {t("Profit of earlier years, not yet closed")}
                    </td>
                    <td className={`right money ${start.profitEarlier < 0 ? "red" : ""}`}>
                      {fmtIQD(start.profitEarlier)}
                    </td>
                    <td className={`right money ${end.profitEarlier < 0 ? "red" : ""}`}>
                      {fmtIQD(end.profitEarlier)}
                    </td>
                  </tr>
                )}
                <tr
                  data-testid="bs-profit"
                  data-start={start.profitThisYear}
                  data-end={end.profitThisYear}
                >
                  <td style={{ paddingInlineStart: 14 }}>
                    {t("Profit this year, not yet closed")}
                  </td>
                  <td className={`right money ${start.profitThisYear < 0 ? "red" : ""}`}>
                    {fmtIQD(start.profitThisYear)}
                  </td>
                  <td className={`right money ${end.profitThisYear < 0 ? "red" : ""}`}>
                    {fmtIQD(end.profitThisYear)}
                  </td>
                </tr>
                {total("Total equity", start.equityTotal, end.equityTotal, "equity")}
                {total(
                  "Owed and the owner's",
                  start.liabilitiesAndEquity,
                  end.liabilitiesAndEquity,
                  "both",
                  true,
                )}
              </tbody>
            </table>
          </div>
          <div className="panel-b">
            {start.difference === 0 && end.difference === 0 ? (
              <span className="badge ok" data-testid="bs-balances">
                {t("It balances")}
              </span>
            ) : (
              <span className="badge err" data-testid="bs-balances">
                {t("Out by {amount}", {
                  amount: fmtIQD(end.difference !== 0 ? end.difference : start.difference),
                })}
              </span>
            )}
          </div>
        </section>
      )}

      {flow && start && end && (
        <section className="panel" data-testid="cash-flow">
          <div className="panel-h">
            <h3>{t("Cash flow")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("{from} to {to}", { from, to })} ·{" "}
              <a href={`/reports/export?report=cash_flow&from=${from}&to=${to}`}>{t("CSV")}</a>
            </span>
          </div>
          <div className="panel-b">
            <p className="muted" style={{ margin: "0 0 8px", fontSize: ".8rem", lineHeight: 1.6 }}>
              {t(
                "Where the cash in the till, the safe and the bank came from and went, read from what else each journal that moved it touched. Money moved between the till, the safe and the bank is no flow; a bill paid counts as what it was for.",
              )}
            </p>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th />
                  <th className="right">{t("Came in")}</th>
                  <th className="right">{t("Went out")}</th>
                  <th className="right">{t("Net")}</th>
                </tr>
              </thead>
              <tbody>
                <tr data-testid="cf-cash-start" data-amount={flow.opening}>
                  <td style={{ fontWeight: 600 }}>{t("Cash at the start")}</td>
                  <td />
                  <td />
                  <td className="right money" style={{ fontWeight: 600 }}>
                    {fmtIQD(flow.opening)}
                  </td>
                </tr>
                {flow.lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      {t("Nothing moved the cash in these dates.")}
                    </td>
                  </tr>
                )}
                {CASH_FLOW_SECTIONS.filter((s) =>
                  flow.lines.some((l) => l.section === s.key),
                ).flatMap((s) => [
                  <tr
                    key={s.key}
                    data-testid="cf-section"
                    data-section={s.key}
                    data-amount={flow[s.key]}
                  >
                    <td style={{ fontWeight: 600, paddingBlockStart: 12 }}>{t(s.label)}</td>
                    <td />
                    <td />
                    <td
                      className={`right money ${flow[s.key] < 0 ? "red" : ""}`}
                      style={{ fontWeight: 600, paddingBlockStart: 12 }}
                    >
                      {fmtIQD(flow[s.key])}
                    </td>
                  </tr>,
                  ...flow.lines.filter((l) => l.section === s.key).flatMap(flowRow),
                ])}
                <tr className="grand" data-testid="cf-net" data-amount={flow.net}>
                  <td>{t("Net change in cash")}</td>
                  <td />
                  <td />
                  <td className={`right money ${flow.net < 0 ? "red" : ""}`}>{fmtIQD(flow.net)}</td>
                </tr>
                <tr data-testid="cf-cash-end" data-amount={flow.closing}>
                  <td style={{ fontWeight: 600 }}>{t("Cash at the end")}</td>
                  <td />
                  <td />
                  <td className="right money" style={{ fontWeight: 600 }}>
                    {fmtIQD(flow.closing)}
                  </td>
                </tr>
                {flow.cash.map((c) => (
                  <tr
                    key={c.code}
                    className="muted"
                    style={{ fontSize: ".8rem" }}
                    data-testid="cf-cash"
                  >
                    <td style={{ paddingInlineStart: 14 }}>
                      {c.code} {msg(c.name)}
                    </td>
                    <td colSpan={3} className="right money">
                      {t("{from} to {to}", { from: fmtIQD(c.opening), to: fmtIQD(c.closing) })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-b">
            {flow.difference === 0 && flow.opening === start.cash && flow.closing === end.cash ? (
              <span className="badge ok" data-testid="cf-adds-up">
                {t("It adds up: the cash at the start and at the end are the balance sheet's.")}
              </span>
            ) : (
              <span className="badge err" data-testid="cf-adds-up">
                {t("Out by {amount}", {
                  amount: fmtIQD(
                    flow.difference !== 0
                      ? flow.difference
                      : flow.closing - end.cash || flow.opening - start.cash,
                  ),
                })}
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
