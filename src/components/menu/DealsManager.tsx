"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDealAction } from "@/lib/actions/deals";
import { WEEKDAYS, type Deal } from "@/lib/deals";
import { isPlatformChannel } from "@/lib/channels";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { useChannels } from "@/components/ChannelsProvider";
import { Icon } from "@/components/Icon";
import { Notice, inputStyle } from "@/components/ui";

/** A size the menu sells, as a deal's place can name it. */
export interface DealSize {
  id: string;
  label: string;
}

interface Draft {
  id: string | null;
  name: string;
  nameAr: string;
  nameCkb: string;
  /** Each place: "v:<size>" or "c:<category>", and its label. */
  places: { pick: string; label: string }[];
  prices: Record<string, string>;
  days: number[];
  starts: string;
  ends: string;
  active: boolean;
}

const blank = (): Draft => ({
  id: null,
  name: "",
  nameAr: "",
  nameCkb: "",
  places: [
    { pick: "", label: "" },
    { pick: "", label: "" },
  ],
  prices: {},
  days: WEEKDAYS.map(([d]) => d),
  starts: "",
  ends: "",
  active: true,
});

function draftOf(d: Deal): Draft {
  return {
    id: d.id,
    name: d.name,
    nameAr: d.nameAr ?? "",
    nameCkb: d.nameCkb ?? "",
    places: d.slots.map((s) => ({
      pick: s.categoryId ? `c:${s.categoryId}` : s.variants[0] ? `v:${s.variants[0]}` : "",
      label: s.label ?? "",
    })),
    prices: Object.fromEntries(Object.entries(d.prices).map(([k, v]) => [k, String(v)])),
    days: d.days ?? WEEKDAYS.map(([x]) => x),
    starts: d.starts ?? "",
    ends: d.ends ?? "",
    active: d.isActive,
  };
}

/**
 * Meal deals (0089) on Products & Recipes: "Latte + croissant = 5,000". Each
 * place is a product's size or any of a category's; a price for each way it
 * is sold; the days and hours it is on. At the till each is sold as itself,
 * what the deal gives away kept apart as its discount.
 */
export function DealsManager({
  deals,
  sizes,
  categories,
}: {
  deals: Deal[];
  sizes: DealSize[];
  categories: { id: string; name: string }[];
}) {
  const { t } = useT();
  const { set, name: channelName } = useChannels();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const channels = set.inUse.filter((c) => !isPlatformChannel(c));
  const sizeName = new Map(sizes.map((s) => [s.id, s.label]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  function save(d: Draft) {
    setMsg(null);
    const prices: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.prices)) if (v.trim() !== "") prices[k] = Number(v);
    start(async () => {
      const r = await saveDealAction(
        {
          id: d.id,
          name: d.name,
          nameAr: d.nameAr || null,
          nameCkb: d.nameCkb || null,
          prices,
          slots: d.places.map((p) => ({
            label: p.label || null,
            categoryId: p.pick.startsWith("c:") ? p.pick.slice(2) : null,
            variants: p.pick.startsWith("v:") ? [p.pick.slice(2)] : [],
          })),
          days: d.days.length === 7 ? null : d.days,
          starts: d.starts || null,
          ends: d.ends || null,
          active: d.active,
        },
        crypto.randomUUID(),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setDraft(null);
      setMsg({ ok: true, text: t("Saved.") });
      router.refresh();
    });
  }

  function placeText(s: Deal["slots"][number]) {
    if (s.label) return s.label;
    if (s.categoryId) return t("Any {category}", { category: catName.get(s.categoryId) ?? "—" });
    return s.variants.map((v) => sizeName.get(v) ?? "—").join(" / ");
  }

  return (
    <details className="card menu-photos" data-testid="deals-card">
      <summary>
        <Icon name="cup" /> {t("Meal deals")}{" "}
        <span className="muted menu-photos-count">{deals.length}</span>
      </summary>
      <p className="muted" style={{ fontSize: ".85rem", margin: "10px 0" }}>
        {t(
          "A deal is two things or more at one price: at the till it is one tap, each thing sold as itself, what the deal gives away kept apart as its discount.",
        )}
      </p>
      <Notice msg={msg} />
      {deals.length > 0 && (
        <ul className="deal-list">
          {deals.map((d) => (
            <li key={d.id} className="deal-row" data-testid="deal-row" data-deal={d.name}>
              <div>
                <strong dir="auto">{d.name}</strong>{" "}
                {d.onNow ? (
                  <span className="badge ok">{t("On now")}</span>
                ) : (
                  <span className="badge">{d.isActive ? t("Not now") : t("Off")}</span>
                )}
                <div className="muted" style={{ fontSize: ".85rem" }} dir="auto">
                  {d.slots.map(placeText).join(" + ")} ·{" "}
                  {Object.entries(d.prices)
                    .map(([c, p]) => `${channelName(c)} ${fmtIQD(p)}`)
                    .join(" · ")}
                  {d.starts && d.ends && (
                    <>
                      {" "}
                      · <bdi className="mono">{d.starts}</bdi>–<bdi className="mono">{d.ends}</bdi>
                    </>
                  )}{" "}
                  · {t("{n} sold", { n: d.sold })}
                </div>
              </div>
              <button type="button" onClick={() => setDraft(draftOf(d))} disabled={busy}>
                {t("Change")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!draft && (
        <button
          type="button"
          className="btn-soft"
          onClick={() => setDraft(blank())}
          data-testid="deal-new"
        >
          <Icon name="plus" size={14} /> {t("New deal")}
        </button>
      )}
      {draft && (
        <div className="deal-form grid" style={{ gap: 10 }} data-testid="deal-form">
          <label>
            <span className="muted">{t("Name")}</span>
            <input
              style={inputStyle}
              value={draft.name}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              data-testid="deal-name"
            />
          </label>
          <div className="deal-names">
            <label>
              <span className="muted">العربية</span>
              <input
                style={inputStyle}
                dir="rtl"
                lang="ar"
                value={draft.nameAr}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
              />
            </label>
            <label>
              <span className="muted">کوردی</span>
              <input
                style={inputStyle}
                dir="rtl"
                lang="ckb"
                value={draft.nameCkb}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, nameCkb: e.target.value })}
              />
            </label>
          </div>
          <fieldset className="deal-places">
            <legend>{t("What is in it")}</legend>
            {draft.places.map((p, i) => (
              <div key={i} className="deal-place">
                <select
                  style={inputStyle}
                  value={p.pick}
                  aria-label={t("Thing {n}", { n: i + 1 })}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      places: draft.places.map((x, j) =>
                        j === i ? { ...x, pick: e.target.value } : x,
                      ),
                    })
                  }
                  data-testid="deal-place"
                >
                  <option value="">{t("Choose…")}</option>
                  {categories.length > 0 && (
                    <optgroup label={t("Any of a category")}>
                      {categories.map((c) => (
                        <option key={c.id} value={`c:${c.id}`}>
                          {t("Any {category}", { category: c.name })}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={t("A product")}>
                    {sizes.map((s) => (
                      <option key={s.id} value={`v:${s.id}`}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <input
                  style={inputStyle}
                  value={p.label}
                  maxLength={40}
                  placeholder={t("Shown as (optional)")}
                  aria-label={t("Shown as (optional)")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      places: draft.places.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                {draft.places.length > 2 && (
                  <button
                    type="button"
                    aria-label={t("Take off")}
                    onClick={() =>
                      setDraft({ ...draft, places: draft.places.filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {draft.places.length < 8 && (
              <button
                type="button"
                className="linklike"
                onClick={() =>
                  setDraft({ ...draft, places: [...draft.places, { pick: "", label: "" }] })
                }
              >
                + {t("One more thing")}
              </button>
            )}
          </fieldset>
          <fieldset className="deal-prices">
            <legend>{t("Its price")}</legend>
            {channels.map((c) => (
              <label key={c}>
                <span className="muted">{channelName(c)}</span>
                <input
                  style={inputStyle}
                  inputMode="decimal"
                  value={draft.prices[c] ?? ""}
                  placeholder={t("Not sold this way")}
                  onChange={(e) =>
                    setDraft({ ...draft, prices: { ...draft.prices, [c]: e.target.value } })
                  }
                  data-testid={`deal-price-${c}`}
                />
              </label>
            ))}
          </fieldset>
          <DaysAndHours
            days={draft.days}
            starts={draft.starts}
            ends={draft.ends}
            optionalHours
            onChange={(v) => setDraft({ ...draft, ...v })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />{" "}
            {t("On sale")}
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => save(draft)}
              data-testid="deal-save"
            >
              {busy ? "…" : t("Save")}
            </button>
            <button type="button" onClick={() => setDraft(null)} disabled={busy}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
    </details>
  );
}

/** The days of the week as chips, and from–until; shared with the prices by the hour. */
export function DaysAndHours({
  days,
  starts,
  ends,
  optionalHours = false,
  onChange,
}: {
  days: number[];
  starts: string;
  ends: string;
  /** A deal may be on all day: then the hours may be left empty. */
  optionalHours?: boolean;
  onChange: (v: { days?: number[]; starts?: string; ends?: string }) => void;
}) {
  const { t } = useT();
  return (
    <div className="grid" style={{ gap: 8 }}>
      <div className="day-chips" role="group" aria-label={t("Days")}>
        {WEEKDAYS.map(([d, name]) => {
          const on = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              className={on ? "chip active" : "chip"}
              aria-pressed={on}
              onClick={() =>
                onChange({
                  days: on ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b),
                })
              }
            >
              {t(name)}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ gap: 8, alignItems: "end", flexWrap: "wrap" }}>
        <label>
          <span className="muted">{t("From")}</span>
          <input
            type="time"
            style={inputStyle}
            value={starts}
            onChange={(e) => onChange({ starts: e.target.value })}
            data-testid="hours-from"
          />
        </label>
        <label>
          <span className="muted">{t("Until")}</span>
          <input
            type="time"
            style={inputStyle}
            value={ends}
            onChange={(e) => onChange({ ends: e.target.value })}
            data-testid="hours-until"
          />
        </label>
        {optionalHours && (
          <span className="muted" style={{ fontSize: ".82rem" }}>
            {t("Leave the hours empty for all day.")}
          </span>
        )}
      </div>
    </div>
  );
}
