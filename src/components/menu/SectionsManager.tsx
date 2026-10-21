"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSectionAction, setCategorySectionAction } from "@/lib/actions/menu";
import { setSectionHoursAction } from "@/lib/actions/deals";
import type { MenuCategory } from "@/lib/db/menu";
import type { MenuSection } from "@/lib/db/sections";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

/** The two the café and the bakery start from, in the three languages. */
const READY = [
  { name: "Café", nameAr: "المقهى", nameCkb: "کافێ" },
  { name: "Bakery", nameAr: "المخبز", nameCkb: "نانەواخانە" },
];

interface Draft {
  name: string;
  nameAr: string;
  nameCkb: string;
  isActive: boolean;
}
const EMPTY: Draft = { name: "", nameAr: "", nameCkb: "", isActive: true };

/**
 * The café and the bakery on one till (round sixteen, 0074): the parts of the
 * menu the café names, and each category's part. One till sells them all on
 * one bill; the reports show each part's takings and profit; and a branch may
 * sell only some parts (Settings → Locations).
 */
export function SectionsManager({
  sections,
  categories,
  categorySection,
  canEdit,
}: {
  sections: MenuSection[];
  categories: MenuCategory[];
  categorySection: Record<string, string>;
  canEdit: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [fresh, setFresh] = useState<Draft>(EMPTY);
  const draftOf = (s: MenuSection): Draft =>
    edits[s.id] ?? {
      name: s.name,
      nameAr: s.nameAr ?? "",
      nameCkb: s.nameCkb ?? "",
      isActive: s.isActive,
    };
  const edit = (s: MenuSection, patch: Partial<Draft>) =>
    setEdits((e) => ({ ...e, [s.id]: { ...draftOf(s), ...patch } }));

  function save(id: string | null, d: Draft, after: () => void) {
    setMsg(null);
    start(async () => {
      const r = await op.run(`saveSection:${id ?? "new"}`, (key) =>
        saveSectionAction(
          {
            id,
            name: d.name,
            nameAr: d.nameAr || null,
            nameCkb: d.nameCkb || null,
            isActive: d.isActive,
          },
          key,
        ),
      );
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved “{name}”.", { name: d.name.trim() }) });
        after();
        router.refresh();
      }
    });
  }

  function addReady() {
    setMsg(null);
    start(async () => {
      for (const s of READY) {
        const r = await op.run(`saveSection:${s.name}`, (key) =>
          saveSectionAction({ id: null, ...s, isActive: true }, key),
        );
        if (!r.ok) {
          setMsg({ ok: false, text: r.error });
          return;
        }
      }
      setMsg({ ok: true, text: t("Added Café and Bakery: now give each category its part.") });
      router.refresh();
    });
  }

  function setSection(categoryId: string, sectionId: string | null) {
    setMsg(null);
    start(async () => {
      const r = await op.run(`categorySection:${categoryId}`, (key) =>
        setCategorySectionAction({ categoryId, sectionId }, key),
      );
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else router.refresh();
    });
  }

  const inUse = sections.filter((s) => s.isActive);

  return (
    <div className="card grid" style={{ gap: 10 }} data-testid="sections">
      <div>
        <h3 style={{ margin: 0 }}>{t("Café and bakery on one till")}</h3>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: ".85rem" }}>
          {t(
            "Name the parts of your menu, such as Café and Bakery, and give each category its part. One till sells them all on one bill; the reports show each part's takings and profit; and a branch can sell only one part (Settings → Locations).",
          )}
        </p>
      </div>

      {sections.length === 0 && canEdit && (
        <div>
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={addReady}
            data-testid="sections-ready"
          >
            {t("Add Café and Bakery")}
          </button>
          <span className="muted" style={{ marginInlineStart: 8, fontSize: ".85rem" }}>
            {t("or name your own below")}
          </span>
        </div>
      )}

      {(sections.length > 0 || canEdit) && (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>العربية</th>
                <th>کوردی</th>
                <th style={{ width: 80 }}>{t("In use")}</th>
                <th>{t("Shown")}</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => {
                const d = draftOf(s);
                return (
                  <tr key={s.id} className={d.isActive ? "" : "faint"} data-testid="section-row">
                    <td>
                      <input
                        value={d.name}
                        aria-label={t("Name")}
                        maxLength={40}
                        disabled={!canEdit}
                        onChange={(e) => edit(s, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        dir="rtl"
                        value={d.nameAr}
                        aria-label={t("plat.form.nameIn", { language: "العربية" })}
                        maxLength={40}
                        disabled={!canEdit}
                        onChange={(e) => edit(s, { nameAr: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        dir="rtl"
                        value={d.nameCkb}
                        aria-label={t("plat.form.nameIn", { language: "کوردی" })}
                        maxLength={40}
                        disabled={!canEdit}
                        onChange={(e) => edit(s, { nameCkb: e.target.value })}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        className="check"
                        checked={d.isActive}
                        disabled={!canEdit}
                        aria-label={t("{name} in use", { name: s.name })}
                        onChange={(e) => edit(s, { isActive: e.target.checked })}
                      />
                    </td>
                    <td>
                      <SectionHours section={s} canEdit={canEdit} />
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          type="button"
                          disabled={pending || !edits[s.id]}
                          onClick={() =>
                            save(s.id, d, () =>
                              setEdits((e) => {
                                const rest = { ...e };
                                delete rest[s.id];
                                return rest;
                              }),
                            )
                          }
                        >
                          {t("Save")}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {canEdit && (
                <tr>
                  <td>
                    <input
                      value={fresh.name}
                      aria-label={t("Name")}
                      maxLength={40}
                      placeholder={t("New part, e.g. Bakery")}
                      onChange={(e) => setFresh({ ...fresh, name: e.target.value })}
                      data-testid="section-new"
                    />
                  </td>
                  <td>
                    <input
                      dir="rtl"
                      value={fresh.nameAr}
                      aria-label={t("plat.form.nameIn", { language: "العربية" })}
                      maxLength={40}
                      onChange={(e) => setFresh({ ...fresh, nameAr: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      dir="rtl"
                      value={fresh.nameCkb}
                      aria-label={t("plat.form.nameIn", { language: "کوردی" })}
                      maxLength={40}
                      onChange={(e) => setFresh({ ...fresh, nameCkb: e.target.value })}
                    />
                  </td>
                  <td />
                  <td>
                    <button
                      type="button"
                      disabled={pending || !fresh.name.trim()}
                      onClick={() => save(null, fresh, () => setFresh(EMPTY))}
                    >
                      {t("Add")}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {inUse.length > 0 && categories.length > 0 && (
        <div className="grid" style={{ gap: 6 }}>
          <strong>{t("Each category's part")}</strong>
          <ul className="section-cats" data-testid="section-cats">
            {categories.map((c) => (
              <li key={c.id} className={c.isActive ? "" : "faint"}>
                <span dir="auto">{c.name}</span>
                <select
                  aria-label={t("{name}'s part", { name: c.name })}
                  value={categorySection[c.id] ?? ""}
                  disabled={!canEdit || pending}
                  onChange={(e) => setSection(c.id, e.target.value || null)}
                  data-testid="category-section"
                  data-category={c.name}
                >
                  <option value="">{t("— none —")}</option>
                  {inUse.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

/**
 * The hours a part of the menu is shown at the till (0089): a breakfast part
 * from 08:00 to 11:00; empty, always. The till changes by itself at the hour.
 */
function SectionHours({ section, canEdit }: { section: MenuSection; canEdit: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [from, setFrom] = useState(section.shownFrom ?? "");
  const [until, setUntil] = useState(section.shownUntil ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const changed = from !== (section.shownFrom ?? "") || until !== (section.shownUntil ?? "");
  return (
    <span className="row" style={{ gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      <input
        type="time"
        value={from}
        disabled={!canEdit}
        aria-label={t("Shown from")}
        onChange={(e) => setFrom(e.target.value)}
        data-testid="section-from"
      />
      –
      <input
        type="time"
        value={until}
        disabled={!canEdit}
        aria-label={t("Shown until")}
        onChange={(e) => setUntil(e.target.value)}
        data-testid="section-until"
      />
      {canEdit && changed && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await setSectionHoursAction({
                sectionId: section.id,
                from: from || null,
                until: until || null,
              });
              if (!r.ok) setErr(r.error);
              else router.refresh();
            })
          }
          data-testid="section-hours-save"
        >
          {t("Save")}
        </button>
      )}
      {!from && !until && <span className="muted">{t("Always")}</span>}
      {err && <span className="badge err">{err}</span>}
    </span>
  );
}
