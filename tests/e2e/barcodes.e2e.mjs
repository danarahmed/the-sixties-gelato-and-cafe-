// Barcodes (round twenty, 0078), through the real screens: the owner gives
// the water its barcode on Products & Recipes and prints its labels; at the
// till a scanner (keys typed faster than anyone can, then Enter) adds it; a
// code no size has is said so.
import { chromium, check, done, open, openProduct, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const WATER = "d1000000-0000-0000-0000-000000000002";
const CODE = "6261123456789";

console.log("▸ the owner gives the water its barcode, and prints its labels");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  const panel = await openProduct(page, "Golden water", "Sizes & prices");
  const card = panel.getByTestId("barcode-sizes");
  await card.getByTestId("barcode-input").first().fill(CODE);
  await card.getByTestId("barcode-save").first().click();
  await page.waitForTimeout(1200);
  check(
    sql(`select barcode from product_variant where id = '${WATER}'`) === CODE,
    "the water has its barcode",
  );
  await open(page, `/products/labels?size=${WATER}`);
  const sheet = page.getByTestId("label-sheet");
  await sheet.getByTestId("label").first().waitFor({ timeout: 10000 });
  check((await sheet.getByTestId("label").count()) === 1, "one label of the water, to print");
  check((await sheet.locator("svg.barcode rect").count()) > 20, "with its barcode drawn in bars");
  await ctx.close();
}

console.log("▸ a scan at the till adds it");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Dine-in" }).click();
  await page.evaluate(() => document.activeElement?.blur?.());
  // As a scanner sends it: every key at once, then Enter, right after the way
  // of selling changed. Typed one by one, a busy test machine can leave more
  // than a scanner's 40 ms between keys; and all at once, the till must look
  // the code up in the menu shown now, not the one before Dine-in was chosen.
  await page.evaluate((code) => {
    for (const key of [...code, "Enter"])
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }, CODE);
  await page.locator(".order-line", { hasText: "Golden water" }).waitFor({ timeout: 10000 });
  check(true, "the water is on the order");
  check(
    (await page.getByTestId("kb-times").count()) === 0,
    "a scan is not a count: no “× 62” left waiting for the next tap",
  );
  await page.keyboard.type("9990001112223", { delay: 5 });
  await page.keyboard.press("Enter");
  await page.getByTestId("scan-miss").waitFor({ timeout: 5000 });
  check(
    ((await page.getByTestId("scan-miss").textContent()) ?? "").includes("9990001112223"),
    "a code no size has is said so",
  );
  await ctx.close();
}

sql(`update product_variant set barcode = null where id = '${WATER}'`);
await browser.close();
done("barcodes");
