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

import { whatsappNumber, whatsappLink } from "@/lib/whatsapp";

describe("a receipt by WhatsApp", () => {
  it("takes an Iraqi number as typed, with its country code", () => {
    expect(whatsappNumber("0750 123 4567")).toBe("9647501234567");
    expect(whatsappNumber("+964 750 123 4567")).toBe("9647501234567");
    expect(whatsappNumber("٠٧٥٠١٢٣٤٥٦٧")).toBe("9647501234567");
    expect(whatsappNumber("12")).toBeNull();
  });
  it("opens WhatsApp with the receipt written out", () => {
    expect(whatsappLink("9647501234567", "Total: 5,000 IQD")).toBe(
      "https://wa.me/9647501234567?text=Total%3A%205%2C000%20IQD",
    );
  });
});
