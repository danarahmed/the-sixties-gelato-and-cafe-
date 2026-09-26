"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeProductRecipeAction } from "@/lib/actions/menu";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { useChannels } from "@/components/ChannelsProvider";
import {
  NoCostYet,
  RecipeLinesEditor,
  ServingCost,
  filledLines,
  halfFilled,
  linesFrom,
  type ItemOpt,
  type LineDraft,
} from "@/components/menu/RecipeLines";

type Msg = { ok: boolean; text: string } | null;

/**
 * A product's recipe, changed from a date: the recipe in force today is the
 * starting point, costed as it is changed. The old recipe stays in force until
 * the new one starts, and every sale keeps the recipe of its own day.
 */
export function ChangeRecipe({
  variantId,
  current,
  items,
  decimals,
  today,
}: {
  variantId: string;
  current: {
    itemId: string | null;
    quantity: number;
    unitCode: string;
    channels: string[] | null;
  }[];
  items: ItemOpt[];
  decimals: number;
  today: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const { set } = useChannels();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [from, setFrom] = useState(today);
  const [msg, setMsg] = useState<Msg>(null);

  function begin() {
    setLines(
      linesFrom(
        current
          .filter((c): c is typeof c & { itemId: string } => c.itemId !== null)
          .map((c) => ({ ...c })),
        set,
      ),
    );
    setFrom(today);
    setMsg(null);
    setOpen(true);
  }

  function save() {
    setMsg(null);
    const half = halfFilled(lines);
    if (half >= 0) {
      setMsg({
        ok: false,
        text: t("Line {n}: choose the ingredient and its quantity, or remove the line.", {
          n: half + 1,
        }),
      });
      return;
    }
    start(async () => {
      const r = await changeProductRecipeAction({
        variantId,
        lines: filledLines(lines, set),
        effectiveFrom: from,
      });
      if (r.ok) {
        setOpen(false);
        setMsg({
          ok: true,
          text:
            r.data.effectiveFrom === today
              ? t("The new recipe is in force from today.")
              : t("The new recipe starts on {date}.", { date: r.data.effectiveFrom }),
        });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (!open) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={begin} style={{ marginBlockStart: 8, fontSize: ".8rem" }}>
          {t("Change the recipe…")}
        </button>
        <Notice msg={msg} />
      </div>
    );
  }
  return (
    <div className="pf-change">
      <p className="pf-hint">
        {t(
          "The recipe in force today, to change. Costs are today's. Sales before the new recipe starts keep the old one.",
        )}
      </p>
      <RecipeLinesEditor
        items={items}
        lines={lines}
        onChange={setLines}
        decimals={decimals}
        channels
      />
      <ServingCost lines={lines} items={items} decimals={decimals} />
      <NoCostYet lines={lines} items={items} />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label>
          <div className="muted" style={{ fontSize: ".75rem" }}>
            {t("In force from")}
          </div>
          <input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={busy} onClick={save}>
          {busy ? t("Saving…") : t("Save the new recipe")}
        </button>
        <button onClick={() => setOpen(false)} disabled={busy}>
          {t("Cancel")}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
