"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postManualJournalAction } from "@/lib/db/books-actions";
import { fmtIQD } from "@/lib/format";
import { Notice } from "@/components/ui";

export interface AccountOption {
  code: string;
  name: string;
}

/** Manual double entry — the voucher must balance before it will post. */
export function JournalEntryForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [desc, setDesc] = useState("");
  const [dr, setDr] = useState(accounts[0]?.code ?? "");
  const [cr, setCr] = useState(accounts[1]?.code ?? "");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const value = Number((amount || "").replace(/[^0-9.]/g, "")) || 0;
  const label = (code: string) => {
    const a = accounts.find((x) => x.code === code);
    return a ? `${a.code} ${a.name}` : code;
  };
  const sameAccount = dr === cr;

  function post() {
    setMsg(null);
    start(async () => {
      const r = await postManualJournalAction({
        description: desc,
        debitCode: dr,
        creditCode: cr,
        amount: value,
      });
      if (r.ok) {
        setMsg({ ok: true, text: "Journal posted." });
        setDesc("");
        setAmount("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div className="panel-b">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: 2, minWidth: 200 }}>
          <div className="sc">Narration</div>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Being stock written down after the freezer fault"
            autoComplete="off"
          />
        </label>
        <label style={{ minWidth: 170 }}>
          <div className="sc">Debit account</div>
          <select value={dr} onChange={(e) => setDr(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 170 }}>
          <div className="sc">Credit account</div>
          <select value={cr} onChange={(e) => setCr(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
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
      </div>

      <div className="voucher" style={{ marginBlockStart: 16, maxWidth: 560 }}>
        {value <= 0 || sameAccount ? (
          <div className="vempty">
            {sameAccount ? "Debit and credit must be different accounts." : "Complete the lines above…"}
          </div>
        ) : (
          <>
            <div className="vline">
              <span className="dr">Dr</span>
              <span className="acct">{label(dr)}</span>
              <span className="amt">{fmtIQD(value)}</span>
            </div>
            <div className="vline credit">
              <span className="dr">Cr</span>
              <span className="acct">{label(cr)}</span>
              <span className="amt">{fmtIQD(value)}</span>
            </div>
            {desc.trim() && (
              <div className="vline" style={{ paddingBlockStart: 6 }}>
                <span className="dr" />
                <span className="acct faint" style={{ fontSize: ".74rem" }}>
                  {desc.trim()}
                </span>
              </div>
            )}
          </>
        )}
        <div className="vfoot">
          <span>
            {value > 0 && !sameAccount
              ? `Balanced — ${fmtIQD(value)} on both sides`
              : "Not yet balanced"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBlockStart: 12 }}>
        <button className="btn-primary" onClick={post} disabled={busy || value <= 0 || sameAccount}>
          {busy ? "Posting…" : "Post journal"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
