"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * Prints the report on the screen, or saves it as a PDF from the print dialog
 * (release AA): the page as it stands, with its print heading, without the
 * menu, the forms or the buttons (globals.css, html.printing-report). The
 * browser lays it out, so Arabic and Kurdish print right to left.
 */
export function PrintButton() {
  const { t } = useT();
  useEffect(() => {
    const done = () => document.documentElement.classList.remove("printing-report");
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.classList.add("printing-report");
        window.print();
      }}
      data-testid="print-report"
    >
      {t("Print or save as PDF")}
    </button>
  );
}
