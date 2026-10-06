// The owner's answer on staffing (0071, round ten), through the real screens.
// On the last four of one weekday: a calm morning (four orders an hour, one
// person on the clock), a busy evening (sixteen an hour, two on the clock),
// and an afternoon with orders and nobody clocked in. Three people, each paid
// 5,000 IQD an hour, and a labour target of 25% set on Settings → Rules. On
// Staff, two weeks ahead, the owner types that weekday's hours and the week is
// checked as they are typed: one in the morning, enough; one in the evening,
// too few; nobody in the afternoon; three in the morning, more than needed;
// and what the hours will cost against a usual week, against the target.
// Reports → Staffed when busy? shows the four weeks' labour as it was. A
// branch manager, who sees no pay, sees the check and no cost; both screens
// speak Arabic and Kurdish.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const HERE = last(`select default_location('${B}')`);
const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
// The day before yesterday's weekday, as the café counts its week (Saturday
// first): Staffed when busy?'s own suite takes yesterday's.
const W = Number(last(`select (extract(isodow from ${TODAY} - 2)::int + 1) % 7`));
const DAY = WEEKDAYS[W];
const DAYS = "unnest(array[2, 9, 16, 23]) k";
const HOURS =
  "(values (9, 4), (10, 4), (11, 4), (13, 3), (14, 3), (18, 16), (19, 16), (20, 16), (21, 16)) x(h, n)";
const PEOPLE = ["E2E Labour Rana", "E2E Labour Dara", "E2E Labour Hawre"];

console.log(`▸ four ${DAY}s: the hours on the clock, the orders, the pay and the target`);
sql(`select test.act_as('manager@example.com');
     select save_employee(null, n, null, 'Floor', '${HERE}', ${TODAY} - 60)
       from unnest(array['${PEOPLE.join("','")}']) n
      where not exists (select 1 from employee where business_id = '${B}' and full_name = n);
     select test.act_as('owner@example.com');
     select set_employee_pay(e.id, 'hourly', 5000, 8, null, 'E2E', gen_random_uuid())
       from employee e where e.business_id = '${B}' and e.full_name like 'E2E Labour %';
     select set_business_rule('labour_target_percent', 'business', null, '25', 'A quarter of what we sell');
     select test.as_admin();
     insert into attendance (business_id, employee_id, location_id, clock_in, clock_out, work_day, source)
     select '${B}', e.id, '${HERE}', ((${TODAY} - k) + s.a) at time zone 'Asia/Baghdad',
            ((${TODAY} - k) + s.b) at time zone 'Asia/Baghdad', ${TODAY} - k, 'manager'
       from ${DAYS}
       cross join (values ('E2E Labour Rana', time '09:00', time '12:00'),
                          ('E2E Labour Dara', time '18:00', time '22:00'),
                          ('E2E Labour Hawre', time '18:00', time '22:00')) s(name, a, b)
       join employee e on e.business_id = '${B}' and e.full_name = s.name
      where not exists (select 1 from attendance a where a.employee_id = e.id and a.work_day = ${TODAY} - k);`);
// Rung up now, then put back to the hour they stand for (the sale's guard
// stands aside for that alone), as Staffed when busy?'s own suite does.
const sold = last(`select test.act_as('cashier@example.com');
     select count(record_sale(md5('labour|' || k || '|' || h || '|' || i)::uuid, 'dine_in', 'card',
                              '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]'::jsonb))
       from ${DAYS} cross join ${HOURS} cross join lateral generate_series(1, x.n) i;
     select test.as_admin();
     alter table sales_order disable trigger sales_order_financial_guard;
     update sales_order o
        set placed_at = (((${TODAY} - s.k) + make_time(s.h, (s.i * 3) % 60, 0)) at time zone 'Asia/Baghdad')
       from (select k, h, i from ${DAYS} cross join ${HOURS} cross join lateral generate_series(1, x.n) i) s
      where o.idempotency_key = md5('labour|' || s.k || '|' || s.h || '|' || s.i)::uuid;
     alter table sales_order enable trigger sales_order_financial_guard;
     select count(*) from sales_order
      where business_id = '${B}' and idempotency_key in
            (select md5('labour|' || k || '|' || h || '|' || i)::uuid
               from ${DAYS} cross join ${HOURS} cross join lateral generate_series(1, x.n) i)`);
check(Number(sold) === 328, `328 orders over the four ${DAY}s (${sold})`);

// The week two ahead: every day still to come.
const WEEK = last(`select ${TODAY} + 14`);
// The day of that week (it starts on a Saturday) that is the weekday above.
const ON = last(
  `select (${TODAY} + 14 - ((extract(isodow from ${TODAY} + 14)::int + 1) % 7) + ${W})::date`,
);
const cellOf = (page, name) =>
  page.locator(
    `[data-testid="schedule-row"][data-name="${name}"] [data-testid="schedule-cell"][data-day="${ON}"]`,
  );
const part = (page, p) =>
  page.locator(`[data-testid="check-cell"][data-day="${W}"][data-part="${p}"]`);

console.log(`▸ Staff, the week of ${ON}: the ${DAY} checked as its hours are typed`);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/staff?week=${WEEK}&place=${HERE}#schedule`);
  const box = page.getByTestId("schedule-check");
  await box.waitFor({ timeout: 15000 });
  await cellOf(page, "E2E Labour Rana").fill("09:00-12:00");
  await cellOf(page, "E2E Labour Dara").fill("18:00-22:00");
  const morning = part(page, "morning");
  const evening = part(page, "evening");
  const afternoon = part(page, "afternoon");
  await page.waitForFunction(
    ([w]) =>
      document
        .querySelector(`[data-testid="check-cell"][data-day="${w}"][data-part="evening"]`)
        ?.getAttribute("data-flag") === "short",
    [W],
    { timeout: 10000 },
  );
  check(
    (await morning.getAttribute("data-flag")) === "" &&
      /✓\s*1 · needs 1/.test((await morning.textContent()) ?? ""),
    `${DAY} morning: one for four orders an hour, enough (${(await morning.textContent())?.trim()})`,
  );
  check(
    (await evening.getAttribute("data-flag")) === "short" &&
      /▲\s*1 · needs [2-9]/.test((await evening.textContent()) ?? ""),
    `${DAY} evening: one for sixteen an hour, too few (${(await evening.textContent())?.trim()})`,
  );
  check(
    (await afternoon.getAttribute("data-flag")) === "nobody",
    `${DAY} afternoon: orders usually come, and nobody is scheduled`,
  );
  const says = (await box.textContent()) ?? "";
  check(
    says.includes(`Too few: ${DAY} evening (1 scheduled, about`) &&
      says.includes(`Nobody scheduled when orders usually come: ${DAY} afternoon`),
    "said in words: too few in the evening, nobody in the afternoon",
  );
  const cost = (await page.getByTestId("check-cost").textContent()) ?? "";
  check(
    /The week's hours cost 35,000 IQD: \d+% of what a usual week sells, against a target of 25%\./.test(
      cost,
    ) && /By part of the day: Morning \d+% · Afternoon (\d+%|—) · Evening \d+%\./.test(cost),
    `with pay seen: seven hours at 5,000, against a usual week and the 25% target (${cost.trim()})`,
  );
  check(
    (await page.getByTestId("check-labour").count()) === 1,
    "and a row of each day's labour share",
  );
  // Three in the morning: more than four orders an hour need.
  await cellOf(page, "E2E Labour Dara").fill("09:00-12:00");
  await cellOf(page, "E2E Labour Hawre").fill("09:00-12:00");
  await page.waitForFunction(
    ([w]) =>
      document
        .querySelector(`[data-testid="check-cell"][data-day="${w}"][data-part="morning"]`)
        ?.getAttribute("data-flag") === "quiet",
    [W],
    { timeout: 10000 },
  );
  check(
    /▽\s*3 · needs 1/.test((await morning.textContent()) ?? "") &&
      ((await box.textContent()) ?? "").includes(
        `More than needed: ${DAY} morning (3 scheduled, about 1 needed)`,
      ),
    "three typed in the morning: more than needed, said as typed, before anything is saved",
  );
  check(
    Number(
      last(`select count(*) from shift_schedule where day = '${ON}' and location_id = '${HERE}'`),
    ) === 0,
    "nothing is saved until Save the week is pressed",
  );
  await ctx.close();
}

console.log("▸ a branch manager, who sees no pay: the check, and no cost");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, `/staff?week=${WEEK}&place=${HERE}#schedule`);
  await page.getByTestId("schedule-check").waitFor({ timeout: 15000 });
  await cellOf(page, "E2E Labour Dara").fill("18:00-22:00");
  await page.waitForFunction(
    ([w]) =>
      document
        .querySelector(`[data-testid="check-cell"][data-day="${w}"][data-part="evening"]`)
        ?.getAttribute("data-flag") === "short",
    [W],
    { timeout: 10000 },
  );
  check(
    (await page.getByTestId("check-cost").count()) === 0 &&
      (await page.getByTestId("check-labour").count()) === 0,
    "the evening is too few for the manager too, and no cost or labour share is shown",
  );
  await ctx.close();
}

console.log("▸ Reports → Staffed when busy?: the four weeks' labour, against the target");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports/staffing");
  const labour = page.getByTestId("staffing-labour");
  await labour.waitFor({ timeout: 15000 });
  check(
    ((await page.getByTestId("labour-target").textContent()) ?? "").includes(
      "The labour target: 25% of net sales.",
    ),
    "the target is said",
  );
  const weeks = labour.getByTestId("labour-week");
  check((await weeks.count()) === 4, "four weeks, one row each");
  const money = (s) => Number((s ?? "").replace(/[^\d]/g, ""));
  const lastWeek = weeks.last();
  const cost = money(await lastWeek.locator("td").nth(3).textContent());
  check(
    cost >= 55000,
    `the latest week: at least eleven hours at 5,000 (the ${DAY}'s), ${cost.toLocaleString("en-US")} IQD`,
  );
  check(
    (await labour.getByTestId("labour-part").count()) === 3,
    "and morning, afternoon and evening over the four weeks",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/reports/staffing");
  check(
    (await page.getByTestId("staffing-labour").count()) === 0,
    "a branch manager is not shown what the hours cost",
  );
  await ctx.close();
}

console.log("▸ Settings → Rules: the labour target, set");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings/rules");
  const text = (await page.locator("main").textContent()) ?? "";
  check(
    text.includes("Labour cost the café aims for (% of net sales)") && text.includes("25%"),
    "listed with the other rules, at 25%",
  );
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of [
    `/staff?week=${WEEK}&place=${HERE}`,
    "/reports/staffing",
    "/settings/rules",
  ]) {
    await open(page, path);
    left.push(...(await english(page, path)));
  }
  check(
    left.length === 0 && (await page.evaluate(() => document.documentElement.dir)) === "rtl",
    `in ${locale}, right to left, no English but the café's own names` +
      (left.length ? `: ${left.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("labour");
