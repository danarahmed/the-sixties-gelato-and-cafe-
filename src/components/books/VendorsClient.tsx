"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupplierAction } from "@/lib/db/actions";
import { recordBillAction, payBillAction } from "@/lib/db/books-actions";
import { fmtIQD } from "@/lib/format";
import { Notice } from "@/components/ui";

export interface VendorView {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  billed: number;
  paid: number;
  balance: number;
  overdue: number;
  lines: { date: string; particulars: string; ref: string; charge: number; payment: number }[];
}
export interface BillView {
  id: string;
  supplierId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  total: number;
  paid: number;
  outstanding: number;
  daysOverdue: number;
}

type Tab = "statement" | "bills" | "new";

export function VendorsClient({
  vendors,
  bills,
  businessName,
}: {
  vendors: VendorView[];
  bills: BillView[];
  businessName: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<Tab>("statement");
  const vendor = vendors[sel];

  if (vendors.length === 0) return <AddVendor onDone={() => router.refresh()} standalone />;

  return (
    <div className="three">
      <div className="listpane">
        <div className="lh">
          <b style={{ fontSize: ".9rem" }}>All Vendors</b>
          <span className="sc" style={{ marginInlineStart: "auto" }}>
            {vendors.length}
          </span>
        </div>
        {vendors.map((v, i) => (
          <button
            key={v.id}
            className={`vrow ${i === sel ? "on" : ""}`}
            onClick={() => {
              setSel(i);
              setTab("statement");
            }}
          >
            <span>
              <span className="nm">{v.name}</span>
              <span className="sub2" style={{ display: "block" }}>
                {v.contact ?? "—"}
              </span>
            </span>
            <span className="money" style={{ fontSize: ".8rem", color: v.overdue > 0 ? "var(--err)" : undefined }}>
              {fmtIQD(v.balance)}
            </span>
          </button>
        ))}
      </div>

      <div>
        <div style={{ padding: "14px 18px 0" }}>
          <h2 style={{ margin: 0 }}>{vendor?.name}</h2>
          <div className="sc" style={{ marginBlockStart: 3 }}>
            {vendor?.phone ? `${vendor.phone} · ` : ""}
            {vendor && vendor.overdue > 0 ? `${fmtIQD(vendor.overdue)} overdue` : "Nothing overdue"}
          </div>
          <div className="dtabs">
            {(
              [
                ["statement", "Statement"],
                ["bills", "Bills & payments"],
                ["new", "New vendor"],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                className={`dtab ${tab === k ? "on" : ""}`}
                style={{ border: "none", background: "transparent", minHeight: 0, padding: "0 0 8px" }}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="dbody">
          {tab === "statement" && vendor && <Statement vendor={vendor} businessName={businessName} />}
          {tab === "bills" && vendor && (
            <Bills
              vendor={vendor}
              bills={bills.filter((b) => b.supplierId === vendor.id)}
              onDone={() => router.refresh()}
            />
          )}
          {tab === "new" && <AddVendor onDone={() => router.refresh()} />}
        </div>
      </div>
    </div>
  );
}

function Statement({ vendor, businessName }: { vendor: VendorView; businessName: string }) {
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
          <div className="muted" style={{ fontSize: ".76rem", marginBlockStart: 4 }}>
            Erbil, Kurdistan Region
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
  onDone,
}: {
  vendor: VendorView;
  bills: BillView[];
  onDone: () => void;
}) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inv, setInv] = useState("");
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("15");
  const [payFor, setPayFor] = useState("");
  const [payAmt, setPayAmt] = useState("");

  function raise() {
    setMsg(null);
    start(async () => {
      const r = await recordBillAction({
        supplierId: vendor.id,
        invoiceNo: inv,
        amount: Number(amount.replace(/[^0-9.]/g, "")),
        invoiceDate: new Date().toISOString().slice(0, 10),
        termDays: Number(terms) || 0,
      });
      if (r.ok) {
        setMsg({ ok: true, text: "Bill recorded — Dr Inventory / Cr Accounts payable." });
        setInv("");
        setAmount("");
        onDone();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  function pay() {
    setMsg(null);
    start(async () => {
      const r = await payBillAction({
        billId: payFor,
        amount: Number(payAmt.replace(/[^0-9.]/g, "")),
        method: "cash",
      });
      if (r.ok) {
        setMsg({ ok: true, text: "Payment recorded — Dr Accounts payable / Cr Cash." });
        setPayAmt("");
        setPayFor("");
        onDone();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="panel">
        <div className="panel-h">
          <h3>Record a bill</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            Raises the payable and brings the stock value in
          </span>
        </div>
        <div className="panel-b">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ flex: 1, minWidth: 130 }}>
              <div className="sc">Invoice no.</div>
              <input value={inv} onChange={(e) => setInv(e.target.value)} placeholder="INV-0012" />
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
            <button className="btn-primary" onClick={raise} disabled={busy || !amount}>
              {busy ? "Saving…" : "Record bill"}
            </button>
          </div>
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ fontStyle: "italic" }}>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {bills.length > 0 && (
          <div className="panel-b" style={{ borderBlockStart: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ flex: 1, minWidth: 170 }}>
                <div className="sc">Pay bill</div>
                <select value={payFor} onChange={(e) => setPayFor(e.target.value)}>
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
              <button onClick={pay} disabled={busy || !payFor || !payAmt}>
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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({ name: "", contact: "", phone: "" });

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createSupplierAction(f);
      if (r.ok) {
        setMsg({ ok: true, text: `Added ${f.name}.` });
        setF({ name: "", contact: "", phone: "" });
        onDone();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
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
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", maxWidth: 720 }}>
          <label style={{ flex: 1, minWidth: 160 }}>
            <div className="sc">Vendor name</div>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Baghdad Dairy Co." />
          </label>
          <label style={{ flex: 1, minWidth: 140 }}>
            <div className="sc">What they supply</div>
            <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Dairy & cream" />
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
