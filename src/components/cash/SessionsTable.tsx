import Link from "next/link";
import { arrows } from "@/lib/i18n/core";
import { getDir, getT } from "@/lib/i18n/server";
import type { CashSessionRow } from "@/lib/db/cash";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";

/** A difference as the table shows it: signed, green when there is none. */
function Diff({ v }: { v: number | null }) {
  if (v === null) return <span className="muted">—</span>;
  return (
    <span style={{ color: v === 0 ? "var(--ok)" : "var(--err)" }}>
      {v > 0 ? "+" : ""}
      {fmtIQD(v)}
    </span>
  );
}

/**
 * Cash sessions (0036), newest first, and the drawer counts and day closes
 * before them: when, whose, what the drawer opened with and should have held,
 * what was counted, and the difference. An open session shows what it should
 * hold only to those who may see it.
 */
export async function SessionsTable({
  rows,
  timezone,
}: {
  rows: CashSessionRow[];
  timezone: string;
}) {
  const t = await getT();
  const { on } = arrows(await getDir());
  const at = (ts: string | null) => (ts ? dateTimeIn(timezone, ts) : "—");
  return (
    <div className="tw">
      <table data-testid="sessions-table">
        <thead>
          <tr>
            <th>{t("Session")}</th>
            <th>{t("Cashier")}</th>
            <th>{t("Opened")}</th>
            <th>{t("Closed")}</th>
            <th className="right">{t("Opened with")}</th>
            <th className="right">{t("Should hold")}</th>
            <th className="right">{t("Counted")}</th>
            <th className="right">{t("Over / short")}</th>
            <th className="right">{t("Taken out")}</th>
            <th className="right">{t("Card")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {r.kind === "session" ? (
                  <Link className="drill" href={`/sales/sessions/${r.id}`}>
                    {t("Session {no}", { no: String(r.no) })}
                  </Link>
                ) : r.kind === "drawer" ? (
                  <Link className="drill" href={`/sales/sessions/${r.id}`}>
                    {t("Drawer count")}
                  </Link>
                ) : (
                  t("Day closed")
                )}
                {r.isOpen && (
                  <span className="badge ok" style={{ marginInlineStart: 6 }}>
                    {t("open")}
                  </span>
                )}
                {r.forcedReason && (
                  <div className="muted" style={{ fontSize: ".75rem" }}>
                    {t("Closed by {name}: {reason}", {
                      name: String(r.closedBy),
                      reason: r.forcedReason,
                    })}
                  </div>
                )}
                {r.openedFromNo !== null && (
                  <div className="muted" style={{ fontSize: ".75rem" }}>
                    {t("Handed over from session {no}", { no: String(r.openedFromNo) })}
                  </div>
                )}
              </td>
              <td>{r.cashier ?? "—"}</td>
              <td className="mono" style={{ fontSize: ".8rem" }}>
                {at(r.openedAt)}
              </td>
              <td className="mono" style={{ fontSize: ".8rem" }}>
                {r.isOpen ? "—" : at(r.closedAt)}
              </td>
              <td className="right money">
                {r.openingCounted === null ? "—" : fmtIQD(r.openingCounted)}
                {r.openingVariance !== null && r.openingVariance !== 0 && (
                  <div style={{ fontSize: ".75rem" }}>
                    <Diff v={r.openingVariance} />
                  </div>
                )}
              </td>
              <td className="right money">{r.expected === null ? "—" : fmtIQD(r.expected)}</td>
              <td className="right money">{r.counted === null ? "—" : fmtIQD(r.counted)}</td>
              <td className="right money">
                <Diff v={r.isOpen ? null : r.variance} />
              </td>
              <td className="right money">
                {r.taken ? `${fmtIQD(r.taken)} ${on} ${t(String(r.takenTo))}` : "—"}
              </td>
              <td className="right money">{r.card === null ? "—" : fmtIQD(r.card)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
