/**
 * Today (src/lib/today.ts): the jobs each person has by what they may do, in
 * the order of the day, the start of the day's steps folded into it in the
 * morning; each job's state from its facts (to do, waiting on someone else,
 * for later, done) and one button to where it is done; to do first, done
 * last; a job whose facts could not be read left out; all of it in Arabic
 * and Kurdish.
 */
import { describe, expect, it } from "vitest";
import type { Alert } from "@/lib/alerts";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions";
import { builtInWords } from "@/lib/i18n/dictionaries";
import { translator } from "@/lib/i18n/core";
import {
  allDone,
  billsDueThisWeek,
  jobsFor,
  morningSteps,
  partOfDay,
  payrollDue,
  sortJobs,
  todayJobs,
  transfersToReceive,
  TODAY_PHRASES,
  type CountFacts,
  type Job,
  type JobKey,
  type TodayFacts,
} from "@/lib/today";

const perms = (role: Role) => [...ROLE_PERMISSIONS[role]] as string[];
const TODAY = "2026-11-04";
const NOW = new Date("2026-11-04T07:30:00Z"); // 10:30 in Baghdad
const facts = (over: Partial<TodayFacts> = {}): TodayFacts => ({
  today: TODAY,
  now: NOW,
  hour: 10,
  ...over,
});
const one = (key: JobKey, over: Partial<TodayFacts>): Job | undefined =>
  todayJobs([key], facts(over))[0];

const alert = (over: Partial<Alert>): Alert => ({
  id: "a",
  rule: "running_out",
  subject: "s",
  urgency: "red",
  title: "Milk runs out today",
  why: null,
  action: null,
  confidence: "high",
  link: null,
  firstSeenAt: "2026-11-04T05:00:00Z",
  lastSeenAt: "2026-11-04T05:00:00Z",
  acknowledgedAt: null,
  acknowledgedBy: null,
  ackNote: null,
  snoozedUntil: null,
  snoozedBy: null,
  snoozeReason: null,
  ...over,
});

const count = (over: Partial<CountFacts["counts"][number]>): CountFacts["counts"][number] => ({
  id: "c1",
  status: "counting",
  countedById: "me",
  countedBy: "Dana",
  lines: 10,
  counted: 4,
  startedAt: "2026-11-04T06:00:00Z",
  ...over,
});

describe("who has which jobs", () => {
  it("decides by what a person may do, in the order of the day", () => {
    expect(jobsFor(perms("cashier"), 10)).toEqual(["drawer"]);
    expect(jobsFor(perms("barista"), 10)).toEqual(["drawer", "make"]);
    expect(jobsFor(perms("inventory_counter"), 10)).toEqual(["count"]);
    expect(jobsFor(perms("purchasing"), 10)).toEqual(["deliveries", "transfers", "order"]);
    expect(jobsFor(perms("accountant"), 10)).toEqual([
      "approvals",
      "alerts",
      "problems",
      "bills",
      "bank",
      "payroll",
      "books",
      "audit",
    ]);
    expect(jobsFor(perms("auditor"), 10)).toEqual(["alerts", "problems", "books", "audit"]);
    expect(jobsFor([], 10)).toEqual([]);
  });

  it("gives whoever opens the day its start in the morning, its steps folded into it", () => {
    expect(jobsFor(perms("branch_manager"), 9)).toEqual([
      "startDay",
      "count",
      "transfers",
      "approvals",
      "problems",
      "endDay",
    ]);
    // The rest of the day, the drawer, what to make, the deliveries, what to buy and the alerts are jobs of their own.
    expect(jobsFor(perms("branch_manager"), 14)).toEqual([
      "drawer",
      "make",
      "count",
      "deliveries",
      "transfers",
      "order",
      "approvals",
      "alerts",
      "problems",
      "endDay",
    ]);
  });

  it("gives the owner every job but the auditor's, and the watch list", () => {
    expect(jobsFor(perms("owner"), 18)).toEqual([
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
      "endDay",
    ]);
  });

  it("splits the day: the morning from four to noon, the evening from four in the afternoon", () => {
    expect([3, 4, 11, 12, 15, 16, 23].map(partOfDay)).toEqual([
      "evening",
      "morning",
      "morning",
      "day",
      "day",
      "evening",
      "evening",
    ]);
  });
});

describe("the order they are worked in", () => {
  const job = (key: JobKey, state: Job["state"]) => ({ key, state });

  it("puts what is to do first, then what waits, then what is for later, then what is done", () => {
    const sorted = sortJobs([
      job("endDay", "later"),
      job("drawer", "done"),
      job("approvals", "waiting"),
      job("problems", "todo"),
      job("count", "todo"),
      job("make", "done"),
    ]);
    expect(sorted.map((j) => j.key)).toEqual([
      "count",
      "problems",
      "approvals",
      "endDay",
      "drawer",
      "make",
    ]);
  });

  it("is all done for now once nothing is to do, whatever waits or is for later", () => {
    expect(allDone([])).toBe(true);
    expect(allDone([job("drawer", "done"), job("endDay", "later"), job("count", "waiting")])).toBe(
      true,
    );
    expect(allDone([job("drawer", "done"), job("count", "todo")])).toBe(false);
  });

  it("leaves out a job whose facts could not be read", () => {
    expect(todayJobs(["drawer", "count", "alerts"], facts())).toEqual([]);
  });
});

describe("each job", () => {
  it("the drawer: to open at the till; once open, done, and selling", () => {
    const closed = one("drawer", { drawer: { session: null, mayOpen: true } })!;
    expect(closed).toMatchObject({
      state: "todo",
      go: { href: "/pos", label: "Open the drawer" },
    });
    const open = one("drawer", {
      drawer: { session: { openedAt: "2026-11-04T08:02:00Z", cashier: "Dana" }, mayOpen: false },
    })!;
    expect(open).toMatchObject({
      state: "done",
      say: "Open since 08:02.",
      go: { href: "/pos", label: "Sell" },
    });
    expect(one("drawer", { drawer: { session: null, mayOpen: false } })?.state).toBe("waiting");
  });

  it("what to make: the plan's batches, the most first; none made in batches, no job", () => {
    const plan = {
      recipes: [
        { recipe: "Vanilla base", status: "make" as const, batches: 1 },
        { recipe: "Chocolate base", status: "make" as const, batches: 3 },
        { recipe: "Lemon sorbet", status: "enough" as const, batches: 0 },
      ],
    };
    const make = one("make", { plan })!;
    expect(make.state).toBe("todo");
    expect(make.say).toBe("2 recipes to make, 4 batches in all.");
    expect(make.items).toEqual(["Chocolate base · 3 batches", "Vanilla base · 1 batch"]);
    expect(make.go.href).toBe("/production#plan");
    expect(one("make", { plan: { recipes: [plan.recipes[2]!] } })?.state).toBe("done");
    expect(one("make", { plan: { recipes: [] } })).toBeUndefined();
  });

  it("the count: the counter's own open count, theirs sent, none; a reviewer's to check", () => {
    const counter = (counts: CountFacts["counts"]): TodayFacts["counts"] => ({
      me: "me",
      mayCount: true,
      mayReview: false,
      counts,
    });
    const open = one("count", { counts: counter([count({})]) })!;
    expect(open).toMatchObject({ state: "todo", go: { href: "/count" } });
    expect(open.say).toBe("Your count is open: 4 of 10 items counted.");
    expect(one("count", { counts: counter([count({ status: "submitted" })]) })?.state).toBe(
      "waiting",
    );
    const none = one("count", { counts: counter([count({ status: "approved" })]) })!;
    expect(none).toMatchObject({ state: "later", go: { href: "/count", label: "Start a count" } });
    // Someone else's open count is not theirs.
    expect(one("count", { counts: counter([count({ countedById: "other" })]) })?.state).toBe(
      "later",
    );

    const reviewer = (counts: CountFacts["counts"]): TodayFacts["counts"] => ({
      me: "boss",
      mayCount: true,
      mayReview: true,
      counts,
    });
    const check = one("count", {
      counts: reviewer([count({ status: "submitted", countedById: "me" })]),
    })!;
    expect(check.state).toBe("todo");
    expect(check.say).toBe("1 count to check.");
    expect(check.items).toEqual(["Dana · 2026-11-04 06:00"]);
    // Their own count is checked by someone else; nothing to check is done.
    expect(
      one("count", { counts: reviewer([count({ status: "submitted", countedById: "boss" })]) })
        ?.state,
    ).toBe("waiting");
    expect(one("count", { counts: reviewer([]) })?.state).toBe("done");
  });

  it("the deliveries and what to buy, at the place", () => {
    const deliveries = [
      { status: "sent", expectedOn: "2026-11-03", poNo: 7, supplier: "Erbil Dairy" },
      { status: "approved", expectedOn: "2026-11-09", poNo: 8, supplier: "Erbil Dairy" },
      { status: "draft", expectedOn: "2026-11-04", poNo: 9, supplier: "Erbil Dairy" },
    ];
    const due = one("deliveries", { deliveries })!;
    expect(due).toMatchObject({ state: "todo", items: ["Order 7 · Erbil Dairy"] });
    expect(due.go.href).toBe("/purchasing");
    const buy = one("order", {
      order: [
        { item: "Milk", status: "order" },
        { item: "Cups", status: "enough" },
      ],
    })!;
    expect(buy).toMatchObject({ state: "todo", items: ["Milk"], say: "1 item to order." });
    expect(buy.go.href).toBe("/purchasing/buying-list");
    expect(one("order", { order: [] })?.state).toBe("done");
  });

  it("the transfers on their way to a place the person works at", () => {
    const list = [
      { no: 1, status: "sent", from: "Kitchen", toId: "branch" },
      { no: 2, status: "sent", from: "Branch", toId: "kitchen" },
      { no: 3, status: "received", from: "Kitchen", toId: "branch" },
    ];
    expect(transfersToReceive(list, ["branch"]).map((x) => x.no)).toEqual([1]);
    const job = one("transfers", { transfers: { list, places: ["branch"] } })!;
    expect(job).toMatchObject({ state: "todo", items: ["Transfer 1 · Kitchen"] });
    expect(job.go.href).toBe("/inventory/transfers");
  });

  it("approvals: what they decide, theirs waiting on someone else, a count left to the count", () => {
    const approvals = [
      { kind: "loss" as const, what: "Beans", mine: false, mayApprove: true },
      { kind: "count" as const, what: "Cups", mine: false, mayApprove: true },
      { kind: "order" as const, what: "Order 4", mine: true, mayApprove: false },
    ];
    const both = todayJobs(
      ["count", "approvals"],
      facts({ approvals, counts: { me: "boss", mayCount: true, mayReview: true, counts: [] } }),
    ).find((j) => j.key === "approvals")!;
    expect(both).toMatchObject({ state: "todo", items: ["Loss · Beans"] });
    expect(both.go.href).toBe("/approvals");
    const alone = one("approvals", { approvals })!;
    expect(alone.items).toEqual(["Loss · Beans", "Stock count · Cups"]);
    const mine = one("approvals", { approvals: [approvals[2]!] })!;
    expect(mine.state).toBe("waiting");
    expect(one("approvals", { approvals: [] })).toMatchObject({
      state: "done",
      say: "Nothing waits for you.",
    });
  });

  it("the red alerts, those answered or orange not counted", () => {
    const job = one("alerts", {
      alerts: [
        alert({ id: "1" }),
        alert({ id: "2", urgency: "orange" }),
        alert({ id: "3", acknowledgedAt: "2026-11-04T06:00:00Z" }),
      ],
    })!;
    expect(job).toMatchObject({ state: "todo", items: ["Milk runs out today"] });
    expect(job.go.href).toBe("/dashboard#needs-you");
    expect(one("alerts", { alerts: [] })?.state).toBe("done");
  });

  it("the problems reported, and the watch list's strong findings without a name", () => {
    const problems = one("problems", {
      problems: { open: 1, reports: [{ what: "The printer jams", status: "open" }] },
    })!;
    expect(problems).toMatchObject({ state: "todo", items: ["The printer jams"] });
    expect(problems.go.href).toBe("/problems");
    const watch = one("watch", {
      watch: {
        findings: [
          { status: "open", strength: "strong" },
          { status: "open", strength: "worth_a_look" },
          { status: "explained", strength: "strong" },
        ],
      },
    })!;
    expect(watch).toMatchObject({
      state: "todo",
      items: [],
      say: "1 strong finding waits for a look.",
    });
    expect(watch.go.href).toBe("/reports/watch");
  });

  it("the bills due by a week from today, the late ones too, the soonest first", () => {
    const bills = [
      { supplierName: "Erbil Dairy", outstanding: 50_000, dueDate: "2026-11-10" },
      { supplierName: "Cups Co", outstanding: 20_000, dueDate: "2026-11-01" },
      { supplierName: "Later Ltd", outstanding: 10_000, dueDate: "2026-11-12" },
      { supplierName: "Paid Ltd", outstanding: 0, dueDate: "2026-11-02" },
      { supplierName: "No date", outstanding: 5_000, dueDate: null },
    ];
    expect(billsDueThisWeek(bills, TODAY).map((b) => b.supplierName)).toEqual([
      "Cups Co",
      "Erbil Dairy",
    ]);
    const job = one("bills", { bills })!;
    expect(job.say).toBe("2 bills to pay by 2026-11-11, 70,000 IQD in all.");
    expect(job.items).toEqual([
      "Cups Co · 20,000 IQD · late since 2026-11-01",
      "Erbil Dairy · 50,000 IQD · due 2026-11-10",
    ]);
    expect(job.go.href).toBe("/vendors");
    expect(one("bills", { bills: [] })?.state).toBe("done");
  });

  it("the bank's lines on no statement", () => {
    const job = one("bank", {
      bank: { open: [{ day: "2026-11-02", description: "Rent", amount: -500_000 }] },
    })!;
    expect(job).toMatchObject({ state: "todo", go: { href: "/accounting/bank" } });
    expect(one("bank", { bank: { open: [] } })?.state).toBe("done");
  });

  it("the month's pay: drafted, approved and paid once last month is over", () => {
    const run = (month: string, status: string) => ({ month, status });
    expect(payrollDue([run("2026-09-01", "paid")], TODAY)).toEqual({
      state: "todo",
      step: "draft",
    });
    // A café that has never paid a month here has nothing to draft.
    expect(payrollDue([], TODAY)).toBeNull();
    expect(payrollDue([run("2026-10-01", "draft")], TODAY)?.step).toBe("approve");
    expect(payrollDue([run("2026-10-01", "approved")], TODAY)?.step).toBe("pay");
    expect(payrollDue([run("2026-10-01", "paid")], TODAY)).toEqual({ state: "done", step: "paid" });
    expect(payrollDue([run("2026-10-01", "paid")], "2026-11-20")).toBeNull();
    // January's pay is December's.
    expect(payrollDue([run("2025-12-01", "approved")], "2026-01-05")?.step).toBe("pay");
    const job = one("payroll", { payroll: [run("2026-10-01", "draft")] })!;
    expect(job).toMatchObject({ state: "todo", go: { href: "/payroll" } });
  });

  it("the books tie, or the checks that do not; and what changed today, for later", () => {
    const books = one("books", {
      books: [
        { label: "Accounts payable", difference: 0 },
        { label: "Stock", difference: 1_500 },
      ],
    })!;
    expect(books).toMatchObject({ state: "todo", items: ["Stock · 1,500 IQD"] });
    expect(books.go.href).toBe("/reports#reconciliation");
    expect(one("books", { books: [{ label: "Stock", difference: 0 }] })?.state).toBe("done");
    const audit = one("audit", { audit: { changes: 12, more: false } })!;
    expect(audit).toMatchObject({ state: "later", say: "12 changes recorded today." });
    expect(audit.go.href).toBe("/audit");
  });

  it("the close: for later in the day, to do from four in the afternoon", () => {
    expect(one("endDay", { hour: 10 })).toMatchObject({
      state: "later",
      go: { href: "/end-of-day" },
    });
    expect(one("endDay", { hour: 17 })?.state).toBe("todo");
  });
});

describe("the start of the day, folded into Today in the morning", () => {
  it("has the start of the day's steps, each shown when it was read", () => {
    expect(morningSteps({}, TODAY, NOW)).toEqual([]);
    const steps = morningSteps(
      {
        drawer: { session: null },
        boards: [
          [{ employeeId: "e", name: "Aram", inSince: null, shiftStarts: "2026-11-04T05:00:00Z" }],
        ],
        plan: { recipes: [{ recipe: "Vanilla", status: "enough", batches: 0 }] },
        orders: [{ status: "sent", expectedOn: TODAY, poNo: 1, lines: [{ itemId: "milk" }] }],
        stock: [
          { itemId: "milk", isLow: true, isNegative: false },
          { itemId: "cups", isLow: true, isNegative: false },
        ],
        alerts: [],
      },
      TODAY,
      NOW,
    );
    expect(steps).toEqual([
      { key: "drawer", state: "left" },
      { key: "staff", state: "left" },
      { key: "make", state: "done" },
      { key: "deliveries", state: "left" },
      // The milk is on its order; the cups are on none.
      { key: "buy", state: "left" },
      { key: "alerts", state: "done" },
    ]);
  });

  it("says how far it has come and what is left, and is done once everything is", () => {
    const left = one("startDay", {
      morning: { drawer: { session: null }, alerts: [] },
    })!;
    expect(left).toMatchObject({
      state: "todo",
      say: "1 of 2 done",
      items: ["Drawer open and counted"],
      go: { href: "/start-of-day" },
    });
    const ready = one("startDay", { morning: { drawer: { session: {} }, alerts: [] } })!;
    expect(ready.state).toBe("done");
    expect(one("startDay", { morning: {} })).toBeUndefined();
  });
});

describe("in Arabic and Kurdish", () => {
  it("has every phrase a job is said with from a map", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(TODAY_PHRASES.filter((p) => !words[p])).toEqual([]);
    }
  });

  it("says every job in the reader's language", () => {
    const everything: TodayFacts = facts({
      hour: 17,
      drawer: { session: { openedAt: "2026-11-04T05:02:00Z", cashier: "دانا" }, mayOpen: true },
      plan: { recipes: [{ recipe: "ڤانیلا", status: "make", batches: 2 }] },
      counts: { me: "me", mayCount: true, mayReview: false, counts: [count({})] },
      deliveries: [{ status: "sent", expectedOn: TODAY, poNo: 3, supplier: "شیر" }],
      transfers: { list: [{ no: 2, status: "sent", from: "مطبخ", toId: "b" }], places: ["b"] },
      order: [{ item: "شیر", status: "order" }],
      approvals: [{ kind: "loss", what: "قاوە", mine: false, mayApprove: true }],
      alerts: [alert({ title: "x" })],
      problems: { open: 1, reports: [{ what: "چاپکەر", status: "open" }] },
      watch: { findings: [{ status: "open", strength: "strong" }] },
      bills: [{ supplierName: "شیر", outstanding: 1_000, dueDate: "2026-11-01" }],
      bank: { open: [{ day: "2026-11-02", description: "کرێ", amount: 5 }] },
      payroll: [{ month: "2026-10-01", status: "approved" }],
      books: [{ label: "x", difference: 5 }],
      audit: { changes: 3, more: false },
    });
    const keys = [...jobsFor(perms("owner"), 17), "books", "audit"] as JobKey[];
    for (const locale of ["ar", "ckb"] as const) {
      const t = translator(builtInWords(locale));
      const jobs = todayJobs(keys, everything, {
        t,
        time: (iso) => iso.slice(11, 16),
        at: (iso) => iso.slice(0, 16),
        msg: (x) => x,
      });
      expect(jobs.length).toBe(keys.length);
      const said = jobs.flatMap((j) => [j.title, j.say, j.go.label, ...j.items]);
      expect(said.filter((x) => /[A-Za-z]{2,}/.test(x.replace(/\bIQD\b/g, "")))).toEqual([]);
    }
  });
});
