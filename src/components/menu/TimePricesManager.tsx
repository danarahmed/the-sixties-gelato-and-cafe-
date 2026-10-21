"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTimePriceAction, stopTimePriceAction } from "@/lib/actions/deals";
import { WEEKDAYS, type TimePrice } from "@/lib/deals";
import { isPlatformChannel } from "@/lib/channels";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { useChannels } from "@/components/ChannelsProvider";
import { Icon } from "@/components/Icon";
import { Notice, inputStyle } from "@/components/ui";
import { DaysAndHours, type DealSize } from "./DealsManager";

/**
 * Prices by the time of day (0089) on Products & Recipes: a size's price at
 * set hours, on set days — on dine-in and take-away unless a way of selling
 * is named — taking the place of its usual price while it runs. The till
 * changes by itself at the hour; a bill keeps the price it was rung at.
 */
export function TimePricesManager({
  prices,
  sizes,
  branches,
}: {
  prices: TimePrice[];
  sizes: DealSize[];
  branches: { id: string; name: string }[];
}) {
  const { t } = useT();
  const { set, name: channelName } = useChannels();
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({
    variantId: "",
    price: "",
    channel: "",
    locationId: "",
    days: WEEKDAYS.map(([d]) => d),
    starts: "",
    ends: "",
  });
  const channels = set.inUse.filter((c) => !isPlatformChannel(c));
  const dayNames = (d: number[] | null) =>
    !d || d.length === 7
      ? t("Every day")
      : d.map((x) => t(WEEKDAYS.find(([n]) => n === x)?.[1] ?? "")).join(", ");

  function add() {
    setMsg(null);
    start(async () => {
      const r = await setTimePriceAction(
        {
          variantId: f.variantId,
          price: Number(f.price),
          starts: f.starts,
          ends: f.ends,
          days: f.days.length === 7 ? null : f.days,
          channel: f.channel || null,
          locationId: f.locationId || null,
        },
        crypto.randomUUID(),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setAdding(false);
      setF({ ...f, variantId: "", price: "" });
      setMsg({ ok: true, text: t("Saved.") });
      router.refresh();
    });
  }

  function stop(id: string) {
    setMsg(null);
    start(async () => {
      const r = await stopTimePriceAction({ id });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else router.refresh();
    });
  }

  return (
    <details className="card menu-photos" data-testid="time-prices-card">
      <summary>
        <Icon name="sun" /> {t("Prices by the time of day")}{" "}
        <span className="muted menu-photos-count">{prices.length}</span>
      </summary>
      <p className="muted" style={{ fontSize: ".85rem", margin: "10px 0" }}>
        {t(
          "A price at set hours, on set days — gelato after 21:00, breakfast from 08:00 to 11:00 — in place of the usual one while it runs. The till changes by itself at the hour; a bill keeps the price it was rung at.",
        )}
      </p>
      <Notice msg={msg} />
      {prices.length > 0 && (
        <ul className="deal-list">
          {prices.map((p) => (
            <li
              key={p.id}
              className="deal-row"
              data-testid="time-price-row"
              data-product={p.product}
            >
              <div>
                <strong dir="auto">{p.product}</strong>{" "}
                <span className="mono">{fmtIQD(p.price)}</span>
                {p.usual !== null && (
                  <span className="muted mono">
                    {" "}
                    ({t("usually {price}", { price: fmtIQD(p.usual) })})
                  </span>
                )}{" "}
                {p.onNow && <span className="badge ok">{t("On now")}</span>}
                <div className="muted" style={{ fontSize: ".85rem" }}>
                  <bdi className="mono">{p.starts}</bdi>–<bdi className="mono">{p.ends}</bdi> ·{" "}
                  {dayNames(p.days)} ·{" "}
                  {p.channel ? channelName(p.channel) : t("Dine-in and take-away")}
                  {p.location && <> · {p.location}</>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => stop(p.id)}
                disabled={busy}
                data-testid="time-price-stop"
              >
                {t("Stop")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!adding ? (
        <button
          type="button"
          className="btn-soft"
          onClick={() => setAdding(true)}
          data-testid="time-price-new"
        >
          <Icon name="plus" size={14} /> {t("New price by the hour")}
        </button>
      ) : (
        <div className="grid" style={{ gap: 10 }} data-testid="time-price-form">
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ flex: 2, minWidth: 200 }}>
              <span className="muted">{t("Product")}</span>
              <select
                style={inputStyle}
                value={f.variantId}
                onChange={(e) => setF({ ...f, variantId: e.target.value })}
                data-testid="time-price-size"
              >
                <option value="">{t("Choose…")}</option>
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 110 }}>
              <span className="muted">{t("Price")}</span>
              <input
                style={inputStyle}
                inputMode="decimal"
                value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })}
                data-testid="time-price-price"
              />
            </label>
            <label style={{ flex: 1, minWidth: 150 }}>
              <span className="muted">{t("Sold")}</span>
              <select
                style={inputStyle}
                value={f.channel}
                onChange={(e) => setF({ ...f, channel: e.target.value })}
              >
                <option value="">{t("Dine-in and take-away")}</option>
                {channels.map((c) => (
                  <option key={c} value={c}>
                    {channelName(c)}
                  </option>
                ))}
              </select>
            </label>
            {branches.length > 1 && (
              <label style={{ flex: 1, minWidth: 150 }}>
                <span className="muted">{t("Branch")}</span>
                <select
                  style={inputStyle}
                  value={f.locationId}
                  onChange={(e) => setF({ ...f, locationId: e.target.value })}
                >
                  <option value="">{t("Every branch")}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <DaysAndHours
            days={f.days}
            starts={f.starts}
            ends={f.ends}
            onChange={(v) => setF({ ...f, ...v })}
          />
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !f.variantId || f.price === "" || !f.starts || !f.ends}
              onClick={add}
              data-testid="time-price-save"
            >
              {busy ? "…" : t("Save")}
            </button>
            <button type="button" onClick={() => setAdding(false)} disabled={busy}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
