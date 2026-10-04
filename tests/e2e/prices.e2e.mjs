// The price watch (round five), through the real screens: the beans come in
// a third dearer than the delivery before; Reports leads to the price watch,
// which says so, by how much and when, and what it does to every size of the
// espresso — what a serving uses of the beans times the rise, the margin
// before and after, and the price that keeps it; the dashboard says the beans
// came in dearer and leads there; the page speaks Arabic and Kurdish; and once
// the delivery is corrected to its true price, the watch reads it so.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const BEANS = "c0000000-0000-0000-0000-000000000001";
const last = (q) => sql(q).split("\n").pop();
const supplier = last(
  `select id from supplier where business_id = '${B}' and is_active order by name, id limit 1`,
);
const receive = (qty, price) =>
  last(`select test.act_as('manager@example.com');
        select receive_goods('${supplier}', '[{"item_id":"${BEANS}","qty":${qty},"unit_price":${price}}]',
                             p_confirm => true) ->> 'receipt_id'`);

console.log("▸ the beans come in a third dearer than the delivery before");
receive(1000, 30);
const dearer = receive(1000, 40);
// What the price history says of the two, newest first: a gram at 30, then at 40.
const history = last(`select test.act_as('owner@example.com');
  select string_agg(trim_scale(round(coalesce(landed_per_base, cost_per_base), 2))::text, ',')
    from (select * from item_price_history('${BEANS}') limit 2) h`);
check(history === "40,30", `the beans' last two deliveries: ${history} a gram`);

console.log("▸ the price watch: by how much, and what it does to the espresso");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  await page.getByTestId("to-prices").click();
  await page.waitForURL(/\/reports\/prices/);
  await page.waitForLoadState("networkidle");
  const card = page.locator('[data-testid="price-rise"][data-item="Golden beans"]');
  await card.waitFor({ timeout: 15000 });
  check(
    (await card.getByTestId("price-rise-change").textContent()).includes("33%") &&
      (await card.textContent()).includes("30,000 IQD → 40,000 IQD a kg"),
    "the beans came in 33% dearer: 30,000 to 40,000 IQD a kilo",
  );
  // What a dine-in espresso uses of the beans today, in grams, and so what the rise adds to it.
  const [variant, g] = last(`select test.act_as('owner@example.com');
      select l.variant_id || ' ' || trim_scale(sum(l.quantity * coalesce(u.factor_to_base, 1)))
        from menu_recipe_lines() l
        join product_variant v on v.id = l.variant_id join product p on p.id = v.product_id
        left join item_unit u on u.item_id = l.item_id and u.code = l.unit_code
       where p.name = 'Golden espresso' and l.item_id = '${BEANS}'
         and (l.channels is null or 'dine_in' = any(l.channels))
       group by l.variant_id order by l.variant_id limit 1`).split(" ");
  const grams = Number(g);
  const row = card.locator(
    `[data-testid="price-touch"][data-variant="${variant}"][data-channel="dine_in"]`,
  );
  const cells = await row.locator("td").allTextContents();
  const adds = Number(cells[4].replace(/\D/g, ""));
  const [before, after] = cells[3].split(/[→←]/).map((x) => Number(x.replace(/[^\d.]/g, "")));
  check(
    grams > 0 && adds === Math.round(grams * 10) && after < before,
    `a dine-in espresso uses ${grams} g: the rise adds ${adds} IQD to it, and its margin falls from ${before}% to ${after}%`,
  );
  const keep = await row.getByTestId("price-keep").textContent();
  const price = Number(cells[2].replace(/\D/g, ""));
  check(
    keep === "—" || Number(keep.replace(/\D/g, "")) > price,
    `with the price that keeps its margin: ${keep}`,
  );
  await ctx.close();
}

console.log("▸ the dashboard says so, and leads there");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  const link = page.locator('a[href="/reports/prices"]');
  check(
    (await link.count()) >= 1 &&
      /dearer[^]*see what it does to the margins/.test(await link.first().textContent()),
    "the beans came in dearer, and a way to the price watch",
  );
  await ctx.close();
}

console.log("▸ the price watch in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/reports/prices");
  const words = await english(page, "/reports/prices");
  check(
    words.length === 0,
    `in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ the delivery corrected: the watch reads it as it stands now");
{
  const line = last(`select id from goods_receipt_line where goods_receipt_id = '${dearer}'`);
  last(`select test.act_as('manager@example.com');
        select correct_receipt('${dearer}',
          jsonb_build_array(jsonb_build_object('line_id', '${line}', 'item_id', '${BEANS}',
                                               'qty', 1000, 'unit_price', 31)),
          null, null, 'The beans were 31 a gram: a typing mistake', true)`);
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports/prices");
  check(
    (await page.locator('[data-testid="price-rise"][data-item="Golden beans"]').count()) === 0,
    "corrected to 31 a gram, 3% over the delivery before: no rise worth saying",
  );
  await ctx.close();
}

await browser.close();
done("prices");
