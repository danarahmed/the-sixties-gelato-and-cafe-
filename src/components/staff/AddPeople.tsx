"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveEmployeeAction, setClockPinAction } from "@/lib/actions/staff";
import { rowProblems, rowUsed, rowsToAdd, type PersonRow } from "@/lib/staffAdd";
import { latinDigits } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

type Msg = { ok: boolean; text: string } | null;
type Place = { id: string; name: string };
type Login = { id: string; name: string };

// A cell's box: the form's own, a little smaller, so a row fits the card's width.
const cell = { ...inputStyle, minHeight: 38, padding: "0 8px", fontSize: ".9rem" };

/**
 * Several people added to the staff at once (round eight): a row each — their
 * name, what they do, phone, where they work, since when, their login, and a
 * PIN if it is set now — another row when needed, rows left empty skipped.
 * Every row is checked first; one press adds them all, each as the one-person
 * form adds them, with its own key, and sets its PIN. Those added leave the
 * form; a row not added stays, saying why.
 */
export function AddPeople({
  places,
  logins,
  today,
  onDone,
  onCancel,
}: {
  places: Place[];
  logins: Login[];
  today: string;
  /** Everyone added: how many, and any PIN not set, to say once the form is closed. */
  onDone: (added: number, pinsNotSet: string[]) => void;
  onCancel: () => void;
}) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const op = useOperation();
  const blank = (): PersonRow => ({
    key: crypto.randomUUID(),
    name: "",
    title: "",
    phone: "",
    placeId: places[0]?.id ?? "",
    hiredOn: today,
    loginId: "",
    pin: "",
  });
  const [rows, setRows] = useState<PersonRow[]>(() => [blank(), blank(), blank()]);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<{ done: number; of: number } | null>(null);
  const [result, setResult] = useState<Msg>(null);

  const ready = rowsToAdd(rows);
  const used = rows.filter(rowUsed);
  const busy = adding !== null;

  const set = (key: string, field: keyof PersonRow, value: string) => {
    setRows(rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    if (failed[key]) setFailed({ ...failed, [key]: "" });
    setResult(null);
  };

  async function add() {
    setResult(null);
    const going = ready;
    setAdding({ done: 0, of: going.length });
    const added = new Set<string>();
    const errors: Record<string, string> = {};
    const pinsNotSet: string[] = [];
    for (const [i, r] of going.entries()) {
      const input = {
        employeeId: null,
        name: r.name,
        phone: r.phone,
        title: r.title,
        locationId: r.placeId,
        hiredOn: r.hiredOn,
        appUserId: r.loginId || null,
      };
      // Each person is their own submission: unanswered, it is sent again with its key.
      const saved = await op.run(`add-person:${r.key}`, (key) => saveEmployeeAction(input, key));
      if (!saved.ok) {
        errors[r.key] = say(saved.error);
      } else {
        added.add(r.key);
        if (r.pin.trim() !== "") {
          const pin = await setClockPinAction({
            employeeId: saved.data.employeeId,
            pin: r.pin.trim(),
          });
          // Added all the same: the PIN is set later on their row, and this says so.
          if (!pin.ok)
            pinsNotSet.push(
              t("{name} is added, but the PIN was not set: {why}", {
                name: r.name.trim(),
                why: say(pin.error),
              }),
            );
        }
      }
      setAdding({ done: i + 1, of: going.length });
    }
    setAdding(null);
    router.refresh();
    if (added.size === going.length) {
      onDone(added.size, pinsNotSet);
      return;
    }
    // Those added leave the form; a row not added stays, saying why.
    const left = rows.filter((r) => !added.has(r.key));
    setRows(left.length > 0 ? left : [blank()]);
    setFailed(errors);
    setResult({
      ok: false,
      text: [t("{n} added to the staff.", { n: added.size }), ...pinsNotSet].join(" "),
    });
  }

  return (
    <div className="grid add-people" style={{ gap: 10 }} data-testid="person-form">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "A row for each person. A PIN can be set now, or later on their row: let each person type their own. Rows left empty are not added.",
        )}
      </p>
      <div className="tw">
        <table className="stack-table add-people-table">
          <thead>
            <tr>
              <th>{t("Name")}</th>
              <th>{t("What they do")}</th>
              <th>{t("Phone")}</th>
              <th>{t("Where they work")}</th>
              <th>{t("Started on")}</th>
              <th>{t("Their login, if they have one")}</th>
              <th>{t("PIN (optional)")}</th>
              <th>
                <span className="sr-only">{t("Remove this row")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const problems = rowProblems(r, rows);
              const why = failed[r.key] || problems.map((p) => t(p)).join(" · ");
              return (
                <tr
                  key={r.key}
                  data-testid="add-person-row"
                  className={why ? "add-row-off" : undefined}
                >
                  <td data-label={t("Name")}>
                    <input
                      style={cell}
                      value={r.name}
                      maxLength={80}
                      aria-label={t("Name")}
                      onChange={(e) => set(r.key, "name", e.target.value)}
                      disabled={busy}
                    />
                    {why && (
                      <span className="add-row-why" role="alert">
                        <Icon name="alert" size={13} /> {why}
                      </span>
                    )}
                  </td>
                  <td data-label={t("What they do")}>
                    <input
                      style={cell}
                      value={r.title}
                      maxLength={60}
                      placeholder={t("e.g. Barista")}
                      aria-label={t("What they do")}
                      onChange={(e) => set(r.key, "title", e.target.value)}
                      disabled={busy}
                    />
                  </td>
                  <td data-label={t("Phone")}>
                    <input
                      style={cell}
                      value={r.phone}
                      dir="ltr"
                      inputMode="tel"
                      maxLength={40}
                      aria-label={t("Phone")}
                      onChange={(e) => set(r.key, "phone", e.target.value)}
                      disabled={busy}
                    />
                  </td>
                  <td data-label={t("Where they work")}>
                    <select
                      style={cell}
                      value={r.placeId}
                      aria-label={t("Where they work")}
                      onChange={(e) => set(r.key, "placeId", e.target.value)}
                      disabled={busy}
                    >
                      {places.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label={t("Started on")}>
                    <input
                      type="date"
                      style={cell}
                      value={r.hiredOn}
                      aria-label={t("Started on")}
                      onChange={(e) => set(r.key, "hiredOn", e.target.value)}
                      disabled={busy}
                    />
                  </td>
                  <td data-label={t("Their login, if they have one")}>
                    <select
                      style={cell}
                      value={r.loginId}
                      aria-label={t("Their login, if they have one")}
                      onChange={(e) => set(r.key, "loginId", e.target.value)}
                      disabled={busy}
                    >
                      <option value="">{t("No login")}</option>
                      {logins.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label={t("PIN (optional)")}>
                    <input
                      style={{ ...cell, maxWidth: 120 }}
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={8}
                      value={r.pin}
                      aria-label={t("PIN (optional)")}
                      onChange={(e) =>
                        set(r.key, "pin", latinDigits(e.target.value).replace(/[^0-9]/g, ""))
                      }
                      disabled={busy}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-only add-row-remove"
                      aria-label={t("Remove this row")}
                      title={t("Remove this row")}
                      onClick={() =>
                        setRows(rows.length > 1 ? rows.filter((x) => x.key !== r.key) : [blank()])
                      }
                      disabled={busy}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="add-people-acts">
        <button
          type="button"
          onClick={() => setRows([...rows, blank()])}
          disabled={busy}
          data-testid="add-person-another"
        >
          <Icon name="plus" size={16} /> {t("Another row")}
        </button>
        <span className="sp" />
        <button type="button" onClick={onCancel} disabled={busy}>
          {t("Cancel")}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={add}
          disabled={busy || ready.length === 0 || ready.length !== used.length}
          data-testid="add-people-save"
        >
          {busy
            ? t("Adding {done} of {of}…", {
                done: Math.min(adding.done + 1, adding.of),
                of: adding.of,
              })
            : ready.length === 0
              ? t("Add to the staff")
              : t("Add {n} to the staff", { n: ready.length })}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={result} />
    </div>
  );
}
