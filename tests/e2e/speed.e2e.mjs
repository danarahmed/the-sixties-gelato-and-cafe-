// Speed (plan 8, 0100), through the real screens: a café's owner has no Speed
// page and no link to it; the system's administrator measures, keeps the
// measurement, and reads it back.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();

console.log("▸ a café's owner has no Speed page");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  check((await page.getByTestId("system-admin").count()) === 0, "Settings offers no Speed page");
  const r = await page.goto(`${BASE}/admin/speed`);
  check(r?.status() === 404, "and the page is not there for them");
  await ctx.close();
}

console.log("▸ the system's administrator measures, and keeps it");
sql(`insert into system_admin (auth_user_id) select auth_user_id from app_user where email = 'owner@example.com'
     on conflict do nothing`);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  await page.getByTestId("system-admin").getByRole("link").click();
  await page.waitForURL(/\/admin\/speed$/);
  await page.getByTestId("speed-measure").click();
  await page.getByTestId("speed-result").waitFor({ timeout: 30000 });
  const calls = await page.getByTestId("speed-call").count();
  check(calls >= 5, `each slow screen's call measured (${calls})`);
  check(
    !((await page.getByTestId("speed-result").textContent()) ?? "").includes("Not reached"),
    "every one reached",
  );
  await page.getByLabel("Where and when, and which screens felt slow").fill("E2E: from the test");
  await page.getByTestId("speed-save").click();
  await page.getByTestId("speed-sample").first().getByText("E2E: from the test").waitFor({ timeout: 10000 });
  check(true, "kept, and listed to send");
  check(sql(`select count(*) from speed_sample where note = 'E2E: from the test'`) === "1", "once");
  await ctx.close();
}
sql(`delete from speed_sample; delete from system_admin`);

await browser.close();
done("speed");
