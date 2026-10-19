"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlaceSectionsAction } from "@/lib/actions/menu";
import type { MenuSection } from "@/lib/db/sections";
import { useT } from "@/lib/i18n/I18nProvider";
import { OperationStatus, useOperation } from "@/components/useOperation";

/**
 * What a branch sells (0074): every part of the menu, or only some — a branch
 * that is the bakery shows only the bakery's products on its till. A tap on a
 * part adds it or takes it away; with none ticked, it sells everything.
 */
export function PlaceSections({
  placeId,
  placeName,
  sections,
  selling,
  canEdit,
}: {
  placeId: string;
  placeName: string;
  sections: MenuSection[];
  selling: string[];
  canEdit: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string[]>(selling);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setChosen(next);
    setError(null);
    start(async () => {
      const r = await op.run(`placeSections:${placeId}`, (key) =>
        setPlaceSectionsAction({ placeId, sectionIds: next }, key),
      );
      if (!r.ok) {
        setError(r.error);
        setChosen(chosen);
      } else router.refresh();
    });
  }

  return (
    <div className="place-sections" data-testid="place-sections" data-place={placeName}>
      <span className="muted">
        {chosen.length === 0 ? t("Sells everything") : t("Sells only:")}
      </span>
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          className={chosen.includes(s.id) ? "chip active" : "chip"}
          aria-pressed={chosen.includes(s.id)}
          disabled={!canEdit || pending}
          onClick={() => toggle(s.id)}
          data-testid="place-section"
        >
          {s.name}
        </button>
      ))}
      {error && <span className="red">{t(error)}</span>}
      <OperationStatus op={op} />
    </div>
  );
}
