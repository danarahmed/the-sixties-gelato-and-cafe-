/** Equipment and its depreciation (round twenty-four, 0081). */

export interface Asset {
  id: string;
  name: string;
  account: string;
  cost: number;
  salvage: number;
  lifeMonths: number;
  startOn: string;
  paidFrom: string | null;
  disposedOn: string | null;
  eachMonth: number;
  depreciated: number;
  bookValue: number;
}

export interface AssetBoard {
  pendingMonths: number;
  assets: Asset[];
}

const n = (v: unknown) => (v == null ? 0 : Number(v));

export function assetBoard(d: unknown): AssetBoard {
  const r = (d ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.assets) ? (r.assets as Record<string, unknown>[]) : [];
  return {
    pendingMonths: n(r.pending_months),
    assets: list.map((a) => ({
      id: String(a.id),
      name: String(a.name ?? ""),
      account: String(a.account ?? "1500"),
      cost: n(a.cost),
      salvage: n(a.salvage),
      lifeMonths: n(a.life_months),
      startOn: String(a.start_on),
      paidFrom: a.paid_from == null ? null : String(a.paid_from),
      disposedOn: a.disposed_on == null ? null : String(a.disposed_on),
      eachMonth: n(a.each_month),
      depreciated: n(a.depreciated),
      bookValue: n(a.book_value),
    })),
  };
}

/** What the equipment still in use is worth in the books, all together. */
export function bookValueOf(assets: readonly Asset[]): number {
  return assets.filter((a) => !a.disposedOn).reduce((s, a) => s + a.bookValue, 0);
}
