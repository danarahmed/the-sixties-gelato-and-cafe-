// Cash ahead (0093, SMART_PLAN part 5) through the real screens: a big bill
// due in five days leaves the bank short; Reports leads to Cash ahead, which
// shows the next 30 days, warns of the day the bank would be short and says
// what to do; with the books going back four weeks, the Dashboard says so too;
// a cashier cannot open it; it speaks Arabic and Kurdish. The bill is
// cancelled again for the suites after.
import { BASE, TODAY, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const today = last(`select ${TODAY}`);
const due = last(`select ${TODAY} + 5`);

const supplier = last(
  `select id from supplier where business_id = '${B}' and is_active order by name, id limit 1`,
);
const supplierName = last(`select name from supplier where id = '${supplier}'`);
const bill = last(`select test.act_as('manager@example.com');
  select record_bill('${supplier}', 'E2E-CASH-1', ${TODAY}, 900000000, 5, null, '6200') ->> 'bill_id'`);
// The books go back four weeks: an expense of 40 days ago.
sql(`select test.act_as('owner@example.com');
     select record_expense('E2E old repair', 1000, '6900', 'owner', ${TODAY} - 40)`);

console.log("▸ Reports leads to Cash ahead: the next 30 days, and the day the bank would be short");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  await page.getByTestId("to-cash-ahead").click();
  await page.waitForURL(/\/reports\/cash-ahead/);
  await page.getByTestId("cash-days").waitFor({ timeout: 15000 });
  check(
    (await page.locator('[data-testid="cash-days"] tbody tr').count()) === 30,
    "the next 30 days, day by day",
  );
  const warning = page.getByTestId("cash-warning").first();
  const said = (await warning.textContent()) ?? "";
  check(
    said.includes("The bank would be") && said.includes(`From ${due}`),
    `the bank short from ${due}, the bill's due day: ${said.slice(0, 120)}`,
  );
  check(
    (await warning.getByTestId("cash-warning-action").textContent()).includes(
      `Ask ${supplierName} to take`,
    ),
    "more than the safe holds: ask the supplier to take it later",
  );
  check(
    (await page
      .locator('[data-testid="cash-event"][data-kind="bill"]', { hasText: supplierName })
      .count()) >= 1,
    "the bill among what is due",
  );
  check(
    (await page.locator('[data-testid="cash-chart"] [data-short="yes"]').count()) >= 1,
    "the chart shows the days the bank would be short",
  );
  await ctx.close();
}

console.log("▸ the Dashboard says so");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  check(
    (await page.locator('a[href="/reports/cash-ahead"]').count()) >= 1,
    "a way from the Dashboard's alert to Cash ahead",
  );
  await ctx.close();
}

console.log("▸ a cashier cannot open it; it speaks Arabic and Kurdish");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/reports/cash-ahead");
  check((await page.getByTestId("cash-days").count()) === 0, "a cashier is sent elsewhere");
  await ctx.close();
}
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/reports/cash-ahead");
  const words = await english(page, "/reports/cash-ahead");
  check(
    words.length === 0,
    `in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

// Put back for the suites after.
sql(`select test.act_as('owner@example.com'); select cancel_bill('${bill}', 'E2E: put back')`);
check(today.length === 10, "done");
await browser.close();
done("cashahead");
