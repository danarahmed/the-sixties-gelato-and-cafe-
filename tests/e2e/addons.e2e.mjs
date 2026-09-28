// Sizes and add-ons (0041, release P), through the real screens. On Products
// the owner gives a latte a second size, its recipe copied from the first;
// makes a group of milks the till asks for and a group of extras it offers;
// gives the oat milk a Large's own quantity; and chooses which sizes offer
// which. At the till a Large with oat milk and two extra shots is one sheet,
// priced as it is chosen and as the database charges it; the receipt and the
// barista's ticket list the add-ons under the drink. A table's bill printed
// before a price rise is paid at the price the customer saw. Orders and the
// report name the add-ons; a size is retired and brought back.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const BEANS = "c0000000-0000-0000-0000-000000000001";
const OAT = "c0000000-0000-0000-0000-0000000000f1";
const TABLE = "Add-on table";

// A latte of one size, oat milk in stock, and a table of its own.
sql(`insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock)
     values ('${OAT}', '${B}', 'ADD-OAT', 'Addon oat milk', 'ingredient', 'ml', 'volume', false);
     insert into dining_table (business_id, location_id, name) values ('${B}', default_location('${B}'), '${TABLE}');
     select test.act_as('owner@example.com');
     select record_opening_stock('${OAT}', 5000, 'ml', 2, 'Opening stock');
     select create_product('Addon latte', '{"dine_in": 3000, "takeaway": 3000}',
                           '[{"item_id": "${BEANS}", "qty": 18, "unit_code": "g"}]');`);
const oatOnHand = () =>
  Number(
    last(`select trim_scale((item_position('${B}', '${OAT}', default_location('${B}'))).qty)`),
  );

/** Printing is counted, not sent to a printer; each job's slips are kept to be read. */
async function till(who) {
  const s = await signIn(browser, who);
  await s.ctx.addInitScript(() => {
    window.__printed = 0;
    window.__slips = [];
    window.print = () => {
      window.__printed += 1;
      window.__slips.push(
        [...document.querySelectorAll(".print-slip > .slip")].map((slip) => ({
          ticket: slip.classList.contains("slip-ticket"),
          text: slip.textContent,
        })),
      );
    };
  });
  return s;
}

console.log("▸ the owner gives the latte a Large, its recipe copied from the one size it had");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  const card = page.locator(".card", { has: page.locator('input[value="Addon latte"]') });
  await card.getByTestId("sizes-addons").locator("summary").click();
  await card.getByTestId("size-add").click();
  const form = card.getByTestId("size-form");
  check(
    (await form.getByLabel("The size sold now is called").inputValue()) === "Regular",
    "the one size, named like the product, is to be called Regular",
  );
  await form.getByLabel("New size (English)").fill("Large");
  await form.getByLabel("Price · Dine-in").fill("4000");
  await form.getByLabel("Price · Takeaway").fill("4000");
  await form.getByTestId("size-save").click();
  await card.locator('[data-testid="size-row"][data-size="Large"]').waitFor({ timeout: 10000 });
  check(
    sql(`select string_agg(pv.name, ', ' order by pv.name) from product_variant pv
           join product p on p.id = pv.product_id where p.name = 'Addon latte'`) ===
      "Large, Regular",
    "the latte has two sizes: Regular and Large",
  );
  check(
    last(`select price_on(pv.id, 'dine_in', null, test.today()) from product_variant pv
            join product p on p.id = pv.product_id where p.name = 'Addon latte' and pv.name = 'Large'`) ===
      "4000",
    "the Large is 4,000",
  );
  check(
    last(`select string_agg(i.name || ' ' || trim_scale(rl.quantity) || ' ' || rl.unit_code, '; ')
            from product_variant pv join product p on p.id = pv.product_id
            join variant_recipe vr on vr.product_variant_id = pv.id
            join recipe_version rv on rv.recipe_id = vr.recipe_id
            join recipe_line rl on rl.recipe_version_id = rv.id join item i on i.id = rl.item_id
           where p.name = 'Addon latte' and pv.name = 'Large'`) === "Golden beans 18 g",
    "with the Regular's recipe copied",
  );

  console.log("▸ a group of milks the till asks for, and a group of extras");
  const manager = page.getByTestId("addons-manager");
  await manager.getByTestId("group-new").click();
  let group = manager.getByTestId("group-form");
  await group.getByLabel("Group name (English)").fill("Milk");
  await group.getByLabel("Fewest a line takes").fill("1");
  await group.getByLabel("Most a line takes").fill("1");
  check(
    (await group.textContent()).includes("The till says: Choose 1"),
    "the form says what the till will ask: Choose 1",
  );
  await group.getByTestId("group-save").click();
  const milk = manager.locator('[data-testid="addon-group-card"][data-group="Milk"]');
  await milk.waitFor({ timeout: 10000 });
  const addAddon = async (card, name, price, recipe) => {
    await card.getByTestId("addon-new").click();
    const f = card.getByTestId("addon-form");
    await f.getByLabel("Add-on name (English)").fill(name);
    await f.getByLabel("Price · Dine-in").fill(String(price));
    await f.getByLabel("Price · Takeaway").fill(String(price));
    if (recipe) {
      await f.getByLabel("Ingredient 1").selectOption({ label: recipe.item });
      await f.getByLabel("Quantity 1").fill(String(recipe.qty));
    }
    await f.getByTestId("addon-save").click();
    await card
      .locator(`[data-testid="addon-row"][data-addon="${name}"]`)
      .waitFor({ timeout: 10000 });
  };
  await addAddon(milk, "Whole milk", 0);
  await addAddon(milk, "Oat milk", 500, { item: "Addon oat milk", qty: 150 });
  check(
    (
      await milk.locator('[data-addon="Whole milk"] [data-testid="addon-prices"]').textContent()
    ).includes("Dine-in free"),
    "the whole milk costs nothing extra",
  );

  await manager.getByTestId("group-new").click();
  group = manager.getByTestId("group-form");
  await group.getByLabel("Group name (English)").fill("Extras");
  await group.getByLabel("Fewest a line takes").fill("0");
  await group.getByLabel("Most a line takes").fill("3");
  check(
    (await group.textContent()).includes("The till says: Up to 3"),
    "extras are optional: up to 3",
  );
  await group.getByTestId("group-save").click();
  const extras = manager.locator('[data-testid="addon-group-card"][data-group="Extras"]');
  await extras.waitFor({ timeout: 10000 });
  await addAddon(extras, "Extra shot", 750, { item: "Golden beans", qty: 18 });
  check(
    sql(`select string_agg(g.name || ' ' || g.min_select || '-' || coalesce(g.max_select::text, '') || ': '
                           || (select string_agg(m.name || ' ' || trim_scale(mp.price), ', ' order by m.sort_order)
                                 from modifier m join modifier_price mp on mp.modifier_id = m.id and mp.channel = 'dine_in'
                                where m.group_id = g.id), ' | ' order by g.sort_order)
           from modifier_group g`) ===
      "Milk 1-1: Whole milk 0, Oat milk 500 | Extras 0-3: Extra shot 750",
    "saved: Milk (one, whole or oat at 500) and Extras (up to three shots at 750)",
  );

  console.log("▸ the latte offers the milks with every size, the extras with the Large only");
  await card.getByTestId("product-addons-edit").click();
  await card.getByLabel("Milk with Addon latte").check();
  await card.getByLabel("Extras with Addon latte").check();
  const extrasChoice = card.locator(".product-addon-choice", { hasText: "Extras" });
  await extrasChoice.getByLabel("Only:").check();
  await extrasChoice.getByLabel("Large").check();
  await card.getByTestId("product-addons-save").click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-testid="product-addons-summary"]')].some(
        (p) => p.textContent === "Milk · Extras (Large)",
      ),
    null,
    { timeout: 10000 },
  );
  check(true, "the card says so: Milk · Extras (Large)");
  check(
    (await milk.textContent()).includes("Offered with Addon latte"),
    "and the group says who offers it",
  );

  console.log("▸ a Large's oat milk is 200 ml, every other size's 150");
  const oat = milk.locator('[data-addon="Oat milk"]');
  await oat.getByRole("button", { name: "What it uses…" }).click();
  await oat.getByLabel("Applies to").selectOption({ label: "Addon latte · Large" });
  await oat.getByLabel("Ingredient 1").selectOption({ label: "Addon oat milk" });
  await oat.getByLabel("Quantity 1").fill("200");
  await oat.getByRole("button", { name: "Save" }).click();
  await oat.getByText("Addon latte · Large: 200 ml Addon oat milk").waitFor({ timeout: 10000 });
  check(true, "the add-on lists every size's quantity and the Large's own");
  await ctx.close();
}
check(
  sql(`select string_agg(action, ',' order by action) from (select distinct action from audit_log
         where action in ('modifier_group.create', 'modifier.create', 'modifier_price.set', 'modifier.recipe',
                          'product.modifiers', 'product_variant.create')) a`) ===
    "modifier.create,modifier.recipe,modifier_group.create,modifier_price.set,product.modifiers,product_variant.create",
  "every change is on the audit trail",
);

console.log(
  "▸ at the till: a Large with oat milk and two extra shots, and a Regular with whole milk",
);
const oatBefore = oatOnHand();
{
  const { ctx, page } = await till("cashier");
  await open(page, "/pos");
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: "Dine-in", exact: true }).click();
  const latte = page.locator(".product-tile", { hasText: "Addon latte" });
  await latte.click();
  const sheet = page.getByTestId("options-sheet");
  await sheet.locator(".variant-btn", { hasText: "Large" }).click();
  check(
    (await sheet.getByTestId("addon-group").allTextContents())
      .map((g) => g.split(" · ")[0])
      .join(",") === "Milk,Extras",
    "the Large asks for its milk first, then offers its extras",
  );
  const add = sheet.getByRole("button", { name: /^Add · / });
  check(
    (await add.isDisabled()) && (await sheet.getByRole("status").textContent()) === "Choose Milk",
    "it cannot be added until a milk is chosen",
  );
  await sheet.locator(".addon-name", { hasText: "Oat milk" }).click();
  await sheet.locator(".addon-name", { hasText: "Extra shot" }).click();
  await sheet.getByRole("button", { name: "One more Extra shot" }).click();
  check(
    (await add.textContent()) === "Add · 6,000 IQD",
    "one comes to 6,000: 4,000, the oat milk 500 and two shots at 750",
  );
  await add.click();
  await latte.click();
  await sheet.locator(".variant-btn", { hasText: "Regular" }).click();
  check(
    (await sheet.getByTestId("addon-group").count()) === 1,
    "a Regular is offered the milks alone",
  );
  await sheet.locator(".addon-name", { hasText: "Whole milk" }).click();
  await sheet.getByRole("button", { name: /^Add · / }).click();
  const shown = await page.getByTestId("line-addons").allTextContents();
  check(
    shown.join(" | ") === "+ Oat milk, Extra shot ×2 | + Whole milk",
    "each line names its add-ons under it",
  );
  await page.getByRole("button", { name: /Card/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(true, "the sale is recorded at the till's 9,000: the database agrees");
  await page.getByRole("button", { name: /Print receipt \+ barista ticket/ }).click();
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  const [receipt, ticket] = await page.evaluate(() => window.__slips[0]);
  check(
    receipt.text.includes("+ Oat milk") &&
      receipt.text.includes("+ Extra shot ×2") &&
      receipt.text.includes("9,000"),
    "the receipt lists the add-ons under the drink, and the 9,000",
  );
  check(
    ticket.ticket && ticket.text.includes("+ Oat milk") && ticket.text.includes("+ Whole milk"),
    "and the barista's ticket says how to make each",
  );
  await ctx.close();
}
const sold = last(`select id from sales_order order by created_at desc limit 1`);
check(
  Number(last(`select net_amount from sales_order where id = '${sold}'`)) === 9000,
  "the sale is 9,000",
);
check(
  sql(`select string_agg(m.name || ' ' || trim_scale(m.qty) || ' x ' || trim_scale(m.unit_price), ', ' order by m.name)
         from sales_order_line_modifier m where m.sales_order_id = '${sold}'`) ===
    "Extra shot 2 x 750, Oat milk 1 x 500, Whole milk 1 x 0",
  "each add-on is kept with its line, at its price",
);
check(oatBefore - oatOnHand() === 200, "the Large's oat milk is its own 200 ml");

console.log("▸ a table's bill, printed before the oat milk goes up, is paid at the printed price");
{
  const { ctx, page } = await till("cashier");
  await open(page, "/pos");
  await page.getByRole("tab", { name: /Tables/ }).click();
  const tile = page.locator(".table-tile", { hasText: TABLE });
  await tile.click();
  const latte = page.locator(".product-tile", { hasText: "Addon latte" });
  await latte.click();
  const sheet = page.getByTestId("options-sheet");
  await sheet.locator(".variant-btn", { hasText: "Regular" }).click();
  await sheet.locator(".addon-name", { hasText: "Oat milk" }).click();
  await sheet.getByRole("button", { name: /^Add · / }).click();
  await page.getByRole("button", { name: /Save/ }).click();
  await page.getByText(`${TABLE} — saved`).waitFor({ timeout: 10000 });
  await tile.click();
  await page.getByRole("button", { name: /Print bill/ }).click();
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  const bill = await page.evaluate(() => window.__slips[0][0]);
  check(
    bill.text.includes("+ Oat milk") && bill.text.includes("3,500"),
    "the printed bill shows the oat milk under the latte, and 3,500",
  );
  sql(`select test.act_as('owner@example.com');
       select set_modifier_price((select id from modifier where name = 'Oat milk'), 'dine_in', 700);`);
  await open(page, "/pos");
  await page.getByRole("tab", { name: /Tables/ }).click();
  await tile.click();
  await page.getByRole("button", { name: /Card/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(true, "paid by card at the printed 3,500, though the oat milk is 700 now");
  await ctx.close();
}
const paid = last(`select id from sales_order order by created_at desc limit 1`);
check(
  Number(last(`select net_amount from sales_order where id = '${paid}'`)) === 3500 &&
    last(
      `select trim_scale(unit_price) from sales_order_line_modifier where sales_order_id = '${paid}'`,
    ) === "500",
  "the sale keeps the oat milk at 500",
);

console.log("▸ Orders and the report name the add-ons; a size is retired and brought back");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/orders");
  check(
    (await page.textContent("main")).includes("Addon latte — Large (+ Oat milk, Extra shot ×2)"),
    "Orders names a line with its add-ons",
  );
  await open(page, "/reports");
  const report = page.getByTestId("sizes-report");
  const text = await report.textContent();
  check(
    text.includes("Addon latte") && text.includes("Large") && text.includes("Regular"),
    "the report shows each size of the latte",
  );
  check(
    text.includes("Oat milk") && text.includes("Extra shot") && text.includes("Whole milk"),
    "and each add-on taken",
  );

  await open(page, "/products");
  const card = page.locator(".card", { has: page.locator('input[value="Addon latte"]') });
  await card.getByTestId("sizes-addons").locator("summary").click();
  const large = card.locator('[data-testid="size-row"][data-size="Large"]');
  await large.getByRole("button", { name: "Retire…" }).click();
  await large.getByLabel("Why it is retired").fill("Cups ran out");
  await large.getByRole("button", { name: "Retire it" }).click();
  await large.getByText("Retired").waitFor({ timeout: 10000 });
  check(
    last(`select pv.is_active from product_variant pv join product p on p.id = pv.product_id
           where p.name = 'Addon latte' and pv.name = 'Large'`) === "f",
    "the Large is off the till",
  );
  check(
    last(
      `select reason from audit_log where action = 'product_variant.update' order by id desc limit 1`,
    ) === "Cups ran out",
    "with the reason on the audit trail",
  );
  await large.getByRole("button", { name: "Bring it back" }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector('[data-testid="size-row"][data-size="Large"]')
        ?.textContent?.includes("Retired"),
    null,
    { timeout: 10000 },
  );
  check(
    last(`select pv.is_active from product_variant pv join product p on p.id = pv.product_id
           where p.name = 'Addon latte' and pv.name = 'Large'`) === "t",
    "and back on it",
  );
  await ctx.close();
}

console.log("▸ in Arabic");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, "/products");
  check(
    (await page.getByTestId("addons-manager").locator("h3").first().textContent()).trim() ===
      "الإضافات",
    "Products shows its add-ons in Arabic",
  );
  await ctx.close();
}

await browser.close();
done("addons");
