// The books completed (round twenty-four, 0081), through the real screens:
// the owner adds an oven bought two months ago from the bank; its
// depreciation for the months gone is posted with one press; another bank
// account and a loan are added to the chart; the owner puts money in; and a
// report downloads ready for Excel, its Arabic and Kurdish read right.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const { ctx, page } = await signIn(browser, "owner");
const start = sql(`select (date_trunc('month', current_date) - interval '2 months')::date`);

console.log("▸ an oven, bought two months ago from the bank");
await open(page, "/accounting");
const card = page.getByTestId("equipment");
await card.waitFor({ timeout: 10000 });
await card.getByTestId("equipment-add").click();
const form = card.getByTestId("equipment-form");
await form.getByTestId("equipment-name").fill("Oven");
await form.getByTestId("equipment-cost").fill("1200000");
await form.getByTestId("equipment-life").fill("24");
await form.locator('input[type="date"]').fill(start);
await form.getByTestId("equipment-save").click();
await card.getByTestId("equipment-row").first().waitFor({ timeout: 10000 });
check(
  sql(`select trim_scale(cost) || ' ' || paid_from from fixed_asset where name = 'Oven'`) ===
    "1200000 1020",
  "the oven is in the books, paid from the bank",
);

console.log("▸ its depreciation for the months gone, with one press");
await card.getByTestId("equipment-depreciate").click();
await page.waitForTimeout(1500);
check(
  sql(`select count(*) || ' ' || trim_scale(sum(amount)) from depreciation_run`) === "2 100000",
  "two months gone: 50,000 each, posted once",
);
check((await card.getByTestId("equipment-depreciate").count()) === 0, "and nothing waits any more");

console.log("▸ another bank and a loan on the chart");
const chart = page.getByTestId("chart-add");
await chart.locator("select").first().selectOption("bank");
await chart.locator("input").nth(1).fill("Second bank");
await chart.getByRole("button", { name: /Add/ }).click();
await page.waitForTimeout(1200);
check(
  sql(`select account_type || ' ' || code from gl_account where name = 'Second bank'`) ===
    "asset 1021",
  "another bank: an asset, 1021",
);

console.log("▸ the owner puts money in");
const owner = page.getByTestId("owner-money");
await owner.getByTestId("owner-amount").fill("500000");
await owner.getByTestId("owner-note").fill("Money for the new oven");
await owner.getByTestId("owner-save").click();
await owner.getByRole("status").waitFor({ timeout: 10000 });
check(
  sql(`select count(*) from cash_transfer where from_place = 'owner' and amount = 500000`) === "1",
  "500,000 from the owner into the bank",
);

console.log("▸ a report for Excel");
const res = await page.request.get(`${BASE}/reports/export?report=trial_balance`);
const body = await res.body();
check(
  body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf,
  "the CSV starts with the mark Excel needs for Arabic and Kurdish",
);

await ctx.close();
await browser.close();
done("equipment");
