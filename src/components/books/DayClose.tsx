"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { closeDayAction } from "@/lib/actions/sales";
import { fmtIQD } from "@/lib/format";
import { normaliseNumber } from "@/lib/validation";
import { Notice } from "@/components/ui";
import type { DayTotals } from "@/lib/db/books";

/**
 * Day close: the till says what the drawer should hold (opening float + cash
 * sales − cash refunds, for that trading day in the business's timezone); the
 * count says what it does. The difference posts to 6300 Cash over/short, dated
 * on the day itself. Each day closes once, and a closed day can no longer have
 * its sales voided.
 */
export function DayClose({ totals }: { totals: DayTotals[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [day, setDay] = useState(totals[0]?.day ?? "");
  const [floatAmt, setFloatAmt] = useState("");
  const [counted, setCounted] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const t = totals.find((x) => x.day === day);
  const floatN = new Decimal(normaliseNumber(floatAmt) || "0").toNumber() || 0;
  const expected = (t ? t.cashSales - t.cashRefunds : 0) + floatN;
  const countedStr = normaliseNumber(counted);
  const variance =
    countedStr === "" || Number.isNaN(Number(countedStr)) ? null : Number(countedStr) - expected;

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await closeDayAction({ day, countedCash: counted, openingFloat: floatAmt || "0" });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      const v = r.data.variance;
      setMsg({
        ok: true,
        text:
          v === 0
            ? `${day} closed — the drawer agrees exactly.`
            : `${day} closed — ${fmtIQD(Math.abs(v))} ${v < 0 ? "short" : "over"}, posted to 6300 Cash over/short (journal ${r.data.journalNo ?? "—"}).`,
      });
      setCounted("");
      setFloatAmt("");
      router.refresh();
    });
  }

  if (totals.length === 0) {
    return (
      <div className="panel-b">
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          Every trading day is closed.
        </p>
        {/* The confirmation outlives the refresh that removed the last open day. */}
        <div style={{ marginBlockStart: 12 }}>
          <Notice msg={msg} />
        </div>
      </div>
    );
  }

  return (
    <div className="panel-b">
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ minWidth: 150 }}>
          <div className="sc">Trading day</div>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {totals.map((d) => (
              <option key={d.day} value={d.day}>
                {d.day} · {d.orders} sale(s)
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 130 }}>
          <div className="sc">Opening float</div>
          <input
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={floatAmt}
            onChange={(e) => setFloatAmt(e.target.value)}
            placeholder="0"
          />
        </label>
        <label style={{ minWidth: 150 }}>
          <div className="sc">Cash counted (IQD)</div>
          <input
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0"
          />
        </label>
        <div style={{ minWidth: 150 }}>
          <div className="sc">Drawer should hold</div>
          <div className="money" style={{ fontSize: "1.05rem", paddingBlock: 6 }}>
            {fmtIQD(expected)}
          </div>
        </div>
        <div style={{ minWidth: 130 }}>
          <div className="sc">Over / short</div>
          <div
            className="money"
            style={{
              fontSize: "1.05rem",
              paddingBlock: 6,
              color:
                variance === null ? "var(--faint)" : variance === 0 ? "var(--ok)" : "var(--err)",
            }}
          >
            {variance === null ? "—" : `${variance > 0 ? "+" : ""}${fmtIQD(variance)}`}
          </div>
        </div>
        <button className="btn-primary" onClick={submit} disabled={busy || counted === "" || !day}>
          {busy ? "Closing…" : "Close the day"}
        </button>
      </div>
      {t && (
        <p className="muted" style={{ fontSize: ".78rem", marginBlockEnd: 0 }}>
          Cash sales {fmtIQD(t.cashSales)} − cash refunds {fmtIQD(t.cashRefunds)}. Card (
          {fmtIQD(t.card)}) and platform ({fmtIQD(t.platform)}) takings are not in the drawer — they
          clear through 1010 and 1100.
        </p>
      )}
      <div style={{ marginBlockStart: 12 }}>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
