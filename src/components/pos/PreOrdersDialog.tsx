"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  cancelPreOrderAction,
  collectPreOrderAction,
  listPreOrdersAction,
  takePreOrderAction,
} from "@/lib/actions/preOrders";
import { isLate, leftToPay, type PreOrder, type PreOrderList } from "@/lib/preOrders";
import { addDays, businessToday, dateTimeIn, localTimeToIso } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/core";
import { Modal } from "./Dialogs";
import { Icon } from "@/components/Icon";

/** A line of the order on the till, to be taken as a pre-order. */
export interface CartLine {
  variantId: string;
  qty: number;
  note: string | null;
  name: string;
  amount: number;
  hasAddons: boolean;
}

type Way = { type: "cash" | "card" | "other"; method: string | null; name: string };

type View =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "collect"; order: PreOrder; error: string | null; done: number | null }
  | { kind: "cancel"; order: PreOrder; error: string | null };

function productName(l: PreOrder["lines"][number], locale: Locale): string {
  const name =
    (locale === "ar" ? l.productAr : locale === "ckb" ? l.productCkb : null) || l.product;
  return l.size ? `${name} (${l.size})` : name;
}

/**
 * Pre-orders at the till (0076): the open ones, soonest first, each
 * collected — its deposit paying its part, the rest paid with a tap — or
 * cancelled, the deposit given back or kept; and the order on the till taken
 * as a new one, with the customer's name, when it is collected, and what they
 * pay now.
 */
export function PreOrdersDialog({
  cart,
  channel,
  discounted,
  payMethods,
  timezone,
  canCancel,
  initial,
  onTaken,
  onChanged,
  onClose,
}: {
  cart: CartLine[];
  channel: string;
  /** The order on the till carries a discount: a pre-order is at the menu's prices. */
  discounted: boolean;
  payMethods: { id: string; name: string }[];
  timezone: string;
  canCancel: boolean;
  initial: PreOrderList | null;
  /** The order on the till became a pre-order: clear it. */
  onTaken: () => void;
  /** How many are open now, for the till's button. */
  onChanged: (open: number) => void;
  onClose: () => void;
}) {
  const { t, msg: say, locale } = useT();
  const [list, setList] = useState<PreOrderList | null>(initial);
  const [view, setView] = useState<View>({ kind: cart.length > 0 ? "new" : "list" });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [now] = useState(() => Date.now());

  const ways: Way[] = [
    { type: "cash", method: null, name: t("pos.tender.cash") },
    { type: "card", method: null, name: t("pos.tender.card") },
    ...payMethods.map((m) => ({ type: "other" as const, method: m.id, name: m.name })),
  ];

  function reload() {
    start(async () => {
      const r = await listPreOrdersAction();
      if (r.ok && r.data) {
        setList(r.data);
        onChanged(r.data.orders.length);
      }
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, []);

  // ------------------------------------------------------------ a new one
  const tomorrow = `${addDays(businessToday(timezone), 1)}T10:00`;
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    pickup: tomorrow,
    note: "",
    deposit: "",
    way: 0,
  });
  const takeKey = useRef(crypto.randomUUID());
  const cartTotal = cart.reduce((s, l) => s + l.amount, 0);
  const withAddons = cart.some((l) => l.hasAddons);
  const wrongChannel = channel !== "takeaway" && channel !== "dine_in";

  function take() {
    setError(null);
    const pickupAt = localTimeToIso(form.pickup, timezone);
    if (!pickupAt) return setError("Say when it is collected");
    const amount = form.deposit.trim() === "" ? 0 : Number(form.deposit.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount < 0) return setError("The payments cannot be read");
    const way: Way = ways[form.way] ?? { type: "cash", method: null, name: "" };
    start(async () => {
      const r = await takePreOrderAction(
        {
          customer: form.customer,
          phone: form.phone || null,
          pickupAt,
          note: form.note || null,
          channel: channel as "takeaway" | "dine_in",
          lines: cart.map((l) => ({ variantId: l.variantId, qty: l.qty, note: l.note })),
          deposit: amount > 0 ? { type: way.type, amount, method: way.method } : null,
        },
        takeKey.current,
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      takeKey.current = crypto.randomUUID();
      onTaken();
      setView({ kind: "list" });
      reload();
    });
  }

  // ------------------------------------------------------------ collecting
  const collectKeys = useRef(new Map<string, string>());
  function collect(o: PreOrder, way: Way | null) {
    const left = leftToPay(o);
    const key = collectKeys.current.get(o.id) ?? crypto.randomUUID();
    collectKeys.current.set(o.id, key);
    start(async () => {
      const r = await collectPreOrderAction({
        preOrderId: o.id,
        key,
        expectedNet: o.total,
        tenders:
          left > 0 && way
            ? [
                {
                  type: way.type,
                  amount: left,
                  received: way.type === "cash" ? left : null,
                  method: way.method,
                },
              ]
            : null,
      });
      if (!r.ok) {
        setView({ kind: "collect", order: o, error: r.error, done: null });
        return;
      }
      setView({ kind: "collect", order: o, error: null, done: r.data.net });
      reload();
    });
  }

  // ------------------------------------------------------------ cancelling
  const [reason, setReason] = useState("");
  const [keep, setKeep] = useState(false);
  const cancelKey = useRef(crypto.randomUUID());
  function cancel(o: PreOrder) {
    start(async () => {
      const r = await cancelPreOrderAction(
        { preOrderId: o.id, reason, keepDeposit: keep },
        cancelKey.current,
      );
      if (!r.ok) {
        setView({ kind: "cancel", order: o, error: r.error });
        return;
      }
      cancelKey.current = crypto.randomUUID();
      setReason("");
      setKeep(false);
      setView({ kind: "list" });
      reload();
    });
  }

  const when = (iso: string) => <bdi className="mono">{dateTimeIn(timezone, iso)}</bdi>;
  const orders = list?.orders ?? [];

  return (
    <Modal label={t("Pre-orders")} busy={busy} onClose={onClose}>
      <div className="grid preorders" style={{ gap: 12 }} data-testid="preorders-dialog">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, flex: 1 }}>
            <Icon name="clock" /> {t("Pre-orders")}
          </h3>
          {view.kind === "list" ? (
            <button
              type="button"
              className="btn-primary"
              disabled={busy || cart.length === 0}
              title={cart.length === 0 ? t("Add what they order to the till first.") : undefined}
              onClick={() => {
                setError(null);
                setView({ kind: "new" });
              }}
              data-testid="preorder-new"
            >
              ＋ {t("New pre-order")}
            </button>
          ) : (
            <button type="button" onClick={() => setView({ kind: "list" })} disabled={busy}>
              {t("pos.back")}
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={busy}
            aria-label={t("Close")}
            title={t("Close")}
            data-testid="preorders-close"
          >
            <Icon name="close" />
          </button>
        </div>

        {view.kind === "list" && (
          <>
            {orders.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t(
                  "No pre-orders waiting. Add what the customer orders to the till, then press New pre-order.",
                )}
              </p>
            ) : (
              <ul className="preorder-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {orders.map((o) => (
                  <li
                    key={o.id}
                    className={`card preorder-row${isLate(o, now) ? " late" : ""}`}
                    data-testid="preorder-row"
                    data-no={o.no}
                  >
                    <div
                      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}
                    >
                      <b>
                        #{o.no} · <bdi>{o.customer}</bdi>
                      </b>
                      <span className="muted">{when(o.pickupAt)}</span>
                      {isLate(o, now) && (
                        <span className="badge err">{t("Not collected yet")}</span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: ".85rem" }}>
                      {o.lines
                        .map(
                          (l) =>
                            `${l.qty} × ${productName(l, locale)}${l.note ? ` — ${l.note}` : ""}`,
                        )
                        .join(" · ")}
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                    >
                      <span className="mono">{fmtIQD(o.total)}</span>
                      {o.deposit > 0 && (
                        <span className="muted">
                          {t("Paid {amount} ahead", { amount: fmtIQD(o.deposit) })}
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      {canCancel && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setView({ kind: "cancel", order: o, error: null })}
                          data-testid="preorder-cancel"
                        >
                          {t("Cancel")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={() =>
                          setView({ kind: "collect", order: o, error: null, done: null })
                        }
                        data-testid="preorder-collect"
                      >
                        {t("Collect")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {list && list.held > 0 && (
              <p
                className="muted"
                style={{ margin: 0, fontSize: ".85rem" }}
                data-testid="preorders-held"
              >
                {t("Deposits held: {amount}", { amount: fmtIQD(list.held) })}
              </p>
            )}
          </>
        )}

        {view.kind === "new" && (
          <div className="grid" style={{ gap: 10 }} data-testid="preorder-form">
            <p className="muted" style={{ margin: 0 }}>
              {cart.map((l) => `${l.qty} × ${l.name}`).join(" · ")} — <b>{fmtIQD(cartTotal)}</b>
            </p>
            {(withAddons || discounted || wrongChannel) && (
              <p className="red" role="alert" style={{ margin: 0 }}>
                {wrongChannel
                  ? say("A pre-order is collected at the café: take it away or eat in")
                  : withAddons
                    ? t("A pre-order takes no add-ons: write what they want in the line's note.")
                    : t("A pre-order is at the menu's prices: take the discount off first.")}
              </p>
            )}
            <label className="field">
              <span>{t("Whose order is it?")}</span>
              <input
                value={form.customer}
                maxLength={80}
                autoFocus
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                data-testid="preorder-name"
              />
            </label>
            <label className="field">
              <span>{t("Phone (optional)")}</span>
              <input
                value={form.phone}
                inputMode="tel"
                maxLength={40}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t("Collected on")}</span>
              <input
                type="datetime-local"
                value={form.pickup}
                onChange={(e) => setForm({ ...form, pickup: e.target.value })}
                data-testid="preorder-pickup"
              />
            </label>
            <label className="field">
              <span>{t("Note for the kitchen (optional)")}</span>
              <input
                value={form.note}
                maxLength={500}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t("Paid now (optional)")}</span>
              <input
                inputMode="numeric"
                value={form.deposit}
                placeholder="0"
                onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                data-testid="preorder-deposit"
              />
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setForm({ ...form, deposit: String(Math.round(cartTotal / 2)) })}
              >
                {t("Half")}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, deposit: String(cartTotal) })}
              >
                {t("All of it")}
              </button>
            </div>
            {form.deposit.trim() !== "" && Number(form.deposit) > 0 && (
              <div className="seg" role="radiogroup" aria-label={t("How is it paid?")}>
                {ways.map((w, i) => (
                  <button
                    key={`${w.type}-${w.method ?? ""}`}
                    type="button"
                    role="radio"
                    aria-checked={form.way === i}
                    className={form.way === i ? "active" : ""}
                    onClick={() => setForm({ ...form, way: i })}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p className="red" role="alert" style={{ margin: 0 }}>
                {say(error)}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !form.customer.trim() || withAddons || discounted || wrongChannel}
                onClick={take}
                data-testid="preorder-take"
              >
                {busy ? "…" : t("Take the pre-order")}
              </button>
            </div>
          </div>
        )}

        {view.kind === "collect" && (
          <div className="grid" style={{ gap: 10 }} data-testid="preorder-collecting">
            <b>
              #{view.order.no} · <bdi>{view.order.customer}</bdi>
            </b>
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {view.order.lines.map((l, i) => (
                <li key={i}>
                  {l.qty} × {productName(l, locale)}
                  {l.note ? ` — ${l.note}` : ""}
                </li>
              ))}
            </ul>
            <div className="mono">
              {t("Total {amount}", { amount: fmtIQD(view.order.total) })}
              {view.order.deposit > 0 &&
                ` · ${t("Paid {amount} ahead", { amount: fmtIQD(view.order.deposit) })}`}
            </div>
            {view.done !== null ? (
              <p
                className="pos-val"
                role="status"
                data-testid="preorder-collected"
                style={{ margin: 0 }}
              >
                <Icon name="check" /> {t("Collected: the sale is recorded.")}
              </p>
            ) : leftToPay(view.order) > 0 ? (
              <>
                <b>{t("To pay now: {amount}", { amount: fmtIQD(leftToPay(view.order)) })}</b>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ways.map((w) => (
                    <button
                      key={`${w.type}-${w.method ?? ""}`}
                      type="button"
                      className="btn-primary"
                      disabled={busy}
                      onClick={() => collect(view.order, w)}
                      data-testid="preorder-pay"
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => collect(view.order, null)}
                data-testid="preorder-pay"
              >
                {t("Paid in full: hand it over")}
              </button>
            )}
            {view.error && (
              <p className="red" role="alert" style={{ margin: 0 }}>
                {say(view.error)}
              </p>
            )}
          </div>
        )}

        {view.kind === "cancel" && (
          <div className="grid" style={{ gap: 10 }} data-testid="preorder-cancelling">
            <b>
              #{view.order.no} · <bdi>{view.order.customer}</bdi>
            </b>
            <label className="field">
              <span>{t("Why (required)")}</span>
              <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            </label>
            {view.order.deposit > 0 && (
              <div className="seg" role="radiogroup" aria-label={t("The deposit")}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!keep}
                  className={!keep ? "active" : ""}
                  onClick={() => setKeep(false)}
                >
                  {t("Give {amount} back", { amount: fmtIQD(view.order.deposit) })}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={keep}
                  className={keep ? "active" : ""}
                  onClick={() => setKeep(true)}
                  data-testid="preorder-keep"
                >
                  {t("Keep it")}
                </button>
              </div>
            )}
            {view.error && (
              <p className="red" role="alert" style={{ margin: 0 }}>
                {say(view.error)}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="danger"
                disabled={busy || !reason.trim()}
                onClick={() => cancel(view.order)}
                data-testid="preorder-cancel-confirm"
              >
                {t("Cancel the pre-order")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
