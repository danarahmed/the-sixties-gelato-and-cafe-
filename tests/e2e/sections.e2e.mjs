// The café and the bakery on one till (round sixteen, 0074), through the real
// screens: the owner adds Café and Bakery in one tap and gives each category
// its part on Products & Recipes; the till shows both, or one, as the device
// was left; a branch that sells only the bakery shows only its products; and
// Reports shows each part's takings and profit.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const ESPRESSO = "d0000000-0000-0000-0000-000000000001";
const WATER = "d0000000-0000-0000-0000-000000000002";
const BUSINESS = "00000000-0000-0000-0000-0000000000b1";

// Two categories, the espresso in one and the water in the other.
sql(`insert into product_category (business_id, name) select '${BUSINESS}', n
       from unnest(array['Golden drinks', 'Golden bakes']) n
      where not exists (select 1 from product_category where business_id = '${BUSINESS}' and name = n);
     update product set category_id = (select id from product_category where name = 'Golden drinks')
      where id = '${ESPRESSO}';
     update product set category_id = (select id from product_category where name = 'Golden bakes')
      where id = '${WATER}';`);

console.log("▸ the owner adds Café and Bakery, and gives each category its part");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  const card = page.getByTestId("sections");
  await card.getByTestId("sections-ready").click();
  await card.getByTestId("section-row").nth(1).waitFor({ timeout: 10000 });
  check(
    sql("select string_agg(name || '/' || name_ckb, ', ' order by position) from menu_section") ===
      "Café/کافێ, Bakery/نانەواخانە",
    "one tap adds Café and Bakery, named in the three languages",
  );
  const pick = (category) =>
    card.locator(`[data-testid="category-section"][data-category="${category}"]`);
  await pick("Golden drinks").selectOption({ label: "Café" });
  await page.waitForTimeout(800);
  await pick("Golden bakes").selectOption({ label: "Bakery" });
  await page.waitForTimeout(800);
  check(
    sql(`select string_agg(c.name || '=' || s.name, ', ' order by c.name)
           from product_category c join menu_section s on s.id = c.section_id`) ===
      "Golden bakes=Bakery, Golden drinks=Café",
    "each category is in its part",
  );
  await ctx.close();
}

console.log("▸ one till sells both; a till can show one part, and keeps to it");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const parts = page.getByTestId("till-sections");
  await parts.waitFor({ timeout: 10000 });
  const tile = (name) => page.locator(".product-tile", { hasText: name });
  check(
    (await tile("Golden espresso").count()) === 1 && (await tile("Golden water").count()) === 1,
    "all parts: the espresso and the water on the one till",
  );
  await parts.getByRole("tab", { name: /Bakery/ }).click();
  check(
    (await tile("Golden espresso").count()) === 0 && (await tile("Golden water").count()) === 1,
    "the bakery's part: the water, not the espresso",
  );
  await page.reload();
  await page.getByTestId("till-sections").waitFor();
  check((await tile("Golden espresso").count()) === 0, "the till opens on the part it was left on");
  const find = page.locator('input[type="search"]').first();
  await find.fill("espresso");
  check((await tile("Golden espresso").count()) === 1, "a search finds in every part");
  await find.fill("");
  await page.getByTestId("till-sections").getByRole("tab", { name: /^All/ }).click();
  check((await tile("Golden espresso").count()) === 1, "and back to all");
  await ctx.close();
}

console.log("▸ a branch that sells only the bakery");
{
  const owner = await signIn(browser, "owner");
  await open(owner.page, "/settings");
  const branch = owner.page.locator('[data-testid="place-sections"]').first();
  await branch.getByRole("button", { name: "Bakery" }).click();
  await owner.page.waitForTimeout(1000);
  check(
    sql("select count(*) from location_section") === "1",
    "the branch sells the bakery's part only",
  );
  const till = await signIn(browser, "cashier");
  await open(till.page, "/pos");
  check(
    (await till.page.locator(".product-tile", { hasText: "Golden espresso" }).count()) === 0 &&
      (await till.page.locator(".product-tile", { hasText: "Golden water" }).count()) === 1,
    "its till shows only the bakery's products",
  );
  await open(owner.page, "/settings");
  await owner.page
    .locator('[data-testid="place-sections"]')
    .first()
    .getByRole("button", { name: "Bakery" })
    .click();
  await owner.page.waitForTimeout(1000);
  check(sql("select count(*) from location_section") === "0", "untick it: it sells everything");
  await open(till.page, "/pos");
  check(
    (await till.page.locator(".product-tile", { hasText: "Golden espresso" }).count()) === 1,
    "and its till shows everything again",
  );
  await owner.ctx.close();
  await till.ctx.close();
}

console.log("▸ Reports: each part's takings and profit");
{
  sql(`select test.act_as('cashier@example.com');
       select record_sale(gen_random_uuid(), 'dine_in', 'card',
         '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2},
           {"variant_id": "d1000000-0000-0000-0000-000000000002", "qty": 1}]'::jsonb)`);
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const report = page.getByTestId("sections-report");
  await report.waitFor({ timeout: 10000 });
  const names = await report
    .getByTestId("section-line")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-name")));
  check(
    names[0] === "Café" && names.includes("Bakery"),
    `each part in its order, its takings beside it: ${names.join(", ")}`,
  );
  await ctx.close();
}

await browser.close();
done("sections");
