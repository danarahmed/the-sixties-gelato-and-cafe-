// Every screen, as every role. Signed out, each one sends you to sign-in.
// Signed in, each screen a role is offered renders (no error boundary); a
// screen it is not offered sends it to its own starting screen instead. And
// every screen fits a phone.
import { chromium, BASE, check, done, open, signIn } from "./lib.mjs";

const PAGES = [
  "/dashboard",
  "/sales",
  "/platforms",
  "/customers",
  "/vendors",
  "/expenses",
  "/purchasing",
  "/pos",
  "/orders",
  "/products",
  "/inventory",
  "/inventory/usage",
  "/count",
  "/production",
  "/staff",
  "/payroll",
  "/journals",
  "/accounting",
  "/reports",
  "/audit",
  "/settings",
  "/account",
];
const browser = await chromium.launch();

console.log("▸ signed out");
{
  const page = await browser.newPage();
  const leaks = [];
  for (const p of PAGES) {
    await page.goto(BASE + p);
    if (!new URL(page.url()).pathname.startsWith("/login")) leaks.push(p);
  }
  check(
    leaks.length === 0,
    `every screen sends you to sign-in${leaks.length ? ` (not: ${leaks.join(", ")})` : ""}`,
  );
  await page.close();
}

for (const who of ["owner", "manager", "cashier", "counter"]) {
  console.log(`▸ ${who}`);
  const { ctx, page } = await signIn(browser, who);
  if (who === "owner") {
    const session = (await ctx.cookies()).filter((c) => c.name.startsWith("sb-"));
    check(
      session.length > 0 && session.every((c) => c.httpOnly),
      "the session cookie is HTTP-only: no script in the page can read it",
    );
    check(
      (await page.evaluate(() => document.cookie))
        .split(";")
        .every((c) => !c.trim().startsWith("sb-")),
      "and document.cookie does not show it",
    );
  }
  const menu = await page.$$eval("nav.sidenav a", (as) => as.map((a) => a.getAttribute("href")));
  console.log(`    menu: ${menu.join(" ")}`);
  const problems = [];
  for (const p of PAGES) {
    const res = await open(page, p);
    const path = new URL(page.url()).pathname;
    const text = (await page.textContent("main")) ?? "";
    if (text.includes("could not be loaded")) problems.push(`${p}: error boundary`);
    else if (res.status() >= 500) problems.push(`${p}: HTTP ${res.status()}`);
    else if (menu.includes(p) && path !== p)
      problems.push(`${p}: offered but redirected to ${path}`);
    else if (!menu.includes(p) && p !== "/account" && path === p)
      problems.push(`${p}: not offered but shown`);
  }
  check(
    problems.length === 0,
    `${PAGES.length} screens behave${problems.length ? `: ${problems.join("; ")}` : ""}`,
  );
  await ctx.close();
}

// What each role is offered, exactly.
const expected = { cashier: ["/pos", "/account"], counter: ["/count", "/account"] };
for (const [who, want] of Object.entries(expected)) {
  const { ctx, page } = await signIn(browser, who);
  const menu = await page.$$eval("nav.sidenav a", (as) => as.map((a) => a.getAttribute("href")));
  check(
    JSON.stringify(menu) === JSON.stringify(want),
    `${who} is offered exactly ${want.join(", ")}`,
  );
  await ctx.close();
}

console.log("▸ on a phone");
{
  // 390px wide: nothing reaches past the screen or is cut off. A wide table,
  // the till's category chips or a vendor's tabs scroll inside their own box.
  const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
  const wide = [];
  for (const p of PAGES) {
    await open(page, p);
    const over = await page.evaluate(() => {
      const main = document.querySelector("main");
      let worst = main.scrollWidth - main.clientWidth;
      for (const el of main.querySelectorAll("*")) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        let edge = document.documentElement.clientWidth;
        for (let e = el.parentElement; e && e !== main; e = e.parentElement) {
          const ox = getComputedStyle(e).overflowX;
          if (ox === "auto" || ox === "scroll") edge = Infinity;
          else if (ox !== "visible") edge = e.getBoundingClientRect().right;
          else continue;
          break;
        }
        worst = Math.max(worst, b.right - edge);
      }
      return Math.round(worst);
    });
    if (over > 1) wide.push(`${p} by ${over}px`);
  }
  check(
    wide.length === 0,
    `every screen fits a 390px phone${wide.length ? ` (not: ${wide.join(", ")})` : ""}`,
  );
  await ctx.close();
}

console.log("▸ right to left, in Arabic and Kurdish");
{
  // The whole page, its header and menu too, within the screen: in a
  // right-to-left page anything past the left edge widens the page, and the
  // screen scrolls sideways into nothing.
  for (const [locale, width] of [
    ["en", 1280],
    ["ar", 1280],
    ["ckb", 390],
  ]) {
    const { ctx, page } = await signIn(browser, "owner", { viewport: { width, height: 900 } });
    await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
    const wide = [];
    for (const p of PAGES) {
      await open(page, p);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (over > 1) wide.push(`${p} by ${over}px`);
    }
    check(
      wide.length === 0,
      `every screen fits, in ${locale} at ${width}px${wide.length ? ` (not: ${wide.join(", ")})` : ""}`,
    );
    await ctx.close();
  }

  // The menu that slides in from ☰ (on a phone, and on the till at any
  // width): out of sight until asked for, then wholly in view, from the side
  // the reading starts.
  const menu = (page) =>
    page.evaluate(() => {
      const r = document.querySelector(".sidenav").getBoundingClientRect();
      const w = document.documentElement.clientWidth;
      return { hidden: r.right <= 0 || r.left >= w, shown: r.left >= -1 && r.right <= w + 1, r };
    });
  for (const [locale, width, path] of [
    ["en", 390, "/dashboard"],
    ["ckb", 390, "/dashboard"],
    ["ar", 1280, "/pos"],
    ["en", 1280, "/pos"],
  ]) {
    const { ctx, page } = await signIn(browser, "owner", { viewport: { width, height: 900 } });
    await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
    await open(page, path);
    const closed = await menu(page);
    await page.locator(".menu-toggle").click();
    await page.waitForTimeout(400); // the slide takes 0.2s
    const opened = await menu(page);
    check(
      closed.hidden && opened.shown,
      `the menu on ${path} in ${locale} at ${width}px: hidden, then in view when opened` +
        (closed.hidden && opened.shown
          ? ""
          : ` (closed ${JSON.stringify(closed.r)}, open ${JSON.stringify(opened.r)})`),
    );
    await ctx.close();
  }
}

console.log("▸ the phone's top bar, the till's categories and tick boxes, as they should look");
{
  // The café's name gives way on a phone, cut with "…"; the controls, the
  // language among them, stay readable on one line.
  for (const locale of ["en", "ar"]) {
    const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
    await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
    await open(page, "/dashboard");
    const bar = await page.evaluate(() => ({
      height: Math.round(document.querySelector(".topbar").getBoundingClientRect().height),
      language: Math.round(document.querySelector(".topbar select").getBoundingClientRect().width),
    }));
    check(
      bar.height <= 64 && bar.language >= 60,
      `in ${locale} at 390px the top bar is one line (${bar.height}px high), the language readable (${bar.language}px)`,
    );
    await ctx.close();
  }
  // A product with no category is under "No category", not a second "Other".
  {
    const { ctx, page } = await signIn(browser, "cashier");
    await open(page, "/pos");
    const labels = (await page.locator(".chip .chip-label").allTextContents()).map((l) => l.trim());
    check(
      labels.length > 0 && new Set(labels).size === labels.length,
      `the till's categories are each named once (${labels.join(", ")})`,
    );
    await ctx.close();
  }
  // Tick boxes keep a tick box's size: Settings' roles were large empty squares.
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('input[type="checkbox"]')]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => Math.round(Math.max(r.width, r.height))),
  );
  check(
    boxes.length > 0 && boxes.every((x) => x <= 24),
    `Settings' tick boxes are tick boxes (the largest ${Math.max(...boxes)}px)`,
  );
  await ctx.close();
}

await browser.close();
done("pages");
