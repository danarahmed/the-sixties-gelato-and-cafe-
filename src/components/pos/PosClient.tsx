"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { DiningTable, OpenBill, PosItem } from "@/lib/db/pos";
import { recordSaleAction } from "@/lib/actions/sales";
import { listApproversAction, requestApprovalAction, type Approver } from "@/lib/actions/approvals";
import {
  cancelBillAction,
  payBillAction,
  printBillAction,
  saveBillAction,
  splitBillAction,
} from "@/lib/actions/pos";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { useOnline } from "@/components/AppShell";
import { useChannels } from "@/components/ChannelsProvider";
import { ProductPicker } from "./ProductPicker";
import { ChooseBill, FloorView } from "./FloorView";
import { OrderPanel, type Receipt } from "./OrderPanel";
import { PayDialog } from "./PayDialog";
import { SplitDialog } from "./SplitDialog";
import { ApproveDialog, CancelDialog, KeepDialog, MoveDialog, PrintingDialog } from "./Dialogs";
import { TablesEditor } from "./TablesEditor";
import {
  PrintSlip,
  ticketFor,
  type BaristaTicket,
  type PrintJob,
  type Slip,
  type TicketItem,
} from "./PrintSlip";
import {
  addLine,
  billChanged,
  billTitle,
  isDirty,
  isPlatform,
  itemCount,
  itemName,
  lineAmount,
  lineKey,
  lineName,
  approvalPercent,
  approvalRefused,
  discountAmount,
  discountParams,
  discountWhy,
  newBill,
  orderDue,
  orderFromBill,
  orderSubtotal,
  parseNumber,
  quickOrder,
  savedHasItems,
  signature,
  ticketChanges,
  ticketLines,
  type Discount,
  type DiscountRules,
  type MoneyRules,
  type Line,
  type Order,
  type Tender,
  type TicketLine,
} from "./model";
import { reasonKey } from "@/lib/reasons";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type Msg = { ok: boolean; text: string } | null;

/** A payment the till sent but never heard back about. */
interface Pending {
  kind: "quick" | "bill";
  /** Sent with every attempt: the database records it once, whatever happens. */
  key: string;
  tender: Tender;
  channel: SalesChannel;
  lines: { variantId: string; qty: number; note: string | null }[];
  tabId: string | null;
  version: number | null;
  title: string;
  received: number | null;
  job: PrintJob | null;
  /** A quick sale's discount, sent again with the retry. */
  discountPercent: string | null;
  discountAmount: string | null;
  /** Its reason and a manager's approval (0028). */
  discountReason: string | null;
  discountNote: string | null;
  approvalId: string | null;
  /**
   * The total the customer was shown. The database records the payment only
   * at this total (0025); null for a payment left by an older till screen.
   */
  expectedNet: string | null;
  /** A delivery platform's order number (0030), sent again with the retry. */
  platformOrderNo: string | null;
}

const PENDING_KEY = "sixties.pos.pending";
const AUTOPRINT_KEY = "sixties.pos.autoprint";
/** "0" when this till prints no barista's ticket; printed otherwise. */
const TICKET_KEY = "sixties.pos.ticket";

function loadPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pending> & {
      lines?: { variantId: string; qty: number | string; note?: string | null }[];
    };
    if (!p.key || !p.tender || !p.channel || !Array.isArray(p.lines)) return null;
    // A sale left behind by the previous till screen is a quick sale.
    return {
      kind: p.kind ?? "quick",
      key: p.key,
      tender: p.tender,
      channel: p.channel,
      lines: p.lines.map((l) => ({
        variantId: l.variantId,
        qty: Number(l.qty),
        note: l.note ?? null,
      })),
      tabId: p.tabId ?? null,
      version: p.version ?? null,
      title: p.title ?? "",
      received: p.received ?? null,
      job: p.job ?? null,
      discountPercent: p.discountPercent ?? null,
      discountAmount: p.discountAmount ?? null,
      discountReason: p.discountReason ?? null,
      discountNote: p.discountNote ?? null,
      approvalId: p.approvalId ?? null,
      expectedNet: p.expectedNet ?? null,
      platformOrderNo: p.platformOrderNo ?? null,
    };
  } catch {
    return null;
  }
}
function savePending(p: Pending | null) {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* private mode: the pending payment stays in memory only */
  }
}

/** JSON from one of the till's own routes; null when offline, signed out or refused. */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null; // offline or signed out: the banner and the next action say so
  }
}

/** The open bills as the database has them now. */
async function fetchBills(): Promise<OpenBill[] | null> {
  const body = await fetchJson<{ ok?: boolean; bills?: OpenBill[] }>("/api/pos/bills");
  return body?.ok && Array.isArray(body.bills) ? body.bills : null;
}

/** The menu at today's prices (0025): a till left open still sells at them. */
async function fetchMenu(): Promise<PosItem[] | null> {
  const body = await fetchJson<{ ok?: boolean; items?: PosItem[] }>("/api/pos/menu");
  return body?.ok && Array.isArray(body.items) && body.items.length > 0 ? body.items : null;
}

/** How often a till left open fetches today's prices, besides when it comes back to the front. */
const MENU_EVERY_MS = 10 * 60 * 1000;

type Dialog =
  | { kind: "pay"; key: string; tender: Tender; order: Order; title: string; error: string | null }
  | { kind: "split"; order: Order; title: string }
  | { kind: "keep" }
  | { kind: "named" }
  | { kind: "move" }
  | { kind: "cancel"; error: string | null }
  | {
      kind: "approve";
      what: string;
      percent: number;
      approvers: Approver[] | null;
      error: string | null;
    }
  | { kind: "choose"; table: DiningTable }
  | { kind: "tables" }
  | { kind: "printing" };

/**
 * The till. Two kinds of order share one screen: a quick sale at the counter,
 * paid there and then; and a bill for a table or a named customer, kept open
 * until the money comes — printed for them, split between them, moved to
 * another table. Either way the sale reaches the books only when it is paid,
 * once, with a key the till mints and reuses on every retry (audit H-01).
 */
export function PosClient({
  items: initialItems,
  tables,
  initialBills,
  canSeeCost,
  canVoid,
  canManageTables,
  businessName,
  cashierName,
  timezone,
  canDiscount,
  discountRules,
  money,
}: {
  items: PosItem[];
  tables: DiningTable[];
  initialBills: OpenBill[];
  canSeeCost: boolean;
  canVoid: boolean;
  canManageTables: boolean;
  businessName: string;
  cashierName: string;
  timezone: string;
  /** discount.apply */
  canDiscount: boolean;
  /** Above the cap a manager approves a discount, unless this person does (0028). */
  discountRules: DiscountRules;
  /** How the business rounds money and discounts, as the database does. */
  money: MoneyRules;
}) {
  const { t, locale } = useT();
  const { set: channelSet, name: channelName } = useChannels();
  const online = useOnline();
  // The menu as the page loaded it, then as fetched again while the till stays open.
  const [items, setItems] = useState<PosItem[]>(initialItems);
  const byId = useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  // The channels in use that sell something: a platform the café added is one more tab.
  const channels = useMemo(
    () => channelSet.inUse.filter((c) => items.some((i) => i.prices[c] !== undefined)),
    [items, channelSet],
  );
  const billChannels = channels.filter((c) => !isPlatform(c));
  const tableChannel: SalesChannel = billChannels.includes("dine_in")
    ? "dine_in"
    : (billChannels[0] ?? "dine_in");
  const floorTables = useMemo(() => tables.filter((tb) => tb.isActive), [tables]);
  const hasFloor = floorTables.length > 0 || canManageTables;

  const [bills, setBills] = useState<OpenBill[]>(initialBills);
  const [view, setView] = useState<"floor" | "menu">(floorTables.length > 0 ? "floor" : "menu");
  const [quick, setQuick] = useState<Order>(() =>
    quickOrder(channels.includes("takeaway") ? "takeaway" : (channels[0] ?? "takeaway")),
  );
  const [bill, setBill] = useState<Order | null>(null);
  const [showBill, setShowBill] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // What is waiting to print, one job after another: each job is one or more slips.
  const [printQueue, setPrintQueue] = useState<Slip[][]>([]);
  const [autoPrint, setAutoPrint] = useState(false);
  const [ticketOn, setTicketOn] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const panel = useRef<HTMLDivElement>(null);

  // The bill being worked on, readable at once by code that runs after an await.
  const billRef = useRef<Order | null>(null);
  const putBill = (o: Order | null) => {
    billRef.current = o;
    setBill(o);
  };
  // Bumped around every change this till makes, so a background refresh that
  // started before it cannot put back what the change replaced.
  const generation = useRef(0);
  const quiet = useRef(true);
  quiet.current = busy === null && dialog === null;
  // Prices are not changed under a payment that is waiting for its answer.
  const menuQuiet = useRef(true);
  menuQuiet.current = quiet.current && pending === null;

  const order = showBill && bill ? bill : quick;
  const title = (o: Order) =>
    o.kind === "quick"
      ? t("pos.quickSale")
      : billTitle(o, tables, o.label?.trim() || t("pos.newBill"));

  // ------------------------------------------------------------ sync
  function applyBills(list: OpenBill[]) {
    setBills(list);
    const cur = billRef.current;
    if (!cur || cur.tabId === null) return;
    const fresh = list.find((b) => b.tabId === cur.tabId);
    if (!fresh) {
      // Paid or cancelled on another till. Unsaved work here is kept, and saving it will say why it cannot be.
      if (!isDirty(cur)) {
        putBill(null);
        setShowBill(false);
        setMsg({ ok: true, text: `${title(cur)} — ${t("pos.closedElsewhere")}` });
      }
      return;
    }
    // Another till's change, a print, or a price that has changed since (0025).
    if (!isDirty(cur) && billChanged(cur, fresh)) putBill(orderFromBill(fresh));
  }
  const applyRef = useRef(applyBills);
  applyRef.current = applyBills;

  // Other tills' work, every 15 seconds and whenever the till comes back to the
  // front; today's prices every ten minutes and then too (0025).
  useEffect(() => {
    const tick = async () => {
      if (document.hidden || !navigator.onLine || !quiet.current) return;
      const g = generation.current;
      const list = await fetchBills();
      if (list && g === generation.current && quiet.current) applyRef.current(list);
    };
    const menuTick = async () => {
      if (document.hidden || !navigator.onLine || !menuQuiet.current) return;
      const fresh = await fetchMenu();
      if (fresh && menuQuiet.current) setItems(fresh);
    };
    const poll = window.setInterval(tick, 15000);
    const menuPoll = window.setInterval(menuTick, MENU_EVERY_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    const onVisible = () => {
      if (document.hidden) return;
      void tick();
      void menuTick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(menuPoll);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // A payment left unconfirmed before a reload is brought back for its retry.
  useEffect(() => {
    try {
      setAutoPrint(localStorage.getItem(AUTOPRINT_KEY) === "1");
      setTicketOn(localStorage.getItem(TICKET_KEY) !== "0");
    } catch {
      /* no storage: printing stays manual */
    }
    const p = loadPending();
    if (!p) return;
    const lines = p.lines.map((l) => ({
      key: lineKey(),
      variantId: l.variantId,
      qty: l.qty,
      note: l.note,
      lineId: null,
      fallbackName: null,
      billPrice: null,
    }));
    setPending(p);
    if (p.kind === "quick") {
      setQuick({ ...quickOrder(p.channel), lines });
    } else {
      const open = initialBills.find((b) => b.tabId === p.tabId);
      putBill(
        open
          ? orderFromBill(open)
          : {
              ...newBill(null, p.title, p.channel),
              tabId: p.tabId,
              version: p.version,
              lines,
              saved: signature(lines, null),
            },
      );
      setShowBill(true);
    }
    setView("menu");
    setMsg({ ok: false, text: t("pos.uncertain") });
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closing the page with unsaved changes on a bill asks first.
  useEffect(() => {
    const dirty = bill !== null && isDirty(bill);
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [bill]);

  // ------------------------------------------------------------ running an action
  async function run<T>(label: string, fn: () => Promise<Result<T>>): Promise<T | null> {
    if (!navigator.onLine) {
      setMsg({ ok: false, text: t("pos.offlineBlocked") });
      return null;
    }
    setBusy(label);
    setMsg(null);
    generation.current++;
    try {
      const r = await fn();
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        if (approvalRefused(r.error)) dropApproval();
        return null;
      }
      return r.data;
    } catch {
      setMsg({ ok: false, text: t("pos.noAnswer") });
      return null;
    } finally {
      generation.current++;
      setBusy(null);
    }
  }

  const printLines = (o: Order) =>
    o.lines.map((l) => ({
      name: lineName(l, byId, locale),
      qty: l.qty,
      amount: lineAmount(l, byId, o.channel)?.toNumber() ?? null,
      note: l.note,
    }));

  /** Send slips to the printer, after whatever is printing now. */
  const print = (slips: (Slip | null)[]) => {
    const job = slips.filter((x): x is Slip => x !== null);
    if (job.length > 0) setPrintQueue((q) => [...q, job]);
  };

  /** Lines as the barista's ticket names them. */
  const ticketItems = (lines: TicketLine[], known: Line[]): TicketItem[] =>
    lines.map((l) => {
      const line = known.find((k) => k.variantId === l.variantId);
      const item = byId.get(l.variantId);
      return {
        name: line ? lineName(line, byId, locale) : item ? itemName(item, locale) : "—",
        qty: l.qty,
        note: l.note,
      };
    });

  /**
   * The barista's ticket for a bill: what was added since the bar last had
   * it, and what was taken off; or, as a copy, the whole order again. Null
   * when there is nothing to tell the bar.
   */
  const barTicket = (o: Order, known: Line[], copy = false): BaristaTicket | null => {
    const { added, removed } = copy
      ? { added: ticketLines(o.lines), removed: [] }
      : ticketChanges(o.sent, ticketLines(o.lines));
    if (added.length === 0 && removed.length === 0) return null;
    return {
      kind: "ticket",
      turnNo: o.turnNo,
      title: title(o),
      channelLabel: channelName(o.channel),
      lines: ticketItems(added, known),
      removed: ticketItems(removed, known),
      more: !copy && o.sent.length > 0,
      copy,
      at: new Date().toISOString(),
      by: cashierName,
    };
  };

  /** "Discount 10% · −500 IQD", under the total when taking the money. */
  const discountNote = (o: Order): string | null => {
    const tt = printTotals(o);
    if (tt.discount <= 0) return null;
    return `${t("pos.discount")}${tt.discountLabel ? ` ${tt.discountLabel}` : ""} · −${fmtIQD(tt.discount)}`;
  };

  /** Subtotal, discount and what is due, for a printed bill or receipt. */
  const printTotals = (o: Order) => {
    const subtotal = orderSubtotal(o, byId, money);
    const discount = discountAmount(o.discount, subtotal, money);
    const pct = o.discount?.kind === "percent" ? parseNumber(o.discount.value) : null;
    return {
      subtotal: subtotal.toNumber(),
      discount: discount.toNumber(),
      discountLabel: pct && discount.gt(0) ? `${pct.toString()}%` : null,
      total: subtotal.minus(discount).toNumber(),
    };
  };

  // ------------------------------------------------------------ the order
  function patchOrder(fn: (o: Order) => Order) {
    if (showBill && billRef.current) putBill(fn(billRef.current));
    else setQuick(fn);
  }
  function add(variantId: string) {
    if (pending || busy) return;
    setReceipt(null);
    setMsg(null);
    patchOrder((o) => ({ ...o, lines: addLine(o.lines, variantId) }));
  }
  function changeQty(key: string, delta: number) {
    patchOrder((o) => ({
      ...o,
      lines: o.lines
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    }));
  }
  function setNote(key: string, note: string | null) {
    patchOrder((o) => ({ ...o, lines: o.lines.map((l) => (l.key === key ? { ...l, note } : l)) }));
  }
  function setChannel(c: SalesChannel) {
    if (pending || busy) return;
    // A delivery platform sets its own discounts: none goes with its orders.
    patchOrder((o) =>
      o.kind === "quick" || o.tabId === null
        ? { ...o, channel: c, discount: isPlatform(c) ? null : o.discount }
        : o,
    );
  }
  function setDiscount(d: Discount | null) {
    if (pending || busy) return;
    setReceipt(null);
    patchOrder((o) => ({ ...o, discount: d }));
  }

  /** An approval the database would not take: the discount asks for a manager again. */
  function dropApproval() {
    patchOrder((o) =>
      o.discount?.approval ? { ...o, discount: { ...o.discount, approval: null } } : o,
    );
  }

  /** A manager approves the discount on screen with their name and PIN (0028). */
  async function askApproval() {
    const o = showBill && billRef.current ? billRef.current : quick;
    const d = o.discount;
    if (!d || busy) return;
    const subtotal = orderSubtotal(o, byId, money);
    const percent = approvalPercent(d, subtotal);
    const what = [
      `${percent}%`,
      `−${fmtIQD(discountAmount(d, subtotal, money).toNumber())}`,
      d.reason
        ? d.reason === "other"
          ? d.note?.trim()
          : t(reasonKey("discount", d.reason))
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    setDialog({ kind: "approve", what, percent, approvers: null, error: null });
    const r = await listApproversAction("discount");
    setDialog((cur) =>
      cur?.kind === "approve"
        ? { ...cur, approvers: r.ok ? r.data : [], error: r.ok ? null : r.error }
        : cur,
    );
  }

  async function confirmApproval(approverId: string, pin: string) {
    if (dialog?.kind !== "approve") return;
    const percent = dialog.percent;
    setBusy("approve");
    try {
      const r = await requestApprovalAction({
        kind: "discount",
        approverId,
        pin,
        scope: { percent },
      });
      if (!r.ok) {
        setDialog((cur) => (cur?.kind === "approve" ? { ...cur, error: r.error } : cur));
        return;
      }
      patchOrder((o) =>
        o.discount
          ? {
              ...o,
              discount: {
                ...o.discount,
                approval: { id: r.data.approvalId, by: r.data.approver, percent },
              },
            }
          : o,
      );
      setDialog(null);
    } catch {
      setDialog((cur) => (cur?.kind === "approve" ? { ...cur, error: t("pos.noAnswer") } : cur));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Save the bill on screen (open it, if new) and return it as the database
   * now has it. A till that prints by itself sends the bar a ticket for what
   * changed, unless the caller prints it (the Barista ticket button).
   */
  async function saveBill(o: Order, tellBar = true): Promise<Order | null> {
    const data = await run("save", () =>
      saveBillAction({
        tabId: o.tabId,
        version: o.version,
        channel: o.channel,
        tableId: o.tableId,
        label: o.label?.trim() || null,
        lines: o.lines.map((l) => ({ variantId: l.variantId, qty: String(l.qty), note: l.note })),
        ...discountParams(o.discount),
        ...discountWhy(o.discount),
      }),
    );
    if (!data) return null;
    const fresh = data.bills?.find((b) => b.tabId === data.tabId);
    const saved = fresh
      ? orderFromBill(fresh)
      : {
          ...o,
          tabId: data.tabId,
          version: data.version,
          saved: signature(o.lines, o.discount),
        };
    // What the bar has had: all of it once its ticket is printed; otherwise
    // what it had before, for the Barista ticket button to send.
    let sent = o.sent;
    if (tellBar && autoPrint && ticketOn) {
      print([barTicket({ ...saved, sent: o.sent }, [...saved.lines, ...o.lines])]);
      sent = ticketLines(saved.lines);
    }
    const next = { ...saved, sent };
    putBill(next);
    if (data.bills) applyBills(data.bills);
    return next;
  }

  /** Leave the bill on screen, saving what was added to it: nothing typed is lost. */
  async function leaveBill(): Promise<boolean> {
    const cur = billRef.current;
    if (!cur) return true;
    if (!(cur.tabId === null && cur.lines.length === 0) && isDirty(cur)) {
      if (!(await saveBill(cur))) return false;
    }
    putBill(null);
    setShowBill(false);
    return true;
  }

  async function openTable(tb: DiningTable) {
    if (pending || busy) return;
    const own = bills.filter((b) => b.tableId === tb.id);
    if (own.length > 1) {
      setDialog({ kind: "choose", table: tb });
      return;
    }
    if (own.length === 1) return openBill(own[0]!);
    await startBill(tb);
  }

  async function startBill(tb: DiningTable) {
    setDialog(null);
    if (!(await leaveBill())) return;
    putBill(newBill(tb, null, tableChannel));
    setShowBill(true);
    setView("menu");
    setReceipt(null);
    setMsg(null);
  }

  async function openBill(b: OpenBill) {
    if (pending || busy) return;
    setDialog(null);
    if (billRef.current?.tabId === b.tabId) {
      setShowBill(true);
      setView("menu");
      return;
    }
    if (!(await leaveBill())) return;
    putBill(orderFromBill(b));
    setShowBill(true);
    setView("menu");
    setReceipt(null);
    setMsg(null);
  }

  async function showQuick() {
    if (pending || busy) return;
    if (!(await leaveBill())) return;
    setView("menu");
  }

  async function startNamed(choice: { label: string | null; channel: SalesChannel }) {
    setDialog(null);
    if (!(await leaveBill())) return;
    putBill(newBill(null, choice.label, choice.channel));
    setShowBill(true);
    setView("menu");
    setReceipt(null);
  }

  /** A quick sale the customer will pay for later: kept open under their name or at a table. */
  async function keepForLater(choice: { label: string | null; tableId: string | null }) {
    const o = quick;
    const data = await run("save", () =>
      saveBillAction({
        tabId: null,
        version: null,
        channel: o.channel,
        tableId: choice.tableId,
        label: choice.label,
        lines: o.lines.map((l) => ({ variantId: l.variantId, qty: String(l.qty), note: l.note })),
        ...discountParams(o.discount),
        ...discountWhy(o.discount),
      }),
    );
    setDialog(null);
    if (!data) return;
    // The order is placed now, to be paid later: the bar makes it now.
    if (autoPrint && ticketOn) {
      const kept = data.bills?.find((b) => b.tabId === data.tabId);
      print([
        {
          kind: "ticket",
          turnNo: kept?.turnNo ?? null,
          title: billTitle(choice, tables, choice.label ?? ""),
          channelLabel: channelName(o.channel),
          lines: ticketItems(ticketLines(o.lines), o.lines),
          at: new Date().toISOString(),
          by: cashierName,
        },
      ]);
    }
    setQuick((q) => quickOrder(q.channel));
    if (data.bills) applyBills(data.bills);
    setMsg({
      ok: true,
      text: `${billTitle(choice, tables, choice.label ?? "")} — ${t("pos.keptOpen")}`,
    });
  }

  async function saveAndClose() {
    const cur = billRef.current;
    if (!cur) return;
    const saved = await saveBill(cur);
    if (!saved) return;
    putBill(null);
    setShowBill(false);
    setMsg({ ok: true, text: `${title(saved)} — ${t("pos.saved")}` });
    if (floorTables.length > 0) setView("floor");
  }

  /** Save if needed; the bill as the database has it, ready to print, split or pay. */
  async function current(): Promise<Order | null> {
    const cur = billRef.current;
    if (!cur) return null;
    return cur.tabId === null || isDirty(cur) ? saveBill(cur) : cur;
  }

  async function printBill() {
    const o = await current();
    if (!o || o.tabId === null || o.version === null) return;
    const data = await run("print", () =>
      printBillAction({ tabId: o.tabId!, version: o.version! }),
    );
    if (!data) return;
    if (data.bills) applyBills(data.bills);
    print([
      {
        kind: "bill",
        title: title(o),
        channelLabel: channelName(o.channel),
        lines: printLines(o),
        ...printTotals(o),
        printCount: data.printCount,
        turnNo: o.turnNo,
        at: new Date().toISOString(),
        by: cashierName,
      },
    ]);
  }

  /**
   * The barista's ticket for the bill on screen: what the bar has not had
   * yet (saved first, if need be), or, when it has had it all, the whole
   * order again, marked as a copy.
   */
  async function sendTicket() {
    const cur = billRef.current;
    if (!cur) return;
    const o = cur.tabId === null || isDirty(cur) ? await saveBill(cur, false) : cur;
    if (!o) return;
    const ticket = barTicket(o, [...o.lines, ...cur.lines]) ?? barTicket(o, o.lines, true);
    if (!ticket) return;
    print([ticket]);
    if (billRef.current?.tabId === o.tabId) {
      putBill({ ...billRef.current, sent: ticketLines(o.lines) });
    }
  }

  async function openSplit() {
    const o = await current();
    if (o) setDialog({ kind: "split", order: o, title: title(o) });
  }

  async function confirmSplit(move: { lineId: string; qty: number }[], label: string) {
    if (dialog?.kind !== "split") return;
    const o = dialog.order;
    const data = await run("split", () =>
      splitBillAction({
        tabId: o.tabId!,
        version: o.version!,
        move: move.map((m) => ({ lineId: m.lineId, qty: String(m.qty) })),
        label: label || null,
      }),
    );
    setDialog(null);
    if (!data) return;
    if (data.bills) {
      setBills(data.bills);
      // Show the new bill, ready to be paid; the rest of the table keeps its own.
      const created = data.bills.find((b) => b.tabId === data.tabId);
      if (created) {
        putBill(orderFromBill(created));
        setShowBill(true);
      }
    }
    setMsg({ ok: true, text: t("pos.splitDone") });
  }

  async function moveTo(tableId: string) {
    const cur = billRef.current;
    if (!cur) return;
    setDialog(null);
    if (cur.tabId === null) {
      putBill({ ...cur, tableId });
      return;
    }
    const saved = await saveBill({ ...cur, tableId });
    if (saved) setMsg({ ok: true, text: `${t("pos.movedTo")} ${title(saved)}` });
  }

  function askCancel() {
    const cur = billRef.current;
    if (!cur) return;
    if (cur.tabId === null) {
      putBill(null);
      setShowBill(false);
      if (floorTables.length > 0) setView("floor");
      return;
    }
    setDialog({ kind: "cancel", error: null });
  }

  async function confirmCancel(reason: { code: string | null; note: string | null }) {
    const cur = billRef.current;
    if (!cur?.tabId || cur.version === null) return;
    setBusy("cancel");
    generation.current++;
    try {
      const r = await cancelBillAction({
        tabId: cur.tabId,
        version: cur.version,
        reasonCode: reason.code,
        note: reason.note,
      });
      if (!r.ok) {
        setDialog({ kind: "cancel", error: r.error });
        return;
      }
      setDialog(null);
      putBill(null);
      setShowBill(false);
      if (r.data.bills) applyBills(r.data.bills);
      setMsg({ ok: true, text: `${title(cur)} — ${t("pos.billCancelled")}` });
      if (floorTables.length > 0) setView("floor");
    } catch {
      setDialog({ kind: "cancel", error: t("pos.noAnswer") });
    } finally {
      generation.current++;
      setBusy(null);
    }
  }

  // ------------------------------------------------------------ taking the money
  async function startPay(tender: Tender) {
    if (pending || busy || order.lines.length === 0) return;
    if (!navigator.onLine) {
      setMsg({ ok: false, text: t("pos.offlineBlocked") });
      return;
    }
    let o = order;
    if (o.kind === "bill") {
      const saved = await current();
      if (!saved) return;
      o = saved;
    }
    setDialog({
      kind: "pay",
      key: crypto.randomUUID(),
      tender,
      order: o,
      title: title(o),
      error: null,
    });
  }

  async function confirmPay(tender: Tender, received: number | null, orderNo: string | null) {
    if (dialog?.kind !== "pay" || busy) return;
    const o = dialog.order;
    await sendPayment({
      kind: o.kind,
      key: dialog.key,
      tender,
      channel: o.channel,
      lines: o.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, note: l.note })),
      tabId: o.tabId,
      version: o.version,
      title: dialog.title,
      received,
      ...(o.kind === "quick"
        ? { ...discountParams(o.discount), ...discountWhy(o.discount) }
        : {
            discountPercent: null,
            discountAmount: null,
            discountReason: null,
            discountNote: null,
            approvalId: null,
          }),
      // What the dialog showed: the database takes the money only at this total.
      expectedNet: orderDue(o, byId, money).toFixed(),
      platformOrderNo: isPlatform(o.channel) ? orderNo : null,
      job: {
        kind: "receipt",
        title: dialog.title,
        channelLabel: channelName(o.channel),
        lines: printLines(o),
        ...printTotals(o),
        tender,
        received,
        platformOrderNo: isPlatform(o.channel) ? orderNo : null,
        turnNo: o.turnNo,
        at: new Date().toISOString(),
        by: cashierName,
      },
    });
  }

  async function sendPayment(p: Pending) {
    setBusy("pay");
    setMsg(null);
    generation.current++;
    try {
      const r =
        p.kind === "quick"
          ? await recordSaleAction({
              key: p.key,
              channel: p.channel,
              tender: p.tender,
              lines: p.lines.map((l) => ({ variantId: l.variantId, qty: String(l.qty) })),
              discountPercent: p.discountPercent,
              discountAmount: p.discountAmount,
              discountReason: p.discountReason,
              discountNote: p.discountNote,
              approvalId: p.approvalId,
              expectedNet: p.expectedNet,
              platformOrderNo: p.platformOrderNo,
            })
          : await payBillAction({
              tabId: p.tabId!,
              version: p.version!,
              key: p.key,
              tender: p.tender,
              expectedNet: p.expectedNet,
            });
      if (!r.ok && r.uncertain) {
        // No answer from the database: it may have been recorded. Freeze, and
        // retry with the SAME key, which cannot record it twice.
        setPending(p);
        savePending(p);
        setDialog(null);
        setMsg({ ok: false, text: t("pos.uncertain") });
        return;
      }
      if (!r.ok) {
        // The database refused it: nothing was recorded, and the order is still here.
        setPending(null);
        savePending(null);
        if (approvalRefused(r.error)) dropApproval();
        if (dialogRef.current?.kind === "pay") setDialog({ ...dialogRef.current, error: r.error });
        else setMsg({ ok: false, text: r.error });
        // A price, or the bill, may have changed since this till last looked.
        // If what is owed has, the order is shown as it now stands, so the
        // customer is told before the money is taken again.
        if (await catchUp(p)) {
          setDialog(null);
          setMsg({ ok: false, text: r.error });
        }
        return;
      }
      const net = r.data.net;
      const change =
        p.received !== null ? Decimal.max(0, new Decimal(p.received).minus(net)).toNumber() : null;
      // The printed receipt shows what the database recorded, discount included.
      const job: PrintJob | null = p.job
        ? {
            ...p.job,
            total: net,
            subtotal: r.data.gross,
            discount: r.data.discount,
            change,
            reference: r.data.orderId.slice(0, 8),
            platformOrderNo: r.data.platformOrderNo ?? p.platformOrderNo,
            journalNo: r.data.journalNo,
            turnNo: r.data.turnNo ?? p.job.turnNo ?? null,
          }
        : null;
      // A quick sale goes to the bar as it is paid; a bill went when it was saved.
      const ticket = p.kind === "quick" && job ? ticketFor(job) : null;
      const autoTicket = autoPrint && ticketOn && ticket !== null;
      setReceipt({
        ...r.data,
        tender: p.tender,
        change,
        job: job ?? emptyJob(p, r.data.orderId, net, r.data.turnNo),
        ticket,
        ticketPrinted: autoTicket,
      });
      setMsg(r.data.replayed ? { ok: true, text: t("pos.replayed") } : null);
      setPending(null);
      savePending(null);
      setDialog(null);
      if (p.kind === "quick") {
        setQuick((q) => quickOrder(q.channel));
      } else {
        putBill(null);
        setShowBill(false);
        const list = "bills" in r.data ? (r.data as { bills: OpenBill[] | null }).bills : null;
        if (list) applyBills(list);
        if (floorTables.length > 0) setView("floor");
      }
      // Two copies, cut apart: the customer's check, and the barista's ticket.
      if (autoPrint) print([job, autoTicket ? ticket : null]);
    } catch {
      // No answer: it may or may not have been recorded. Freeze, and retry
      // with the SAME key, which cannot record it twice.
      setPending(p);
      savePending(p);
      setDialog(null);
      setMsg({ ok: false, text: t("pos.uncertain") });
    } finally {
      generation.current++;
      setBusy(null);
    }
  }
  const dialogRef = useRef<Dialog | null>(null);
  dialogRef.current = dialog;

  /**
   * After a refusal: today's prices and the open bills, as the database has
   * them now (0025). True when what the payment was for has changed: a price
   * on it, or the bill itself.
   */
  async function catchUp(p: Pending): Promise<boolean> {
    try {
      const [fresh, list] = await Promise.all([fetchMenu(), fetchBills()]);
      if (fresh) setItems(fresh);
      if (list) applyRef.current(list);
      if (p.kind === "bill") {
        if (!list) return false;
        const b = list.find((x) => x.tabId === p.tabId);
        return (
          !b ||
          b.version !== p.version ||
          (p.expectedNet !== null && !new Decimal(b.total).eq(p.expectedNet))
        );
      }
      if (!fresh) return false;
      const now = new Map(fresh.map((i) => [i.variantId, i]));
      return p.lines.some(
        (l) => byId.get(l.variantId)?.prices[p.channel] !== now.get(l.variantId)?.prices[p.channel],
      );
    } catch {
      // Catching up is a courtesy: the refusal stands, and is shown, either way.
      return false;
    }
  }

  const emptyJob = (p: Pending, orderId: string, net: number, turnNo: number | null): PrintJob => ({
    kind: "receipt",
    title: p.title,
    channelLabel: channelName(p.channel),
    lines: [],
    total: net,
    tender: p.tender,
    reference: orderId.slice(0, 8),
    platformOrderNo: p.platformOrderNo,
    turnNo,
    at: new Date().toISOString(),
    by: cashierName,
  });

  function discardPending() {
    const p = pending;
    setPending(null);
    savePending(null);
    if (p?.kind === "bill") {
      putBill(null);
      setShowBill(false);
      setMsg({ ok: false, text: t("pos.discardBillWarning") });
    } else {
      setQuick((q) => quickOrder(q.channel));
      setMsg({ ok: false, text: t("pos.discardWarning") });
    }
  }

  function toggleAutoPrint(v: boolean) {
    setAutoPrint(v);
    try {
      localStorage.setItem(AUTOPRINT_KEY, v ? "1" : "0");
    } catch {
      /* not remembered on this till */
    }
  }
  function toggleTicket(v: boolean) {
    setTicketOn(v);
    try {
      localStorage.setItem(TICKET_KEY, v ? "1" : "0");
    } catch {
      /* not remembered on this till */
    }
  }

  /** The sale just paid, printed: with the barista's ticket, the first time. */
  function printReceipt() {
    if (!receipt) return;
    const withTicket = ticketOn && receipt.ticket !== null && !receipt.ticketPrinted;
    print([receipt.job, withTicket ? receipt.ticket : null]);
    if (withTicket) setReceipt({ ...receipt, ticketPrinted: true });
  }
  /** The barista's ticket alone: again, marked as a copy, if the bar has had it. */
  function printReceiptTicket() {
    if (!receipt?.ticket) return;
    print([{ ...receipt.ticket, copy: receipt.ticketPrinted }]);
    setReceipt({ ...receipt, ticketPrinted: true });
  }

  /** A sample check and ticket, to set the printer up by. */
  function testPrint() {
    const sample = items.slice(0, 3);
    const job: PrintJob = {
      kind: "receipt",
      title: t("pos.testPrint"),
      channelLabel: channelName(channels[0] ?? "takeaway"),
      lines: sample.map((i, n) => ({
        name: itemName(i, locale),
        qty: n === 0 ? 2 : 1,
        amount: (i.prices[channels[0] ?? "takeaway"] ?? 0) * (n === 0 ? 2 : 1),
        note: n === 0 ? t("pos.sampleNote") : null,
      })),
      total: 0,
      tender: "cash",
      turnNo: 1,
      at: new Date().toISOString(),
      by: cashierName,
    };
    job.total = job.lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
    print([job, ticketOn ? ticketFor(job) : null]);
  }

  function fullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  // ------------------------------------------------------------ screen
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of order.lines) m.set(l.variantId, (m.get(l.variantId) ?? 0) + l.qty);
    return m;
  }, [order.lines]);
  const tableOrder = new Map(tables.map((tb, i) => [tb.id, i]));
  const strip = [...bills].sort(
    (a, b) =>
      (a.tableId ? (tableOrder.get(a.tableId) ?? 0) : 1e6) -
        (b.tableId ? (tableOrder.get(b.tableId) ?? 0) : 1e6) ||
      a.openedAt.localeCompare(b.openedAt),
  );
  const channelChoice =
    order.kind === "quick"
      ? channels
      : order.tabId === null && order.tableId === null
        ? billChannels
        : null;
  const blocked = pending !== null || busy !== null;
  const total = orderDue(order, byId, money);

  return (
    <div className="pos">
      <div className="pos-top">
        {hasFloor && (
          <div className="seg" role="tablist">
            <button
              role="tab"
              aria-selected={view === "floor"}
              className={view === "floor" ? "active" : ""}
              onClick={() => setView("floor")}
            >
              🪑 {t("pos.tables")}
            </button>
            <button
              role="tab"
              aria-selected={view === "menu"}
              className={view === "menu" ? "active" : ""}
              onClick={() => setView("menu")}
            >
              ☕ {t("pos.menu")}
            </button>
          </div>
        )}
        <div className="bill-strip" aria-label={t("pos.openBills")}>
          <button
            className={`strip-chip${!showBill ? " active" : ""}`}
            onClick={showQuick}
            disabled={blocked}
          >
            ⚡ {t("pos.quickSale")}
            {quick.lines.length > 0 && <span className="chip-n">{itemCount(quick)}</span>}
          </button>
          {strip.map((b) => (
            <button
              key={b.tabId}
              className={`strip-chip${showBill && bill?.tabId === b.tabId ? " active" : ""}${b.billPrintedAt ? " waiting" : ""}`}
              onClick={() => openBill(b)}
              disabled={blocked}
              title={b.billPrintedAt ? t("pos.waitingPayment") : t("pos.ordering")}
            >
              {b.billPrintedAt ? "🧾 " : ""}
              {billTitle(b, tables, b.label ?? "—")}
              <span className="mono chip-amt">{fmtIQD(b.total)}</span>
            </button>
          ))}
        </div>
        <button
          className={`icon-btn print-btn${autoPrint ? " on" : ""}`}
          onClick={() => setDialog({ kind: "printing" })}
          title={t("pos.printing")}
          aria-label={t("pos.printing")}
        >
          🖨
        </button>
        <button
          className="icon-btn"
          onClick={fullscreen}
          title={t("pos.fullscreen")}
          aria-label={t("pos.fullscreen")}
        >
          ⛶
        </button>
      </div>

      <div className="pos-grid">
        <div className="pos-main">
          {view === "floor" && hasFloor ? (
            <FloorView
              tables={floorTables}
              bills={bills}
              now={now}
              activeTabId={showBill ? (bill?.tabId ?? null) : null}
              onTable={openTable}
              onBill={openBill}
              onNamedBill={() => setDialog({ kind: "named" })}
              onEditTables={canManageTables ? () => setDialog({ kind: "tables" }) : null}
            />
          ) : (
            <ProductPicker
              items={items}
              channel={order.channel}
              counts={counts}
              disabled={blocked}
              onAdd={add}
            />
          )}
        </div>

        <div ref={panel} className="pos-side">
          <OrderPanel
            order={order}
            title={title(order)}
            byId={byId}
            busy={busy}
            pending={pending !== null}
            online={online}
            canVoid={canVoid}
            canSeeCost={canSeeCost}
            hasTables={floorTables.length > 0}
            receipt={receipt}
            msg={msg}
            channels={channelChoice}
            onChannel={setChannel}
            ticketOn={ticketOn}
            onQty={changeQty}
            onNote={setNote}
            onLabel={(label) => billRef.current && putBill({ ...billRef.current, label })}
            onPay={startPay}
            onSave={saveAndClose}
            onPrintBill={printBill}
            onTicket={sendTicket}
            onSplit={openSplit}
            onMove={() => setDialog({ kind: "move" })}
            onCancelBill={askCancel}
            onKeepForLater={() => setDialog({ kind: "keep" })}
            onClear={() => setQuick((q) => quickOrder(q.channel))}
            onRetry={() => pending && sendPayment(pending)}
            onDiscard={discardPending}
            onPrintReceipt={printReceipt}
            onPrintReceiptTicket={printReceiptTicket}
            now={now}
            canDiscount={canDiscount}
            money={money}
            discountRules={discountRules}
            onDiscount={setDiscount}
            onAskApproval={askApproval}
          />
        </div>
      </div>

      {order.lines.length > 0 && (
        <button
          className="pos-mobile-bar"
          onClick={() => panel.current?.scrollIntoView({ behavior: "smooth" })}
        >
          <span>
            🛒 {itemCount(order)} · {title(order)}
          </span>
          <strong className="mono">{fmtIQD(total.toNumber())}</strong>
        </button>
      )}

      {dialog?.kind === "pay" && (
        <PayDialog
          title={dialog.title}
          total={orderDue(dialog.order, byId, money).toNumber()}
          note={discountNote(dialog.order)}
          tenders={isPlatform(dialog.order.channel) ? ["platform_paid"] : ["cash", "card"]}
          initialTender={isPlatform(dialog.order.channel) ? "platform_paid" : dialog.tender}
          platform={isPlatform(dialog.order.channel) ? channelName(dialog.order.channel) : null}
          busy={busy === "pay"}
          error={dialog.error}
          onConfirm={confirmPay}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "split" && (
        <SplitDialog
          order={dialog.order}
          title={dialog.title}
          defaultLabel={
            dialog.order.tableId
              ? String(bills.filter((b) => b.tableId === dialog.order.tableId).length + 1)
              : `${dialog.order.label ?? ""} · 2`
          }
          byId={byId}
          busy={busy !== null}
          onConfirm={confirmSplit}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "keep" && (
        <KeepDialog
          title={t("pos.keepForLater")}
          tables={floorTables}
          bills={bills}
          channels={null}
          initialChannel={quick.channel}
          busy={busy !== null}
          onConfirm={keepForLater}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "named" && (
        <KeepDialog
          title={t("pos.billForName")}
          tables={null}
          bills={bills}
          channels={billChannels}
          initialChannel={billChannels.includes("takeaway") ? "takeaway" : tableChannel}
          busy={busy !== null}
          onConfirm={startNamed}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "move" && bill && (
        <MoveDialog
          tables={floorTables}
          bills={bills}
          currentTableId={bill.tableId}
          busy={busy !== null}
          onConfirm={moveTo}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "approve" && (
        <ApproveDialog
          what={dialog.what}
          approvers={dialog.approvers}
          busy={busy === "approve"}
          error={dialog.error}
          onConfirm={confirmApproval}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "cancel" && bill && (
        <CancelDialog
          title={title(bill)}
          needsReason={savedHasItems(bill)}
          busy={busy !== null}
          error={dialog.error}
          onConfirm={confirmCancel}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "choose" && (
        <ChooseBill
          title={dialog.table.name}
          bills={bills.filter((b) => b.tableId === dialog.table.id)}
          onBill={openBill}
          onNew={() => startBill(dialog.table)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "tables" && (
        <TablesEditor tables={tables} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "printing" && (
        <PrintingDialog
          autoPrint={autoPrint}
          ticketOn={ticketOn}
          onAutoPrint={toggleAutoPrint}
          onTicket={toggleTicket}
          onTest={testPrint}
          onClose={() => setDialog(null)}
        />
      )}

      <PrintSlip
        slips={printQueue[0] ?? null}
        businessName={businessName}
        timezone={timezone}
        onDone={nextPrint}
      />
    </div>
  );

  function nextPrint() {
    setPrintQueue((q) => q.slice(1));
  }
}
