"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessDetailsAction } from "@/lib/actions/details";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import type { BusinessDetails } from "@/lib/db/details";

/** Time zones offered first; any other the browser knows can be typed. */
const NEAR_ZONES = ["Asia/Baghdad", "Asia/Dubai", "Asia/Riyadh", "Asia/Tehran", "Europe/Istanbul"];

function allZones(): string[] {
  try {
    const more = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    return [...new Set([...NEAR_ZONES, ...(more ?? [])])];
  } catch {
    return NEAR_ZONES;
  }
}

/**
 * The café's details (0095), on Settings: the owner changes its name and its
 * default language at any time; the currency, the time zone and how bill
 * numbers start only until the café sells or posts anything, since every
 * record is read by them from then on. Anyone else sees them.
 */
export function DetailsManager({
  details,
  languages,
}: {
  details: BusinessDetails;
  /** The café's languages: code and name. */
  languages: { code: string; label: string }[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({
    name: details.name,
    defaultLocale: details.defaultLocale,
    currencyCode: details.currencyCode,
    currencySymbol: details.currencySymbol,
    currencyDecimals: String(details.currencyDecimals),
    timezone: details.timezone,
    billPrefix: details.billPrefix,
  });
  const zones = useMemo(allZones, []);
  const can = details.owner;
  const open = can && !details.fixed;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  function save() {
    setMsg(null);
    const decimals = Number(f.currencyDecimals);
    if (open && (!Number.isInteger(decimals) || decimals < 0 || decimals > 3)) {
      setMsg({ ok: false, text: t("A currency has 0 to 3 decimal places") });
      return;
    }
    start(async () => {
      const r = await updateBusinessDetailsAction({
        name: f.name,
        defaultLocale: f.defaultLocale,
        // Fixed ones are not sent: the database would refuse even the same value written differently.
        ...(open
          ? {
              currencyCode: f.currencyCode,
              currencySymbol: f.currencySymbol,
              currencyDecimals: decimals,
              timezone: f.timezone,
              billPrefix: f.billPrefix,
            }
          : {}),
      });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        router.refresh();
      }
    });
  }

  const row = (label: string, field: React.ReactNode, note?: string) => (
    <label className="grid" style={{ gap: 4 }}>
      <span className="muted" style={{ fontSize: ".85rem" }}>
        {label}
      </span>
      {field}
      {note && (
        <span className="muted" style={{ fontSize: ".78rem" }}>
          {note}
        </span>
      )}
    </label>
  );
  const fixedNote = details.fixed
    ? t("Fixed: the café has sold or posted with it, and every record reads by it.")
    : undefined;

  return (
    <form
      className="grid"
      style={{ gap: 12, maxWidth: 520 }}
      data-testid="details-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Notice msg={msg} />
      {!can && (
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {t("Only the owner changes the café's details.")}
        </p>
      )}
      {row(
        t("Business name"),
        <input
          style={inputStyle}
          value={f.name}
          onChange={set("name")}
          disabled={!can || busy}
          maxLength={80}
          aria-label={t("Business name")}
          data-testid="details-name"
        />,
      )}
      {row(
        t("Default language"),
        <select
          style={inputStyle}
          value={f.defaultLocale}
          onChange={set("defaultLocale")}
          disabled={!can || busy}
          aria-label={t("Default language")}
          data-testid="details-language"
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>,
        t("The language of the sign-in screen and of anyone who has not chosen one."),
      )}
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        {row(
          t("Currency"),
          <input
            style={{ ...inputStyle, width: "7ch", textTransform: "uppercase" }}
            value={f.currencyCode}
            onChange={set("currencyCode")}
            disabled={!open || busy}
            maxLength={3}
            aria-label={t("Currency")}
            data-testid="details-currency"
          />,
        )}
        {row(
          t("Its sign"),
          <input
            style={{ ...inputStyle, width: "8ch" }}
            value={f.currencySymbol}
            onChange={set("currencySymbol")}
            disabled={!open || busy}
            maxLength={6}
            aria-label={t("Its sign")}
            data-testid="details-symbol"
          />,
        )}
        {row(
          t("Decimal places"),
          <input
            style={{ ...inputStyle, width: "5ch" }}
            inputMode="numeric"
            value={f.currencyDecimals}
            onChange={set("currencyDecimals")}
            disabled={!open || busy}
            aria-label={t("Decimal places")}
            data-testid="details-decimals"
          />,
        )}
      </div>
      {row(
        t("Timezone"),
        <>
          <input
            style={inputStyle}
            list="details-zones"
            value={f.timezone}
            onChange={set("timezone")}
            disabled={!open || busy}
            aria-label={t("Timezone")}
            data-testid="details-timezone"
          />
          <datalist id="details-zones">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </>,
        fixedNote ?? t("Every trading day and period runs midnight to midnight here."),
      )}
      {row(
        t("Bill numbers start with"),
        <input
          style={{ ...inputStyle, width: "12ch", textTransform: "uppercase" }}
          value={f.billPrefix}
          onChange={set("billPrefix")}
          disabled={!open || busy}
          maxLength={8}
          aria-label={t("Bill numbers start with")}
          data-testid="details-prefix"
        />,
        fixedNote ??
          t("2 to 8 capital letters or digits, a letter first: {prefix}-2026-0001.", {
            prefix: (f.billPrefix || "BILL").toUpperCase(),
          }),
      )}
      {can && (
        <button
          type="submit"
          disabled={busy}
          style={{ justifySelf: "start" }}
          data-testid="details-save"
        >
          {t("Save")}
        </button>
      )}
    </form>
  );
}
