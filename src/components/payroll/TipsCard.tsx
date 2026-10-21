"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTipSharersAction } from "@/lib/actions/tips";
import type { TipsMonth } from "@/lib/tips";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

/**
 * The tips (0090), on Payroll: who shares them, ticked by the owner; each
 * day's tips at the end of that day, shared equally between those ticked who
 * clocked in that day (all of them when nobody did); and each person's total
 * for the month, which the month's payroll adds to their pay.
 */
export function TipsCard({
  tips,
  people,
  canRun,
}: {
  tips: TipsMonth;
  /** Everyone who works here now, to tick. */
  people: { id: string; name: string }[];
  canRun: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(tips.sharers.map((s) => s.employeeId)),
  );
  const changed =
    ticked.size !== tips.sharers.length || tips.sharers.some((s) => !ticked.has(s.employeeId));

  function save() {
    setMsg(null);
    start(async () => {
      const r = await setTipSharersAction({ employees: [...ticked] });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved: from today, the tips are shared between them.") });
        router.refresh();
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 12 }} data-testid="tips-card">
      <Notice msg={msg} />
      <div>
        <h3 style={{ margin: "0 0 6px" }}>{t("Who shares the tips")}</h3>
        {people.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t("Add the people who work here on Staff first.")}
          </p>
        ) : (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }} data-testid="tip-sharers">
            {people.map((p) => (
              <label key={p.id} className="chip" data-testid="tip-sharer" data-name={p.name}>
                <input
                  type="checkbox"
                  checked={ticked.has(p.id)}
                  disabled={!canRun || busy}
                  onChange={(e) => {
                    const next = new Set(ticked);
                    if (e.target.checked) next.add(p.id);
                    else next.delete(p.id);
                    setTicked(next);
                  }}
                />{" "}
                <span dir="auto">{p.name}</span>
              </label>
            ))}
          </div>
        )}
        {canRun && changed && (
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 8 }}
            onClick={save}
            disabled={busy}
            data-testid="tip-sharers-save"
          >
            {busy ? "…" : t("Save who shares the tips")}
          </button>
        )}
      </div>

      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <div>
          <span className="muted">{t("Tips this month")}</span>
          <div className="mono" style={{ fontSize: "1.3rem" }} data-testid="tips-total">
            {fmtIQD(tips.total)}
          </div>
        </div>
        {tips.unshared > 0 && (
          <div className="badge warn" data-testid="tips-unshared">
            {t("{amount} had nobody ticked to share it", { amount: fmtIQD(tips.unshared) })}
          </div>
        )}
      </div>

      {tips.people.length > 0 && (
        <div className="tw">
          <table data-testid="tips-people">
            <thead>
              <tr>
                <th>{t("Person")}</th>
                <th className="num">{t("Their tips this month")}</th>
              </tr>
            </thead>
            <tbody>
              {tips.people.map((p) => (
                <tr key={p.employeeId} data-name={p.name}>
                  <td dir="auto">{p.name}</td>
                  <td className="num mono">{fmtIQD(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tips.days.length > 0 && (
        <details>
          <summary>{t("Each day's tips, and how they were shared")}</summary>
          <div className="tw">
            <table data-testid="tips-days">
              <thead>
                <tr>
                  <th>{t("Day")}</th>
                  <th className="num">{t("Tips")}</th>
                  <th>{t("Shared")}</th>
                </tr>
              </thead>
              <tbody>
                {tips.days.map((d) => (
                  <tr key={`${d.day}-${d.location ?? ""}`}>
                    <td>
                      <bdi className="mono">{d.day}</bdi>
                      {d.location ? <span className="muted"> · {d.location}</span> : null}
                      {d.today && <span className="muted"> · {t("so far today")}</span>}
                    </td>
                    <td className="num mono">{fmtIQD(d.tips)}</td>
                    <td>
                      {d.shares
                        .map((s) =>
                          s.employeeId === null
                            ? t("nobody to share it")
                            : `${s.name} ${fmtIQD(s.amount)}`,
                        )
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
