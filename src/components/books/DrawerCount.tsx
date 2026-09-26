"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { countDrawerAction, moveCashAction } from "@/lib/actions/sales";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Rich } from "@/lib/i18n/Rich";
import { Notice } from "@/components/ui";
import type { DrawerStatus } from "@/lib/db/books";
import { drawerPreview } from "./drawerMath";

type Msg = { ok: boolean; text: string } | null;

/**
 * Count the drawer (0024). The count covers every movement of cash since the
 * last one, whatever the day: the café trades past midnight, so a night's
 * drawer holds two calendar days. After counting, say how much stays in the
 * drawer for next time; the rest goes to the safe or the bank, and the next
 * count starts from what stayed.
 */
export function DrawerCount({ status, since }: { status: DrawerStatus; since: string | null }) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [startCash, setStartCash] = useState("");
  const [counted, setCounted] = useState("");
  const [left, setLeft] = useState(
    status.start !== null && status.start > 0 ? String(status.start) : "",
  );
  const [takeTo, setTakeTo] = useState<"safe" | "bank">("safe");
  const [msg, setMsg] = useState<Msg>(null);

  const p = drawerPreview({
    start: status.needsStart ? null : status.start,
    startTyped: startCash,
    moved: status.moved,
    counted,
    left,
  });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await countDrawerAction({
        counted,
        left: left.trim() === "" ? null : left,
        takeTo: p.taken && p.taken > 0 ? takeTo : null,
        startCash: status.needsStart ? startCash : null,
      });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      const v = r.data.variance;
      const posted = { amount: fmtIQD(Math.abs(v)), journal: r.data.journalNo ?? "—" };
      const head =
        v === 0
          ? t("Counted — the drawer agrees exactly.")
          : v < 0
            ? t(
                "Counted — {amount} short, posted to 6300 Cash over / short (journal {journal}).",
                posted,
              )
            : t(
                "Counted — {amount} over, posted to 6300 Cash over / short (journal {journal}).",
                posted,
              );
      const tail =
        r.data.taken > 0
          ? ` ${t("{taken} to the {place}; {left} stays in the drawer.", {
              taken: fmtIQD(r.data.taken),
              place: t(String(r.data.takenTo)),
              left: fmtIQD(r.data.left),
            })}`
          : ` ${t("{left} stays in the drawer.", { left: fmtIQD(r.data.left) })}`;
      setMsg({ ok: true, text: head + tail });
      setCounted("");
      setStartCash("");
      router.refresh();
    });
  }

  const line = (label: string, value: number, sign: "+" | "−" | "") =>
    value === 0 && sign !== "" ? null : (
      <div className="deduction-row" key={label}>
        <span>
          {sign && <span className="muted">{sign} </span>}
          {label}
        </span>
        <span className="mono">{fmtIQD(value)}</span>
      </div>
    );

  return (
    <div className="panel-b" data-testid="drawer-count">
      <div className="grid" style={{ gap: 4, maxWidth: 520 }}>
        {status.needsStart ? (
          <label style={{ display: "grid", gap: 4, marginBlockEnd: 6 }}>
            <span className="sc">
              {t("Cash in the drawer when trading began after the last close")}
            </span>
            <input
              aria-label={t("Cash when trading began")}
              className="amt"
              style={{ textAlign: "end", maxWidth: 200 }}
              inputMode="decimal"
              value={startCash}
              onChange={(e) => setStartCash(e.target.value)}
              placeholder="0"
            />
            <span className="muted" style={{ fontSize: ".78rem" }}>
              {t(
                "Asked once: the days before were closed one at a time. From now on each count starts from what the last one left.",
              )}
            </span>
          </label>
        ) : (
          line(
            since
              ? t("In the drawer after the count of {when}", { when: since })
              : t("In the drawer at the start"),
            status.start ?? 0,
            "",
          )
        )}
        {line(t("Cash sales"), status.cashSales, "+")}
        {line(t("Cash refunds"), status.refunds, "−")}
        {line(t("Voided sales"), status.voids, "−")}
        {line(t("Paid out of the till"), status.paidOut, "−")}
        {line(t("Put into the till"), status.cashIn, "+")}
        {line(t("Taken out of the till"), status.cashOut, "−")}
        <div className="deduction-row" style={{ borderBlockStart: "1px solid var(--rule)" }}>
          <strong>{t("The drawer should hold")}</strong>
          <strong className="mono" data-testid="drawer-expected">
            {p.expected === null ? "—" : fmtIQD(p.expected)}
          </strong>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBlockStart: 14,
        }}
      >
        <label style={{ minWidth: 150 }}>
          <div className="sc">{t("Cash counted (IQD)")}</div>
          <input
            aria-label={t("Cash counted")}
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0"
          />
        </label>
        <div style={{ minWidth: 130 }}>
          <div className="sc">{t("Over / short")}</div>
          <div
            className="money"
            style={{
              fontSize: "1.05rem",
              paddingBlock: 6,
              color:
                p.variance === null
                  ? "var(--faint)"
                  : p.variance === 0
                    ? "var(--ok)"
                    : "var(--err)",
            }}
          >
            {p.variance === null ? "—" : `${p.variance > 0 ? "+" : ""}${fmtIQD(p.variance)}`}
          </div>
        </div>
        <label style={{ minWidth: 170 }}>
          <div className="sc">{t("Stays in the drawer")}</div>
          <input
            aria-label={t("Stays in the drawer")}
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder={t("all of it")}
          />
        </label>
        {p.taken !== null && p.taken > 0 && (
          <label style={{ minWidth: 170 }}>
            <div className="sc">{t("The other {amount} goes to", { amount: fmtIQD(p.taken) })}</div>
            <select
              aria-label={t("Takings go to")}
              value={takeTo}
              onChange={(e) => setTakeTo(e.target.value as "safe" | "bank")}
            >
              <option value="safe">{t("the safe (1005)")}</option>
              <option value="bank">{t("the bank (1020)")}</option>
            </select>
          </label>
        )}
        <button
          className="btn-primary"
          onClick={submit}
          disabled={
            busy ||
            counted.trim() === "" ||
            p.error !== null ||
            status.openBills > 0 ||
            (status.needsStart && startCash.trim() === "")
          }
        >
          {busy ? t("Counting…") : t("Count the drawer")}
        </button>
      </div>
      {p.error && (
        <p className="red" style={{ fontSize: ".85rem", marginBlockEnd: 0 }}>
          {say(p.error)}
        </p>
      )}
      {status.openBills > 0 && (
        <p className="red" style={{ fontSize: ".85rem", marginBlockEnd: 0 }}>
          <Rich
            text={t(
              "{n} bill(s) from the till are still open. Take payment for them, or have a manager cancel them, on the <till>till</till> before counting the drawer.",
              { n: status.openBills },
            )}
            tags={{ till: (c) => <Link href="/pos">{c}</Link> }}
          />
        </p>
      )}
      <p className="muted" style={{ fontSize: ".78rem", marginBlockEnd: 0 }}>
        {t(
          "{n} sale(s) since the last count. Card ({card}) and platform ({platform}) takings are not in the drawer — they clear through 1010 and 1100. A sale after this count is in the next one.",
          { n: status.orders, card: fmtIQD(status.card), platform: fmtIQD(status.platform) },
        )}
      </p>
      <div style={{ marginBlockStart: 12 }}>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

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
      const r = await moveCashAction({ from, to, amount, note });
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
        <Notice msg={msg} />
      </div>
    </div>
  );
}
