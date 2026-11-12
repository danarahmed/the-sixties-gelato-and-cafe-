"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revalueDollarBillsAction } from "@/lib/actions/purchasing";
import { useOperation } from "@/components/useOperation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { fmtIQD } from "@/lib/format";

/**
 * What the café owes its suppliers in dollars (0103), and what the books carry
 * it at; at month end, valued again at a rate typed once (IAS 21), the
 * difference recorded to 6950 Exchange differences.
 */
export function DollarsOwed({
  usd,
  value,
  lastRate,
  canRevalue,
}: {
  usd: number;
  value: number;
  lastRate: number | null;
  canRevalue: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function revalue() {
    setMsg(null);
    start(async () => {
      const r = await op.run("revalueDollars", (key) =>
        revalueDollarBillsAction({ rate, reason }, key),
      );
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({
          ok: true,
          text: t(
            "Valued again: {n} bills, a difference of {amount} to 6950 Exchange differences.",
            {
              n: r.data.bills,
              amount: fmtIQD(r.data.difference),
            },
          ),
        });
        setRate("");
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <div className="card grid" style={{ gap: 8 }} data-testid="dollars-owed">
      <strong>
        {t("Owed to suppliers in dollars: ${usd}, carried at {value}", {
          usd: usd.toLocaleString("en-US"),
          value: fmtIQD(value),
        })}
      </strong>
      {lastRate !== null && (
        <span className="muted" style={{ fontSize: ".85rem" }}>
          {t("Last valued again at {rate} dinars a dollar.", {
            rate: lastRate.toLocaleString("en-US"),
          })}
        </span>
      )}
      {canRevalue && usd > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="grid" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: ".8rem" }}>
              {t("Dinars a dollar")}
            </span>
            <input
              style={{ ...inputStyle, width: "10ch" }}
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              data-testid="revalue-rate"
            />
          </label>
          <label className="grid" style={{ gap: 4, flex: 1, minWidth: 180 }}>
            <span className="muted" style={{ fontSize: ".8rem" }}>
              {t("Why")}
            </span>
            <input
              style={inputStyle}
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={revalue}
            disabled={busy || !rate || !reason.trim()}
            data-testid="revalue-go"
          >
            {t("Value again at month end")}
          </button>
        </div>
      )}
      <Notice msg={msg} />
    </div>
  );
}
