"use client";

import { useState } from "react";
import type { PosItem } from "@/lib/db/pos";
import type { SaleReceipt } from "@/lib/actions/sales";
import { fmtIQD, fmtQty } from "@/lib/format";
import { fmtRate, fmtUSD } from "@/lib/fx";
import { useT } from "@/lib/i18n/I18nProvider";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { useChannels } from "@/components/ChannelsProvider";
import { Notice } from "@/components/ui";
import { REASONS, reasonKey } from "@/lib/reasons";
import Decimal from "decimal.js";
import {
  discountAmount,
  discountInvalid,
  discountNeeds,
  isDirty,
  isPlatform,
  itemCount,
  addonNames,
  lineAmount,
  lineName,
  linePrice,
  minutesSince,
  orderSubtotal,
  percentOf,
  savedHasItems,
  type AddonMenu,
  type Discount,
  type DiscountRules,
  type Line,
  type MoneyRules,
  type Order,
  type Tender,
} from "./model";
import { Emblem, type BaristaTicket, type PrintJob } from "./PrintSlip";

export interface Receipt extends SaleReceipt {
  tender: Tender;
  change: number | null;
  job: PrintJob;
  /** The barista's copy of a quick sale; a bill's went to the bar when it was saved. */
  ticket: BaristaTicket | null;
  ticketPrinted: boolean;
}

function OrderLine({
  line,
  order,
  byId,
  addons,
  locked,
  onQty,
  onNote,
}: {
  line: Line;
  order: Order;
  byId: Map<string, PosItem>;
  addons: AddonMenu;
  locked: boolean;
  onQty: (key: string, delta: number) => void;
  onNote: (key: string, note: string | null) => void;
}) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(line.note ?? "");
  const price = linePrice(line, byId, order.channel, addons);
  const amount = lineAmount(line, byId, order.channel, addons);
  const withAddons = addonNames(line.addons, addons, locale, line.addons);
  const save = () => {
    onNote(line.key, note.trim() || null);
    setEditing(false);
  };
  return (
    <div className="order-line">
      <div className="ol-row">
        <div className="ol-main">
          <span className="ol-name">{lineName(line, byId, locale)}</span>
          {withAddons.length > 0 && (
            <span className="ol-addons" data-testid="line-addons">
              + {withAddons.join(", ")}
            </span>
          )}
          <span className="ol-sub muted">
            {price === null ? t("pos.noPrice") : fmtIQD(price)}
            {line.note && <em className="ol-note"> · {line.note}</em>}
          </span>
        </div>
        <div className="stepper">
          <button
            aria-label={`${t("pos.less")} ${lineName(line, byId, locale)}`}
            onClick={() => onQty(line.key, -1)}
            disabled={locked}
          >
            −
          </button>
          <span className="mono">{fmtQty(line.qty)}</span>
          <button
            aria-label={`${t("pos.more")} ${lineName(line, byId, locale)}`}
            onClick={() => onQty(line.key, 1)}
            disabled={locked}
          >
            +
          </button>
        </div>
        <span className="ol-amt mono">{amount === null ? "—" : fmtIQD(amount.toNumber())}</span>
        <button
          className="ol-note-btn"
          title={t("pos.addNote")}
          aria-label={t("pos.addNote")}
          onClick={() => {
            setNote(line.note ?? "");
            setEditing((v) => !v);
          }}
          disabled={locked}
        >
          ✎
        </button>
      </div>
      {editing && (
        <div className="ol-note-edit">
          <input
            autoFocus
            value={note}
            maxLength={200}
            placeholder={t("pos.notePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button onClick={save}>{t("pos.ok")}</button>
        </div>
      )}
    </div>
  );
}

/**
 * A discount, typed either way: as a percentage, and the amount is worked out
 * (rounded to the dinar, as the books round it); or as an amount, and the
 * percentage is shown beside it. It is given with a reason from the list, and
 * over the cap with a manager's approval (0028); one already on the bill says
 * why, who gave it and who approved it.
 */
function DiscountRow({
  discount,
  subtotal,
  money,
  rules,
  locked,
  lockedReason,
  onChange,
  onRemove,
  onAskApproval,
}: {
  discount: Discount | null;
  subtotal: Decimal;
  money: MoneyRules;
  rules: DiscountRules;
  locked: boolean;
  lockedReason: string | null;
  onChange: (d: Discount | null) => void;
  onRemove: () => void;
  onAskApproval: () => void;
}) {
  const { t, msg } = useT();
  const amount = discountAmount(discount, subtotal, money);
  const invalid = discountInvalid(discount);
  const needs = discountNeeds(discount, subtotal, rules);
  // Why 47% of 8,500 shows 4,000 and not 3,995: the step is coarser than the currency's unit.
  const rounded =
    discount?.kind === "percent" && !invalid && money.discountStep > 10 ** -money.decimals;
  const percentShown =
    discount?.kind === "percent"
      ? discount.value
      : discount && !invalid
        ? percentOf(amount, subtotal)
        : "";
  const amountShown =
    discount?.kind === "amount" ? discount.value : discount && !invalid ? amount.toString() : "";
  // A new value is a new discount: asked about again, keeping the reason chosen.
  const typed = (kind: Discount["kind"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange(
      e.target.value.trim() === ""
        ? null
        : { ...discount, kind, value: e.target.value, kept: null },
    );
  const kept = discount?.kept ?? null;
  return (
    <div className="discount">
      <div className="discount-row">
        <span className="disc-label">{t("pos.discount")}</span>
        <label className="disc-field">
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={percentShown}
            onFocus={(e) => e.target.select()}
            onChange={typed("percent")}
            disabled={locked}
            aria-label={t("pos.discountPercent")}
          />
          <span>%</span>
        </label>
        <label className="disc-field wide">
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amountShown}
            onFocus={(e) => e.target.select()}
            onChange={typed("amount")}
            disabled={locked}
            aria-label={t("pos.discountAmount")}
          />
          <span>IQD</span>
        </label>
        <button
          className="disc-remove"
          onClick={onRemove}
          disabled={locked}
          aria-label={t("pos.removeDiscount")}
          title={t("pos.removeDiscount")}
        >
          ✕
        </button>
      </div>
      {invalid && <p className="red disc-note">{t("pos.discountInvalid")}</p>}
      {rounded && (
        <p className="muted disc-note">
          {t("pos.discountRounded").replace("{step}", fmtIQD(money.discountStep))}
        </p>
      )}
      {discount && !invalid && kept && (kept.reason || kept.by || kept.approvedBy) && (
        <p className="muted disc-note" data-testid="discount-kept">
          {[
            // The reason as the database keeps it: its English label.
            kept.reason ? msg(kept.reason) : null,
            kept.by ? t("pos.givenBy").replace("{name}", kept.by) : null,
            kept.approvedBy ? t("pos.approvedBy").replace("{name}", kept.approvedBy) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {discount && !invalid && !kept && (
        <div className="disc-why">
          <select
            aria-label={t("pos.discountReason")}
            value={discount.reason ?? ""}
            onChange={(e) => onChange({ ...discount, reason: e.target.value || null })}
            disabled={locked}
          >
            <option value="">{t("pos.chooseReason")}</option>
            {REASONS.discount.map((code) => (
              <option key={code} value={code}>
                {t(reasonKey("discount", code))}
              </option>
            ))}
          </select>
          {discount.reason === "other" && (
            <input
              aria-label={t("pos.reasonNote")}
              placeholder={t("pos.reasonNote")}
              value={discount.note ?? ""}
              maxLength={300}
              onChange={(e) => onChange({ ...discount, note: e.target.value })}
              disabled={locked}
            />
          )}
        </div>
      )}
      {needs === "note" && <p className="muted disc-note">{t("pos.sayWhat")}</p>}
      {needs === "approval" && (
        <p className="disc-note disc-approval" data-testid="discount-needs-approval">
          <span>{t("pos.overCap").replace("{cap}", String(rules.cap))}</span>
          <button onClick={onAskApproval} disabled={locked}>
            🔑 {t("pos.askManager")}
          </button>
        </p>
      )}
      {discount?.approval && !kept && needs === null && (
        <p className="muted disc-note" data-testid="discount-approved">
          ✓ {t("pos.approvedBy").replace("{name}", discount.approval.by)}
        </p>
      )}
      {lockedReason && <p className="muted disc-note">{lockedReason}</p>}
    </div>
  );
}

/**
 * The order on the right, laid out as a ticket: who it is for and its number
 * at the top, what is being sold in the middle, and at the foot what it comes
 * to and every way to finish it — paid now, kept open for later, printed,
 * split or moved. After a payment the middle shows the sale just recorded:
 * the customer's number, the change to give, and its printouts.
 */
export function OrderPanel({
  order,
  title,
  byId,
  addons,
  busy,
  pending,
  online,
  canVoid,
  canSeeCost,
  hasTables,
  receipt,
  msg,
  channels,
  onChannel,
  ticketOn,
  onQty,
  onNote,
  onLabel,
  onPay,
  onSave,
  onPrintBill,
  onTicket,
  onSplit,
  onMove,
  onCancelBill,
  onKeepForLater,
  onGiveAway,
  onClear,
  onRetry,
  onDiscard,
  onPrintReceipt,
  onPrintReceiptTicket,
  now,
  canDiscount,
  money,
  discountRules,
  onDiscount,
  onAskApproval,
  onCustomer = null,
}: {
  order: Order;
  title: string;
  byId: Map<string, PosItem>;
  /** The add-ons, to price and name a line's (0041). */
  addons: AddonMenu;
  busy: string | null;
  pending: boolean;
  online: boolean;
  canVoid: boolean;
  canSeeCost: boolean;
  hasTables: boolean;
  receipt: Receipt | null;
  msg: { ok: boolean; text: string } | null;
  /** The channels this order may still move between; null once it cannot. */
  channels: SalesChannel[] | null;
  onChannel: (c: SalesChannel) => void;
  /** This till prints the barista's ticket. */
  ticketOn: boolean;
  onQty: (key: string, delta: number) => void;
  onNote: (key: string, note: string | null) => void;
  onLabel: (label: string) => void;
  onPay: (tender: Tender) => void;
  onSave: () => void;
  onPrintBill: () => void;
  /** The barista's ticket for a bill: what the bar has not had yet, or the whole order again. */
  onTicket: () => void;
  onSplit: () => void;
  onMove: () => void;
  onCancelBill: () => void;
  onKeepForLater: () => void;
  /** A staff meal, on the house or a sample (0048): offered for a quick sale eaten in or taken away. */
  onGiveAway: (() => void) | null;
  onClear: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  onPrintReceipt: () => void;
  onPrintReceiptTicket: () => void;
  now: number;
  /** discount.apply: the discount row is offered. */
  canDiscount: boolean;
  /** How amounts and discounts are rounded, as the books round them. */
  money: MoneyRules;
  /** The cap above which a manager approves a discount, and whether this person does (0028). */
  discountRules: DiscountRules;
  onDiscount: (d: Discount | null) => void;
  onAskApproval: () => void;
  /** The order's customer (0050): found by their number, or added. */
  onCustomer?: (() => void) | null;
}) {
  const { t } = useT();
  const { name: channelName } = useChannels();
  const isBill = order.kind === "bill";
  const blocked = busy !== null || pending;
  const empty = order.lines.length === 0;
  const dirty = isDirty(order);
  const subtotal = orderSubtotal(order, byId, money, addons);
  const discount = discountAmount(order.discount, subtotal, money);
  const due = subtotal.minus(discount);
  // Not given until it has its reason and, over the cap, a manager's approval (0028).
  const badDiscount =
    discountInvalid(order.discount) ||
    discountNeeds(order.discount, subtotal, discountRules) !== null;
  const count = itemCount(order);
  const opened = minutesSince(order.openedAt, now);
  const savedWithItems = order.tabId !== null && savedHasItems(order);
  const [discountOpen, setDiscountOpen] = useState(false);
  const offerDiscount = canDiscount && !isPlatform(order.channel);
  const showDiscount = offerDiscount && (discountOpen || order.discount !== null);
  // The customer has seen the printed total: only a manager may change what it comes to.
  const discountLocked = isBill && order.printedAt !== null && !canVoid;
  const receiptTicket = receipt?.ticket && ticketOn ? receipt.ticket : null;

  return (
    <div className="card order-panel" aria-live="polite">
      <div className="order-head">
        <div className="order-head-main">
          <div className="order-title">{title}</div>
          <div className="order-badges">
            <span className="badge">{channelName(order.channel)}</span>
            {isBill && order.tabId === null && <span className="badge">{t("pos.newBill")}</span>}
            {isBill && order.printedAt && (
              <span className="badge warn">
                🧾 {t("pos.printed")}
                {order.printCount > 1 ? ` ×${order.printCount}` : ""}
              </span>
            )}
            {dirty && <span className="badge err">{t("pos.notSaved")}</span>}
          </div>
          {isBill && order.openedAt && (
            // The minutes open are the browser's own clock's, which may have
            // ticked since the server's rendered them.
            <div className="order-opened muted" suppressHydrationWarning>
              {t("pos.openedBy")} {order.openedBy ?? "—"}
              {opened !== null ? ` · ${opened} ${t("pos.min")}` : ""}
            </div>
          )}
        </div>
        {order.turnNo !== null && (
          <div className="order-turn" title={t("pos.turnHint")}>
            <span>{t("print.no")}</span>
            <strong>{order.turnNo}</strong>
          </div>
        )}
      </div>

      {channels && channels.length > 1 && (
        <div className="channel-tabs" role="group" aria-label={t("pos.channel")}>
          {channels.map((c) => (
            <button
              key={c}
              className={c === order.channel ? "active" : ""}
              aria-pressed={c === order.channel}
              onClick={() => onChannel(c)}
              disabled={blocked && c !== order.channel}
            >
              {channelName(c)}
            </button>
          ))}
        </div>
      )}

      {isBill && order.tabId === null && order.tableId === null && (
        <label className="order-customer muted">
          {t("pos.customerName")}
          <input
            value={order.label ?? ""}
            maxLength={60}
            onChange={(e) => onLabel(e.target.value)}
            disabled={blocked}
          />
        </label>
      )}

      {onCustomer && !isPlatform(order.channel) && (
        <div
          className="order-customer muted"
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
          data-testid="order-customer"
        >
          {order.customer ? (
            <>
              <span>
                👤 <b data-testid="order-customer-name">{order.customer.name}</b>
                {order.customer.points !== null &&
                  ` · ${t("{n} points", { n: String(order.customer.points) })}`}
              </span>
              {order.customer.address && (
                <span data-testid="order-customer-address">→ {order.customer.address}</span>
              )}
              <button type="button" className="linklike" onClick={onCustomer} disabled={blocked}>
                {t("Change")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCustomer}
              disabled={blocked}
              data-testid="order-customer-add"
            >
              👤 {t("Customer")}
            </button>
          )}
        </div>
      )}

      <div className="order-lines">
        {empty && receipt ? (
          <div className="receipt-card">
            <div className="rc-top">
              <strong>
                ✅ {t("pos.recorded")} · {receipt.orderId.slice(0, 8)}
              </strong>
              {receipt.payments.length > 1 || receipt.payments.some((p) => p.currency === "USD") ? (
                <span
                  data-testid="receipt-payments"
                  style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                >
                  {receipt.payments.map((p, i) => (
                    <span key={i} className="badge ok">
                      {p.currency === "USD"
                        ? t("{usd} at {rate} = {amount}", {
                            usd: fmtUSD(p.usd ?? 0),
                            rate: fmtRate(p.rate ?? 0),
                            amount: fmtIQD(p.received ?? p.amount),
                          })
                        : `${t(`pos.tender.${p.type}`)} ${fmtIQD(p.amount)}`}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="badge ok">{t(`pos.tender.${receipt.tender}`)}</span>
              )}
            </div>
            {receipt.turnNo !== null && (
              <div className="rc-turn">
                <span>{t("pos.customerNumber")}</span>
                <strong>{receipt.turnNo}</strong>
              </div>
            )}
            {receipt.customer && (
              <p className="rc-facts" data-testid="receipt-points">
                👤 {receipt.customer.name}
                {receipt.customer.earned > 0 &&
                  ` · ${t("Points earned: {n}", { n: String(receipt.customer.earned) })}`}
                {receipt.customer.spent > 0 &&
                  ` · ${t("Points spent: {n}", { n: String(receipt.customer.spent) })}`}
                {` · ${t("{n} points now", { n: String(receipt.customer.points) })}`}
              </p>
            )}
            <p className="rc-facts muted">
              {fmtIQD(receipt.net)}
              {receipt.platformOrderNo
                ? ` · ${t("print.orderNo").replace("{no}", receipt.platformOrderNo)}`
                : ""}
              {receipt.discount > 0 ? ` · ${t("pos.discount")} −${fmtIQD(receipt.discount)}` : ""}
              {receipt.journalNo !== null ? ` · ${t("pos.journal")} ${receipt.journalNo}` : ""}
              {canSeeCost && receipt.cogs !== undefined
                ? ` · ${t("pos.cost")} ${fmtIQD(receipt.cogs)}`
                : ""}
            </p>
            {receipt.change !== null && (
              <div className="change-row">
                <span>{t("pos.changeDue")}</span>
                <strong className="mono change-amt">{fmtIQD(receipt.change)}</strong>
              </div>
            )}
            <div className="rc-actions">
              <button onClick={onPrintReceipt}>
                🖨{" "}
                {receiptTicket && !receipt.ticketPrinted
                  ? t("pos.printBoth")
                  : t("pos.printReceipt")}
              </button>
              {receiptTicket && (
                <button onClick={onPrintReceiptTicket}>☕ {t("pos.baristaTicket")}</button>
              )}
            </div>
            <p className="rc-next muted">{t("pos.nextCustomer")}</p>
          </div>
        ) : empty ? (
          <div className="order-empty">
            <Emblem />
            <p>{t("pos.tapToAdd")}</p>
          </div>
        ) : (
          order.lines.map((l) => (
            <OrderLine
              key={l.key}
              line={l}
              order={order}
              byId={byId}
              addons={addons}
              locked={blocked}
              onQty={onQty}
              onNote={onNote}
            />
          ))
        )}
      </div>

      <div className="order-foot">
        {!empty && showDiscount && (
          <>
            <div className="order-sub">
              <span>
                {t("pos.subtotal")}{" "}
                <span className="muted">
                  · {fmtQty(count)} {t("pos.items")}
                </span>
              </span>
              <span className="mono">{fmtIQD(subtotal.toNumber())}</span>
            </div>
            <DiscountRow
              discount={order.discount}
              subtotal={subtotal}
              money={money}
              rules={discountRules}
              locked={blocked || discountLocked}
              lockedReason={discountLocked ? t("pos.discountLocked") : null}
              onChange={onDiscount}
              onRemove={() => {
                onDiscount(null);
                setDiscountOpen(false);
              }}
              onAskApproval={onAskApproval}
            />
          </>
        )}
        {!empty && offerDiscount && !showDiscount && (
          <button
            className="linklike add-discount"
            onClick={() => setDiscountOpen(true)}
            disabled={blocked || discountLocked}
          >
            ＋ {t("pos.addDiscount")}
          </button>
        )}
        {!empty && (
          <div className="order-total">
            <span>
              {t("pos.total")}{" "}
              {!showDiscount && (
                <span className="muted">
                  · {fmtQty(count)} {t("pos.items")}
                </span>
              )}
            </span>
            <strong className="mono">{fmtIQD(due.toNumber())}</strong>
          </div>
        )}

        {pending ? (
          <div className="order-actions">
            <button className="btn-primary big" disabled={busy !== null} onClick={onRetry}>
              {busy ? "…" : t("pos.retry")}
            </button>
            <button onClick={onDiscard} disabled={busy !== null}>
              {t("pos.discardPending")}
            </button>
          </div>
        ) : (
          !empty && (
            <>
              <div className="order-actions">
                {isPlatform(order.channel) ? (
                  <button
                    className="btn-primary big"
                    disabled={blocked || !online || badDiscount}
                    onClick={() => onPay("platform_paid")}
                  >
                    🧾 {t("pos.platformPaid")}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-primary big"
                      disabled={blocked || !online || badDiscount}
                      onClick={() => onPay("cash")}
                    >
                      💵 {t("pos.cash")}
                    </button>
                    <button
                      className="btn-primary big"
                      disabled={blocked || !online || badDiscount}
                      onClick={() => onPay("card")}
                    >
                      💳 {t("pos.card")}
                    </button>
                  </>
                )}
              </div>
              <div className="order-actions secondary">
                {isBill ? (
                  <>
                    <button
                      onClick={onSave}
                      disabled={
                        blocked || !online || badDiscount || !(dirty || order.tabId === null)
                      }
                    >
                      💾 {t("pos.save")}
                    </button>
                    <button onClick={onPrintBill} disabled={blocked || !online || badDiscount}>
                      🖨 {t("pos.printBill")}
                    </button>
                    {ticketOn && (
                      <button onClick={onTicket} disabled={blocked || !online || badDiscount}>
                        ☕ {t("pos.baristaTicket")}
                      </button>
                    )}
                    <button
                      onClick={onSplit}
                      disabled={
                        blocked || !online || badDiscount || order.tabId === null || count < 2
                      }
                    >
                      ✂ {t("pos.split")}
                    </button>
                    {hasTables && (
                      <button onClick={onMove} disabled={blocked || !online || badDiscount}>
                        ⇄ {t("pos.move")}
                      </button>
                    )}
                    <button
                      onClick={onCancelBill}
                      disabled={
                        blocked || (savedWithItems && !canVoid) || (order.tabId !== null && !online)
                      }
                      title={savedWithItems && !canVoid ? t("pos.cancelNeedsManager") : undefined}
                    >
                      ✕ {t("pos.cancelBill")}
                    </button>
                  </>
                ) : (
                  <>
                    {!isPlatform(order.channel) && (
                      <button onClick={onKeepForLater} disabled={blocked || !online || badDiscount}>
                        🕒 {t("pos.keepForLater")}
                      </button>
                    )}
                    {onGiveAway && (
                      <button onClick={onGiveAway} disabled={blocked || !online}>
                        🎁 {t("Give away…")}
                      </button>
                    )}
                    <button onClick={onClear} disabled={blocked}>
                      {t("pos.clear")}
                    </button>
                  </>
                )}
              </div>
            </>
          )
        )}
        {isBill && empty && !pending && (
          <div className="order-actions secondary">
            <button onClick={onCancelBill} disabled={blocked || (order.tabId !== null && !online)}>
              ✕ {order.tabId === null ? t("pos.close") : t("pos.cancelBill")}
            </button>
          </div>
        )}
        {!online && !pending && <p className="red order-offline">{t("pos.offlineBlocked")}</p>}

        <Notice msg={msg} />
      </div>
    </div>
  );
}
