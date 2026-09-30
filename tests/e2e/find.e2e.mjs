// Find a sale on Orders (the September audit's P2-20, "hard to find things"),
// through the real screen: the owner finds a sale by the number its receipt
// prints after "Sale", by its journal, by a refund's number and the refund's
// journal; a Talabat sale by its order number, whatever its capitals; a
// customer's sale by part of their name and by their phone typed another way.
// A search that names nothing says so and shows no sale; in Arabic and
// Kurdish, no English but the café's own names.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const E = "d1000000-0000-0000-0000-000000000001";
/** A sale rung up on the till, as the tests' own shortcut: its id. */
const sell = (channel, tender, qty, extra = "") =>
  last(`select test.act_as('cashier@example.com');
        select record_sale(gen_random_uuid(), '${channel}', '${tender}',
                           '[{"variant_id":"${E}","qty":${qty}}]'${extra}) ->> 'order_id'`);

// A cash sale of two espressos, one of them refunded.
const cash = sell("dine_in", "cash", 2);
const line = last(`select id from sales_order_line where sales_order_id = '${cash}'`);
sql(`select test.act_as('manager@example.com');
     select refund_sale_lines('${cash}', '[{"line_id":"${line}","qty":1}]', 'changed_mind')`);
const refundNo = last(`select refund_no from sale_refund where sales_order_id = '${cash}'`);
const saleJournal = last(`select journal_no from journal_entry
                           where reference_type = 'sales_order' and reference_id = '${cash}'
                           order by journal_no limit 1`);
const refundJournal = last(`select e.journal_no from journal_entry e
                              join sale_refund r on r.id = e.reference_id
                             where e.reference_type = 'sale_refund' and r.sales_order_id = '${cash}'`);
// A Talabat order, by the number its tablet shows.
const talabat = sell("talabat", "platform_paid", 1, `, p_platform_order_no => 'TB-FIND-77'`);
// A customer's sale, taken away.
sql(`select test.act_as('owner@example.com');
     select save_customer(null, 'Shilan Findtest', '0750 555 0199')`);
const customer = last(`select id from customer where phone = '+9647505550199'`);
const theirs = sell("takeaway", "cash", 1, `, p_customer => '${customer}'`);

const short = (id) => id.slice(0, 8);
/** The sales Orders shows for a search: the number each receipt prints after "Sale". */
async function find(page, q) {
  await open(page, `/orders?q=${encodeURIComponent(q)}`);
  return page.getByTestId("sale-no").allTextContents();
}

console.log("▸ the owner finds a sale by what its receipt and its refund print");
{
  const { ctx, page } = await signIn(browser, "owner");
  let got = await find(page, short(cash).toUpperCase());
  check(
    got.length === 1 && got[0] === short(cash),
    `by the number after "Sale" on the receipt, in capitals too: that sale alone (${got.join(", ")})`,
  );
  check(
    (await page.getByTestId("find-sale").inputValue()) === short(cash).toUpperCase(),
    "the search stays in its box",
  );
  got = await find(page, saleJournal);
  check(got.includes(short(cash)), `by its journal, ${saleJournal}`);
  got = await find(page, refundJournal);
  check(got.includes(short(cash)), `by its refund's journal, ${refundJournal}`);
  got = await find(page, refundNo);
  check(got.includes(short(cash)), `by the refund's own number, ${refundNo}`);
  check(
    (await page.locator("tbody tr", { hasText: short(cash) }).textContent())?.includes(
      `Refund ${refundNo}`,
    ),
    "and the sale found shows its refund",
  );

  console.log("▸ a platform's order, and a customer's sale");
  got = await find(page, "tb-find-77");
  check(
    got.length === 1 && got[0] === short(talabat),
    "the Talabat order by its number, whatever its capitals",
  );
  got = await find(page, "findtest");
  check(got.length === 1 && got[0] === short(theirs), "the customer's sale by part of their name");
  got = await find(page, "+964 750 555 0199");
  check(got.length === 1 && got[0] === short(theirs), "and by their phone, typed another way");

  console.log("▸ a search that names no sale says so");
  got = await find(page, "no-such-sale-99");
  check(
    got.length === 0 && (await page.getByText("No sale matches “no-such-sale-99”").isVisible()),
    "no sale shown, and what to type instead",
  );
  await open(page, "/orders");
  check(
    (await page.getByTestId("sale-no").count()) >= 3,
    "the latest sales again, once the search is cleared",
  );
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const got = await find(page, short(cash));
  const words = await english(page, "/orders");
  // Nothing found: digits, since what was typed is shown back as it was.
  await open(page, "/orders?q=99999998");
  words.push(...(await english(page, "/orders")));
  check(
    got.length === 1 && words.length === 0,
    `in ${locale}, the sale found, and no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("find");
