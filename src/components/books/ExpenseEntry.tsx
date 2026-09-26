"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewExpenseCategoryAction, recordExpenseAction } from "@/lib/actions/books";
import { fmtIQD } from "@/lib/format";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

interface Suggestion {
  accountCode: string;
  accountName: string;
  explanation: string;
  needsReview: boolean;
}

/**
 * Where the money came from (0024). From the till it leaves today's drawer.
 * Each label and account name is a phrase, shown through t().
 */
const PAID_FROM = {
  till: { code: "1000", name: "Cash in the till", label: "The till (today's drawer)" }, // i18n-ignore: shown through t()
  safe: { code: "1005", name: "Cash in the safe", label: "The safe" }, // i18n-ignore: shown through t()
  bank: { code: "1020", name: "Bank", label: "The bank" }, // i18n-ignore: shown through t()
  card: { code: "1010", name: "Card clearing", label: "A card" }, // i18n-ignore: shown through t()
  owner: { code: "3000", name: "Owner equity", label: "The owner, personally" }, // i18n-ignore: shown through t()
} as const;
type PaidFrom = keyof typeof PAID_FROM;

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
  // say: what the server answers (an account's name, the house rules' reason), in the reader's language.
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [paidFrom, setPaidFrom] = useState<PaidFrom | "">("");
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
      if (!paidFrom) return;
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
          text: t("Posted to {account} {name} (journal {no}).", {
            account,
            name: say(accountName),
            no: r.data.journalNo ?? "—",
          }),
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
          <div className="sc">{t("Narration")}</div>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t("September shop rent")}
            autoComplete="off"
          />
        </label>
        <label style={{ minWidth: 130 }}>
          <div className="sc">{t("Amount (IQD)")}</div>
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
          <div className="sc">{t("Date")}</div>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label style={{ minWidth: 150 }}>
          <div className="sc">{t("Paid from")}</div>
          <select
            aria-label={t("Paid from")}
            value={paidFrom}
            onChange={(e) => setPaidFrom(e.target.value as PaidFrom | "")}
          >
            <option value="">{t("Choose…")}</option>
            {(Object.keys(PAID_FROM) as PaidFrom[]).map((k) => (
              <option key={k} value={k}>
                {t(PAID_FROM[k].label)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 200 }}>
          <div className="sc">{t("Account")}</div>
          <select
            value={account}
            onChange={(e) => {
              setAccount(e.target.value);
              setChosenByHand(true);
            }}
          >
            <option value="">{t("Choose…")}</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} {say(a.name)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="grid"
        style={{
          // Side by side where both fit, one above the other on a phone.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
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
            {t("As it will be written")}
          </div>
          {!account ? (
            <div className="vempty">{t("Choose the account…")}</div>
          ) : (
            <>
              <div className="vline">
                <span className="dr">{t("Dr")}</span>
                <span className="acct">
                  <em>{account}</em>
                  {say(accountName)}
                </span>
                <span className="amt">{fmtIQD(value)}</span>
              </div>
              {paidFrom ? (
                <div className="vline credit">
                  <span className="dr">{t("Cr")}</span>
                  <span className="acct">
                    <em>{PAID_FROM[paidFrom].code}</em>
                    {t(PAID_FROM[paidFrom].name)}
                  </span>
                  <span className="amt">{fmtIQD(value)}</span>
                </div>
              ) : (
                <div className="vempty">{t("Choose where the money came from…")}</div>
              )}
              {desc.trim() && (
                <div className="vline" style={{ paddingBlockStart: 6 }}>
                  <span className="dr" />
                  <span className="acct faint" style={{ fontSize: ".74rem" }}>
                    {t("Being {text}", { text: desc.trim().toLowerCase() })}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="vfoot">
            <span>{value > 0 ? t("Balanced — debits equal credits") : t("Enter an amount")}</span>
          </div>
        </div>

        <div>
          {hint && (
            <p
              style={{ fontSize: ".8rem", marginBlockStart: 0, lineHeight: 1.6 }}
              className={hint.needsReview ? "red" : "muted"}
            >
              {say(hint.explanation)}
            </p>
          )}
          <button
            className="btn-primary"
            onClick={post}
            disabled={busy || !desc.trim() || value <= 0 || !account || !paidFrom}
          >
            {busy ? t("Posting…") : t("Post expense")}
          </button>
          <div style={{ marginBlockStart: 12 }}>
            <Notice msg={msg} />
          </div>
        </div>
      </div>
    </div>
  );
}
