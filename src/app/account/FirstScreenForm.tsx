"use client";

import { useState, useTransition } from "react";
import { setFirstScreenAction } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";

/**
 * The screen a person opens on (E6): their role's, or one they choose from
 * the screens the menu offers them. Saved as soon as it is picked.
 */
export function FirstScreenForm({
  screens,
  chosen,
  roleScreen,
}: {
  screens: { href: string; label: string }[];
  chosen: string | null;
  /** Their role's own first screen, by name. */
  roleScreen: string;
}) {
  const { t } = useT();
  const [value, setValue] = useState(chosen ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="grid" style={{ gap: 8, maxWidth: 380 }}>
      <select
        style={inputStyle}
        value={value}
        disabled={busy}
        aria-label={t("First screen")}
        data-testid="first-screen"
        onChange={(e) => {
          const href = e.target.value;
          const before = value;
          setValue(href);
          setMsg(null);
          start(async () => {
            const r = await setFirstScreenAction(href);
            if (!r.ok) setValue(before);
            if (r.message) setMsg({ ok: r.ok, text: r.message });
          });
        }}
      >
        <option value="">{t("My role's: {screen}", { screen: roleScreen })}</option>
        {screens.map((s) => (
          <option key={s.href} value={s.href}>
            {s.label}
          </option>
        ))}
      </select>
      <Notice msg={msg} />
    </div>
  );
}
