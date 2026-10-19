"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addEquipmentAction,
  depreciateAction,
  disposeEquipmentAction,
} from "@/lib/actions/equipment";
import { bookValueOf, type AssetBoard } from "@/lib/equipment";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import type { ActionResult } from "@/lib/db/rpc";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

const PAID = ["bank", "safe", "owner", "supplier", ""] as const;
const PAID_LABEL: Record<(typeof PAID)[number], string> = {
  bank: "From the bank",
  safe: "From the safe",
  owner: "With the owner's own money",
  supplier: "On a supplier's bill",
  "": "Bought before: in the books already",
};

/**
 * The equipment (0081): what each piece cost and is worth now; its monthly
 * share of the cost posted for the months gone with one press; a piece added,
 * or sold and thrown out.
 */
export function EquipmentCard({
  board,
  canPost,
  today,
  loans,
}: {
  board: AssetBoard;
  canPost: boolean;
  today: string;
  loans: { code: string; name: string }[];
}) {
  const { t, msg } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cost: "",
    salvage: "0",
    life: "60",
    start: today,
    paid: "bank",
  });
  const [gone, setGone] = useState<{
    id: string;
    on: string;
    fetched: string;
    into: "bank" | "safe";
  } | null>(null);

  function run<T>(label: string, fn: (key: string) => Promise<ActionResult<T>>) {
    setError(null);
    start(async () => {
      const r = await op.run(label, fn);
      if (!r.ok) setError(r.error);
      else {
        setAdding(false);
        setGone(null);
        router.refresh();
      }
    });
  }
  const num = (v: string) => Number(v.replace(/,/g, ""));

  return (
    <section className="panel" data-testid="equipment">
      <div className="panel-h">
        <h3>
          <Icon name="box" /> {t("Equipment")}
        </h3>
        <span className="muted" style={{ fontSize: ".8rem" }}>
          {t("Worth in the books: {amount}", { amount: fmtIQD(bookValueOf(board.assets)) })}
        </span>
      </div>
      <div className="grid" style={{ gap: 10, padding: 12 }}>
        {board.pendingMonths > 0 && canPost && (
          <div
            className="card"
            style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
          >
            <span>{t("Depreciation waits for {n} months gone.", { n: board.pendingMonths })}</span>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => run("depreciate", (key) => depreciateAction(key))}
              data-testid="equipment-depreciate"
            >
              {t("Post it")}
            </button>
          </div>
        )}
        {board.assets.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t(
              "No equipment yet. Add the oven, the machines and the fridges: each month's share of what they cost is then a cost of that month.",
            )}
          </p>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Equipment")}</th>
                  <th className="right">{t("Cost")}</th>
                  <th className="right">{t("A month")}</th>
                  <th className="right">{t("Depreciated")}</th>
                  <th className="right">{t("Worth now")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {board.assets.map((a) => (
                  <tr
                    key={a.id}
                    data-testid="equipment-row"
                    className={a.disposedOn ? "faint" : undefined}
                  >
                    <td>
                      {a.name}
                      <div className="muted" style={{ fontSize: ".78rem" }}>
                        {a.disposedOn
                          ? t("Gone on {date}", { date: a.disposedOn })
                          : t("Bought {date} · {months} months", {
                              date: a.startOn,
                              months: a.lifeMonths,
                            })}
                      </div>
                    </td>
                    <td className="right mono">{fmtIQD(a.cost)}</td>
                    <td className="right mono">{fmtIQD(a.eachMonth)}</td>
                    <td className="right mono">{fmtIQD(a.depreciated)}</td>
                    <td className="right mono">{a.disposedOn ? "—" : fmtIQD(a.bookValue)}</td>
                    <td>
                      {canPost && !a.disposedOn && (
                        <button
                          type="button"
                          className="linklike"
                          onClick={() =>
                            setGone({ id: a.id, on: today, fetched: "0", into: "bank" })
                          }
                        >
                          {t("Sold or thrown out")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {gone && (
          <div className="card grid account-form" style={{ gap: 8 }}>
            <label>
              <span>{t("When")}</span>
              <input
                type="date"
                value={gone.on}
                max={today}
                onChange={(e) => setGone({ ...gone, on: e.target.value })}
              />
            </label>
            <label>
              <span>{t("What it fetched (0 when thrown out)")}</span>
              <input
                inputMode="numeric"
                value={gone.fetched}
                onChange={(e) => setGone({ ...gone, fetched: e.target.value })}
              />
            </label>
            {num(gone.fetched) > 0 && (
              <div className="seg" role="radiogroup" aria-label={t("Where did the money go?")}>
                {(["bank", "safe"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={gone.into === w}
                    className={gone.into === w ? "active" : ""}
                    onClick={() => setGone({ ...gone, into: w })}
                  >
                    {t(w === "bank" ? "The bank" : "The safe")}
                  </button>
                ))}
              </div>
            )}
            <div>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  run(`dispose:${gone.id}`, (key) =>
                    disposeEquipmentAction(
                      {
                        assetId: gone.id,
                        on: gone.on,
                        fetched: num(gone.fetched),
                        into: num(gone.fetched) > 0 ? gone.into : null,
                      },
                      key,
                    ),
                  )
                }
              >
                {t("Save")}
              </button>
            </div>
          </div>
        )}
        {canPost && !adding && (
          <div>
            <button type="button" onClick={() => setAdding(true)} data-testid="equipment-add">
              ＋ {t("Add equipment")}
            </button>
          </div>
        )}
        {adding && (
          <div className="card grid account-form" style={{ gap: 8 }} data-testid="equipment-form">
            <label>
              <span>{t("What is it?")}</span>
              <input
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="equipment-name"
              />
            </label>
            <label>
              <span>{t("What it cost")}</span>
              <input
                inputMode="numeric"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                data-testid="equipment-cost"
              />
            </label>
            <label>
              <span>{t("Months it will be used")}</span>
              <input
                inputMode="numeric"
                value={form.life}
                onChange={(e) => setForm({ ...form, life: e.target.value })}
                data-testid="equipment-life"
              />
            </label>
            <label>
              <span>{t("Worth at the end (0 if nothing)")}</span>
              <input
                inputMode="numeric"
                value={form.salvage}
                onChange={(e) => setForm({ ...form, salvage: e.target.value })}
              />
            </label>
            <label>
              <span>{t("Bought on")}</span>
              <input
                type="date"
                value={form.start}
                max={today}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </label>
            <label>
              <span>{t("How was it paid?")}</span>
              <select
                value={form.paid}
                onChange={(e) => setForm({ ...form, paid: e.target.value })}
                data-testid="equipment-paid"
              >
                {PAID.map((p) => (
                  <option key={p} value={p}>
                    {t(PAID_LABEL[p])}
                  </option>
                ))}
                {loans.map((l) => (
                  <option key={l.code} value={l.code}>
                    {t("With the loan {name}", { name: `${l.code} ${l.name}` })}
                  </option>
                ))}
              </select>
            </label>
            {num(form.cost) > 0 && num(form.life) > 0 && (
              <p className="muted" style={{ margin: 0 }}>
                {t("{amount} a month for {months} months", {
                  amount: fmtIQD(
                    Math.round((num(form.cost) - num(form.salvage || "0")) / num(form.life)),
                  ),
                  months: num(form.life),
                })}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !form.name.trim() || !(num(form.cost) > 0)}
                onClick={() =>
                  run(`asset:${form.name}:${form.cost}`, (key) =>
                    addEquipmentAction(
                      {
                        name: form.name,
                        cost: num(form.cost),
                        salvage: num(form.salvage || "0"),
                        lifeMonths: num(form.life),
                        startOn: form.start,
                        paidFrom: form.paid || null,
                      },
                      key,
                    ),
                  )
                }
                data-testid="equipment-save"
              >
                {t("Add it")}
              </button>
              <button type="button" onClick={() => setAdding(false)}>
                {t("Cancel")}
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="red" role="alert" style={{ margin: 0 }}>
            {msg(error)}
          </p>
        )}
        <OperationStatus op={op} />
      </div>
    </section>
  );
}
