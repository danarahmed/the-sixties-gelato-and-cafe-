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
import { useT } from "@/lib/i18n/I18nProvider";
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
  const { t } = useT();
  const router = useRouter();
  // By id, not position: a vendor renamed or taken out of use moves in the list.
  const [selId, setSelId] = useState(vendors[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("statement");
  const vendor = vendors.find((v) => v.id === selId) ?? vendors[0];

  if (vendors.length === 0) {
    return canAddVendor ? (
      <AddVendor onDone={() => router.refresh()} standalone />
    ) : (
      <div className="card muted">{t("No vendors yet.")}</div>
    );
  }

  const tabs: [Tab, string][] = [
    ["statement", t("Statement")],
    ["bills", t("Bills & payments")],
  ];
  if (canAddVendor) tabs.push(["edit", t("Edit vendor")], ["new", t("New vendor")]);

  return (
    <div className="three">
      <div className="listpane">
        <div className="lh">
          <b style={{ fontSize: ".9rem" }}>{t("All Vendors")}</b>
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
                {v.isActive ? (v.contact ?? "—") : t("Out of use")}
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
                {t("Out of use")}
              </span>
            )}
          </h2>
          <div className="sc" style={{ marginBlockStart: 3 }}>
            {vendor?.phone ? `${vendor.phone} · ` : ""}
            {vendor && vendor.overdue > 0
              ? t("{amount} overdue", { amount: fmtIQD(vendor.overdue) })
              : t("Nothing overdue")}
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
  const { t, msg } = useT();
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
          <strong>{t("To")}</strong>
          <br />
          {vendor.name}
          <br />
          {vendor.contact ?? ""}
        </div>
      </div>

      <div className="masthead" style={{ paddingBlockEnd: 0 }}>
        <div className="doc" style={{ fontSize: "1.02rem", fontStyle: "normal", fontWeight: 600 }}>
          {t("Statement of Account")}
        </div>
        <div className="period">{t("All transactions to date · IQD")}</div>
      </div>
      <div className="rule-band" style={{ marginBlockEnd: 14 }} />

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("Date")}</th>
              <th>{t("Particulars")}</th>
              <th>{t("Ref")}</th>
              <th className="right">{t("Charge")}</th>
              <th className="right">{t("Payment")}</th>
              <th className="right">{t("Balance")}</th>
            </tr>
          </thead>
          <tbody>
            {running.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ fontStyle: "italic" }}>
                  {t("No transactions with this vendor yet.")}
                </td>
              </tr>
            ) : (
              running.map((l, i) => (
                <tr key={i}>
                  <td>{l.date}</td>
                  <td>{msg(l.particulars)}</td>
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
          {t("Account Summary")}
        </div>
        <div className="srow">
          <span>{t("Billed to date")}</span>
          <span className="money">{fmtIQD(vendor.billed)}</span>
        </div>
        <div className="srow">
          <span>{t("Paid")}</span>
          <span className="money">({fmtIQD(vendor.paid)})</span>
        </div>
        <div className="srow tot">
          <span>{t("Balance due")}</span>
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
  const { t } = useT();
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
        const vars = {
          bill: r.data.invoiceNo,
          journal: r.data.journalNo ?? "—",
          amount: fmtIQD(Math.abs(pv)),
        };
        setMsg({
          ok: true,
          text: pv
            ? pv > 0
              ? t(
                  "Bill {bill} recorded (journal {journal}) — {amount} over the receipt, to 5050 Purchase price variance.",
                  vars,
                )
              : t(
                  "Bill {bill} recorded (journal {journal}) — {amount} under the receipt, to 5050 Purchase price variance.",
                  vars,
                )
            : t("Bill {bill} recorded (journal {journal}).", vars),
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
          text: t(
            "Payment recorded (journal {journal}). {amount} still outstanding on that bill.",
            { journal: r.data.journalNo ?? "—", amount: fmtIQD(r.data.outstanding) },
          ),
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
            <h3>{t("Record a bill")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("The supplier's invoice — raises what you owe")}
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
                {t("For goods received")} {receipts.length === 0 && t("(no unbilled receipts)")}
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  checked={kind === "expense"}
                  onChange={() => setKind("expense")}
                />
                {t("For a service or asset (rent, repairs, equipment…)")}
              </label>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              {kind === "receipt" ? (
                <label style={{ flex: 2, minWidth: 220 }}>
                  <div className="sc">{t("Goods receipt")}</div>
                  <select value={receiptId} onChange={(e) => setReceiptId(e.target.value)}>
                    {receipts.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.supplierId === null
                          ? t("Before controls · {note}", {
                              note: r.note ?? t("supplier not recorded"),
                            })
                          : t("Receipt {no}", { no: r.receiptNo ?? "—" })}{" "}
                        · {r.receivedAt.slice(0, 10)} · {fmtIQD(r.value)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label style={{ flex: 2, minWidth: 220 }}>
                  <div className="sc">{t("Charge to account")}</div>
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
                <div className="sc">{t("Invoice no.")}</div>
                <input
                  aria-label={t("Invoice no.")}
                  value={inv ?? nextBillNo ?? ""}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setInv(e.target.value)}
                  placeholder={nextBillNo ?? t("The supplier's invoice no.")}
                />
              </label>
              <label style={{ minWidth: 140 }}>
                <div className="sc">{t("Invoice date")}</div>
                <input
                  type="date"
                  value={invDate}
                  max={today}
                  onChange={(e) => setInvDate(e.target.value)}
                />
              </label>
              <label style={{ minWidth: 130 }}>
                <div className="sc">{t("Amount (IQD)")}</div>
                <input
                  className="amt"
                  style={{ textAlign: "end" }}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label style={{ minWidth: 110 }}>
                <div className="sc">{t("Terms")}</div>
                <select value={terms} onChange={(e) => setTerms(e.target.value)}>
                  <option value="0">{t("Due now")}</option>
                  <option value="7">{t("Net 7 days")}</option>
                  <option value="15">{t("Net 15 days")}</option>
                  <option value="30">{t("Net 30 days")}</option>
                </select>
              </label>
              <button
                className="btn-primary"
                onClick={raise}
                disabled={busy || !amount || (kind === "receipt" ? !receiptId : !accountCode)}
              >
                {busy ? t("Saving…") : t("Record bill")}
              </button>
            </div>
            {ownNo && nextBillNo && (
              <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
                {t(
                  "{no} is the café's own number, given when the bill is recorded and never to another bill. If the supplier's invoice has its own number, type that instead.",
                  { no: nextBillNo },
                )}
              </p>
            )}
            {kind === "receipt" && receipt && amountN === 0 && (
              <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
                {t(
                  "Type the amount the supplier's invoice says. It is checked against the {amount} the receipt recorded.",
                  { amount: fmtIQD(receipt.value) },
                )}
              </p>
            )}
            {kind === "receipt" && receipt && amountN > 0 && variance !== 0 && (
              <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
                {variance > 0
                  ? t(
                      "The bill is {amount} more than the receipt recorded; the difference goes to 5050 Purchase price variance.",
                      { amount: fmtIQD(Math.abs(variance)) },
                    )
                  : t(
                      "The bill is {amount} less than the receipt recorded; the difference goes to 5050 Purchase price variance.",
                      { amount: fmtIQD(Math.abs(variance)) },
                    )}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-h">
          <h3>{t("Open bills")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("{n} unpaid", { n: bills.length })}
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t("Invoice")}</th>
                <th>{t("Dated")}</th>
                <th>{t("Due")}</th>
                <th className="right">{t("Total")}</th>
                <th className="right">{t("Outstanding")}</th>
                <th className="right">{t("Status")}</th>
                {canPay && <th />}
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={canPay ? 7 : 6} className="muted" style={{ fontStyle: "italic" }}>
                    {t("Nothing outstanding.")}
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
                        {b.daysOverdue > 0 ? t("{n}d overdue", { n: b.daysOverdue }) : t("Current")}
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
                <div className="sc">{t("Pay bill")}</div>
                <select
                  value={payFor}
                  onChange={(e) => {
                    setPayFor(e.target.value);
                    const b = bills.find((x) => x.id === e.target.value);
                    if (b) setPayAmt(String(b.outstanding));
                  }}
                >
                  <option value="">{t("Choose an invoice…")}</option>
                  {bills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {t("{invoice} — {amount} outstanding", {
                        invoice: b.invoiceNo || b.id.slice(0, 8),
                        amount: fmtIQD(b.outstanding),
                      })}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ minWidth: 130 }}>
                <div className="sc">{t("Amount (IQD)")}</div>
                <input
                  className="amt"
                  style={{ textAlign: "end" }}
                  inputMode="decimal"
                  value={payAmt}
                  onChange={(e) => setPayAmt(e.target.value)}
                />
              </label>
              <label style={{ minWidth: 120 }}>
                <div className="sc">{t("Paid from")}</div>
                <select
                  aria-label={t("Paid from")}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentSource | "")}
                >
                  <option value="">{t("Choose…")}</option>
                  <option value="till">{t("The till (today's drawer)")}</option>
                  <option value="safe">{t("The safe")}</option>
                  <option value="bank">{t("The bank")}</option>
                  <option value="card">{t("A card")}</option>
                  <option value="owner">{t("The owner, personally")}</option>
                </select>
              </label>
              <button onClick={pay} disabled={busy || !payFor || !payAmt || !method}>
                {busy ? t("Paying…") : t("Record payment")}
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
  const { t } = useT();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [f, setF] = useState({ name: "", contact: "", phone: "" });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createSupplierAction(f);
      if (r.ok) {
        setMsg({ ok: true, text: t("Added {name}.", { name: f.name }) });
        setF({ name: "", contact: "", phone: "" });
        onDone();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className={standalone ? "panel" : ""}>
      {standalone && (
        <div className="panel-h">
          <h3>{t("No vendors yet")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Add the suppliers the shop buys from")}
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
            <div className="sc">{t("Vendor name")}</div>
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder={t("Baghdad Dairy Co.")}
            />
          </label>
          <label style={{ flex: 1, minWidth: 140 }}>
            <div className="sc">{t("What they supply")}</div>
            <input
              value={f.contact}
              onChange={(e) => setF({ ...f, contact: e.target.value })}
              placeholder={t("Dairy & cream")}
            />
          </label>
          <label style={{ minWidth: 130 }}>
            <div className="sc">{t("Phone")}</div>
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </label>
          <button className="btn-primary" onClick={submit} disabled={busy || !f.name.trim()}>
            {busy ? t("Saving…") : t("Add vendor")}
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
  const { t } = useT();
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
        setMsg({ ok: true, text: t("Saved, and on the audit trail.") });
        setReason("");
        onDone();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="grid" style={{ gap: 12, maxWidth: 720 }} data-testid="edit-vendor">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: 1, minWidth: 160 }}>
          <div className="sc">{t("Vendor name")}</div>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label style={{ flex: 1, minWidth: 140 }}>
          <div className="sc">{t("What they supply")}</div>
          <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        </label>
        <label style={{ minWidth: 130 }}>
          <div className="sc">{t("Phone")}</div>
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </label>
        <label style={{ width: 150 }}>
          <div className="sc">{t("Days a delivery takes")}</div>
          <input
            inputMode="numeric"
            aria-label={t("Days a delivery takes")}
            value={f.leadTimeDays}
            placeholder={t("Café default")}
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
        {t("In use: deliveries can be received from them")}
      </label>
      <label>
        <div className="sc">{t("Why (on the audit trail)")}</div>
        <input
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          placeholder={f.isActive ? t("e.g. their registered name") : t("e.g. no longer delivers")}
        />
      </label>
      <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
        {t(
          "No two vendors in use share a name, whatever the capitals, spaces or punctuation — so the same invoice cannot be billed twice under two spellings. A vendor still owed money stays in use until their bills are paid or cancelled. The days a delivery takes tell the dashboard when an item they supply is running out (empty: the café's default, on Settings).",
        )}
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={save}
          disabled={busy || !changed || !f.name.trim()}
        >
          {busy ? t("Saving…") : t("Save changes")}
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
  const { t, msg } = useT();
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
        title={t("Entered in error — a duplicate or the wrong amount")}
      >
        {t("Cancel")}
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
        placeholder={
          invoiceNo ? t("Why cancel {bill}?", { bill: invoiceNo }) : t("Why cancel this bill?")
        }
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
        aria-label={t("Date of the cancellation")}
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
        {busy ? "…" : t("Confirm")}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} style={small}>
        {t("Keep")}
      </button>
      {err && (
        <span className="red" style={{ fontSize: ".72rem", flexBasis: "100%", textAlign: "end" }}>
          {msg(err)}
        </span>
      )}
    </span>
  );
}
