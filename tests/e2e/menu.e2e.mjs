// A new product priced knowing what it costs: on Products & Recipes the owner
// builds a recipe and is shown, as it is typed, what each ingredient and one
// serving cost at today's stock costs, what each price leaves, and a round
// price that leaves the target margin. Saved, the product's card shows the
// same cost: the one a sale posts. (Run after the other suites: the costs are
// read from the database, as their trading left them.)
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const BEANS = "c0000000-0000-0000-0000-000000000001";
const CUP = "c0000000-0000-0000-0000-000000000002";

/** What the database charges for this much of an item in a sale today. */
const cost = (item, qty) =>
  Number(
    sql(
      `select money_round('${B}', item_issue_cost('${B}', '${item}', default_location('${B}')) * ${qty})`,
    ),
  );
/** The business's rounding step: suggested prices are rounded up to it. */
const STEP = Number(sql(`select discount_round_to from business where id = '${B}'`));
const dineIn = cost(BEANS, 18);
const toGo = dineIn + cost(CUP, 1);
const fmt = (n) => `${n.toLocaleString("en-US")} IQD`;
/** The lowest multiple of the step that leaves the margin: cost ÷ (1 − margin). */
const suggest = (c, marginPct) => Math.ceil((c * 100) / (100 - marginPct) / STEP) * STEP;
const marginText = (price, c) =>
  `margin ${fmt(price - c)} (${(((price - c) / price) * 100).toFixed(1)}%)`;

console.log("▸ owner prices a new drink from what its recipe costs");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  await page.getByRole("button", { name: "➕ Add menu product" }).click();
  await page.getByLabel("Product name (English)").fill("Golden cortado");
  const serving = page.getByTestId("serving-cost");
  check(
    (await serving.textContent()).includes("Choose the ingredients"),
    "an empty recipe asks for its ingredients",
  );

  await page.getByLabel("Ingredient 1").selectOption({ label: "Golden beans" });
  await page.getByLabel("Quantity 1").fill("18");
  check(
    (await page.getByTestId("cost-1").textContent()).startsWith(fmt(dineIn)),
    `18 g of beans cost ${fmt(dineIn)}, beside the line`,
  );
  await page.getByRole("button", { name: "+ Add ingredient" }).click();
  await page.getByLabel("Ingredient 2").selectOption({ label: "Golden cup" });
  await page.getByLabel("Quantity 2").fill("1");
  await page.getByLabel("Used for 2").selectOption("to_go");
  const total = await serving.textContent();
  check(
    total.includes(`${fmt(dineIn)} Dine-in`) &&
      total.includes(`${fmt(toGo)} Takeaway, Direct delivery, Talabat`),
    `one serving: ${fmt(dineIn)} at a table, ${fmt(toGo)} with the takeaway cup`,
  );
  check(
    (await page.getByTestId("cost-2").textContent()).includes("per"),
    "each line shows what its unit costs",
  );

  const card = (c) => page.locator(`.pf-price[data-channel="${c}"]`);
  check(
    (await card("dine_in").textContent()).includes(`cost ${fmt(dineIn)}`) &&
      (await card("takeaway").textContent()).includes(`cost ${fmt(toGo)}`),
    "each price box shows that channel's cost",
  );
  const dinePrice = suggest(dineIn, 70);
  await card("dine_in")
    .getByRole("button", { name: `Use ${fmt(dinePrice)}` })
    .click();
  check(
    (await page.getByLabel("Dine-in price").inputValue()) === String(dinePrice),
    `one click takes the suggested ${fmt(dinePrice)}: a 70% margin, rounded up to ${STEP}`,
  );
  check(
    (await card("dine_in").locator(".pf-margin.ok").textContent()) ===
      marginText(dinePrice, dineIn),
    "and shows what it leaves",
  );

  await page.getByLabel("Takeaway price").fill(String(toGo * 2));
  check(
    (await card("takeaway").locator(".pf-margin.warn").count()) === 1 &&
      (await card("takeaway").getByRole("button", { name: /^Use / }).count()) === 1,
    "a margin under the target is flagged, with the suggestion still offered",
  );
  await page.getByLabel("Talabat price").fill(String(toGo - 10));
  check(
    (await card("talabat").locator(".pf-margin.err").textContent()).startsWith(`loss ${fmt(10)}`),
    "a price under the cost is shown as a loss",
  );
  await page.getByLabel("Talabat price").fill("");
  await page.getByLabel("Target margin %").fill("80");
  check(
    (await card("talabat").getByRole("button", { name: /^Use / }).textContent()) ===
      `Use ${fmt(suggest(toGo, 80))}`,
    "a different target margin changes the suggestions",
  );

  await page.getByRole("button", { name: "+ Add ingredient" }).click();
  await page.getByLabel("Ingredient 3").selectOption({ label: "Golden beans" });
  await page.getByRole("button", { name: "Create product" }).click();
  await page.getByText("Recipe line 3: choose the ingredient and its quantity").waitFor();
  check(
    sql("select count(*) from product where name = 'Golden cortado'") === "0",
    "a line without its quantity stops the save, instead of being dropped",
  );
  await page.getByRole("button", { name: "Remove line 3" }).click();
  await page.getByRole("button", { name: "Create product" }).click();
  await page.getByText("Created “Golden cortado”.").waitFor({ timeout: 10000 });

  const recipe =
    sql(`select string_agg(i.name || ' ' || trim_scale(rl.quantity) || ' ' || rl.unit_code || ' '
                        || coalesce(rl.applies_to_channels::text, 'all'), '; ' order by i.name)
                        from product p join product_variant pv on pv.product_id = p.id
                        join variant_recipe vr on vr.product_variant_id = pv.id
                        join recipe_version rv on rv.recipe_id = vr.recipe_id
                        join recipe_line rl on rl.recipe_version_id = rv.id
                        join item i on i.id = rl.item_id
                       where p.name = 'Golden cortado'`);
  check(
    recipe ===
      "Golden beans 18 g all; Golden cup 1 each {takeaway,direct_delivery,talabat,careem,toters}",
    "the recipe is saved: the beans on every order, the cup for takeaway and delivery",
  );
  const prices = sql(`select string_agg(channel || '=' || price, ',' order by channel)
                        from channel_price cp join product_variant pv on pv.id = cp.product_variant_id
                        join product p on p.id = pv.product_id where p.name = 'Golden cortado'`);
  check(
    prices === `dine_in=${dinePrice},takeaway=${toGo * 2}`,
    "with the prices chosen, and none where it is not sold",
  );

  const saved = page.locator(".card", { has: page.locator('input[value="Golden cortado"]') });
  await saved.waitFor({ timeout: 10000 });
  await saved.locator("summary").click();
  const row = (label) =>
    saved.locator(".tw", { hasText: "Price & margin by channel" }).locator("tr", {
      hasText: label,
    });
  check(
    (await row("Dine-in").textContent()).includes(fmt(dineIn)) &&
      (await row("Takeaway").textContent()).includes(fmt(toGo)),
    "the saved product's card shows the same costs: the ones a sale posts",
  );
  await ctx.close();
}

await browser.close();
done("menu");
