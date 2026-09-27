"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveCashAction } from "@/lib/actions/sales";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

const PLACES = {
  till: "the till",
  safe: "the safe",
  bank: "the bank",
  owner: "the owner",
} as const;
type Place = keyof typeof PLACES;

/**
 * Cash moved between the till, the safe, the bank and the owner: a float put in
 * the drawer, takings to the safe during the day, a bank deposit, money the
 * owner puts in or takes out (only the owner takes money for themselves).
 */
export function MoveCash({ isOwner, safe }: { isOwner: boolean; safe: number }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [from, setFrom] = useState<Place>("safe");
  const [to, setTo] = useState<Place>("till");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const needsNote = from === "owner" || to === "owner";

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await op.run("moveCash", (key) => moveCashAction({ from, to, amount, note }, key));
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({
        ok: true,
        text: t("Moved {amount} from {from} to {to} (journal {journal}).", {
          amount: fmtIQD(Number(amount.replace(/[^0-9.]/g, "")) || 0),
          from: t(PLACES[from]),
          to: t(PLACES[to]),
          journal: r.data.journalNo ?? "—",
        }),
      });
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="panel-b">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ minWidth: 130 }}>
          <div className="sc">{t("From")}</div>
          <select
            aria-label={t("Cash from")}
            value={from}
            onChange={(e) => setFrom(e.target.value as Place)}
          >
            {(Object.keys(PLACES) as Place[]).map((k) => (
              <option key={k} value={k}>
                {t(PLACES[k])}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 130 }}>
          <div className="sc">{t("To")}</div>
          <select
            aria-label={t("Cash to")}
            value={to}
            onChange={(e) => setTo(e.target.value as Place)}
          >
            {(Object.keys(PLACES) as Place[])
              .filter((k) => k !== "owner" || isOwner)
              .map((k) => (
                <option key={k} value={k}>
                  {t(PLACES[k])}
                </option>
              ))}
          </select>
        </label>
        <label style={{ minWidth: 130 }}>
          <div className="sc">{t("Amount (IQD)")}</div>
          <input
            aria-label={t("Amount to move")}
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label style={{ flex: 1, minWidth: 180 }}>
          <div className="sc">
            {needsNote ? t("What it is for (required)") : t("Note (optional)")}
          </div>
          <input
            aria-label={t("What the cash is for")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={needsNote ? t("Float for the till") : t("Deposit at the bank")}
          />
        </label>
        <button
          onClick={submit}
          disabled={busy || from === to || !amount.trim() || (needsNote && !note.trim())}
        >
          {busy ? t("Moving…") : t("Move cash")}
        </button>
      </div>
      <p className="muted" style={{ fontSize: ".78rem", marginBlockEnd: 0 }}>
        {t(
          "The safe holds {amount} in the books. Neither the till nor the safe can pay out more than it holds.",
          { amount: fmtIQD(safe) },
        )}
      </p>
      <div style={{ marginBlockStart: 12 }}>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </div>
  );
}
