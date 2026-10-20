import { byPickupDay, type PreOrderList } from "@/lib/preOrders";
import { dateIn, dateTimeIn } from "@/lib/dates";
import { withSize } from "@/lib/format";
import type { Locale, T } from "@/lib/i18n/core";
import { Icon } from "@/components/Icon";

/**
 * What the customers ordered ahead (0076), for the kitchen: the open
 * pre-orders by the day they are collected, soonest first, each with what to
 * write on it.
 */
export function PreOrdersToMake({
  list,
  timezone,
  today,
  locale,
  t,
}: {
  list: PreOrderList;
  timezone: string;
  today: string;
  locale: Locale;
  t: T;
}) {
  const days = byPickupDay(list.orders, (iso) => dateIn(timezone, new Date(iso)));
  if (days.length === 0) return null;
  return (
    <section className="card grid" style={{ gap: 10 }} data-testid="preorders-to-make">
      <h2 style={{ margin: 0 }}>
        <Icon name="clock" /> {t("Ordered ahead")}
      </h2>
      {days.map((d) => (
        <div key={d.day} className="grid" style={{ gap: 6 }}>
          <b className={d.day < today ? "red" : undefined}>
            {d.day === today ? t("Today") : <bdi className="mono">{d.day}</bdi>}
          </b>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {d.orders.map((o) => (
              <li key={o.id} data-testid="preorder-to-make">
                <span className="mono">{dateTimeIn(timezone, o.pickupAt).slice(11)}</span> · #{o.no}{" "}
                <bdi>{o.customer}</bdi>:{" "}
                {o.lines
                  .map((l) => {
                    const name =
                      (locale === "ar" ? l.productAr : locale === "ckb" ? l.productCkb : null) ||
                      l.product;
                    return `${l.qty} × ${withSize(name, l.size, l.product)}${l.note ? ` — “${l.note}”` : ""}`;
                  })
                  .join(", ")}
                {o.note ? <span className="muted"> · {o.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
