"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLoyaltyOwedAction } from "@/lib/actions/loyaltyOwed";
import type { LoyaltyOwed as Owed } from "@/lib/loyaltyOwed";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

/**
 * Loyalty points as money owed (0113), on Settings: the owner's switch, a
 * point's value, the points held and what the books owe for them; when the two
 * differ (the reward's value changed), one press brings the books to the
 * points held.
 */
export function LoyaltyOwed({ owed, isOwner }: { owed: Owed; isOwner: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set(enabled: boolean) {
    setMsg(null);
    start(async () => {
      const r = await setLoyaltyOwedAction({ enabled });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({
          ok: true,
          text: enabled
            ? t("Saved: the points held are owed, {amount}.", { amount: fmtIQD(r.data.owed) })
            : t("Saved: points are a discount when they are taken, as before."),
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="loyalty-owed">
      <Notice msg={msg} />
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "On, the points customers hold are money owed: each point at the reward's value, a cost when it is earned (Dr 6150 Loyalty points, Cr 2150 Loyalty points owed), owed no more when it is spent or taken back. Off, a reward is a discount when it is taken.",
        )}
      </p>
      <label className="chip" style={{ width: "fit-content" }}>
        <input
          type="checkbox"
          checked={owed.enabled}
          disabled={!isOwner || busy}
          onChange={(e) => set(e.target.checked)}
          data-testid="loyalty-owed-on"
        />{" "}
        {t("Points are booked as money owed")}
      </label>
      <div style={{ fontSize: ".9rem" }} data-testid="loyalty-owed-figures">
        {t("A point is worth {value}; customers hold {points} points, worth {worth}.", {
          value: fmtIQD(owed.pointValue),
          points: owed.pointsHeld.toLocaleString("en"),
          worth: fmtIQD(owed.worth),
        })}{" "}
        {owed.enabled && t("The books owe {amount}.", { amount: fmtIQD(owed.owed) })}
      </div>
      {isOwner && owed.enabled && owed.worth !== owed.owed && (
        <button
          type="button"
          disabled={busy}
          onClick={() => set(true)}
          data-testid="loyalty-owed-true-up"
          style={{ width: "fit-content" }}
        >
          {t("Bring the books to the points held")}
        </button>
      )}
      {!isOwner && (
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
          {t("Only the owner books points as money owed")}
        </p>
      )}
    </div>
  );
}
