// Finding things (the September audit's P2-20, "hard to find things"),
// through the real screens. On Orders, the owner finds a sale by the number
// its receipt prints after "Sale", by its journal, by a refund's number and
// the refund's journal; a Talabat sale by its order number, whatever its
// capitals; a customer's sale by part of their name and by their phone typed
// another way. On Products & Recipes, a product by part of its name, in
// capitals or not, and by its Arabic and Kurdish names. On Journals, a journal
// by its number and by words in it. A search that names nothing says so; in
// Arabic and Kurdish, no English but the café's own names.
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

// The espresso's names in Arabic and Kurdish, as the owner would give them.
sql(`update product set name_ar = 'إسبريسو ذهبي', name_ckb = 'ئێسپرێسۆی زێڕین'
      where id = 'd0000000-0000-0000-0000-000000000001'`);

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

console.log("▸ a product on Products & Recipes, and a journal on Journals");
{
  const { ctx, page } = await signIn(browser, "manager");
  const products = async (q) => {
    await open(page, `/products?q=${encodeURIComponent(q)}`);
    return page
      .getByTestId("product-card")
      .evaluateAll((cards) => cards.map((c) => c.getAttribute("data-name")));
  };
  let names = await products("GOLDEN WAT");
  check(
    names.length === 1 && names[0] === "Golden water",
    `a product by part of its name, in capitals (${names.join(", ")})`,
  );
  names = await products("water");
  check(
    names.includes("Golden water") && names.includes("Bottled Water"),
    `every product whose name has it (${names.join(", ")})`,
  );
  names = await products("ذهبي");
  check(names.length === 1 && names[0] === "Golden espresso", "by its Arabic name");
  names = await products("زێڕین");
  check(names.length === 1 && names[0] === "Golden espresso", "and by its Kurdish name");
  names = await products("إسبريسو");
  check(
    names.includes("Golden espresso") && names.includes("Espresso"),
    `in Arabic, every product whose Arabic name has it (${names.join(", ")})`,
  );
  names = await products("no-such-product");
  check(
    names.length === 0 &&
      (await page.getByText("No product matches “no-such-product”").isVisible()),
    "a search that names no product says so",
  );

  const journals = async (q) => {
    await open(page, `/journals?q=${encodeURIComponent(q)}`);
    return page
      .getByTestId("journal-row")
      .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-no")));
  };
  let nos = await journals(saleJournal);
  check(nos.length === 1 && nos[0] === saleJournal, `a journal by its number, ${saleJournal}`);
  nos = await journals(short(cash));
  check(
    nos.includes(saleJournal) && nos.includes(refundJournal),
    `by words in it: the sale's and its refund's journals name the sale (${nos.join(", ")})`,
  );
  nos = await journals("no-such-journal");
  check(
    nos.length === 0 && (await page.getByText("No journal matches “no-such-journal”").isVisible()),
    "a search that names no journal says so",
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
  for (const path of [
    "/products?q=99999998",
    `/journals?q=${saleJournal}`,
    "/journals?q=99999998",
  ]) {
    await open(page, path);
    words.push(...(await english(page, path.split("?")[0])));
  }
  check(
    got.length === 1 && words.length === 0,
    `in ${locale}, the sale found, and no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ Orders' days: today, yesterday and the last seven, a tap each");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/orders");
  const days = page.getByTestId("orders-days");
  await days.getByRole("link", { name: "Today", exact: true }).click();
  await page.waitForURL(/\/orders\?from=/);
  const [today, sold] = sql(
    `select (now() at time zone 'Asia/Baghdad')::date || ' ' || count(*)
       from sales_order
      where status in ('completed', 'partially_refunded')
        and (placed_at at time zone 'Asia/Baghdad')::date = (now() at time zone 'Asia/Baghdad')::date`,
  ).split(" ");
  const url = new URL(page.url());
  const tile = await page.locator(".card.stat .value").first().textContent();
  check(
    url.searchParams.get("from") === today &&
      url.searchParams.get("to") === today &&
      Number(tile) === Number(sold) &&
      (await days
        .getByRole("link", { name: "Today", exact: true })
        .getAttribute("aria-current")) === "true",
    `Today opens today's ${sold} completed sales, and is marked as chosen`,
  );
  await days.getByRole("link", { name: "Last 7 days" }).click();
  await page.waitForURL((u) => u.searchParams.get("from") !== today);
  check(new URL(page.url()).searchParams.get("to") === today, "the last seven days end today");
  await ctx.close();
}

await browser.close();
done("find");
