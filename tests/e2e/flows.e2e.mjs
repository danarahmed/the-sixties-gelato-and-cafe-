// The day's work, through the real screens, as the people who do it: sales
// (cash and platform-paid), void and refund, an expense, a manual journal and
// its reversal, a blind count approved by a second person, the drawer count
// and moving its takings, the reports, and adding a member of staff.
import { chromium, BASE, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const ok = (m) => check(true, m);

// ---------------------------------------------------------------- the till
console.log("▸ cashier rings up two sales");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByRole("button", { name: "Dine-in" }).click();
  for (let i = 0; i < 2; i++) {
    await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
    await page.getByRole("button", { name: /Cash/ }).click();
    await page.locator(".pay-confirm").click();
    await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  }
  ok("two cash sales recorded through the till");
  const receipt = await page
    .locator("text=Sale recorded")
    .locator("..")
    .locator("..")
    .textContent();
  check(!/Cost/.test(receipt), "the cashier's receipt shows no cost");
  // Talabat takes only platform-paid.
  await page.getByRole("button", { name: "Talabat" }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  check(
    await page.getByRole("button", { name: /platform/i }).isVisible(),
    "a Talabat order offers only platform-paid",
  );
  check(!(await page.getByRole("button", { name: /💵/ }).isVisible()), "and no cash button");
  await page.getByRole("button", { name: /platform/i }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  ok("a Talabat sale recorded");
  await ctx.close();
}
check(
  sql("select count(*) from sales_order where status = 'completed'") === "3",
  "three completed orders in the database",
);
check(
  sql("select count(distinct idempotency_key) from sales_order") === "3",
  "each with its own idempotency key",
);
check(
  sql(
    "select count(*) from journal_entry where reference_type = 'sales_order' and status = 'published'",
  ) === "3",
  "each with a published journal",
);

// ------------------------------------------------------- void and refund
console.log("▸ manager voids one sale and refunds another");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/orders");
  const rows = page.locator("tbody tr", { has: page.getByRole("button", { name: "Void" }) });
  check((await rows.count()) === 3, "the three sales can be voided or refunded");
  await rows.first().getByRole("button", { name: "Void" }).click();
  await page.getByPlaceholder("Why void it?").fill("rung twice by mistake");
  await page.getByRole("button", { name: "Confirm void" }).click();
  await page.getByText(/^Voided/).waitFor({ timeout: 10000 });
  ok("voided");
  await open(page, "/orders");
  await page
    .locator("tbody tr", { has: page.getByRole("button", { name: "Refund" }) })
    .first()
    .getByRole("button", { name: "Refund" })
    .click();
  await page.getByPlaceholder("Why refund it?").fill("customer did not like it");
  await page.getByRole("button", { name: "Confirm refund" }).click();
  await page.getByText(/^Refunded/).waitFor({ timeout: 10000 });
  ok("refunded");
  await ctx.close();
}
check(
  sql("select string_agg(status::text, ',' order by status::text) from sales_order") ===
    "completed,refunded,voided",
  "one sale voided, one refunded, one untouched",
);
check(
  sql("select count(*) from audit_log where action in ('sale.void','sale.refund')") === "2",
  "both on the audit trail",
);

// ------------------------------------------------------------- expenses
console.log("▸ manager records the rent");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/expenses");
  await page.getByPlaceholder("September shop rent").fill("September shop rent");
  await page.locator("input.amt").first().fill("400000");
  await page
    .waitForFunction(
      () => {
        const s = [...document.querySelectorAll("select")].find((x) =>
          [...x.options].some((o) => o.value === "6000"),
        );
        return s && s.value === "6000";
      },
      null,
      { timeout: 5000 },
    )
    .then(
      () => ok("the account is proposed: 6000 Rent"),
      () => check(false, "no account proposed"),
    );
  const post = page.getByRole("button", { name: "Post expense" });
  check(await post.isDisabled(), "it cannot post until someone says where the money came from");
  // The drawer holds 2,500: two cash sales, less the one refunded.
  await page.getByLabel("Paid from", { exact: true }).selectOption("till");
  await post.click();
  await page
    .getByText(/The drawer should hold only 2500 — not enough to pay 400000/)
    .waitFor({ timeout: 10000 });
  ok("the till cannot pay out more than the drawer should hold");
  await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
  await post.click();
  await page.getByText(/Posted to 6000/).waitFor({ timeout: 10000 });
  ok("rent posted, paid from the bank");
  await ctx.close();
}
check(
  sql(
    "select count(*) from expense x join journal_line l on l.journal_entry_id = x.journal_entry_id join gl_account a on a.id = l.account_id where a.code = '1020' and l.credit = 400000",
  ) === "1",
  "the rent is credited to 1020 Bank",
);
check(
  sql("select count(*) from cash_event where kind = 'paid_out'") === "0",
  "and nothing left the drawer",
);

// ------------------------------------------------------------- journals
console.log("▸ owner posts and reverses a manual journal");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/journals");
  await page.getByRole("button", { name: "New Journal" }).click();
  const selects = page.locator("tbody select");
  await selects.nth(0).selectOption("6200");
  await selects.nth(1).selectOption("1020");
  const amts = page.locator("tbody input.amt");
  await amts.nth(0).fill("25000");
  await amts.nth(3).fill("25000");
  await page
    .getByPlaceholder("Being the reason this entry is made")
    .fill("Generator fuel paid by bank transfer");
  const blocked = await selects.nth(0).locator("option").allTextContents();
  check(
    !blocked.some((o) => /^(1000|1200|2000|2050|3100) /.test(o)),
    "subledger accounts, and the till, are not offered for manual journals",
  );
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.getByText(/Journal \d+ published/).waitFor({ timeout: 10000 });
  ok("published");
  await open(page, "/journals?show=manual");
  await page
    .locator("tbody tr", { hasText: "Generator fuel" })
    .getByRole("button", { name: "Reverse" })
    .click();
  await page.getByPlaceholder("Why is it being reversed?").fill("paid by the landlord after all");
  await page.getByRole("button", { name: "Post reversal" }).click();
  await page.waitForTimeout(1500);
  check(
    sql(
      "select count(*) from journal_entry where reference_type = 'reversal' and description like 'Reversal: paid by%'",
    ) === "1",
    "reversed by a mirror entry",
  );
  await ctx.close();
}

// --------------------------------------------------------------- counts
console.log("▸ counter counts blind; manager approves");
{
  const { ctx, page } = await signIn(browser, "counter");
  await open(page, "/count");
  await page.getByRole("button", { name: "Start count" }).click();
  await page.getByText("Your count").waitFor({ timeout: 10000 });
  const html = await page.content();
  check(
    (await page.locator("th", { hasText: "Expected" }).count()) === 0 &&
      !/expected_base|"expected"/.test(html),
    "the counter's page carries no expected quantities, on screen or in its data",
  );
  const inputs = page.locator('input[aria-label^="Counted"]');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    await inputs.nth(i).fill(i === 0 ? "1" : "0");
    await inputs.nth(i).blur();
  }
  await page.waitForFunction((k) => document.body.innerText.includes(`${k} of ${k} counted`), n, {
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Submit count" }).click();
  await page.getByText("Count submitted").waitFor({ timeout: 10000 });
  ok(`counted ${n} items and submitted`);
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/count");
  await page.getByRole("link", { name: "Review" }).first().click();
  await page.getByText("Review — count").waitFor({ timeout: 10000 });
  check(
    /Expected/.test(await page.locator("main").textContent()),
    "the reviewer sees expected against counted",
  );
  await page.getByRole("button", { name: "Approve and post variances" }).click();
  await page.getByText(/^Approved/).waitFor({ timeout: 10000 });
  ok("approved by a second person");
  await ctx.close();
}
check(
  sql("select status from stock_count order by started_at desc limit 1") === "approved",
  "the count is approved",
);

// ---------------------------------------------------------- opening stock
console.log("▸ manager gives an item with no stock its opening stock, at what it cost");
sql(`
  insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension)
  values ('e2e00000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-0000000000b1', 'MILK-E2E',
          'Fresh milk', 'ingredient', 'ml', 'volume');
  insert into item_unit (item_id, code, label, dimension, factor_to_base)
  values ('e2e00000-0000-0000-0000-00000000000f', 'l', 'Litre', 'volume', 1000);
`);
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/inventory");
  const panel = page.getByTestId("opening-stock");
  await panel.getByLabel("Item with no stock yet").selectOption({ label: "Fresh milk" });
  await panel.getByLabel("Quantity on the shelf").fill("12.5");
  // A select inside its label adds its option to the label's name ("Unit ml").
  await panel.locator("label", { hasText: /^Unit/ }).locator("select").selectOption("l");
  await panel.getByLabel("Cost per Litre (IQD)").fill("1500");
  await panel.getByRole("button", { name: "Record opening stock" }).click();
  await page
    .getByText(/Opening stock of Fresh milk: 12.5 Litre, worth 18,750 IQD \(journal \d+\)/)
    .waitFor({ timeout: 10000 });
  ok("12.5 litres at 1,500 a litre: 18,750 IQD");
  await open(page, "/inventory");
  check(
    (await page.getByTestId("opening-stock").count()) === 0 ||
      !(await page
        .getByTestId("opening-stock")
        .getByLabel("Item with no stock yet")
        .locator("option", { hasText: "Fresh milk" })
        .count()),
    "and it is no longer offered: its stock now changes only through its own records",
  );
  await ctx.close();
}
check(
  sql(
    `select string_agg(a.code || case when l.debit > 0 then ' Dr ' || trim_scale(l.debit) else ' Cr ' || trim_scale(l.credit) end, ' | ' order by a.code)
       from inventory_movement m join journal_entry e on e.reference_type = 'inventory_movement' and e.reference_id = m.id
       join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
      where m.item_id = 'e2e00000-0000-0000-0000-00000000000f'`,
  ) === "1200 Dr 18750 | 3000 Cr 18750",
  "journaled Dr Inventory, Cr Owner equity, as a new item's opening stock",
);

// ------------------------------------------------------- the drawer count
console.log("▸ a bill still waiting for its money holds the drawer count");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.locator(".product-tile", { hasText: "Golden espresso" }).click();
  await page.getByRole("button", { name: /Keep open, pay later/ }).click();
  await page.getByLabel("Customer's name").fill("Late customer");
  await page.getByRole("button", { name: "Keep open", exact: true }).click();
  await page
    .getByText("Late customer — kept open, waiting for payment")
    .waitFor({ timeout: 10000 });
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales");
  await page.getByText("1 bill(s) from the till are still open").waitFor({ timeout: 10000 });
  await page.getByLabel("Cash counted", { exact: true }).fill("2000");
  check(
    await page.getByRole("button", { name: "Count the drawer" }).isDisabled(),
    "the drawer cannot be counted while a bill is open",
  );
  await open(page, "/pos");
  await page.locator(".strip-chip", { hasText: "Late customer" }).click();
  await page.getByRole("button", { name: /Cancel bill/ }).click();
  await page.getByLabel("Reason").fill("Customer left before it was made");
  await page.getByRole("button", { name: "Cancel the bill" }).click();
  await page.getByText("Late customer — bill cancelled").waitFor({ timeout: 10000 });
  ok("a manager cancels it, with a reason");
  await ctx.close();
}
check(
  sql("select reason from audit_log where action = 'bill.cancel'") ===
    "Customer left before it was made",
  "the cancellation is on the audit trail",
);

const BIZ_ID = "00000000-0000-0000-0000-0000000000b1";
const balance = (code) =>
  sql(`select trim_scale(gl_balance_at('${BIZ_ID}', '${code}', 'infinity'))`);

console.log("▸ manager counts the drawer, keeps a float and takes the rest to the safe");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales");
  check(
    (await page.getByTestId("drawer-expected").textContent()).trim() === "2,500 IQD",
    "the drawer should hold 2,500 IQD: two cash sales, less the one refunded",
  );
  await page.getByLabel("Cash counted", { exact: true }).fill("2000");
  await page.getByLabel("Stays in the drawer", { exact: true }).fill("1500");
  await page.getByLabel("Takings go to", { exact: true }).selectOption("safe");
  await page.getByRole("button", { name: "Count the drawer" }).click();
  await page
    .getByText(/Counted — 500 IQD short, posted to 6300 Cash over \/ short/)
    .waitFor({ timeout: 10000 });
  check(
    await page.getByText("500 IQD to the safe; 1,500 IQD stays in the drawer.").isVisible(),
    "500 short, posted to 6300; 500 to the safe, and 1,500 stays for next time",
  );
  await open(page, "/sales");
  check(
    (await page.getByTestId("drawer-expected").textContent()).trim() === "1,500 IQD",
    "the next count starts from what stayed",
  );
  const uncountedCard = page.locator(".cards2 > div", {
    has: page.locator(".sc", { hasText: "Days whose cash is not counted" }),
  });
  check(
    (await uncountedCard.locator(".v").textContent()).trim() === "0" &&
      /Drawer last counted/.test(await uncountedCard.textContent()),
    "and Sales shows no day left uncounted",
  );
  await ctx.close();
}
check(
  sql(
    `select string_agg(kind || ' ' || trim_scale(expected_cash) || ' ' || trim_scale(counted_cash) || ' ' ||
                       trim_scale(variance) || ' ' || trim_scale(left_in_drawer) || ' ' || trim_scale(taken_out) ||
                       ' ' || taken_to, ',')
       from work_shift where closed_at is not null`,
  ) === "drawer 2500 2000 -500 1500 500 safe",
  "one drawer count: 2,500 expected, 2,000 counted, 500 short, 1,500 stays, 500 to the safe",
);
check(
  sql("select count(*) from cash_event where work_shift_id is null") === "0",
  "every movement of cash is in the count",
);
check(
  balance("1000") === "1500" && balance("1005") === "500",
  `the books agree with the cash: 1000 Cash in the till ${balance("1000")}, 1005 Cash in the safe ${balance("1005")}`,
);
check(
  sql(`select count(*) from uncounted_days('${BIZ_ID}')`) === "0",
  "no trading day is left with its cash uncounted",
);

console.log("▸ manager banks the safe; the safe cannot pay out more than it holds");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales");
  await page.getByLabel("Cash from", { exact: true }).selectOption("safe");
  await page.getByLabel("Cash to", { exact: true }).selectOption("bank");
  check(
    (await page.getByLabel("Cash to", { exact: true }).locator("option").allTextContents())
      .join(",")
      .includes("owner") === false,
    "a manager is not offered paying money to the owner",
  );
  await page.getByLabel("Amount to move", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Move cash" }).click();
  await page
    .getByText(/The safe holds only 500 in the books — not enough to pay 1000/)
    .waitFor({ timeout: 10000 });
  ok("refused: the safe holds 500");
  await page.getByLabel("Amount to move", { exact: true }).fill("500");
  await page.getByLabel("What the cash is for", { exact: true }).fill("Deposit at the bank");
  await page.getByRole("button", { name: "Move cash" }).click();
  await page
    .getByText(/Moved 500 IQD from the safe to the bank \(journal \d+\)/)
    .waitFor({ timeout: 10000 });
  ok("500 moved from the safe to the bank");
  await ctx.close();
}
check(
  balance("1005") === "0" &&
    sql("select count(*) from audit_log where action = 'cash.move'") === "1" &&
    sql("select count(*) from cash_event where work_shift_id is null") === "0",
  "the safe is empty in the books, the move is on the audit trail, and the drawer is untouched",
);

// -------------------------------------------------- reports and the close
console.log("▸ owner reads the books");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const recon = await page.locator("#reconciliation").textContent();
  check(!recon.includes("⛔"), "every subledger reconciles to its control account");
  check(
    /Net revenue/.test(await page.locator("#pnl").textContent()),
    "the P&L renders from the ledger",
  );
  const csv = await page.request.get(BASE + "/reports/export?report=trial_balance");
  check(
    csv.ok() && (csv.headers()["content-type"] || "").includes("text/csv"),
    "trial balance downloads as CSV",
  );
  await open(page, "/accounting");
  check(
    /Earlier periods are locked|No draft journals/.test(await page.locator("main").textContent()),
    "the closing checklist is shown",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  const csv = await page.request.get(BASE + "/reports/export?report=trial_balance");
  check(csv.status() === 403, `a cashier cannot download the trial balance (HTTP ${csv.status()})`);
  await ctx.close();
}

// --------------------------------------------------------------- people
console.log("▸ owner adds a person");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  await page.locator("label", { hasText: "Name" }).last().locator("input").fill("New Barista");
  await page.locator('input[type="email"]').fill("new.barista@example.com");
  await page.getByLabel("Barista / production").last().check();
  await page.getByRole("button", { name: "Add person" }).click();
  await page.getByText(/Ask them to create their login/).waitFor({ timeout: 10000 });
  ok("invited, waiting for their login");
  await ctx.close();
}

// ----------------------------------------------------- corrections, owner
console.log("▸ owner cancels a bill entered in error, and posts a control correction");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/vendors");
  await page.getByRole("button", { name: "Bills & payments" }).click();
  await page.getByText("For a service or asset").click();
  check(
    /^SGC-\d{4}-\d{4}$/.test(await page.getByLabel("Invoice no.").inputValue()),
    "the invoice box is filled in with the café's own number",
  );
  await page.getByLabel("Invoice no.").fill("E2E-DUP-1");
  await page.locator("label", { hasText: "Amount (IQD)" }).first().locator("input").fill("12345");
  await page.getByRole("button", { name: "Record bill" }).click();
  await page.getByText(/Bill E2E-DUP-1 recorded/).waitFor({ timeout: 10000 });
  await page
    .locator("tr", { hasText: "E2E-DUP-1" })
    .getByRole("button", { name: "Cancel" })
    .click();
  await page.getByPlaceholder("Why cancel E2E-DUP-1?").fill("entered twice");
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.waitForTimeout(1500);
  check(
    sql(
      "select count(*) from purchase_invoice where invoice_no = 'E2E-DUP-1' and cancelled_at is not null",
    ) === "1",
    "the bill is cancelled, and still on record",
  );
  check(
    sql(
      "select count(*) from journal_entry where reverses_entry = (select journal_entry_id from purchase_invoice where invoice_no = 'E2E-DUP-1')",
    ) === "1",
    "its journal is reversed",
  );

  await open(page, "/journals");
  await page.getByRole("button", { name: "New Journal" }).click();
  await page.getByText(/Correction to a control account/).click();
  const selects = page.locator("tbody select");
  await selects.nth(0).selectOption("1200");
  await selects.nth(1).selectOption("5400");
  const amts = page.locator("tbody input.amt");
  await amts.nth(0).fill("100");
  await amts.nth(3).fill("100");
  await page
    .getByPlaceholder("Being the reason this entry is made")
    .fill("Stock found in the back store");
  await page
    .getByPlaceholder("What was wrong, and how this entry puts it right")
    .fill("e2e: counted stock not on the ledger");
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.getByText(/Correction published as journal \d+/).waitFor({ timeout: 10000 });
  check(
    sql("select count(*) from audit_log where action = 'journal.control_correction'") === "1",
    "the owner's control correction is published and on the audit trail",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/journals");
  check(
    (await page.getByRole("button", { name: "New Journal" }).count()) === 0 &&
      (await page.getByText(/Correction to a control account/).count()) === 0,
    "a branch manager (who does not post journals) is offered no journal form and no corrections",
  );
  await ctx.close();
}

// --------------------------------------- history from before the upgrade
console.log("▸ owner reviews and posts stock the old app never journaled, then bills the delivery");
{
  // Written the way the old app wrote them: stock moved, no journal, and no
  // supplier on the receipt (the old app kept the supplier's name in the note).
  const BIZ = "00000000-0000-0000-0000-0000000000b1";
  const RECEIPT = "e2e00000-0000-0000-0000-000000000001";
  sql(`
    insert into goods_receipt (id, business_id, location_id, note, received_at)
    select '${RECEIPT}', '${BIZ}', id, 'Old Dairy Co.', now() - interval '2 days'
      from location where business_id = '${BIZ}' and kind = 'branch' limit 1;
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, occurred_at)
    select '${BIZ}', i.id, r.location_id, 'purchase_receipt', 3000, 3, 9000, 'goods_receipt', r.id, r.received_at
      from item i, goods_receipt r where i.business_id = '${BIZ}' and i.sku = 'MILK' and r.id = '${RECEIPT}';
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, occurred_at)
    select '${BIZ}', i.id, r.location_id, 'opening_balance', 700, 10, 7000, r.received_at
      from item i, goods_receipt r where i.business_id = '${BIZ}' and i.sku = 'SUGAR' and r.id = '${RECEIPT}';
  `);
  {
    const { ctx, page } = await signIn(browser, "manager");
    await open(page, "/reports");
    const recon = await page.locator("#reconciliation").textContent();
    check(
      /Stock the old app never journaled/.test(recon) && /Only the owner can post them/.test(recon),
      "a manager sees the unjournaled stock, but only the owner may post it",
    );
    await ctx.close();
  }
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  await page
    .getByPlaceholder("Why they are being posted (for the audit trail)")
    .fill("e2e: real stock from before the upgrade");
  await page.getByRole("button", { name: /Post these 2 journal/ }).click();
  await page.getByText(/2 journal\(s\) posted/).waitFor({ timeout: 10000 });
  check(
    sql(
      `select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit else ' Cr ' || l.credit end, ' | ' order by a.code)
         from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
        where e.reference_type = 'goods_receipt' and e.reference_id = '${RECEIPT}'`,
    ) === "1200 Dr 9000 | 2050 Cr 9000",
    "the delivery is journaled as the new app journals one: Dr Inventory, Cr goods received not invoiced",
  );
  check(
    sql("select count(*) from audit_log where action = 'legacy.post_unposted'") === "1",
    "and the owner's decision is on the audit trail",
  );
  // The notice shows before the page's refreshed figures arrive: wait for them.
  check(
    await page
      .locator("#reconciliation", { hasText: "Stock the old app never journaled" })
      .waitFor({ state: "hidden", timeout: 10000 })
      .then(
        () => true,
        () => false,
      ),
    "nothing is left to post",
  );

  await open(page, "/vendors");
  await page.getByRole("button", { name: "Bills & payments" }).click();
  const receiptSelect = page.locator("label", { hasText: "Goods receipt" }).locator("select");
  const value = await receiptSelect
    .locator("option", { hasText: "Before controls · Old Dairy Co." })
    .getAttribute("value");
  check(
    value === RECEIPT,
    "the old delivery, with no supplier recorded, can be billed from Vendors",
  );
  await receiptSelect.selectOption(RECEIPT);
  await page.getByLabel("Invoice no.").fill("OLD-DAIRY-9");
  await page.locator("label", { hasText: "Amount (IQD)" }).first().locator("input").fill("9000");
  await page.getByRole("button", { name: "Record bill" }).click();
  await page.getByText(/Bill OLD-DAIRY-9 recorded/).waitFor({ timeout: 10000 });
  check(
    sql(
      `select count(*) from purchase_invoice where invoice_no = 'OLD-DAIRY-9' and goods_receipt_id = '${RECEIPT}'`,
    ) === "1",
    "and its bill clears it",
  );
  await ctx.close();
}

// ------------------------------------------------ the café's own bill numbers
console.log("▸ a bill without the supplier's number takes the café's own, never given twice");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/vendors");
  await page.getByRole("button", { name: "Bills & payments" }).click();
  await page.getByText("For a service or asset").click();
  const box = page.getByLabel("Invoice no.");
  const offered = await box.inputValue();
  check(/^SGC-\d{4}-\d{4}$/.test(offered), `the form offers ${offered}`);
  await page.locator("label", { hasText: "Amount (IQD)" }).first().locator("input").fill("4000");
  await page.getByRole("button", { name: "Record bill" }).click();
  await page.getByText(`Bill ${offered} recorded`, { exact: false }).waitFor({ timeout: 10000 });
  check(
    sql(
      `select count(*) from purchase_invoice where invoice_no = '${offered}' and cancelled_at is null`,
    ) === "1",
    "the bill is recorded under it",
  );
  check(
    sql(
      `select count(*) from journal_entry where description = 'Bill ${offered}' and reference_no = '${offered}'`,
    ) === "1",
    "and so is its journal",
  );
  const [, year, n] = offered.match(/^SGC-(\d{4})-(\d{4})$/) ?? [];
  const next = `SGC-${year}-${String(Number(n) + 1).padStart(4, "0")}`;
  await box.waitFor();
  await page.waitForFunction(
    (want) => document.querySelector('input[aria-label="Invoice no."]')?.value === want,
    next,
    { timeout: 10000 },
  );
  ok(`the next bill is offered ${next}`);
  await box.fill(offered);
  await page.locator("label", { hasText: "Amount (IQD)" }).first().locator("input").fill("100");
  await page.getByRole("button", { name: "Record bill" }).click();
  await page.getByText(/given automatically/).waitFor({ timeout: 10000 });
  ok("a number in the café's own form cannot be typed in by hand");
  await ctx.close();
}

// ------------------------------------------------- the register's order
console.log("▸ the journal register lists entries by number, newest first");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/journals");
  const register = page.locator("section", {
    has: page.locator("h3", { hasText: "Journal Register" }),
  });
  const shown = (
    await register.locator("table tbody tr td:nth-child(2) button").allTextContents()
  ).map((t) => t.trim());
  const numbers = shown.filter((t) => /^\d+$/.test(t)).map(Number);
  check(
    numbers.length > 5 && numbers.every((n, i) => i === 0 || numbers[i - 1] > n),
    `numbers run down from the top: ${numbers.slice(0, 5).join(", ")} …`,
  );
  check(
    numbers[0] === Number(sql("select max(journal_no) from journal_entry")),
    "and the newest journal is first",
  );
  const lastDraft = shown.lastIndexOf("draft");
  check(
    lastDraft === -1 || lastDraft < shown.findIndex((t) => /^\d+$/.test(t)),
    "drafts, which have no number yet, come before them",
  );
  await ctx.close();
}

// ------------------------------------------------------- the ledger ties
check(
  sql(
    "select count(*) from journal_entry e where status = 'published' and (select sum(debit) - sum(credit) from journal_line where journal_entry_id = e.id) <> 0",
  ) === "0",
  "every published journal balances",
);

await browser.close();
done("flows");
