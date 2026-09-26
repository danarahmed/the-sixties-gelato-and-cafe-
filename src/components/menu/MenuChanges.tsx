"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelScheduledPriceAction,
  cancelScheduledRecipeAction,
  setNoStockAction,
} from "@/lib/actions/menu";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Rich } from "@/lib/i18n/Rich";
import { Notice } from "@/components/ui";
import { useChannels } from "@/components/ChannelsProvider";
import type { ScheduledChange } from "@/lib/db/reports";

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
  const { t } = useT();
  if (changes.length === 0) return null;
  return (
    <div style={{ marginBlockStart: 10 }} data-testid="scheduled-changes">
      <h4 className="muted" style={{ margin: "0 0 4px" }}>
        {t("Scheduled")}
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
  const { t } = useT();
  const router = useRouter();
  const { name: channelName } = useChannels();
  const [busy, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const what =
    change.kind === "price"
      ? t("{channel} at {price}", {
          channel: channelName(change.channel ?? ""),
          price: fmtIQD(change.price ?? 0),
        })
      : t("a new recipe (version {version})", { version: String(change.versionNo) });

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
      <Rich text={t("From <b>{date}</b>: {what}", { date: change.effectiveFrom, what })} />
      {canEdit && !asking && (
        <button
          onClick={() => setAsking(true)}
          style={{ marginInlineStart: 8, fontSize: ".78rem", minHeight: 28 }}
        >
          {t("Withdraw…")}
        </button>
      )}
      {asking && (
        <span style={{ display: "inline-flex", gap: 6, marginInlineStart: 8, flexWrap: "wrap" }}>
          <input
            aria-label={t("Why the change is withdrawn")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("Why?")}
            maxLength={300}
            style={{ minWidth: 160 }}
          />
          <button disabled={busy || !reason.trim()} onClick={withdraw}>
            {busy ? t("Withdrawing…") : t("Withdraw it")}
          </button>
          <button onClick={() => setAsking(false)} disabled={busy}>
            {t("Keep it")}
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
  const { t } = useT();
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
        {t("Uses no stock: {reason}.", { reason: noStockReason })}
        {canEdit && (
          <button
            onClick={() => save(null)}
            disabled={busy}
            style={{ marginInlineStart: 8, fontSize: ".78rem", minHeight: 28 }}
          >
            {t("It does use stock")}
          </button>
        )}
        <Notice msg={msg} />
      </div>
    );
  }
  if (!noRecipe && zeroCostItems.length === 0) return null;
  return (
    <div style={{ margin: "6px 0 0" }} data-testid="cost-warning">
      <span className="badge err">{t("Costed at nothing")}</span>{" "}
      <span style={{ fontSize: ".85rem" }}>
        {noRecipe
          ? t(
              "No recipe: nothing is taken from stock, and every sale shows full profit. Give it its recipe, or say why it uses no stock.",
            )
          : t(
              "No cost yet for {items}: its share of each sale is costed at nothing until it is received, or given its opening stock on Inventory.",
              { items: zeroCostItems.join(", ") },
            )}
      </span>
      {canEdit && noRecipe && (
        <span style={{ display: "inline-flex", gap: 6, marginInlineStart: 8, flexWrap: "wrap" }}>
          <input
            aria-label={t("Why it uses no stock")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("A service charge")}
            maxLength={200}
            style={{ minWidth: 160 }}
          />
          <button disabled={busy || !reason.trim()} onClick={() => save(reason)}>
            {busy ? t("Saving…") : t("Uses no stock")}
          </button>
        </span>
      )}
      <Notice msg={msg} />
    </div>
  );
}
