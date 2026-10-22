#!/usr/bin/env node
// The guide's pictures: every screen, as the role that uses it, on the copy of
// the simulated year that scripts/guide/serve.sh serves (on the year's clock).
//
//   PGPORT=5434 E2E_DB=sixties_guide node scripts/guide/shots.mjs [name…]
//
// Each picture is named as the guide's entries name them (docs/guide/src),
// into $GUIDE_OUT/shots as JPEG. Records are only read, except where a step
// says so (a sale rung up to show the till's payment sheet…), on the copy.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, signIn, open, sql } from "../../tests/e2e/lib.mjs";
import { SHOTS as PAGES } from "./shot-list.mjs";
import { STATE_SHOTS } from "./shot-states.mjs";

const SHOTS = [...PAGES, ...STATE_SHOTS];

const OUT = join(process.env.GUIDE_OUT || "/tmp/sixties-guide/out", "shots");
mkdirSync(OUT, { recursive: true });
const CLOCK = readFileSync(process.env.GUIDE_CLOCK_FILE || "/tmp/sixties-guide/clock", "utf8").trim();
const only = new Set(process.argv.slice(2));

// Ids the screens with an id in their address need: read once.
const id = (q) => sql(q).split("\n")[0]?.trim();
export const IDS = {
  customer: () => id(`select c.id from customer c join sales_order o on o.customer_id = c.id group by c.id order by count(*) desc limit 1`),
  item: () => id(`select id from item where name = 'Coffee beans' limit 1`),
  payroll: () => id(`select id from payroll_run order by created_at desc limit 1`),
  batch: () => id(`select id from production_batch order by produced_at desc limit 1`),
  po: () => id(`select id from purchase_order order by updated_at desc limit 1`),
  session: () => id(`select id from work_shift where kind = 'session' and closed_at is not null order by closed_at desc limit 1`),
  supplier: () => id(`select id from supplier where name = 'Kurdistan Coffee Imports' limit 1`),
  receipt: () => id(`select id from goods_receipt order by received_at desc limit 1`),
};

const browser = await chromium.launch();
const sessions = new Map();
async function as(role, viewport) {
  const key = `${role}:${viewport.width}`;
  if (!sessions.has(key)) {
    const { ctx, page } = await signIn(browser, role, { viewport, deviceScaleFactor: 1 });
    await ctx.clock.install({ time: new Date(`${CLOCK.replace(" ", "T")}Z`) });
    // No "Show me around" offers in the pictures.
    await ctx.addInitScript(() => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) {
        return String(k).startsWith("sixties.tour.") ? "no" : get.call(this, k);
      };
    });
    sessions.set(key, { ctx, page });
  }
  return sessions.get(key);
}

let made = 0;
const failed = [];
for (const s of SHOTS) {
  if (only.size && !only.has(s.name)) continue;
  const viewport = s.phone ? { width: 390, height: 844 } : { width: 1280, height: s.height || 900 };
  try {
    if (s.sql) sql(s.sql);
    const { page } = await as(s.role || "owner", viewport);
    const path = typeof s.path === "function" ? s.path(IDS) : s.path;
    await open(page, path);
    if (s.then) await s.then(page);
    if (await page.getByText("This screen could not be loaded").count()) throw new Error("the screen's error page");
    if (s.expect && new URL(page.url()).pathname !== s.expect) throw new Error(`sent to ${new URL(page.url()).pathname}`);
    await page.waitForTimeout(250);
    const target = s.locator ? page.locator(s.locator).first() : page;
    await target.screenshot({ path: join(OUT, `${s.name}.jpg`), type: "jpeg", quality: 72, fullPage: !s.locator && !!s.full });
    if (s.after) await s.after(page);
    made++;
  } catch (err) {
    failed.push(`${s.name}: ${String(err.message).split("\n")[0]}`);
  }
}
for (const { ctx } of sessions.values()) await ctx.close();
await browser.close();
console.log(`pictures: ${made} made${failed.length ? `, ${failed.length} failed:\n  ${failed.join("\n  ")}` : ""}`);
