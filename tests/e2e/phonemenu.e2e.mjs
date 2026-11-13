// The menu on customers' phones (0118). The owner turns it on on Settings;
// on a phone that is not signed in, its link opens the menu; two espressos
// are chosen and shown as a QR. At the till, the scanner types the QR's code
// and the two espressos are on the bill, and on the customer's screen beside
// the till. Turned off, the link opens nothing.
import { chromium, check, done, open, signIn, sql, BASE } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const ESPRESSO = "d1000000-0000-0000-0000-000000000001";
const code = `S60O1.${ESPRESSO.replace(/-/g, "")}-2`;

console.log("▸ the owner turns the menu on, for the tables");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#phone-menu");
  const card = page.getByTestId("public-menu");
  await card.getByTestId("public-menu-toggle").click();
  await card.getByText("On: the QR opens the menu.").waitFor({ timeout: 15000 });
  await card.getByTestId("public-menu-qr").waitFor({ timeout: 15000 });
  check(true, "on, with the QR to print for the tables");
  await ctx.close();
}
const token = last(`select token from public_menu`);

console.log("▸ a customer's phone, not signed in");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/m/${token}`);
  const item = page.locator('[data-testid="phone-item"][data-name="Golden espresso"]');
  await item.waitFor({ timeout: 15000 });
  check(true, "the menu opens, with nobody signed in");
  await item.getByTestId("phone-add").click();
  await item.getByTestId("phone-add").click();
  await page.getByTestId("phone-show").click();
  await page.getByTestId("phone-order-qr").waitFor({ timeout: 10000 });
  check(
    ((await page.getByTestId("phone-order").textContent()) ?? "").includes("2 × Golden espresso"),
    "two espressos, shown as a QR for the waiter",
  );
  await page.goto(`${BASE}/m/not-the-link-at-all-0000`);
  await page.getByTestId("phone-menu-off").waitFor({ timeout: 10000 });
  check(true, "a wrong link opens nothing");
  await ctx.close();
}

console.log("▸ the waiter scans it at the till");
{
  const { ctx, page } = await signIn(browser, "cashier");
  // The customer's screen, a second window of the same till.
  const screen = await ctx.newPage();
  await open(screen, "/pos/customer");
  await screen.getByTestId("customer-screen").waitFor({ timeout: 15000 });
  await open(page, "/pos");
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: "Dine-in", exact: true }).click();
  // A scanner types the code fast, then Enter.
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press("Enter");
  const line = page.locator(".order-line", { hasText: "Golden espresso" });
  await line.first().waitFor({ timeout: 10000 });
  check(
    ((await page.locator(".order-total").textContent()) ?? "").includes("2 item"),
    "the two espressos are on the bill",
  );
  await screen.getByTestId("customer-screen-total").waitFor({ timeout: 10000 });
  check(
    ((await screen.getByTestId("customer-screen-total").textContent()) ?? "").includes("5,000"),
    "and the customer's screen shows them, 5,000",
  );
  await ctx.close();
}

console.log("▸ a table sends its order straight to the till (0119)");
sql(`select test.act_as('owner@example.com'); select set_phone_orders(true, false)`);
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/m/${token}`);
  const item = page.locator('[data-testid="phone-item"][data-name="Golden espresso"]');
  await item.getByTestId("phone-add").click();
  await page.getByTestId("phone-show").click();
  await page.getByTestId("phone-send").getByLabel("Your table").fill("7");
  await page.getByTestId("phone-send-go").click();
  await page.getByTestId("phone-sent").waitFor({ timeout: 10000 });
  check(true, "sent from table 7");
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByTestId("phone-orders").click();
  const row = page.getByTestId("phone-order-row").first();
  check(((await row.textContent()) ?? "").includes("Table 7"), "the till sees table 7's order");
  await row.getByTestId("phone-order-take").click();
  await page
    .locator(".order-line", { hasText: "Golden espresso" })
    .first()
    .waitFor({ timeout: 10000 });
  check(
    last(`select status from phone_order order by created_at desc limit 1`) === "accepted",
    "taken: on the order, rung up as any",
  );
  await ctx.close();
}
sql(`select test.act_as('owner@example.com'); select set_phone_orders(false, false)`);

// Off again for the suites after this one.
sql(`update public_menu set enabled = false`);
check(last(`select enabled from public_menu`) === "f", "off: the link opens nothing");
await browser.close();
done("the menu on customers' phones");
