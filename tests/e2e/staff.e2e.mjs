// Staff, their hours and their pay (0049, release W), through the real screens:
// a manager adds someone who works here, sets their clock-in PIN and the week's
// schedule, and sees no pay; the owner sets the pay; at the till the cashier's
// screen clocks them in and out with their name and PIN, a wrong PIN refused;
// the manager corrects the hours and adds hours nobody clocked last month; the
// owner gives an advance, drafts last month's payroll, adds a bonus, approves
// it, and pays everyone from the bank. Each journal is checked, and the books
// still tie. Reports shows the hours and what staff cost; the audit trail names
// every change; the screens speak Arabic and Kurdish.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const TZ = "Asia/Baghdad";
const last = (q) => sql(q).split("\n").pop();
/** A journal as one line: "1300 Cr 50000 | 6100 Dr 650500", accounts in code order. */
const journal = (where) =>
  last(`select string_agg(a.code || case when l.debit > 0 then ' Dr ' || trim_scale(l.debit)
                                         else ' Cr ' || trim_scale(l.credit) end, ' | ' order by a.code)
          from journal_entry e join journal_line l on l.journal_entry_id = e.id
          join gl_account a on a.id = l.account_id
         where ${where}`);

// The branch the till clocks at, and last month: the month a payroll can be approved for.
const HERE_ID = last(`select default_location('${B}')`);
const HERE = last(`select name from location where id = '${HERE_ID}'`);
const MONTH = last(
  `select to_char(date_trunc('month', ${TODAY}) - interval '1 month', 'YYYY-MM-DD')`,
);
const DAY10 = MONTH.slice(0, 8) + "10";
const DAY11 = MONTH.slice(0, 8) + "11";

/** How far each subledger is from its control account: staff and pay must leave them as they were. */
const differences = () =>
  sql(`select test.act_as('owner@example.com');
       select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
         from report_reconciliation(${TODAY})`)
    .split("\n")
    .pop();
const before = differences();
check(
  before.includes("advances=0") && before.includes("payroll=0"),
  "the books have the two new checks, salaries owed and advances, both at zero",
);

console.log("▸ a manager adds someone who works here, sets their PIN, and sees no pay");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/staff");
  await page.getByTestId("add-person").click();
  const form = page.getByTestId("person-form");
  const first = form.getByTestId("add-person-row").first();
  await first.getByLabel("Name").fill("Rana Staff");
  await first.getByLabel("What they do").fill("Barista");
  await first.getByLabel("Where they work").selectOption({ label: HERE });
  await first.getByLabel("Started on").fill(MONTH);
  await form.getByTestId("add-people-save").click();
  const row = page.locator('[data-testid="person-row"][data-name="Rana Staff"]');
  await row.waitFor({ timeout: 10000 });
  check((await row.textContent()).includes("No PIN yet"), "added, with no PIN yet");
  await row.getByRole("button").click();
  const panel = page.getByTestId("person-panel");
  await panel.waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("staff-people").textContent()).includes("Barista") &&
      (await page.getByTestId("person-pay").count()) === 0 &&
      (await panel.getByTestId("set-pay").count()) === 0 &&
      (await panel.getByTestId("person-form").count()) === 1,
    "a branch manager sees no pay, and cannot set it; their panel opens on their details",
  );

  await panel.getByTestId("set-pin").click();
  const pin = page.getByTestId("pin-form");
  await pin.getByLabel("PIN", { exact: true }).fill("5820");
  await pin.getByLabel("The same PIN again").fill("5820");
  await pin.getByRole("button", { name: "Save the PIN" }).click();
  await page.getByText("Rana Staff clocks in with this PIN now.").waitFor({ timeout: 10000 });
  check(true, "the PIN is set, typed twice");
  await ctx.close();
}

const RANA = last(`select id from employee where full_name = 'Rana Staff'`);
check(
  last(`select hired_on || ' ' || (clock_pin_hash is not null) || ' ' || (clock_pin_hash <> '5820')
          from employee where id = '${RANA}'`) === `${MONTH} true true`,
  "kept with the day they started, and the PIN only as a hash",
);

// Omar, paid by the hour, with six hours on the 11th of last month.
sql(`select test.act_as('manager@example.com');
     select save_employee(null, 'Omar Staff', null, 'Kitchen', '${HERE_ID}', '${MONTH}');
     select add_attendance((select id from employee where full_name = 'Omar Staff'),
                           ('${DAY11} 09:00'::timestamp at time zone '${TZ}'),
                           ('${DAY11} 15:00'::timestamp at time zone '${TZ}'), 'Paper timesheet');
     select test.act_as('owner@example.com');
     select set_employee_pay((select id from employee where full_name = 'Omar Staff'), 'hourly', 3000);`);

console.log("▸ the owner sets the pay");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/staff");
  const row = page.locator('[data-testid="person-row"][data-name="Rana Staff"]');
  check(
    (await row.getByTestId("person-pay").textContent()).includes("Pay not set"),
    "the owner sees the pay: not set yet",
  );
  await row.getByRole("button").click();
  await page.getByTestId("person-panel").getByTestId("set-pay").click();
  const form = page.getByTestId("pay-form");
  await form.getByLabel("How they are paid").selectOption("monthly");
  await form.getByLabel("Pay a month").fill("600,000");
  await form.getByLabel("A day's hours").fill("8");
  await form.getByLabel("Why it changes (optional)").fill("Starting pay");
  await form.getByRole("button", { name: "Save the pay" }).click();
  await row
    .getByTestId("person-pay")
    .getByText(/600,000/)
    .waitFor({ timeout: 10000 });
  check(true, "600,000 a month, eight hours a day");
  await ctx.close();
}
check(
  last(
    `select pay_basis || ' ' || trim_scale(rate) || ' ' || trim_scale(standard_hours) from employee where id = '${RANA}'`,
  ) === "monthly 600000 8",
  "kept as the database takes it",
);

console.log("▸ a manager plans the week");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, `/staff?place=${HERE_ID}#schedule`);
  const today = last(`select ${TODAY}`);
  const cell = page.locator(
    `[data-testid="schedule-row"][data-name="Rana Staff"] [data-testid="schedule-cell"][data-day="${today}"]`,
  );
  await cell.fill("08:00-16:00");
  await page.getByTestId("save-schedule").click();
  await page.getByText("The week's hours are saved.").waitFor({ timeout: 10000 });
  check(true, "saved");
  await ctx.close();
}
check(
  last(`select to_char(starts_at at time zone '${TZ}', 'HH24:MI') || '-' || to_char(ends_at at time zone '${TZ}', 'HH24:MI')
          from shift_schedule where employee_id = '${RANA}' and day = ${TODAY}`) === "08:00-16:00",
  "Rana works 08:00 to 16:00 today, on the café's clock",
);

console.log("▸ at the till, Rana clocks in and out with her name and PIN");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByTestId("clock-button").click();
  const dialog = page.getByTestId("clock-dialog");
  const rana = dialog.locator('[data-testid="clock-person"][data-name="Rana Staff"]');
  await rana.waitFor({ timeout: 10000 });
  check((await rana.textContent()).includes("Shift 08:00–16:00"), "the till shows her shift today");
  await rana.click();
  await dialog.getByTestId("clock-pin").fill("1111");
  await dialog.getByTestId("clock-confirm").click();
  await dialog
    .getByTestId("clock-error")
    .getByText("That PIN is not right")
    .waitFor({ timeout: 10000 });
  check(true, "a wrong PIN is refused, and counted");
  await dialog.getByTestId("clock-pin").fill("5820");
  await dialog.getByTestId("clock-confirm").click();
  await dialog
    .getByTestId("clock-done")
    .getByText(/Rana Staff is clocked in, at \d\d:\d\d\./)
    .waitFor({ timeout: 10000 });
  check(true, "with the right one, she is clocked in");
  const again = dialog.locator(
    '[data-testid="clock-person"][data-name="Rana Staff"][data-in="yes"]',
  );
  await again.waitFor({ timeout: 10000 });
  check((await again.textContent()).includes("In since"), "the till shows her in, since when");
  await again.click();
  await dialog.getByTestId("clock-pin").fill("5820");
  await dialog.getByTestId("clock-confirm").click();
  await dialog
    .getByTestId("clock-done")
    .getByText(/Rana Staff is clocked out, at \d\d:\d\d/)
    .waitFor({ timeout: 10000 });
  check(true, "and clocked out");
  await ctx.close();
}
check(
  last(
    `select count(*) filter (where not ok) || ' ' || count(*) filter (where ok) from clock_attempt where employee_id = '${RANA}'`,
  ) === "1 2",
  "each PIN typed is kept: one wrong, two right",
);
check(
  last(`select a.source || ' ' || (a.clock_out is not null) || ' ' || u.full_name
          from attendance a join app_user u on u.id = a.recorded_by
         where a.employee_id = '${RANA}' and a.work_day = ${TODAY}`) === "till true Demo Cashier",
  "one record of today's hours, clocked at the till by the cashier's screen",
);

console.log("▸ a manager corrects today's hours, and adds hours nobody clocked last month");
let todayRecord = "";
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/staff#attendance");
  const rec = page.locator('[data-testid="attendance-record"][data-name="Rana Staff"]').first();
  await rec.getByTestId("correct-hours").click();
  const form = page.getByTestId("correct-form");
  // The record by its id: in the two hours after midnight, starting two hours
  // earlier makes it the day before's.
  todayRecord = last(
    `select id from attendance where employee_id = '${RANA}' and work_day = ${TODAY} and cancelled_at is null`,
  );
  const earlier =
    last(`select to_char((clock_in at time zone '${TZ}') - interval '2 hours', 'YYYY-MM-DD"T"HH24:MI')
                          from attendance where id = '${todayRecord}'`);
  await form.getByLabel("In", { exact: true }).fill(earlier);
  await form.getByLabel("Why").fill("Forgot to clock in at opening");
  await form.getByRole("button", { name: "Save the correction" }).click();
  await page
    .getByText(/Corrected by Demo Manager: Forgot to clock in at opening/)
    .waitFor({ timeout: 10000 });
  check(true, "corrected, with who and why");

  await page.getByTestId("add-hours").click();
  const add = page.getByTestId("add-hours-form");
  await add.getByLabel("Who").selectOption({ label: "Rana Staff" });
  await add.getByLabel("In", { exact: true }).fill(`${DAY10}T08:00`);
  await add.getByLabel("Out (empty: still in)").fill(`${DAY10}T18:00`);
  await add.getByLabel("Why").fill("The till was down");
  await add.getByRole("button", { name: "Add the hours" }).click();
  await add.waitFor({ state: "detached", timeout: 10000 });
  check(true, "ten hours on the 10th of last month, added with why");
  await ctx.close();
}
check(
  last(`select source || ' ' || floor(extract(epoch from clock_out - clock_in) / 60) || ' ' || edit_reason
          from attendance where employee_id = '${RANA}' and work_day = '${DAY10}'`) ===
    "manager 600 The till was down",
  "kept as added by a manager, 600 minutes",
);
check(
  Number(
    last(`select floor(extract(epoch from clock_out - clock_in) / 60) from attendance
           where id = '${todayRecord}' and cancelled_at is null`),
  ) >= 119,
  "today's record starts two hours earlier",
);

console.log("▸ the owner gives an advance, and drafts last month's payroll");
let RUN = "";
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/payroll");
  await page.getByTestId("give-advance").click();
  const adv = page.getByTestId("advance-form");
  await adv.getByLabel("To").selectOption({ label: "Rana Staff" });
  await adv.getByLabel("Amount").fill("50000");
  await adv.getByLabel("Paid from").selectOption("bank");
  await adv.getByLabel("What it is for").fill("Rent help");
  await adv.getByRole("button", { name: "Give the advance" }).click();
  await page
    .locator('[data-testid="advance-row"][data-name="Rana Staff"]')
    .waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("advances-owed").textContent()).includes("Rana Staff owes"),
    "given, and owed until a payroll takes it back",
  );

  await page
    .getByTestId("draft-payroll")
    .getByRole("button", { name: "Draft the payroll" })
    .click();
  await page.waitForURL(/\/payroll\/[0-9a-f-]{36}$/, { timeout: 15000 });
  RUN = page.url().split("/").pop();
  const run = page.getByTestId("payroll-run");
  await run.waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("run-status").textContent()).includes("Draft"),
    "a draft of last month",
  );
  const net = async (name) =>
    (
      await page
        .locator(`[data-testid="payroll-line"][data-name="${name}"] [data-testid="line-net"]`)
        .textContent()
    ).replace(/\D/g, "");
  check(
    (await net("Rana Staff")) === "557500" && (await net("Omar Staff")) === "18000",
    "Rana: 600,000 and two hours' overtime at 150% (7,500), less the advance 50,000; Omar: six hours at 3,000",
  );

  const line = page.locator('[data-testid="payroll-line"][data-name="Rana Staff"]');
  await line.getByTestId("adjust-line").click();
  const adj = page.getByTestId("adjust-form");
  await adj.getByLabel("Added").fill("25000");
  await adj.getByLabel("What it is for").first().fill("Eid bonus");
  await adj.getByRole("button", { name: "Save" }).click();
  await line.getByText("Eid bonus").waitFor({ timeout: 10000 });
  check((await net("Rana Staff")) === "582500", "a bonus added, with why");

  // The message comes with the answer; the payroll's status, with the page
  // refreshed after it.
  const shows = (status) =>
    page
      .locator(`[data-testid="payroll-run"][data-status="${status}"]`)
      .waitFor({ timeout: 10000 })
      .then(
        () => true,
        () => false,
      );
  await page.getByTestId("approve-payroll").click();
  await page
    .getByTestId("run-actions")
    .getByText("Approved, and posted.")
    .waitFor({ timeout: 10000 });
  check(
    (await shows("approved")) &&
      (await page.getByTestId("run-status").textContent()).includes("Approved"),
    "approved",
  );

  await page.getByTestId("pay-everyone").click();
  await page
    .getByTestId("run-actions")
    .getByText(/Paid\./)
    .waitFor({ timeout: 10000 });
  check(
    (await shows("paid")) && (await page.getByTestId("run-status").textContent()).includes("Paid"),
    "paid, from the bank",
  );
  check(
    (await page.getByTestId("salary-payments").textContent()).includes("Rana Staff, Omar Staff") ||
      (await page.getByTestId("salary-payments").textContent()).includes("Omar Staff, Rana Staff"),
    "one payment to both, listed with the payroll",
  );
  await ctx.close();
}
check(
  journal(`e.reference_type = 'employee_advance'
           and e.reference_id = (select id from employee_advance where employee_id = '${RANA}')`) ===
    "1020 Cr 50000 | 1300 Dr 50000",
  "the advance: Dr 1300 Employee advances, Cr 1020 the bank",
);
check(
  journal(`e.reference_type = 'payroll_approval'
           and e.reference_id = (select id from payroll_approval where run_id = '${RUN}' and reopened_at is null)`) ===
    "1300 Cr 50000 | 2100 Cr 600500 | 6100 Dr 650500",
  "the approval: Dr 6100 Salaries 650,500, Cr 2100 Salaries payable 600,500, Cr 1300 the advance taken back",
);
check(
  last(`select to_char(e.occurred_at at time zone '${TZ}', 'YYYY-MM-DD HH24:MI') from journal_entry e
         where e.reference_type = 'payroll_approval'
           and e.reference_id = (select id from payroll_approval where run_id = '${RUN}')`) ===
    last(`select to_char(date_trunc('month', ${TODAY}) - interval '1 day', 'YYYY-MM-DD')`) +
      " 12:00",
  "dated on the month's last day, in the month it pays for",
);
check(
  journal(`e.reference_type = 'salary_payment'
           and e.reference_id = (select p.id from salary_payment p where p.run_id = '${RUN}')`) ===
    "1020 Cr 600500 | 2100 Dr 600500",
  "the payment: Dr 2100, Cr 1020 the bank",
);
check(
  last(`select status from payroll_run where id = '${RUN}'`) === "paid" &&
    last(
      `select trim_scale(coalesce(sum(amount), 0)) from employee_advance where employee_id = '${RANA}' and cancelled_at is null`,
    ) === "50000" &&
    last(`select trim_scale(advance_owed('${B}', '${RANA}'))`) === "0",
  "the payroll is paid, and the advance taken back in full",
);

console.log("▸ Reports: the hours, and what staff cost against sales");
{
  const { ctx, page } = await signIn(browser, "owner");
  const today = last(`select ${TODAY}`);
  await open(page, `/reports?from=${MONTH}&to=${today}`);
  const report = page.getByTestId("staff-report");
  const rana = await report
    .locator('[data-testid="staff-hours-row"][data-name="Rana Staff"]')
    .textContent();
  const omar = await report
    .locator('[data-testid="staff-hours-row"][data-name="Omar Staff"]')
    .textContent();
  check(rana.includes("Barista") && omar.includes("6 h"), "each person's hours, with what they do");
  check(
    (await report.getByTestId("staff-labour").textContent()).includes("650,500"),
    "what staff cost last month: the payroll approved for it, 650,500",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/reports");
  check(
    (await page.getByTestId("staff-report").count()) === 1 &&
      (await page.getByTestId("staff-labour").count()) === 0,
    "a branch manager sees the hours, not what staff cost",
  );
  await ctx.close();
}

console.log("▸ the audit trail names every change");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/audit?group=staff");
  const text = await page.textContent("main");
  const said = [
    "Person who works here saved",
    "Clock-in PIN set",
    "Pay set",
    "Schedule saved",
    "Hours corrected",
    "Hours added",
    "Advance given",
    "Payroll drafted",
    "Payroll adjusted",
    "Payroll approved",
    "Salaries paid",
  ].filter((w) => !text.includes(w));
  check(
    said.length === 0,
    `each staff and payroll change, in words${said.length ? ` (missing: ${said.join(", ")})` : ""}`,
  );
  check(text.includes("Payroll 1") || /Payroll \d+/.test(text), "a payroll named by its number");
  await ctx.close();
}

console.log("▸ the screens in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of ["/staff", "/payroll", `/payroll/${RUN}`, "/audit?group=staff"]) {
    await open(page, path);
    const words = await english(page, path);
    if (words.length) left.push(`${path}: ${words.slice(0, 12).join(" ")}`);
  }
  check(
    left.length === 0,
    `in ${locale}, no English but the café's own names` +
      (left.length ? `\n      ${left.join("\n      ")}` : ""),
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await ctx.addCookies([{ name: "locale", value: "ckb", url: BASE }]);
  await open(page, "/pos");
  await page.getByTestId("clock-button").click();
  const dialog = page.getByTestId("clock-dialog");
  await dialog.locator('[data-testid="clock-person"]').first().waitFor({ timeout: 10000 });
  const text = await dialog.textContent();
  check(
    text.includes("تۆمارکردنی هاتن یان ڕۆیشتن") && text.includes("Rana Staff"),
    "the till's clock in Kurdish, the names as they were typed",
  );
  await ctx.close();
}

console.log("▸ the books still tie");
check(differences() === before, `every subledger is where it was (${differences()})`);

console.log("▸ a manager adds three people at once, their PINs with them (round eight)");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/staff");
  await page.getByTestId("add-person").click();
  const form = page.getByTestId("person-form");
  const rows = form.getByTestId("add-person-row");
  check((await rows.count()) === 3, "three empty rows to start with");
  await rows.nth(0).getByLabel("Name").fill("Bulk One");
  await rows.nth(0).getByLabel("PIN (optional)").fill("5821");
  await rows.nth(1).getByLabel("Name").fill("Bulk Two");
  await rows.nth(1).getByLabel("What they do").fill("Kitchen");
  await rows.nth(1).getByLabel("PIN (optional)").fill("1111");
  await rows.nth(2).getByLabel("What they do").fill("Cleaner");
  const save = form.getByTestId("add-people-save");
  check(
    ((await rows.nth(1).textContent()) ?? "").includes("Choose a PIN that is harder to guess") &&
      ((await rows.nth(2).textContent()) ?? "").includes("Give their name") &&
      (await save.isDisabled()),
    "a PIN too easy to guess and a row with no name are said, and nothing is added yet",
  );
  await rows.nth(1).getByLabel("PIN (optional)").fill("5822");
  await rows.nth(2).getByLabel("Name").fill("Bulk Three");
  await form.getByTestId("add-person-another").click();
  check((await rows.count()) === 4, "another row when needed");
  check(
    ((await save.textContent()) ?? "").trim() === "Add 3 to the staff",
    "the empty row is left out: Add 3 to the staff",
  );
  await save.click();
  await page.getByText("3 added to the staff.").waitFor({ timeout: 20000 });
  check(
    (await page.getByTestId("person-form").count()) === 0,
    "the form closes once all are added",
  );
  const pins = sql(
    `select string_agg(full_name || '=' || (clock_pin_hash is not null)::text, ',' order by full_name)
       from employee where full_name like 'Bulk %'`,
  );
  check(
    pins === "Bulk One=true,Bulk Three=false,Bulk Two=true",
    `three people added, two with their PINs set (${pins})`,
  );
  check(
    sql("select title from employee where full_name = 'Bulk Two'") === "Kitchen",
    "with what they do",
  );
  await ctx.close();
}

await browser.close();
done("staff");
