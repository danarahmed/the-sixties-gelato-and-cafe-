"use client";

import { useEffect, useRef, useState } from "react";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { PosItem } from "@/lib/db/pos";
import { dealName, type Deal } from "@/lib/deals";
import { useT } from "@/lib/i18n/I18nProvider";
import { OptionsSheet } from "./OptionsSheet";
import type { AddonChoice, AddonMenu } from "./model";

type Pick = { variantId: string; addons: AddonChoice[] };

/**
 * A meal deal chosen at the till (0089): each of its places in turn — a size
 * of those it takes, with its add-ons — then the deal goes on the order. A
 * place with only one size and nothing to choose is filled without asking.
 */
export function DealFlow({
  deal,
  byId,
  channel,
  addons,
  onDone,
  onClose,
}: {
  deal: Deal;
  byId: Map<string, PosItem>;
  channel: SalesChannel;
  addons: AddonMenu;
  onDone: (picks: Pick[]) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [picks, setPicks] = useState<Pick[]>([]);
  const done = useRef(false);
  // Each place's sizes on sale here: none weighed, each with a price on the channel.
  const places = deal.slots.map((s) =>
    s.sizes
      .map((id) => byId.get(id))
      .filter((v): v is PosItem => !!v && v.prices[channel] !== undefined && !v.soldByWeight),
  );
  const empty = places.findIndex((p) => p.length === 0);
  const at = picks.length;
  const sizes = places[at] ?? [];
  const simple =
    sizes.length === 1 && addons.groupsFor(sizes[0]!.productId, sizes[0]!.variantId).length === 0;

  // A place with nothing to choose is filled at once; the deal goes on the
  // order when the last is filled. Each step once, whatever renders between.
  const filled = useRef(-1);
  const autoSize = simple ? sizes[0]!.variantId : null;
  useEffect(() => {
    if (empty >= 0 || done.current) return;
    if (at >= places.length) {
      done.current = true;
      onDone(picks);
    } else if (autoSize && filled.current < at) {
      filled.current = at;
      setPicks((p) => (p.length === at ? [...p, { variantId: autoSize, addons: [] }] : p));
    }
  }, [at, empty, places.length, picks, autoSize, onDone]);

  if (empty >= 0) {
    return (
      <div className="pos-modal-back" onClick={onClose}>
        <div
          className="pos-modal"
          role="dialog"
          aria-modal="true"
          aria-label={dealName(deal, locale)}
          onClick={(e) => e.stopPropagation()}
          data-testid="deal-unavailable"
        >
          <h3 style={{ marginTop: 0 }}>{dealName(deal, locale)}</h3>
          <p className="muted">{t("Something in this deal is not on sale here now.")}</p>
          <button onClick={onClose}>{t("pos.close")}</button>
        </div>
      </div>
    );
  }
  if (at >= places.length || simple) return null;
  const label = deal.slots[at]?.label;
  return (
    <OptionsSheet
      key={at}
      variants={sizes}
      channel={channel}
      addons={addons}
      inDeal
      title={`${dealName(deal, locale)} · ${at + 1}/${places.length}${label ? ` · ${label}` : ""}`}
      onAdd={(variantId, chosen) => setPicks((p) => [...p, { variantId, addons: chosen }])}
      onClose={onClose}
    />
  );
}
