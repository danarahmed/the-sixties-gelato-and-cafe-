"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { PosAddonGroup, PosItem } from "@/lib/db/pos";
import { fmtIQD } from "@/lib/format";
import type { T } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/I18nProvider";
import {
  addonName,
  addonsMissing,
  groupName,
  productName,
  variantLabel,
  type AddonChoice,
  type AddonMenu,
} from "./model";

/** What a group asks for, in a few words: "Choose 1", "Up to 3", "1 to 3", "As many as you like". */
export function asks(g: { min: number; max: number | null }, t: T): string {
  if (g.max !== null && g.min === g.max) return t("Choose {n}", { n: g.min });
  if (g.min === 0) return g.max === null ? t("As many as you like") : t("Up to {n}", { n: g.max });
  return g.max === null
    ? t("At least {n}", { n: g.min })
    : t("{min} to {max}", { min: g.min, max: g.max });
}

/**
 * A product with sizes or add-ons, as one sheet: its size first, then each
 * group it offers with that size — those that ask for a choice first — and
 * what one comes to. Added when every group has what it asks for.
 */
export function OptionsSheet({
  variants,
  channel,
  addons,
  onAdd,
  onClose,
}: {
  /** The product's sizes on sale on this channel. */
  variants: PosItem[];
  channel: SalesChannel;
  addons: AddonMenu;
  onAdd: (variantId: string, chosen: AddonChoice[]) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const first = variants[0]!;
  const [size, setSize] = useState<PosItem | null>(variants.length === 1 ? first : null);
  const [chosen, setChosen] = useState<AddonChoice[]>([]);
  const groups = size ? addons.groupsFor(size.productId, size.variantId) : [];
  const missing = size ? addonsMissing(groups, chosen) : null;
  const priced = (id: string) => addons.byId.get(id)?.prices[channel];

  function pickSize(v: PosItem) {
    const offered = addons.groupsFor(v.productId, v.variantId);
    // A size with no add-ons is added as it is tapped, as the till always did.
    if (offered.length === 0) {
      onAdd(v.variantId, []);
      return;
    }
    setSize(v);
    const ids = new Set(offered.flatMap((g) => g.addons.map((a) => a.id)));
    setChosen((c) => c.filter((x) => ids.has(x.modifierId)));
  }

  function qtyOf(id: string): number {
    return chosen.find((c) => c.modifierId === id)?.qty ?? 0;
  }

  /** One more of an add-on: in a group of one, it takes the place of the other. */
  function more(g: PosAddonGroup, id: string) {
    setChosen((c) => {
      const inGroup = new Set(g.addons.map((a) => a.id));
      if (g.max === 1)
        return [...c.filter((x) => !inGroup.has(x.modifierId)), { modifierId: id, qty: 1 }];
      const had = c.find((x) => x.modifierId === id);
      return had
        ? c.map((x) => (x.modifierId === id ? { ...x, qty: Math.min(20, x.qty + 1) } : x))
        : [...c, { modifierId: id, qty: 1 }];
    });
  }
  function less(id: string) {
    setChosen((c) =>
      c.map((x) => (x.modifierId === id ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0),
    );
  }

  const each = size
    ? chosen.reduce(
        (sum, c) => sum.plus(new Decimal(priced(c.modifierId) ?? 0).times(c.qty)),
        new Decimal(size.prices[channel] ?? 0),
      )
    : null;

  return (
    <div className="pos-modal-back" onClick={onClose}>
      <div
        className="pos-modal options-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={productName(first, locale)}
        data-testid="options-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>{productName(first, locale)}</h3>
        {variants.length > 1 && (
          <div className="variant-list" role="group" aria-label={t("Size")}>
            {variants.map((v) => (
              <button
                key={v.variantId}
                className={size?.variantId === v.variantId ? "variant-btn active" : "variant-btn"}
                aria-pressed={size?.variantId === v.variantId}
                onClick={() => pickSize(v)}
              >
                <span>{variantLabel(v) ?? productName(v, locale)}</span>
                <span className="price mono">{fmtIQD(v.prices[channel]!)}</span>
              </button>
            ))}
          </div>
        )}
        {groups.map((g) => (
          <section key={g.id} className="addon-group" data-testid="addon-group">
            <h4 className="addon-group-h">
              {groupName(g, locale)} <span className="muted">· {asks(g, t)}</span>
            </h4>
            <div className="addon-chips">
              {g.addons
                .filter((a) => priced(a.id) !== undefined)
                .map((a) => {
                  const n = qtyOf(a.id);
                  const price = priced(a.id)!;
                  return (
                    <span key={a.id} className={n > 0 ? "addon-chip on" : "addon-chip"}>
                      <button
                        className="addon-name"
                        aria-pressed={n > 0}
                        onClick={() =>
                          // Tapped again: one fewer; in a group of one, off only if it may be left empty.
                          n === 0
                            ? more(g, a.id)
                            : g.max !== 1 || g.min === 0
                              ? less(a.id)
                              : undefined
                        }
                      >
                        {addonName(a, locale)}
                        <span className="muted mono">
                          {" "}
                          {price > 0 ? `+${fmtIQD(price)}` : t("free")}
                        </span>
                        {n > 1 && <strong className="mono"> ×{n}</strong>}
                      </button>
                      {n > 0 && g.max !== 1 && (
                        <button
                          className="addon-more"
                          aria-label={`${t("pos.more")} ${addonName(a, locale)}`}
                          onClick={() => more(g, a.id)}
                        >
                          +
                        </button>
                      )}
                    </span>
                  );
                })}
            </div>
          </section>
        ))}
        {size && groups.length > 0 && (
          <div className="options-foot">
            <span className="muted" role="status">
              {missing
                ? missing.kind === "fewer"
                  ? t("Choose {group}", { group: groupName(missing.group, locale) })
                  : t("At most {n} from {group}", {
                      n: missing.group.max ?? 0,
                      group: groupName(missing.group, locale),
                    })
                : null}
            </span>
            <button
              className="btn-primary"
              disabled={missing !== null}
              onClick={() => onAdd(size.variantId, chosen)}
            >
              {t("Add")} · <span className="mono">{fmtIQD(each!.toNumber())}</span>
            </button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onClose}>{t("pos.close")}</button>
        </div>
      </div>
    </div>
  );
}
