"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVariantWeighedAction } from "@/lib/actions/menu";
import { useT } from "@/lib/i18n/I18nProvider";
import { OperationStatus, useOperation } from "@/components/useOperation";

/**
 * Selling by weight (round seventeen, 0075): a size sold by the kilo — sweets,
 * cookies, bread — has a kilo's price; the till asks how much it weighs, and
 * its recipe is a kilo's, so the stock it uses is the weight sold.
 */
export function WeighedSizes({
  sizes,
  canEdit,
}: {
  sizes: { id: string; name: string; weighed: boolean }[];
  canEdit: boolean;
}) {
  const { t, msg } = useT();
  const router = useRouter();
  const op = useOperation();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Ticked at once, and put back if the database refuses it.
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const isOn = (s: { id: string; weighed: boolean }) => ticked[s.id] ?? s.weighed;

  function set(variantId: string, weighed: boolean) {
    setError(null);
    setTicked((m) => ({ ...m, [variantId]: weighed }));
    start(async () => {
      const r = await op.run(`weighed:${variantId}`, (key) =>
        setVariantWeighedAction({ variantId, weighed }, key),
      );
      if (!r.ok) {
        setError(r.error);
        setTicked((m) => ({ ...m, [variantId]: !weighed }));
      } else router.refresh();
    });
  }

  return (
    <div className="card grid weighed-sizes" style={{ gap: 6 }} data-testid="weighed-sizes">
      <strong>{t("Sold by weight")}</strong>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Tick a size sold by the kilo: its price is the price of a kilo, the till asks how much it weighs, and its recipe is for a kilo.",
        )}
      </p>
      {sizes.map((s) => (
        <label key={s.id} className="check-row">
          <input
            type="checkbox"
            className="check"
            checked={isOn(s)}
            disabled={!canEdit || pending}
            onChange={(e) => set(s.id, e.target.checked)}
            data-testid="size-weighed"
            data-size={s.name}
          />{" "}
          <span dir="auto">{s.name}</span>
          {isOn(s) && <span className="badge">{t("a kilo")}</span>}
        </label>
      ))}
      {error && <p className="red">{msg(error)}</p>}
      <OperationStatus op={op} />
    </div>
  );
}
