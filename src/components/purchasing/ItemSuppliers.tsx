"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeItemSupplierAction, setItemSupplierAction } from "@/lib/actions/buying";
import type { ItemSupplier } from "@/lib/db/buying";
import { fmtPrice } from "@/lib/buying";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

/**
 * Who an item is bought from (0045): each supplier with the pack it comes in
 * and a pack's price agreed last, and which is the usual one, the one the
 * buying list suggests. Set and removed by whoever drafts orders; each change
 * is on the audit trail.
 */
export function ItemSuppliers({
  itemId,
  units,
  links,
  suppliers,
  canEdit,
}: {
  itemId: string;
  /** The item's units, its base unit first. */
  units: { code: string; label: string }[];
  links: ItemSupplier[];
  suppliers: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [f, setF] = useState({
    supplierId: "",
    pack: units[0]?.code ?? "",
    price: "",
    usual: false,
  });
  const label = (code: string) => units.find((u) => u.code === code)?.label ?? code;

  function save(input: { supplierId: string; pack: string; price: string; usual: boolean }) {
    setMsg(null);
    start(async () => {
      const r = await op.run("setItemSupplier", (key) =>
        setItemSupplierAction(
          {
            itemId,
            supplierId: input.supplierId,
            packUnit: input.pack,
            price: normaliseNumber(input.price) || null,
            usual: input.usual,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("Saved, and on the audit trail.") });
      setF({ supplierId: "", pack: units[0]?.code ?? "", price: "", usual: false });
      router.refresh();
    });
  }

  function remove(supplierId: string) {
    setMsg(null);
    start(async () => {
      const r = await op.run("removeItemSupplier", (key) =>
        removeItemSupplierAction({ itemId, supplierId }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("Removed, and on the audit trail.") });
      router.refresh();
    });
  }

  return (
    <section className="panel" data-testid="item-suppliers">
      <div className="panel-h">
        <h3>{t("Bought from")}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {t(
            "The pack each supplier sends it in and a pack's price; the usual one is suggested on What to buy",
          )}
        </span>
      </div>
      {links.length === 0 ? (
        <div className="panel-b">
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            {t("No supplier set yet: What to buy suggests the one its last delivery came from.")}
          </p>
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t("Supplier")}</th>
                <th>{t("Pack")}</th>
                <th className="right">{t("Price of a pack")}</th>
                <th>{t("Agreed")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.supplierId} data-testid="item-supplier-row" data-supplier={l.supplier}>
                  <td>
                    {l.supplier}{" "}
                    {l.usual && <span className="badge ok">{t("The usual supplier")}</span>}
                    {!l.active && <span className="badge warn">{t("Out of use")}</span>}
                  </td>
                  <td>{label(l.packUnit)}</td>
                  <td className="right mono">
                    {l.lastPrice === null ? "—" : fmtPrice(l.lastPrice)}
                  </td>
                  <td className="muted mono" style={{ fontSize: ".8rem" }}>
                    {l.lastPriceOn ?? "—"}
                  </td>
                  <td style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {canEdit && !l.usual && l.active && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          save({
                            supplierId: l.supplierId,
                            pack: l.packUnit,
                            price: "",
                            usual: true,
                          })
                        }
                      >
                        {t("Make it the usual one")}
                      </button>
                    )}
                    {canEdit && (
                      <button type="button" disabled={busy} onClick={() => remove(l.supplierId)}>
                        {t("Remove")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && suppliers.length > 0 && (
        <form
          className="panel-b"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
          data-testid="item-supplier-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (f.supplierId) save(f);
          }}
        >
          <label>
            <div className="sc">{t("Supplier")}</div>
            <select
              aria-label={t("Supplier")}
              value={f.supplierId}
              onChange={(e) => {
                const had = links.find((l) => l.supplierId === e.target.value);
                // A supplier set before keeps its pack, and stays the usual one unless unticked.
                setF({
                  ...f,
                  supplierId: e.target.value,
                  pack: had?.packUnit ?? f.pack,
                  usual: had?.usual ?? false,
                });
              }}
            >
              <option value="">{t("Choose…")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="sc">{t("Pack")}</div>
            <select
              aria-label={t("Pack")}
              value={f.pack}
              onChange={(e) => setF({ ...f, pack: e.target.value })}
            >
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="sc">{t("Price of a pack")}</div>
            <input
              aria-label={t("Price of a pack")}
              className="amt"
              inputMode="decimal"
              style={{ width: 110, textAlign: "end" }}
              value={f.price}
              placeholder={t("as it was")}
              onChange={(e) => setF({ ...f, price: e.target.value })}
            />
          </label>
          <label
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              fontSize: ".85rem",
              whiteSpace: "nowrap",
            }}
          >
            <input
              type="checkbox"
              checked={f.usual}
              onChange={(e) => setF({ ...f, usual: e.target.checked })}
            />
            {t("The usual supplier")}
          </label>
          <button className="btn-primary" type="submit" disabled={busy || !f.supplierId}>
            {busy ? t("Saving…") : t("Save the supplier")}
          </button>
        </form>
      )}
      <div className="panel-b" style={{ paddingTop: 0 }}>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </section>
  );
}
