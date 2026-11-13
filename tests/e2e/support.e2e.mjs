// Running many businesses (0109), through the real screens: a cashier sends a
// problem to the system's support; the owner allows support for some hours;
// an administrator sees the problem and the business on the console, looks
// at it read-only (the banner says so) and leaves; the owner sees the visit.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
// The manager is one of the system's administrators here.
sql(`insert into system_admin (auth_user_id)
     select auth_user_id from app_user where email = 'manager@example.com' on conflict do nothing`);

console.log("▸ a problem sent to support");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/today");
  await page.getByTestId("problem-button").click();
  await page.getByTestId("problem-what").fill("E2E the printer is silent");
  check(await page.getByTestId("problem-to-support").isChecked(), "sent to support by default");
  await page.getByTestId("problem-send").click();
  await page.getByTestId("problem-sent").waitFor({ timeout: 10000 });
  check(
    last(
      `select for_support::text from problem_report where what = 'E2E the printer is silent'`,
    ) === "true",
    "kept for support",
  );
  await ctx.close();
}

console.log("▸ the owner allows support");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#support");
  const part = page.getByTestId("support-access");
  await part.waitFor({ timeout: 10000 });
  await part.getByTestId("support-reason").fill("Help with the printer");
  await part.getByTestId("support-grant").click();
  await part.getByText(/Support may look until/).waitFor({ timeout: 10000 });
  await ctx.close();
}

console.log("▸ the administrator looks, read-only, and leaves");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/admin/businesses");
  await page.getByTestId("business-plans").waitFor({ timeout: 10000 });
  check(
    ((await page.getByTestId("support-problems").textContent()) ?? "").includes(
      "E2E the printer is silent",
    ),
    "the console lists the problem",
  );
  await page.getByTestId("business-support").first().click();
  await page.getByTestId("support-banner").waitFor({ timeout: 10000 });
  check(true, "the support banner says it is read-only");
  await page.getByTestId("support-leave").click();
  await page.getByTestId("business-plans").waitFor({ timeout: 10000 });
  check((await page.getByTestId("support-banner").count()) === 0, "left: themselves again");
  await ctx.close();
}

console.log("▸ the owner sees the visit");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#support");
  await page.getByTestId("support-visits").waitFor({ timeout: 10000 });
  check(true, "the visit is listed");
  await page.getByTestId("support-revoke").click();
  await page
    .getByText("Support has no access", { exact: true })
    .first()
    .waitFor({ timeout: 10000 });
  await ctx.close();
}
sql(
  `delete from system_admin where auth_user_id = (select auth_user_id from app_user where email = 'manager@example.com')`,
);

await browser.close();
done("support");
