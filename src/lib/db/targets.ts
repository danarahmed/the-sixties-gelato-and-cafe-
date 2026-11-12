import "server-only";
/** Each product's target margin (0105): its own, else its category's; none before 0105. */
import { db } from "./client";

export interface ProductTarget {
  target: number | null;
  own: number | null;
}

export async function getProductTargets(): Promise<Map<string, ProductTarget>> {
  const c = await db();
  const r = await c.rpc("product_targets");
  if (r.error || !Array.isArray(r.data)) return new Map();
  return new Map(
    (r.data as Record<string, unknown>[]).map((x) => [
      String(x.product_id),
      {
        target: x.target == null ? null : Number(x.target),
        own: x.own == null ? null : Number(x.own),
      },
    ]),
  );
}
