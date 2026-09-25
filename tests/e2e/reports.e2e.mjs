// Every number opens what is behind it, and the reports agree (0026, the
// audit's P1-2): sales by channel, net of refunds, are the P&L's net revenue;
// a P&L line's journal lines add up to it; a trial-balance line's run from its
// opening balance to its closing one; every journal line comes as CSV; an
// item's stock card closes at what the stock board shows; a dashboard tile and
// a day's sales open the orders behind them; a reversed expense is no longer
// counted as spent. (Run after flows, on its trading.)
import { chromium, BASE, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const BEANS = "c0000000-0000-0000-0000-000000000001";

/** "12,500 IQD" → 12500; "(2,500 IQD)" or "−2,500" → −2500; "—" → 0. */
function money(text) {
  const t = String(text ?? "").trim();
  const neg = /^\(.*\)$/.test(t) || /^[-−]/.test(t);
  const n = Number(t.replace(/[^\d.]/g, "") || "0");
  return neg ? -n : n;
}
/** A CSV body as rows of fields, quoted fields and all. */
function parseCsv(body) {
  const out = [];
  let row = [];
  let f = "";
  let q = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) {
      if (c === '"' && body[i + 1] === '"') {
        f += '"';
        i++;
      } else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n") {
      row.push(f.replace(/\r$/, ""));
      out.push(row);
      row = [];
      f = "";
    } else f += c;
  }
  if (f || row.length) out.push([...row, f]);
  return out;
}

console.log("▸ owner: the reports agree, and each figure opens");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const all = page.locator("#channel tr.grand td");
  const netByChannel = money(await all.nth(4).textContent());
  const refunds = money(await all.nth(3).textContent());
  const revenue = money(
    await page
      .locator("#pnl .st-row.total", { hasText: "Net revenue" })
      .locator(".amt")
      .textContent(),
  );
  check(refunds < 0, `the refund comes off the channel's sales (${refunds})`);
  check(
    netByChannel === revenue,
    `sales by channel, net of refunds (${netByChannel}), are the P&L's net revenue (${revenue})`,
  );
  check(
    (await page.locator("#pnl").textContent()).includes("Gross profit after waste & fees"),
    "the P&L says which gross profit it is",
  );

  // A P&L line opens its journal lines, which add up to it.
  const salesLine = page.locator("#pnl .st-row.indent", { hasText: "4000 Sales revenue" });
  const sales4000 = money(await salesLine.locator(".amt").textContent());
  await salesLine.locator("a").click();
  await page.waitForURL(/\/journals\?account=4000.*pnl=1/);
  const ledger = page.getByTestId("account-ledger");
  await ledger.waitFor({ timeout: 10000 });
  const total = await ledger.locator("tr.grand td").first().textContent();
  check(money(total) === sales4000, `4000's lines add up to the P&L's ${sales4000} (${total})`);

  // A trial-balance line opens its ledger, from its opening to its closing balance.
  await open(page, "/accounting");
  const bankRow = page.locator("tbody tr", { hasText: "1020" }).first();
  const tbClosing = (await bankRow.locator("td").last().textContent()).trim();
  await bankRow.locator("a").click();
  await page.waitForURL(/\/journals\?account=1020/);
  await page.getByTestId("account-ledger").waitFor({ timeout: 10000 });
  const ledgerClosing = (
    await page.getByTestId("account-ledger").locator("tr.grand td").last().textContent()
  ).trim();
  check(
    ledgerClosing === tbClosing,
    `1020's lines close where the trial balance does (${ledgerClosing})`,
  );

  // Every journal line, as CSV: they balance, and none is missing.
  const res = await page.request.get(`${BASE}/reports/export?report=journal_lines`);
  check(
    res.ok() && (res.headers()["content-type"] ?? "").includes("text/csv"),
    "every journal line downloads as CSV",
  );
  const rows = parseCsv(await res.text()).filter((r) => r.length > 1);
  const [header, ...lines] = rows;
  check(header.slice(0, 4).join(",") === "journal_no,when,day,account", "with its columns named");
  const debit = lines.reduce((s, r) => s + Number(r[5]), 0);
  const credit = lines.reduce((s, r) => s + Number(r[6]), 0);
  check(debit === credit && debit > 0, `the lines balance: ${debit} debit, ${credit} credit`);
  const expected = Number(
    sql(`select count(*) from journal_line l join journal_entry e on e.id = l.journal_entry_id
          where e.status = 'published'
            and business_local_date(e.business_id, e.occurred_at)
                between date_trunc('month', business_local_date(e.business_id, now()))::date
                    and business_local_date(e.business_id, now())`),
  );
  check(lines.length === expected, `all ${expected} of this month's lines are in it`);

  // An item's stock card closes at what the stock board shows.
  await open(page, "/inventory");
  await page.locator("a", { hasText: "Golden beans" }).first().click();
  await page.waitForURL(new RegExp(`/inventory/${BEANS}`));
  const card = page.getByTestId("stock-card");
  await card.waitFor({ timeout: 10000 });
  const closing = Number(
    (await card.locator("tr.grand td").nth(1).textContent()).replace(/[^\d.-]/g, ""),
  );
  const board = sql(`select sum(quantity_base) from stock_board where item_id = '${BEANS}'`);
  check(
    board !== "" && closing === Number(board),
    `the beans' card closes at ${closing} g, as the stock board has it (${board})`,
  );
  check(
    (await card.locator('tr[data-kind="sold"]').count()) === 1 &&
      (await card.locator('tr[data-kind="counted"]').count()) === 1,
    "and shows what was sold, and what the count found",
  );

  // The dashboard's figures open what is behind them.
  await open(page, "/dashboard");
  const tile = page.locator("a.card.stat", { hasText: "Gross profit after waste & fees" });
  check((await tile.count()) === 1, "the dashboard says which gross profit it shows");
  check(
    /\/reports\?from=.*#pnl$/.test((await tile.getAttribute("href")) ?? ""),
    "and opens the P&L",
  );
  await page.locator("a.card.stat", { hasText: /^Orders/ }).click();
  await page.waitForURL(/\/orders\?from=/);
  const today = sql("select business_local_date('00000000-0000-0000-0000-0000000000b1', now())");
  const shown = await page.locator("tbody tr").count();
  const todays = Number(
    sql(`select count(*) from sales_order where status <> 'open'
          and business_local_date(business_id, placed_at) = '${today}'`),
  );
  check(shown === todays, `today's orders tile opens today's ${todays} sale(s)`);
  await ctx.close();
}

console.log("▸ owner reverses the rent; it is no longer counted as spent");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/journals");
  await page
    .locator("tbody tr", { hasText: "September shop rent" })
    .getByRole("button", { name: "Reverse" })
    .click();
  await page.getByPlaceholder("Why is it being reversed?").fill("the landlord waived September");
  await page.getByRole("button", { name: "Post reversal" }).click();
  await page.waitForTimeout(1500);
  await open(page, "/expenses");
  const rent = page.locator("tbody tr", { hasText: "September shop rent" });
  check(/reversed by #\d+/.test(await rent.textContent()), "the rent is marked reversed");
  const live = Number(
    sql(`select coalesce(sum(x.amount), 0) from expense x
          where not exists (select 1 from journal_entry r where r.reverses_entry = x.journal_entry_id
                              and r.status = 'published')`),
  );
  const grand = page.locator("tbody tr.grand");
  check(
    money(await grand.locator("td").last().textContent()) === live &&
      (await grand.textContent()).includes("less 1 reversed"),
    `and left out of the total: ${live} spent`,
  );
  await ctx.close();
}

console.log("▸ a cashier downloads no journal lines");
{
  const { ctx, page } = await signIn(browser, "cashier");
  const res = await page.request.get(`${BASE}/reports/export?report=journal_lines`);
  check(res.status() === 403, `refused (HTTP ${res.status()})`);
  await ctx.close();
}

await browser.close();
done("reports");
