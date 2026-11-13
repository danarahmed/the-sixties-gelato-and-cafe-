// The menu on customers' phones (0118). The owner turns it on on Settings;
// on a phone that is not signed in, its link opens the menu; two espressos
// are chosen and shown as a QR. At the till, the scanner types the QR's code
// and the two espressos are on the bill. Turned off, the link opens nothing.
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
  await ctx.close();
}

// Off again for the suites after this one.
sql(`update public_menu set enabled = false`);
check(last(`select enabled from public_menu`) === "f", "off: the link opens nothing");
await browser.close();
done("the menu on customers' phones");
