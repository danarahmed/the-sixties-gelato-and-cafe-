// Budgets and comparisons (0117). The owner opens Reports → Against last
// year and the budget: the revenue, the gross profit and the profit, each
// against the same days a year before. They set this month's rent budget;
// the page then shows it beside the rent, and the profit against the budget.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();

console.log("▸ the owner compares, and sets the month's budget");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  await page.getByTestId("to-compare").click();
  await page.waitForURL(/\/reports\/compare/);
  await page.getByTestId("cmp-revenue").waitFor({ timeout: 15000 });
  check(
    ((await page.getByTestId("cmp-revenue").textContent()) ?? "").length > 0,
    "the revenue, against a year before",
  );
  const form = page.getByTestId("budget-form");
  await form.getByLabel(/^Budget for 6000/).fill("3000000");
  await form.getByRole("button", { name: "Save the budget" }).click();
  await form.getByText(/Saved: the budget of/).waitFor({ timeout: 15000 });
  check(
    last(`select amount::int from budget_line where account_code = '6000'`) === "3000000",
    "this month's rent budgeted: 3,000,000",
  );
  await page.reload();
  await page.getByTestId("cmp-net-budget").waitFor({ timeout: 15000 });
  check(true, "the profit against the budget");
  check(
    (await page.locator('[data-testid="compare-row"][data-code="6000"]').count()) === 1,
    "the rent beside its budget",
  );
  await ctx.close();
}

// Off again for the suites after this one.
sql(`delete from budget_line`);
await browser.close();
done("budgets and comparisons");
