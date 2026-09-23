"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewExpenseCategoryAction, recordExpenseAction } from "@/lib/actions/books";
import { fmtIQD } from "@/lib/format";
import { normaliseNumber } from "@/lib/validation";
import { Notice } from "@/components/ui";

interface Suggestion {
  accountCode: string;
  accountName: string;
  explanation: string;
  needsReview: boolean;
}

const PAID_FROM = {
  cash: { code: "1000", name: "Cash on hand" },
  card: { code: "1010", name: "Card clearing" },
  bank: { code: "1020", name: "Bank" },
} as const;

/**
 * Write the expense in plain words. The house rules PROPOSE an account from
 * the narration; the person sees the entry exactly as it will be written and
 * can change the account before posting. Nothing is posted on a guess.
 */
export function ExpenseEntry({
  accounts,
  today,
}: {
  accounts: { code: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [paidFrom, setPaidFrom] = useState<keyof typeof PAID_FROM>("cash");
  const [account, setAccount] = useState("");
  const [chosenByHand, setChosenByHand] = useState(false);
  const [hint, setHint] = useState<Suggestion | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const value = Number(normaliseNumber(amount)) || 0;
  const accountName = accounts.find((a) => a.code === account)?.name ?? "";

  useEffect(() => {
    if (!desc.trim()) {
      setHint(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const s = await previewExpenseCategoryAction(desc, value);
      setHint(s);
      if (!chosenByHand && accounts.some((a) => a.code === s.accountCode))
        setAccount(s.accountCode);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [desc, value, chosenByHand, accounts]);

  function post() {
    setMsg(null);
    start(async () => {
      const r = await recordExpenseAction({
        description: desc,
        amount,
        accountCode: account,
        paidFrom,
        date,
      });
      if (r.ok) {
        setMsg({
          ok: true,
          text: `Posted to ${account} ${accountName} (journal ${r.data.journalNo ?? "—"}).`,
        });
        setDesc("");
        setAmount("");
        setAccount("");
        setChosenByHand(false);
        setHint(null);
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
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
            placeholder="September shop rent"
            autoComplete="off"
          />
        </label>
        <label style={{ minWidth: 130 }}>
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
        <label style={{ minWidth: 140 }}>
          <div className="sc">Date</div>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label style={{ minWidth: 150 }}>
          <div className="sc">Paid from</div>
          <select
            value={paidFrom}
            onChange={(e) => setPaidFrom(e.target.value as keyof typeof PAID_FROM)}
          >
            {Object.entries(PAID_FROM).map(([k, a]) => (
              <option key={k} value={k}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 200 }}>
          <div className="sc">Account</div>
          <select
            value={account}
            onChange={(e) => {
              setAccount(e.target.value);
              setChosenByHand(true);
            }}
          >
            <option value="">Choose…</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "minmax(280px, 1fr) minmax(240px, 1fr)",
          marginBlockStart: 16,
        }}
      >
        <div className="voucher">
          <div
            className="sc"
            style={{
              borderBlockEnd: "1px solid var(--rule)",
              paddingBlockEnd: 6,
              marginBlockEnd: 8,
            }}
          >
            As it will be written
          </div>
          {!account ? (
            <div className="vempty">Choose the account…</div>
          ) : (
            <>
              <div className="vline">
                <span className="dr">Dr</span>
                <span className="acct">
                  <em>{account}</em>
                  {accountName}
                </span>
                <span className="amt">{fmtIQD(value)}</span>
              </div>
              <div className="vline credit">
                <span className="dr">Cr</span>
                <span className="acct">
                  <em>{PAID_FROM[paidFrom].code}</em>
                  {PAID_FROM[paidFrom].name}
                </span>
                <span className="amt">{fmtIQD(value)}</span>
              </div>
              {desc.trim() && (
                <div className="vline" style={{ paddingBlockStart: 6 }}>
                  <span className="dr" />
                  <span className="acct faint" style={{ fontSize: ".74rem" }}>
                    Being {desc.trim().toLowerCase()}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="vfoot">
            <span>{value > 0 ? "Balanced — debits equal credits" : "Enter an amount"}</span>
          </div>
        </div>

        <div>
          {hint && (
            <p
              style={{ fontSize: ".8rem", marginBlockStart: 0, lineHeight: 1.6 }}
              className={hint.needsReview ? "red" : "muted"}
            >
              {hint.explanation}
            </p>
          )}
          <button
            className="btn-primary"
            onClick={post}
            disabled={busy || !desc.trim() || value <= 0 || !account}
          >
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
