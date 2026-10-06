import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { EmptyState } from "@/components/ui";
import { BarList } from "@/components/charts/BarList";
import { Sayings, type Saying } from "@/components/Sayings";
import { getT } from "@/lib/i18n/server";
import { wholeDates } from "@/lib/i18n/core";
import { requirePermission } from "@/lib/auth/session";
import { getWasteBatches, getWasteWeek } from "@/lib/db/waste";
import { addDays, businessToday, parseDay } from "@/lib/dates";
import { fmtIQD, unitName } from "@/lib/format";
import { bigQty, recipeWaste, WASTES, wasteTip, weekWorst } from "@/lib/waste";
import { WEEKDAY_NAME } from "@/lib/production";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Four weeks of batches. */
const DAYS = 28;

/**
 * Waste by recipe (round six): the batches made in the four weeks to
 * yesterday — or to a day asked — recipe by recipe: what they made, what was
 * sold or went into other batches, what was thrown away and what eaten or
 * given away, and what is still in stock, each batch as it stands now; the
 * share of what has gone that was thrown away and its cost; and, where what
 * was thrown away was mostly left unsold, the batch that would have covered
 * what went. Nothing on it is new: the production report (0046) and the lots'
 * movements.
 */
export default async function WastePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const latest = addDays(today, -1);
  const asked = parseDay(sp.end, latest);
  const to = asked > latest ? latest : asked;
  const from = addDays(to, -(DAYS - 1));
  const location =
    profile.worksAt ??
    (typeof sp.location === "string" && UUID.test(sp.location) ? sp.location : null);
  const place = location && profile.worksAt === null ? `&location=${location}` : "";
  const href = (end: string) => `/reports/waste?end=${end}${place}`;

  const [madeBatches, week] = await Promise.all([
    getWasteBatches(from, to, location),
    getWasteWeek(to, location),
  ]);
  const recipes = recipeWaste(madeBatches);
  const qty = (base: number, unit: string, down = false) => {
    const q = bigQty(base, unit, down);
    return `${q.qty} ${unitName(q.unit, t)}`;
  };
  const pct = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);
  const sum = (f: (r: (typeof recipes)[number]) => number) => recipes.reduce((n, r) => n + f(r), 0);
  const thrownValue = sum((r) => r.value);
  const goneValue = sum((r) => r.goneValue);
  const givenValue = sum((r) => r.givenValue);
  const batches = sum((r) => r.batches);
  const open = sum((r) => r.open);
  const worst = recipes.find((r) => r.value > 0) ?? null;

  // ------------------------------------------------------------ what it says
  const said: Saying[] = [];
  const reports = `/reports?from=${from}&to=${to}#production`;
  const wasting = recipes.filter((r) => r.share !== null && r.share >= WASTES && r.value > 0);
  for (const r of wasting.slice(0, 3)) {
    const mostlyUnsold = r.unsold > 0 && r.unsold >= r.handled;
    said.push({
      tone: "warn",
      icon: "!",
      text: t("{recipe}: {pct} of what went was thrown away, {amount}.", {
        recipe: r.recipe,
        pct: pct(r.share),
        amount: fmtIQD(Math.round(r.value)),
      }),
      detail:
        r.better !== null && r.perBatch !== null && r.takenPerBatch !== null
          ? t(
              "Batches of about {made}, of which about {taken} was sold, used or eaten; most of the rest went past its use-by. Batches of about {better} would have covered what went.",
              {
                made: qty(r.perBatch, r.baseUnit),
                taken: qty(r.takenPerBatch, r.baseUnit),
                better: qty(r.better, r.baseUnit, true),
              },
            )
          : mostlyUnsold
            ? t("Most of it went past its use-by, unsold.")
            : t(
                "Most of it was spilt, melted or spoilt in the making: a smaller batch would not help. Look at how it is made and kept.",
              ),
      href: reports,
    });
  }
  if (recipes.length > 0 && thrownValue <= 0)
    said.push({
      tone: "ok",
      icon: "✓",
      text: t("Nothing made in these four weeks was thrown away."),
    });
  else if (recipes.length > 0 && wasting.length === 0)
    said.push({
      tone: "ok",
      icon: "✓",
      text: t("No recipe threw away a tenth of what went."),
    });
  if (givenValue > 0)
    said.push({
      tone: "info",
      icon: "●",
      text: t("{amount} of it was eaten by the staff, given away or tasted.", {
        amount: fmtIQD(Math.round(givenValue)),
      }),
    });
  if (open > 0)
    said.push({
      tone: "info",
      icon: "◐",
      text: t("{n} batch(es) are still in stock: what becomes of them is not counted yet.", {
        n: open,
      }),
    });

  // ------------------------------------------------------------ the last seven days (0070)
  const weekSaid: Saying[] = [];
  if (week) {
    const amount = fmtIQD(Math.round(week.value));
    const before = fmtIQD(Math.round(week.valueBefore));
    if (week.value <= 0)
      weekSaid.push({
        tone: "ok",
        icon: "✓",
        text: t("Nothing was thrown away unsold in these seven days."),
        detail:
          week.valueBefore > 0
            ? t("{amount} the seven days before.", { amount: before })
            : undefined,
      });
    else
      weekSaid.push({
        tone: week.value > week.valueBefore ? "warn" : "ok",
        icon: week.value > week.valueBefore ? "▲" : "▼",
        text:
          week.valueBefore <= 0
            ? t(
                "Thrown away unsold in these seven days: {amount}; nothing the seven days before.",
                {
                  amount,
                },
              )
            : week.value > week.valueBefore
              ? t(
                  "Thrown away unsold in these seven days: {amount}, up from {before} the seven days before.",
                  { amount, before },
                )
              : t(
                  "Thrown away unsold in these seven days: {amount}, against {before} the seven days before.",
                  { amount, before },
                ),
      });
    for (const i of weekWorst(week)) {
      const tip = wasteTip(i);
      weekSaid.push({
        tone: "warn",
        icon: "!",
        text: t("{item}: {qty} thrown away, {amount}, {n} time(s), on {days}.", {
          item: i.item,
          qty: qty(i.qty, i.unit),
          amount: fmtIQD(Math.round(i.value)),
          n: i.times,
          days: i.weekdays.map((d) => t(WEEKDAY_NAME[d - 1] ?? "")).join(", "),
        }),
        detail:
          tip === "made"
            ? t(
                "Made here: the day's plan already makes less of what is thrown away on half the days or more. Look at the batch made on these days.",
              )
            : tip === "say_keeps"
              ? t(
                  "Bought: say how many days it keeps on What to buy, and it is ordered for no more than that.",
                )
              : t("Bought, and it keeps {n} day(s): order less of it at a time, and more often.", {
                  n: i.keepsDays ?? 0,
                }),
        href: tip === "made" ? "/production#plan" : "/purchasing/buying-list",
      });
    }
  }

  const tiles = [
    {
      key: "thrown",
      label: t("Thrown away"),
      value: fmtIQD(Math.round(thrownValue)),
      note:
        goneValue > 0
          ? t("{pct} of what was made and has gone", { pct: pct(thrownValue / goneValue) })
          : null,
    },
    {
      key: "batches",
      label: t("Batches made"),
      value: String(batches),
      note: t("{n} recipe(s)", { n: recipes.length }),
    },
    {
      key: "given",
      label: t("Eaten or given away"),
      value: fmtIQD(Math.round(givenValue)),
      note: t("Staff meals, gifts and tastings"),
    },
    {
      key: "worst",
      label: t("The most thrown away"),
      value: worst?.recipe ?? "—",
      note: worst ? t("{pct} of what it made and has gone", { pct: pct(worst.share) }) : null,
    },
  ];

  return (
    <div className="grid waste" style={{ gap: 18 }}>
      <PrintHead
        business={profile.businessName}
        title={t("Waste by recipe")}
        period={t("{from} to {to}", { from, to })}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>{t("Waste by recipe")}</h1>
        <PrintButton />
        <span className="sc" data-testid="waste-period">
          {t("Batches made {from} to {to}, each as it stands now", {
            from: wholeDates(from),
            to: wholeDates(to),
          })}
        </span>
      </div>
      <nav className="week-nav no-print" aria-label={t("Four weeks at a time")}>
        <Link className="badge" href={href(addDays(to, -DAYS))} data-testid="waste-before">
          {t("The four weeks before")}
        </Link>
        {addDays(to, DAYS) <= latest && (
          <Link className="badge" href={href(addDays(to, DAYS))}>
            {t("The four weeks after")}
          </Link>
        )}
        {to !== latest && addDays(to, DAYS) !== latest && (
          <Link className="badge" href={href(latest)}>
            {t("The last four weeks")}
          </Link>
        )}
      </nav>

      {week && (
        <section className="card" aria-labelledby="waste-week-h" data-testid="waste-week">
          <h2 id="waste-week-h" className="viz-title">
            {t("The seven days to {day}", { day: wholeDates(week.to) })}
          </h2>
          <Sayings items={weekSaid} />
        </section>
      )}

      {recipes.length === 0 ? (
        <EmptyState
          title={t("No batches were made in these four weeks.")}
          hint={t("Each batch recorded on Production is followed here, to the last of it.")}
        />
      ) : (
        <>
          <div className="kpis" data-testid="waste-tiles">
            {tiles.map((x) => (
              <div key={x.key} className="card stat" data-tile={x.key}>
                <span className="label">{x.label}</span>
                <span className="value">{x.value}</span>
                {x.note && <span className="delta">{x.note}</span>}
              </div>
            ))}
          </div>

          <section className="card" aria-labelledby="waste-say" data-testid="waste-says">
            <h2 id="waste-say" className="viz-title">
              {t("What the batches say")}
            </h2>
            <Sayings items={said} />
          </section>

          {thrownValue > 0 && (
            <section className="card" aria-labelledby="waste-bars" data-testid="waste-bars">
              <h2 id="waste-bars" className="viz-title">
                {t("What was thrown away, by recipe")}
              </h2>
              <BarList
                label={t("What was thrown away, by recipe")}
                rows={recipes
                  .filter((r) => r.value > 0)
                  .slice(0, 10)
                  .map((r) => ({
                    key: r.recipe,
                    name: r.recipe,
                    value: r.value,
                    valueText: fmtIQD(Math.round(r.value)),
                    sub: t("{pct} of what went, {qty}", {
                      pct: pct(r.share),
                      qty: qty(r.thrown, r.baseUnit),
                    }),
                  }))}
              />
            </section>
          )}

          <section className="card" aria-labelledby="waste-table">
            <h2 id="waste-table" className="viz-title">
              {t("Recipe by recipe")}
            </h2>
            <div className="tw">
              <table className="stack-table" data-testid="waste-recipes">
                <thead>
                  <tr>
                    <th>{t("Recipe")}</th>
                    <th className="right">{t("Batches")}</th>
                    <th className="right">{t("Made")}</th>
                    <th className="right">{t("Sold or used")}</th>
                    <th className="right">{t("Thrown away")}</th>
                    <th className="right">{t("Eaten or given away")}</th>
                    <th className="right">{t("Still in stock")}</th>
                    <th className="right">{t("What it cost")}</th>
                    <th className="right">{t("A better batch")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recipes.map((r) => (
                    <tr
                      key={r.recipe}
                      data-testid="waste-recipe"
                      data-recipe={r.recipe}
                      data-share={r.share === null ? "" : Math.round(r.share * 1000) / 1000}
                    >
                      <td>
                        {r.recipe}
                        {r.item !== r.recipe && <span className="muted"> · {r.item}</span>}
                      </td>
                      <td className="right mono" data-label={t("Batches")}>
                        {r.batches}
                      </td>
                      <td className="right mono" data-label={t("Made")}>
                        {qty(r.made, r.baseUnit)}
                      </td>
                      <td className="right mono" data-label={t("Sold or used")}>
                        {qty(r.sold, r.baseUnit)}
                      </td>
                      <td className="right mono" data-label={t("Thrown away")}>
                        <span
                          className={
                            r.share !== null && r.share >= WASTES ? "warn-text" : undefined
                          }
                        >
                          {qty(r.thrown, r.baseUnit)}
                        </span>
                        <span className="cell-sub" data-testid="waste-share">
                          {t("{pct} of what went", { pct: pct(r.share) })}
                        </span>
                      </td>
                      <td className="right mono" data-label={t("Eaten or given away")}>
                        {qty(r.given, r.baseUnit)}
                      </td>
                      <td className="right mono" data-label={t("Still in stock")}>
                        {qty(r.left, r.baseUnit)}
                      </td>
                      <td className="right money" data-label={t("What it cost")}>
                        {fmtIQD(Math.round(r.value))}
                      </td>
                      <td
                        className="right mono"
                        data-label={t("A better batch")}
                        data-testid="waste-better"
                      >
                        {r.better === null ? "—" : qty(r.better, r.baseUnit, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "Each batch made in the four weeks, followed to now: what was sold and what went into other batches; what was thrown away — past its use-by, spoilt, spilt or melted, less any loss taken back on review; and what the staff ate, was given away or tasted. Its cost is the batch's own. A batch to cover what went is said only where most of what was thrown away went unsold, from two or more batches all gone: what each of them sold, used or gave, on average.",
        )}
      </p>
    </div>
  );
}
