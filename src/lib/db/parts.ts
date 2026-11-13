import "server-only";
/** Plans, parts and the type of business (0108). Null before 0108. */
import { db } from "./client";

export type Plan = "starter" | "complete" | "business";
export type BusinessType = "cafe" | "bakery" | "restaurant" | "supplier";

export interface BusinessPart {
  part: string;
  label: string;
  inPlan: boolean;
  defaultOn: boolean;
  on: boolean;
  reason: string | null;
}

export interface BusinessParts {
  plan: Plan;
  businessType: BusinessType;
  parts: BusinessPart[];
}

const PLANS: Plan[] = ["starter", "complete", "business"];
const TYPES: BusinessType[] = ["cafe", "bakery", "restaurant", "supplier"];
export const asPlan = (v: unknown): Plan => (PLANS.includes(v as Plan) ? (v as Plan) : "business");
export const asType = (v: unknown): BusinessType =>
  TYPES.includes(v as BusinessType) ? (v as BusinessType) : "cafe";

export function toBusinessParts(d: unknown): BusinessParts | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  return {
    plan: asPlan(o.plan),
    businessType: asType(o.business_type),
    parts: (Array.isArray(o.parts) ? (o.parts as Record<string, unknown>[]) : []).map((p) => ({
      part: String(p.part),
      label: String(p.label ?? p.part),
      inPlan: p.in_plan === true,
      defaultOn: p.default_on === true,
      on: p.on === true,
      reason: typeof p.reason === "string" ? p.reason : null,
    })),
  };
}

export async function getBusinessParts(): Promise<BusinessParts | null> {
  const c = await db();
  const r = await c.rpc("business_parts");
  if (r.error) return null;
  return toBusinessParts(r.data);
}

export interface AdminBusiness {
  id: string;
  name: string;
  plan: Plan;
  businessType: BusinessType;
  places: number;
  people: number;
  practice: boolean;
}

export function toAdminBusinesses(d: unknown): AdminBusiness[] {
  return (Array.isArray(d) ? (d as Record<string, unknown>[]) : []).map((b) => ({
    id: String(b.id),
    name: String(b.name ?? ""),
    plan: asPlan(b.plan),
    businessType: asType(b.business_type),
    places: Number(b.places ?? 0),
    people: Number(b.people ?? 0),
    practice: b.practice === true,
  }));
}

/** Every business, for the system's administrators; null for anyone else, or before 0108. */
export async function getAdminBusinesses(): Promise<AdminBusiness[] | null> {
  const c = await db();
  const r = await c.rpc("admin_businesses");
  if (r.error) return null;
  return toAdminBusinesses(r.data);
}
