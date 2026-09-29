// Customers and loyalty (0050, release X), through the real screens: at the
// till a cashier finds a customer by their number, adds them when nobody has
// it, and puts them on a sale, which earns them points; a manager gives points
// by hand on Customers; the customer, found again by their number typed in
// Arabic digits, takes a reward off their next bill, the bill's discount on
// 4100; a delivery by the café's own driver asks for the customer and their
// address, added on the spot. Customers shows who bought what and how their
// points moved; Reports shows the loyalty report; Settings shows its rules.
// The screens speak Arabic and Kurdish, and the books still tie. Paid by card:
// no drawer is needed. Prices are read from the database: earlier suites
// change them.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const E = "d1000000-0000-0000-0000-000000000001";
const last = (q) => sql(q).split("\n").pop();
/** As the screen shows money: 12,345 IQD. */
const iqd = (n) => `${n.toLocaleString("en-US")} IQD`;
/** Today's price of a product on a channel, as the till sells it. */
const price = (channel) =>
  Number(
    last(`select trim_scale(price_on('${E}', '${channel}', default_location('${B}'), ${TODAY}))`),
  );
const points = () =>
  Number(last(`select customer_points(id) from customer where phone = '+9647705551234'`));
const differences = () =>
  sql(`select test.act_as('owner@example.com');
       select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
         from report_reconciliation(${TODAY})`)
    .split("\n")
    .pop();
const before = differences();

// The café's own driver: espresso has a price for it, for the till to offer the channel.
sql(`insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
     select '${B}', '${E}', 'direct_delivery', 3000, '2020-01-01'
      where not exists (select 1 from channel_price where product_variant_id = '${E}' and channel = 'direct_delivery')`);

/** A quick sale at the till: the channel, and so many espressos. */
async function quickSale(page, channel, n) {
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: channel, exact: true }).click();
  const tile = page.locator(".product-tile", { hasText: "Golden espresso" });
  for (let i = 0; i < n; i++) await tile.click();
}

const P = price("dine_in");

console.log("▸ at the till: a customer found by their number, added, and earning points");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await quickSale(page, "Dine-in", 4);
  await page.getByTestId("order-customer-add").click();
  const dialog = page.getByTestId("customer-dialog");
  await dialog.getByTestId("customer-phone").fill("0770 555 1234");
  await dialog.getByTestId("customer-find").click();
  await dialog.getByTestId("customer-nobody").waitFor({ timeout: 10000 });
  check(true, "nobody has the number yet");
  await dialog.getByTestId("customer-add").click();
  const form = dialog.getByTestId("customer-form");
  await form.getByLabel("Name").fill("Hawre Customer");
  await form.getByLabel("Notes about them").fill("Likes it strong");
  await form.getByRole("button", { name: "Add the customer" }).click();
  await dialog.getByTestId("customer-found").waitFor({ timeout: 10000 });
  check(
    (await dialog.getByTestId("customer-points").textContent()).includes("0 points"),
    "added at the till: no points yet",
  );
  await dialog.getByTestId("customer-choose").click();
  check(
    (await page.getByTestId("order-customer-name").textContent()) === "Hawre Customer",
    "the customer is on the order",
  );
  await page.getByRole("button", { name: /Card/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  const earned = Math.floor((4 * P) / 1000);
  check(
    (await page.getByTestId("receipt-points").textContent()).includes(`Points earned: ${earned}`),
    `the receipt card tells the customer: ${iqd(4 * P)} earns ${earned}`,
  );
  check(
    last(`select count(*) from sales_order o join customer c on c.id = o.customer_id
           where c.phone = '+9647705551234'`) === "1" && points() === earned,
    "the sale names its customer, and their points are counted once",
  );
  await ctx.close();
}

console.log("▸ a manager finds them on Customers and gives points by hand");
let CUSTOMER;
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/customers");
  await page.getByTestId("customer-search").fill("555");
  const row = page.locator('[data-testid="customer-row"][data-name="Hawre Customer"]');
  await row.waitFor({ timeout: 10000 });
  check(true, "found by part of their number");
  await row.getByRole("link", { name: "Hawre Customer" }).click();
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/, { timeout: 15000 });
  CUSTOMER = page.url().split("/").pop();
  const form = page.getByTestId("points-form");
  await form.getByLabel("Points").fill("100");
  await form.getByLabel("Why").fill("Points from the paper card");
  await form.getByRole("button", { name: "Give or take them" }).click();
  await page.getByText(/Done: they have \d+ points\./).waitFor({ timeout: 10000 });
  check(points() === Math.floor((4 * P) / 1000) + 100, "given by hand, with why");
  await ctx.close();
}

console.log("▸ found again by the number in Arabic digits, the customer takes a reward");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await quickSale(page, "Dine-in", 3);
  await page.getByTestId("order-customer-add").click();
  const dialog = page.getByTestId("customer-dialog");
  await dialog.getByTestId("customer-phone").fill("٠٧٧٠ ٥٥٥ ١٢٣٤");
  await dialog.getByTestId("customer-find").click();
  await dialog.getByTestId("customer-found").waitFor({ timeout: 10000 });
  check(
    (await dialog.getByTestId("customer-rewards").textContent()).includes("1 rewards to take"),
    "the number typed in Arabic digits finds them, with a reward to take",
  );
  await dialog.getByTestId("customer-choose").click();
  await page.getByRole("button", { name: /Card/ }).click();
  const reward = page.getByTestId("pay-reward");
  await reward.waitFor({ timeout: 10000 });
  await reward.getByTestId("pay-reward-more").click();
  check(
    (await page.getByTestId("pay-total").textContent()).trim() === iqd(3 * P - 5000),
    `a reward takes 5,000 off: ${iqd(3 * P)} comes to ${iqd(3 * P - 5000)}`,
  );
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("receipt-points").textContent()).includes("Points spent: 100"),
    "the receipt card says the reward took 100 points",
  );
  const sale = last(`select o.id from sales_order o join loyalty_ledger l on l.sales_order_id = o.id
                      where l.kind = 'redeem' order by o.placed_at desc limit 1`);
  check(
    last(
      `select discount_reason || ' ' || trim_scale(discount_amount) from sales_order where id = '${sale}'`,
    ) === "Loyalty reward 5000" &&
      last(`select trim_scale(l.debit) from journal_line l join gl_account a on a.id = l.account_id
             join journal_entry e on e.id = l.journal_entry_id
            where e.reference_id = '${sale}' and a.code = '4100'`) === "5000",
    "the reward is the bill's discount: 5,000 on 4100, given as a loyalty reward",
  );
  await ctx.close();
}

console.log("▸ a delivery by the café's own driver goes to the customer's address");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await quickSale(page, "Direct delivery", 1);
  await page.getByRole("button", { name: /Card/ }).click();
  const dialog = page.getByTestId("customer-dialog");
  await dialog.waitFor({ timeout: 10000 });
  check(
    (await dialog.textContent()).includes(
      "A delivery by the café's own driver needs the customer and their address",
    ),
    "the till asks who it goes to before taking the money",
  );
  await dialog.getByTestId("customer-phone").fill("07705551234");
  await dialog.getByTestId("customer-find").click();
  await dialog.getByTestId("customer-found").waitFor({ timeout: 10000 });
  check(
    await dialog.getByTestId("customer-choose").isDisabled(),
    "with no address yet, the customer cannot be put on the delivery",
  );
  await dialog.getByTestId("customer-add-address").click();
  const form = dialog.getByTestId("address-form");
  await form.getByLabel("Address").fill("Salim Street 12");
  await form.getByLabel("How to find it").fill("the blue door");
  await form.getByRole("button", { name: "Add the address" }).click();
  await dialog.getByTestId("customer-address-choice").first().waitFor({ timeout: 10000 });
  await dialog.getByTestId("customer-choose").click();
  check(
    (await page.getByTestId("order-customer-address").textContent()).includes(
      "Salim Street 12 (the blue door)",
    ),
    "the order shows where it goes",
  );
  await page.getByRole("button", { name: /Card/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    last(`select delivery_address from sales_order where channel = 'direct_delivery'
           order by placed_at desc limit 1`) === "Salim Street 12 (the blue door)",
    "the sale keeps the address as it was",
  );
  await ctx.close();
}

console.log("▸ Customers: what they bought, and how their points moved");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, `/customers/${CUSTOMER}`);
  const orders = page.getByTestId("customer-order");
  check((await orders.count()) === 3, "three sales, the latest first");
  check(
    (await page.getByTestId("customer-orders").textContent()).includes(
      "Delivered to Salim Street 12 (the blue door)",
    ),
    "the delivery with its address",
  );
  const kinds = await page
    .getByTestId("ledger-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-kind")));
  check(
    kinds.includes("earn") && kinds.includes("adjust") && kinds.includes("redeem"),
    "points earned, given by hand and spent on a reward",
  );
  check(
    (await page.getByTestId("customer-balance").textContent()).includes(`${points()} points`),
    "their points, as the database counts them",
  );
  await ctx.close();
}

console.log(
  "▸ Reports: the loyalty report; Settings: its rules; the till's staff do not list customers",
);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const report = page.getByTestId("customer-report");
  check(
    (await report.getByTestId("loyalty-rewards").textContent()).includes("Rewards taken: 1") &&
      (await report
        .locator('[data-testid="customer-top-row"][data-name="Hawre Customer"]')
        .count()) === 1,
    "the rewards taken, and who bought the most",
  );
  await open(page, "/settings/rules");
  const text = await page.locator("main").textContent();
  check(
    text.includes("Customers earn points, and take rewards") && text.includes("A reward is worth"),
    "the loyalty rules are on Settings",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  const links = await page.$$eval("nav.sidenav a", (as) => as.map((a) => a.getAttribute("href")));
  check(!links.includes("/customers"), "the till's cashier is not offered the list of customers");
  await ctx.close();
}

console.log("▸ the screens in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of ["/customers", `/customers/${CUSTOMER}`, "/audit?group=customers"]) {
    await open(page, path);
    const words = await english(page, path);
    if (words.length) left.push(`${path}: ${words.slice(0, 12).join(" ")}`);
  }
  check(
    left.length === 0,
    `in ${locale}, no English but the café's own names` +
      (left.length ? `\n      ${left.join("\n      ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ the books still tie");
check(differences() === before, `every subledger is where it was (${differences()})`);

await browser.close();
done("customers");
