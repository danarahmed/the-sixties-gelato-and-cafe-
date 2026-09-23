// Shared helpers for the end-to-end checks. Local only: these drive the real
// app, through a real PostgREST, against a scratch database built from the
// migrations — never against a deployed project.
import { execFileSync } from "node:child_process";

const pw = await import(process.env.PLAYWRIGHT_MJS || "playwright");
export const chromium = pw.chromium;
export const BASE = process.env.E2E_BASE || "http://127.0.0.1:3100";
export const PASSWORD = "password123";

let failures = 0;
export function check(cond, message) {
  console.log(`  ${cond ? "✓" : "✗"} ${message}`);
  if (!cond) failures++;
}
export function done(what) {
  console.log(failures ? `\n${what}: ${failures} failure(s)` : `\n${what}: all passed`);
  process.exit(failures ? 1 : 0);
}

/** A query against the scratch database, as its superuser (ground truth). */
export function sql(query) {
  return execFileSync("psql", ["-X", "-At", "-d", process.env.E2E_DB || "sixties_e2e", "-c", query]).toString().trim();
}

/** A browser context signed in as one of the fixture people. */
export async function signIn(browser, who, options = {}) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => check(false, `${who}: browser error ${e.message}`));
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', `${who}@example.com`);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('button[type="submit"]')]);
  return { ctx, page };
}

/** Open a screen and wait until it is interactive. */
export async function open(page, path) {
  const res = await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
  return res;
}
