// Selling by weight (round seventeen, 0075), through the real screens: the
// owner ticks a size as sold by the kilo; at the till a tap asks its weight,
// typed in grams or one of the usual weights in one tap; each weighing is a
// line of its own, weighed again with a tap; the sale is recorded at the
// weight to the gram, and the receipt says it in grams.
import { chromium, check, done, open, openProduct, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const WATER = "d1000000-0000-0000-0000-000000000002";
/** The till on its menu, dine-in (the café's tables may open it on Tables). */
async function menu(page) {
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Dine-in" }).click();
}

console.log("▸ the owner sells the water by the kilo");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  const panel = await openProduct(page, "Golden water", "Sizes & prices");
  await panel.getByTestId("size-weighed").first().check();
  await page.waitForTimeout(1000);
  check(
    sql(`select sold_by_weight from product_variant where id = '${WATER}'`) === "t",
    "the size is sold by weight",
  );
  await ctx.close();
}

console.log("▸ the till asks its weight");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await menu(page);
  const tile = page.locator(".product-tile", { hasText: "Golden water" });
  check(((await tile.textContent()) ?? "").includes("/ kg"), "its tile says its price is a kilo's");
  await tile.click();
  const sheet = page.getByTestId("weight-sheet");
  await sheet.waitFor();
  await sheet.getByTestId("weight-input").fill("750");
  check(
    ((await sheet.textContent()) ?? "").includes("0.75 kg comes to 750 IQD"),
    "750 g at 1,000 a kilo: it says 750 before it is added",
  );
  await sheet.getByTestId("weight-add").click();
  await tile.click();
  await page.getByTestId("weight-sheet").getByTestId("weight-quick").nth(2).click();
  const weights = await page.getByTestId("line-weight").allTextContents();
  check(
    weights.join(", ") === "750 g, 500 g",
    `each weighing a line of its own: ${weights.join(", ")}`,
  );
  await page.getByTestId("line-weight").nth(1).click();
  await page.getByTestId("weight-sheet").getByTestId("weight-input").fill("1000");
  await page.getByTestId("weight-sheet").getByTestId("weight-add").click();
  check(
    (await page.getByTestId("line-weight").nth(1).textContent()) === "1 kg",
    "weighed again with a tap: 1 kg",
  );
  check(
    (await page.locator(".order-total strong").textContent()) === "1,750 IQD",
    "1.75 kg at 1,000 a kilo: 1,750 to pay",
  );
  await page.getByRole("button", { name: /^Card$/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    sql(`select string_agg(trim_scale(quantity)::text, ',' order by quantity) from sales_order_line
          where sales_order_id = (select id from sales_order order by created_at desc limit 1)`) ===
      "0.75,1",
    "recorded at the weights, to the gram",
  );
  await ctx.close();
}

// The water goes back to being sold by the bottle for the suites after this one.
sql(`update product_variant set sold_by_weight = false where id = '${WATER}'`);

await browser.close();
done("weight");
