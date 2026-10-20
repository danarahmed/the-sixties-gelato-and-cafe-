// Pre-orders with deposits (round eighteen, 0076), through the real screens:
// the cashier takes a cake ordered for tomorrow from what is on the till, with
// part paid now; the kitchen sees it on Production; collected, its deposit
// pays its part and the rest is paid with a tap; another is cancelled by a
// manager, the deposit kept.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
/** The till on its menu, take-away (the café's tables may open it on Tables). */
async function menu(page) {
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Takeaway" }).click();
}
const espresso = (page) => page.locator(".product-tile", { hasText: "Golden espresso" });
const ESPRESSO = "d1000000-0000-0000-0000-000000000001";
const money = (n) => `${Number(n).toLocaleString("en-US")} IQD`;

/** Two espressos on the till, taken as a pre-order for `name`, `paid` now by card. */
async function take(page, name, paid) {
  await espresso(page).click();
  await espresso(page).click();
  await page.getByTestId("preorders-button").click();
  const form = page.getByTestId("preorder-form");
  await form.waitFor();
  await form.getByTestId("preorder-name").fill(name);
  await form.getByTestId("preorder-deposit").fill(String(paid));
  await form.getByRole("radio", { name: "Card" }).click();
  await form.getByTestId("preorder-take").click();
  await page.locator(`[data-testid="preorder-row"]`, { hasText: name }).waitFor({ timeout: 10000 });
}

console.log("▸ a pre-order taken from the till, part paid now");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await menu(page);
  await take(page, "Shilan", 2000);
  check(
    sql(`select total = 2 * price_on('${ESPRESSO}', 'takeaway', location_id, business_local_date(business_id, now()))
                and deposit = 2000 and status = 'open'
           from pre_order where customer_name = 'Shilan'`) === "t",
    "Shilan's two espressos at today's take-away price, 2,000 paid ahead, open",
  );
  check(
    ((await page.getByTestId("preorder-row").first().textContent()) ?? "").includes(
      "Paid 2,000 IQD ahead",
    ),
    "the till's list says what was paid ahead",
  );
  await page.getByTestId("preorders-close").click();
  check(
    (await page.locator(".order-line").count()) === 0,
    "the till's order is cleared once it is a pre-order",
  );
  await take(page, "Rawa", 1000);
  await ctx.close();
}

console.log("▸ the kitchen sees what was ordered ahead");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/production");
  const card = page.getByTestId("preorders-to-make");
  await card.waitFor({ timeout: 10000 });
  check(
    (await card.getByTestId("preorder-to-make").count()) === 2,
    "both, by the day they are collected",
  );
  await ctx.close();
}

console.log("▸ collected: the deposit pays its part, the rest paid with a tap");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByTestId("preorders-button").click();
  await page
    .locator('[data-testid="preorder-row"]', { hasText: "Shilan" })
    .getByTestId("preorder-collect")
    .click();
  const collecting = page.getByTestId("preorder-collecting");
  const left = Number(
    sql(`select trim_scale(total - deposit) from pre_order where customer_name = 'Shilan'`),
  );
  check(
    ((await collecting.textContent()) ?? "").includes(`To pay now: ${money(left)}`),
    `${money(left)} left to pay: the total less what was paid ahead`,
  );
  await collecting.getByTestId("preorder-pay").nth(1).click(); // card
  await page.getByTestId("preorder-collected").waitFor({ timeout: 10000 });
  check(
    sql(`select string_agg(tender_type::text || ' ' || trim_scale(amount) || case when pre_order_id is null then ''
                  else ' deposit' end, ', ' order by amount)
           from sales_tender where sales_order_id = (select sales_order_id from pre_order where customer_name = 'Shilan')`) ===
      `other 2000 deposit, card ${left}`,
    "the sale paid 2,000 by its deposit and the rest by card",
  );
  check(
    sql(`select status from pre_order where customer_name = 'Shilan'`) === "collected",
    "and the pre-order is collected",
  );
  await ctx.close();
}

console.log("▸ cancelled by a manager, the deposit kept");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/pos");
  await page.getByTestId("preorders-button").click();
  await page
    .locator('[data-testid="preorder-row"]', { hasText: "Rawa" })
    .getByTestId("preorder-cancel")
    .click();
  const cancelling = page.getByTestId("preorder-cancelling");
  await cancelling.getByRole("textbox").fill("Did not come");
  await cancelling.getByTestId("preorder-keep").click();
  await cancelling.getByTestId("preorder-cancel-confirm").click();
  await page
    .locator('[data-testid="preorder-row"]', { hasText: "Rawa" })
    .waitFor({ state: "detached" });
  check(
    sql(`select status || ' ' || deposit_kept from pre_order where customer_name = 'Rawa'`) ===
      "cancelled true",
    "cancelled, and its deposit kept",
  );
  await ctx.close();
}

console.log("▸ a customer the café knows: found by their number, only the time to choose");
{
  sql(`insert into customer (business_id, full_name, phone)
       select '00000000-0000-0000-0000-0000000000b1', 'Hawre Karim', '+9647504445566'
        where not exists (select 1 from customer where phone = '+9647504445566')`);
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await menu(page);
  await espresso(page).click();
  await page.getByTestId("preorders-button").click();
  const form = page.getByTestId("preorder-form");
  await form.waitFor();
  await form.getByTestId("preorder-phone").fill("07504445566");
  await form.getByTestId("preorder-find").click();
  await form.getByTestId("preorder-who").waitFor({ timeout: 10000 });
  check(
    ((await form.getByTestId("preorder-who").textContent()) ?? "").includes("Hawre Karim") &&
      (await form.getByTestId("preorder-name").count()) === 0,
    "their name comes from the customer: nothing to type",
  );
  // Tomorrow: today's 16:30 is gone by the evening, and a time gone is refused.
  await form.getByRole("radio", { name: "Tomorrow" }).click();
  await form.getByTestId("preorder-time").fill("16:30");
  await form.getByTestId("preorder-take").click();
  await page
    .locator(`[data-testid="preorder-row"]`, { hasText: "Hawre Karim" })
    .waitFor({ timeout: 10000 });
  check(
    sql(`select customer_phone || ' ' || to_char(pickup_at at time zone 'Asia/Baghdad', 'HH24:MI')
                || ' ' || ((pickup_at at time zone 'Asia/Baghdad')::date = (now() at time zone 'Asia/Baghdad')::date + 1)
           from pre_order where customer_name = 'Hawre Karim'`) === "+9647504445566 16:30 true",
    "taken with their number, for tomorrow at 16:30",
  );
  await ctx.close();
}

await browser.close();
done("preorders");
