"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelBillAction,
  createSupplierAction,
  payBillAction,
  recordBillAction,
  updateSupplierAction,
} from "@/lib/actions/purchasing";
import type { PaymentSource } from "@/lib/validation";
import { fmtIQD } from "@/lib/format";
import { Notice } from "@/components/ui";
import type { OpenBill, VendorRow } from "@/lib/db/books";

export interface ReceiptOption {
  id: string;
  /** Null for deliveries received before the controls: the old app did not record the supplier. */
  supplierId: string | null;
  receiptNo: number | null;
  value: number;
  receivedAt: string;
  note: string | null;
}
export interface AccountOption {
  code: string;
  name: string;
}

type Tab = "statement" | "bills" | "edit" | "new";
type Msg = { ok: boolean; text: string } | null;

export function VendorsClient({
  vendors,
  bills,
  receipts,
  accounts,
  today,
  businessName,
  canBill,
  nextBillNo,
  canPay,
  canAddVendor,
}: {
  vendors: VendorRow[];
  bills: OpenBill[];
  receipts: ReceiptOption[];
  accounts: AccountOption[];
  today: string;
  businessName: string;
  canBill: boolean;
  /** The café's own number the next bill takes if its box is left as filled. */
  nextBillNo: string | null;
  canPay: boolean;
  canAddVendor: boolean;
}) {
  const router = useRouter();
  // By id, not position: a vendor renamed or taken out of use moves in the list.
  const [selId, setSelId] = useState(vendors[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("statement");
  const vendor = vendors.find((v) => v.id === selId) ?? vendors[0];

  if (vendors.length === 0) {
    return canAddVendor ? (
      <AddVendor onDone={() => router.refresh()} standalone />
    ) : (
      <div className="card muted">No vendors yet.</div>
    );
  }

  const tabs: [Tab, string][] = [
    ["statement", "Statement"],
    ["bills", "Bills & payments"],
  ];
  if (canAddVendor) tabs.push(["edit", "Edit vendor"], ["new", "New vendor"]);

  return (
    <div className="three">
      <div className="listpane">
        <div className="lh">
          <b style={{ fontSize: ".9rem" }}>All Vendors</b>
          <span className="sc" style={{ marginInlineStart: "auto" }}>
            {vendors.length}
          </span>
        </div>
        {vendors.map((v) => (
          <button
            key={v.id}
            className={`vrow ${v.id === vendor?.id ? "on" : ""}`}
            onClick={() => {
              setSelId(v.id);
              setTab("statement");
            }}
          >
            <span>
              <span className="nm">{v.name}</span>
              <span className="sub2" style={{ display: "block" }}>
                {v.isActive ? (v.contact ?? "—") : "Out of use"}
              </span>
            </span>
            <span
              className="money"
              style={{ fontSize: ".8rem", color: v.overdue > 0 ? "var(--err)" : undefined }}
            >
              {fmtIQD(v.balance)}
            </span>
          </button>
        ))}
      </div>

      <div>
        <div style={{ padding: "14px 18px 0" }}>
          <h2 style={{ margin: 0 }}>
            {vendor?.name}
            {vendor && !vendor.isActive && (
              <span className="badge warn" style={{ marginInlineStart: 8, fontSize: ".7rem" }}>
                Out of use
              </span>
            )}
          </h2>
          <div className="sc" style={{ marginBlockStart: 3 }}>
            {vendor?.phone ? `${vendor.phone} · ` : ""}
            {vendor && vendor.overdue > 0 ? `${fmtIQD(vendor.overdue)} overdue` : "Nothing overdue"}
          </div>
          <div className="dtabs">
            {tabs.map(([k, label]) => (
              <button
                key={k}
                className={`dtab ${tab === k ? "on" : ""}`}
                style={{
                  border: "none",
                  background: "transparent",
                  minHeight: 0,
                  padding: "0 0 8px",
                }}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="dbody">
          {tab === "statement" && vendor && (
            <Statement vendor={vendor} businessName={businessName} />
          )}
          {tab === "bills" && vendor && (
            <Bills
              key={vendor.id}
              vendor={vendor}
              bills={bills.filter((b) => b.supplierId === vendor.id)}
              receipts={receipts.filter((r) => r.supplierId === vendor.id || r.supplierId === null)}
              accounts={accounts}
              today={today}
              canBill={canBill}
              nextBillNo={nextBillNo}
              canPay={canPay}
              onDone={() => router.refresh()}
            />
          )}
          {tab === "edit" && vendor && (
            <EditVendor key={vendor.id} vendor={vendor} onDone={() => router.refresh()} />
          )}
          {tab === "new" && <AddVendor onDone={() => router.refresh()} />}
        </div>
      </div>
    </div>
  );
}

function Statement({ vendor, businessName }: { vendor: VendorRow; businessName: string }) {
  const running = useMemo(() => {
    let bal = 0;
    return vendor.lines.map((l) => {
      bal += l.charge - l.payment;
      return { ...l, bal };
    });
  }, [vendor]);

  return (
    <div className="stmt">
      <div className="stmt-top">
        <div>
          <div className="serif" style={{ fontSize: "1.15rem", fontWeight: 700 }}>
            {businessName}
          </div>
        </div>
        <div className="muted" style={{ fontSize: ".76rem", textAlign: "end" }}>
          <strong>To</strong>
          <br />
          {vendor.name}
          <br />
          {vendor.contact ?? ""}
        </div>
      </div>

      <div className="masthead" style={{ paddingBlockEnd: 0 }}>
        <div className="doc" style={{ fontSize: "1.02rem", fontStyle: "normal", fontWeight: 600 }}>
          Statement of Account
        </div>
        <div className="period">All transactions to date · IQD</div>
      </div>
      <div className="rule-band" style={{ marginBlockEnd: 14 }} />

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Particulars</th>
              <th>Ref</th>
              <th className="right">Charge</th>
              <th className="right">Payment</th>
              <th className="right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {running.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ fontStyle: "italic" }}>
                  No transactions with this vendor yet.
                </td>
              </tr>
            ) : (
              running.map((l, i) => (
                <tr key={i}>
                  <td>{l.date}</td>
                  <td>{l.particulars}</td>
                  <td className="ref">{l.ref}</td>
                  <td className="right money">{l.charge ? fmtIQD(l.charge) : "—"}</td>
                  <td className="right money">{l.payment ? `(${fmtIQD(l.payment)})` : "—"}</td>
                  <td className="right money">{fmtIQD(l.bal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="sumbox">
        <div className="sc" style={{ marginBlockEnd: 6 }}>
          Account Summary
        </div>
        <div className="srow">
          <span>Billed to date</span>
          <span className="money">{fmtIQD(vendor.billed)}</span>
        </div>
        <div className="srow">
          <span>Paid</span>
          <span className="money">({fmtIQD(vendor.paid)})</span>
        </div>
        <div className="srow tot">
          <span>Balance due</span>
          <span className="money" style={{ color: vendor.balance > 0 ? "var(--err)" : undefined }}>
            {fmtIQD(vendor.balance)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Bills({
  vendor,
  bills,
  receipts,
  accounts,
  today,
  canBill,
  nextBillNo,
  canPay,
  onDone,
}: {
  vendor: VendorRow;
  bills: OpenBill[];
  receipts: ReceiptOption[];
  accounts: AccountOption[];
  today: string;
  canBill: boolean;
  nextBillNo: string | null;
  canPay: boolean;
  onDone: () => void;
}) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [kind, setKind] = useState<"receipt" | "expense">(
    receipts.length > 0 ? "receipt" : "expense",
  );
  const [receiptId, setReceiptId] = useState(receipts[0]?.id ?? "");
  const [accountCode, setAccountCode] = useState(accounts[0]?.code ?? "");
  // null: the box shows the café's next number, taken when the bill is saved.
  const [inv, setInv] = useState<string | null>(null);
  const [invDate, setInvDate] = useState(today);
  // Typed from the supplier's invoice, never copied from the receipt (audit P1-3):
  // a typo on the receipt would otherwise be billed and paid too.
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("15");
  const [payFor, setPayFor] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [method, setMethod] = useState<PaymentSource | "">("");

  const receipt = receipts.find((r) => r.id === receiptId);
  const amountN = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const variance = kind === "receipt" && receipt ? amountN - receipt.value : 0;
  const typedNo = (inv ?? "").trim();
  // Left as filled (or emptied), the bill takes the café's own number.
  const ownNo = typedNo === "" || typedNo === nextBillNo;

  function raise() {
    setMsg(null);
    start(async () => {
      const r = await recordBillAction({
        supplierId: vendor.id,
        invoiceNo: ownNo ? null : typedNo,
        invoiceDate: invDate,
        amount,
        termDays: Number(terms) || 0,
        receiptId: kind === "receipt" ? receiptId || null : null,
        accountCode: kind === "expense" ? accountCode || null : null,
      });
      if (r.ok) {
        const pv = r.data.priceVariance;
        setMsg({
          ok: true,
          text:
            `Bill ${r.data.invoiceNo} recorded (journal ${r.data.journalNo ?? "—"})` +
            (pv
              ? ` — ${fmtIQD(Math.abs(pv))} ${pv > 0 ? "over" : "under"} the receipt, to 5050 Purchase price variance.`
              : "."),
        });
        setInv(null);
        setAmount("");
        onDone();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  function pay() {
    setMsg(null);
    start(async () => {
      if (!method) return;
      const r = await payBillAction({ billId: payFor, amount: payAmt, method });
      if (r.ok) {
        setMsg({
          ok: true,
          text: `Payment recorded (journal ${r.data.journalNo ?? "—"}). ${fmtIQD(r.data.outstanding)} still outstanding on that bill.`,
        });
        setPayAmt("");
        setPayFor("");
        onDone();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      {canBill && (
        <div className="panel">
          <div className="panel-h">
            <h3>Record a bill</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              The supplier&apos;s invoice — raises what you owe
            </span>
          </div>
          <div className="panel-b grid" style={{ gap: 12 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: ".85rem" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  checked={kind === "receipt"}
                  onChange={() => setKind("receipt")}
                  disabled={receipts.length === 0}
                />
                For goods received {receipts.length === 0 && "(no unbilled receipts)"}
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  checked={kind === "expense"}
                  onChange={() => setKind("expense")}
                />
                For a service or asset (rent, repairs, equipment…)
              </label>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              {kind === "receipt" ? (
                <label style={{ flex: 2, minWidth: 220 }}>
                  <div className="sc">Goods receipt</div>
                  <select value={receiptId} onChange={(e) => setReceiptId(e.target.value)}>
                    {receipts.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.supplierId === null
                          ? `Before controls · ${r.note ?? "supplier not recorded"}`
                          : `Receipt ${r.receiptNo ?? "—"}`}{" "}
                        · {r.receivedAt.slice(0, 10)} · {fmtIQD(r.value)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label style={{ flex: 2, minWidth: 220 }}>
                  <div className="sc">Charge to account</div>
                  <select value={accountCode} onChange={(e) => setAccountCode(e.target.value)}>
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label style={{ flex: 1, minWidth: 120 }}>
                <div className="sc">Invoice no.</div>
                <input
                  aria-label="Invoice no."
                  value={inv ?? nextBillNo ?? ""}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setInv(e.target.value)}
                  placeholder={nextBillNo ?? "The supplier's invoice no."}
                />
              </label>
              <label style={{ minWidth: 140 }}>
                <div className="sc">Invoice date</div>
                <input
                  type="date"
                  value={invDate}
                  max={today}
                  onChange={(e) => setInvDate(e.target.value)}
                />
              </label>
              <label style={{ minWidth: 130 }}>
                <div className="sc">Amount (IQD)</div>
                <input
                  className="amt"
                  style={{ textAlign: "end" }}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label style={{ minWidth: 110 }}>
                <div className="sc">Terms</div>
                <select value={terms} onChange={(e) => setTerms(e.target.value)}>
                  <option value="0">Due now</option>
                  <option value="7">Net 7 days</option>
                  <option value="15">Net 15 days</option>
                  <option value="30">Net 30 days</option>
                </select>
              </label>
              <button
                className="btn-primary"
                onClick={raise}
                disabled={busy || !amount || (kind === "receipt" ? !receiptId : !accountCode)}
              >
                {busy ? "Saving…" : "Record bill"}
              </button>
            </div>
            {ownNo && nextBillNo && (
              <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
                {nextBillNo} is the café&apos;s own number, given when the bill is recorded and
                never to another bill. If the supplier&apos;s invoice has its own number, type that
                instead.
              </p>
            )}
            {kind === "receipt" && receipt && amountN === 0 && (
              <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
                Type the amount the supplier&apos;s invoice says. It is checked against the{" "}
                {fmtIQD(receipt.value)} the receipt recorded.
              </p>
            )}
            {kind === "receipt" && receipt && amountN > 0 && variance !== 0 && (
              <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
                The bill is {fmtIQD(Math.abs(variance))} {variance > 0 ? "more" : "less"} than the
                receipt recorded; the difference goes to 5050 Purchase price variance.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-h">
          <h3>Open bills</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {bills.length} unpaid
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Dated</th>
                <th>Due</th>
                <th className="right">Total</th>
                <th className="right">Outstanding</th>
                <th className="right">Status</th>
                {canPay && <th />}
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={canPay ? 7 : 6} className="muted" style={{ fontStyle: "italic" }}>
                    Nothing outstanding.
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id}>
                    <td>{b.invoiceNo || "—"}</td>
                    <td>{b.invoiceDate}</td>
                    <td>{b.dueDate ?? "—"}</td>
                    <td className="right money">{fmtIQD(b.total)}</td>
                    <td className="right money">{fmtIQD(b.outstanding)}</td>
                    <td className="right">
                      <span className={`ref ${b.daysOverdue > 0 ? "due" : ""}`}>
                        {b.daysOverdue > 0 ? `${b.daysOverdue}d overdue` : "Current"}
                      </span>
                    </td>
                    {canPay && (
                      <td className="right">
                        {b.paid === 0 && (
                          <CancelBill
                            billId={b.id}
                            invoiceNo={b.invoiceNo}
                            invoiceDate={b.invoiceDate}
                            today={today}
                            onDone={onDone}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {bills.length > 0 && canPay && (
          <div className="panel-b" style={{ borderBlockStart: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ flex: 1, minWidth: 170 }}>
                <div className="sc">Pay bill</div>
                <select
                  value={payFor}
                  onChange={(e) => {
                    setPayFor(e.target.value);
                    const b = bills.find((x) => x.id === e.target.value);
                    if (b) setPayAmt(String(b.outstanding));
                  }}
                >
                  <option value="">Choose an invoice…</option>
                  {bills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.invoiceNo || b.id.slice(0, 8)} — {fmtIQD(b.outstanding)} outstanding
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ minWidth: 130 }}>
                <div className="sc">Amount (IQD)</div>
                <input
                  className="amt"
                  style={{ textAlign: "end" }}
                  inputMode="decimal"
                  value={payAmt}
                  onChange={(e) => setPayAmt(e.target.value)}
                />
              </label>
              <label style={{ minWidth: 120 }}>
                <div className="sc">Paid from</div>
                <select
                  aria-label="Paid from"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentSource | "")}
                >
                  <option value="">Choose…</option>
                  <option value="till">The till (today&apos;s drawer)</option>
                  <option value="safe">The safe</option>
                  <option value="bank">The bank</option>
                  <option value="card">A card</option>
                  <option value="owner">The owner, personally</option>
                </select>
              </label>
              <button onClick={pay} disabled={busy || !payFor || !payAmt || !method}>
                {busy ? "Paying…" : "Record payment"}
              </button>
            </div>
          </div>
        )}
      </div>
      <Notice msg={msg} />
    </div>
  );
}

function AddVendor({ onDone, standalone }: { onDone: () => void; standalone?: boolean }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [f, setF] = useState({ name: "", contact: "", phone: "" });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createSupplierAction(f);
      if (r.ok) {
        setMsg({ ok: true, text: `Added ${f.name}.` });
        setF({ name: "", contact: "", phone: "" });
        onDone();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className={standalone ? "panel" : ""}>
      {standalone && (
        <div className="panel-h">
          <h3>No vendors yet</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Add the suppliers the shop buys from
          </span>
        </div>
      )}
      <div className={standalone ? "panel-b" : ""}>
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "flex-end",
            maxWidth: 720,
          }}
        >
          <label style={{ flex: 1, minWidth: 160 }}>
            <div className="sc">Vendor name</div>
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Baghdad Dairy Co."
            />
          </label>
          <label style={{ flex: 1, minWidth: 140 }}>
            <div className="sc">What they supply</div>
            <input
              value={f.contact}
              onChange={(e) => setF({ ...f, contact: e.target.value })}
              placeholder="Dairy & cream"
            />
          </label>
          <label style={{ minWidth: 130 }}>
            <div className="sc">Phone</div>
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </label>
          <button className="btn-primary" onClick={submit} disabled={busy || !f.name.trim()}>
            {busy ? "Saving…" : "Add vendor"}
          </button>
        </div>
        <div style={{ marginBlockStart: 12 }}>
          <Notice msg={msg} />
        </div>
      </div>
    </div>
  );
}

/**
 * A supplier corrected (0027): name, what they supply, phone, whether they are
 * in use — not taken out of use while they are owed money — and how many days
 * a delivery takes, for the "running out" alert (0029). On the audit trail,
 * with the values before and after.
 */
function EditVendor({ vendor, onDone }: { vendor: VendorRow; onDone: () => void }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const initial = {
    name: vendor.name,
    contact: vendor.contact ?? "",
    phone: vendor.phone ?? "",
    isActive: vendor.isActive,
    leadTimeDays: vendor.leadTimeDays === null ? "" : String(vendor.leadTimeDays),
  };
  const [f, setF] = useState(initial);
  const [reason, setReason] = useState("");
  const changed = JSON.stringify(f) !== JSON.stringify(initial);

  function save() {
    setMsg(null);
    start(async () => {
      const days = f.leadTimeDays.trim();
      const r = await updateSupplierAction({
        supplierId: vendor.id,
        name: f.name,
        contact: f.contact,
        phone: f.phone,
        isActive: f.isActive,
        reason,
        leadTimeDays: days === "" ? null : Number(days),
      });
      if (r.ok) {
        setMsg({ ok: true, text: "Saved, and on the audit trail." });
        setReason("");
        onDone();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="grid" style={{ gap: 12, maxWidth: 720 }} data-testid="edit-vendor">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: 1, minWidth: 160 }}>
          <div className="sc">Vendor name</div>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label style={{ flex: 1, minWidth: 140 }}>
          <div className="sc">What they supply</div>
          <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        </label>
        <label style={{ minWidth: 130 }}>
          <div className="sc">Phone</div>
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </label>
        <label style={{ width: 150 }}>
          <div className="sc">Days a delivery takes</div>
          <input
            inputMode="numeric"
            aria-label="Days a delivery takes"
            value={f.leadTimeDays}
            placeholder="Café default"
            onChange={(e) =>
              setF({ ...f, leadTimeDays: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })
            }
          />
        </label>
      </div>
      <label style={{ fontSize: ".85rem", display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={f.isActive}
          onChange={(e) => setF({ ...f, isActive: e.target.checked })}
        />
        In use: deliveries can be received from them
      </label>
      <label>
        <div className="sc">Why (on the audit trail)</div>
        <input
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          placeholder={f.isActive ? "e.g. their registered name" : "e.g. no longer delivers"}
        />
      </label>
      <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
        No two vendors in use share a name, whatever the capitals, spaces or punctuation — so the
        same invoice cannot be billed twice under two spellings. A vendor still owed money stays in
        use until their bills are paid or cancelled. The days a delivery takes tell the dashboard
        when an item they supply is running out (empty: the café&apos;s default, on Settings).
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={save}
          disabled={busy || !changed || !f.name.trim()}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}

/** Cancel a bill entered in error: it stays on record, its journal is reversed. */
function CancelBill({
  billId,
  invoiceNo,
  invoiceDate,
  today,
  onDone,
}: {
  billId: string;
  invoiceNo: string;
  invoiceDate: string;
  today: string;
  onDone: () => void;
}) {
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today);
  const [err, setErr] = useState<string | null>(null);
  const small = { minHeight: 26, padding: "0 8px", fontSize: ".72rem" };
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={small}
        title="Entered in error — a duplicate or the wrong amount"
      >
        Cancel
      </button>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "end",
      }}
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Why cancel ${invoiceNo || "this bill"}?`}
        style={{ minHeight: 26, width: 180, fontSize: ".78rem" }}
        maxLength={300}
        autoFocus
      />
      <input
        type="date"
        value={date}
        min={invoiceDate}
        max={today}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Date of the cancellation"
        style={{ minHeight: 26, fontSize: ".78rem" }}
      />
      <button
        className="btn-primary"
        disabled={busy || !reason.trim()}
        style={small}
        onClick={() =>
          start(async () => {
            const r = await cancelBillAction({ billId, reason, date });
            if (r.ok) {
              setOpen(false);
              onDone();
            } else setErr(r.error);
          })
        }
      >
        {busy ? "…" : "Confirm"}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} style={small}>
        Keep
      </button>
      {err && (
        <span className="red" style={{ fontSize: ".72rem", flexBasis: "100%", textAlign: "end" }}>
          {err}
        </span>
      )}
    </span>
  );
}
