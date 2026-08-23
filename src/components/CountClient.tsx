"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitCountAction } from "@/lib/db/actions";
import { Notice, inputStyle } from "@/components/ui";

interface CountRow {
  itemId: string;
  name: string;
  unit: string;
  expectedBase: number;
}

export function CountClient({ rows }: { rows: CountRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);

  function submit() {
    setMsg(null);
    const lines = rows
      .filter((r) => counted[r.itemId] !== undefined && counted[r.itemId] !== "")
      .map((r) => ({ itemId: r.itemId, expectedBase: r.expectedBase, countedBase: Number(counted[r.itemId]) }));
    if (lines.length === 0) {
      setMsg({ ok: false, text: "Enter at least one counted quantity." });
      return;
    }
    start(async () => {
      const r = await submitCountAction({ lines });
      if (r.ok) {
        setRevealed(true);
        setMsg({ ok: true, text: `Count posted — ${r.adjusted ?? 0} adjustment movement(s) written.` });
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Blind count</h3>
        <span className="muted" style={{ fontSize: ".82rem" }}>
          {revealed ? "Expected quantities revealed" : "Expected quantities are hidden while counting"}
        </span>
      </div>
      <table style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th className="right">Counted</th>
            {revealed && <th className="right">Expected</th>}
            {revealed && <th className="right">Variance</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = counted[r.itemId];
            const delta = c !== undefined && c !== "" ? Number(c) - r.expectedBase : null;
            return (
              <tr key={r.itemId}>
                <td>
                  {r.name} <span className="muted">({r.unit})</span>
                </td>
                <td className="right">
                  <input
                    style={{ ...inputStyle, width: 120, textAlign: "right" }}
                    value={c ?? ""}
                    onChange={(e) => setCounted({ ...counted, [r.itemId]: e.target.value })}
                    inputMode="decimal"
                    placeholder="—"
                  />
                </td>
                {revealed && <td className="right mono">{r.expectedBase.toLocaleString()}</td>}
                {revealed && (
                  <td className="right mono" style={{ color: delta == null ? undefined : delta < 0 ? "var(--err)" : delta > 0 ? "var(--ok)" : undefined }}>
                    {delta == null ? "" : `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <button className="btn-primary" onClick={submit} disabled={pending}>
          {pending ? "Posting…" : "Submit count & post adjustments"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
