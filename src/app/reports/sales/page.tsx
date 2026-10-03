import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { getLocale, getMsg, getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { getChannelNames } from "@/lib/db/channels";
import {
  analysisProblem,
  barWidth,
  dimensionLabel,
  isSalesDimension,
  namesIn,
  rowName,
  SALES_DIMENSIONS,
  TIME_DIMENSIONS,
  WEEKDAYS,
  type AnalysisRow,
  type SalesDimension,
} from "@/lib/analysis";
import { fmtIQD, fmtQty } from "@/lib/format";
import { ColumnChart, type Column } from "@/components/charts/ColumnChart";
import { addDays, businessToday, daysBetween, monthEnd, monthStart, parseDay } from "@/lib/dates";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The sales analysis (0051, release Y): the sales of the dates by one thing
 * and, if wanted, a second — the hour, the day, a product, a person, a
 * payment… — narrowed to a channel, a branch, a category or a person. Each
 * sale counts as it was paid, and what its refunds gave back since is taken
 * off it, so every way of looking adds up to the same sales.
 */
export default async function SalesAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const [t, msg, locale, sp, channels] = await Promise.all([
    getT(),
    getMsg(),
    getLocale(),
    searchParams,
    getChannelNames(),
  ]);
  const today = businessToday(profile.timezone);
  const from = parseDay(sp.from, monthStart(today));
  const to = parseDay(sp.to, today);
  const one = (k: string): string | null => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const byRaw = one("by");
  const by: SalesDimension = isSalesDimension(byRaw) ? byRaw : "product";
  const thenRaw = one("then");
  const then: SalesDimension | null = isSalesDimension(thenRaw) && thenRaw !== by ? thenRaw : null;
  const channel = channels.channels.some((c) => c.code === one("channel")) ? one("channel") : null;
  const uuid = (k: string) => {
    const v = one(k);
    return v && UUID.test(v) ? v : null;
  };
  const location = uuid("location");
  const category = uuid("category");
  const cashier = uuid("cashier");

  const problem =
    from > to
      ? "Choose the dates, the first on or before the last"
      : daysBetween(from, to) > 366
        ? "Choose at most a year of dates"
        : analysisProblem(by, then, category);
  const a = problem
    ? null
    : await getSalesAnalysis({ from, to, by, then, channel, location, category, cashier });

  const name = (dim: SalesDimension, key: string, names: AnalysisRow["names"]) => {
    const n = rowName(dim, key, names, locale, channels.name);
    return n.phrase ? t(n.text) : n.text;
  };
  const query = (over: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const all: Record<string, string | null> = {
      from,
      to,
      by,
      then,
      channel,
      location,
      category,
      cashier,
      ...over,
    };
    for (const [k, v] of Object.entries(all)) if (v) q.set(k, v);
    return q.toString();
  };
  const lastMonthEnd = addDays(monthStart(today), -1);
  const ranges: [string, string, string][] = [
    ["Today", today, today],
    ["Last 7 days", addDays(today, -6), today],
    ["This month", monthStart(today), today],
    ["Last month", monthStart(lastMonthEnd), monthEnd(lastMonthEnd)],
  ];
  // Sales over time drawn as well (one way only, not the payments'): every
  // hour from the first to the last sold in, every day of the dates (two
  // months at most), every day of the week; a gap is a column of nothing.
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const timeChart: { columns: Column[]; per: "hour" | "day" | null } | null = (() => {
    if (!a || then || a.grain === "payment" || !TIME_DIMENSIONS.has(by) || a.rows.length === 0)
      return null;
    const byKey = new Map(a.rows.map((r) => [r.key, r]));
    const column = (key: string, label: string, detail: string): Column => {
      const r = byKey.get(key);
      return {
        key,
        label,
        value: Math.max(r?.net ?? 0, 0),
        valueText: fmtIQD(r?.net ?? 0),
        detail: `${detail} · ${t("{n} order(s)", { n: r?.orders ?? 0 })}`,
        emphasis: true,
      };
    };
    if (by === "hour") {
      const hours = a.rows.map((r) => Number(r.key));
      const first = Math.min(...hours);
      const last = Math.max(...hours);
      return {
        per: "hour",
        columns: Array.from({ length: last - first + 1 }, (_, i) => first + i).map((h) =>
          column(String(h), String(h), `${hh(h)}–${hh(h + 1)}`),
        ),
      };
    }
    if (by === "weekday")
      return {
        per: null,
        columns: WEEKDAYS.map((d, i) => column(String(i), t(d), t(d))),
      };
    if (daysBetween(from, to) > 61) return null;
    return {
      per: "day",
      columns: Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i)).map(
        (d) => column(d, d.slice(8).replace(/^0/, ""), d),
      ),
    };
  })();
  const sold = timeChart?.columns.filter((c) => c.value > 0) ?? [];
  const perAverage = sold.length ? sold.reduce((s, c) => s + c.value, 0) / sold.length : 0;

  // The bar beside each row: the most of the first way's groups sets its length.
  const measure = (r: AnalysisRow) => (a?.grain === "payment" ? r.paid : r.net);
  const most = a ? Math.max(0, ...a.rows.map(measure)) : 0;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <PrintHead
        business={profile.businessName}
        title={t("Sales analysis")}
        period={t("{from} to {to}", { from, to })}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>{t("Sales analysis")}</h1>
        <PrintButton />
        <span className="sc">
          <Link className="drill" href={`/reports?from=${from}&to=${to}`}>
            {t("← Reports")}
          </Link>
        </span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem", lineHeight: 1.6 }}>
        {t(
          "The sales of the dates, seen one way and, if you like, a second. Each sale counts as it was paid; what its refunds gave back since is taken off it, whenever they were made. Voided sales are left out.",
        )}
      </p>

      <form className="card grid" style={{ gap: 12 }} data-testid="analysis-form">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            <div className="sc">{t("From")}</div>
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label>
            <div className="sc">{t("To")}</div>
            <input type="date" name="to" defaultValue={to} />
          </label>
          <label>
            <div className="sc">{t("See the sales by")}</div>
            <select name="by" defaultValue={by} data-testid="analysis-by">
              {SALES_DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {t(d.label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="sc">{t("Then by")}</div>
            <select name="then" defaultValue={then ?? ""} data-testid="analysis-then">
              <option value="">{t("Nothing more")}</option>
              {SALES_DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {t(d.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            <div className="sc">{t("Channel")}</div>
            <select name="channel" defaultValue={channel ?? ""}>
              <option value="">{t("Every channel")}</option>
              {channels.channels.map((c) => (
                <option key={c.code} value={c.code}>
                  {channels.name(c.code)}
                </option>
              ))}
            </select>
          </label>
          {a && a.choices.branches.length > 1 && (
            <label>
              <div className="sc">{t("Branch")}</div>
              <select name="location" defaultValue={location ?? ""}>
                <option value="">{t("Every branch")}</option>
                {a.choices.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <div className="sc">{t("Category")}</div>
            <select name="category" defaultValue={category ?? ""}>
              <option value="">{t("Every category")}</option>
              {(a?.choices.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {namesIn(c.names, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="sc">{t("Who took the money")}</div>
            <select name="cashier" defaultValue={cashier ?? ""} data-testid="analysis-cashier">
              <option value="">{t("Everyone")}</option>
              {(a?.choices.people ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">
            {t("Show")}
          </button>
        </div>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ranges.map(([label, f, tt]) => (
            <Link
              key={label}
              className="badge"
              href={`/reports/sales?${query({ from: f, to: tt })}`}
            >
              {t(label)}
            </Link>
          ))}
        </span>
      </form>

      {problem && (
        <p className="badge err" style={{ whiteSpace: "normal" }} data-testid="analysis-problem">
          {msg(problem)}
        </p>
      )}

      {a && (
        <section className="panel" data-testid="analysis" data-grain={a.grain}>
          <div className="panel-h">
            <h3>
              {then
                ? t("By {first}, then by {second}", {
                    first: t(dimensionLabel(by)),
                    second: t(dimensionLabel(then)),
                  })
                : t("By {first}", { first: t(dimensionLabel(by)) })}
            </h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("{from} to {to}", { from, to })} ·{" "}
              <a href={`/reports/export?report=sales_analysis&${query({})}`}>{t("CSV")}</a>
            </span>
          </div>
          {a.rows.length === 0 ? (
            <div className="panel-b">
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                {t("No sales in these dates.")}
              </p>
            </div>
          ) : (
            <>
              {timeChart && (
                <div className="panel-b rep-chart" data-testid="analysis-chart">
                  <ColumnChart
                    title={t("Net sales")}
                    columnsName={t("Net sales")}
                    labels={{ table: t("Show as a table"), heading: t(dimensionLabel(by)) }}
                    reference={
                      timeChart.per && perAverage > 0
                        ? {
                            value: perAverage,
                            label:
                              timeChart.per === "hour"
                                ? t("Average: {amount} an hour sold in", {
                                    amount: fmtIQD(perAverage),
                                  })
                                : t("Average: {amount} a day sold in", {
                                    amount: fmtIQD(perAverage),
                                  }),
                          }
                        : undefined
                    }
                    columns={timeChart.columns}
                  />
                </div>
              )}
              <div className="tw">
                <table data-testid="analysis-table">
                  <thead>
                    <tr>
                      <th>{t(dimensionLabel(by))}</th>
                      {then && <th>{t(dimensionLabel(then))}</th>}
                      {a.grain === "payment" ? (
                        <>
                          <th className="right">{t("Sales")}</th>
                          <th className="right">{t("Paid")}</th>
                          <th className="right">{t("Given back")}</th>
                          <th className="right">{t("Kept")}</th>
                        </>
                      ) : (
                        <>
                          <th className="right">
                            {a.grain === "addon" ? t("Times taken") : t("Orders")}
                          </th>
                          <th className="right">{t("Items")}</th>
                          <th className="right">{t("Sold for")}</th>
                          <th className="right">{t("Discount")}</th>
                          <th className="right">{t("Net")}</th>
                          <th className="right">{t("Cost")}</th>
                          <th className="right">{t("Margin")}</th>
                          {a.grain === "line" && (
                            <>
                              <th className="right">{t("Given back")}</th>
                              <th className="right">{t("Kept")}</th>
                              <th className="right">{t("Margin kept")}</th>
                            </>
                          )}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {a.rows.map((r, i) => {
                      const first = i === 0 || a.rows[i - 1]?.key !== r.key;
                      return (
                        <tr
                          key={`${r.key}|${r.key2 ?? ""}`}
                          data-testid="analysis-row"
                          data-key={r.key}
                          data-key2={r.key2 ?? ""}
                          data-net={r.net}
                          data-paid={r.paid}
                        >
                          <td>
                            {first || !then ? (
                              <span className="ref">{name(by, r.key, r.names)}</span>
                            ) : (
                              ""
                            )}
                          </td>
                          {then && <td>{name(then, r.key2 ?? "", r.names2 ?? { en: "" })}</td>}
                          {a.grain === "payment" ? (
                            <>
                              <td className="right money">{r.orders}</td>
                              <td className="right money">
                                <Bar width={barWidth(r.paid, most)} />
                                {fmtIQD(r.paid)}
                              </td>
                              <td className="right money">
                                {r.refunded ? `(${fmtIQD(r.refunded)})` : "—"}
                              </td>
                              <td className="right money">{fmtIQD(r.kept)}</td>
                            </>
                          ) : (
                            <>
                              <td className="right money">
                                {a.grain === "addon" ? r.lines : r.orders}
                              </td>
                              <td className="right money">{fmtQty(r.qty)}</td>
                              <td className="right money">{fmtIQD(r.gross)}</td>
                              <td className="right money">
                                {r.discount ? `(${fmtIQD(r.discount)})` : "—"}
                              </td>
                              <td className="right money" data-testid="analysis-net">
                                <Bar width={barWidth(r.net, most)} />
                                {fmtIQD(r.net)}
                              </td>
                              <td className="right money">{fmtIQD(r.cost)}</td>
                              <td className="right money">{fmtIQD(r.margin)}</td>
                              {a.grain === "line" && (
                                <>
                                  <td className="right money">
                                    {r.refunded ? `(${fmtIQD(r.refunded)})` : "—"}
                                  </td>
                                  <td className="right money">{fmtIQD(r.kept)}</td>
                                  <td className="right money">{fmtIQD(r.marginKept)}</td>
                                </>
                              )}
                            </>
                          )}
                        </tr>
                      );
                    })}
                    <tr
                      className="grand"
                      data-testid="analysis-total"
                      data-net={a.total.net}
                      data-paid={a.total.paid}
                      data-kept={a.total.kept}
                    >
                      <td>{t("All")}</td>
                      {then && <td />}
                      {a.grain === "payment" ? (
                        <>
                          <td className="right money">{a.total.orders}</td>
                          <td className="right money">{fmtIQD(a.total.paid)}</td>
                          <td className="right money">
                            {a.total.refunded ? `(${fmtIQD(a.total.refunded)})` : "—"}
                          </td>
                          <td className="right money">{fmtIQD(a.total.kept)}</td>
                        </>
                      ) : (
                        <>
                          <td className="right money">
                            {a.grain === "addon" ? a.total.lines : a.total.orders}
                          </td>
                          <td className="right money">{fmtQty(a.total.qty)}</td>
                          <td className="right money">{fmtIQD(a.total.gross)}</td>
                          <td className="right money">
                            {a.total.discount ? `(${fmtIQD(a.total.discount)})` : "—"}
                          </td>
                          <td className="right money">{fmtIQD(a.total.net)}</td>
                          <td className="right money">{fmtIQD(a.total.cost)}</td>
                          <td className="right money">{fmtIQD(a.total.margin)}</td>
                          {a.grain === "line" && (
                            <>
                              <td className="right money">
                                {a.total.refunded ? `(${fmtIQD(a.total.refunded)})` : "—"}
                              </td>
                              <td className="right money">{fmtIQD(a.total.kept)}</td>
                              <td className="right money">{fmtIQD(a.total.marginKept)}</td>
                            </>
                          )}
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div
            className="panel-b muted"
            style={{ fontSize: ".76rem", lineHeight: 1.7 }}
            data-testid="analysis-notes"
          >
            {a.truncated && (
              <p style={{ margin: "0 0 6px" }}>
                {t("The first {n} rows of {m}: narrow the dates or the choice to see the rest.", {
                  n: String(a.rows.length),
                  m: String(a.rowCount),
                })}
              </p>
            )}
            <p style={{ margin: "0 0 6px" }} data-testid="analysis-left-out">
              {t("Left out: {n} voided sale(s), {amount}; {m} bill(s) cancelled.", {
                n: String(a.voided.orders),
                amount: fmtIQD(a.voided.net),
                m: String(a.cancelledBills),
              })}
            </p>
            <p style={{ margin: 0 }}>
              {a.grain === "addon"
                ? t(
                    "Each add-on as it was sold on its line, its share of the discount taken off. Refunds are not taken off here.",
                  )
                : a.grain === "payment"
                  ? t(
                      "What each way of paying took of the sales, and what their refunds gave back that way. A payment pays for a whole sale, so payments go with the hour, the day, the person, the channel and the branch.",
                    )
                  : t(
                      "Each line as it was sold, its add-ons with it, so the products, the categories and the sizes add up to the sales. The margin is what they came to less the cost of what they used; kept, less what refunds gave back and the cost they put back.",
                    )}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

/** A thin bar under a figure: its share of the largest in the list. */
function Bar({ width }: { width: number }) {
  if (width <= 0) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        height: 4,
        width: `${width}%`,
        marginInlineStart: "auto",
        marginBottom: 3,
        borderRadius: 2,
        background: "var(--accent)",
        opacity: 0.55,
      }}
    />
  );
}
