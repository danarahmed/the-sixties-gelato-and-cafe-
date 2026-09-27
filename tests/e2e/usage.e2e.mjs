// Usage against the recipes (0039, release N): cups are counted, four
// espressos to take away use four of them, and the next count finds two cups
// fewer than the books. The Usage screen shows the two cups no recipe explains
// and what may explain them; with the owner's thresholds low enough, the
// dashboard names them. Earlier suites count and sell too: whatever came
// between, the difference is what the later counts found short.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const CUP = "c0000000-0000-0000-0000-000000000002";
const onHand = () =>
  Number(
    last(`select trim_scale((item_position('${B}', '${CUP}', default_location('${B}'))).qty)`),
  );
/** A count of the cups, by the counter, approved by the manager. */
const count = (qty) => {
  const id = last(`select test.act_as('counter@example.com');
                   select start_stock_count(array['${CUP}'::uuid])`);
  sql(`select test.act_as('counter@example.com');
       select record_count('${id}', '${CUP}', ${qty});
       select submit_stock_count('${id}')`);
  sql(`select test.act_as('manager@example.com'); select approve_stock_count('${id}')`);
};

console.log("▸ cups counted, four taken away, and two fewer found at the next count");
sql(`select test.act_as('manager@example.com');
     select receive_goods((select id from supplier where business_id = '${B}' and is_active order by name, id limit 1),
       '[{"item_id":"${CUP}","qty":10,"unit_price":50}]', p_confirm => true)`);
count(onHand());
sql(`select test.act_as('cashier@example.com');
     select record_sale(gen_random_uuid(), 'takeaway', 'card', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":4}]')`);
count(onHand() - 2);
const truth = JSON.parse(
  last(`select test.act_as('owner@example.com');
        select row_to_json(r) from report_usage_variance(current_date, current_date) r
         where item_id = '${CUP}'`),
);
check(Number(truth.variance) === 2, "the database finds the two cups the counts are short");

{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/inventory/usage");
  const row = page.locator('[data-testid="usage-row"][data-item="Golden cup"]');
  check((await row.count()) === 1, "the Usage screen lists the cups");
  check(
    (await row.getByTestId("usage-difference").textContent()).trim() === "+2 each",
    "two more used than the recipes explain",
  );
  const text = await row.textContent();
  check(
    text.includes(`${Number(truth.variance_percent).toLocaleString("en-US")}%`) &&
      text.includes(`${Math.round(Number(truth.variance_value)).toLocaleString("en-US")} IQD`),
    "with its share of what the recipes used, and its value, as the database has them",
  );
  check(
    (await row.getByTestId("usage-factors").textContent()).includes(
      "More was used than the recipes say: bigger portions, waste not recorded, or sales not rung up",
    ),
    "and what may explain it",
  );
  await row.locator("summary").click();
  check(
    (await row.getByTestId("usage-product").first().textContent()).startsWith(
      "Golden espresso — Single:",
    ),
    "opened, it names the product whose sales used them",
  );
  await ctx.close();
}

console.log("▸ past the owner's thresholds, the dashboard names them");
sql(`select test.act_as('owner@example.com');
     select set_alert_thresholds('{"usage_variance_percent": 1, "usage_variance_min": 1}')`);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  check(
    (await page.textContent("main")).includes("Golden cup: 2 each more used than the recipes say"),
    "the alert: two cups more used than the recipes say, between the last two counts",
  );
  await ctx.close();
}
sql(`select test.act_as('owner@example.com');
     select set_alert_thresholds('{"usage_variance_percent": 10, "usage_variance_min": 5000}')`);

console.log("▸ in Arabic, and not for a cashier");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, "/inventory/usage");
  check(
    (await page.locator("h1").textContent()).trim() === "الاستهلاك",
    "the screen reads in Arabic",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/inventory/usage");
  check(
    new URL(page.url()).pathname !== "/inventory/usage",
    "a cashier is sent to their own screen",
  );
  await ctx.close();
}

await browser.close();
done("usage");
