"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { draftPurchaseOrdersAction, type DraftedOrder } from "@/lib/actions/buying";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

/**
 * What to buy, drafted in one press (0092): a draft order for each supplier,
 * from what is to order and what its supplier would top up, for a manager to
 * approve and send on this page. What has no supplier or price is named, for
 * What to buy.
 */
export function DraftNow({ locationId }: { locationId: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ orders: DraftedOrder[]; left: string[] } | null>(null);

  function draft() {
    setError(null);
    setMade(null);
    start(async () => {
      const r = await op.run("draftPurchaseOrders", (key) =>
        draftPurchaseOrdersAction({ locationId }, key),
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMade(r.data);
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="draft-now">
      <div>
        <button type="button" className="btn-primary" disabled={busy} onClick={draft}>
          {busy ? t("Drafting…") : t("Draft the orders now")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={error ? { ok: false, text: error } : null} />
      {made && made.orders.length === 0 && (
        <span className="muted" data-testid="draft-now-none">
          {t("Nothing to order now: everything lasts until its next delivery could come.")}
        </span>
      )}
      {made && made.orders.length > 0 && (
        <div data-testid="draft-now-made">
          <strong>
            {t("{n} draft order(s) made: approve and send each below.", { n: made.orders.length })}
          </strong>
          <ul style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>
            {made.orders.map((o) => (
              <li key={o.poId}>
                <Link href={`/purchasing/orders/${o.poId}`}>{t("Order {no}", { no: o.poNo })}</Link>
                {" · "}
                {o.supplier}
                {" · "}
                {fmtIQD(o.total)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {made && made.left.length > 0 && (
        <span className="muted" data-testid="draft-now-left">
          {t("To order, but with no supplier or price yet: {items}. Choose them on What to buy.", {
            items: made.left.join(", "),
          })}
        </span>
      )}
    </div>
  );
}
