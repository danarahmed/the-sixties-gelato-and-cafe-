// A supplier bill in dollars and dinars (0103), through the real screens: the
// owner records a bill for a service, 50,000 dinars and $40 at 1,300; Vendors
// shows it owed as dinars and dollars; the dinars are paid, then the dollars in
// dinars at 1,320, the difference to 6950; then nothing is owed.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();

console.log("▸ a bill in dollars and dinars, paid in both");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/vendors");
  await page.getByRole("button", { name: "Bills & payments" }).click();
  await page.getByText("For a service or asset").click();
  await page.getByLabel("Invoice no.").fill("E2E-USD-1");
  await page.locator("label", { hasText: "Amount (IQD)" }).first().locator("input").fill("50000");
  await page.getByTestId("bill-usd").fill("40");
  await page.getByTestId("bill-rate").fill("1300");
  await page.getByRole("button", { name: "Record bill" }).click();
  await page.getByText(/Bill E2E-USD-1 recorded/).waitFor({ timeout: 10000 });
  check(
    last(
      `select amount_total::int || ' ' || usd_amount::int || ' ' || usd_rate::int from purchase_invoice where invoice_no = 'E2E-USD-1'`,
    ) === "102000 40 1300",
    "booked in dinars, 50,000 and $40 at 1,300, the dollars kept beside them",
  );
  const row = page.locator('[data-testid="bill-row"][data-bill="E2E-USD-1"]');
  await row.waitFor({ timeout: 10000 });
  check(
    ((await row.textContent()) ?? "").includes("+ $40"),
    "Vendors shows it owed in dinars and dollars",
  );

  // The dinars.
  const payFor = page.locator("label", { hasText: "Pay bill" }).locator("select");
  const billValue = await payFor.locator("option", { hasText: "E2E-USD-1" }).getAttribute("value");
  await payFor.selectOption(billValue);
  await page.getByTestId("pay-what").selectOption("dinars");
  await page.getByLabel("Paid from").selectOption("bank");
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByText(/Payment recorded/).waitFor({ timeout: 10000 });
  check(
    last(
      `select (amount_total - paid_amount - usd_value)::int from purchase_invoice where invoice_no = 'E2E-USD-1'`,
    ) === "0",
    "the dinars paid",
  );

  // The dollars, in dinars at 1,320.
  await payFor.selectOption(billValue);
  await page.getByTestId("pay-what").selectOption("usd_at_rate");
  await page.getByTestId("pay-usd").fill("40");
  await page.getByTestId("pay-rate").fill("1320");
  await page.getByLabel("Paid from").selectOption("bank");
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.waitForTimeout(1500);
  check(
    last(
      `select is_paid::text || ' ' || usd_paid from purchase_invoice where invoice_no = 'E2E-USD-1'`,
    ) === "true 40.00",
    "the $40 paid: the bill is paid",
  );
  check(
    last(`select sum(l.debit - l.credit)::int from journal_line l join journal_entry e on e.id = l.journal_entry_id
            join gl_account g on g.id = l.account_id
           where g.code = '6950' and e.reference_id in
             (select id from supplier_payment where purchase_invoice_id =
                (select id from purchase_invoice where invoice_no = 'E2E-USD-1'))`) === "800",
    "$40 at 1,320 against 1,300: 800 to exchange differences",
  );
  await ctx.close();
}

await browser.close();
done("dollarbills");
