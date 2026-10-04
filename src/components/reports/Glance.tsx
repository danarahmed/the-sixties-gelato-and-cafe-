import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Profile } from "@/lib/auth/session";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { getDailySalesTarget, getLossReport } from "@/lib/db/reports";
import { namesIn, type AnalysisRow } from "@/lib/analysis";
import { addDays, businessToday, daysBetween, monthStart } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import { change, pctText } from "@/lib/insights";
import { direction, percent } from "@/lib/dashboard";
import { WEEKDAY_NAME, weekdayOf } from "@/lib/production";
import { monthText } from "@/lib/staff";
import { wholeDates } from "@/lib/i18n/core";
import {
  bestDay,
  dayByDay,
  monthDayByDay,
  monthPace,
  monthWindow,
  movers,
  splitWeeks,
  usualByWeekday,
  weekWindow,
  weekdaysApart,
  type DayFigures,
} from "@/lib/week";
import { ColumnChart, type Column, type LinePoint } from "@/components/charts/ColumnChart";
import { BarList } from "@/components/charts/BarList";
import { Sayings, type Saying } from "@/components/Sayings";

export type Span = "week" | "month";

/**
 * The week or the month at a glance (rounds four and five): the seven days to
 * a day against the seven before them, or a month against the same days of
 * the month before (all of it once the month is over) — net sales day by day,
 * the margin, the orders, what was lost, what sold the most and what rose and
 * fell — each with a chart or a figure and a sentence on what changed, and
 * where to look into it. A month still running says where it closes at its
 * pace, and a month long enough which weekdays sell and which do not. Sales
 * are as the sales analysis has them (0051): as paid, less what refunds gave
 * back since; what was lost is the loss report's (0048). Nothing on it is new.
 */
export async function Glance({
  profile,
  span,
  at,
  location,
}: {
  profile: Profile;
  span: Span;
  /** The week's last day, or a day of the month; today at most. */
  at: string;
  /** A place to narrow it to; null for the café's own reach. */
  location: string | null;
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const tz = profile.timezone;
  const today = businessToday(tz);
  const month = span === "month" ? monthWindow(at, today) : null;
  const w = month ?? weekWindow(at);
  const query = { channel: null, location, category: null, cashier: null, then: null };
  const [byDate, nowProducts, beforeProducts, lostNow, lostBefore, dailyTarget] = await Promise.all(
    [
      // A month's line is a usual weekday of all of the month before.
      getSalesAnalysis({
        ...query,
        from: month?.beforeMonth ?? w.beforeFrom,
        to: w.to,
        by: "date",
      }),
      getSalesAnalysis({ ...query, from: w.from, to: w.to, by: "product" }),
      getSalesAnalysis({ ...query, from: w.beforeFrom, to: w.beforeTo, by: "product" }),
      getLossReport(w.from, w.to, location),
      getLossReport(w.beforeFrom, w.beforeTo, location),
      // The day's target (0067), the place's where it is narrowed to one: a month running measures against it.
      month && !month.whole ? getDailySalesTarget(location ?? profile.worksAt) : 0,
    ],
  );

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
  const weekDays = month ? null : dayByDay(dayRows, w);
  const monthDays = month ? monthDayByDay(dayRows, month) : null;
  const best = bestDay<{ day: string; net: number }>(weekDays ?? monthDays ?? []);
  const sold = movers(products(nowProducts.rows), products(beforeProducts.rows));
  const lost = lostNow.total.value;
  const lostWas = lostBefore.total.value;
  const topLoss = [...lostNow.byItem].sort((a, b) => b.value - a.value)[0];

  // A month or a date as shown in words: whole on its line.
  const ym = (day: string) => wholeDates(monthText(day));
  const on = (day: string) => wholeDates(day);
  // What the figures are set against: the week before, the same days of the
  // month before, or all of it once the month is over.
  const then = !month
    ? t("the week before")
    : month.whole
      ? ym(month.beforeMonth)
      : t("the same days of {month}", { month: ym(month.beforeMonth) });
  const words = month
    ? {
        title: t("The month at a glance"),
        says: t("What the month says"),
        noSales: t("No sales this month."),
        noneLost: t("Nothing was lost this month."),
        isNew: t("new this month"),
        columns: ym(month.month),
        analysis: t("The sales analysis of the month →"),
        losses: t("The losses of the month →"),
        back: t("The month before"),
        on: t("The month after"),
        latest: t("This month"),
        steps: t("Months"),
      }
    : {
        title: t("The week at a glance"),
        says: t("What the week says"),
        noSales: t("No sales this week."),
        noneLost: t("Nothing was lost this week."),
        isNew: t("new this week"),
        columns: t("This week"),
        analysis: t("The sales analysis of the week →"),
        losses: t("The losses of the week →"),
        back: t("The week before"),
        on: t("The week after"),
        latest: t("The last 7 days"),
        steps: t("Weeks"),
      };

  const mark = (dir: "up" | "down" | "same") => (dir === "up" ? "▲" : dir === "down" ? "▼" : "●");
  const weekday = (day: string) => t(weekdayOf(`${day}T12:00:00Z`, "UTC"));
  const short = (day: string) => `${weekday(day)} ${day.slice(8)}`;
  const against = (c: number | null) => {
    const dir = direction(c);
    if (dir === null || c === null) return null;
    return dir === "up"
      ? t("{pct}% more than {then}", { pct: percent(c), then })
      : dir === "down"
        ? t("{pct}% less than {then}", { pct: percent(c), then })
        : t("About the same as {then}", { then });
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

  // ------------------------------------------------------------ what it says
  const said: Saying[] = [];
  const salesChange = change(now.net, before.net);
  const salesDir = direction(salesChange);
  const bestDetail = best
    ? t("The best day: {day}, {amount}.", { day: short(best.day), amount: fmtIQD(best.net) })
    : undefined;
  if (now.net <= 0) said.push({ tone: "info", icon: "●", text: words.noSales });
  else if (salesDir === null || salesChange === null)
    said.push({
      tone: "info",
      icon: "●",
      text: t("Net sales {amount}, and no sales in {then} to compare with.", {
        amount: fmtIQD(now.net),
        then,
      }),
      detail: bestDetail,
    });
  else
    said.push({
      tone: salesDir === "up" ? "ok" : salesDir === "down" ? "warn" : "info",
      icon: mark(salesDir),
      text:
        salesDir === "up"
          ? t("Net sales rose {pct}% against {then}: {amount} more.", {
              pct: percent(salesChange),
              then,
              amount: fmtIQD(now.net - before.net),
            })
          : salesDir === "down"
            ? t("Net sales fell {pct}% against {then}: {amount} less.", {
                pct: percent(salesChange),
                then,
                amount: fmtIQD(before.net - now.net),
              })
            : t("Net sales held steady against {then}.", { then }),
      detail: bestDetail,
    });

  // A month still running: where it closes at its pace, against the month
  // before and the café's target for it.
  const pace = month ? monthPace(dayRows, month, today) : null;
  if (month && pace) {
    const closed = dayRows
      .filter((r) => r.day >= month.beforeMonth && r.day <= month.beforeLast)
      .reduce((s, r) => s + r.net, 0);
    const goal = dailyTarget > 0 ? dailyTarget * (daysBetween(month.month, month.last) + 1) : 0;
    const dir: "up" | "down" | "same" =
      goal > 0
        ? pace.projected >= goal
          ? "up"
          : "down"
        : (direction(change(pace.projected, closed)) ?? "same");
    said.push({
      tone: dir === "up" ? "ok" : dir === "down" ? "warn" : "info",
      icon: mark(dir),
      text: t("At this pace, {month} closes near {amount}.", {
        month: ym(month.month),
        amount: fmtIQD(pace.projected),
      }),
      detail: [
        t("From {n} full day(s) so far; {month} closed at {amount}.", {
          n: pace.days,
          month: ym(month.beforeMonth),
          amount: fmtIQD(closed),
        }),
        goal > 0 ? t("The month's target: {amount}.", { amount: fmtIQD(goal) }) : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
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
  // Two weeks or more of a month: the weekday that sells, and the one that does not.
  const apart =
    month && daysBetween(w.from, w.to) + 1 >= 14
      ? weekdaysApart(usualByWeekday(dayRows, w.from, w.to))
      : null;
  if (apart)
    said.push({
      tone: "info",
      icon: "◐",
      text: t("On average, {best} sold the most: {amount} a day; {worst} the least: {low}.", {
        best: t(WEEKDAY_NAME[apart.best] ?? ""),
        amount: fmtIQD(apart.bestNet),
        worst: t(WEEKDAY_NAME[apart.worst] ?? ""),
        low: fmtIQD(apart.worstNet),
      }),
      href: `/reports/sales?from=${w.from}&to=${w.to}&by=weekday${location ? `&location=${location}` : ""}`,
    });
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
            t("{amount} in {then}.", { amount: fmtIQD(lostWas), then }),
          ]
            .filter(Boolean)
            .join(" "),
          href: `/reports?from=${w.from}&to=${w.to}#losses`,
        }
      : { tone: "ok", icon: "✓", text: words.noneLost },
  );
  const top = sold.best[0];
  if (top)
    said.push({
      tone: "info",
      icon: "★",
      text: t("{name} sold the most: {amount}.", { name: top.name, amount: fmtIQD(top.net) }),
      detail: against(top.change) ?? undefined,
    });
  // The best seller's own change is said beside it: rising the most too is no news.
  if (sold.rise && sold.rise.key !== top?.key)
    said.push({
      tone: "ok",
      icon: "▲",
      text: t("{name} rose the most: {amount} more than {then}.", {
        name: sold.rise.name,
        amount: fmtIQD(sold.rise.net - sold.rise.before),
        then,
      }),
    });
  if (sold.fall)
    said.push({
      tone: "warn",
      icon: "▼",
      text: t("{name} fell the most: {amount} less than {then}.", {
        name: sold.fall.name,
        amount: fmtIQD(sold.fall.before - sold.fall.net),
        then,
      }),
      href: `/reports/sales?from=${w.beforeFrom}&to=${w.to}&by=product&then=date`,
    });

  const tiles = [
    {
      label: t("Net sales"),
      value: fmtIQD(now.net),
      note: t("{amount} in {then}.", { amount: fmtIQD(before.net), then }),
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
              ? t("{n} point(s) more than {then}", { n: marginPoints, then })
              : marginPoints <= -1
                ? t("{n} point(s) less than {then}", { n: -marginPoints, then })
                : t("About the same as {then}", { then })}
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

  // ------------------------------------------------------------ the chart
  const columns: Column[] = monthDays
    ? monthDays.map((d) => ({
        key: d.day,
        label: d.day.slice(8),
        value: Math.max(d.net, 0),
        valueText: fmtIQD(d.net),
        detail: `${weekday(d.day)} ${on(d.day)} · ${t("{n} order(s)", { n: d.orders })}`,
        emphasis: d.day === best?.day,
      }))
    : (weekDays ?? []).map((d) => ({
        key: d.day,
        label: short(d.day),
        value: Math.max(d.net, 0),
        valueText: fmtIQD(d.net),
        detail: `${on(d.day)} · ${t("{n} order(s)", { n: d.orders })}`,
        emphasis: d.day === best?.day,
      }));
  const linePoints: LinePoint[] = monthDays
    ? monthDays.flatMap((d) =>
        d.usual === null
          ? []
          : [{ key: d.day, value: Math.max(d.usual, 0), valueText: fmtIQD(d.usual) }],
      )
    : (weekDays ?? []).map((d) => ({
        key: d.day,
        value: Math.max(d.beforeNet, 0),
        valueText: fmtIQD(d.beforeNet),
      }));
  const lineName = month
    ? t("Usual for the weekday in {month}", { month: ym(month.beforeMonth) })
    : t("The week before");

  // ------------------------------------------------------------ the way about
  const place = location ? `&location=${location}` : "";
  const thisMonth = monthStart(today);
  const steps = month
    ? {
        back: month.beforeMonth,
        on: addDays(month.last, 1) > thisMonth ? null : addDays(month.last, 1),
        // Not when the month after is this one: the same page twice.
        latest:
          month.month === thisMonth || addDays(month.last, 1) === thisMonth ? null : thisMonth,
      }
    : {
        back: addDays(w.to, -7),
        on: addDays(w.to, 7) > today ? null : addDays(w.to, 7),
        latest: w.to === today || addDays(w.to, 7) === today ? null : today,
      };
  const href = (day: string) =>
    month ? `/reports/month?month=${day.slice(0, 7)}${place}` : `/reports/week?end=${day}${place}`;
  const id = (part: string) => `${span}-${part}`;

  return (
    <div className="grid week" style={{ gap: 18 }}>
      <PrintHead
        business={profile.businessName}
        title={words.title}
        period={t("{from} to {to}", { from: w.from, to: w.to })}
        timezone={tz}
      />
      <div className="phead">
        <h1>{words.title}</h1>
        <PrintButton />
        <span className="sc" data-testid={id("period")}>
          {t("{from} to {to}, against {beforeFrom} to {beforeTo}", {
            from: on(w.from),
            to: on(w.to),
            beforeFrom: on(w.beforeFrom),
            beforeTo: on(w.beforeTo),
          })}
        </span>
      </div>
      <div className="week-nav no-print">
        <nav className="seg" aria-label={t("A week or a month")}>
          <Link
            href={`/reports/week?end=${w.to}${place}`}
            aria-current={month ? undefined : "page"}
            data-testid="span-week"
          >
            {t("Week")}
          </Link>
          <Link
            href={`/reports/month?month=${w.to.slice(0, 7)}${place}`}
            aria-current={month ? "page" : undefined}
            data-testid="span-month"
          >
            {t("Month")}
          </Link>
        </nav>
        <nav className="week-nav" aria-label={words.steps}>
          <Link className="badge" href={href(steps.back)} data-testid={id("before")}>
            {words.back}
          </Link>
          {steps.on && (
            <Link className="badge" href={href(steps.on)} data-testid={id("after")}>
              {words.on}
            </Link>
          )}
          {steps.latest && (
            <Link className="badge" href={href(steps.latest)}>
              {words.latest}
            </Link>
          )}
        </nav>
      </div>

      <div className="kpis" data-testid={id("tiles")}>
        {tiles.map((x) => (
          <div key={x.label} className="card stat">
            <span className="label">{x.label}</span>
            <span className="value">{x.value}</span>
            {x.note && <span className="delta">{x.note}</span>}
            {x.delta}
          </div>
        ))}
      </div>

      <section className="card" aria-labelledby={id("say")} data-testid={id("says")}>
        <h2 id={id("say")} className="viz-title">
          {words.says}
        </h2>
        <Sayings items={said} />
      </section>

      <section className="card" data-testid={id("days")}>
        <ColumnChart
          title={t("Sales day by day")}
          columnsName={words.columns}
          labels={{ table: t("Show as a table"), heading: t("Day") }}
          line={linePoints.length ? { name: lineName, points: linePoints } : undefined}
          columns={columns}
          sparse={Boolean(month)}
        />
      </section>

      <div className="week-two">
        <section className="card" aria-labelledby={id("sold")} data-testid={id("sold")}>
          <h2 id={id("sold")} className="viz-title">
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
                sub: m.change === null ? words.isNew : (against(m.change) ?? undefined),
              }))}
            />
          ) : (
            <p className="muted">{words.noSales}</p>
          )}
          <Link
            className="drill"
            href={`/reports/sales?from=${w.from}&to=${w.to}&by=product${place}`}
          >
            {words.analysis}
          </Link>
        </section>
        <section className="card" aria-labelledby={id("lost")} data-testid={id("lost")}>
          <h2 id={id("lost")} className="viz-title">
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
            <p className="muted">{words.noneLost}</p>
          )}
          <Link className="drill" href={`/reports?from=${w.from}&to=${w.to}#losses`}>
            {words.losses}
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
