"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustStockAction, recordLossAction, recordOpeningStockAction } from "@/lib/actions/stock";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import {
  LOSS_ACCOUNT_NAME,
  LOSS_KINDS,
  NEEDS_APPROVAL,
  NEEDS_STOCK_APPROVAL,
  lossKind,
  type LossKind,
} from "@/lib/losses";
import { LOT_STATUS_LABEL, type LotStatus } from "@/lib/production";
import { useT } from "@/lib/i18n/I18nProvider";
import { normaliseNumber } from "@/lib/validation";
import { Field, Notice, inputStyle } from "@/components/ui";
import { NewItemForm } from "@/components/NewItemForm";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { ManagerApproval } from "@/components/ManagerApproval";

interface ItemOpt {
  id: string;
  name: string;
  /** Its Arabic and Kurdish names, to find look-alikes of a new item among. */
  nameAr?: string | null;
  nameCkb?: string | null;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}

/** A product the café sells, by the size: its name, with the size when it has several. */
export interface ProductOpt {
  variantId: string;
  name: string;
}

/** A batch in stock of an item kept by batch (0046). */
export interface LotOpt {
  lotId: string;
  lot: string;
  itemId: string;
  batchNo: number | null;
  left: number;
  status: LotStatus;
}

type Msg = { ok: boolean; text: string } | null;

export function InventoryForms({
  items,
  unstocked,
  products = [],
  lots = [],
  canAddItem,
  canWaste,
  canCorrect,
  isOwner,
  lossLimit = null,
  lossWindow = null,
  onHand = {},
}: {
  items: ItemOpt[];
  /** The products sold, to record one lost as made (0048). */
  products?: ProductOpt[];
  /** The batches in stock, to lose from the one named (0048). */
  lots?: LotOpt[];
  /** Items with no stock history yet: they can be given their opening stock. */
  unstocked: ItemOpt[];
  canAddItem: boolean;
  canWaste: boolean;
  canCorrect: boolean;
  /** Opening stock is capital the owner puts in: the owner's alone (0027). */
  isOwner: boolean;
  /** The loss a manager approves over, as it applies to the person, and what it is added up over (0040). */
  lossLimit?: number | null;
  lossWindow?: string | null;
  /** Each item's stock here and what one base unit costs, for a correction to show its effect. */
  onHand?: Record<string, { qty: number; cost: number | null }>;
}) {
  if (!canAddItem && !canWaste && !canCorrect) return null;
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}
    >
      {isOwner && unstocked.length > 0 && <OpeningStock items={unstocked} />}
      {canAddItem && <AddItem isOwner={isOwner} items={items} />}
      {canWaste && (
        <RecordLoss
          items={items}
          products={products}
          lots={lots}
          lossLimit={lossLimit}
          lossWindow={lossWindow}
        />
      )}
      {canCorrect && <CorrectStock items={items} onHand={onHand} lossLimit={lossLimit} />}
    </div>
  );
}

function AddItem({ isOwner, items }: { isOwner: boolean; items: ItemOpt[] }) {
  const { t } = useT();
  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }}>
      <h3 style={{ margin: 0 }}>➕ {t("Add stock item")}</h3>
      <NewItemForm items={items} isOwner={isOwner} />
    </div>
  );
}

function UnitSelect({
  item,
  value,
  onChange,
}: {
  item: ItemOpt | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useT();
  const units = item?.units ?? [];
  return (
    <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      {units.map((u) => (
        <option key={u.code} value={u.code}>
          {unitName(u.label, t)}
          {u.factor !== 1 ? ` (${u.factor} ${unitName(item?.baseUnit ?? "", t)})` : ""}
        </option>
      ))}
    </select>
  );
}

/**
 * Opening stock for an item that has none yet — at go-live, or for an item
 * added without it — at what it cost, so its sales are costed from the start.
 */
function OpeningStock({ items }: { items: ItemOpt[] }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  // Once an item has its opening stock it leaves the list: fall back to the first.
  const item = items.find((i) => i.id === itemId) ?? items[0];
  const [unitChoice, setUnit] = useState(item?.baseUnit ?? "");
  const unit = item?.units.some((u) => u.code === unitChoice) ? unitChoice : (item?.baseUnit ?? "");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const unitLabel = unitName(item?.units.find((u) => u.code === unit)?.label ?? unit, t);
  const value =
    (Number(qty.replace(/[^0-9.]/g, "")) || 0) * (Number(unitCost.replace(/[^0-9.]/g, "")) || 0);

  function submit() {
    if (!item) return;
    setMsg(null);
    start(async () => {
      const r = await op.run("recordOpeningStock", (key) =>
        recordOpeningStockAction(
          {
            itemId: item.id,
            qty,
            unitCode: unit || null,
            unitCost,
            reason,
          },
          key,
        ),
      );
      if (r.ok) {
        setMsg({
          ok: true,
          text: t("Opening stock of {name}: {qty} {unit}, worth {value} (journal {journal}).", {
            name: item.name,
            qty,
            unit: unitLabel,
            value: fmtIQD(r.data.value),
            journal: r.data.journalNo ?? "—",
          }),
        });
        setQty("");
        setUnitCost("");
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (!item) return null;
  return (
    <div
      className="card grid"
      style={{ gap: 10, alignContent: "start" }}
      data-testid="opening-stock"
    >
      <h3 style={{ margin: 0 }}>📦 {t("Opening stock")}</h3>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {t(
          "{n} item(s) have no stock recorded yet. Count what is on the shelf and enter it at what it cost, so every sale of it is costed.",
          { n: items.length },
        )}
      </p>
      <Field label={t("Item with no stock yet")}>
        <select
          style={inputStyle}
          value={item.id}
          onChange={(e) => {
            setItemId(e.target.value);
            setUnit(items.find((i) => i.id === e.target.value)?.baseUnit ?? "");
          }}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label={t("Quantity on the shelf")}>
          <input
            style={inputStyle}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label={t("Unit")}>
          <UnitSelect item={item} value={unit} onChange={setUnit} />
        </Field>
        <Field label={t("Cost per {unit} (IQD)", { unit: unitLabel })}>
          <input
            style={inputStyle}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            inputMode="decimal"
          />
        </Field>
      </div>
      <Field label={t("Where it came from")}>
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          placeholder={t("e.g. the opening count on the first day")}
        />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {value > 0 ? `${t("Worth {value}.", { value: fmtIQD(value) })} ` : ""}
        {t(
          "It is capital you put into the business, on the audit trail with where it came from. Once an item has stock, it changes only by deliveries, sales, waste, counts and corrections.",
        )}
      </p>
      <details className="booked">
        <summary>{t("How it is booked")}</summary>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: ".8rem" }}>
          {t("Journaled Dr 1200 Inventory / Cr 3000 Owner equity.")}
        </p>
      </details>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={pending || !qty.trim() || !unitCost.trim() || !reason.trim()}
        >
          {pending ? t("Recording…") : t("Record opening stock")}
        </button>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </div>
  );
}

/**
 * A loss (0048): its kind first, with what it means and the account it is
 * charged to; then an item (from a batch, when it is kept by batch) or a
 * product, as its recipe makes it to eat in; and why. Over the limit a
 * manager approves it now, with their PIN, or it is saved to wait for one.
 */
function RecordLoss({
  items,
  products,
  lots,
  lossLimit,
  lossWindow,
}: {
  items: ItemOpt[];
  products: ProductOpt[];
  lots: LotOpt[];
  lossLimit: number | null;
  lossWindow: string | null;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [kind, setKind] = useState<LossKind>("waste");
  const [what, setWhat] = useState<"item" | "product">("item");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const item = items.find((i) => i.id === itemId);
  const [unit, setUnit] = useState(items[0]?.baseUnit ?? "");
  const [lotId, setLotId] = useState("");
  const [variantId, setVariantId] = useState(products[0]?.variantId ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  // What the database asked for: a manager now, or the choice to wait for one (0040).
  const [need, setNeed] = useState<"approval" | "stock" | null>(null);
  const k = lossKind(kind) ?? LOSS_KINDS[0];
  const itemLots = lots.filter((l) => l.itemId === itemId && l.left > 0);
  const product = products.find((p) => p.variantId === variantId);

  function submit(extra: { approvalId?: string; wait?: boolean } = {}) {
    setMsg(null);
    start(async () => {
      const r = await op.run("recordLoss", (key) =>
        recordLossAction(
          what === "item"
            ? { kind, itemId, qty, unitCode: unit || null, lotId: lotId || null, reason, ...extra }
            : { kind, variantId, qty, reason, ...extra },
          key,
        ),
      );
      if (r.ok) {
        setNeed(null);
        const journal = r.data.journalNo ?? "—";
        setMsg({
          ok: true,
          text:
            r.data.status === "pending"
              ? t("Saved. It waits for a manager's approval, under Needs you.")
              : r.data.value !== undefined
                ? r.data.approvedBy
                  ? t("Recorded, approved by {name} — {value} written off (journal {journal}).", {
                      name: r.data.approvedBy,
                      value: fmtIQD(r.data.value),
                      journal,
                    })
                  : t("Recorded — {value} written off (journal {journal}).", {
                      value: fmtIQD(r.data.value),
                      journal,
                    })
                : t("Recorded (journal {journal}).", { journal }),
        });
        setQty("");
        setReason("");
        setLotId("");
        router.refresh();
      } else {
        if (NEEDS_APPROVAL.test(r.error)) setNeed("approval");
        else if (NEEDS_STOCK_APPROVAL.test(r.error)) setNeed("stock");
        else setNeed(null);
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  if (items.length === 0 && products.length === 0) return null;
  return (
    <div className="card grid" style={{ gap: 10, alignContent: "start" }} data-testid="record-loss">
      <h3 style={{ margin: 0 }}>🗑️ {t("Record a loss")}</h3>
      <Field label={t("What kind of loss")}>
        <select
          style={inputStyle}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as LossKind);
            setNeed(null);
          }}
        >
          {LOSS_KINDS.map((l) => (
            <option key={l.kind} value={l.kind}>
              {t(l.label)}
            </option>
          ))}
        </select>
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }} data-testid="loss-kind-explain">
        {t(k.explain)}{" "}
        {t("Charged to {code} {name}.", {
          code: k.account,
          name: t(LOSS_ACCOUNT_NAME[k.account] ?? ""),
        })}
      </p>
      {products.length > 0 && (
        <div style={{ display: "flex", gap: 6 }} role="group" aria-label={t("What was lost")}>
          <button
            type="button"
            className={what === "item" ? "btn-primary" : undefined}
            aria-pressed={what === "item"}
            onClick={() => {
              setWhat("item");
              setNeed(null);
            }}
          >
            {t("An item")}
          </button>
          <button
            type="button"
            className={what === "product" ? "btn-primary" : undefined}
            aria-pressed={what === "product"}
            onClick={() => {
              setWhat("product");
              setNeed(null);
            }}
          >
            {t("A product, as made")}
          </button>
        </div>
      )}
      {what === "item" ? (
        <>
          <Field label={t("Item")}>
            <select
              style={inputStyle}
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                setUnit(items.find((i) => i.id === e.target.value)?.baseUnit ?? "");
                setLotId("");
                setNeed(null);
              }}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          {itemLots.length > 0 && (
            <Field label={t("From batch")}>
              <select style={inputStyle} value={lotId} onChange={(e) => setLotId(e.target.value)}>
                <option value="">{t("As sales take it: the batch to be used first")}</option>
                {itemLots.map((l) => (
                  <option key={l.lotId} value={l.lotId}>
                    {l.batchNo !== null ? t("Batch {n}", { n: l.batchNo }) : l.lot} —{" "}
                    {fmtQty(l.left)} {unitName(item?.baseUnit ?? "", t)} ·{" "}
                    {t(LOT_STATUS_LABEL[l.status])}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label={t("Quantity lost")}>
              <input
                style={inputStyle}
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  setNeed(null);
                }}
                inputMode="decimal"
              />
            </Field>
            <Field label={t("Unit")}>
              <UnitSelect item={item} value={unit} onChange={setUnit} />
            </Field>
          </div>
        </>
      ) : (
        <>
          <Field label={t("Product")}>
            <select
              style={inputStyle}
              value={variantId}
              onChange={(e) => {
                setVariantId(e.target.value);
                setNeed(null);
              }}
            >
              {products.map((p) => (
                <option key={p.variantId} value={p.variantId}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("How many")}>
            <input
              style={inputStyle}
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                setNeed(null);
              }}
              inputMode="decimal"
            />
          </Field>
          <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
            {t("What its recipe uses to eat in comes out, without add-ons.")}
          </p>
        </>
      )}
      <Field label={t("Why (required)")}>
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {t("Taken out at what it costs now.")}{" "}
        {lossLimit !== null &&
          t(
            lossWindow === "entry"
              ? "A loss over {limit} needs a manager's approval."
              : lossWindow === "day"
                ? "A loss over {limit}, or that takes your losses today or the item's over it, needs a manager's approval."
                : "A loss over {limit}, or that takes your losses this session (or today) or the item's today over it, needs a manager's approval.",
            { limit: fmtIQD(lossLimit) },
          )}
      </p>
      <details className="booked">
        <summary>{t("How it is booked")}</summary>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: ".8rem" }}>
          {t("In one journal: Dr {code} / Cr 1200 Inventory.", { code: k.account })}
        </p>
      </details>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={() => submit()}
          disabled={pending || !qty || !reason.trim() || (what === "product" && !product)}
        >
          {pending ? t("Recording…") : t("Record the loss")}
        </button>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
      {need && (
        <div className="card grid" style={{ gap: 8 }} data-testid="loss-approval">
          <b style={{ fontSize: ".9rem" }}>
            {need === "approval"
              ? t("A manager approves it now, with their PIN:")
              : t("A manager approves using more than the books hold, with their PIN:")}
          </b>
          <ManagerApproval
            kind="waste"
            items={
              what === "item"
                ? `${item?.name ?? ""} ${qty} ${unitName(unit, t)}`
                : `${product?.name ?? ""} ×${qty}`
            }
            onApproved={(a) => submit({ approvalId: a.id })}
          />
          {need === "approval" && (
            <div>
              <button type="button" onClick={() => submit({ wait: true })} disabled={pending}>
                {t("Save it to wait for a manager's approval")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CorrectStock({
  items,
  onHand,
  lossLimit,
}: {
  items: ItemOpt[];
  onHand: Record<string, { qty: number; cost: number | null }>;
  lossLimit: number | null;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const item = items.find((i) => i.id === itemId);
  const [unit, setUnit] = useState(items[0]?.baseUnit ?? "");
  const [delta, setDelta] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  // Asked again before a large change is posted: one a slip of the keyboard could make.
  const [asking, setAsking] = useState(false);
  const adding = Number(delta.replace(/[^0-9.-]/g, "")) > 0;

  // What the change does here: the stock before and after, and what it is worth.
  const here = onHand[itemId];
  const typed = Number(normaliseNumber(delta));
  const change =
    delta.trim() && Number.isFinite(typed)
      ? typed * (item?.units.find((u) => u.code === unit)?.factor ?? 1)
      : 0;
  const typedCost = Number(normaliseNumber(unitCost));
  const cost =
    adding && unitCost.trim() && Number.isFinite(typedCost) ? typedCost : (here?.cost ?? null);
  const worth = cost !== null ? Math.abs(change) * cost : null;
  const base = unitName(item?.baseUnit ?? "", t);
  const now = here ? `${fmtQty(here.qty)} ${base}` : "";
  const after = here ? `${fmtQty(here.qty + change)} ${base}` : "";
  // More than all it has here, or worth more than a loss a manager must approve.
  const large =
    here !== undefined &&
    change !== 0 &&
    (Math.abs(change) > Math.max(here.qty, 0) ||
      (lossLimit !== null && worth !== null && worth > lossLimit));

  function post() {
    if (large && !asking) {
      setAsking(true);
      return;
    }
    setAsking(false);
    submit();
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await op.run("adjustStock", (key) =>
        adjustStockAction(
          {
            itemId,
            delta,
            unitCode: unit || null,
            reason,
            unitCost: adding && unitCost ? unitCost : null,
          },
          key,
        ),
      );
      if (r.ok) {
        setMsg({
          ok: true,
          text: t("Corrected — {value} (journal {journal}).", {
            value: fmtIQD(r.data.value),
            journal: r.data.journalNo ?? "—",
          }),
        });
        setDelta("");
        setUnitCost("");
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (items.length === 0) return null;
  return (
    <div
      className="card grid"
      style={{ gap: 10, alignContent: "start" }}
      data-testid="correct-stock"
    >
      <h3 style={{ margin: 0 }}>✏️ {t("Correct stock (manager)")}</h3>
      <Field label={t("Item")}>
        <select
          style={inputStyle}
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setUnit(items.find((i) => i.id === e.target.value)?.baseUnit ?? "");
            setAsking(false);
          }}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Field label={t("Change (− to reduce)")}>
          <input
            style={inputStyle}
            value={delta}
            onChange={(e) => {
              setDelta(e.target.value);
              setAsking(false);
            }}
            inputMode="decimal"
            placeholder="-250"
          />
        </Field>
        <Field label={t("Unit")}>
          <UnitSelect
            item={item}
            value={unit}
            onChange={(u) => {
              setUnit(u);
              setAsking(false);
            }}
          />
        </Field>
        <Field label={t("Cost per base unit (additions)")}>
          <input
            style={inputStyle}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            inputMode="decimal"
            disabled={!adding}
            placeholder={t("average")}
          />
        </Field>
      </div>
      <Field label={t("Why (required)")}>
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </Field>
      <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
        {t(
          "For corrections outside a count. What is taken off goes out at its average cost, and is written to the audit trail. Counted stock is corrected by approving a count.",
        )}
      </p>
      <details className="booked">
        <summary>{t("How it is booked")}</summary>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: ".8rem" }}>
          {t("Posted against 5400 Inventory count variance.")}
        </p>
      </details>
      {here && change !== 0 && (
        <p className="muted" style={{ fontSize: ".85rem", margin: 0 }} data-testid="correct-effect">
          {t("On hand here: {now} → {after}", { now, after })}
          {worth !== null && ` · ${t("worth {value}", { value: fmtIQD(worth) })}`}
        </p>
      )}
      {asking && (
        <div
          className="card"
          role="alert"
          data-testid="correct-confirm"
          style={{ borderColor: "var(--warn)", padding: 10, fontSize: ".86rem" }}
        >
          {worth !== null
            ? t(
                "A large change: {item} goes from {now} to {after} here, worth {value}. Is it right?",
                {
                  item: item?.name ?? "",
                  now,
                  after,
                  value: fmtIQD(worth),
                },
              )
            : t("A large change: {item} goes from {now} to {after} here. Is it right?", {
                item: item?.name ?? "",
                now,
                after,
              })}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={post}
          disabled={pending || !delta || !reason.trim()}
        >
          {pending ? t("Posting…") : asking ? t("Yes, post it") : t("Post correction")}
        </button>
        {asking && (
          <button type="button" onClick={() => setAsking(false)}>
            {t("Change it")}
          </button>
        )}
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </div>
  );
}
