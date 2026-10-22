"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { setPriceAction } from "@/lib/actions/menu";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { useOperation } from "@/components/useOperation";

/**
 * The price that keeps a size's margin after a delivery came dearer, set in
 * one tap from today (0092), for every branch, as Products & Recipes sets a
 * price; by whoever may change the menu.
 */
export function SetKeepPrice({
  variantId,
  channel,
  price,
  from,
}: {
  variantId: string;
  channel: string;
  price: number;
  from: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done)
    return (
      <span className="muted" style={{ fontSize: ".75rem" }} data-testid="price-keep-set">
        {t("Set from today")}
      </span>
    );
  return (
    <>
      <button
        type="button"
        className="linklike"
        style={{ fontSize: ".75rem" }}
        disabled={busy}
        data-testid="price-keep-button"
        aria-label={t("Set the price to {price}", { price: fmtIQD(price) })}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await op.run("setKeepPrice", (key) =>
              setPriceAction(
                {
                  variantId,
                  channel: channel as SalesChannel,
                  price,
                  effectiveFrom: from,
                  placeId: null,
                },
                key,
              ),
            );
            if (!r.ok) {
              setError(r.error);
              return;
            }
            setDone(true);
            router.refresh();
          })
        }
      >
        {t("Set it")}
      </button>
      {error && (
        <span className="warn-text" style={{ display: "block", fontSize: ".75rem" }}>
          {error}
        </span>
      )}
    </>
  );
}
