// The café's own ways to pay (0069, round ten), through the real screens. The
// owner adds FIB and FastPay on Settings with one press each: each is given
// its own account. At the till FIB is a button under Cash and Card: a sale
// paid by it carries the reference the app showed, and a split takes a part
// by FIB and the rest by card (no cash: the drawer may be closed by now). Orders names the way a sale was paid; a refund gives FIB its part
// back. On Sales the owner moves FIB's money to the bank, less its fee, and
// cancels the move. Reports and the end of the day list FIB. Both are taken
// out of use at the end, so the suites after this one see the till as before.
import { chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const E = "d1000000-0000-0000-0000-000000000001";
/** As the screen shows money: 12,345 IQD. */
const iqd = (n) => `${n.toLocaleString("en-US")} IQD`;
/** Today's dine-in price of a product, as the till sells it. */
const price = (v) =>
  Number(
    last(`select trim_scale(price_on('${v}', 'dine_in', default_location('${B}'), ${TODAY}))`),
  );
/** What an account holds in the books. */
const balance = (code) =>
  Number(
    last(`select coalesce(trim_scale(sum(l.debit - l.credit)), 0) from journal_line l
            join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
           where a.business_id = '${B}' and a.code = '${code}' and e.status = 'published'`),
  );
/** A sale's payments, as a line: "other FIB 2500 (TX 77)". */
const paid = (sale) =>
  last(`select string_agg(t.tender_type || coalesce(' ' || m.name, '') || ' ' || trim_scale(t.amount)
                          || coalesce(' (' || t.reference || ')', ''), ' + ' order by t.position)
          from sales_tender t left join payment_method m on m.id = t.payment_method_id
         where t.sales_order_id = '${sale}'`);

/** A quick dine-in sale of espressos on the till, ready to pay. */
async function ring(page, n) {
  await open(page, "/pos");
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: "Dine-in", exact: true }).click();
  const tile = page.locator(".product-tile", { hasText: "Golden espresso" });
  for (let i = 0; i < n; i++) await tile.click();
}

// ------------------------------------------------------------ Settings
console.log("▸ the owner adds FIB and FastPay on Settings, one press each");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  const card = page.getByTestId("settings-pay-methods");
  check(
    (await card.locator("h3").textContent()) === "Ways to pay",
    "Settings has a card for the ways to pay",
  );
  check(
    (await card.getByRole("button", { name: /^\+ / }).allTextContents()).join(", ") ===
      "+ FIB, + FastPay, + ZainCash, + Qi Card",
    "it offers FIB, FastPay, ZainCash and Qi Card to add with one press",
  );
  await card.getByTestId("pay-method-quick-fib").click();
  await card.getByText("FIB added: the till offers it now.").waitFor({ timeout: 10000 });
  await card.getByTestId("pay-method-quick-fastpay").click();
  await card.getByText("FastPay added: the till offers it now.").waitFor({ timeout: 10000 });
  const rows = card.getByTestId("pay-method-row");
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="pay-method-row"]').length === 2,
  );
  check(
    (await rows.allTextContents()).every((r) => r.includes("offered")) &&
      (await rows.first().textContent()).includes("1030") &&
      (await rows.nth(1).textContent()).includes("1031"),
    "each is listed with an account of its own, 1030 and 1031, offered at the till",
  );
  check(
    !(await card.getByRole("button", { name: "+ FIB" }).isVisible()),
    "and is no longer offered to add",
  );
  await ctx.close();
}
check(
  sql(`select string_agg(m.name || ' ' || a.code || ' ' || a.name || ' ' || a.account_type, ', ' order by a.code)
         from payment_method m join gl_account a on a.business_id = m.business_id and a.code = m.account_code`) ===
    "FIB 1030 FIB asset, FastPay 1031 FastPay asset",
  "the database gave each an asset account, named after it",
);
const FIB = last(`select id from payment_method where name = 'FIB'`);

// ------------------------------------------------------------ the till
console.log("▸ at the till: an espresso paid by FIB, with the app's reference");
const espresso = price(E);
let fibSale;
{
  const { ctx, page } = await signIn(browser, "cashier");
  await ring(page, 1);
  const methods = page.getByTestId("pay-methods-row");
  check(
    (await methods.getByTestId("pay-method").allTextContents()).map((s) => s.trim()).join(", ") ===
      "FIB, FastPay",
    "a button for each way to pay, under Cash and Card",
  );
  await methods.getByRole("button", { name: "FIB" }).click();
  const fibChoice = page.getByTestId("pay-method-choice").filter({ hasText: "FIB" });
  check((await fibChoice.getAttribute("aria-checked")) === "true", "the payment opens on FIB");
  await page.locator("#pay-reference").fill("TX 77");
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    (await page.locator(".receipt-card .rc-top .badge").first().textContent()).includes("FIB"),
    "the receipt names FIB",
  );
  await ctx.close();
}
fibSale = last(`select id from sales_order order by created_at desc limit 1`);
check(
  paid(fibSale) === `other FIB ${espresso} (TX 77)`,
  "the database keeps FIB and the reference",
);
check(
  last(`select string_agg(a.code || ' ' || case when l.debit > 0 then 'Dr' else 'Cr' end, ',' order by a.code)
          from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id
         where e.reference_id = '${fibSale}' and a.code in ('1000', '1010', '1030')`) === "1030 Dr",
  "FIB's account takes the money: not the drawer, not the card",
);

console.log("▸ two espressos split: part by FIB, the rest by card");
const fibPart = 1000;
let splitSale;
{
  const { ctx, page } = await signIn(browser, "cashier");
  await ring(page, 2);
  await page.getByRole("button", { name: /Card/ }).click();
  await page.getByTestId("pay-split").click();
  const box = page.getByTestId("split-box");
  await box.getByLabel("How payment 1 is made").selectOption(`m:${FIB}`);
  await box.getByLabel("Amount of payment 1").fill(String(fibPart));
  await box.getByLabel("How payment 2 is made").selectOption("card");
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  const badges = await page.getByTestId("receipt-payments").locator(".badge").allTextContents();
  check(
    badges.join(" | ") === `FIB ${iqd(fibPart)} | Card ${iqd(2 * espresso - fibPart)}`,
    "the receipt shows FIB's part and the card's",
  );
  await ctx.close();
}
splitSale = last(`select id from sales_order order by created_at desc limit 1`);
check(
  paid(splitSale) === `other FIB ${fibPart} + card ${2 * espresso - fibPart}`,
  "the database keeps each part, FIB's named",
);

// ------------------------------------------------------------ Orders and a refund
console.log("▸ Orders names FIB; a refund gives FIB its part back");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/orders");
  const fibRow = page.locator("tbody tr", { hasText: fibSale.slice(0, 8) });
  const shown = await fibRow.getByTestId("order-payments").textContent();
  check(
    shown.includes("FIB") && shown.includes("Ref. TX 77"),
    "the FIB sale says FIB, and its reference",
  );
  const row = page.locator("tbody tr", { hasText: splitSale.slice(0, 8) });
  check(
    (await row.getByTestId("order-payments").textContent()) ===
      `FIB ${iqd(fibPart)} + Card ${iqd(2 * espresso - fibPart)}`,
    "the split sale shows FIB's part and the card's",
  );
  await row.getByRole("button", { name: "Refund" }).click();
  const dialog = page.getByTestId("refund-dialog");
  await dialog.getByLabel("How many of Golden espresso — Single go back").fill("1");
  const split = dialog.getByTestId("refund-split");
  await split.getByLabel("Given back FIB").fill(String(fibPart));
  await split.getByLabel("Given back Card").fill(String(espresso - fibPart));
  check(
    (await dialog.getByTestId("refund-total").textContent()).includes(
      `${iqd(fibPart)} by FIB, the way it was paid`,
    ),
    "the refund says FIB's part goes back by FIB",
  );
  await dialog.getByLabel("Why refund it?").selectOption("changed_mind");
  await dialog.getByRole("button", { name: "Confirm refund" }).click();
  await dialog.getByTestId("refund-answer").waitFor({ timeout: 10000 });
  check(
    (await dialog.getByTestId("refund-answer").textContent()).includes(
      "by FIB, the way it was paid",
    ),
    "and the answer says so",
  );
  await ctx.close();
}
check(
  sql(`select string_agg(t.tender_type || coalesce(' ' || m.name, '') || ' ' || trim_scale(t.amount), ',' order by t.tender_type)
         from sale_refund r join sale_refund_tender t on t.refund_id = r.id
         left join payment_method m on m.id = t.payment_method_id where r.sales_order_id = '${splitSale}'`) ===
    `card ${espresso - fibPart},other FIB ${fibPart}`,
  "the database gave FIB back its part, and the card its",
);
const fibHolds = espresso;
check(
  balance("1030") === fibHolds,
  `FIB's account holds ${iqd(fibHolds)}: what it took, less what it gave back`,
);

// ------------------------------------------------------------ Sales: money moved
console.log("▸ on Sales the owner moves FIB's money to the bank, less its fee, and cancels it");
const fee = 100;
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/sales");
  const panel = page.getByTestId("ways-to-pay-panel");
  const fibTile = panel.getByTestId("money-tile").filter({ hasText: "FIB" });
  check(
    (await fibTile.textContent()).includes(iqd(fibHolds)),
    `FIB's tile shows what its account holds: ${iqd(fibHolds)}`,
  );
  await panel.getByLabel("Money from").selectOption("1030");
  await panel.getByLabel("Money to").selectOption("1020");
  await panel.getByLabel("What arrived").fill(String(fibHolds - fee));
  await panel.getByLabel("Fee kept").fill(String(fee));
  await panel.getByTestId("move-money-go").click();
  await panel
    .getByText(`Moved ${iqd(fibHolds - fee)} from FIB to the bank (journal`)
    .waitFor({ timeout: 10000 });
  check(true, "the move is recorded, with its journal");
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="money-moves"] tbody tr').length === 1,
  );
  check(
    (await panel.getByTestId("money-moves").textContent()).includes("FIB → the bank"),
    "and listed: FIB to the bank",
  );
  await ctx.close();
}
check(
  balance("1030") === 0 && balance("6500") >= fee,
  "FIB's account is empty; the fee went to card and bank fees",
);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/sales");
  const moves = page.getByTestId("money-moves");
  await moves.getByRole("button", { name: "Cancel" }).click();
  await moves.getByLabel("Why it is cancelled").fill("Typed the wrong amount");
  await moves.getByRole("button", { name: "Cancel the move" }).click();
  await page
    .getByText("The move is cancelled: its journal is reversed today.")
    .waitFor({ timeout: 10000 });
  check(true, "the move is cancelled, with why");
  await ctx.close();
}
check(balance("1030") === fibHolds, "FIB's account has its money back");

// ------------------------------------------------------------ Reports and the end of the day
console.log("▸ Reports and the end of the day list FIB");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const byWay = page.getByTestId("payments-by-way");
  const fibLine = byWay.getByTestId("payments-way").filter({ hasText: "FIB" });
  check(
    (await fibLine.textContent()).includes(iqd(espresso + fibPart)),
    `Reports lists FIB with what it took today: ${iqd(espresso + fibPart)}`,
  );
  await open(page, "/end-of-day");
  check(
    (await page.locator("body").textContent()).includes(
      `FIB today: ${iqd(fibHolds)} from 2 sales.`,
    ),
    "the end of the day says what FIB took, to check against its app",
  );
  await ctx.close();
}

// ------------------------------------------------------------ out of use
console.log("▸ taken out of use: the till offers cash and the card again");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  const card = page.getByTestId("settings-pay-methods");
  for (const name of ["FIB", "FastPay"]) {
    const row = card.getByTestId("pay-method-row").filter({ hasText: name });
    await row.getByTestId("pay-method-toggle").click();
    await card
      .getByText(
        `${name} is out of use: no longer offered at the till. Its account keeps what it holds.`,
      )
      .waitFor({ timeout: 10000 });
  }
  check(true, "FIB and FastPay are taken out of use");
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await ring(page, 1);
  check(
    (await page.getByTestId("pay-methods-row").count()) === 0,
    "the till shows no way to pay but cash and the card",
  );
  await ctx.close();
}
check(balance("1030") === fibHolds, "and FIB's account keeps what it holds");

await browser.close();
done("Ways to pay");
