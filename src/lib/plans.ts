/** The plans and types of business (0108), as the screens name them. Pure: server and browser both read it. */

export type Plan = "starter" | "complete" | "business";
export type BusinessType = "cafe" | "bakery" | "restaurant" | "supplier";

export const PLAN_LABEL: Record<Plan, string> = {
  starter: "Starter",
  complete: "Complete",
  business: "Business",
};

export const TYPE_LABEL: Record<BusinessType, string> = {
  cafe: "Café",
  bakery: "Bakery",
  restaurant: "Restaurant",
  supplier: "Supplier",
};
