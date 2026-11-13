// Sale days (0106), through the real screens: the owner starts "20% off"
// today in Settings; the till shows it at the top and gives it by itself; the
// cashier, whose own cap is 10%, takes the money with no manager; the sale is
// kept as the sale day's, and its result is under Reports. Stopped, the till
// no longer gives it.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();

console.log("▸ the owner starts a sale day");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#sale-days");
  const part = page.getByTestId("sale-days");
  await part.waitFor({ timeout: 10000 });
  await part.getByTestId("sale-day-name").fill("E2E autumn sale");
  await part.getByTestId("sale-day-percent").fill("20");
  await part.getByTestId("sale-day-save").click();
  await part
    .locator('[data-testid="sale-day-row"][data-name="E2E autumn sale"]')
    .waitFor({ timeout: 10000 });
  check(
    last(`select percent::int from sale_day where name = 'E2E autumn sale'`) === "20",
    "kept: 20% off, from today",
  );
  await ctx.close();
}

console.log("▸ the till gives it by itself");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByTestId("sale-day-banner").waitFor({ timeout: 10000 });
  check(
    ((await page.getByTestId("sale-day-banner").textContent()) ?? "").includes("20% off"),
    "the top of the till says so",
  );
  await page.getByRole("button", { name: "Dine-in" }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  // An earlier suite may have changed the espresso's price: 20% of whatever it is now.
  const sold = last(
    `select gross_amount::int || '|' || discount_amount::int || '|' || coalesce(discount_reason, '')
       from sales_order order by placed_at desc limit 1`,
  ).split("|");
  const gross = Number(sold[0]);
  const off = Number(sold[1]);
  check(
    sold[2] === "Sale day: E2E autumn sale" && off > 0 && off <= gross * 0.2 && off >= gross * 0.2 - 500,
    `the full price and the sale day's 20% off apart, with no manager (${sold.join(" ")})`,
  );
  await ctx.close();
}

console.log("▸ its result, then stopped");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports/sale-days");
  await page.getByTestId("sale-day-result").waitFor({ timeout: 10000 });
  check(
    ((await page.getByTestId("sale-day-result").textContent()) ?? "").includes("1,000"),
    "Reports → Sale days shows the discount it gave",
  );
  await open(page, "/settings#sale-days");
  await page
    .locator('[data-testid="sale-day-row"][data-name="E2E autumn sale"]')
    .getByTestId("sale-day-stop")
    .click();
  await page.waitForTimeout(1500);
  check(
    last(`select (stopped_at is not null)::text from sale_day where name = 'E2E autumn sale'`) ===
      "true",
    "stopped",
  );
  await ctx.close();
}

await browser.close();
done("saledays");
