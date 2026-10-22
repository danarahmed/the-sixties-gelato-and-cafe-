import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/ui";
import { ReportVisit } from "@/components/reports/ReportVisit";
import { BalanceChart } from "@/components/charts/BalanceChart";
import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getCashAhead } from "@/lib/db/cashAhead";
import { lowestBank, sums, type CashEvent } from "@/lib/cashAhead";
import { WEEKDAY_NAME } from "@/lib/production";
import { fmtIQD } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAYS = 30;

/** A day's weekday, Monday first, as the books name it. */
const weekday = (day: string) => WEEKDAY_NAME[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]!;

/**
 * Cash ahead (0093, SMART_PLAN part 5): the next 30 days of the café's money,
 * the bank day by day as a chart and the safe and the café as a whole in a
 * table, what is due and expected, and a warning for each spell the bank or
 * the safe would be below nothing, with what to do. Worked out by the
 * database from the café's own records (cash_ahead).
 */
export default async function CashAheadPage() {
  const profile = await requirePermission("profit.view");
  const t = await getT();
  const ahead = await getCashAhead(DAYS);

  if (!ahead) {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <div className="phead">
          <h1>{t("Cash ahead")}</h1>
        </div>
        <EmptyState
          title={t("Cash ahead is not ready yet.")}
          hint={t("It comes with migration 0093.")}
        />
      </div>
    );
  }

  const low = lowestBank(ahead.days);
  const { out, in: comingIn } = sums(ahead.events);
  const last = ahead.days[ahead.days.length - 1];
  const kind = (e: CashEvent) =>
    e.kind === "bill"
      ? t("Bill {ref}", { ref: e.ref ?? "" })
      : e.kind === "to_bill"
        ? e.ref === "order"
          ? t("An order still to be billed")
          : t("A delivery still to be billed")
        : e.kind === "customer"
          ? t("Invoice {ref}", { ref: e.ref ?? "" })
          : e.every === "week"
            ? t("Every week")
            : e.every === "fortnight"
              ? t("Every two weeks")
              : e.every === "quarter"
                ? t("Every three months")
                : t("Every month");
  const from = (e: CashEvent) => (e.from === "safe" ? t("the safe") : t("the bank"));

  return (
    <div className="grid" style={{ gap: 18 }}>
      <ReportVisit path="/reports/cash-ahead" />
      <PrintHead
        business={profile.businessName}
        title={t("Cash ahead")}
        period={t("The next {n} day(s) from {day}", { n: DAYS, day: ahead.asOf })}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>{t("Cash ahead")}</h1>
        <PrintButton />
        <span className="sc">
          {t("The next {n} day(s) from {day}", { n: DAYS, day: ahead.asOf })}
        </span>
      </div>
      <PageIntro
        text={t(
          "The café's money over the next days, from what it holds now, the usual takings of each weekday and what is due, as its own records have them. Nothing is moved or paid.",
        )}
        more={t("How this works")}
        extra={` ${t(
          "Each weekday's takings are the last four weeks' same weekdays: the cash goes to the safe at each close, the card money reaches the bank on the weekdays it has before, less what the bank keeps; the safe is banked on the weekdays it has been. Bills are paid on their due dates, moved to the days and as late as the café has paid them lately. A payment made again and again under the same words — the rent, the electricity, the salaries, the owner's drawings — comes again when it has before, at what it was last. An overdue customer invoice is not counted.",
        )}`}
      />

      {ahead.warnings.length > 0 ? (
        <div className="grid" style={{ gap: 10 }} data-testid="cash-warnings">
          {ahead.warnings.map((w) => (
            <div key={w.from} className="card cash-warning" role="alert" data-testid="cash-warning">
              <strong>
                {w.account === "bank"
                  ? t("The bank would be {amount} short on {day}.", {
                      amount: fmtIQD(-w.lowest),
                      day: w.lowestOn,
                    })
                  : t("The safe would be {amount} short on {day}.", {
                      amount: fmtIQD(-w.lowest),
                      day: w.lowestOn,
                    })}
              </strong>
              <div className="muted" style={{ fontSize: ".85rem" }}>
                {w.until
                  ? t("From {from}, in {n} day(s), until {until}.", {
                      from: w.from,
                      n: w.daysAhead,
                      until: w.until,
                    })
                  : t("From {from}, in {n} day(s), and still at the end of the days ahead.", {
                      from: w.from,
                      n: w.daysAhead,
                    })}{" "}
                {w.due.length > 0 &&
                  t("Due then: {what}.", {
                    what: w.due.map((e) => `${e.label} ${fmtIQD(-e.amount)}`).join(", "),
                  })}
              </div>
              <div data-testid="cash-warning-action">
                {w.action === "move" && w.move !== null
                  ? t("Move {amount} from the safe to the bank by {day}.", {
                      amount: fmtIQD(w.move),
                      day: w.moveBy ?? w.from,
                    })
                  : w.action === "later" && w.later
                    ? t("Ask {supplier} to take {amount} later.", {
                        supplier: w.later.label,
                        amount: fmtIQD(-w.later.amount),
                      })
                    : t("Put money in, or pay something due later.")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" data-testid="cash-ok">
          <strong>
            {t("The bank and the safe cover what is due in the next {n} day(s).", { n: DAYS })}
          </strong>
        </div>
      )}

      <div className="kpis" data-testid="cash-tiles">
        <div className="card stat">
          <span className="label">{t("The bank now")}</span>
          <span className="value">{fmtIQD(ahead.now.bank)}</span>
          <span className="delta">
            {t("The safe {safe}, card money on its way {card}", {
              safe: fmtIQD(ahead.now.safe),
              card: fmtIQD(ahead.now.card),
            })}
          </span>
        </div>
        <div className="card stat">
          <span className="label">{t("Lowest the bank comes to")}</span>
          <span className={`value${low && low.amount < 0 ? " warn-text" : ""}`}>
            {low ? fmtIQD(low.amount) : "—"}
          </span>
          <span className="delta">{low ? low.day : ""}</span>
        </div>
        <div className="card stat">
          <span className="label">{t("Due in the next {n} day(s)", { n: DAYS })}</span>
          <span className="value">{fmtIQD(out)}</span>
          <span className="delta">
            {comingIn > 0
              ? t("And {amount} from customers", { amount: fmtIQD(comingIn) })
              : t("Bills, regular payments, salaries")}
          </span>
        </div>
        <div className="card stat">
          <span className="label">{t("The café in {n} day(s)", { n: DAYS })}</span>
          <span className="value">{last ? fmtIQD(last.total) : "—"}</span>
          <span className="delta">{t("The till, the safe, the card money and the bank")}</span>
        </div>
      </div>

      <div className="card" data-testid="cash-chart">
        <BalanceChart
          title={t("The bank at each day's end (million IQD)")}
          shortWord={t("short")}
          balances={ahead.days.map((d) => {
            const due = ahead.events.filter((e) => e.day === d.day && e.amount < 0);
            return {
              key: d.day,
              label: d.day.slice(8),
              value: d.bank,
              valueText: fmtIQD(d.bank),
              detail:
                due.length > 0
                  ? `${t(weekday(d.day))} ${d.day}: ${due.map((e) => e.label).join(", ")}`
                  : `${t(weekday(d.day))} ${d.day}`,
            };
          })}
          labels={{ table: t("The days as a table"), heading: t("Day"), value: t("The bank") }}
        />
      </div>

      <section className="card" aria-labelledby="cash-days">
        <h2 id="cash-days" className="viz-title">
          {t("Day by day")}
        </h2>
        <div className="tw">
          <table data-testid="cash-days">
            <thead>
              <tr>
                <th>{t("Day")}</th>
                <th className="right">{t("Takings")}</th>
                <th className="right">{t("Paid out")}</th>
                <th className="right">{t("The safe")}</th>
                <th className="right">{t("The bank")}</th>
                <th className="right">{t("The café")}</th>
              </tr>
            </thead>
            <tbody>
              {ahead.days.map((d) => (
                <tr key={d.day} data-day={d.day}>
                  <td>
                    {t(weekday(d.day))} <span style={{ whiteSpace: "nowrap" }}>{d.day}</span>
                  </td>
                  <td className="right money" data-label={t("Takings")}>
                    {fmtIQD(d.takings)}
                  </td>
                  <td className="right money" data-label={t("Paid out")}>
                    {d.paid > 0 ? fmtIQD(d.paid) : "—"}
                  </td>
                  <td className="right money" data-label={t("The safe")}>
                    {fmtIQD(d.safe)}
                  </td>
                  <td
                    className={`right money${d.bank < 0 ? " warn-text" : ""}`}
                    data-label={t("The bank")}
                  >
                    {fmtIQD(d.bank)}
                  </td>
                  <td className="right money" data-label={t("The café")}>
                    {fmtIQD(d.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="cash-due">
        <h2 id="cash-due" className="viz-title">
          {t("What is due and expected")}
        </h2>
        {ahead.events.length === 0 ? (
          <p className="muted">{t("Nothing due in the days ahead but the usual takings.")}</p>
        ) : (
          <div className="tw">
            <table data-testid="cash-events">
              <thead>
                <tr>
                  <th>{t("Day")}</th>
                  <th>{t("What")}</th>
                  <th>{t("Why it is expected")}</th>
                  <th className="right">{t("Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {ahead.events.map((e, i) => (
                  <tr key={`${e.day}-${i}`} data-testid="cash-event" data-kind={e.kind}>
                    <td style={{ whiteSpace: "nowrap" }}>{e.day}</td>
                    <td>
                      {e.label}
                      <span className="muted"> · {from(e)}</span>
                    </td>
                    <td className="muted">{kind(e)}</td>
                    <td className={`right money${e.amount < 0 ? "" : " cash-in"}`}>
                      {e.amount < 0 ? `−${fmtIQD(-e.amount)}` : `+${fmtIQD(e.amount)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ahead.overdue.length > 0 && (
          <p className="muted" style={{ fontSize: ".85rem" }} data-testid="cash-overdue">
            {t("Overdue, not counted: {what}.", {
              what: ahead.overdue.map((o) => `${o.label} ${fmtIQD(o.amount)}`).join(", "),
            })}{" "}
            <Link href="/customers">{t("nav.customers")}</Link>
          </p>
        )}
      </section>
    </div>
  );
}
