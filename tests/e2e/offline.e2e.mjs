// Audit H-04: offline, the app says plainly that sales cannot be recorded and
// the till will not take one — in English, Arabic and Kurdish, right to left
// where the language is. And on a slow connection, each page is hydrated once.
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

// A slow connection (or the service worker) can bring a part's code after its
// page. Each page is still hydrated once, whole: before AppShell waited for
// every script, React's #418 (a browser error, which fails signIn's check)
// came on about 1 load in 15 with the code up to 1.5 s late.
{
  const { ctx, page } = await signIn(browser, "owner", { serviceWorkers: "block" });
  await ctx.route("**/_next/static/chunks/**/*.js", async (route) => {
    await new Promise((r) => setTimeout(r, Math.random() * 1500));
    await route.continue();
  });
  for (let i = 0; i < 3; i++)
    for (const path of ["/dashboard", "/pos", "/staff", "/reports"]) await open(page, path);
  check(true, "twelve pages whose code came late, each hydrated once");
  await ctx.close();
}
await browser.close();
done("offline");
