import Link from "next/link";
import { getMsg, getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/core";
import { has, requirePermission } from "@/lib/auth/session";
import { getItem, getItemPriceHistory } from "@/lib/db/read";
import { getStockCard, type StockCardKind, type StockCardRow } from "@/lib/db/reports";
import { fmtIQD, fmtQty, itemTypeLabel, movementLabel } from "@/lib/format";
import { businessToday, dateTimeIn, monthStart, parseDay } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { EditItem, PackUnits } from "@/components/ItemEditor";

export const dynamic = "force-dynamic";

/** The card's lines, in the order a stock-taker reads them, in the reader's language. */
const LINES = (t: T): { kind: StockCardKind; label: string }[] => [
  { kind: "opening_stock", label: t("Opening stock recorded") },
  { kind: "received", label: t("Received (less returns to suppliers)") },
  { kind: "sold", label: t("Sold (less voids and refunds back on the shelf)") },
  { kind: "batches", label: t("Used in batches") },
  { kind: "made", label: t("Made") },
  { kind: "wasted", label: t("Wasted, spoiled, given away") },
  { kind: "counted", label: t("Stock counts") },
  { kind: "corrected", label: t("Corrections") },
  { kind: "transferred", label: t("Moved between locations") },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An item's stock card (audit P1-2): what it opened with, each kind of
 * movement in the dates, and what it closed with, which is what the stock
 * board shows at the end of the last day; then every movement, with the
 * balance after it. Below it (0027, P1-3 and P1-4): what each delivery cost,
 * the item's units, and the item corrected, by those who look after stock.
 */
export default async function StockCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const msg = await getMsg();
  const { itemId } = await params;
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const to = parseDay(sp.to, today);
  const from = parseDay(sp.from, monthStart(to));
  const item = UUID.test(itemId) ? await getItem(itemId) : null;
  if (!item) {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>{t("Stock card")}</h1>
        <EmptyState title={t("Item not found")} hint={t("Choose an item on Inventory.")} />
        <Link href="/inventory">{t("Back to Inventory")}</Link>
      </div>
    );
  }
  const [card, prices] = await Promise.all([
    getStockCard(item.id, from, to),
    getItemPriceHistory(item.id),
  ]);
  const canEdit =
    has(profile, "settings.manage") ||
    has(profile, "purchase.create") ||
    has(profile, "inventory.adjust.approve");
  const opening = card.find((r) => r.seq === 0);
  const moves = card.filter((r) => r.seq > 0);
  const last: StockCardRow | undefined = card[card.length - 1];
  const totals = new Map<StockCardKind, { qty: number; value: number }>();
  for (const m of moves) {
    const t = totals.get(m.kind) ?? { qty: 0, value: 0 };
    totals.set(m.kind, { qty: t.qty + m.qty, value: t.value + m.value });
  }
  const unit = item.baseUnit;
  const q = (n: number) => `${n > 0 ? "+" : ""}${fmtQty(n)}`;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="phead">
        <h1>{t("Stock card: {name}", { name: item.name })}</h1>
        <span className="sc">
          {t("{type} · {from} to {to} · in {unit}", {
            type: t(itemTypeLabel(item.itemType)),
            from,
            to,
            unit,
          })}
        </span>
        {!item.isActive && (
          <div className="sp">
            <span className="badge warn">{t("Out of use")}</span>
          </div>
        )}
      </div>

      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit">{t("Show")}</button>
        <Link href="/inventory" className="badge">
          {t("Back to Inventory")}
        </Link>
      </form>

      <section className="panel" data-testid="stock-card">
        <div className="panel-h">
          <h3>{t("Opening to closing")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Every movement of the stock ledger, at the value it was recorded with")}
          </span>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th />
                <th className="right">{t("Quantity ({unit})", { unit })}</th>
                <th className="right">{t("Value")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t("On hand when {from} began", { from })}</td>
                <td className="right mono">{fmtQty(opening?.qty ?? 0)}</td>
                <td className="right money">{fmtIQD(opening?.value ?? 0)}</td>
              </tr>
              {LINES(t)
                .filter((l) => totals.has(l.kind))
                .map((l) => (
                  <tr key={l.kind} data-kind={l.kind}>
                    <td>{l.label}</td>
                    <td className="right mono">{q(totals.get(l.kind)!.qty)}</td>
                    <td className="right money">{fmtIQD(totals.get(l.kind)!.value)}</td>
                  </tr>
                ))}
              <tr className="grand">
                <td>{t("On hand at the end of {to}", { to })}</td>
                <td className="right mono">{fmtQty(last?.balanceQty ?? 0)}</td>
                <td className="right money">{fmtIQD(last?.balanceValue ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <h3>{t("Movements")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("{n} in these dates", { n: moves.length })}
          </span>
        </div>
        {moves.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("Nothing moved in these dates.")}
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th>{t("What")}</th>
                  <th className="right">{t("Qty")}</th>
                  <th className="right">{t("Value")}</th>
                  <th className="right">{t("On hand")}</th>
                  <th className="right">{t("Worth")}</th>
                  <th>{t("Note")}</th>
                  <th>{t("By")}</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.seq}>
                    <td className="mono muted" style={{ fontSize: ".8rem", whiteSpace: "nowrap" }}>
                      {dateTimeIn(profile.timezone, m.occurredAt)}
                    </td>
                    <td>
                      <span className="badge">
                        {m.movement ? t(movementLabel(m.movement)) : "—"}
                      </span>
                    </td>
                    <td
                      className="right mono"
                      style={{ color: m.qty < 0 ? "var(--err)" : "var(--ok)" }}
                    >
                      {q(m.qty)}
                    </td>
                    <td className="right mono">{fmtIQD(m.value)}</td>
                    <td className="right mono">{fmtQty(m.balanceQty)}</td>
                    <td className="right mono">{fmtIQD(m.balanceValue)}</td>
                    <td className="muted" style={{ fontSize: ".85rem" }}>
                      {msg(m.reason ?? "")}
                    </td>
                    <td className="muted" style={{ fontSize: ".85rem" }}>
                      {m.by ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" data-testid="price-history">
        <div className="panel-h">
          <h3>{t("What it has cost")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Each delivery, newest first: the price paid, and with freight shared out")}
          </span>
        </div>
        {prices.length === 0 ? (
          <div className="panel-b">
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("No deliveries of it yet.")}
            </p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Received")}</th>
                  <th>{t("Receipt")}</th>
                  <th>{t("Supplier")}</th>
                  <th className="right">{t("Quantity")}</th>
                  <th className="right">{t("Paid")}</th>
                  <th className="right">{t("A {unit}", { unit })}</th>
                  <th className="right">{t("Landed, a {unit}", { unit })}</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p, i) => (
                  <tr key={`${p.receiptNo}-${i}`}>
                    <td className="mono muted" style={{ fontSize: ".8rem", whiteSpace: "nowrap" }}>
                      {dateTimeIn(profile.timezone, p.receivedAt)}
                    </td>
                    <td className="mono">{p.receiptNo ?? "—"}</td>
                    <td>{p.supplier ?? "—"}</td>
                    <td className="right mono">
                      {fmtQty(p.qty)} {p.unit}
                    </td>
                    <td className="right money">{fmtIQD(p.goodsValue)}</td>
                    <td className="right mono">
                      {/* i18n-ignore: a cost in IQD, the currency's code */}
                      {p.costPerBase === null ? "—" : `${fmtQty(p.costPerBase)} IQD`}
                    </td>
                    <td className="right mono">
                      {/* i18n-ignore: a cost in IQD, the currency's code */}
                      {p.landedPerBase === null ? "—" : `${fmtQty(p.landedPerBase)} IQD`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PackUnits item={item} canAdd={canEdit} />
      {canEdit && <EditItem item={item} />}
    </div>
  );
}
