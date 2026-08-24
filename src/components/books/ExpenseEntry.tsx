"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewExpenseCategoryAction, recordExpenseAction } from "@/lib/db/accounting-actions";
import { fmtIQD } from "@/lib/format";
import { Notice } from "@/components/ui";

interface Cat {
  accountCode: string;
  accountName: string;
  confidence: number;
  explanation: string;
  needsReview: boolean;
}

/**
 * Write an expense in plain words; the account is proposed from the narration
 * and the entry is shown exactly as it will be written in the book before it
 * is posted.
 */
export function ExpenseEntry() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<Cat | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const value = Number((amount || "").replace(/[^0-9.]/g, "")) || 0;

  useEffect(() => {
    if (!desc.trim()) {
      setCat(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setCat(await previewExpenseCategoryAction(desc, value));
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [desc, value]);

  function post() {
    setMsg(null);
    start(async () => {
      const r = await recordExpenseAction({ description: desc, amount: value });
      if (r.ok) {
        setMsg({ ok: true, text: `Posted to ${r.accountCode} ${r.accountName}.` });
        setDesc("");
        setAmount("");
        setCat(null);
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div className="panel-b">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: 2, minWidth: 220 }}>
          <div className="sc">Narration</div>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="August shop rent"
            autoComplete="off"
          />
        </label>
        <label style={{ minWidth: 140 }}>
          <div className="sc">Amount (IQD)</div>
          <input
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label style={{ minWidth: 150 }}>
          <div className="sc">Paid through</div>
          <select disabled>
            <option>1000 Cash on hand</option>
          </select>
        </label>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "minmax(280px, 1fr) minmax(240px, 1fr)", marginBlockStart: 16 }}
      >
        <div className="voucher">
          <div className="sc" style={{ borderBlockEnd: "1px solid var(--rule)", paddingBlockEnd: 6, marginBlockEnd: 8 }}>
            As it will be written
          </div>
          {!cat ? (
            <div className="vempty">Awaiting narration…</div>
          ) : (
            <>
              <div className="vline">
                <span className="dr">Dr</span>
                <span className="acct">
                  <em>{cat.accountCode}</em>
                  {cat.accountName}
                </span>
                <span className="amt">{fmtIQD(value)}</span>
              </div>
              <div className="vline credit">
                <span className="dr">Cr</span>
                <span className="acct">
                  <em>1000</em>Cash on hand
                </span>
                <span className="amt">{fmtIQD(value)}</span>
              </div>
              <div className="vline" style={{ paddingBlockStart: 6 }}>
                <span className="dr" />
                <span className="acct faint" style={{ fontSize: ".74rem" }}>
                  Being {desc.trim().toLowerCase()}
                </span>
              </div>
            </>
          )}
          <div className="vfoot">
            <span>{value > 0 ? "Balanced — debits equal credits" : "Enter an amount to balance"}</span>
            {cat && (
              <span className={cat.needsReview ? "red" : ""}>
                {cat.needsReview ? "Low confidence — confirm the account" : "Classified with confidence"}
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="muted" style={{ fontSize: ".78rem", marginBlockStart: 0, lineHeight: 1.7 }}>
            Classification is assisted and always reviewable: “rent” finds 6000, “wages” finds 6100,
            “electricity” finds 6200. Anything it cannot place is flagged for you. Nothing reaches the
            ledger unless debits equal credits.
          </p>
          <button className="btn-primary" onClick={post} disabled={busy || !desc.trim() || value <= 0}>
            {busy ? "Posting…" : "Post expense"}
          </button>
          <div style={{ marginBlockStart: 12 }}>
            <Notice msg={msg} />
          </div>
        </div>
      </div>
    </div>
  );
}
