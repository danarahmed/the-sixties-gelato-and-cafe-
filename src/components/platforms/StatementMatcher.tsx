"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { matchStatementAction, postStatementAction } from "@/lib/actions/settlements";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Rich } from "@/lib/i18n/Rich";
import { Notice } from "@/components/ui";
import {
  matchIssues,
  parseStatement,
  type LineStatus,
  type StatementMatch,
} from "@/lib/settlements";

type Msg = { ok: boolean; text: string } | null;

// Phrases of the platforms book: shown through t(), in the reader's language.
export const LINE_STATUS: Record<LineStatus, string> = {
  matched: "Matched",
  not_found: "No sale has this order number",
  already_paid: "Already paid out",
  voided: "The sale was voided or refunded",
  duplicate: "On the statement twice",
};

const ACCOUNT: Record<string, string> = {
  "1020": "1020 Bank",
  "1100": "1100 Platform receivable",
  "5100": "5100 Platform commission",
  "5200": "5200 Platform fees",
};

const cell = (n: number | null) => (n === null ? "—" : fmtIQD(n));

/**
 * A platform's statement, matched to the orders waiting to be paid out
 * (0030). Paste the statement's lines from the platform's report; the match
 * says, line by line, which sale each pays for, or why it pays for none, and
 * which orders it leaves out. Nothing is written until the payout is posted:
 * the money into the bank, the commission and fees, and the orders' value
 * out of 1100 Platform receivable.
 */
export function StatementMatcher({
  platforms,
  initialPlatform,
  canPost,
  today,
  timezone,
}: {
  platforms: { code: string; name: string }[];
  /** The platform most orders are waiting on. */
  initialPlatform: string | null;
  canPost: boolean;
  today: string;
  timezone: string;
}) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [platform, setPlatform] = useState(initialPlatform ?? platforms[0]?.code ?? "talabat");
  const [text, setText] = useState("");
  const [match, setMatch] = useState<StatementMatch | null>(null);
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(today);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const parsed = useMemo(() => parseStatement(text), [text]);
  const name = platforms.find((p) => p.code === platform)?.name ?? platform;
  const issues = match ? matchIssues(match) : 0;
  const canMatch = !busy && parsed.lines.length > 0 && parsed.problems.length === 0;
  const canSubmit =
    canPost &&
    !busy &&
    match !== null &&
    match.matched > 0 &&
    reference.trim() !== "" &&
    (issues === 0 || note.trim().length >= 3);

  function runMatch() {
    setMsg(null);
    start(async () => {
      const r = await matchStatementAction({ platform, lines: parsed.lines });
      if (!r.ok) {
        setMatch(null);
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMatch(r.data);
    });
  }

  function post() {
    setMsg(null);
    start(async () => {
      const r = await postStatementAction({
        platform,
        lines: parsed.lines,
        reference,
        receivedOn,
        note,
      });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      const posted = { journal: r.data.journalNo ?? "—", n: r.data.orders, platform: name };
      setMsg({
        ok: true,
        text:
          r.data.issues > 0
            ? t(
                "Posted (journal {journal}): {n} {platform} order(s) paid out; {issues} line(s) not a clean match, kept with the statement to follow up.",
                { ...posted, issues: r.data.issues },
              )
            : t("Posted (journal {journal}): {n} {platform} order(s) paid out.", posted),
      });
      setText("");
      setMatch(null);
      setReference("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="panel-b" data-testid="statement-matcher">
      <div className="grid" style={{ gap: 10, maxWidth: 820 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            <div className="sc">{t("Platform")}</div>
            <select
              aria-label={t("Platform")}
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value);
                setMatch(null);
              }}
            >
              {platforms.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <span className="muted" style={{ fontSize: ".8rem", flex: 1, minWidth: 260 }}>
            <Rich
              text={t(
                "Copy the statement's rows from the platform's report (a spreadsheet or CSV) with their column names: <b>Order</b>, <b>Payout</b>, and <b>Commission</b> and <b>Fees</b> if it gives them. Without the names, the columns are read in that order.",
              )}
            />
          </span>
        </div>
        <label>
          <div className="sc">{t("The statement")}</div>
          <textarea
            aria-label={t("The statement")}
            rows={8}
            spellCheck={false}
            className="mono"
            style={{ width: "100%", fontSize: ".82rem" }}
            value={text}
            // i18n-ignore: an example of the platform's report, with column names the reading knows
            placeholder={"Order ID\tPayout\tCommission\n12345\t8500\t1500"}
            onChange={(e) => {
              setText(e.target.value);
              setMatch(null);
            }}
          />
        </label>
        {text.trim() !== "" && (
          <div className="muted" style={{ fontSize: ".82rem" }} data-testid="statement-read">
            {t("{n} line(s) read", { n: parsed.lines.length })}
            {parsed.columns
              ? ` · ${t("columns: {columns}", { columns: [parsed.columns.orderNo, parsed.columns.payout, parsed.columns.commission, parsed.columns.fees].filter(Boolean).join(", ") })}`
              : ""}
            {parsed.skipped > 0
              ? ` · ${t("{n} total row(s) left out", { n: parsed.skipped })}`
              : ""}
          </div>
        )}
        {parsed.problems.length > 0 && (
          <ul className="red" style={{ margin: 0, fontSize: ".85rem" }}>
            {parsed.problems.slice(0, 8).map((p) => (
              <li key={p}>{say(p)}</li>
            ))}
            {parsed.problems.length > 8 && (
              <li>{t("…and {n} more", { n: parsed.problems.length - 8 })}</li>
            )}
          </ul>
        )}
        <div>
          <button onClick={runMatch} disabled={!canMatch}>
            {busy && !match ? "…" : t("Match to the orders waiting")}
          </button>
        </div>
      </div>

      {match && (
        <div className="grid" style={{ gap: 12, marginBlockStart: 16 }} data-testid="match-result">
          <div className="cards2">
            <div>
              <div className="sc">{t("Orders matched")}</div>
              <div className="v">{match.matched}</div>
              <div className="m">
                {t("worth {amount} at the till", { amount: fmtIQD(match.totals.orders) })}
              </div>
            </div>
            <div>
              <div className="sc">{t("Paid for them")}</div>
              <div className="v">{fmtIQD(match.totals.payout)}</div>
              <div className="m">
                {t("commission {commission} · fees {fees}", {
                  commission: fmtIQD(match.totals.commission),
                  fees: fmtIQD(match.totals.fees),
                })}
              </div>
            </div>
            <div>
              <div className="sc">{t("Not explained")}</div>
              <div
                className="v"
                style={{ color: match.totals.difference !== 0 ? "var(--warn)" : undefined }}
                data-testid="match-difference"
              >
                {fmtIQD(match.totals.difference)}
              </div>
              <div className="m">{t("the orders' value less what was paid, kept and charged")}</div>
            </div>
            <div>
              <div className="sc">{t("On lines not posted")}</div>
              <div
                className="v"
                style={{ color: match.totals.notPosted !== 0 ? "var(--warn)" : undefined }}
              >
                {fmtIQD(match.totals.notPosted)}
              </div>
              <div className="m">{t("{n} line(s) need a word in the note", { n: issues })}</div>
            </div>
          </div>

          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Line")}</th>
                  <th>{t("Order")}</th>
                  <th>{t("What it is")}</th>
                  <th className="right">{t("Sold for")}</th>
                  <th className="right">{t("Paid")}</th>
                  <th className="right">{t("Commission")}</th>
                  <th className="right">{t("Fees")}</th>
                  <th className="right">{t("Not explained")}</th>
                </tr>
              </thead>
              <tbody>
                {match.lines.map((l) => (
                  <tr key={l.line} data-testid="match-line" data-status={l.status}>
                    <td className="mono">{l.line}</td>
                    <td className="mono">{l.orderNo}</td>
                    <td>
                      <span className={`ref ${l.status === "matched" ? "auto" : "due"}`}>
                        {t(LINE_STATUS[l.status])}
                      </span>
                      {l.paidBy && (
                        <span className="muted"> {t("by statement {ref}", { ref: l.paidBy })}</span>
                      )}
                      {l.placedAt && (
                        <div className="muted" style={{ fontSize: ".78rem" }}>
                          {t("sold {when}", { when: dateTimeIn(timezone, l.placedAt) })}
                        </div>
                      )}
                    </td>
                    <td className="right money">{cell(l.expected)}</td>
                    <td className="right money">{fmtIQD(l.payout)}</td>
                    <td className="right money">{cell(l.commission)}</td>
                    <td className="right money">{cell(l.fees)}</td>
                    <td
                      className="right money"
                      style={{
                        color:
                          l.difference !== null && l.difference !== 0 ? "var(--err)" : undefined,
                      }}
                    >
                      {l.difference === null || l.difference === 0 ? "—" : fmtIQD(l.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {match.missing.length > 0 && (
            <div
              className="card"
              style={{ borderColor: "var(--warn)" }}
              data-testid="match-missing"
            >
              <strong>
                {t(
                  "{n} {platform} order(s) waiting, from between those it pays, are not on this statement.",
                  { n: match.missing.length, platform: name },
                )}
              </strong>{" "}
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {t("Ask {platform} about them; they stay waiting until a statement pays them.", {
                  platform: name,
                })}
              </span>
              <ul style={{ margin: "6px 0 0", fontSize: ".85rem" }}>
                {match.missing.map((o) => (
                  <li key={o.saleId}>
                    <span className="mono">{o.orderNo}</span> · {dateTimeIn(timezone, o.placedAt)} ·{" "}
                    {fmtIQD(o.amount)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {match.journal.length > 0 && (
            <div className="grid" style={{ gap: 4, maxWidth: 560 }} data-testid="match-journal">
              <div className="sc">{t("The journal it would post")}</div>
              {match.journal.map((j) => (
                <div className="deduction-row" key={j.code}>
                  <span>
                    <span className="muted">{j.debit ? t("Dr") : t("Cr")}</span>{" "}
                    {t(ACCOUNT[j.code] ?? j.code)}
                  </span>
                  <span className="mono">{fmtIQD(j.debit || j.credit)}</span>
                </div>
              ))}
            </div>
          )}

          {canPost && match.matched > 0 && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ minWidth: 200 }}>
                <div className="sc">{t("Statement number or date")}</div>
                <input
                  aria-label={t("Statement number or date")}
                  value={reference}
                  maxLength={80}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <label>
                <div className="sc">{t("The payout arrived on")}</div>
                <input
                  aria-label={t("The payout arrived on")}
                  type="date"
                  value={receivedOn}
                  max={today}
                  onChange={(e) => setReceivedOn(e.target.value)}
                />
              </label>
              <label style={{ flex: 1, minWidth: 260 }}>
                <div className="sc">
                  {issues > 0
                    ? t("Note: say what the lines that do not match are")
                    : t("Note (optional)")}
                </div>
                <input
                  aria-label={t("Note")}
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button className="btn-primary" onClick={post} disabled={!canSubmit}>
                {busy ? "…" : t("Post the payout")}
              </button>
            </div>
          )}
          {!canPost && (
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("The owner or the accountant posts the payout.")}
            </p>
          )}
        </div>
      )}

      <div style={{ marginBlockStart: 12 }}>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
