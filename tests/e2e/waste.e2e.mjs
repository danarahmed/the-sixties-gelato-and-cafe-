// Waste by recipe (round six), through the real screens. Three batches of a
// stracciatella made yesterday, 4 kg each, each used by a day after the one
// before: of each, 28 cups of 100 g sold, and the rest past its use-by thrown
// away — but of the last, 100 g tasted. Reports leads to the page: the
// stracciatella threw away 29% of what went, at what its batches cost; most
// of it went unsold, so batches of about 2.8 kg would have covered what went;
// Production leads there too; the page speaks Arabic and Kurdish; and the
// cashier is not shown it.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const NAME = "E2E stracciatella";

console.log("▸ three batches made yesterday, sold and thrown away from each in turn");
if (last(`select count(*) from recipe where business_id = '${B}' and name = '${NAME}'`) === "0") {
  sql(`select test.act_as('owner@example.com');
       select create_item('E2E cream', 'ingredient', 'g', 'mass', p_opening_qty => 60000,
                          p_opening_unit_cost => 4, p_opening_reason => 'the opening count');
       select save_batch_recipe(null, '${NAME}', '{"measure": "weight"}', 4, 'kg',
                                jsonb_build_array(jsonb_build_object(
                                  'item_id', (select id from item where business_id = '${B}' and name = 'E2E cream'),
                                  'qty', 4000, 'unit_code', 'g')),
                                p_shelf_life_hours => 72);
       select test.as_admin();
       -- Its ingredients in force well before yesterday, when its batches were made.
       update recipe_version set effective_from = ${TODAY} - 30
        where recipe_id = (select id from recipe where business_id = '${B}' and name = '${NAME}');
       select test.act_as('manager@example.com');
       select record_production((select id from recipe where business_id = '${B}' and name = '${NAME}'), 1,
                                p_produced_at => ((${TODAY} - 1) + time '09:00') at time zone 'Asia/Baghdad',
                                p_use_by => now() + make_interval(days => k),
                                p_late_reason => 'Recorded the morning after')
         from generate_series(1, 3) k;
       select test.act_as('owner@example.com');
       select create_product('E2E stracciatella cup', '{"dine_in": 3000}',
                             jsonb_build_array(jsonb_build_object(
                               'item_id', (select id from item where business_id = '${B}' and name = '${NAME}'),
                               'qty', 100, 'unit_code', 'g', 'channels', null)));`);
  const cup = last(`select v.id from product_variant v join product p on p.id = v.product_id
                     where p.business_id = '${B}' and p.name = 'E2E stracciatella cup' limit 1`);
  const lots =
    sql(`select l.id from item_lot l join production_batch b on b.id = l.production_batch_id
                     join recipe r on r.id = b.recipe_id
                    where r.business_id = '${B}' and r.name = '${NAME}' order by b.batch_no`)
      .split("\n")
      .filter(Boolean);
  // Each batch in turn: 28 cups sold (the one to be used first goes first), then what is left thrown away.
  lots.forEach((lot, i) => {
    sql(`select test.act_as('cashier@example.com');
         select count(record_sale(gen_random_uuid(), 'dine_in', 'card',
                                  '[{"variant_id": "${cup}", "qty": 1}]'::jsonb))
           from generate_series(1, 28);
         select test.act_as('owner@example.com');
         ${i === 2 ? `select record_loss('sampling', (select item_id from item_lot where id = '${lot}'), null, 100, 'g', 'Tasted at the counter', '${lot}');` : ""}
         select record_loss('expired', (select item_id from item_lot where id = '${lot}'), null, ${i === 2 ? 1100 : 1200},
                            'g', 'Past its use-by', '${lot}');`);
  });
}
const story =
  sql(`select string_agg(b.batch_no || ':' || (batch_story(b.id) ->> 'sold') || '/' || (batch_story(b.id) ->> 'lost')
                                     || '/' || (batch_story(b.id) ->> 'left'), ' ' order by b.batch_no)
                     from production_batch b join recipe r on r.id = b.recipe_id
                    where r.business_id = '${B}' and r.name = '${NAME}'`);
check(
  /^\d+:2800\/1200\/0 \d+:2800\/1200\/0 \d+:2800\/1200\/0$/.test(story),
  `each batch: 2.8 kg sold, 1.2 kg lost, none left (${story})`,
);

console.log(
  "▸ Reports leads to the page: what went to waste, and the batch that would have covered what went",
);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  await page.getByTestId("to-waste").click();
  await page.waitForURL(/\/reports\/waste/);
  await page.waitForLoadState("networkidle");
  const row = page.locator(`[data-testid="waste-recipe"][data-recipe="${NAME}"]`);
  await row.waitFor({ timeout: 15000 });
  const cells = await row.locator("td").allTextContents();
  check(
    cells[1] === "3" && cells[2] === "12 kg" && cells[3] === "8.4 kg",
    `three batches, 12 kg made, 8.4 kg sold: ${cells.slice(1, 4).join(", ")}`,
  );
  const share = await row.getByTestId("waste-share").textContent();
  check(
    cells[4].startsWith("3.5 kg") &&
      share === "29% of what went" &&
      cells[5] === "100 g" &&
      cells[6] === "0 g",
    `3.5 kg thrown away, ${share}; 100 g tasted, none left (${cells.slice(4, 7).join(", ")})`,
  );
  // What was thrown away cost what the cream in it cost: 4 IQD a gram.
  check(
    cells[7].replace(/\D/g, "") === "14000",
    `what was thrown away cost 14,000 IQD: ${cells[7]}`,
  );
  check(
    (await row.getByTestId("waste-better").textContent()) === "2.8 kg",
    "mostly gone past its use-by: batches of 2.8 kg would have covered what went",
  );
  const says = (await page.getByTestId("waste-says").textContent()) ?? "";
  check(
    says.includes(`${NAME}: 29% of what went was thrown away, 14,000 IQD.`) &&
      says.includes("Batches of about 4 kg, of which about 2.8 kg was sold, used or eaten") &&
      says.includes("Batches of about 2.8 kg would have covered what went."),
    "said in words, with the batch to make",
  );
  check(
    ((await page.getByTestId("waste-bars").textContent()) ?? "").includes(NAME),
    "and among the bars of what was thrown away",
  );
  await ctx.close();
}

console.log("▸ Production leads there too");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/production");
  await page.getByTestId("to-waste-from-production").click();
  await page.waitForURL(/\/reports\/waste/);
  check(true, "from Production to the waste by recipe");
  await ctx.close();
}

console.log("▸ the page in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/reports/waste");
  const words = await english(page, "/reports/waste");
  check(
    words.length === 0,
    `in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ the cashier is not shown it");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await page.goto(`${BASE}/reports/waste`);
  await page.waitForLoadState("networkidle");
  check(!/\/reports\/waste/.test(page.url()), `the cashier is sent elsewhere: ${page.url()}`);
  await ctx.close();
}

await browser.close();
done("waste");
