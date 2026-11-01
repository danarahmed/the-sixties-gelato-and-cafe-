"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { addPlaceAction, renamePlaceAction, setPlaceActiveAction } from "@/lib/actions/details";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import type { PlaceRow } from "@/lib/db/details";

const KIND_LABEL: Record<string, string> = {
  branch: "Branch",
  central_kitchen: "Central kitchen",
  warehouse: "Warehouse",
};

type Names = { name: string; nameAr: string; nameCkb: string };
const NO_NAMES: Names = { name: "", nameAr: "", nameCkb: "" };

/** A place's names in English, Arabic and Kurdish. */
function NameFields({
  names,
  onChange,
  disabled,
}: {
  names: Names;
  onChange: (n: Names) => void;
  disabled: boolean;
}) {
  const { t } = useT();
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <input
        style={{ ...inputStyle, minWidth: 160 }}
        placeholder={t("Name")}
        aria-label={t("Name")}
        value={names.name}
        maxLength={60}
        onChange={(e) => onChange({ ...names, name: e.target.value })}
        disabled={disabled}
        data-testid="place-name"
      />
      <input
        style={{ ...inputStyle, minWidth: 140 }}
        dir="rtl"
        placeholder={t("Name in Arabic")}
        aria-label={t("Name in Arabic")}
        value={names.nameAr}
        maxLength={60}
        onChange={(e) => onChange({ ...names, nameAr: e.target.value })}
        disabled={disabled}
        data-testid="place-name-ar"
      />
      <input
        style={{ ...inputStyle, minWidth: 140 }}
        dir="rtl"
        placeholder={t("Name in Kurdish")}
        aria-label={t("Name in Kurdish")}
        value={names.nameCkb}
        maxLength={60}
        onChange={(e) => onChange({ ...names, nameCkb: e.target.value })}
        disabled={disabled}
        data-testid="place-name-ckb"
      />
    </div>
  );
}

/**
 * The café's places (0095), on Settings: a branch, central kitchen or store
 * added here has its till drawer at once and is counted by every screen,
 * report and the books by place as the others are. A place is renamed in
 * the three languages, closed with a reason once nothing is left open in it,
 * and opened again.
 */
export function PlacesManager({
  places,
  extra,
}: {
  places: PlaceRow[];
  /** What else each place's row shows (the parts of the menu a branch sells). */
  extra?: Record<string, ReactNode>;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [kind, setKind] = useState("branch");
  const [names, setNames] = useState<Names>(NO_NAMES);
  const [renaming, setRenaming] = useState<{ id: string; names: Names } | null>(null);
  const [closing, setClosing] = useState<{ id: string; reason: string } | null>(null);

  function done(text: string) {
    setMsg({ ok: true, text });
    setRenaming(null);
    setClosing(null);
    router.refresh();
  }

  function add() {
    setMsg(null);
    start(async () => {
      const r = await op.run("addPlace", (key) => addPlaceAction({ kind, ...names }, key));
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setNames(NO_NAMES);
      done(
        t("{name} added: it has its till drawer, and every screen and report counts it.", {
          name: names.name.trim(),
        }),
      );
    });
  }

  function rename() {
    if (!renaming) return;
    setMsg(null);
    start(async () => {
      const r = await renamePlaceAction({ place: renaming.id, ...renaming.names });
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      done(t("Renamed."));
    });
  }

  function setActive(p: PlaceRow, active: boolean, reason?: string) {
    setMsg(null);
    start(async () => {
      const r = await setPlaceActiveAction({ place: p.id, active, reason: reason ?? null });
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      done(
        active
          ? t("{name} is open again.", { name: p.name })
          : t("{name} is closed.", { name: p.name }),
      );
    });
  }

  return (
    <div className="grid" style={{ gap: 12 }} data-testid="places-manager">
      <Notice msg={msg} />
      <OperationStatus op={op} />
      <div className="tw">
        <table className="stack-table">
          <tbody>
            {places.map((p) => (
              <tr
                key={p.id}
                data-testid="place-row"
                data-place={p.name}
                className={p.isActive ? "" : "muted"}
              >
                <td>
                  {renaming?.id === p.id ? (
                    <NameFields
                      names={renaming.names}
                      onChange={(n) => setRenaming({ id: p.id, names: n })}
                      disabled={busy}
                    />
                  ) : (
                    <>
                      <strong>{p.name}</strong>
                      {(p.nameAr || p.nameCkb) && (
                        <div className="muted" style={{ fontSize: ".8rem" }} dir="rtl">
                          {[p.nameAr, p.nameCkb].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="muted">{t(KIND_LABEL[p.kind] ?? p.kind)}</td>
                <td>
                  <span className={p.isActive ? "badge ok" : "badge"}>
                    {p.isActive ? t("open") : t("closed")}
                  </span>
                </td>
                {extra && <td>{p.isActive ? extra[p.id] : null}</td>}
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {renaming?.id === p.id ? (
                      <>
                        <button
                          type="button"
                          onClick={rename}
                          disabled={busy}
                          data-testid="place-rename-save"
                        >
                          {t("Save")}
                        </button>
                        <button
                          type="button"
                          className="linklike"
                          onClick={() => setRenaming(null)}
                        >
                          {t("Cancel")}
                        </button>
                      </>
                    ) : closing?.id === p.id ? (
                      <>
                        <input
                          style={{ ...inputStyle, minWidth: 180 }}
                          placeholder={t("Why it closes")}
                          aria-label={t("Why it closes")}
                          value={closing.reason}
                          onChange={(e) => setClosing({ id: p.id, reason: e.target.value })}
                          disabled={busy}
                          data-testid="place-close-reason"
                        />
                        <button
                          type="button"
                          className="btn-soft"
                          onClick={() => setActive(p, false, closing.reason)}
                          disabled={busy}
                          data-testid="place-close-confirm"
                        >
                          {t("Close it")}
                        </button>
                        <button type="button" className="linklike" onClick={() => setClosing(null)}>
                          {t("Cancel")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="linklike"
                          onClick={() =>
                            setRenaming({
                              id: p.id,
                              names: {
                                name: p.name,
                                nameAr: p.nameAr ?? "",
                                nameCkb: p.nameCkb ?? "",
                              },
                            })
                          }
                          disabled={busy}
                          data-testid="place-rename"
                        >
                          {t("Rename")}
                        </button>
                        {p.isActive ? (
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => setClosing({ id: p.id, reason: "" })}
                            disabled={busy}
                            data-testid="place-close"
                          >
                            {t("Close")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => setActive(p, true)}
                            disabled={busy}
                            data-testid="place-open"
                          >
                            {t("Open again")}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="grid"
        style={{ gap: 8 }}
        data-testid="place-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <strong>{t("Add a place")}</strong>
        <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <select
            style={inputStyle}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={busy}
            aria-label={t("Kind of place")}
            data-testid="place-kind"
          >
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {t(label)}
              </option>
            ))}
          </select>
          <NameFields names={names} onChange={setNames} disabled={busy} />
          <button
            type="submit"
            disabled={busy || names.name.trim().length < 2}
            data-testid="place-add-save"
          >
            {t("Add")}
          </button>
        </div>
        <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
          {t(
            "A new branch sells the whole menu at the menu's prices, and has no stock until some is sent or received there. Give people their place on People.",
          )}
        </p>
      </form>
    </div>
  );
}
