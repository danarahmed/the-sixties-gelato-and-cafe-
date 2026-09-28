"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exchangeDollarsAction, setFxRateAction } from "@/lib/actions/fx";
import { fmtIQD } from "@/lib/format";
import { fmtRate, fmtUSD, wholeNumber, type DollarsReport, type FxStatus } from "@/lib/fx";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

// Where dollars are kept and where their dinars go: phrases, shown through t().
const PLACES = { till: "the till", safe: "the safe", bank: "the bank" } as const;
type From = "till" | "safe";
type To = keyof typeof PLACES;

/**
 * US dollars (0043) on Sales: today's rate, set by a manager with where it
 * comes from, and the rates before; what the tills and the safe hold; and
 * dollars exchanged for dinars, the difference from what they were taken at
 * going to 6950 Exchange differences.
 */
export function DollarsPanel({
  fx,
  held,
  canExchange,
  timezone,
}: {
  fx: FxStatus;
  /** What the tills and the safe hold now (report_dollars), for those who may see costs. */
  held: DollarsReport["held"] | null;
  /** day.close or accounting.post */
  canExchange: boolean;
  timezone: string;
}) {
  const { t } = useT();
  const at = (ts: string | null) => (ts ? dateTimeIn(timezone, ts) : "—");
  return (
    <div className="panel-b grid" style={{ gap: 14 }}>
      <div data-testid="fx-rate">
        {fx.rate === null ? (
          <strong className="red">{t("No dollar rate is set: dollars are not taken")}</strong>
        ) : (
          <>
            <strong>
              {t("{rate} dinars a dollar", { rate: fmtRate(fx.rate) })}
              {fx.usable ? "" : ` · ${t("too old: dollars are not taken")}`}
            </strong>
            <div className="muted" style={{ fontSize: ".82rem" }}>
              {t("Set {when} by {who}: {reason}", {
                when: at(fx.setAt),
                who: fx.setBy ?? "—",
                reason: fx.reason ?? "",
              })}
            </div>
          </>
        )}
        <div className="muted" style={{ fontSize: ".78rem" }}>
          {t(
            "A rate is used for {hours} hours; dollars are counted in dinars to the nearest {step}, and change is given in dinars.",
            { hours: fx.maxAgeHours, step: fmtIQD(fx.roundTo) },
          )}
        </div>
      </div>

      {fx.maySet && <SetRate current={fx.rate} />}

      {held && (
        <div data-testid="fx-held">
          <div className="sc">{t("Dollars held")}</div>
          <div style={{ fontSize: ".9rem" }}>
            {t("The safe: {usd} (taken at {amount})", {
              usd: fmtUSD(held.safe.usd),
              amount: fmtIQD(held.safe.value),
            })}
            {held.tills.map((x) => (
              <div key={x.locationId}>
                {t("{place}'s till: {usd} (taken at {amount})", {
                  place: x.location,
                  usd: fmtUSD(x.usd),
                  amount: fmtIQD(x.value),
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {canExchange && held && <Exchange held={held} />}

      {fx.history.length > 1 && (
        <details>
          <summary className="sc">{t("Rates set before")}</summary>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th className="right">{t("Dinars a dollar")}</th>
                  <th>{t("By")}</th>
                  <th>{t("Why")}</th>
                </tr>
              </thead>
              <tbody>
                {fx.history.map((h) => (
                  <tr key={h.setAt + h.rate}>
                    <td>{at(h.setAt)}</td>
                    <td className="right money">{fmtRate(h.rate)}</td>
                    <td>{h.setBy ?? "—"}</td>
                    <td>{h.reason}</td>
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

/** A manager sets today's rate, saying where it comes from. */
function SetRate({ current }: { current: number | null }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const typed = wholeNumber(rate);
  const ready = !busy && typeof typed === "number" && typed > 0 && reason.trim() !== "";

  function submit() {
    if (!ready || typeof typed !== "number") return;
    setMsg(null);
    start(async () => {
      const r = await op.run("setRate", (key) => setFxRateAction({ rate: typed, reason }, key));
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({
        ok: true,
        text: t("The rate is {rate} dinars a dollar.", { rate: fmtRate(r.data.rate) }),
      });
      setRate("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <form
      className="grid"
      style={{ gap: 8 }}
      data-testid="fx-set"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ minWidth: 150 }}>
          <div className="sc">{t("Today's rate: dinars a dollar")}</div>
          <input
            aria-label={t("Dinars a dollar")}
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="numeric"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={current === null ? "1310" : String(current)}
          />
        </label>
        <label style={{ flex: 1, minWidth: 220 }}>
          <div className="sc">{t("Where it comes from")}</div>
          <input
            aria-label={t("Where it comes from")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("The exchange office's rate this morning")}
          />
        </label>
        <button className="btn-primary" type="submit" disabled={!ready}>
          {busy ? t("Saving…") : t("Set the rate")}
        </button>
      </div>
      {rate.trim() !== "" && typed === null && (
        <span className="red" style={{ fontSize: ".8rem" }}>
          {t("A dollar is a whole number of dinars, from 100 to 100,000")}
        </span>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </form>
  );
}

/** Dollars exchanged for dinars: from the safe or a till, into the till, the safe or the bank. */
function Exchange({ held }: { held: DollarsReport["held"] }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [from, setFrom] = useState<From>("safe");
  const [to, setTo] = useState<To>("safe");
  const [usd, setUsd] = useState("");
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const u = wholeNumber(usd);
  const d = wholeNumber(received);
  const ready = !busy && typeof u === "number" && u > 0 && typeof d === "number" && d > 0;
  const tillUsd = held.tills.reduce((s, x) => s + x.usd, 0);

  function submit() {
    if (!ready || typeof u !== "number" || typeof d !== "number") return;
    setMsg(null);
    start(async () => {
      const r = await op.run("exchange", (key) =>
        exchangeDollarsAction({ from, usd: u, received: d, to, note }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      const x = r.data;
      setMsg({
        ok: true,
        text: `${t("{usd} exchanged for {received}: they were taken at {value}.", {
          usd: fmtUSD(x.usd),
          received: fmtIQD(x.received),
          value: fmtIQD(x.value),
        })} ${
          x.difference === 0
            ? ""
            : x.difference > 0
              ? t("A gain of {amount} (6950 Exchange differences, journal {journal}).", {
                  amount: fmtIQD(x.difference),
                  journal: x.journalNo ?? "—",
                })
              : t("A loss of {amount} (6950 Exchange differences, journal {journal}).", {
                  amount: fmtIQD(-x.difference),
                  journal: x.journalNo ?? "—",
                })
        }`.trim(),
      });
      setUsd("");
      setReceived("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form
      className="grid"
      style={{ gap: 8 }}
      data-testid="fx-exchange"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="sc">{t("Exchange dollars for dinars")}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ minWidth: 120 }}>
          <div className="sc">{t("From")}</div>
          <select
            aria-label={t("Dollars from")}
            value={from}
            onChange={(e) => setFrom(e.target.value as From)}
          >
            <option value="safe">
              {t(PLACES.safe)} · {fmtUSD(held.safe.usd)}
            </option>
            <option value="till">
              {t(PLACES.till)} · {fmtUSD(tillUsd)}
            </option>
          </select>
        </label>
        <label style={{ minWidth: 110 }}>
          <div className="sc">{t("Dollars")}</div>
          <input
            aria-label={t("Dollars exchanged")}
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="numeric"
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
            placeholder="$0"
          />
        </label>
        <label style={{ minWidth: 140 }}>
          <div className="sc">{t("Dinars received")}</div>
          <input
            aria-label={t("Dinars received")}
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="numeric"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            placeholder="0"
          />
        </label>
        <label style={{ minWidth: 120 }}>
          <div className="sc">{t("Into")}</div>
          <select
            aria-label={t("Dinars into")}
            value={to}
            onChange={(e) => setTo(e.target.value as To)}
          >
            {(Object.keys(PLACES) as To[]).map((k) => (
              <option key={k} value={k}>
                {t(PLACES[k])}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1, minWidth: 180 }}>
          <div className="sc">{t("Note (optional)")}</div>
          <input
            aria-label={t("Note (optional)")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="btn-primary" type="submit" disabled={!ready}>
          {busy ? t("Saving…") : t("Exchange")}
        </button>
      </div>
      {typeof u === "number" && u > 0 && typeof d === "number" && d > 0 && (
        <span className="muted" style={{ fontSize: ".8rem" }}>
          {t("{rate} dinars a dollar", { rate: fmtRate(Math.round((d / u) * 100) / 100) })}
        </span>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </form>
  );
}
