import { describe, expect, it } from "vitest";
import { ID_BATCH, ROW_PAGE, readInBatches, readPaged } from "@/lib/db/batches";

/**
 * A table read as the hosted API reads it: the rows of the ids asked for, in
 * the table's own order, at most a page of them a call.
 */
function table(rowsOf: Record<string, number>, page = ROW_PAGE, failFor?: string) {
  const all = Object.entries(rowsOf).flatMap(([id, n]) =>
    Array.from({ length: n }, (_, i) => ({ owner: id, n: i })),
  );
  const asked: string[][] = [];
  const read = (batch: string[]) => {
    asked.push(batch);
    return {
      range: async (from: number, to: number) => {
        if (failFor && batch.includes(failFor)) {
          return { data: null, error: { message: "URI too long" } as never };
        }
        const mine = all.filter((r) => batch.includes(r.owner));
        return { data: mine.slice(from, Math.min(to + 1, from + page)), error: null };
      },
    };
  };
  return { read, asked, all };
}

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`);

describe("reading over a long list of ids", () => {
  it("asks for nothing when there is nothing to read", async () => {
    const t = table({});
    expect(await readInBatches([], t.read, "lines")).toEqual([]);
    expect(t.asked).toEqual([]);
  });

  it("keeps each request's list short, and reads every row once", async () => {
    const list = ids(250);
    const t = table(Object.fromEntries(list.map((id) => [id, 2])));
    const got = await readInBatches([...list, list[0] ?? ""], t.read, "lines");
    expect(t.asked.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(got).toHaveLength(500);
    expect(new Set(got.map((r) => `${r.owner}/${r.n}`)).size).toBe(500);
    // 100 ids are well under a request address's 8 KB.
    expect(`sales_order_id=in.(${list.slice(0, ID_BATCH).join(",")})`.length).toBeLessThan(4000);
  });

  it("reads a batch again in halves when its rows fill a page", async () => {
    const list = ids(4);
    const t = table(Object.fromEntries(list.map((id) => [id, 2])), 5);
    const got = await readInBatches(list, t.read, "lines", { page: 5 });
    expect(got).toHaveLength(8);
    expect(got.map((r) => r.owner)).toEqual(t.all.map((r) => r.owner));
    expect(t.asked.map((b) => b.length)).toEqual([4, 2, 2]);
  });

  it("reads one id's many rows a page at a time", async () => {
    const one = ids(1)[0] ?? "";
    const t = table({ [one]: 12 }, 5);
    const got = await readInBatches([one], t.read, "lines", { page: 5 });
    expect(got.map((r) => r.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(t.asked).toHaveLength(3);
  });

  it("fails as a whole when any batch fails, never with fewer rows", async () => {
    const list = ids(150);
    const t = table(Object.fromEntries(list.map((id) => [id, 1])), ROW_PAGE, list[120] ?? "");
    await expect(readInBatches(list, t.read, "refunds")).rejects.toThrow(
      "Could not load refunds: URI too long",
    );
  });
});

describe("reading every row of one read (round six)", () => {
  /** A read the hosted API answers a page at a time, at most `page` rows a call. */
  const pages = (n: number, page: number, failAt?: number) => {
    const all = Array.from({ length: n }, (_, i) => ({ id: i }));
    const asked: [number, number][] = [];
    const read = () => ({
      range: async (from: number, to: number) => {
        asked.push([from, to]);
        if (failAt !== undefined && from >= failAt)
          return { data: null, error: { message: "timeout" } as never };
        return { data: all.slice(from, Math.min(to + 1, from + page)), error: null };
      },
    });
    return { read, asked };
  };

  it("reads a page at a time until one comes back short", async () => {
    const p = pages(2500, 1000);
    const got = await readPaged(p.read, "hours");
    expect(got.map((r) => r.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i));
    expect(p.asked).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("a read that fills its last page exactly asks once more, and gets none", async () => {
    const p = pages(2000, 1000);
    expect(await readPaged(p.read, "hours")).toHaveLength(2000);
    expect(p.asked).toHaveLength(3);
    expect(await readPaged(pages(0, 1000).read, "hours")).toEqual([]);
  });

  it("any page's error is the read's: never a shorter list in its place", async () => {
    await expect(readPaged(pages(2500, 1000, 1000).read, "the hours on the clock")).rejects.toThrow(
      "Could not load the hours on the clock: timeout",
    );
  });
});
