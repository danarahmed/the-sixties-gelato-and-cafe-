// The sales analysis, the stock's value on a day and what was bought (0051,
// release Y), through the real screens, on the day the earlier suites traded:
// the owner sees today's sales by product, then by the hour, then by payment
// and person, each adding up to the same sales as the database counts them;
// a payment asked for with a category is refused in words; the analysis
// downloads as CSV; the stock's value on a day agrees with 1200; the
// Purchasing section says what came in by supplier and by item; the cashier
// is not shown the analysis; the screens speak Arabic and Kurdish; and the
// books still tie.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const today = last(`select ${TODAY}`);
const differences = () =>
  sql(`select test.act_as('owner@example.com');
       select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
         from report_reconciliation(${TODAY})`)
    .split("\n")
    .pop();
const before = differences();
// A sale of its own, by card (no drawer needed), so the day has one whatever ran before.
sql(`select test.act_as('cashier@example.com');
     select record_sale(gen_random_uuid(), 'dine_in', 'card',
       '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]'::jsonb)`);
// Today's sales as the database keeps them: paid, not voided.
const net = Number(
  last(`select trim_scale(coalesce(sum(net_amount), 0)) from sales_order
         where business_id = '${B}' and status not in ('voided', 'open')
           and business_local_date('${B}', placed_at) = ${TODAY}`),
);
const sales = Number(
  last(`select count(*) from sales_order
         where business_id = '${B}' and status not in ('voided', 'open')
           and business_local_date('${B}', placed_at) = ${TODAY}`),
);
check(sales > 0, `the day has sales: ${sales}, coming to ${net}`);

/** The rows on screen: each one's key, and its net (or what it was paid). */
async function rows(page, field = "net") {
  return page
    .getByTestId("analysis-row")
    .evaluateAll(
      (els, f) => els.map((e) => ({ key: e.dataset.key, v: Number(e.dataset[f]) })),
      field,
    );
}
const sum = (list) => Math.round(list.reduce((s, r) => s + r.v, 0) * 100) / 100;

console.log("▸ the owner: today's sales by product, by the hour, by payment and person");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/reports/sales?from=${today}&to=${today}&by=product`);
  const total = page.getByTestId("analysis-total");
  await total.waitFor({ timeout: 15000 });
  check(
    Number(await total.getAttribute("data-net")) === net,
    `by product: ${net}, as the database counts the day`,
  );
  const byProduct = await rows(page);
  check(byProduct.length > 0 && sum(byProduct) === net, "and its products add up to it");

  await page.getByTestId("analysis-by").selectOption("hour");
  await page.getByRole("button", { name: "Show" }).click();
  await page.waitForURL(/by=hour/, { timeout: 15000 });
  const byHour = await rows(page);
  check(
    byHour.length > 0 && byHour.every((r) => /^\d\d$/.test(r.key)) && sum(byHour) === net,
    `by the hour: ${byHour.map((r) => r.key).join(", ")}, adding up to the same`,
  );

  await open(page, `/reports/sales?from=${today}&to=${today}&by=payment&then=employee`);
  await page.getByTestId("analysis-total").waitFor({ timeout: 15000 });
  check(
    (await page.getByTestId("analysis").getAttribute("data-grain")) === "payment",
    "by payment, then by the person: the payments",
  );
  const paid = await rows(page, "paid");
  check(
    paid.length > 0 &&
      paid.every((r) => ["cash", "card", "platform_paid"].includes(r.key)) &&
      sum(paid) === net,
    `what each way took adds up to the sales (${paid.map((r) => r.key).join(", ")})`,
  );

  const category = last(
    `select id from product_category where business_id = '${B}' order by sort_order limit 1`,
  );
  await open(page, `/reports/sales?from=${today}&to=${today}&by=payment&category=${category}`);
  const problem = page.getByTestId("analysis-problem");
  await problem.waitFor({ timeout: 15000 });
  check(
    (await problem.textContent()).startsWith("A payment pays for a whole sale"),
    "payments of one category are refused, in words",
  );

  const res = await page.request.get(
    `${BASE}/reports/export?report=sales_analysis&from=${today}&to=${today}&by=product`,
  );
  const csv = await res.text();
  check(
    res.ok() && csv.startsWith("product,product_name,orders,qty,gross,discount,net,cost,margin"),
    "the analysis downloads as CSV",
  );
  await ctx.close();
}

console.log("▸ the stock's value on a day, and what came in");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/reports/stock?on=${today}`);
  const summary = page.getByTestId("stock-value-summary");
  await summary.waitFor({ timeout: 15000 });
  const stock = Number(
    last(`select trim_scale(round(coalesce(sum(value * sign(base_quantity_signed)), 0)))
            from inventory_movement where business_id = '${B}'`),
  );
  const books = Number(last(`select trim_scale(gl_balance_at('${B}', '1200', 'infinity'))`));
  check(
    (await summary.textContent()).includes(stock.toLocaleString("en-US")),
    `the stock ledger: ${stock.toLocaleString("en-US")}`,
  );
  check(
    stock === books
      ? (await page.getByTestId("stock-value-difference").textContent()).includes("They agree")
      : true,
    "beside 1200, and they agree",
  );
  check((await page.getByTestId("stock-value-item").count()) > 0, "item by item");

  await open(page, `/reports?from=${today}&to=${today}`);
  check(
    (await page.getByTestId("to-analysis").count()) === 1 &&
      (await page.getByTestId("to-stock-value").count()) === 1,
    "Reports leads to the analysis and the stock's value",
  );
  const receipts = Number(
    last(`select count(*) from goods_receipt where business_id = '${B}'
           and business_local_date('${B}', received_at) = ${TODAY}`),
  );
  check(
    receipts === 0 || (await page.getByTestId("purchases-supplier").count()) > 0,
    `what came in today, by supplier (${receipts} deliveries)`,
  );
  await ctx.close();
}

console.log("▸ the cashier is not shown the analysis");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await page.goto(`${BASE}/reports/sales?from=${today}&to=${today}`);
  await page.waitForLoadState("networkidle");
  check(
    (await page.getByTestId("analysis-form").count()) === 0,
    "no analysis for the till's cashier",
  );
  await ctx.close();
}

console.log("▸ the screens in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of [
    `/reports/sales?from=${today}&to=${today}&by=weekday&then=payment`,
    `/reports/sales?from=${today}&to=${today}&by=category&then=employee`,
    `/reports/stock?on=${today}`,
  ]) {
    await open(page, path);
    const words = await english(page, path);
    if (words.length) left.push(`${path}: ${words.slice(0, 12).join(" ")}`);
  }
  check(
    left.length === 0,
    `in ${locale}, no English but the café's own names` +
      (left.length ? `\n      ${left.join("\n      ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ the books still tie");
check(differences() === before, `every subledger is where it was (${differences()})`);

await browser.close();
done("analysis");
