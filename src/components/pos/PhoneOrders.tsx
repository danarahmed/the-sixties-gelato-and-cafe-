"use client";

import { useCallback, useEffect, useState } from "react";
import {
  handlePhoneOrderAction,
  phoneOrdersAction,
  type PhoneOrder,
} from "@/lib/actions/publicMenu";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * Orders sent from customers' phones (0119), at the till: a button while one
 * waits; each added to the order on screen (then rung up as any) or turned
 * down with why. Asked again every 20 seconds.
 */
export function PhoneOrders({
  nameOf,
  onTake,
}: {
  nameOf: (variantId: string) => string | null;
  /** Each line added to the order on screen. */
  onTake: (lines: { variantId: string; qty: number }[]) => void;
}) {
  const { t, msg } = useT();
  const [orders, setOrders] = useState<PhoneOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await phoneOrdersAction();
    if (r.ok) setOrders(r.data.filter((o) => o.status === "new"));
  }, []);
  useEffect(() => {
    void load();
    const tick = setInterval(load, 20_000);
    return () => clearInterval(tick);
  }, [load]);
  if (orders.length === 0) return null;

  async function handle(o: PhoneOrder, accept: boolean) {
    setErr(null);
    const r = await handlePhoneOrderAction({ orderId: o.id, accept, reason: why[o.id] ?? null });
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    if (accept) onTake(o.lines.filter((l) => nameOf(l.variantId) !== null));
    await load();
  }

  const where = (o: PhoneOrder) =>
    o.kind === "table"
      ? t("Table {name}", { name: o.table ?? "" })
      : `${o.kind === "pickup" ? t("To take away") : t("To deliver")} · ${o.name ?? ""} ${o.phone ?? ""}${o.address ? ` · ${o.address}` : ""}`;

  return (
    <>
      <button
        type="button"
        className="strip-chip"
        onClick={() => setOpen((x) => !x)}
        data-testid="phone-orders"
      >
        {t("From phones ({n})", { n: String(orders.length) })}
      </button>
      {open && (
        <div
          className="card grid"
          style={{ gap: 8, position: "absolute", zIndex: 20, maxWidth: 420 }}
          data-testid="phone-orders-list"
        >
          {err && <span className="red">{msg(err)}</span>}
          {orders.map((o) => (
            <div
              key={o.id}
              className="grid"
              style={{ gap: 4 }}
              data-testid="phone-order-row"
              data-no={o.orderNo}
            >
              <strong>
                {t("Order {no}", { no: String(o.orderNo) })} · {where(o)}
              </strong>
              <div style={{ fontSize: ".9rem" }}>
                {o.lines.map((l) => `${l.qty} × ${nameOf(l.variantId) ?? "—"}`).join(", ")}
              </div>
              {o.note && <div className="muted">“{o.note}”</div>}
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handle(o, true)}
                  data-testid="phone-order-take"
                >
                  {t("Add it to the order")}
                </button>
                <input
                  aria-label={t("Why it is turned down")}
                  placeholder={t("Why it is turned down")}
                  value={why[o.id] ?? ""}
                  onChange={(e) => setWhy({ ...why, [o.id]: e.target.value })}
                  style={{ width: 160 }}
                />
                <button
                  type="button"
                  onClick={() => handle(o, false)}
                  disabled={!(why[o.id] ?? "").trim()}
                >
                  {t("Turn it down")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
