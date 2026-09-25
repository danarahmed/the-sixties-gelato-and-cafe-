import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getAuditTrail } from "@/lib/db/books";
import { AUDIT_GROUPS, auditGroup } from "@/lib/audit";
import { addDays, businessToday, dateTimeIn, dayStart, parseDay } from "@/lib/dates";

export const dynamic = "force-dynamic";

const SHOWN = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Who changed what (0027, the audit's P1-1): every change the database
 * recorded, newest first, with its values before and after, the person and
 * their reason — prices, products, items, opening stock, suppliers, recipes,
 * settings, and everything the controls already recorded. A change made in the
 * database itself shows no one against it, which is itself worth seeing.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("audit.view");
  const t = await getT();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const to = parseDay(sp.to, today);
  const from = parseDay(sp.from, addDays(to, -29));
  const group = auditGroup(one(sp.group))?.key ?? "";
  const personArg = one(sp.person) ?? "";
  const person = personArg === "none" || UUID.test(personArg) ? personArg : "";

  const { entries, more, people } = await getAuditTrail(
    {
      fromTs: dayStart(from, profile.timezone),
      toTs: dayStart(addDays(to, 1), profile.timezone),
      group: group || null,
      person: person || null,
    },
    SHOWN,
  );
  const query = new URLSearchParams({
    from,
    to,
    ...(group && { group }),
    ...(person && { person }),
  });

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("nav.audit")}</h1>
        <span className="sc">Who changed what, with the values before and after</span>
      </div>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">From</div>
          <input type="date" name="from" defaultValue={from} max={today} />
        </label>
        <label>
          <div className="sc">To</div>
          <input type="date" name="to" defaultValue={to} max={today} />
        </label>
        <label>
          <div className="sc">What</div>
          <select name="group" defaultValue={group} aria-label="What">
            <option value="">Every change</option>
            {AUDIT_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="sc">Who</div>
          <select name="person" defaultValue={person} aria-label="Who">
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="none">No one signed in (changed in the database)</option>
          </select>
        </label>
        <button type="submit">Show</button>
        <a className="badge" href={`/reports/export?report=audit&${query}`}>
          CSV
        </a>
      </form>

      <section className="panel" data-testid="audit-trail">
        <div className="panel-h">
          <h3>
            {from} to {to}
          </h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {more
              ? `The latest ${entries.length} changes are shown; the CSV has them all`
              : `${entries.length} change(s)`}
          </span>
        </div>
        {entries.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              Nothing recorded in these dates{group || person ? " for this choice" : ""}.
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What happened</th>
                  <th>About</th>
                  <th>Before → after</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} data-action={e.action}>
                    <td className="mono muted" style={{ fontSize: ".8rem", whiteSpace: "nowrap" }}>
                      {dateTimeIn(profile.timezone, e.at)}
                    </td>
                    <td>{e.by ?? <span className="badge warn">No one signed in</span>}</td>
                    <td>{e.label}</td>
                    <td>{e.subject}</td>
                    <td style={{ fontSize: ".84rem" }}>
                      {e.changes.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        e.changes.map((c, i) => (
                          <div key={i}>
                            <span className="muted">{c.field}:</span>{" "}
                            {c.before === "" ? (
                              <strong>{c.after}</strong>
                            ) : c.after === "" ? (
                              <s>{c.before}</s>
                            ) : (
                              <>
                                {c.before} → <strong>{c.after}</strong>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: ".84rem" }}>
                      {e.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted" style={{ fontSize: ".76rem", lineHeight: 1.7, maxWidth: 780 }}>
        Written by the database in the same step as the change, and never edited or deleted. Prices,
        products, stock items and their units, opening stock, suppliers, recipes, business settings
        and places are recorded however they are changed — on a screen, or in the database, where no
        one is signed in. Sales, refunds, discounts, counts, cash and the books are recorded by the
        steps that make them. See also the <Link href="/journals">journal register</Link> for every
        posting.
      </p>
    </div>
  );
}
