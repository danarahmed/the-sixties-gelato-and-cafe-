"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { returnToSupplierAction } from "@/lib/actions/purchasing";
import { fmtIQD, unitName } from "@/lib/format";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

export interface ReturnItemOpt {
  id: string;
  name: string;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}
export interface ReturnDeliveryOpt {
  id: string;
  receiptNo: number | null;
  supplierId: string | null;
  receivedOn: string;
  billed: boolean;
  /** Received before the controls, or reversed: its goods go back without naming it. */
  usable: boolean;
  itemIds: string[];
}
type Msg = { ok: boolean; text: string } | null;
interface LineDraft {
  itemId: string;
  qty: string;
  unit: string;
}

/** The database's question when a return would leave stock below zero. */
const BELOW_ZERO = /below zero: confirm to return it all the same$/;

/**
 * Goods sent back to a supplier (0044). Named against the delivery they came
 * in, the supplier owes back what that delivery charged for them: before its
 * bill, off what the bill will clear; after it, as a credit on the supplier's
 * account, set against the bill. Not named, at what they cost now.
 */
export function ReturnGoods({
  suppliers,
  items,
  deliveries,
}: {
  suppliers: { id: string; name: string }[];
  items: ReturnItemOpt[];
  deliveries: ReturnDeliveryOpt[];
}) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [check, setCheck] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [receiptId, setReceiptId] = useState("");
  const [reason, setReason] = useState("");
  const blank = (): LineDraft => ({ itemId: "", qty: "", unit: "" });
  const [lines, setLines] = useState<LineDraft[]>([blank()]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const theirs = deliveries.filter((d) => d.usable && d.supplierId === supplierId);
  const delivery = theirs.find((d) => d.id === receiptId) ?? null;
  const choosable = delivery ? items.filter((i) => delivery.itemIds.includes(i.id)) : items;
  const set = (i: number, patch: Partial<LineDraft>) => {
    setCheck(null);
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };
  const ready =
    !busy &&
    supplierId !== "" &&
    reason.trim() !== "" &&
    lines.some((l) => l.itemId !== "" && Number(normaliseNumber(l.qty)) > 0);

  function submit(confirm: boolean) {
    if (!ready) return;
    setMsg(null);
    start(async () => {
      const r = await op.run("returnGoods", (key) =>
        returnToSupplierAction(
          {
            supplierId,
            receiptId: delivery?.id ?? null,
            reason,
            confirm,
            lines: lines
              .filter((l) => l.itemId !== "" && l.qty.trim() !== "")
              .map((l) => ({
                itemId: l.itemId,
                qty: normaliseNumber(l.qty),
                unitCode: l.unit || (byId.get(l.itemId)?.baseUnit ?? ""),
              })),
          },
          key,
        ),
      );
      if (!r.ok) {
        if (!confirm && BELOW_ZERO.test(r.error)) setCheck(r.error);
        else setMsg({ ok: false, text: r.error });
        return;
      }
      setCheck(null);
      setMsg({
        ok: true,
        text:
          r.data.against === "delivery"
            ? t(
                "Return {no}: {value} back to the supplier, off what the delivery's bill will clear.",
                {
                  no: r.data.returnNo,
                  value: fmtIQD(r.data.value),
                },
              )
            : r.data.setAgainstBill > 0
              ? t(
                  "Return {no}: {value} owed back, as credit {credit} on the supplier's account; {set} of it set against the delivery's bill.",
                  {
                    no: r.data.returnNo,
                    value: fmtIQD(r.data.value),
                    credit: r.data.creditNo ?? "—",
                    set: fmtIQD(r.data.setAgainstBill),
                  },
                )
              : t("Return {no}: {value} owed back, as credit {credit} on the supplier's account.", {
                  no: r.data.returnNo,
                  value: fmtIQD(r.data.value),
                  credit: r.data.creditNo ?? "—",
                }),
      });
      setLines([blank()]);
      setReason("");
      setReceiptId("");
      router.refresh();
    });
  }

  return (
    <div className="card grid" style={{ gap: 10 }} data-testid="return-goods">
      <h3 style={{ margin: 0 }}>
        <Icon name="undo" /> {t("Return goods to a supplier")}
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Named against the delivery they came in, the supplier owes back what it charged for them: before its bill, the bill is for what was kept; after it, a credit on their account is set against the bill. The stock leaves at what it costs now.",
        )}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={{ minWidth: 200 }}>
          <div className="sc">{t("Supplier")}</div>
          <select
            aria-label={t("Supplier")}
            value={supplierId}
            onChange={(e) => {
              setCheck(null);
              setSupplierId(e.target.value);
              setReceiptId("");
            }}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 240 }}>
          <div className="sc">{t("The delivery they came in")}</div>
          <select
            aria-label={t("The delivery they came in")}
            value={receiptId}
            onChange={(e) => {
              setCheck(null);
              setReceiptId(e.target.value);
            }}
          >
            <option value="">{t("Not named: at what they cost now")}</option>
            {theirs.map((d) => (
              <option key={d.id} value={d.id}>
                {t("Delivery {no} ({day}), {billed}", {
                  no: d.receiptNo ?? "—",
                  day: d.receivedOn,
                  billed: d.billed ? t("billed") : t("awaiting its bill"),
                })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table>
        <thead>
          <tr>
            <th>{t("Item")}</th>
            <th className="right">{t("Quantity")}</th>
            <th>{t("Unit")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const it = byId.get(l.itemId);
            return (
              <tr key={i} data-testid="return-line">
                <td>
                  <select
                    aria-label={t("Item")}
                    value={l.itemId}
                    onChange={(e) =>
                      set(i, {
                        itemId: e.target.value,
                        unit: byId.get(e.target.value)?.baseUnit ?? "",
                      })
                    }
                  >
                    <option value="">{t("Choose…")}</option>
                    {choosable.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="right">
                  <input
                    aria-label={t("Quantity")}
                    className="amt"
                    inputMode="decimal"
                    style={{ width: 90, textAlign: "end" }}
                    value={l.qty}
                    onChange={(e) => set(i, { qty: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label={t("Unit")}
                    value={l.unit || it?.baseUnit || ""}
                    onChange={(e) => set(i, { unit: e.target.value })}
                    disabled={!it}
                  >
                    {it && <option value={it.baseUnit}>{unitName(it.baseUnit, t)}</option>}
                    {it?.units
                      .filter((u) => u.code !== it.baseUnit)
                      .map((u) => (
                        <option key={u.code} value={u.code}>
                          {unitName(u.label, t)}
                        </option>
                      ))}
                  </select>
                </td>
                <td>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      aria-label={t("Remove the line")}
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        style={{ alignSelf: "start" }}
        onClick={() => setLines((ls) => [...ls, blank()])}
      >
        + {t("Add line")}
      </button>
      <label>
        <div className="sc">{t("Why they are going back")}</div>
        <input
          aria-label={t("Why they are going back")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("Damaged in delivery, out of date, the wrong size…")}
          maxLength={300}
        />
      </label>
      {check && (
        <div
          className="card"
          role="alert"
          data-testid="return-check"
          style={{ borderColor: "var(--warn)" }}
        >
          <p style={{ marginTop: 0, fontSize: ".88rem" }}>
            <strong>{say(check)}</strong>
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => submit(true)} disabled={busy}>
              {t("Return it all the same")}
            </button>
            <button onClick={() => setCheck(null)} disabled={busy}>
              {t("Let me correct it")}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={() => submit(false)}
          disabled={!ready || check !== null}
        >
          {busy ? t("Saving…") : t("Return them")}
        </button>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </div>
  );
}
