/**
 * Today: each person's jobs for the day, in the order of the day, each with
 * one button to where it is done (the sales round). Who does a job is decided
 * by what they may do, not by the name of their role. Nothing here reads or
 * writes: the page reads the facts through the readers the screens behind
 * each job already use, and this chooses the jobs, says where each stands in
 * a sentence, and puts them in order: what is still to do first, then what
 * waits on someone else, then what is for later, then what is done.
 */
import { fill, type T } from "@/lib/i18n/core";
import { mayOpen } from "@/lib/auth/routes";
import { addDays, monthStart } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import type { Alert } from "@/lib/alerts";
import { firstFew, progress, waitingAlerts, type StepState } from "@/lib/endofday";
import {
  deliveriesDue,
  dueIn,
  isMorning,
  toMake,
  type DueOrder,
  type DuePerson,
  type PlanLine,
} from "@/lib/startofday";

/** Where a job stands: to do, waiting on someone else, for later, or done. */
export type JobState = "todo" | "waiting" | "later" | "done";

export type JobKey =
  | "startDay"
  | "drawer"
  | "make"
  | "count"
  | "deliveries"
  | "transfers"
  | "order"
  | "approvals"
  | "alerts"
  | "problems"
  | "watch"
  | "bills"
  | "bank"
  | "payroll"
  | "books"
  | "audit"
  | "endDay";

/** The jobs in the order of a day: the morning's first, the close last. */
export const DAY_ORDER: readonly JobKey[] = [
  "startDay",
  "drawer",
  "make",
  "count",
  "deliveries",
  "transfers",
  "order",
  "approvals",
  "alerts",
  "problems",
  "watch",
  "bills",
  "bank",
  "payroll",
  "books",
  "audit",
  "endDay",
];

export interface Job {
  key: JobKey;
  title: string;
  state: JobState;
  /** Where it stands, in a sentence. */
  say: string;
  /** What is still to do, the first few. */
  items: string[];
  more: number;
  /** The one place its work is done. */
  go: { href: string; label: string };
}

/** The part of the café's day: the morning opens it, the evening closes it. */
export type PartOfDay = "morning" | "day" | "evening";

export function partOfDay(hour: number): PartOfDay {
  if (isMorning(hour)) return "morning";
  // As the dashboard offers the close: from four in the afternoon until the small hours.
  return hour >= 16 || hour < 4 ? "evening" : "day";
}

/** The jobs the start of the day already lists: in the morning they are its steps, not jobs of their own. */
const IN_THE_MORNING: ReadonlySet<JobKey> = new Set([
  "drawer",
  "make",
  "deliveries",
  "order",
  "alerts",
]);

/**
 * The jobs a person may do, in the order of the day, by their permissions.
 * Whoever opens the day (day.close) has the start of the day in the morning,
 * with the drawer, what to make, the deliveries, what to buy and the red
 * alerts as its steps; the rest of the day those are jobs of their own.
 */
export function jobsFor(permissions: readonly string[], hour: number): JobKey[] {
  const may = (p: string) => permissions.includes(p);
  // Whoever reads the books and does not sell (the accountant, the auditor) checks each day
  // that they tie, and what changed; for those who sell, the dashboard says it.
  const checksBooks = may("profit.view") && may("audit.view") && !may("sale.create");
  const who: Record<JobKey, boolean> = {
    startDay: may("day.close") && partOfDay(hour) === "morning",
    drawer: may("sale.create"),
    make: may("production.record"),
    count:
      may("inventory.count") ||
      may("inventory.count.view_expected") ||
      may("inventory.adjust.approve"),
    deliveries: may("purchase.receive"),
    transfers: may("stock.transfer"),
    order: may("purchase.create"),
    approvals: mayOpen(permissions, "/approvals"),
    alerts: mayOpen(permissions, "/dashboard"),
    problems: may("audit.view") || may("settings.manage"),
    // The owner's alone (or the general manager's, if the owner allows): the page asks.
    watch: may("settings.manage"),
    bills: may("accounting.post"),
    bank: may("accounting.post"),
    payroll: may("payroll.run"),
    books: checksBooks,
    audit: checksBooks,
    endDay: may("day.close"),
  };
  return DAY_ORDER.filter((k) => who[k] && !(who.startDay && IN_THE_MORNING.has(k)));
}

const RANK: Record<JobState, number> = { todo: 0, waiting: 1, later: 2, done: 3 };

/** What is to do first, then what waits on someone else, then what is for later, then what is done; the day's order within each. */
export function sortJobs<J extends { key: JobKey; state: JobState }>(jobs: readonly J[]): J[] {
  const at = (k: JobKey) => DAY_ORDER.indexOf(k);
  return [...jobs].sort((a, b) => RANK[a.state] - RANK[b.state] || at(a.key) - at(b.key));
}

/** Nothing left to do now: what is left waits on someone else, or is for later. */
export function allDone(jobs: readonly { state: JobState }[]): boolean {
  return !jobs.some((j) => j.state === "todo");
}

// ------------------------------------------------------------------ the facts

/** How the page writes what a job says: its words, a time and a message from the database. */
export interface Say {
  t: T;
  /** "08:02", where the café is. */
  time: (iso: string) => string;
  /** "2026-11-04 08:02", where the café is. */
  at: (iso: string) => string;
  /** A message the database wrote, in the reader's language. */
  msg: (text: string) => string;
}

const english: Say = {
  t: (key, vars) => fill(key, vars),
  time: (iso) => iso.slice(11, 16),
  at: (iso) => iso.slice(0, 16).replace("T", " "),
  msg: (text) => text,
};

export interface DrawerFacts {
  session: { openedAt: string; cashier: string } | null;
  mayOpen: boolean;
}

export interface CountFacts {
  me: string;
  /** They count, and they may check what others counted. */
  mayCount: boolean;
  mayReview: boolean;
  counts: {
    id: string;
    status: string;
    countedById: string | null;
    countedBy: string | null;
    lines: number;
    counted: number;
    startedAt: string;
  }[];
}

export interface StockTransfer {
  no: number;
  status: string;
  from: string;
  toId: string;
}

export interface ApprovalFacts {
  kind: "count" | "loss" | "order" | "payroll";
  what: string;
  mine: boolean;
  mayApprove: boolean;
}

export interface BillDue {
  supplierName: string;
  outstanding: number;
  dueDate: string | null;
}

export interface PayrollRunFacts {
  month: string;
  status: string;
}

/**
 * The start of the day's steps, as its page has them (src/app/start-of-day):
 * each one shown only when its facts were read, and done once nothing of it
 * is left.
 */
export interface MorningFacts {
  drawer?: { session: unknown } | null;
  boards?: DuePerson[][] | null;
  plan?: { recipes: PlanLine[] } | null;
  /** The orders at this place; with the stock, the deliveries and what to buy. */
  orders?: (DueOrder & { lines: { itemId: string }[] })[] | null;
  stock?: { itemId: string; isLow: boolean; isNegative: boolean }[] | null;
  alerts?: Alert[] | null;
}

export type MorningStep = "drawer" | "staff" | "make" | "deliveries" | "buy" | "alerts";

export function morningSteps(
  f: MorningFacts,
  today: string,
  now: Date,
): { key: MorningStep; state: StepState }[] {
  const out: { key: MorningStep; state: StepState }[] = [];
  const left = (n: number): StepState => (n > 0 ? "left" : "done");
  if (f.drawer) out.push({ key: "drawer", state: f.drawer.session ? "done" : "left" });
  if (f.boards?.some((b) => b.length > 0))
    out.push({ key: "staff", state: left(dueIn(f.boards, now).late.length) });
  if (f.plan) out.push({ key: "make", state: left(toMake(f.plan.recipes).length) });
  if (f.orders && f.stock) {
    out.push({ key: "deliveries", state: left(deliveriesDue(f.orders, today).length) });
    const onOrder = new Set(
      f.orders
        .filter((o) => o.status === "draft" || o.status === "approved" || o.status === "sent")
        .flatMap((o) => o.lines.map((l) => l.itemId)),
    );
    const low = f.stock.filter((r) => (r.isLow || r.isNegative) && !onOrder.has(r.itemId));
    out.push({ key: "buy", state: left(low.length) });
  }
  if (f.alerts) out.push({ key: "alerts", state: left(waitingAlerts(f.alerts).red.length) });
  return out;
}

/**
 * Last month's pay: to draft once the month is over (when the café has paid
 * a month here before), to approve and to pay; done once paid, and shown so
 * for the first ten days of the month. Null when there is nothing to say.
 */
export function payrollDue(
  runs: readonly PayrollRunFacts[],
  today: string,
): { state: JobState; step: "draft" | "approve" | "pay" | "paid" } | null {
  const last = monthStart(addDays(monthStart(today), -1));
  const run = runs.find((r) => r.month.slice(0, 10) === last);
  if (!run) return runs.some((r) => r.month < last) ? { state: "todo", step: "draft" } : null;
  if (run.status === "draft") return { state: "todo", step: "approve" };
  if (run.status === "approved") return { state: "todo", step: "pay" };
  return Number(today.slice(8, 10)) <= 10 ? { state: "done", step: "paid" } : null;
}

/** The bills to pay by a week from today, the late ones too, the soonest due first. */
export function billsDueThisWeek<B extends BillDue>(bills: readonly B[], today: string): B[] {
  const by = addDays(today, 7);
  return bills
    .filter((b) => b.outstanding > 0 && b.dueDate !== null && b.dueDate <= by)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

/** Stock on its way to one of the places a person works at. */
export function transfersToReceive<X extends StockTransfer>(
  transfers: readonly X[],
  places: readonly string[],
): X[] {
  return transfers.filter((x) => x.status === "sent" && places.includes(x.toId));
}

// ------------------------------------------------------------------ the jobs

/** What the page read, each job's facts; a job whose facts could not be read is left out. */
export interface TodayFacts {
  today: string;
  now: Date;
  /** The hour the café's clock shows. */
  hour: number;
  morning?: MorningFacts;
  drawer?: DrawerFacts | null;
  plan?: { recipes: (PlanLine & { recipe: string })[] } | null;
  counts?: CountFacts | null;
  deliveries?: (DueOrder & { supplier: string })[] | null;
  transfers?: { list: StockTransfer[]; places: string[] } | null;
  order?: { item: string; status: string }[] | null;
  approvals?: ApprovalFacts[] | null;
  alerts?: Alert[] | null;
  problems?: { open: number; reports: { what: string; status: string }[] } | null;
  watch?: { findings: { status: string; strength: string }[] } | null;
  bills?: BillDue[] | null;
  bank?: { open: { day: string; description: string; amount: number }[] } | null;
  payroll?: PayrollRunFacts[] | null;
  books?: { label: string; difference: number }[] | null;
  audit?: { changes: number; more: boolean } | null;
}

const KIND: Record<ApprovalFacts["kind"], string> = {
  count: "Stock count",
  loss: "Loss",
  order: "Purchase order",
  payroll: "The month's pay",
};

const MORNING_TITLE: Record<MorningStep, string> = {
  drawer: "Drawer open and counted",
  staff: "Everyone due in is in",
  make: "What to make today",
  deliveries: "Deliveries due",
  buy: "Nothing low without an order",
  alerts: "Red alerts answered",
};

/** Where a job stands, in words (a phrase, said through t()). */
export const STATE_LABEL: Record<JobState, string> = {
  todo: "To do",
  waiting: "Waiting on someone else",
  later: "For later",
  done: "Done",
};

/** Every phrase a job is said with from a map, for the check that each is translated. */
export const TODAY_PHRASES: readonly string[] = [
  ...Object.values(KIND),
  ...Object.values(MORNING_TITLE),
  ...Object.values(STATE_LABEL),
];

function few<X>(list: X[], show: (x: X) => string) {
  const f = firstFew(list);
  return { items: f.shown.map(show), more: f.more };
}

/**
 * The jobs for these keys whose facts were read, each said in a sentence,
 * in the order they are worked: to do, waiting, later, done.
 */
export function todayJobs(keys: readonly JobKey[], f: TodayFacts, s: Say = english): Job[] {
  const { t, time, at, msg } = s;
  const jobs: Job[] = [];
  const add = (job: Job | null) => {
    if (job) jobs.push(job);
  };
  const part = partOfDay(f.hour);

  for (const key of keys) {
    switch (key) {
      case "startDay": {
        if (!f.morning) break;
        const steps = morningSteps(f.morning, f.today, f.now);
        if (!steps.length) break;
        const p = progress(steps.map((x) => x.state));
        const left = steps.filter((x) => x.state === "left");
        add({
          key,
          title: t("Open up for the day"),
          state: p.ready ? "done" : "todo",
          say: p.ready
            ? t("Everything is ready: open the doors.")
            : t("{done} of {total} done", { done: p.done, total: p.total }),
          ...few(left, (x) => t(MORNING_TITLE[x.key])),
          go: { href: "/start-of-day", label: t("nav.startOfDay") },
        });
        break;
      }

      case "drawer": {
        const d = f.drawer;
        if (!d) break;
        add(
          d.session
            ? {
                key,
                title: t("The drawer"),
                state: "done",
                say: t("Open since {time}.", { time: time(d.session.openedAt) }),
                items: [],
                more: 0,
                go: { href: "/pos", label: t("Sell") },
              }
            : {
                key,
                title: t("The drawer"),
                state: d.mayOpen ? "todo" : "waiting",
                say: d.mayOpen
                  ? t("The drawer is not open yet: count the cash in it, then open it.")
                  : t("The drawer is not open yet: a manager opens it."),
                items: [],
                more: 0,
                go: { href: "/pos", label: d.mayOpen ? t("Open the drawer") : t("Open the till") },
              },
        );
        break;
      }

      case "make": {
        if (!f.plan || !f.plan.recipes.length) break;
        const make = toMake(f.plan.recipes);
        add({
          key,
          title: t("What to make today"),
          state: make.length ? "todo" : "done",
          say: make.length
            ? t("{n} recipe(s) to make, {batches} batch(es) in all.", {
                n: make.length,
                batches: make.reduce((sum, r) => sum + r.batches, 0),
              })
            : t("Nothing needs making: the stock covers the day."),
          ...few(make, (r) => `${r.recipe} · ${t("{n} batch(es)", { n: r.batches })}`),
          go: { href: "/production#plan", label: t("Open the plan") },
        });
        break;
      }

      case "count": {
        const c = f.counts;
        if (!c) break;
        const mine = c.counts.find((x) => x.status === "counting" && x.countedById === c.me);
        const toReview = c.mayReview
          ? c.counts.filter((x) => x.status === "submitted" && x.countedById !== c.me)
          : [];
        const waiting = c.counts.find((x) => x.status === "submitted" && x.countedById === c.me);
        const title = t("Stock count");
        if (mine && c.mayCount)
          add({
            key,
            title,
            state: "todo",
            say: t("Your count is open: {counted} of {lines} item(s) counted.", {
              counted: mine.counted,
              lines: mine.lines,
            }),
            items: [],
            more: 0,
            go: { href: "/count", label: t("Go on counting") },
          });
        else if (toReview.length)
          add({
            key,
            title,
            state: "todo",
            say: t("{n} count(s) to check.", { n: toReview.length }),
            ...few(toReview, (x) => `${x.countedBy ?? "—"} · ${at(x.startedAt)}`),
            go: { href: "/count", label: t("Check them") },
          });
        else if (waiting && c.mayCount)
          add({
            key,
            title,
            state: "waiting",
            say: t("Your count is sent: someone else checks it now."),
            items: [],
            more: 0,
            go: { href: "/count", label: t("See the count") },
          });
        else if (c.mayReview)
          add({
            key,
            title,
            state: "done",
            say: t("No count waits for you to check it."),
            items: [],
            more: 0,
            go: { href: "/count", label: t("nav.count") },
          });
        else
          add({
            key,
            title,
            state: "later",
            say: t("No count is open. Start one when you are asked to."),
            items: [],
            more: 0,
            go: { href: "/count", label: t("Start a count") },
          });
        break;
      }

      case "deliveries": {
        if (!f.deliveries) break;
        const due = deliveriesDue(f.deliveries, f.today);
        add({
          key,
          title: t("Deliveries due"),
          state: due.length ? "todo" : "done",
          say: due.length
            ? t("{n} order(s) due today or late.", { n: due.length })
            : t("No delivery is due today."),
          ...few(due, (o) => `${t("Order {no}", { no: o.poNo })} · ${o.supplier}`),
          go: { href: "/purchasing", label: t("Receive them") },
        });
        break;
      }

      case "transfers": {
        if (!f.transfers) break;
        const coming = transfersToReceive(f.transfers.list, f.transfers.places);
        add({
          key,
          title: t("Stock on its way to you"),
          state: coming.length ? "todo" : "done",
          say: coming.length
            ? t("{n} transfer(s) to receive when they come.", { n: coming.length })
            : t("Nothing is on its way."),
          ...few(coming, (x) => `${t("Transfer {no}", { no: x.no })} · ${x.from}`),
          go: { href: "/inventory/transfers", label: t("Receive them") },
        });
        break;
      }

      case "order": {
        if (!f.order) break;
        const buy = f.order.filter((l) => l.status === "order");
        add({
          key,
          title: t("What to buy"),
          state: buy.length ? "todo" : "done",
          say: buy.length
            ? t("{n} item(s) to order.", { n: buy.length })
            : t("Nothing needs ordering now."),
          ...few(buy, (l) => l.item),
          go: { href: "/purchasing/buying-list", label: t("Order them") },
        });
        break;
      }

      case "approvals": {
        if (!f.approvals) break;
        // A count to check is the count's job, and the month's pay the payroll's.
        const covered = new Set<string>([
          ...(keys.includes("count") && f.counts?.mayReview ? ["count"] : []),
          ...(keys.includes("payroll") && f.payroll && payrollDue(f.payroll, f.today)
            ? ["payroll"]
            : []),
        ]);
        const list = f.approvals.filter((a) => !covered.has(a.kind));
        const decide = list.filter((a) => a.mayApprove);
        const mine = list.filter((a) => !a.mayApprove && a.mine);
        add({
          key,
          title: t("nav.approvals"),
          state: decide.length ? "todo" : mine.length ? "waiting" : "done",
          say: decide.length
            ? t("{n} thing(s) wait for you to approve.", { n: decide.length })
            : mine.length
              ? t("{n} of yours wait for someone else to approve.", { n: mine.length })
              : t("Nothing waits for you."),
          ...few(decide.length ? decide : mine, (a) => `${t(KIND[a.kind])} · ${a.what}`),
          go: { href: "/approvals", label: t("Open Approvals") },
        });
        break;
      }

      case "alerts": {
        if (!f.alerts) break;
        const red = waitingAlerts(f.alerts).red;
        add({
          key,
          title: t("Red alerts"),
          state: red.length ? "todo" : "done",
          say: red.length
            ? t("{n} red alert(s) wait for an answer.", { n: red.length })
            : t("No red alert waits."),
          ...few(red, (a) => msg(a.title)),
          go: { href: "/dashboard#needs-you", label: t("Answer them") },
        });
        break;
      }

      case "problems": {
        if (!f.problems) break;
        const open = f.problems.reports.filter((r) => r.status === "open");
        const n = Math.max(f.problems.open, open.length);
        add({
          key,
          title: t("Problems reported"),
          state: n ? "todo" : "done",
          say: n
            ? t("{n} problem(s) reported by staff wait for an answer.", { n })
            : t("No problem waits for an answer."),
          ...few(open, (r) => r.what),
          go: { href: "/problems", label: t("Look at them") },
        });
        break;
      }

      case "watch": {
        if (!f.watch) break;
        const strong = f.watch.findings.filter(
          (x) => x.status === "open" && x.strength === "strong",
        );
        add({
          key,
          title: t("The watch list"),
          state: strong.length ? "todo" : "done",
          // No names here: they are on the watch list, for its readers.
          say: strong.length
            ? t("{n} strong finding(s) wait for a look.", { n: strong.length })
            : t("Nothing strong on the watch list."),
          items: [],
          more: 0,
          go: { href: "/reports/watch", label: t("Open the watch list") },
        });
        break;
      }

      case "bills": {
        if (!f.bills) break;
        const due = billsDueThisWeek(f.bills, f.today);
        add({
          key,
          title: t("Bills due this week"),
          state: due.length ? "todo" : "done",
          say: due.length
            ? t("{n} bill(s) to pay by {day}, {amount} in all.", {
                n: due.length,
                day: addDays(f.today, 7),
                amount: fmtIQD(due.reduce((sum, b) => sum + b.outstanding, 0)),
              })
            : t("No bill is due this week."),
          ...few(
            due,
            (b) =>
              `${b.supplierName} · ${fmtIQD(b.outstanding)} · ${
                (b.dueDate ?? "") < f.today
                  ? t("late since {day}", { day: b.dueDate ?? "" })
                  : t("due {when}", { when: b.dueDate ?? "" })
              }`,
          ),
          go: { href: "/vendors", label: t("Pay them") },
        });
        break;
      }

      case "bank": {
        if (!f.bank) break;
        const open = f.bank.open;
        add({
          key,
          title: t("The bank's statement"),
          state: open.length ? "todo" : "done",
          say: open.length
            ? t("{n} bank line(s) not matched to a statement yet.", { n: open.length })
            : t("Every bank line is on a statement."),
          ...few(open, (l) => `${l.day} · ${l.description} · ${fmtIQD(l.amount)}`),
          go: { href: "/accounting/bank", label: t("Match them") },
        });
        break;
      }

      case "payroll": {
        if (!f.payroll) break;
        const due = payrollDue(f.payroll, f.today);
        if (!due) break;
        const say = {
          draft: t("Last month is over: draft its pay."),
          approve: t("Last month's pay is drafted: check it and approve it."),
          pay: t("Last month's pay is approved: pay it."),
          paid: t("Last month's pay is paid."),
        }[due.step];
        add({
          key,
          title: t("The month's pay"),
          state: due.state,
          say,
          items: [],
          more: 0,
          go: { href: "/payroll", label: t("nav.payroll") },
        });
        break;
      }

      case "books": {
        if (!f.books) break;
        const off = f.books.filter((r) => r.difference !== 0);
        add({
          key,
          title: t("Do the books tie?"),
          state: off.length ? "todo" : "done",
          say: off.length
            ? t("{n} check(s) do not tie: look into them.", { n: off.length })
            : t("Every check ties: the books agree with their records."),
          ...few(off, (r) => `${msg(r.label)} · ${fmtIQD(r.difference)}`),
          go: { href: "/reports#reconciliation", label: t("Open the checks") },
        });
        break;
      }

      case "audit": {
        if (!f.audit) break;
        add({
          key,
          title: t("What changed today"),
          state: "later",
          say: !f.audit.changes
            ? t("Nothing has been changed today.")
            : f.audit.more
              ? t("Over {n} change(s) recorded today.", { n: f.audit.changes })
              : t("{n} change(s) recorded today.", { n: f.audit.changes }),
          items: [],
          more: 0,
          go: { href: "/audit", label: t("Open the audit trail") },
        });
        break;
      }

      case "endDay": {
        const closing = part === "evening";
        add({
          key,
          title: t("Close the day"),
          state: closing ? "todo" : "later",
          say: closing
            ? t("Time to close: work down the end of the day, step by step.")
            : t("From four in the afternoon: close the day step by step."),
          items: [],
          more: 0,
          go: { href: "/end-of-day", label: t("nav.endOfDay") },
        });
        break;
      }
    }
  }
  return sortJobs(jobs);
}
