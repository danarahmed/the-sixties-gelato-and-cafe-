"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPublicMenuAction } from "@/lib/actions/publicMenu";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { QrCode } from "@/components/QrCode";

/**
 * The menu on customers' phones (0118), on Settings: the owner turns it on
 * for a place; its link, and the QR to print for the tables; a new link
 * makes the old QR open nothing.
 */
export function PublicMenuCard({
  setup,
  places,
  isOwner,
}: {
  setup: { enabled: boolean; token: string; locationId: string | null } | null;
  places: { id: string; name: string }[];
  isOwner: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [place, setPlace] = useState(setup?.locationId ?? places[0]?.id ?? "");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = setup?.token ? `${origin}/m/${setup.token}` : "";

  function save(enabled: boolean, newLink = false) {
    setMsg(null);
    start(async () => {
      const r = await setPublicMenuAction({ enabled, locationId: place || null, newLink });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({
          ok: true,
          text: newLink
            ? t("A new link: print its QR again, the old one opens nothing.")
            : enabled
              ? t("On: the QR opens the menu.")
              : t("Off: the QR opens nothing."),
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="public-menu">
      <Notice msg={msg} />
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Customers scan the QR on the table: the menu opens on their phone, with the photos and prices, in their language. They choose, and show the waiter their order as a QR; the waiter scans it at the till, and it is added to the bill. Nothing reaches the books from their phone.",
        )}
      </p>
      {places.length > 1 && (
        <label>
          <div className="sc">{t("Its prices are this place's")}</div>
          <select
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            disabled={!isOwner || busy}
          >
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {isOwner && (
          <button
            type="button"
            className={setup?.enabled ? undefined : "btn-primary"}
            onClick={() => save(!setup?.enabled)}
            disabled={busy}
            data-testid="public-menu-toggle"
          >
            {setup?.enabled ? t("Turn it off") : t("Turn it on")}
          </button>
        )}
        {isOwner && setup?.enabled && (
          <button
            type="button"
            onClick={() => save(true, true)}
            disabled={busy}
            data-testid="public-menu-new"
          >
            {t("A new link")}
          </button>
        )}
      </div>
      {setup?.enabled && link && (
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <QrCode
            text={link}
            size={140}
            label={t("The menu's QR, for the tables")}
            testId="public-menu-qr"
          />
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="mono"
            data-testid="public-menu-link"
          >
            {link}
          </a>
        </div>
      )}
      {!isOwner && (
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
          {t("Only the owner turns the menu on customers' phones on or off")}
        </p>
      )}
    </div>
  );
}
