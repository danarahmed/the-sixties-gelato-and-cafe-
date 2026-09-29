"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * Where this device does its stock work, when the café has more than one
 * place (release AB): chosen here, it is kept on the device, and the stock
 * screens record at it and show its stock.
 */
export function PlaceSwitch({
  places,
  current,
}: {
  places: { id: string; name: string }[];
  current: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  if (places.length < 2 || !current) return null;

  function choose(id: string) {
    document.cookie = `place=${id}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <label className="place-switch" data-testid="place-switch">
      <span className="muted">{t("Stock at")}</span>
      <select
        aria-label={t("Stock at")}
        value={current}
        disabled={busy}
        onChange={(e) => choose(e.target.value)}
        data-testid="place-choice"
      >
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
