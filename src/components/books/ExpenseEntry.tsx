"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExpensePrefill } from "@/lib/bank";
import type { CashOnHand } from "@/lib/cash";
import {
  previewExpenseCategoryAction,
  recordExpenseAction,
  recordPrepaidExpenseAction,
} from "@/lib/actions/books";
import { fmtIQD } from "@/lib/format";
import { addMonths, prepaidRefusal, prepaidShares } from "@/lib/prepaid";
import { samePayments, type PostedPayment } from "@/lib/expenses";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { CashOnHandNote } from "@/components/cash/CashOnHandNote";
import { SamePaymentNote } from "@/components/books/SamePaymentNote";
import { OperationStatus, useOperation } from "@/components/useOperation";

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
  // A card payment comes out of the bank (0030): 1010 holds only the till's card takings.
  card: { code: "1020", name: "Bank", label: "A card" }, // i18n-ignore: shown through t()
  owner: { code: "3000", name: "Owner equity", label: "The owner, personally" }, // i18n-ignore: shown through t()
} as const;
type PaidFrom = keyof typeof PAID_FROM;

/**
 * Write the expense in plain words. The house rules PROPOSE an account from
 * the narration; the person sees the entry exactly as it will be written and
 * can change the account before posting. Nothing is posted on a guess.
 *
 * Opened from the bank's statement, a charge the books don't have yet comes
 * filled in (its words, amount, day, paid from the bank), with the way back.
 *
 * Paid from the safe or the till, the form says what it holds (AK).
 *
 * Paid ahead for months to come (next month's rent, a year's insurance), it
 * goes into Prepaid expenses and each month it covers takes its share as an
 * expense of that month (0060): the form shows the shares before anything is
 * posted, and is an ordinary expense's again once it is.
 *
 * One like a payment posted in the three days around it (the same account, the
 * same amount) is asked about before it is posted: the person ticks that it
 * is another payment (the September audit's P2-14, rent posted twice).
 */
export function ExpenseEntry({
  accounts,
  today,
  prefill = null,
  cash = null,
  paid = [],
}: {
  accounts: { code: string; name: string }[];
  today: string;
  prefill?: ExpensePrefill | null;
  cash?: CashOnHand | null;
  /** What was paid lately: one like it is asked about (P2-14). */
  paid?: PostedPayment[];
}) {
  const op = useOperation();
  // say: what the server answers (an account's name, the house rules' reason), in the reader's language.
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [desc, setDesc] = useState(prefill?.description ?? "");
  const [amount, setAmount] = useState(prefill?.amount ?? "");
  const [date, setDate] = useState(prefill?.date ?? today);
  const [paidFrom, setPaidFrom] = useState<PaidFrom | "">(prefill?.paidFrom ?? "");
  const [posted, setPosted] = useState(false);
  const [account, setAccount] = useState("");
  const [chosenByHand, setChosenByHand] = useState(false);
  const [hint, setHint] = useState<Suggestion | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Paid ahead: from this month, or one of the twelve after it (0060).
  const thisMonth = today.slice(0, 7);
  const [ahead, setAhead] = useState(false);
  const [firstMonth, setFirstMonth] = useState(thisMonth);
  const [months, setMonths] = useState("12");

  const value = Number(normaliseNumber(amount)) || 0;
  const accountName = accounts.find((a) => a.code === account)?.name ?? "";
  const monthCount = Number(normaliseNumber(months)) || 0;
  // Why it cannot be paid ahead as it stands, as the database would say; else its shares.
  const refusal =
    ahead && value > 0 ? prepaidRefusal(value, monthCount, firstMonth, thisMonth) : null;
  const shares = ahead && !refusal ? prepaidShares(value, monthCount, firstMonth) : [];
  const first = shares[0];
  const last = shares[shares.length - 1];
  // A payment like it posted already, as typed, and any the server found since
  // the page opened: posted only once the person says it is another.
  const [acceptedFor, setAcceptedFor] = useState<string | null>(null);
  const [serverSame, setServerSame] = useState<{ key: string; same: PostedPayment[] } | null>(null);
  const payDate = ahead ? today : date;
  const fieldsKey = `${account}|${value}|${payDate}`;
  const typedSame = samePayments(paid, { accountCode: account, amount: value, date: payDate });
  const same =
    serverSame?.key === fieldsKey
      ? [
          ...typedSame,
          ...serverSame.same.filter(
            (x) => !typedSame.some((y) => y.journalNo === x.journalNo && y.date === x.date),
          ),
        ]
      : typedSame;
  const sameKey = `${fieldsKey}|${same.map((x) => `${x.journalNo}`).join(",")}`;
  const acceptSame = same.length > 0 && acceptedFor === sameKey;

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

  /** Posted: say so, and clear the form for the next one. */
  function done(text: string) {
    setMsg({ ok: true, text });
    setDesc("");
    setAmount("");
    setAccount("");
    setChosenByHand(false);
    setHint(null);
    setPosted(true);
    setAcceptedFor(null);
    setServerSame(null);
    router.refresh();
  }

  /** Not posted: say why, and show the payments like it the server found. */
  function refused(r: { error: string; same?: PostedPayment[] }, key: string) {
    if (r.same) setServerSame({ key, same: r.same });
    setMsg({ ok: false, text: r.error });
  }

  function post() {
    setMsg(null);
    setPosted(false);
    start(async () => {
      if (!paidFrom) return;
      if (ahead) {
        const r = await op.run("recordPrepaidExpense", (key, resend) =>
          recordPrepaidExpenseAction(
            {
              description: desc,
              amount,
              accountCode: account,
              paidFrom,
              firstMonth,
              months: monthCount,
              acceptSame,
            },
            key,
            resend,
          ),
        );
        if (r.ok)
          done(
            [
              monthCount === 1
                ? t("Paid into Prepaid expenses (journal {no}): one month, {first}.", {
                    no: r.data.journalNo ?? "—",
                    first: firstMonth,
                  })
                : t("Paid into Prepaid expenses (journal {no}): {n} months, {first} to {last}.", {
                    no: r.data.journalNo ?? "—",
                    n: monthCount,
                    first: firstMonth,
                    last: addMonths(firstMonth, monthCount - 1),
                  }),
              r.data.released > 0 ? t("This month's share is posted as an expense.") : "",
            ]
              .filter(Boolean)
              .join(" "),
          );
        else refused(r, fieldsKey);
        // The next one is an ordinary expense unless it is ticked again.
        if (r.ok) {
          setAhead(false);
          setFirstMonth(thisMonth);
          setMonths("12");
        }
        return;
      }
      const r = await op.run("recordExpense", (key, resend) =>
        recordExpenseAction(
          {
            description: desc,
            amount,
            accountCode: account,
            paidFrom,
            date,
            acceptSame,
          },
          key,
          resend,
        ),
      );
      if (r.ok)
        done(
          t("Posted to {account} {name} (journal {no}).", {
            account,
            name: say(accountName),
            no: r.data.journalNo ?? "—",
          }),
        );
      else refused(r, fieldsKey);
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
        {ahead ? (
          <>
            <label style={{ minWidth: 120 }}>
              <div className="sc">{t("First month")}</div>
              <select
                aria-label={t("First month")}
                value={firstMonth}
                onChange={(e) => setFirstMonth(e.target.value)}
              >
                {Array.from({ length: 13 }, (_, i) => addMonths(thisMonth, i)).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ minWidth: 90 }}>
              <div className="sc">{t("How many months")}</div>
              <input
                className="amt"
                style={{ textAlign: "end" }}
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                autoComplete="off"
              />
            </label>
          </>
        ) : (
          <label style={{ minWidth: 140 }}>
            <div className="sc">{t("Date")}</div>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
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
            aria-label={t("Account")}
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
      <label
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginBlockStart: 10,
          fontSize: ".85rem",
        }}
      >
        <input
          type="checkbox"
          checked={ahead}
          onChange={(e) => setAhead(e.target.checked)}
          data-testid="expense-ahead"
        />
        {t(
          "Paid ahead for months to come (next month's rent, a year's insurance): each month takes its share",
        )}
      </label>
      <div style={{ marginBlockStart: 8 }}>
        <CashOnHandNote on={cash} from={paidFrom} amount={value} />
        <SamePaymentNote
          same={same}
          accepted={acceptSame}
          onAccept={(yes) => setAcceptedFor(yes ? sameKey : null)}
        />
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
                {ahead ? (
                  <span className="acct">
                    <em>1400</em>
                    {t("Prepaid expenses")}
                  </span>
                ) : (
                  <span className="acct">
                    <em>{account}</em>
                    {say(accountName)}
                  </span>
                )}
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
              {ahead && (
                <div data-testid="prepaid-shares" style={{ marginBlockStart: 10 }}>
                  <div className="sc">{t("Then each month it covers")}</div>
                  {first && last ? (
                    <>
                      <div className="vline">
                        <span className="dr">{t("Dr")}</span>
                        <span className="acct">
                          <em>{account}</em>
                          {say(accountName)}
                        </span>
                        <span className="amt">{fmtIQD(first.amount)}</span>
                      </div>
                      <div className="vline credit">
                        <span className="dr">{t("Cr")}</span>
                        <span className="acct">
                          <em>1400</em>
                          {t("Prepaid expenses")}
                        </span>
                        <span className="amt">{fmtIQD(first.amount)}</span>
                      </div>
                      <div className="vline" style={{ paddingBlockStart: 6 }}>
                        <span className="dr" />
                        <span className="acct faint" style={{ fontSize: ".74rem" }}>
                          {shares.length === 1
                            ? t("One month, {first}: {each}", {
                                first: first.month,
                                each: fmtIQD(first.amount),
                              })
                            : first.amount === last.amount
                              ? t("{n} months, {first} to {last}, {each} each", {
                                  n: shares.length,
                                  first: first.month,
                                  last: last.month,
                                  each: fmtIQD(first.amount),
                                })
                              : t("{n} months, {first} to {last}: {each} each, the last {rest}", {
                                  n: shares.length,
                                  first: first.month,
                                  last: last.month,
                                  each: fmtIQD(first.amount),
                                  rest: fmtIQD(last.amount),
                                })}{" "}
                          {first.month === thisMonth
                            ? t(
                                "This month's share is posted now, each later one as its month comes.",
                              )
                            : t("Each share is posted as its month comes.")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="vempty">
                      {refusal ? t(refusal.text, refusal.vars) : t("Enter an amount")}
                    </div>
                  )}
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
            disabled={
              busy ||
              !desc.trim() ||
              value <= 0 ||
              !account ||
              !paidFrom ||
              (ahead && (refusal !== null || shares.length === 0)) ||
              (same.length > 0 && !acceptSame)
            }
          >
            {busy ? t("Posting…") : ahead ? t("Post prepaid expense") : t("Post expense")}
          </button>
          <div style={{ marginBlockStart: 12 }}>
            <OperationStatus op={op} />
            <Notice msg={msg} />
            {posted && prefill?.back && (
              <Link href={prefill.back} data-testid="expense-back">
                {t("Back to the bank's statement")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
