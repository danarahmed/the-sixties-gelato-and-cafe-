// Split payments (0042, release Q), through the real screens. At the till two
// espressos are paid part by card and the rest in cash, the cash with change;
// parts that come to more than the total are held back before anything is
// sent; the receipt lists each payment. A named bill is paid two ways too.
// Orders shows each payment; a refund of a sale paid two ways starts from each
// way's share of what is left, and goes back as the manager chose. Reports →
// Sales by payment method. The drawer is open (the fixtures', or one a suite
// before left open). Prices are read from the database: earlier suites change
// them.
import { chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const E = "d1000000-0000-0000-0000-000000000001";
const W = "d1000000-0000-0000-0000-000000000002";
/** As the screen shows money: 12,345 IQD. */
const iqd = (n) => `${n.toLocaleString("en-US")} IQD`;
/** Today's dine-in price of a product, as the till sells it. */
const price = (v) =>
  Number(
    last(`select trim_scale(price_on('${v}', 'dine_in', default_location('${B}'), ${TODAY}))`),
  );
/** A sale's payments, as a line: "card 4000 + cash 1000 of 5000, change 4000". */
const paid = (sale) =>
  last(`select string_agg(tender_type || ' ' || trim_scale(amount)
                          || coalesce(' of ' || trim_scale(received) || ', change ' || trim_scale(change_given), ''),
                          ' + ' order by position)
          from sales_tender where sales_order_id = '${sale}'`);

/** Printing is counted, not sent to a printer; each job's slips are kept to be read. */
async function withPrinter(who) {
  const s = await signIn(browser, who);
  await s.ctx.addInitScript(() => {
    window.__printed = 0;
    window.__slips = [];
    window.print = () => {
      window.__printed += 1;
      window.__slips.push(
        [...document.querySelectorAll(".print-slip > .slip")].map((slip) => slip.textContent),
      );
    };
  });
  return s;
}

// ------------------------------------------------------------ at the till
console.log("▸ at the till: two espressos, part by card and the rest in cash, with change");
const espresso = price(E);
const total = 2 * espresso;
const cardPart = total - 1000;
let sale;
{
  const { ctx, page } = await withPrinter("cashier");
  await open(page, "/pos");
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: "Dine-in", exact: true }).click();
  const tile = page.locator(".product-tile", { hasText: "Golden espresso" });
  await tile.click();
  await tile.click();
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.getByTestId("pay-split").click();
  const box = page.getByTestId("split-box");
  check(
    (await box.getByTestId("split-row").count()) === 2 &&
      (await box.getByLabel("How payment 1 is made").inputValue()) === "card" &&
      (await box.getByLabel("How payment 2 is made").inputValue()) === "cash",
    "Split starts as part by card and the rest in cash",
  );
  const confirm = page.locator(".pay-confirm");
  await box.getByLabel("Amount of payment 1").fill(String(total + 500));
  check(
    (await box.getByTestId("split-problem").textContent()) ===
      "The payments come to 500 IQD more than the total" && (await confirm.isDisabled()),
    "parts that come to more than the total are held back",
  );
  await box.getByLabel("Amount of payment 1").fill(String(cardPart));
  check(
    (await box.getByLabel("Amount of payment 2").getAttribute("placeholder")) === iqd(1000),
    "the last payment, left empty, takes what is left: 1,000",
  );
  await page.locator("#split-received").fill("5000");
  check(
    (await box.getByTestId("split-change").textContent()).includes("4,000 IQD"),
    "5,000 handed over for the cash part: 4,000 change",
  );
  await confirm.click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  const badges = await page.getByTestId("receipt-payments").locator(".badge").allTextContents();
  check(
    badges.join(" | ") === `Card ${iqd(cardPart)} | Cash ${iqd(1000)}`,
    "the receipt card shows each payment",
  );
  check(
    (await page.locator(".receipt-card .change-amt").textContent()) === iqd(4000),
    "and the change the database recorded",
  );
  await page.getByRole("button", { name: /Print receipt/ }).click();
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  const receipt = await page.evaluate(() => window.__slips[0][0]);
  check(
    new RegExp(`Card\\s*${cardPart.toLocaleString("en-US")}`).test(receipt) &&
      /Cash\s*5,000/.test(receipt) &&
      /Change\s*4,000/.test(receipt),
    "the printed receipt lists the card, the cash handed over, and the change",
  );
  await ctx.close();
}
sale = last(`select id from sales_order order by created_at desc limit 1`);
check(
  paid(sale) === `card ${cardPart} + cash 1000 of 5000, change 4000`,
  "the database keeps each payment: the card's part, and the cash's with what was handed over",
);
check(
  sql(`select string_agg(kind || ' ' || trim_scale(amount), ',') from cash_event
        where reference_type = 'sales_order' and reference_id = '${sale}'`) === "sale 1000",
  "the drawer takes the cash part, not the note handed over",
);
check(
  sql(`select string_agg(a.code || ' ' || trim_scale(l.debit), ',' order by a.code)
         from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
        where e.reference_id = '${sale}' and a.code in ('1000', '1010') and l.debit > 0`) ===
    `1000 1000,1010 ${cardPart}`,
  "each payment's account is debited with its part",
);

// ------------------------------------------------------------ a bill
console.log("▸ a named bill, paid by two cards");
const water = price(W);
sql(`select test.act_as('cashier@example.com');
     select open_tab('dine_in', null, 'Split Sam', null,
                     '[{"variant_id": "${E}", "qty": 1}, {"variant_id": "${W}", "qty": 1}]');`);
const bill = espresso + water;
{
  const { ctx, page } = await withPrinter("cashier");
  await open(page, "/pos");
  await page.locator(".strip-chip", { hasText: "Split Sam" }).click();
  await page.getByRole("button", { name: /Card/ }).click();
  await page.getByTestId("pay-split").click();
  const box = page.getByTestId("split-box");
  await box.getByLabel("How payment 2 is made").selectOption("card");
  await box.getByLabel("Amount of payment 1").fill(String(water));
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  await ctx.close();
}
const billSale = last(`select sales_order_id from pos_tab where label = 'Split Sam'`);
check(
  paid(billSale) === `card ${water} + card ${espresso}` &&
    last(`select status from pos_tab where label = 'Split Sam'`) === "paid",
  `the bill is paid: ${iqd(water)} on one card, ${iqd(espresso)} on the other`,
);

// ------------------------------------------------------------ Orders and a refund
console.log("▸ Orders shows each payment; a refund goes back each way, as the manager chooses");
// One espresso of the two: its net, shared over what is left of each payment.
const back = espresso;
{
  const { ctx, page } = await withPrinter("manager");
  await open(page, "/orders");
  const row = page.locator("tbody tr", { hasText: sale.slice(0, 8) });
  check(
    (await row.getByTestId("order-payments").textContent()) ===
      `Card ${iqd(cardPart)} + Cash ${iqd(1000)}`,
    "Orders shows the card's part and the cash's",
  );
  await row.getByRole("button", { name: "Refund" }).click();
  const dialog = page.getByTestId("refund-dialog");
  await dialog.getByLabel("How many of Golden espresso — Single go back").fill("1");
  const cashShare = Math.round((1000 * back) / total);
  const split = dialog.getByTestId("refund-split");
  check(
    Number(await split.getByLabel("Given back Cash").inputValue()) === cashShare &&
      Number(await split.getByLabel("Given back Card").inputValue()) === back - cashShare,
    `it starts from each way's share: ${iqd(cashShare)} in cash, ${iqd(back - cashShare)} to the card`,
  );
  await split.getByLabel("Given back Cash").fill("1500");
  check(
    (await dialog.getByTestId("refund-split-problem").textContent()) ===
      "Only 1000 of the cash paid is left to give back" &&
      (await dialog.getByRole("button", { name: "Confirm refund" }).isDisabled()),
    "never more back in cash than the cash paid",
  );
  await split.getByLabel("Given back Cash").fill("1000");
  check(
    (await dialog.getByTestId("refund-split-problem").textContent()).startsWith(
      `The refund is ${back}, but the payments given back come to`,
    ),
    "the parts must come to the refund",
  );
  await split.getByLabel("Given back Card").fill(String(back - 1000));
  check(
    (await dialog.getByTestId("refund-total").textContent()).includes(
      `Gives back ${iqd(back)}: ${iqd(back - 1000)} to the card it was paid with; ${iqd(1000)} in cash, from the drawer`,
    ),
    "it says how the money goes back, each way, in the order the sale was paid",
  );
  await dialog.getByLabel("Why refund it?").selectOption("changed_mind");
  await dialog.getByRole("button", { name: "Confirm refund" }).click();
  const answer = dialog.getByTestId("refund-answer");
  await answer.waitFor({ timeout: 10000 });
  check(
    (await answer.textContent()).includes(
      `given back: ${iqd(back - 1000)} to the card it was paid with; ${iqd(1000)} in cash, from the drawer (journal `,
    ),
    "the answer says each way it went back",
  );
  await dialog.getByRole("button", { name: /Print the refund slip/ }).click();
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  const slip = await page.evaluate(() => window.__slips[0][0]);
  check(
    /Cash\s*1,000/.test(slip) &&
      new RegExp(`Card\\s*${(back - 1000).toLocaleString("en-US")}`).test(slip),
    "the refund slip lists each way",
  );
  await ctx.close();
}
check(
  sql(`select string_agg(t.tender_type || ' ' || trim_scale(t.amount), ',' order by t.tender_type)
         from sale_refund r join sale_refund_tender t on t.refund_id = r.id where r.sales_order_id = '${sale}'`) ===
    `cash 1000,card ${back - 1000}`,
  "the database gave back each way its part",
);
check(
  sql(`select string_agg(e.kind || ' ' || trim_scale(e.amount), ',') from cash_event e
         join sale_refund r on r.id = e.reference_id where r.sales_order_id = '${sale}'`) ===
    "refund -1000",
  "only the cash part left the drawer",
);

// ------------------------------------------------------------ the report
console.log("▸ Reports → Sales by payment method");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const report = page.getByTestId("payments-report");
  /** The database's own figures for a way of paying, today. */
  const db = (m) =>
    last(`select test.act_as('owner@example.com');
          select trim_scale(taken) || '|' || split_sales || '|' || trim_scale(refunded)
            from report_payments(${TODAY}, ${TODAY}) where method = '${m}'`).split("|");
  for (const [m, name] of [
    ["cash", "Cash"],
    ["card", "Card"],
  ]) {
    const [taken, split, refunded] = db(m);
    const shown = await report.getByTestId(`payments-${m}`).textContent();
    check(
      shown.startsWith(name) &&
        shown.includes(`${split} paid two ways`) &&
        shown.includes(iqd(Number(taken))) &&
        shown.includes(`(${iqd(Number(refunded))})`),
      `${name}: ${iqd(Number(taken))} taken, ${split} paid two ways, ${iqd(Number(refunded))} given back, as the database has it`,
    );
  }
  await ctx.close();
}

await browser.close();
done("split payments");
