import Link from "next/link";
import { getLocale, getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getStockValue } from "@/lib/db/analysis";
import { itemNameIn } from "@/lib/analysis";
import { fmtIQD, fmtQty, itemTypeLabel } from "@/lib/format";
import { businessToday, parseDay } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * The stock's value at the end of a day (0051, release Y): every item's stock
 * and value from the stock ledger as they stood then, and what 1200 Inventory
 * held — the two sides of the books check.
 */
export default async function StockValuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const [t, locale, sp] = await Promise.all([getT(), getLocale(), searchParams]);
  const today = businessToday(profile.timezone);
  const asOf = parseDay(sp.on, today);
  const later = asOf > today;
  const v = later ? null : await getStockValue(asOf, null);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Stock value on a day")}</h1>
        <span className="sc">
          <Link className="drill" href="/reports">
            {t("← Reports")}
          </Link>
        </span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem", lineHeight: 1.6 }}>
        {t(
          "What every item in stock was worth when the day ended, from the stock ledger, beside what 1200 Inventory held then. The two agree when the books tie.",
        )}
      </p>
      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">{t("On")}</div>
          <input type="date" name="on" defaultValue={asOf} max={today} />
        </label>
        <button type="submit">{t("Show")}</button>
      </form>

      {later && (
        <p className="badge err" style={{ whiteSpace: "normal" }}>
          {t("Choose today or a day before it")}
        </p>
      )}

      {v && (
        <>
          <div className="card grid" style={{ gap: 6 }} data-testid="stock-value-summary">
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
              <span>
                {t("The stock ledger")}: <b className="mono">{fmtIQD(v.stock)}</b>
              </span>
              {v.ledger !== null && (
                <span>
                  {t("1200 Inventory")}: <b className="mono">{fmtIQD(v.ledger)}</b>
                </span>
              )}
              {v.difference !== null && (
                <span
                  className={v.difference === 0 ? "badge ok" : "badge err"}
                  data-testid="stock-value-difference"
                >
                  {v.difference === 0
                    ? t("They agree")
                    : t("Difference: {amount}", { amount: fmtIQD(v.difference) })}
                </span>
              )}
            </div>
            {v.byType.length > 0 && (
              <div className="muted" style={{ fontSize: ".85rem" }}>
                {v.byType.map((x) => `${t(itemTypeLabel(x.type))} ${fmtIQD(x.value)}`).join(" · ")}
              </div>
            )}
          </div>

          <section className="panel">
            <div className="panel-h">
              <h3>{t("Item by item")}</h3>
              <span className="muted" style={{ fontSize: ".74rem" }}>
                <a href={`/reports/export?report=stock_value&on=${asOf}`}>{t("CSV")}</a>
              </span>
            </div>
            {v.items.length === 0 ? (
              <div className="panel-b">
                <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                  {t("Nothing was in stock then.")}
                </p>
              </div>
            ) : (
              <div className="tw">
                <table data-testid="stock-value-items">
                  <thead>
                    <tr>
                      <th>{t("Item")}</th>
                      <th>{t("Kind")}</th>
                      <th className="right">{t("In stock")}</th>
                      <th className="right">{t("Cost of one")}</th>
                      <th className="right">{t("Value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.items.map((i) => (
                      <tr key={i.itemId} data-testid="stock-value-item" data-name={i.name}>
                        <td>
                          <Link className="drill" href={`/inventory/${i.itemId}`}>
                            {itemNameIn(i, locale)}
                          </Link>
                        </td>
                        <td>{t(itemTypeLabel(i.type))}</td>
                        <td className="right money">
                          {fmtQty(i.qty)} {i.unit}
                        </td>
                        <td className="right money">
                          {i.unitCost === null ? "—" : fmtQty(i.unitCost)}
                        </td>
                        <td className="right money">{fmtIQD(i.value)}</td>
                      </tr>
                    ))}
                    <tr className="grand">
                      <td>{t("All")}</td>
                      <td />
                      <td />
                      <td />
                      <td className="right money">{fmtIQD(v.stock)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
