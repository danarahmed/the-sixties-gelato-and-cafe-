// Meal deals and prices by the time of day (0089). The owner makes a deal on
// Products & Recipes — two waters for 1,500 at a table — and a price by the
// hour for the espresso that runs now. The cashier's till shows the espresso
// at the hour's price and the deal as a tile; the deal goes on the order as
// one block at its price, taken off whole, and paid: each water sold as
// itself at its own price, the 500 the deal gives away their discount. A
// deal is not kept on a bill. Sales analysis lists the deal sold. The price
// stopped, the till is back to the usual price.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const WATER = "d1000000-0000-0000-0000-000000000002";
const ESPRESSO = "d1000000-0000-0000-0000-000000000001";
// A window around now in the café's time: from a minute ago for two hours.
const tz = last(`select timezone from business limit 1`);
const from = last(`select to_char((now() - interval '1 minute') at time zone '${tz}', 'HH24:MI')`);
const until = last(`select to_char((now() + interval '2 hours') at time zone '${tz}', 'HH24:MI')`);
const usualEspresso = Number(
  last(`select price from channel_price where product_variant_id = '${ESPRESSO}' and channel = 'dine_in'
         order by effective_from desc, created_at desc limit 1`),
);

console.log("▸ the owner makes a deal, and a price by the hour");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  const deals = page.getByTestId("deals-card");
  await deals.locator("summary").click();
  await deals.getByTestId("deal-new").click();
  const form = deals.getByTestId("deal-form");
  await form.getByTestId("deal-name").fill("Two waters");
  const places = form.getByTestId("deal-place");
  await places.nth(0).selectOption(`v:${WATER}`);
  await places.nth(1).selectOption(`v:${WATER}`);
  await form.getByTestId("deal-price-dine_in").fill("1500");
  await form.getByTestId("deal-save").click();
  await deals
    .locator('[data-testid="deal-row"][data-deal="Two waters"]')
    .waitFor({ timeout: 15000 });
  check(
    last(
      `select count(*) from deal_slot s join deal d on d.id = s.deal_id where d.name = 'Two waters'`,
    ) === "2",
    "a deal of two waters, at 1,500 at a table",
  );

  const hours = page.getByTestId("time-prices-card");
  await hours.locator("summary").click();
  await hours.getByTestId("time-price-new").click();
  const f = hours.getByTestId("time-price-form");
  await f.getByTestId("time-price-size").selectOption(ESPRESSO);
  await f.getByTestId("time-price-price").fill("1500");
  await f.getByTestId("hours-from").fill(from);
  await f.getByTestId("hours-until").fill(until);
  await f.getByTestId("time-price-save").click();
  await hours.getByTestId("time-price-row").first().waitFor({ timeout: 15000 });
  check(
    ((await hours.getByTestId("time-price-row").first().textContent()) ?? "").includes("On now"),
    `the espresso at 1,500 from ${from} until ${until}: on now`,
  );
  await ctx.close();
}

console.log("▸ the till");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Dine-in" }).click();
  const espresso = page.locator(".product-tile", { hasText: "Golden espresso" });
  check(
    ((await espresso.locator(".price").textContent()) ?? "").includes("1,500"),
    "the espresso at the hour's price, 1,500",
  );
  const deal = page.locator('[data-testid="till-deal"][data-deal="Two waters"]');
  await deal.waitFor({ timeout: 10000 });
  await deal.click();
  const block = page.getByTestId("order-deal");
  await block.waitFor({ timeout: 10000 });
  check(
    ((await block.getByTestId("deal-amount").textContent()) ?? "").includes("1,500"),
    "two waters on the order as one deal, at 1,500",
  );
  await block.getByTestId("deal-remove").click();
  check((await page.getByTestId("order-deal").count()) === 0, "taken off whole");
  await deal.click();
  await page.getByTestId("order-deal").waitFor();
  check((await page.locator(".order-total strong").textContent()) === "1,500 IQD", "1,500 to pay");
  const before = Number(last(`select count(*) from sale_deal`));
  await page.getByRole("button", { name: /^Card$/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 15000 });
  check(
    Number(last(`select count(*) from sale_deal`)) === before + 1,
    "the deal is kept with the sale",
  );
  const order = last(`select sales_order_id from sale_deal order by created_at desc limit 1`);
  check(
    last(`select string_agg(trim_scale(unit_price) || '-' || trim_scale(line_discount), ',' order by id)
            from sales_order_line where sales_order_id = '${order}'`)
      .split(",")
      .sort()
      .join(",") === "1000-250,1000-250",
    "each water sold at its own 1,000, the 500 given away shared as their discount",
  );
  check(
    last(
      `select gross_amount || ' ' || discount_amount || ' ' || net_amount from sales_order where id = '${order}'`,
    ) === "2000 500 1500",
    "2,000 at their prices, 500 off, 1,500 paid",
  );

  // A deal is sold at the counter, not kept on a bill.
  await deal.click();
  await page.getByTestId("order-deal").waitFor();
  await page.getByRole("button", { name: "Keep open, pay later" }).click();
  await page
    .getByText("A deal is sold at the counter: pay for it now, not on a bill.")
    .waitFor({ timeout: 10000 });
  check(true, "a deal is not kept on a bill: it is paid at the counter");
  await page
    .getByTestId("deal-remove")
    .first()
    .click()
    .catch(() => {});
  await ctx.close();
}

console.log("▸ Reports, and the hour's price stopped");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports/sales");
  const row = page.locator('[data-testid="deal-sold"][data-deal="Two waters"]');
  await row.waitFor({ timeout: 15000 });
  check(
    ((await row.textContent()) ?? "").includes("500"),
    "Sales analysis lists the deal and the 500 it gave away",
  );
  await open(page, "/products");
  const hours = page.getByTestId("time-prices-card");
  await hours.locator("summary").click();
  await hours.getByTestId("time-price-stop").first().click();
  await hours.getByTestId("time-price-row").first().waitFor({ state: "detached", timeout: 15000 });
  await open(page, "/pos");
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Dine-in" }).click();
  const espresso = page.locator(".product-tile", { hasText: "Golden espresso" });
  check(
    ((await espresso.locator(".price").textContent()) ?? "").includes(
      usualEspresso.toLocaleString("en"),
    ),
    `stopped: the espresso is back to ${usualEspresso.toLocaleString("en")}`,
  );
  await ctx.close();
}
// The deal off again, for the suites after this one.
sql(`update deal set is_active = false where name = 'Two waters'`);

void BASE;
await browser.close();
done("deals");
