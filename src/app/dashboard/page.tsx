import Link from "next/link";
import { getLocale, getMsg, getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getDailySalesTarget, getDashboard, getReconciliation } from "@/lib/db/reports";
import { getSalesOrders, getStockBoard } from "@/lib/db/read";
import { getCurrentAlerts, getDailyBrief } from "@/lib/db/alerts";
import { getSalesAnalysis, type AnalysisQuery } from "@/lib/db/analysis";
import { namesIn, type SalesAnalysis } from "@/lib/analysis";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import { getChannelNames } from "@/lib/db/channels";
import { addDays, businessToday, dateTimeIn } from "@/lib/dates";
import {
  busiestHour,
  direction,
  hourSpan,
  kept,
  pace,
  percent,
  sameWeekdaysBefore,
  targetPace,
  thinnestMargin,
  topSellers,
  usualHours,
  type HourSales,
  type ProductSales,
} from "@/lib/dashboard";
import { NeedsYou } from "@/components/dashboard/NeedsYou";
import { DailyBrief } from "@/components/dashboard/DailyBrief";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { BarList } from "@/components/charts/BarList";
import { Sayings, type Saying } from "@/components/Sayings";
import { Icon } from "@/components/Icon";
import { isMorning } from "@/lib/startofday";

export const dynamic = "force-dynamic";

const WEEKDAY = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

function hoursOf(a: SalesAnalysis | null): HourSales[] {
  return (a?.rows ?? []).map((r) => ({ hour: Number(r.key), net: r.net, orders: r.orders }));
}

/**
 * Exceptions first (0029, the audit's P1-8): what needs someone. Then today
 * as the books have it, each figure against a usual day of its kind by this
 * time; what the figures say, in words, with what to do about it; the last
 * fortnight, today hour by hour, and what sells, drawn; the stock; and
 * yesterday's brief. Every figure opens what is behind it.
 */
export default async function DashboardPage() {
  const profile = await requirePermission("profit.view");
  const [t, msg, locale] = await Promise.all([getT(), getMsg(), getLocale()]);
  const today = businessToday(profile.timezone);
  const now = dateTimeIn(profile.timezone, new Date().toISOString());
  const hour = Number(now.slice(11, 13));
  const minute = Number(now.slice(14, 16));
  const time = now.slice(11, 16);
  const weekday = WEEKDAY(today);
  const pastDays = sameWeekdaysBefore(today, 4);
  // The figures behind the charts are the sales analysis's, which those who
  // see profits may read; a role changed to see one and not the other still
  // has its dashboard, without them.
  const analyse = has(profile, "cost.view");
  const q = (from: string, to: string, by: AnalysisQuery["by"]): AnalysisQuery => ({
    from,
    to,
    by,
    then: null,
    channel: null,
    location: null,
    category: null,
    cashier: null,
  });
  const maybe = (query: AnalysisQuery) =>
    analyse ? getSalesAnalysis(query) : Promise.resolve(null);

  const [
    alerts,
    brief,
    d,
    rec,
    board,
    recent,
    channels,
    target,
    days,
    hoursToday,
    products,
    ...hoursPast
  ] = await Promise.all([
    getCurrentAlerts(),
    getDailyBrief(addDays(today, -1)),
    getDashboard(today),
    getReconciliation(today),
    getStockBoard(),
    getSalesOrders(6),
    getChannelNames(),
    // The day's target (0067): the café's, or the place's for someone who reads their place's day.
    getDailySalesTarget(profile.worksAt),
    maybe(q(addDays(today, -14), today, "date")),
    maybe(q(today, today, "hour")),
    maybe(q(addDays(today, -6), today, "product")),
    ...pastDays.map((day) => maybe(q(day, day, "hour"))),
  ]);
  // Below zero first (the records are wrong), then the furthest under their
  // reorder level; the rest are a link away, so the card stays a glance.
  const low = board
    .filter((s) => s.isLow || s.isNegative)
    .sort(
      (a, b) =>
        Number(b.isNegative) - Number(a.isNegative) ||
        (a.isNegative
          ? a.name.localeCompare(b.name)
          : a.onHandBase / (a.reorderBase || 1) - b.onHandBase / (b.reorderBase || 1)),
    );
  const LOW_SHOWN = 6;
  const differences = rec.filter((r) => r.difference !== 0);

  // ------------------------------------------------------------ the figures
  const byDay = new Map((days?.rows ?? []).map((r) => [r.key, r]));
  const dayOf = (day: string) => {
    const r = byDay.get(day);
    return { day, net: r?.net ?? 0, orders: r?.orders ?? 0 };
  };
  // The chart's fortnight ends today; a figure's line, the fortnight before it.
  const fortnight = Array.from({ length: 14 }, (_, i) => dayOf(addDays(today, i - 13)));
  const before = Array.from({ length: 14 }, (_, i) => dayOf(addDays(today, i - 14)));
  const todayHours = hoursOf(hoursToday);
  const past = hoursPast.map(hoursOf);
  const p = pace(todayHours, past, hour, minute);
  const usual = usualHours(past);
  // Today's net sales as the books have them (the tile's), against the target;
  // a usual day of its kind says how much of a day is sold by now.
  const goal = targetPace(target, d.netRevenue, p, usual);
  const busiest = busiestHour(usual);
  const sold: ProductSales[] = (products?.rows ?? []).map((r) => ({
    name: namesIn(r.names, locale),
    net: r.net,
    cost: r.cost,
    margin: r.margin,
    qty: r.qty,
  }));
  const top = topSellers(sold, 5);
  const thin = thinnestMargin(sold);
  const usualAverage = p.usualNet !== null && p.usualOrders ? p.usualNet / p.usualOrders : null;
  const average = p.orders > 0 ? p.net / p.orders : null;
  const averageChange =
    average !== null && usualAverage ? (average - usualAverage) / usualAverage : null;

  /** A change against a usual day, in words, with its arrow: up is good for sales. */
  const delta = (change: number | null) => {
    const dir = analyse ? direction(change) : null;
    if (dir === null || change === null) return null;
    const words =
      dir === "up"
        ? t("{pct}% above usual by {time}", { pct: percent(change), time })
        : dir === "down"
          ? t("{pct}% below usual by {time}", { pct: percent(change), time })
          : t("As usual by {time}", { time });
    return (
      <span className={`delta ${dir}`}>
        <span aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "●"}</span> {words}
      </span>
    );
  };

  // Each figure opens what is behind it (audit P1-2).
  const span = `from=${today}&to=${today}`;
  const kpis = [
    {
      label: t("dash.netSales"),
      value: fmtIQD(d.netRevenue),
      href: `/reports?${span}#channel`,
      delta: delta(p.netChange),
      spark: before.map((x) => x.net),
    },
    {
      label: t("dash.orders"),
      value: String(d.orders),
      href: `/orders?${span}`,
      delta: delta(p.ordersChange),
      spark: before.map((x) => x.orders),
    },
    {
      label: t("dash.avgOrder"),
      value: fmtIQD(d.averageOrder),
      href: `/orders?${span}`,
      delta: delta(averageChange),
      spark: before.map((x) => (x.orders ? x.net / x.orders : 0)),
    },
    {
      label: t("dash.grossProfit"),
      value: fmtIQD(d.grossProfit),
      tone: d.grossProfit < 0 ? "err" : undefined,
      href: `/reports?${span}#pnl`,
      note:
        d.netRevenue > 0
          ? t("{pct}% of net sales", { pct: Math.round((d.grossProfit / d.netRevenue) * 100) })
          : null,
    },
  ];

  // ------------------------------------------------------- the target
  const shareText = (x: number) => String(Math.floor(x * 100));
  const about = (x: number) => fmtIQD(Math.round(x / 1000) * 1000);
  const goalWords = !goal
    ? null
    : goal.reached
      ? goal.net > goal.target
        ? t("Reached: {over} over the target.", { over: fmtIQD(goal.net - goal.target) })
        : t("Reached, exactly.")
      : [
          goal.expectedByNow === null
            ? t("{left} still to make; no {weekday} before today to know the pace by.", {
                left: fmtIQD(goal.left),
                weekday: t(weekday),
              })
            : Math.floor((goal.usualShareByNow ?? 0) * 100) === 0
              ? t("{left} still to make; a usual {weekday} has sold almost nothing by {time}.", {
                  left: fmtIQD(goal.left),
                  weekday: t(weekday),
                  time,
                })
              : goal.net >= goal.expectedByNow
                ? t(
                    "Ahead of the pace: by {time} a usual {weekday} has made {pct}% of its day, and today has {share}% of the target.",
                    {
                      time,
                      weekday: t(weekday),
                      pct: shareText(goal.usualShareByNow ?? 0),
                      share: shareText(goal.share),
                    },
                  )
                : t(
                    "Behind the pace: by {time} a usual {weekday} has made {pct}% of its day, and today has {share}% of the target.",
                    {
                      time,
                      weekday: t(weekday),
                      pct: shareText(goal.usualShareByNow ?? 0),
                      share: shareText(goal.share),
                    },
                  ),
          goal.projected === null
            ? null
            : goal.projected >= goal.target
              ? t(
                  "Selling as a usual {weekday} from here, the day ends at about {amount}: over it.",
                  {
                    weekday: t(weekday),
                    amount: about(goal.projected),
                  },
                )
              : t(
                  "Selling as a usual {weekday} from here, the day ends at about {amount}: {short} short of it.",
                  {
                    weekday: t(weekday),
                    amount: about(goal.projected),
                    short: about(goal.target - goal.projected),
                  },
                ),
        ]
          .filter(Boolean)
          .join(" ");
  const behind =
    goal !== null && !goal.reached && goal.expectedByNow !== null && goal.net < goal.expectedByNow;
  // A day of more refunds than sales draws an empty bar, not a negative one.
  const filled = goal ? Math.min(Math.max(goal.share, 0), 1) : 0;

  // ------------------------------------------------------- what they say
  const sayings: Saying[] = [];
  if (analyse) {
    if (p.net === 0 && p.orders === 0 && (p.usualNet ?? 0) < 1) {
      sayings.push({ tone: "info", icon: "●", text: t("No sales yet today.") });
    } else if (p.usualNet === null) {
      sayings.push({
        tone: "info",
        icon: "●",
        text: t("No {weekday} before today to compare with yet.", { weekday: t(weekday) }),
      });
    } else {
      const dir = direction(p.netChange) ?? "same";
      sayings.push({
        tone: dir === "up" ? "ok" : dir === "down" ? "warn" : "info",
        icon: dir === "up" ? "▲" : dir === "down" ? "▼" : "●",
        text:
          dir === "up"
            ? t("Sales are {pct}% above a usual {weekday} by {time}.", {
                pct: percent(p.netChange ?? 0),
                weekday: t(weekday),
                time,
              })
            : dir === "down"
              ? t("Sales are {pct}% below a usual {weekday} by {time}.", {
                  pct: percent(p.netChange ?? 0),
                  weekday: t(weekday),
                  time,
                })
              : t("Sales are about as on a usual {weekday} by {time}.", {
                  weekday: t(weekday),
                  time,
                }),
        detail: t("{today} so far; {usual} by then on average, over the {n} before.", {
          today: fmtIQD(p.net),
          usual: fmtIQD(p.usualNet),
          n: p.days,
        }),
        href: `/reports/sales?from=${today}&to=${today}&by=hour`,
      });
    }
    if (busiest !== null)
      sayings.push({
        tone: "info",
        icon: "◷",
        text: t("A usual {weekday} is busiest from {from} to {to}: have the most hands on then.", {
          weekday: t(weekday),
          from: `${String(busiest).padStart(2, "0")}:00`,
          to: `${String(busiest + 1).padStart(2, "0")}:00`,
        }),
        href: "/staff",
      });
    if (top[0]) {
      const k = kept(top[0]);
      sayings.push({
        tone: "ok",
        icon: "★",
        text:
          k === null
            ? t("{product} brought in the most over the last 7 days: {net}.", {
                product: top[0].name,
                net: fmtIQD(top[0].net),
              })
            : t(
                "{product} brought in the most over the last 7 days: {net}, keeping {kept}% after what it uses.",
                {
                  product: top[0].name,
                  net: fmtIQD(top[0].net),
                  kept: Math.round(k * 100),
                },
              ),
        href: `/reports/sales?from=${addDays(today, -6)}&to=${today}&by=product`,
      });
    }
    if (thin)
      sayings.push({
        tone: "warn",
        icon: "!",
        text: t(
          "{product} keeps only {kept}% of what it sells for: look at its recipe's cost, or its price.",
          {
            product: thin.name,
            kept: Math.round(thin.kept * 100),
          },
        ),
        href: "/products",
      });
  }
  sayings.push(
    d.lowStock > 0
      ? {
          tone: "warn",
          icon: "!",
          text: t("{n} item(s) at or below their reorder level: see what to buy.", {
            n: d.lowStock,
          }),
          href: "/inventory",
        }
      : { tone: "ok", icon: "✓", text: t("Every item is above its reorder level.") },
  );

  // ------------------------------------------------------------- the charts
  const months = (day: string) => {
    const dt = new Date(`${day}T12:00:00Z`);
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
      .formatToParts(dt)
      .map((x) => (x.type === "month" ? t(x.value) : x.value))
      .join("");
  };
  const earlier = fortnight.slice(0, 13).filter((x) => x.net !== 0 || x.orders !== 0);
  const dailyAverage = earlier.length ? earlier.reduce((s, x) => s + x.net, 0) / earlier.length : 0;
  const hoursDrawn = hourSpan(todayHours, usual);
  const todayByHour = new Map(todayHours.map((h) => [h.hour, h]));
  const usualByHour = new Map(usual.map((h) => [h.hour, h]));
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

  const closing = has(profile, "day.close") && (hour >= 16 || hour < 4);
  const opening = has(profile, "day.close") && isMorning(hour);
  const firstName = (profile.name ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = !firstName
    ? t("dash.title")
    : hour < 12
      ? t("Good morning, {name}", { name: firstName })
      : hour < 17
        ? t("Good afternoon, {name}", { name: firstName })
        : t("Good evening, {name}", { name: firstName });

  return (
    <div className="dash">
      <header className="dash-hero">
        <div>
          <h1>{greeting}</h1>
          <p className="dash-when">
            {t(weekday)} {months(today)} · {time}
            {d.location && <span data-testid="dashboard-at"> · {d.location}</span>}
          </p>
        </div>
        <div className="dash-hero-acts">
          {/* In the morning, whoever opens the day is offered its steps; from the late afternoon, its close. */}
          {opening && (
            <Link href="/start-of-day" className="btn-soft" data-testid="dash-start-of-day">
              <Icon name="sun" size={16} /> {t("Opening up? The start of the day, step by step")}
            </Link>
          )}
          {closing && (
            <Link href="/end-of-day" className="btn-soft" data-testid="dash-end-of-day">
              <Icon name="sunset" size={16} /> {t("Closing up? The end of the day, step by step")}
            </Link>
          )}
          <Link
            href="/reports#reconciliation"
            className={`badge ${differences.length ? "err" : "ok"}`}
          >
            {differences.length
              ? t("{n} reconciliation difference(s)", { n: differences.length })
              : t("Books reconcile")}
          </Link>
        </div>
      </header>

      <NeedsYou
        alerts={alerts}
        canAct={has(profile, "sale.void") || has(profile, "accounting.post")}
        myId={profile.id}
        today={today}
        timezone={profile.timezone}
      />

      <section aria-labelledby="dash-today">
        <h2 id="dash-today" className="dash-h">
          {t("dash.today")}
        </h2>
        {goal && (
          <section
            className={`card dash-target${goal.reached ? " reached" : behind ? " behind" : ""}`}
            data-testid="dash-target"
            data-state={goal.reached ? "reached" : behind ? "behind" : "on-pace"}
            aria-labelledby="dash-target-h"
          >
            <div className="dash-target-top">
              <div>
                <h3 id="dash-target-h" className="viz-title">
                  {t("Today's target")}
                </h3>
                <p className="dash-target-num">
                  <b>{fmtIQD(goal.net)}</b>{" "}
                  <span className="muted">{t("of {target}", { target: fmtIQD(goal.target) })}</span>
                </p>
              </div>
              <span className="dash-target-pct" data-testid="dash-target-pct">
                {shareText(goal.share)}%
              </span>
            </div>
            <div
              className="target-bar"
              role="progressbar"
              aria-labelledby="dash-target-h"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(filled * 100)}
              aria-valuetext={t("{pct}% of the target", { pct: shareText(goal.share) })}
            >
              <span className="target-fill" style={{ inlineSize: `${filled * 100}%` }} />
              {goal.usualShareByNow !== null && !goal.reached && (
                <span
                  className="target-now"
                  style={{ insetInlineStart: `${goal.usualShareByNow * 100}%` }}
                  aria-hidden="true"
                />
              )}
            </div>
            <p className="dash-target-say" data-testid="dash-target-say">
              {goalWords}
            </p>
          </section>
        )}
        <div className="kpis">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="card stat">
              <span className="label">{k.label}</span>
              <span className={`value${k.tone ? ` ${k.tone}` : ""}`}>{k.value}</span>
              {k.delta ?? (k.note ? <span className="delta">{k.note}</span> : null)}
              {k.spark && analyse && <Sparkline values={k.spark} />}
            </Link>
          ))}
        </div>
        <p className="muted dash-note">
          {t(
            "These are the profit and loss's own figures for today. Gross profit is after waste, count differences, price differences on deliveries and platform fees. Open a figure to see what is behind it.",
          )}
          {!goal && has(profile, "settings.manage") && (
            <>
              {" "}
              <Link href="/settings/rules#rule-daily_sales_target" data-testid="dash-set-target">
                {t("Give the café a day's sales target, and today is measured against it.")}
              </Link>
            </>
          )}
        </p>
      </section>

      {/* What the figures say comes first, for a phone and a screen reader;
          a wide screen sets it atop the side column. */}
      <div className="dash-grid">
        <section className="card dash-say" aria-labelledby="dash-say">
          <h3 id="dash-say" className="viz-title">
            {t("What the figures say")}
          </h3>
          <Sayings items={sayings} />
        </section>

        <div className="dash-main">
          {analyse && (
            <section className="card">
              <ColumnChart
                title={t("Sales, the last 14 days")}
                columnsName={t("Net sales")}
                labels={{ table: t("Show as a table"), heading: t("Day") }}
                reference={
                  dailyAverage > 0
                    ? {
                        value: dailyAverage,
                        label: t("Average: {amount} a day", { amount: fmtIQD(dailyAverage) }),
                      }
                    : undefined
                }
                columns={fortnight.map((x) => ({
                  key: x.day,
                  label: x.day === today ? t("Today") : x.day.slice(8).replace(/^0/, ""),
                  value: Math.max(x.net, 0),
                  valueText: fmtIQD(x.net),
                  detail: `${t(WEEKDAY(x.day))} ${months(x.day)} · ${t("{n} order(s)", { n: x.orders })}`,
                  emphasis: x.day === today,
                }))}
              />
            </section>
          )}
          {analyse && (
            <section className="card">
              {hoursDrawn.length > 0 ? (
                <ColumnChart
                  title={t("Today, hour by hour")}
                  columnsName={t("Today")}
                  labels={{ table: t("Show as a table"), heading: t("Hour") }}
                  line={
                    usual.length
                      ? {
                          name: t("A usual {weekday}", { weekday: t(weekday) }),
                          points: hoursDrawn.map((h) => ({
                            key: String(h),
                            value: usualByHour.get(h)?.net ?? 0,
                            valueText: fmtIQD(usualByHour.get(h)?.net ?? 0),
                          })),
                        }
                      : undefined
                  }
                  columns={hoursDrawn.map((h) => ({
                    key: String(h),
                    label: String(h),
                    value: Math.max(todayByHour.get(h)?.net ?? 0, 0),
                    valueText: fmtIQD(todayByHour.get(h)?.net ?? 0),
                    detail: `${hh(h)}–${hh(h + 1)} · ${t("{n} order(s)", { n: todayByHour.get(h)?.orders ?? 0 })}`,
                    emphasis: true,
                  }))}
                />
              ) : (
                <>
                  <h3 className="viz-title">{t("Today, hour by hour")}</h3>
                  <p className="muted">{t("No sales yet today.")}</p>
                </>
              )}
            </section>
          )}
          <DailyBrief
            brief={brief}
            heading={t("dash.yesterday")}
            labels={{
              facts: t("dash.facts"),
              calculations: t("dash.calculations"),
              toDo: t("dash.toDo"),
            }}
            t={t}
            msg={msg}
          />
        </div>

        <div className="dash-side">
          {analyse && top.length > 0 && (
            <section className="card" aria-labelledby="dash-sells">
              <h3 id="dash-sells" className="viz-title">
                {t("What sells, the last 7 days")}
              </h3>
              <BarList
                label={t("What sells, the last 7 days")}
                rows={top.map((x, i) => {
                  const k = kept(x);
                  return {
                    key: `${i}-${x.name}`,
                    name: x.name,
                    value: x.net,
                    valueText: fmtIQD(x.net),
                    sub:
                      k === null
                        ? t("{n} sold · not costed yet", { n: fmtQty(x.qty) })
                        : t("{n} sold · {kept}% kept", {
                            n: fmtQty(x.qty),
                            kept: Math.round(k * 100),
                          }),
                  };
                })}
              />
            </section>
          )}

          <section className="card" aria-labelledby="dash-stock">
            <h3 id="dash-stock" className="viz-title">
              <Link href="/inventory">
                {d.location ? t("Stock at {place}", { place: d.location }) : t("Stock value")}
              </Link>
            </h3>
            <p className="dash-stock-value">{fmtIQD(d.inventoryValue)}</p>
            {board.length === 0 ? (
              <span className="muted">{t("No items yet.")}</span>
            ) : low.length === 0 ? (
              <span className="badge ok">{t("All above reorder level")}</span>
            ) : (
              <>
                {low.slice(0, LOW_SHOWN).map((s) => (
                  <div key={s.itemId} className="deduction-row">
                    <span>{s.name}</span>
                    <span className={`badge mono ${s.isNegative ? "err" : "warn"}`}>
                      {fmtQty(s.onHandBase)}
                      {s.reorderBase === null ? "" : ` / ${fmtQty(s.reorderBase)}`}{" "}
                      {unitName(s.unit, t)}
                    </span>
                  </div>
                ))}
                {low.length > LOW_SHOWN && (
                  <p className="dash-more">
                    <Link href="/inventory">
                      {t("…and {n} more", { n: low.length - LOW_SHOWN })}
                    </Link>
                  </p>
                )}
              </>
            )}
          </section>

          <section className="card" aria-labelledby="dash-recent">
            <h3 id="dash-recent" className="viz-title">
              {t("Recent sales")}
            </h3>
            {recent.length === 0 ? (
              <span className="muted">{t("No sales yet.")}</span>
            ) : (
              recent.map((o) => (
                <div key={o.id} className="deduction-row">
                  <span>
                    <span className="muted mono recent-time">
                      {dateTimeIn(profile.timezone, o.placedAt).slice(11)}
                    </span>{" "}
                    <span className="badge">{channels.name(o.channel)}</span>{" "}
                    {o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ") || "—"}
                    {o.status !== "completed" && (
                      <>
                        {" "}
                        <span className="badge warn">{t(o.status)}</span>
                      </>
                    )}
                  </span>
                  <span className="mono">{fmtIQD(o.net)}</span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
