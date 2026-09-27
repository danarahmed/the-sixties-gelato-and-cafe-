// Every write recorded once (0035, release J), on the screens themselves: the
// database does the work and its answer to the app's server is lost on the way
// back (the gateway drops it). The screen says it is checking, sends it again
// with the same key, and shows what was done — and the database holds it once.
// The quick sale's own version of this is tested in retry.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const gateway = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321");
/** The next call to `fn` reaches the database, which commits; its answer never arrives. */
const loseNextAnswer = (fn) =>
  fetch(new URL(`/__e2e/lose-next-answer?fn=${fn}`, gateway), { method: "POST" });
const n = (q) => Number(sql(q));
const logged = (fn) => n(`select count(*) from request_log where operation = '${fn}'`);
/** Each subledger's difference from its account (earlier suites may leave some, on purpose). */
const differences = () =>
  sql(`select test.act_as('owner@example.com');
       select string_agg(check_key || '=' || difference, ',' order by check_key)
         from report_reconciliation(current_date)`)
    .split("\n")
    .pop();
const differencesBefore = differences();
const checking = (page) =>
  page
    .getByText(/may already have been saved\. Checking/)
    .first()
    .waitFor({ timeout: 8000 })
    .then(
      () => true,
      () => false,
    );

// ------------------------------------------------------------- an expense
console.log("▸ an expense whose answer is lost is posted once");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/expenses");
  await page.getByPlaceholder("September shop rent").fill("Ice for the freezer, resent");
  await page.locator("input.amt").first().fill("1500");
  await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="6900"]') })
    .first()
    .selectOption("6900");
  const before = n("select count(*) from expense");
  await loseNextAnswer("record_expense");
  await page.getByRole("button", { name: "Post expense" }).click();
  check(await checking(page), "the screen says it may already be saved, and checks");
  await page.getByText(/Posted to 6900/).waitFor({ timeout: 15000 });
  check(n("select count(*) from expense") === before + 1, "one expense, though it was sent twice");
  check(logged("record_expense") >= 1, "the database kept the first answer under the key");
  await ctx.close();
}

// ------------------------------------------------------------- cash
console.log("▸ cash moved with its answer lost is moved once");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales");
  await page.getByLabel("Cash from", { exact: true }).selectOption("owner");
  await page.getByLabel("Cash to", { exact: true }).selectOption("till");
  await page.getByLabel("Amount to move", { exact: true }).fill("1000");
  await page.getByLabel("What the cash is for", { exact: true }).fill("Float, resent");
  const before = n("select count(*) from cash_transfer");
  await loseNextAnswer("move_cash");
  await page.getByRole("button", { name: "Move cash" }).click();
  check(await checking(page), "the cash screen checks too");
  await page.getByText(/Moved 1,000 IQD from/).waitFor({ timeout: 15000 });
  check(n("select count(*) from cash_transfer") === before + 1, "the cash moved once");
  await ctx.close();
}

// ------------------------------------------------------------- a void
console.log("▸ a void with its answer lost is voided once, not refused as done already");
{
  const sale = sql(`select test.act_as('cashier@example.com');
    select record_sale(gen_random_uuid(), 'dine_in', 'card',
      '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]') ->> 'order_id'`)
    .split("\n")
    .pop();
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/orders");
  await page
    .locator("tbody tr", { has: page.getByRole("button", { name: "Void" }) })
    .first()
    .getByRole("button", { name: "Void" })
    .click();
  const fix = page.getByTestId("order-correction");
  await fix.getByLabel("Why void it?").selectOption("rang_twice");
  await loseNextAnswer("void_sale");
  await fix.getByRole("button", { name: "Confirm void" }).click();
  await fix.waitFor({ state: "detached", timeout: 15000 });
  check(
    sql(`select status from sales_order where id = '${sale}'`) === "voided" &&
      n(`select count(*) from sale_adjustment where sales_order_id = '${sale}'`) === 1,
    "the sale is voided, with one void recorded",
  );
  await ctx.close();
}

// ------------------------------------------------------------- a refund
console.log("▸ a refund with its answer lost is given once, not refused as more than is left");
{
  const sale = sql(`select test.act_as('cashier@example.com');
    select record_sale(gen_random_uuid(), 'dine_in', 'card',
      '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]') ->> 'order_id'`)
    .split("\n")
    .pop();
  // One of the two, at whatever an espresso costs by now (earlier suites change it).
  const one = n(`select line_net / 2 from sales_order_line where sales_order_id = '${sale}'`);
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/orders");
  await page
    .locator("tbody tr", { hasText: sale.slice(0, 8) })
    .getByRole("button", { name: "Refund" })
    .click();
  const dialog = page.getByTestId("refund-dialog");
  await dialog.getByLabel("How many of Golden espresso — Single go back").fill("1");
  await dialog.getByLabel("Why refund it?").selectOption("wrong_order");
  await loseNextAnswer("refund_sale_lines");
  await dialog.getByRole("button", { name: "Confirm refund" }).click();
  check(await checking(page), "the refund checks too");
  const answer = dialog.getByTestId("refund-answer");
  await answer.waitFor({ timeout: 15000 });
  check(
    (await answer.textContent()).includes(
      `${one.toLocaleString("en-US")} IQD given back to the card it was paid with`,
    ),
    "and shows the refund that was given",
  );
  check(
    sql(`select status || ' ' || (select count(*) from sale_refund where sales_order_id = o.id)
           from sales_order o where id = '${sale}'`) === "partially_refunded 1",
    "one espresso refunded once, though it was sent twice",
  );
  await ctx.close();
}

// ------------------------------------------------------------- a journal
console.log("▸ a journal saved with its answer lost is one journal");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/journals");
  await page.getByRole("button", { name: "New Journal" }).click();
  const selects = page.locator("tbody select");
  await selects.nth(0).selectOption("6200");
  await selects.nth(1).selectOption("1020");
  const amts = page.locator("tbody input.amt");
  await amts.nth(0).fill("7000");
  await amts.nth(3).fill("7000");
  const narration = `Gas bottle, resent ${Date.now()}`;
  await page.getByPlaceholder("Being the reason this entry is made").fill(narration);
  await loseNextAnswer("save_journal");
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.getByText(/Journal \d+ published/).waitFor({ timeout: 15000 });
  check(
    n(`select count(*) from journal_entry where description = '${narration}'`) === 1,
    "one journal, published once",
  );
  await ctx.close();
}

// ------------------------------------------------------------- a bill at the till
console.log("▸ a bill kept open with its answer lost is one bill");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  // With tables set up, the till opens on them: go to the menu.
  await page.getByRole("tab", { name: "☕ Menu" }).click();
  await page.getByRole("button", { name: "Dine-in" }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /Keep open, pay later/ }).click();
  const guest = `Resent guest ${Date.now() % 100000}`;
  await page.getByLabel("Customer's name").fill(guest);
  await loseNextAnswer("open_tab");
  await page.getByRole("button", { name: "Keep open", exact: true }).click();
  await page.getByText(`${guest} — kept open, waiting for payment`).waitFor({ timeout: 15000 });
  check(
    n(`select count(*) from pos_tab where label = '${guest}'`) === 1,
    "one bill for the guest, though it was opened twice",
  );
  await ctx.close();
}

// ------------------------------------------------------------- a delivery
console.log("▸ a delivery received with its answer lost is received once");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const form = page.getByTestId("receive");
  await form
    .locator("label", { hasText: /^Supplier/ })
    .locator("select")
    .selectOption({ index: 1 });
  const line = form.getByTestId("receive-line").first();
  await line
    .locator("label", { hasText: /^Item/ })
    .locator("select")
    .selectOption({ label: "Golden cup" });
  await line
    .locator("label", { hasText: /^Quantity/ })
    .locator("input")
    .fill("10");
  await line
    .locator("label", { hasText: /^Price per/ })
    .locator("input")
    .fill("50");
  const before = n("select count(*) from goods_receipt");
  await loseNextAnswer("receive_goods");
  await form.getByRole("button", { name: "Receive goods" }).click();
  await form.getByText(/Receipt \d+ — 500 IQD into stock/).waitFor({ timeout: 15000 });
  check(n("select count(*) from goods_receipt") === before + 1, "one receipt, one lot of stock in");
  await ctx.close();
}

// ------------------------------------------------------------- a delivery's correction
console.log("▸ a delivery corrected with its answer lost is corrected once");
{
  const id = sql(`select test.act_as('manager@example.com');
    select receive_goods((select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1'
                           and is_active order by name, id limit 1),
      '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":4,"unit_price":50}]', p_confirm => true) ->> 'receipt_id'`)
    .split("\n")
    .pop();
  const no = sql(`select receipt_no from goods_receipt where id = '${id}'`);
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  await page
    .locator(`[data-testid="receipt-row"][data-receipt="${no}"]`)
    .getByRole("button", { name: "Correct", exact: true })
    .click();
  const dialog = page.getByTestId("receipt-correction");
  await dialog.getByLabel("Quantity of Golden cup").fill("3");
  await dialog.getByRole("button", { name: "Show what it would do" }).click();
  await dialog.getByTestId("correction-plan").waitFor({ timeout: 10000 });
  await dialog.getByLabel("Why it is corrected").fill("One cup short, resent");
  await loseNextAnswer("correct_receipt");
  await dialog.getByRole("button", { name: "Confirm the correction" }).click();
  check(await checking(page), "the correction checks too");
  await dialog.getByTestId("correction-answer").waitFor({ timeout: 15000 });
  check(
    n(`select count(*) from receipt_correction where goods_receipt_id = '${id}'`) === 1,
    "one correction, though it was sent twice",
  );
  check(
    n(`select count(*) from journal_entry where reference_type = 'receipt_correction'
         and reference_id in (select id from receipt_correction where goods_receipt_id = '${id}')`) ===
      1,
    "with one journal",
  );
  await ctx.close();
}

check(
  differences() === differencesBefore,
  "and no subledger moved away from its account through all of it",
);
await browser.close();
done("resend");
