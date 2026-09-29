import "server-only";
/**
 * The sales analysis, the stock's value on a day, and what was bought (0051):
 * read as the signed-in person, whose permission the database checks.
 */
import { db, one } from "./client";
import {
  purchasesFrom,
  salesAnalysisFrom,
  stockValueFrom,
  type Purchases,
  type SalesAnalysis,
  type SalesDimension,
  type StockValue,
} from "@/lib/analysis";

export interface AnalysisQuery {
  from: string;
  to: string;
  by: SalesDimension;
  then: SalesDimension | null;
  channel: string | null;
  location: string | null;
  category: string | null;
  cashier: string | null;
}

export async function getSalesAnalysis(q: AnalysisQuery): Promise<SalesAnalysis> {
  const c = await db();
  return salesAnalysisFrom(
    one(
      await c.rpc("report_sales_analysis", {
        p_from: q.from,
        p_to: q.to,
        p_by: q.by,
        p_then: q.then,
        p_channel: q.channel,
        p_location: q.location,
        p_category: q.category,
        p_cashier: q.cashier,
      }),
      "the sales analysis",
    ),
  );
}

export async function getStockValue(asOf: string, location: string | null): Promise<StockValue> {
  const c = await db();
  return stockValueFrom(
    one(
      await c.rpc("inventory_valuation", { p_as_of: asOf, p_location: location }),
      "the stock's value",
    ),
  );
}

export async function getPurchases(from: string, to: string): Promise<Purchases> {
  const c = await db();
  return purchasesFrom(
    one(await c.rpc("report_purchases", { p_from: from, p_to: to }), "what was bought"),
  );
}
