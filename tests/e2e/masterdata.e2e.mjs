// Master data through the real screens (0027, the audit's P1-1, P1-3, P1-4): a
// manager corrects an item and adds the bottle it comes in; deliveries are
// entered at a price per unit, a mistyped price is asked about before
// anything is received, and a real rise is confirmed; the item's price
// history shows each delivery; a vendor is renamed; a bill's amount is typed
// from the invoice; a sale keeps the name it was sold under; and the owner
// reads all of it on the audit trail, with the values before and after, and
// downloads it. (Run last: it renames things the other suites do not use.)
import { chromium, BASE, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();

sql(`select test.act_as('owner@example.com');
     select create_item('E2E syrup', 'ingredient', 'ml', 'volume');
     select create_supplier('E2E Farm', 'Syrups', '0750 000 0000');
     select create_product('E2E lemonade', '{"dine_in": 3000}', p_no_stock_reason => 'made to order');`);
const SYRUP = sql(`select id from item where name = 'E2E syrup'`);
const LEMONADE = sql(
  `select pv.id from product_variant pv join product p on p.id = pv.product_id where p.name = 'E2E lemonade'`,
);
const receipts = () => Number(sql(`select count(*) from goods_receipt`));

console.log("▸ a manager corrects an item, and adds the bottle it comes in");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, `/inventory/${SYRUP}`);
  const edit = page.getByTestId("edit-item");
  await edit.getByLabel("Name (English)").fill("golden BEANS");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await edit.getByText("There is already an item called golden BEANS").waitFor({ timeout: 10000 });
  check(true, "a second item under another's name is refused, whatever its capitals");

  await edit.getByLabel("Name (English)").fill("E2E vanilla syrup");
  await edit.getByLabel("Reorder level (ml)").fill("1500");
  await edit.getByLabel("Why (on the audit trail)").fill("the supplier's name for it");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await edit.getByText("Saved, and on the audit trail.").waitFor({ timeout: 10000 });
  check(
    sql(`select name || ' ' || min_level_base from item where id = '${SYRUP}'`) ===
      "E2E vanilla syrup 1500",
    "renamed, with its reorder level",
  );

  const units = page.getByTestId("pack-units");
  await units.getByLabel("New unit").fill("bottle_750");
  await units.getByLabel("Label").fill("Bottle of 750 ml");
  await units.getByLabel("Holds (ml)").fill("750");
  await units.getByRole("button", { name: "Add unit" }).click();
  await units.getByText("Added Bottle of 750 ml.").waitFor({ timeout: 10000 });
  await units.locator("tr", { hasText: "bottle_750" }).waitFor({ timeout: 10000 });
  check(
    (await units.locator("tr", { hasText: "bottle_750" }).textContent()).includes("750 ml"),
    "and the bottle it comes in: 750 ml",
  );
  await units.getByLabel("New unit").fill("BOTTLE_750");
  await units.getByLabel("Holds (ml)").fill("700");
  await units.getByRole("button", { name: "Add unit" }).click();
  await units
    .getByText(/already has a unit called BOTTLE_750: a unit in use keeps its size/)
    .waitFor({ timeout: 10000 });
  check(true, "a unit in use keeps its size: 700 would re-count every bottle received");
  await ctx.close();
}

console.log("▸ deliveries at a price per unit; a mistyped price is asked about first");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const form = page.getByTestId("receive");
  /** One line: the syrup, by the bottle, at a price. */
  async function fill(qty, price) {
    await form
      .locator("label", { hasText: /^Supplier/ })
      .locator("select")
      .selectOption({ label: "E2E Farm" });
    const line = form.getByTestId("receive-line").first();
    await line
      .locator("label", { hasText: /^Item/ })
      .locator("select")
      .selectOption({ label: "E2E vanilla syrup" });
    await line
      .locator("label", { hasText: /^Quantity/ })
      .locator("input")
      .fill(qty);
    await line.locator("label", { hasText: /^Unit/ }).locator("select").selectOption("bottle_750");
    await line
      .locator("label", { hasText: /^Price per/ })
      .locator("input")
      .fill(price);
    return line;
  }

  let line = await fill("2", "9000");
  const first = await line.getByTestId("receive-line-cost").textContent();
  check(
    first.includes("2 × 9,000 = 18,000 IQD · 12 IQD a ml") && first.includes("first delivery"),
    `the line's total and its cost a ml, shown as it is typed (${first})`,
  );
  await form.getByRole("button", { name: "Receive goods" }).click();
  await form.getByText(/Receipt \d+ — 18,000 IQD into stock/).waitFor({ timeout: 10000 });
  check(true, "2 bottles at 9,000 a bottle: 18,000 into stock");

  // A digit short: 900 a bottle is 1.2 a ml, when it costs 12.
  const before = receipts();
  line = await fill("1", "900");
  check(
    (await line.getByTestId("receive-line-cost").textContent()).includes("90% below: check it"),
    "the line says the price is 90% below the cost now, before it is sent",
  );
  await form.getByRole("button", { name: "Receive goods" }).click();
  const ask = page.getByTestId("price-check");
  await ask.waitFor({ timeout: 10000 });
  check(
    (await ask.textContent()).includes(
      "Check the price: E2E vanilla syrup at 1.2 a ml is 90% below its cost now (12 a ml).",
    ),
    "the database asks: 1.2 a ml, when it costs 12",
  );
  check(receipts() === before, "and nothing is received until someone answers");
  await ask.getByRole("button", { name: "Let me correct it" }).click();
  await line
    .locator("label", { hasText: /^Price per/ })
    .locator("input")
    .fill("9000");
  await form.getByRole("button", { name: "Receive goods" }).click();
  await form.getByText(/Receipt \d+ — 9,000 IQD into stock/).waitFor({ timeout: 10000 });
  check(receipts() === before + 1, "corrected to 9,000, it is received");

  // A real rise, confirmed: 12,000 a bottle is 16 a ml, a third over.
  await fill("1", "12000");
  await form.getByRole("button", { name: "Receive goods" }).click();
  await ask.waitFor({ timeout: 10000 });
  await ask.getByRole("button", { name: "The price is right: receive it" }).click();
  await form.getByText(/Receipt \d+ — 12,000 IQD into stock/).waitFor({ timeout: 10000 });
  check(
    sql(
      `select reason from audit_log where action = 'purchase.price_confirmed' order by id desc limit 1`,
    ).includes("E2E vanilla syrup at 16 a ml is 33% above its cost now (12 a ml)"),
    "confirmed, it is received, and the confirmation is on the audit trail",
  );

  await open(page, `/inventory/${SYRUP}`);
  const history = page.getByTestId("price-history").locator("tbody tr");
  check(
    (await history.count()) === 3 &&
      (await history.first().textContent()).includes("16 IQD") &&
      (await history.first().textContent()).includes("E2E Farm"),
    "the price history shows each delivery, newest first: 16 a ml from E2E Farm",
  );
  await ctx.close();
}

console.log("▸ a vendor renamed; a bill's amount is typed from the invoice");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/vendors");
  await page.locator("button.vrow", { hasText: "E2E Farm" }).click();
  await page.getByRole("button", { name: "Edit vendor" }).click();
  const ev = page.getByTestId("edit-vendor");
  await ev
    .locator("label", { hasText: /^Vendor name/ })
    .locator("input")
    .fill("E2E Farms Ltd");
  await ev.locator("label", { hasText: /^Why/ }).locator("input").fill("their registered name");
  await ev.getByRole("button", { name: "Save changes" }).click();
  await ev.getByText("Saved, and on the audit trail.").waitFor({ timeout: 10000 });
  check(
    sql(`select count(*) from supplier where name = 'E2E Farms Ltd' and is_active`) === "1",
    "the vendor is renamed",
  );
  // Out of use while owed nothing is allowed; it is not asked here. A bill:
  await page.getByRole("button", { name: "Bills & payments" }).click();
  const amount = page.locator("label", { hasText: "Amount (IQD)" }).first().locator("input");
  check(
    (await amount.inputValue()) === "" &&
      (await page.getByText("Type the amount the supplier's invoice says").count()) === 1,
    "the bill's amount starts empty: it is typed from the invoice, never copied from the receipt",
  );
  await ctx.close();
}

console.log("▸ a sale keeps the name it was sold under");
{
  sql(`select test.act_as('cashier@example.com');
       select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"${LEMONADE}","qty":1}]');
       select test.act_as('owner@example.com');
       select set_product_details((select product_id from product_variant where id = '${LEMONADE}'),
                                  'E2E pink lemonade');`);
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/orders");
  check(
    (await page.locator("tbody tr", { hasText: "E2E lemonade ×1" }).count()) === 1 &&
      (await page.locator("tbody tr", { hasText: "E2E pink lemonade" }).count()) === 0,
    "renamed afterwards, the product's old sale still reads E2E lemonade",
  );
  await ctx.close();
}

console.log("▸ the owner reads who changed what, with the values before and after");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/audit?group=items");
  const trail = page.getByTestId("audit-trail");
  const renamed = trail.locator('tr[data-action="item.update"]', { hasText: "E2E vanilla syrup" });
  const text = (await renamed.first().textContent()) ?? "";
  check(
    text.includes("Demo Manager") &&
      text.includes("Name: E2E syrup → E2E vanilla syrup") &&
      text.includes("Reorder level: — → 1,500") &&
      text.includes("the supplier's name for it"),
    "the item's correction: who, each value before and after, and why",
  );
  check(
    (await trail
      .locator('tr[data-action="item_unit.create"]', { hasText: "bottle_750" })
      .count()) === 1,
    "and the bottle added",
  );

  await open(page, "/audit?group=suppliers");
  const sup = page.getByTestId("audit-trail");
  check(
    ((await sup.locator('tr[data-action="supplier.update"]').first().textContent()) ?? "").includes(
      "Name: E2E Farm → E2E Farms Ltd",
    ),
    "the vendor renamed",
  );
  check(
    (
      (await sup.locator('tr[data-action="purchase.price_confirmed"]').first().textContent()) ?? ""
    ).includes("33% above its cost now"),
    "the price confirmed, with what the person was told",
  );

  await open(page, "/audit?group=prices&person=none");
  const bySql = page.getByTestId("audit-trail").locator("tbody tr");
  check(
    (await bySql.count()) > 0 &&
      (await bySql.filter({ hasText: "No one signed in" }).count()) === (await bySql.count()),
    "prices set in the database itself show no one against them, and can be picked out",
  );

  const res = await page.request.get(`${BASE}/reports/export?report=audit&group=suppliers`);
  const body = await res.text();
  check(
    res.ok() &&
      (res.headers()["content-type"] ?? "").includes("text/csv") &&
      body.startsWith("when,person,action,what_happened,about,changes,reason,before,after") &&
      body.includes("purchase.price_confirmed"),
    "and downloads it as CSV",
  );
  await ctx.close();
}

console.log("▸ the trail is not for everyone");
{
  const { ctx, page } = await signIn(browser, "cashier");
  const res = await page.request.get(`${BASE}/reports/export?report=audit`);
  check(res.status() === 403, `a cashier downloads none of it (HTTP ${res.status()})`);
  await ctx.close();
}

await browser.close();
done("masterdata");
