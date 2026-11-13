// Packing at the till (0107), through the real screens: the owner makes a
// stock item packing, one an order to take away; the pay screen shows it, the
// cashier makes it two with +, and the order's packing leaves stock to 5500
// Packaging. Reports → Packing shows it.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();

console.log("▸ the owner sets up the packing");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#packing");
  const part = page.getByTestId("packing-settings");
  await part.waitFor({ timeout: 10000 });
  const pick = part.getByTestId("packing-new-item");
  const value = await pick.locator("option", { hasText: "Golden water" }).getAttribute("value");
  await pick.selectOption(value);
  await part.getByTestId("packing-new-role").selectOption("bag");
  await part.getByTestId("packing-add").click();
  await part
    .locator('[data-testid="packing-row"][data-item="Golden water"]')
    .waitFor({ timeout: 10000 });
  check(
    last(
      `select role || ' ' || takeaway_qty || ' ' || delivery_qty from packing_item p join item i on i.id = p.item_id where i.name = 'Golden water'`,
    ) === "bag 1 1",
    "a bag: one an order, to take away and for delivery",
  );
  await ctx.close();
}

console.log("▸ the pay screen counts it, and the cashier makes it two");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Takeaway" }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).first().click();
  await page.getByRole("button", { name: /Cash/ }).click();
  const row = page.locator('[data-testid="pack-item"][data-item="Golden water"]');
  await row.waitFor({ timeout: 10000 });
  check((await row.getByTestId("pack-n").textContent()) === "1", "one bag by default");
  await row.getByTestId("pack-more").click();
  check((await row.getByTestId("pack-n").textContent()) === "2", "+ makes it two");
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    last(
      `select trim_scale(sp.qty) || ' ' || sp.sent_by_till from sales_order_packing sp join item i on i.id = sp.item_id
        where i.name = 'Golden water' order by sp.created_at desc limit 1`,
    ) === "2 true",
    "the order went out in two, as the cashier counted",
  );
  check(
    Number(
      last(`select coalesce(sum(l.debit - l.credit), 0)::int from journal_line l
              join gl_account g on g.id = l.account_id join journal_entry e on e.id = l.journal_entry_id
             where g.code = '5500' and e.status = 'published'`),
    ) > 0,
    "its cost on 5500 Packaging",
  );
  await ctx.close();
}

console.log("▸ Reports → Packing");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports/packing");
  await page.getByTestId("packing-total").waitFor({ timeout: 10000 });
  check(
    ((await page.getByTestId("packing-by-item").textContent()) ?? "").includes("Golden water"),
    "by item",
  );
  await ctx.close();
}

await browser.close();
done("packing");
