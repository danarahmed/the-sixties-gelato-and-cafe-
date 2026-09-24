// Audit H-01 in the browser: the sale reaches the database but the till never
// hears back. The cart freezes; the retry — or a reload and then the retry —
// returns the sale already recorded. Nothing is ever charged twice.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const { page } = await signIn(browser, "cashier");
await open(page, "/pos");
const before = Number(sql("select count(*) from sales_order"));

let dropped = false;
await page.route("**/pos", async (route) => {
  if (route.request().method() === "POST" && !dropped) {
    dropped = true;
    await route.fetch(); // the server records the sale…
    return route.abort("failed"); // …and the answer is lost on the way back.
  }
  return route.continue();
});

await page.getByRole("button", { name: "Dine-in" }).click();
await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
await page.getByRole("button", { name: /Cash/ }).click();
await page.locator(".pay-confirm").click();
await page.getByRole("button", { name: "Retry" }).waitFor({ timeout: 10000 });
check(dropped, "the answer to the first attempt was lost");
check(
  Number(sql("select count(*) from sales_order")) === before + 1,
  "the sale did reach the database",
);
check(
  await page.locator(".product-tile").first().isDisabled(),
  "the till freezes the cart until it is settled",
);

await page.getByRole("button", { name: "Retry" }).click();
await page.getByText("already been recorded").waitFor({ timeout: 10000 });
check(
  Number(sql("select count(*) from sales_order")) === before + 1,
  "the retry records nothing new — one order",
);

dropped = false;
await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
await page.getByRole("button", { name: /Cash/ }).click();
await page.locator(".pay-confirm").click();
await page.getByRole("button", { name: "Retry" }).waitFor({ timeout: 10000 });
await page.unroute("**/pos");
await page.reload();
await page.waitForLoadState("networkidle");
check(
  await page.getByRole("button", { name: "Retry" }).isVisible(),
  "after a reload the unsettled sale still waits for its retry",
);
await page.getByRole("button", { name: "Retry" }).click();
await page.getByText("already been recorded").waitFor({ timeout: 10000 });
check(
  Number(sql("select count(*) from sales_order")) === before + 2,
  "and it too is recorded exactly once",
);

await browser.close();
done("retry");
