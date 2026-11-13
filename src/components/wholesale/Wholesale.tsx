"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  creditCustomerAction,
  invoiceQuoteAction,
  makeDeliveryNoteAction,
  makeItemSellableAction,
  saveQuoteAction,
  setCustomerPriceAction,
  setDeliveryStatusAction,
  setQuoteStatusAction,
} from "@/lib/actions/wholesale";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { fmtIQD } from "@/lib/format";
import type { DeliveryNote, Quote, RecentInvoice } from "@/lib/db/wholesale";

type Opt = { id: string; name: string };

const QUOTE_STATUS: Record<Quote["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};
const NOTE_STATUS: Record<DeliveryNote["status"], string> = {
  prepared: "Prepared",
  out: "Out with the driver",
  delivered: "Delivered",
};

/** The wholesale screen (0111): quotes, delivery notes, credit notes, prices and cartons. */
export function Wholesale({
  quotes,
  notes,
  invoices,
  customers,
  sizes,
  items,
  today,
}: {
  quotes: Quote[];
  notes: DeliveryNote[];
  invoices: RecentInvoice[];
  customers: Opt[];
  sizes: Opt[];
  items: Opt[];
  today: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const keys = useRef<Record<string, string>>({});
  const keyFor = (k: string) => (keys.current[k] ??= crypto.randomUUID());

  const run = (
    f: () => Promise<{ ok: boolean; error?: string }>,
    after?: () => void,
    k?: string,
  ) => {
    setMsg(null);
    start(async () => {
      const r = await f();
      if (!r.ok) setMsg({ ok: false, text: r.error ?? "" });
      else {
        if (k) delete keys.current[k];
        after?.();
        setMsg({ ok: true, text: t("Saved.") });
        router.refresh();
      }
    });
  };

  // A new quote.
  const [qCustomer, setQCustomer] = useState("");
  const [qLines, setQLines] = useState<{ variantId: string; qty: string }[]>([
    { variantId: "", qty: "1" },
  ]);
  const [qUntil, setQUntil] = useState("");
  // A delivery note.
  const [dnInvoice, setDnInvoice] = useState("");
  const [dnDriver, setDnDriver] = useState("");
  const [dnRoute, setDnRoute] = useState("");
  const [signer, setSigner] = useState<Record<string, string>>({});
  // A credit note.
  const [cnCustomer, setCnCustomer] = useState("");
  const [cnAmount, setCnAmount] = useState("");
  const [cnReason, setCnReason] = useState("");
  // A customer's price.
  const [pCustomer, setPCustomer] = useState("");
  const [pSize, setPSize] = useState("");
  const [pPrice, setPPrice] = useState("");
  // A stock item sold.
  const [sItem, setSItem] = useState("");
  const [sName, setSName] = useState("");
  const [sPrice, setSPrice] = useState("");
  const [sPack, setSPack] = useState("1");

  const select = (
    value: string,
    set: (v: string) => void,
    opts: Opt[],
    label: string,
    testid: string,
  ) => (
    <select
      style={inputStyle}
      value={value}
      onChange={(e) => set(e.target.value)}
      aria-label={label}
      data-testid={testid}
    >
      <option value="">{t("Choose…")}</option>
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid" style={{ gap: 16 }} data-testid="wholesale">
      <Notice msg={msg} />

      <section className="card grid" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{t("Quotes")}</h3>
        {quotes.length > 0 && (
          <table data-testid="quotes">
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} data-testid="quote-row" data-no={q.quoteNo}>
                  <td className="mono">#{q.quoteNo}</td>
                  <td>
                    <strong>{q.customer}</strong>
                    <div className="muted" style={{ fontSize: ".85rem" }}>
                      {q.lines.map((l) => `${l.qty} × ${l.name} @ ${fmtIQD(l.price)}`).join(", ")}
                    </div>
                  </td>
                  <td className="right mono">{fmtIQD(q.total)}</td>
                  <td>{t(QUOTE_STATUS[q.status])}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {q.status === "draft" && (
                      <button
                        type="button"
                        className="btn-link"
                        disabled={busy}
                        onClick={() => run(() => setQuoteStatusAction(q.id, "sent"))}
                      >
                        {t("Sent")}
                      </button>
                    )}
                    {(q.status === "draft" || q.status === "sent") && (
                      <button
                        type="button"
                        className="btn-link"
                        disabled={busy}
                        onClick={() => run(() => setQuoteStatusAction(q.id, "accepted"))}
                        data-testid="quote-accept"
                      >
                        {t("Accepted")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => invoiceQuoteAction(q.id, keyFor(`inv:${q.id}`)),
                          undefined,
                          `inv:${q.id}`,
                        )
                      }
                      data-testid="quote-invoice"
                    >
                      {t("Invoice it")}
                    </button>{" "}
                    <button
                      type="button"
                      className="btn-link"
                      disabled={busy}
                      onClick={() => run(() => setQuoteStatusAction(q.id, "cancelled"))}
                    >
                      {t("Cancel")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}
        >
          <Field label={t("Customer")}>
            {select(qCustomer, setQCustomer, customers, t("Customer"), "quote-customer")}
          </Field>
          <Field label={t("Good until")}>
            <input
              type="date"
              style={inputStyle}
              value={qUntil}
              min={today}
              onChange={(e) => setQUntil(e.target.value)}
            />
          </Field>
        </div>
        {qLines.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            {select(
              l.variantId,
              (v) => setQLines((x) => x.map((y, j) => (j === i ? { ...y, variantId: v } : y))),
              sizes,
              t("Product"),
              "quote-size",
            )}
            <input
              style={{ ...inputStyle, maxWidth: 90 }}
              inputMode="decimal"
              value={l.qty}
              aria-label={t("Quantity")}
              onChange={(e) =>
                setQLines((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))
              }
              data-testid="quote-qty"
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setQLines((x) => [...x, { variantId: "", qty: "1" }])}
          >
            {t("Another line")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !qCustomer}
            data-testid="quote-save"
            onClick={() =>
              run(
                () =>
                  saveQuoteAction({
                    customerId: qCustomer,
                    lines: qLines
                      .filter((l) => l.variantId)
                      .map((l) => ({
                        variantId: l.variantId,
                        qty: Number(l.qty.replace(",", ".")) || 0,
                      })),
                    validUntil: qUntil || null,
                    note: null,
                  }),
                () => setQLines([{ variantId: "", qty: "1" }]),
              )
            }
          >
            {t("Make the quote")}
          </button>
        </div>
      </section>

      <section className="card grid" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{t("Delivery notes")}</h3>
        {notes.length > 0 && (
          <table data-testid="delivery-notes">
            <tbody>
              {notes.map((d) => (
                <tr key={d.id} data-testid="delivery-row" data-no={d.noteNo}>
                  <td className="mono">#{d.noteNo}</td>
                  <td>
                    <strong>{d.customer}</strong> · {t("Invoice {n}", { n: d.invoiceNo })}
                    <div className="muted">
                      {[d.driver, d.route].filter(Boolean).join(" · ")}
                      {d.receivedBy ? ` · ${t("Signed by {name}", { name: d.receivedBy })}` : ""}
                    </div>
                  </td>
                  <td>{t(NOTE_STATUS[d.status])}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {d.status === "prepared" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            setDeliveryStatusAction({ id: d.id, status: "out", receivedBy: null }),
                          )
                        }
                        data-testid="delivery-out"
                      >
                        {t("Out with the driver")}
                      </button>
                    )}
                    {d.status !== "delivered" && (
                      <>
                        <input
                          style={{ ...inputStyle, maxWidth: 150 }}
                          placeholder={t("Who signed for it")}
                          aria-label={t("Who signed for it")}
                          value={signer[d.id] ?? ""}
                          onChange={(e) => setSigner((x) => ({ ...x, [d.id]: e.target.value }))}
                          data-testid="delivery-signer"
                        />{" "}
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              setDeliveryStatusAction({
                                id: d.id,
                                status: "delivered",
                                receivedBy: signer[d.id] ?? null,
                              }),
                            )
                          }
                          data-testid="delivery-done"
                        >
                          {t("Delivered")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}
        >
          <Field label={t("Invoice")}>
            {select(
              dnInvoice,
              setDnInvoice,
              invoices
                .filter((i) => i.delivery !== "prepared" && i.delivery !== "out")
                .map((i) => ({
                  id: i.id,
                  name: `${i.invoiceNo} · ${i.customer} · ${fmtIQD(i.amount)}`,
                })),
              t("Invoice"),
              "delivery-invoice",
            )}
          </Field>
          <Field label={t("Driver")}>
            <input
              style={inputStyle}
              value={dnDriver}
              maxLength={80}
              onChange={(e) => setDnDriver(e.target.value)}
              data-testid="delivery-driver"
            />
          </Field>
          <Field label={t("Route")}>
            <input
              style={inputStyle}
              value={dnRoute}
              maxLength={120}
              onChange={(e) => setDnRoute(e.target.value)}
            />
          </Field>
          <div style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !dnInvoice}
              data-testid="delivery-make"
              onClick={() =>
                run(
                  () =>
                    makeDeliveryNoteAction({
                      invoiceId: dnInvoice,
                      driver: dnDriver,
                      route: dnRoute || null,
                    }),
                  () => setDnInvoice(""),
                )
              }
            >
              {t("Make the delivery note")}
            </button>
          </div>
        </div>
      </section>

      <section className="card grid" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{t("A credit note")}</h3>
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}
        >
          <Field label={t("Customer")}>
            {select(cnCustomer, setCnCustomer, customers, t("Customer"), "credit-customer")}
          </Field>
          <Field label={t("Amount")}>
            <input
              style={inputStyle}
              inputMode="decimal"
              value={cnAmount}
              onChange={(e) => setCnAmount(e.target.value)}
              data-testid="credit-amount"
            />
          </Field>
          <Field label={t("Why")}>
            <input
              style={inputStyle}
              value={cnReason}
              maxLength={300}
              onChange={(e) => setCnReason(e.target.value)}
              data-testid="credit-reason"
            />
          </Field>
          <div style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !cnCustomer}
              data-testid="credit-save"
              onClick={() =>
                run(
                  () =>
                    creditCustomerAction(
                      {
                        customerId: cnCustomer,
                        amount: Number(cnAmount.replace(",", ".")) || 0,
                        reason: cnReason,
                      },
                      keyFor("credit"),
                    ),
                  () => {
                    setCnAmount("");
                    setCnReason("");
                  },
                  "credit",
                )
              }
            >
              {t("Take it off what they owe")}
            </button>
          </div>
        </div>
      </section>

      <section className="card grid" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{t("A customer's own price")}</h3>
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}
        >
          <Field label={t("Customer")}>
            {select(pCustomer, setPCustomer, customers, t("Customer"), "price-customer")}
          </Field>
          <Field label={t("Product")}>
            {select(pSize, setPSize, sizes, t("Product"), "price-size")}
          </Field>
          <Field label={t("Their price")}>
            <input
              style={inputStyle}
              inputMode="decimal"
              value={pPrice}
              onChange={(e) => setPPrice(e.target.value)}
              data-testid="price-amount"
            />
          </Field>
          <div style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !pCustomer || !pSize}
              data-testid="price-save"
              onClick={() =>
                run(() =>
                  setCustomerPriceAction({
                    customerId: pCustomer,
                    variantId: pSize,
                    price: pPrice.trim() === "" ? null : Number(pPrice.replace(",", ".")),
                  }),
                )
              }
            >
              {t("Save")}
            </button>
          </div>
        </div>
      </section>

      <section className="card grid" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{t("Sell a stock item as it is")}</h3>
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}
        >
          <Field label={t("Stock item")}>
            {select(sItem, setSItem, items, t("Stock item"), "sell-item")}
          </Field>
          <Field label={t("Name on the menu")}>
            <input
              style={inputStyle}
              value={sName}
              maxLength={120}
              onChange={(e) => setSName(e.target.value)}
              data-testid="sell-name"
            />
          </Field>
          <Field label={t("How many in one (a carton's count)")}>
            <input
              style={inputStyle}
              inputMode="decimal"
              value={sPack}
              onChange={(e) => setSPack(e.target.value)}
              data-testid="sell-pack"
            />
          </Field>
          <Field label={t("Price")}>
            <input
              style={inputStyle}
              inputMode="decimal"
              value={sPrice}
              onChange={(e) => setSPrice(e.target.value)}
              data-testid="sell-price"
            />
          </Field>
          <div style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !sItem}
              data-testid="sell-save"
              onClick={() =>
                run(
                  () =>
                    makeItemSellableAction({
                      itemId: sItem,
                      name: sName,
                      price: Number(sPrice.replace(",", ".")) || 0,
                      pack: Number(sPack.replace(",", ".")) || 0,
                    }),
                  () => {
                    setSName("");
                    setSPrice("");
                  },
                )
              }
            >
              {t("Put it on the menu")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
