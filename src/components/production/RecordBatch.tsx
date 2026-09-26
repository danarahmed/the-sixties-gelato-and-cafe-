"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { recordProductionAction } from "@/lib/actions/production";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Rich } from "@/lib/i18n/Rich";
import { Notice, inputStyle } from "@/components/ui";
import { parseNumber } from "@/components/pos/model";
import type { BatchRecipe } from "@/lib/db/production";
import {
  batchCost,
  batchesOf,
  perUnit,
  showIn,
  unitFactor,
  unitLabel,
  type UnitsOf,
} from "@/components/production/batchMath";

type Msg = { ok: boolean; text: string } | null;

export interface ProductionItem extends UnitsOf {
  id: string;
  name: string;
  /** Cost per base unit today; "0" when unknown or not shown. */
  unitCost: string;
}

/**
 * A batch made: which recipe, how many batches, and what came out — weighed,
 * counted in pans or pieces, or left as the recipe says. Before it is
 * recorded the form shows what it will take out of stock and put in.
 */
export function RecordBatch({
  recipes,
  items,
  onHand,
  seesCost,
  decimals,
}: {
  recipes: BatchRecipe[];
  items: ProductionItem[];
  /** Stock on hand in base units, for those who may see it. */
  onHand: Record<string, number> | null;
  seesCost: boolean;
  decimals: number;
}) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [batches, setBatches] = useState("1");
  const [outQty, setOutQty] = useState("");
  const [outUnit, setOutUnit] = useState(recipes[0]?.yieldUnit ?? "");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const byId = new Map(items.map((i) => [i.id, i]));
  const recipe = recipes.find((r) => r.id === recipeId);
  const output = recipe ? byId.get(recipe.outputItemId) : undefined;
  const b = batchesOf(batches);
  const planned = recipe && b ? new Decimal(recipe.yieldBase).times(b) : null;
  const typedOut = outQty.trim() === "" ? null : parseNumber(outQty);
  const outFactor = unitFactor(output, outUnit);
  const actual =
    typedOut && outFactor ? typedOut.times(outFactor) : outQty.trim() === "" ? planned : null;
  const shownUnit = outQty.trim() === "" ? (recipe?.yieldUnit ?? "") : outUnit;
  const cost =
    recipe && b && seesCost
      ? batchCost(recipe.lines, b, (id) => byId.get(id)?.unitCost ?? "0", decimals)
      : null;

  if (recipes.length === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        {t("Nothing to record yet: first add what you make, below.")}
      </p>
    );
  }

  function choose(id: string) {
    setRecipeId(id);
    setOutQty("");
    setOutUnit(recipes.find((r) => r.id === id)?.yieldUnit ?? "");
    setMsg(null);
  }

  function submit() {
    if (!recipe) return;
    setMsg(null);
    start(async () => {
      const r = await recordProductionAction({
        recipeId: recipe.id,
        batches,
        outputQty: outQty.trim() === "" ? null : outQty,
        outputUnit: outQty.trim() === "" ? null : outUnit,
        note,
      });
      if (r.ok) {
        const made = showIn(new Decimal(r.data.actual), output, shownUnit);
        setMsg({
          ok: true,
          text:
            r.data.value === null
              ? t("Recorded: {made} of {output} into stock.", { made, output: recipe.outputName })
              : t("Recorded: {made} of {output} into stock. The ingredients cost {amount}.", {
                  made,
                  output: recipe.outputName,
                  amount: fmtIQD(r.data.value),
                }),
        });
        setBatches("1");
        setOutQty("");
        setNote("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  const diff = planned && actual ? actual.minus(planned) : null;
  return (
    <div className="pr-record">
      <div className="pr-fields">
        <label className="pr-what">
          <span>{t("What did you make?")}</span>
          <select
            aria-label={t("What did you make")}
            style={inputStyle}
            value={recipeId}
            onChange={(e) => choose(e.target.value)}
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("Batches")}</span>
          <input
            aria-label={t("Batches")}
            style={inputStyle}
            value={batches}
            onChange={(e) => setBatches(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label>
          <span>{t("What came out (optional)")}</span>
          <span className="pr-out">
            <input
              aria-label={t("What came out")}
              style={inputStyle}
              value={outQty}
              onChange={(e) => setOutQty(e.target.value)}
              placeholder={planned ? showIn(planned, output, recipe!.yieldUnit) : ""}
              inputMode="decimal"
            />
            <select
              aria-label={t("Unit of what came out")}
              style={inputStyle}
              value={outUnit}
              onChange={(e) => setOutUnit(e.target.value)}
            >
              {output &&
                [output.baseUnit, ...output.units.map((u) => u.code)]
                  .filter((c, i, all) => all.indexOf(c) === i)
                  .map((c) => (
                    <option key={c} value={c}>
                      {unitLabel(output, c)}
                    </option>
                  ))}
            </select>
          </span>
        </label>
        <label className="pr-note">
          <span>{t("Note (optional)")}</span>
          <input
            aria-label={t("Note")}
            style={inputStyle}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("e.g. a little thick, left to rest")}
          />
        </label>
      </div>

      {recipe && b && (
        <div className="pr-preview" data-testid="batch-preview">
          <div className="pr-uses">
            <strong>{t("Uses")}</strong>
            <ul>
              {recipe.lines.map((l, i) => {
                const it = byId.get(l.itemId);
                const need = new Decimal(l.baseQty).times(b);
                const have = onHand ? onHand[l.itemId] : undefined;
                const short = have !== undefined && new Decimal(have).lt(need);
                return (
                  <li key={`${l.itemId}-${i}`}>
                    <span>{l.name}</span>
                    <span className="mono">{showIn(need, it, l.unitCode)}</span>
                    {have !== undefined && (
                      <span className={short ? "pr-short" : "muted"}>
                        {short
                          ? t("only {qty} in stock", {
                              qty: showIn(new Decimal(have), it, l.unitCode),
                            })
                          : t("{qty} in stock", { qty: showIn(new Decimal(have), it, l.unitCode) })}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="pr-makes">
            <strong>{t("Makes")}</strong>
            {actual ? (
              <span>
                <Rich
                  text={t("<qty>{qty}</qty> of {output}", {
                    qty: showIn(actual, output, shownUnit),
                    output: recipe.outputName,
                  })}
                  tags={{ qty: (c) => <span className="mono">{c}</span> }}
                />
                {outQty.trim() === "" ? (
                  <span className="muted"> {t("— as the recipe says")}</span>
                ) : (
                  diff &&
                  !diff.isZero() &&
                  planned && (
                    <span className={diff.lt(0) ? "pr-short" : "muted"}>
                      {" "}
                      {diff.lt(0)
                        ? t("— {diff} less than the recipe's {planned}", {
                            diff: showIn(diff.abs(), output, shownUnit),
                            planned: showIn(planned, output, shownUnit),
                          })
                        : t("— {diff} more than the recipe's {planned}", {
                            diff: showIn(diff.abs(), output, shownUnit),
                            planned: showIn(planned, output, shownUnit),
                          })}
                    </span>
                  )
                )}
              </span>
            ) : (
              <span className="muted">
                {t("Enter what came out as a number, or leave it empty.")}
              </span>
            )}
            {cost && actual && (
              <span className="pr-cost">
                <Rich
                  text={t("Cost <b>{amount}</b>", { amount: fmtIQD(cost.toNumber()) })}
                  tags={{ b: (c) => <strong className="mono">{c}</strong> }}
                />
                {(() => {
                  const f = unitFactor(output, shownUnit) ?? 1;
                  const each = perUnit(cost, actual.div(f), unitLabel(output, shownUnit));
                  return each ? ` · ${say(each)}` : "";
                })()}
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={submit} disabled={busy || !recipe || !b}>
          {busy ? t("Recording…") : t("Record batch")}
        </button>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
