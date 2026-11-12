import Link from "next/link";
import { getMsg, getT } from "@/lib/i18n/server";
import { has, requireMember } from "@/lib/auth/session";
import { getDrawerState } from "@/lib/db/cash";
import { getClockBoard, getPayrollRuns } from "@/lib/db/staff";
import { getCurrentAlerts } from "@/lib/db/alerts";
import { getReconciliation } from "@/lib/db/reports";
import { getStockBoard, getStockCounts } from "@/lib/db/read";
import { getProductionPlan } from "@/lib/db/production";
import { getPurchaseOrders } from "@/lib/db/purchasing";
import { getBuyingList } from "@/lib/db/buying";
import { getTransfers } from "@/lib/db/transfers";
import { getApprovals } from "@/lib/db/approvals";
import { getProblems } from "@/lib/db/problems";
import { getWatchList, watchMaySee } from "@/lib/db/watch";
import { getAuditTrail, getVendorBook } from "@/lib/db/books";
import { getBankBook } from "@/lib/db/bank";
import { getPlaces, placeChoice, tillChoice } from "@/lib/place";
import { addDays, businessToday, dateTimeIn, dayStart } from "@/lib/dates";
import {
  allDone,
  jobsFor,
  STATE_LABEL,
  todayJobs,
  type JobKey,
  type JobState,
  type TodayFacts,
} from "@/lib/today";
import { Icon } from "@/components/Icon";
import { getPracticeState } from "@/lib/db/practice";
import { isReady } from "@/lib/practice";
import { getUseByLots } from "@/lib/db/useBy";
import { groupUseBy, type UseByLot } from "@/lib/useBy";
import { fmtQty, unitName } from "@/lib/format";
import type { T } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

/** A read Today can do without: a job that cannot be read is left out, not the page. */
const orElse = <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

/** One read for every job that needs it, made only when one does. */
function once<T>(read: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined;
  return () => (p ??= read());
}

const STATE_BADGE: Record<JobState, string> = {
  todo: "badge warn",
  waiting: "badge info",
  later: "badge",
  done: "badge ok",
};

/**
 * Today (the sales round): where everyone starts. Only today's jobs for what
 * this person may do, in the order of the day, each with one button straight
 * to where it is done, and each ticked once it is: what is still to do first,
 * then what waits on someone else, then what is for later, then what is done.
 * Nothing on it is new: it reads what the screens behind each job read, and a
 * job whose read fails is left out rather than the page.
 */
export default async function TodayPage() {
  const profile = await requireMember();
  const [t, msg] = await Promise.all([getT(), getMsg()]);
  const tz = profile.timezone;
  const now = new Date();
  const nowIso = now.toISOString();
  const today = businessToday(tz);
  const clock = dateTimeIn(tz, nowIso);
  const hour = Number(clock.slice(11, 13));
  const time = (iso: string) => dateTimeIn(tz, iso).slice(11, 16);
  const keys = jobsFor(profile.permissions, hour);
  const wants = (...k: JobKey[]) => k.some((x) => keys.includes(x));

  const [{ at: tillAt }, { at }, places] = await Promise.all([
    tillChoice(),
    placeChoice(),
    getPlaces(),
  ]);

  // What is near or past its use-by here (0098): null before it, or for those who may not read it.
  const useBy = await orElse(getUseByLots({ locationId: at }), null);

  // The reads more than one job shares, each made once.
  const drawer = once(() => orElse(getDrawerState(tillAt), null));
  const plan = once(() => orElse(getProductionPlan(today, at), null));
  const orders = once(() =>
    orElse(
      getPurchaseOrders().then((r) =>
        at ? r.orders.filter((o) => o.locationId === at) : r.orders,
      ),
      null,
    ),
  );
  const alerts = once(() => orElse(getCurrentAlerts(), null));
  const none = Promise.resolve(null);

  // The start of the day's steps, as its page reads them, for those it shows each to.
  const morning = wants("startDay")
    ? Promise.all([
        has(profile, "cash.session") || has(profile, "cash.session.force") ? drawer() : none,
        has(profile, "sale.create") ||
        has(profile, "staff.manage") ||
        has(profile, "attendance.edit")
          ? orElse(Promise.all(places.map((p) => getClockBoard(p.id))), null)
          : none,
        has(profile, "production.record") || has(profile, "cost.view") ? plan() : none,
        has(profile, "cost.view") ? orders() : none,
        has(profile, "cost.view") ? orElse(getStockBoard(at), null) : none,
        has(profile, "profit.view") ? alerts() : none,
      ]).then(([d, boards, p, o, stock, a]) => ({
        drawer: d,
        boards,
        plan: p,
        orders: o,
        stock,
        alerts: a,
      }))
    : Promise.resolve(undefined);

  const [
    morningFacts,
    drawerState,
    planRead,
    counts,
    deliveries,
    transfers,
    buying,
    approvals,
    alertList,
    problems,
    watch,
    vendorBook,
    bank,
    payroll,
    books,
    audit,
  ] = await Promise.all([
    morning,
    wants("drawer") ? drawer() : none,
    wants("make") ? plan() : none,
    wants("count") ? orElse(getStockCounts(), null) : none,
    wants("deliveries") ? orders() : none,
    wants("transfers") ? orElse(getTransfers(), null) : none,
    wants("order") ? orElse(getBuyingList(at), null) : none,
    wants("approvals") ? orElse(getApprovals(), null) : none,
    wants("alerts") ? alerts() : none,
    wants("problems") ? orElse(getProblems(), null) : none,
    // The watch list is the owner's (and the general manager's, when the owner allows).
    wants("watch")
      ? orElse(
          watchMaySee().then((may) => (may ? getWatchList() : null)),
          null,
        )
      : none,
    wants("bills") ? orElse(getVendorBook(today), null) : none,
    wants("bank") ? orElse(getBankBook(today), null) : none,
    wants("payroll") ? orElse(getPayrollRuns(), null) : none,
    wants("books") ? orElse(getReconciliation(today), null) : none,
    wants("audit")
      ? orElse(
          getAuditTrail(
            { fromTs: dayStart(today, tz), toTs: dayStart(addDays(today, 1), tz) },
            200,
          ),
          null,
        )
      : none,
  ]);

  const facts: TodayFacts = {
    today,
    now,
    hour,
    morning: morningFacts,
    drawer: drawerState,
    plan: planRead,
    counts: counts && {
      me: profile.id,
      mayCount: has(profile, "inventory.count"),
      mayReview:
        has(profile, "inventory.count.view_expected") || has(profile, "inventory.adjust.approve"),
      counts,
    },
    deliveries,
    transfers: transfers && { list: transfers, places: places.map((p) => p.id) },
    order: buying && buying.items.map((l) => ({ item: l.item, status: l.status })),
    approvals,
    alerts: alertList,
    problems,
    watch,
    bills: vendorBook?.openBills ?? null,
    bank,
    payroll,
    books,
    audit: audit && { changes: audit.entries.length, more: audit.more },
  };
  const jobs = todayJobs(keys, facts, {
    t,
    time,
    at: (iso) => dateTimeIn(tz, iso),
    msg,
  });
  const done = jobs.filter((j) => j.state === "done").length;
  const free = allDone(jobs);
  // Practice (0096): someone who has not done their role's practice tasks is offered them first.
  const practice = profile.practice ? null : await getPracticeState().catch(() => null);
  const practiceLeft =
    practice && !isReady(practice) ? practice.tasks.filter((x) => !x.doneAt).length : 0;
  const ring = 2 * Math.PI * 16;
  const firstName = (profile.name ?? "").trim().split(/\s+/)[0] ?? "";

  return (
    <div className="grid eod today" style={{ gap: 18 }} data-testid="today">
      <div className="phead">
        <h1>{t("nav.today")}</h1>
        <span className="sc">
          {today} · {clock.slice(11, 16)}
          {profile.worksAtName ? ` · ${profile.worksAtName}` : ""}
        </span>
      </div>

      {practice && practiceLeft > 0 && (
        <section className="card grid" style={{ gap: 8 }} data-testid="today-practice">
          <strong>{t("New here? Practise first")}</strong>
          <span className="muted">
            {practice.started
              ? t("{n} practice tasks left for your role. Nothing you do in practice is real.", {
                  n: practiceLeft,
                })
              : t("Try your work in a practice café of your own: nothing you do there is real.")}
          </span>
          <div>
            <Link href="/practice" className="btn-primary">
              {practice.started ? t("Carry on practising") : t("Start practising")}
            </Link>
          </div>
        </section>
      )}

      {useBy && <UseByCard list={useBy} t={t} />}

      <section
        className={`card eod-head${free ? " ready" : ""}`}
        data-testid="today-progress"
        data-done={done}
        data-total={jobs.length}
      >
        <svg className="eod-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle className="eod-ring-track" cx="20" cy="20" r="16" />
          <circle
            className="eod-ring-done"
            cx="20"
            cy="20"
            r="16"
            strokeDasharray={`${jobs.length ? (ring * done) / jobs.length : ring} ${ring}`}
            transform="rotate(-90 20 20)"
          />
        </svg>
        <div>
          {free ? (
            <h2 data-testid="today-all-done">{t("All done for now")}</h2>
          ) : (
            <h2>
              {firstName
                ? t("{name}, here is your day", { name: firstName })
                : t("Here is your day")}
            </h2>
          )}
          <p className="muted">
            {free
              ? jobs.length
                ? t(
                    "Nothing is left to do now. What is left waits on someone else, or is for later.",
                  )
                : t("Nothing is set for you today.")
              : t(
                  "Start at the top. Each button opens where the job is done; it is ticked here once it is.",
                )}
          </p>
        </div>
      </section>

      {jobs.length > 0 && (
        <ol className="eod-steps" aria-label={t("Your jobs today")}>
          {jobs.map((j) => (
            <li
              key={j.key}
              className={`card eod-step today-job ${j.state}`}
              data-testid={`today-job-${j.key}`}
              data-job={j.key}
              data-state={j.state}
            >
              <span className="eod-dot" aria-hidden="true">
                {j.state === "done" ? (
                  <Icon name="check" size={16} />
                ) : j.state === "waiting" ? (
                  <Icon name="clock" size={16} />
                ) : (
                  <Icon name="chevron" size={16} />
                )}
              </span>
              <div className="eod-body">
                <h3>
                  {j.title}{" "}
                  <span className={STATE_BADGE[j.state]} data-testid="today-job-state">
                    {t(STATE_LABEL[j.state])}
                  </span>
                </h3>
                <p className="eod-say" data-testid="today-job-say">
                  {j.say}
                </p>
                {j.items.length > 0 && (
                  <ul className="eod-items">
                    {j.items.map((x, i) => (
                      <li key={i} dir="auto">
                        {x}
                      </li>
                    ))}
                    {j.more > 0 && <li className="muted">{t("…and {n} more", { n: j.more })}</li>}
                  </ul>
                )}
              </div>
              <div className="eod-go">
                <Link
                  className={`btn-soft${j.state === "todo" ? " today-now" : ""}`}
                  href={j.go.href}
                  data-testid="today-job-go"
                >
                  {j.go.label}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * What is near or past its use-by here (0098), so it never reaches the till:
 * what to take off the shelf now, what goes off today, and what soon; and,
 * for those who set items and recipes up, what has not said how it keeps.
 */
function UseByCard({
  list,
  t,
}: {
  list: NonNullable<Awaited<ReturnType<typeof getUseByLots>>>;
  t: T;
}) {
  const g = groupUseBy(list.lots);
  if (
    g.expired.length + g.today.length + g.soon.length + list.unsetItems.length +
      list.unsetRecipes.length ===
    0
  )
    return null;
  const rows = (lots: UseByLot[]) => (
    <ul className="eod-items">
      {lots.slice(0, 8).map((l) => (
        <li key={l.lotId} dir="auto">
          {t("{item}: {qty} {unit}, use by {day}", {
            item: l.item,
            qty: fmtQty(l.left),
            unit: unitName(l.unit, t),
            day: l.useByOn ?? "—",
          })}
        </li>
      ))}
      {lots.length > 8 && <li className="muted">{t("…and {n} more", { n: lots.length - 8 })}</li>}
    </ul>
  );
  return (
    <section className="card" data-testid="today-use-by">
      <h2 style={{ marginTop: 0 }}>{t("Use-by")}</h2>
      {g.expired.length > 0 && (
        <div data-testid="today-use-by-expired">
          <h3>
            <span className="badge bad">{t("Past its use-by")}</span>{" "}
            {t("Take these off the shelf: past their use-by")}
          </h3>
          {rows(g.expired)}
          <p className="muted" style={{ marginTop: 0 }}>
            {t("Record what is left as expired on Inventory, or change its use-by if it was set wrong.")}
          </p>
        </div>
      )}
      {g.today.length > 0 && (
        <div data-testid="today-use-by-today">
          <h3>{t("These go off tonight: sell or use them first")}</h3>
          {rows(g.today)}
        </div>
      )}
      {g.soon.length > 0 && (
        <div data-testid="today-use-by-soon">
          <h3>{t("Going off soon")}</h3>
          {rows(g.soon)}
        </div>
      )}
      {list.unsetItems.length > 0 && (
        <div data-testid="today-use-by-unset">
          <h3>{t("Say how these keep, so their deliveries carry a use-by")}</h3>
          <ul className="eod-items">
            {list.unsetItems.slice(0, 8).map((i) => (
              <li key={i.itemId} dir="auto">
                <Link href={`/inventory/${i.itemId}#keeping`}>{i.name}</Link>
              </li>
            ))}
            {list.unsetItems.length > 8 && (
              <li className="muted">{t("…and {n} more", { n: list.unsetItems.length - 8 })}</li>
            )}
          </ul>
        </div>
      )}
      {list.unsetRecipes.length > 0 && (
        <div data-testid="today-use-by-recipes">
          <h3>{t("Say how long these recipes keep, or that they don't go off")}</h3>
          <ul className="eod-items">
            {list.unsetRecipes.slice(0, 8).map((r) => (
              <li key={r.recipeId} dir="auto">
                <Link href="/production#recipes">{r.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link className="btn-soft" href="/inventory#use-by">
        {t("Open the use-by list")}
      </Link>
    </section>
  );
}
