import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { EmptyState } from "@/components/ui";
import { Sayings, type Saying } from "@/components/Sayings";
import { Mark, MenuMatrixChart } from "@/components/charts/MenuMatrixChart";
import { getLocale, getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { namesIn } from "@/lib/analysis";
import { addDays, businessToday } from "@/lib/dates";
import { fmtIQD, fmtQty } from "@/lib/format";
import {
  GROUP_DO,
  GROUP_LABEL,
  GROUP_WHY,
  MENU_GROUPS,
  menuMatrix,
  raiseWorth,
  type MenuGroup,
} from "@/lib/menuMatrix";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The periods offered, four weeks or three months to today: phrases, shown through t(). */
const PERIODS = [
  { days: 28, phrase: "The last 4 weeks" },
  { days: 91, phrase: "The last 3 months" },
] as const;

/**
 * The menu matrix (round eleven): every product sold in the period, by how
 * much it sells against what it earns on each one, in four groups — keep,
 * raise the price, show it more, change it or drop it — each with what to do.
 * A category asked compares like with like (a coffee with coffees). Nothing
 * on it is new: the sales analysis by product (0051), after refunds.
 */
export default async function MenuMatrixPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const days = PERIODS.find((p) => String(p.days) === sp.days)?.days ?? PERIODS[0].days;
  const from = addDays(today, -(days - 1));
  const category = typeof sp.category === "string" && UUID.test(sp.category) ? sp.category : null;
  const location =
    profile.worksAt ??
    (typeof sp.location === "string" && UUID.test(sp.location) ? sp.location : null);
  const href = (o: { days?: number; category?: string | null }) => {
    const q = new URLSearchParams();
    q.set("days", String(o.days ?? days));
    const c = o.category === undefined ? category : o.category;
    if (c) q.set("category", c);
    if (location && profile.worksAt === null) q.set("location", location);
    return `/reports/menu?${q.toString()}`;
  };

  const analysis = await getSalesAnalysis({
    from,
    to: today,
    by: "product",
    then: null,
    channel: null,
    location,
    category,
    cashier: null,
  });
  const m = menuMatrix(analysis.rows);
  const name = (n: Parameters<typeof namesIn>[0]) => namesIn(n, locale);
  const each = (v: number) => fmtIQD(Math.round(v));
  const of = (g: MenuGroup) => m.items.filter((i) => i.group === g);
  const worth = raiseWorth(m);

  const said: Saying[] = [];
  if (of("raise").length > 0)
    said.push({
      tone: "warn",
      icon: "▲",
      text: t("Raise the price of {n} product(s): many are sold, but each earns little.", {
        n: of("raise").length,
      }),
      detail:
        worth > 0
          ? t(
              "At the raises shown, as many sold as in this period would bring about {amount} more.",
              { amount: fmtIQD(Math.round(worth)) },
            )
          : undefined,
    });
  if (of("promote").length > 0)
    said.push({
      tone: "info",
      icon: "●",
      text: t("Show {n} product(s) more: each earns well, but few are sold.", {
        n: of("promote").length,
      }),
    });
  if (of("rethink").length > 0)
    said.push({
      tone: "warn",
      icon: "!",
      text: t("Change or drop {n} product(s): few are sold, and each earns little.", {
        n: of("rethink").length,
      }),
    });
  if (of("keep").length > 0)
    said.push({
      tone: "ok",
      icon: "★",
      text: t("Keep {n} product(s) first: many are sold, and each earns well.", {
        n: of("keep").length,
      }),
    });

  return (
    <div className="grid menu-matrix" style={{ gap: 18 }}>
      <PrintHead
        business={profile.businessName}
        title={t("Menu matrix")}
        period={t("{from} to {to}", { from, to: today })}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>{t("Menu matrix")}</h1>
        <PrintButton />
        <span className="sc" data-testid="matrix-period">
          {t("What each product sells against what it earns on each one, {from} to {to}", {
            from,
            to: today,
          })}
        </span>
      </div>

      <nav className="day-pick no-print" aria-label={t("The period")}>
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={href({ days: p.days })}
            aria-current={p.days === days ? "page" : undefined}
          >
            {t(p.phrase)}
          </Link>
        ))}
      </nav>
      {analysis.choices.categories.length > 0 && (
        <nav
          className="day-pick no-print"
          aria-label={t("Category")}
          data-testid="matrix-categories"
        >
          <Link
            href={href({ category: null })}
            aria-current={category === null ? "page" : undefined}
          >
            {t("The whole menu")}
          </Link>
          {analysis.choices.categories.map((c) => (
            <Link
              key={c.id}
              href={href({ category: c.id })}
              aria-current={category === c.id ? "page" : undefined}
            >
              {name(c.names)}
            </Link>
          ))}
        </nav>
      )}

      {m.items.length === 0 ? (
        <EmptyState
          title={t("Not enough sold yet to compare.")}
          hint={t(
            "The matrix compares at least two products sold in the period, each with a cost on its recipe.",
          )}
        />
      ) : (
        <>
          <Sayings items={said} />
          <MenuMatrixChart
            points={m.items.map((i) => ({
              key: i.key,
              name: name(i.names),
              group: i.group,
              sold: i.sold,
              perItem: Math.round(i.perItem),
              soldText: t("{n} sold", { n: fmtQty(i.sold) }),
              perItemText: t("earns {amount} on each", { amount: each(i.perItem) }),
            }))}
            popular={m.popular}
            average={m.average}
            labels={{
              title: t("Sold against what each one earns"),
              x: t("Sold in the period"),
              y: t("Earns on each one (IQD)"),
              groups: {
                keep: t(GROUP_LABEL.keep),
                raise: t(GROUP_LABEL.raise),
                promote: t(GROUP_LABEL.promote),
                rethink: t(GROUP_LABEL.rethink),
              },
              sellsALot: t("Sells a lot from {n} sold", { n: fmtQty(Math.ceil(m.popular)) }),
              average: t("The menu's average: {amount} on each one", { amount: each(m.average) }),
            }}
          />
          <p className="muted mm-how" data-testid="matrix-how">
            {t(
              "A product sells a lot when it sold at least {n} in the period: 70% of an even share of the {total} items sold. It earns well when it keeps at least {amount} on each one after its cost: the menu's average. Refunds are taken off.",
              {
                n: fmtQty(Math.ceil(m.popular)),
                total: fmtQty(m.sold),
                amount: each(m.average),
              },
            )}
          </p>

          <div className="mm-groups">
            {/* The four corners of the chart, in its order: top first. */}
            {(["promote", "keep", "rethink", "raise"] as const).map((g) => (
              <section
                key={g}
                className={`card mm-group mm-${g}`}
                data-testid="matrix-group"
                data-group={g}
                aria-labelledby={`mm-${g}`}
              >
                <h2 id={`mm-${g}`} className="viz-title mm-group-head">
                  <Mark group={g} size={12} />
                  {t(GROUP_LABEL[g])}
                  <span className="badge">{of(g).length}</span>
                </h2>
                <p className="mm-why">{t(GROUP_WHY[g])}</p>
                <p className="mm-do">{t(GROUP_DO[g])}</p>
                {of(g).length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {t("None in this period.")}
                  </p>
                ) : (
                  <div className="tw">
                    <table className="stack-table mm-table">
                      <thead>
                        <tr>
                          <th>{t("Product")}</th>
                          <th className="right">{t("Items sold")}</th>
                          <th className="right">{t("Earns on each")}</th>
                          {g === "raise" && <th className="right">{t("Raise by about")}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {of(g).map((i) => (
                          <tr
                            key={i.key}
                            data-testid="matrix-item"
                            data-key={i.key}
                            data-raise={i.raiseBy ?? undefined}
                          >
                            <td data-label={t("Product")}>{name(i.names)}</td>
                            <td className="right mono" data-label={t("Items sold")}>
                              {fmtQty(i.sold)} · {Math.round(i.share * 100)}%
                            </td>
                            <td className="right mono" data-label={t("Earns on each")}>
                              {each(i.perItem)}
                            </td>
                            {g === "raise" && (
                              <td className="right mono" data-label={t("Raise by about")}>
                                {i.raiseBy ? `+${fmtIQD(i.raiseBy)}` : "—"}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {m.noCost.length > 0 && (
        <p className="muted" data-testid="matrix-no-cost">
          {t(
            "Left out, sold with no cost to judge them by (add their recipe and its costs on Products & Recipes): {list}.",
            {
              list: m.noCost.map((n) => `${name(n.names)} (${fmtQty(n.sold)})`).join(", "),
            },
          )}
        </p>
      )}
    </div>
  );
}
