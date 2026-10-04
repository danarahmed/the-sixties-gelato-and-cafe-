// Shared helpers for the end-to-end checks. Local only: these drive the real
// app, through a real PostgREST, against a scratch database built from the
// migrations — never against a deployed project.
import { execFileSync } from "node:child_process";

const pw = await import(process.env.PLAYWRIGHT_MJS || "playwright");
export const chromium = pw.chromium;
export const BASE = process.env.E2E_BASE || "http://127.0.0.1:3100";
export const PASSWORD = "password123";
/** The café's day, as the app and the database's functions count it: in its
 *  own time zone, Baghdad's. `current_date` is the scratch database's, in UTC:
 *  from 21:00 to midnight UTC it is still yesterday there. Written out, so it
 *  also works once a query has signed in as someone (test.act_as). */
export const TODAY = "(now() at time zone 'Asia/Baghdad')::date";

let failures = 0;
export function check(cond, message) {
  console.log(`  ${cond ? "✓" : "✗"} ${message}`);
  if (!cond) failures++;
}
/** One of Inventory's forms, opened from its button unless it is open already. */
export async function inventoryForm(page, key, testid) {
  const form = page.getByTestId(testid);
  if ((await form.count()) === 0) await page.getByTestId(`inv-open-${key}`).click();
  await form.waitFor({ timeout: 10000 });
  return form;
}

/** "1 bill", "3 bills": a count as the screens write it. */
export function counted(n, one, many = `${one}s`) {
  return `${n} ${Number(n) === 1 ? one : many}`;
}
export function done(what) {
  console.log(failures ? `\n${what}: ${failures} failure(s)` : `\n${what}: all passed`);
  process.exit(failures ? 1 : 0);
}

/** A query against the scratch database, as its superuser (ground truth). */
export function sql(query) {
  return execFileSync("psql", ["-X", "-At", "-d", process.env.E2E_DB || "sixties_e2e", "-c", query])
    .toString()
    .trim();
}

/**
 * In every page: whether React hydrated the menu bar while the page was still
 * arriving. A page's data streams in after its HTML; hydrating a long one (the
 * audit trail) before all of it was in made React hydrate an element a second
 * time, from the wrong place (a hydration error, React's #418, now and then).
 * The shell holds hydration back until the whole page is in (AppShell), and
 * open() checks it did.
 */
function watchHydration() {
  const look = () => {
    if (document.readyState !== "loading") return;
    const bar = document.querySelector("header.topbar");
    if (bar && Object.keys(bar).some((k) => k.startsWith("__reactFiber$"))) {
      window.__hydratedEarly = true;
      return;
    }
    setTimeout(look, 0);
  };
  look();
}

/** A browser context signed in as one of the fixture people. */
export async function signIn(browser, who, options = {}) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript(watchHydration);
  const page = await ctx.newPage();
  // The page it happened on, for an error that comes and goes.
  page.on("pageerror", (e) =>
    check(false, `${who}: browser error on ${new URL(page.url()).pathname}: ${e.message}`),
  );
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', `${who}@example.com`);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login")),
    page.click('button[type="submit"]'),
  ]);
  return { ctx, page };
}

/** Open a screen and wait until it is interactive. */
export async function open(page, path) {
  const res = await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
  if (await page.evaluate(() => window.__hydratedEarly === true))
    check(false, `${path}: hydrated before the whole page had arrived`);
  return res;
}
