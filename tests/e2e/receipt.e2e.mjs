// The café's own receipt and each person's screens first (0091). The owner
// fills in the receipt on Settings — the names in Arabic and Kurdish, thanks
// in the three languages, Instagram, the Wi-Fi and a QR code to the reviews —
// watching the preview beside it; gives a logo; and the test print on Test
// your devices prints all of it. Reports puts the waste report first for the
// owner once it is opened most; the Dashboard is arranged for the owner and
// for a branch manager.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const REVIEWS = "https://g.page/r/sixties-test/review";
// A 1×1 PNG: the browser makes it small and sends it on.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

console.log("▸ the owner sets up the receipt on Settings");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  const card = page.getByTestId("settings-receipt");
  const preview = card.getByTestId("receipt-preview");
  await card.getByTestId("receipt-nameAr").fill("الستينات");
  await card.getByTestId("receipt-nameCkb").fill("شەستەکان");
  await card.getByTestId("receipt-thanksEn").fill("See you soon!");
  await card.getByTestId("receipt-thanksAr").fill("نراكم قريبًا");
  await card.getByTestId("receipt-thanksCkb").fill("بەم زووانە دەتانبینینەوە");
  await card.getByTestId("receipt-instagram").fill("@thesixties");
  await card.getByTestId("receipt-wifiName").fill("Sixties Guest");
  await card.getByTestId("receipt-wifiPassword").fill("gelato2026");
  const said = (await preview.textContent()) ?? "";
  check(
    said.includes("شەستەکان") && said.includes("See you soon!") && said.includes("gelato2026"),
    "the preview shows each line as it is typed",
  );
  check(said.includes("Instagram @thesixties"), "the @ is not doubled: Instagram @thesixties");

  await card.getByTestId("receipt-qr-review").click();
  await card.getByTestId("receipt-reviewUrl").fill("http://not-safe.example");
  await card.getByTestId("receipt-save").click();
  await card.getByText("A link starts with https:// and has no spaces").waitFor({ timeout: 15000 });
  check(true, "a link that is not https is refused");
  check(last(`select count(*) from receipt_setup`) === "0", "and nothing is saved");

  await card.getByTestId("receipt-reviewUrl").fill(REVIEWS);
  check(
    (await preview.locator('[data-testid="slip-qr"] svg').getAttribute("data-text")) === REVIEWS,
    "the preview's QR code leads to the reviews",
  );
  await card.getByTestId("receipt-save").click();
  await card.getByText("Saved: every receipt prints it from now on.").waitFor({ timeout: 15000 });
  check(
    last(
      `select instagram || ' ' || qr || ' ' || review_url || ' ' || wifi_name from receipt_setup`,
    ) === `thesixties review ${REVIEWS} Sixties Guest`,
    "saved as given, the @ left off",
  );

  await card.getByTestId("receipt-logo-file").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await preview.getByTestId("slip-logo").waitFor({ timeout: 15000 });
  check(
    last(`select count(*) from receipt_logo`) === "1",
    "a logo given, kept, and on the preview",
  );
  await ctx.close();
}

console.log("▸ the test print on Test your devices prints the café's receipt");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/devices");
  await page.evaluate(() => {
    window.__printed = [];
    window.print = () => {
      const slip = document.querySelector(".print-slip");
      window.__printed.push({
        text: slip?.textContent ?? "",
        qr: slip?.querySelector('[data-testid="slip-qr"] svg')?.getAttribute("data-text") ?? null,
        logo: !!slip?.querySelector('[data-testid="slip-logo"]'),
      });
    };
  });
  await page.getByTestId("device-printer-test").click();
  await page.waitForFunction(() => window.__printed.length > 0, null, { timeout: 5000 });
  const printed = await page.evaluate(() => window.__printed[0]);
  check(
    printed.text.includes("الستينات") &&
      printed.text.includes("شەستەکان") &&
      printed.text.includes("See you soon!") &&
      printed.text.includes("نراكم قريبًا") &&
      printed.text.includes("بەم زووانە دەتانبینینەوە"),
    "the café's names and its thanks in the three languages",
  );
  check(
    printed.text.includes("Sixties Guest") && printed.text.includes("gelato2026"),
    "the Wi-Fi and its password",
  );
  check(printed.qr === REVIEWS, "a QR code to the reviews");
  check(printed.logo, "and the logo");
  await ctx.close();
}

console.log("▸ Reports: the ones the owner opens most, first");
{
  sql(`delete from report_visit`);
  const { ctx, page } = await signIn(browser, "owner");
  for (let i = 1; i <= 3; i++) {
    await open(page, "/reports/waste");
    // Counted once the page is open in the browser.
    for (
      let n = 0;
      n < 50 && last(`select coalesce(max(visits), 0) from report_visit`) !== String(i);
      n++
    )
      await page.waitForTimeout(100);
  }
  check(
    last(`select path || ':' || visits from report_visit`) === "/reports/waste:3",
    "the waste report opened three times, counted for the owner",
  );
  await open(page, "/reports");
  const pages = page.getByTestId("report-pages");
  check(
    (await pages.locator(".drill").first().getAttribute("data-testid")) === "to-waste",
    "Reports puts it first",
  );
  check(await pages.getByTestId("reports-learned").isVisible(), "and says why");
  await ctx.close();
}

console.log("▸ the Dashboard arranged for each role");
// Before or after: which of today and what needs you comes first on the page.
const order = (page) =>
  page.evaluate(() => {
    const today = document.getElementById("dash-today");
    const needs = document.querySelector('[data-testid="needs-you"]');
    return today && needs
      ? today.compareDocumentPosition(needs) & Node.DOCUMENT_POSITION_FOLLOWING
        ? "today"
        : "needs"
      : null;
  });
for (const [who, lead, first] of [
  ["owner", "owner", "today"],
  ["manager", "branch", "needs"],
]) {
  const { ctx, page } = await signIn(browser, who);
  await open(page, "/dashboard");
  const dash = page.locator(".dash");
  check((await dash.getAttribute("data-arranged")) === lead, `${who}: arranged for the ${lead}`);
  const urgent = (await dash.getAttribute("data-urgent")) !== null;
  check(
    (await order(page)) === (urgent ? "needs" : first),
    urgent ? `${who}: something red, what needs them first` : `${who}: ${first} first`,
  );
  await ctx.close();
}

// The app's own receipt again, for the suites after this one.
sql(`delete from receipt_setup; delete from receipt_logo; delete from report_visit`);

await browser.close();
done("receipt");
