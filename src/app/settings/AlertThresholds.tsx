"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAlertThresholdsAction } from "@/lib/actions/alerts";
import { thresholdChanges, type Threshold } from "@/lib/alerts";
import { Notice } from "@/components/ui";

const shown = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * The thresholds the alert rules use (0029): each empty box follows its
 * default. A change is on the audit trail as a change to the business.
 */
export function AlertThresholds({ thresholds }: { thresholds: Threshold[] }) {
  const router = useRouter();
  const initial = Object.fromEntries(
    thresholds.map((t) => [t.key, t.value === t.default ? "" : String(t.value)]),
  );
  const [typed, setTyped] = useState<Record<string, string>>(initial);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    const c = thresholdChanges(thresholds, typed);
    if (!c.ok) {
      setMsg({ ok: false, text: c.error });
      return;
    }
    if (Object.keys(c.changes).length === 0) {
      setMsg({ ok: true, text: "Nothing changed." });
      return;
    }
    start(async () => {
      const r = await setAlertThresholdsAction(c.changes);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: "Saved, and on the audit trail. The dashboard uses them now." });
      router.refresh();
    });
  }

  return (
    <form
      className="grid"
      style={{ gap: 12 }}
      data-testid="alert-thresholds"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="th-grid">
        {thresholds.map((t) => (
          <label key={t.key} style={{ display: "grid", gap: 4 }}>
            <span className="sc">{t.label}</span>
            <input
              inputMode="decimal"
              aria-label={t.label}
              value={typed[t.key] ?? ""}
              placeholder={shown(t.default)}
              onChange={(e) => setTyped({ ...typed, [t.key]: e.target.value })}
            />
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Default {shown(t.default)} · {shown(t.min)} to {shown(t.max)}
              {t.value !== t.default ? ` · now ${shown(t.value)}` : ""}
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save thresholds"}
        </button>
        <Notice msg={msg} />
      </div>
    </form>
  );
}
