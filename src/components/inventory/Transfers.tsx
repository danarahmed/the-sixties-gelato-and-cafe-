"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import {
  cancelTransferAction,
  receiveTransferAction,
  sendTransferAction,
} from "@/lib/actions/transfers";
import { TRANSFER_NOTE_MAX, TRANSFER_STATUS_LABEL, type Transfer } from "@/lib/transfers";
import { fmtIQD, fmtQty, unitName } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { normaliseNumber } from "@/lib/validation";

export interface TransferItemOpt {
  id: string;
  name: string;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}
type Msg = { ok: boolean; text: string } | null;
interface LineDraft {
  itemId: string;
  qty: string;
  unit: string;
}

/** The database's question when sending would leave stock below zero. */
const BELOW_ZERO = /below zero: confirm to send it all the same$/;

/**
 * Stock sent from one of the café's places to another (0054): from this
 * device's place unless another is chosen, at what it costs there. It is on
 * its way until the other place receives it.
 */
export function SendTransfer({
  places,
  from: fromFirst,
  items,
  stock,
}: {
  places: { id: string; name: string }[];
  from: string;
  items: TransferItemOpt[];
  /** What each place holds: place → item → stock in its base unit. */
  stock: Record<string, Record<string, number>>;
}) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [check, setCheck] = useState<string | null>(null);
  const [from, setFrom] = useState(fromFirst);
  const [to, setTo] = useState(places.find((p) => p.id !== fromFirst)?.id ?? "");
  const [note, setNote] = useState("");
  const blank = (): LineDraft => ({ itemId: "", qty: "", unit: "" });
  const [lines, setLines] = useState<LineDraft[]>([blank()]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const held = stock[from] ?? {};
  const set = (i: number, patch: Partial<LineDraft>) => {
    setCheck(null);
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };
  const ready =
    !busy &&
    to !== "" &&
    to !== from &&
    lines.some((l) => l.itemId !== "" && Number(normaliseNumber(l.qty)) > 0);

  function submit(confirm: boolean) {
    if (!ready) return;
    setMsg(null);
    start(async () => {
      const r = await op.run("send", (key) =>
        sendTransferAction(
          {
            fromId: from,
            toId: to,
            note,
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
        text: t("Transfer {no} is on its way to {to}: {value}.", {
          no: r.data.transferNo,
          to: r.data.to,
          value: fmtIQD(r.data.value),
        }),
      });
      setLines([blank()]);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="card grid" style={{ gap: 10 }} data-testid="send-transfer">
      <h3 style={{ margin: 0 }}>🚚 {t("Send stock to another place")}</h3>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "It leaves at what it costs where it is, the batch with the earliest use-by first, and is on its way until the other place receives it: counted there, what did not arrive is lost. While it is on its way it can be cancelled, and goes back where it was.",
        )}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={{ minWidth: 200 }}>
          <div className="sc">{t("From")}</div>
          <select
            aria-label={t("From")}
            value={from}
            data-testid="transfer-from"
            onChange={(e) => {
              setCheck(null);
              setFrom(e.target.value);
              if (e.target.value === to)
                setTo(places.find((p) => p.id !== e.target.value)?.id ?? "");
            }}
          >
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 200 }}>
          <div className="sc">{t("To")}</div>
          <select
            aria-label={t("To")}
            value={to}
            data-testid="transfer-to"
            onChange={(e) => {
              setCheck(null);
              setTo(e.target.value);
            }}
          >
            {places
              .filter((p) => p.id !== from)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("Item")}</th>
              <th className="right">{t("Quantity")}</th>
              <th>{t("Unit")}</th>
              <th className="right">{t("There now")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const it = byId.get(l.itemId);
              const there = it ? (held[it.id] ?? 0) : null;
              return (
                <tr key={i} data-testid="transfer-line">
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
                      {items.map((x) => (
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
                  <td
                    className="right mono muted"
                    style={{ color: there !== null && there < 0 ? "var(--err)" : undefined }}
                  >
                    {it && there !== null ? `${fmtQty(there)} ${unitName(it.baseUnit, t)}` : ""}
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
      </div>
      <button
        type="button"
        style={{ alignSelf: "start" }}
        onClick={() => setLines((ls) => [...ls, blank()])}
      >
        + {t("Add line")}
      </button>
      <label>
        <div className="sc">{t("Note (optional)")}</div>
        <input
          aria-label={t("Note (optional)")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={TRANSFER_NOTE_MAX}
          data-testid="transfer-note"
        />
      </label>
      {check && (
        <div
          className="card"
          role="alert"
          data-testid="transfer-check"
          style={{ borderColor: "var(--warn)" }}
        >
          <p style={{ marginTop: 0, fontSize: ".88rem" }}>
            <strong>{say(check)}</strong>
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => submit(true)} disabled={busy}>
              {t("Send it all the same")}
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
          data-testid="transfer-send"
        >
          {busy ? t("Saving…") : t("Send it")}
        </button>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </div>
  );
}

/** A unit's name as the item has it: "Sleeve of 50" for sleeve_50. */
type UnitNames = Record<string, Record<string, string>>;
const unitNamed = (units: UnitNames, itemId: string, code: string) => units[itemId]?.[code] ?? code;

/**
 * A transfer on its way: received there, all of it or what arrived, or
 * cancelled. What was done is said by the board above it, where it stays when
 * the transfer moves to those received and cancelled.
 */
function OnItsWay({
  transfer,
  units,
  onDone,
}: {
  transfer: Transfer;
  units: UnitNames;
  onDone: (text: string) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [mode, setMode] = useState<"none" | "short" | "cancel">("none");
  const [arrived, setArrived] = useState<Record<string, string>>(() =>
    Object.fromEntries(transfer.lines.map((l) => [l.id, String(l.qty)])),
  );
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  function receive(all: boolean) {
    setMsg(null);
    start(async () => {
      const r = await op.run("receive", (key) =>
        receiveTransferAction(
          {
            transferId: transfer.id,
            lines: all
              ? null
              : transfer.lines.map((l) => ({
                  lineId: l.id,
                  qty: normaliseNumber(arrived[l.id] ?? ""),
                })),
            note,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMode("none");
      onDone(
        r.data.short > 0
          ? t("Transfer {no} received: {value} arrived, {short} lost on the way.", {
              no: r.data.transferNo,
              value: fmtIQD(r.data.received),
              short: fmtIQD(r.data.short),
            })
          : t("Transfer {no} received: all of it.", { no: r.data.transferNo }),
      );
      router.refresh();
    });
  }

  function cancel() {
    setMsg(null);
    start(async () => {
      const r = await op.run("cancel", (key) =>
        cancelTransferAction({ transferId: transfer.id, reason }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMode("none");
      onDone(
        t("Transfer {no} cancelled: back at {from}.", { no: r.data.transferNo, from: r.data.from }),
      );
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }}>
      {mode === "short" && (
        <div className="grid" style={{ gap: 8 }} data-testid="transfer-arrived">
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            {t("What arrived of each, in the unit it was sent in: what did not arrive is lost.")}
          </p>
          {transfer.lines.map((l) => (
            <label
              key={l.id}
              style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
            >
              <span style={{ minWidth: 160 }}>{l.item}</span>
              <input
                aria-label={t("What arrived of {item}", { item: l.item })}
                className="amt"
                inputMode="decimal"
                style={{ width: 90, textAlign: "end" }}
                value={arrived[l.id] ?? ""}
                onChange={(e) => setArrived((a) => ({ ...a, [l.id]: e.target.value }))}
                data-testid="arrived-qty"
              />
              <span className="muted">
                {t("of {qty} {unit} sent", {
                  qty: fmtQty(l.qty),
                  unit: unitName(unitNamed(units, l.itemId, l.unitCode), t),
                })}
              </span>
            </label>
          ))}
          <label>
            <div className="sc">{t("Note (optional)")}</div>
            <input
              aria-label={t("Note (optional)")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={TRANSFER_NOTE_MAX}
              placeholder={t("A tub fell, one came open…")}
            />
          </label>
        </div>
      )}
      {mode === "cancel" && (
        <label>
          <div className="sc">{t("Why the transfer is cancelled")}</div>
          <input
            aria-label={t("Why the transfer is cancelled")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder={t("Sent to the wrong place, not needed after all…")}
            data-testid="transfer-cancel-reason"
          />
        </label>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {mode === "none" && (
          <>
            <button
              className="btn-primary"
              onClick={() => receive(true)}
              disabled={busy}
              data-testid="transfer-receive"
            >
              {t("Received: all of it")}
            </button>
            <button
              onClick={() => setMode("short")}
              disabled={busy}
              data-testid="transfer-receive-some"
            >
              {t("Not all of it arrived…")}
            </button>
            <button onClick={() => setMode("cancel")} disabled={busy} data-testid="transfer-cancel">
              {t("Cancel it…")}
            </button>
          </>
        )}
        {mode === "short" && (
          <>
            <button
              className="btn-primary"
              onClick={() => receive(false)}
              disabled={busy}
              data-testid="transfer-receive-what"
            >
              {t("Receive what arrived")}
            </button>
            <button onClick={() => setMode("none")} disabled={busy}>
              {t("Back")}
            </button>
          </>
        )}
        {mode === "cancel" && (
          <>
            <button
              className="btn-primary"
              onClick={cancel}
              disabled={busy || reason.trim() === ""}
              data-testid="transfer-cancel-confirm"
            >
              {t("Cancel the transfer")}
            </button>
            <button onClick={() => setMode("none")} disabled={busy}>
              {t("Back")}
            </button>
          </>
        )}
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </div>
  );
}

/** The transfers: where each is from and going, what, at what, and where it stands. */
function TransferList({
  transfers,
  units,
  canAct,
  timezone,
  onDone,
}: {
  transfers: Transfer[];
  units: UnitNames;
  canAct: boolean;
  timezone: string;
  onDone: (text: string) => void;
}) {
  const { t, msg: say } = useT();
  const when = (iso: string | null) => (iso ? dateTimeIn(timezone, iso) : "—");
  return (
    <div className="grid" style={{ gap: 12 }}>
      {transfers.map((x) => (
        <section
          key={x.id}
          className="panel"
          data-testid="transfer"
          data-no={x.no}
          data-status={x.status}
        >
          <div className="panel-h">
            <h3>
              {t("Transfer {no}", { no: x.no })} · {t("{from} to {to}", { from: x.from, to: x.to })}
            </h3>
            <span
              className={`badge ${x.status === "sent" ? "warn" : x.status === "received" ? "ok" : ""}`}
            >
              {t(TRANSFER_STATUS_LABEL[x.status])}
            </span>
          </div>
          <div className="panel-b grid" style={{ gap: 8 }}>
            <p className="muted" style={{ margin: 0, fontSize: ".82rem" }}>
              {t("Sent by {who}, {when}: {value}", {
                who: x.sentBy ?? "—",
                when: when(x.sentAt),
                value: fmtIQD(x.value),
              })}
              {x.note ? ` · “${x.note}”` : ""}
            </p>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>{t("Item")}</th>
                    <th className="right">{t("Sent")}</th>
                    {x.status === "received" && <th className="right">{t("What arrived")}</th>}
                    <th className="right">{t("Value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {x.lines.map((l) => (
                    <tr key={l.id} data-testid="transfer-row">
                      <td>{l.item}</td>
                      <td className="right mono">
                        {fmtQty(l.qty)} {unitName(unitNamed(units, l.itemId, l.unitCode), t)}
                      </td>
                      {x.status === "received" && (
                        <td
                          className="right mono"
                          style={{
                            color:
                              l.qtyReceived !== null && l.qtyReceived < l.qty
                                ? "var(--warn)"
                                : undefined,
                          }}
                        >
                          {l.qtyReceived === null
                            ? "—"
                            : `${fmtQty(l.qtyReceived)} ${unitName(unitNamed(units, l.itemId, l.unitCode), t)}`}
                        </td>
                      )}
                      <td className="right mono">{fmtIQD(l.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {x.status === "received" && (
              <p className="muted" style={{ margin: 0, fontSize: ".82rem" }}>
                {t("Received by {who}, {when}", {
                  who: x.receivedBy ?? "—",
                  when: when(x.receivedAt),
                })}
                {(x.valueShort ?? 0) > 0 &&
                  ` · ${t("{short} lost on the way", { short: fmtIQD(x.valueShort ?? 0) })}`}
                {x.receiveNote ? ` · “${x.receiveNote}”` : ""}
              </p>
            )}
            {x.status === "cancelled" && (
              <p className="muted" style={{ margin: 0, fontSize: ".82rem" }}>
                {t("Cancelled by {who}, {when}: {reason}", {
                  who: x.cancelledBy ?? "—",
                  when: when(x.cancelledAt),
                  reason: say(x.cancelReason ?? ""),
                })}
              </p>
            )}
            {x.status === "sent" && canAct && (
              <OnItsWay transfer={x} units={units} onDone={onDone} />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * The transfers on their way, which those who may send stock receive or
 * cancel, then those received and cancelled; what was just done said above.
 */
export function TransferBoard({
  transfers,
  units,
  canAct,
  timezone,
}: {
  transfers: Transfer[];
  /** Each item's units by code, for their names. */
  units: UnitNames;
  canAct: boolean;
  timezone: string;
}) {
  const { t } = useT();
  const [done, setDone] = useState<Msg>(null);
  const onTheirWay = transfers.filter((x) => x.status === "sent");
  const settled = transfers.filter((x) => x.status !== "sent");
  const said = (text: string) => setDone({ ok: true, text });
  return (
    <>
      <section className="grid" style={{ gap: 10 }} data-testid="transfers-on-their-way">
        <h2 style={{ margin: 0 }}>{t("On their way")}</h2>
        <Notice msg={done} />
        {onTheirWay.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>
            {t("Nothing is on its way.")}
          </p>
        ) : (
          <TransferList
            transfers={onTheirWay}
            units={units}
            canAct={canAct}
            timezone={timezone}
            onDone={said}
          />
        )}
      </section>
      {settled.length > 0 && (
        <section className="grid" style={{ gap: 10 }} data-testid="transfers-settled">
          <h2 style={{ margin: 0 }}>{t("Received and cancelled")}</h2>
          <TransferList
            transfers={settled}
            units={units}
            canAct={false}
            timezone={timezone}
            onDone={said}
          />
        </section>
      )}
    </>
  );
}
