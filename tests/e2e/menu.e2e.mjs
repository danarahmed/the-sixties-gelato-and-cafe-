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

console.log("▸ owner schedules a price, sees it waiting, and withdraws it; the past is refused");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  const today = sql(`select business_local_date('${B}', now())`);
  const card = page.locator(".card", { has: page.locator('input[value="Golden cortado"]') });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Change a price…" }).click();
  await card
    .locator("label", { hasText: /^Channel/ })
    .locator("select")
    .selectOption("dine_in");
  await card.locator("label", { hasText: "New price" }).locator("input").fill("9000");
  const from = card.locator("label", { hasText: /^From/ }).locator("input");
  await from.fill(sql(`select ('${today}'::date - 1)::text`));
  await card.getByRole("button", { name: "Set price" }).click();
  await card.getByText("A price cannot start in the past").waitFor({ timeout: 10000 });
  const nines = "select count(*) from channel_price where price = 9000";
  check(sql(nines) === "0", "a price dated yesterday is refused: yesterday's sales keep theirs");

  const later = sql(`select ('${today}'::date + 7)::text`);
  await from.fill(later);
  await card.getByRole("button", { name: "Set price" }).click();
  await card.getByText(`New price takes effect on ${later}.`).waitFor({ timeout: 10000 });
  const waiting = card.getByTestId("scheduled-changes");
  await waiting.waitFor({ timeout: 10000 });
  check(
    (await waiting.textContent()).includes(`From ${later}: Dine-in at 9,000 IQD`),
    "a price set for next week is listed on the product, waiting",
  );
  await waiting.getByRole("button", { name: "Withdraw…" }).click();
  await waiting.getByLabel("Why the change is withdrawn").fill("The supplier kept its price");
  await waiting.getByRole("button", { name: "Withdraw it" }).click();
  await waiting.waitFor({ state: "detached", timeout: 10000 });
  check(sql(nines) === "0", "withdrawn before it starts, it is gone");
  check(
    sql(
      "select count(*) from audit_log where action = 'price.cancel' and reason = 'The supplier kept its price'",
    ) === "1",
    "with the reason on the audit trail",
  );
  await ctx.close();
}

console.log("▸ a product with no recipe says why it uses no stock, or is flagged");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  await page.getByRole("button", { name: "➕ Add menu product" }).click();
  await page.getByLabel("Product name (English)").fill("Golden service");
  await page.getByLabel("Dine-in price").fill("1000");
  await page.getByRole("button", { name: "Create product" }).click();
  await page
    .getByText("List what one serving uses, or say why it uses no stock (a service charge, say).")
    .waitFor({ timeout: 10000 });
  check(
    sql("select count(*) from product where name = 'Golden service'") === "0",
    "a product with no ingredients and no reason is not created",
  );
  await page.getByLabel("Why it uses no stock").first().fill("A table service charge");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.getByText("Created “Golden service”.").waitFor({ timeout: 10000 });
  check(
    sql(
      "select pv.no_stock_reason from product_variant pv join product p on p.id = pv.product_id where p.name = 'Golden service'",
    ) === "A table service charge",
    "with its reason, it is: it sells at no cost, and says why",
  );
  const card = page.locator(".card", { has: page.locator('input[value="Golden service"]') });
  await card.waitFor({ timeout: 10000 });
  await card.locator("summary").click();
  check(
    (await card.getByText("Uses no stock: A table service charge.").count()) === 1 &&
      (await card.getByTestId("cost-warning").count()) === 0,
    "its card says so, and does not flag it",
  );
  await card.getByRole("button", { name: "It does use stock" }).click();
  await card.getByTestId("cost-warning").waitFor({ timeout: 10000 });
  check(
    (await card.getByTestId("cost-warning").textContent()).includes("Costed at nothing"),
    "taken back, it is flagged as costed at nothing until it has a recipe",
  );
  await ctx.close();
}

console.log("▸ it is sold, and Reports list the sale as costed at nothing");
{
  const cashier = await signIn(browser, "cashier");
  await open(cashier.page, "/pos");
  await cashier.page.locator(".strip-chip", { hasText: "Quick sale" }).click();
  await cashier.page.getByRole("button", { name: "Dine-in" }).click();
  await cashier.page.getByRole("tab", { name: /All/ }).click();
  await cashier.page.locator(".product-tile", { hasText: "Golden service" }).click();
  await cashier.page.getByRole("button", { name: /Cash/ }).click();
  await cashier.page.locator(".pay-confirm").click();
  await cashier.page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    sql(
      "select net_amount || '/' || cogs_amount from sales_order order by created_at desc limit 1",
    ) === "1000/0",
    "a sale of it posts no cost",
  );
  await cashier.ctx.close();

  const { ctx, page } = await signIn(browser, "owner");
  const to = sql(`select business_local_date('${B}', now())`);
  const from = sql(`select ('${to}'::date - 60)::text`);
  await open(page, `/reports?from=${from}&to=${to}`);
  const section = page.locator("#uncosted");
  const row = section.locator("tbody tr", { hasText: "Golden service" });
  check(
    (await row.count()) === 1 &&
      (await row.textContent()).includes("Costed at nothing: Golden service"),
    "Reports list the sale under Uncosted Sales, and why",
  );
  const uncosted = Number(sql(`select count(*) from uncosted_sales('${B}', '${from}', '${to}')`));
  check(
    (await section.locator("tbody tr").count()) === uncosted,
    `and list exactly the database's ${uncosted} uncosted sale(s) in these dates`,
  );

  await open(page, "/accounting");
  const warning = (await page.locator('tr[data-check="uncosted"]').textContent()) ?? "";
  check(
    warning.includes("⚠️") && warning.includes("costed at nothing"),
    "the month's closing checklist warns of it",
  );
  const blocking = await page.locator("tr[data-check]", { hasText: "⛔" }).count();
  const hints = page.getByText(/Resolve the \d+ failing check/);
  const hint = (await hints.count()) > 0 ? await hints.textContent() : "";
  check(
    blocking === 0 ? hint === "" : hint.includes(`Resolve the ${blocking} failing`),
    `as a warning only: the lock waits on the ${blocking} blocking check(s), not on it`,
  );
  await ctx.close();
}

await browser.close();
done("menu");
