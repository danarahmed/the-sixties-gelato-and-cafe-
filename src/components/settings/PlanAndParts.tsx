"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBusinessPartAction, setBusinessTypeAction } from "@/lib/actions/parts";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

type Plan = "starter" | "complete" | "business";
type BusinessType = "cafe" | "bakery" | "restaurant" | "supplier";

export const PLAN_LABEL: Record<Plan, string> = {
  starter: "Starter",
  complete: "Complete",
  business: "Business",
};
export const TYPE_LABEL: Record<BusinessType, string> = {
  cafe: "Café",
  bakery: "Bakery",
  restaurant: "Restaurant",
  supplier: "Supplier",
};

/**
 * Plans and parts (0108): the business's plan (changed by the system's
 * administrators), its type (deciding what is on by default), and each part,
 * on or off. The owner switches a part within the plan, with why; a part that
 * is off is hidden, and its work refused, while the books run underneath.
 */
export function PlanAndParts({
  plan,
  businessType,
  parts,
  isOwner,
}: {
  plan: Plan;
  businessType: BusinessType;
  parts: { part: string; label: string; inPlan: boolean; defaultOn: boolean; on: boolean }[];
  isOwner: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [type, setType] = useState<BusinessType>(businessType);
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
    <div className="grid" style={{ gap: 10 }} data-testid="plan-and-parts">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "One system for every business: a part that is off is not shown, and its work is refused, but every sale, delivery and count still posts to the books. Turned on, a part shows its whole history.",
        )}
      </p>
      <strong data-testid="plan-now">
        {t("The {plan} plan · {type}", {
          plan: t(PLAN_LABEL[plan]),
          type: t(TYPE_LABEL[businessType]),
        })}
      </strong>
      <table data-testid="parts">
        <tbody>
          {parts.map((p) => (
            <tr key={p.part} data-testid="part-row" data-part={p.part}>
              <td>{t(p.label)}</td>
              <td>
                <span className={p.on ? "badge ok" : "badge"}>
                  {p.on ? t("On") : p.inPlan ? t("Off") : t("Not in the plan")}
                </span>
              </td>
              <td>
                {isOwner && p.inPlan && (
                  <button
                    type="button"
                    className="btn-link"
                    disabled={busy}
                    data-testid="part-toggle"
                    onClick={() =>
                      run(() => setBusinessPartAction({ part: p.part, on: !p.on, reason }))
                    }
                  >
                    {p.on ? t("Turn off") : t("Turn on")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isOwner && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}
        >
          <Field label={t("Why")}>
            <input
              style={inputStyle}
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              data-testid="parts-reason"
            />
          </Field>
          <Field label={t("Type of business")}>
            <select
              style={inputStyle}
              value={type}
              onChange={(e) => setType(e.target.value as BusinessType)}
              data-testid="business-type"
            >
              {(Object.keys(TYPE_LABEL) as BusinessType[]).map((k) => (
                <option key={k} value={k}>
                  {t(TYPE_LABEL[k])}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ alignSelf: "end" }}>
            <button
              type="button"
              disabled={busy || type === businessType}
              onClick={() => run(() => setBusinessTypeAction({ type, reason }))}
              data-testid="business-type-save"
            >
              {t("Change the type")}
            </button>
          </div>
        </div>
      )}
      <Notice msg={msg} />
    </div>
  );
}
