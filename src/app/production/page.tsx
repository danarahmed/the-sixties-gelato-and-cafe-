import Decimal from "decimal.js";
import { getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems, getStockBoard } from "@/lib/db/read";
import { getItemCosts } from "@/lib/db/reports";
import { getBatchRecipes, getBatches, type BatchRecipe } from "@/lib/db/production";
import { fmtIQD, fmtQty } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import type { ItemOpt } from "@/components/menu/RecipeLines";
import { RecordBatch } from "@/components/production/RecordBatch";
import { BatchRecipeForm } from "@/components/production/BatchRecipeForm";
import { CancelBatch, RecipeActions } from "@/components/production/RecipeActions";
import { batchCost, perUnit, showIn, unitLabel } from "@/components/production/batchMath";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const profile = await requirePermission("cost.view", "production.record");
  const t = await getT();
  const msg = await getMsg();
  const seesCost = has(profile, "cost.view");
  const canRecord = has(profile, "production.record");
  const canEdit = has(profile, "recipe.edit");
  const canCancel = has(profile, "inventory.adjust.approve");
  const decimals = profile.currencyDecimals;
  const [recipes, batches, items, costs, board] = await Promise.all([
    getBatchRecipes(),
    getBatches(50),
    getItems(),
    seesCost ? getItemCosts() : Promise.resolve(new Map<string, string>()),
    seesCost ? getStockBoard() : Promise.resolve([]),
  ]);

  const itemOpts: ItemOpt[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    baseUnit: i.baseUnit,
    units: i.units,
    unitCost: costs.get(i.id) || "0",
  }));
  const byId = new Map(itemOpts.map((i) => [i.id, i]));
  const onHand: Record<string, number> | null = seesCost ? {} : null;
  if (onHand) for (const r of board) onHand[r.itemId] = (onHand[r.itemId] ?? 0) + r.onHandBase;
  const active = recipes.filter((r) => r.isActive);
  const stopped = recipes.filter((r) => !r.isActive);

  const recipeCard = (r: BatchRecipe) => {
    const output = byId.get(r.outputItemId);
    const cost = seesCost
      ? batchCost(r.lines, new Decimal(1), (id) => byId.get(id)?.unitCost ?? "0", decimals)
      : null;
    const missing = seesCost
      ? r.lines
          .filter((l) => new Decimal(byId.get(l.itemId)?.unitCost ?? "0").isZero())
          .map((l) => l.name)
      : [];
    const yieldBase = new Decimal(r.yieldBase);
    const f = output?.units.find((u) => u.code === r.yieldUnit)?.factor ?? 1;
    return (
      <div key={r.id} className="card pr-recipe">
        <div className="pr-recipe-head">
          <strong>{r.name}</strong>
          <span className="muted">
            <Rich
              text={
                r.outputName !== r.name
                  ? t("one batch makes <qty>{qty}</qty> of {output}", {
                      qty: showIn(yieldBase, output, r.yieldUnit),
                      output: r.outputName,
                    })
                  : t("one batch makes <qty>{qty}</qty>", {
                      qty: showIn(yieldBase, output, r.yieldUnit),
                    })
              }
              tags={{ qty: (c) => <span className="mono">{c}</span> }}
            />
          </span>
          {cost && !cost.isZero() && (
            <span className="pr-recipe-cost">
              <Rich
                text={t("costs <b>{amount}</b>", { amount: fmtIQD(cost.toNumber()) })}
                tags={{ b: (c) => <strong className="mono">{c}</strong> }}
              />
              {(() => {
                const each = perUnit(cost, yieldBase.div(f), unitLabel(output, r.yieldUnit));
                return each ? <span className="muted"> · {msg(each)}</span> : null;
              })()}
            </span>
          )}
          {missing.length > 0 && (
            <span className="pr-short pr-recipe-cost">
              {t("No cost yet for {names}: never bought or made", { names: missing.join(", ") })}
            </span>
          )}
        </div>
        <ul className="pr-lines">
          {r.lines.map((l, i) => (
            <li key={`${l.itemId}-${i}`}>
              <span className="mono">
                {fmtQty(l.quantity)} {unitLabel(byId.get(l.itemId), l.unitCode)}
              </span>{" "}
              {l.name}
            </li>
          ))}
        </ul>
        {r.instructions && <p className="pr-instructions">{r.instructions}</p>}
        {canEdit && <RecipeActions recipe={r} items={itemOpts} decimals={decimals} />}
      </div>
    );
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t("nav.production")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        {t(
          "What you make in batches: gelato, a base, syrup, dough. Recording a batch takes its ingredients out of stock and puts what came out in, valued at what the ingredients cost. Made items are then used like any other: in another batch (a base, then its flavours) or in a product's recipe on Products & Recipes (a cup of gelato).",
        )}
      </p>

      {canRecord && (
        <div className="card grid" style={{ gap: 12 }}>
          <h2 style={{ margin: 0 }}>{t("Record a batch")}</h2>
          <RecordBatch
            recipes={active}
            items={itemOpts}
            onHand={onHand}
            seesCost={seesCost}
            decimals={decimals}
          />
        </div>
      )}

      <section className="grid" style={{ gap: 10 }}>
        <h2 style={{ margin: "8px 0 0" }}>{t("What you make")}</h2>
        {canEdit && (
          <details className="card pr-new">
            <summary>{t("➕ Add something you make")}</summary>
            <BatchRecipeForm items={itemOpts} decimals={decimals} seesCost={seesCost} />
          </details>
        )}
        {recipes.length === 0 ? (
          <EmptyState
            title={t("Nothing set up yet")}
            hint={
              canEdit
                ? t("Add what you make above: its name, how much a batch makes, and what goes in.")
                : t("A manager who edits recipes adds what you make.")
            }
          />
        ) : (
          <div className="pr-recipes">{active.map(recipeCard)}</div>
        )}
        {stopped.length > 0 && (
          <details>
            <summary className="muted">
              {t("Not made any more ({n})", { n: stopped.length })}
            </summary>
            <div className="pr-recipes" style={{ marginTop: 10 }}>
              {stopped.map(recipeCard)}
            </div>
          </details>
        )}
      </section>

      <section className="grid" style={{ gap: 10 }}>
        <h2 style={{ margin: "8px 0 0" }}>{t("Batches")}</h2>
        {batches.length === 0 ? (
          <EmptyState
            title={t("No batches yet")}
            hint={t("Every batch recorded is listed here.")}
          />
        ) : (
          <div className="card tw">
            <table className="pr-batches">
              <thead>
                <tr>
                  <th>{t("Made")}</th>
                  <th>{t("What")}</th>
                  <th className="right">{t("Batches")}</th>
                  <th className="right">{t("Came out")}</th>
                  {seesCost && <th className="right">{t("Cost")}</th>}
                  <th>{t("By")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const output = byId.get(b.outputItemId);
                  const actual = new Decimal(b.actualBase);
                  const diff = actual.minus(b.plannedBase);
                  const f = output?.units.find((u) => u.code === b.enteredUnit)?.factor ?? 1;
                  const cancelled = b.status === "cancelled";
                  return (
                    <tr key={b.id} className={cancelled ? "pr-cancelled" : undefined}>
                      <td className="muted mono" style={{ fontSize: ".8rem" }}>
                        {dateTimeIn(profile.timezone, b.producedAt)}
                      </td>
                      <td>
                        {b.recipeName}
                        {b.note && <div className="muted pr-note-cell">{b.note}</div>}
                        {cancelled && (
                          <div className="pr-note-cell">
                            <span className="badge warn">{t("cancelled")}</span> {b.cancelReason}
                            {b.cancelledBy ? ` — ${b.cancelledBy}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="right mono">{Number(b.batches.toFixed(3))}</td>
                      <td className="right mono">
                        {showIn(actual, output, b.enteredUnit)}
                        {!diff.isZero() && (
                          <div
                            className={diff.lt(0) ? "pr-short" : "muted"}
                            style={{ fontSize: ".75rem" }}
                          >
                            {diff.lt(0) ? "−" : "+"}
                            {t("{qty} on the recipe", {
                              qty: showIn(diff.abs(), output, b.enteredUnit),
                            })}
                          </div>
                        )}
                      </td>
                      {seesCost && (
                        <td className="right mono">
                          {b.value === null ? "—" : fmtIQD(b.value)}
                          {b.value !== null && (
                            <div className="muted" style={{ fontSize: ".75rem" }}>
                              {msg(
                                perUnit(
                                  new Decimal(b.value),
                                  actual.div(f),
                                  unitLabel(output, b.enteredUnit),
                                ) ?? "",
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="muted" style={{ fontSize: ".85rem" }}>
                        {b.madeBy ?? "—"}
                      </td>
                      <td>
                        {canCancel && !cancelled && (
                          <CancelBatch
                            batchId={b.id}
                            label={t("{name} batch", { name: b.recipeName })}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
