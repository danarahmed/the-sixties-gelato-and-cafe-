// Every screen, as every role. Signed out, each one sends you to sign-in.
// Signed in, each screen a role is offered renders (no error boundary); a
// screen it is not offered sends it to its own starting screen instead. And
// every screen fits a phone, and names each of its boxes, lists and buttons.
// The keyboard finds a way past the menu, and its place is always shown. And
// the browser is told its safeguards.
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
  "/start-of-day",
  "/end-of-day",
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
    const bar = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return {
        height: Math.round(document.querySelector(".topbar").getBoundingClientRect().height),
        language: Math.round(
          document.querySelector(".topbar select").getBoundingClientRect().width,
        ),
        // Nothing in the bar past either edge of the screen.
        off: [...document.querySelectorAll(".topbar *")]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.right > w + 1 || r.left < -1)).length,
      };
    });
    check(
      bar.height <= 64 && bar.language >= 60 && bar.off === 0,
      `in ${locale} at 390px the top bar is one line (${bar.height}px high), the language readable (${bar.language}px), nothing past the edge (${bar.off})`,
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
  // Settings → People on a phone: each person a card, their buttons in reach,
  // not off to the side in the table's own scroll.
  {
    const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
    await open(page, "/settings");
    const reach = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const boxes = [...document.querySelectorAll('[data-testid="people-table"] button')].map((b) =>
        b.getBoundingClientRect(),
      );
      return { n: boxes.length, out: boxes.filter((r) => r.right > w + 1 || r.left < -1).length };
    });
    check(
      reach.n > 0 && reach.out === 0,
      `Settings' people on a phone: ${reach.n} button(s), ${reach.out} out of reach`,
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

console.log(
  "▸ in Arabic and Kurdish: dates as written, arrows the way the words read, and on a phone",
);
{
  // A date among Arabic or Kurdish words showed back to front (30-09-2026)
  // while the same date alone showed as written (2026-09-30): each date on
  // the screen is read where it is drawn, its year to the left of its day.
  const backToFront = () => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.textContent;
      for (const m of s.matchAll(/\d{4}-\d{2}(?:-\d{2})?/g)) {
        const at = (from, to) => {
          const r = document.createRange();
          r.setStart(n, from);
          r.setEnd(n, to);
          return r.getBoundingClientRect();
        };
        const year = at(m.index, m.index + 4);
        const end = at(m.index + m[0].length - 2, m.index + m[0].length);
        if (!year.width || !end.width || Math.abs(year.top - end.top) > 4) continue;
        if (year.left > end.left) out.push(s.replace(/\s+/g, " ").trim().slice(0, 80));
      }
    }
    return out;
  };
  const SCREENS = [
    "/reports",
    "/accounting",
    "/reports/statements",
    "/audit",
    "/staff",
    "/production",
    "/inventory/usage",
  ];
  for (const locale of ["ar", "ckb"]) {
    const { ctx, page } = await signIn(browser, "owner");
    await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
    const found = [];
    let dates = 0;
    for (const path of SCREENS) {
      await open(page, path);
      found.push(...(await page.evaluate(backToFront)).map((s) => `${path}: ${s}`));
      dates += await page.evaluate(
        () => (document.body.innerText.match(/\d{4}-\d{2}/g) ?? []).length,
      );
    }
    check(
      dates > 0 && found.length === 0,
      `in ${locale}, ${dates} dates on ${SCREENS.length} screens, none back to front${found.length ? `: ${found.slice(0, 3).join(" | ")}` : ""}`,
    );
    // The rota's weeks: the one before points back (right), the one after on (left).
    await open(page, "/staff");
    const before = (await page.getByTestId("week-before").textContent()).trim();
    const after = (await page.getByTestId("week-after").textContent()).trim();
    check(
      before.startsWith("→") && after.endsWith("←"),
      `in ${locale}, the rota's arrows point the way the words read (${before} · ${after})`,
    );
    await ctx.close();
  }
  // The audit trail on a phone: a card per change, nothing off the screen.
  const { ctx, page } = await signIn(browser, "owner", { viewport: { width: 390, height: 900 } });
  await ctx.addCookies([{ name: "locale", value: "ckb", url: BASE }]);
  await open(page, "/audit");
  const trail = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const table = document.querySelector('[data-testid="audit-table"]');
    const cells = [...table.querySelectorAll("td")]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 0);
    return {
      head: getComputedStyle(table.querySelector("thead")).display,
      cells: cells.length,
      out: cells.filter((r) => r.right > w + 1 || r.left < -1).length,
    };
  });
  check(
    trail.head === "none" && trail.cells > 0 && trail.out === 0,
    `the audit trail on a phone is a card per change (${trail.cells} cells, ${trail.out} off the screen)`,
  );
  // The name on the top bar, in Kurdish: a Latin name left to right, cut with "…" at its end.
  const name = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector(".topbar .account-name"));
    return `${style.direction} ${style.textOverflow}`;
  });
  check(
    name === "ltr ellipsis",
    `in Kurdish the name on the top bar is cut at its own end (${name})`,
  );
  await ctx.close();
}

console.log("▸ every box, list and button has a name a screen reader can say");
{
  // A placeholder is not a name: it goes once something is typed. A button
  // that shows only × is said as "multiplication sign". Every <details> is
  // opened first, so the forms folded into them are looked at too. The
  // unit tests (a11y) check the boxes only a click opens.
  const SCREENS = [
    ...PAGES,
    "/sales/sessions",
    "/purchasing/buying-list",
    "/inventory/transfers",
    "/accounting/bank",
    "/reports/sales",
    "/reports/statements",
    "/reports/stock",
    "/settings/rules",
    "/settings/languages",
  ];
  const unnamed = () => {
    const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const by = (el) =>
      (el.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => text(document.getElementById(id)))
        .join(" ");
    const shown = (el) =>
      !el.hidden && !el.closest("[hidden]") && getComputedStyle(el).display !== "none";
    const where = (el) =>
      el.closest("[data-testid]")?.getAttribute("data-testid") ??
      el.closest("section, form, table, dialog")?.tagName.toLowerCase() ??
      "";
    const out = [];
    for (const el of document.querySelectorAll("input, select, textarea")) {
      if (el.type === "hidden" || !shown(el)) continue;
      const name =
        by(el) ||
        (el.getAttribute("aria-label") || "").trim() ||
        [...(el.labels ?? [])].map(text).join(" ") ||
        (el.getAttribute("title") || "").trim();
      if (!name) out.push(`${el.tagName.toLowerCase()} in ${where(el)}`);
    }
    for (const el of document.querySelectorAll("button, a[href]")) {
      if (!shown(el)) continue;
      const name =
        by(el) ||
        (el.getAttribute("aria-label") || "").trim() ||
        text(el) ||
        (el.getAttribute("title") || "").trim();
      if (!/[\p{L}\p{N}]/u.test(name))
        out.push(`${el.tagName.toLowerCase()} “${text(el)}” in ${where(el)}`);
    }
    return out;
  };
  const { ctx, page } = await signIn(browser, "owner");
  const found = [];
  for (const p of SCREENS) {
    await open(page, p);
    await page.evaluate(() => {
      for (const d of document.querySelectorAll("details")) d.open = true;
    });
    await page.waitForLoadState("networkidle");
    found.push(...(await page.evaluate(unnamed)).map((s) => `${p}: ${s}`));
  }
  check(
    found.length === 0,
    `on ${SCREENS.length} screens, every box, list and button is named${found.length ? ` (not: ${found.slice(0, 6).join("; ")})` : ""}`,
  );
  await ctx.close();
}

console.log("▸ the keyboard: a way past the menu, and where it is (AL)");
{
  // The first place the keyboard reaches is a way past the menu, which then
  // shows; it leads to the page. The menu is named, and the page shown is
  // marked in it. Wherever the keyboard is, a ring shows it: on a box with a
  // border of its own and on a tick box too, which showed nothing.
  const ring = (page) =>
    page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return {
        what: `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ""}`,
        ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2,
      };
    });
  for (const [locale, width] of [
    ["en", 1280],
    ["ckb", 390],
  ]) {
    const { ctx, page } = await signIn(browser, "owner", { viewport: { width, height: 900 } });
    await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
    await open(page, "/expenses");
    await page.keyboard.press("Tab");
    const skip = await page.evaluate(() => {
      const el = document.activeElement;
      const r = el.getBoundingClientRect();
      const w = document.documentElement.clientWidth;
      return {
        cls: el.className,
        text: el.textContent.trim(),
        seen: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= w,
      };
    });
    await page.keyboard.press("Enter");
    const landed = await page.evaluate(() => document.activeElement?.id ?? "");
    check(
      skip.cls === "skip-link" && skip.seen && skip.text !== "" && landed === "content",
      `in ${locale} at ${width}px, the first Tab shows the way past the menu (“${skip.text}”), and Enter goes to the page`,
    );
    await ctx.close();
  }
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/expenses");
  const menu = await page.evaluate(() => {
    const nav = document.querySelector("nav.sidenav");
    return {
      name: nav.getAttribute("aria-label"),
      current: [...nav.querySelectorAll('[aria-current="page"]')].map((a) =>
        a.getAttribute("href"),
      ),
    };
  });
  check(
    menu.name === "Menu" && JSON.stringify(menu.current) === JSON.stringify(["/expenses"]),
    `the menu is named (${menu.name}), and marks the page shown (${menu.current.join(", ")})`,
  );
  const seen = [];
  // A box of the underlined kind (Expenses), then one with a border of its own
  // (an advance on Payroll), then a tick box (Settings): each reached by Tab.
  await page.getByLabel("Narration", { exact: true }).focus();
  await page.keyboard.press("Tab");
  seen.push(await ring(page));
  await open(page, "/payroll");
  await page.getByTestId("give-advance").click();
  await page.getByTestId("advance-form").getByLabel("To", { exact: true }).focus();
  await page.keyboard.press("Tab");
  seen.push(await ring(page));
  await open(page, "/settings");
  const box = page.locator('input[type="checkbox"]').first();
  await box.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  seen.push(await ring(page));
  check(
    seen.length === 3 && seen.every((s) => s.ring) && seen[2].what === "input[checkbox]",
    `the keyboard's place is ringed: ${seen.map((s) => `${s.what} ${s.ring ? "✓" : "✗"}`).join(", ")}`,
  );
  await ctx.close();
}

console.log("▸ the browser's safeguards (AN)");
{
  // What the running app sends: a page may be shown inside no other site,
  // is read as what it is, and may not use the camera; a product's photo
  // (here one that is not there) goes without the pages' own policy.
  const { ctx, page } = await signIn(browser, "owner");
  const h = (await page.goto(`${BASE}/dashboard`)).headers();
  const photo = await ctx.request.get(
    `${BASE}/api/product-image/00000000-0000-0000-0000-000000000000`,
  );
  const ph = photo.headers();
  check(
    h["x-frame-options"] === "DENY" &&
      (h["content-security-policy"] ?? "").includes("frame-ancestors 'none'") &&
      h["x-content-type-options"] === "nosniff" &&
      h["referrer-policy"] === "strict-origin-when-cross-origin" &&
      (h["permissions-policy"] ?? "").includes("camera=()"),
    "a page is shown inside no other site, is read as what it is, and may not use the camera",
  );
  check(
    photo.status() === 404 &&
      ph["x-frame-options"] === "DENY" &&
      ph["content-security-policy"] === undefined,
    "a product's photo keeps its own policy, not the pages'",
  );
  await ctx.close();
}

await browser.close();
done("pages");
