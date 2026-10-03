// The balance sheet and the cash-flow statement (0052, release Z), through the
// real screens, on the day the earlier suites traded: the owner puts money in
// the bank; the balance sheet at the end of the day balances and its assets
// are the books'; the cash flow starts and ends at the cash the books hold,
// its lines add up to the change, the owner's money is among them, and it
// says it adds up; both download as CSV; dates the wrong way round are
// refused in words; Reports leads to it; the branch manager reads it and the
// cashier does not; it speaks Arabic and Kurdish; and the books still tie.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const today = last(`select ${TODAY}`);
const yesterday = last(`select ${TODAY} - 1`);
const differences = () =>
  sql(`select test.act_as('owner@example.com');
       select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
         from report_reconciliation(${TODAY})`)
    .split("\n")
    .pop();

// The owner puts 25,000 in the bank: the day has a flow of its own, whatever ran before.
sql(`select test.act_as('owner@example.com');
     select move_cash('owner', 'bank', 25000, 'e2e: the owner puts money in', null, gen_random_uuid())`);
const before = differences();

/** A figure from the books: the published journals' balance of these accounts. */
const books = (codes, until = "'infinity'") =>
  Number(
    last(`select trim_scale(coalesce(sum(l.debit - l.credit), 0))
            from journal_line l join journal_entry e on e.id = l.journal_entry_id
            join gl_account a on a.id = l.account_id
           where e.business_id = '${B}' and e.status = 'published' and e.occurred_at < ${until}
             and a.code in (${codes.map((c) => `'${c}'`).join(", ")})`),
  );
const CASH = ["1000", "1001", "1005", "1006", "1020"];
const startOfToday = `(select from_ts from local_day_bounds('${B}', ${TODAY}, ${TODAY}))`;
const cashNow = books(CASH);
const cashAtStart = books(CASH, startOfToday);
const assets = Number(
  last(`select trim_scale(coalesce(sum(l.debit - l.credit), 0))
          from journal_line l join journal_entry e on e.id = l.journal_entry_id
          join gl_account a on a.id = l.account_id
         where e.business_id = '${B}' and e.status = 'published' and a.account_type = 'asset'`),
);

console.log("▸ the owner: the balance sheet at the end of today, and the cash flow of the day");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/reports/statements?from=${today}&to=${today}`);
  await page.getByTestId("balance-sheet").waitFor({ timeout: 15000 });
  check(
    (await page.getByTestId("bs-balances").textContent()).includes("It balances"),
    "the balance sheet balances",
  );
  const total = (kind) => page.locator(`[data-testid="bs-total"][data-kind="${kind}"]`);
  check(
    Number(await total("assets").getAttribute("data-end")) === assets,
    `its assets are the books': ${assets.toLocaleString("en-US")}`,
  );
  check(
    Number(await total("both").getAttribute("data-end")) === assets,
    "and what it owes and the owner's come to the same",
  );
  check(
    Number(await total("cash").getAttribute("data-end")) === cashNow,
    `the cash in hand and at the bank: ${cashNow.toLocaleString("en-US")}`,
  );

  const start = Number(await page.getByTestId("cf-cash-start").getAttribute("data-amount"));
  const end = Number(await page.getByTestId("cf-cash-end").getAttribute("data-amount"));
  const net = Number(await page.getByTestId("cf-net").getAttribute("data-amount"));
  check(
    start === cashAtStart && end === cashNow,
    `the cash flow starts at the books' ${cashAtStart.toLocaleString("en-US")} and ends at ${cashNow.toLocaleString("en-US")}`,
  );
  const lines = await page.getByTestId("cf-line").evaluateAll((els) =>
    els.map((e) => ({
      line: e.dataset.line,
      amount: Number(e.dataset.amount),
      in: Number(e.dataset.in),
    })),
  );
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  check(
    sum === net && start + net === end,
    `its lines (${lines.map((l) => l.line).join(", ")}) add up to the change, ${net.toLocaleString("en-US")}`,
  );
  check(
    lines.some((l) => l.line === "owner" && l.in >= 25000),
    "the owner's 25,000 is among them, from and to the owner",
  );
  check(
    (await page.getByTestId("cf-adds-up").textContent()).startsWith("It adds up"),
    "and it says it adds up",
  );

  const bs = await page.request.get(`${BASE}/reports/export?report=balance_sheet&on=${today}`);
  const bsCsv = await bs.text();
  check(
    bs.ok() &&
      bsCsv.startsWith("section,group,code,account,amount") &&
      bsCsv.includes(`total,assets,,Total assets,${assets}`),
    "the balance sheet downloads as CSV",
  );
  const cf = await page.request.get(
    `${BASE}/reports/export?report=cash_flow&from=${today}&to=${today}`,
  );
  const cfCsv = await cf.text();
  check(
    cf.ok() &&
      cfCsv.startsWith("section,line,code,account,in,out,amount") &&
      cfCsv.includes(`cash,closing,,Cash at the end,,,${cashNow}`),
    "and the cash flow",
  );

  await open(page, `/reports/statements?from=${today}&to=${yesterday}`);
  const problem = page.getByTestId("statements-problem");
  await problem.waitFor({ timeout: 15000 });
  check(
    (await problem.textContent()).startsWith("Choose the dates, the first on or before the last"),
    "dates the wrong way round are refused, in words",
  );

  await open(page, `/reports?from=${today}&to=${today}`);
  check((await page.getByTestId("to-statements").count()) === 1, "Reports leads to them");
  await ctx.close();
}

console.log("▸ the branch manager reads them; the cashier does not");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, `/reports/statements?from=${today}&to=${today}`);
  await page.getByTestId("balance-sheet").waitFor({ timeout: 15000 });
  check((await page.getByTestId("cash-flow").count()) === 1, "the branch manager sees both");
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await page.goto(`${BASE}/reports/statements?from=${today}&to=${today}`);
  await page.waitForLoadState("networkidle");
  check(
    (await page.getByTestId("balance-sheet").count()) === 0,
    "no balance sheet for the till's cashier",
  );
  const res = await page.request.get(`${BASE}/reports/export?report=balance_sheet&on=${today}`);
  check(!res.ok(), "nor its CSV");
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const path = `/reports/statements?from=${today}&to=${today}`;
  await open(page, path);
  const words = await english(page, path);
  check(
    words.length === 0,
    `in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ the books still tie");
check(differences() === before, `every subledger is where it was (${differences()})`);

await browser.close();
done("statements");
