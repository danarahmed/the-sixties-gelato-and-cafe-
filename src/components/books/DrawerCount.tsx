"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { countDrawerAction, moveCashAction } from "@/lib/actions/sales";
import { fmtIQD } from "@/lib/format";
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
      const head =
        v === 0
          ? "Counted — the drawer agrees exactly."
          : `Counted — ${fmtIQD(Math.abs(v))} ${v < 0 ? "short" : "over"}, posted to 6300 Cash over / short (journal ${r.data.journalNo ?? "—"}).`;
      const tail =
        r.data.taken > 0
          ? ` ${fmtIQD(r.data.taken)} to the ${r.data.takenTo}; ${fmtIQD(r.data.left)} stays in the drawer.`
          : ` ${fmtIQD(r.data.left)} stays in the drawer.`;
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
            <span className="sc">Cash in the drawer when trading began after the last close</span>
            <input
              aria-label="Cash when trading began"
              className="amt"
              style={{ textAlign: "end", maxWidth: 200 }}
              inputMode="decimal"
              value={startCash}
              onChange={(e) => setStartCash(e.target.value)}
              placeholder="0"
            />
            <span className="muted" style={{ fontSize: ".78rem" }}>
              Asked once: the days before were closed one at a time. From now on each count starts
              from what the last one left.
            </span>
          </label>
        ) : (
          line(
            since ? `In the drawer after the count of ${since}` : "In the drawer at the start",
            status.start ?? 0,
            "",
          )
        )}
        {line("Cash sales", status.cashSales, "+")}
        {line("Cash refunds", status.refunds, "−")}
        {line("Voided sales", status.voids, "−")}
        {line("Paid out of the till", status.paidOut, "−")}
        {line("Put into the till", status.cashIn, "+")}
        {line("Taken out of the till", status.cashOut, "−")}
        <div className="deduction-row" style={{ borderBlockStart: "1px solid var(--rule)" }}>
          <strong>The drawer should hold</strong>
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
          <div className="sc">Cash counted (IQD)</div>
          <input
            aria-label="Cash counted"
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0"
          />
        </label>
        <div style={{ minWidth: 130 }}>
          <div className="sc">Over / short</div>
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
          <div className="sc">Stays in the drawer</div>
          <input
            aria-label="Stays in the drawer"
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="all of it"
          />
        </label>
        {p.taken !== null && p.taken > 0 && (
          <label style={{ minWidth: 170 }}>
            <div className="sc">The other {fmtIQD(p.taken)} goes to</div>
            <select
              aria-label="Takings go to"
              value={takeTo}
              onChange={(e) => setTakeTo(e.target.value as "safe" | "bank")}
            >
              <option value="safe">the safe (1005)</option>
              <option value="bank">the bank (1020)</option>
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
          {busy ? "Counting…" : "Count the drawer"}
        </button>
      </div>
      {p.error && (
        <p className="red" style={{ fontSize: ".85rem", marginBlockEnd: 0 }}>
          {p.error}
        </p>
      )}
      {status.openBills > 0 && (
        <p className="red" style={{ fontSize: ".85rem", marginBlockEnd: 0 }}>
          {status.openBills} bill(s) from the till are still open. Take payment for them, or have a
          manager cancel them, on the <Link href="/pos">till</Link> before counting the drawer.
        </p>
      )}
      <p className="muted" style={{ fontSize: ".78rem", marginBlockEnd: 0 }}>
        {status.orders} sale(s) since the last count. Card ({fmtIQD(status.card)}) and platform (
        {fmtIQD(status.platform)}) takings are not in the drawer — they clear through 1010 and 1100.
        A sale after this count is in the next one.
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
        text: `Moved ${fmtIQD(Number(amount.replace(/[^0-9.]/g, "")) || 0)} from ${PLACES[from]} to ${PLACES[to]} (journal ${r.data.journalNo ?? "—"}).`,
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
          <div className="sc">From</div>
          <select
            aria-label="Cash from"
            value={from}
            onChange={(e) => setFrom(e.target.value as Place)}
          >
            {(Object.keys(PLACES) as Place[]).map((k) => (
              <option key={k} value={k}>
                {PLACES[k]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 130 }}>
          <div className="sc">To</div>
          <select aria-label="Cash to" value={to} onChange={(e) => setTo(e.target.value as Place)}>
            {(Object.keys(PLACES) as Place[])
              .filter((k) => k !== "owner" || isOwner)
              .map((k) => (
                <option key={k} value={k}>
                  {PLACES[k]}
                </option>
              ))}
          </select>
        </label>
        <label style={{ minWidth: 130 }}>
          <div className="sc">Amount (IQD)</div>
          <input
            aria-label="Amount to move"
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label style={{ flex: 1, minWidth: 180 }}>
          <div className="sc">{needsNote ? "What it is for (required)" : "Note (optional)"}</div>
          <input
            aria-label="What the cash is for"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={needsNote ? "Float for the till" : "Deposit at the bank"}
          />
        </label>
        <button
          onClick={submit}
          disabled={busy || from === to || !amount.trim() || (needsNote && !note.trim())}
        >
          {busy ? "Moving…" : "Move cash"}
        </button>
      </div>
      <p className="muted" style={{ fontSize: ".78rem", marginBlockEnd: 0 }}>
        The safe holds {fmtIQD(safe)} in the books. Neither the till nor the safe can pay out more
        than it holds.
      </p>
      <div style={{ marginBlockStart: 12 }}>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
