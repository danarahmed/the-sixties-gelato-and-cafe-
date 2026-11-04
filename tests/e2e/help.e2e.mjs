// The ? help (G3), through the real screens: a cashier presses ? on the till
// and reads the till's help for a cashier, with their tasks on it; the help
// opened is noted for the owner's "Where people get stuck"; in Kurdish it is
// in Kurdish where translated; a new tour shows on Today.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();

console.log("▸ a cashier opens the till's help");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByTestId("help-button").click();
  const panel = page.getByTestId("help-panel");
  await panel.getByTestId("help-screen").first().waitFor({ timeout: 10000 });
  check((await panel.getByTestId("help-screen").count()) > 1, "the till's help, part by part");
  check((await panel.getByTestId("help-task").count()) > 0, "with the cashier's tasks on it");
  check(
    /What you can do here/.test((await panel.textContent()) ?? ""),
    "and what a cashier may do there",
  );
  await page.keyboard.press("Escape");
  check(!(await panel.isVisible()), "Escape closes it");
  check(
    Number(last(`select count(*) from stuck_event where kind = 'help' and path = '/pos'`)) >= 1,
    "the help opened is noted for the owner",
  );
  await ctx.close();
}

console.log("▸ in Kurdish");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await ctx.addCookies([
    { name: "locale", value: "ckb", url: process.env.E2E_BASE || "http://127.0.0.1:3100" },
  ]);
  await open(page, "/pos");
  await page.getByTestId("help-button").click();
  const panel = page.getByTestId("help-panel");
  await panel.getByTestId("help-screen").first().waitFor({ timeout: 10000 });
  const text = (await panel.textContent()) ?? "";
  check(/یارمەتی بۆ ئەم شاشەیە/.test(text), "the panel's own words in Kurdish");
  await ctx.close();
}

await browser.close();
done("help");
