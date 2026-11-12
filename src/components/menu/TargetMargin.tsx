"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTargetMarginAction } from "@/lib/actions/menu";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";

/**
 * A product's target margin (0105): its own, or left empty to take its
 * category's or the café's. The price form suggests prices from it.
 */
export function TargetMargin({
  productId,
  own,
  target,
  canEdit,
}: {
  productId: string;
  own: number | null;
  /** The target it has now: its own, its category's, or the café's. */
  target: number;
  canEdit: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [value, setValue] = useState(own === null ? "" : String(own));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    const v = value.trim() === "" ? null : Number(value);
    start(async () => {
      const r = await setTargetMarginAction(productId, v === null || Number.isNaN(v) ? null : v);
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        router.refresh();
      }
    });
  }

  return (
    <div
      className="row"
      style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      data-testid="target-margin"
    >
      <span className="muted" style={{ fontSize: ".85rem" }}>
        {t("Target {n}%", { n: target })} · {own !== null ? t("Its own") : t("Its category's")}
      </span>
      {canEdit && (
        <>
          <label className="grid" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: ".8rem" }}>
              {t("Target margin (%)")}
            </span>
            <input
              style={{ ...inputStyle, width: "8ch" }}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="target-margin-input"
            />
          </label>
          <button type="button" onClick={save} disabled={busy}>
            {t("Save")}
          </button>
        </>
      )}
      <Notice msg={msg} />
    </div>
  );
}
