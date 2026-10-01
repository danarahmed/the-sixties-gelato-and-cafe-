// The bank against its statement (0059), through the real screens: the owner
// opens it from Chart of Accounts, reads what the books say the bank holds,
// ticks the lines to a statement's last day and keeps it when it ties; a
// statement that does not tie cannot be kept; the latest is undone with why,
// its lines open again. A branch manager reads it and changes nothing; a
// cashier is sent away. The audit trail names each statement. In Arabic and
// Kurdish, and on a phone.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const today = last(`select ${TODAY}`);
const daysAgo = (n) => last(`select ${TODAY} - ${n}`);

// The suite's own bank lines, back-dated so a statement can end before today.
sql(`select test.act_as('owner@example.com');
  select save_journal(${TODAY} - 10, 'The owner puts money in the bank',
    '[{"code":"1020","debit":1000000},{"code":"3000","credit":1000000}]', true);
  select record_expense('The internet', 60000, '6200', 'bank', ${TODAY} - 8, p_idempotency_key => gen_random_uuid());
  select record_expense('Cleaning', 25000, '6900', 'bank', ${TODAY} - 2, p_idempotency_key => gen_random_uuid());`);
const open_ = (to) =>
  last(`select count(*) || '/' || coalesce(trim_scale(sum(amount)), 0) from bank_lines('${B}', '${to}')
         where statement_no is null`);
const [toFive, sumFive] = open_(daysAgo(5)).split("/");
const books = Number(last(`select gl_balance_at('${B}', '1020', now() + interval '1 day')`));
const money = (n) => `${Math.round(n).toLocaleString("en-US")} IQD`;

console.log("▸ the owner keeps a statement");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/accounting");
  await Promise.all([
    page.waitForURL("**/accounting/bank"),
    page.getByRole("link", { name: "The bank against its statement" }).click(),
  ]);
  check(
    (await page.getByTestId("bank-books").textContent()).includes(money(books)),
    `the books' bank, ${money(books)}`,
  );
  check(
    (await page.getByTestId("bank-last").textContent()).includes("None yet"),
    "no statement yet: the first starts from nothing",
  );
  await page.getByTestId("bank-date").fill(daysAgo(5));
  check(
    (await page.getByTestId("bank-line").count()) === Number(toFive),
    `to the statement's last day, ${toFive} line(s) to tick`,
  );
  await page.getByTestId("bank-closing").fill(String(Number(sumFive) - 15000));
  check(
    (await page.getByTestId("bank-difference").textContent()).includes("apart") &&
      (await page.getByTestId("bank-keep").isDisabled()),
    "nothing ticked, or not tying: it says how far apart, and cannot be kept",
  );
  await page.getByRole("button", { name: "Tick every line to this day" }).click();
  check(
    (await page.getByTestId("bank-difference").textContent()).includes("15,000 IQD apart"),
    "ticked, still 15,000 apart from what was typed",
  );
  await page.getByTestId("bank-closing").fill(sumFive);
  check(
    (await page.getByTestId("bank-difference").textContent()).includes("It ties") &&
      !(await page.getByTestId("bank-keep").isDisabled()),
    "the statement's balance typed: it ties, and can be kept",
  );
  await page.getByTestId("bank-keep").click();
  await page.getByText(/Statement 1 is kept/).waitFor({ timeout: 10000 });
  check(
    last(`select statement_date || ' ' || trim_scale(closing_balance) || ' ' || line_count || ' ' || status
            from bank_statement where business_id = '${B}' and statement_no = 1`) ===
      `${daysAgo(5)} ${sumFive} ${toFive} kept`,
    "kept: statement 1, to its last day, at the bank's balance, with its lines",
  );
  await page.locator('[data-testid="bank-statement"][data-no="1"]').waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("bank-last").textContent()).includes("Statement 1"),
    "the last statement kept is statement 1",
  );

  console.log("▸ and undoes it, with why");
  const row = page.locator('[data-testid="bank-statement"][data-no="1"]');
  await row.getByTestId("bank-undo").click();
  await row.getByTestId("bank-undo-reason").fill("The balance was read from the wrong page");
  await row.getByTestId("bank-undo-confirm").click();
  await page.getByText(/Statement 1 is undone/).waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="bank-statement"][data-no="1"]')
        ?.getAttribute("data-status") === "undone",
    null,
    { timeout: 10000 },
  );
  check(open_(daysAgo(5)).split("/")[0] === toFive, "undone: its lines are open again");
  await ctx.close();
}

console.log("▸ a branch manager reads it; a cashier is sent away");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/accounting/bank");
  check(
    (await page.getByTestId("bank-books").count()) === 1 &&
      (await page.getByTestId("bank-closing").count()) === 0 &&
      (await page.getByTestId("bank-undo").count()) === 0,
    "the manager sees the bank and its lines, and keeps or undoes nothing",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/accounting/bank");
  check(
    !new URL(page.url()).pathname.startsWith("/accounting"),
    "the bank is not the cashier's: sent elsewhere",
  );
  await ctx.close();
}

console.log("▸ the audit trail");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/audit?group=books");
  const trail = await page.getByTestId("audit-trail").textContent();
  check(
    (await page.locator('tr[data-action="bank.reconcile"]').count()) === 1 &&
      (await page.locator('tr[data-action="bank.unreconcile"]').count()) === 1 &&
      trail.includes("Bank statement 1") &&
      trail.includes("The balance was read from the wrong page"),
    "the statement kept and undone, by its number, with why",
  );
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of ["/accounting/bank", "/audit?group=books"]) {
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

console.log("▸ on a phone");
{
  const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
  await ctx.addCookies([{ name: "locale", value: "ckb", url: BASE }]);
  await open(page, "/accounting/bank");
  const over = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    let worst = document.documentElement.scrollWidth - width;
    for (const box of document.querySelectorAll(
      '[data-testid="bank-open"] .tw, [data-testid="bank-statements"] .tw',
    ))
      worst = Math.max(worst, box.scrollWidth - box.clientWidth);
    return Math.round(worst);
  });
  check(
    over <= 1,
    `at 390px, in Kurdish, the bank fits the screen${over > 1 ? ` (by ${over}px)` : ""}`,
  );
  await ctx.close();
}

await browser.close();
done("bank");
