// The café's rules (0040, release O). On Settings → Rules the owner changes a
// rule with a reason, sets one for a role, and sets one back; every change is
// kept. At the till, an item whose rule asks a manager is sold beyond what the
// books hold once a manager types their PIN. A barista's loss over the limit
// is saved to wait, the dashboard names it, and the manager approves it on
// Inventory. A refund over the limit asks for a second person. Earlier suites
// sell, lose and refund too: this one reads what it needs from the database.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const BEANS = "c0000000-0000-0000-0000-000000000001";
/** A rule set as the owner, with a reason: null sets it back to its default. */
const rule = (key, scope, id, value) =>
  sql(`select test.act_as('owner@example.com');
       select set_business_rule('${key}', '${scope}', ${id ? `'${id}'` : "null"},
                                ${value === null ? "null" : `'${JSON.stringify(value)}'`}, 'e2e')`);
const ruleRow = (page, key, scope) =>
  page.locator(`[data-rule="${key}"] [data-testid="rule-row"][data-scope="${scope}"]`);

// The barista (made by the production suite, or here when it runs alone), and PINs.
sql(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000e', 'barista@example.com')
       on conflict do nothing;
     insert into app_user (business_id, full_name, email, auth_user_id)
     select '${B}', 'Demo Barista', 'barista@example.com', 'a0000000-0000-0000-0000-00000000000e'
      where not exists (select 1 from app_user where email = 'barista@example.com');
     insert into user_role (app_user_id, role)
     select id, 'barista' from app_user where email = 'barista@example.com'
        and not exists (select 1 from user_role ur where ur.app_user_id = app_user.id and ur.role = 'barista');
     select test.act_as('owner@example.com'); select set_my_pin('13579');
     select test.act_as('manager@example.com'); select set_my_pin('24680');`);

console.log("▸ the owner changes a rule with a reason, sets one for a role, and sets one back");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  check(
    (await page.getByTestId("settings-rules").textContent()).includes("25,000 IQD"),
    "Settings shows the café's rules as they stand: refunds over 25,000 IQD",
  );
  await page.getByRole("link", { name: "Open Rules →" }).click();
  await page.waitForURL("**/settings/rules");
  const refunds = ruleRow(page, "refund_approval_over", "business:");
  check(
    (await refunds.getByTestId("rule-value").textContent()).trim() === "25,000 IQD" &&
      (await refunds.textContent()).includes("Default"),
    "the refund limit is at its default, 25,000 IQD",
  );
  await refunds.getByRole("button", { name: "Change" }).click();
  const form = page.locator('[data-rule="refund_approval_over"] [data-testid="rule-form"]');
  await form.getByTestId("rule-input").fill("20000");
  check(
    await form.getByRole("button", { name: "Save" }).isDisabled(),
    "a rule is not changed without a reason",
  );
  await form.getByTestId("rule-reason").fill("Tighter refunds this month");
  await form.getByRole("button", { name: "Save" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(
          '[data-rule="refund_approval_over"] [data-scope="business:"] [data-testid="rule-value"]',
        )
        ?.textContent?.includes("20,000"),
    null,
    { timeout: 10000 },
  );
  check(
    (await refunds.textContent()).includes("Demo Owner") &&
      (await refunds.textContent()).includes("Tighter refunds this month"),
    "set to 20,000 IQD, by the owner, with the reason",
  );
  check(
    last(`select trim_scale((rule_value('${B}', 'refund_approval_over') #>> '{}')::numeric)`) ===
      "20000",
    "and the database applies it",
  );
  // For a role: cashiers give 5% at most without a manager.
  const cap = page.locator('[data-rule="discount_cap_percent"]');
  await cap.getByTestId("rule-add").click();
  await cap.getByTestId("rule-target").selectOption("cashier");
  await cap.getByTestId("rule-input").fill("5");
  await cap.getByTestId("rule-reason").fill("Cashiers give less");
  await cap.getByRole("button", { name: "Save" }).click();
  await ruleRow(page, "discount_cap_percent", "role:cashier").waitFor({ timeout: 10000 });
  check(
    (
      await ruleRow(page, "discount_cap_percent", "role:cashier")
        .getByTestId("rule-value")
        .textContent()
    ).trim() === "5%",
    "a cap of 5% for the cashier, beside the café's",
  );
  // Back to the default, with a reason.
  await refunds.getByRole("button", { name: "Back to default" }).click();
  await form.getByTestId("rule-reason").fill("As before");
  await form.getByRole("button", { name: "Set it back to the default" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(
          '[data-rule="refund_approval_over"] [data-scope="business:"] [data-testid="rule-value"]',
        )
        ?.textContent?.includes("25,000"),
    null,
    { timeout: 10000 },
  );
  const history = page.getByTestId("rule-change");
  check((await history.count()) === 3, "every change is kept: three");
  check(
    (await history.first().textContent()).includes("As before") &&
      (await history.first().textContent()).includes("20,000 IQD") &&
      (await history.first().textContent()).includes("Default"),
    "the latest first: from 20,000 IQD back to the default, and why",
  );
  await ctx.close();
}
check(
  sql("select count(*) from audit_log where action = 'rule.set'") === "3",
  "each change is on the audit trail",
);
rule("discount_cap_percent", "role", "cashier", null);

console.log("▸ at the till, a manager approves selling what the books do not hold");
sql(`insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension)
     values ('c0000000-0000-0000-0000-0000000000e1', '${B}', 'RULE-JUICE', 'Rules juice', 'resale', 'each', 'count');
     insert into product (id, business_id, name) values ('d0000000-0000-0000-0000-0000000000e1', '${B}', 'Rules juice');
     insert into product_variant (id, product_id, name, resale_item_id)
     values ('d1000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-0000000000e1', 'Bottle',
             'c0000000-0000-0000-0000-0000000000e1');
     insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
     values ('${B}', 'd1000000-0000-0000-0000-0000000000e1', 'dine_in', 1500, '2020-01-01');`);
rule("negative_stock", "item", "c0000000-0000-0000-0000-0000000000e1", "approve");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  // Past the floor of tables, when an earlier suite set tables up.
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: "Dine-in", exact: true }).click();
  await page.locator(".product-tile", { hasText: "Rules juice" }).click();
  await page.getByRole("button", { name: /Card/ }).click();
  await page.locator(".pay-confirm").click();
  const dialog = page.getByRole("dialog", {
    name: "A manager approves selling more than the books hold",
  });
  await dialog.waitFor({ timeout: 10000 });
  check(
    (await dialog.textContent()).includes("Only 0 each of Rules juice is in stock"),
    "the juice the books do not hold asks for a manager, saying why",
  );
  await dialog.getByLabel("Manager").selectOption({ label: "Demo Manager" });
  await dialog.getByLabel("PIN").fill("24680");
  await dialog.getByRole("button", { name: "Approve" }).click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(true, "with the manager's PIN, the sale is recorded");
  await ctx.close();
}
check(
  last(`select (select full_name from app_user where id = (after_state ->> 'approved_by')::uuid)
          from audit_log where action = 'stock.below_zero' order by id desc limit 1`) ===
    "Demo Manager",
  "the audit trail keeps who approved it",
);
check(
  last(`select string_agg(title, ' | ') from alert_conditions('${B}', now()) where rule = 'stock_below_zero'
                                                                   and title like 'Rules juice%'`) ===
    "Rules juice is below zero in the books: -1 each",
  "and the dashboard's alert says the juice is below zero",
);

console.log("▸ a barista's loss over the limit waits, and the manager approves it");
// Whatever the beans cost after the other suites, any loss of them is over 1 IQD.
rule("waste_approval_over", "business", null, 1);
{
  const { ctx, page } = await signIn(browser, "barista");
  await open(page, "/inventory");
  const form = page.getByTestId("record-loss");
  await form.getByLabel("What kind of loss").selectOption("spoilage");
  await form.getByLabel("Item").selectOption({ label: "Golden beans" });
  await form.getByLabel("Quantity lost").fill("50");
  await form.getByLabel("Why (required)").fill("Spilled the hopper");
  await form.getByRole("button", { name: "Record the loss" }).click();
  const approval = form.getByTestId("loss-approval");
  await approval.waitFor({ timeout: 10000 });
  check(
    (await form.textContent()).includes("This loss needs a manager's approval"),
    "over the limit: a manager's approval, now or later",
  );
  await approval.getByRole("button", { name: "Save it to wait for a manager's approval" }).click();
  await form
    .getByText("Saved. It waits for a manager's approval, under Needs you.")
    .waitFor({ timeout: 10000 });
  check(true, "saved to wait for a manager");
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/dashboard");
  check(
    /loss\(es\) waiting for a manager's approval/.test(await page.textContent("main")),
    "the dashboard names the losses waiting",
  );
  await open(page, "/inventory");
  const row = page.locator('[data-testid="loss-waiting"]', { hasText: "Spilled the hopper" });
  check(
    (await row.count()) === 1 && (await row.textContent()).includes("Demo Barista"),
    "Inventory lists the loss, with who recorded it",
  );
  await row.getByRole("button", { name: "Approve" }).click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('[data-testid="loss-waiting"]')].some((r) =>
        r.textContent?.includes("Spilled the hopper"),
      ),
    null,
    { timeout: 10000 },
  );
  check(true, "approved, it leaves the list");
  await ctx.close();
}
check(
  last(`select r.decision || ' by ' || u.full_name from loss_review r join app_user u on u.id = r.decided_by
          join inventory_movement m on m.id = r.movement_id where m.reason = 'Spilled the hopper'`) ===
    "approved by Demo Manager",
  "the approval is kept with the loss",
);
rule("waste_approval_over", "business", null, null);

console.log("▸ a refund over the limit needs a second person");
// Enough espressos to make more than 25,000 IQD at today's price, as earlier suites left it.
const price = Number(
  last(
    `select price_on('d1000000-0000-0000-0000-000000000001', 'dine_in', default_location('${B}'), test.today())`,
  ),
);
const big = last(`select test.act_as('cashier@example.com');
                  select record_sale(gen_random_uuid(), 'dine_in', 'card',
                    '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":${Math.ceil(26000 / price)}}]') ->> 'order_id'`);
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/orders");
  await page
    .locator("tbody tr", { hasText: big.slice(0, 8) })
    .getByRole("button", { name: "Refund" })
    .click();
  const dialog = page.getByTestId("refund-dialog");
  await dialog.getByLabel("Why refund it?").selectOption("quality");
  check(
    (await dialog.getByTestId("refund-needs-second").isVisible()) &&
      (await dialog.getByRole("button", { name: "Confirm refund" }).isDisabled()),
    "over 25,000 IQD, the refund waits for a second person",
  );
  await dialog.getByLabel("Approved by").selectOption({ label: "Approved by Demo Owner" });
  await dialog.getByLabel("Their PIN").fill("13579");
  await dialog.getByRole("button", { name: "Confirm refund" }).click();
  await dialog.getByTestId("refund-answer").waitFor({ timeout: 10000 });
  check(true, "with the owner's PIN, it is given back");
  await ctx.close();
}

console.log("▸ in Arabic, and not for a manager or a cashier");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, "/settings/rules");
  check(
    (await page.locator("h1").textContent()).trim() === "القواعد",
    "the Rules screen reads in Arabic",
  );
  await ctx.close();
}
for (const who of ["manager", "cashier"]) {
  const { ctx, page } = await signIn(browser, who);
  await open(page, "/settings/rules");
  check(
    new URL(page.url()).pathname !== "/settings/rules",
    `a ${who === "manager" ? "branch manager" : "cashier"} does not set the rules`,
  );
  await ctx.close();
}

await browser.close();
done("rules");
