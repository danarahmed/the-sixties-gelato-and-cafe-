// Card and platform money, reconciled (0030, the audit's P1-9), through the
// real screens: the owner settles a day's card takings, once it is over,
// against the terminal's report and the bank (the fee to 6500, a difference
// to 6300 with a note), cancels it and settles again; a manager matches a Talabat statement but
// does not post it; the owner posts it, with a note for the lines that do
// not match, and cancels it.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const ESPRESSO = "d1000000-0000-0000-0000-000000000001";
/** The latest journal posted for a settlement of this kind, line by line. */
const lines = (by) =>
  sql(`select string_agg(g.code || ' ' || case when l.debit > 0 then 'Dr ' || trim_scale(l.debit)
                                             else 'Cr ' || trim_scale(l.credit) end, ' | ' order by g.code)
         from journal_line l join gl_account g on g.id = l.account_id
        where l.journal_entry_id = (select id from journal_entry where reference_type = '${by}'
                                     order by journal_no desc limit 1)`);
const num = (s) => Number(String(s).replace(/[^\d.-]/g, ""));

// Yesterday's card takings, 10,000 (brought in as a journal: the till rings
// only today); two card sales today, still trading; and four Talabat orders
// of 3,000, each rung on its own, in order.
sql(`select post_journal('00000000-0000-0000-0000-0000000000b1',
       ((test.today() - 1)::timestamp + time '20:00') at time zone 'Asia/Baghdad',
       'Card takings brought forward (E2E)', 'manual', null,
       '[{"code":"1010","debit":10000},{"code":"3000","credit":10000}]')`);
const sell = (channel, tender, qty, orderNo = null) =>
  sql(`select test.act_as('cashier@example.com');
       select record_sale(gen_random_uuid(), '${channel}', '${tender}',
                          '[{"variant_id":"${ESPRESSO}","qty":${qty}}]',
                          p_platform_order_no => ${orderNo ? `'${orderNo}'` : "null"})`);
sell("dine_in", "card", 2);
sell("dine_in", "card", 2);
for (const no of ["E2E-1", "E2E-2", "E2E-3", "E2E-4"]) sell("talabat", "platform_paid", 1, no);
// The third rung twice: voided.
sql(`select test.act_as('manager@example.com');
     select void_sale((select sales_order_id from platform_order where external_order_id = 'E2E-3'), null, 'rang_twice');`);

console.log("▸ a manager sees the card takings waiting, and does not settle them");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales#card");
  const panel = page.getByTestId("card-takings");
  check(await panel.isVisible(), "Sales shows the card takings, where the alert points");
  check((await panel.getByTestId("card-day").count()) === 2, "each day waiting to be settled");
  check(
    !(await panel.getByRole("button", { name: "Record the settlement" }).isVisible()),
    "a person who keeps the books settles them: not a branch manager",
  );
  await ctx.close();
}

console.log("▸ the owner settles yesterday's against the terminal and the bank");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/sales#card");
  const panel = page.getByTestId("card-takings");
  check(
    (await panel.getByTestId("card-day").last().textContent()).includes(
      "today: settled once the day is over",
    ),
    "today's takings wait until the day is over: the till takes cards until midnight",
  );
  check(
    num(await panel.getByTestId("card-till").textContent()) === 10000,
    "yesterday's 10,000 is offered",
  );
  // The terminal took 2,500 less: a sale rung as card was paid in cash. 50 is the fee.
  await panel.getByLabel("The terminal's total").fill("7,500");
  await panel.getByLabel("Reached the bank").fill("7450");
  const preview = await panel.getByTestId("card-preview").textContent();
  check(
    num(await panel.getByTestId("card-fee").textContent()) === 50 &&
      num(await panel.getByTestId("card-difference").textContent()) === 2500 &&
      preview.includes("the till took more by card than the terminal"),
    "the fee and the difference, before anything is posted",
  );
  const record = panel.getByRole("button", { name: "Record the settlement" });
  check(await record.isDisabled(), "a difference needs a note saying why");
  await panel.getByLabel("Note").fill("A card sale rung by mistake: it was paid in cash");
  await record.click();
  await page.getByText(/^✅ Settled \(journal \d+\)/).waitFor({ timeout: 10000 });
  check(
    lines("card_settlement") === "1010 Cr 10000 | 1020 Dr 7450 | 6300 Dr 2500 | 6500 Dr 50",
    "the bank's money in, the fee to 6500, the difference to 6300, the till's takings out of 1010",
  );
  await open(page, "/sales#card");
  check(
    (await panel.getByTestId("card-day").count()) === 1 &&
      (await panel.getByText("Today's card takings are settled once the day is over").isVisible()),
    "only today's wait, for tomorrow",
  );

  // Cancelled: yesterday's wait again; then settled rightly.
  await panel.getByRole("button", { name: "Cancel…" }).click();
  await panel.getByLabel("Why it is cancelled").fill("The terminal's report was the day before's");
  await panel.getByRole("button", { name: "Cancel it" }).click();
  await page.getByText(/^✅ Cancelled: its journal is reversed/).waitFor({ timeout: 10000 });
  await open(page, "/sales#card");
  check(
    num(await panel.getByTestId("card-till").textContent()) === 10000,
    "cancelled, yesterday's takings wait again",
  );
  await panel.getByRole("button", { name: "Same as the till" }).click();
  await panel.getByLabel("Reached the bank").fill("9900");
  await panel.getByRole("button", { name: "Record the settlement" }).click();
  await page.getByText(/^✅ Settled \(journal \d+\)/).waitFor({ timeout: 10000 });
  check(
    lines("card_settlement") === "1010 Cr 10000 | 1020 Dr 9900 | 6500 Dr 100",
    "settled again with no difference: no note needed",
  );
  await open(page, "/sales#card");
  check(
    (await panel.getByTestId("card-settlement").count()) === 2 &&
      (await panel.getByText("Cancelled", { exact: true }).count()) === 1,
    "both settlements are listed, the first marked cancelled",
  );
  await ctx.close();
}
check(
  sql(`select string_agg(action, ',' order by id) from audit_log where action like 'card.%'`) ===
    "card.settlement,card.settlement_cancel,card.settlement",
  "each on the audit trail",
);

// E2E-1 paid; E2E-3 was voided; 9999 is no sale of ours; E2E-4 paid 50 short;
// line 5 repeats line 1; and E2E-2, sold between them, is not on it.
const statement = [
  "Order ID\tOrder Value\tCommission\tNet Payout",
  "#E2E-1\t3,000\t-450\t2,550",
  "E2E-3\t3,000\t-450\t2,550",
  "9999\t1,000\t\t1,000",
  "E2E-4\t3,000\t-450\t2,500",
  "E2E-1\t3,000\t-450\t2,550",
  "Total\t13,000\t-1,800\t11,150",
].join("\n");

console.log("▸ a manager matches a Talabat statement, and does not post it");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/platforms");
  const owed = await page
    .getByTestId("platform-owed")
    .evaluateAll((rows) => rows.map((r) => r.textContent));
  check(
    owed.some((t) => t.includes("E2E-1")) &&
      owed.some((t) => t.includes("E2E-2")) &&
      !owed.some((t) => t.includes("E2E-3")),
    "the platform owes the Talabat orders by number; the voided one, nothing",
  );
  const m = page.getByTestId("statement-matcher");
  check(
    (await m.getByLabel("Platform").inputValue()) === "talabat",
    "the platform most orders wait on is offered first",
  );
  await m.getByLabel("Platform").selectOption("talabat");
  await m.getByLabel("The statement").fill(statement);
  check(
    (await m.getByTestId("statement-read").textContent()).includes("5 line(s) read") &&
      (await m.getByTestId("statement-read").textContent()).includes("1 total row(s) left out"),
    "the pasted statement is read by its column names, its total row left out",
  );
  await m.getByRole("button", { name: "Match to the orders waiting" }).click();
  await m.getByTestId("match-result").waitFor({ timeout: 10000 });
  const statuses = await m
    .getByTestId("match-line")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-status")));
  check(
    statuses.join(",") === "matched,voided,not_found,matched,duplicate",
    "each line matched, or why not: a voided sale, an order the till never saw, a line twice",
  );
  check(
    num(await m.getByTestId("match-difference").textContent()) === 50,
    "and what the platform paid short, not explained by commission or fees",
  );
  check(
    (await m.getByTestId("match-missing").textContent()).includes("E2E-2"),
    "and the order it leaves out, sold between those it pays",
  );
  check(
    (await m.getByTestId("match-journal").textContent()).includes("1100 Platform receivable"),
    "the journal it would post",
  );
  check(
    !(await m.getByRole("button", { name: "Post the payout" }).isVisible()) &&
      (await m.getByText("The owner or the accountant posts the payout.").isVisible()),
    "a branch manager matches; a person who keeps the books posts",
  );
  await ctx.close();
}

console.log("▸ the owner posts it with a note, then cancels it");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/platforms");
  const m = page.getByTestId("statement-matcher");
  await m.getByLabel("Platform").selectOption("talabat");
  await m.getByLabel("The statement").fill(statement);
  await m.getByRole("button", { name: "Match to the orders waiting" }).click();
  await m.getByTestId("match-result").waitFor({ timeout: 10000 });
  await m.getByLabel("Statement number or date").fill("TLB-E2E-1");
  const post = m.getByRole("button", { name: "Post the payout" });
  check(await post.isDisabled(), "lines that do not match need a note");
  await m
    .getByLabel("Note")
    .fill("9999 is not ours; E2E-3 was voided; E2E-4 paid 50 short, asked; line 5 repeats line 1");
  await post.click();
  await page
    .getByText(/^✅ Posted \(journal \d+\): 2 Talabat order\(s\) paid out; 4 line\(s\)/)
    .waitFor({ timeout: 10000 });
  check(
    lines("platform_settlement") === "1020 Dr 5050 | 1100 Cr 6000 | 5100 Dr 900 | 5200 Dr 50",
    "the payout into the bank, the commission, the 50 short to fees, the orders out of 1100",
  );
  await open(page, "/platforms");
  const owed = await page
    .getByTestId("platform-owed")
    .evaluateAll((rows) => rows.map((r) => r.textContent));
  check(
    !owed.some((t) => t.includes("E2E-1")) &&
      !owed.some((t) => t.includes("E2E-4")) &&
      owed.some((t) => t.includes("E2E-2")),
    "the orders paid no longer wait; the one left out still does",
  );
  const row = page.getByTestId("platform-settlement").filter({ hasText: "TLB-E2E-1" });
  check(
    (await row.textContent()).includes("2 of 5 lines"),
    "the statement is listed: 2 orders paid, of its 5 lines",
  );
  await row.getByRole("button", { name: "Cancel…" }).click();
  await row.getByLabel("Why it is cancelled").fill("The statement was Careem's");
  await row.getByRole("button", { name: "Cancel it" }).click();
  await page.getByText(/^✅ Cancelled: its journal is reversed/).waitFor({ timeout: 10000 });
  await open(page, "/platforms");
  check(
    (
      await page.getByTestId("platform-owed").evaluateAll((rows) => rows.map((r) => r.textContent))
    ).some((t) => t.includes("E2E-1")),
    "cancelled, its orders wait again",
  );
  await ctx.close();
}
check(
  sql(
    `select string_agg(action, ',' order by id) from audit_log where action like 'platform.%'`,
  ) === "platform.settlement,platform.settlement_cancel",
  "each on the audit trail",
);

await browser.close();
done("settlements");
