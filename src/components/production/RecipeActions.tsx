"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { cancelProductionAction, saveBatchRecipeAction } from "@/lib/actions/production";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import type { BatchRecipe } from "@/lib/db/production";
import type { ItemOpt } from "@/components/menu/RecipeLines";
import { BatchRecipeForm } from "@/components/production/BatchRecipeForm";
import { unitFactor } from "@/components/production/batchMath";

type Msg = { ok: boolean; text: string } | null;

/** Changing what goes into a batch recipe, or no longer making it (and making it again). */
export function RecipeActions({
  recipe,
  items,
  decimals,
}: {
  recipe: BatchRecipe;
  items: ItemOpt[];
  decimals: number;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  function setActive(isActive: boolean) {
    setMsg(null);
    const output = items.find((i) => i.id === recipe.outputItemId);
    const f = unitFactor(output, recipe.yieldUnit) ?? 1;
    start(async () => {
      const r = await saveBatchRecipeAction({
        recipeId: recipe.id,
        name: recipe.name,
        output: null,
        yieldQty: new Decimal(recipe.yieldBase).div(f).toString(),
        yieldUnit: recipe.yieldUnit,
        lines: null,
        instructions: recipe.instructions,
        isActive,
      });
      if (r.ok) router.refresh();
      else setMsg({ ok: false, text: r.error });
    });
  }

  if (editing) {
    return (
      <BatchRecipeForm
        recipe={recipe}
        items={items}
        decimals={decimals}
        seesCost
        onClose={() => setEditing(false)}
      />
    );
  }
  return (
    <div className="pr-actions">
      <button onClick={() => setEditing(true)} disabled={busy}>
        {t("Change…")}
      </button>
      {recipe.isActive ? (
        <button onClick={() => setActive(false)} disabled={busy}>
          {t("Stop making it")}
        </button>
      ) : (
        <button onClick={() => setActive(true)} disabled={busy}>
          {t("Make it again")}
        </button>
      )}
      <Notice msg={msg} />
    </div>
  );
}

/** A batch recorded in error, cancelled by a manager with the reason. */
export function CancelBatch({ batchId, label }: { batchId: string; label: string }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  if (!open) {
    return (
      <button
        className="pr-cancel"
        onClick={() => setOpen(true)}
        aria-label={t("Cancel {what}", { what: label })}
      >
        {t("Cancel…")}
      </button>
    );
  }
  return (
    <div className="pr-cancel-form">
      <input
        aria-label={t("Why it is cancelled")}
        style={inputStyle}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("Why? e.g. recorded twice")}
      />
      <button
        className="btn-primary"
        disabled={busy || !reason.trim()}
        onClick={() =>
          start(async () => {
            const r = await cancelProductionAction({ batchId, reason });
            if (r.ok) {
              setOpen(false);
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        {busy ? "…" : t("Cancel the batch")}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy}>
        {t("Keep it")}
      </button>
      <Notice msg={msg} />
    </div>
  );
}
