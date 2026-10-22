import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/ui";
import { ReportVisit } from "@/components/reports/ReportVisit";
import { SettleFinding } from "@/components/watch/SettleFinding";
import { getT } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth/session";
import { getWatchList } from "@/lib/db/watch";
import { chanceBand, timesAsOften, type WatchFinding } from "@/lib/watch";
import { WEEKDAY_NAME } from "@/lib/production";
import { fmtIQD } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The watch list (0094, SMART_PLAN part 2): for the owner (and the general
 * manager if the owner allows it). Each finding names the person, the
 * pattern, the evidence and how unusual it is against the others at the same
 * hours; it says "worth a look", never more, and is marked explained or
 * looked into. Worked out by the database (watch_list).
 */
export default async function WatchPage() {
  await requireMember();
  const t = await getT();
  const list = await getWatchList();
  if (!list) redirect("/reports");

  const open = list.findings.filter((f) => f.status === "open");
  const settled = list.findings.filter((f) => f.status !== "open");
  const title = (f: WatchFinding) =>
    f.kind === "voids"
      ? t("{person}: sales voided far more often than the others' at the same hours", {
          person: f.person,
        })
      : f.kind === "discounts"
        ? t("{person}: discounts just under the limit, again and again", { person: f.person })
        : t("{person}: the drawer short again and again", { person: f.person });
  const evidence = (f: WatchFinding) => {
    const e = f.evidence;
    const times = timesAsOften(f);
    if (f.kind === "voids")
      return [
        t("{voids} of {sales} sales voided, {from} to {to}.", {
          voids: Number(e.voids ?? f.observed),
          sales: Number(e.sales ?? 0),
          from: f.from,
          to: f.to,
        }),
        times === null
          ? t("The others voided none at the same hours.")
          : t("The others' rate at the same hours would give {expected}: {times} times as often.", {
              expected: f.expected,
              times,
            }),
      ];
    if (f.kind === "discounts")
      return [
        t("{n} discounts of {low}–{high}% ({reason}) in {sales} sales, {from} to {to}.", {
          n: Number(e.discounts ?? f.observed),
          low: Number(e.from ?? 8),
          high: Number(e.below ?? 10),
          reason: f.reason ?? "",
          sales: Number(e.sales ?? 0),
          from: f.from,
          to: f.to,
        }),
        times === null
          ? t("The others gave none like it at the same hours.")
          : t("The others' rate at the same hours would give {expected}: {times} times as often.", {
              expected: f.expected,
              times,
            }),
      ];
    const wd = Number(e.weekday ?? 0);
    return [
      t(
        "{short} of {shifts} drawers short by 5,000 IQD or more, {amount} in all, {from} to {to}.",
        {
          short: Number(e.short ?? f.observed),
          shifts: Number(e.shifts ?? 0),
          amount: fmtIQD(Number(e.amount ?? 0)),
          from: f.from,
          to: f.to,
        },
      ),
      ...(Number(e.same_weekday ?? 0) >= 2 && wd >= 1 && wd <= 7
        ? [
            t("{n} of them on a {weekday}, on the same shift.", {
              n: Number(e.same_weekday),
              weekday: t(WEEKDAY_NAME[wd - 1]!),
            }),
          ]
        : []),
    ];
  };
  const chance = (f: WatchFinding) => {
    const band = chanceBand(f.chance);
    return band === "million"
      ? t("Strong: less than 1 in a million by luck")
      : band === "hundred_thousand"
        ? t("Worth a look: less than 1 in 100,000 by luck")
        : t("Worth a look: less than 1 in 10,000 by luck");
  };

  return (
    <div className="grid" style={{ gap: 18 }}>
      <ReportVisit path="/reports/watch" />
      <div className="phead">
        <h1>{t("Watch list")}</h1>
        <span className="sc">
          {list.scannedAt
            ? t("Last looked {day}", { day: list.scannedAt.slice(0, 10) })
            : t("Not looked yet")}
        </span>
      </div>
      <PageIntro
        text={t(
          "Patterns that stand out from what the others do at the same hours, by more than luck would give. Each is worth a look, not proof: mark it explained or looked into.",
        )}
        more={t("How this works")}
        extra={` ${t(
          "Once a day, over the four weeks to yesterday: sales voided, discounts within two points of the limit a cashier may give alone (each reason apart, so a promotion everyone gives is nobody's), and drawers short by 5,000 IQD or more. Each person is set against the others who sold at the same hours. Someone new is not judged in their first three weeks. A finding settled is not raised again for two weeks.",
        )}`}
      />

      {open.length === 0 ? (
        <EmptyState
          title={t("Nothing stands out.")}
          hint={t(
            "Nobody's voids, discounts or drawers are far from the others' at the same hours.",
          )}
        />
      ) : (
        <div className="grid" style={{ gap: 12 }} data-testid="watch-open">
          {open.map((f) => (
            <section
              key={f.id}
              className={`card watch-finding${f.strength === "strong" ? " strong" : ""}`}
              data-testid="watch-finding"
              data-person={f.person}
              data-kind={f.kind}
            >
              <h2 className="viz-title">{title(f)}</h2>
              {evidence(f).map((line) => (
                <p key={line} style={{ margin: 0 }}>
                  {line}
                </p>
              ))}
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                {chance(f)} ·{" "}
                {t("first seen {first}, last {last}", { first: f.firstSeen, last: f.lastSeen })}
                {f.kind !== "drawer_short" && (
                  <>
                    {" · "}
                    <Link href={`/orders?from=${f.from}&to=${f.to}`}>
                      {t("The sales of those days")}
                    </Link>
                  </>
                )}
              </p>
              <SettleFinding findingId={f.id} />
            </section>
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <details className="card" data-testid="watch-settled">
          <summary>{t("Settled in the last 30 days ({n})", { n: settled.length })}</summary>
          <ul style={{ margin: "8px 0 0", paddingInlineStart: 18 }}>
            {settled.map((f) => (
              <li key={f.id}>
                {title(f)} — {f.status === "explained" ? t("explained") : t("looked into")}
                {f.settledBy ? ` (${f.settledBy})` : ""}
                {f.note ? `: ${f.note}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
