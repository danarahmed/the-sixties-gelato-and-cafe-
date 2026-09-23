// Every screen, as every role. Signed out, each one sends you to sign-in.
// Signed in, each screen a role is offered renders (no error boundary); a
// screen it is not offered sends it to its own starting screen instead.
import { chromium, BASE, check, done, open, signIn } from "./lib.mjs";

const PAGES = [
  "/dashboard",
  "/sales",
  "/platforms",
  "/vendors",
  "/expenses",
  "/purchasing",
  "/pos",
  "/orders",
  "/products",
  "/inventory",
  "/count",
  "/production",
  "/journals",
  "/accounting",
  "/reports",
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

await browser.close();
done("pages");
