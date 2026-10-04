"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { recordProductionAction } from "@/lib/actions/production";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { inputStyle } from "@/components/ui";
import { parseNumber } from "@/components/pos/model";
import type { BatchRecipe } from "@/lib/db/production";
import {
  batchesOf,
  labelsFor,
  makeOrder,
  showIn,
  showNice,
  unitFactor,
  unitLabel,
} from "@/components/production/batchMath";
import { PrintAllLabels, type LabelBatch } from "@/components/production/BatchLabels";
import type { ProductionItem } from "@/components/production/RecordBatch";
import { OperationStatus, STUCK_MESSAGE, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

/** A row of the day's plan with batches to make. */
export interface PlanToMake {
  recipeId: string;
  batches: number;
}

type Done = { recipeId: string; batches: number; batch: LabelBatch; pans: number; text: string };
type Row = { pick: boolean; batches: string; out: string; unit: string };

/**
 * The day's plan recorded in one go (round five): each batch the plan says to
 * make, filled in as it says; what came out is changed where it differs, and
 * what was not made is unticked. One press records them one after another,
 * each as its own batch, checked as the batch form checks it and sent with its
 * own key, so a batch is never recorded twice whatever the connection does; a
 * base goes before the flavours made from it. What each became, or why it was
 * not recorded, is said beside it, and every label is printed at once.
 */
export function RecordPlan({
  plan,
  recipes,
  items,
  onHand,
  timezone,
  labels,
}: {
  plan: PlanToMake[];
  /** The recipes in use. */
  recipes: BatchRecipe[];
  items: ProductionItem[];
  /** Stock on hand in base units, for those who may see it. */
  onHand: Record<string, number> | null;
  timezone: string;
  labels: {
    businessName: string;
    place: string | null;
    by: string;
    names: Record<string, string>;
  } | null;
}) {
  const op = useOperation();
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const byId = new Map(items.map((i) => [i.id, i]));
  const recipeOf = new Map(recipes.map((r) => [r.id, r]));
  const [typed, setRows] = useState<Record<string, Row>>({});
  const [done, setDone] = useState<Record<string, Done>>({});
  const [refused, setRefused] = useState<Record<string, string>>({});
  const [at, setAt] = useState<{ i: number; n: number } | null>(null);

  // What the plan says to make now, and what was recorded here: said beside
  // it still when the page is drawn again with what is left to make.
  const todo = makeOrder(
    [
      ...plan.filter((p) => !done[p.recipeId]),
      ...Object.values(done).map((d) => ({ recipeId: d.recipeId, batches: d.batches })),
    ].flatMap((p) => {
      const r = recipeOf.get(p.recipeId);
      return r
        ? [{ ...p, recipe: r, outputItemId: r.outputItemId, uses: r.lines.map((l) => l.itemId) }]
        : [];
    }),
  );
  if (todo.length === 0) return null;
  // Each row as the plan fills it in, until it is changed.
  const rows: Record<string, Row> = Object.fromEntries(
    todo.map((p) => [
      p.recipeId,
      typed[p.recipeId] ?? {
        pick: true,
        batches: String(p.batches),
        out: "",
        unit: p.recipe.yieldUnit,
      },
    ]),
  );
  const set = (id: string, patch: Partial<Row>) =>
    setRows((all) => ({ ...all, [id]: { ...rows[id]!, ...all[id], ...patch } }));
  // What is still to record: ticked and not yet recorded; each with a number
  // of batches, and what came out a number too, or left as the recipe says.
  const ready = todo.filter((p) => rows[p.recipeId]?.pick && !done[p.recipeId]);
  const outOk = (p: (typeof todo)[number]) => {
    const row = rows[p.recipeId]!;
    if (row.out.trim() === "") return true;
    const typed = parseNumber(row.out);
    return Boolean(typed && typed.gt(0) && unitFactor(byId.get(p.recipe.outputItemId), row.unit));
  };
  const valid = ready.filter((p) => batchesOf(rows[p.recipeId]!.batches) && outOk(p));
  const total = valid.reduce(
    (s, p) => s.plus(batchesOf(rows[p.recipeId]!.batches)!),
    new Decimal(0),
  );

  // What some batches together need of each ingredient, against what is on
  // hand; what a batch before makes is there for those after it.
  const shortFor = (list: { p: (typeof todo)[number]; b: Decimal }[]): string[] => {
    if (!onHand) return [];
    const need = new Map<string, Decimal>();
    for (const { p, b } of list)
      for (const l of p.recipe.lines)
        need.set(
          l.itemId,
          (need.get(l.itemId) ?? new Decimal(0)).plus(new Decimal(l.baseQty).times(b)),
        );
    for (const { p, b } of list) {
      const n = need.get(p.recipe.outputItemId);
      if (n) need.set(p.recipe.outputItemId, n.minus(new Decimal(p.recipe.yieldBase).times(b)));
    }
    return [...need].flatMap(([itemId, n]) => {
      const have = new Decimal(onHand[itemId] ?? 0);
      if (!n.gt(have)) return [];
      const it = byId.get(itemId);
      return [`${it?.name ?? ""} ${showNice(n.minus(have), it, it?.baseUnit ?? "", t)}`];
    });
  };
  // Said here only once the batches ticked differ from the plan's: the plan says its own below.
  const short = shortFor(valid.map((p) => ({ p, b: batchesOf(rows[p.recipeId]!.batches)! })));
  const shortAsPlanned = shortFor(
    todo.filter((p) => !done[p.recipeId]).map((p) => ({ p, b: new Decimal(p.batches) })),
  );
  const shortChanged = short.join() !== shortAsPlanned.join();

  function recordAll() {
    const list = valid;
    if (list.length === 0) return;
    start(async () => {
      let recorded = 0;
      for (const [i, p] of list.entries()) {
        setAt({ i: i + 1, n: list.length });
        const row = rows[p.recipeId]!;
        const typed = row.out.trim();
        const output = byId.get(p.recipe.outputItemId);
        const r = await op.run(`plan:${p.recipeId}`, (key) =>
          recordProductionAction(
            {
              recipeId: p.recipeId,
              batches: row.batches,
              outputQty: typed === "" ? null : typed,
              outputUnit: typed === "" ? null : row.unit,
              note: "",
              stockApprovalId: null,
              producedAt: null,
              lateReason: null,
              useBy: null,
            },
            key,
          ),
        );
        if (r.ok) {
          const shownUnit = typed === "" ? p.recipe.yieldUnit : row.unit;
          const made = showIn(new Decimal(r.data.actual), output, shownUnit, t);
          recorded += 1;
          const d: Done = {
            recipeId: p.recipeId,
            batches: Number(row.batches) || p.batches,
            batch: {
              batchNo: r.data.batchNo,
              name: labels?.names[p.recipe.outputItemId] || p.recipe.outputName,
              made: showNice(new Decimal(r.data.actual), output, output?.baseUnit ?? "", t),
              madeAt: new Date().toISOString(),
              useBy: r.data.useBy,
              place: labels?.place ?? null,
              madeBy: labels?.by ?? null,
            },
            pans: labelsFor(r.data.actual, shownUnit, output),
            text: [
              t("Recorded as batch {no}: {made} of {output} into stock.", {
                no: r.data.batchNo,
                made,
                output: p.recipe.outputName,
              }),
              r.data.useBy
                ? t("Use it by {when}.", { when: dateTimeIn(timezone, r.data.useBy) })
                : null,
            ]
              .filter(Boolean)
              .join(" "),
          };
          setDone((all) => ({ ...all, [p.recipeId]: d }));
          setRefused((all) => {
            const rest = { ...all };
            delete rest[p.recipeId];
            return rest;
          });
        } else setRefused((all) => ({ ...all, [p.recipeId]: r.error }));
      }
      setAt(null);
      if (recorded > 0) router.refresh();
    });
  }

  const printed = todo.flatMap((p) => {
    const d = done[p.recipeId];
    return d ? [{ batch: d.batch, count: d.pans }] : [];
  });
  return (
    <details className="plan-all" data-testid="plan-all">
      <summary>
        <Icon name="bolt" size={16} /> {t("Record the plan in one go")}
      </summary>
      <div className="plan-all-body">
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {t(
            "Each as the plan says: change what came out where it differs, and untick what was not made.",
          )}
        </p>
        <ul className="plan-all-rows">
          {todo.map((p) => {
            const row = rows[p.recipeId]!;
            const output = byId.get(p.recipe.outputItemId);
            const b = batchesOf(row.batches);
            const planned = b ? new Decimal(p.recipe.yieldBase).times(b) : null;
            const d = done[p.recipeId];
            const no = refused[p.recipeId];
            const units = output
              ? [output.baseUnit, ...output.units.map((u) => u.code)].filter(
                  (c, i, all) => all.indexOf(c) === i,
                )
              : [];
            return (
              <li
                key={p.recipeId}
                className={`plan-all-row${d ? " done" : ""}${no ? " refused" : ""}`}
                data-testid="plan-all-row"
                data-recipe={p.recipe.name}
                data-state={d ? "done" : no ? "refused" : row.pick ? "ready" : "skipped"}
              >
                <label className="plan-all-pick">
                  <input
                    type="checkbox"
                    checked={row.pick || Boolean(d)}
                    disabled={Boolean(d) || busy}
                    aria-label={t("Make {name}", { name: p.recipe.name })}
                    onChange={(e) => set(p.recipeId, { pick: e.target.checked })}
                  />
                  <strong>{p.recipe.name}</strong>
                </label>
                {d ? (
                  <span className="plan-all-said ok" role="status">
                    ✓ {d.text}
                  </span>
                ) : (
                  <>
                    <label className="plan-all-field">
                      <span>{t("Batches")}</span>
                      <input
                        aria-label={t("Batches of {name}", { name: p.recipe.name })}
                        style={{ ...inputStyle, width: 72 }}
                        inputMode="decimal"
                        value={row.batches}
                        disabled={!row.pick || busy}
                        onChange={(e) => set(p.recipeId, { batches: e.target.value })}
                      />
                    </label>
                    <label className="plan-all-field">
                      <span>{t("What came out (optional)")}</span>
                      <span className="pr-out">
                        <input
                          aria-label={t("What came out of {name}", { name: p.recipe.name })}
                          style={{ ...inputStyle, width: 110 }}
                          inputMode="decimal"
                          value={row.out}
                          disabled={!row.pick || busy}
                          placeholder={
                            planned ? showIn(planned, output, p.recipe.yieldUnit, t) : ""
                          }
                          onChange={(e) => set(p.recipeId, { out: e.target.value })}
                        />
                        <select
                          aria-label={t("Unit of what came out of {name}", { name: p.recipe.name })}
                          style={{ ...inputStyle, width: 120 }}
                          value={row.unit}
                          disabled={!row.pick || busy}
                          onChange={(e) => set(p.recipeId, { unit: e.target.value })}
                        >
                          {units.map((c) => (
                            <option key={c} value={c}>
                              {unitLabel(output, c, t)}
                            </option>
                          ))}
                        </select>
                      </span>
                    </label>
                    {row.pick && !b && (
                      <span className="plan-all-said pr-short">
                        {t("Enter how many batches, as a number above 0.")}
                      </span>
                    )}
                    {row.pick && !outOk(p) && (
                      <span className="plan-all-said pr-short">
                        {t("Enter what came out as a number, or leave it empty.")}
                      </span>
                    )}
                    {no && (
                      <span className="plan-all-said pr-short" role="alert">
                        {t("Not recorded: {why}", { why: say(no) })}
                        {/* With no answer it may be saved: the same press checks it, never a second batch. */}
                        {no !== STUCK_MESSAGE && (
                          <>
                            {" "}
                            <Link
                              href={`/production?make=${p.recipeId}&batches=${row.batches}#record`}
                              data-testid="plan-all-alone"
                            >
                              {t("Record it on its own")}
                            </Link>
                          </>
                        )}
                      </span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {short.length > 0 && shortChanged && (
          <p
            className="pr-short"
            style={{ margin: 0, fontSize: ".85rem" }}
            data-testid="plan-all-short"
          >
            {t("Short for these batches: {list}.", { list: short.join(", ") })}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {valid.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              data-testid="plan-all-record"
              disabled={busy || valid.length !== ready.length}
              onClick={recordAll}
            >
              {busy && at
                ? t("Recording {i} of {n}…", at)
                : t("Record {n} batch(es)", { n: total.toNumber() })}
            </button>
          )}
          <OperationStatus op={op} />
          {labels && printed.length > 0 && (
            <PrintAllLabels
              batches={printed}
              businessName={labels.businessName}
              timezone={timezone}
            />
          )}
        </div>
      </div>
    </details>
  );
}
