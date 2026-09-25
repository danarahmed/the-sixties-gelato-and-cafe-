"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelScheduledPriceAction,
  cancelScheduledRecipeAction,
  setNoStockAction,
} from "@/lib/actions/menu";
import { channelLabel, fmtIQD } from "@/lib/format";
import { Notice } from "@/components/ui";
import type { ScheduledChange } from "@/lib/db/reports";
import type { SalesChannel } from "@domain/sales/recipe.js";

type Msg = { ok: boolean; text: string } | null;

/**
 * Prices and recipes set to start on a later date (0025): shown, so a change
 * made today cannot hide one already planned, and withdrawn — with a reason —
 * before they start.
 */
export function ScheduledChanges({
  changes,
  canEdit,
}: {
  changes: ScheduledChange[];
  canEdit: boolean;
}) {
  if (changes.length === 0) return null;
  return (
    <div style={{ marginBlockStart: 10 }} data-testid="scheduled-changes">
      <h4 className="muted" style={{ margin: "0 0 4px" }}>
        Scheduled
      </h4>
      <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: ".88rem" }}>
        {changes.map((c) => (
          <ScheduledRow key={c.id} change={c} canEdit={canEdit} />
        ))}
      </ul>
    </div>
  );
}

function ScheduledRow({ change, canEdit }: { change: ScheduledChange; canEdit: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const what =
    change.kind === "price"
      ? `${channelLabel[change.channel as SalesChannel] ?? change.channel} at ${fmtIQD(change.price ?? 0)}`
      : `a new recipe (version ${change.versionNo})`;

  function withdraw() {
    setMsg(null);
    start(async () => {
      const act =
        change.kind === "price" ? cancelScheduledPriceAction : cancelScheduledRecipeAction;
      const r = await act({ id: change.id, reason });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setAsking(false);
      router.refresh();
    });
  }

  return (
    <li style={{ marginBlockEnd: 4 }}>
      From <strong>{change.effectiveFrom}</strong>: {what}
      {canEdit && !asking && (
        <button
          onClick={() => setAsking(true)}
          style={{ marginInlineStart: 8, fontSize: ".78rem", minHeight: 28 }}
        >
          Withdraw…
        </button>
      )}
      {asking && (
        <span style={{ display: "inline-flex", gap: 6, marginInlineStart: 8, flexWrap: "wrap" }}>
          <input
            aria-label="Why the change is withdrawn"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why?"
            maxLength={300}
            style={{ minWidth: 160 }}
          />
          <button disabled={busy || !reason.trim()} onClick={withdraw}>
            {busy ? "Withdrawing…" : "Withdraw it"}
          </button>
          <button onClick={() => setAsking(false)} disabled={busy}>
            Keep it
          </button>
        </span>
      )}
      <Notice msg={msg} />
    </li>
  );
}

/**
 * A product whose sales are costed at nothing, said plainly (0025): no recipe,
 * or an ingredient with no cost yet. A product that truly uses no stock (a
 * service charge) says so, with a reason, and is not flagged.
 */
export function CostWarning({
  variantId,
  noRecipe,
  noStockReason,
  zeroCostItems,
  canEdit,
}: {
  variantId: string;
  noRecipe: boolean;
  noStockReason: string | null;
  zeroCostItems: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function save(r: string | null) {
    setMsg(null);
    start(async () => {
      const res = await setNoStockAction({ variantId, reason: r });
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setReason("");
      router.refresh();
    });
  }

  if (noRecipe && noStockReason) {
    return (
      <div className="muted" style={{ fontSize: ".85rem", margin: "6px 0 0" }}>
        Uses no stock: {noStockReason}.
        {canEdit && (
          <button
            onClick={() => save(null)}
            disabled={busy}
            style={{ marginInlineStart: 8, fontSize: ".78rem", minHeight: 28 }}
          >
            It does use stock
          </button>
        )}
        <Notice msg={msg} />
      </div>
    );
  }
  if (!noRecipe && zeroCostItems.length === 0) return null;
  return (
    <div style={{ margin: "6px 0 0" }} data-testid="cost-warning">
      <span className="badge err">Costed at nothing</span>{" "}
      <span style={{ fontSize: ".85rem" }}>
        {noRecipe
          ? "No recipe: nothing is taken from stock, and every sale shows full profit. Give it its recipe, or say why it uses no stock."
          : `No cost yet for ${zeroCostItems.join(", ")}: its share of each sale is costed at nothing until it is received, or given its opening stock on Inventory.`}
      </span>
      {canEdit && noRecipe && (
        <span style={{ display: "inline-flex", gap: 6, marginInlineStart: 8, flexWrap: "wrap" }}>
          <input
            aria-label="Why it uses no stock"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="A service charge"
            maxLength={200}
            style={{ minWidth: 160 }}
          />
          <button disabled={busy || !reason.trim()} onClick={() => save(reason)}>
            {busy ? "Saving…" : "Uses no stock"}
          </button>
        </span>
      )}
      <Notice msg={msg} />
    </div>
  );
}
