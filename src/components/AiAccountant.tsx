"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  autoPostPendingAction,
  previewExpenseCategoryAction,
  recordExpenseAction,
  proposeCloseAction,
  approveCloseAction,
} from "@/lib/db/accounting-actions";
import { fmtIQD } from "@/lib/format";
import { Field, Notice, inputStyle } from "@/components/ui";

export interface AiOverview {
  revenue: number;
  cogs: number;
  otherExpenses: number;
  waste: number;
  netProfit: number;
  unpostedPurchases: number;
  unpostedWaste: number;
  trialBalanced: boolean;
  currentPeriodName: string;
  currentPeriodStatus: string | null;
}

interface Categorization {
  accountCode: string;
  accountName: string;
  confidence: number;
  explanation: string;
  needsReview: boolean;
}
interface CloseReport {
  overview: AiOverview & { grossProfit: number };
  review: { readyToClose: boolean; narrative: string; flags: string[] };
}

export function AiAccountant({ overview }: { overview: AiOverview }) {
  const locked = overview.currentPeriodStatus === "locked";
  const pending = overview.unpostedPurchases + overview.unpostedWaste;

  return (
    <div className="card grid" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>🤖 AI Accountant</h3>
        <span className="badge" title="Deterministic stand-in until a Claude API key is wired">
          🧪 Mock brain — swap-ready
        </span>
        <span className={`badge ${locked ? "err" : "ok"}`}>
          Period {overview.currentPeriodName} · {locked ? "locked" : "open"}
        </span>
      </div>
      <p className="muted" style={{ fontSize: ".85rem", margin: 0 }}>
        Level 2: routine entries are drafted and posted automatically; the month-end close waits for
        your approval. The engine builds every balanced entry and the database validates it — the AI
        only classifies, explains, and reviews. Every action is written to the audit log.
      </p>

      <AutoPost pending={pending} purchases={overview.unpostedPurchases} waste={overview.unpostedWaste} locked={locked} />
      <ExpenseEntry locked={locked} />
      <MonthEndClose overview={overview} locked={locked} />
    </div>
  );
}

function AutoPost({ pending, purchases, waste, locked }: { pending: number; purchases: number; waste: number; locked: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [details, setDetails] = useState<string[]>([]);

  function run() {
    setMsg(null);
    setDetails([]);
    start(async () => {
      const r = await autoPostPendingAction();
      if (r.ok) {
        setDetails(r.details ?? []);
        setMsg({ ok: true, text: `Posted ${r.purchases ?? 0} purchase and ${r.waste ?? 0} waste journal(s).` });
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong>Auto-post routine entries</strong>
          <div className="muted" style={{ fontSize: ".85rem" }}>
            {pending > 0
              ? `${purchases} purchase(s) and ${waste} waste movement(s) not yet journaled.`
              : "All purchases and waste are journaled."}
          </div>
        </div>
        <button className="btn-primary" onClick={run} disabled={busy || locked || pending === 0}>
          {busy ? "Posting…" : `Auto-post ${pending || ""}`.trim()}
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <Notice msg={msg} />
      </div>
      {details.length > 0 && (
        <ul className="muted" style={{ fontSize: ".82rem", margin: "8px 0 0", paddingInlineStart: 18 }}>
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExpenseEntry({ locked }: { locked: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<Categorization | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live AI category preview as the user types (debounced).
  useEffect(() => {
    if (!description.trim()) {
      setCat(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await previewExpenseCategoryAction(description, Number(amount) || 0);
      setCat(r);
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [description, amount]);

  function post() {
    setMsg(null);
    start(async () => {
      const r = await recordExpenseAction({ description, amount: Number(amount) });
      if (r.ok) {
        setMsg({ ok: true, text: `Posted to ${r.accountCode} ${r.accountName}.` });
        setDescription("");
        setAmount("");
        setCat(null);
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <strong>Record an expense</strong>
      <div className="muted" style={{ fontSize: ".85rem", marginBottom: 8 }}>
        Type what it was for — the AI picks the account and posts Dr expense / Cr cash.
      </div>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <Field label="Description">
          <input
            style={inputStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. August shop rent / electricity bill / barista wages"
          />
        </Field>
        <Field label="Amount (IQD)">
          <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </Field>
      </div>
      {cat && (
        <div
          className="badge"
          style={{ marginTop: 8, alignSelf: "start", whiteSpace: "normal", background: cat.needsReview ? "var(--surface-2)" : undefined }}
        >
          🤖 Suggests <strong>&nbsp;{cat.accountCode} {cat.accountName}</strong> · {Math.round(cat.confidence * 100)}% ·{" "}
          {cat.explanation}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <button className="btn-primary" onClick={post} disabled={busy || locked || !description.trim() || !Number(amount)}>
          {busy ? "Posting…" : "Post expense"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function MonthEndClose({ overview, locked }: { overview: AiOverview; locked: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [report, setReport] = useState<CloseReport | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function review() {
    setMsg(null);
    start(async () => {
      const r = await proposeCloseAction();
      if (r.ok) setReport({ overview: r.overview, review: r.review });
      else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }
  function approve() {
    setMsg(null);
    start(async () => {
      const r = await approveCloseAction();
      if (r.ok) {
        setMsg({ ok: true, text: `Period ${r.periodName} locked. Corrections now require reversing entries.` });
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong>Month-end close (your approval required)</strong>
        {locked ? (
          <span className="badge err">🔒 {overview.currentPeriodName} locked</span>
        ) : (
          <button onClick={review} disabled={busy}>
            {busy ? "Reviewing…" : "Review close"}
          </button>
        )}
      </div>

      {report && !locked && (
        <div style={{ marginTop: 10 }}>
          <table>
            <tbody>
              <tr>
                <td>Revenue</td>
                <td className="right mono">{fmtIQD(report.overview.revenue)}</td>
              </tr>
              <tr>
                <td className="muted">Cost of goods sold</td>
                <td className="right mono">−{fmtIQD(report.overview.cogs)}</td>
              </tr>
              <tr>
                <td className="muted">Other expenses + waste</td>
                <td className="right mono">−{fmtIQD(report.overview.otherExpenses + report.overview.waste)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Net profit</strong>
                </td>
                <td className="right mono" style={{ fontWeight: 700, color: report.overview.netProfit < 0 ? "var(--err)" : "var(--ok)" }}>
                  {fmtIQD(report.overview.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: ".9rem", margin: "8px 0" }}>{report.review.narrative}</p>
          {report.review.flags.length > 0 && (
            <ul style={{ margin: "6px 0", paddingInlineStart: 18 }}>
              {report.review.flags.map((f, i) => (
                <li key={i} style={{ color: "var(--warn)", fontSize: ".85rem" }}>
                  {f}
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
            <button
              className="btn-primary"
              onClick={approve}
              disabled={busy || !report.review.readyToClose}
              title={report.review.readyToClose ? "" : "Resolve the flags first"}
            >
              {busy ? "Locking…" : `✅ Approve & lock ${overview.currentPeriodName}`}
            </button>
            {!report.review.readyToClose && <span className="muted" style={{ fontSize: ".82rem" }}>Resolve flags to enable.</span>}
          </div>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
