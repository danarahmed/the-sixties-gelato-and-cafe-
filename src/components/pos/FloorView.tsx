"use client";

import type { DiningTable, OpenBill } from "@/lib/db/pos";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { useChannels } from "@/components/ChannelsProvider";
import { minutesSince } from "./model";

function Elapsed({ at, now }: { at: string | null; now: number }) {
  const { t } = useT();
  const m = minutesSince(at, now);
  if (m === null) return null;
  const text =
    m < 60
      ? `${m} ${t("pos.min")}`
      : `${Math.floor(m / 60)} ${t("pos.hr")} ${m % 60} ${t("pos.min")}`;
  return <span className="muted">{text}</span>;
}

/** Printed and handed over: the customer has the bill, the till waits for the money. */
function BillState({ printed }: { printed: boolean }) {
  const { t } = useT();
  return printed ? (
    <span className="badge warn">🧾 {t("pos.waitingPayment")}</span>
  ) : (
    <span className="badge">{t("pos.ordering")}</span>
  );
}

/**
 * The floor: every table, free or taken, and what each owes; then the bills
 * kept for a customer by name. A table shows how long it has been open and
 * whether its bill has gone to the customer and the money is still to come.
 */
export function FloorView({
  tables,
  bills,
  now,
  activeTabId,
  onTable,
  onBill,
  onNamedBill,
  onEditTables,
}: {
  tables: DiningTable[];
  bills: OpenBill[];
  now: number;
  activeTabId: string | null;
  onTable: (t: DiningTable) => void;
  onBill: (b: OpenBill) => void;
  onNamedBill: () => void;
  onEditTables: (() => void) | null;
}) {
  const { t } = useT();
  const { name: channelName } = useChannels();
  const areas = new Map<string, DiningTable[]>();
  for (const tb of tables) {
    const a = tb.area ?? "";
    areas.set(a, [...(areas.get(a) ?? []), tb]);
  }
  const named = bills.filter((b) => !b.tableId);
  const waiting = bills.filter((b) => b.billPrintedAt).length;

  return (
    <div className="floor">
      <div className="floor-summary">
        <span>
          <strong>{bills.length}</strong> {t("pos.openBills")}
        </span>
        {waiting > 0 && (
          <span className="badge warn">
            🧾 {waiting} {t("pos.waitingPayment")}
          </span>
        )}
        <span className="spacer" />
        <button onClick={onNamedBill}>＋ {t("pos.billForName")}</button>
        {onEditTables && <button onClick={onEditTables}>{t("pos.editTables")}</button>}
      </div>

      {tables.length === 0 ? (
        <div className="card muted" style={{ fontSize: ".9rem" }}>
          {onEditTables ? t("pos.noTablesManager") : t("pos.noTables")}
        </div>
      ) : (
        [...areas.entries()].map(([area, list]) => (
          <section key={area || "-"}>
            {areas.size > 1 && (
              <h4 className="sc" style={{ margin: "10px 0 6px" }}>
                {area || t("pos.tables")}
              </h4>
            )}
            <div className="table-grid">
              {list.map((tb) => {
                const own = bills.filter((b) => b.tableId === tb.id);
                const total = own.reduce((s, b) => s + b.total, 0);
                const printed = own.some((b) => b.billPrintedAt);
                const first = own.reduce<string | null>(
                  (a, b) => (a === null || b.openedAt < a ? b.openedAt : a),
                  null,
                );
                const active = own.some((b) => b.tabId === activeTabId);
                return (
                  <button
                    key={tb.id}
                    className={`table-tile${own.length ? (printed ? " waiting" : " busy") : ""}${active ? " active" : ""}`}
                    onClick={() => onTable(tb)}
                  >
                    <span className="table-name">{tb.name}</span>
                    {own.length === 0 ? (
                      <span className="muted">
                        {t("pos.free")}
                        {tb.seats ? ` · ${tb.seats} ${t("pos.seats")}` : ""}
                      </span>
                    ) : (
                      <>
                        <span className="mono">{fmtIQD(total)}</span>
                        <span className="table-meta">
                          <Elapsed at={first} now={now} />
                          {own.length > 1 && (
                            <span className="muted">
                              {" · "}
                              {own.length} {t("pos.bills")}
                            </span>
                          )}
                        </span>
                        {printed && <span className="table-flag">🧾</span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {named.length > 0 && (
        <section>
          <h4 className="sc" style={{ margin: "16px 0 6px" }}>
            {t("pos.namedBills")}
          </h4>
          <div className="bill-list">
            {named.map((b) => (
              <button
                key={b.tabId}
                className={`bill-row${b.tabId === activeTabId ? " active" : ""}`}
                onClick={() => onBill(b)}
              >
                <strong>{b.label}</strong>
                <span className="muted">{channelName(b.channel)}</span>
                <BillState printed={!!b.billPrintedAt} />
                <Elapsed at={b.openedAt} now={now} />
                <span className="mono" style={{ marginInlineStart: "auto" }}>
                  {fmtIQD(b.total)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** A table with more than one bill (it was split): which one? */
export function ChooseBill({
  title,
  bills,
  onBill,
  onNew,
  onClose,
}: {
  title: string;
  bills: OpenBill[];
  onBill: (b: OpenBill) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="pos-modal-back" onClick={onClose}>
      <div
        className="pos-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div className="bill-list">
          {bills.map((b) => (
            <button key={b.tabId} className="bill-row" onClick={() => onBill(b)}>
              <strong>{b.label ?? title}</strong>
              <BillState printed={!!b.billPrintedAt} />
              <span className="mono" style={{ marginInlineStart: "auto" }}>
                {fmtIQD(b.total)}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onNew}>＋ {t("pos.anotherBill")}</button>
          <button onClick={onClose}>{t("pos.close")}</button>
        </div>
      </div>
    </div>
  );
}
