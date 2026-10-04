// The end of the day, step by step (UX-K): the owner opens End of Day and each
// step says what the database has open now — the bills, who is clocked in,
// the drawers, the losses waiting, the money still late and the red alerts —
// ticked only once nothing of it is left, and counted in the ring at the top.
// The drawer is closed from the page itself, counted, and its step ticks with
// the count's answer still on the screen. The day in numbers is the books' own.
// A branch manager is offered it, a cashier is not. The start of the day
// (round four) says what the morning needs, and opens the drawer from the page.
// It leaves the drawer open, as it found it.
import { chromium, check, counted, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const BIZ = "00000000-0000-0000-0000-0000000000b1";
const fmt = (n) => `${Math.round(Number(n)).toLocaleString("en-US")} IQD`;
const count = (q) => Number(sql(q));
/** What the first branch's drawer holds: the tests' own view, as counting it would find. */
const holds = () =>
  Number(
    sql(`select d.carry + d.moved from drawer_position('${BIZ}', default_location('${BIZ}')) d`),
  );
const drawersOpen = () =>
  count(
    `select count(*) from work_shift where business_id = '${BIZ}' and kind = 'session' and closed_at is null`,
  );
const billsOpen = () =>
  count(`select count(*) from pos_tab where business_id = '${BIZ}' and status = 'open'`);
const clockedIn = () =>
  count(`select count(distinct a.employee_id) from attendance a join employee e on e.id = a.employee_id
          where e.business_id = '${BIZ}' and a.clock_out is null and a.cancelled_at is null`);
const lossesWaiting = () =>
  count(`select test.act_as('owner@example.com'); select count(*) from losses_waiting()`);
const waitingAlerts = (where) =>
  count(`select test.act_as('owner@example.com');
         select count(*) from current_alerts()
          where acknowledged_at is null and snoozed_until is null and ${where}`);

// The drawer is the cashier's, open at the first branch, as the suites before
// leave it: one left open anywhere else, or by anyone else, is closed first,
// counted, by the owner.
const MAIN = sql(`select default_location('${BIZ}')`);
const strays = sql(`select w.id || ' ' || w.location_id || ' '
                           || (select d.carry + d.moved from drawer_position('${BIZ}', w.location_id) d)
                      from work_shift w join app_user u on u.id = w.cashier_id
                     where w.business_id = '${BIZ}' and w.kind = 'session' and w.closed_at is null
                       and (u.email <> 'cashier@example.com' or w.location_id <> '${MAIN}')`)
  .split("\n")
  .filter(Boolean);
for (const line of strays) {
  const [id, place, held] = line.split(" ");
  sql(`select test.act_as('owner@example.com');
       select close_cash_session(${held}, null, null, null, '${id}', '${place}')`);
}
if (drawersOpen() === 0) {
  sql(`select test.act_as('cashier@example.com'); select open_cash_session(${holds()})`);
}

console.log("▸ the owner's end of the day says what the database has open");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/end-of-day");
  const state = (step) => page.getByTestId(`eod-${step}`).getAttribute("data-state");
  const expect = {
    bills: billsOpen() > 0,
    tills: drawersOpen() > 0,
    losses: lossesWaiting() > 0,
    alerts: waitingAlerts("urgency = 'red'") > 0,
    money: waitingAlerts("rule in ('card_not_banked', 'platform_not_received')") > 0,
  };
  const wrong = [];
  for (const [step, left] of Object.entries(expect)) {
    const s = await state(step);
    if (s !== (left ? "left" : "done"))
      wrong.push(`${step}: ${s}, the database ${left ? "has some open" : "has none"}`);
  }
  check(
    wrong.length === 0,
    `each step stands as the database does: ${Object.entries(expect)
      .map(([k, v]) => `${k} ${v ? "left" : "done"}`)
      .join(", ")}${wrong.length ? ` (not: ${wrong.join("; ")})` : ""}`,
  );
  if (await page.getByTestId("eod-staff").count()) {
    check(
      (await state("staff")) === (clockedIn() > 0 ? "left" : "done"),
      `who is clocked in: ${clockedIn()}, as the step says`,
    );
  }
  const bills = billsOpen();
  if (bills > 0) {
    check(
      (await page.getByTestId("eod-bills").textContent()).includes(
        `${counted(bills, "bill")} still open`,
      ),
      `the bills step counts the ${counted(bills, "bill")} open`,
    );
  }
  const steps = await page.locator(".eod-step").count();
  const ticked = await page.locator('.eod-step[data-state="done"]').count();
  const ring = page.getByTestId("eod-progress");
  check(
    Number(await ring.getAttribute("data-done")) === ticked &&
      Number(await ring.getAttribute("data-total")) === steps &&
      (await ring.textContent()).includes(
        ticked === steps ? "Everything is done" : `${ticked} of ${steps} done`,
      ),
    `the ring counts the steps ticked: ${ticked} of ${steps}`,
  );

  // The day in numbers: the books' own, as the daily brief has them.
  const today = sql(`select business_local_date('${BIZ}', now())`);
  const net = sql(`select test.act_as('owner@example.com');
                   select (daily_brief('${today}')->'facts'->>'net_sales')::numeric`);
  check(
    (await page.getByTestId("eod-net").textContent()) === fmt(net),
    `the day's net sales are the books' ${fmt(net)}`,
  );

  // ---------------------------------------------------------- the drawer, closed here
  const tills = page.getByTestId("eod-tills");
  check(
    (await tills.textContent()).includes("1 drawer still open.") &&
      (await tills.textContent()).includes("Demo Cashier"),
    "the drawer step lists the cashier's session, still open",
  );
  const [no] =
    sql(`select session_no from work_shift where business_id = '${BIZ}' and kind = 'session'
                     and closed_at is null`).split("\n");
  const before = Number(await ring.getAttribute("data-done"));
  const drawer = tills.getByTestId("drawer-panel");
  await drawer.getByRole("button", { name: "Close it for them" }).click();
  await drawer.getByLabel("Why it is closed").fill("Closing up for the night");
  await drawer.getByLabel("Cash counted", { exact: true }).fill(String(holds()));
  await drawer.getByRole("button", { name: "Close the session" }).click();
  const answer = drawer.getByTestId("drawer-answer");
  await answer.waitFor({ timeout: 15000 });
  await page.locator('[data-testid="eod-tills"][data-state="done"]').waitFor({ timeout: 15000 });
  check(
    new RegExp(`Session ${no} is closed\\..*it agrees exactly`).test(await answer.textContent()),
    `closed from the end of the day, counted: session ${no} agrees exactly`,
  );
  check(
    (await tills.textContent()).includes("Every drawer is closed.") &&
      (await tills.textContent()).includes("Counted today:") &&
      (await answer.isVisible()),
    "its step ticks, says what was counted today, and keeps the count's answer on the screen",
  );
  check(
    Number(await ring.getAttribute("data-done")) === before + 1,
    `and the ring counts one more: ${before + 1}`,
  );
  check(
    sql(
      `select forced_reason from work_shift where business_id = '${BIZ}' and session_no = ${no}`,
    ) === "Closing up for the night",
    "the session keeps why it was closed",
  );
  await ctx.close();
}
console.log("▸ the start of the day: what the morning needs, and the drawer opened from it");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/start-of-day");
  const state = (step) => page.getByTestId(`sod-${step}`).getAttribute("data-state");
  const ring = page.getByTestId("sod-progress");
  const steps = await page.locator(".eod-step").count();
  const ticked = await page.locator('.eod-step[data-state="done"]').count();
  check(
    Number(await ring.getAttribute("data-done")) === ticked &&
      Number(await ring.getAttribute("data-total")) === steps &&
      (await ring.textContent()).includes(
        ticked === steps ? "Everything is ready" : `${ticked} of ${steps} done`,
      ),
    `the ring counts the steps ticked: ${ticked} of ${steps}`,
  );
  check(
    (await state("alerts")) === (waitingAlerts("urgency = 'red'") > 0 ? "left" : "done"),
    "the red alerts stand as the database has them",
  );
  // Each delivery listed is an order still to come, expected today or before.
  const today = sql(`select business_local_date('${BIZ}', now())`);
  const listed = [
    ...(await page.getByTestId("sod-deliveries").textContent()).matchAll(/Order (\d+)/g),
  ].map((m) => m[1]);
  const due = listed.length
    ? count(`select count(*) from purchase_order where business_id = '${BIZ}'
              and po_no in (${listed.join(",")}) and status in ('approved', 'sent')
              and expected_on <= '${today}'`)
    : 0;
  check(
    due === listed.length && (await state("deliveries")) === (listed.length ? "left" : "done"),
    `the deliveries due are orders still to come by today: ${listed.length}`,
  );

  // The drawer, closed at the end of the day, opened here, counted.
  check(
    drawersOpen() === 0 && (await state("drawer")) === "left",
    "with the drawer closed, its step is still to do",
  );
  const before = Number(await ring.getAttribute("data-done"));
  const drawer = page.getByTestId("sod-open-drawer").getByTestId("drawer-panel");
  await drawer.getByRole("button", { name: "Open the drawer" }).click();
  await drawer.getByLabel("Cash counted", { exact: true }).fill(String(holds()));
  await drawer.getByRole("button", { name: "Open the drawer" }).last().click();
  const answer = drawer.getByTestId("drawer-answer");
  await answer.waitFor({ timeout: 15000 });
  await page.locator('[data-testid="sod-drawer"][data-state="done"]').waitFor({ timeout: 15000 });
  check(
    drawersOpen() === 1 &&
      (await page.getByTestId("sod-open-drawer").isVisible()) &&
      (await answer.isVisible()) &&
      Number(await ring.getAttribute("data-done")) === before + 1,
    "opened from the start of the day, its step ticks, the ring counts one more, and the count's answer stays",
  );
  await ctx.close();
}
// As it was: the drawer closed again, counted, for the cashier to open.
{
  const [id] = sql(`select id from work_shift where business_id = '${BIZ}' and kind = 'session'
                      and closed_at is null`).split("\n");
  sql(`select test.act_as('owner@example.com');
       select close_cash_session(${holds()}, null, null, null, '${id}', '${MAIN}')`);
}
// As it was found: the cashier's drawer open again, on what was left in it.
sql(`select test.act_as('cashier@example.com'); select open_cash_session(${holds()})`);
check(drawersOpen() === 1, "the drawer is open again for the next suite");

console.log("▸ a branch manager is offered it; a cashier is not");
{
  const { ctx, page } = await signIn(browser, "manager");
  const menu = await page.$$eval("nav.sidenav a", (as) => as.map((a) => a.getAttribute("href")));
  await open(page, "/end-of-day");
  check(
    menu.includes("/end-of-day") &&
      new URL(page.url()).pathname === "/end-of-day" &&
      (await page.locator(".eod-step").count()) > 0,
    "the branch manager has End of Day in the menu, and its steps",
  );
  await open(page, "/start-of-day");
  check(
    menu.includes("/start-of-day") &&
      new URL(page.url()).pathname === "/start-of-day" &&
      (await page.locator(".eod-step").count()) > 0,
    "and Start of Day, with its steps",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/end-of-day");
  check(new URL(page.url()).pathname === "/pos", "a cashier is sent to the till instead");
  await open(page, "/start-of-day");
  check(new URL(page.url()).pathname === "/pos", "from the start of the day too");
  await ctx.close();
}

console.log("▸ the dashboard offers it from the late afternoon, and the start in the morning");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  const hour = Number(
    sql(
      `select extract(hour from now() at time zone (select timezone from business where id = '${BIZ}'))`,
    ),
  );
  const offered = (await page.getByTestId("dash-end-of-day").count()) === 1;
  check(
    offered === (hour >= 16 || hour < 4),
    `at ${hour}:00 the dashboard ${offered ? "offers" : "does not yet offer"} the end of the day`,
  );
  const morning = (await page.getByTestId("dash-start-of-day").count()) === 1;
  check(
    morning === (hour >= 4 && hour < 12),
    `and ${morning ? "offers" : "does not offer"} the start of the day`,
  );
  await ctx.close();
}

await browser.close();
done("close");
