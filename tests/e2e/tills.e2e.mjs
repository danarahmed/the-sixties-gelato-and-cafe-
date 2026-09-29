// The tills at each branch, and who works where (0055, release AB), through
// the real screens: the café opens a second branch, with its own price for an
// espresso. The owner's till offers both branches and sells at the one chosen,
// at its price; a device at the central kitchen is asked which branch it sells
// at. A barista who works at the second branch only sells there, from its own
// numbers, and sees no other place; the first branch's manager cannot void
// the second's sale. The owner puts the cashier at the first branch on
// Settings, and the product card lists the second branch's price. In Arabic
// and Kurdish too.
import { BASE, TODAY, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";

// The second branch, its barista, and its own price for an espresso; beans at
// both branches for what they sell.
sql(`insert into location (business_id, kind, name) values ('${B}', 'branch', 'Second Branch')`);
const main = last(`select id from location where business_id = '${B}' and name = 'Main Branch'`);
const second = last(
  `select id from location where business_id = '${B}' and name = 'Second Branch'`,
);
const kitchen = last(
  `select id from location where business_id = '${B}' and name = 'Central Kitchen'`,
);
sql(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000f1', 'barista2@example.com')
       on conflict do nothing;
     insert into app_user (business_id, full_name, email, auth_user_id)
     values ('${B}', 'Second Barista', 'barista2@example.com', 'a0000000-0000-0000-0000-0000000000f1');
     insert into user_role (app_user_id, role, location_id)
     select id, 'barista', '${second}' from app_user where email = 'barista2@example.com';`);
sql(`select test.act_as('owner@example.com');
     select set_price('d1000000-0000-0000-0000-000000000001', 'dine_in', 3500, null, '${second}', gen_random_uuid());
     select adjust_stock('c0000000-0000-0000-0000-000000000001', 1000, 'g', 'beans for the second branch', 10,
                         '${second}', gen_random_uuid());`);
const sales = (place) =>
  last(`select coalesce(string_agg(trim_scale(net_amount) || ' #' || turn_no, ', ' order by created_at), '')
          from sales_order where location_id = '${place}' and status = 'completed'`);
const mainBefore = sales(main);
// The café's dine-in price at the first branch, whatever the suites before
// this one made it.
const cafePrice = Number(
  last(
    `select trim_scale(price_on('d1000000-0000-0000-0000-000000000001', 'dine_in', '${main}', ${TODAY}))`,
  ),
).toLocaleString("en-US");

/** The till's menu, dine-in: a branch with tables opens on them (the other suites add some). */
async function dineInMenu(page) {
  await page.getByTestId("till-at").or(page.locator(".strip-chip").first()).first().waitFor();
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: "Dine-in", exact: true }).click();
}

/** Ring up one espresso, dine-in, by card, on the till open on this page. */
async function sellEspresso(page) {
  await dineInMenu(page);
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /Card/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
}

console.log("▸ the owner's till offers both branches, and sells at the one chosen");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/pos");
  const choice = page.getByTestId("till-at").getByTestId("place-choice");
  check(
    (await choice.locator("option").allTextContents()).join("|") === "Main Branch|Second Branch" &&
      (await choice.inputValue()) === main,
    "Till at: the café's two branches, the first chosen, and not the kitchen",
  );
  await dineInMenu(page);
  check(
    cafePrice !== "3,500" &&
      (await page.locator(".product-tile", { hasText: "Golden espresso" }).textContent()).includes(
        cafePrice,
      ),
    `at the first branch, dine-in, an espresso is the café's price, ${cafePrice}, not the second's`,
  );
  await Promise.all([page.waitForEvent("load"), choice.selectOption(second)]);
  await page.waitForLoadState("networkidle");
  check(
    (await page.getByTestId("till-at").getByTestId("place-choice").inputValue()) === second,
    "the till, loaded anew, sells at the second branch",
  );
  await dineInMenu(page);
  check(
    (await page.locator(".product-tile", { hasText: "Golden espresso" }).textContent()).includes(
      "3,500",
    ),
    "at the second branch, dine-in, its own price, 3,500",
  );
  await sellEspresso(page);
  check(sales(second) === "3500 #1", "sold at the second branch, at its price, its number 1");
  check(sales(main) === mainBefore, "and nothing at the first branch");

  // The device moved to the kitchen: the till asks which branch it sells at.
  await open(page, "/inventory");
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByTestId("place-choice").selectOption(kitchen),
  ]);
  await page.waitForFunction(
    (id) => document.querySelector('[data-testid="place-choice"]')?.value === id,
    kitchen,
  );
  await open(page, "/pos");
  check(
    (await page.getByTestId("till-no-branch").textContent()).includes(
      "Central Kitchen does not sell: the till is at a branch",
    ),
    "at the kitchen, the till says the kitchen does not sell",
  );
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Sell at Main Branch" }).click(),
  ]);
  await page.getByTestId("till-at").waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("till-at").getByTestId("place-choice").inputValue()) === main,
    "and, a branch chosen, sells there",
  );
  await ctx.close();
}

console.log("▸ the second branch's barista sells there only");
{
  const { ctx, page } = await signIn(browser, "barista2");
  await open(page, "/pos");
  check(
    (await page.getByTestId("till-at").count()) === 0,
    "no branch to choose: the barista works at the second branch",
  );
  await sellEspresso(page);
  check(sales(second) === "3500 #1, 3500 #2", "their sale is the second branch's number 2");
  await open(page, "/inventory");
  check(
    (await page.getByTestId("place-switch").count()) === 0,
    "the stock screens offer no other place",
  );
  await ctx.close();
}

console.log("▸ the first branch's manager cannot void the second branch's sale");
sql(`update user_role set location_id = '${main}'
      where app_user_id = (select id from app_user where email = 'manager@example.com')`);
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/orders");
  // The barista's sale at the second branch, by who took it.
  const row = page.locator("tbody tr", { hasText: "Second Barista" }).first();
  await row.getByRole("button", { name: "Void" }).click();
  const fix = page.getByTestId("order-correction");
  await fix.getByLabel("Why void it?").selectOption("rang_twice");
  await fix.getByRole("button", { name: "Confirm void" }).click();
  await page.getByText("You work at Main Branch, not at Second Branch").waitFor({ timeout: 10000 });
  check(true, "refused, in words: they work at the first branch");
  check(
    last(
      `select count(*) from sales_order where location_id = '${second}' and status = 'voided'`,
    ) === "0",
    "and nothing was voided",
  );
  await ctx.close();
}
sql(`update user_role set location_id = null
      where app_user_id = (select id from app_user where email = 'manager@example.com')`);

console.log("▸ Settings: where each person works; the product card: each branch's price");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  const cashier = last(`select id from app_user where email = 'cashier@example.com'`);
  const cell = page.getByTestId(`works-at-${cashier}`);
  await cell.locator("select").selectOption(main);
  await page.getByText("Demo Cashier works at Main Branch.").waitFor({ timeout: 10000 });
  check(
    last(`select string_agg(distinct coalesce(location_id::text, 'everywhere'), ',') from user_role
           where app_user_id = '${cashier}'`) === main,
    "the owner puts the cashier at the first branch",
  );
  check(
    last(
      `select after_state ->> 'place' from audit_log where action = 'member.place' order by id desc limit 1`,
    ) === "Main Branch",
    "on the audit trail",
  );
  const barista2 = last(`select id from app_user where email = 'barista2@example.com'`);
  check(
    (await page.getByTestId(`works-at-${barista2}`).locator("select").inputValue()) === second,
    "and shows the barista at the second branch",
  );
  await cell.locator("select").selectOption("");
  await page.getByText("Demo Cashier works everywhere.").waitFor({ timeout: 10000 });

  await open(page, "/products");
  check(
    (await page.getByTestId("branch-prices").first().textContent()).includes(
      "At Second Branch: Dine-in 3,500",
    ),
    "the product card lists the second branch's own price",
  );
  await ctx.close();
}

console.log("▸ the books by place: each place's profit and loss, side by side (0056)");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const panel = page.getByTestId("pnl-places");
  const heads = (await panel.locator("thead th").allTextContents()).map((h) => h.trim());
  check(
    heads.slice(1, 4).join("|") === "Main Branch|Central Kitchen|Second Branch" &&
      heads.at(-1) === "Café total",
    "the owner reads a column for each of the café's places, and the café's total",
  );
  // The second branch's sales this month, as the database keeps them.
  const secondSales = Number(
    last(`select coalesce(sum(gross_amount), 0) from sales_order
           where location_id = '${second}' and status = 'completed'
             and business_local_date(business_id, placed_at) >= date_trunc('month', ${TODAY})::date`),
  );
  const cells = (await panel.getByTestId("pnl-places-4000").locator("td").allTextContents()).map(
    (c) => c.trim(),
  );
  const secondCell = cells[heads.indexOf("Second Branch")];
  check(
    secondSales > 0 && secondCell === `${secondSales.toLocaleString("en-US")} IQD`,
    `the second branch's column: its own sales, ${secondSales.toLocaleString("en-US")} IQD (shown: ${secondCell})`,
  );
  const cafeRevenue = (
    await panel.getByTestId("pnl-places-revenue").locator("td").last().textContent()
  )?.trim();
  const pnlRevenue = (await page.locator("#pnl .st-row.total .amt").first().textContent())?.trim();
  check(
    !!cafeRevenue && cafeRevenue === pnlRevenue,
    "the places add up to the café's net revenue, as the profit and loss has it",
  );
  const res = await page.request.get(`${BASE}/reports/export?report=pnl_by_place`);
  const csv = await res.text();
  check(
    res.ok() &&
      csv.startsWith("code,account,section,place,amount") &&
      csv.includes(`,revenue,Second Branch,${secondSales}`),
    "and downloads as a CSV, place by place",
  );
  await ctx.close();
}
console.log("▸ every report at a place (0057)");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const choice = page.getByTestId("reports-place");
  check(
    (await choice.locator("option").allTextContents()).join("|") ===
      "The whole café|Main Branch|Central Kitchen|Second Branch",
    "the owner reads the whole café's reports, or chooses one place",
  );
  await choice.selectOption(second);
  await Promise.all([
    page.waitForURL(/place=/),
    page.getByRole("button", { name: "Show" }).click(),
  ]);
  await page.waitForLoadState("networkidle");
  const secondSales = Number(
    last(`select coalesce(sum(net_amount), 0) from sales_order
           where location_id = '${second}' and status not in ('voided', 'open')
             and business_local_date(business_id, placed_at) >= date_trunc('month', ${TODAY})::date`),
  );
  check(
    (await page.getByTestId("reports-at").textContent())?.includes("Second Branch") &&
      (await page.locator("#pnl h3").textContent())?.trim() === "Profit & Loss at Second Branch" &&
      (await page.getByTestId("pnl-places").count()) === 0,
    "chosen, the second branch's reports and its profit and loss",
  );
  check(
    (await page.locator("#channel").textContent()).includes(secondSales.toLocaleString("en-US")),
    `its sales by channel are its own, ${secondSales.toLocaleString("en-US")}`,
  );
  await ctx.close();
}
sql(`update user_role set location_id = '${main}'
      where app_user_id = (select id from app_user where email = 'manager@example.com')`);
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/reports");
  check(
    (await page.locator("#pnl h3").textContent())?.trim() === "Profit & Loss at Main Branch" &&
      (await page.getByTestId("pnl-places").count()) === 0 &&
      (await page.getByTestId("reports-place").count()) === 0 &&
      (await page.getByTestId("reports-at").textContent())?.includes("Main Branch"),
    "the first branch's manager reads the first branch's reports, and chooses no other place",
  );
  await open(page, "/dashboard");
  check(
    (await page.getByTestId("dashboard-at").textContent())?.includes("Main Branch") &&
      (await page.getByText("Stock at Main Branch").count()) === 1,
    "and the dashboard is the first branch's day",
  );
  await ctx.close();
}
sql(`update user_role set location_id = null
      where app_user_id = (select id from app_user where email = 'manager@example.com')`);

console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const words = [];
  for (const path of ["/pos", "/settings", "/products", "/audit", "/reports"]) {
    await open(page, path);
    words.push(...(await english(page, path)));
  }
  check(
    words.length === 0 && (await page.evaluate(() => document.documentElement.dir)) === "rtl",
    `in ${locale}, right to left, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("tills");
