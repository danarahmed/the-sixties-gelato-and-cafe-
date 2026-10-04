// Staffed when busy? (round six), through the real screens. On the last four
// of yesterday's weekday: one person on the clock from 18:00 to 22:00, with
// two orders an hour, then twelve and ten from 20:00 (short of hands); three
// from 09:00 to 12:00, with no order, then one, then six (quiet, twice); and
// two orders at 23:00 with nobody clocked in. Reports leads to the page,
// which marks those hours on the week's grid, says each in words with what
// one more person, or one fewer, would make of it, and warns that orders
// came with nobody on the clock; a sentence leads to that weekday hour by
// hour, its short hours in raspberry; the page speaks Arabic and Kurdish;
// and the cashier is not shown it.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const HERE = last(`select default_location('${B}')`);
const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
// Yesterday's weekday, as the café counts its week (Saturday first).
const W = Number(last(`select (extract(isodow from ${TODAY} - 1)::int + 1) % 7`));
const day = WEEKDAYS[W];
const DAYS = "unnest(array[1, 8, 15, 22]) k";
const HOURS = "(values (18, 2), (19, 2), (20, 12), (21, 10), (10, 1), (11, 6), (23, 2)) x(h, n)";

console.log(`▸ four ${day}s: the hours on the clock, and the orders hour by hour`);
// Each step once, whatever ran before: the people, their hours, and the sales
// (each sale's key is its day, hour and place in the hour).
sql(`select test.act_as('manager@example.com');
     select save_employee(null, n, null, 'Floor', '${HERE}', ${TODAY} - 60)
       from unnest(array['E2E Evening', 'E2E Morning 1', 'E2E Morning 2', 'E2E Morning 3']) n
      where not exists (select 1 from employee where business_id = '${B}' and full_name = n);
     select test.as_admin();
     insert into attendance (business_id, employee_id, location_id, clock_in, clock_out, work_day, source)
     select '${B}', e.id, '${HERE}', ((${TODAY} - k) + s.a) at time zone 'Asia/Baghdad',
            ((${TODAY} - k) + s.b) at time zone 'Asia/Baghdad', ${TODAY} - k, 'manager'
       from ${DAYS}
       cross join (values ('E2E Evening', time '18:00', time '22:00'),
                          ('E2E Morning 1', time '09:00', time '12:00'),
                          ('E2E Morning 2', time '09:00', time '12:00'),
                          ('E2E Morning 3', time '09:00', time '12:00')) s(name, a, b)
       join employee e on e.business_id = '${B}' and e.full_name = s.name
      where not exists (select 1 from attendance a where a.employee_id = e.id and a.work_day = ${TODAY} - k);`);
// Rung up now, then put back to the hour they stand for: a sale is otherwise
// never changed once made, so its guard stands aside for that alone.
const sold = last(`select test.act_as('cashier@example.com');
     select count(record_sale(md5('staffing|' || k || '|' || h || '|' || i)::uuid, 'dine_in', 'card',
                              '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]'::jsonb))
       from ${DAYS} cross join ${HOURS} cross join lateral generate_series(1, x.n) i;
     select test.as_admin();
     alter table sales_order disable trigger sales_order_financial_guard;
     update sales_order o
        set placed_at = (((${TODAY} - s.k) + make_time(s.h, (s.i * 4) % 60, 0)) at time zone 'Asia/Baghdad')
       from (select k, h, i from ${DAYS} cross join ${HOURS} cross join lateral generate_series(1, x.n) i) s
      where o.idempotency_key = md5('staffing|' || s.k || '|' || s.h || '|' || s.i)::uuid;
     alter table sales_order enable trigger sales_order_financial_guard;
     select count(*) from sales_order
      where business_id = '${B}' and business_local_date('${B}', placed_at) between ${TODAY} - 22 and ${TODAY} - 1
        and extract(isodow from business_local_date('${B}', placed_at)) = extract(isodow from ${TODAY} - 1)`);
check(Number(sold) >= 140, `140 orders over the four ${day}s: ${sold} on them`);

/** A cell of the week's grid: its mark, if any. */
const mark = (page, hour) =>
  page
    .locator(`.hour-grid tr[data-weekday="${W}"] td[data-hour="${hour}"]`)
    .getAttribute("data-flag");

console.log("▸ Reports leads to the page: the hours marked on the week, and said");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  await page.getByTestId("to-staffing").click();
  await page.waitForURL(/\/reports\/staffing/);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("staffing-week").waitFor({ timeout: 15000 });
  const marks = {};
  for (const h of [9, 10, 11, 18, 19, 20, 21, 23]) marks[h] = await mark(page, h);
  check(
    marks[20] === "short" && marks[21] === "short",
    `${day} 20:00 and 21:00, one on the clock for twelve and ten orders: short of hands`,
  );
  check(
    marks[9] === "quiet" && marks[10] === "quiet" && marks[11] === null,
    `${day} 09:00 and 10:00, three on the clock for no order and one: quiet; 11:00, six orders: not`,
  );
  check(
    marks[18] === null && marks[19] === null,
    `${day} 18:00 and 19:00, two orders for the one on the clock: nothing to say`,
  );
  check(marks[23] === "nobody", `${day} 23:00, two orders with nobody clocked in`);
  const busiest = page.locator('[data-testid="staffing-tiles"] [data-tile="busiest"] .value');
  check(
    (await busiest.textContent()) === `${day} 20:00`,
    `the busiest hour: ${await busiest.textContent()}`,
  );

  const says = page.getByTestId("staffing-says");
  const text = (await says.textContent()) ?? "";
  check(
    text.includes(`Short of hands: ${day}, 20:00–22:00.`) &&
      /About 11 orders an hour with 1 on the clock: 11 each, against [\d.]+ usually\. One more would bring it to 5\.5 each\./.test(
        text,
      ),
    "said: short of hands from 20:00 to 22:00, eleven orders an hour for one, five and a half with two",
  );
  check(
    text.includes(`Quiet with 3 on the clock: ${day}, 09:00–11:00.`) &&
      text.includes("one fewer would still leave 2"),
    "said: quiet from 09:00 to 11:00 with three on the clock, and two would still be left",
  );
  check(
    text.includes(`Orders with nobody on the clock: ${day}, 23:00–00:00.`) &&
      /\d+% of the orders were rung up with nobody on the clock\./.test(text),
    "said: orders at 23:00 with nobody clocked in, and how much of the orders that is",
  );

  console.log(`▸ a sentence leads to ${day}, hour by hour`);
  await says.getByRole("link", { name: `Short of hands: ${day}, 20:00–22:00.` }).click();
  await page.waitForURL(new RegExp(`day=${W}`));
  const chart = page.getByTestId("staffing-day");
  await chart.waitFor();
  check(
    ((await chart.locator(".viz-title").first().textContent()) ?? "").includes(
      `Orders hour by hour: ${day}`,
    ) &&
      (await chart.locator(`.day-pick a[data-weekday="${W}"]`).getAttribute("aria-current")) ===
        "page",
    `the chart is ${day}'s, chosen above it`,
  );
  check(
    (await chart.locator(".viz-slot.emph").count()) === 2,
    "its two short hours stand out in raspberry",
  );
  await ctx.close();
}

console.log("▸ the page in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, `/reports/staffing?day=${W}`);
  const words = await english(page, `/reports/staffing?day=${W}`);
  check(
    words.length === 0,
    `in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ the cashier is not shown it");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await page.goto(`${BASE}/reports/staffing`);
  await page.waitForLoadState("networkidle");
  check(!/\/reports\/staffing/.test(page.url()), `the cashier is sent elsewhere: ${page.url()}`);
  await ctx.close();
}

await browser.close();
done("staffing");
