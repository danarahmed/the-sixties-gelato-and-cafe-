"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { DiningTable, OpenBill, PosItem } from "@/lib/db/pos";
import { recordSaleAction } from "@/lib/actions/sales";
import {
  cancelBillAction,
  payBillAction,
  printBillAction,
  saveBillAction,
  splitBillAction,
} from "@/lib/actions/pos";
import { fmtIQD, SELLABLE_CHANNELS } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { useOnline } from "@/components/AppShell";
import { ProductPicker } from "./ProductPicker";
import { ChooseBill, FloorView } from "./FloorView";
import { OrderPanel, type Receipt } from "./OrderPanel";
import { PayDialog } from "./PayDialog";
import { SplitDialog } from "./SplitDialog";
import { CancelDialog, KeepDialog, MoveDialog } from "./Dialogs";
import { TablesEditor } from "./TablesEditor";
import { PrintSlip, type PrintJob } from "./PrintSlip";
import {
  addLine,
  billTitle,
  isDirty,
  isPlatform,
  itemCount,
  lineAmount,
  lineKey,
  lineName,
  discountAmount,
  discountParams,
  newBill,
  orderDue,
  orderFromBill,
  orderSubtotal,
  parseNumber,
  quickOrder,
  savedHasItems,
  signature,
  type Discount,
  type MoneyRules,
  type Order,
  type Tender,
} from "./model";

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
}

const PENDING_KEY = "sixties.pos.pending";
const AUTOPRINT_KEY = "sixties.pos.autoprint";

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

type Dialog =
  | { kind: "pay"; key: string; tender: Tender; order: Order; title: string; error: string | null }
  | { kind: "split"; order: Order; title: string }
  | { kind: "keep" }
  | { kind: "named" }
  | { kind: "move" }
  | { kind: "cancel"; error: string | null }
  | { kind: "choose"; table: DiningTable }
  | { kind: "tables" };

/**
 * The till. Two kinds of order share one screen: a quick sale at the counter,
 * paid there and then; and a bill for a table or a named customer, kept open
 * until the money comes — printed for them, split between them, moved to
 * another table. Either way the sale reaches the books only when it is paid,
 * once, with a key the till mints and reuses on every retry (audit H-01).
 */
export function PosClient({
  items,
  tables,
  initialBills,
  canSeeCost,
  canVoid,
  canManageTables,
  businessName,
  cashierName,
  timezone,
  canDiscount,
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
  /** How the business rounds money and discounts, as the database does. */
  money: MoneyRules;
}) {
  const { t, locale } = useT();
  const online = useOnline();
  const byId = useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  const channels = useMemo(
    () => SELLABLE_CHANNELS.filter((c) => items.some((i) => i.prices[c] !== undefined)),
    [items],
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
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
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
    if (
      !isDirty(cur) &&
      (fresh.version !== cur.version ||
        fresh.billPrintedAt !== cur.printedAt ||
        fresh.billPrintCount !== cur.printCount)
    ) {
      putBill(orderFromBill(fresh));
    }
  }
  const applyRef = useRef(applyBills);
  applyRef.current = applyBills;

  // Other tills' work, every 15 seconds and whenever the till comes back to the front.
  useEffect(() => {
    const tick = async () => {
      if (document.hidden || !navigator.onLine || !quiet.current) return;
      const g = generation.current;
      try {
        const res = await fetch("/api/pos/bills", {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { ok?: boolean; bills?: OpenBill[] };
        if (body.ok && Array.isArray(body.bills) && g === generation.current && quiet.current) {
          applyRef.current(body.bills);
        }
      } catch {
        /* offline or signed out: the banner and the next action say so */
      }
    };
    const poll = window.setInterval(tick, 15000);
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // A payment left unconfirmed before a reload is brought back for its retry.
  useEffect(() => {
    try {
      setAutoPrint(localStorage.getItem(AUTOPRINT_KEY) === "1");
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
      fallbackPrice: null,
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

  /** Save the bill on screen (open it, if new) and return it as the database now has it. */
  async function saveBill(o: Order): Promise<Order | null> {
    const data = await run("save", () =>
      saveBillAction({
        tabId: o.tabId,
        version: o.version,
        channel: o.channel,
        tableId: o.tableId,
        label: o.label?.trim() || null,
        lines: o.lines.map((l) => ({ variantId: l.variantId, qty: String(l.qty), note: l.note })),
        ...discountParams(o.discount),
      }),
    );
    if (!data) return null;
    const fresh = data.bills?.find((b) => b.tabId === data.tabId);
    const next = fresh
      ? orderFromBill(fresh)
      : {
          ...o,
          tabId: data.tabId,
          version: data.version,
          saved: signature(o.lines, o.discount),
        };
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
      }),
    );
    setDialog(null);
    if (!data) return;
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
    setPrintJob({
      kind: "bill",
      title: title(o),
      channelLabel: t(`pos.channel.${o.channel}`),
      lines: printLines(o),
      ...printTotals(o),
      printCount: data.printCount,
      at: new Date().toISOString(),
      by: cashierName,
    });
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

  async function confirmCancel(reason: string | null) {
    const cur = billRef.current;
    if (!cur?.tabId || cur.version === null) return;
    setBusy("cancel");
    generation.current++;
    try {
      const r = await cancelBillAction({ tabId: cur.tabId, version: cur.version, reason });
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

  async function confirmPay(tender: Tender, received: number | null) {
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
        ? discountParams(o.discount)
        : { discountPercent: null, discountAmount: null }),
      job: {
        kind: "receipt",
        title: dialog.title,
        channelLabel: t(`pos.channel.${o.channel}`),
        lines: printLines(o),
        ...printTotals(o),
        tender,
        received,
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
            })
          : await payBillAction({
              tabId: p.tabId!,
              version: p.version!,
              key: p.key,
              tender: p.tender,
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
        if (dialogRef.current?.kind === "pay") setDialog({ ...dialogRef.current, error: r.error });
        else setMsg({ ok: false, text: r.error });
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
            journalNo: r.data.journalNo,
          }
        : null;
      setReceipt({
        ...r.data,
        tender: p.tender,
        change,
        job: job ?? emptyJob(p, r.data.orderId, net),
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
      if (autoPrint && job) setPrintJob(job);
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

  const emptyJob = (p: Pending, orderId: string, net: number): PrintJob => ({
    kind: "receipt",
    title: p.title,
    channelLabel: t(`pos.channel.${p.channel}`),
    lines: [],
    total: net,
    tender: p.tender,
    reference: orderId.slice(0, 8),
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
            <>
              {channelChoice && channelChoice.length > 1 && (
                <div className="channel-tabs">
                  {channelChoice.map((c) => (
                    <button
                      key={c}
                      className={c === order.channel ? "active" : ""}
                      onClick={() => setChannel(c)}
                      disabled={blocked && c !== order.channel}
                    >
                      {t(`pos.channel.${c}`)}
                    </button>
                  ))}
                </div>
              )}
              <ProductPicker
                items={items}
                channel={order.channel}
                counts={counts}
                disabled={blocked}
                onAdd={add}
              />
            </>
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
            autoPrint={autoPrint}
            onAutoPrint={toggleAutoPrint}
            onQty={changeQty}
            onNote={setNote}
            onLabel={(label) => billRef.current && putBill({ ...billRef.current, label })}
            onPay={startPay}
            onSave={saveAndClose}
            onPrintBill={printBill}
            onSplit={openSplit}
            onMove={() => setDialog({ kind: "move" })}
            onCancelBill={askCancel}
            onKeepForLater={() => setDialog({ kind: "keep" })}
            onClear={() => setQuick((q) => quickOrder(q.channel))}
            onRetry={() => pending && sendPayment(pending)}
            onDiscard={discardPending}
            onPrintReceipt={() => receipt && setPrintJob(receipt.job)}
            now={now}
            canDiscount={canDiscount}
            money={money}
            onDiscount={setDiscount}
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

      <PrintSlip
        job={printJob}
        businessName={businessName}
        timezone={timezone}
        onDone={clearPrint}
      />
    </div>
  );

  function clearPrint() {
    setPrintJob(null);
  }
}
