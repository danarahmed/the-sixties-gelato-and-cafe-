import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getProfitAndLoss } from "@/lib/db/reports";
import { getBudgetFor, getBudgetMonth } from "@/lib/db/budget";
import { change, compareRows, compareTotals, yearBefore, type CompareRow } from "@/lib/budget";
import { addDays, businessToday, monthStart, parseDay } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import { PageIntro } from "@/components/PageIntro";
import { ReportVisit } from "@/components/reports/ReportVisit";
import { BudgetForm } from "@/components/reports/BudgetForm";

export const dynamic = "force-dynamic";

/**
 * Reports → Compare (0117): each revenue and cost account in the dates,
 * against the same days a year before and against the budget of the dates;
 * the revenue, the gross profit and the profit, in words. The owner or the
 * accountant sets each month's budget under it.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("profit.view");
  const t = await getT();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const from = parseDay(sp.from, monthStart(today));
  const to = parseDay(sp.to, today);
  const ok = from <= to;
  const mayBudget = profile.roles.includes("owner") || has(profile, "accounting.post");
  const thisMonth = monthStart(today);
  const lastMonthStart = monthStart(addDays(thisMonth, -1));
  const [now, lastYear, budget, monthBudget, lastMonth] = await Promise.all([
    ok ? getProfitAndLoss(from, to) : Promise.resolve([]),
    ok ? getProfitAndLoss(yearBefore(from), yearBefore(to)) : Promise.resolve([]),
    ok ? getBudgetFor(from, to) : Promise.resolve(null),
    mayBudget ? getBudgetMonth(thisMonth) : Promise.resolve(null),
    mayBudget ? getProfitAndLoss(lastMonthStart, addDays(thisMonth, -1)) : Promise.resolve([]),
  ]);
  const rows = compareRows(now, lastYear, budget);
  const totNow = compareTotals(rows, (r) => r.now);
  const totYear = compareTotals(rows, (r) => r.lastYear);
  const totBudget = budget ? compareTotals(rows, (r) => r.budget ?? 0) : null;
  const hasBudget = !!budget && budget.size > 0;

  /** In words: this against that, more being better for revenue and profit. */
  const said = (a: number, b: number, what: string) => {
    const c = change(a, b);
    if (c === null) return t("Nothing to compare with");
    if (Math.abs(c) <= 1) return t("About as {what}", { what });
    return c > 0
      ? t("{pct}% more than {what}", { pct: String(c), what })
      : t("{pct}% less than {what}", { pct: String(-c), what });
  };
  const SECTIONS: [CompareRow["section"], string][] = [
    ["revenue", t("Revenue")],
    ["cost_of_sales", t("Cost of sales")],
    ["operating_expenses", t("Operating expenses")],
  ];
  const cards: [string, keyof typeof totNow, string][] = [
    [t("Net revenue"), "revenue", "cmp-revenue"],
    [t("Gross profit"), "grossProfit", "cmp-gross"],
    [t("Profit"), "net", "cmp-net"],
  ];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <ReportVisit path="/reports/compare" />
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        <Link href="/reports">{t("← Reports")}</Link>
      </p>
      <h1 style={{ margin: 0 }}>{t("Against last year and the budget")}</h1>
      <PageIntro
        text={t(
          "Each revenue and cost account in the dates, beside the same days a year before and beside the budget of the dates (each month's budget shared by the days of it the dates cover).",
        )}
        more={t("How this works")}
      />
      <form className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit">{t("Show")}</button>
      </form>
      {!ok ? (
        <p className="badge err">{t("Choose the dates, the first on or before the last")}</p>
      ) : (
        <>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            {cards.map(([label, key, id]) => (
              <section
                key={key}
                className="card"
                style={{ minWidth: 220, flex: 1 }}
                data-testid={id}
              >
                <div className="sc">{label}</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700 }} className="money">
                  {fmtIQD(totNow[key])}
                </div>
                <div style={{ fontSize: ".85rem" }}>
                  {said(totNow[key], totYear[key], t("a year before"))} ({fmtIQD(totYear[key])})
                </div>
                {totBudget && hasBudget && (
                  <div style={{ fontSize: ".85rem" }} data-testid={`${id}-budget`}>
                    {said(totNow[key], totBudget[key], t("the budget"))} ({fmtIQD(totBudget[key])})
                  </div>
                )}
              </section>
            ))}
          </div>
          <div className="tw">
            <table data-testid="compare-table">
              <thead>
                <tr>
                  <th>{t("Account")}</th>
                  <th className="right">{t("These dates")}</th>
                  <th className="right">{t("A year before")}</th>
                  {hasBudget && <th className="right">{t("Budget")}</th>}
                  {hasBudget && <th className="right">{t("Against the budget")}</th>}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map(([section, label]) => {
                  const mine = rows.filter((r) => r.section === section);
                  if (mine.length === 0) return null;
                  return [
                    <tr key={section}>
                      <th colSpan={hasBudget ? 5 : 3} style={{ textAlign: "start" }}>
                        {label}
                      </th>
                    </tr>,
                    ...mine.map((r) => {
                      const off = hasBudget && r.budget ? change(r.now, r.budget) : null;
                      // More is good for revenue, less is good for a cost.
                      const good =
                        off === null ? null : section === "revenue" ? off >= 0 : off <= 0;
                      return (
                        <tr key={r.code} data-testid="compare-row" data-code={r.code}>
                          <td>
                            <span className="mono muted">{r.code}</span> {r.name}
                          </td>
                          <td className="right money">{fmtIQD(r.now)}</td>
                          <td className="right money muted">{fmtIQD(r.lastYear)}</td>
                          {hasBudget && (
                            <td className="right money muted">
                              {r.budget ? fmtIQD(r.budget) : "—"}
                            </td>
                          )}
                          {hasBudget && (
                            <td className="right">
                              {off === null ? (
                                "—"
                              ) : (
                                <span className={good ? "badge ok" : "badge warn"}>
                                  {off > 0 ? "+" : ""}
                                  {off}%
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {mayBudget && monthBudget && (
        <section className="card grid" style={{ gap: 8 }} id="budget">
          <h2 style={{ margin: 0 }}>{t("This month's budget")}</h2>
          <BudgetForm
            month={thisMonth}
            accounts={now.map((r) => ({ code: r.code, name: r.name, section: r.section }))}
            set={monthBudget}
            lastMonth={Object.fromEntries(lastMonth.map((r) => [r.code, r.amount]))}
          />
        </section>
      )}
    </div>
  );
}
