import { describe, expect, it } from "vitest";
import { decodeQrOrder, encodeQrOrder, QR_ORDER_PREFIX } from "@/lib/qrOrder";

describe("the order a customer shows the waiter (0118)", () => {
  const espresso = "d1000000-0000-0000-0000-000000000001";
  const water = "d1000000-0000-0000-0000-000000000002";

  it("is read back at the till as it was chosen", () => {
    const code = encodeQrOrder([
      { variantId: espresso, qty: 2 },
      { variantId: water, qty: 1 },
    ]);
    expect(code.startsWith(QR_ORDER_PREFIX)).toBe(true);
    expect(code).not.toMatch(/[^A-Za-z0-9.-]/);
    expect(decodeQrOrder(code)).toEqual([
      { variantId: espresso, qty: 2 },
      { variantId: water, qty: 1 },
    ]);
  });

  it("leaves out what was not chosen, and caps a line at 99", () => {
    expect(
      decodeQrOrder(
        encodeQrOrder([
          { variantId: espresso, qty: 0 },
          { variantId: water, qty: 150 },
        ]),
      ),
    ).toEqual([{ variantId: water, qty: 99 }]);
  });

  it("is not read from anything else", () => {
    expect(decodeQrOrder("5012345678900")).toBeNull();
    expect(decodeQrOrder(`${QR_ORDER_PREFIX}`)).toBeNull();
    expect(decodeQrOrder(`${QR_ORDER_PREFIX}nothex-1`)).toBeNull();
    expect(decodeQrOrder(`${QR_ORDER_PREFIX}${"a".repeat(32)}-0`)).toBeNull();
  });
});
