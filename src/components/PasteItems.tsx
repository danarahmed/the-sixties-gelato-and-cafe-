"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createItemAction } from "@/lib/actions/stock";
import { isReady, itemInputOf, readPaste, type ItemType, type PastedRow } from "@/lib/itemPaste";
import type { NamedItem } from "@/lib/names";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";
import { fmtIQD, fmtQty, itemTypeLabel, unitName } from "@/lib/format";

const TYPES: readonly ItemType[] = [
  "ingredient",
  "packaging",
  "consumable",
  "finished_good",
  "resale",
];

/** Rows as a spreadsheet copies them: the first column is the item's English name. */
const SAMPLE = ["Milk\tL\t10\t24\t1250", "Sugar\tkg\t5\t50\t1000", "Cups\teach\t100\t500\t75"].join(
  "\n",
);

/** The columns, in the order a row gives them; the first two are needed. */
const COLUMNS = [
  "Name",
  "Unit",
  "Reorder at",
  "On the shelf",
  "Cost each",
  "Arabic name",
  "Kurdish name",
] as const;

type Msg = { ok: boolean; text: string } | null;

/**
 * Paste stock items in (round seven): a list copied from Excel or Google
 * Sheets, read row by row and shown as it will be added — each row checked
 * (its unit, its numbers, a name in use or in the list twice, a look-alike to
 * say is another item) — then every row ready added in one press, each as the
 * one-item form adds it, with its own key: pressed again, nothing is added
 * twice. What is added leaves the box; what is not stays, with what to put
 * right.
 */
export function PasteItems({ items, isOwner }: { items: NamedItem[]; isOwner: boolean }) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const op = useOperation();
  const [text, setText] = useState("");
  const [itemType, setItemType] = useState<ItemType>("ingredient");
  // A row's own type, and a look-alike said to be another item: by the line as pasted.
  const [types, setTypes] = useState<Record<string, ItemType>>({});
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState(() => t("The opening count"));
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<{ done: number; of: number } | null>(null);
  const [result, setResult] = useState<Msg>(null);

  const rows = useMemo(() => readPaste(text, items), [text, items]);
  const ready = rows.filter((r) => isReady(r, !!accepted[r.text]));
  const toFix = rows.length - ready.length;
  const shelved = rows.some((r) => r.shelf !== null && r.shelf > 0);
  const busy = adding !== null;

  async function add() {
    setResult(null);
    const going = ready;
    if (going.length === 0) return;
    if (isOwner && shelved && !reason.trim()) {
      setResult({ ok: false, text: t("Say where the stock on the shelf came from") });
      return;
    }
    setAdding({ done: 0, of: going.length });
    const added = new Set<string>();
    const errors: Record<string, string> = {};
    for (const [i, row] of going.entries()) {
      const input = itemInputOf(row, {
        itemType: types[row.text] ?? itemType,
        isOwner,
        reason,
        acceptSimilar: row.similar.length > 0 && !!accepted[row.text],
      });
      // Each row is its own submission: unanswered, it is sent again with its key.
      const r = await op.run(`paste-item:${JSON.stringify(input)}`, (key) =>
        createItemAction(input, key),
      );
      if (r.ok) added.add(row.text);
      else if ("similar" in r)
        errors[row.text] = t("Its name looks like “{name}”, already on the list.", {
          name: r.similar[0]?.name ?? "",
        });
      else errors[row.text] = say(r.error);
      setAdding({ done: i + 1, of: going.length });
    }
    setAdding(null);
    setFailed(errors);
    // What was added leaves the box; what was not stays, to put right.
    setText(
      text
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "" && !added.has(line))
        .join("\n"),
    );
    // Every row left in the box: those held back, and any the database refused.
    const notAdded = rows.length - added.size;
    setResult(
      notAdded === 0
        ? { ok: true, text: t("{n} item(s) added.", { n: added.size }) }
        : {
            ok: false,
            text: `${t("{n} item(s) added.", { n: added.size })} ${t(
              "{n} row(s) not added: each stays in the box, with what to put right.",
              { n: notAdded },
            )}`,
          },
    );
    if (added.size > 0) router.refresh();
  }

  const check = (row: PastedRow) => {
    if (failed[row.text])
      return (
        <span className="paste-bad">
          <Icon name="alert" size={14} /> {failed[row.text]}
        </span>
      );
    if (row.problems.length > 0)
      return (
        <span className="paste-bad">
          <Icon name="alert" size={14} /> {row.problems.map((p) => t(p.key, p.vars)).join(" · ")}
        </span>
      );
    if (row.similar.length > 0)
      return (
        <span className="paste-warn">
          {t("Its name looks like “{name}”.", { name: row.similar[0]!.name })}{" "}
          <label className="paste-other">
            <input
              type="checkbox"
              className="check"
              checked={!!accepted[row.text]}
              onChange={(e) => setAccepted({ ...accepted, [row.text]: e.target.checked })}
              disabled={busy}
              data-testid="paste-other"
            />
            {t("It is a different item: add it")}
          </label>
        </span>
      );
    return (
      <span className="paste-ok">
        <Icon name="ok" size={14} /> {t("Ready")}
      </span>
    );
  };

  return (
    <div className="grid paste-items" style={{ gap: 10 }} data-testid="paste-items">
      <p className="muted" style={{ margin: 0, fontSize: ".86rem" }}>
        {t(
          "Copy the rows from Excel or Google Sheets and paste them here, one item a line. Every row is checked before anything is added.",
        )}
      </p>
      <ol className="paste-cols" aria-label={t("The columns, in this order")}>
        {COLUMNS.map((c, i) => (
          <li key={c} className={i < 2 ? "needed" : undefined}>
            {t(c)}
          </li>
        ))}
      </ol>
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "Only the name and the unit are needed. The unit is g, kg, ml, L or each, and the numbers are in it: 24 on the shelf of milk in L is 24 litres, at what one litre cost.",
        )}
      </p>
      <textarea
        style={{ ...inputStyle, minHeight: 130, fontFamily: "var(--mono, monospace)" }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFailed({});
          setResult(null);
        }}
        placeholder={SAMPLE}
        aria-label={t("The list to add")}
        spellCheck={false}
        disabled={busy}
        data-testid="paste-box"
      />

      {rows.length > 0 && (
        <>
          <div className="paste-opts">
            <Field label={t("Type for all the rows")}>
              <select
                style={inputStyle}
                value={itemType}
                onChange={(e) => setItemType(e.target.value as ItemType)}
                disabled={busy}
                data-testid="paste-type"
              >
                {TYPES.map((o) => (
                  <option key={o} value={o}>
                    {t(itemTypeLabel(o))}
                  </option>
                ))}
              </select>
            </Field>
            {shelved && isOwner && (
              <Field label={t("Where the stock on the shelf came from")}>
                <input
                  style={inputStyle}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  disabled={busy}
                  data-testid="paste-reason"
                />
              </Field>
            )}
          </div>
          {shelved && !isOwner && (
            <p
              className="muted"
              style={{ margin: 0, fontSize: ".82rem" }}
              data-testid="paste-not-owner"
            >
              {t(
                "What is on the shelf is the owner's to record: the items are added without it, and the owner gives each its opening stock.",
              )}
            </p>
          )}
          {shelved && isOwner && (
            <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
              {t("Opening stock is journaled: Dr 1200 Inventory / Cr 3000 Owner equity.")}
            </p>
          )}

          <div className="tw">
            <table className="stack-table paste-table" data-testid="paste-rows">
              <thead>
                <tr>
                  <th>{t("Line")}</th>
                  <th>{t("Name")}</th>
                  <th>{t("Unit")}</th>
                  <th className="right">{t("Reorder at")}</th>
                  <th className="right">{t("On the shelf")}</th>
                  <th className="right">{t("Cost each")}</th>
                  <th>{t("Type")}</th>
                  <th>{t("Check")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const unit = row.unit ? unitName(row.unit.code, t) : row.unitTyped || "—";
                  const ok = isReady(row, !!accepted[row.text]) && !failed[row.text];
                  return (
                    <tr
                      key={`${row.line}:${row.text}`}
                      className={
                        ok
                          ? undefined
                          : row.problems.length > 0 || failed[row.text]
                            ? "paste-row-off"
                            : "paste-row-ask"
                      }
                      data-testid="paste-row"
                      data-ready={ok ? "yes" : "no"}
                    >
                      <td className="muted mono" data-label={t("Line")}>
                        {row.line}
                      </td>
                      <td data-label={t("Name")}>
                        <strong>{row.name || "—"}</strong>
                        {(row.nameAr || row.nameCkb) && (
                          <span className="cell-sub" dir="rtl">
                            {[row.nameAr, row.nameCkb].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </td>
                      <td data-label={t("Unit")}>{unit}</td>
                      <td className="right mono" data-label={t("Reorder at")}>
                        {row.reorder === null ? "—" : fmtQty(row.reorder)}
                      </td>
                      <td className="right mono" data-label={t("On the shelf")}>
                        {row.shelf === null || !isOwner ? "—" : fmtQty(row.shelf)}
                      </td>
                      <td className="right mono" data-label={t("Cost each")}>
                        {row.cost === null || !isOwner ? "—" : fmtIQD(row.cost)}
                      </td>
                      <td data-label={t("Type")}>
                        <select
                          style={{ ...inputStyle, minHeight: 32, padding: "2px 6px" }}
                          value={types[row.text] ?? itemType}
                          onChange={(e) =>
                            setTypes({ ...types, [row.text]: e.target.value as ItemType })
                          }
                          aria-label={t("Type")}
                          disabled={busy}
                        >
                          {TYPES.map((o) => (
                            <option key={o} value={o}>
                              {t(itemTypeLabel(o))}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-label={t("Check")}>{check(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="paste-acts">
            <button
              type="button"
              className="btn-primary"
              onClick={add}
              disabled={busy || ready.length === 0}
              data-testid="paste-add"
            >
              <Icon name="plus" size={16} />{" "}
              {busy
                ? t("Adding {done} of {of}…", {
                    done: Math.min(adding.done + 1, adding.of),
                    of: adding.of,
                  })
                : t("Add {n} item(s)", { n: ready.length })}
            </button>
            {toFix > 0 && !busy && (
              <span className="muted" style={{ fontSize: ".85rem" }} data-testid="paste-to-fix">
                {t("{n} row(s) to put right first", { n: toFix })}
              </span>
            )}
            <OperationStatus op={op} />
          </div>
        </>
      )}
      <Notice msg={result} />
    </div>
  );
}
