// Offline (audit H-04, then round fifteen, 0073): the app says plainly there
// is no connection, in English, Arabic and Kurdish, right to left where the
// language is; a quick sale is kept on the till and sent once it is back,
// recorded once; and (0082) a table's bill keeps taking orders and can be paid,
// its changes saved and the bill paid once the connection is back. And on a slow
// connection, each page is hydrated once.
import { chromium, BASE, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const sales = () => Number(sql("select count(*) from sales_order"));
for (const locale of ["en", "ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "cashier");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/pos");
  const dir = await page.evaluate(() => document.documentElement.dir);
  check(dir === (locale === "en" ? "ltr" : "rtl"), `${locale}: written ${dir}`);
  await page.locator(".product-tile").first().click();
  await ctx.setOffline(true);
  await page.waitForTimeout(300);
  const banner =
    (await page
      .locator(".offline-banner")
      .textContent()
      .catch(() => "")) ?? "";
  check(banner.length > 0, `${locale}: offline banner — “${banner}”`);
  const said = (await page.getByTestId("order-offline").textContent()) ?? "";
  check(said.length > 0, `${locale}: the order says a quick sale is kept on the till — “${said}”`);
  check(
    !(await page.locator(".pos-grid .order-actions button.btn-primary").last().isDisabled()),
    `${locale}: a quick sale can still be paid`,
  );
  await ctx.setOffline(false);
  await page.waitForTimeout(300);
  check(
    (await page.locator(".offline-banner").count()) === 0,
    `${locale}: the banner clears when the connection returns`,
  );
  await ctx.close();
}

console.log("▸ a quick sale with no connection: kept on the till, sent once it is back");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const before = sales();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await ctx.setOffline(true);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^Card$/ }).click();
  check(
    ((await page.locator(".pos-modal").textContent()) ?? "").includes("kept on this till"),
    "the pay dialog says the sale is kept on the till",
  );
  await page.locator(".pay-confirm").click();
  await page.getByTestId("receipt-offline").waitFor();
  check(
    ((await page.getByTestId("receipt-offline").textContent()) ?? "").includes("Offline"),
    "its receipt is the till's: Offline and its number",
  );
  const strip = page.getByTestId("offline-strip");
  check((await strip.getAttribute("data-waiting")) === "1", "the till says one sale is kept on it");
  check(sales() === before, "nothing reaches the database while there is no connection");
  await ctx.setOffline(false);
  await strip.waitFor({ state: "detached", timeout: 20000 });
  check(sales() === before + 1, "back online, the sale is sent by itself");
  check(
    sql(
      "select count(*) from sales_order where sold_offline_at is not null and placed_at <= now()",
    ) !== "0",
    "recorded as sold offline, at the time it was sold",
  );
  await page.reload();
  await page.waitForTimeout(1500);
  check(sales() === before + 1, "and sent once: reopening the till sends nothing again");
  await ctx.close();
}

// A named bill opened by the cashier, with one espresso on it (0082).
function openBill(label) {
  sql(`select test.act_as('cashier@example.com');
       select open_tab('dine_in', p_label => '${label}',
         p_lines => '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]')`);
  return sql(`select id from pos_tab where label = '${label}' and status = 'open'`);
}
async function toBill(page, label) {
  await page.getByRole("tab", { name: /Tables/ }).click();
  await page.locator(".bill-row", { hasText: label }).click();
}
const espresso = (page) => page.locator(".product-tile", { hasText: "Golden espresso" });

console.log(
  "▸ a table's bill with no connection: what is added is kept, and saved once it is back",
);
{
  const id = openBill("Offline K");
  // A manager: the Tables view is there even before the café sets out its tables.
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/pos");
  await ctx.setOffline(true);
  await page.waitForTimeout(300);
  await toBill(page, "Offline K");
  await espresso(page).click();
  check(
    ((await page.getByTestId("order-offline").textContent()) ?? "").includes("this bill is kept"),
    "the bill says it is kept on this till",
  );
  await page.getByTestId("bill-save").click();
  await page.getByRole("tab", { name: /Tables/ }).click();
  await page.getByTestId("kept-bill").first().waitFor({ timeout: 10000 });
  check(
    sql(`select sum(qty) from pos_tab_line where tab_id = '${id}'`) === "1",
    "nothing reaches the database while there is no connection",
  );
  await ctx.setOffline(false);
  await page.getByTestId("kept-bills").waitFor({ state: "detached", timeout: 40000 });
  check(
    sql(`select sum(qty) from pos_tab_line where tab_id = '${id}'`) === "2",
    "back online, the second espresso is saved on the bill, once",
  );
  await ctx.close();
}

console.log("▸ a table's bill paid with no connection: paid as itself, at the time it was paid");
{
  const id = openBill("Offline P");
  const before = sales();
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/pos");
  await ctx.setOffline(true);
  await page.waitForTimeout(300);
  await toBill(page, "Offline P");
  await espresso(page).click();
  await page.getByRole("button", { name: /^Card$/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByTestId("receipt-offline").waitFor();
  check(
    sql(`select status from pos_tab where id = '${id}'`) === "open" && sales() === before,
    "nothing reaches the database while there is no connection",
  );
  const paidAt = Date.now();
  await ctx.setOffline(false);
  await page.getByTestId("offline-strip").waitFor({ state: "detached", timeout: 40000 });
  check(
    sql(`select status || ' ' || (select sum(qty) from pos_tab_line where tab_id = t.id)
           from pos_tab t where id = '${id}'`) === "paid 2",
    "back online, the bill is saved with both espressos and paid",
  );
  check(sales() === before + 1, "one sale");
  check(
    sql(`select o.sold_offline_at is not null
                and abs(extract(epoch from o.placed_at) * 1000 - ${paidAt}) < 30000
                and o.net_amount = 2 * price_on('d1000000-0000-0000-0000-000000000001', 'dine_in', o.location_id, current_date)
           from sales_order o join pos_tab t on t.sales_order_id = o.id where t.id = '${id}'`) ===
      "t",
    "recorded as sold offline, when the money was taken, at the bill's price",
  );
  await ctx.close();
}

console.log("▸ the internet down behind a working network: the sale is kept, not frozen");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const before = sales();
  // The till's own writes get no answer; the browser still says it is online.
  const cut = (route) =>
    route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue();
  await page.route("**/pos", cut);
  await page.route("**/api/pos/**", (route) => route.abort("internetdisconnected"));
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /^Card$/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByTestId("receipt-offline").waitFor({ timeout: 15000 });
  check(
    true,
    "with no answer, the quick sale is kept on the till and the next customer can be served",
  );
  check(
    (await page.getByRole("button", { name: /Retry/ }).count()) === 0,
    "the till is not frozen waiting for a retry",
  );
  await page.unroute("**/pos", cut);
  await page.unroute("**/api/pos/**");
  await page.getByTestId("offline-strip").waitFor({ state: "detached", timeout: 40000 });
  check(sales() === before + 1, "once it answers again, the sale is sent, once");
  await ctx.close();
}

// A slow connection (or the service worker) can bring a part's code after its
// page. Each page is still hydrated once, whole: before AppShell waited for
// every script, React's #418 (a browser error, which fails signIn's check)
// came on about 1 load in 15 with the code up to 1.5 s late.
{
  const { ctx, page } = await signIn(browser, "owner", { serviceWorkers: "block" });
  await ctx.route("**/_next/static/chunks/**/*.js", async (route) => {
    await new Promise((r) => setTimeout(r, Math.random() * 1500));
    await route.continue();
  });
  for (let i = 0; i < 3; i++)
    for (const path of ["/dashboard", "/pos", "/staff", "/reports"]) await open(page, path);
  check(true, "twelve pages whose code came late, each hydrated once");
  await ctx.close();
}
await browser.close();
done("offline");
