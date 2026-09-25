// Production through the real screens: the owner sets up a base and a
// flavour made from it, kept in pans; a barista records two batches of the
// base and is never shown a cost; the owner records a batch of the flavour,
// weighed short, and sees what it cost; a manager cancels it; and a product's
// recipe is changed from today on Products & Recipes. (Run last: it adds a
// barista, and the espresso's costs are read as the other suites left them.)
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";

// Someone who makes the gelato, and three ingredients with a known cost:
// milk at 1.5 a ml, sugar at 1.2 a g, pistachio paste at 30 a g.
sql(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com')
       on conflict do nothing;
     insert into app_user (business_id, full_name, email, auth_user_id)
     values ('${B}', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e');
     insert into user_role (app_user_id, role) select id, 'barista' from app_user where email = 'barista@example.com';
     select test.act_as('owner@example.com');
     select create_item('E2E milk', 'ingredient', 'ml', 'volume', p_units => '[{"code":"L","label":"L","factor":1000}]',
                        p_opening_qty => 20000, p_opening_unit_cost => 1.5, p_opening_reason => 'the opening count');
     select create_item('E2E sugar', 'ingredient', 'g', 'mass', p_units => '[{"code":"kg","label":"kg","factor":1000}]',
                        p_opening_qty => 10000, p_opening_unit_cost => 1.2, p_opening_reason => 'the opening count');
     select create_item('E2E paste', 'ingredient', 'g', 'mass', p_opening_qty => 2000, p_opening_unit_cost => 30,
                        p_opening_reason => 'the opening count');`);

/**
 * How far the stock ledger is from Inventory (1200). Other suites leave it where
 * they leave it (an owner's control correction, say); batches must not move it.
 */
const inventoryGap = () =>
  sql(
    `select test.act_as('owner@example.com'); select difference from report_reconciliation(test.today()) where check_key = 'inventory'`,
  )
    .split("\n")
    .pop();
const gapBefore = inventoryGap();

/** Fill one line of a recipe editor. */
async function line(page, n, item, qty, unit) {
  if (n > 1) await page.getByRole("button", { name: "+ Add ingredient" }).click();
  await page.getByLabel(`Ingredient ${n}`).selectOption({ label: item });
  await page.getByLabel(`Quantity ${n}`).fill(qty);
  if (unit) await page.getByLabel(`Unit ${n}`).selectOption(unit);
}

console.log("▸ owner sets up a base, and a flavour made from it kept in pans");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/production");
  await page.getByText("➕ Add something you make").click();
  await page.getByLabel("Name of what it makes").fill("E2E base");
  await page.getByLabel("How it is counted").selectOption("volume");
  await page.getByLabel("One batch makes", { exact: true }).fill("5");
  await page.getByLabel("Unit one batch makes").selectOption("L");
  await line(page, 1, "E2E milk", "4", "L");
  await line(page, 2, "E2E sugar", "800", "g");
  check(
    (await page.getByTestId("batch-cost").textContent()).includes("6,960 IQD") &&
      (await page.getByTestId("batch-cost").textContent()).includes("1,392 IQD per L"),
    "one batch of the base costs 6,960 IQD: 1,392 IQD a litre",
  );
  await page.getByLabel("How to make it").fill("Heat to 85°C, cool overnight");
  await page.getByRole("button", { name: "Add it" }).click();
  await page.getByText("Added “E2E base”.").waitFor({ timeout: 10000 });

  await page.getByLabel("Name of what it makes").fill("E2E pistachio gelato");
  await page.getByLabel("How it is counted").selectOption("weight");
  await page.getByLabel("Container", { exact: true }).fill("Pan");
  await page.getByLabel("What a container holds").fill("5");
  await page.getByLabel("Unit a container holds").selectOption("kg");
  await page.getByLabel("One batch makes", { exact: true }).fill("1");
  await page.getByLabel("Unit one batch makes").selectOption("pan");
  await line(page, 1, "E2E base", "4.5", "L");
  await line(page, 2, "E2E paste", "500", "g");
  check(
    await page.getByText("No cost yet for E2E base: never bought or made").isVisible(),
    "a base never made yet is flagged: it has no cost",
  );
  await page.getByRole("button", { name: "Add it" }).click();
  await page.getByText("Added “E2E pistachio gelato”.").waitFor({ timeout: 10000 });
  check(
    sql(
      `select i.item_type || ' ' || i.base_unit_code || ' ' || string_agg(u.code || '=' || trim_scale(u.factor_to_base), ',' order by u.code)
         from item i join item_unit u on u.item_id = i.id where i.name = 'E2E pistachio gelato' group by i.item_type, i.base_unit_code`,
    ) === "finished_good g kg=1000,pan=5000",
    "the gelato is a new item, weighed in g and kg, kept in pans of 5 kg",
  );
  await ctx.close();
}

console.log("▸ a barista records two batches of the base, and is shown no cost");
{
  const { ctx, page } = await signIn(browser, "barista");
  await open(page, "/production");
  check(
    (await page.locator("nav").innerText()).includes("Production"),
    "the barista is offered Production",
  );
  await page.getByLabel("What did you make").selectOption({ label: "E2E base" });
  await page.getByLabel("Batches").fill("2");
  const preview = await page.getByTestId("batch-preview").innerText();
  check(
    /E2E milk\s*8 L/.test(preview) && /E2E sugar\s*1,600 g/.test(preview),
    "before recording, the barista sees what it will use: 8 L of milk, 1,600 g of sugar",
  );
  await page.getByRole("button", { name: "Record batch" }).click();
  await page.getByText("Recorded: 10 L of E2E base into stock.").waitFor({ timeout: 10000 });
  check(
    !(await page.locator("main").innerText()).includes("IQD"),
    "no cost anywhere on the barista's page",
  );
  check(
    (await page.getByText("➕ Add something you make").count()) === 0 &&
      (await page.getByRole("button", { name: /^Cancel/ }).count()) === 0,
    "and no way to change recipes or cancel batches",
  );
  await ctx.close();
}

console.log("▸ owner records a batch of the flavour, weighed short");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/production");
  await page.getByLabel("What did you make").selectOption({ label: "E2E pistachio gelato" });
  await page.getByLabel("What came out", { exact: true }).fill("4.6");
  await page.getByLabel("Unit of what came out").selectOption("kg");
  await page.getByLabel("Note").fill("a little short");
  const preview = await page.getByTestId("batch-preview").innerText();
  check(
    preview.includes("0.4 kg less than the recipe's 5 kg"),
    "the preview says what came out against the recipe",
  );
  check(
    preview.includes("21,264 IQD") && preview.includes("4,623 IQD per kg"),
    "and what it costs: 21,264 IQD, 4,623 IQD a kg",
  );
  await page.getByRole("button", { name: "Record batch" }).click();
  await page
    .getByText(
      "Recorded: 4.6 kg of E2E pistachio gelato into stock. The ingredients cost 21,264 IQD.",
    )
    .waitFor({ timeout: 10000 });
  const moved =
    sql(`select string_agg(i.name || ' ' || trim_scale(m.base_quantity_signed) || ' = ' || m.value, '; '
                                       order by m.base_quantity_signed, i.name)
                       from inventory_movement m join item i on i.id = m.item_id
                       join production_batch b on b.id = m.reference_id
                      where m.reference_type = 'production_batch' and b.quality_note = 'a little short'`);
  check(
    moved === "E2E base -4500 = 6264; E2E paste -500 = 15000; E2E pistachio gelato 4600 = 21264",
    "the base and paste out at their cost, the gelato in at exactly their sum",
  );
  check(
    inventoryGap() === gapBefore,
    "batches write no journal and take no value out of Inventory: the reconciliation is unmoved",
  );
  await ctx.close();
}

console.log("▸ a manager cancels the flavour's batch");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/production");
  await page.getByRole("button", { name: "Cancel E2E pistachio gelato batch" }).click();
  await page.getByLabel("Why it is cancelled").fill("recorded by mistake");
  await page.getByRole("button", { name: "Cancel the batch" }).click();
  await page.locator("tr.pr-cancelled").waitFor({ timeout: 10000 });
  check(
    sql(
      "select status || ': ' || cancel_reason from production_batch where quality_note = 'a little short'",
    ) === "cancelled: recorded by mistake",
    "the batch is kept, marked cancelled, with the reason",
  );
  check(
    sql(
      "select sum(base_quantity_signed) from inventory_movement m join item i on i.id = m.item_id where i.name = 'E2E pistachio gelato'",
    ) === "0",
    "and the gelato it made is out of stock again",
  );
  check(inventoryGap() === gapBefore, "cancelling it leaves the reconciliation unmoved too");
  await ctx.close();
}

console.log("▸ owner changes a product's recipe from today");
{
  const beans = Number(
    sql(
      `select money_round('${B}', item_issue_cost('${B}', 'c0000000-0000-0000-0000-000000000001', default_location('${B}')) * 18)`,
    ),
  );
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  const card = page.locator(".card", { has: page.locator('input[value="Golden espresso"]') });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Change the recipe…" }).click();
  check(
    (await card.getByLabel("Quantity 1").inputValue()) === "20" &&
      (await card.getByLabel("Used for 2").inputValue()) === "custom",
    "the change starts from the recipe in force: 20 g, the cup for takeaway and Talabat",
  );
  await card.getByLabel("Quantity 1").fill("18");
  await card.getByRole("button", { name: "Save the new recipe" }).click();
  await card.getByText("The new recipe is in force from today.").waitFor({ timeout: 10000 });
  check(
    sql(
      `select string_agg(trim_scale(rl.quantity) || ' ' || rl.unit_code || ' ' || coalesce(rl.applies_to_channels::text, 'all'), '; ' order by rl.quantity desc)
         from recipe_version rv join recipe_line rl on rl.recipe_version_id = rv.id
        where rv.id = recipe_version_on('d2000000-0000-0000-0000-000000000001', business_local_date('${B}', now()))`,
    ) === "18 g all; 1 each {takeaway,talabat}",
    "the new recipe is in force: 18 g, the cup still only for takeaway and Talabat",
  );
  const row = card
    .locator(".tw", { hasText: "Price & margin by channel" })
    .locator("tr", { hasText: "Dine-in" });
  check(
    await row
      .getByText(`${beans.toLocaleString("en-US")} IQD`)
      .first()
      .waitFor({ timeout: 10000 })
      .then(
        () => true,
        () => false,
      ),
    `and the card costs a dine-in espresso at ${beans} IQD from today`,
  );
  check(
    (await page
      .locator(".card", { has: page.locator('input[value="Golden water"]') })
      .getByRole("button", { name: "Change the recipe…" })
      .count()) === 0,
    "a product sold as bought has no recipe to change",
  );
  await ctx.close();
}

await browser.close();
done("production");
