// Audit H-04: offline, the app says plainly that sales cannot be recorded and
// the till will not take one — in English, Arabic and Kurdish, right to left
// where the language is.
import { chromium, BASE, check, done, open, signIn } from "./lib.mjs";

const browser = await chromium.launch();
for (const locale of ["en", "ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "cashier");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/pos");
  const dir = await page.evaluate(() => document.documentElement.dir);
  check(dir === (locale === "en" ? "ltr" : "rtl"), `${locale}: written ${dir}`);
  await page.locator(".product-tile").first().click();
  await ctx.setOffline(true);
  await page.waitForTimeout(300);
  const banner =
    (await page
      .locator(".offline-banner")
      .textContent()
      .catch(() => "")) ?? "";
  check(banner.length > 0, `${locale}: offline banner — “${banner}”`);
  check(
    await page.locator(".pos-grid button.btn-primary").first().isDisabled(),
    `${locale}: checkout is disabled`,
  );
  await ctx.setOffline(false);
  await page.waitForTimeout(300);
  check(
    (await page.locator(".offline-banner").count()) === 0,
    `${locale}: the banner clears when the connection returns`,
  );
  await ctx.close();
}
await browser.close();
done("offline");
