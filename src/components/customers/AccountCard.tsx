"use client";

import { useRef, useState, useTransition } from "react";
import {
  invoiceCustomerAction,
  receiveCustomerPaymentAction,
  setCustomerAccountAction,
} from "@/lib/actions/accounts";
import { creditLeft, wholesalePrice, type CustomerAccount } from "@/lib/accounts";
import { dateTimeIn } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon } from "@/components/Icon";

export interface InvoiceProduct {
  variantId: string;
  name: string;
  /** The take-away price, before the customer's wholesale percentage. */
  price: number;
}

type Row = { variantId: string; qty: string };

/**
 * A customer's account (0077): whether they buy on account, their limit,
 * terms and wholesale price; what they owe, invoice by invoice, how late; an
 * invoice made; a payment received. Paying pays the oldest invoices first.
 */
export function AccountCard({
  account,
  products,
  payMethods,
  timezone,
  canManage,
  decimals,
}: {
  account: CustomerAccount;
  products: InvoiceProduct[];
  payMethods: { id: string; name: string }[];
  timezone: string;
  canManage: boolean;
  decimals: number;
}) {
  const { t, msg: say } = useT();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "settings" | "invoice" | "payment">("none");

  // ------------------------------------------------------------ settings
  const [set, setSet] = useState({
    onAccount: account.onAccount,
    limit: String(account.creditLimit),
    terms: String(account.termsDays),
    percent: String(account.wholesalePercent),
  });
  const setKey = useRef(crypto.randomUUID());
  function saveSettings() {
    setError(null);
    start(async () => {
      const r = await setCustomerAccountAction(
        {
          customerId: account.customer,
          onAccount: set.onAccount,
          creditLimit: Number(set.limit.replace(/,/g, "")),
          termsDays: Number(set.terms),
          wholesalePercent: Number(set.percent),
        },
        setKey.current,
      );
      if (!r.ok) return setError(r.error);
      setKey.current = crypto.randomUUID();
      setMode("none");
      setDone(t("Saved."));
    });
  }

  // ------------------------------------------------------------ an invoice
  const [rows, setRows] = useState<Row[]>([{ variantId: "", qty: "1" }]);
  const [note, setNote] = useState("");
  const invoiceKey = useRef(crypto.randomUUID());
  const byId = new Map(products.map((p) => [p.variantId, p]));
  const invoiceTotal = rows.reduce((s, r) => {
    const p = byId.get(r.variantId);
    const q = Number(r.qty);
    return p && q > 0 ? s + wholesalePrice(p.price, account.wholesalePercent, decimals) * q : s;
  }, 0);
  function makeInvoice() {
    setError(null);
    const lines = rows
      .filter((r) => r.variantId && Number(r.qty) > 0)
      .map((r) => ({ variantId: r.variantId, qty: Number(r.qty) }));
    start(async () => {
      const r = await invoiceCustomerAction(
        { customerId: account.customer, note: note || null, lines },
        invoiceKey.current,
      );
      if (!r.ok) return setError(r.error);
      invoiceKey.current = crypto.randomUUID();
      setRows([{ variantId: "", qty: "1" }]);
      setNote("");
      setMode("none");
      setDone(
        t("Invoice {no} made: {amount}, due {date}.", {
          no: r.data.invoiceNo,
          amount: fmtIQD(r.data.amount),
          date: r.data.dueOn,
        }),
      );
    });
  }

  // ------------------------------------------------------------ a payment
  const [pay, setPay] = useState({ amount: "", into: "bank", reference: "" });
  const payKey = useRef(crypto.randomUUID());
  function receive() {
    setError(null);
    start(async () => {
      const r = await receiveCustomerPaymentAction(
        {
          customerId: account.customer,
          amount: Number(pay.amount.replace(/,/g, "")),
          into: pay.into,
          reference: pay.reference || null,
        },
        payKey.current,
      );
      if (!r.ok) return setError(r.error);
      payKey.current = crypto.randomUUID();
      setPay({ amount: "", into: pay.into, reference: "" });
      setMode("none");
      setDone(t("Payment received. They owe {amount}.", { amount: fmtIQD(r.data.balance) }));
    });
  }

  const open = account.invoices.filter((i) => i.status === "open" && i.left > 0);
  const overdue = open.filter((i) => i.daysLate > 0).reduce((s, i) => s + i.left, 0);
  const into = [
    { id: "till", name: t("The till's drawer") },
    { id: "bank", name: t("The bank") },
    ...payMethods,
  ];

  return (
    <section className="card grid account-card" style={{ gap: 12 }} data-testid="customer-account">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>
          <Icon name="ledger" /> {t("Account")}
        </h2>
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => setMode(mode === "settings" ? "none" : "settings")}
            >
              {t("Credit settings")}
            </button>
            {account.onAccount && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setMode(mode === "invoice" ? "none" : "invoice")}
                data-testid="account-new-invoice"
              >
                ＋ {t("New invoice")}
              </button>
            )}
            {account.balance > 0 && (
              <button
                type="button"
                onClick={() => setMode(mode === "payment" ? "none" : "payment")}
                data-testid="account-receive"
              >
                {t("Receive a payment")}
              </button>
            )}
            <button type="button" onClick={() => window.print()}>
              <Icon name="print" /> {t("Statement")}
            </button>
          </>
        )}
      </div>

      {!account.onAccount && account.invoices.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {t(
            "Not on account: they pay as they buy. A shop or a hotel that pays later is put on account here, with a limit and terms.",
          )}
        </p>
      ) : (
        <div className="kpis" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="muted">{t("They owe")}</div>
            <b className="mono" data-testid="account-balance">
              {fmtIQD(account.balance)}
            </b>
          </div>
          <div>
            <div className="muted">{t("Overdue")}</div>
            <b className={`mono${overdue > 0 ? " red" : ""}`}>{fmtIQD(overdue)}</b>
          </div>
          <div>
            <div className="muted">{t("Credit left")}</div>
            <b className="mono">{fmtIQD(creditLeft(account))}</b>
          </div>
          <div className="muted" style={{ alignSelf: "end" }}>
            {t("Limit {amount} · {days} days to pay · {percent}% off", {
              amount: fmtIQD(account.creditLimit),
              days: account.termsDays,
              percent: account.wholesalePercent,
            })}
          </div>
        </div>
      )}

      {mode === "settings" && (
        <div className="grid account-form" style={{ gap: 8 }} data-testid="account-settings">
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={set.onAccount}
              onChange={(e) => setSet({ ...set, onAccount: e.target.checked })}
              data-testid="account-on"
            />
            {t("Buys on account (pays later)")}
          </label>
          <label>
            <span>{t("Credit limit")}</span>
            <input
              inputMode="numeric"
              value={set.limit}
              onChange={(e) => setSet({ ...set, limit: e.target.value })}
              data-testid="account-limit"
            />
          </label>
          <label>
            <span>{t("Days to pay")}</span>
            <input
              inputMode="numeric"
              value={set.terms}
              onChange={(e) => setSet({ ...set, terms: e.target.value })}
            />
          </label>
          <label>
            <span>{t("Wholesale price: % off the menu")}</span>
            <input
              inputMode="decimal"
              value={set.percent}
              onChange={(e) => setSet({ ...set, percent: e.target.value })}
              data-testid="account-percent"
            />
          </label>
          <div>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={saveSettings}
              data-testid="account-save"
            >
              {t("Save")}
            </button>
          </div>
        </div>
      )}

      {mode === "invoice" && (
        <div className="grid account-form" style={{ gap: 8 }} data-testid="account-invoice">
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                aria-label={t("Product")}
                value={r.variantId}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, variantId: e.target.value } : x)))
                }
                data-testid="invoice-product"
                style={{ flex: 1, minWidth: 180 }}
              >
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.variantId} value={p.variantId}>
                    {p.name} · {fmtIQD(wholesalePrice(p.price, account.wholesalePercent, decimals))}
                  </option>
                ))}
              </select>
              <input
                aria-label={t("Quantity")}
                inputMode="decimal"
                value={r.qty}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))
                }
                style={{ width: 80 }}
                data-testid="invoice-qty"
              />
            </div>
          ))}
          <div>
            <button type="button" onClick={() => setRows([...rows, { variantId: "", qty: "1" }])}>
              ＋ {t("Another line")}
            </button>
          </div>
          <label>
            <span>{t("Note (optional)")}</span>
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b className="mono">{fmtIQD(invoiceTotal)}</b>
            <span className="muted">{t("Due in {days} days", { days: account.termsDays })}</span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn-primary"
              disabled={busy || invoiceTotal <= 0}
              onClick={makeInvoice}
              data-testid="invoice-make"
            >
              {t("Make the invoice")}
            </button>
          </div>
        </div>
      )}

      {mode === "payment" && (
        <div className="grid account-form" style={{ gap: 8 }} data-testid="account-payment">
          <label>
            <span>{t("Amount")}</span>
            <input
              inputMode="numeric"
              value={pay.amount}
              placeholder={String(account.balance)}
              onChange={(e) => setPay({ ...pay, amount: e.target.value })}
              data-testid="payment-amount"
            />
          </label>
          <div className="seg" role="radiogroup" aria-label={t("Where did the money go?")}>
            {into.map((w) => (
              <button
                key={w.id}
                type="button"
                role="radio"
                aria-checked={pay.into === w.id}
                className={pay.into === w.id ? "active" : ""}
                onClick={() => setPay({ ...pay, into: w.id })}
              >
                {w.name}
              </button>
            ))}
          </div>
          <label>
            <span>{t("Reference (optional)")}</span>
            <input
              value={pay.reference}
              maxLength={60}
              onChange={(e) => setPay({ ...pay, reference: e.target.value })}
            />
          </label>
          <div>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !pay.amount.trim()}
              onClick={receive}
              data-testid="payment-receive"
            >
              {t("Receive it")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="red" role="alert" style={{ margin: 0 }}>
          {say(error)}
        </p>
      )}
      {done && !error && (
        <p className="pos-val" role="status" style={{ margin: 0 }} data-testid="account-done">
          {done}
        </p>
      )}

      {account.invoices.length > 0 && (
        <div className="tw">
          <table data-testid="account-invoices">
            <thead>
              <tr>
                <th>{t("Invoice")}</th>
                <th>{t("Date")}</th>
                <th>{t("Due")}</th>
                <th className="right">{t("Amount")}</th>
                <th className="right">{t("Paid")}</th>
                <th className="right">{t("Left to pay")}</th>
              </tr>
            </thead>
            <tbody>
              {account.invoices.map((i) => (
                <tr
                  key={i.id}
                  data-testid="account-invoice-row"
                  data-no={i.no}
                  className={i.status === "void" ? "faint" : undefined}
                >
                  <td>
                    #{i.no}
                    {i.status === "void" && <span className="badge"> {t("Voided")}</span>}
                    {i.note && (
                      <div className="muted" style={{ fontSize: ".8rem" }}>
                        {i.note}
                      </div>
                    )}
                  </td>
                  <td className="mono">{i.issuedOn}</td>
                  <td className="mono">
                    {i.dueOn}
                    {i.daysLate > 0 && (
                      <div className="red" style={{ fontSize: ".8rem" }}>
                        {t("{days} days late", { days: i.daysLate })}
                      </div>
                    )}
                  </td>
                  <td className="right mono">{fmtIQD(i.amount)}</td>
                  <td className="right mono">{i.status === "void" ? "—" : fmtIQD(i.paid)}</td>
                  <td className="right mono">{i.status === "void" ? "—" : fmtIQD(i.left)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {account.payments.length > 0 && (
        <details>
          <summary>{t("Payments ({n})", { n: account.payments.length })}</summary>
          <ul style={{ margin: "8px 0 0", paddingInlineStart: 18 }}>
            {account.payments.map((p) => (
              <li key={p.id}>
                <span className="mono">{dateTimeIn(timezone, p.at)}</span> ·{" "}
                <b className="mono">{fmtIQD(p.amount)}</b> ·{" "}
                {p.method ?? (p.account === "1000" ? t("The till's drawer") : t("The bank"))}
                {p.reference ? ` · ${p.reference}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
