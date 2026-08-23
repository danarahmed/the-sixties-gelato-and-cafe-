/**
 * Idempotency for offline sync and external-order import.
 *
 * SYNC RULE: never "last write wins" for financial or inventory records. Every
 * offline transaction carries a UUID idempotency key; every external order maps
 * to a stable natural key (platform + external order id). Applying the same key
 * twice must be a no-op after the first success, so a re-sync or a re-import can
 * never double-count a sale or double-deduct inventory.
 *
 * In production the uniqueness is also enforced by a UNIQUE constraint in
 * PostgreSQL (see migrations). This in-memory model exists so the behaviour is
 * unit-tested independently of the database.
 */

export type SyncStatus = "pending" | "applied" | "failed";

export interface OfflineTransaction<T> {
  /** Client-generated UUID; the idempotency key. */
  idempotencyKey: string;
  deviceId: string;
  /** UTC ISO-8601 timestamp when the client created it. */
  createdAt: string;
  payload: T;
}

export interface ApplyOutcome<R> {
  status: "applied" | "duplicate";
  result: R;
}

/**
 * A registry that applies each idempotency key at most once. The `apply`
 * function is only invoked the first time a key is seen; later attempts return
 * the stored result and are reported as duplicates.
 */
export class IdempotencyRegistry<R> {
  private readonly results = new Map<string, R>();

  has(key: string): boolean {
    return this.results.has(key);
  }

  apply(key: string, compute: () => R): ApplyOutcome<R> {
    const existing = this.results.get(key);
    if (existing !== undefined) {
      return { status: "duplicate", result: existing };
    }
    const result = compute();
    this.results.set(key, result);
    return { status: "applied", result };
  }

  size(): number {
    return this.results.size;
  }
}

/** Stable natural key for an external delivery-platform order. */
export function externalOrderKey(platform: string, externalOrderId: string): string {
  return `${platform.toLowerCase()}::${externalOrderId}`;
}
