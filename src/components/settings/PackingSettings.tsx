"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePackingItemAction, setVariantPackingAction } from "@/lib/actions/packing";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

type Role = "bag" | "cup" | "lid" | "box" | "other";
interface PackItem {
  itemId: string;
  name: string;
  role: Role;
  takeaway: number;
  delivery: number;
  active: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  bag: "Bag",
  cup: "Cup",
  lid: "Lid",
  box: "Box",
  other: "Other packing",
};

/**
 * Packing (0107): which stock items are packing, how many of each an order
 * takes by default to take away and for delivery (a bag: 1), and what each
 * size goes out in (a cup and its lid). Free to the customer; its cost goes
 * to 5500 Packaging, never into the products' cost.
 */
export function PackingSettings({
  items,
  variants,
  stock,
  sizes,
}: {
  items: PackItem[];
  variants: { variantId: string; itemId: string; qty: number }[];
  stock: { id: string; name: string; unit: string }[];
  sizes: { id: string; name: string }[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newRole, setNewRole] = useState<Role>("bag");
  const [size, setSize] = useState("");
  const [sizeItems, setSizeItems] = useState<Record<string, number>>({});

  const run = (f: () => Promise<{ ok: boolean; error?: string }>) => {
    setMsg(null);
    start(async () => {
      const r = await f();
      if (!r.ok) setMsg({ ok: false, text: r.error ?? "" });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        router.refresh();
      }
    });
  };

  const save = (i: PackItem, change: Partial<PackItem>) => {
    const next = { ...i, ...change };
    run(() =>
      savePackingItemAction({
        itemId: next.itemId,
        role: next.role,
        takeaway: next.takeaway,
        delivery: next.delivery,
        active: next.active,
      }),
    );
  };

  const chooseSize = (id: string) => {
    setSize(id);
    const now: Record<string, number> = {};
    for (const v of variants) if (v.variantId === id) now[v.itemId] = v.qty;
    setSizeItems(now);
  };

  const sizeName = (id: string) => sizes.find((s) => s.id === id)?.name ?? "";
  const itemName = (id: string) => items.find((i) => i.itemId === id)?.name ?? "";
  const packed = [...new Set(variants.map((v) => v.variantId))];
  const notPacking = stock.filter((s) => !items.some((i) => i.itemId === s.id));

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="packing-settings">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Free to the customer, a cost to the café: what each order goes out in leaves stock at its average cost, to 5500 Packaging. Dine-in takes none. The till adds the defaults by itself; the cashier changes them with + and −.",
        )}
      </p>
      {items.length > 0 && (
        <table data-testid="packing-items">
          <thead>
            <tr>
              <th>{t("Item")}</th>
              <th>{t("What it is")}</th>
              <th className="right">{t("To take away")}</th>
              <th className="right">{t("For delivery")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.itemId} data-testid="packing-row" data-item={i.name}>
                <td className={i.active ? "" : "muted"}>{i.name}</td>
                <td>{t(ROLE_LABEL[i.role])}</td>
                {(["takeaway", "delivery"] as const).map((k) => (
                  <td key={k} className="right" style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="chip"
                      disabled={busy || i[k] <= 0}
                      onClick={() => save(i, { [k]: i[k] - 1 })}
                      aria-label={t("One fewer {name}", { name: i.name })}
                    >
                      −
                    </button>{" "}
                    <span className="mono" data-testid={`packing-${k}`}>
                      {i[k]}
                    </span>{" "}
                    <button
                      type="button"
                      className="chip"
                      disabled={busy || i[k] >= 20}
                      onClick={() => save(i, { [k]: i[k] + 1 })}
                      aria-label={t("One more {name}", { name: i.name })}
                      data-testid={`packing-${k}-more`}
                    >
                      +
                    </button>
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="btn-link"
                    disabled={busy}
                    onClick={() => save(i, { active: !i.active })}
                  >
                    {i.active ? t("Stop using it") : t("Use it again")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}
      >
        <Field label={t("A stock item that is packing")}>
          <select
            style={inputStyle}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            data-testid="packing-new-item"
          >
            <option value="">{t("Choose…")}</option>
            {notPacking.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("What it is")}>
          <select
            style={inputStyle}
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            data-testid="packing-new-role"
          >
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL[r])}
              </option>
            ))}
          </select>
        </Field>
        <div style={{ alignSelf: "end" }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !newItem}
            data-testid="packing-add"
            onClick={() => {
              const one = newRole === "bag" ? 1 : 0;
              run(async () => {
                const r = await savePackingItemAction({
                  itemId: newItem,
                  role: newRole,
                  takeaway: one,
                  delivery: one,
                  active: true,
                });
                if (r.ok) setNewItem("");
                return r;
              });
            }}
          >
            {t("Add as packing")}
          </button>
        </div>
      </div>

      {items.some((i) => i.active) && (
        <>
          <h4 style={{ margin: "6px 0 0" }}>{t("What each size goes out in")}</h4>
          {packed.length > 0 && (
            <ul style={{ margin: 0, paddingInlineStart: 18 }} data-testid="packing-sizes">
              {packed.map((id) => (
                <li key={id}>
                  <button type="button" className="btn-link" onClick={() => chooseSize(id)}>
                    {sizeName(id)}
                  </button>
                  {": "}
                  {variants
                    .filter((v) => v.variantId === id)
                    .map((v) => `${v.qty} × ${itemName(v.itemId)}`)
                    .join(", ")}
                </li>
              ))}
            </ul>
          )}
          <Field label={t("Product size")}>
            <select
              style={inputStyle}
              value={size}
              onChange={(e) => chooseSize(e.target.value)}
              data-testid="packing-size"
            >
              <option value="">{t("Choose…")}</option>
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {size && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {items
                .filter((i) => i.active)
                .map((i) => (
                  <span
                    key={i.itemId}
                    className="pack-count"
                    data-testid="size-pack"
                    data-item={i.name}
                  >
                    {i.name}
                    <button
                      type="button"
                      className="chip"
                      disabled={busy || (sizeItems[i.itemId] ?? 0) <= 0}
                      onClick={() =>
                        setSizeItems((x) => ({
                          ...x,
                          [i.itemId]: Math.max(0, (x[i.itemId] ?? 0) - 1),
                        }))
                      }
                      aria-label={t("One fewer {name}", { name: i.name })}
                    >
                      −
                    </button>
                    <span className="mono">{sizeItems[i.itemId] ?? 0}</span>
                    <button
                      type="button"
                      className="chip"
                      disabled={busy || (sizeItems[i.itemId] ?? 0) >= 10}
                      onClick={() =>
                        setSizeItems((x) => ({
                          ...x,
                          [i.itemId]: Math.min(10, (x[i.itemId] ?? 0) + 1),
                        }))
                      }
                      aria-label={t("One more {name}", { name: i.name })}
                      data-testid="size-pack-more"
                    >
                      +
                    </button>
                  </span>
                ))}
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                data-testid="size-pack-save"
                onClick={() =>
                  run(() =>
                    setVariantPackingAction({
                      variantId: size,
                      items: Object.entries(sizeItems)
                        .filter(([, q]) => q > 0)
                        .map(([itemId, qty]) => ({ itemId, qty })),
                    }),
                  )
                }
              >
                {t("Save")}
              </button>
            </div>
          )}
        </>
      )}
      <Notice msg={msg} />
    </div>
  );
}
