/**
 * The customer's screen (plan 11, item 4): a second window on the till's own
 * computer, on a screen turned to the customer, showing what the cashier
 * rings up and the total, then what was paid and the change. The till tells
 * it through the browser itself (BroadcastChannel): nothing leaves the
 * computer.
 */
export const CUSTOMER_SCREEN_CHANNEL = "sixties.customer-screen";

export type CustomerScreenMessage =
  | { kind: "idle"; business: string }
  | {
      kind: "order";
      business: string;
      lines: { name: string; qty: number; amount: number | null }[];
      total: number;
    }
  | { kind: "paid"; business: string; total: number; change: number | null };
