import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { EmptyState } from "@/components/ui";
import { ColumnChart, type Column, type LinePoint } from "@/components/charts/ColumnChart";
import { Sayings, type Saying } from "@/components/Sayings";
import { getT } from "@/lib/i18n/server";
import { wholeDates } from "@/lib/i18n/core";
import { has, requirePermission } from "@/lib/auth/session";
import { getStaffing } from "@/lib/db/staffing";
import { WEEKDAYS } from "@/lib/analysis";
import { addDays, businessToday, localClock, parseDay } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import {
  aboutText,
  busiestHour,
  dayProfile,
  hourGroups,
  hourText,
  minutesOnClock,
  staffing,
  type HourFlag,
  type HourGroup,
} from "@/lib/staffing";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Four weeks: each hour of the week four times over. */
const DAYS = 28;
/** Orders with nobody on the clock, of all of them, before the page warns that it reads short. */
const UNCLOCKED_SHARE = 0.05;

const MARK: Record<HourFlag, string> = { short: "▲", quiet: "▽", nobody: "●" };

/**
 * Staffed when busy? (round six): the four weeks to yesterday — or to a day
 * asked — each hour of the café's week on average: the orders rung up in it
 * against the people on the clock, and what a person on the clock usually
 * serves in an hour. It says where the hands were short, where many stood
 * about, and where orders came with nobody clocked in; a day hour by hour
 * shows the orders against what those on the clock usually serve, and the
 * week as a grid. Needs the sales analysis (cost.view) and the hours (those
 * who keep the staff, their hours or their pay). Nothing on it is new.
 */
export default async function StaffingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  // Whole days: today is not over.
  const latest = addDays(today, -1);
  const asked = parseDay(sp.end, latest);
  const to = asked > latest ? latest : asked;
  const from = addDays(to, -(DAYS - 1));
  const location =
    profile.worksAt ??
    (typeof sp.location === "string" && UUID.test(sp.location) ? sp.location : null);
  const chosen = typeof sp.day === "string" && /^[0-6]$/.test(sp.day) ? Number(sp.day) : null;
  const seesHours =
    has(profile, "staff.manage") || has(profile, "attendance.edit") || has(profile, "payroll.view");

  const place = location && profile.worksAt === null ? `&location=${location}` : "";
  const href = (end: string, day: number | null = chosen) =>
    `/reports/staffing?end=${end}${day === null ? "" : `&day=${day}`}${place}`;
  const head = (
    <>
      <PrintHead
        business={profile.businessName}
        title={t("Staffed when busy?")}
        period={t("{from} to {to}", { from, to })}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>{t("Staffed when busy?")}</h1>
        <PrintButton />
        <span className="sc" data-testid="staffing-period">
          {t("{from} to {to}: four weeks, each hour of the week on average", {
            from: wholeDates(from),
            to: wholeDates(to),
          })}
        </span>
      </div>
      <nav className="week-nav no-print" aria-label={t("Four weeks at a time")}>
        <Link className="badge" href={href(addDays(to, -DAYS))} data-testid="staffing-before">
          {t("The four weeks before")}
        </Link>
        {addDays(to, DAYS) <= latest && (
          <Link className="badge" href={href(addDays(to, DAYS))} data-testid="staffing-after">
            {t("The four weeks after")}
          </Link>
        )}
        {to !== latest && addDays(to, DAYS) !== latest && (
          <Link className="badge" href={href(latest)}>
            {t("The last four weeks")}
          </Link>
        )}
      </nav>
    </>
  );

  if (!seesHours)
    return (
      <div className="grid staffing" style={{ gap: 18 }}>
        {head}
        <EmptyState
          title={t("This page needs the hours on the clock.")}
          hint={t("Those who keep the staff, their hours or their pay can see it.")}
        />
      </div>
    );

  const data = await getStaffing(from, to, location);
  const s = staffing(
    data.sales,
    minutesOnClock(data.spans, from, to, localClock(profile.timezone)),
    from,
    to,
  );
  const day = (w: number) => t(WEEKDAYS[w] ?? "");
  const when = (g: { weekday: number; from: number; to: number }) =>
    t("{day}, {from}–{to}", { day: day(g.weekday), from: hourText(g.from), to: hourText(g.to) });
  const usual = s.usual === null ? "—" : aboutText(s.usual);
  const flagWord: Record<HourFlag, string> = {
    short: t("Short of hands"),
    quiet: t("Quiet"),
    nobody: t("Nobody on the clock"),
  };

  if (s.personHours === 0 || s.orders === 0)
    return (
      <div className="grid staffing" style={{ gap: 18 }}>
        {head}
        <EmptyState
          title={
            s.orders === 0
              ? t("No orders in these four weeks.")
              : t("Nobody was on the clock in these four weeks.")
          }
          hint={t(
            "This page sets the orders of each hour against the hours on the clock: clock in and out at the till, or add the hours on Staff.",
          )}
        />
      </div>
    );

  // ------------------------------------------------------------ what it says
  const groups = hourGroups(s);
  const of = (flag: HourFlag) => groups.filter((g) => g.flag === flag).slice(0, 2);
  const at = (g: HourGroup) => `${href(to, g.weekday)}#staffing-day`;
  const said: Saying[] = [];
  const busiest = busiestHour(s);
  if (busiest)
    said.push({
      tone: "info",
      icon: "★",
      text: t("The busiest hour: {when}, about {orders} orders and {amount}.", {
        when: `${day(busiest.weekday)} ${hourText(busiest.hour)}`,
        orders: aboutText(busiest.orders),
        amount: fmtIQD(Math.round(busiest.net)),
      }),
      detail: t("{people} on the clock, on average.", { people: aboutText(busiest.people) }),
      href: `${href(to, busiest.weekday)}#staffing-day`,
    });
  for (const g of of("short"))
    said.push({
      tone: "warn",
      icon: MARK.short,
      text: t("Short of hands: {when}.", { when: when(g) }),
      detail: t(
        "About {orders} orders an hour with {people} on the clock: {each} each, against {usual} usually. One more would bring it to {after} each.",
        {
          orders: aboutText(g.orders),
          people: aboutText(g.people),
          each: aboutText(g.orders / g.people),
          usual,
          after: aboutText(g.orders / (g.people + 1)),
        },
      ),
      href: at(g),
    });
  for (const g of of("quiet"))
    said.push({
      tone: "info",
      icon: MARK.quiet,
      text: t("Quiet with {people} on the clock: {when}.", {
        people: aboutText(g.people),
        when: when(g),
      }),
      detail: t(
        "About {orders} orders an hour: {each} each, against {usual} usually. Unless they were preparing, one fewer would still leave {left}.",
        {
          orders: aboutText(g.orders),
          each: aboutText(g.orders / g.people),
          usual,
          left: aboutText(g.people - 1),
        },
      ),
      href: at(g),
    });
  for (const g of of("nobody"))
    said.push({
      tone: "warn",
      icon: MARK.nobody,
      text: t("Orders with nobody on the clock: {when}.", { when: when(g) }),
      detail: t("About {orders} an hour. Clock in at the till, so this page reads true.", {
        orders: aboutText(g.orders),
      }),
      href: at(g),
    });
  if (of("short").length === 0 && of("quiet").length === 0)
    said.push({
      tone: "ok",
      icon: "✓",
      text: t("No hour was short of hands, nor quiet with two or more on the clock."),
    });
  if (s.unclocked / s.orders >= UNCLOCKED_SHARE)
    said.push({
      tone: "warn",
      icon: "!",
      text: t("{pct}% of the orders were rung up with nobody on the clock.", {
        pct: Math.round((s.unclocked / s.orders) * 100),
      }),
      detail: t("This page counts only the hours on the clock: clock in and out at the till."),
      href: "/staff",
    });

  const shortHours = s.hours.filter((h) => h.flag === "short").length;
  const quietHours = s.hours.filter((h) => h.flag === "quiet").length;
  const tiles = [
    {
      key: "usual",
      label: t("Orders an hour, each on the clock"),
      value: usual,
      note: t("Over {n} hour(s) on the clock", { n: Math.round(s.personHours) }),
    },
    {
      key: "busiest",
      label: t("The busiest hour"),
      value: busiest ? `${day(busiest.weekday)} ${hourText(busiest.hour)}` : "—",
      note: busiest
        ? t("About {orders} orders, {people} on the clock", {
            orders: aboutText(busiest.orders),
            people: aboutText(busiest.people),
          })
        : null,
    },
    {
      key: "short",
      label: t("Hours short of hands"),
      value: String(shortHours),
      note: t("A week: each served half as many again as usual, or more"),
    },
    {
      key: "quiet",
      label: t("Hours quiet with two or more"),
      value: String(quietHours),
      note: t("A week: each served half the usual, or less"),
    },
  ];

  // ------------------------------------------------------------ a day, hour by hour
  const profileHours = dayProfile(s, chosen);
  const columns: Column[] = profileHours.map((h) => ({
    key: String(h.hour),
    label: hourText(h.hour).slice(0, 2),
    value: h.orders,
    valueText: aboutText(h.orders),
    detail: [
      hourText(h.hour),
      t("{people} on the clock", { people: aboutText(h.people) }),
      fmtIQD(Math.round(h.net)),
      h.flag ? flagWord[h.flag] : null,
    ]
      .filter(Boolean)
      .join(" · "),
    emphasis: h.flag === "short",
  }));
  const linePoints: LinePoint[] = profileHours.flatMap((h) =>
    h.expected === null
      ? []
      : [{ key: String(h.hour), value: h.expected, valueText: aboutText(h.expected) }],
  );

  // ------------------------------------------------------------ the week as a grid
  const hoursShown =
    s.first === null || s.last === null
      ? []
      : Array.from({ length: s.last - s.first + 1 }, (_, i) => s.first! + i);
  const cellOf = new Map(s.hours.map((h) => [`${h.weekday}|${h.hour}`, h]));
  const peak = Math.max(...s.hours.map((h) => h.orders), 0);
  const shade = (orders: number) => (orders <= 0 || peak <= 0 ? 0 : Math.ceil((orders / peak) * 5));

  return (
    <div className="grid staffing" style={{ gap: 18 }}>
      {head}

      <div className="kpis" data-testid="staffing-tiles">
        {tiles.map((x) => (
          <div key={x.key} className="card stat" data-tile={x.key}>
            <span className="label">{x.label}</span>
            <span className="value">{x.value}</span>
            {x.note && <span className="delta">{x.note}</span>}
          </div>
        ))}
      </div>

      <section className="card" aria-labelledby="staffing-say" data-testid="staffing-says">
        <h2 id="staffing-say" className="viz-title">
          {t("What the hours say")}
        </h2>
        <Sayings items={said} />
      </section>

      <section className="card staffing-day" id="staffing-day" data-testid="staffing-day">
        <nav className="day-pick no-print" aria-label={t("A day of the week")}>
          <Link
            href={`${href(to, null)}#staffing-day`}
            aria-current={chosen === null ? "page" : undefined}
            data-testid="staffing-every-day"
          >
            {t("Every day")}
          </Link>
          {WEEKDAYS.map((name, w) => (
            <Link
              key={name}
              href={`${href(to, w)}#staffing-day`}
              aria-current={chosen === w ? "page" : undefined}
              data-weekday={w}
            >
              {t(name)}
            </Link>
          ))}
        </nav>
        <ColumnChart
          title={
            chosen === null
              ? t("Orders hour by hour: a day on average")
              : t("Orders hour by hour: {day}", { day: day(chosen) })
          }
          columnsName={t("Orders an hour")}
          line={
            linePoints.length
              ? { name: t("What those on the clock usually serve"), points: linePoints }
              : undefined
          }
          labels={{ table: t("Show as a table"), heading: t("Hour") }}
          columns={columns}
        />
        <p className="muted dash-note">
          {t(
            "Where a column stands above the line, each person on the clock served more than usual; where it falls well below with two or more on the clock, the hour was quiet.",
          )}
        </p>
      </section>

      <section className="card" aria-labelledby="staffing-week" data-testid="staffing-week">
        <h2 id="staffing-week" className="viz-title">
          {t("The week, hour by hour")}
        </h2>
        <div className="hour-grid-wrap">
          <table className="hour-grid">
            <caption className="sr-only">
              {t("Orders an hour, a day on average, and the hours marked")}
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t("Day")}</span>
                </th>
                {hoursShown.map((h) => (
                  <th key={h} scope="col">
                    <span className={h % 3 === 0 ? undefined : "sr-only"}>
                      {hourText(h).slice(0, 2)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((name, w) => (
                <tr key={name} data-weekday={w}>
                  <th scope="row">
                    <Link href={`${href(to, w)}#staffing-day`}>{t(name)}</Link>
                  </th>
                  {hoursShown.map((hour) => {
                    const c = cellOf.get(`${w}|${hour}`);
                    const words = c
                      ? [
                          `${t(name)} ${hourText(hour)}`,
                          t("About {orders} orders, {people} on the clock", {
                            orders: aboutText(c.orders),
                            people: aboutText(c.people),
                          }),
                          c.flag ? flagWord[c.flag] : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : `${t(name)} ${hourText(hour)}: —`;
                    return (
                      <td
                        key={hour}
                        className={`hg-c s${c ? shade(c.orders) : 0}`}
                        title={words}
                        data-flag={c?.flag ?? undefined}
                        data-testid={c?.flag ? "staffing-cell" : undefined}
                        data-hour={hour}
                      >
                        <span aria-hidden="true">{c?.flag ? MARK[c.flag] : ""}</span>
                        <span className="sr-only">{words}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hour-grid-key" aria-hidden="true">
          <span className="hg-scale">
            {t("Fewer orders")}
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`hg-c s${n}`} />
            ))}
            {t("More orders")}
          </span>
          {(Object.keys(MARK) as HourFlag[]).map((f) => (
            <span key={f}>
              {MARK[f]} {flagWord[f]}
            </span>
          ))}
        </div>
      </section>

      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "Orders as rung up, in the hour they were paid; hours on the clock as clocked in and out at the till or added on Staff, those cancelled left out; each a day on average over the four weeks. What a person usually serves is every order served with someone on the clock, over every hour on the clock.",
        )}
        {data.open > 0 &&
          ` ${t("{n} time(s) clocked in and not out are left out.", { n: data.open })}`}
      </p>
    </div>
  );
}
