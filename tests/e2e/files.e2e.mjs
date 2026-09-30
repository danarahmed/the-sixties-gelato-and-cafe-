// Statements read from their files (the step after the bank's statement,
// 0059), through the real screens. On Delivery Platforms, the owner chooses
// Talabat's report, an Excel workbook with a title above its columns, a total
// and a note: its two orders are read and matched, and the payout posted. On
// the bank's page, the owner chooses the bank's statement, a CSV in Arabic
// with the newest line first: the lines the books have are found and ticked,
// the platform's payout among them; the last day and the balance are filled
// in; a cheque not cashed yet stays open; the bank's charge and its interest
// are shown as not in the books. Record it opens Expenses with the charge
// filled in, and a journal with the interest; back on the page each is found
// too, and the statement is kept. A PDF is refused, with what to choose
// instead. In Arabic and Kurdish, and on a phone.
import { readFileSync } from "node:fs";
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const ESPRESSO = "d1000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-0000000000b1";
const daysAgo = (n) => last(`select ${TODAY} - ${n}`);
const dmy = (iso) => iso.split("-").reverse().join("/");
const num = (s) => Number(String(s).replace(/[^\d.-]/g, ""));
const workbook = readFileSync(
  new URL("../statement-files/talabat-statement.xlsx", import.meta.url),
);

// Two Talabat orders, of one espresso and of two, by the numbers the report gives.
for (const [qty, no] of [
  [1, "FILE-7001"],
  [2, "FILE-7002"],
])
  sql(`select test.act_as('cashier@example.com');
       select record_sale(gen_random_uuid(), 'talabat', 'platform_paid',
                          '[{"variant_id":"${ESPRESSO}","qty":${qty}}]', p_platform_order_no => '${no}')`);
// The bank in the books: cash taken to it, paper paid from it, and a cheque
// written that the bank has not paid yet.
sql(`select test.act_as('owner@example.com');
  select save_journal(${TODAY} - 3, 'Cash taken to the bank',
    '[{"code":"1020","debit":1234500},{"code":"3000","credit":1234500}]', true);
  select record_expense('Printer paper', 98765, '6900', 'bank', ${TODAY} - 1, p_idempotency_key => gen_random_uuid());
  select record_expense('A cheque not cashed yet', 45000, '6900', 'bank', ${TODAY} - 2, p_idempotency_key => gen_random_uuid());
  select create_account('4900', 'Bank interest', 'revenue');`);

// The bank's statement as its website gives it: in Arabic, the newest line
// first, the account above the columns, and a balance brought forward.
const statement = Buffer.from(
  "\u{FEFF}" +
    [
      "كشف حساب,,,,",
      "رقم الحساب,0123-456789-001,,,",
      "التاريخ,البيان,مدين,دائن,الرصيد",
      `${dmy(daysAgo(0))},فائدة,,"1,250","1,141,885"`,
      `${dmy(daysAgo(0))},عمولة البنك,"2,750",,"1,140,635"`,
      `${dmy(daysAgo(0))},حوالة طلبات,,"7,650","1,143,385"`,
      `${dmy(daysAgo(1))},ورق طابعة,"98,765",,"1,135,735"`,
      `${dmy(daysAgo(3))},إيداع نقدي,,"1,234,500","1,234,500"`,
      `${dmy(daysAgo(4))},رصيد افتتاحي,,,0`,
    ].join("\r\n"),
  "utf8",
);
const statementFile = { name: "كشف-الحساب.csv", mimeType: "text/csv", buffer: statement };

console.log("▸ a platform's report, chosen as its Excel file");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/platforms");
  const m = page.getByTestId("statement-matcher");
  await m.getByLabel("Platform").selectOption("talabat");
  await m.getByTestId("statement-file").setInputFiles({
    name: "talabat-statement.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook,
  });
  await m.getByTestId("file-read").waitFor({ timeout: 10000 });
  const read = await m.getByTestId("statement-read").textContent();
  check(
    read.includes("2 line(s) read") &&
      read.includes("columns: Order ID, Net Payout, Commission") &&
      read.includes("1 total row(s) left out") &&
      read.includes("3 other row(s) left out: titles and notes"),
    `read from the workbook by the column names below its title; its total, title and note left out (${read})`,
  );
  check(
    (await m.getByLabel("The statement").inputValue()).startsWith("Talabat vendor statement\n"),
    "what the file holds is shown, to be seen before anything is posted",
  );
  await m.getByRole("button", { name: "Match to the orders waiting" }).click();
  await m.getByTestId("match-result").waitFor({ timeout: 10000 });
  const statuses = await m
    .getByTestId("match-line")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-status")));
  check(
    statuses.join(",") === "matched,matched" &&
      num(await m.getByTestId("match-difference").textContent()) === 0,
    "both orders matched, the payout and commission their whole value",
  );
  await m.getByLabel("Statement number or date").fill("TLB-FILE-1");
  await m.getByRole("button", { name: "Post the payout" }).click();
  await page
    .getByText(/^✅ Posted \(journal \d+\): 2 Talabat order\(s\) paid out\.$/)
    .waitFor({ timeout: 10000 });
  check(
    last(`select count(*) from platform_order
           where external_order_id in ('FILE-7001', 'FILE-7002') and settlement_reference = 'TLB-FILE-1'`) ===
      "2",
    "posted: the two orders paid out by the statement",
  );

  await m.getByTestId("statement-file").setInputFiles({
    name: "statement.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n1 0 obj\n"),
  });
  await m.getByRole("alert").filter({ hasText: "A PDF is not read" }).waitFor({ timeout: 10000 });
  check(true, "a PDF is refused, with what to choose instead");
  await ctx.close();
}

const line = (page, amount) =>
  page.locator(`[data-testid="bank-line"][data-amount="${amount}"] input[type="checkbox"]`);

console.log("▸ the bank's statement, chosen as its CSV file, in Arabic");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/accounting/bank");
  await page.getByTestId("bank-file").setInputFiles(statementFile);
  await page.getByTestId("bank-read-summary").waitFor({ timeout: 10000 });
  const summary = await page.getByTestId("bank-read-summary").textContent();
  check(
    summary.includes("5 line(s) read") &&
      summary.includes(`${daysAgo(3)} to ${daysAgo(0)}`) &&
      summary.includes("columns: التاريخ, البيان, دائن, مدين, الرصيد") &&
      summary.includes("4 row(s) left out"),
    `its five lines read, oldest first, by their Arabic column names (${summary})`,
  );
  check(
    (await page.getByTestId("bank-found").textContent()).includes(
      "3 of its 5 line(s) are in the books, and are ticked.",
    ),
    "three found in the books",
  );
  check(
    (await line(page, 1234500).isChecked()) &&
      (await line(page, -98765).isChecked()) &&
      (await line(page, 7650).isChecked()) &&
      !(await line(page, -45000).isChecked()),
    "the cash, the paper and the platform's payout ticked; the cheque not cashed yet left open",
  );
  check(
    (await page.getByTestId("bank-date").inputValue()) === daysAgo(0) &&
      (await page.getByTestId("bank-closing").inputValue()) === "1141885",
    "its last day and its balance filled in",
  );
  const missing = await page
    .getByTestId("bank-missing")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-amount")));
  check(
    missing.join(",") === "-2750,1250" &&
      (await page.getByTestId("bank-not-in-books").textContent()).includes("عمولة البنك"),
    "the bank's charge and its interest: on the statement, not in the books",
  );
  check(
    (await page.getByTestId("bank-settled-elsewhere").getByRole("link").count()) === 2,
    "and money in from cards or a platform pointed to where it is settled",
  );
  check(
    (await page.getByTestId("bank-difference").textContent()).includes("1,500 IQD apart") &&
      (await page.getByTestId("bank-keep").isDisabled()),
    "so it does not tie yet, by the two, and cannot be kept",
  );

  console.log("▸ on a phone, what was read fits the screen");
  {
    const phone = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
    await phone.ctx.addCookies([{ name: "locale", value: "ckb", url: BASE }]);
    await open(phone.page, "/accounting/bank");
    await phone.page.getByTestId("bank-file").setInputFiles(statementFile);
    await phone.page.getByTestId("bank-not-in-books").waitFor({ timeout: 10000 });
    const over = await phone.page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      let worst = document.documentElement.scrollWidth - width;
      for (const box of document.querySelectorAll('[data-testid="bank-read"] .tw'))
        worst = Math.max(worst, box.scrollWidth - box.clientWidth);
      return Math.round(worst);
    });
    check(over <= 1, `at 390px, in Kurdish, it fits${over > 1 ? ` (by ${over}px)` : ""}`);
    await phone.ctx.close();
  }

  console.log("▸ the charge recorded from the statement, on Expenses");
  const record = (amount) =>
    page.locator(
      `[data-testid="bank-missing"][data-amount="${amount}"] [data-testid="bank-record"]`,
    );
  await Promise.all([page.waitForURL("**/expenses?**"), record(-2750).click()]);
  await page.getByRole("button", { name: "Post expense" }).waitFor({ timeout: 10000 });
  check(
    (await page.getByPlaceholder("September shop rent").inputValue()) === "عمولة البنك" &&
      (await page.getByLabel("Amount (IQD)").inputValue()) === "2750" &&
      (await page.getByLabel("Paid from").inputValue()) === "bank" &&
      (await page.locator('input[type="date"]').first().inputValue()) === daysAgo(0),
    "Record it opens Expenses filled in: the bank's words, the amount, the day, from the bank",
  );
  await page.getByLabel("Account").selectOption("6500");
  await page.getByRole("button", { name: "Post expense" }).click();
  await page.getByText(/Posted to 6500/).waitFor({ timeout: 10000 });
  await Promise.all([
    page.waitForURL("**/accounting/bank"),
    page.getByTestId("expense-back").click(),
  ]);
  await page.getByTestId("bank-found").waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("bank-found").textContent()).includes(
      "4 of its 5 line(s) are in the books, and are ticked.",
    ) && (await line(page, -2750).isChecked()),
    "back on the page, the statement read is there, and the charge found and ticked",
  );

  console.log("▸ the interest recorded from the statement, by a journal");
  await Promise.all([page.waitForURL("**/journals?**"), record(1250).click()]);
  const rows = page.getByTestId("journal-line");
  await rows.first().waitFor({ timeout: 10000 });
  check(
    (await page.getByPlaceholder("Being the reason this entry is made").inputValue()) === "فائدة" &&
      (await rows.nth(0).getByLabel("Account").inputValue()) === "1020" &&
      (await rows.nth(0).locator("input.amt").nth(0).inputValue()) === "1250" &&
      (await rows.nth(1).locator("input.amt").nth(1).inputValue()) === "1250",
    "Record it opens a journal filled in: Dr 1020 Bank 1,250, its other side to choose",
  );
  await rows.nth(1).getByLabel("Account").selectOption("4900");
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.getByText(/Journal \d+ published/).waitFor({ timeout: 10000 });
  await Promise.all([
    page.waitForURL("**/accounting/bank"),
    page.getByTestId("journal-back").click(),
  ]);
  await page.getByTestId("bank-found").waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId("bank-found").textContent()).includes(
      "5 of its 5 line(s) are in the books, and are ticked.",
    ) &&
      (await page.getByTestId("bank-not-in-books").count()) === 0 &&
      (await line(page, 1250).isChecked()),
    "back again, the interest found too: every line of it in the books",
  );
  check(
    (await page.getByTestId("bank-difference").textContent()).includes("It ties"),
    "and it ties",
  );
  await page.getByTestId("bank-keep").click();
  await page.getByText(/Statement \d+ is kept/).waitFor({ timeout: 10000 });
  check(
    last(`select statement_date || ' ' || trim_scale(closing_balance) || ' ' || line_count
            from bank_statement where business_id = '${B}' and status = 'kept'
           order by statement_no desc limit 1`) === `${daysAgo(0)} 1141885 5`,
    "kept: to today, at the bank's balance, with its five lines",
  );
  check(
    last(`select count(*) from bank_lines('${B}', ${TODAY})
           where statement_no is null and amount = -45000`) === "1",
    "the cheque not cashed yet stays open for the next statement",
  );
  await open(page, "/accounting/bank");
  check(
    (await page.getByTestId("bank-read-summary").count()) === 0,
    "once kept, the statement read is let go",
  );
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/platforms");
  await page.getByTestId("statement-file").setInputFiles({
    name: "2026-09.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook,
  });
  await page.getByTestId("file-read").waitFor({ timeout: 10000 });
  const left = await english(page, "/platforms");
  await open(page, "/accounting/bank");
  await page.getByTestId("bank-file").setInputFiles(statementFile);
  await page.getByTestId("bank-read-summary").waitFor({ timeout: 10000 });
  const before = await page.getByTestId("bank-read-summary").textContent();
  left.push(...(await english(page, "/accounting/bank")));
  check(
    left.length === 0 && !/[A-Za-z]{3,}/.test(before.replace(/\d{4}-\d{2}-\d{2}/g, "")),
    `in ${locale}, both read, and no English but the café's own names` +
      (left.length ? `: ${left.slice(0, 12).join(" ")}` : ""),
  );
  await page
    .getByRole("button", {
      name: locale === "ar" ? "امسح الكشف المقروء" : "کەشفە خوێندراوەکە بسڕەوە",
    })
    .click();
  await ctx.close();
}

await browser.close();
done("files");
