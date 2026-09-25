/**
 * Whether a failed database call is a refusal or an unknown.
 *
 * A function the database ran and refused answers with a status and a
 * PostgreSQL code: nothing was written, and the person can correct and try
 * again. But when no answer came back — the connection dropped, timed out, or
 * a gateway in between gave up (502, 503, 504) — the call may have finished
 * after all. The database client returns that as an ordinary error (status 0,
 * no code) rather than throwing, so it must be recognised here: a sale that
 * was in fact recorded must be retried with the same key, never rung again
 * with a new one (audit P0-4).
 */
export interface RpcFailure {
  code?: string | null;
  message?: string | null;
}

export function isUncertainFailure(
  error: RpcFailure | null | undefined,
  status?: number | null,
): boolean {
  if (!error) return false;
  // No HTTP answer at all.
  if (!status) return !error.code;
  // A gateway gave up, or the database could not be reached for an answer.
  if (status >= 502) return true;
  return /^PGRST00[0-3]$/.test(error.code ?? "");
}

export const UNCERTAIN_MESSAGE =
  "The database did not answer, so this may have been saved. Check before trying again.";
