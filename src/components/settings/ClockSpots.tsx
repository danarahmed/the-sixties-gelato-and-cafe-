"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClockSpotAction } from "@/lib/actions/security";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";

interface Spot {
  placeId: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  radius: number;
}

/**
 * Where each place is (0099): clocking from a phone is then only near it or
 * inside it. Set by standing at the place and pressing "Here", on a phone or
 * a tablet that says where it is; a place with no spot clocks as before.
 */
export function ClockSpots({ spots }: { spots: Spot[] }) {
  const { t } = useT();
  return (
    <div className="grid" style={{ gap: 10 }} data-testid="clock-spots" id="clock-spots">
      <h3 style={{ margin: "8px 0 0" }}>{t("Where each place is")}</h3>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Clocking in or out from a phone is only near the place, or inside it, once the place has its spot. Stand there and press Here.",
        )}
      </p>
      {spots.map((s) => (
        <SpotRow key={s.placeId} spot={s} />
      ))}
    </div>
  );
}

function SpotRow({ spot }: { spot: Spot }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [radius, setRadius] = useState(String(spot.radius));

  function save(lat: number | null, lng: number | null) {
    const r = Number(radius);
    start(async () => {
      const res = await setClockSpotAction({
        placeId: spot.placeId,
        lat,
        lng,
        radius: Number.isInteger(r) ? r : 150,
      });
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        router.refresh();
      }
    });
  }

  function here() {
    setMsg(null);
    if (!navigator.geolocation) {
      setMsg({
        ok: false,
        text: t("This device does not say where it is: use a phone or a tablet."),
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => save(p.coords.latitude, p.coords.longitude),
      () =>
        setMsg({
          ok: false,
          text: t("Allow this device to say where it is, then press Here again."),
        }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div
      className="card row"
      style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}
      data-testid="clock-spot"
    >
      <strong style={{ minWidth: 140 }}>{spot.name}</strong>
      <span className="muted mono" style={{ fontSize: ".82rem" }}>
        {spot.lat === null || spot.lng === null
          ? t("No spot: phones clock from anywhere")
          : `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}`}
      </span>
      <label className="row" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: ".82rem" }}>
          {t("Near is within")}
        </span>
        <input
          style={{ ...inputStyle, width: "7ch" }}
          inputMode="numeric"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          aria-label={t("Near is within")}
        />
        <span className="muted" style={{ fontSize: ".82rem" }}>
          {t("metres")}
        </span>
      </label>
      <button type="button" className="btn-primary" onClick={here} disabled={busy}>
        {t("Here")}
      </button>
      {spot.lat !== null && (
        <button type="button" onClick={() => save(null, null)} disabled={busy}>
          {t("Take the spot away")}
        </button>
      )}
      <Notice msg={msg} />
    </div>
  );
}
