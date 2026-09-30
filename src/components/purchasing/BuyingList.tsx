"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { draftOrdersFromListAction, type DraftedOrder } from "@/lib/actions/buying";
import {
  bySupplier,
  draftOf,
  inPack,
  listStamp,
  reasonsOf,
  sourceOf,
  STATUS_LABEL,
  withSupplier,
  type BuyingLine,
  type BuyingList,
  type LineDraft,
} from "@/lib/buying";
import { orderTotal } from "@/lib/purchasing";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;
type Unit = { code: string; label: string; factor: number };

const fresh = (list: BuyingList): Record<string, LineDraft> =>
  Object.fromEntries(list.items.map((l) => [l.itemId, draftOf(l)]));

/**
 * What to buy (0045): the items to order, grouped by the supplier each is
 * bought from, each with why and its numbers; the rest below, any of which
 * can be added. The buyer ticks, changes a quantity, pack, price or supplier,
 * and creates the orders: a draft for each supplier, for a manager to approve.
 */
export function BuyingListForm({
  list,
  units,
  suppliers,
  canCreate,
}: {
  list: BuyingList;
  /** Each item's units, its base unit first. */
  units: Record<string, Unit[]>;
  suppliers: { id: string; name: string }[];
  canCreate: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [made, setMade] = useState<DraftedOrder[] | null>(null);
  const stamp = listStamp(list);
  const [seen, setSeen] = useState(stamp);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(() => fresh(list));
  if (seen !== stamp) {
    // The list changed under the screen (orders drafted, stock moved): start again from it.
    setSeen(stamp);
    setDrafts(fresh(list));
  }
  const names = new Map(suppliers.map((s) => [s.id, s.name]));
  const unitsOf = (itemId: string) => units[itemId] ?? [];
  const packName = (itemId: string, code: string) =>
    unitName(unitsOf(itemId).find((u) => u.code === code)?.label ?? code, t);
  const draft = (l: BuyingLine) => drafts[l.itemId] ?? draftOf(l);
  const set = (itemId: string, d: LineDraft) => setDrafts((all) => ({ ...all, [itemId]: d }));

  const shown = list.items.filter((l) => l.status === "order" || draft(l).include);
  const rest = list.items.filter((l) => !(l.status === "order" || draft(l).include));
  const typed = (l: BuyingLine) => {
    const d = draft(l);
    return {
      line: l,
      draft: d,
      supplierId: d.supplierId,
      qty: Number(normaliseNumber(d.qty)) || 0,
      unitPrice: Number(normaliseNumber(d.price)) || 0,
    };
  };
  const groups = bySupplier(shown.map(typed), names);
  const chosen = shown.map(typed).filter((x) => x.draft.include);
  const chosenGroups = bySupplier(chosen, names);
  const noSupplier = chosen.some((x) => x.supplierId === "");
  const ready =
    canCreate &&
    !busy &&
    chosen.length > 0 &&
    !noSupplier &&
    chosen.every((x) => x.qty > 0 && x.draft.price.trim() !== "");

  function create() {
    if (!ready) return;
    setMsg(null);
    setMade(null);
    start(async () => {
      const r = await op.run("draftFromList", (key) =>
        draftOrdersFromListAction(
          {
            locationId: list.locationId || null,
            lines: chosen.map((x) => ({
              itemId: x.line.itemId,
              supplierId: x.supplierId,
              qty: normaliseNumber(x.draft.qty),
              unitCode: x.draft.unit || x.line.baseUnit,
              unitPrice: normaliseNumber(x.draft.price),
              usual: x.draft.usual,
            })),
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMade(r.data.orders);
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      {made && (
        <div className="card" data-testid="buying-made">
          <strong>
            {made.length === 1
              ? t("1 draft order made, for a manager to approve:")
              : t("{n} draft orders made, for a manager to approve:", { n: made.length })}
          </strong>
          <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
            {made.map((o) => (
              <li key={o.poId} data-testid="buying-made-order">
                <Link href={`/purchasing/orders/${o.poId}`}>{t("Order {no}", { no: o.poNo })}</Link>{" "}
                ·{" "}
                {t("{supplier}: {n} line(s), {total}, expected {day}", {
                  supplier: o.supplier,
                  n: o.lines,
                  total: fmtIQD(o.total),
                  day: o.expectedOn ?? "—",
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card" data-testid="buying-nothing">
          <strong>{t("Nothing to order now.")}</strong>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: ".85rem" }}>
            {t(
              "Every item has enough on hand and coming for its use. Any of them can still be added from the list below.",
            )}
          </p>
        </div>
      ) : (
        groups.map((g) => {
          const lead = g.supplierId
            ? g.lines[0]?.line.choices.find((c) => c.supplierId === g.supplierId)?.leadTime
            : null;
          const ticked = g.lines.filter((x) => x.draft.include);
          return (
            <div
              key={g.supplierId || "none"}
              className="card"
              data-testid="buying-group"
              data-supplier={g.supplier ?? ""}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>{g.supplier ?? t("No supplier yet")}</h3>
                <span className="muted" style={{ fontSize: ".82rem" }}>
                  {g.supplierId
                    ? lead === null || lead === undefined
                      ? t("Delivers in the café's {n} day(s)", { n: list.leadTime })
                      : t("Delivers in {n} day(s)", { n: lead })
                    : t("Choose a supplier for each line")}
                </span>
                <span style={{ marginInlineStart: "auto" }} className="mono">
                  {t("{n} ticked · {total}", {
                    n: ticked.length,
                    total: fmtIQD(orderTotal(ticked)),
                  })}
                </span>
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th />
                      <th>{t("Item")}</th>
                      <th>{t("Why")}</th>
                      <th className="right">{t("Quantity")}</th>
                      <th>{t("Pack")}</th>
                      <th className="right">{t("Price of a pack")}</th>
                      <th className="right">{t("Amount")}</th>
                      <th>{t("Supplier")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map(({ line: l, draft: d, qty, unitPrice }) => {
                      const choice = l.choices.find((c) => c.supplierId === d.supplierId);
                      return (
                        <tr
                          key={l.itemId}
                          data-testid="buying-line"
                          data-item={l.item}
                          style={{ opacity: d.include ? 1 : 0.55 }}
                        >
                          <td style={{ width: 24 }}>
                            <input
                              type="checkbox"
                              aria-label={t("Order {item}", { item: l.item })}
                              checked={d.include}
                              disabled={!canCreate}
                              onChange={(e) => set(l.itemId, { ...d, include: e.target.checked })}
                            />
                          </td>
                          <td>
                            <Link href={`/inventory/${l.itemId}`}>{l.item}</Link>
                            {l.status !== "order" && (
                              <div className="muted" style={{ fontSize: ".75rem" }}>
                                {t("Added by hand")}
                              </div>
                            )}
                          </td>
                          <td
                            style={{ fontSize: ".78rem", maxWidth: 340 }}
                            data-testid="buying-why"
                          >
                            {reasonsOf(l, t, (code) => packName(l.itemId, code)).map((s, i) => (
                              <div key={i}>{s}</div>
                            ))}
                            <div className="muted">
                              {sourceOf(l, t).join(" ")}
                              {l.orders.map((o) => (
                                <Fragment key={o.poId}>
                                  {" "}
                                  <Link href={`/purchasing/orders/${o.poId}`}>
                                    {t("Order {no}", { no: o.poNo })}
                                  </Link>
                                  {`: ${fmtQty(o.baseQty)} ${unitName(l.baseUnit, t)}`}
                                </Fragment>
                              ))}
                            </div>
                          </td>
                          <td className="right">
                            <input
                              aria-label={t("Quantity")}
                              className="amt"
                              inputMode="decimal"
                              style={{ width: 70, textAlign: "end" }}
                              value={d.qty}
                              disabled={!canCreate}
                              onChange={(e) => set(l.itemId, { ...d, qty: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              aria-label={t("Pack")}
                              value={d.unit}
                              disabled={!canCreate}
                              onChange={(e) =>
                                set(l.itemId, inPack(l, d, e.target.value, unitsOf(l.itemId)))
                              }
                            >
                              {(unitsOf(l.itemId).length
                                ? unitsOf(l.itemId)
                                : [{ code: l.baseUnit, label: l.baseUnit, factor: 1 }]
                              ).map((u) => (
                                <option key={u.code} value={u.code}>
                                  {unitName(u.label, t)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="right">
                            <input
                              aria-label={t("Price of a pack")}
                              className="amt"
                              inputMode="decimal"
                              style={{ width: 90, textAlign: "end" }}
                              value={d.price}
                              disabled={!canCreate}
                              onChange={(e) => set(l.itemId, { ...d, price: e.target.value })}
                            />
                          </td>
                          <td className="right mono">{fmtIQD(orderTotal([{ qty, unitPrice }]))}</td>
                          <td>
                            <select
                              aria-label={t("Supplier")}
                              value={d.supplierId}
                              disabled={!canCreate}
                              onChange={(e) => set(l.itemId, withSupplier(l, d, e.target.value))}
                            >
                              <option value="">{t("Choose…")}</option>
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            {d.supplierId !== "" &&
                              (choice?.usual ? (
                                <div className="muted" style={{ fontSize: ".75rem" }}>
                                  {t("The usual supplier")}
                                </div>
                              ) : (
                                <label style={{ display: "flex", gap: 4, fontSize: ".75rem" }}>
                                  <input
                                    type="checkbox"
                                    checked={d.usual}
                                    disabled={!canCreate}
                                    onChange={(e) =>
                                      set(l.itemId, { ...d, usual: e.target.checked })
                                    }
                                  />
                                  {t("Make it the usual one")}
                                </label>
                              ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {canCreate && (
        <div className="card" style={{ display: "grid", gap: 8 }} data-testid="buying-create">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span>
              {chosen.length === 0
                ? t("Tick what to order.")
                : t("{lines} line(s) ticked: {orders} draft order(s), {total} in all.", {
                    lines: chosen.length,
                    orders: chosenGroups.filter((g) => g.supplierId !== "").length,
                    total: fmtIQD(orderTotal(chosen)),
                  })}
            </span>
            <button
              className="btn-primary"
              type="button"
              style={{ marginInlineStart: "auto" }}
              disabled={!ready}
              onClick={create}
            >
              {busy ? t("Saving…") : t("Create the orders")}
            </button>
          </div>
          {noSupplier && (
            <span className="muted" style={{ fontSize: ".82rem" }}>
              {t("Choose a supplier for every line ticked.")}
            </span>
          )}
          <OperationStatus op={op} />
          <Notice msg={msg} />
        </div>
      )}

      <details className="card" data-testid="buying-rest" open={groups.length === 0}>
        <summary style={{ cursor: "pointer" }}>
          <strong>{t("Not to order now ({n})", { n: rest.length })}</strong>
          <span className="muted" style={{ fontSize: ".82rem" }}>
            {" "}
            · {t("each with why; add any of them to an order")}
          </span>
        </summary>
        {rest.length === 0 ? (
          <p className="muted" style={{ fontSize: ".85rem" }}>
            {t("Every item bought is to order.")}
          </p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Item")}</th>
                  <th>{t("Stage")}</th>
                  <th>{t("Why")}</th>
                  <th className="right">{t("On hand")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rest.map((l) => (
                  <tr key={l.itemId} data-testid="buying-rest-line" data-item={l.item}>
                    <td>
                      <Link href={`/inventory/${l.itemId}`}>{l.item}</Link>
                    </td>
                    <td>
                      <span className={l.status === "enough" ? "badge ok" : "badge"}>
                        {t(STATUS_LABEL[l.status])}
                      </span>
                    </td>
                    <td style={{ fontSize: ".78rem", maxWidth: 420 }}>
                      {reasonsOf(l, t, (code) => packName(l.itemId, code)).join(" ")}
                    </td>
                    <td className="right mono">
                      {fmtQty(l.onHand)} {unitName(l.baseUnit, t)}
                    </td>
                    <td>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => set(l.itemId, { ...draft(l), include: true })}
                        >
                          {t("Add to an order")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
