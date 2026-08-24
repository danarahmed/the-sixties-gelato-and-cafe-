"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoPostPendingAction, proposeCloseAction, approveCloseAction } from "@/lib/db/accounting-actions";
import { fmtIQD } from "@/lib/format";
import { Notice } from "@/components/ui";

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

interface CloseReport {
  overview: AiOverview & { grossProfit: number };
  review: { readyToClose: boolean; narrative: string; flags: string[] };
}

/**
 * Carrying forward and closing the period. Routine entries are drafted and
 * posted for you; closing the books is yours to approve.
 */
export function AiAccountant({ overview }: { overview: AiOverview }) {
  const locked = overview.currentPeriodStatus === "locked";
  const pending = overview.unpostedPurchases + overview.unpostedWaste;

  return (
    <section className="panel">
      <div className="panel-h">
        <h3>Carrying Forward &amp; Closing</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          Routine entries are drafted for you; closing the period is yours to approve
        </span>
      </div>
      <div className="panel-b" style={{ display: "grid", gap: 18 }}>
        <AutoPost
          pending={pending}
          purchases={overview.unpostedPurchases}
          waste={overview.unpostedWaste}
          locked={locked}
        />
        <PeriodClose overview={overview} locked={locked} />
      </div>
    </section>
  );
}

function AutoPost({
  pending,
  purchases,
  waste,
  locked,
}: {
  pending: number;
  purchases: number;
  waste: number;
  locked: boolean;
}) {
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
        setMsg({
          ok: true,
          text: `Carried ${r.purchases ?? 0} purchase and ${r.waste ?? 0} waste entr(ies) to the ledger.`,
        });
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: ".92rem" }}>Entries awaiting the ledger</strong>
          <div className="muted" style={{ fontSize: ".78rem" }}>
            {pending > 0
              ? `${purchases} purchase(s) and ${waste} waste movement(s) not yet journaled.`
              : "Every purchase and write-off has been carried to the ledger."}
          </div>
        </div>
        <button className="btn-primary" onClick={run} disabled={busy || locked || pending === 0}>
          {busy ? "Posting…" : pending > 0 ? `Carry ${pending} forward` : "Nothing to carry"}
        </button>
      </div>
      {details.length > 0 && (
        <ul className="muted" style={{ fontSize: ".76rem", margin: "8px 0 0", paddingInlineStart: 18 }}>
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      <div style={{ marginBlockStart: 8 }}>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

function PeriodClose({ overview, locked }: { overview: AiOverview; locked: boolean }) {
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
        setMsg({
          ok: true,
          text: `${r.periodName} is closed. Corrections now require a reversing entry.`,
        });
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div style={{ borderBlockStart: "1px solid var(--border)", paddingBlockStart: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: ".92rem" }}>Close {overview.currentPeriodName}</strong>
          <div className="muted" style={{ fontSize: ".78rem" }}>
            Locking the period seals it — nothing further may be posted into it.
          </div>
        </div>
        {locked ? (
          <span className="badge err">{overview.currentPeriodName} locked</span>
        ) : (
          <button onClick={review} disabled={busy}>
            {busy ? "Reviewing…" : "Review the close"}
          </button>
        )}
      </div>

      {report && !locked && (
        <div style={{ marginBlockStart: 14, maxWidth: 560 }}>
          <div className="st-row">
            <span className="lbl">Net revenue</span>
            <span className="amt">{fmtIQD(report.overview.revenue)}</span>
          </div>
          <div className="st-row">
            <span className="lbl">Cost of goods sold</span>
            <span className="amt red">({fmtIQD(report.overview.cogs)})</span>
          </div>
          <div className="st-row">
            <span className="lbl">Operating expenses &amp; waste</span>
            <span className="amt red">
              ({fmtIQD(report.overview.otherExpenses + report.overview.waste)})
            </span>
          </div>
          <div className="rule-single" />
          <div className="st-row total">
            <span className="lbl">Net {report.overview.netProfit < 0 ? "loss" : "profit"}</span>
            <span className={`amt ${report.overview.netProfit < 0 ? "red" : ""}`}>
              {fmtIQD(report.overview.netProfit)}
            </span>
          </div>
          <div className="rule-double" />

          <p style={{ fontSize: ".84rem", margin: "12px 0 8px" }}>{report.review.narrative}</p>
          {report.review.flags.length > 0 && (
            <ul style={{ margin: "6px 0", paddingInlineStart: 18 }}>
              {report.review.flags.map((f, i) => (
                <li key={i} style={{ color: "var(--warn)", fontSize: ".8rem" }}>
                  {f}
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBlockStart: 10 }}>
            <button
              className="btn-primary"
              onClick={approve}
              disabled={busy || !report.review.readyToClose}
              title={report.review.readyToClose ? "" : "Resolve the flags first"}
            >
              {busy ? "Closing…" : `Approve and close ${overview.currentPeriodName}`}
            </button>
            {!report.review.readyToClose && (
              <span className="muted" style={{ fontSize: ".76rem" }}>
                Resolve the points above to enable.
              </span>
            )}
          </div>
        </div>
      )}
      <div style={{ marginBlockStart: 10 }}>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
