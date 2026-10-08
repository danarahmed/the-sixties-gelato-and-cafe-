// The menu matrix (round eleven), through the real screens: Reports leads to
// it; each product sold in the four weeks to today is in the group the sales
// analysis puts it in — sells a lot from 70% of an even share, earns well from
// the menu's average after cost — and a product that sells a lot but earns
// little says by how much to raise its price; three months, and a category,
// read the same way; the cashier is not shown it; and it speaks Arabic and
// Kurdish.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const ESPRESSO = "d1000000-0000-0000-0000-000000000001";
const WATER = "d1000000-0000-0000-0000-000000000002";

console.log("▸ sales of their own: many espressos, a few bottles of water");
sql(`select test.act_as('cashier@example.com');
     select record_sale(gen_random_uuid(), 'dine_in', 'card',
       '[{"variant_id": "${ESPRESSO}", "qty": 12}, {"variant_id": "${WATER}", "qty": 2}]'::jsonb)`);

/** What the matrix should say, from the sales analysis by product, by the page's rules. */
function expected(days, category = null) {
  const rows = JSON.parse(
    last(`select test.act_as('owner@example.com');
      select coalesce(jsonb_agg(jsonb_build_object('key', r->>'key', 'qty', (r->>'qty')::numeric,
                     'cost', (r->>'cost')::numeric, 'margin', (r->>'margin_kept')::numeric)), '[]')
        from jsonb_array_elements(report_sales_analysis(${TODAY} - ${days - 1}, ${TODAY}, 'product',
               null, null, null, ${category ? `'${category}'` : "null"}, null) -> 'rows') r`),
  );
  const counted = rows.filter((r) => r.qty > 0 && r.cost > 0);
  const total = counted.reduce((n, r) => n + r.qty, 0);
  const average = counted.reduce((n, r) => n + r.margin, 0) / total;
  const popular = (0.7 * total) / counted.length;
  return Object.fromEntries(
    counted.map((r) => {
      const each = r.margin / r.qty;
      const lot = r.qty >= popular;
      const well = each >= average;
      const group = lot ? (well ? "keep" : "raise") : well ? "promote" : "rethink";
      return [r.key, { group, raise: Math.ceil((average - each) / 250) * 250 }];
    }),
  );
}

/** The products on screen, with their group, and the raise of each to raise. */
async function onScreen(page) {
  return page
    .getByTestId("matrix-group")
    .evaluateAll((groups) =>
      Object.fromEntries(
        groups.flatMap((g) =>
          [...g.querySelectorAll('[data-testid="matrix-item"]')].map((r) => [
            r.dataset.key,
            { group: g.dataset.group, raise: r.dataset.raise ? Number(r.dataset.raise) : null },
          ]),
        ),
      ),
    );
}

function same(shown, want) {
  const keys = Object.keys(want);
  return (
    keys.length === Object.keys(shown).length &&
    keys.every(
      (k) =>
        shown[k]?.group === want[k].group &&
        (want[k].group !== "raise" || shown[k].raise === want[k].raise),
    )
  );
}

console.log("▸ Reports leads to the matrix; each product in its group");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  await page.getByTestId("to-menu").click();
  await page.waitForURL(/\/reports\/menu/);
  await page.waitForLoadState("networkidle");
  const want = expected(28);
  const shown = await onScreen(page);
  check(
    Object.keys(want).length >= 2 && same(shown, want),
    `four weeks: ${Object.keys(want).length} products, each where the sales analysis puts it ` +
      `(${Object.values(shown)
        .map((s) => s.group)
        .join(", ")})`,
  );
  check(
    (await page.getByTestId("matrix-point").count()) === Object.keys(want).length,
    "a mark on the chart for each",
  );
  check(
    /70% of an even share/.test(await page.getByTestId("matrix-how").textContent()),
    "and how the groups are cut, in words",
  );

  await open(page, "/reports/menu?days=91");
  check(same(await onScreen(page), expected(91)), "three months, read the same way");

  const category = last(`select category_id from product
                          where id = 'd0000000-0000-0000-0000-000000000001'`);
  if (category) {
    await open(page, `/reports/menu?days=28&category=${category}`);
    const want = expected(28, category);
    const shown = await onScreen(page);
    check(
      Object.keys(want).length < 2
        ? (await page.getByTestId("matrix-group").count()) === 0
        : same(shown, want),
      "one category, compared within itself",
    );
  }
  await ctx.close();
}

console.log("▸ the cashier is not shown it");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await page.goto(BASE + "/reports/menu");
  await page.waitForLoadState("networkidle");
  check((await page.getByTestId("matrix-group").count()) === 0, "no matrix for the cashier");
  await ctx.close();
}

console.log("▸ the matrix in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/reports/menu");
  const words = await english(page, "/reports/menu");
  check(
    words.length === 0,
    `in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("menumatrix");
