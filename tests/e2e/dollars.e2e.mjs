// US dollars at the till (0043, release R), through the real screens. A
// manager sets today's rate on Sales → Dollars, with where it comes from. At
// the till two espressos are paid in dollars: the dialog suggests the fewest
// that pay, values them at the rate to the nearest 250, and gives the change
// in dinars; the receipt shows the dollars and their value. The rate changes
// while the till is open: the payment is refused, the till reads the new rate,
// and the payment goes through at it. Dollars worth less than the total pay
// what they are worth, the rest by card. The drawer's close counts the dollars
// too, blind, and they go to the safe; the owner exchanges them for dinars
// into the bank, the gain to 6950. Reports → Dollars, and the rules on
// Settings. The drawer is open (the fixtures', or one a suite before left
// open), and is left open. Prices are read from the database: earlier suites
// change them.
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
/** What dollars are worth at a rate, as the database counts them (usd_value). */
const worth = (usd, rate) => Number(last(`select trim_scale(usd_value('${B}', ${usd}, ${rate}))`));
/** What the drawer holds in dinars: the tests' own view, as counting it would find. */
const holds = () =>
  Number(
    sql(`select d.carry + d.moved from location l cross join lateral drawer_position(l.business_id, l.id) d
          where l.business_id = '${B}' and l.kind = 'branch'`),
  );
/** The dollars a place holds and their value: "7 9250". */
const held = (place) =>
  last(`select trim_scale(h.usd) || ' ' || trim_scale(h.value)
          from fx_place_balance('${B}', '${place}', default_location('${B}')) h`);
const openSession = () =>
  sql(`select session_no || ' ' || (select full_name from app_user where id = cashier_id)
         from work_shift where kind = 'session' and closed_at is null and business_id = '${B}'`);
/** Each check's difference from its account (earlier suites leave some, on purpose). */
const differences = () =>
  last(`select test.act_as('owner@example.com');
        select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
          from report_reconciliation(${TODAY})`);
const differencesBefore = differences();

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

/** Two espressos (or one) in a quick sale at the till, and the payment dialog in dollars. */
async function sellInDollars(page, qty) {
  await open(page, "/pos");
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: "Dine-in", exact: true }).click();
  const tile = page.locator(".product-tile", { hasText: "Golden espresso" });
  for (let i = 0; i < qty; i++) await tile.click();
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.getByTestId("pay-usd").click();
  return page.getByTestId("usd-box");
}

// The drawer is the cashier's, open, with dinars in it for the change.
const other = sql(`select w.id from work_shift w join app_user u on u.id = w.cashier_id
                    where w.kind = 'session' and w.closed_at is null and w.business_id = '${B}'
                      and u.email <> 'cashier@example.com'`);
if (other !== "") {
  sql(`select test.act_as('owner@example.com');
       select close_cash_session(${holds()}, null, null, null, '${other}')`);
}
if (openSession() === "") {
  sql(`select test.act_as('cashier@example.com'); select open_cash_session(${holds()})`);
}
sql(`select test.act_as('cashier@example.com');
     select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id": "${E}", "qty": 4}]')`);

// ------------------------------------------------------------ the rate
console.log("▸ the manager sets today's rate on Sales → Dollars");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales");
  const panel = page.getByTestId("dollars-panel");
  check(
    (await panel.getByTestId("fx-rate").textContent()).includes(
      "No dollar rate is set: dollars are not taken",
    ),
    "no rate yet: dollars are not taken",
  );
  await panel.getByLabel("Dinars a dollar").fill("1310");
  await panel.getByLabel("Where it comes from").fill("The exchange office's rate this morning");
  await panel.getByRole("button", { name: "Set the rate" }).click();
  await panel.getByText("The rate is 1,310 dinars a dollar.").waitFor({ timeout: 10000 });
  // The panel reads the rate again once it is set.
  await panel
    .getByTestId("fx-rate")
    .filter({ hasText: "1,310 dinars a dollar" })
    .waitFor({ timeout: 10000 });
  const shown = await panel.getByTestId("fx-rate").textContent();
  check(
    shown.includes("1,310 dinars a dollar") &&
      shown.includes("by Demo Manager: The exchange office's rate this morning"),
    "the rate, who set it and where it comes from",
  );
  await ctx.close();
}
check(
  last(`select trim_scale(rate) || ' ' || reason from fx_rate order by created_at desc limit 1`) ===
    "1310 The exchange office's rate this morning",
  "the database keeps the rate with its reason",
);

// ------------------------------------------------------------ at the till
console.log("▸ at the till: two espressos paid in dollars, the change in dinars");
const espresso = price(E);
const total = 2 * espresso;
let usd = 1;
while (worth(usd, 1310) < total) usd++;
const value = worth(usd, 1310);
let sale;
{
  const { ctx, page } = await withPrinter("cashier");
  const box = await sellInDollars(page, 2);
  check(
    (await box.locator('label[for="usd-received"]').textContent()).includes(
      "1,310 dinars a dollar",
    ),
    "the dialog shows today's rate",
  );
  check(
    (await page.locator("#usd-received").getAttribute("placeholder")) === `$${usd}`,
    `it suggests $${usd}, the fewest dollars that pay ${iqd(total)}`,
  );
  await page.locator("#usd-received").fill(String(usd));
  check(
    (await box.getByTestId("usd-value").textContent()) === `$${usd} are ${iqd(value)}`,
    `$${usd} at 1,310 are ${iqd(value)}, to the nearest 250`,
  );
  check(
    (await box.getByTestId("usd-change").textContent()).includes(iqd(value - total)),
    `the change, ${iqd(value - total)}, in dinars`,
  );
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  const badges = await page.getByTestId("receipt-payments").locator(".badge").allTextContents();
  check(
    badges.join(" | ") === `$${usd} at 1,310 = ${iqd(value)}`,
    "the receipt card shows the dollars, the rate and their value",
  );
  check(
    (await page.locator(".receipt-card .change-amt").textContent()) === iqd(value - total),
    "and the change the database recorded",
  );
  await page.getByRole("button", { name: /Print receipt/ }).click();
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  const receipt = await page.evaluate(() => window.__slips[0][0]);
  check(
    new RegExp(`Dollars \\$${usd} at 1,310\\s*${value.toLocaleString("en-US")}`).test(receipt) &&
      (value === total ||
        new RegExp(`Change\\s*${(value - total).toLocaleString("en-US")}`).test(receipt)),
    "the printed receipt lists the dollars, their value and the change",
  );
  await ctx.close();
}
sale = last(`select id from sales_order order by created_at desc limit 1`);
check(
  last(`select currency || ' ' || trim_scale(foreign_amount) || ' at ' || trim_scale(rate) || ' = '
               || trim_scale(received) || ', change ' || trim_scale(change_given)
          from sales_tender where sales_order_id = '${sale}'`) ===
    `USD ${usd} at 1310 = ${value}, change ${value - total}`,
  "the database keeps the dollars, the rate, their value and the change",
);
check(
  sql(`select string_agg(place || ' ' || kind || ' ' || trim_scale(usd) || ' ' || trim_scale(value), ',')
         from fx_cash_event where reference_id = '${sale}'`) === `till sale ${usd} ${value}`,
  "the till's dollars take them, at their value",
);
check(
  (sql(`select string_agg(kind || ' ' || trim_scale(amount), ',') from cash_event
         where reference_id = '${sale}'`) || "none") ===
    (value > total ? `sale -${value - total}` : "none"),
  "the drawer gives the change in dinars",
);

// ------------------------------------------------------------ the rate changes
console.log("▸ the rate changes while the till is open: refused, then taken at the new rate");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await sellInDollars(page, 1);
  sql(`select test.act_as('manager@example.com');
       select set_fx_rate('USD', 1320, 'The exchange office, this afternoon')`);
  await page.locator("#usd-received").fill("5");
  await page.locator(".pay-confirm").click();
  const err = page.locator(".pay-modal .badge.err");
  await err.waitFor({ timeout: 10000 });
  check(
    (await err.textContent()).includes(
      "The dollar rate is now 1320, not the 1310 shown: take the payment again",
    ),
    "the payment is refused: the rate changed since the till read it",
  );
  await page
    .locator('label[for="usd-received"]', { hasText: "1,320 dinars a dollar" })
    .waitFor({ timeout: 10000 });
  check(true, "the till reads the new rate: 1,320");
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  await ctx.close();
}
check(
  last(`select trim_scale(t.rate) || ' ' || trim_scale(t.received) from sales_tender t
          join sales_order o on o.id = t.sales_order_id order by o.created_at desc limit 1`) ===
    `1320 ${worth(5, 1320)}`,
  `taken at the new rate: $5 are ${iqd(worth(5, 1320))}`,
);

// ------------------------------------------------------------ worth less than the total
console.log("▸ dollars worth less than the total: the rest by card");
{
  const two = worth(2, 1320);
  const { ctx, page } = await signIn(browser, "cashier");
  const box = await sellInDollars(page, 2);
  await page.locator("#usd-received").fill("2");
  check(
    (await box.getByTestId("usd-rest").textContent()) === `The other ${iqd(total - two)} is paid`,
    `$2 are ${iqd(two)}: the other ${iqd(total - two)} is paid another way`,
  );
  await box.getByRole("radio", { name: /Card/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  const badges = await page.getByTestId("receipt-payments").locator(".badge").allTextContents();
  check(
    badges.join(" | ") === `$2 at 1,320 = ${iqd(two)} | Card ${iqd(total - two)}`,
    "the receipt card shows the dollars and the card",
  );
  await ctx.close();
}

// ------------------------------------------------------------ the close
console.log("▸ the cashier closes the drawer: the dollars are counted too, and go to the safe");
const [tillUsd, tillValue] = held("till").split(" ").map(Number);
const [safeBefore] = held("safe").split(" ").map(Number);
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByTestId("drawer-button").click();
  const drawer = page.getByTestId("drawer-panel");
  await drawer.getByRole("button", { name: "Close the drawer" }).click();
  check(
    await drawer.getByTestId("usd-count").isVisible(),
    "the till took dollars: the close asks for them too",
  );
  await drawer.getByLabel("Cash counted", { exact: true }).fill(String(holds()));
  check(
    await drawer.getByRole("button", { name: "Close the drawer" }).isDisabled(),
    "and waits for them to be counted",
  );
  await drawer.getByLabel("Dollars counted", { exact: true }).fill(String(tillUsd));
  await drawer.getByRole("button", { name: "Close the drawer" }).click();
  const answer = drawer.getByTestId("drawer-answer");
  await answer.waitFor({ timeout: 10000 });
  const said = await answer.textContent();
  check(
    said.includes(
      `Dollars: it should have held $${tillUsd}; counted $${tillUsd}: it agrees exactly.`,
    ) && said.includes(`$${tillUsd} to the safe, at ${iqd(tillValue)}.`),
    `counted blind: $${tillUsd}, as the till should hold, all to the safe at ${iqd(tillValue)}`,
  );
  await ctx.close();
}
check(
  held("till") === "0 0" && held("safe") === `${safeBefore + tillUsd} ${tillValue}`,
  "the till holds no dollars; the safe holds them, at what they were taken at",
);

// ------------------------------------------------------------ an exchange
console.log("▸ the owner exchanges the safe's dollars for dinars, into the bank");
const [safeUsd, safeValue] = held("safe").split(" ").map(Number);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/sales");
  const panel = page.getByTestId("dollars-panel");
  check(
    (await panel.getByTestId("fx-held").textContent()).includes(
      `The safe: $${safeUsd} (taken at ${iqd(safeValue)})`,
    ),
    "Sales shows what the safe holds, and what it was taken at",
  );
  const form = panel.getByTestId("fx-exchange");
  await form.getByLabel("Dollars exchanged").fill(String(safeUsd));
  await form.getByLabel("Dinars received").fill(String(safeValue + 500));
  await form.getByLabel("Dinars into").selectOption("bank");
  await form.getByRole("button", { name: "Exchange" }).click();
  const answer = form.getByText(/exchanged for/);
  await answer.waitFor({ timeout: 10000 });
  check(
    (await answer.textContent()).includes(
      `$${safeUsd} exchanged for ${iqd(safeValue + 500)}: they were taken at ${iqd(safeValue)}. A gain of 500 IQD (6950 Exchange differences, journal `,
    ),
    "the answer: exchanged, what they were taken at, and the gain",
  );
  await ctx.close();
}
const exchange = last(`select id from fx_exchange order by created_at desc limit 1`);
check(
  sql(`select string_agg(a.code || case when l.debit > 0 then ' Dr ' || trim_scale(l.debit)
                                        else ' Cr ' || trim_scale(l.credit) end, ' | ' order by a.code)
         from journal_line l join journal_entry e on e.id = l.journal_entry_id
         join gl_account a on a.id = l.account_id where e.reference_id = '${exchange}'`) ===
    `1006 Cr ${safeValue} | 1020 Dr ${safeValue + 500} | 6950 Cr 500`,
  "its journal: the dollars out of the safe at their value, the dinars into the bank, the gain",
);
check(held("safe") === "0 0", "the safe holds no dollars now");

// ------------------------------------------------------------ the report and the books
console.log("▸ Reports → Dollars; the books tie");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const [sales, usdTaken, valueTaken, paid, change] = last(
    `select test.act_as('owner@example.com');
     select concat_ws('|', r -> 'taken' ->> 'sales', r -> 'taken' ->> 'usd', r -> 'taken' ->> 'value',
                      r -> 'taken' ->> 'paid', r -> 'taken' ->> 'change')
       from report_dollars(${TODAY}, ${TODAY}) r`,
  )
    .split("|")
    .map(Number);
  check(
    (await page.getByTestId("dollars-taken").textContent()) ===
      `${sales} sale(s) paid in dollars: $${usdTaken}, taken at ${iqd(valueTaken)}; they paid ${iqd(paid)}, and ${iqd(change)} went back as change in dinars.`,
    `Reports → Dollars: ${sales} sale(s), $${usdTaken}, as the database has it`,
  );
  check(
    (await page.getByTestId("dollars-exchanges").locator("tbody tr").count()) >= 1,
    "and the exchange",
  );
  await ctx.close();
}
{
  const after = differences();
  check(
    after === differencesBefore && /(^|,)dollars=0(,|$)/.test(after),
    `the books tie as they did, the dollars' check at zero (${after})`,
  );
}

// ------------------------------------------------------------ the rules
console.log("▸ Settings → Rules: how long a rate lasts, and what dollars are rounded to");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings/rules");
  const text = await page.locator("body").textContent();
  check(
    text.includes("A dollar rate is used for") &&
      text.includes("36 hours") &&
      text.includes("Dollars are counted in dinars to the nearest"),
    "the dollar's two rules, with their defaults",
  );
  await ctx.close();
}

// The drawer is left open, as it was found.
sql(`select test.act_as('cashier@example.com'); select open_cash_session(${holds()})`);

await browser.close();
done("dollars");
