// Fewer steps to the work (SMART_PLAN step 2). Find anything: Ctrl+K opens
// one box; a screen is found by its name, a product by part of its name, a
// journal by its number, and Enter goes there; the cashier is shown only what
// a cashier may read. Each role's first screen: the barista starts on
// Production; a person may choose their own first screen on My account, kept
// with their sign-in, and back to their role's. Photos many at once, each to
// the product its file is named for, and what fits none named. On a phone the
// owner's Dashboard is short: the rest one tap away.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const ESPRESSO = "d0000000-0000-0000-0000-000000000001";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

// The barista, made here when this suite runs alone (the production suite makes them too).
sql(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com')
       on conflict do nothing;
     insert into app_user (business_id, full_name, email, auth_user_id)
     select '${B}', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e'
      where not exists (select 1 from app_user where email = 'barista@example.com');
     insert into user_role (app_user_id, role)
     select id, 'barista' from app_user where email = 'barista@example.com'
     on conflict do nothing`);
const journalNo = last(`select journal_no from journal_entry order by journal_no desc limit 1`);

console.log("▸ find anything");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  await page.keyboard.press("Control+k");
  const box = page.getByTestId("find-input");
  await box.waitFor({ timeout: 10000 });
  check(
    await box.evaluate((e) => e === document.activeElement),
    "Ctrl+K opens the box, ready to type",
  );
  await box.fill("invent");
  const rows = page.getByTestId("find-row");
  await rows.first().waitFor({ timeout: 10000 });
  check(
    (await rows.first().getAttribute("data-href")) === "/inventory",
    "a screen is found by part of its name",
  );
  await box.fill("golden esp");
  await page
    .locator('[data-testid="find-row"][data-href^="/products?q="]')
    .first()
    .waitFor({ timeout: 15000 });
  check(true, "a product by part of its name, in any capitals");
  if (journalNo) {
    await box.fill(journalNo);
    await page
      .locator(`[data-testid="find-row"][data-href="/journals?q=${journalNo}"]`)
      .waitFor({ timeout: 15000 });
    check(true, `a journal by its number (#${journalNo})`);
  }
  await box.fill("invent");
  await page.locator('[data-testid="find-row"][data-href="/inventory"]').waitFor();
  await page.waitForTimeout(400);
  await box.press("Enter");
  await page.waitForURL((u) => u.pathname === "/inventory", { timeout: 15000 });
  check((await page.getByTestId("find-dialog").count()) === 0, "Enter goes to the first found");
  await page.keyboard.press("Control+k");
  await page.getByTestId("find-input").fill("zzqxnothing");
  await page.getByTestId("find-none").waitFor({ timeout: 15000 });
  check(true, "a search that finds nothing says so");
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  check(
    (await page.getByTestId("find-open").count()) === 0 ||
      !(await page.getByTestId("find-open").isVisible()),
    "the till keeps its screen to itself: no search button in its way",
  );
  await page.keyboard.press("Control+k");
  const box = page.getByTestId("find-input");
  await box.waitFor({ timeout: 10000 });
  await box.fill("invent");
  await page.waitForTimeout(800);
  check(
    (await page.locator('[data-testid="find-row"][data-href="/inventory"]').count()) === 0,
    "the cashier is not offered a screen that is not theirs",
  );
  if (journalNo) {
    await box.fill(journalNo);
    await page.waitForTimeout(1500);
    check(
      (await page.locator('[data-testid="find-row"][data-href^="/journals"]').count()) === 0,
      "nor a journal, found by its number",
    );
  }
  await ctx.close();
}

console.log("▸ each role's first screen");
{
  const { ctx, page } = await signIn(browser, "barista");
  check(new URL(page.url()).pathname === "/production", "the barista starts on Production");
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "counter");
  check(new URL(page.url()).pathname === "/count", "the counter starts on the count");
  await open(page, "/account");
  check(
    (await page.getByTestId("first-screen-card").count()) === 0,
    "with one screen, there is nothing to choose",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "owner");
  check(new URL(page.url()).pathname === "/dashboard", "the owner starts on the Dashboard");
  await open(page, "/account");
  await page.getByTestId("first-screen").selectOption("/pos");
  await page.getByText("Saved: you start there from now on.").waitFor({ timeout: 15000 });
  await open(page, "/");
  check(new URL(page.url()).pathname === "/pos", "the chosen screen is where home is at once");
  await ctx.close();
  const again = await signIn(browser, "owner");
  check(
    new URL(again.page.url()).pathname === "/pos",
    "and on signing in again, on another browser",
  );
  await open(again.page, "/account");
  await again.page.getByTestId("first-screen").selectOption("");
  await again.page.getByText("Saved: you start there from now on.").waitFor({ timeout: 15000 });
  await open(again.page, "/");
  check(new URL(again.page.url()).pathname === "/dashboard", "back to the role's own");
  await again.ctx.close();
}

console.log("▸ photos many at once");
{
  sql(`select test.act_as('owner@example.com'); select clear_product_image('${ESPRESSO}')`);
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  await page.locator('[data-testid="menu-photos"] > summary').click();
  await page.getByTestId("photos-many-input").setInputFiles([
    { name: "golden-espresso.png", mimeType: "image/png", buffer: PNG },
    { name: "IMG_2041.png", mimeType: "image/png", buffer: PNG },
  ]);
  await page.getByText("1 photo saved; 1 not placed.").waitFor({ timeout: 20000 });
  check(
    sql(`select image_url is not null from product where id = '${ESPRESSO}'`) === "t",
    "golden-espresso.png went on Golden espresso",
  );
  check(
    ((await page.getByTestId("photos-left").textContent()) ?? "").includes("IMG_2041.png"),
    "the file named for no product is named, to place by hand",
  );
  await ctx.close();
}

console.log("▸ the owner's short home on a phone");
{
  const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 844 } });
  await open(page, "/dashboard");
  const more = page.getByTestId("phone-more");
  check(await more.isVisible(), "a phone shows today first, with the rest one tap away");
  check(!(await page.locator(".dash-grid").isVisible()), "the charts and lists wait behind it");
  await more.click();
  check(await page.locator(".dash-grid").isVisible(), "one tap shows them");
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 1280, height: 900 } });
  await open(page, "/dashboard");
  check(
    !(await page.getByTestId("phone-more").isVisible()) &&
      (await page.locator(".dash-grid").isVisible()),
    "a wide screen shows everything, no button",
  );
  await ctx.close();
}

await browser.close();
done("shortcuts");
