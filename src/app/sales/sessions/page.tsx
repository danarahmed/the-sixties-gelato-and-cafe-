import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getCashSessions } from "@/lib/db/cash";
import { addDays, businessToday, parseDay } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { SessionsTable } from "@/components/cash/SessionsTable";

export const dynamic = "force-dynamic";

/**
 * Cash sessions (0036): each from its opening count to its closing count, with
 * the drawer counts and day closes before them. An open session shows what it
 * should hold only to those who may see it.
 */
export default async function CashSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("day.close", "cash.view_expected", "audit.view");
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const today = businessToday(profile.timezone);
  const from = parseDay(sp.from, addDays(today, -6));
  const to = parseDay(sp.to, today);
  const rows = await getCashSessions(from, to);
  const short = rows.reduce(
    (n, r) => n + Math.min(r.variance ?? 0, 0) + Math.min(r.openingVariance ?? 0, 0),
    0,
  );
  const over = rows.reduce(
    (n, r) => n + Math.max(r.variance ?? 0, 0) + Math.max(r.openingVariance ?? 0, 0),
    0,
  );

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Cash Sessions")}</h1>
        <span className="sc">
          <Link className="drill" href="/sales#drawer">
            {t("The Drawer")}
          </Link>
        </span>
      </div>
      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit">{t("Show")}</button>
        <span className="muted" style={{ fontSize: ".85rem" }}>
          {t("{n} session(s) · short {short} · over {over}", {
            n: rows.filter((r) => r.kind === "session").length,
            short: fmt(short),
            over: fmt(over),
          })}
        </span>
      </form>
      {rows.length === 0 ? (
        <EmptyState
          title={t("No cash sessions in these dates")}
          hint={t(
            "A session begins when the drawer is opened on the till, counting the cash in it.",
          )}
        />
      ) : (
        <section className="panel">
          <SessionsTable rows={rows} timezone={profile.timezone} />
        </section>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString("en-US");
}
