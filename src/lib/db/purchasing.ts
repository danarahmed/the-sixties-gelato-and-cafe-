import "server-only";
/**
 * Purchasing (0044, release S): the orders, a supplier's statement, the
 * report, and the suppliers' returns and credits. Each read runs as the
 * signed-in person, for those who may see costs.
 */
import {
  purchaseOrderFrom,
  purchaseOrdersFrom,
  purchasingReportFrom,
  statementFrom,
  type CreditKind,
  type PurchaseOrder,
  type PurchasingReport,
  type SupplierCredit,
  type SupplierStatement,
} from "@/lib/purchasing";
import { db, num, numOrNull, one, rows, str, strOrNull } from "./client";

export async function getPurchaseOrders(): Promise<{
  approveUpTo: number | null;
  orders: PurchaseOrder[];
}> {
  const c = await db();
  return purchaseOrdersFrom(
    one(await c.rpc("purchase_orders"), "purchase orders") as Record<string, unknown> | null,
  );
}

/** One order, for its own page and for printing; null when there is no such order. */
export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const c = await db();
  const r = await c.rpc("purchase_order", { p_po: id });
  if (r.error && /Order not found/.test(r.error.message)) return null;
  const d = one(r, "the purchase order") as Record<string, unknown> | null;
  return d ? purchaseOrderFrom(d) : null;
}

export async function getSupplierStatement(
  supplierId: string,
  from: string,
  to: string,
): Promise<SupplierStatement> {
  const c = await db();
  return statementFrom(
    one(
      await c.rpc("supplier_statement", { p_supplier: supplierId, p_from: from, p_to: to }),
      "the supplier's statement",
    ) as Record<string, unknown> | null,
  );
}

export async function getPurchasingReport(
  from: string,
  to: string,
  place: string | null = null,
): Promise<PurchasingReport> {
  const c = await db();
  return purchasingReportFrom(
    one(
      await c.rpc("report_purchasing", { p_from: from, p_to: to, p_location: place }),
      "purchasing",
    ) as Record<string, unknown> | null,
  );
}

/** Every supplier's credits, newest first, with what is set against bills and what is left. */
export async function getSupplierCredits(): Promise<SupplierCredit[]> {
  const c = await db();
  const [credits, allocations, receipts, returns, bills] = await Promise.all([
    c
      .from("supplier_credit")
      .select(
        "id,credit_no,supplier_id,kind,amount,credit_date,supplier_ref,reason,goods_receipt_id,supplier_return_id,purchase_invoice_id,account_code",
      )
      .order("credit_no", { ascending: false }),
    c.from("supplier_credit_allocation").select("supplier_credit_id,amount"),
    c.from("goods_receipt").select("id,receipt_no"),
    c.from("supplier_return").select("id,return_no"),
    c.from("purchase_invoice").select("id,invoice_no"),
  ]);
  const used = new Map<string, number>();
  for (const a of rows(allocations, "credits set against bills")) {
    const k = str(a.supplier_credit_id);
    used.set(k, (used.get(k) ?? 0) + num(a.amount));
  }
  const receiptNo = new Map(
    rows(receipts, "deliveries").map((r) => [str(r.id), numOrNull(r.receipt_no)]),
  );
  const returnNo = new Map(rows(returns, "returns").map((r) => [str(r.id), num(r.return_no)]));
  const billNo = new Map(rows(bills, "bills").map((b) => [str(b.id), str(b.invoice_no)]));
  return rows(credits, "supplier credits").map((x) => {
    const amount = num(x.amount);
    const setAgainst = used.get(str(x.id)) ?? 0;
    const kind = str(x.kind);
    return {
      id: str(x.id),
      creditNo: num(x.credit_no),
      supplierId: str(x.supplier_id),
      kind: (kind === "goods_return" || kind === "price" ? kind : "other") as CreditKind,
      amount,
      creditDate: str(x.credit_date),
      supplierRef: strOrNull(x.supplier_ref),
      reason: str(x.reason),
      receiptNo: x.goods_receipt_id ? (receiptNo.get(str(x.goods_receipt_id)) ?? null) : null,
      returnNo: x.supplier_return_id ? (returnNo.get(str(x.supplier_return_id)) ?? null) : null,
      billNo: x.purchase_invoice_id ? (billNo.get(str(x.purchase_invoice_id)) ?? null) : null,
      accountCode: strOrNull(x.account_code),
      setAgainst,
      left: amount - setAgainst,
    };
  });
}

export interface SupplierReturnRow {
  id: string;
  returnNo: number;
  supplierId: string;
  supplier: string;
  receiptNo: number | null;
  reason: string;
  value: number;
  stockValue: number;
  against: "delivery" | "account";
  createdAt: string;
  by: string | null;
  creditNo: number | null;
  journalNo: number | null;
  lines: { itemId: string; qty: number; unitCode: string; value: number }[];
}

/** The last returns to suppliers, newest first, with their lines. */
export async function getSupplierReturns(limit = 30): Promise<SupplierReturnRow[]> {
  const c = await db();
  const returns = rows(
    await c
      .from("supplier_return")
      .select(
        "id,return_no,supplier_id,goods_receipt_id,reason,value,stock_value,against,created_at,created_by,journal_entry_id",
      )
      .order("return_no", { ascending: false })
      .limit(limit),
    "returns",
  );
  if (returns.length === 0) return [];
  const ids = returns.map((r) => str(r.id));
  const [lines, suppliers, receipts, credits, people, journals] = await Promise.all([
    c
      .from("supplier_return_line")
      .select("supplier_return_id,item_id,qty,unit_code,value")
      .in("supplier_return_id", ids),
    c.from("supplier").select("id,name"),
    c.from("goods_receipt").select("id,receipt_no"),
    c.from("supplier_credit").select("supplier_return_id,credit_no").in("supplier_return_id", ids),
    c.from("app_user").select("id,full_name"),
    c
      .from("journal_entry")
      .select("id,journal_no")
      .in("id", returns.map((r) => r.journal_entry_id).filter(Boolean)),
  ]);
  const supplierName = new Map(rows(suppliers, "suppliers").map((s) => [str(s.id), str(s.name)]));
  const receiptNo = new Map(
    rows(receipts, "deliveries").map((r) => [str(r.id), numOrNull(r.receipt_no)]),
  );
  const creditNo = new Map(
    rows(credits, "return credits").map((x) => [str(x.supplier_return_id), num(x.credit_no)]),
  );
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  const journalNo = new Map(
    rows(journals, "return journals").map((j) => [str(j.id), num(j.journal_no)]),
  );
  const linesOf = new Map<string, SupplierReturnRow["lines"]>();
  for (const l of rows(lines, "return lines")) {
    const k = str(l.supplier_return_id);
    linesOf.set(k, [
      ...(linesOf.get(k) ?? []),
      { itemId: str(l.item_id), qty: num(l.qty), unitCode: str(l.unit_code), value: num(l.value) },
    ]);
  }
  return returns.map((r) => ({
    id: str(r.id),
    returnNo: num(r.return_no),
    supplierId: str(r.supplier_id),
    supplier: supplierName.get(str(r.supplier_id)) ?? "—",
    receiptNo: r.goods_receipt_id ? (receiptNo.get(str(r.goods_receipt_id)) ?? null) : null,
    reason: str(r.reason),
    value: num(r.value),
    stockValue: num(r.stock_value),
    against: str(r.against) === "delivery" ? "delivery" : "account",
    createdAt: str(r.created_at),
    by: r.created_by ? (person.get(str(r.created_by)) ?? null) : null,
    creditNo: creditNo.get(str(r.id)) ?? null,
    journalNo: r.journal_entry_id ? (journalNo.get(str(r.journal_entry_id)) ?? null) : null,
    lines: linesOf.get(str(r.id)) ?? [],
  }));
}
