"use client";

import { useEffect, useMemo, useState } from "react";
import { phoneOrderStatusAction, submitPhoneOrderAction } from "@/lib/actions/publicMenu";
import { encodeQrOrder, type PublicMenu, type PublicMenuItem } from "@/lib/qrOrder";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { QrCode } from "@/components/QrCode";

/**
 * The café's menu on the customer's phone (0118): the categories, each
 * product with its photo and price; tapped into an order, shown as a QR for
 * the waiter to scan at the till. Nothing is sent from the phone.
 */
export function PhoneMenu({ menu, token }: { menu: PublicMenu; token: string }) {
  const { t, locale } = useT();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [showing, setShowing] = useState(false);
  const groups = useMemo(() => {
    const category = (i: PublicMenuItem) =>
      (locale === "ar" ? i.categoryAr : locale === "ckb" ? i.categoryCkb : null) ?? i.category;
    const out: { name: string | null; items: PublicMenuItem[] }[] = [];
    for (const i of menu.items) {
      const c = category(i);
      const g = out.find((x) => x.name === c);
      if (g) g.items.push(i);
      else out.push({ name: c, items: [i] });
    }
    return out;
  }, [menu, locale]);
  const name = (i: PublicMenuItem) =>
    (locale === "ar" ? i.nameAr : locale === "ckb" ? i.nameCkb : null) ?? i.product;
  const lines = menu.items.filter((i) => (qty[i.variantId] ?? 0) > 0);
  const count = lines.reduce((s, i) => s + (qty[i.variantId] ?? 0), 0);
  const total = lines.reduce((s, i) => s + i.price * (qty[i.variantId] ?? 0), 0);
  const add = (id: string, n: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(99, (q[id] ?? 0) + n)) }));
  const sized = (i: PublicMenuItem) => (i.variant && i.variant !== "Regular" ? i.variant : null);

  if (showing) {
    return (
      <div
        className="grid"
        style={{ gap: 12, maxWidth: 480, margin: "0 auto" }}
        data-testid="phone-order"
      >
        <h1 style={{ margin: 0 }}>{t("Your order")}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t("Show this to the waiter: they scan it, and bring what you chose.")}
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <QrCode
            text={encodeQrOrder(
              lines.map((i) => ({ variantId: i.variantId, qty: qty[i.variantId] ?? 0 })),
            )}
            size={260}
            label={t("Your order, for the waiter to scan")}
            testId="phone-order-qr"
          />
        </div>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {lines.map((i) => (
            <li key={i.variantId} dir="auto">
              {qty[i.variantId]} × {name(i)}
              {sized(i) ? ` (${sized(i)})` : ""}
            </li>
          ))}
        </ul>
        <div style={{ fontWeight: 700 }}>{t("Total {amount}", { amount: fmtIQD(total) })}</div>
        <button type="button" onClick={() => setShowing(false)}>
          {t("Change my order")}
        </button>
        {(menu.toTill || menu.online) && (
          <SendOrder
            menu={menu}
            token={token}
            lines={lines.map((i) => ({
              variantId: i.variantId,
              qty: Math.min(20, qty[i.variantId] ?? 0),
            }))}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="grid"
      style={{ gap: 14, maxWidth: 640, margin: "0 auto" }}
      data-testid="phone-menu"
    >
      <div>
        <h1 style={{ margin: 0 }}>{menu.business}</h1>
        {menu.place && <div className="muted">{menu.place}</div>}
      </div>
      {groups.map((g) => (
        <section key={g.name ?? "-"} className="grid" style={{ gap: 8 }}>
          {g.name && <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{g.name}</h2>}
          {g.items.map((i) => (
            <div
              key={i.variantId}
              className="card"
              style={{ display: "flex", gap: 10, alignItems: "center" }}
              data-testid="phone-item"
              data-name={i.product}
            >
              {i.imageUrl && (
                <img
                  src={i.imageUrl}
                  alt=""
                  width={56}
                  height={56}
                  style={{ borderRadius: 8, objectFit: "cover" }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }} dir="auto">
                  {name(i)}
                </div>
                {sized(i) && (
                  <div className="muted" style={{ fontSize: ".85rem" }}>
                    {sized(i)}
                  </div>
                )}
                <div className="money">{fmtIQD(i.price)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {(qty[i.variantId] ?? 0) > 0 && (
                  <>
                    <button
                      type="button"
                      aria-label={t("One less")}
                      onClick={() => add(i.variantId, -1)}
                    >
                      −
                    </button>
                    <span className="mono" data-testid="phone-qty">
                      {qty[i.variantId]}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  aria-label={t("One more of {name}", { name: name(i) })}
                  onClick={() => add(i.variantId, 1)}
                  data-testid="phone-add"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </section>
      ))}
      {menu.items.length === 0 && <p className="muted">{t("Nothing is on the menu just now.")}</p>}
      {count > 0 && (
        <div
          className="card"
          style={{ position: "sticky", bottom: 8, display: "flex", gap: 10, alignItems: "center" }}
        >
          <div style={{ flex: 1 }}>
            {t("{n} chosen · {amount}", { n: String(count), amount: fmtIQD(total) })}
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowing(true)}
            data-testid="phone-show"
          >
            {t("Show my order to the waiter")}
          </button>
        </div>
      )}
    </div>
  );
}

/** The order sent to the till (0119): from a table, or to take away or deliver; then where it stands. */
function SendOrder({
  menu,
  token,
  lines,
}: {
  menu: PublicMenu;
  token: string;
  lines: { variantId: string; qty: number }[];
}) {
  const { t, msg } = useT();
  const kinds = [
    ...(menu.toTill ? (["table"] as const) : []),
    ...(menu.online ? (["pickup", "delivery"] as const) : []),
  ];
  const [kind, setKind] = useState<"table" | "pickup" | "delivery">(kinds[0] ?? "table");
  const [table, setTable] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; no: number } | null>(null);
  const [status, setStatus] = useState<{ status: string; reason: string | null } | null>(null);
  useEffect(() => {
    if (!sent || status?.status === "accepted" || status?.status === "declined") return;
    const tick = setInterval(async () => {
      const r = await phoneOrderStatusAction({ token, orderId: sent.id });
      if (r.ok) setStatus(r.data);
    }, 8000);
    return () => clearInterval(tick);
  }, [sent, status, token]);

  if (sent)
    return (
      <div className="card" data-testid="phone-sent">
        <strong>{t("Order {no} is sent", { no: String(sent.no) })}</strong>
        <div>
          {status?.status === "accepted"
            ? t("The café has taken it.")
            : status?.status === "declined"
              ? t("The café could not take it: {why}", { why: status.reason ?? "" })
              : t("Waiting for the café to take it…")}
        </div>
      </div>
    );
  const LABEL = { table: t("To my table"), pickup: t("To take away"), delivery: t("To deliver") };
  return (
    <form
      className="card grid"
      style={{ gap: 8 }}
      data-testid="phone-send"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setBusy(true);
        const r = await submitPhoneOrderAction({ token, kind, lines, name, phone, table, address });
        setBusy(false);
        if (!r.ok) setErr(r.error);
        else setSent({ id: r.data.orderId, no: r.data.orderNo });
      }}
    >
      <strong>{t("Or send it to the counter")}</strong>
      {kinds.length > 1 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {kinds.map((k) => (
            <label key={k} className="chip">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />{" "}
              {LABEL[k]}
            </label>
          ))}
        </div>
      )}
      {kind === "table" ? (
        <input
          aria-label={t("Your table")}
          placeholder={t("Your table")}
          value={table}
          onChange={(e) => setTable(e.target.value)}
        />
      ) : (
        <>
          <input
            aria-label={t("Your name")}
            placeholder={t("Your name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            aria-label={t("Your phone number")}
            placeholder="0750 123 4567"
            inputMode="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {kind === "delivery" && (
            <input
              aria-label={t("Where it goes")}
              placeholder={t("Where it goes")}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          )}
        </>
      )}
      {err && <span className="red">{msg(err)}</span>}
      <button type="submit" className="btn-primary" disabled={busy} data-testid="phone-send-go">
        {t("Send my order")}
      </button>
      <span className="muted" style={{ fontSize: ".8rem" }}>
        {t("You pay at the café, as always.")}
      </span>
    </form>
  );
}
