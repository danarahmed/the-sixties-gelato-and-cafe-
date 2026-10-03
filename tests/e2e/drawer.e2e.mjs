// The drawer in sessions (0036, release K), on the screens: a session handed
// over at the till; cash sold into whoever's session is open; a manager closing
// one left open, without a count; the drawer opened with a float from the safe;
// and the sessions' record on Sales; and a payment out of the safe or the
// drawer, told what it holds first (AK). The count is blind throughout: the tests
// know what the drawer holds from the database, as the cash in a real drawer
// would tell whoever counts it. It leaves the drawer open, as it found it.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const BIZ = "00000000-0000-0000-0000-0000000000b1";
/** What the drawer holds: the tests' own view, as counting it would find. */
const holds = () =>
  Number(
    sql(`select d.carry + d.moved from location l cross join lateral drawer_position(l.business_id, l.id) d
          where l.business_id = '${BIZ}' and l.kind = 'branch'`),
  );
const openSession = () =>
  sql(`select session_no || ' ' || (select full_name from app_user where id = cashier_id)
         from work_shift where kind = 'session' and closed_at is null and business_id = '${BIZ}'`);
const fmt = (n) => `${n.toLocaleString("en-US")} IQD`;

// The drawer is the cashier's, open (the fixtures', or one a suite before left
// open): one left open by anyone else is closed first, counted, by the owner.
const other = sql(`select w.id from work_shift w join app_user u on u.id = w.cashier_id
                    where w.kind = 'session' and w.closed_at is null and w.business_id = '${BIZ}'
                      and u.email <> 'cashier@example.com'`);
if (other !== "") {
  sql(`select test.act_as('owner@example.com');
       select close_cash_session(${holds()}, null, null, null, '${other}')`);
}
if (openSession() === "") {
  sql(`select test.act_as('cashier@example.com'); select open_cash_session(${holds()})`);
}
const [first] = openSession().split(" ");

// ------------------------------------------------------------- handing over
console.log("▸ the cashier hands the drawer to the manager, counted");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByTestId("drawer-button").click();
  const drawer = page.getByTestId("drawer-panel");
  await drawer.getByRole("button", { name: "Hand over" }).click();
  const count = holds();
  await drawer.getByLabel("Cash counted", { exact: true }).fill(String(count));
  await drawer.getByLabel("Hand the drawer to").selectOption({ label: "Demo Manager" });
  await drawer.getByRole("button", { name: "Hand over" }).click();
  const answer = drawer.getByTestId("drawer-answer");
  await answer.waitFor({ timeout: 10000 });
  const said = await answer.textContent();
  const [no] = openSession().split(" ");
  check(
    /it agrees exactly/.test(said) &&
      new RegExp(`Session ${no} is open for Demo Manager\\.`).test(said),
    `counted true, and session ${no} opens for the manager on what was left`,
  );
  check(openSession() === `${no} Demo Manager`, "the drawer is the manager's now");
  await ctx.close();
}

console.log("▸ the cashier still sells for cash, into the manager's session");
{
  const before = holds();
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  if (await page.getByRole("tab", { name: "Menu", exact: true }).count()) {
    await page.getByRole("tab", { name: "Menu", exact: true }).click();
  }
  await page.getByRole("button", { name: "Takeaway" }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  const [net, session] = sql(
    `select trim_scale(o.net_amount) || ' ' || coalesce(w.session_no::text, 'none')
       from sales_order o left join work_shift w on w.id = o.shift_id
      order by o.created_at desc limit 1`,
  ).split(" ");
  check(holds() === before + Number(net), `the sale's ${fmt(Number(net))} is in the drawer`);
  check(
    `${session} Demo Manager` === openSession(),
    "and the sale names the manager's open session",
  );
  await ctx.close();
}

// ------------------------------------------------------------- a manager's close
console.log("▸ the owner closes the manager's session, left open, without a count");
{
  const expected = holds();
  const [no] = openSession().split(" ");
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/sales");
  const drawer = page.getByTestId("drawer-panel");
  check(
    new RegExp(`It should hold ${fmt(expected).replace(/[,]/g, ",")}`).test(
      await drawer.getByTestId("drawer-expected").textContent(),
    ),
    "the owner is shown what the open drawer should hold",
  );
  await drawer.getByRole("button", { name: "Close it for them" }).click();
  await drawer.getByLabel("Why it is closed").fill("The manager left for the day");
  await drawer.getByRole("button", { name: "Close it without a count" }).click();
  const answer = drawer.getByTestId("drawer-answer");
  await answer.waitFor({ timeout: 10000 });
  check(
    new RegExp(
      `Session ${no} is closed without a count: the ${fmt(expected)} it should hold stays in the drawer`,
    ).test(await answer.textContent()),
    "closed without a count: what it should hold stays for the next opening count",
  );
  await ctx.close();
}
check(
  sql(`select forced_reason || ' / ' || coalesce(counted_cash::text, 'not counted') from work_shift
        where kind = 'session' order by session_no desc limit 1`) ===
    "The manager left for the day / not counted",
  "the session keeps why, and that it was not counted",
);

// ------------------------------------------------------------- opening with a float
console.log("▸ the manager opens the drawer, and puts in a float from the safe");
sql(
  `select test.act_as('owner@example.com'); select move_cash('owner', 'safe', 5000, 'Change for the floats')`,
);
{
  const left = holds();
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales");
  const drawer = page.getByTestId("drawer-panel");
  await drawer.getByTestId("drawer-closed").waitFor({ timeout: 10000 });
  await drawer.getByRole("button", { name: "Open the drawer" }).click();
  await drawer.getByLabel("Cash counted", { exact: true }).fill(String(left));
  await drawer.getByLabel("Cash from the safe").fill("5000");
  await drawer.getByRole("button", { name: "Open the drawer" }).click();
  const answer = drawer.getByTestId("drawer-answer");
  await answer.waitFor({ timeout: 10000 });
  const said = await answer.textContent();
  check(
    /is open\. Counted .*: it agrees exactly\./.test(said) &&
      /5,000 IQD put in from the safe\./.test(said),
    "the count agrees with what was left, and 5,000 comes in from the safe",
  );
  check(holds() === left + 5000, "the drawer holds the count and the float");
  await ctx.close();
}

// ------------------------------------------------------------- the record
console.log("▸ the sessions' record: the list, a statement, and who may read them");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales/sessions");
  const rows = page.getByTestId("sessions-table").locator("tbody tr");
  check((await rows.count()) >= 3, "the week's sessions are listed");
  check(
    (await rows.first().textContent()).includes("open") &&
      (await rows.first().locator("td").nth(5).textContent()) === "—",
    "the open one first, marked open, without what it should hold",
  );
  await page
    .getByTestId("sessions-table")
    .getByRole("link", { name: `Session ${first}`, exact: true })
    .click();
  await page.getByTestId("session-movements").waitFor({ timeout: 10000 });
  check(
    page
      .url()
      .endsWith(
        sql(`select id from work_shift where kind = 'session' and session_no = ${first}`),
      ) && (await page.getByTestId("session-movements").textContent()).includes("Opened with"),
    `session ${first}'s statement: what it opened with, and every movement of its cash`,
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/sales/sessions");
  check(!page.url().includes("/sales/sessions"), "a cashier is not shown the sessions' record");
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
  await open(page, "/sales/sessions");
  const over = await page.evaluate(() => {
    const main = document.querySelector("main");
    return main.scrollWidth - main.clientWidth;
  });
  check(over <= 1, `the sessions' record fits a phone (${over}px over)`);
  await ctx.close();
}

// ------------------------------------------------------------- paying out of them
console.log("▸ paid from the safe or the drawer, a form says what it holds (AK)");
{
  // The database refuses a payment out of the safe or the drawer that is more
  // than it holds: the form says so before it is sent. Nothing is paid here.
  const safe = Number(sql(`select gl_balance_at('${BIZ}', '1005', 'infinity')`));
  const drawer = holds();
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/expenses");
  const note = page.getByTestId("cash-on-hand");
  const from = page.getByLabel("Paid from", { exact: true });
  const amount = page.getByLabel("Amount (IQD)", { exact: true });
  await from.selectOption("safe");
  await amount.fill(String(safe));
  check(
    (await note.textContent()) === `The safe holds ${fmt(safe)} in the books.` &&
      (await note.getAttribute("data-warn")) === "no",
    `Expenses, from the safe: it holds ${fmt(safe)}`,
  );
  await amount.fill(String(safe + 1000));
  check(
    (await note.getAttribute("data-warn")) === "yes" &&
      (await note.textContent()).includes("not enough to pay this"),
    "and more than that is warned of before it is sent",
  );
  await from.selectOption("till");
  await amount.fill(String(drawer));
  check(
    (await note.textContent()) === `The drawer should hold ${fmt(drawer)}.`,
    `from the till: the owner is told what the drawer should hold (${fmt(drawer)})`,
  );
  await amount.fill(String(drawer + 250));
  check((await note.getAttribute("data-warn")) === "yes", "and warned of paying more than that");
  await from.selectOption("bank");
  check((await note.textContent()) === "", "from the bank: nothing to say");

  // An advance on pay, from the safe (the form's first choice).
  await open(page, "/payroll");
  await page.getByTestId("give-advance").click();
  const form = page.getByTestId("advance-form");
  await form.getByLabel("Amount", { exact: true }).fill(String(safe + 1000));
  check(
    (await form.getByTestId("cash-on-hand").getAttribute("data-warn")) === "yes",
    "an advance of more than the safe holds is warned of",
  );
  await ctx.close();
}
{
  // The manager counts blind: the drawer's figure is not shown, the safe's is.
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/expenses");
  const note = page.getByTestId("cash-on-hand");
  await page.getByLabel("Paid from", { exact: true }).selectOption("till");
  await page.getByLabel("Amount (IQD)", { exact: true }).fill("99999999");
  check((await note.textContent()) === "", "the manager is not told what the drawer should hold");
  await page.getByLabel("Paid from", { exact: true }).selectOption("safe");
  check(
    (await note.textContent()).startsWith("⚠️ The safe holds"),
    "but is told what the safe holds",
  );
  await ctx.close();
}

check(openSession() !== "", "and the drawer is left open, as it was found");
await browser.close();
done("drawer");
