"use client";

import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * The owner's short home on a phone (E6): today's numbers, what needs them and
 * the alerts first; the charts and lists behind one tap. A wider screen shows
 * everything, with no button.
 */
export function PhoneMore({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn-soft phone-more-button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="phone-more"
      >
        {open ? t("Show less") : t("Show the rest: charts, stock, recent sales")}
      </button>
      <div className={`phone-more${open ? " open" : ""}`}>{children}</div>
    </>
  );
}
