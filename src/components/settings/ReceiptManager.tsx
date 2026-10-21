"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearReceiptLogoAction,
  setReceiptLogoAction,
  setReceiptSetupAction,
} from "@/lib/actions/receipt";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { ReceiptPreview, type PrintJob } from "@/components/pos/PrintSlip";
import { LOGO, shrinkPhoto } from "@/components/menu/photo";
import type { ReceiptQr, ReceiptSetup } from "@/lib/receipt";

type Form = Omit<ReceiptSetup, "name" | "logo">;
type TextKey = Exclude<keyof Form, "qr">;

const blank = (v: string | null) => v ?? "";

/**
 * The café's own receipt (0091), on Settings: what the bill, the receipt and
 * a refund's slip print besides the sale — the logo, the café's name in
 * Arabic and Kurdish, a thank-you line in each language, its pages, the
 * Wi-Fi, a QR code to its menu or its reviews, and a line at the foot. The
 * receipt beside the form shows each change as it will print.
 */
export function ReceiptManager({ setup, timezone }: { setup: ReceiptSetup; timezone: string }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [logo, setLogo] = useState(setup.logo);
  const file = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>(() => {
    const { name: _name, logo: _logo, ...rest } = setup;
    return rest;
  });
  const set = (k: TextKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const text = (k: TextKey, label: string, opts: { max: number; rtl?: boolean; ltr?: boolean }) => (
    <Field label={label}>
      <input
        style={inputStyle}
        value={blank(form[k])}
        onChange={set(k)}
        maxLength={opts.max}
        dir={opts.rtl ? "rtl" : opts.ltr ? "ltr" : undefined}
        disabled={busy}
        data-testid={`receipt-${k}`}
      />
    </Field>
  );

  function save() {
    setMsg(null);
    start(async () => {
      const r = await setReceiptSetupAction(form);
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved: every receipt prints it from now on.") });
        router.refresh();
      }
    });
  }

  function chooseLogo(f: File | undefined) {
    if (!f) return;
    setMsg(null);
    start(async () => {
      try {
        const photo = await shrinkPhoto(f, LOGO);
        const r = await setReceiptLogoAction(photo);
        if (!r.ok) setMsg({ ok: false, text: r.error });
        else {
          setLogo(r.data.logo);
          setMsg({ ok: true, text: t("Saved.") });
          router.refresh();
        }
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
      } finally {
        if (file.current) file.current.value = "";
      }
    });
  }

  function takeLogoOff() {
    setMsg(null);
    start(async () => {
      const r = await clearReceiptLogoAction();
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setLogo(null);
        router.refresh();
      }
    });
  }

  const qrChoices: { v: ReceiptQr; label: string }[] = [
    { v: "none", label: t("No QR code") },
    { v: "menu", label: t("Our menu") },
    { v: "review", label: t("Tell us how we did") },
  ];

  // A sale made up to fill the receipt beside the form.
  const sample: PrintJob = {
    kind: "receipt",
    title: t("Test receipt"),
    channelLabel: t("Dine-in"),
    lines: [
      { name: t("Test line"), qty: 1, price: 4000, amount: 4000, note: null },
      { name: t("Another test line"), qty: 2, price: 3000, amount: 6000, note: null },
    ],
    total: 10000,
    tender: "cash",
    received: 10000,
    change: 0,
    reference: "1024",
    turnNo: 24,
    at: new Date().toISOString(),
    by: t("Cashier"),
  };
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <div className="receipt-setup" data-testid="receipt-setup">
      <div className="grid" style={{ gap: 14 }}>
        <Notice msg={msg} />

        <fieldset className="receipt-group">
          <legend>{t("Logo")}</legend>
          <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data address
              <img className="receipt-logo-thumb" src={logo} alt={t("Logo")} />
            ) : (
              <span className="muted">{t("The café's emblem prints until a logo is given.")}</span>
            )}
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              hidden
              aria-label={t("Logo")}
              onChange={(e) => chooseLogo(e.target.files?.[0])}
              data-testid="receipt-logo-file"
            />
            <button type="button" onClick={() => file.current?.click()} disabled={busy}>
              {logo ? t("Choose another logo") : t("Choose a logo")}
            </button>
            {logo && (
              <button
                type="button"
                onClick={takeLogoOff}
                disabled={busy}
                data-testid="receipt-logo-off"
              >
                {t("Take the logo off")}
              </button>
            )}
          </div>
          <p className="muted" style={{ fontSize: ".8rem", margin: "6px 0 0" }}>
            {t("It prints in black and white. A dark logo on a light background prints best.")}
          </p>
        </fieldset>

        <fieldset className="receipt-group">
          <legend>{t("The café's name")}</legend>
          <div className="receipt-fields">
            {text("nameAr", t("In Arabic"), { max: 60, rtl: true })}
            {text("nameCkb", t("In Kurdish"), { max: 60, rtl: true })}
          </div>
        </fieldset>

        <fieldset className="receipt-group">
          <legend>{t("Thank-you line")}</legend>
          <div className="receipt-fields">
            {text("thanksEn", t("In English"), { max: 120, ltr: true })}
            {text("thanksAr", t("In Arabic"), { max: 120, rtl: true })}
            {text("thanksCkb", t("In Kurdish"), { max: 120, rtl: true })}
          </div>
        </fieldset>

        <fieldset className="receipt-group">
          <legend>{t("Your pages")}</legend>
          <div className="receipt-fields">
            {text("instagram", "Instagram", { max: 60, ltr: true })}
            {text("facebook", "Facebook", { max: 80, ltr: true })}
            {text("tiktok", "TikTok", { max: 60, ltr: true })}
          </div>
        </fieldset>

        <fieldset className="receipt-group">
          <legend>{t("Wi-Fi")}</legend>
          <div className="receipt-fields">
            {text("wifiName", t("The Wi-Fi's name"), { max: 60, ltr: true })}
            {text("wifiPassword", t("Its password"), { max: 60, ltr: true })}
          </div>
        </fieldset>

        <fieldset className="receipt-group">
          <legend>{t("QR code")}</legend>
          <div className="seg" role="radiogroup" aria-label={t("QR code")}>
            {qrChoices.map((c) => (
              <button
                key={c.v}
                type="button"
                role="radio"
                aria-checked={form.qr === c.v}
                className={form.qr === c.v ? "active" : undefined}
                onClick={() => setForm({ ...form, qr: c.v })}
                disabled={busy}
                data-testid={`receipt-qr-${c.v}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {form.qr === "menu" &&
            text("menuUrl", t("The link to your menu (https://…)"), { max: 300, ltr: true })}
          {form.qr === "review" &&
            text("reviewUrl", t("The link to your reviews page (https://…)"), {
              max: 300,
              ltr: true,
            })}
          <p className="muted" style={{ fontSize: ".8rem", margin: "6px 0 0" }}>
            {t(
              "A customer scans it with a phone's camera. The menu can be a page or a PDF you share; for reviews, the link Google Maps gives to write one.",
            )}
          </p>
        </fieldset>

        <fieldset className="receipt-group">
          <legend>{t("A line at the foot")}</legend>
          {text("footer", t("An address, a phone number, opening hours…"), { max: 200 })}
        </fieldset>

        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={busy}
            data-testid="receipt-save"
          >
            {busy ? "…" : t("Save the receipt")}
          </button>
        </div>
      </div>

      <div className="receipt-preview-wrap">
        <div className="muted" style={{ fontSize: ".8rem", marginBottom: 6 }}>
          {t("As it prints")}
        </div>
        <ReceiptPreview
          job={sample}
          businessName={setup.name}
          receipt={{ ...form, name: setup.name, logo }}
          when={when}
        />
      </div>
    </div>
  );
}
