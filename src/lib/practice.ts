/**
 * Practice (0096): the same app with pretend money and stock. While the
 * cookie below is set, every database call says it is practice, and the
 * database answers as the person's twin in their practice café; nothing of
 * it reaches the café's books. Pure: the screens and the tests read it.
 */

/** Set while practising; a session cookie, so closing the app ends it. */
export const PRACTICE_COOKIE = "sixties_practice";
/** The header every database call carries while practising. */
export const PRACTICE_HEADER = "x-sixties-practice";

export interface PracticeTaskInfo {
  /** What to do, as a phrase. */
  title: string;
  /** How, in a sentence. */
  how: string;
  /** Where it is done. */
  href: string;
}

/** Each task the database knows (practice_task_list), in English, with where it is done. */
export const PRACTICE_TASKS: Record<string, PracticeTaskInfo> = {
  open_drawer: {
    title: "Open the drawer and count it",
    how: "On the till, press the drawer button, count the cash in it and open it.",
    href: "/pos",
  },
  sell_card: {
    title: "Sell 2 small lattes, paid by card",
    how: "On the till, press Menu, tap Latte and choose Small, twice, then Card.",
    href: "/pos",
  },
  sell_cash: {
    title: "Sell for cash and give change",
    how: "Sell an espresso, choose Cash and type 5000 as what the customer gave: the till says the change.",
    href: "/pos",
  },
  discount: {
    title: "Give a 10% discount",
    how: "Before paying, press Discount, choose 10% and a reason.",
    href: "/pos",
  },
  table_bill: {
    title: "Serve a table: open its bill, add to it, then take payment",
    how: "On Tables, tap Table 1, add two items, keep the bill, open it again and take payment.",
    href: "/pos",
  },
  refund: {
    title: "Refund one item of a sale",
    how: "On Orders, find the sale, press Refund, choose the item and why.",
    href: "/orders",
  },
  void: {
    title: "Void a sale rung by mistake",
    how: "On Orders, find the sale, press Void and say why.",
    href: "/orders",
  },
  close_drawer: {
    title: "Count and close the drawer",
    how: "At the end of the shift, press the drawer button, count the cash and close it.",
    href: "/pos",
  },
  batch: {
    title: "Record a batch you made",
    how: "On Production, record a batch of the vanilla base: 5 L from milk and sugar.",
    href: "/production",
  },
  waste: {
    title: "Record something thrown away",
    how: "On Stock, press Record a loss, choose the item, how much and why.",
    href: "/inventory",
  },
  count: {
    title: "Count the stock and send the count",
    how: "On Stock Count, start a count, type what is on the shelf, and send it.",
    href: "/count",
  },
  approve_count: {
    title: "Review Omar's count and approve it",
    how: "On Stock Count, at the practice kitchen, open the count Omar sent, look at what is short, and approve it.",
    href: "/count",
  },
  order: {
    title: "Order from the supplier",
    how: "On Purchasing, make an order to the practice supplier, approve it and send it.",
    href: "/purchasing",
  },
  receive: {
    title: "Receive a delivery",
    how: "On Purchasing, receive what the supplier brought, with its prices.",
    href: "/purchasing",
  },
  transfer: {
    title: "Send stock from the kitchen to the branch",
    how: "On Transfers, send coffee beans from the practice kitchen to the practice branch.",
    href: "/inventory/transfers",
  },
  expense: {
    title: "Record an expense",
    how: "On Expenses, record what was paid, for what, and from where.",
    href: "/expenses",
  },
  price: {
    title: "Change a price",
    how: "On Products, open Espresso and give it a new price.",
    href: "/products",
  },
  reports: {
    title: "Open three reports",
    how: "On Reports, open any three, and read what each says.",
    href: "/reports",
  },
};

export interface PracticeTask {
  task: string;
  doneAt: string | null;
}

export interface PracticeState {
  started: boolean;
  startedAt: string | null;
  tasks: PracticeTask[];
}

export function practiceStateFrom(x: unknown): PracticeState {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const tasks = Array.isArray(o.tasks) ? (o.tasks as Record<string, unknown>[]) : [];
  return {
    started: o.started === true,
    startedAt: typeof o.started_at === "string" ? o.started_at : null,
    tasks: tasks
      .filter((t) => typeof t.task === "string" && t.task in PRACTICE_TASKS)
      .map((t) => ({
        task: String(t.task),
        doneAt: typeof t.done_at === "string" ? t.done_at : null,
      })),
  };
}

/** Ready: every task of their role done. */
export const isReady = (s: Pick<PracticeState, "tasks">) =>
  s.tasks.length > 0 && s.tasks.every((t) => t.doneAt !== null);

/** The next task to do: the first not done. */
export const nextTask = (s: Pick<PracticeState, "tasks">) =>
  s.tasks.find((t) => t.doneAt === null) ?? null;

export interface TeamMember {
  id: string;
  name: string;
  roles: string[];
  tasks: number;
  done: number;
  startedAt: string | null;
  lastDoneAt: string | null;
}

export function practiceTeamFrom(x: unknown): TeamMember[] {
  return (Array.isArray(x) ? (x as Record<string, unknown>[]) : []).map((p) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    roles: Array.isArray(p.roles) ? p.roles.map(String) : [],
    tasks: Number(p.tasks) || 0,
    done: Number(p.done) || 0,
    startedAt: typeof p.started_at === "string" ? p.started_at : null,
    lastDoneAt: typeof p.last_done_at === "string" ? p.last_done_at : null,
  }));
}

/** A device's own storage, kept apart while practising: a practice sale kept offline never goes to the books. */
export function practiceScoped(key: string): string {
  if (typeof document === "undefined") return key;
  return document.cookie.split("; ").includes(`${PRACTICE_COOKIE}=1`) ? `${key}.practice` : key;
}
