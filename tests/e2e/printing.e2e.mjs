// Every report printed or saved as a PDF (release AA), through the real
// screens: each report screen has the button; pressed, it readies the print
// layout before the print dialog opens; on paper the page leaves out the menu,
// the forms and the buttons, and carries a heading with the café, the report,
// its dates and when it was read; the browser prints it to a PDF; in Arabic
// the heading prints right to left, in Arabic.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const today = last(`select ${TODAY}`);
const item = last(`select id from item order by name limit 1`);
const session = last(`select id from work_shift order by opened_at limit 1`);
const payroll = last(
  `select coalesce((select id::text from payroll_run order by created_at limit 1), '')`,
);

const REPORTS = [
  "/reports",
  `/reports/sales?from=${today}&to=${today}`,
  `/reports/stock?on=${today}`,
  `/reports/statements?from=${today}&to=${today}`,
  "/accounting",
  "/audit",
  "/journals",
  "/journals?account=1000",
  "/inventory/usage",
  `/inventory/${item}`,
  `/sales/sessions/${session}`,
  ...(payroll ? [`/payroll/${payroll}`] : []),
];

console.log("▸ every report screen can be printed");
{
  const { ctx, page } = await signIn(browser, "owner");
  const missing = [];
  for (const path of REPORTS) {
    await open(page, path);
    const button = await page.getByTestId("print-report").count();
    const head = page.getByTestId("print-head");
    const onScreen = (await head.count()) === 1 && !(await head.isVisible());
    if (button !== 1 || !onScreen) missing.push(path);
  }
  check(
    missing.length === 0,
    `${REPORTS.length} report screens carry the button, and a heading kept for the paper` +
      (missing.length ? `: not ${missing.join(", ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ on A4, every report fits the width of the paper, in each language");
{
  // A4 upright is 210 mm; less the 10 mm margins, 190 mm: 718 px at 96 a inch.
  const { ctx, page } = await signIn(browser, "owner");
  await page.setViewportSize({ width: 718, height: 1000 });
  const cut = [];
  for (const [locale, path] of ["en", "ar", "ckb"].flatMap((l) => REPORTS.map((p) => [l, p]))) {
    await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
    await open(page, path);
    await page.evaluate(() => document.documentElement.classList.add("printing-report"));
    await page.emulateMedia({ media: "print" });
    const past = await page.evaluate(() => {
      const edge = document.documentElement.clientWidth;
      const out = [];
      if (document.documentElement.scrollWidth > edge + 1)
        out.push(`the page ${document.documentElement.scrollWidth}px`);
      for (const t of document.querySelectorAll("table")) {
        const r = t.getBoundingClientRect();
        if (r.width > 0 && (r.right > edge + 1 || r.left < -1)) {
          const named = t.closest("[data-testid]")?.getAttribute("data-testid") ?? "a table";
          out.push(`${named} ${Math.round(r.width)}px`);
        }
      }
      return out;
    });
    if (past.length) cut.push(`${path} (${locale}): ${past.join(", ")}`);
    await page.emulateMedia({ media: "screen" });
  }
  check(
    cut.length === 0,
    `nothing runs past the edge of the paper, in English, Arabic or Kurdish` +
      (cut.length ? `: ${cut.join("; ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ the balance sheet and cash flow, on paper");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/reports/statements?from=${today}&to=${today}`);
  // The print dialog itself is the browser's: here it only notes what it would print.
  await page.evaluate(() => {
    window.__printing = null;
    window.print = () => {
      window.__printing = document.documentElement.classList.contains("printing-report");
    };
  });
  await page.getByTestId("print-report").click();
  check(
    (await page.evaluate(() => window.__printing)) === true,
    "the button readies the print layout before printing",
  );
  await page.emulateMedia({ media: "print" });
  const visible = async (sel) => page.locator(sel).first().isVisible();
  check(!(await visible(".sidenav")) && !(await visible(".topbar")), "no menu, no top bar");
  check(!(await visible("form")) && !(await visible("button")), "no forms, no buttons");
  check(
    (await visible('[data-testid="balance-sheet"]')) &&
      (await visible('[data-testid="cash-flow"]')),
    "the statements themselves",
  );
  const head = page.getByTestId("print-head");
  check(
    (await head.isVisible()) &&
      (await head.textContent()).includes("Balance sheet and cash flow") &&
      (await head.textContent()).includes(`${today} to ${today}`),
    "headed with the report and its dates",
  );
  const pdf = await page.pdf({ format: "A4" });
  check(
    pdf.subarray(0, 4).toString() === "%PDF" && pdf.length > 5000,
    `saved as a PDF (${Math.round(pdf.length / 1024)} KB)`,
  );
  await ctx.close();
}

console.log("▸ in Arabic, right to left");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, `/reports/statements?from=${today}&to=${today}`);
  await page.evaluate(() => document.documentElement.classList.add("printing-report"));
  await page.emulateMedia({ media: "print" });
  const head = page.getByTestId("print-head");
  check(
    (await page.evaluate(() => document.documentElement.dir)) === "rtl" &&
      (await head.isVisible()) &&
      (await head.textContent()).includes("بتاريخ"),
    "the page and its heading print right to left, in Arabic",
  );
  const pdf = await page.pdf({ format: "A4" });
  check(pdf.subarray(0, 4).toString() === "%PDF", "and save as a PDF");
  await ctx.close();
}

await browser.close();
done("printing");
