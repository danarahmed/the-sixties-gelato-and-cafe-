// The practice tasks' short videos (G5), recorded in a practice café through
// the real screens: for each task, someone whose role has it starts (or
// carries on) practising, and the browser records them doing just that task,
// at a pace a new member of staff can follow, from the screen it begins on to
// the screen saying it is done. Each video is shrunk with ffmpeg into
// public/help/videos/<task>.webm, and the task is checked ticked in the
// database. Not in the default list: run by hand to re-record,
//   scripts/test-e2e.sh videos
//   VIDEOS_ONLY=sell_card,refund scripts/test-e2e.sh videos   # some of them
// then put the seconds it prints in src/lib/help/videos.ts (VIDEOS).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BASE, PASSWORD, chromium, check, done, sql } from "./lib.mjs";

const browser = await chromium.launch();
const SIZE = { width: 1024, height: 640 };
const OUT = "public/help/videos";
const RAW = mkdtempSync(join(tmpdir(), "sixties-videos-"));
mkdirSync(OUT, { recursive: true });
const only = (process.env.VIDEOS_ONLY ?? "").split(",").filter(Boolean);
const last = (q) => sql(q).split("\n").pop();
const made = [];
let failed = false;

// -------------------------------------------------------------- the practice café
/** The practice café of a fixture person, and its places. */
function cafe(who) {
  const biz =
    last(`select w.business_id from practice_twin t join app_user u on u.id = t.app_user_id
                      join app_user w on w.id = t.twin_id where u.email = '${who}@example.com'`);
  const place = (kind) =>
    last(`select id from location where business_id = '${biz}' and kind = '${kind}'`);
  return { biz, branch: place("branch"), kitchen: place("central_kitchen") };
}
/** As the person, practising: a query the way their screens make it. */
const practising = (who, query) =>
  last(`select test.act_as('${who}@example.com');
        select set_config('request.headers', '{"x-sixties-practice": "1"}', false);
        ${query}`);
const variant = (biz, product, size) =>
  last(`select v.id from product_variant v join product p on p.id = v.product_id
         where p.business_id = '${biz}' and p.name = '${product}' and v.name = '${size}'`);
/** What the practice drawer holds: as counting it would find. */
const holds = (who) => {
  const { biz, branch } = cafe(who);
  return Number(
    last(`select trim_scale(d.carry + d.moved) from drawer_position('${biz}', '${branch}') d`),
  );
};
function ticked(who, task) {
  const state = JSON.parse(
    last(`select test.act_as('${who}@example.com'); select practice_tasks()`),
  );
  return state.tasks.some((t) => t.task === task && t.done_at);
}

// The barista is not among the fixtures' people: one of their own, as production's suite adds.
sql(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com')
       on conflict do nothing;
     insert into app_user (business_id, full_name, email, auth_user_id)
     select '00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com',
            'a0000000-0000-0000-0000-00000000000e'
      where not exists (select 1 from app_user where email = 'barista@example.com');
     insert into user_role (app_user_id, role)
     select id, 'barista' from app_user where email = 'barista@example.com'
        and not exists (select 1 from user_role r where r.app_user_id = app_user.id);`);

// -------------------------------------------------------------- a calm pace
/**
 * A pointer drawn on the page: the browser's own is not in its recording.
 * It follows the mouse, shrinks as it presses, and stays where it was when a
 * new page opens.
 */
function pointer() {
  const KEY = "__videoPointer";
  const el = () => {
    let c = document.getElementById(KEY);
    if (!c && document.body) {
      c = document.createElement("div");
      c.id = KEY;
      c.style.cssText =
        "position:fixed;z-index:2147483647;pointer-events:none;width:26px;height:26px;" +
        "margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,170,0,.35);" +
        "border:3px solid rgba(214,92,0,.95);box-shadow:0 0 0 2px rgba(255,255,255,.8);" +
        "transition:transform .12s ease-out;left:-60px;top:-60px";
      try {
        const at = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
        if (at) Object.assign(c.style, { left: `${at.x}px`, top: `${at.y}px` });
      } catch {
        /* a pointer from nowhere, then */
      }
      document.body.appendChild(c);
    }
    return c;
  };
  addEventListener(
    "mousemove",
    (e) => {
      const c = el();
      if (!c) return;
      Object.assign(c.style, { left: `${e.clientX}px`, top: `${e.clientY}px` });
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ x: e.clientX, y: e.clientY }));
      } catch {
        /* kept only on this page */
      }
    },
    true,
  );
  addEventListener("mousedown", () => el() && (el().style.transform = "scale(.65)"), true);
  addEventListener("mouseup", () => el() && (el().style.transform = "scale(1)"), true);
  addEventListener("load", () => el());
}

const wait = (page, ms = 600) => page.waitForTimeout(ms);
/** The pointer goes to it, and it is pressed. */
async function tap(page, loc, after = 700) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (b) {
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 14 });
    await wait(page, 300);
  }
  await loc.click();
  await wait(page, after);
}
/** Typed into, a key at a time. */
async function type(page, loc, text) {
  await tap(page, loc, 250);
  await loc.fill("");
  await loc.pressSequentially(String(text), { delay: 120 });
  await wait(page, 500);
}
/** A choice made from a list. */
async function choose(page, loc, option) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 14 });
  await wait(page, 400);
  await loc.selectOption(option);
  await wait(page, 700);
}

// -------------------------------------------------------------- recording
/** Signed in, practising: what the recording begins with. */
async function practice(who) {
  const ctx = await browser.newContext({ viewport: SIZE });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', `${who}@example.com`);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login")),
    page.click('button[type="submit"]'),
  ]);
  await page.goto(`${BASE}/practice`);
  await page.getByTestId("practice-start").click();
  await page.getByTestId("practice-banner").waitFor({ timeout: 15000 });
  await page.waitForLoadState("networkidle");
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

/**
 * One task's video: recorded from the screen it begins on, cut to begin
 * there, shrunk, and its task checked ticked.
 */
async function record(task, who, path, steps) {
  if (only.length && !only.includes(task)) return;
  console.log(`▸ ${task}, as the ${who}`);
  const state = await practice(who);
  const ctx = await browser.newContext({
    viewport: SIZE,
    storageState: state,
    recordVideo: { dir: RAW, size: SIZE },
  });
  await ctx.addInitScript(pointer);
  const page = await ctx.newPage();
  const began = Date.now();
  page.on("pageerror", (e) => check(false, `${task}: browser error: ${e.message}`));
  let ok = true;
  let from = 0;
  try {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("practice-banner").waitFor({ timeout: 10000 });
    from = (Date.now() - began) / 1000;
    await page.mouse.move(SIZE.width / 2, SIZE.height / 2);
    await wait(page, 1200);
    await steps(page);
    await wait(page, 2500);
  } catch (e) {
    ok = false;
    failed = true;
    check(false, `${task}: ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: join(RAW, `${task}-failed.png`) }).catch(() => {});
    console.log(`    (what the screen showed: ${join(RAW, `${task}-failed.png`)})`);
  }
  const raw = await page.video().path();
  await ctx.close();
  if (!ok) return;
  check(ticked(who, task), `${task}: ticked in ${who}'s practice`);
  const out = join(OUT, `${task}.webm`);
  execFileSync("ffmpeg", [
    ...["-y", "-loglevel", "error", "-i", raw, "-ss", from.toFixed(2)],
    ...["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-an", "-r", "24"],
    ...["-vf", "scale=1024:-2", "-row-mt", "1", out],
  ]);
  const seconds = Math.round(
    Number(
      execFileSync("ffprobe", [
        ...["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
      ]).toString(),
    ),
  );
  const kb = Math.round(statSync(out).size / 1024);
  check(seconds >= 5 && kb < 1024, `${task}: ${seconds} s, ${kb} KB, in ${out}`);
  made.push({ task, seconds, kb });
}

const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const tile = (page, name) => page.locator(".product-tile", { hasText: name });
const size = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
const recorded = (page) => page.getByText("Sale recorded").waitFor({ timeout: 15000 });

// -------------------------------------------------------------- the till (a cashier)
await record("open_drawer", "cashier", "/pos", async (page) => {
  await tap(page, page.getByTestId("drawer-button"));
  const drawer = page.getByTestId("drawer-panel");
  await drawer.getByTestId("drawer-closed").waitFor({ timeout: 10000 });
  await tap(page, drawer.getByRole("button", { name: "Open the drawer" }));
  await type(page, drawer.getByLabel("Cash counted", { exact: true }), holds("cashier"));
  await tap(page, drawer.getByRole("button", { name: "Open the drawer" }));
  await drawer.getByTestId("drawer-answer").waitFor({ timeout: 15000 });
});

await record("sell_card", "cashier", "/pos", async (page) => {
  await tap(page, tab(page, "Menu"));
  for (let i = 0; i < 2; i++) {
    await tap(page, tile(page, "Latte"));
    await tap(page, size(page, "Small"));
  }
  await tap(page, page.getByRole("button", { name: /Card/ }).first());
  await tap(page, page.locator(".pay-confirm"));
  await recorded(page);
});

await record("sell_cash", "cashier", "/pos", async (page) => {
  await tap(page, tab(page, "Menu"));
  await tap(page, tile(page, "Espresso"));
  await tap(page, page.getByRole("button", { name: /Cash/ }).first());
  await type(page, page.locator("#cash-received"), "5000");
  await page.locator(".pay-modal .change-amt").waitFor({ timeout: 10000 });
  await wait(page, 1500);
  await tap(page, page.locator(".pay-confirm"));
  await recorded(page);
});

await record("discount", "cashier", "/pos", async (page) => {
  await tap(page, tab(page, "Menu"));
  await tap(page, tile(page, "Espresso"));
  await tap(page, tile(page, "Croissant"));
  await tap(page, tile(page, "Water"));
  await tap(page, page.getByRole("button", { name: "＋ Discount" }));
  await type(page, page.getByLabel("Discount as a percentage"), "10");
  await choose(page, page.getByLabel("Why?"), "regular");
  await wait(page, 800);
  await tap(page, page.getByRole("button", { name: /Card/ }).first());
  await tap(page, page.locator(".pay-confirm"));
  await recorded(page);
});

await record("table_bill", "cashier", "/pos", async (page) => {
  const table = page.locator(".table-tile", { hasText: "Table 1" });
  await tap(page, table);
  await tap(page, tile(page, "Latte"));
  await tap(page, size(page, "Large"));
  await tap(page, tile(page, "Croissant"));
  await tap(page, page.getByRole("button", { name: /Save/ }));
  await page.getByText("Table 1 — saved").waitFor({ timeout: 15000 });
  await wait(page, 1200);
  await tap(page, table);
  await tap(page, page.getByRole("button", { name: /Card/ }).first());
  await tap(page, page.locator(".pay-confirm"));
  await recorded(page);
});

await record("close_drawer", "cashier", "/pos", async (page) => {
  await tap(page, page.getByTestId("drawer-button"));
  const drawer = page.getByTestId("drawer-panel");
  await drawer.getByTestId("drawer-open").waitFor({ timeout: 10000 });
  await tap(page, drawer.getByRole("button", { name: "Close the drawer" }));
  await type(page, drawer.getByLabel("Cash counted", { exact: true }), holds("cashier"));
  await tap(page, drawer.getByRole("button", { name: "Close the drawer" }));
  await drawer.getByTestId("drawer-answer").waitFor({ timeout: 15000 });
});

// -------------------------------------------------------------- stock (a barista, a counter)
await record("waste", "barista", "/inventory", async (page) => {
  const form = page.getByTestId("record-loss");
  await form.waitFor({ timeout: 10000 });
  await choose(page, form.getByLabel("What kind of loss"), "damaged");
  await choose(page, form.getByLabel("Item"), { label: "Croissant" });
  await type(page, form.getByLabel("Quantity lost"), "1");
  await type(page, form.getByLabel("Why (required)"), "Dropped on the floor");
  await tap(page, form.getByRole("button", { name: "Record the loss" }));
  await form.getByText(/^Recorded/).waitFor({ timeout: 15000 });
});

// Omar's count waits for review at the branch, and one count at a time is
// taken at a place: the counter counts the kitchen.
await record("count", "counter", "/count", async (page) => {
  const { biz, kitchen } = cafe("counter");
  await choose(page, page.getByTestId("place-choice"), kitchen);
  await page.waitForLoadState("networkidle");
  await wait(page, 800);
  await tap(page, page.getByRole("button", { name: "Start count" }));
  await page.getByText("Your count").waitFor({ timeout: 15000 });
  await wait(page, 800);
  const inputs = page.locator('input[aria-label^="Counted"]');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const name = ((await inputs.nth(i).getAttribute("aria-label")) ?? "").replace(
      /^Counted\s*/,
      "",
    );
    const qty = last(`select coalesce(trim_scale(p.qty), 0) from item i
                        cross join lateral item_position('${biz}', i.id, '${kitchen}') p
                       where i.business_id = '${biz}' and '${name.replace(/'/g, "''")}' like '%' || i.name || '%'
                       limit 1`);
    await type(page, inputs.nth(i), qty || "0");
    await inputs.nth(i).blur();
  }
  await page.waitForFunction((k) => document.body.innerText.includes(`${k} of ${k} counted`), n, {
    timeout: 20000,
  });
  await tap(page, page.getByRole("button", { name: "Submit count" }));
  // The sheet says so, then gives way to the list, where the count waits for its review.
  await page
    .locator("tbody tr", { hasText: "Practice kitchen" })
    .filter({ hasText: "Waiting for review" })
    .waitFor({ timeout: 15000 });
});

// -------------------------------------------------------------- a manager
/** Two sales by card in the manager's practice café, to refund and to void. */
function managerSales() {
  practising("manager", "select practice_start()");
  const { biz } = cafe("manager");
  const lines = JSON.stringify([
    { variant_id: variant(biz, "Latte", "Small"), qty: 1 },
    { variant_id: variant(biz, "Croissant", "Each"), qty: 1 },
  ]);
  return [0, 1].map(() =>
    practising(
      "manager",
      `select record_sale(gen_random_uuid(), 'dine_in', 'card', '${lines}') ->> 'order_id'`,
    ),
  );
}
const [toRefund, toVoid] =
  only.length && !only.includes("refund") && !only.includes("void") ? [] : managerSales();
const orderRow = (page, sale) => page.locator("tbody tr", { hasText: sale.slice(0, 8) });

await record("refund", "manager", "/orders", async (page) => {
  await tap(page, orderRow(page, toRefund).getByRole("button", { name: "Refund" }));
  const dialog = page.getByTestId("refund-dialog");
  await dialog.waitFor({ timeout: 10000 });
  await type(page, dialog.getByLabel(/^How many of Latte/), "0");
  await type(page, dialog.getByLabel(/^How many of Croissant/), "1");
  await choose(page, dialog.getByLabel("Why refund it?"), "quality");
  await tap(page, dialog.getByRole("button", { name: "Confirm refund" }));
  await dialog.getByTestId("refund-answer").waitFor({ timeout: 15000 });
});

await record("void", "manager", "/orders", async (page) => {
  await tap(page, orderRow(page, toVoid).getByRole("button", { name: "Void" }));
  const fix = page.getByTestId("order-correction");
  await wait(page, 500);
  await choose(page, fix.getByLabel("Why void it?"), "rang_twice");
  await tap(page, fix.getByRole("button", { name: "Confirm void" }));
  await page.getByText(/^Voided/).waitFor({ timeout: 15000 });
});

await record("approve_count", "manager", "/count", async (page) => {
  await tap(page, page.getByRole("link", { name: "Review" }).first());
  await page.getByText("Review — count").waitFor({ timeout: 15000 });
  await wait(page, 800);
  // What is short: two paper cups.
  const short = page.locator("tr", { hasText: "Paper cup" }).first();
  await short.scrollIntoViewIfNeeded();
  await short.hover();
  await wait(page, 1800);
  await tap(page, page.getByRole("button", { name: "Approve and post variances" }));
  // Approved, the review gives way: the list says so, and by whom.
  await page.getByRole("button", { name: "Approve and post variances" }).waitFor({
    state: "detached",
    timeout: 15000,
  });
  const done = page
    .locator("tbody tr", { hasText: "Omar (practice)" })
    .filter({ hasText: "Approved" })
    .filter({ hasText: "Demo Manager" });
  await done.waitFor({ timeout: 15000 });
  await done.scrollIntoViewIfNeeded();
  await done.hover();
});

await record("order", "manager", "/purchasing", async (page) => {
  const panel = page.getByTestId("po-panel");
  await tap(page, panel.getByRole("button", { name: "New order" }));
  const form = page.getByTestId("po-form");
  await choose(page, form.getByLabel("Supplier", { exact: true }), { label: "Practice supplier" });
  const line = form.getByTestId("po-line").nth(0);
  const { biz } = cafe("manager");
  const beans = last(`select id from item where business_id = '${biz}' and name = 'Coffee beans'`);
  await choose(page, line.getByLabel("Item", { exact: true }), beans);
  await type(page, line.getByLabel("Quantity", { exact: true }), "2");
  await choose(page, line.getByLabel("Unit", { exact: true }), "kg");
  await type(page, line.getByLabel("Price per unit", { exact: true }), "20000");
  await tap(page, form.getByRole("button", { name: "Save the draft" }));
  await panel.getByText(/Order \d+ saved as a draft/).waitFor({ timeout: 15000 });
  const no = last(`select max(po_no) from purchase_order where business_id = '${biz}'`);
  const row = page.locator(`[data-testid="po-row"][data-po="${no}"]`);
  await tap(page, row.getByRole("button", { name: "Approve", exact: true }));
  await row.getByText(`Order ${no} approved.`).waitFor({ timeout: 15000 });
  await tap(page, row.getByRole("button", { name: "Mark as sent" }));
  await row.getByText(`Order ${no} marked as sent to the supplier.`).waitFor({ timeout: 15000 });
});

await record("receive", "manager", "/purchasing", async (page) => {
  const { biz } = cafe("manager");
  const po =
    last(`select id from purchase_order where business_id = '${biz}' and sent_at is not null
                    order by po_no desc limit 1`);
  const form = page.getByTestId("receive");
  await choose(page, form.getByTestId("receive-order"), po);
  // What the order said is filled in: the beans, how many and at what price.
  await form.getByTestId("receive-line").first().hover();
  await wait(page, 1800);
  await tap(page, form.getByRole("button", { name: "Receive goods" }));
  const ask = page.getByTestId("price-check");
  const said = form.getByText(/Receipt \d+ —/);
  await ask.or(said).first().waitFor({ timeout: 15000 });
  if (await ask.isVisible()) {
    await tap(page, ask.locator("button.btn-primary"));
    await said.waitFor({ timeout: 15000 });
  }
});

await record("transfer", "manager", "/inventory/transfers", async (page) => {
  const { biz, branch, kitchen } = cafe("manager");
  const form = page.getByTestId("send-transfer");
  await choose(page, form.getByTestId("transfer-from"), kitchen);
  await choose(page, form.getByTestId("transfer-to"), branch);
  const line = form.getByTestId("transfer-line").nth(0);
  const beans = last(`select id from item where business_id = '${biz}' and name = 'Coffee beans'`);
  await choose(page, line.getByLabel("Item"), beans);
  await type(page, line.getByLabel("Quantity"), "1");
  await choose(page, line.getByLabel("Unit"), "kg");
  await tap(page, form.getByTestId("transfer-send"));
  await form.getByText(/is on its way to Practice branch/).waitFor({ timeout: 15000 });
});

await record("expense", "manager", "/expenses", async (page) => {
  await type(page, page.getByPlaceholder("September shop rent"), "Generator fuel");
  await type(page, page.locator("input.amt").first(), "25000");
  await choose(page, page.getByLabel("Paid from", { exact: true }), "bank");
  // The account is proposed from the narration: 6200 Utilities, there to read before posting.
  const account = page.getByLabel("Account", { exact: true });
  await page.waitForFunction(
    () => document.querySelector('select[aria-label="Account"]')?.value === "6200",
    null,
    { timeout: 10000 },
  );
  await account.hover();
  await wait(page, 1200);
  await tap(page, page.getByRole("button", { name: "Post expense" }));
  await page.getByText(/Posted to 6200/).waitFor({ timeout: 15000 });
});

await record("reports", "manager", "/reports", async (page) => {
  for (const [id, path] of [
    ["to-analysis", "/reports/sales"],
    ["to-week", "/reports/week"],
    ["to-month", "/reports/month"],
  ]) {
    await tap(page, page.getByTestId(id), 0);
    await page.waitForURL((u) => u.pathname === path, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await wait(page, 2200);
    if (path !== "/reports/month") {
      await page.goBack();
      await page.waitForLoadState("networkidle");
      await wait(page, 800);
    }
  }
});

// -------------------------------------------------------------- the owner
await record("price", "owner", "/products", async (page) => {
  await tap(page, page.locator('[data-testid="product-card"][data-name="Espresso"] > button'));
  const panel = page.getByTestId("product-panel");
  await panel.waitFor({ timeout: 10000 });
  await tap(page, panel.getByRole("tab", { name: "Sizes & prices", exact: true }));
  await tap(page, panel.getByRole("button", { name: "Change a price…" }));
  for (const channel of ["dine_in", "takeaway"]) {
    await choose(page, panel.locator("label", { hasText: /^Channel/ }).locator("select"), channel);
    await type(page, panel.locator("label", { hasText: "New price" }).locator("input"), "2500");
    await tap(page, panel.getByRole("button", { name: "Set price" }), 1200);
  }
});

// The batch is not recorded: the practice café has nothing made in batches to record.

await browser.close();
if (!failed) rmSync(RAW, { recursive: true, force: true });
if (made.length) {
  console.log("\n  For src/lib/help/videos.ts:");
  for (const m of made) console.log(`    ${m.task}: { seconds: ${m.seconds} },  // ${m.kb} KB`);
}
done("videos");
