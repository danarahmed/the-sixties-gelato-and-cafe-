"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerClockScreenAction, removeClockScreenAction } from "@/lib/actions/clock";
import type { ClockScreen } from "@/lib/clock";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { Icon } from "@/components/Icon";

type Msg = { ok: boolean; text: string } | null;
type Place = { id: string; name: string };

/**
 * The shop's clock (0068), on Staff: the devices at the shop that show the
 * code staff scan with their own phones, which the owner makes and takes out
 * of use. A device is made one from itself: the owner opens Staff on the till
 * (or the tablet by the door) and presses the button there.
 */
export function ShopClock({
  screens,
  thisScreen,
  places,
  canSetUp,
  timezone,
}: {
  /** Null: the database is not ready for clock screens yet. */
  screens: ClockScreen[] | null;
  /** This device's screen, when it is one. */
  thisScreen: string | null;
  places: Place[];
  /** settings.manage: make and remove clock screens. */
  canSetUp: boolean;
  timezone: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [making, setMaking] = useState(false);
  const [name, setName] = useState(() => t("The till"));
  const [place, setPlace] = useState(places[0]?.id ?? "");
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, start] = useTransition();

  if (screens === null) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        {t("The database is not ready for clock screens yet.")}
      </p>
    );
  }

  function make() {
    setMsg(null);
    start(async () => {
      const r = await registerClockScreenAction({ name, locationId: place });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMaking(false);
      setMsg({
        ok: true,
        text: t("This device is the clock screen “{name}” now.", { name: r.data.name }),
      });
      router.refresh();
    });
  }

  function remove(id: string) {
    setMsg(null);
    start(async () => {
      const r = await removeClockScreenAction({ screenId: id, reason });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setRemoving(null);
      setReason("");
      setMsg({ ok: true, text: t("The clock screen is taken out of use.") });
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="shop-clock">
      <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>
        {t(
          "Staff clock in and out on their own phone: they scan the code on the shop's clock screen, which changes every 30 seconds, so it works only at the shop. Those without a phone clock in on the clock screen with their PIN.",
        )}
      </p>

      {screens.length === 0 ? (
        <p style={{ margin: 0 }} data-testid="shop-clock-none">
          {t("No clock screen yet: everyone clocks in at the till with their PIN, as before.")}
        </p>
      ) : (
        <ul className="clock-screens">
          {screens.map((s) => (
            <li key={s.id} data-testid="clock-screen" data-name={s.name}>
              <div className="clock-screen-line">
                <Icon name="qr" size={18} />
                <b>{s.name}</b>
                <span className="muted">· {s.location}</span>
                {s.id === thisScreen && (
                  <span className="badge ok" data-testid="clock-screen-this">
                    {t("This device")}
                  </span>
                )}
                <span className="sp" />
                <span className="muted" style={{ fontSize: ".8rem" }}>
                  {s.lastSeenAt
                    ? t("Seen {when}", { when: dateTimeIn(timezone, s.lastSeenAt).slice(5) })
                    : t("Not seen yet")}
                </span>
                {canSetUp && removing !== s.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setRemoving(s.id);
                      setReason("");
                    }}
                    disabled={busy}
                    data-testid="clock-screen-remove"
                  >
                    {t("Take out of use…")}
                  </button>
                )}
              </div>
              {removing === s.id && (
                <div className="clock-screen-remove">
                  <input
                    style={{ ...inputStyle, minHeight: 38 }}
                    value={reason}
                    maxLength={300}
                    onChange={(e) => setReason(e.target.value)}
                    aria-label={t("Why it is taken out of use")}
                    placeholder={t("e.g. The tablet broke")}
                    data-testid="clock-screen-reason"
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || reason.trim() === ""}
                    onClick={() => remove(s.id)}
                    data-testid="clock-screen-remove-confirm"
                  >
                    {t("Take it out of use")}
                  </button>
                  <button type="button" onClick={() => setRemoving(null)} disabled={busy}>
                    {t("Cancel")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {thisScreen && (
        <p style={{ margin: 0 }}>
          <Link href="/clock/screen" className="clock-screen-open" data-testid="clock-screen-open">
            <Icon name="expand" size={16} /> {t("Show the code on the whole screen")}
          </Link>
          <span className="muted" style={{ display: "block", fontSize: ".85rem" }}>
            {t("On the till, the code is also in Clock in or out.")}
          </span>
        </p>
      )}

      {canSetUp &&
        !thisScreen &&
        (making ? (
          <div className="card grid clock-screen-make" style={{ gap: 10 }}>
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t(
                "Do this on the device at the shop that will show the code: the till, or a tablet by the door.",
              )}
            </p>
            <div className="clock-screen-fields">
              <Field label={t("The clock screen's name")}>
                <input
                  style={inputStyle}
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="clock-screen-name"
                />
              </Field>
              {places.length > 1 && (
                <Field label={t("Where it is")}>
                  <select
                    style={inputStyle}
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    data-testid="clock-screen-place"
                  >
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || name.trim() === "" || !place}
                onClick={make}
                data-testid="clock-screen-save"
              >
                {busy ? "…" : t("Make it the clock screen")}
              </button>
              <button type="button" onClick={() => setMaking(false)} disabled={busy}>
                {t("Cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={screens.length === 0 ? "btn-primary" : undefined}
            style={{ alignSelf: "start" }}
            onClick={() => {
              setMsg(null);
              setMaking(true);
            }}
            data-testid="clock-screen-make"
          >
            <Icon name="qr" size={16} />{" "}
            {screens.length === 0
              ? t("Make this device the shop's clock screen")
              : t("Make this device a clock screen too")}
          </button>
        ))}
      {!canSetUp && screens.length === 0 && (
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {t("The owner or the general manager makes a device at the shop the clock screen.")}
        </p>
      )}
      <Notice msg={msg} />
    </div>
  );
}
