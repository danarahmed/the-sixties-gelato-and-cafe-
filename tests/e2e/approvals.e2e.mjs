// One approvals inbox (0088, E5) and undo for a few seconds (E7). A count
// submitted, a loss saved to wait and an order drafted and left are on
// Approvals, counted on the menu, each with who asked and why; the manager
// who counted may only withdraw their own count; the owner approves the
// count, reverses the loss with why and cancels the order with why, each
// recorded as its own screen would; a cashier is offered no Approvals. A
// product renamed is put back with Undo.
import { BASE, chromium, check, done, open, openProduct, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const CUP = "c0000000-0000-0000-0000-000000000002";
const BEANS = "c0000000-0000-0000-0000-000000000001";

// The barista records losses (the shortcuts and production suites make them too).
sql(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com')
       on conflict do nothing;
     insert into app_user (business_id, full_name, email, auth_user_id)
     select '00000000-0000-0000-0000-0000000000b1', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e'
      where not exists (select 1 from app_user where email = 'barista@example.com');
     insert into user_role (app_user_id, role)
     select id, 'barista' from app_user where email = 'barista@example.com'
     on conflict do nothing`);

// Waiting: the manager's count of the cups, a loss of beans, an order of beans left two hours.
const count = last(`select test.act_as('manager@example.com');
  select start_stock_count(array['${CUP}'::uuid])`);
sql(`select test.act_as('manager@example.com');
     select record_count('${count}', '${CUP}', 97, 'each');
     select submit_stock_count('${count}')`);
sql(`select test.act_as('owner@example.com');
     select set_business_rule('waste_approval_over', 'business', null, '1', 'Every loss is looked at')`);
sql(`select test.act_as('barista@example.com');
     select record_loss('waste', '${BEANS}', null, 12, 'g', 'Dropped the scoop', p_wait => true)`);
const po = last(`select test.act_as('owner@example.com');
  select save_po(null, (select id from supplier where name = 'Kurdistan Coffee Imports' limit 1),
    '[{"item_id":"${BEANS}","qty":1,"unit_code":"kg","unit_price":9000}]'::jsonb,
    null, 'Beans for the weekend', null, gen_random_uuid()) ->> 'po_id'`);
sql(`update purchase_order set updated_at = now() - interval '2 hours' where id = '${po}'`);
const poNo = last(`select po_no from purchase_order where id = '${po}'`);

console.log("▸ the manager's own count");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/approvals");
  const card = page.locator('[data-testid="approval"][data-kind="count"]');
  await card.waitFor({ timeout: 15000 });
  check(
    (await card.getByTestId("approve").count()) === 0 &&
      (await card.getByTestId("send-back").textContent())?.includes("Withdraw for a recount"),
    "whoever counted it may withdraw it, not approve it",
  );
  await ctx.close();
}

console.log("▸ the owner decides each, in one place");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  const n = await page.getByTestId("approvals-count").textContent();
  check(Number(n) >= 3, `the menu counts what waits (${n})`);
  await open(page, "/approvals");
  const cards = page.getByTestId("approval");
  await cards.first().waitFor({ timeout: 15000 });
  const kinds = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
  check(
    ["count", "loss", "order"].every((k) => kinds.includes(k)),
    `a count, a loss and an order wait (${kinds.join(", ")})`,
  );
  const loss = page.locator('[data-testid="approval"][data-kind="loss"]').first();
  check(
    ((await loss.textContent()) ?? "").includes("Dropped the scoop") &&
      ((await loss.textContent()) ?? "").includes("Demo Barista"),
    "the loss says why, and who",
  );

  // The count approved: its differences posted.
  await page.locator('[data-testid="approval"][data-kind="count"]').getByTestId("approve").click();
  await page
    .locator('[data-testid="approval"][data-kind="count"]')
    .waitFor({ state: "detached", timeout: 15000 });
  check(
    sql(`select status from stock_count where id = '${count}'`) === "approved",
    "the count is approved, as on Stock Count",
  );

  // The loss reversed, with why; asked first.
  await loss.getByTestId("send-back").click();
  await loss.getByTestId("send-back-confirm").click();
  await loss.getByText("Why is it reversed? (required)").first().waitFor({ timeout: 5000 });
  check(true, "a loss is not reversed without why");
  await loss.getByTestId("send-back-why").fill("It was counted already");
  await loss.getByTestId("send-back-confirm").click();
  await page
    .locator('[data-testid="approval"][data-kind="loss"]')
    .waitFor({ state: "detached", timeout: 15000 });
  check(
    sql(`select decision || ' ' || reason from loss_review order by decided_at desc limit 1`) ===
      "reversed It was counted already",
    "the loss is reversed with why, as on Inventory",
  );

  // The order cancelled, with why.
  const order = page.locator('[data-testid="approval"][data-kind="order"]');
  check(((await order.textContent()) ?? "").includes(`#${poNo}`), `the order is #${poNo}`);
  await order.getByTestId("send-back").click();
  await order.getByTestId("send-back-why").fill("Bought at the market");
  await order.getByTestId("send-back-confirm").click();
  await order.waitFor({ state: "detached", timeout: 15000 });
  check(
    sql(`select status from purchase_order where id = '${po}'`) === "cancelled",
    "the order is cancelled, as on Purchasing",
  );
  await page.getByText("Nothing waits for you.").waitFor({ timeout: 15000 });
  check(true, "and nothing waits");
  await ctx.close();
}

console.log("▸ the cashier");
{
  const { ctx, page } = await signIn(browser, "cashier");
  const menu = await page.$$eval("nav.sidenav a", (as) => as.map((a) => a.getAttribute("href")));
  check(!menu.includes("/approvals"), "is offered no Approvals");
  await page.goto(`${BASE}/approvals`);
  check(new URL(page.url()).pathname === "/pos", "and is taken to the till from it");
  await ctx.close();
}

console.log("▸ undo, for a few seconds");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  const name = sql(`select name from product where id = 'd0000000-0000-0000-0000-000000000002'`);
  const setup = (await openProduct(page, name)).locator(".product-setup");
  const box = setup.locator("label", { hasText: "Name" }).first().locator("input");
  await box.fill(`${name} renamed`);
  await setup.getByRole("button", { name: "Save" }).click();
  await page.getByTestId("undo").waitFor({ timeout: 15000 });
  check(
    sql(`select name from product where id = 'd0000000-0000-0000-0000-000000000002'`) ===
      `${name} renamed`,
    "the new name is saved",
  );
  await page.getByTestId("undo").click();
  await page.getByTestId("undone").waitFor({ timeout: 15000 });
  check(
    sql(`select name from product where id = 'd0000000-0000-0000-0000-000000000002'`) === name,
    "Undo puts the name back",
  );
  await ctx.close();
}

await browser.close();
done("approvals");
