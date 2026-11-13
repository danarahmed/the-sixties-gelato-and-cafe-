// The supplier parts (0111), through the real screens: the owner turns on
// quotes; a hotel on account is quoted two espressos, the quote accepted and
// invoiced; a delivery note goes out with the driver and is signed for.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
sql(`insert into customer (business_id, full_name, phone, on_account, credit_limit, terms_days)
     values ('00000000-0000-0000-0000-0000000000b1', 'E2E Hotel', '0750 999 0000', true, 500000, 30)`);

console.log("▸ quotes turned on, a quote made, accepted and invoiced");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#plan");
  await page.getByTestId("parts-reason").fill("We sell to hotels now");
  await page
    .locator('[data-testid="part-row"][data-part="quotes"]')
    .getByTestId("part-toggle")
    .click();
  await page.waitForTimeout(1500);
  await open(page, "/wholesale");
  await page.getByTestId("wholesale").waitFor({ timeout: 10000 });
  const pick = async (testid, text) => {
    const sel = page.getByTestId(testid).first();
    const v = await sel.locator("option", { hasText: text }).first().getAttribute("value");
    await sel.selectOption(v);
  };
  await pick("quote-customer", "E2E Hotel");
  await pick("quote-size", "Golden espresso");
  await page.getByTestId("quote-qty").first().fill("2");
  await page.getByTestId("quote-save").click();
  const row = page.locator('[data-testid="quote-row"]').first();
  await row.waitFor({ timeout: 10000 });
  await row.getByTestId("quote-accept").click();
  await page.waitForTimeout(1200);
  await page.locator('[data-testid="quote-row"]').first().getByTestId("quote-invoice").click();
  await page.waitForTimeout(2000);
  check(
    last(`select status from sales_quote order by created_at desc limit 1`) === "invoiced",
    "the quote is invoiced",
  );

  console.log("▸ a delivery note, out and signed for");
  await pick("delivery-invoice", "E2E Hotel");
  await page.getByTestId("delivery-driver").fill("Hama");
  await page.getByTestId("delivery-make").click();
  const dn = page.locator('[data-testid="delivery-row"]').first();
  await dn.waitFor({ timeout: 10000 });
  await dn.getByTestId("delivery-out").click();
  await page.waitForTimeout(1200);
  await page
    .locator('[data-testid="delivery-row"]')
    .first()
    .getByTestId("delivery-signer")
    .fill("Reception");
  await page.locator('[data-testid="delivery-row"]').first().getByTestId("delivery-done").click();
  await page.waitForTimeout(1500);
  check(
    last(
      `select status || ' ' || received_by from delivery_note order by created_at desc limit 1`,
    ) === "delivered Reception",
    "delivered, and who signed for it",
  );

  await open(page, "/settings#plan");
  await page.getByTestId("parts-reason").fill("Back as a café");
  await page
    .locator('[data-testid="part-row"][data-part="quotes"]')
    .getByTestId("part-toggle")
    .click();
  await page.waitForTimeout(1500);
  await ctx.close();
}

await browser.close();
done("wholesale");
