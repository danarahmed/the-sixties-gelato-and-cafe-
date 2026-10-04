import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { db, str } from "@/lib/db/client";
import { getStaff } from "@/lib/db/staff";
import { dateTimeIn } from "@/lib/dates";
import type { SetupCounts } from "@/lib/setup";

/**
 * Getting set up (round seven): how far a café has come, as the person sees
 * it — its stock items, suppliers, kitchen recipes, products and tables in
 * use, the people working there and how many have no PIN yet (for those who
 * keep the staff), and its sales, with the day of the first. Counts only:
 * nothing is read row by row but the staff list.
 */
export async function getSetupCounts(timezone: string, readsStaff: boolean): Promise<SetupCounts> {
  const c = await db();
  const counted = (
    what: string,
    res: PromiseLike<{ count: number | null; error: PostgrestError | null }>,
  ) =>
    Promise.resolve(res).then((r) => {
      if (r.error) throw new Error(`Could not count ${what}: ${r.error.message}`);
      return r.count ?? 0;
    });
  const head = { count: "exact" as const, head: true };
  const [items, suppliers, recipes, products, tables, sales, first, staff] = await Promise.all([
    counted("the stock items", c.from("item").select("id", head).eq("is_active", true)),
    counted("the suppliers", c.from("supplier").select("id", head).eq("is_active", true)),
    // What the kitchen makes: a recipe with an output (0046); a product's own recipe has none.
    counted(
      "the recipes",
      c.from("recipe").select("id", head).eq("is_active", true).not("output_item_id", "is", null),
    ),
    counted("the products", c.from("product").select("id", head).eq("is_active", true)),
    counted("the tables", c.from("dining_table").select("id", head).eq("is_active", true)),
    counted("the sales", c.from("sales_order").select("id", head).neq("status", "open")),
    c
      .from("sales_order")
      .select("placed_at")
      .neq("status", "open")
      .order("placed_at")
      .limit(1)
      .then((r) => {
        if (r.error) throw new Error(`Could not load the first sale: ${r.error.message}`);
        return r.data?.[0] ? str(r.data[0].placed_at) : null;
      }),
    readsStaff ? getStaff() : Promise.resolve(null),
  ]);
  const working = (staff ?? []).filter((p) => p.worksNow);
  return {
    items,
    suppliers,
    recipes,
    products,
    tables,
    staff: working.length,
    staffWithoutPin: working.filter((p) => !p.hasPin).length,
    sales,
    firstSaleOn: first ? dateTimeIn(timezone, first).slice(0, 10) : null,
  };
}
