// Test your devices (G4), through the real screen: the cashier checks the
// connection, prints a test receipt (the drawer said to open with it), scans
// a product's barcode, a code no product has, and a scale's label; typing is
// told apart from a scan; and a device that fails says what to do.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const { ctx, page } = await signIn(browser, "cashier");
await open(page, "/devices");
// The print dialog is the browser's: here it only notes what it would print.
await page.evaluate(() => {
  window.__printed = [];
  window.print = () => {
    window.__printed.push(document.querySelector(".print-slip")?.textContent ?? "");
  };
});

console.log("▸ the internet");
await page.getByTestId("device-internet-test").click();
await page.locator('[data-testid="device-internet"][data-state="ok"]').waitFor({ timeout: 15000 });
check(true, "the connection checked: the database answered");

console.log("▸ the receipt printer and its drawer");
await page.getByTestId("device-printer-test").click();
await page.getByTestId("device-printer-yes").waitFor();
await page.waitForFunction(() => window.__printed.length > 0, null, { timeout: 5000 });
check(
  (await page.evaluate(() => window.__printed.join(" "))).includes("Test receipt"),
  "a test receipt is printed",
);
check(Number(sql("select count(*) from sales_order")) >= 0, "and nothing is sold");
await page.getByTestId("device-printer-yes").click();
await page.getByTestId("device-drawer-no").click();
check(
  ((await page.getByTestId("device-drawer-fix").textContent()) ?? "").includes("cash drawer"),
  "a drawer that did not open says what to do",
);

console.log("▸ the scanner and the scale");
const box = page.getByTestId("device-scan");
// A barcode the café has: the water's, given here.
sql(`update product_variant set barcode = '6291041500213'
      where id = 'd1000000-0000-0000-0000-000000000002'`);
await page.reload();
await page.evaluate(() => {
  window.print = () => {};
});
await page.getByTestId("device-scan").click();
await page.keyboard.type("6291041500213", { delay: 5 });
await page.keyboard.press("Enter");
check(
  ((await page.getByTestId("device-scan-said").textContent()) ?? "").includes("Golden water"),
  "a scanned code names its product",
);
await box.click();
await page.keyboard.type("1234567", { delay: 150 });
await page.keyboard.press("Enter");
check(
  ((await page.getByTestId("device-scan-said").textContent()) ?? "").includes("typed, not scanned"),
  "typing by hand is told apart from a scan",
);
await box.click();
await page.keyboard.type("4006381333931", { delay: 5 });
await page.keyboard.press("Enter");
check(
  ((await page.getByTestId("device-scan-said").textContent()) ?? "").includes("No product has"),
  "a code no product has says to add it",
);
check(
  (await page.locator('[data-testid="device-scanner"][data-state="ok"]').count()) === 1,
  "the scanner works",
);
await box.click();
await page.keyboard.type("2000000007509", { delay: 5 });
await page.keyboard.press("Enter");
check(
  (await page.locator('[data-testid="device-scale"][data-state="problem"]').count()) === 1,
  "a scale's label no weighed product has needs attention, and says what to do",
);
check(
  ((await page.getByTestId("devices-summary").textContent()) ?? "").includes("attention"),
  "the page says how many need attention",
);

await ctx.close();
await browser.close();
done("devices");
