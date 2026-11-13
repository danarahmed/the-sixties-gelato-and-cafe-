// Social insurance and the payslip (0112). The owner turns social insurance
// on, 12% the café's and 5% the person's, on Payroll, and unticks someone on a
// trial period. Two months ago's payroll, approved, takes Sara's 5% (30,000)
// from her 600,000; the payroll shows it, and her payslip says so with the
// café's 72,000. The month's social insurance is paid to the government from
// the bank, and nothing is left. Then it is turned off again, so the suites
// after this one count the pay as before.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const tz = last(`select timezone from business limit 1`);
const TODAY = `(now() at time zone '${tz}')::date`;
const MONTH = last(`select (date_trunc('month', ${TODAY}) - interval '2 months')::date`);
const MAIN = last(`select default_location('${B}')`);

sql(`select test.act_as('owner@example.com');
     select save_employee(null, n, null, 'Barista', '${MAIN}', ${TODAY} - 120, null, gen_random_uuid())
       from unnest(array['SI Sara', 'SI Dara']) n
      where not exists (select 1 from employee where full_name = n);
     select set_employee_pay((select id from employee where full_name = 'SI Sara'), 'monthly', 600000, 8, null,
                             'Her salary', gen_random_uuid());
     select set_employee_pay((select id from employee where full_name = 'SI Dara'), 'monthly', 500000, 8, null,
                             'His salary', gen_random_uuid());`);

console.log("▸ the owner turns social insurance on, and leaves out someone on a trial");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/payroll#social-insurance");
  const card = page.getByTestId("social-insurance");
  await card.getByTestId("si-enabled").check();
  await card.getByTestId("si-employer").fill("12");
  await card.getByTestId("si-employee").fill("5");
  await card.getByRole("button", { name: "Save" }).click();
  await card.getByText("Saved: the next payroll approved takes it.").waitFor({ timeout: 15000 });
  check(
    last(`select enabled || ' ' || employer_percent::int || ' ' || employee_percent::int
            from social_insurance_setup`) === "true 12 5",
    "on: 12% the café's, 5% the person's",
  );
  check(
    last(`select count(*) from gl_account where code in ('6120', '2110')`) === "2",
    "its two accounts: 6120 Social insurance, 2110 Social insurance owed",
  );
  await card.locator('[data-testid="si-person"][data-name="SI Dara"] input').uncheck();
  for (let i = 0; i < 30; i++) {
    if (last(`select social_insurance from employee where full_name = 'SI Dara'`) === "f") break;
    await page.waitForTimeout(300);
  }
  check(
    last(`select social_insurance from employee where full_name = 'SI Dara'`) === "f",
    "Dara, on a trial, is left out",
  );
  await ctx.close();
}

// Two months ago's payroll, drafted and approved (staff's suite has last month's).
const RUN = (() => {
  sql(`select test.act_as('owner@example.com');
       select draft_payroll('${MONTH}', gen_random_uuid())
        where not exists (select 1 from payroll_run where month = '${MONTH}')`);
  const id = last(`select id from payroll_run where month = '${MONTH}'`);
  // Anyone another suite made without a pay is given one, and the draft drawn again.
  sql(`select test.act_as('owner@example.com');
       select set_employee_pay(l.employee_id, 'monthly', 100000, 8, null, 'For the payroll', gen_random_uuid())
         from payroll_line l where l.run_id = '${id}' and l.pay_basis is null;
       select draft_payroll('${MONTH}', gen_random_uuid())
        where exists (select 1 from payroll_line l where l.run_id = '${id}' and l.pay_basis is null)`);
  sql(`select test.act_as('owner@example.com');
       select approve_payroll('${id}', gen_random_uuid())
        where (select status from payroll_run where id = '${id}') = 'draft'`);
  return id;
})();
const sara = () =>
  last(`select net::int || ' ' || si_employee::int || ' ' || si_employer::int from payroll_line l
          join employee e on e.id = l.employee_id where l.run_id = '${RUN}' and e.full_name = 'SI Sara'`);
check(sara() === "570000 30000 72000", "approved: Sara's 5% off her pay, the café's 12% on top");

console.log("▸ the payroll and her payslip");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/payroll/${RUN}`);
  const line = page.locator('[data-testid="payroll-line"][data-name="SI Sara"]');
  check(
    ((await line.getByTestId("payroll-si").textContent()) ?? "").includes("30,000"),
    "her line shows the social insurance taken",
  );
  check(
    ((await line.getByTestId("line-net").textContent()) ?? "").includes("570,000"),
    "and 570,000 to be paid",
  );
  check(
    (await page
      .locator('[data-testid="payroll-line"][data-name="SI Dara"] [data-testid="payroll-si"]')
      .count()) === 0,
    "nothing taken from Dara's",
  );
  await line.getByTestId("payslip-link").click();
  await page.waitForURL(/\/payroll\/payslip\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const slip = page.getByTestId("payslip");
  await slip.waitFor({ timeout: 15000 });
  const text = (await slip.textContent()) ?? "";
  check(
    text.includes("SI Sara") && text.includes("600,000") && text.includes("30,000"),
    "her payslip: the salary, and her 5% taken",
  );
  check(
    ((await page.getByTestId("payslip-net").textContent()) ?? "").includes("570,000"),
    "what she is paid",
  );
  check(
    ((await page.getByTestId("payslip-employer").textContent()) ?? "").includes("72,000"),
    "and the café's part, on top of the pay",
  );
  await ctx.close();
}

console.log("▸ the month's social insurance, paid to the government");
{
  const owed = Number(
    last(
      `select test.act_as('owner@example.com'); select social_insurance_month('${MONTH}') ->> 'left'`,
    ),
  );
  check(owed >= 102000, `the month owes ${owed.toLocaleString("en")}, Sara's 102,000 among it`);
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/payroll#social-insurance");
  const label = last(`select payroll_month_text('${MONTH}')`);
  const row = page.locator(`[data-testid="si-month"][data-month="${label}"]`);
  check(
    ((await row.getByTestId("si-left").textContent()) ?? "").includes(owed.toLocaleString("en")),
    "Payroll shows what is left to pay",
  );
  await row.getByTestId("si-pay").click();
  const form = page.getByTestId("si-pay-form");
  await form.getByLabel("The government's receipt no.").fill("SI-77");
  await form.getByRole("button", { name: "Pay the government" }).click();
  await form.waitFor({ state: "detached", timeout: 15000 });
  check(
    last(
      `select test.act_as('owner@example.com'); select social_insurance_month('${MONTH}') ->> 'left'`,
    ) === "0",
    "paid from the bank: nothing left",
  );
  check(
    last(
      `select count(*) from social_insurance_payment where reference = 'SI-77' and account_code = '1020'`,
    ) === "1",
    "from the bank, with the government's receipt",
  );
  await ctx.close();
}

// Off again, for the suites after this one.
sql(`select test.act_as('owner@example.com'); select set_social_insurance(false)`);
await browser.close();
done("social insurance and the payslip");
