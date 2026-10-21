// Tips and a service charge (0090). The owner sets a service charge of 10% at
// a table on Settings, and ticks two people to share the tips on Payroll. At
// the till, an espresso at a table shows the service charge on the way to
// pay; a tip of 500 is added, and the card pays all three. A second is paid
// with the service charge taken off. Payroll shows today's tips shared
// between the two; Sales analysis shows what the till took of both.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const ESPRESSO = "d1000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-0000000000b1";
const tz = last(`select timezone from business limit 1`);
const espresso = () =>
  Number(
    last(`select price_on('${ESPRESSO}', 'dine_in', null, (now() at time zone '${tz}')::date)`),
  );
const latest = () =>
  last(`select service_amount || ' ' || tip_amount || ' ' || net_amount || ' '
               || (select sum(amount) from sales_tender t where t.sales_order_id = o.id)
          from sales_order o order by created_at desc limit 1`);

// Two people who work here, made now when no suite before made them.
sql(`select test.act_as('owner@example.com');
     select save_employee(null, n, null, 'Waiter', default_location('${B}'),
                          (now() at time zone '${tz}')::date - 30, null, gen_random_uuid())
       from unnest(array['Tip Avin', 'Tip Bana']) n
      where not exists (select 1 from employee where full_name = n)`);

console.log("▸ the owner sets the service charge, and who shares the tips");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  const row = page.locator('[data-testid="service-row"][data-channel="dine_in"]');
  await row.getByTestId("service-percent").fill("10");
  await row.getByTestId("service-save").click();
  await row.getByText("10%").waitFor({ timeout: 15000 });
  check(
    last(`select percent from service_charge where channel = 'dine_in'`) === "10",
    "10% at a table",
  );
  check(
    (await page.locator('[data-testid="service-row"][data-channel="talabat"]').count()) === 0,
    "a delivery platform is not offered one",
  );

  await open(page, "/payroll");
  const card = page.getByTestId("tips-card");
  for (const name of ["Tip Avin", "Tip Bana"])
    await card.locator(`[data-testid="tip-sharer"][data-name="${name}"] input`).check();
  await card.getByTestId("tip-sharers-save").click();
  await card.getByText("Saved: from today, the tips are shared between them.").waitFor({
    timeout: 15000,
  });
  check(
    last(`select count(*) from tip_sharer t join employee e on e.id = t.employee_id
           where e.full_name like 'Tip %' and t.until_day is null`) === "2",
    "two ticked to share the tips",
  );
  await ctx.close();
}

console.log("▸ the till");
const price = espresso();
const service = Math.round(price / 10);
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const tab = page.locator('.pos-top [role="tablist"] [role="tab"]').last();
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Dine-in" }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /^Card$/ }).click();
  const svc = page.getByTestId("pay-service-amount");
  await svc.waitFor({ timeout: 10000 });
  check(
    ((await svc.textContent()) ?? "").includes(service.toLocaleString("en")),
    `the service charge on the way to pay: 10% of ${price.toLocaleString("en")}`,
  );
  await page.getByTestId("pay-tip").fill("500");
  check(
    ((await page.getByTestId("pay-total").textContent()) ?? "").includes(
      (price + service + 500).toLocaleString("en"),
    ),
    "the total is the espresso, the service charge and the tip",
  );
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 15000 });
  check(
    latest() === `${service} 500 ${price} ${price + service + 500}`,
    "recorded: the service charge and the tip apart, the card paid all of it",
  );

  // The service charge taken off one sale.
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /^Card$/ }).click();
  await page.getByTestId("pay-service-toggle").click();
  check(
    ((await page.getByTestId("pay-total").textContent()) ?? "").includes(
      price.toLocaleString("en"),
    ),
    "taken off: the espresso alone",
  );
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 15000 });
  check(latest() === `0 0 ${price} ${price}`, "recorded without it");
  await ctx.close();
}

console.log("▸ Payroll and Reports");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/payroll");
  const card = page.getByTestId("tips-card");
  const people = await card.getByTestId("tips-people").textContent();
  check(
    (people ?? "").includes("Tip Avin") && (people ?? "").includes("Tip Bana"),
    "today's 500 shared between the two ticked",
  );
  await open(page, "/reports/sales");
  const extras = page.getByTestId("extras-report");
  await extras.waitFor({ timeout: 15000 });
  check(
    ((await extras.getByTestId("extras-tips").textContent()) ?? "").includes("500"),
    "Sales analysis shows the service charge and the tips",
  );
  await ctx.close();
}

// The service charge off again, for the suites after this one.
sql(`delete from service_charge`);

await browser.close();
done("tips");
