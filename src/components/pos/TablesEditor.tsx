"use client";

import { useState } from "react";
import type { DiningTable } from "@/lib/db/pos";
import { saveTableAction } from "@/lib/actions/pos";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

interface Draft {
  name: string;
  area: string;
  seats: string;
  sortOrder: string;
  isActive: boolean;
}

const toDraft = (t: DiningTable): Draft => ({
  name: t.name,
  area: t.area ?? "",
  seats: t.seats === null ? "" : String(t.seats),
  sortOrder: String(t.sortOrder),
  isActive: t.isActive,
});

function input(d: Draft, id: string | null) {
  const seats = d.seats.trim() === "" ? null : Number(d.seats);
  return {
    id,
    name: d.name,
    area: d.area || null,
    seats: seats !== null && Number.isFinite(seats) ? Math.trunc(seats) : null,
    sortOrder: Math.trunc(Number(d.sortOrder) || 0),
    isActive: d.isActive,
  };
}

/**
 * The café's tables, for the people who arrange the floor: add them one by
 * one or twenty at a time, rename, reorder, group by area, and take one out
 * of use (not while it has an open bill).
 */
export function TablesEditor({ tables, onClose }: { tables: DiningTable[]; onClose: () => void }) {
  const { t } = useT();
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const next = tables.reduce((m, tb) => Math.max(m, tb.sortOrder), 0) + 1;
  const [fresh, setFresh] = useState<Draft>({
    name: "",
    area: "",
    seats: "",
    sortOrder: String(next),
    isActive: true,
  });
  const [bulk, setBulk] = useState({
    count: "10",
    prefix: t("pos.tablePrefix"),
    from: String(next),
  });

  const draftOf = (tb: DiningTable) => edits[tb.id] ?? toDraft(tb);
  const edit = (tb: DiningTable, patch: Partial<Draft>) =>
    setEdits((e) => ({ ...e, [tb.id]: { ...draftOf(tb), ...patch } }));

  async function save(id: string | null, d: Draft): Promise<boolean> {
    const r = await saveTableAction(input(d, id));
    if (!r.ok) setMsg({ ok: false, text: r.error });
    return r.ok;
  }

  async function saveRow(tb: DiningTable) {
    setBusy(true);
    setMsg(null);
    if (await save(tb.id, draftOf(tb))) {
      setEdits((e) => {
        const rest = { ...e };
        delete rest[tb.id];
        return rest;
      });
      setMsg({ ok: true, text: t("pos.saved") });
    }
    setBusy(false);
  }

  async function add() {
    setBusy(true);
    setMsg(null);
    if (await save(null, fresh)) {
      setFresh({
        name: "",
        area: fresh.area,
        seats: fresh.seats,
        sortOrder: String(Number(fresh.sortOrder) + 1),
        isActive: true,
      });
      setMsg({ ok: true, text: t("pos.saved") });
    }
    setBusy(false);
  }

  async function addMany() {
    const n = Math.min(50, Math.max(1, Math.trunc(Number(bulk.count) || 0)));
    const from = Math.trunc(Number(bulk.from) || 1);
    setBusy(true);
    setMsg(null);
    let made = 0;
    for (let i = 0; i < n; i++) {
      const ok = await save(null, {
        name: `${bulk.prefix.trim()} ${from + i}`.trim(),
        area: fresh.area,
        seats: fresh.seats,
        sortOrder: String(from + i),
        isActive: true,
      });
      if (!ok) break;
      made++;
    }
    if (made === n) setMsg({ ok: true, text: `${made} ${t("pos.tablesAdded")}` });
    setBusy(false);
  }

  return (
    <div className="pos-modal-back" onClick={() => !busy && onClose()}>
      <div
        className="pos-modal wide"
        role="dialog"
        aria-modal="true"
        aria-label={t("pos.editTables")}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>{t("pos.editTables")}</h3>
        <div className="tw" style={{ maxHeight: "50vh", overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>{t("pos.tableName")}</th>
                <th>{t("pos.area")}</th>
                <th>{t("pos.seatsH")}</th>
                <th>{t("pos.order")}</th>
                <th>{t("pos.inUse")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tables.map((tb) => {
                const d = draftOf(tb);
                return (
                  <tr key={tb.id} className={d.isActive ? "" : "faint"}>
                    <td>
                      <input
                        value={d.name}
                        maxLength={40}
                        onChange={(e) => edit(tb, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={d.area}
                        maxLength={40}
                        onChange={(e) => edit(tb, { area: e.target.value })}
                      />
                    </td>
                    <td style={{ width: 70 }}>
                      <input
                        inputMode="numeric"
                        value={d.seats}
                        onChange={(e) => edit(tb, { seats: e.target.value })}
                      />
                    </td>
                    <td style={{ width: 70 }}>
                      <input
                        inputMode="numeric"
                        value={d.sortOrder}
                        onChange={(e) => edit(tb, { sortOrder: e.target.value })}
                      />
                    </td>
                    <td style={{ width: 60, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        className="check"
                        checked={d.isActive}
                        onChange={(e) => edit(tb, { isActive: e.target.checked })}
                      />
                    </td>
                    <td>
                      <button onClick={() => saveRow(tb)} disabled={busy || !edits[tb.id]}>
                        {t("pos.save")}
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <input
                    value={fresh.name}
                    maxLength={40}
                    placeholder={t("pos.newTable")}
                    onChange={(e) => setFresh({ ...fresh, name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={fresh.area}
                    maxLength={40}
                    onChange={(e) => setFresh({ ...fresh, area: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={fresh.seats}
                    onChange={(e) => setFresh({ ...fresh, seats: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={fresh.sortOrder}
                    onChange={(e) => setFresh({ ...fresh, sortOrder: e.target.value })}
                  />
                </td>
                <td />
                <td>
                  <button
                    className="btn-primary"
                    onClick={add}
                    disabled={busy || !fresh.name.trim()}
                  >
                    ＋ {t("pos.add")}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bulk-add">
          <span className="muted">{t("pos.addSeveral")}</span>
          <input
            inputMode="numeric"
            aria-label={t("pos.howMany")}
            style={{ width: 60 }}
            value={bulk.count}
            onChange={(e) => setBulk({ ...bulk, count: e.target.value })}
          />
          <span className="muted">{t("pos.namedLike")}</span>
          <input
            aria-label={t("pos.tableName")}
            style={{ width: 110 }}
            value={bulk.prefix}
            onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })}
          />
          <input
            inputMode="numeric"
            aria-label={t("pos.startingAt")}
            style={{ width: 60 }}
            value={bulk.from}
            onChange={(e) => setBulk({ ...bulk, from: e.target.value })}
          />
          <button onClick={addMany} disabled={busy}>
            {busy ? "…" : t("pos.add")}
          </button>
        </div>

        <div style={{ marginTop: 8 }}>
          <Notice msg={msg} />
        </div>
        <div className="pay-actions">
          <button onClick={onClose} disabled={busy}>
            {t("pos.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
