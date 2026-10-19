// End-of-day markdowns (round twenty-one, 0079), through the real screens: a
// lot of water must be sold within the hour; Production says so, with half
// off suggested; a tap marks it down, the till sells it at half, and it is
// stopped with a tap.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const WATER = "d1000000-0000-0000-0000-000000000002";
sql(`insert into item_lot (business_id, item_id, lot_code, use_by, location_id, left_base)
     select '00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000003', 'MD-' || now()::text,
            least(now() + interval '1 hour',
                  ((((now() at time zone b.timezone)::date + 1)::timestamp) at time zone b.timezone) - interval '1 minute'),
            (select id from location where kind = 'branch' order by created_at limit 1), 6
       from business b limit 1`);
const before = Number(sql(`select price_on('${WATER}', 'dine_in', null, current_date)`));

console.log("▸ Production: what must go today, half off suggested");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/production");
  const card = page.getByTestId("markdowns");
  await card.waitFor({ timeout: 10000 });
  const lot = card.locator('[data-testid="markdown-lot"][data-item="Golden water"]');
  check((await lot.count()) === 1, "the water must go within the hour");
  await lot.getByTestId("markdown-apply").first().click();
  await card.getByTestId("markdown-running").first().waitFor({ timeout: 10000 });
  check(
    sql(
      `select percent from price_markdown where product_variant_id = '${WATER}' and stopped_at is null`,
    ) === "50",
    "a tap marks it down: half off",
  );
  await ctx.close();
}

console.log("▸ the till sells it marked down");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Dine-in" }).click();
  const tile = page.locator(".product-tile", { hasText: "Golden water" });
  check(((await tile.textContent()) ?? "").includes("−50%"), "its tile says −50%");
  await ctx.close();
}

console.log("▸ stopped with a tap");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/production");
  await page.getByTestId("markdowns").getByTestId("markdown-stop").first().click();
  await page.waitForTimeout(1200);
  check(
    Number(sql(`select price_on('${WATER}', 'dine_in', null, current_date)`)) === before,
    "and the water is at its price again",
  );
  await ctx.close();
}

sql(`update item_lot set left_base = 0 where lot_code like 'MD-%'`);
await browser.close();
done("markdowns");
