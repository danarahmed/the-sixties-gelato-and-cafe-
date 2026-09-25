"use client";

import { useT } from "@/lib/i18n/I18nProvider";

/**
 * A screen that failed to load says so. It never falls back to an empty
 * table, which would be indistinguishable from "nothing recorded yet".
 */
export default function ScreenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();
  return (
    <div className="card" style={{ maxWidth: 640, borderColor: "var(--err)" }}>
      <h2 style={{ marginTop: 0 }}>{t("This screen could not be loaded")}</h2>
      <p>
        {t(
          "The information could not be read from the database, so nothing is shown rather than something incomplete. Nothing has been changed.",
        )}
      </p>
      {process.env.NODE_ENV !== "production" && (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: ".8rem" }}>{error.message}</pre>
      )}
      <p className="muted" style={{ fontSize: ".82rem" }}>
        {error.digest
          ? t("If it keeps happening, tell the owner, and quote reference {ref}.", {
              ref: error.digest,
            })
          : t("If it keeps happening, tell the owner.")}
      </p>
      <button className="btn-primary" onClick={reset}>
        {t("Try again")}
      </button>
    </div>
  );
}
