"use client";

import { useState, useTransition } from "react";
import { saveCategoryAction } from "@/lib/actions/menu";
import type { MenuCategory } from "@/lib/db/menu";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

interface Draft {
  name: string;
  nameAr: string;
  nameCkb: string;
  sortOrder: string;
  isActive: boolean;
}

const toDraft = (c: MenuCategory): Draft => ({
  name: c.name,
  nameAr: c.nameAr ?? "",
  nameCkb: c.nameCkb ?? "",
  sortOrder: String(c.sortOrder),
  isActive: c.isActive,
});

/**
 * The till is organised by category: this sets their names in the three
 * languages, the order of the chips, and hides a whole category from the till
 * (a seasonal menu, say) without touching its products.
 */
export function CategoriesManager({
  categories,
  counts,
  canEdit,
}: {
  categories: MenuCategory[];
  counts: Map<string, number>;
  canEdit: boolean;
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const next = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1;
  const [fresh, setFresh] = useState<Draft>({
    name: "",
    nameAr: "",
    nameCkb: "",
    sortOrder: String(next),
    isActive: true,
  });
  const draftOf = (c: MenuCategory) => edits[c.id] ?? toDraft(c);
  const edit = (c: MenuCategory, patch: Partial<Draft>) =>
    setEdits((e) => ({ ...e, [c.id]: { ...draftOf(c), ...patch } }));

  function save(id: string | null, d: Draft, after: () => void) {
    setMsg(null);
    start(async () => {
      const r = await saveCategoryAction({
        id,
        name: d.name,
        nameAr: d.nameAr || null,
        nameCkb: d.nameCkb || null,
        sortOrder: Math.trunc(Number(d.sortOrder) || 0),
        isActive: d.isActive,
      });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved “{name}”.", { name: d.name.trim() }) });
        after();
      }
    });
  }

  return (
    <div className="card grid" style={{ gap: 10 }}>
      <div>
        <h3 style={{ margin: 0 }}>{t("Categories on the till")}</h3>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: ".85rem" }}>
          {t(
            "The till shows its products in these groups, in this order. Untick “On the till” to hide a whole category (a seasonal menu, say); its products and their history stay as they are.",
          )}
        </p>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("Name")}</th>
              <th>العربية</th>
              <th>کوردی</th>
              <th style={{ width: 70 }}>{t("pos.order")}</th>
              <th style={{ width: 80 }}>{t("On the till")}</th>
              <th className="right">{t("Products")}</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const d = draftOf(c);
              return (
                <tr key={c.id} className={d.isActive ? "" : "faint"}>
                  <td>
                    <input
                      value={d.name}
                      maxLength={60}
                      disabled={!canEdit}
                      onChange={(e) => edit(c, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      dir="rtl"
                      value={d.nameAr}
                      maxLength={60}
                      disabled={!canEdit}
                      onChange={(e) => edit(c, { nameAr: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      dir="rtl"
                      value={d.nameCkb}
                      maxLength={60}
                      disabled={!canEdit}
                      onChange={(e) => edit(c, { nameCkb: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      inputMode="numeric"
                      value={d.sortOrder}
                      disabled={!canEdit}
                      onChange={(e) => edit(c, { sortOrder: e.target.value })}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className="check"
                      checked={d.isActive}
                      disabled={!canEdit}
                      aria-label={t("{name} on the till", { name: c.name })}
                      onChange={(e) => edit(c, { isActive: e.target.checked })}
                    />
                  </td>
                  <td className="right mono">{counts.get(c.id) ?? 0}</td>
                  {canEdit && (
                    <td>
                      <button
                        disabled={pending || !edits[c.id]}
                        onClick={() =>
                          save(c.id, d, () =>
                            setEdits((e) => {
                              const rest = { ...e };
                              delete rest[c.id];
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
                    maxLength={60}
                    placeholder={t("New category, e.g. Hot drinks")}
                    onChange={(e) => setFresh({ ...fresh, name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    dir="rtl"
                    value={fresh.nameAr}
                    maxLength={60}
                    onChange={(e) => setFresh({ ...fresh, nameAr: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    dir="rtl"
                    value={fresh.nameCkb}
                    maxLength={60}
                    onChange={(e) => setFresh({ ...fresh, nameCkb: e.target.value })}
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
                <td />
                <td>
                  <button
                    className="btn-primary"
                    disabled={pending || !fresh.name.trim()}
                    onClick={() =>
                      save(null, fresh, () =>
                        setFresh({
                          name: "",
                          nameAr: "",
                          nameCkb: "",
                          sortOrder: String(Number(fresh.sortOrder) + 1),
                          isActive: true,
                        }),
                      )
                    }
                  >
                    ＋ {t("Add")}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Notice msg={msg} />
    </div>
  );
}
