import type { PostgrestError } from "@supabase/supabase-js";

/** Ids in one request at most: 100 are about 3.7 KB of its address. */
export const ID_BATCH = 100;
/** The hosted API returns at most 1,000 rows a call. */
export const ROW_PAGE = 1000;

type Page = PromiseLike<{ data: unknown; error: PostgrestError | null }>;

/**
 * The rows of a read over a list of ids that may be long (the lines of 500
 * sales), in the read's own order for each id:
 * - a batch of ids at a time, since a long list does not fit in one request's
 *   address;
 * - a batch whose rows fill a page is read again in halves, since the hosted
 *   API returns at most 1,000 rows a call and says nothing of the rest;
 * - one id with a page of rows or more is read a page at a time, in the
 *   read's order, which then must end with a column of its own (the id).
 * Any batch's error is the read's, as with `rows`: never a shorter list
 * standing in for a failure.
 */
export async function readInBatches<T = Record<string, unknown>>(
  ids: readonly string[],
  read: (batch: string[]) => { range(from: number, to: number): Page },
  what: string,
  sizes: { batch?: number; page?: number } = {},
): Promise<T[]> {
  const batch = sizes.batch ?? ID_BATCH;
  const page = sizes.page ?? ROW_PAGE;
  const get = async (b: string[], start: number): Promise<T[]> => {
    const res = await read(b).range(start, start + page - 1);
    if (res.error) throw new Error(`Could not load ${what}: ${res.error.message}`);
    return (Array.isArray(res.data) ? res.data : []) as T[];
  };
  const readBatch = async (b: string[]): Promise<T[]> => {
    const first = await get(b, 0);
    if (first.length < page) return first;
    if (b.length > 1) {
      const half = Math.ceil(b.length / 2);
      const parts = await Promise.all([readBatch(b.slice(0, half)), readBatch(b.slice(half))]);
      return parts.flat();
    }
    const out = [...first];
    for (let start = page; ; start += page) {
      const more = await get(b, start);
      out.push(...more);
      if (more.length < page) return out;
    }
  };
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += batch) batches.push(unique.slice(i, i + batch));
  return (await Promise.all(batches.map(readBatch))).flat();
}
