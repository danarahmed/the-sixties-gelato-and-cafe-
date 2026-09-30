// The chart of accounts on a screen (0058, the August audit's M-06), through
// the real screens: the owner adds a cost, Repairs, with its names in Arabic
// and Kurdish (a code taken is refused in words first); a manager records an
// expense on it from Expenses, and it is in the profit and loss; the owner
// renames it, takes it out of use (Expenses no longer offers it, its past
// stays in the profit and loss) and brings it back. The accounts the system
// posts to offer no change, and a branch manager sees the accounts but
// changes none. The audit trail names each change. In Arabic and Kurdish,
// the account by the café's own words for it.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const acct = (code) =>
  last(`select name || ' ' || account_type || ' '
                || case when is_active then 'in use' else 'out of use' end || ' '
                || case when is_system then 'system' else 'own' end
          from gl_account where business_id = '${B}' and code = '${code}'`);
const words = (locale, phrase) =>
  last(`select words from app_phrase
         where business_id = '${B}' and locale = '${locale}' and phrase = '${phrase}'`);
const row = (page, code) => page.locator(`[data-testid="chart-row"][data-code="${code}"]`);
const accounts = Number(last(`select count(*) from gl_account where business_id = '${B}'`));

console.log("▸ the owner adds a cost: Repairs");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/accounting");
  const chart = page.getByTestId("chart");
  check(
    (await chart.getByTestId("chart-row").count()) === accounts,
    `every account is listed, ${accounts} of them`,
  );
  const rent = row(page, "6000");
  check(
    (await rent.textContent()).includes("Rent") &&
      (await rent.textContent()).includes("The system posts to it") &&
      (await rent.getByRole("button").count()) === 0,
    "an account the system posts to says so, and offers no change",
  );
  const add = page.getByTestId("chart-add");
  check(
    (await add.getByLabel("Code").inputValue()) === "6010",
    "a cost is proposed the first free code of ten, 6010",
  );
  await add.getByLabel("Type").selectOption("revenue");
  check(
    (await add.getByLabel("Code").inputValue()) === "4300" &&
      (await add.textContent()).includes("An income's code is from 4000 to 4999."),
    "an income, 4300, and the codes an income may have",
  );
  await add.getByLabel("Type").selectOption("expense");
  await add.getByLabel("Code").fill("6000");
  await add.getByLabel("Name (English)").fill("Shop rent");
  await add.getByRole("button", { name: "Add the account" }).click();
  await chart.getByText("Account 6000 is Rent").waitFor({ timeout: 10000 });
  check(
    Number(last(`select count(*) from gl_account where business_id = '${B}'`)) === accounts,
    "a code taken is refused, in words, and nothing is added",
  );

  await add.getByLabel("Code").fill("6010");
  await add.getByLabel("Name (English)").fill("Repairs");
  await add.getByLabel("الاسم (Arabic)").fill("الإصلاحات");
  await add.getByLabel("ناو (Kurdish)").fill("چاککردنەوە");
  await add.getByRole("button", { name: "Add the account" }).click();
  await chart.getByText("Account 6010 Repairs is added.").waitFor({ timeout: 10000 });
  check(acct("6010") === "Repairs expense in use own", "added: a cost, in use, the café's own");
  check(
    words("ar", "Repairs") === "الإصلاحات" && words("ckb", "Repairs") === "چاککردنەوە",
    "its names in Arabic and Kurdish kept as the café's own words for it",
  );
  await row(page, "6010").waitFor({ timeout: 10000 });
  check(
    (await row(page, "6010").getByRole("button", { name: "Rename…" }).count()) === 1 &&
      (await row(page, "6010").getByRole("button", { name: "Take out of use…" }).count()) === 1,
    "listed among the costs, with a change offered",
  );
  await ctx.close();
}

console.log("▸ a manager records an expense on it");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/expenses");
  const choice = page.getByLabel("Account", { exact: true });
  check(
    (await choice.locator("option").allTextContents()).includes("6010 Repairs"),
    "Expenses offers 6010 Repairs",
  );
  await page.getByPlaceholder("September shop rent").fill("Fixed the grinder");
  await page.locator("input.amt").first().fill("50000");
  await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
  await choice.selectOption("6010");
  await page.getByRole("button", { name: "Post expense" }).click();
  await page.getByText(/Posted to 6010 Repairs/).waitFor({ timeout: 10000 });
  check(
    last(`select string_agg(a.code || ' ' || trim_scale(l.debit) || '/' || trim_scale(l.credit), ', '
                            order by a.code)
            from expense x join journal_line l on l.journal_entry_id = x.journal_entry_id
            join gl_account a on a.id = l.account_id
           where x.description = 'Fixed the grinder'`) === "1020 0/50000, 6010 50000/0",
    "posted: 6010 debited 50,000, the bank credited",
  );
  await ctx.close();
}

console.log("▸ the owner renames it, takes it out of use and brings it back");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  check(
    (
      await page.locator("#pnl .st-row.indent", { hasText: "6010 Repairs" }).first().textContent()
    ).includes("50,000"),
    "the profit and loss shows 6010 Repairs, 50,000",
  );

  await open(page, "/accounting");
  const chart = page.getByTestId("chart");
  await row(page, "6010").getByRole("button", { name: "Rename…" }).click();
  const r = row(page, "6010");
  check(
    (await r.getByLabel("Name (English)").inputValue()) === "Repairs" &&
      (await r.textContent()).includes("Its names in Arabic and Kurdish stay as they are"),
    "the rename starts from its name, and says its other names stay",
  );
  await r.getByLabel("Name (English)").fill("Repairs and upkeep");
  await r.getByLabel("الاسم (Arabic)").fill("الإصلاح والصيانة");
  await r.getByRole("button", { name: "Save the name" }).click();
  await chart.getByText("Account 6010 is renamed.").waitFor({ timeout: 10000 });
  check(
    acct("6010") === "Repairs and upkeep expense in use own" &&
      words("ar", "Repairs and upkeep") === "الإصلاح والصيانة" &&
      words("ckb", "Repairs and upkeep") === "چاککردنەوە",
    "renamed, with its new Arabic; its Kurdish, not given anew, kept",
  );

  await row(page, "6010").getByRole("button", { name: "Take out of use…" }).click();
  const out = row(page, "6010");
  check(
    (await out.getByRole("button", { name: "Take it out of use" }).isDisabled()) &&
      (await out.textContent()).includes("what was posted to it stays in every report"),
    "taking it out of use asks why, and says what that means",
  );
  await out.getByLabel("Why (required)").fill("Merged into Other expenses");
  await out.getByRole("button", { name: "Take it out of use" }).click();
  await chart.getByText("Account 6010 is out of use.").waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="chart-row"][data-code="6010"]')
        ?.textContent?.includes("Out of use"),
    null,
    { timeout: 10000 },
  );
  check(
    acct("6010") === "Repairs and upkeep expense out of use own",
    "out of use, marked so on the list",
  );
  await open(page, "/expenses");
  check(
    !(await page.getByLabel("Account", { exact: true }).locator("option").allTextContents()).some(
      (o) => o.startsWith("6010"),
    ),
    "Expenses no longer offers it",
  );
  await open(page, "/reports");
  check(
    (
      await page
        .locator("#pnl .st-row.indent", { hasText: "6010 Repairs and upkeep" })
        .first()
        .textContent()
    ).includes("50,000"),
    "what was posted to it stays in the profit and loss, under its new name",
  );

  await open(page, "/accounting");
  await row(page, "6010").getByRole("button", { name: "Bring back…" }).click();
  const back = row(page, "6010");
  await back.getByLabel("Why (required)").fill("Needed again");
  await back.getByRole("button", { name: "Put it back in use" }).click();
  await page
    .getByTestId("chart")
    .getByText("Account 6010 is in use again.")
    .waitFor({ timeout: 10000 });
  check(acct("6010") === "Repairs and upkeep expense in use own", "brought back into use");
  await ctx.close();
}

console.log("▸ a branch manager sees the accounts and changes none");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/accounting");
  check(
    (await page.getByTestId("chart-row").count()) === accounts + 1 &&
      (await page.getByTestId("chart-add").count()) === 0 &&
      (await page.getByTestId("chart").getByRole("button").count()) === 0,
    "the accounts are listed; no account is added, renamed or taken out of use",
  );
  await ctx.close();
}

console.log("▸ the audit trail");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/audit?group=books");
  const trail = await page.getByTestId("audit-trail").textContent();
  check(
    (await page.locator('tr[data-action="account.create"]').count()) === 1 &&
      (await page.locator('tr[data-action="account.rename"]').count()) === 1 &&
      (await page.locator('tr[data-action="account.in_use"]').count()) === 2,
    "each change is on the trail, under Books & periods",
  );
  check(
    trail.includes("Account added") &&
      trail.includes("Account 6010 Repairs") &&
      trail.includes("Account renamed") &&
      trail.includes("Merged into Other expenses"),
    "named by the account's code and name, with why it was taken out of use",
  );
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const [locale, name] of [
  ["ar", "الإصلاح والصيانة"],
  ["ckb", "چاککردنەوە"],
]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/accounting");
  check(
    (await row(page, "6010").textContent()).includes(name),
    `in ${locale}, 6010 by the café's own words for it: ${name}`,
  );
  const left = [];
  for (const path of ["/accounting", "/expenses", "/audit?group=books"]) {
    await open(page, path);
    left.push(...(await english(page, path)));
  }
  check(
    left.length === 0 && (await page.evaluate(() => document.documentElement.dir)) === "rtl",
    `in ${locale}, right to left, no English but the café's own names` +
      (left.length ? `: ${left.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ on a phone, the rename open");
{
  const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
  await ctx.addCookies([{ name: "locale", value: "ckb", url: BASE }]);
  await open(page, "/accounting");
  await row(page, "6010").locator("button").first().click();
  await row(page, "6010").locator("input").first().waitFor();
  // Nothing past the screen, nor past a box that clips it; and the accounts are
  // cards, so their own box does not scroll sideways.
  const over = await page.evaluate(() => {
    const main = document.querySelector("main");
    const width = document.documentElement.clientWidth;
    let worst = document.documentElement.scrollWidth - width;
    for (const el of main.querySelectorAll("*")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      let box = { left: 0, right: width };
      for (let e = el.parentElement; e && e !== main; e = e.parentElement) {
        const ox = getComputedStyle(e).overflowX;
        if (ox === "auto" || ox === "scroll") box = null;
        else if (ox !== "visible") box = e.getBoundingClientRect();
        else continue;
        break;
      }
      if (box) worst = Math.max(worst, b.right - box.right, box.left - b.left);
    }
    const chart = document.querySelector('[data-testid="chart"] .tw');
    return Math.round(Math.max(worst, chart.scrollWidth - chart.clientWidth));
  });
  check(
    over <= 1,
    `at 390px, in Kurdish, the accounts and the rename fit the screen${over > 1 ? ` (by ${over}px)` : ""}`,
  );
  await ctx.close();
}

await browser.close();
done("chart");
