// "Something's wrong?" (G5, 0083), through the real screens: the cashier, on
// the till, says what went wrong from the menu; the owner sees it on the
// dashboard and on Reported problems, with the screen it was on, and deals
// with it.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();

console.log("▸ the cashier says what went wrong, from the till's menu");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByTestId("problem-button").click();
  const dialog = page.getByTestId("problem-dialog");
  await dialog.getByTestId("problem-what").fill("The receipt printed twice");
  await dialog.getByTestId("problem-send").click();
  await dialog.getByTestId("problem-sent").waitFor({ timeout: 10000 });
  check(
    sql(`select page || ' ' || (context ->> 'online') from problem_report
          where what = 'The receipt printed twice'`) === "/pos true",
    "kept with the screen it was on and what the app knew",
  );
  await ctx.close();
}

console.log("▸ the owner sees it and deals with it");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  check((await page.getByTestId("dash-problems").count()) === 1, "the dashboard says one is open");
  await open(page, "/problems");
  const row = page.getByTestId("problem-row").first();
  check(
    ((await row.textContent()) ?? "").includes("The receipt printed twice") &&
      ((await row.textContent()) ?? "").includes("/pos"),
    "Reported problems shows what was said, and on which screen",
  );
  await row.getByRole("textbox").fill("Printer set to one copy");
  await row.getByTestId("problem-settle").click();
  await page.locator('[data-testid="problem-row"][data-status="done"]').waitFor({ timeout: 10000 });
  check(
    sql(
      `select status || ' ' || note from problem_report where what = 'The receipt printed twice'`,
    ) === "done Printer set to one copy",
    "dealt with, with what was done",
  );
  await open(page, "/dashboard");
  check((await page.getByTestId("dash-problems").count()) === 0, "and the dashboard's card goes");
  await ctx.close();
}

await browser.close();
done("problems");
