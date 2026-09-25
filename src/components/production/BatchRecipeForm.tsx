"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { saveBatchRecipeAction } from "@/lib/actions/production";
import { NO_CHANNELS } from "@/lib/channels";
import { fmtIQD } from "@/lib/format";
import { Notice, inputStyle } from "@/components/ui";
import { parseNumber } from "@/components/pos/model";
import type { BatchRecipe } from "@/lib/db/production";
import {
  NoCostYet,
  RecipeLinesEditor,
  filledLines,
  halfFilled,
  linesFrom,
  newLine,
  type ItemOpt,
  type LineDraft,
} from "@/components/menu/RecipeLines";
import { batchCost, perUnit, unitFactor } from "@/components/production/batchMath";

type Msg = { ok: boolean; text: string } | null;
type Measure = "weight" | "volume" | "pieces";

const MEASURES: { value: Measure; label: string; units: { code: string; label: string }[] }[] = [
  {
    value: "weight",
    label: "Weighed (g, kg)",
    units: [
      { code: "kg", label: "kg" },
      { code: "g", label: "g" },
    ],
  },
  {
    value: "volume",
    label: "Measured (ml, L)",
    units: [
      { code: "L", label: "L" },
      { code: "ml", label: "ml" },
    ],
  },
  { value: "pieces", label: "Counted in pieces", units: [{ code: "each", label: "pieces" }] },
];

/**
 * What the café makes in batches: its name, how much one batch makes (in any
 * unit: weighed, measured, counted, or in a container such as a pan), and what
 * goes into one batch. Its ingredients may be bought or made here, so a base
 * made first and then flavoured fits, and so does a flavour made from scratch.
 */
export function BatchRecipeForm({
  recipe,
  items,
  decimals,
  seesCost,
  onClose,
}: {
  /** The recipe being changed; none for a new one. */
  recipe?: BatchRecipe;
  items: ItemOpt[];
  decimals: number;
  seesCost: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const itemOf = (id: string) => items.find((i) => i.id === id);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [name, setName] = useState(recipe?.name ?? "");
  const [makes, setMakes] = useState<"new" | "existing">("new");
  const [existingId, setExistingId] = useState("");
  const [measure, setMeasure] = useState<Measure>("weight");
  const [container, setContainer] = useState("");
  const [containerQty, setContainerQty] = useState("");
  const [containerUnit, setContainerUnit] = useState("kg");
  const [yieldQty, setYieldQty] = useState(
    recipe
      ? String(
          new Decimal(recipe.yieldBase)
            .div(unitFactor(itemOf(recipe.outputItemId), recipe.yieldUnit) ?? 1)
            .toDecimalPlaces(3)
            .toNumber(),
        )
      : "",
  );
  const [yieldUnit, setYieldUnit] = useState(recipe?.yieldUnit ?? "kg");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    recipe
      ? linesFrom(
          recipe.lines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            unitCode: l.unitCode,
          })),
          NO_CHANNELS,
        )
      : [newLine()],
  );
  const [instructions, setInstructions] = useState(recipe?.instructions ?? "");

  // The item it makes, as far as the form knows it yet, and the units its yield may be given in.
  const outputId = recipe ? recipe.outputItemId : makes === "existing" ? existingId : null;
  const outputItem = outputId ? itemOf(outputId) : undefined;
  const m = MEASURES.find((x) => x.value === measure)!;
  const yieldUnits: { code: string; label: string }[] = outputItem
    ? [
        { code: outputItem.baseUnit, label: outputItem.baseUnit },
        ...outputItem.units.filter((u) => u.code !== outputItem.baseUnit),
      ]
    : [
        ...m.units,
        ...(container.trim()
          ? [{ code: container.trim().toLowerCase(), label: container.trim() }]
          : []),
      ];
  const ingredients = items.filter((i) => i.id !== outputId);

  // What one batch costs, and each unit of what it makes.
  const yieldAmount = parseNumber(yieldQty);
  const costLines = filledLines(lines, NO_CHANNELS).map((l) => {
    const it = itemOf(l.itemId);
    const f = unitFactor(it, l.unitCode) ?? 1;
    return { itemId: l.itemId, baseQty: new Decimal(parseNumber(l.qty) ?? 0).times(f).toNumber() };
  });
  const cost =
    seesCost && costLines.length > 0
      ? batchCost(costLines, new Decimal(1), (id) => itemOf(id)?.unitCost ?? "0", decimals)
      : null;
  const yieldLabel = yieldUnits.find((u) => u.code === yieldUnit)?.label ?? yieldUnit;

  function pickMeasure(v: Measure) {
    setMeasure(v);
    const units = MEASURES.find((x) => x.value === v)!.units;
    setYieldUnit(units[0]!.code);
    setContainerUnit(units[0]!.code);
  }

  function pickExisting(id: string) {
    setExistingId(id);
    const it = itemOf(id);
    if (it) {
      setYieldUnit(it.units.find((u) => u.code !== it.baseUnit)?.code ?? it.baseUnit);
      if (!name.trim()) setName(it.name);
    }
  }

  function save() {
    setMsg(null);
    const half = halfFilled(lines);
    if (half >= 0) {
      setMsg({
        ok: false,
        text: `Line ${half + 1}: choose the ingredient and its quantity, or remove the line.`,
      });
      return;
    }
    start(async () => {
      const r = await saveBatchRecipeAction({
        recipeId: recipe?.id ?? null,
        name,
        output: recipe
          ? null
          : makes === "existing"
            ? { itemId: existingId }
            : {
                measure,
                container: container.trim() || null,
                containerQty: container.trim() ? containerQty : null,
                containerUnit: container.trim() ? containerUnit : null,
              },
        yieldQty,
        yieldUnit,
        lines: filledLines(lines, NO_CHANNELS).map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          unitCode: l.unitCode,
        })),
        instructions,
        isActive: recipe?.isActive ?? true,
      });
      if (r.ok) {
        setMsg({ ok: true, text: recipe ? "Saved." : `Added “${name.trim()}”.` });
        if (!recipe) {
          setName("");
          setYieldQty("");
          setContainer("");
          setContainerQty("");
          setLines([newLine()]);
          setInstructions("");
        }
        router.refresh();
        onClose?.();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="pf pr-form">
      <section className="pf-step">
        <h3 className="pf-h">
          <span className="pf-n">1</span> What it makes
        </h3>
        <div className="pr-grid">
          <label>
            <span>Name</span>
            <input
              aria-label="Name of what it makes"
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pistachio gelato, White base, Croissants"
            />
          </label>
          {!recipe && (
            <label>
              <span>It is</span>
              <select
                aria-label="New or kept item"
                style={inputStyle}
                value={makes}
                onChange={(e) => setMakes(e.target.value as "new" | "existing")}
              >
                <option value="new">Something new to keep in stock</option>
                <option value="existing">An item already kept</option>
              </select>
            </label>
          )}
          {!recipe && makes === "existing" && (
            <label>
              <span>Item</span>
              <select
                aria-label="Item it makes"
                style={inputStyle}
                value={existingId}
                onChange={(e) => pickExisting(e.target.value)}
              >
                <option value="">Choose…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!recipe && makes === "new" && (
            <label>
              <span>How it is counted</span>
              <select
                aria-label="How it is counted"
                style={inputStyle}
                value={measure}
                onChange={(e) => pickMeasure(e.target.value as Measure)}
              >
                {MEASURES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!recipe && makes === "new" && (
          <div className="pr-container">
            <span className="muted">Kept in a container? (optional)</span>
            <input
              aria-label="Container"
              style={inputStyle}
              value={container}
              onChange={(e) => setContainer(e.target.value)}
              placeholder="pan, tray, tub"
            />
            {container.trim() && (
              <>
                <span className="muted">holds</span>
                <input
                  aria-label="What a container holds"
                  style={inputStyle}
                  value={containerQty}
                  onChange={(e) => setContainerQty(e.target.value)}
                  inputMode="decimal"
                />
                <select
                  aria-label="Unit a container holds"
                  style={inputStyle}
                  value={containerUnit}
                  onChange={(e) => setContainerUnit(e.target.value)}
                >
                  {m.units.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
        <div className="pr-yield">
          <span>One batch makes</span>
          <input
            aria-label="One batch makes"
            style={inputStyle}
            value={yieldQty}
            onChange={(e) => setYieldQty(e.target.value)}
            inputMode="decimal"
          />
          <select
            aria-label="Unit one batch makes"
            style={inputStyle}
            value={yieldUnit}
            onChange={(e) => setYieldUnit(e.target.value)}
          >
            {yieldUnits.map((u) => (
              <option key={u.code} value={u.code}>
                {u.label}
              </option>
            ))}
          </select>
          <span className="muted">
            — about right is fine: each batch records what really came out, if you weigh or count
            it.
          </span>
        </div>
      </section>

      <section className="pf-step">
        <h3 className="pf-h">
          <span className="pf-n">2</span> What goes into one batch
        </h3>
        <p className="pf-hint">
          Anything kept in stock, bought or made here: a base made first, then flavoured, works the
          same as milk and sugar.
        </p>
        <RecipeLinesEditor
          items={ingredients}
          lines={lines}
          onChange={setLines}
          decimals={decimals}
          channels={false}
        />
        {cost && (
          <div className="pf-total" data-testid="batch-cost">
            <span>One batch costs</span>
            <span className="pf-total-figs">
              <span>
                <strong className="mono">{fmtIQD(cost.toNumber())}</strong>
              </span>
              {yieldAmount && yieldAmount.gt(0) && (
                <span className="muted">{perUnit(cost, yieldAmount, yieldLabel)}</span>
              )}
            </span>
          </div>
        )}
        <NoCostYet lines={lines} items={ingredients} />
      </section>

      <section className="pf-step">
        <h3 className="pf-h">
          <span className="pf-n">3</span> How to make it (optional)
        </h3>
        <textarea
          aria-label="How to make it"
          style={{ ...inputStyle, minHeight: 70, paddingBlock: 8 }}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Steps, temperatures, resting times — shown to whoever records a batch"
        />
      </section>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={save} disabled={busy || !name.trim()}>
          {busy ? "Saving…" : recipe ? "Save changes" : "Add it"}
        </button>
        {onClose && (
          <button onClick={onClose} disabled={busy}>
            Cancel
          </button>
        )}
        <Notice msg={msg} />
      </div>
    </div>
  );
}
