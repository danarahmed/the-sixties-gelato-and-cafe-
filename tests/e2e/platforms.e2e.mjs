// Delivery platforms the café adds itself (0031), through the real screens: a
// branch manager sees them and changes none; the owner adds Lezzoo, named in
// Arabic and Kurdish and set up like Talabat (its packaging and its prices);
// the cashier sells on it from the till, by the number from its tablet, in
// English and in Arabic; the owner renames it, takes it out of use (it leaves
// the till, what it owes stays) and brings it back.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const row = (page, code) => page.locator(`[data-testid="platform-row"][data-code="${code}"]`);
/** The till, past its floor of tables when an earlier suite set tables up. */
async function till(page, quickSale = "Quick sale") {
  await open(page, "/pos");
  const chip = page.locator(".strip-chip", { hasText: quickSale });
  if (await chip.isVisible()) await chip.click();
}

// What a platform set up like Talabat takes from it.
const talabatPrices =
  sql(`select count(*) from product_variant pv join product p on p.id = pv.product_id
                            where pv.is_active and p.is_active
                              and price_on(pv.id, 'talabat', null, test.today()) is not null`);
const talabatLines = sql(
  `select count(*) from recipe_line where 'talabat' = any (applies_to_channels)`,
);

console.log("▸ a branch manager sees the platforms, and changes none");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/platforms");
  const codes = await page
    .getByTestId("platform-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-code")));
  check(
    [...codes].sort().join(",") === "careem,talabat,toters",
    "the café's platforms are listed: Talabat, Careem and Toters",
  );
  check(
    (await row(page, "talabat").textContent()).includes("In use") &&
      (await row(page, "careem").textContent()).includes("Not in use"),
    "Talabat in use; Careem, never used, not",
  );
  check(
    !(await page.getByRole("button", { name: "+ Add a delivery platform" }).isVisible()) &&
      !(await row(page, "talabat").getByRole("button").count()),
    "a branch manager adds, renames and retires none",
  );
  check(
    await page.getByText("The owner or the general manager adds a platform").isVisible(),
    "and is told who does",
  );
  await ctx.close();
}

console.log("▸ the owner adds Lezzoo, set up like Talabat");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/platforms");
  await page.getByRole("button", { name: "+ Add a delivery platform" }).click();
  const form = page.getByTestId("add-platform");
  await form.getByLabel("Name, as its customers know it").fill("Lezzoo");
  await form.getByLabel("Name in العربية").fill("ليزو");
  await form.getByLabel("Name in کوردی").fill("لێزۆ");
  check(
    (await form.getByLabel("Its orders take the packaging of").inputValue()) === "talabat",
    "set up like Talabat unless told otherwise",
  );
  await form.getByRole("button", { name: "Add the platform" }).click();
  await page
    .getByText(
      `Lezzoo is added. ${talabatPrices} product price(s) and ${talabatLines} packaging line(s) copied.`,
    )
    .waitFor({ timeout: 10000 });
  check(true, "added, with Talabat's prices and packaging");
  const lz = row(page, "lezzoo");
  await lz.waitFor();
  const text = await lz.textContent();
  check(
    text.includes("Lezzoo") && text.includes("ليزو · لێزۆ") && text.includes("In use"),
    "listed in use, with its names in Arabic and Kurdish",
  );
  check(
    (await lz.getByTestId("platform-priced").textContent()) === talabatPrices,
    "and as many products priced on it as on Talabat",
  );

  // Once only.
  await page.getByRole("button", { name: "+ Add a delivery platform" }).click();
  await form.getByLabel("Name, as its customers know it").fill("LEZZOO");
  await form.getByRole("button", { name: "Add the platform" }).click();
  await page
    .getByText("LEZZOO is already a delivery platform here: bring it back into use")
    .waitFor({ timeout: 10000 });
  check(true, "the same platform is not added twice");
  await ctx.close();
}
check(
  sql(`select names::text from delivery_platform where code = 'lezzoo'`) ===
    `{"ar": "ليزو", "ckb": "لێزۆ"}`,
  "its names kept by language",
);
check(
  sql(
    `select count(*) from channel_price where channel = 'lezzoo' and effective_from = test.today()`,
  ) === talabatPrices,
  "priced as on Talabat, from today",
);

console.log("▸ the cashier sells on it, by the number from its tablet");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await till(page);
  await page.getByRole("button", { name: "Lezzoo", exact: true }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /platform/i }).click();
  check(
    await page.locator(".pay-confirm").isDisabled(),
    "a Lezzoo sale waits for its order number",
  );
  await page.getByLabel("Lezzoo order number").fill("LZ-501");
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    (await page.locator(".receipt-card").textContent()).includes("Order LZ-501"),
    "recorded, with its order number",
  );
  await ctx.close();
}
check(
  sql(`select o.channel || ' ' || trim_scale(o.net_amount) || ' ' || po.external_order_id
         from platform_order po join sales_order o on o.id = po.sales_order_id
         join delivery_platform dp on dp.id = po.platform_id where dp.code = 'lezzoo'`) ===
    "lezzoo 3000 LZ-501",
  "at its Lezzoo price, owed by Lezzoo by its number",
);
check(
  sql(`select string_agg(i.name, ', ' order by i.name) from inventory_movement m join item i on i.id = m.item_id
        where m.reference_id = (select o.id from sales_order o where o.channel = 'lezzoo')`) ===
    "Golden beans, Golden cup",
  "the espresso and the cup a Talabat order takes, out of stock",
);

console.log("▸ in Arabic, the till names it as the café does");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await till(page, "بيع سريع");
  check(
    await page.getByRole("button", { name: "ليزو", exact: true }).isVisible(),
    "its tab reads ليزو",
  );
  await ctx.close();
}

console.log("▸ renamed, taken out of use, brought back");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/platforms");
  const lz = row(page, "lezzoo");
  await lz.getByRole("button", { name: "Edit…" }).click();
  await lz.getByLabel("Name, as its customers know it").fill("Lezzoo Express");
  await lz.getByRole("button", { name: "Save" }).click();
  await page.getByText("Saved.").waitFor({ timeout: 10000 });
  await open(page, "/platforms");
  check((await lz.textContent()).includes("Lezzoo Express"), "renamed");

  await lz.getByRole("button", { name: "Take out of use…" }).click();
  check(
    await lz
      .getByText("Lezzoo Express leaves the till and sells nothing more. What it owes")
      .isVisible(),
    "asked first, and told what taking it out of use does",
  );
  await lz.getByRole("button", { name: "Take it out of use" }).click();
  await page.getByText("Lezzoo Express is out of use.").waitFor({ timeout: 10000 });
  await open(page, "/platforms");
  check((await lz.textContent()).includes("Not in use"), "out of use");
  check(
    (
      await page.getByTestId("platform-owed").evaluateAll((rows) => rows.map((r) => r.textContent))
    ).some((t) => t.includes("LZ-501") && t.includes("Lezzoo Express")),
    "what it owes stays, under its new name",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await till(page);
  check(
    !(await page.getByRole("button", { name: "Lezzoo Express", exact: true }).isVisible()) &&
      (await page.getByRole("button", { name: "Talabat", exact: true }).isVisible()),
    "out of use, it leaves the till",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/platforms");
  await row(page, "lezzoo").getByRole("button", { name: "Bring back into use" }).click();
  await page.getByText("Lezzoo Express is back in use.").waitFor({ timeout: 10000 });
  await till(page);
  check(
    await page.getByRole("button", { name: "Lezzoo Express", exact: true }).isVisible(),
    "brought back, it is on the till again",
  );
  await ctx.close();
}
check(
  sql(`select string_agg(action, ',' order by id) from audit_log
        where action in ('platform.create', 'platform.setup', 'platform.update')`) ===
    "platform.create,platform.setup,platform.update,platform.update,platform.update",
  "each on the audit trail",
);

await browser.close();
done("platforms");
