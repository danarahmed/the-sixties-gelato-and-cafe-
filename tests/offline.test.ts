/**
 * Selling without internet (round fifteen, 0073): what the till takes offline,
 * what it keeps and sends, and the database's refusal it offers to record at
 * today's price.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  OFFLINE_KEY,
  loadOffline,
  nextOfflineNo,
  offlineBlock,
  offlineTotals,
  priceChanged,
  saveOffline,
  type OfflineSale,
} from "@/components/pos/offline";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const sale = (over: Partial<OfflineSale> = {}): OfflineSale => ({
  key: "73000000-0000-0000-0000-000000000001",
  soldAt: "2026-10-19T09:30:00.000Z",
  soldBy: null,
  soldByName: "Sara",
  place: "branch-1",
  no: 1,
  channel: "takeaway",
  payments: [{ type: "cash", amount: 5000, received: 10000 }],
  lines: [{ variantId: "v1", qty: 2, addons: [] }],
  expectedNet: "5000",
  platformOrderNo: null,
  title: "Quick sale",
  job: null,
  state: "waiting",
  error: null,
  ...over,
});

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe("what the till takes offline", () => {
  const quick = {
    kind: "quick" as const,
    channel: "takeaway" as const,
    discount: null,
    customer: null,
  };
  it("takes a quick sale", () => {
    expect(offlineBlock(quick)).toBeNull();
    expect(offlineBlock({ ...quick, channel: "talabat" })).toBeNull();
  });
  it("takes a bill on a table, as it was saved (0082)", () => {
    const saved = JSON.stringify([[], ["percent", "10"]]);
    const bill = { ...quick, kind: "bill" as const, tabId: "t1", saved, savedCustomer: "" };
    // Its saved discount stays: the database checked it then.
    expect(
      offlineBlock({ ...bill, discount: { kind: "percent", value: "10" } as never }),
    ).toBeNull();
    // A new or changed one needs the database.
    expect(offlineBlock({ ...bill, discount: { kind: "percent", value: "20" } as never })).toMatch(
      /discount/,
    );
    expect(offlineBlock({ ...bill, saved: JSON.stringify([[], null]) })).toBeNull();
    expect(
      offlineBlock({ ...bill, saved: JSON.stringify([[], null]), customer: { id: "c" } as never }),
    ).toMatch(/customer/);
    // A bill opened offline is sent as a quick sale.
    expect(offlineBlock({ ...quick, kind: "bill", tabId: null })).toBeNull();
  });
  it("leaves what needs the database's answer", () => {
    expect(offlineBlock({ ...quick, channel: "direct_delivery" })).toMatch(/own delivery/);
    expect(offlineBlock({ ...quick, discount: { kind: "percent", value: "10" } as never })).toMatch(
      /discount/,
    );
    expect(offlineBlock({ ...quick, customer: { id: "c" } as never })).toMatch(/customer/);
  });
});

describe("what the till keeps", () => {
  it("keeps the sales in order and reads them back", () => {
    expect(loadOffline()).toEqual([]);
    expect(saveOffline([sale(), sale({ key: "k2", no: 2 })])).toBe(true);
    expect(loadOffline().map((s) => s.no)).toEqual([1, 2]);
    saveOffline([]);
    expect(localStorage.getItem(OFFLINE_KEY)).toBeNull();
  });

  it("leaves out what it cannot read", () => {
    localStorage.setItem(
      OFFLINE_KEY,
      JSON.stringify([sale(), { key: 1 }, null, sale({ lines: [] })]),
    );
    expect(loadOffline()).toHaveLength(1);
    localStorage.setItem(OFFLINE_KEY, "not json");
    expect(loadOffline()).toEqual([]);
  });

  it("numbers each sale after the last, never again", () => {
    expect(nextOfflineNo([])).toBe(1);
    expect(nextOfflineNo([])).toBe(2);
    expect(nextOfflineNo([sale({ no: 9 })])).toBe(10);
  });

  it("counts what waits at this branch, and its cash", () => {
    const list = [
      sale(),
      sale({ key: "k2", payments: [{ type: "card", amount: 2500, received: null }] }),
      sale({ key: "k3", state: "attention", error: "x" }),
      sale({ key: "k4", place: "branch-2" }),
    ];
    expect(offlineTotals(list, "branch-1")).toEqual({
      waiting: 2,
      attention: 1,
      count: 3,
      cash: 10000,
    });
    expect(offlineTotals(list, null).count).toBe(4);
  });
});

describe("a price changed since", () => {
  it("is told apart from other refusals", () => {
    expect(
      priceChanged(
        "The total is 3000 now, not the 2500 shown: a price has changed. The till has the new prices; tell the customer, then take payment again",
      ),
    ).toBe(true);
    expect(priceChanged("Open the drawer first: on the till, count the cash in it")).toBe(false);
    expect(priceChanged(null)).toBe(false);
  });
});
