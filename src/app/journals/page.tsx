import { getT } from "@/lib/i18n/server";
import { getGlAccounts, getBusinessConfig } from "@/lib/db/read";
import { getAccountingOverview } from "@/lib/db/accounting";
import { getJournalRegister, peekNextJournalNo, getPeople } from "@/lib/db/books";
import { fmtIQD } from "@/lib/format";
import { JournalEntryForm } from "@/components/books/JournalEntryForm";
import { JournalRow } from "@/components/books/JournalRow";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JournalsPage() {
  const t = await getT();
  const [entries, accounts, overview, nextNo, people, cfg] = await Promise.all([
    getJournalRegister(150).catch(() => []),
    getGlAccounts().catch(() => []),
    getAccountingOverview().catch(() => null),
    peekNextJournalNo().catch(() => 1001),
    getPeople().catch(() => []),
    getBusinessConfig().catch(() => null),
  ]);
  const locked = overview?.currentPeriodStatus === "locked";
  const drafts = entries.filter((e) => e.status === "draft").length;
  const currency = cfg?.currencyCode ?? "IQD";

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="phead">
        <h1>All Manual Journals</h1>
        <span className="sc">Period {overview?.currentPeriodName ?? ""}</span>
        <div className="sp">
          {drafts > 0 && <span className="badge warn">{drafts} draft</span>}
          <span className={`badge ${overview?.trialBalanced ? "ok" : "err"}`}>
            {overview?.trialBalanced ? "Trial balance agrees" : "Out of balance"}
          </span>
          <span className={`badge ${locked ? "err" : ""}`}>
            {overview?.currentPeriodName ?? ""} {locked ? "locked" : "open"}
          </span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <h3>New Journal</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Debits must equal credits before it can be published
          </span>
        </div>
        {locked ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {overview?.currentPeriodName} is locked — post a reversing entry in the next period
              instead.
            </p>
          </div>
        ) : (
          <JournalEntryForm
            accounts={accounts.map((a) => ({ code: a.code, name: a.name }))}
            people={people}
            nextNo={nextNo}
            currency={currency}
          />
        )}
      </section>

      <section className="panel">
        <div className="panel-h">
          <h3>Journal Register</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {entries.length} entries
          </span>
        </div>
        {entries.length === 0 ? (
          <EmptyState
            title="No journal entries yet"
            hint="Sales, bills, payments, expenses and the day close all write here — as does anything you post by hand above."
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
                  <th>Created by</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <JournalRow key={e.id} entry={e} locked={locked} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: ".76rem", padding: "10px 16px 14px", lineHeight: 1.7 }}>
          A published entry can never be edited or deleted — the database refuses it. Corrections are
          made by a reversing entry, so the history of the book stays intact. Only a draft, which has
          not reached the books, may be discarded.
        </p>
      </section>

      <div className="cards2">
        <div>
          <div className="sc">Entries</div>
          <div className="v">{entries.length}</div>
          <div className="m">All sources</div>
        </div>
        <div>
          <div className="sc">Drafts</div>
          <div className="v" style={{ color: drafts ? "var(--warn)" : undefined }}>
            {drafts}
          </div>
          <div className="m">Not yet in the books</div>
        </div>
        <div>
          <div className="sc">Posted this period</div>
          <div className="v">{fmtIQD(entries.filter((e) => e.status === "published").reduce((s, e) => s + e.amount, 0))}</div>
          <div className="m">Total debits</div>
        </div>
        <div>
          <div className="sc">Next number</div>
          <div className="v">{nextNo}</div>
          <div className="m">Assigned on save</div>
        </div>
      </div>
    </div>
  );
}
