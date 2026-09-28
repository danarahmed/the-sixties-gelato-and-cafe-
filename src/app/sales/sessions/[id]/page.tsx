import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getSessionStatement } from "@/lib/db/cash";
import { fmtIQD } from "@/lib/format";
import { fmtUSD } from "@/lib/fx";
import { dateTimeIn } from "@/lib/dates";
import { SessionsTable } from "@/components/cash/SessionsTable";

export const dynamic = "force-dynamic";

const MOVEMENT: Record<string, string> = {
  sale: "Cash sale",
  void: "Void",
  refund: "Refund",
  paid_out: "Paid out",
  paid_out_reversed: "Paid out, reversed",
  cash_in: "Put in",
  cash_out: "Taken out",
};

// The till's dollars in and out (0043): phrases, shown through t().
const DOLLAR_MOVEMENT: Record<string, string> = {
  sale: "Paid in dollars",
  void: "Void",
  count: "Counted over or short",
  take: "Taken to the safe",
  exchange: "Exchanged for dinars",
};

/**
 * One session's statement (0036): what it opened with, every movement of cash
 * in it as it happened, what it should have held, what was counted, and the
 * takings after it. An open session's statement waits for its count, but for
 * those who may see what a drawer should hold.
 */
export default async function SessionStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requirePermission("day.close", "cash.view_expected", "audit.view");
  const [t, { id }] = await Promise.all([getT(), params]);
  const st = await getSessionStatement(id);
  const s = st.session;
  const at = (ts: string) => dateTimeIn(profile.timezone, ts);
  const notes = (n: Record<string, number> | null) =>
    n
      ? Object.entries(n)
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(([note, qty]) => `${fmtIQD(Number(note))} × ${qty}`)
          .join(" · ")
      : null;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>
          {s.kind === "session" ? t("Session {no}", { no: String(s.no) }) : t("Drawer count")}
        </h1>
        <span className="sc">
          <Link className="drill" href="/sales/sessions">
            {t("Cash sessions")}
          </Link>
        </span>
      </div>
      <section className="panel">
        <SessionsTable rows={[s]} timezone={profile.timezone} />
      </section>
      {(notes(st.notes.opening) || notes(st.notes.closing)) && (
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {notes(st.notes.opening) && `${t("Notes at the opening")}: ${notes(st.notes.opening)}`}
          {notes(st.notes.opening) && notes(st.notes.closing) && " — "}
          {notes(st.notes.closing) && `${t("Notes at the close")}: ${notes(st.notes.closing)}`}
        </p>
      )}
      <section className="panel">
        <div className="panel-h">
          <h3>{t("Cash in and out")}</h3>
        </div>
        <div className="tw">
          <table data-testid="session-movements">
            <thead>
              <tr>
                <th>{t("When")}</th>
                <th>{t("What")}</th>
                <th>{t("Order")}</th>
                <th>{t("Note")}</th>
                <th>{t("By")}</th>
                <th className="right">{t("Amount")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono" style={{ fontSize: ".8rem" }}>
                  {at(s.openedAt)}
                </td>
                <td>{t("Opened with")}</td>
                <td />
                <td />
                <td className="muted">{s.openedBy ?? "—"}</td>
                <td className="right money">
                  {s.openingCounted === null ? "—" : fmtIQD(s.openingCounted)}
                </td>
              </tr>
              {st.movements.map((m, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: ".8rem" }}>
                    {at(m.at)}
                  </td>
                  <td>{t(MOVEMENT[m.kind] ?? m.kind)}</td>
                  <td className="mono">{m.turnNo === null ? "" : `#${m.turnNo}`}</td>
                  <td className="muted">{m.note ?? ""}</td>
                  <td className="muted">{m.by ?? "—"}</td>
                  <td
                    className="right money"
                    style={{ color: m.amount < 0 ? "var(--err)" : undefined }}
                  >
                    {fmtIQD(m.amount)}
                  </td>
                </tr>
              ))}
              {st.takings.map((x, i) => (
                <tr key={`t${i}`}>
                  <td className="mono" style={{ fontSize: ".8rem" }}>
                    {at(x.at)}
                  </td>
                  <td>{t("Takings to the {place}", { place: t(x.to) })}</td>
                  <td />
                  <td className="muted">
                    {x.journalNo ? t("Journal {no}", { no: x.journalNo }) : ""}
                  </td>
                  <td />
                  <td className="right money">{fmtIQD(-x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {(st.dollars || st.dollarEvents.length > 0) && (
        <section className="panel" data-testid="session-dollars">
          <div className="panel-h">
            <h3>{t("Dollars in and out")}</h3>
            {st.dollars && (
              <span className="muted" style={{ fontSize: ".78rem" }}>
                {st.dollars.counted === null
                  ? t("Not counted at the close: {usd} stayed in the till", {
                      usd: fmtUSD(st.dollars.expected),
                    })
                  : t("Should have held {expected}; counted {counted}; {taken} to the safe", {
                      expected: fmtUSD(st.dollars.expected),
                      counted: fmtUSD(st.dollars.counted),
                      taken: fmtUSD(st.dollars.taken),
                    })}
              </span>
            )}
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th>{t("What")}</th>
                  <th>{t("Order")}</th>
                  <th>{t("By")}</th>
                  <th className="right">{t("Dollars")}</th>
                  <th className="right">{t("Taken at")}</th>
                </tr>
              </thead>
              <tbody>
                {st.dollarEvents.map((e, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: ".8rem" }}>
                      {at(e.at)}
                    </td>
                    <td>{t(DOLLAR_MOVEMENT[e.kind] ?? e.kind)}</td>
                    <td className="mono">{e.turnNo === null ? "" : `#${e.turnNo}`}</td>
                    <td className="muted">{e.by ?? "—"}</td>
                    <td
                      className="right money"
                      style={{ color: e.usd < 0 ? "var(--err)" : undefined }}
                    >
                      {e.usd < 0 ? `−${fmtUSD(-e.usd)}` : fmtUSD(e.usd)}
                    </td>
                    <td className="right money">{fmtIQD(e.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
