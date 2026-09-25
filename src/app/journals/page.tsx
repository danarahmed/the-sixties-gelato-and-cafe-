import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import {
  getGlAccounts,
  getJournalRegister,
  getNextJournalNo,
  getPeriods,
  periodFor,
} from "@/lib/db/books";
import { fmtIQD } from "@/lib/format";
import { businessToday } from "@/lib/dates";
import { JournalEntryForm } from "@/components/books/JournalEntryForm";
import { JournalRow } from "@/components/books/JournalRow";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Accounts with a subledger behind them take no manual journal (the database
 * refuses them too): the till's cash (every movement of it is a drawer event,
 * 0024), stock, payables, goods received and retained earnings.
 */
const BLOCKED = new Set(["1000", "1200", "2000", "2050", "3100"]);

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const sp = await searchParams;
  const manualOnly = sp.show === "manual";
  const today = businessToday(profile.timezone);
  const canPost = has(profile, "accounting.post");
  const [entries, accounts, periods, nextNo] = await Promise.all([
    getJournalRegister(200, manualOnly),
    getGlAccounts(),
    getPeriods(),
    getNextJournalNo(),
  ]);
  const period = periodFor(periods, today);
  const drafts = entries.filter((e) => e.status === "draft").length;
  const legacy = entries.filter((e) => e.legacy).length;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>{t("nav.journals")}</h1>
        <span className="sc">Every entry in the book, by number, newest first</span>
        <div className="sp">
          {drafts > 0 && <span className="badge warn">{drafts} draft</span>}
          {period && (
            <span className={`badge ${period.status === "locked" ? "err" : ""}`}>
              {period.name} {period.status}
            </span>
          )}
        </div>
      </div>

      {canPost && (
        <section className="panel">
          <div className="panel-h">
            <h3>New Journal</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Debits must equal credits before it can be published
            </span>
          </div>
          <JournalEntryForm
            accounts={accounts
              .filter((a) => a.isActive && !BLOCKED.has(a.code))
              .map((a) => ({ code: a.code, name: a.name }))}
            controlAccounts={accounts
              .filter((a) => a.isActive && BLOCKED.has(a.code))
              .map((a) => ({ code: a.code, name: a.name }))}
            canCorrect={has(profile, "accounting.period.unlock")}
            nextNo={nextNo}
            today={today}
            currency={profile.currency}
          />
        </section>
      )}

      <section className="panel">
        <div className="panel-h">
          <h3>Journal Register</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            <Link href="/journals" className={manualOnly ? "" : "badge"}>
              All
            </Link>{" "}
            ·{" "}
            <Link href="/journals?show=manual" className={manualOnly ? "badge" : ""}>
              Manual and reversals
            </Link>
          </span>
        </div>
        {entries.length === 0 ? (
          <EmptyState
            title="No journal entries yet"
            hint="Sales, receipts, bills, payments, expenses, drawer counts and cash moved all write here, as do journals posted by hand."
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Journal #</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th className="right">Amount</th>
                  <th>Posted by</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <JournalRow
                    key={e.id}
                    entry={e}
                    timezone={profile.timezone}
                    canPost={canPost}
                    today={today}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p
          className="muted"
          style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}
        >
          A published entry can never be edited or deleted — the database refuses it. A mistake is
          corrected by reversing the entry, so the history of the book stays intact. Only a draft,
          which has not reached the books, may be discarded. Numbers are given in order when an
          entry is published, with no gaps.
          {legacy > 0 &&
            ` ${legacy} entr${legacy === 1 ? "y is" : "ies are"} marked “before controls”: recorded before these rules existed, kept as they were, and reported for review (docs/REMEDIATION.md).`}
        </p>
      </section>

      <div className="cards2">
        <div>
          <div className="sc">Shown</div>
          <div className="v">{entries.length}</div>
          <div className="m">{manualOnly ? "Manual and reversals" : "All sources"}</div>
        </div>
        <div>
          <div className="sc">Drafts</div>
          <div className="v" style={{ color: drafts ? "var(--warn)" : undefined }}>
            {drafts}
          </div>
          <div className="m">Not in the books; block the period close</div>
        </div>
        <div>
          <div className="sc">Published, shown</div>
          <div className="v">
            {fmtIQD(
              entries.filter((e) => e.status === "published").reduce((s, e) => s + e.amount, 0),
            )}
          </div>
          <div className="m">Total debits</div>
        </div>
        <div>
          <div className="sc">Next number</div>
          <div className="v">{nextNo ?? "—"}</div>
          <div className="m">Given on publish</div>
        </div>
      </div>
    </div>
  );
}
