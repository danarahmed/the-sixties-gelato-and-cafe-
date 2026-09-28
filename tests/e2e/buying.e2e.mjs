// The buying list (0045, release T) through the real screens: a manager opens
// What to buy from Purchasing; oat milk under its own reorder level, and
// straws never in stock, are to order, with why and their numbers, and no
// supplier yet; a syrup new today has not enough history. The manager gives
// each a supplier and a pack, makes the dairy the oat milk's usual supplier,
// leaves the rest unticked and creates the orders: a draft for each supplier,
// expected in its own days. Drafted, the oat milk is no longer to order. On
// the item's page, who it is bought from is set and removed; a cashier sees
// no buying list; the audit trail says so; the screens speak Arabic and
// Kurdish; and the books still tie.
import { BASE, TODAY, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const n = (q) => Number(last(q));
const B = "00000000-0000-0000-0000-0000000000b1";
const today = last(`select ${TODAY}`);

/** Each check's difference from its account (earlier suites leave some, on purpose). */
const differences = () =>
  JSON.parse(
    last(`select test.act_as('owner@example.com');
          select json_object_agg(check_key, difference) from report_reconciliation(${TODAY})`),
  );
const differencesBefore = differences();

// This suite's own supplier, three days away, and items: oat milk, 2,000 ml
// on hand, reorder level 5,000, par level 12,000, bought by the litre carton;
// straws never in stock, reorder level 100, by the box of 100; a syrup new
// today, with no level of its own.
const DAIRY = last(`select test.act_as('manager@example.com');
                    select create_supplier('E2E Dairy', 'Rawa', '0750 555 0102')`);
sql(`select test.act_as('manager@example.com');
     select update_supplier('${DAIRY}', 'E2E Dairy', 'Rawa', '0750 555 0102', true, 'three days away', 3)`);
sql(`select test.act_as('owner@example.com');
     select create_item('E2E Oat milk', 'ingredient', 'ml', 'volume', null, null, 5000,
                        '[{"code": "carton_1l", "label": "Carton of 1 L", "factor": 1000}]', 2000, 1.5, false,
                        'E2E opening');
     select create_item('E2E Straws', 'consumable', 'each', 'count', null, null, 100,
                        '[{"code": "box_100", "label": "Box of 100", "factor": 100}]');
     select create_item('E2E Syrup', 'ingredient', 'ml', 'volume', null, null, null, '[]', 500, 2, false,
                        'E2E opening')`);
const itemId = (name) =>
  last(`select id from item where business_id = '${B}' and name = '${name}'`);
const OAT = itemId("E2E Oat milk");
const STRAWS = itemId("E2E Straws");
sql(`select test.act_as('owner@example.com');
     select update_item('${OAT}', 'E2E Oat milk', 'ingredient', p_min_level => 5000, p_par_level => 12000)`);
const ordersBefore = n(`select count(*) from purchase_order where business_id = '${B}'`);
// City Packaging Supplies delivers in its own days, or the café's when it has none.
const cityLead = n(`select coalesce(lead_time_days, alert_setting('${B}', 'lead_time_days'))
                      from supplier where business_id = '${B}' and name = 'City Packaging Supplies'`);

const line = (page, item) => page.locator(`[data-testid="buying-line"][data-item="${item}"]`);
const why = async (page, item) =>
  (await line(page, item).getByTestId("buying-why").textContent()) ?? "";

// ------------------------------------------------------------ what to buy
console.log("▸ a manager opens What to buy: what is to order, with why, and what is not");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  await page.getByTestId("buying-link").getByRole("link", { name: "Open What to buy" }).click();
  await page.waitForURL(/\/purchasing\/buying-list$/, { timeout: 15000 });
  await page.getByTestId("buying-page").waitFor({ timeout: 15000 });
  check(
    (await page.locator(".phead").textContent()).includes("use judged over the last 28 days"),
    "Purchasing leads to What to buy, for the branch, its use judged over 28 days",
  );
  const none = page.locator('[data-testid="buying-group"][data-supplier=""]');
  check(
    (await none.getByRole("heading").textContent()) === "No supplier yet" &&
      (await none.locator('[data-testid="buying-line"][data-item="E2E Oat milk"]').count()) === 1 &&
      (await none.locator('[data-testid="buying-line"][data-item="E2E Straws"]').count()) === 1,
    "oat milk and straws are to order, under no supplier yet",
  );
  const oat = await why(page, "E2E Oat milk");
  check(
    [
      "2,000 ml on hand.",
      "Below its reorder level, set on the item: 5,000 ml.",
      "Ordered up to its par level, 12,000 ml.",
      "10,000 ml to order.",
      "No supplier yet: choose one.",
      "1.5 IQD a pack, from what it costs now",
    ].every((w) => oat.includes(w)),
    "the oat milk's why: 2,000 on hand, its own reorder level, up to its par level, 10,000 ml, priced at its cost now",
  );
  check(
    (await why(page, "E2E Straws")).includes("0 each on hand.") &&
      (await why(page, "E2E Straws")).includes("No price yet: enter one."),
    "straws: none on hand, and no price to go by",
  );
  const rest = page.getByTestId("buying-rest");
  await rest.locator("summary").click();
  const syrup = rest.locator('[data-testid="buying-rest-line"][data-item="E2E Syrup"]');
  check(
    (await syrup.textContent()).includes("Not enough history") &&
      (await syrup.textContent()).includes("Only 0 day(s) of history: 7 are needed"),
    "the syrup, new today, has not enough history to judge by",
  );

  // Each given a supplier and a pack; the rest unticked.
  let oatLine = line(page, "E2E Oat milk");
  await oatLine.getByLabel("Supplier", { exact: true }).selectOption({ label: "E2E Dairy" });
  await page
    .locator(
      '[data-testid="buying-group"][data-supplier="E2E Dairy"] [data-testid="buying-line"][data-item="E2E Oat milk"]',
    )
    .waitFor({ timeout: 10000 });
  oatLine = line(page, "E2E Oat milk");
  await oatLine.getByLabel("Pack", { exact: true }).selectOption({ label: "Carton of 1 L" });
  check(
    (await oatLine.getByLabel("Quantity", { exact: true }).inputValue()) === "10" &&
      (await oatLine.getByLabel("Price of a pack", { exact: true }).inputValue()) === "1500",
    "in cartons: 10 of them, at 1,500 a carton",
  );
  await oatLine.getByLabel("Make it the usual one").check();
  const strawLine = line(page, "E2E Straws");
  await strawLine
    .getByLabel("Supplier", { exact: true })
    .selectOption({ label: "City Packaging Supplies" });
  await strawLine.getByLabel("Pack", { exact: true }).selectOption({ label: "Box of 100" });
  check(
    (await line(page, "E2E Straws").getByLabel("Quantity", { exact: true }).inputValue()) === "1",
    "straws: one box of 100",
  );
  for (const box of await page.locator('[data-testid="buying-line"]').all()) {
    const item = await box.getAttribute("data-item");
    if (item !== "E2E Oat milk" && item !== "E2E Straws")
      await box.getByRole("checkbox").first().uncheck();
  }
  const create = page.getByTestId("buying-create");
  check(
    await create.getByRole("button", { name: "Create the orders" }).isDisabled(),
    "with no price for the straws, no orders are made",
  );
  await line(page, "E2E Straws").getByLabel("Price of a pack", { exact: true }).fill("5000");
  check(
    (await create.textContent()).includes("2 line(s) ticked: 2 draft order(s), 20,000 IQD in all."),
    "two lines, two suppliers: two draft orders, 20,000 in all",
  );
  await create.getByRole("button", { name: "Create the orders" }).click();
  const made = page.getByTestId("buying-made");
  await made.waitFor({ timeout: 15000 });
  check(
    (await made.textContent()).includes("2 draft orders made, for a manager to approve:") &&
      (await made.getByTestId("buying-made-order").count()) === 2,
    "two draft orders are made, each linked",
  );
  check(
    n(`select count(*) from purchase_order where business_id = '${B}'`) === ordersBefore + 2,
    "exactly two orders, drafted once",
  );
  const drafted = sql(`
    select s.name || ' ' || o.status || ' +' || (o.expected_on - ${TODAY}) || ' ' || coalesce(o.note, '-') || ': '
           || string_agg(i.name || ' ' || trim_scale(l.order_qty) || ' ' || l.order_unit_code || ' at '
                         || trim_scale(l.unit_price), ', ')
      from purchase_order o join supplier s on s.id = o.supplier_id
      join purchase_order_line l on l.purchase_order_id = o.id join item i on i.id = l.item_id
     where o.business_id = '${B}' and i.id in ('${OAT}', '${STRAWS}') and o.status = 'draft'
     group by s.name, o.status, o.expected_on, o.note order by s.name`);
  check(
    drafted ===
      `City Packaging Supplies draft +${cityLead} -: E2E Straws 1 box_100 at 5000\n` +
        "E2E Dairy draft +3 -: E2E Oat milk 10 carton_1l at 1500",
    "each a draft for its supplier, expected in that supplier's days (the café's for one with none), no note",
  );
  check(
    last(`select l.pack_unit_code || ' ' || trim_scale(l.last_price) || ' ' || l.preferred
            from item_supplier l where l.item_id = '${OAT}' and l.supplier_id = '${DAIRY}'`) ===
      "carton_1l 1500 true",
    "the dairy is now the oat milk's usual supplier, by the carton at 1,500",
  );

  // Drafted: nothing is suggested twice.
  await page.reload();
  await page.getByTestId("buying-page").waitFor({ timeout: 15000 });
  check(
    (await page.locator('[data-testid="buying-line"][data-item="E2E Oat milk"]').count()) === 0,
    "drafted, the oat milk is no longer to order",
  );
  await page.getByTestId("buying-rest").locator("summary").click();
  const oatRest = await page
    .locator('[data-testid="buying-rest-line"][data-item="E2E Oat milk"]')
    .textContent();
  check(
    oatRest.includes("Enough") &&
      oatRest.includes(
        "2,000 ml on hand, 0 ml on order and 10,000 ml in draft orders: 12,000 ml in all.",
      ),
    "it has enough, with what the draft holds counted",
  );
  await ctx.close();
}

// ------------------------------------------------------------ who it is bought from
console.log("▸ on the item's page: who it is bought from, set and removed");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, `/inventory/${OAT}`);
  const panel = page.getByTestId("item-suppliers");
  const dairyRow = panel.locator('[data-testid="item-supplier-row"][data-supplier="E2E Dairy"]');
  check(
    (await dairyRow.textContent()).includes("The usual supplier") &&
      (await dairyRow.textContent()).includes("Carton of 1 L") &&
      (await dairyRow.textContent()).includes("1,500 IQD"),
    "the dairy: the usual supplier, by the carton, at 1,500",
  );
  const form = panel.getByTestId("item-supplier-form");
  await form
    .getByLabel("Supplier", { exact: true })
    .selectOption({ label: "City Packaging Supplies" });
  await form.getByLabel("Pack", { exact: true }).selectOption({ label: "Carton of 1 L" });
  await form.getByLabel("Price of a pack", { exact: true }).fill("1400");
  await form.getByLabel("The usual supplier").check();
  await form.getByRole("button", { name: "Save the supplier" }).click();
  await panel.getByText("Saved, and on the audit trail.").waitFor({ timeout: 15000 });
  const cityRow = panel.locator(
    '[data-testid="item-supplier-row"][data-supplier="City Packaging Supplies"]',
  );
  await cityRow.waitFor({ timeout: 10000 });
  check(
    (await cityRow.textContent()).includes("The usual supplier") &&
      !(await dairyRow.textContent()).includes("The usual supplier"),
    "City Packaging Supplies is the usual one now, in the dairy's place",
  );
  await dairyRow.getByRole("button", { name: "Remove" }).click();
  await panel.getByText("Removed, and on the audit trail.").waitFor({ timeout: 15000 });
  await dairyRow.waitFor({ state: "detached", timeout: 10000 });
  check(
    n(`select count(*) from item_supplier where item_id = '${OAT}'`) === 1,
    "the dairy is removed; one supplier is left",
  );
  await open(page, "/purchasing/buying-list");
  await page.getByTestId("buying-rest").locator("summary").click();
  check(
    (
      await page.locator('[data-testid="buying-rest-line"][data-item="E2E Oat milk"]').textContent()
    ).includes("Enough"),
    "and the list reads it again",
  );
  await ctx.close();
}

// ------------------------------------------------------------ a cashier, and the trail
console.log("▸ a cashier sees no buying list; the trail says who set what");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/purchasing/buying-list");
  check(
    (await page.getByTestId("buying-page").count()) === 0,
    "a cashier, who sees no costs, is sent elsewhere",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/audit?group=items");
  const trail = await page.locator("main").textContent();
  check(
    ["Item's supplier set", "Item's supplier removed", "E2E Oat milk", "E2E Straws"].every((w) =>
      trail.includes(w),
    ),
    "the trail names each supplier set or removed, by the item",
  );
  await ctx.close();
}

// ------------------------------------------------------------ in Arabic and Kurdish
console.log("▸ the new screens in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of [
    "/purchasing",
    "/purchasing/buying-list",
    `/inventory/${STRAWS}`,
    "/audit?group=items",
  ]) {
    await open(page, path);
    if (path === "/purchasing/buying-list")
      await page.getByTestId("buying-rest").locator("summary").click();
    const words = await english(page, path.replace(/\?.*$/, ""));
    if (words.length) left.push(`${path}: ${words.slice(0, 12).join(" ")}`);
  }
  check(
    left.length === 0,
    `in ${locale}, no English but the café's own names` +
      (left.length ? `\n      ${left.join("\n      ")}` : ""),
  );
  await ctx.close();
}

// ------------------------------------------------------------ the books
console.log("▸ the books still tie");
{
  const after = differences();
  const moved = Object.keys({ ...differencesBefore, ...after }).filter(
    (k) => Number(after[k] ?? 0) !== Number(differencesBefore[k] ?? 0),
  );
  check(
    moved.length === 0,
    `no subledger moved away from its account${moved.length ? `: ${moved.join(", ")}` : ""}`,
  );
}

await browser.close();
done("buying");
