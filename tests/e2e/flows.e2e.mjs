// The day's work, through the real screens, as the people who do it: sales
// (cash and platform-paid), void and refund, an expense, a manual journal and
// its reversal, a blind count approved by a second person, the day close,
// the reports, and adding a member of staff.
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
  await page.getByRole("button", { name: "Post expense" }).click();
  await page.getByText(/Posted to 6000/).waitFor({ timeout: 10000 });
  ok("rent posted");
  await ctx.close();
}

// ------------------------------------------------------------- journals
console.log("▸ owner posts and reverses a manual journal");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/journals");
  await page.getByRole("button", { name: "New Journal" }).click();
  const selects = page.locator("tbody select");
  await selects.nth(0).selectOption("6200");
  await selects.nth(1).selectOption("1000");
  const amts = page.locator("tbody input.amt");
  await amts.nth(0).fill("25000");
  await amts.nth(3).fill("25000");
  await page
    .getByPlaceholder("Being the reason this entry is made")
    .fill("Generator fuel paid from the till");
  const blocked = await selects.nth(0).locator("option").allTextContents();
  check(
    !blocked.some((o) => /^(1200|2000|2050|3100) /.test(o)),
    "subledger accounts are not offered for manual journals",
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

// ------------------------------------------------------------ day close
console.log("▸ manager closes the day");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/sales");
  const counted = page.locator("label", { hasText: "Cash counted" }).locator("input");
  await counted.fill("2000");
  await page.getByRole("button", { name: "Close the day" }).click();
  await page.getByText(/closed —/).waitFor({ timeout: 10000 });
  ok("closed with a counted drawer");
  await ctx.close();
}
check(
  sql("select count(*) from work_shift where closed_at is not null") === "1",
  "the day is closed once",
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
  await page.getByPlaceholder("INV-0012").fill("E2E-DUP-1");
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

// ------------------------------------------------------- the ledger ties
check(
  sql(
    "select count(*) from journal_entry e where status = 'published' and (select sum(debit) - sum(credit) from journal_line where journal_entry_id = e.id) <> 0",
  ) === "0",
  "every published journal balances",
);

await browser.close();
done("flows");
