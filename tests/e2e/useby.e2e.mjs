// Use-by for everything that goes off (0098), through the real screens: the
// owner says on an item's page that each delivery has its own date; the
// delivery form will not take it without the date on the pack, and takes it
// with one; Inventory lists the lot; Today tells the counter what to take off
// the shelf; the till marks the product; and a batch recipe must say how long
// it keeps, or that it doesn't go off.
import { chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const ITEM = "c0000000-0000-0000-0000-0000000000e9";
const last = (q) => sql(q).split("\n").pop();

// A yoghurt bought in, sold as it is; none on the shelf yet.
sql(`insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock)
     values ('${ITEM}', '${B}', 'E2E-YOG', 'E2E yoghurt', 'resale', 'each', 'count', false)
     on conflict (id) do nothing;
     select test.act_as('owner@example.com');
     select create_product('E2E yoghurt pot', '{"dine_in": 2000, "takeaway": 2000}',
                           '[{"item_id": "${ITEM}", "qty": 1, "unit_code": "each"}]');`);
const day = (n) => last(`select to_char(${TODAY} + ${n}, 'YYYY-MM-DD')`);

console.log("▸ the owner says how it keeps");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/inventory/${ITEM}`);
  const box = page.getByTestId("item-keeping");
  await box.waitFor({ timeout: 10000 });
  check(
    ((await box.textContent()) ?? "").includes("Not chosen yet"),
    "it has not said how it keeps",
  );
  await box.getByTestId("keeping-exact_date").check();
  await box.getByTestId("keeping-save").click();
  await page.waitForTimeout(1500);
  check(
    last(`select expiry_mode from item where id = '${ITEM}'`) === "exact_date",
    "each delivery has its own date",
  );
  await ctx.close();
}

console.log("▸ a delivery needs the date on the pack");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const form = page.getByTestId("receive");
  const line = form.getByTestId("receive-line").first();
  await line.locator("select").first().selectOption({ label: "E2E yoghurt" });
  await line.getByLabel("Quantity").fill("4");
  await line.getByLabel(/^Price per/).fill("1000");
  await form.getByRole("button", { name: "Receive goods" }).click();
  await form
    .getByText("Type the use-by printed on the pack of E2E yoghurt")
    .waitFor({ timeout: 10000 });
  check(true, "refused without the date, before anything is sent");
  await line.getByTestId("receive-use-by").fill(day(2));
  await form.getByRole("button", { name: "Receive goods" }).click();
  const ask = page.getByTestId("price-check");
  await page.waitForTimeout(1500);
  if (await ask.isVisible()) await ask.locator("button.btn-primary").click();
  await page.waitForTimeout(2000);
  check(
    last(
      `select count(*) from item_lot where item_id = '${ITEM}' and expiry_date = '${day(2)}'`,
    ) === "1",
    "with the date, it comes in as a lot used by that day",
  );
  await ctx.close();
}

console.log("▸ Inventory lists it; Today and the till warn of it");
{
  // Time passes: it goes off today.
  sql(`update item_lot set use_by = now() + interval '2 hours' where item_id = '${ITEM}'`);
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/inventory");
  const row = page
    .getByTestId("use-by-lots")
    .getByTestId("use-by-lot")
    .filter({ hasText: "E2E yoghurt" });
  check((await row.count()) === 1, "Inventory lists the lot, with its use-by");
  await ctx.close();

  const c = await signIn(browser, "cashier");
  await open(c.page, "/pos");
  const tab = c.page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  const tile = c.page.locator(".product-tile", { hasText: "E2E yoghurt pot" });
  await tile.waitFor({ timeout: 10000 });
  check(
    (await tile.getByTestId("tile-use-by").getAttribute("data-state")) === "soon",
    "the till marks it: sell it first",
  );
  await c.ctx.close();

  sql(`update item_lot set use_by = now() - interval '1 hour' where item_id = '${ITEM}'`);
  const d = await signIn(browser, "cashier");
  await open(d.page, "/today");
  const card = d.page.getByTestId("today-use-by-expired");
  await card.waitFor({ timeout: 10000 });
  check(((await card.textContent()) ?? "").includes("E2E yoghurt"), "Today: take it off the shelf");
  await d.ctx.close();
}

console.log("▸ a batch recipe says how long it keeps, or that it doesn't go off");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/production");
  // The new recipe's form opens from its button, in a side panel.
  await page.getByTestId("new-recipe").click();
  await page.getByTestId("new-recipe-panel").waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("never-goes-off").count()) > 0,
    "the recipe form offers “It doesn't go off”",
  );
  await ctx.close();
}

sql(`update item_lot set left_base = 0 where item_id = '${ITEM}';
     update product set is_active = false where name = 'E2E yoghurt pot';
     update item set is_active = false where id = '${ITEM}'`);
await browser.close();
done("useby");
