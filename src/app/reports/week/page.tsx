import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { getLocale, getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { getLossReport } from "@/lib/db/reports";
import { namesIn, type AnalysisRow } from "@/lib/analysis";
import { addDays, businessToday, parseDay } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import { change, pctText } from "@/lib/insights";
import { direction, percent } from "@/lib/dashboard";
import { weekdayOf } from "@/lib/production";
import { bestDay, dayByDay, movers, splitWeeks, weekWindow, type DayFigures } from "@/lib/week";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { BarList } from "@/components/charts/BarList";
import { Sayings, type Saying } from "@/components/Sayings";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The week at a glance (round four): the seven days to a day against the
 * seven before them — net sales day by day, the margin, the orders, what was
 * lost, what sold the most and what rose and fell — each with a chart or a
 * figure and a sentence on what changed, and where to look into it. Sales are
 * as the sales analysis has them (0051): as paid, less what refunds gave back
 * since; what was lost is the loss report's (0048). Nothing on it is new.
 */
export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const [t, locale, sp] = await Promise.all([getT(), getLocale(), searchParams]);
  const tz = profile.timezone;
  const today = businessToday(tz);
  const asked = parseDay(sp.end, today);
  const end = asked > today ? today : asked;
  const w = weekWindow(end);
  const location = typeof sp.location === "string" && UUID.test(sp.location) ? sp.location : null;
  const query = { channel: null, location, category: null, cashier: null, then: null };
  const [byDate, nowProducts, beforeProducts, lostNow, lostBefore] = await Promise.all([
    getSalesAnalysis({ ...query, from: w.beforeFrom, to: w.to, by: "date" }),
    getSalesAnalysis({ ...query, from: w.from, to: w.to, by: "product" }),
    getSalesAnalysis({ ...query, from: w.beforeFrom, to: w.beforeTo, by: "product" }),
    getLossReport(w.from, w.to, location),
    getLossReport(w.beforeFrom, w.beforeTo, location),
  ]);

  // Sales as paid, less what refunds gave back since; their cost, less what came back.
  const dayRows: DayFigures[] = byDate.rows.map((r) => ({
    day: r.key,
    net: r.kept,
    cost: r.cost - r.costBack,
    orders: r.orders,
  }));
  const products = (rows: AnalysisRow[]) =>
    rows.map((r) => ({ key: r.key, name: namesIn(r.names, locale), net: r.kept }));
  const { now, before } = splitWeeks(dayRows, w);
  const days = dayByDay(dayRows, w);
  const best = bestDay(days);
  const sold = movers(products(nowProducts.rows), products(beforeProducts.rows));
  const lost = lostNow.total.value;
  const lostWas = lostBefore.total.value;
  const topLoss = [...lostNow.byItem].sort((a, b) => b.value - a.value)[0];

  const mark = (dir: "up" | "down" | "same") => (dir === "up" ? "▲" : dir === "down" ? "▼" : "●");
  const short = (day: string) => `${t(weekdayOf(`${day}T12:00:00Z`, "UTC"))} ${day.slice(8)}`;
  const against = (c: number | null) => {
    const dir = direction(c);
    if (dir === null || c === null) return null;
    return dir === "up"
      ? t("{pct}% more than the {n} day(s) before", { pct: percent(c), n: 7 })
      : dir === "down"
        ? t("{pct}% less than the {n} day(s) before", { pct: percent(c), n: 7 })
        : t("About as the {n} day(s) before", { n: 7 });
  };
  const delta = (c: number | null, good: "up" | "down" = "up") => {
    const dir = direction(c);
    const text = against(c);
    if (!dir || !text) return null;
    // Less lost is the good way for waste: its arrow says which way, its tone whether it is good.
    const tone = dir === "same" ? "same" : dir === good ? "up" : "down";
    return (
      <span className={`delta ${tone}`}>
        <span aria-hidden="true">{mark(dir)}</span> {text}
      </span>
    );
  };
  const marginPoints =
    now.marginPct !== null && before.marginPct !== null
      ? Math.round(now.marginPct - before.marginPct)
      : null;

  // ------------------------------------------------------------ what the week says
  const said: Saying[] = [];
  const salesChange = change(now.net, before.net);
  const salesDir = direction(salesChange);
  const bestDetail = best
    ? t("The best day: {day}, {amount}.", { day: short(best.day), amount: fmtIQD(best.net) })
    : undefined;
  if (now.net <= 0) said.push({ tone: "info", icon: "●", text: t("No sales this week.") });
  else if (salesDir === null || salesChange === null)
    said.push({
      tone: "info",
      icon: "●",
      text: t("Net sales {amount}: nothing sold the week before to compare with.", {
        amount: fmtIQD(now.net),
      }),
      detail: bestDetail,
    });
  else
    said.push({
      tone: salesDir === "up" ? "ok" : salesDir === "down" ? "warn" : "info",
      icon: mark(salesDir),
      text:
        salesDir === "up"
          ? t("Net sales rose {pct}% on the week before: {amount} more.", {
              pct: percent(salesChange),
              amount: fmtIQD(now.net - before.net),
            })
          : salesDir === "down"
            ? t("Net sales fell {pct}% on the week before: {amount} less.", {
                pct: percent(salesChange),
                amount: fmtIQD(before.net - now.net),
              })
            : t("Net sales held steady against the week before."),
      detail: bestDetail,
    });
  if (now.marginPct !== null && marginPoints !== null) {
    const costChange = change(now.cost, before.cost);
    // What was sold cost more than the sales grew: said only when the sales did not fall.
    const costsRan =
      costChange !== null &&
      salesChange !== null &&
      salesChange >= 0 &&
      costChange - salesChange >= 0.05;
    said.push(
      marginPoints <= -2
        ? {
            tone: "warn",
            icon: "▼",
            text: t("The margin fell {n} point(s), to {pct}%.", {
              n: -marginPoints,
              pct: now.marginPct,
            }),
            detail: costsRan
              ? t(
                  "What was sold cost {cost}% more, on {sales}% more sales: check the recipes' costs and the prices.",
                  {
                    cost: Math.round(costChange * 100),
                    sales: Math.round(salesChange * 100),
                  },
                )
              : undefined,
            href: "/products",
          }
        : marginPoints >= 2
          ? {
              tone: "ok",
              icon: "▲",
              text: t("The margin rose {n} point(s), to {pct}%.", {
                n: marginPoints,
                pct: now.marginPct,
              }),
            }
          : {
              tone: "info",
              icon: "●",
              text: t("The margin held at {pct}%.", { pct: now.marginPct }),
            },
    );
  }
  said.push(
    lost > 0
      ? {
          tone: now.net > 0 && lost / now.net >= 0.03 ? "warn" : "info",
          icon: "!",
          text: t("Lost {amount} to waste, {pct}% of net sales.", {
            amount: fmtIQD(lost),
            pct: pctText(lost, now.net) ?? "—",
          }),
          detail: [
            topLoss
              ? t("Most of it {item}: {amount}.", {
                  item: topLoss.item,
                  amount: fmtIQD(topLoss.value),
                })
              : null,
            t("{amount} the week before.", { amount: fmtIQD(lostWas) }),
          ]
            .filter(Boolean)
            .join(" "),
          href: `/reports?from=${w.from}&to=${w.to}#losses`,
        }
      : { tone: "ok", icon: "✓", text: t("Nothing was lost this week.") },
  );
  const top = sold.best[0];
  if (top)
    said.push({
      tone: "info",
      icon: "★",
      text: t("{name} sold the most: {amount}.", { name: top.name, amount: fmtIQD(top.net) }),
      detail: against(top.change) ?? undefined,
    });
  if (sold.rise)
    said.push({
      tone: "ok",
      icon: "▲",
      text: t("{name} rose the most: {amount} more than the week before.", {
        name: sold.rise.name,
        amount: fmtIQD(sold.rise.net - sold.rise.before),
      }),
    });
  if (sold.fall)
    said.push({
      tone: "warn",
      icon: "▼",
      text: t("{name} fell the most: {amount} less than the week before.", {
        name: sold.fall.name,
        amount: fmtIQD(sold.fall.before - sold.fall.net),
      }),
      href: `/reports/sales?from=${w.beforeFrom}&to=${w.to}&by=product&then=date`,
    });

  const tiles = [
    {
      label: t("Net sales"),
      value: fmtIQD(now.net),
      note: t("{amount} the week before.", { amount: fmtIQD(before.net) }),
      delta: delta(salesChange),
    },
    {
      label: t("Gross margin"),
      value: now.marginPct === null ? "—" : `${now.marginPct}%`,
      note: fmtIQD(now.margin),
      delta:
        marginPoints === null ? null : (
          <span
            className={`delta ${marginPoints >= 1 ? "up" : marginPoints <= -1 ? "down" : "same"}`}
          >
            <span aria-hidden="true">
              {mark(marginPoints >= 1 ? "up" : marginPoints <= -1 ? "down" : "same")}
            </span>{" "}
            {marginPoints >= 1
              ? t("{n} point(s) more than the {days} day(s) before", { n: marginPoints, days: 7 })
              : marginPoints <= -1
                ? t("{n} point(s) less than the {days} day(s) before", {
                    n: -marginPoints,
                    days: 7,
                  })
                : t("About as the {n} day(s) before", { n: 7 })}
          </span>
        ),
    },
    {
      label: t("dash.orders"),
      value: String(now.orders),
      note:
        now.perOrder === null
          ? null
          : t("{amount} an order on average", { amount: fmtIQD(now.perOrder) }),
      delta: delta(change(now.orders, before.orders)),
    },
    {
      label: t("Waste"),
      value: fmtIQD(lost),
      note: now.net > 0 ? t("{pct}% of net sales", { pct: pctText(lost, now.net) ?? "0" }) : null,
      delta: delta(change(lost, lostWas), "down"),
    },
  ];

  const prev = addDays(end, -7);
  const next = addDays(end, 7) > today ? null : addDays(end, 7);
  const href = (e: string) => `/reports/week?end=${e}${location ? `&location=${location}` : ""}`;
  return (
    <div className="grid week" style={{ gap: 18 }}>
      <PrintHead
        business={profile.businessName}
        title={t("The week at a glance")}
        period={t("{from} to {to}", { from: w.from, to: w.to })}
        timezone={tz}
      />
      <div className="phead">
        <h1>{t("The week at a glance")}</h1>
        <PrintButton />
        <span className="sc" data-testid="week-period">
          {t("{from} to {to}, against {beforeFrom} to {beforeTo}", {
            from: w.from,
            to: w.to,
            beforeFrom: w.beforeFrom,
            beforeTo: w.beforeTo,
          })}
        </span>
      </div>
      <nav className="week-nav no-print" aria-label={t("Weeks")}>
        <Link className="badge" href={href(prev)} data-testid="week-before">
          {t("The week before")}
        </Link>
        {next && (
          <Link className="badge" href={href(next)} data-testid="week-after">
            {t("The week after")}
          </Link>
        )}
        {end !== today && (
          <Link className="badge" href={href(today)}>
            {t("The last 7 days")}
          </Link>
        )}
      </nav>

      <div className="kpis" data-testid="week-tiles">
        {tiles.map((x) => (
          <div key={x.label} className="card stat">
            <span className="label">{x.label}</span>
            <span className="value">{x.value}</span>
            {x.note && <span className="delta">{x.note}</span>}
            {x.delta}
          </div>
        ))}
      </div>

      <section className="card" aria-labelledby="week-say" data-testid="week-says">
        <h2 id="week-say" className="viz-title">
          {t("What the week says")}
        </h2>
        <Sayings items={said} />
      </section>

      <section className="card" data-testid="week-days">
        <ColumnChart
          title={t("Sales day by day")}
          columnsName={t("This week")}
          labels={{ table: t("Show as a table"), heading: t("Day") }}
          line={{
            name: t("The week before"),
            points: days.map((d) => ({
              key: d.day,
              value: Math.max(d.beforeNet, 0),
              valueText: fmtIQD(d.beforeNet),
            })),
          }}
          columns={days.map((d) => ({
            key: d.day,
            label: short(d.day),
            value: Math.max(d.net, 0),
            valueText: fmtIQD(d.net),
            detail: `${d.day} · ${t("{n} order(s)", { n: d.orders })}`,
            emphasis: d.day === best?.day,
          }))}
        />
      </section>

      <div className="week-two">
        <section className="card" aria-labelledby="week-sold" data-testid="week-sold">
          <h2 id="week-sold" className="viz-title">
            {t("What sold the most")}
          </h2>
          {sold.best.length ? (
            <BarList
              label={t("What sold the most")}
              rows={sold.best.slice(0, 8).map((m) => ({
                key: m.key,
                name: m.name,
                value: m.net,
                valueText: fmtIQD(m.net),
                sub: m.change === null ? t("new this week") : (against(m.change) ?? undefined),
              }))}
            />
          ) : (
            <p className="muted">{t("No sales this week.")}</p>
          )}
          <Link
            className="drill"
            href={`/reports/sales?from=${w.from}&to=${w.to}&by=product${location ? `&location=${location}` : ""}`}
          >
            {t("The sales analysis of the week →")}
          </Link>
        </section>
        <section className="card" aria-labelledby="week-lost" data-testid="week-lost">
          <h2 id="week-lost" className="viz-title">
            {t("What was lost")}
          </h2>
          {lostNow.byItem.length ? (
            <BarList
              label={t("What was lost")}
              rows={[...lostNow.byItem]
                .sort((a, b) => b.value - a.value)
                .slice(0, 6)
                .map((i) => ({
                  key: i.itemId,
                  name: i.item,
                  value: i.value,
                  valueText: fmtIQD(i.value),
                  sub: t("{n} loss(es)", { n: i.count }),
                }))}
            />
          ) : (
            <p className="muted">{t("Nothing was lost this week.")}</p>
          )}
          <Link className="drill" href={`/reports?from=${w.from}&to=${w.to}#losses`}>
            {t("The losses of the week →")}
          </Link>
        </section>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "Sales as paid, less what refunds gave back since, as the sales analysis has them; what was lost at what it cost.",
        )}
      </p>
    </div>
  );
}
