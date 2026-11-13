"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setBusinessPlanAction,
  setClosedAction,
  setPaidUntilAction,
  setPilotAction,
} from "@/lib/actions/parts";
import { enterSupportAction } from "@/lib/actions/support";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { PLAN_LABEL, TYPE_LABEL } from "@/lib/plans";
import { dateTimeIn } from "@/lib/dates";

type Plan = "starter" | "complete" | "business";
type State = "active" | "grace" | "read_only" | "closed";

const STATE_LABEL: Record<State, string> = {
  active: "Paid",
  grace: "Payment due",
  read_only: "Read-only",
  closed: "Closed",
};

/**
 * The administrators' console (0108, 0109): every business on one page, how
 * it is doing (its last sale, today's sales, errors, tills keeping sales,
 * problems sent to support), its plan, paying, the pilot group, closing, and
 * a support look while its owner allows it. Each change asks why.
 */
export function BusinessPlans({
  businesses,
  timezone,
}: {
  businesses: {
    id: string;
    name: string;
    plan: Plan;
    businessType: "cafe" | "bakery" | "restaurant" | "supplier";
    places: number;
    people: number;
    practice: boolean;
    pilot: boolean;
    paidUntil: string | null;
    state: State;
    lastSaleAt: string | null;
    salesToday: number;
    errorsToday: number;
    tillsWaiting: number;
    problemsOpen: number;
    supportUntil: string | null;
  }[];
  timezone: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [paid, setPaid] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (f: () => Promise<{ ok: boolean; error?: string }>) => {
    setMsg(null);
    start(async () => {
      const r = await f();
      if (!r.ok) setMsg({ ok: false, text: r.error ?? "" });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="business-plans">
      <Field label={t("Why")}>
        <input
          style={inputStyle}
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          data-testid="plan-reason"
        />
      </Field>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("Business")}</th>
              <th>{t("Plan")}</th>
              <th>{t("Paying")}</th>
              <th className="right">{t("Sales today")}</th>
              <th>{t("Last sale")}</th>
              <th className="right">{t("Errors")}</th>
              <th className="right">{t("Tills keeping sales")}</th>
              <th className="right">{t("Problems")}</th>
              <th>{t("Support")}</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} data-testid="business-row" data-name={b.name}>
                <td>
                  <strong>{b.name}</strong>
                  <div className="muted" style={{ fontSize: ".8rem" }}>
                    {t(TYPE_LABEL[b.businessType])} · {b.places} · {b.people}
                    {b.practice ? ` · ${t("practice")}` : ""}
                  </div>
                  <label style={{ display: "flex", gap: 4, fontSize: ".8rem" }}>
                    <input
                      type="checkbox"
                      checked={b.pilot}
                      disabled={busy || b.practice}
                      onChange={(e) =>
                        run(() =>
                          setPilotAction({ businessId: b.id, pilot: e.target.checked, reason }),
                        )
                      }
                      data-testid="business-pilot"
                    />
                    {t("Pilot group")}
                  </label>
                </td>
                <td>
                  <select
                    style={inputStyle}
                    aria-label={t("Plan")}
                    value={b.plan}
                    disabled={busy}
                    onChange={(e) =>
                      run(() =>
                        setBusinessPlanAction({
                          businessId: b.id,
                          plan: e.target.value as Plan,
                          reason,
                        }),
                      )
                    }
                    data-testid="business-plan"
                  >
                    {(Object.keys(PLAN_LABEL) as Plan[]).map((p) => (
                      <option key={p} value={p}>
                        {t(PLAN_LABEL[p])}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span
                    className={b.state === "active" ? "badge ok" : "badge"}
                    data-testid="business-state"
                  >
                    {t(STATE_LABEL[b.state])}
                  </span>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <input
                      type="date"
                      style={inputStyle}
                      aria-label={t("Paid until")}
                      value={paid[b.id] ?? b.paidUntil ?? ""}
                      onChange={(e) => setPaid((x) => ({ ...x, [b.id]: e.target.value }))}
                      data-testid="business-paid-until"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          setPaidUntilAction({
                            businessId: b.id,
                            paidUntil: (paid[b.id] ?? b.paidUntil ?? "") || null,
                            reason,
                          }),
                        )
                      }
                      data-testid="business-paid-save"
                    >
                      {t("Save")}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn-link"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        setClosedAction({ businessId: b.id, closed: b.state !== "closed", reason }),
                      )
                    }
                  >
                    {b.state === "closed" ? t("Open it again") : t("Close it")}
                  </button>
                </td>
                <td className="right mono">{b.salesToday}</td>
                <td>{b.lastSaleAt ? dateTimeIn(timezone, b.lastSaleAt) : "—"}</td>
                <td className={`right mono ${b.errorsToday > 0 ? "red" : ""}`}>{b.errorsToday}</td>
                <td className={`right mono ${b.tillsWaiting > 0 ? "red" : ""}`}>
                  {b.tillsWaiting}
                </td>
                <td className={`right mono ${b.problemsOpen > 0 ? "red" : ""}`}>
                  {b.problemsOpen}
                </td>
                <td>
                  {b.supportUntil ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => enterSupportAction(b.id))}
                      data-testid="business-support"
                    >
                      {t("Look, read-only")}
                    </button>
                  ) : (
                    <span className="muted">{t("Not allowed")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Notice msg={msg} />
    </div>
  );
}
