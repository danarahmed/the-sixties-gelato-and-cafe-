// The owner's answer on waste (0070) through the real screens. Four weeks of
// two sorbets on this weekday: lemon, made two batches at a time and thrown
// away every week; mango, one batch, sold out twice and never thrown away. On
// Production the day's plan says what it learnt: lemon one batch, not two;
// mango two. Cream, a litre a day for twenty days, spoilt once this week:
// What to buy leaves what was thrown away out of its use, and orders it up
// to its par level, ten cartons, until the manager says, under How it was
// worked out, that it keeps three days: three cartons, and why. Reports →
// Waste speaks of the last seven days: the lemon and the cream, with what to
// try and where. The history is laid down value for value (made, sold and
// thrown away), so the books still tie; the screens speak Arabic and Kurdish.
import { BASE, TODAY, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const LOC = last(`select default_location('${B}')`);

// ------------------------------------------------------------ the history
// A syrup the sorbets are made from, and the two sorbets, batches of 2 kg.
sql(`select test.act_as('owner@example.com');
     select create_item('E2E Sorbet syrup', 'ingredient', 'ml', 'volume', p_opening_qty => 20000,
                        p_opening_unit_cost => 1, p_opening_reason => 'E2E opening')`);
const SYRUP = last(`select id from item where business_id = '${B}' and name = 'E2E Sorbet syrup'`);
const recipe = (name) =>
  JSON.parse(
    last(`select test.act_as('owner@example.com');
          select save_batch_recipe(null, '${name}', '{"measure":"weight"}', 2, 'kg',
            jsonb_build_array(jsonb_build_object('item_id', '${SYRUP}', 'qty', 1000, 'unit_code', 'ml')),
            null, true, 24)`),
  );
const LEMON = recipe("E2E Lemon sorbet");
const MANGO = recipe("E2E Mango sorbet");
sql(`update recipe_version set effective_from = ${TODAY} - 60
      where recipe_id in ('${LEMON.recipe_id}', '${MANGO.recipe_id}')`);

/** A movement so many days ago at a time (Baghdad), worth what it moves at 1 IQD each. */
const at = (days, time) => `((${TODAY} - ${days}) + time '${time}') at time zone 'Asia/Baghdad'`;
const move = (item, type, qty, days, time) =>
  `('${B}', '${item}', '${LOC}', '${type}', ${qty}, 1, ${Math.abs(qty)},
    ${type === "sale_consumption" ? "'sales_order'" : "null"}, 'E2E history', ${at(days, time)})`;
const lay = (rows) =>
  sql(`insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                       unit_cost, value, reference_type, reason, occurred_at)
       values ${rows.join(",\n")}`);
// Lemon: two batches made, 2.5 kg sold, 1.5 kg thrown away that night, each week.
lay(
  [7, 14, 21, 28].flatMap((d) => [
    move(LEMON.item_id, "production_output", 4000, d, "09:00"),
    move(LEMON.item_id, "sale_consumption", -2500, d, "12:00"),
    move(LEMON.item_id, "expired", -1500, d, "21:00"),
  ]),
);
// Mango: one batch; sold out the last two weeks; before that, what was left
// was thrown away the next day, not a day the plan judges by.
lay([
  ...[7, 14].flatMap((d) => [
    move(MANGO.item_id, "production_output", 2000, d, "09:00"),
    move(MANGO.item_id, "sale_consumption", -2000, d, "12:00"),
  ]),
  ...[21, 28].flatMap((d) => [
    move(MANGO.item_id, "production_output", 2000, d, "09:00"),
    move(MANGO.item_id, "sale_consumption", -1500, d, "12:00"),
    move(MANGO.item_id, "expired", -500, d - 1, "21:00"),
  ]),
]);
// Cream, bought by the litre carton from a creamery a day away: 20.6 L twenty
// days ago, a litre used each day since, and 600 ml spoilt three days ago; a
// par level of 10 L.
sql(`insert into item (business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock)
     values ('${B}', 'E2E-CREAM', 'E2E Cream', 'ingredient', 'ml', 'volume', false)`);
const CREAM = last(`select id from item where business_id = '${B}' and name = 'E2E Cream'`);
sql(`insert into item_unit (item_id, code, label, dimension, factor_to_base)
     values ('${CREAM}', 'carton_1l', 'Carton of 1 L', 'volume', 1000)`);
lay([
  move(CREAM, "opening_balance", 20600, 20, "08:00"),
  ...Array.from({ length: 20 }, (_, i) => move(CREAM, "sale_consumption", -1000, i + 1, "12:00")),
  move(CREAM, "spoilage", -600, 3, "18:00"),
]);
sql(`select test.act_as('owner@example.com');
     select update_item('${CREAM}', 'E2E Cream', 'ingredient', p_par_level => 10000)`);
// From its own creamery, a day away, by the carton.
const CREAMERY = last(`select test.act_as('manager@example.com');
                       select create_supplier('E2E Creamery', 'Rawa', '0750 555 0199')`);
sql(`select test.act_as('manager@example.com');
     select update_supplier('${CREAMERY}', 'E2E Creamery', 'Rawa', '0750 555 0199', true, 'a day away', 1);
     select set_item_supplier('${CREAM}', '${CREAMERY}', 'carton_1l', 1500, true, gen_random_uuid())`);

// ------------------------------------------------------------ the day's plan
console.log("▸ the day's plan says what it learnt");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/production#plan");
  const row = (name) => page.locator(`[data-testid="plan-row"][data-recipe="${name}"]`);
  const lemon = row("E2E Lemon sorbet");
  const mango = row("E2E Mango sorbet");
  const lemonSays = (await lemon.getByTestId("plan-learnt").textContent()) ?? "";
  check(
    (await lemon.getByTestId("plan-learnt").getAttribute("data-learned")) === "waste" &&
      /Thrown away 4 of the last 4 weeks, about 1[.,]5 ?kg a time: makes 500 ?g less/.test(
        lemonSays,
      ),
    `lemon, thrown away every week: it makes 500 g less (said: ${lemonSays})`,
  );
  const lemonMakes = (await lemon.locator("td").last().textContent()) ?? "";
  check(
    /1 batch: 2 ?kg/.test(lemonMakes),
    `one batch of lemon, where what it sold would make two (${lemonMakes})`,
  );
  const mangoSays = (await mango.getByTestId("plan-learnt").textContent()) ?? "";
  check(
    (await mango.getByTestId("plan-learnt").getAttribute("data-learned")) === "sold_out" &&
      /Sold out 2 of the last 4 weeks: makes 1 ?kg more/.test(mangoSays),
    `mango, sold out the last two weeks: a kilo more (said: ${mangoSays})`,
  );
  const mangoMakes = (await mango.locator("td").last().textContent()) ?? "";
  check(/2 batches: 4 ?kg/.test(mangoMakes), `two batches of mango (${mangoMakes})`);
  check(
    ((await page.getByTestId("plan").textContent()) ?? "").includes(
      "It makes more of what sold out on half those days or more",
    ),
    "the plan says how it learns",
  );
  await ctx.close();
}

// ------------------------------------------------------------ what to buy
const creamLine = (page) => page.locator('[data-testid="buying-line"][data-item="E2E Cream"]');
const creamWhy = async (page) =>
  (await creamLine(page).getByTestId("buying-why").textContent()) ?? "";
console.log("▸ What to buy leaves what was thrown away out of use, and asks how long it keeps");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing/buying-list");
  const why = await creamWhy(page);
  check(
    why.includes(
      "About 1,000 ml a day over the last 20 days; a delivery takes 1 day, and a day more: 2,000 ml is its reorder level.",
    ) &&
      why.includes("600 ml thrown away unsold in the last 20 days is not counted as use.") &&
      why.includes("10 × Carton of 1 L (10,000 ml), rounded up to whole packs."),
    "cream: a litre a day, the 600 ml spoilt left out, up to its par level: ten cartons",
  );
  check(
    (await creamLine(page).getByLabel("Quantity").inputValue()) === "10",
    "ten in the quantity",
  );
  await creamLine(page).locator("summary", { hasText: "How it was worked out" }).click();
  const keeps = creamLine(page).getByTestId("buying-keeps");
  await keeps.getByLabel("Days it keeps once it comes").fill("3");
  await keeps.getByRole("button", { name: "Save" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(
          '[data-testid="buying-line"][data-item="E2E Cream"] [data-testid="buying-why"]',
        )
        ?.textContent?.includes("It keeps 3 days"),
    null,
    { timeout: 15000 },
  );
  const after = await creamWhy(page);
  check(
    after.includes("It keeps 3 days: ordered up to no more than they use, 3,000 ml.") &&
      after.includes("3 × Carton of 1 L (3,000 ml), in whole packs.") &&
      (await creamLine(page).getByLabel("Quantity").inputValue()) === "3",
    "said to keep three days: three cartons, and why",
  );
  check(
    last(`select keeps_days from item where id = '${CREAM}'`) === "3" &&
      last(`select after_state ->> 'keeps_days' from audit_log
             where action = 'item.keeps' and entity_id = '${CREAM}' order by id desc limit 1`) ===
        "3",
    "kept on the item, and on the audit trail",
  );
  await ctx.close();
}

// ------------------------------------------------------------ the last seven days
console.log("▸ Reports → Waste: the last seven days, and what to try");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports/waste");
  const week = page.getByTestId("waste-week");
  const text = (await week.textContent()) ?? "";
  check(
    /Thrown away unsold in these seven days: [\d,]+ IQD/.test(text),
    "it says what was thrown away unsold in the seven days, against the seven before",
  );
  const lemon = week.locator("li", { hasText: "E2E Lemon sorbet:" });
  const cream = week.locator("li", { hasText: "E2E Cream:" });
  check(
    ((await lemon.textContent()) ?? "").includes("Made here: the day's plan already makes less") &&
      (await lemon.locator('a[href="/production#plan"]').count()) > 0,
    "the lemon, made here: the plan already makes less, and a way to it",
  );
  check(
    /E2E Cream: 600 ml thrown away, 600 IQD, 1 time, on \w+day\./.test(
      (await cream.textContent()) ?? "",
    ) &&
      ((await cream.textContent()) ?? "").includes(
        "Bought, and it keeps 3 days: order less of it at a time, and more often.",
      ) &&
      (await cream.locator('a[href="/purchasing/buying-list"]').count()) > 0,
    "the cream, bought and keeping three days: order less at a time, and a way to What to buy",
  );
  await ctx.close();
}

// ------------------------------------------------------------ in Arabic and in Kurdish
console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of ["/production", "/purchasing/buying-list", "/reports/waste"]) {
    await open(page, path);
    left.push(...(await english(page, path)));
  }
  check(
    left.length === 0 && (await page.evaluate(() => document.documentElement.dir)) === "rtl",
    `in ${locale}, right to left, no English but the café's own names` +
      (left.length ? `: ${left.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

// The history laid down moved no value: the books still tie.
check(
  last(`select coalesce(sum(value * sign(base_quantity_signed)), 0) from inventory_movement
         where reason = 'E2E history'`) === "0",
  "the history moved nothing in value: the stock ledger and its account still agree",
);

await browser.close();
done("The plan learns");
