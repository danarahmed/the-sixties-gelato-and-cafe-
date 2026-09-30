import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHead } from "@/components/PrintHead";
import { getMsg, getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import {
  findJournalIds,
  getGlAccounts,
  getJournalRegister,
  getNextJournalNo,
  getPeriods,
  periodFor,
} from "@/lib/db/books";
import { getJournalLines, getTrialBalance } from "@/lib/db/reports";
import { readJournalQuery, SEARCH_MAX, searchText } from "@/lib/find";
import { fmtIQD } from "@/lib/format";
import { businessToday, monthStart, parseDay } from "@/lib/dates";
import { AccountLedger } from "@/components/books/AccountLedger";
import { JournalEntryForm } from "@/components/books/JournalEntryForm";
import { journalFromLink } from "@/lib/bank";
import { JournalRow } from "@/components/books/JournalRow";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Accounts with a subledger behind them take no manual journal (the database
 * refuses them too): the till's cash (every movement of it is a drawer event,
 * 0024), the safe (every movement of it is cash moved, 0038), the dollars in
 * both (0043), stock, payables, goods received, retained earnings, the
 * advances given on pay and the salaries owed (0049), and the stock on its way
 * between places (0054).
 */
const BLOCKED = new Set([
  "1000",
  "1001",
  "1005",
  "1006",
  "1200",
  "1210",
  "1300",
  "2000",
  "2050",
  "2100",
  "3100",
]);

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const msg = await getMsg();
  const sp = await searchParams;
  const manualOnly = sp.show === "manual";
  const today = businessToday(profile.timezone);
  // Opened from the bank's statement: money it received, the other side to choose.
  const prefill = journalFromLink(sp, today);

  // Opened from a figure: the lines of an account (or a few) behind it (0026).
  const ledgerOf =
    typeof sp.account === "string" ? sp.account.split(",").filter((c) => /^\d{4}$/.test(c)) : [];
  if (ledgerOf.length > 0) {
    const to = parseDay(sp.to, today);
    const from = parseDay(sp.from, monthStart(to));
    const pnl = sp.pnl === "1";
    const [{ lines, more }, tb] = await Promise.all([
      getJournalLines(from, to, { accounts: ledgerOf, excludeYearEnd: pnl, max: 1000 }),
      getTrialBalance(from, to),
    ]);
    const chosen = tb.filter((r) => ledgerOf.includes(r.code));
    const name = chosen.map((r) => `${r.code} ${msg(r.name)}`).join(" + ") || ledgerOf.join(" + ");
    return (
      <div className="grid" style={{ gap: 18 }}>
        <PrintHead
          business={profile.businessName}
          title={name}
          period={t("{from} to {to}", { from, to })}
          timezone={profile.timezone}
        />
        <div className="phead">
          <h1>{t("nav.journals")}</h1>
          <PrintButton />
          <span className="sc">{t("The lines behind the figure")}</span>
        </div>
        <AccountLedger
          title={name}
          accounts={ledgerOf}
          from={from}
          to={to}
          lines={lines}
          more={more}
          opening={pnl ? null : chosen.reduce((s, r) => s + r.opening, 0)}
          closing={pnl ? null : chosen.reduce((s, r) => s + r.closing, 0)}
          pnl={pnl}
          revenue={chosen.length > 0 && chosen.every((r) => r.type === "revenue")}
          timezone={profile.timezone}
          t={t}
          msg={msg}
        />
      </div>
    );
  }
  const canPost = has(profile, "accounting.post");
  // Find a journal (the September audit's P2-20): by its number, or words in it.
  const find = typeof sp.q === "string" ? (searchText(sp.q) ?? "") : "";
  const query = find ? readJournalQuery(find) : null;
  const found = query ? await findJournalIds(query) : null;
  const [entries, accounts, periods, nextNo] = await Promise.all([
    getJournalRegister(200, manualOnly && !find, find ? (found ?? []) : undefined),
    getGlAccounts(),
    getPeriods(),
    getNextJournalNo(),
  ]);
  const period = periodFor(periods, today);
  const drafts = entries.filter((e) => e.status === "draft").length;
  const legacy = entries.filter((e) => e.legacy).length;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <PrintHead
        business={profile.businessName}
        title={t("nav.journals")}
        period={period?.name}
        timezone={profile.timezone}
      />
      <div className="phead">
        <h1>{t("nav.journals")}</h1>
        <PrintButton />
        <span className="sc">{t("Every entry in the book, by number, newest first")}</span>
        <div className="sp">
          {drafts > 0 && <span className="badge warn">{t("{n} draft", { n: drafts })}</span>}
          {period && (
            <span className={`badge ${period.status === "locked" ? "err" : ""}`}>
              {period.name} {t(period.status)}
            </span>
          )}
        </div>
      </div>

      {canPost && (
        <section className="panel">
          <div className="panel-h">
            <h3>{t("New Journal")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("Debits must equal credits before it can be published")}
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
            prefill={prefill}
          />
        </section>
      )}

      <section className="panel">
        <div className="panel-h">
          <h3>{t("Journal Register")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            <Link href="/journals" className={manualOnly || find ? "" : "badge"}>
              {t("All")}
            </Link>{" "}
            ·{" "}
            <Link href="/journals?show=manual" className={manualOnly && !find ? "badge" : ""}>
              {t("Manual and reversals")}
            </Link>
          </span>
        </div>
        <form
          role="search"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 16px 0" }}
        >
          <input
            type="search"
            name="q"
            defaultValue={find}
            maxLength={SEARCH_MAX}
            dir="auto"
            data-testid="find-journal"
            aria-label={t("Find a journal")}
            placeholder={t("Its number, or words in it")}
            style={{ flex: "1 1 240px" }}
          />
          <button type="submit">{t("Find")}</button>
        </form>
        {find && entries.length === 0 ? (
          <EmptyState
            title={t("No journal matches “{q}”", { q: find })}
            hint={t(
              "Type its number, or words from its description, its reference or a line's note.",
            )}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            title={t("No journal entries yet")}
            hint={t(
              "Sales, receipts, bills, payments, expenses, drawer counts and cash moved all write here, as do journals posted by hand.",
            )}
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Date")}</th>
                  <th>{t("Journal #")}</th>
                  <th>{t("Reference")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Notes")}</th>
                  <th className="right">{t("Amount")}</th>
                  <th>{t("Posted by")}</th>
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
          {t(
            "A published entry can never be edited or deleted — the database refuses it. A mistake is corrected by reversing the entry, so the history of the book stays intact. Only a draft, which has not reached the books, may be discarded. Numbers are given in order when an entry is published, with no gaps.",
          )}
          {legacy > 0 &&
            ` ${
              legacy === 1
                ? t(
                    "{n} entry is marked “before controls”: recorded before these rules existed, kept as they were, and reported for review (docs/REMEDIATION.md).",
                    { n: legacy },
                  )
                : t(
                    "{n} entries are marked “before controls”: recorded before these rules existed, kept as they were, and reported for review (docs/REMEDIATION.md).",
                    { n: legacy },
                  )
            }`}
        </p>
      </section>

      <div className="cards2">
        <div>
          <div className="sc">{t("Shown")}</div>
          <div className="v">{entries.length}</div>
          <div className="m">
            {find
              ? t("Found for “{q}”", { q: find })
              : manualOnly
                ? t("Manual and reversals")
                : t("All sources")}
          </div>
        </div>
        <div>
          <div className="sc">{t("Drafts")}</div>
          <div className="v" style={{ color: drafts ? "var(--warn)" : undefined }}>
            {drafts}
          </div>
          <div className="m">{t("Not in the books; block the period close")}</div>
        </div>
        <div>
          <div className="sc">{t("Published, shown")}</div>
          <div className="v">
            {fmtIQD(
              entries.filter((e) => e.status === "published").reduce((s, e) => s + e.amount, 0),
            )}
          </div>
          <div className="m">{t("Total debits")}</div>
        </div>
        <div>
          <div className="sc">{t("Next number")}</div>
          <div className="v">{nextNo ?? "—"}</div>
          <div className="m">{t("Given on publish")}</div>
        </div>
      </div>
    </div>
  );
}
