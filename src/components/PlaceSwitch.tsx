"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * Keep the device's place, a year at a time, and show the screen again there.
 * The till starts afresh at its new branch: its menu, prices, bills and drawer
 * are that branch's, and a till keeps its own copy of them, so the page is
 * loaded anew rather than refreshed.
 */
function useChoosePlace(reload = false) {
  const router = useRouter();
  const [busy, start] = useTransition();
  function choose(id: string) {
    document.cookie = `place=${id}; path=/; max-age=31536000; samesite=lax`;
    if (reload) window.location.reload();
    else start(() => router.refresh());
  }
  return { busy, choose };
}

/**
 * Where this device works, when there is more than one place to choose from
 * (release AB): chosen here, it is kept on the device. The stock screens
 * record at it and show its stock ("Stock at"); the till sells at it ("Till
 * at", its branches only).
 */
export function PlaceSwitch({
  places,
  current,
  kind = "stock",
}: {
  places: { id: string; name: string }[];
  current: string | null;
  /** The stock screens' switch, or the till's (its branches only). */
  kind?: "stock" | "till";
}) {
  const { t } = useT();
  const { busy, choose } = useChoosePlace(kind === "till");
  if (places.length < 2 || !current) return null;
  const label = kind === "till" ? t("Till at") : t("Stock at");

  return (
    <label className="place-switch" data-testid="place-switch">
      <span className="muted">{label}</span>
      <select
        aria-label={label}
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

/**
 * The branches a till can sell at, when the device is at a place that sells
 * nothing (0055): choosing one keeps it on the device, as the switch does.
 */
export function BranchPicker({ branches }: { branches: { id: string; name: string }[] }) {
  const { t } = useT();
  const { busy, choose } = useChoosePlace(true);
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }} data-testid="branch-picker">
      {branches.map((b) => (
        <button key={b.id} className="btn-primary" disabled={busy} onClick={() => choose(b.id)}>
          {t("Sell at {place}", { place: b.name })}
        </button>
      ))}
    </div>
  );
}
