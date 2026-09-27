// Refunds by the item (0037, release L), on the Orders screen: some of a
// sale's items given back, what each gives back shown before anything is
// refunded, more than is left refused, the refund's slip printed, the sale
// part-refunded and then refunded whole; a card sale's money goes back to the
// card. The drawer is open (the fixtures', or one a suite before left open).
// Prices are read from each sale, since earlier suites change them.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
/** A sale rung up on the till, as the tests' own shortcut. */
const sell = (tender, lines) =>
  last(`select test.act_as('cashier@example.com');
        select record_sale(gen_random_uuid(), 'dine_in', '${tender}', '${JSON.stringify(lines)}') ->> 'order_id'`);
const E = "d1000000-0000-0000-0000-000000000001";
const W = "d1000000-0000-0000-0000-000000000002";
/** What a line of the sale was sold for, after the bill's discount. */
const net = (sale, variant) =>
  Number(
    sql(`select trim_scale(line_net) from sales_order_line
          where sales_order_id = '${sale}' and product_variant_id = '${variant}'`),
  );
/** As the screen shows money: 12,345 IQD. */
const iqd = (n) => `${n.toLocaleString("en-US")} IQD`;
const water = () =>
  Number(
    sql(`select (item_position('00000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000003',
                  default_location('00000000-0000-0000-0000-0000000000b1'))).qty`),
  );
/** Printing is counted, not sent to a printer; each job's slips are kept to be read. */
async function manager() {
  const s = await signIn(browser, "manager");
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
const row = (page, sale) => page.locator("tbody tr", { hasText: sale.slice(0, 8) });

// ------------------------------------------------------------ some of it
console.log("▸ a manager gives back one espresso and one water of a sale of five");
const sale = sell("cash", [
  { variant_id: E, qty: 3 },
  { variant_id: W, qty: 2 },
]);
// Whole dinars each (a line's net divides by its count here: no bill discount).
const espresso = net(sale, E) / 3;
const bottle = net(sale, W) / 2;
const all = 3 * espresso + 2 * bottle;
const some = espresso + bottle;
const waterBefore = water();
{
  const { ctx, page } = await manager();
  await open(page, "/orders");
  await row(page, sale).getByRole("button", { name: "Refund" }).click();
  const dialog = page.getByTestId("refund-dialog");
  const total = dialog.getByTestId("refund-total");
  check(
    (await total.textContent()).includes(`Gives back ${iqd(all)} in cash, from the drawer`),
    `it starts from all that is left: ${iqd(all)}, back in cash from the drawer`,
  );
  await dialog.getByLabel("How many of Golden espresso — Single go back").fill("5");
  check(
    /Only 3 of Golden espresso — Single is left to refund/.test(await total.textContent()) &&
      (await dialog.getByRole("button", { name: "Confirm refund" }).isDisabled()),
    "not more than was sold: only 3 are left",
  );
  await dialog.getByLabel("How many of Golden espresso — Single go back").fill("1");
  await dialog.getByLabel("How many of Golden water — Bottle go back").fill("1");
  check(
    (await total.textContent()).includes(`Gives back ${iqd(some)}`),
    `one of each gives back ${iqd(some)}: ${iqd(espresso)} and ${iqd(bottle)}`,
  );
  check(
    await dialog.getByRole("button", { name: "Confirm refund" }).isDisabled(),
    "and waits for its reason",
  );
  await dialog.getByLabel("Why refund it?").selectOption("changed_mind");
  await dialog.getByRole("button", { name: "Confirm refund" }).click();
  const answer = dialog.getByTestId("refund-answer");
  await answer.waitFor({ timeout: 10000 });
  const said = await answer.textContent();
  const no = sql(`select refund_no from sale_refund where sales_order_id = '${sale}'`);
  check(
    said.includes(`Refund ${no}: ${iqd(some)} given back in cash, from the drawer (journal `) &&
      said.includes("The rest of the sale can still be refunded."),
    `refund ${no}: ${iqd(some)} back in cash; the rest can still be refunded`,
  );
  await dialog.getByRole("button", { name: /Print the refund slip/ }).click();
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  const slip = await page.evaluate(() => window.__slips[0][0]);
  check(
    /REFUND/.test(slip) &&
      /Refund \d+/.test(slip) &&
      new RegExp(`Given back\\s*${some.toLocaleString("en-US")}`).test(slip) &&
      /Customer changed their mind/.test(slip),
    `its slip prints: REFUND, the refund's number, ${iqd(some)} given back, and why`,
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await open(page, "/orders");
  const r = row(page, sale);
  const text = await r.textContent();
  check(
    text.includes("Part-refunded") &&
      text.includes(
        `Refund ${no}: ${iqd(some)} for Golden espresso — Single ×1, Golden water — Bottle ×1`,
      ),
    "Orders shows the sale part-refunded, and what went back",
  );
  check(
    (await r.getByRole("button", { name: "Void" }).count()) === 0,
    "a sale part-refunded is not voided",
  );
  await ctx.close();
}
check(
  sql(`select status || ' ' || (select trim_scale(sum(amount)) from sale_refund where sales_order_id = o.id)
         from sales_order o where id = '${sale}'`) === `partially_refunded ${some}`,
  `the database has it part-refunded, ${iqd(some)} given back`,
);
check(water() === waterBefore + 1, "the bottle is back on the shelf");

// ------------------------------------------------------------ the rest of it
console.log("▸ the rest of it, whole");
{
  const { ctx, page } = await manager();
  await open(page, "/orders");
  await row(page, sale).getByRole("button", { name: "Refund" }).click();
  const dialog = page.getByTestId("refund-dialog");
  check(
    (await dialog.getByTestId("refund-total").textContent()).includes(
      `Gives back ${iqd(all - some)}`,
    ),
    `what is left: two espressos and a water, ${iqd(all - some)}`,
  );
  await dialog.getByLabel("Why refund it?").selectOption("quality");
  await dialog.getByRole("button", { name: "Confirm refund" }).click();
  const answer = dialog.getByTestId("refund-answer");
  await answer.waitFor({ timeout: 10000 });
  // The answer stays though the sale, refunded whole, now offers nothing.
  await row(page, sale)
    .locator(".badge", { hasText: /^Refunded$/ })
    .waitFor({ timeout: 10000 });
  check(
    (await answer.isVisible()) &&
      /Nothing of the sale is left to refund\./.test(await answer.textContent()),
    "nothing of the sale is left to refund, and the answer stays until it is closed",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await open(page, "/orders");
  const r = row(page, sale);
  check(
    (await r.textContent()).includes("Refunded") &&
      (await r.getByRole("button", { name: "Refund" }).count()) === 0,
    "refunded: no more to give back",
  );
  await ctx.close();
}
check(
  sql(`select status || ' ' || (select trim_scale(sum(amount)) || '/' || count(*) from sale_refund
                                  where sales_order_id = o.id) from sales_order o where id = '${sale}'`) ===
    `refunded ${all}/2`,
  `two refunds add up to the sale, ${iqd(all)}`,
);
check(water() === waterBefore + 2, "both bottles are back on the shelf");

// ------------------------------------------------------------ a card sale
console.log("▸ a card sale's money goes back to the card");
const card = sell("card", [{ variant_id: E, qty: 2 }]);
const one = net(card, E) / 2;
{
  const { ctx, page } = await manager();
  await open(page, "/orders");
  await row(page, card).getByRole("button", { name: "Refund" }).click();
  const dialog = page.getByTestId("refund-dialog");
  await dialog.getByLabel("How many of Golden espresso — Single go back").fill("1");
  check(
    (await dialog.getByTestId("refund-total").textContent()).includes(
      `Gives back ${iqd(one)} to the card it was paid with`,
    ),
    `one of two: ${iqd(one)}, to the card it was paid with`,
  );
  await dialog.getByLabel("Why refund it?").selectOption("wrong_order");
  await dialog.getByRole("button", { name: "Confirm refund" }).click();
  await dialog.getByTestId("refund-answer").waitFor({ timeout: 10000 });
  await ctx.close();
}
check(
  sql(`select string_agg(t.tender_type::text || ' ' || trim_scale(t.amount), ',')
         from sale_refund r join sale_refund_tender t on t.refund_id = r.id where r.sales_order_id = '${card}'`) ===
    `card ${one}`,
  `the refund went back to the card: ${iqd(one)}`,
);
check(
  sql(`select count(*) from cash_event e join sale_refund r on r.id = e.reference_id
        where r.sales_order_id = '${card}'`) === "0",
  "and nothing left the drawer",
);

// ------------------------------------------------------------ on a phone
{
  const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
  await open(page, "/orders");
  await row(page, card).getByRole("button", { name: "Refund" }).click();
  await page.getByTestId("refund-dialog").waitFor({ timeout: 10000 });
  const over = await page.evaluate(() => {
    const d = document.querySelector("[data-testid=refund-dialog]");
    return Math.max(0, d.getBoundingClientRect().right - window.innerWidth);
  });
  check(over <= 1, `the refund fits a phone (${over}px over)`);
  await ctx.close();
}

await browser.close();
done("refunds");
