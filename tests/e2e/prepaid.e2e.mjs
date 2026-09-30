// Prepaid expenses (0060, the September audit's P2-14), through the real
// screens: a manager pays a quarter's rent ahead from the bank; the form shows
// each month's share before anything is posted, and this month's share is
// posted at once, an expense of this month. A year's insurance from next month
// posts nothing yet. When its month comes (moved to this month in the scratch
// database), the dashboard says a share is due and one press posts it. The
// manager may not cancel one; the owner cancels the rent, with why, and its
// payment and its share are reversed. 1400 ties to what the prepaid expenses
// still hold throughout, and the screens speak Arabic and Kurdish.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
/** A month from this one, as the screens write it: "2026-09". */
const month = (n) =>
  last(`select to_char(date_trunc('month', ${TODAY}) + interval '${n} month', 'YYYY-MM')`);
/** What 1400 holds, and whether it ties to the prepaid expenses. */
const held = () => Number(last(`select gl_balance_at('${B}', '1400', now())`));
const ties = () =>
  last(`select trim_scale(difference) from reconciliation_checks('${B}', ${TODAY})
         where check_key = 'prepaid'`) === "0";
/** A journal's lines, "code debit/credit" by code. */
const lines = (where) =>
  last(`select string_agg(a.code || ' ' || trim_scale(l.debit) || '/' || trim_scale(l.credit), ', '
                          order by a.code, l.debit)
          from journal_line l join gl_account a on a.id = l.account_id
         where l.journal_entry_id = (${where})`);
const rent = `(select id from prepaid_expense where description = 'Shop rent, a quarter')`;
const insurance = `(select id from prepaid_expense where description = 'Insurance, a year')`;

console.log("▸ a manager pays a quarter's rent ahead, from the bank");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/expenses");
  check(
    (await page.getByTestId("prepaid").count()) === 0,
    "no prepaid expense yet: no list of them",
  );
  await page.getByPlaceholder("September shop rent").fill("Shop rent, a quarter");
  await page.locator("input.amt").first().fill("300001");
  await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
  await page.getByLabel("Account", { exact: true }).selectOption("6000");
  await page.getByTestId("expense-ahead").check();
  const first = page.getByLabel("First month", { exact: true });
  const offered = await first.locator("option").allTextContents();
  check(
    (await first.inputValue()) === month(0) &&
      offered.length === 13 &&
      offered[0] === month(0) &&
      offered[12] === month(12),
    `it starts this month, ${month(0)}, or one of the twelve after`,
  );
  check(
    (await page.getByLabel("Date", { exact: true }).count()) === 0,
    "no date to choose: it is paid now",
  );
  const months = page.getByLabel("How many months", { exact: true });
  const shares = page.getByTestId("prepaid-shares");
  const post = page.getByRole("button", { name: "Post prepaid expense" });
  await months.fill("1");
  check(
    (await shares.textContent()).includes("For this month alone, record an expense") &&
      (await post.isDisabled()),
    "this month alone is refused before it is sent: that is an expense",
  );
  await months.fill("40");
  check(
    (await shares.textContent()).includes("Say how many months it covers, 1 to 36") &&
      (await post.isDisabled()),
    "and more than three years",
  );
  await months.fill("3");
  const voucher = page.locator(".voucher");
  check(
    (await voucher.textContent()).includes("1400Prepaid expenses300,001 IQD") &&
      (await voucher.textContent()).includes("1020Bank300,001 IQD"),
    "as it will be written: 1400 Prepaid expenses debited, the bank credited",
  );
  const said = await shares.textContent();
  check(
    said.includes("6000Rent100,000 IQD") &&
      said.includes(
        `3 months, ${month(0)} to ${month(2)}: 100,000 IQD each, the last 100,001 IQD`,
      ) &&
      said.includes("This month's share is posted now"),
    "then each month: Rent debited 100,000, the last month 100,001, this month's now",
  );
  await page.getByRole("button", { name: "Post prepaid expense" }).click();
  await page
    .getByText(/Paid into Prepaid expenses \(journal \d+\): 3 months/)
    .waitFor({ timeout: 10000 });
  check(
    (await page.getByText("This month's share is posted as an expense.").count()) === 1,
    "posted, and this month's share with it",
  );
  check(
    !(await page.getByTestId("expense-ahead").isChecked()) &&
      (await page.getByLabel("Date", { exact: true }).count()) === 1,
    "the form is an ordinary expense's again, with its date",
  );
  check(
    lines(`select journal_entry_id from prepaid_expense where id = ${rent}`) ===
      "1020 0/300001, 1400 300001/0",
    "the payment: 1400 debited 300,001, the bank credited",
  );
  check(
    last(`select r.month || ' ' || trim_scale(r.amount) || ' ' || e.description
            from prepaid_release r join expense e on e.id = r.expense_id
           where r.prepaid_id = ${rent}`) ===
      `${month(0)}-01 100000 Shop rent, a quarter (${month(0)})` &&
      lines(`select journal_entry_id from prepaid_release where prepaid_id = ${rent}`) ===
        "1400 0/100000, 6000 100000/0",
    "this month's share: an expense of 100,000 on Rent, out of 1400",
  );
  check(held() === 200001 && ties(), "1400 holds the two months to come, 200,001, and ties");

  await page.getByTestId("prepaid").waitFor({ timeout: 10000 });
  const register = page.getByTestId("expense-register");
  check(
    (await register.textContent()).includes(`Shop rent, a quarter (${month(0)})`),
    "this month's share is on the Expense Register",
  );
  const row = page.getByTestId("prepaid-row").filter({ hasText: "Shop rent, a quarter" });
  const text = await row.textContent();
  check(
    text.includes(`${month(0)} — ${month(2)}`) &&
      text.includes("1 of 3") &&
      text.includes("300,001 IQD") &&
      text.includes("200,001 IQD"),
    "listed: its three months, one share posted, 200,001 still ahead",
  );
  check(
    (await page.getByTestId("prepaid").getByRole("button", { name: "Cancel" }).count()) === 0,
    "a branch manager records them but may not cancel one",
  );

  console.log("▸ a year's insurance from next month: nothing posted yet");
  await page.getByPlaceholder("September shop rent").fill("Insurance, a year");
  await page.locator("input.amt").first().fill("120000");
  await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
  await page.getByLabel("Account", { exact: true }).selectOption("6900");
  await page.getByTestId("expense-ahead").check();
  await page.getByLabel("First month", { exact: true }).selectOption(month(1));
  await page.getByLabel("How many months", { exact: true }).fill("12");
  const later = await page.getByTestId("prepaid-shares").textContent();
  check(
    later.includes(`12 months, ${month(1)} to ${month(12)}, 10,000 IQD each`) &&
      later.includes("Each share is posted as its month comes."),
    "twelve equal shares, from next month",
  );
  await page.getByRole("button", { name: "Post prepaid expense" }).click();
  await page
    .getByText(/Paid into Prepaid expenses \(journal \d+\): 12 months/)
    .waitFor({ timeout: 10000 });
  check(
    (await page.getByText("This month's share is posted as an expense.").count()) === 0 &&
      last(`select count(*) from prepaid_release where prepaid_id = ${insurance}`) === "0",
    "nothing of it is posted yet",
  );
  check(held() === 320001 && ties(), "1400 holds 320,001, and ties");
  await page
    .getByTestId("prepaid-row")
    .filter({ hasText: "Insurance, a year" })
    .waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("prepaid-release").count()) === 0 &&
      (await page.getByTestId("prepaid-to-come").textContent()).includes("320,001 IQD"),
    "nothing due, no button to release; 320,001 still ahead",
  );
  await ctx.close();
}

console.log("▸ its month comes: the dashboard says so, and one press posts it");
// The scratch database moves the insurance to start this month, as if a month
// had passed (a prepaid expense is otherwise never changed).
sql(`alter table prepaid_expense disable trigger prepaid_expense_guard;
     update prepaid_expense set first_month = date_trunc('month', ${TODAY})::date
      where id = ${insurance};
     alter table prepaid_expense enable trigger prepaid_expense_guard;`);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  const alert = page.getByTestId("alert").filter({
    hasText: "1 month(s) of prepaid expenses are due to be released, 10,000 IQD in all",
  });
  check(
    (await alert.count()) === 1 && (await alert.getAttribute("data-urgency")) === "orange",
    "the dashboard: one month of prepaid expenses due, 10,000, in orange",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/expenses#prepaid");
  const release = page.getByTestId("prepaid-release");
  check(
    (await release.textContent()).includes("Release what is due (1)"),
    "one share due, and the button to release it",
  );
  await release.click();
  await page
    .getByText("1 month(s)' share posted as an expense of its month.")
    .waitFor({ timeout: 10000 });
  check(
    last(`select r.month || ' ' || trim_scale(r.amount) from prepaid_release r
           where r.prepaid_id = ${insurance}`) === `${month(0)}-01 10000` &&
      lines(`select journal_entry_id from prepaid_release where prepaid_id = ${insurance}`) ===
        "1400 0/10000, 6900 10000/0",
    "posted: this month's 10,000 of the insurance, an expense on 6900",
  );
  check(held() === 310001 && ties(), "1400 holds 310,001, and ties");
  await page.getByTestId("prepaid-release").waitFor({ state: "detached", timeout: 10000 });
  check(
    (
      await page.getByTestId("prepaid-row").filter({ hasText: "Insurance, a year" }).textContent()
    ).includes("1 of 12"),
    "nothing more due: the insurance has one share of twelve posted",
  );
  await ctx.close();
}

console.log("▸ the owner cancels the rent, entered in error");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/expenses");
  const row = page.getByTestId("prepaid-row").filter({ hasText: "Shop rent, a quarter" });
  await row.getByRole("button", { name: "Cancel" }).click();
  const why = row.getByLabel("Why cancel Shop rent, a quarter?");
  check(await row.getByRole("button", { name: "Confirm" }).isDisabled(), "not without saying why");
  await why.fill("Paid twice by mistake");
  await row.getByRole("button", { name: "Confirm" }).click();
  await row.getByText("cancelled").waitFor({ timeout: 10000 });
  const text = await row.textContent();
  check(
    text.includes("Paid twice by mistake") && text.includes("0 IQD"),
    "listed as cancelled, with why, nothing of it still ahead",
  );
  check(
    lines(`select cancel_journal_entry_id from prepaid_expense where id = ${rent}`) ===
      "1020 300001/0, 1400 0/300001",
    "its payment reversed: the bank back, 1400 out",
  );
  check(
    lines(`select x.id from journal_entry x join prepaid_release r
             on x.reverses_entry = r.journal_entry_id where r.prepaid_id = ${rent}`) ===
      "1400 100000/0, 6000 0/100000",
    "and this month's share of it: no longer an expense",
  );
  check(held() === 110000 && ties(), "1400 holds the insurance's eleven months, 110,000, and ties");
  check(
    last(`select count(*) from audit_log where action = 'prepaid.cancel'
             and reason = 'Paid twice by mistake'`) === "1",
    "on the audit trail, with why",
  );
  const share = page
    .getByTestId("expense-register")
    .locator("tr", { hasText: `Shop rent, a quarter (${month(0)})` });
  check(
    /reversed by #\d+/.test(await share.textContent()),
    "the Expense Register marks its share reversed",
  );
  await ctx.close();
}

console.log("▸ a month to come, alone: December's rent paid now");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/expenses");
  await page.getByPlaceholder("September shop rent").fill("Shop rent, one month ahead");
  await page.locator("input.amt").first().fill("150000");
  await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
  await page.getByLabel("Account", { exact: true }).selectOption("6000");
  await page.getByTestId("expense-ahead").check();
  await page.getByLabel("First month", { exact: true }).selectOption(month(3));
  await page.getByLabel("How many months", { exact: true }).fill("1");
  check(
    (await page.getByTestId("prepaid-shares").textContent()).includes(
      `One month, ${month(3)}: 150,000 IQD`,
    ),
    `all of it ${month(3)}'s`,
  );
  await page.getByRole("button", { name: "Post prepaid expense" }).click();
  await page
    .getByText(
      new RegExp(`Paid into Prepaid expenses \\(journal \\d+\\): one month, ${month(3)}\\.`),
    )
    .waitFor({ timeout: 10000 });
  check(
    last(`select count(*) from prepaid_release r join prepaid_expense p on p.id = r.prepaid_id
           where p.description = 'Shop rent, one month ahead'`) === "0" &&
      held() === 260000 &&
      ties(),
    "nothing of it posted before its month; 1400 holds it too, 260,000, and ties",
  );
  const row = page.getByTestId("prepaid-row").filter({ hasText: "Shop rent, one month ahead" });
  await row.waitFor({ timeout: 10000 });
  check((await row.textContent()).includes("0 of 1"), "listed: its one month, none posted yet");
  await ctx.close();
}

console.log("▸ 1400 is offered nowhere else: a bill for a service, a journal by hand");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/vendors");
  await page.getByRole("button", { name: "Bills & payments" }).click();
  await page.getByText("For a service or asset").click();
  const charge = page.locator("label", { hasText: "Charge to account" }).locator("select");
  const offered = await charge.locator("option").allTextContents();
  check(
    offered.length > 0 &&
      !offered.some((o) => o.startsWith("1400")) &&
      !(await charge.inputValue()).startsWith("14"),
    `a bill for a service or asset does not offer 1400 (it starts at ${await charge.inputValue()})`,
  );
  await open(page, "/journals");
  await page.getByRole("button", { name: "New Journal" }).click();
  const codes = await page
    .getByTestId("journal-line")
    .first()
    .locator("select option")
    .allTextContents();
  check(
    codes.some((o) => o.startsWith("6000")) && !codes.some((o) => o.startsWith("1400")),
    "nor does a journal by hand",
  );
  await ctx.close();
}

console.log("▸ a payment like one posted already is asked about before it is posted");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/expenses");
  const fill = async (what, amount, account) => {
    await page.getByPlaceholder("September shop rent").fill(what);
    await page.locator("input.amt").first().fill(amount);
    await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
    await page.getByLabel("Account", { exact: true }).selectOption(account);
  };
  const note = page.getByTestId("same-payment");
  const post = page.getByRole("button", { name: "Post expense" });
  await fill("Electricity, September", "45000", "6200");
  check(
    (await note.textContent()) === "" && !(await post.isDisabled()),
    "the first: nothing to ask",
  );
  await post.click();
  await page.getByText(/Posted to 6200/).waitFor({ timeout: 10000 });
  await fill("Electricity again", "45000", "6200");
  await note.getByText("Electricity, September").waitFor({ timeout: 10000 });
  check(
    (await note.textContent()).includes("A payment like this one is posted already") &&
      (await post.isDisabled()),
    "the same account and amount the same day: asked about, and not posted until answered",
  );
  await page.locator("input.amt").first().fill("45250");
  check(
    (await note.textContent()) === "" && !(await post.isDisabled()),
    "another amount: nothing to ask",
  );
  await page.locator("input.amt").first().fill("45000");
  await page.getByTestId("same-payment-ok").check();
  check(!(await post.isDisabled()), "said to be another payment: it may be posted");
  await post.click();
  await page.getByText(/Posted to 6200/).waitFor({ timeout: 10000 });
  check(
    last(
      `select count(*) from expense
        where description in ('Electricity, September', 'Electricity again')`,
    ) === "2",
    "both posted, the second once it was said to be another",
  );

  // One posted from another device while this form was open: the server asks.
  await fill("Cleaning, the manager's", "30000", "6900");
  const owner = await signIn(browser, "owner");
  await open(owner.page, "/expenses");
  await owner.page.getByPlaceholder("September shop rent").fill("Cleaning, the owner's");
  await owner.page.locator("input.amt").first().fill("30000");
  await owner.page.getByLabel("Paid from", { exact: true }).selectOption("bank");
  await owner.page.getByLabel("Account", { exact: true }).selectOption("6900");
  await owner.page.getByRole("button", { name: "Post expense" }).click();
  await owner.page.getByText(/Posted to 6900/).waitFor({ timeout: 10000 });
  await owner.ctx.close();
  await post.click();
  await note.getByText("Cleaning, the owner's").waitFor({ timeout: 10000 });
  check(
    (await page
      .getByText(
        "A payment like this one is posted already: tick that it is another payment to post it",
      )
      .count()) === 1 &&
      (await post.isDisabled()) &&
      last(`select count(*) from expense
                where description in ('Cleaning, the manager''s', 'Cleaning, the owner''s')`) ===
        "1",
    "posted meanwhile on another device: the server asks, and nothing is posted",
  );
  await page.getByTestId("same-payment-ok").check();
  await post.click();
  await page.getByText(/Posted to 6900/).waitFor({ timeout: 10000 });
  check(
    last(`select count(*) from expense
                where description in ('Cleaning, the manager''s', 'Cleaning, the owner''s')`) ===
      "2",
    "said to be another: posted",
  );

  // Paid ahead too: the insurance paid today is asked about.
  await page.getByPlaceholder("September shop rent").fill("Insurance, again");
  await page.locator("input.amt").first().fill("120000");
  await page.getByLabel("Account", { exact: true }).selectOption("6900");
  await page.getByTestId("expense-ahead").check();
  await page.getByLabel("First month", { exact: true }).selectOption(month(1));
  await note.getByText("Insurance, a year").waitFor({ timeout: 10000 });
  check(
    await page.getByRole("button", { name: "Post prepaid expense" }).isDisabled(),
    "a prepaid expense like the insurance paid today: asked about too",
  );
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const [locale, title] of [
  ["ar", "المصروفات المدفوعة مقدمًا"],
  ["ckb", "خەرجییە پێشەکییەکان"],
]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/expenses");
  await page.getByTestId("expense-ahead").check();
  check(
    (await page.getByTestId("prepaid").textContent()).includes(title),
    `in ${locale}: ${title}`,
  );
  const left = await english(page, "/expenses");
  check(
    left.length === 0 && (await page.evaluate(() => document.documentElement.dir)) === "rtl",
    `in ${locale}, right to left, the form paid ahead too, no English but the café's own words` +
      (left.length ? `: ${left.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("prepaid expenses");
