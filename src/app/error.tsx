"use client";

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
  return (
    <div className="card" style={{ maxWidth: 640, borderColor: "var(--err)" }}>
      <h2 style={{ marginTop: 0 }}>This screen could not be loaded</h2>
      <p>
        The information could not be read from the database, so nothing is shown rather than
        something incomplete. Nothing has been changed.
      </p>
      {process.env.NODE_ENV !== "production" && (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: ".8rem" }}>{error.message}</pre>
      )}
      <p className="muted" style={{ fontSize: ".82rem" }}>
        If it keeps happening, tell the owner
        {error.digest ? ` and quote reference ${error.digest}` : ""}.
      </p>
      <button className="btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
