// Plans and parts (0108), through the real screens: the owner sees the
// Business plan with every part on; turns the accounting screens off, with
// why: Journals leaves the menu and its page is not opened; turned on again,
// it is back.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();

console.log("▸ the owner's plan and parts");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#plan");
  const part = page.getByTestId("plan-and-parts");
  await part.waitFor({ timeout: 10000 });
  check(
    ((await part.getByTestId("plan-now").textContent()) ?? "").includes("Business"),
    "the Business plan",
  );
  const row = part.locator('[data-testid="part-row"][data-part="accounting"]');
  await part.getByTestId("parts-reason").fill("Trying the café without the books");
  await row.getByTestId("part-toggle").click();
  await row.getByText("Off", { exact: true }).waitFor({ timeout: 10000 });
  check(
    sql(`select enabled::text from business_part where part = 'accounting'`) === "false",
    "the accounting screens turned off, with why",
  );
  await page.goto(`${BASE}/journals`);
  await page.waitForLoadState("networkidle");
  check(!page.url().includes("/journals"), "Journals is not opened while its part is off");
  check((await page.locator('nav a[href="/journals"]').count()) === 0, "and is not on the menu");

  await open(page, "/settings#plan");
  await page.getByTestId("parts-reason").fill("The books are wanted again");
  await page
    .locator('[data-testid="part-row"][data-part="accounting"]')
    .getByTestId("part-toggle")
    .click();
  await page
    .locator('[data-testid="part-row"][data-part="accounting"]')
    .getByText("On", { exact: true })
    .waitFor({ timeout: 10000 });
  await open(page, "/journals");
  check(page.url().includes("/journals"), "turned on again, Journals opens");
  await ctx.close();
}

await browser.close();
done("plans");
