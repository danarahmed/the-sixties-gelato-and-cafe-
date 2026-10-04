import Link from "next/link";
import Decimal from "decimal.js";
import { getLocale, getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems, getStockBoard } from "@/lib/db/read";
import { getItemCosts } from "@/lib/db/reports";
import {
  getBatchRecipes,
  getBatches,
  getProductionLots,
  getProductionPlan,
  type BatchRecipe,
} from "@/lib/db/production";
import { fmtIQD, fmtQty } from "@/lib/format";
import { addDays, businessToday, dateTimeIn, parseDay } from "@/lib/dates";
import { PLAN_STATUS_LABEL, WEEKDAY_NAME, keepsLabel } from "@/lib/production";
import { EmptyState } from "@/components/ui";
import { PlaceSwitch } from "@/components/PlaceSwitch";
import { placeChoice } from "@/lib/place";
import type { ItemOpt } from "@/components/menu/RecipeLines";
import { RecordBatch } from "@/components/production/RecordBatch";
import { RecordPlan } from "@/components/production/RecordPlan";
import { BatchRecipeForm } from "@/components/production/BatchRecipeForm";
import { CancelBatch, RecipeActions } from "@/components/production/RecipeActions";
import { ProductionLots } from "@/components/production/Lots";
import { batchCost, perUnit, showIn, showNice, unitLabel } from "@/components/production/batchMath";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view", "production.record");
  const t = await getT();
  const msg = await getMsg();
  const locale = await getLocale();
  const sp = await searchParams;
  const seesCost = has(profile, "cost.view");
  const canRecord = has(profile, "production.record");
  const canEdit = has(profile, "recipe.edit");
  const canCancel = has(profile, "inventory.adjust.approve");
  const decimals = profile.currencyDecimals;
  const today = businessToday(profile.timezone);
  const tomorrow = addDays(today, 1);
  const planDay = parseDay(sp.day, today) === tomorrow ? tomorrow : today;
  // A row of the plan opens the form with what it says to make (one tap fewer, still checked).
  const make = typeof sp.make === "string" && /^[0-9a-f-]{36}$/i.test(sp.make) ? sp.make : null;
  const makeBatches = typeof sp.batches === "string" ? Number(sp.batches) : NaN;
  const prefill =
    make && Number.isInteger(makeBatches) && makeBatches >= 1 && makeBatches <= 99
      ? { recipeId: make, batches: makeBatches }
      : null;
  // Batches are made, planned and kept at this device's place (AB).
  const { places, place, at } = await placeChoice();
  const [recipes, batches, items, costs, board, plan, lots] = await Promise.all([
    getBatchRecipes(),
    getBatches(50),
    getItems(),
    seesCost ? getItemCosts() : Promise.resolve(new Map<string, string>()),
    seesCost ? getStockBoard(at) : Promise.resolve([]),
    getProductionPlan(planDay, at),
    getProductionLots(at),
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
  // What a batch's labels say beyond the batch: the café, the place, who made it, and each made item's name.
  const labelWords = {
    businessName: profile.businessName,
    place: place?.name ?? null,
    by: profile.name,
    names: Object.fromEntries(
      items.map((i) => [
        i.id,
        (locale === "ar" ? i.nameAr : locale === "ckb" ? i.nameCkb : null) || i.name,
      ]),
    ),
  };
  // The plan's batches to make, of recipes in use: recorded in one go.
  const toMake = plan.recipes
    .filter((r) => r.status === "make" && r.batches > 0 && active.some((x) => x.id === r.recipeId))
    .map((r) => ({ recipeId: r.recipeId, batches: r.batches }));

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
    const keeps = keepsLabel(r.shelfLifeHours);
    return (
      <div key={r.id} className="card pr-recipe">
        <div className="pr-recipe-head">
          <strong>{r.name}</strong>
          <span className="muted">
            <Rich
              text={
                r.outputName !== r.name
                  ? t("one batch makes <qty>{qty}</qty> of {output}", {
                      qty: showIn(yieldBase, output, r.yieldUnit, t),
                      output: r.outputName,
                    })
                  : t("one batch makes <qty>{qty}</qty>", {
                      qty: showIn(yieldBase, output, r.yieldUnit, t),
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
                const each = perUnit(cost, yieldBase.div(f), unitLabel(output, r.yieldUnit, t));
                return each ? <span className="muted"> · {msg(each)}</span> : null;
              })()}
            </span>
          )}
          {missing.length > 0 && (
            <span className="pr-short pr-recipe-cost">
              {t("No cost yet for {names}: never bought or made", { names: missing.join(", ") })}
            </span>
          )}
          {keeps && (
            <span className="muted" data-testid="recipe-keeps">
              {t(keeps.text, keeps.vars)}
            </span>
          )}
        </div>
        <ul className="pr-lines">
          {r.lines.map((l, i) => (
            <li key={`${l.itemId}-${i}`}>
              <span className="mono">
                {fmtQty(l.quantity)} {unitLabel(byId.get(l.itemId), l.unitCode, t)}
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
      <div className="title-row">
        <h1>{t("nav.production")}</h1>
        <PlaceSwitch places={places} current={place?.id ?? null} />
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        {t(
          "What you make in batches: gelato, a base, syrup, dough. Recording a batch takes its ingredients out of stock and puts what came out in, valued at what the ingredients cost. Made items are then used like any other: in another batch (a base, then its flavours) or in a product's recipe on Products & Recipes (a cup of gelato).",
        )}
      </p>

      {canRecord && (
        <div className="card grid" style={{ gap: 12 }} id="record">
          <h2 style={{ margin: 0 }}>{t("Record a batch")}</h2>
          <RecordBatch
            key={prefill ? `${prefill.recipeId}:${prefill.batches}` : "blank"}
            initial={prefill}
            recipes={active}
            items={itemOpts}
            onHand={onHand}
            seesCost={seesCost}
            decimals={decimals}
            timezone={profile.timezone}
            canRecordLate={canCancel}
            labels={labelWords}
          />
        </div>
      )}

      {/* ---- The day's plan (0046) ---- */}
      <section className="panel" id="plan" data-testid="plan">
        <div className="panel-h">
          <h3>
            {t("What to make on {weekday}, {day}", {
              weekday: t(WEEKDAY_NAME[plan.weekday - 1] ?? ""),
              day: plan.day,
            })}
          </h3>
          <span style={{ display: "flex", gap: 6 }}>
            <Link className={planDay === today ? "badge ok" : "badge"} href="/production#plan">
              {t("Today")}
            </Link>
            <Link
              className={planDay === tomorrow ? "badge ok" : "badge"}
              href={`/production?day=${tomorrow}#plan`}
            >
              {t("Tomorrow")}
            </Link>
          </span>
        </div>
        <div className="panel-b grid" style={{ gap: 10 }}>
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            {t(
              "From what each was sold, used in batches or sent to another place on the same weekday over the last 4 to 8 weeks, on average, less what is on hand and still good at the end of the day: in whole batches.",
            )}
          </p>
          {plan.recipes.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t("Nothing is made here yet.")}
            </p>
          ) : (
            <div className="tw">
              <table data-testid="plan-table">
                <thead>
                  <tr>
                    <th>{t("What")}</th>
                    <th className="right">{t("Used on the day, on average")}</th>
                    <th className="right">{t("On hand")}</th>
                    <th className="right">{t("Due before the day is out")}</th>
                    <th className="right">{t("To make")}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.recipes.map((r) => {
                    const it = byId.get(r.itemId);
                    const q = (n: number) => showNice(new Decimal(n), it, r.baseUnit, t);
                    return (
                      <tr
                        key={r.recipeId}
                        data-testid="plan-row"
                        data-recipe={r.recipe}
                        data-status={r.status}
                      >
                        <td>{r.recipe}</td>
                        <td className="right mono">
                          {r.demand === null ? (
                            <span className="muted" style={{ fontFamily: "inherit" }}>
                              {r.historyDays
                                ? t("{n} day(s) of history: 28 are needed", { n: r.historyDays })
                                : t("No history yet: 28 days are needed")}
                            </span>
                          ) : (
                            <>
                              {q(r.demand)}
                              <div className="muted" style={{ fontSize: ".72rem" }}>
                                {t("over {n} weeks", { n: r.weeks ?? 0 })}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="right mono">{q(r.onHand)}</td>
                        <td className="right mono">{r.due > 0 ? q(r.due) : "—"}</td>
                        <td className="right">
                          {r.status === "make" ? (
                            <span className="plan-make">
                              <strong>
                                {t("{n} batch(es): {qty}", { n: r.batches, qty: q(r.makes) })}
                              </strong>
                              {canRecord && active.some((x) => x.id === r.recipeId) && (
                                <Link
                                  className="btn-soft"
                                  href={`/production?make=${r.recipeId}&batches=${r.batches}${
                                    planDay === tomorrow ? `&day=${tomorrow}` : ""
                                  }#record`}
                                  data-testid="plan-record"
                                >
                                  {t("Record these")}
                                </Link>
                              )}
                            </span>
                          ) : (
                            <span className={r.status === "enough" ? "badge ok" : "badge"}>
                              {t(PLAN_STATUS_LABEL[r.status])}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Drawn while the page is: what it recorded stays said when nothing is left to make. */}
          {canRecord && (
            <RecordPlan
              key={planDay}
              plan={toMake}
              recipes={active}
              items={itemOpts}
              onHand={onHand}
              timezone={profile.timezone}
              labels={labelWords}
            />
          )}
          {plan.ingredients.some((i) => i.short > 0) && (
            <p
              className="pr-short"
              style={{ margin: 0, fontSize: ".85rem" }}
              data-testid="plan-short"
            >
              <Rich
                text={t("Short for these batches: {list}. <buy>What to buy</buy>", {
                  list: plan.ingredients
                    .filter((i) => i.short > 0)
                    .map(
                      (i) =>
                        `${i.item} ${showNice(new Decimal(i.short), byId.get(i.itemId), i.baseUnit, t)}`,
                    )
                    .join(", "),
                })}
                tags={{ buy: (c) => <Link href="/purchasing/buying-list">{c}</Link> }}
              />
            </p>
          )}
        </div>
      </section>

      {/* ---- What is in stock, batch by batch (0046) ---- */}
      <section className="panel" id="lots" data-testid="lots-panel">
        <div className="panel-h">
          <h3>{t("In stock by batch")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("Sales take the batch to be used first first; one past its use-by last.")}
          </span>
        </div>
        <div className="panel-b">
          <ProductionLots
            lots={lots}
            items={itemOpts}
            timezone={profile.timezone}
            canChange={canCancel}
          />
        </div>
      </section>

      <section className="grid" style={{ gap: 10 }}>
        <h2 style={{ margin: "8px 0 0" }}>{t("What you make")}</h2>
        {canEdit && (
          <details className="card pr-new">
            <summary>
              <Icon name="plus" size={16} /> {t("Add something you make")}
            </summary>
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
                  <th>{t("Batch")}</th>
                  <th>{t("Made")}</th>
                  <th>{t("What")}</th>
                  <th className="right">{t("Batches")}</th>
                  <th className="right">{t("Came out")}</th>
                  <th className="right">{t("Still in stock")}</th>
                  <th>{t("Use by")}</th>
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
                    <tr
                      key={b.id}
                      className={cancelled ? "pr-cancelled" : undefined}
                      data-testid="batch-row"
                      data-batch={b.batchNo}
                    >
                      <td className="mono">
                        <Link href={`/production/batches/${b.id}`}>{b.batchNo}</Link>
                      </td>
                      <td className="muted mono" style={{ fontSize: ".8rem" }}>
                        {dateTimeIn(profile.timezone, b.producedAt)}
                        {b.lateReason && (
                          <div className="pr-note-cell" title={b.lateReason}>
                            <span className="badge warn">{t("recorded late")}</span>
                          </div>
                        )}
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
                        {showIn(actual, output, b.enteredUnit, t)}
                        {!diff.isZero() && (
                          <div
                            className={diff.lt(0) ? "pr-short" : "muted"}
                            style={{ fontSize: ".75rem" }}
                          >
                            {diff.lt(0) ? "−" : "+"}
                            {t("{qty} on the recipe", {
                              qty: showIn(diff.abs(), output, b.enteredUnit, t),
                            })}
                          </div>
                        )}
                      </td>
                      <td className="right mono">
                        {b.leftBase === null || cancelled
                          ? "—"
                          : showNice(new Decimal(b.leftBase), output, b.outputUnit, t)}
                      </td>
                      <td className="muted mono" style={{ fontSize: ".8rem" }}>
                        {b.useBy ? dateTimeIn(profile.timezone, b.useBy) : "—"}
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
                                  unitLabel(output, b.enteredUnit, t),
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
