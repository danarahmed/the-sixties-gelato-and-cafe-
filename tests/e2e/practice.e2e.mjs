// Practice (0096), through the real screens: a cashier starts practising from
// My account; every screen shows the PRACTICE banner and the till sells the
// practice menu; two small lattes by card tick the task, and none of it is
// in the café's sales; Stop practising goes back to the café; the owner sees
// the cashier's progress on the Practice page.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const realSales = () => last(`select count(*) from sales_order where business_id = '${B}'`);

console.log("▸ a cashier practises");
{
  const before = realSales();
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/account");
  await page.getByTestId("account-practice").getByRole("link").click();
  await page.waitForURL((u) => u.pathname === "/practice", { timeout: 10000 });
  check(
    (await page.getByTestId("practice-task").count()) === 6,
    "the Practice page lists a cashier's six tasks",
  );
  await page.getByTestId("practice-start").click();
  await page.waitForURL((u) => u.pathname === "/pos", { timeout: 15000 });
  await page.getByTestId("practice-banner").waitFor({ timeout: 10000 });
  check(true, "practice begun: straight to the till, under the PRACTICE banner");

  for (let i = 0; i < 2; i++) {
    await page.locator(".product-tile", { hasText: "Latte" }).click();
    await page
      .getByRole("button", { name: /^Small/ })
      .first()
      .click();
  }
  await page.getByRole("button", { name: /Card/ }).first().click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(realSales() === before, "the sale is not the café's");
  const practiceCafe = last(
    `select w.business_id from practice_twin t join app_user u on u.id = t.app_user_id
       join app_user w on w.id = t.twin_id where u.email = 'cashier@example.com'`,
  );
  check(
    last(`select count(*) from sales_order where business_id = '${practiceCafe}'`) === "1",
    "it is in the practice café",
  );

  await open(page, "/practice");
  check(
    (await page
      .locator('[data-testid="practice-task"][data-task="sell_card"]')
      .getAttribute("data-done")) === "1",
    "two small lattes by card: ticked",
  );
  await page.getByTestId("practice-stop").click();
  await page.waitForURL((u) => u.pathname === "/practice", { timeout: 10000 });
  await page.getByTestId("practice-start").waitFor({ timeout: 10000 });
  check(!(await page.getByTestId("practice-banner").isVisible()), "stopped: back to the café");
  await ctx.close();
}

console.log("▸ the owner sees who is ready");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/practice");
  const name = last(`select full_name from app_user where email = 'cashier@example.com'`);
  const row = page.locator(`[data-testid="practice-member"][data-name="${name}"]`);
  check(/1 of 6/.test((await row.textContent()) ?? ""), "the cashier: one of six done");
  await ctx.close();
}

await browser.close();
done("practice");
