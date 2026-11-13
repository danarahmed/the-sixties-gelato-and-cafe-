/**
 * Loyalty points as money owed (0113), as Settings reads it: on or off, a
 * point's value, the points customers hold, what they are worth, and what the
 * books owe for them (2150).
 */
export interface LoyaltyOwed {
  enabled: boolean;
  pointValue: number;
  pointsHeld: number;
  worth: number;
  owed: number;
}

export function loyaltyOwedFrom(v: unknown): LoyaltyOwed {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = (x: unknown) => (x === null || x === undefined || x === "" ? 0 : Number(x));
  return {
    enabled: o.enabled === true,
    pointValue: n(o.point_value),
    pointsHeld: n(o.points_held),
    worth: n(o.worth),
    owed: n(o.owed),
  };
}
