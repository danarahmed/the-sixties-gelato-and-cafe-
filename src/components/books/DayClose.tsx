"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeDayAction } from "@/lib/db/books-actions";
import { fmtIQD } from "@/lib/format";
import { Notice } from "@/components/ui";

/**
 * Day close: the till says what the day should have taken in cash; the count
 * says what it did. The difference is posted to Cash over/short — the number
 * worth watching in a café.
 */
export function DayClose({
  days,
  expectedByDay,
}: {
  days: string[];
  expectedByDay: Record<string, number>;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [day, setDay] = useState(days[0] ?? "");
  const [counted, setCounted] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const expected = expectedByDay[day] ?? 0;
  const countedNum = Number((counted || "").replace(/[^0-9-]/g, "")) || 0;
  const variance = counted === "" ? null : countedNum - Math.round(expected);

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await closeDayAction({ day, countedCash: countedNum });
      if (r.ok) {
        const v = r.variance ?? 0;
        setMsg({
          ok: true,
          text:
            v === 0
              ? "Day closed — the till agrees exactly."
              : `Day closed — ${fmtIQD(Math.abs(v))} ${v < 0 ? "short" : "over"}, posted to 6300 Cash over/short.`,
        });
        setCounted("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  if (days.length === 0) {
    return (
      <div className="panel-b">
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          No trading days recorded yet. Sales taken on the POS appear here as daily summaries.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-b">
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ minWidth: 150 }}>
          <div className="sc">Trading day</div>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
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
          <div className="sc">Till expects</div>
          <div className="money" style={{ fontSize: "1.05rem", paddingBlock: 6 }}>
            {fmtIQD(expected)}
          </div>
        </div>
        <div style={{ minWidth: 150 }}>
          <div className="sc">Over / short</div>
          <div
            className="money"
            style={{
              fontSize: "1.05rem",
              paddingBlock: 6,
              color: variance === null ? "var(--faint)" : variance === 0 ? "var(--ok)" : "var(--err)",
            }}
          >
            {variance === null ? "—" : `${variance > 0 ? "+" : ""}${fmtIQD(variance)}`}
          </div>
        </div>
        <button className="btn-primary" onClick={submit} disabled={busy || counted === ""}>
          {busy ? "Closing…" : "Close the day"}
        </button>
      </div>
      <div style={{ marginBlockStart: 12 }}>
        <Notice msg={msg} />
      </div>
      <p className="muted" style={{ fontSize: ".78rem", marginBlockEnd: 0 }}>
        A shortage is an expense (Dr 6300 / Cr Cash); an overage credits it back. Card and platform
        takings are not counted here — they clear through their own accounts.
      </p>
    </div>
  );
}
