import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { requirePermission } from "@/lib/auth/session";
import { getUsageVariance, type UsageRow } from "@/lib/db/reports";
import { fmtIQD, fmtQty, movementLabel, unitName } from "@/lib/format";
import { addDays, businessToday, dateTimeIn, monthEnd, monthStart, parseDay } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { PlaceSwitch } from "@/components/PlaceSwitch";
import { placeChoice } from "@/lib/place";

export const dynamic = "force-dynamic";

/**
 * Usage against the recipes (0039, release N): each item between its first
 * and last approved count in the dates. What the counts say went, less what
 * was recorded as lost, set against what the recipes of what was sold and
 * made say it should have used; and what may explain a difference.
 */
export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const msg = await getMsg();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const from = parseDay(sp.from, monthStart(today));
  const to = parseDay(sp.to, today);
  const { places, place, at } = await placeChoice();
  const rows = to < from ? [] : await getUsageVariance(from, to, at);
  const pairs = rows.filter((r) => r.counts >= 2);
  const once = rows.filter((r) => r.counts < 2);
  const over = pairs.filter((r) => r.varianceValue > 0).reduce((s, r) => s + r.varianceValue, 0);
  const under = pairs.filter((r) => r.varianceValue < 0).reduce((s, r) => s - r.varianceValue, 0);
  const q = (n: number | null, unit: string) =>
    n === null ? "—" : `${fmtQty(n)} ${unitName(unit, t)}`;
  const signed = (n: number, unit: string) =>
    `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtQty(Math.abs(n))} ${unitName(unit, t)}`;
  const cameIn = (r: UsageRow) =>
    r.received + r.made + r.transferred + r.openingStock + r.corrected;
  const day = (iso: string | null) => (iso ? dateTimeIn(profile.timezone, iso) : "—");

  const lastMonthEnd = addDays(monthStart(today), -1);
  const ranges: [string, string, string][] = [
    ["This month", monthStart(today), today],
    ["Last month", monthStart(lastMonthEnd), monthEnd(lastMonthEnd)],
    ["Last 90 days", addDays(today, -89), today],
  ];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <PrintHead
        business={profile.businessName}
        title={t("nav.usage")}
        period={t("{from} to {to}", { from, to })}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>{t("nav.usage")}</h1>
        <PlaceSwitch places={places} current={place?.id ?? null} />
        <PrintButton />
        <span className="sc">{t("{from} to {to} · between each item's counts", { from, to })}</span>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        <Rich
          text={t(
            "Between two approved counts of an item: what came in, what the recipes of what was sold and made say was used, and what was recorded as lost. <b>Used</b> is what the counts say went, less the losses recorded; the <b>difference</b> is what no recipe and no recorded loss explains. More used than the recipes is stock gone: bigger portions, waste not recorded, sales not rung up. Less is a smaller portion, or a delivery that was never entered. Count again on <count>Stock Count</count> to see the next stretch.",
          )}
          tags={{ count: (c) => <Link href="/count">{c}</Link> }}
        />
      </p>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit">{t("Show")}</button>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ranges.map(([label, f, tt]) => (
            <Link key={label} className="badge" href={`/inventory/usage?from=${f}&to=${tt}`}>
              {t(label)}
            </Link>
          ))}
        </span>
      </form>

      {pairs.length === 0 ? (
        <EmptyState
          title={t("No item was counted twice in these dates")}
          hint={t(
            "Usage is worked out between two approved counts of an item. Count again, or choose wider dates.",
          )}
        />
      ) : (
        <section className="panel">
          <div className="panel-h">
            <h3>{t("Usage against the recipes")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("Stock gone that nothing explains: {over} · less used than the recipes: {under}", {
                over: fmtIQD(over),
                under: fmtIQD(under),
              })}
            </span>
          </div>
          <div className="tw">
            <table data-testid="usage">
              <thead>
                <tr>
                  <th>{t("Item")}</th>
                  <th>{t("Between the counts")}</th>
                  <th className="right">{t("First count")}</th>
                  <th className="right">{t("Came in")}</th>
                  <th className="right">{t("Last count")}</th>
                  <th className="right">{t("Lost")}</th>
                  <th className="right">{t("Used")}</th>
                  <th className="right">{t("The recipes say")}</th>
                  <th className="right">{t("Difference")}</th>
                  <th className="right">%</th>
                  <th className="right">{t("Value")}</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((r) => (
                  <tr
                    key={r.itemId}
                    data-testid="usage-row"
                    data-item={r.name}
                    style={{ verticalAlign: "top" }}
                  >
                    <td>
                      <Link className="drill" href={`/inventory/${r.itemId}?from=${from}&to=${to}`}>
                        {r.name}
                      </Link>
                      <details style={{ fontSize: ".78rem", marginTop: 4 }}>
                        <summary className="muted">{t("What it is made of")}</summary>
                        <div className="muted" style={{ display: "grid", gap: 2, marginTop: 4 }}>
                          <span>
                            {t(
                              "Came in: received {received}, made {made}, moved {moved}, opening stock {opening}, corrected by hand {corrected}",
                              {
                                received: q(r.received, r.unit),
                                made: q(r.made, r.unit),
                                moved: q(r.transferred, r.unit),
                                opening: q(r.openingStock, r.unit),
                                corrected: q(r.corrected, r.unit),
                              },
                            )}
                          </span>
                          <span>
                            {t("The recipes: sold {sold}, in batches {batches}", {
                              sold: q(r.sold, r.unit),
                              batches: q(r.batches, r.unit),
                            })}
                          </span>
                          {r.losses.length > 0 && (
                            <span>
                              {t("Lost: {losses}", {
                                losses: r.losses
                                  .map((l) => `${t(movementLabel(l.kind))} ${q(l.qty, r.unit)}`)
                                  .join(", "),
                              })}
                            </span>
                          )}
                          {r.products.map((p) => (
                            <span key={`p-${p.name}`} data-testid="usage-product">
                              {t("{name}: {sold} sold, using {used}", {
                                name: p.name,
                                sold: fmtQty(p.sold),
                                used: q(p.used, r.unit),
                              })}
                            </span>
                          ))}
                          {r.recipes.map((p) => (
                            <span key={`b-${p.name}`}>
                              {t("{name}: {batches} batch(es), using {used}", {
                                name: p.name,
                                batches: fmtQty(p.batches),
                                used: q(p.used, r.unit),
                              })}
                            </span>
                          ))}
                        </div>
                      </details>
                      {r.factors.length > 0 && (
                        <ul
                          data-testid="usage-factors"
                          style={{ margin: "4px 0 0", paddingInlineStart: 16, fontSize: ".78rem" }}
                        >
                          {r.factors.map((f) => (
                            <li key={f}>{msg(f)}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="muted mono" style={{ fontSize: ".78rem" }}>
                      {day(r.openedAt)}
                      <br />
                      {day(r.closedAt)}
                    </td>
                    <td className="right mono">{q(r.opening, r.unit)}</td>
                    <td className="right mono">{signed(cameIn(r), r.unit)}</td>
                    <td className="right mono">{q(r.closing, r.unit)}</td>
                    <td className="right mono">{q(r.lost, r.unit)}</td>
                    <td className="right mono">{q(r.actual, r.unit)}</td>
                    <td className="right mono">{q(r.theoretical, r.unit)}</td>
                    <td
                      className={`right mono ${r.variance > 0 ? "red" : ""}`}
                      data-testid="usage-difference"
                    >
                      {signed(r.variance, r.unit)}
                    </td>
                    <td className="right mono">
                      {r.variancePercent === null ? "—" : `${fmtQty(r.variancePercent)}%`}
                    </td>
                    <td className={`right money ${r.varianceValue > 0 ? "red" : ""}`}>
                      {fmtIQD(r.varianceValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {once.length > 0 && (
        <section className="panel" data-testid="usage-once">
          <div className="panel-h">
            <h3>{t("Counted once in these dates")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("A second count gives what they used")}
            </span>
          </div>
          <div className="panel-b" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {once.map((r) => (
              <span key={r.itemId} className="badge">
                {r.name} · {q(r.opening, r.unit)} · <bdi>{day(r.openedAt)}</bdi>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
