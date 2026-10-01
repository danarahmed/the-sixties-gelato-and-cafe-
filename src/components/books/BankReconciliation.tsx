"use client";
/**
 * The bank against its statement (0059): what the books say the bank holds,
 * the bank's lines on no statement yet, and the statements kept. The owner, a
 * general manager or the accountant keeps a statement when the lines ticked
 * take the bank from the last statement's balance to the one the bank gives,
 * and undoes the latest, with why. A line not on the bank's statement yet (a
 * transfer on its way) stays open for the next one.
 *
 * The bank's statement may be read from its file (or pasted): its lines are
 * found among the books' lines and ticked, its last day and balance filled
 * in, and its lines not in the books listed, to be recorded. What was read is
 * kept for this browser tab, so it is found again after a bank's charge is
 * recorded on Expenses.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { saveBankStatementAction, undoBankStatementAction } from "@/lib/actions/bank";
import {
  BANK_EXAMPLE,
  bankMath,
  recordLink,
  linesTo,
  matchBankStatement,
  parseBankStatement,
  type BankStatementMatch,
  type ParsedBankStatement,
} from "@/lib/bank";
import type { BankBook, BankStatementRow } from "@/lib/db/bank";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { ReadStatementFile } from "@/components/ReadStatementFile";

type Msg = { ok: boolean; text: string } | null;

/** The bank's statement read on this page, kept for the browser tab. */
const READ_KEY = "bank-statement-read";

export function BankReconciliation({
  book,
  canKeep,
  today,
  timezone,
}: {
  book: BankBook;
  canKeep: boolean;
  today: string;
  /** The café's: a statement's date with a time and its zone is read as its day there. */
  timezone: string;
}) {
  const { t, msg: say, locale } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [date, setDate] = useState(today);
  const [closing, setClosing] = useState("");
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [statement, setStatement] = useState("");
  const [pasting, setPasting] = useState(false);
  // Changed to start the file's button afresh, once what it read is let go.
  const [fileKey, setFileKey] = useState(0);

  const after = book.last?.statementDate ?? "";
  const opening = book.last?.closingBalance ?? 0;
  const read = useMemo(
    () => (statement.trim() === "" ? null : parseBankStatement(statement, timezone)),
    [statement, timezone],
  );
  const found = useMemo(
    () => (read ? matchBankStatement(read, book.open, after) : null),
    [read, book.open, after],
  );

  /** A statement read: its last day, its balance, and the books' lines it shows, ticked. */
  function readStatement(text: string) {
    setStatement(text);
    try {
      if (text.trim() === "") sessionStorage.removeItem(READ_KEY);
      else sessionStorage.setItem(READ_KEY, text);
    } catch {
      // Kept for the tab only when the browser keeps it.
    }
    if (text.trim() === "") return;
    const m = matchBankStatement(parseBankStatement(text, timezone), book.open, after);
    if (m.lastDay && m.lastDay <= today && (after === "" || m.lastDay > after)) setDate(m.lastDay);
    if (m.closing !== null) setClosing(m.closing);
    setTicked(new Set(m.ticked));
  }

  // Back on the page in the same tab, after recording a charge: read it again.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(READ_KEY);
    } catch {
      saved = null;
    }
    if (saved && canKeep) readStatement(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lines = linesTo(book.open, date);
  const onIt = lines.filter((l) => ticked.has(l.lineId));
  const m = bankMath(
    opening,
    onIt.map((l) => l.amount),
    closing,
  );
  const dateOk = date !== "" && date <= today && (after === "" || date > after);
  const ties = m.difference !== null && m.difference.isZero();

  function toggle(lineId: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  function keep() {
    setMsg(null);
    start(async () => {
      const r = await op.run("saveBankStatement", (key) =>
        saveBankStatementAction({ date, closing, lines: onIt.map((l) => l.lineId), note }, key),
      );
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({
        ok: true,
        text: t("Statement {no} is kept: the bank ties to {date}.", {
          no: r.data.statementNo,
          date,
        }),
      });
      setTicked(new Set());
      setClosing("");
      setNote("");
      readStatement("");
      setPasting(false);
      setFileKey((k) => k + 1);
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}
      >
        <div className="card" data-testid="bank-books">
          <div className="sc">{t("In the books, the bank holds")}</div>
          <div className="money" style={{ fontSize: "1.3rem", fontWeight: 600 }}>
            {fmtIQD(book.books)}
          </div>
          <div className="muted" style={{ fontSize: ".8rem" }}>
            {t("at the end of {date}", { date: book.to })}
          </div>
        </div>
        <div className="card" data-testid="bank-last">
          <div className="sc">{t("The last statement kept")}</div>
          {book.last ? (
            <>
              <div className="money" style={{ fontSize: "1.3rem", fontWeight: 600 }}>
                {fmtIQD(book.last.closingBalance)}
              </div>
              <div className="muted" style={{ fontSize: ".8rem" }}>
                {t("Statement {no}, to {date}", {
                  no: book.last.statementNo,
                  date: book.last.statementDate,
                })}
              </div>
            </>
          ) : (
            <div className="muted">{t("None yet: the first starts from nothing.")}</div>
          )}
        </div>
      </div>

      <Notice msg={msg} />

      <section className="panel" data-testid="bank-open">
        <div className="panel-h">
          <h3>{t("The bank's lines on no statement yet")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {canKeep
              ? t("Tick each line the bank's statement shows, to its last day.")
              : t("{n} line(s)", { n: book.open.length })}
          </span>
        </div>
        <div className="panel-b grid" style={{ gap: 12 }}>
          {canKeep && (
            <div className="grid" style={{ gap: 8 }} data-testid="bank-read">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="sc">{t("The bank's statement")}</span>
                <ReadStatementFile
                  key={fileKey}
                  testId="bank-file"
                  onRead={(text) => readStatement(text)}
                />
                {statement === "" && !pasting && (
                  <button type="button" className="linklike" onClick={() => setPasting(true)}>
                    {t("or paste it")}
                  </button>
                )}
                {statement !== "" && (
                  <button
                    type="button"
                    onClick={() => {
                      readStatement("");
                      setPasting(false);
                      setFileKey((k) => k + 1);
                    }}
                  >
                    {t("Clear the statement read")}
                  </button>
                )}
              </div>
              {(pasting || statement !== "") && (
                <textarea
                  aria-label={t("The bank's statement")}
                  // The bank's own words and numbers: not to be translated.
                  translate="no"
                  rows={5}
                  spellCheck={false}
                  className="mono"
                  style={{ width: "100%", fontSize: ".8rem" }}
                  value={statement}
                  placeholder={BANK_EXAMPLE[locale] ?? BANK_EXAMPLE.en}
                  onChange={(e) => {
                    setPasting(true);
                    readStatement(e.target.value);
                  }}
                  data-testid="bank-statement-text"
                />
              )}
              {read && found && (
                <StatementRead
                  read={read}
                  found={found}
                  after={after}
                  kept={book.last ? opening : null}
                />
              )}
            </div>
          )}
          {canKeep && (
            <div
              className="grid"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
                gap: 8,
              }}
            >
              <Field label={t("The statement's last day")}>
                <input
                  type="date"
                  style={inputStyle}
                  value={date}
                  min={after || undefined}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="bank-date"
                />
              </Field>
              <Field label={t("The balance on the statement")}>
                <input
                  style={inputStyle}
                  inputMode="decimal"
                  value={closing}
                  placeholder="0"
                  onChange={(e) => setClosing(e.target.value)}
                  data-testid="bank-closing"
                />
              </Field>
            </div>
          )}
          {lines.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {book.open.length === 0
                ? t("Every bank line in the books is on a statement.")
                : t("No bank line to this day is waiting.")}
            </p>
          ) : (
            <div className="tw">
              <table className="stack-table" data-testid="bank-lines">
                <thead>
                  <tr>
                    {canKeep && <th />}
                    <th>{t("Date")}</th>
                    <th>{t("Journal")}</th>
                    <th>{t("What")}</th>
                    <th className="right">{t("Money in")}</th>
                    <th className="right">{t("Money out")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(canKeep ? lines : book.open).map((l) => (
                    <tr key={l.lineId} data-testid="bank-line" data-amount={l.amount}>
                      {canKeep && (
                        <td>
                          <input
                            type="checkbox"
                            aria-label={t("On the statement")}
                            checked={ticked.has(l.lineId)}
                            onChange={() => toggle(l.lineId)}
                          />
                        </td>
                      )}
                      <td className="when" data-label={t("Date")}>
                        {l.day}
                      </td>
                      <td className="mono" data-label={t("Journal")}>
                        {l.journalNo ?? "—"}
                      </td>
                      <td data-label={t("What")}>{say(l.description)}</td>
                      <td className="right money" data-label={t("Money in")}>
                        {l.amount > 0 ? fmtIQD(l.amount) : ""}
                      </td>
                      <td className="right money" data-label={t("Money out")}>
                        {l.amount < 0 ? fmtIQD(-l.amount) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canKeep && (
            <>
              {lines.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setTicked(new Set(lines.map((l) => l.lineId)))}
                  >
                    {t("Tick every line to this day")}
                  </button>
                  <button type="button" onClick={() => setTicked(new Set())}>
                    {t("Untick all")}
                  </button>
                </div>
              )}
              <div className="card grid" style={{ gap: 4 }} data-testid="bank-sum">
                <div>
                  {t("The last statement")}: <b className="money">{fmtIQD(opening)}</b>
                </div>
                <div>
                  {t("Money in, ticked")}: <b className="money">{fmtIQD(m.moneyIn.toNumber())}</b> ·{" "}
                  {t("Money out, ticked")}: <b className="money">{fmtIQD(m.moneyOut.toNumber())}</b>
                </div>
                <div>
                  {t("The lines ticked take the bank to")}:{" "}
                  <b className="money">{fmtIQD(m.reached.toNumber())}</b>
                </div>
                {m.difference !== null && (
                  <div className={ties ? "ok" : "red"} data-testid="bank-difference">
                    {ties
                      ? t("It ties with the statement.")
                      : t("The statement says {closing}: {difference} apart.", {
                          closing: fmtIQD(m.closing!.toNumber()),
                          difference: fmtIQD(m.difference.toNumber()),
                        })}
                  </div>
                )}
                {!dateOk && after !== "" && (
                  <div className="muted" style={{ fontSize: ".8rem" }}>
                    {t("The next statement ends after {date}.", { date: after })}
                  </div>
                )}
              </div>
              <Field label={t("Note (optional)")}>
                <input
                  style={inputStyle}
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  className="btn-primary"
                  disabled={busy || !dateOk || !ties}
                  onClick={keep}
                  data-testid="bank-keep"
                >
                  {t("Keep the statement")}
                </button>
                <OperationStatus op={op} />
              </div>
              <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
                {t(
                  "On the statement but not in the books? A bank's charge is recorded on Expenses, paid from the bank; interest by a journal. Then tick it here.",
                )}{" "}
                <Link href="/expenses">{t("nav.expenses")}</Link>
              </p>
            </>
          )}
        </div>
      </section>

      <Statements statements={book.statements} canKeep={canKeep} onDone={setMsg} />
    </div>
  );
}

/**
 * What the bank's statement read comes to: its lines, those found in the
 * books (ticked), those on a statement kept already, and those not in the
 * books, to be recorded.
 */
function StatementRead({
  read,
  found,
  after,
  kept,
}: {
  read: ParsedBankStatement;
  found: BankStatementMatch;
  after: string;
  /** Where the last statement kept ends; null when none is kept yet. */
  kept: number | null;
}) {
  const { t, msg: say } = useT();
  const inBooks = found.lines.filter((x) => x.lineId !== null).length;
  const missing = found.lines.filter((x) => x.lineId === null).map((x) => x.line);
  const first = read.lines[0]?.day;
  const last = read.lines[read.lines.length - 1]?.day;
  const startsElsewhere =
    found.opening !== null && !new Decimal(found.opening).eq(kept ?? 0) ? found.opening : null;
  return (
    <div className="grid" style={{ gap: 6, fontSize: ".85rem" }} data-testid="bank-read-summary">
      <div className="muted">
        {t("{n} line(s) read", { n: read.lines.length })}
        {first && last ? ` · ${t("{from} to {to}", { from: first, to: last })}` : ""}
        {read.columns ? ` · ${t("columns: {columns}", { columns: read.columns.join(", ") })}` : ""}
        {read.skipped > 0
          ? ` · ${t("{n} row(s) left out: titles, totals and balances brought forward", { n: read.skipped })}`
          : ""}
      </div>
      {read.problems.length > 0 && (
        <ul className="red" style={{ margin: 0 }}>
          {read.problems.slice(0, 8).map((p) => (
            <li key={p}>{say(p)}</li>
          ))}
          {read.problems.length > 8 && (
            <li>{t("…and {n} more", { n: read.problems.length - 8 })}</li>
          )}
        </ul>
      )}
      {found.before > 0 && (
        <div className="muted">
          {t(
            "{n} of its line(s), to {date}, are on the statements kept already, and are left out.",
            {
              n: found.before,
              date: after,
            },
          )}
        </div>
      )}
      {read.lines.length > 0 && found.lines.length === 0 && (
        <div>
          {t("Every line on it is on or before {date}, on the statements kept already.", {
            date: after,
          })}
        </div>
      )}
      {found.lines.length > 0 && (
        <div data-testid="bank-found">
          {t("{found} of its {n} line(s) are in the books, and are ticked.", {
            found: inBooks,
            n: found.lines.length,
          })}
        </div>
      )}
      {startsElsewhere !== null && (
        <div style={{ color: "var(--warn)" }} data-testid="bank-starts">
          {kept !== null
            ? t(
                "The statement starts from {opening}, and the last statement kept ends at {kept}: a line between them may be missing.",
                { opening: fmtIQD(Number(startsElsewhere)), kept: fmtIQD(kept) },
              )
            : t(
                "The statement starts from {opening}, and the books start the bank from nothing: the bank's opening balance may not be in the books yet.",
                { opening: fmtIQD(Number(startsElsewhere)) },
              )}
        </div>
      )}
      {missing.length > 0 && (
        <div
          className="card grid"
          style={{ gap: 6, borderColor: "var(--warn)" }}
          data-testid="bank-not-in-books"
        >
          <strong>{t("On the statement, not in the books")}</strong>
          <div className="tw">
            <table className="stack-table">
              <thead>
                <tr>
                  <th>{t("Date")}</th>
                  <th>{t("What")}</th>
                  <th className="right">{t("Money in")}</th>
                  <th className="right">{t("Money out")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {missing.map((l) => (
                  <tr key={l.line} data-testid="bank-missing" data-amount={l.amount}>
                    <td className="when" data-label={t("Date")}>
                      {l.day}
                    </td>
                    <td data-label={t("What")}>
                      <bdi translate="no">{l.description}</bdi>
                    </td>
                    <td className="right money" data-label={t("Money in")}>
                      {Number(l.amount) > 0 ? fmtIQD(Number(l.amount)) : ""}
                    </td>
                    <td className="right money" data-label={t("Money out")}>
                      {Number(l.amount) < 0 ? fmtIQD(-Number(l.amount)) : ""}
                    </td>
                    <td className="right">
                      <Link href={recordLink(l)} data-testid="bank-record">
                        {t("Record it")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="muted">
            {t(
              "Record it fills in what the bank shows: a charge on Expenses, paid from the bank; money in (interest) as a journal into the bank, the account it came from yours to choose. Back on this page, it is found and ticked.",
            )}
          </span>
          {missing.some((l) => Number(l.amount) > 0) && (
            <span className="muted" data-testid="bank-settled-elsewhere">
              {t("Card money and a platform's payout are recorded where they are settled:")}{" "}
              <Link href="/sales#card">{t("Card Takings")}</Link>
              {" · "}
              <Link href="/platforms">{t("nav.platforms")}</Link>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Statements({
  statements,
  canKeep,
  onDone,
}: {
  statements: BankStatementRow[];
  canKeep: boolean;
  onDone: (m: Msg) => void;
}) {
  const { t, msg: say } = useT();
  const latest = statements.find((s) => s.status === "kept") ?? null;
  return (
    <section className="panel" data-testid="bank-statements">
      <div className="panel-h">
        <h3>{t("The statements kept")}</h3>
      </div>
      {statements.length === 0 ? (
        <div className="panel-b">
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            {t("No statement yet.")}
          </p>
        </div>
      ) : (
        <div className="tw">
          <table className="stack-table">
            <thead>
              <tr>
                <th>{t("No.")}</th>
                <th>{t("To")}</th>
                <th className="right">{t("The bank's balance")}</th>
                <th className="right">{t("Money in")}</th>
                <th className="right">{t("Money out")}</th>
                <th>{t("Lines ticked")}</th>
                <th>{t("Kept by")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <StatementRow
                  key={s.id}
                  s={s}
                  canUndo={canKeep && latest?.id === s.id}
                  onDone={onDone}
                  say={say}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatementRow({
  s,
  canUndo,
  onDone,
  say,
}: {
  s: BankStatementRow;
  canUndo: boolean;
  onDone: (m: Msg) => void;
  say: (text: string) => string;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  function undo() {
    onDone(null);
    start(async () => {
      const r = await op.run("undoBankStatement", (key) =>
        undoBankStatementAction({ statementId: s.id, reason }, key),
      );
      if (!r.ok) return onDone({ ok: false, text: r.error });
      onDone({
        ok: true,
        text: t("Statement {no} is undone: its lines are open again.", { no: r.data.statementNo }),
      });
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <tr
      data-testid="bank-statement"
      data-no={s.statementNo}
      data-status={s.status}
      className={s.status === "undone" ? "muted" : undefined}
    >
      <td className="mono" data-label={t("No.")}>
        {s.statementNo}
      </td>
      <td className="when" data-label={t("To")}>
        {s.statementDate}
      </td>
      <td className="right money" data-label={t("The bank's balance")}>
        {fmtIQD(s.closingBalance)}
      </td>
      <td className="right money" data-label={t("Money in")}>
        {fmtIQD(s.moneyIn)}
      </td>
      <td className="right money" data-label={t("Money out")}>
        {fmtIQD(s.moneyOut)}
      </td>
      <td data-label={t("Lines ticked")}>{s.lineCount}</td>
      <td data-label={t("Kept by")}>
        {s.by ?? "—"}
        {s.note && (
          <div className="muted" style={{ fontSize: ".78rem" }}>
            {say(s.note)}
          </div>
        )}
        {s.status === "undone" && (
          <div style={{ fontSize: ".78rem" }}>
            <span className="badge">{t("Undone")}</span> {s.undoReason ? say(s.undoReason) : ""}
          </div>
        )}
      </td>
      <td className="right" style={{ whiteSpace: "nowrap" }}>
        {canUndo && !open && (
          <button type="button" onClick={() => setOpen(true)} data-testid="bank-undo">
            {t("Undo…")}
          </button>
        )}
        {canUndo && open && (
          <span className="grid" style={{ gap: 6, justifyItems: "end" }}>
            <input
              style={inputStyle}
              value={reason}
              maxLength={300}
              placeholder={t("Why (required)")}
              aria-label={t("Why (required)")}
              onChange={(e) => setReason(e.target.value)}
              data-testid="bank-undo-reason"
            />
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                className="btn-primary"
                disabled={busy || !reason.trim()}
                onClick={undo}
                data-testid="bank-undo-confirm"
              >
                {t("Undo the statement")}
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                {t("Cancel")}
              </button>
            </span>
            <OperationStatus op={op} />
          </span>
        )}
      </td>
    </tr>
  );
}
