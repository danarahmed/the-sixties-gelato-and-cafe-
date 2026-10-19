// Audit H-01 in the browser: the sale reaches the database but the till never
// hears back. Nothing is ever charged twice. Since round fifteen (0073) a
// quick sale with no answer is kept on the till and sent again by itself with
// the same key, and the next customer is served meanwhile; a payment the till
// may not keep (here, a discount) freezes the cart for its retry, as before.
// And audit P0-4: when it is the database's answer to the app's server that
// is lost, the till must treat it the same way, never as a refusal.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const { page } = await signIn(browser, "cashier");
await open(page, "/pos");
const before = Number(sql("select count(*) from sales_order"));
const sales = () => Number(sql("select count(*) from sales_order"));

let dropped = false;
await page.route("**/pos", async (route) => {
  if (route.request().method() === "POST" && !dropped) {
    dropped = true;
    await route.fetch(); // the server records the sale…
    return route.abort("failed"); // …and the answer is lost on the way back.
  }
  return route.continue();
});

console.log("▸ a quick sale whose answer is lost: kept on the till, sent again once");
await page.getByRole("button", { name: "Dine-in" }).click();
await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
await page.getByRole("button", { name: /Cash/ }).click();
await page.locator(".pay-confirm").click();
await page.getByTestId("receipt-offline").waitFor({ timeout: 10000 });
check(dropped, "the answer to the first attempt was lost");
check(sales() === before + 1, "the sale did reach the database");
check(
  !(await page.locator(".product-tile").first().isDisabled()),
  "the till keeps it and serves the next customer, not frozen",
);
await page.getByTestId("offline-strip").waitFor({ state: "detached", timeout: 40000 });
check(sales() === before + 1, "sent again with its key, it records nothing new — one order");

console.log("▸ kept, then the till reloaded: sent once it opens");
dropped = false;
await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
await page.getByRole("button", { name: /Cash/ }).click();
await page.locator(".pay-confirm").click();
await page.getByTestId("receipt-offline").waitFor({ timeout: 10000 });
await page.unroute("**/pos");
await page.reload();
await page.waitForLoadState("networkidle");
await page.waitForFunction(() => !document.querySelector('[data-testid="offline-strip"]'), null, {
  timeout: 40000,
});
check(sales() === before + 2, "after a reload the kept sale is sent, and recorded exactly once");

console.log("▸ the database's answer to the app's server lost");
await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
const gateway = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321");
await fetch(new URL("/__e2e/lose-next-answer?fn=record_sale", gateway), { method: "POST" });
await page.getByRole("button", { name: /Cash/ }).click();
await page.locator(".pay-confirm").click();
await page.getByTestId("receipt-offline").waitFor({ timeout: 10000 });
check(
  sales() === before + 3,
  "the sale reached the database, though the server never heard back: kept, not refused",
);
await page.getByTestId("offline-strip").waitFor({ state: "detached", timeout: 40000 });
check(sales() === before + 3, "sent again, it records nothing new");

console.log("▸ a payment the till may not keep: frozen for its retry");
let lost = false;
await page.route("**/pos", async (route) => {
  if (route.request().method() === "POST" && !lost) {
    lost = true;
    await route.fetch();
    return route.abort("failed");
  }
  return route.continue();
});
await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
await page.getByRole("button", { name: "＋ Discount" }).click();
await page.getByLabel("Discount as a percentage").fill("10");
await page.getByLabel("Why?").selectOption("regular");
await page.getByRole("button", { name: /Cash/ }).click();
await page.locator(".pay-confirm").click();
await page.getByRole("button", { name: "Retry" }).waitFor({ timeout: 10000 });
check(sales() === before + 4, "the discounted sale did reach the database");
check(
  (await page.getByText(/connection dropped/).count()) > 0 &&
    (await page.locator(".product-tile").first().isDisabled()),
  "the till says it may have gone through, and freezes the cart — not a refusal",
);
await page.unroute("**/pos");
await page.reload();
await page.waitForLoadState("networkidle");
check(
  await page.getByRole("button", { name: "Retry" }).isVisible(),
  "after a reload the unsettled sale still waits for its retry",
);
await page.getByRole("button", { name: "Retry" }).click();
await page.getByText("already been recorded").waitFor({ timeout: 10000 });
check(sales() === before + 4, "the retry records nothing new — one order");

await browser.close();
done("retry");
