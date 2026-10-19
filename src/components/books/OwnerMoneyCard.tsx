"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveCashAction } from "@/lib/actions/sales";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

/**
 * The owner's money (round twenty-four): what the owner has put into the café
 * and taken out of it, all told (3000 and 3200), and either done here — into
 * or out of the bank or the safe — in two taps.
 */
export function OwnerMoneyCard({ invested, drawn }: { invested: number; drawn: number }) {
  const { t, msg } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [way, setWay] = useState<"in" | "out">("in");
  const [place, setPlace] = useState<"bank" | "safe">("bank");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function save() {
    const value = Number(amount.replace(/,/g, ""));
    setError(null);
    setDone(null);
    start(async () => {
      const r = await op.run(`owner:${way}:${place}:${value}`, (key) =>
        moveCashAction(
          {
            from: way === "in" ? "owner" : place,
            to: way === "in" ? place : "owner",
            amount: value,
            note: note.trim(),
          },
          key,
        ),
      );
      if (!r.ok) return setError(r.error);
      setAmount("");
      setNote("");
      setDone(t("Recorded."));
      router.refresh();
    });
  }

  return (
    <section className="panel" data-testid="owner-money">
      <div className="panel-h">
        <h3>
          <Icon name="user" /> {t("The owner's money")}
        </h3>
      </div>
      <div className="grid" style={{ gap: 10, padding: 12 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="muted">{t("Put in")}</div>
            <b className="mono">{fmtIQD(invested)}</b>
          </div>
          <div>
            <div className="muted">{t("Taken out")}</div>
            <b className="mono">{fmtIQD(drawn)}</b>
          </div>
        </div>
        <div className="seg" role="radiogroup" aria-label={t("Which way?")}>
          <button
            type="button"
            role="radio"
            aria-checked={way === "in"}
            className={way === "in" ? "active" : ""}
            onClick={() => setWay("in")}
          >
            {t("The owner puts money in")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={way === "out"}
            className={way === "out" ? "active" : ""}
            onClick={() => setWay("out")}
          >
            {t("The owner takes money out")}
          </button>
        </div>
        <div className="seg" role="radiogroup" aria-label={t("Where?")}>
          {(["bank", "safe"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={place === p}
              className={place === p ? "active" : ""}
              onClick={() => setPlace(p)}
            >
              {t(p === "bank" ? "The bank" : "The safe")}
            </button>
          ))}
        </div>
        <div className="account-form grid" style={{ gap: 8 }}>
          <label>
            <span>{t("Amount")}</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="owner-amount"
            />
          </label>
          <label>
            <span>{t("What it is for (required)")}</span>
            <input
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              data-testid="owner-note"
            />
          </label>
        </div>
        <div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !(Number(amount.replace(/,/g, "")) > 0) || !note.trim()}
            onClick={save}
            data-testid="owner-save"
          >
            {t("Record it")}
          </button>
        </div>
        {error && (
          <p className="red" role="alert" style={{ margin: 0 }}>
            {msg(error)}
          </p>
        )}
        {done && !error && (
          <p className="pos-val" role="status" style={{ margin: 0 }}>
            {done}
          </p>
        )}
        <OperationStatus op={op} />
      </div>
    </section>
  );
}
