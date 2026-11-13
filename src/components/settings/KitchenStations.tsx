"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStationAction, setCategoryStationAction } from "@/lib/actions/kitchen";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

/**
 * The kitchen's stations (0110): a grill, a cold kitchen, a bar; each
 * category sent to one. A category with none goes to the kitchen's own screen.
 */
export function KitchenStations({
  stations,
  categories,
  map,
}: {
  stations: { id: string; name: string; active: boolean }[];
  categories: { id: string; name: string }[];
  map: Record<string, string>;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (f: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setMsg(null);
    start(async () => {
      const r = await f();
      if (!r.ok) setMsg({ ok: false, text: r.error ?? "" });
      else {
        after?.();
        setMsg({ ok: true, text: t("Saved.") });
        router.refresh();
      }
    });
  };
  const active = stations.filter((s) => s.active);

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="kitchen-stations">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Each station has its own screen (Kitchen on the menu). What a bill or a sale adds goes to the station of its category; a category with none goes to the kitchen's own screen.",
        )}
      </p>
      {stations.length > 0 && (
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {stations.map((s) => (
            <li key={s.id} className={s.active ? "" : "muted"}>
              {s.name}{" "}
              <button
                type="button"
                className="btn-link"
                disabled={busy}
                onClick={() =>
                  run(() => saveStationAction({ id: s.id, name: s.name, active: !s.active }))
                }
              >
                {s.active ? t("Stop using it") : t("Use it again")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
        <Field label={t("A new station")}>
          <input
            style={inputStyle}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            data-testid="station-name"
          />
        </Field>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !name.trim()}
          onClick={() =>
            run(
              () => saveStationAction({ id: null, name, active: true }),
              () => setName(""),
            )
          }
          data-testid="station-add"
        >
          {t("Add")}
        </button>
      </div>
      {active.length > 0 && categories.length > 0 && (
        <table data-testid="category-stations">
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <select
                    style={inputStyle}
                    aria-label={t("Station for {name}", { name: c.name })}
                    value={map[c.id] ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      run(() => setCategoryStationAction(c.id, e.target.value || null))
                    }
                    data-testid="category-station"
                    data-category={c.name}
                  >
                    <option value="">{t("The kitchen's own screen")}</option>
                    {active.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Notice msg={msg} />
    </div>
  );
}
