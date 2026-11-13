"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBusinessPlanAction } from "@/lib/actions/parts";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { PLAN_LABEL, TYPE_LABEL } from "@/components/settings/PlanAndParts";

type Plan = "starter" | "complete" | "business";

/** Every business and its plan (0108), for the system's administrators: changed with why. */
export function BusinessPlans({
  businesses,
}: {
  businesses: {
    id: string;
    name: string;
    plan: Plan;
    businessType: "cafe" | "bakery" | "restaurant" | "supplier";
    places: number;
    people: number;
    practice: boolean;
  }[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = (businessId: string, plan: Plan) => {
    setMsg(null);
    start(async () => {
      const r = await setBusinessPlanAction({ businessId, plan, reason });
      if (!r.ok) setMsg({ ok: false, text: r.error });
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
      <table>
        <thead>
          <tr>
            <th>{t("Business")}</th>
            <th>{t("Type of business")}</th>
            <th className="right">{t("Places")}</th>
            <th className="right">{t("People")}</th>
            <th>{t("Plan")}</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((b) => (
            <tr key={b.id} data-testid="business-row" data-name={b.name}>
              <td>
                {b.name}
                {b.practice ? ` · ${t("practice")}` : ""}
              </td>
              <td>{t(TYPE_LABEL[b.businessType])}</td>
              <td className="right mono">{b.places}</td>
              <td className="right mono">{b.people}</td>
              <td>
                <select
                  style={inputStyle}
                  aria-label={t("Plan")}
                  value={b.plan}
                  disabled={busy}
                  onChange={(e) => change(b.id, e.target.value as Plan)}
                  data-testid="business-plan"
                >
                  {(Object.keys(PLAN_LABEL) as Plan[]).map((p) => (
                    <option key={p} value={p}>
                      {t(PLAN_LABEL[p])}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Notice msg={msg} />
    </div>
  );
}
