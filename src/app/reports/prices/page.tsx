import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { getDir, getLocale, getT } from "@/lib/i18n/server";
import { arrows } from "@/lib/i18n/core";
import { requirePermission } from "@/lib/auth/session";
import { getPriceRises } from "@/lib/db/prices";
import { getChannelNames } from "@/lib/db/channels";
import { addDays, businessToday, dateTimeIn } from "@/lib/dates";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import { wholeDates } from "@/lib/i18n/core";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAYS = 30;

/**
 * The price watch (round five): what came in dearer in the 30 days to today,
 * each delivery against the one before it, and what it does to the margin of
 * every size it touches — on its recipe or through what is made from it — with
 * the price that keeps the margin, and what the rise comes to over a month at
 * the 30 days' sales. Nothing on it is new: deliveries (0027, 0038), recipes,
 * the menu's costs (0017) and the sales analysis (0051).
 */
export default async function PricesPage() {
  const profile = await requirePermission("cost.view");
  const [t, locale, dir, { name: channel }] = await Promise.all([
    getT(),
    getLocale(),
    getDir(),
    getChannelNames(),
  ]);
  // From before to after, the way the reader reads.
  const { on: then } = arrows(dir);
  const today = businessToday(profile.timezone);
  const rises = await getPriceRises(today, { days: DAYS });
  const named = (i: { name: string; nameAr: string | null; nameCkb: string | null }) =>
    (locale === "ar" ? i.nameAr : locale === "ckb" ? i.nameCkb : null) || i.name;
  const pct = (f: number | null) => (f === null ? "—" : `${Math.round(f * 1000) / 10}%`);
  const touched = new Set(rises.flatMap((r) => r.touches.map((x) => x.variantId))).size;
  const repriced = rises.reduce((n, r) => n + r.touches.filter((x) => x.keep !== null).length, 0);
  const month = rises.reduce((s, r) => s + r.month, 0);

  return (
    <div className="grid prices" style={{ gap: 18 }}>
      <PrintHead
        business={profile.businessName}
        title={t("Price watch")}
        period={t("{from} to {to}", { from: addDays(today, -DAYS), to: today })}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>{t("Price watch")}</h1>
        <PrintButton />
        <span className="sc" data-testid="prices-period">
          {t("Deliveries of the last {n} day(s), each against the one before", { n: DAYS })}
        </span>
      </div>

      {rises.length === 0 ? (
        <EmptyState
          title={t("Nothing came in dearer in the last {n} day(s).", { n: DAYS })}
          hint={t("Each delivery is set against the one before it, item by item.")}
        />
      ) : (
        <>
          <div className="kpis" data-testid="prices-tiles">
            <div className="card stat">
              <span className="label">{t("Came in dearer")}</span>
              <span className="value">{rises.length}</span>
              <span className="delta">{t("{n} item(s), by 5% or more", { n: rises.length })}</span>
            </div>
            <div className="card stat">
              <span className="label">{t("What it comes to a month")}</span>
              <span className="value">{fmtIQD(Math.round(month))}</span>
              <span className="delta">{t("At the last 30 days' sales")}</span>
            </div>
            <div className="card stat">
              <span className="label">{t("Sizes it touches")}</span>
              <span className="value">{touched}</span>
              <span className="delta">
                {t("{n} price(s) would keep the margin", { n: repriced })}
              </span>
            </div>
          </div>

          {rises.map((r) => {
            const big = r.item.units.find(
              (u) => (u.code === "kg" || u.code === "L") && u.factor === 1000,
            );
            const unit = big ?? { code: r.item.baseUnit, label: r.item.baseUnit, factor: 1 };
            const per = (perBase: number) => fmtIQD(Math.round(perBase * unit.factor * 100) / 100);
            return (
              <section
                key={r.itemId}
                className="card price-rise"
                data-testid="price-rise"
                data-item={r.item.name}
                aria-labelledby={`rise-${r.itemId}`}
              >
                <div className="price-rise-head">
                  <h2 id={`rise-${r.itemId}`} className="viz-title">
                    {named(r.item)}
                  </h2>
                  <span className="badge warn" data-testid="price-rise-change">
                    ▲ {Math.round(r.change * 100)}%
                  </span>
                </div>
                <p className="price-rise-was">
                  {t("{was} → {now} a {unit}, delivered {when}", {
                    was: per(r.was),
                    now: per(r.now),
                    unit: unitName(unit.code, t),
                    when: wholeDates(dateTimeIn(profile.timezone, r.on).slice(0, 10)),
                  })}
                  {r.supplier ? ` · ${r.supplier}` : ""}
                </p>
                {r.month > 0 && (
                  <p className="price-rise-month">
                    {t("At the last 30 days' sales, it comes to about {amount} a month.", {
                      amount: fmtIQD(Math.round(r.month)),
                    })}
                  </p>
                )}
                {r.touches.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {t("No product uses it on its recipe, nor through what is made from it.")}
                  </p>
                ) : (
                  <div className="tw">
                    <table className="stack-table" data-testid="price-touches">
                      <thead>
                        <tr>
                          <th>{t("What it touches")}</th>
                          <th>{t("Channel")}</th>
                          <th className="right">{t("Price")}</th>
                          <th className="right">{t("Margin, before → after")}</th>
                          <th className="right">{t("Adds a serving")}</th>
                          <th className="right">{t("Sold in 30 days")}</th>
                          <th className="right">{t("Keeps the margin")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.touches.slice(0, 15).map((x) => {
                          const fell =
                            x.marginBefore !== null &&
                            x.marginAfter !== null &&
                            x.marginBefore - x.marginAfter >= 0.02;
                          return (
                            <tr
                              key={`${x.variantId}-${x.channel}`}
                              data-testid="price-touch"
                              data-variant={x.variantId}
                              data-product={x.product}
                              data-channel={x.channel}
                            >
                              <td>
                                {x.product}
                                {x.size && x.size !== x.product && (
                                  <span className="muted"> · {x.size}</span>
                                )}
                              </td>
                              <td data-label={t("Channel")}>{channel(x.channel)}</td>
                              <td className="right money" data-label={t("Price")}>
                                {fmtIQD(x.price)}
                              </td>
                              <td className="right mono" data-label={t("Margin, before → after")}>
                                {pct(x.marginBefore)} {then}{" "}
                                <span className={fell ? "warn-text" : undefined}>
                                  {pct(x.marginAfter)}
                                </span>
                              </td>
                              <td className="right money" data-label={t("Adds a serving")}>
                                {fmtIQD(Math.round(x.adds))}
                              </td>
                              <td className="right mono" data-label={t("Sold in 30 days")}>
                                {fmtQty(x.sold)}
                              </td>
                              <td
                                className="right money"
                                data-testid="price-keep"
                                data-label={t("Keeps the margin")}
                              >
                                {x.keep === null ? "—" : fmtIQD(x.keep)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {r.touches.length > 15 && (
                  <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
                    {t("And {n} more, each adding less.", { n: r.touches.length - 15 })}
                  </p>
                )}
                <Link className="drill" href={`/inventory/${r.itemId}`}>
                  {t("Its deliveries and prices →")}
                </Link>
              </section>
            );
          })}
        </>
      )}
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "Each delivery against the one before it, a unit at a time, with freight shared out. A serving costs what a sale would post, with this item at its old price, then its new, once what was bought dearer is what is sold. The price that keeps the margin is rounded up to 250 IQD.",
        )}
      </p>
    </div>
  );
}
