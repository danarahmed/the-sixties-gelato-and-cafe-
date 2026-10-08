"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProductAddonsAction } from "@/lib/actions/menu";
import type { MenuAddonGroup, MenuProduct, ProductAddonOffer } from "@/lib/db/menu";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { asks } from "@/components/pos/OptionsSheet";
import { OperationStatus, useOperation } from "@/components/useOperation";
import {
  GroupCard,
  GroupForm,
  groupProducts,
  groupSizes,
  sizeLabels,
  type Editor,
} from "@/components/menu/AddonsManager";

type Msg = { ok: boolean; text: string } | null;
/** A group as ticked: offered or not, and with every size or the sizes ticked. */
interface Choice {
  on: boolean;
  every: boolean;
  sizes: string[];
}

/**
 * The groups of add-ons a product offers (0041), for every size or some — the
 * milk with every size, extra shots with the big ones only. The till asks for
 * them as the product is added.
 */
export function ProductAddons({
  product,
  groups,
  offers,
  canEdit,
}: {
  product: MenuProduct;
  groups: MenuAddonGroup[];
  /** Every product's offers; this one's are picked out. */
  offers: ProductAddonOffer[];
  canEdit: boolean;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const mine = offers.filter((o) => o.productId === product.id);
  const sizes = product.variants.filter((v) => v.isActive);
  const sizeName = (id: string | null) => product.variants.find((v) => v.id === id)?.name ?? "";
  const offered = groups.filter((g) => mine.some((o) => o.groupId === g.id));
  // Groups on the till, and any taken off it that the product still offers.
  const choosable = groups.filter((g) => g.isActive || mine.some((o) => o.groupId === g.id));

  function begin() {
    const c: Record<string, Choice> = {};
    for (const g of choosable) {
      const rows = mine.filter((o) => o.groupId === g.id);
      c[g.id] = {
        on: rows.length > 0,
        every: rows.length === 0 || rows.some((o) => o.variantId === null),
        sizes: rows.flatMap((o) => (o.variantId ? [o.variantId] : [])),
      };
    }
    setChoice(c);
    setMsg(null);
    setOpen(true);
  }
  const put = (id: string, patch: Partial<Choice>) =>
    setChoice((c) => ({ ...c, [id]: { ...c[id]!, ...patch } }));

  function save() {
    setMsg(null);
    const picked = choosable.filter((g) => choice[g.id]?.on);
    const bare = picked.find((g) => !choice[g.id]!.every && choice[g.id]!.sizes.length === 0);
    if (bare) {
      setMsg({
        ok: false,
        text: t("Tick the sizes that offer {group}, or choose every size.", { group: bare.name }),
      });
      return;
    }
    const list = picked.flatMap((g): { groupId: string; variantId: string | null }[] => {
      const c = choice[g.id]!;
      // Offered for some sizes it stays so, a retired one among them, until changed here.
      return c.every
        ? [{ groupId: g.id, variantId: null }]
        : c.sizes.map((v) => ({ groupId: g.id, variantId: v }));
    });
    start(async () => {
      const r = await op.run(`productAddons:${product.id}`, (key) =>
        setProductAddonsAction({ productId: product.id, groups: list }, key),
      );
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="product-addons" data-testid="product-addons">
      <h4 className="muted" style={{ margin: "0 0 6px" }}>
        {t("Add-ons offered")}
      </h4>
      {!open && (
        <p style={{ margin: 0, fontSize: ".9rem" }} data-testid="product-addons-summary">
          {offered.length === 0
            ? t("None: the till adds it as it is.")
            : offered
                .map((g) => {
                  const rows = mine.filter((o) => o.groupId === g.id);
                  return rows.some((o) => o.variantId === null)
                    ? g.name
                    : `${g.name} (${rows.map((o) => sizeName(o.variantId)).join(", ")})`;
                })
                .join(" · ")}
        </p>
      )}
      {canEdit && !open && (
        <div
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}
        >
          {groups.some((g) => g.isActive) ? (
            <button
              onClick={begin}
              data-testid="product-addons-edit"
              style={{ fontSize: ".85rem" }}
            >
              {t("Choose the add-ons…")}
            </button>
          ) : (
            <span className="pf-hint">{t("Make a group of add-ons below first.")}</span>
          )}
          <OperationStatus op={op} />
          <Notice msg={msg} />
        </div>
      )}
      {open && (
        <div className="pf-change grid" style={{ gap: 8 }}>
          {choosable.map((g) => {
            const c = choice[g.id]!;
            return (
              <div key={g.id} className="product-addon-choice">
                <label>
                  <input
                    type="checkbox"
                    className="check"
                    checked={c.on}
                    aria-label={t("{group} with {product}", {
                      group: g.name,
                      product: product.name,
                    })}
                    onChange={(e) => put(g.id, { on: e.target.checked })}
                  />{" "}
                  <strong>{g.name}</strong> <span className="muted">· {asks(g, t)}</span>
                  {!g.isActive && <span className="badge warn"> {t("Off the till")}</span>}
                </label>
                {c.on && sizes.length > 1 && (
                  <div className="product-addon-sizes">
                    <label>
                      <input
                        type="radio"
                        checked={c.every}
                        onChange={() => put(g.id, { every: true })}
                      />{" "}
                      {t("Every size")}
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={!c.every}
                        onChange={() => put(g.id, { every: false })}
                      />{" "}
                      {t("Only:")}
                    </label>
                    {!c.every &&
                      sizes.map((v) => (
                        <label key={v.id}>
                          <input
                            type="checkbox"
                            className="check"
                            checked={c.sizes.includes(v.id)}
                            onChange={(e) =>
                              put(g.id, {
                                sizes: e.target.checked
                                  ? [...c.sizes, v.id]
                                  : c.sizes.filter((x) => x !== v.id),
                              })
                            }
                          />{" "}
                          {v.name}
                        </label>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btn-primary"
              onClick={save}
              disabled={busy}
              data-testid="product-addons-save"
            >
              {busy ? t("Saving…") : t("Save")}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy}>
              {t("Cancel")}
            </button>
            <OperationStatus op={op} />
            <Notice msg={msg} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A product's add-ons, set up from its own panel (round thirteen, the owner's
 * choice): which groups it offers and with which sizes; each group it offers,
 * with its add-ons, prices and what they use, changed right here — a group
 * stays shared, so the panel says which other products offer it and that a
 * change here changes it there too; and a new group made for this product,
 * which it offers as soon as it is saved.
 */
export function ProductAddonGroups({
  product,
  groups,
  offers,
  products,
  editor,
}: {
  product: MenuProduct;
  groups: MenuAddonGroup[];
  offers: ProductAddonOffer[];
  products: MenuProduct[];
  /** Null for those who may look but not change. */
  editor: Editor | null;
}) {
  const op = useOperation();
  const { t } = useT();
  const [adding, setAdding] = useState(false);
  const labelOf = sizeLabels(products);
  const mine = offers.filter((o) => o.productId === product.id);
  const offered = groups.filter((g) => mine.some((o) => o.groupId === g.id));
  const nextSort = groups.reduce((m, g) => Math.max(m, g.sortOrder), 0) + 1;

  /** The new group offered with this product, beside those it offers already. */
  async function offer(groupId: string): Promise<string | null> {
    const r = await op.run(`productAddons:${product.id}`, (key) =>
      setProductAddonsAction(
        {
          productId: product.id,
          groups: [
            ...mine.map((o) => ({ groupId: o.groupId, variantId: o.variantId })),
            { groupId, variantId: null },
          ],
        },
        key,
      ),
    );
    return r.ok ? null : r.error;
  }

  return (
    <div className="grid" style={{ gap: 14 }} data-testid="product-addon-groups">
      <ProductAddons product={product} groups={groups} offers={offers} canEdit={editor !== null} />
      {offered.map((g) => (
        <GroupCard
          key={g.id}
          group={g}
          editor={editor}
          sizes={groupSizes(g.id, products, offers, labelOf)}
          offeredOn={groupProducts(g.id, products, offers)
            .filter((p) => p.id !== product.id)
            .map((p) => p.name)}
          labelOf={labelOf}
          within={product.name}
        />
      ))}
      {editor &&
        (adding ? (
          <GroupForm
            group={null}
            nextSort={nextSort}
            onCreated={offer}
            onDone={() => setAdding(false)}
          />
        ) : (
          <div>
            <button onClick={() => setAdding(true)} data-testid="group-new">
              {t("+ New group for {product}", { product: product.name })}
            </button>
          </div>
        ))}
      <OperationStatus op={op} />
    </div>
  );
}
