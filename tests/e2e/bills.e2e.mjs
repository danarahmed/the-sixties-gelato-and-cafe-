// The till for a busy café, through the real screens: a photo and a category
// set on Products, tables laid out by a manager, a table's bill kept open,
// printed, guarded once printed, split between two payers and paid with
// change given; a bill kept under a customer's name; and a cancelled bill.
// (That an open bill holds the day open is checked in flows, before its day
// close.)
import { chromium, BASE, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const ok = (m) => check(true, m);
const ESPRESSO = "d0000000-0000-0000-0000-000000000001";
const ESPRESSO_SINGLE = "d1000000-0000-0000-0000-000000000001";
// A 1×1 PNG: the browser shrinks and re-encodes it, the database checks the bytes.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);
/** Printing is counted, not sent to a printer; each job's slips are kept to be read. */
async function till(who) {
  const s = await signIn(browser, who);
  await s.ctx.addInitScript(() => {
    window.__printed = 0;
    window.__slips = [];
    window.print = () => {
      window.__printed += 1;
      window.__slips.push(
        [...document.querySelectorAll(".print-slip > .slip")].map((slip) => ({
          ticket: slip.classList.contains("slip-ticket"),
          no: slip.querySelector(".tk-no-n, .sl-turn-no")?.textContent ?? null,
          rows: [...slip.querySelectorAll(".sl-items tbody tr")].map((tr) =>
            [...tr.cells].map((td) => td.textContent),
          ),
          text: slip.textContent,
        })),
      );
    };
  });
  return s;
}
const salesBefore = Number(sql("select count(*) from sales_order"));

// ------------------------------------------------------------ the menu
console.log("▸ owner gives the espresso a photo, a category and a ★");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/products");
  await page.getByPlaceholder("New category, e.g. Hot drinks").fill("Golden drinks");
  await page.getByRole("button", { name: "＋ Add" }).click();
  await page.getByText("Saved “Golden drinks”.").waitFor({ timeout: 10000 });
  ok("a category is added");
  const setup = page.locator(".product-setup", {
    has: page.locator(`input[value="Golden espresso"]`),
  });
  await setup.locator("select").selectOption({ label: "Golden drinks" });
  await setup.getByText("★ Favourite (shown first)").click();
  await setup.getByRole("button", { name: "Save" }).click();
  await setup.getByText("Saved.").waitFor({ timeout: 10000 });
  check(
    sql(
      `select c.name || ',' || p.is_favourite from product p join product_category c on c.id = p.category_id where p.id = '${ESPRESSO}'`,
    ) === "Golden drinks,true",
    "the espresso is in its category, as a favourite",
  );
  // Saving moves the card into its category's group, which replaces it; wait
  // for that, as a person would (Add photo is disabled until the save is done),
  // so the photo is not handed to the card being replaced.
  await page
    .locator("section", { has: page.locator("h2", { hasText: "Golden drinks" }) })
    .locator(".product-setup", { has: page.locator(`input[value="Golden espresso"]`) })
    .waitFor({ timeout: 10000 });
  await setup
    .locator('input[type="file"]')
    .setInputFiles({ name: "espresso.png", mimeType: "image/png", buffer: PNG });
  await setup.getByText("Photo saved").waitFor({ timeout: 15000 });
  const type = sql(`select content_type from product_image where product_id = '${ESPRESSO}'`);
  check(type === "image/webp" || type === "image/jpeg", `the photo is stored shrunk, as ${type}`);
  const url = sql(`select image_url from product where id = '${ESPRESSO}'`);
  const res = await page.request.get(`${BASE}${url}`);
  check(
    res.status() === 200 &&
      res.headers()["content-type"] === type &&
      /immutable/.test(res.headers()["cache-control"] ?? ""),
    "a signed-in member gets the photo, kept by the browser",
  );
  check(
    res.headers()["x-content-type-options"] === "nosniff",
    "and it is never sniffed as anything else",
  );
  const anon = await browser.newContext();
  const out = await anon.request.get(`${BASE}${url}`, { maxRedirects: 0 });
  check(
    out.status() !== 200 || !/image/.test(out.headers()["content-type"] ?? ""),
    "the public gets no photo",
  );
  await anon.close();
  await ctx.close();
}

// ------------------------------------------------------------ the floor
console.log("▸ manager lays out three tables");
{
  const { ctx, page } = await till("manager");
  await open(page, "/pos");
  await page.getByRole("tab", { name: /Tables/ }).click();
  await page.getByRole("button", { name: "Edit tables" }).click();
  await page.getByLabel("How many").fill("3");
  await page.locator(".bulk-add button").click();
  await page.getByText("3 tables added").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Close" }).click();
  await page.locator(".table-tile", { hasText: "Table 3" }).waitFor({ timeout: 10000 });
  ok("the floor shows Table 1 to Table 3");
  await ctx.close();
}
check(sql("select count(*) from dining_table where is_active") === "3", "three tables in use");

console.log("▸ manager sets the PIN they approve discounts with, on My account");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/account");
  const form = page.getByTestId("pin-form");
  await form.getByLabel("New PIN").fill("1234");
  await form.getByLabel("The same PIN again").fill("1234");
  await form.getByRole("button", { name: "Save the PIN" }).click();
  await form.getByText("Choose a PIN that is harder to guess").waitFor({ timeout: 10000 });
  ok("a run like 1234 is refused");
  await form.getByLabel("New PIN").fill("2580");
  await form.getByLabel("The same PIN again").fill("2580");
  await form.getByRole("button", { name: "Save the PIN" }).click();
  await form.getByText("Your PIN is saved.").waitFor({ timeout: 10000 });
  check(
    sql(
      "select pin_hash like '$2%' and pin_hash not like '%2580%' from app_user where email = 'manager@example.com'",
    ) === "t",
    "the PIN is kept only as a hash",
  );
  await ctx.close();
}

console.log("▸ cashier: Table 1 orders, is shown the bill, pays cash");
{
  const { ctx, page } = await till("cashier");
  await open(page, "/pos");
  check(
    await page.locator(".table-tile", { hasText: "Table 1" }).isVisible(),
    "with tables, the till opens on the floor",
  );
  await page.locator(".table-tile", { hasText: "Table 1" }).click();
  const espresso = page.locator(".product-tile", { hasText: "Golden espresso" });
  check(
    (await espresso.locator("img.tile-img").count()) === 1,
    "the espresso tile shows its photo",
  );
  await page.getByRole("tab", { name: /Golden drinks/ }).click();
  check((await page.locator(".product-tile").count()) === 1, "its category shows it alone");
  await espresso.click();
  await espresso.click();
  await page.getByRole("button", { name: /Save/ }).click();
  await page.getByText("Table 1 — saved").waitFor({ timeout: 10000 });
  check(sql("select count(*) from pos_tab where status = 'open'") === "1", "the bill is open");
  check(
    Number(sql("select count(*) from sales_order")) === salesBefore,
    "and it is not a sale yet",
  );
  check(
    await page.locator(".table-tile.busy", { hasText: "5,000 IQD" }).isVisible(),
    "Table 1 shows what it owes",
  );

  await page.locator(".table-tile", { hasText: "Table 1" }).click();
  await page.getByRole("button", { name: /Print bill/ }).click();
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  check(
    sql("select count(*) from pos_tab where bill_printed_at is not null") === "1",
    "printing the bill is recorded",
  );

  await page.getByRole("button", { name: /^One less/ }).click();
  await page.getByRole("button", { name: /Save/ }).click();
  await page
    .getByText("Only a manager can take items off a bill that has been printed")
    .waitFor({ timeout: 10000 });
  check(
    sql(
      "select sum(l.qty) from pos_tab_line l join pos_tab t on t.id = l.tab_id where t.status = 'open'",
    ) === "2",
    "a cashier cannot strike an item off a printed bill",
  );
  await page.getByRole("button", { name: /^One more/ }).click();

  await page.getByRole("button", { name: /Cash/ }).click();
  await page.locator("#cash-received").fill("10000");
  check(
    (await page.locator(".pay-modal .change-amt").textContent()) === "5,000 IQD",
    "the change is worked out: 5,000",
  );
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    sql(
      "select status from pos_tab where table_id = (select id from dining_table where name = 'Table 1')",
    ) === "paid",
    "the bill is paid",
  );
  check(Number(sql("select count(*) from sales_order")) === salesBefore + 1, "one sale, posted");
  check(
    sql("select net_amount from sales_order order by created_at desc limit 1") === "5000",
    "for exactly what the bill said",
  );

  // Table 2: one of them pays for the water now; the espressos wait.
  await page.locator(".table-tile", { hasText: "Table 2" }).click();
  await espresso.click();
  await espresso.click();
  await page.getByRole("tab", { name: /All/ }).click();
  await page.locator(".product-tile", { hasText: "Golden water" }).click();
  await page.getByRole("button", { name: /Save/ }).click();
  await page.getByText("Table 2 — saved").waitFor({ timeout: 10000 });
  await page.locator(".table-tile", { hasText: "Table 2" }).click();
  check(
    await page.getByRole("button", { name: /Cancel bill/ }).isDisabled(),
    "a cashier cannot cancel a bill with items on it",
  );
  await page.getByRole("button", { name: /Split bill/ }).click();
  await page
    .locator(".split-line", { hasText: "Golden water" })
    .getByRole("button", { name: "+" })
    .click();
  await page.getByRole("button", { name: /Move to a new bill/ }).click();
  await page.getByText(/Split\. The new bill is on screen/).waitFor({ timeout: 10000 });
  check(
    (await page.locator(".order-title").textContent()) === "Table 2 · 2",
    "the new bill is on screen as Table 2 · 2",
  );
  await page.getByRole("button", { name: /Card/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    sql(
      "select string_agg(status || ':' || (select sum(qty) from pos_tab_line l where l.tab_id = t.id)::text, ',' order by status) from pos_tab t where table_id = (select id from dining_table where name = 'Table 2')",
    ) === "open:2,paid:1",
    "the water is paid; the two espressos still wait on the table's bill",
  );

  // A takeaway customer who will pay when their order is ready.
  await page.locator(".strip-chip", { hasText: "Quick sale" }).click();
  await espresso.click();
  await page.getByRole("button", { name: /Keep open, pay later/ }).click();
  await page.getByLabel("Customer's name").fill("Sara");
  await page.getByRole("button", { name: "Keep open", exact: true }).click();
  await page.getByText("Sara — kept open, waiting for payment").waitFor({ timeout: 10000 });
  await page.locator(".strip-chip", { hasText: "Sara" }).click();
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    sql("select status from pos_tab where label = 'Sara'") === "paid",
    "Sara's bill waited for her, then was paid",
  );

  // A discount, typed either way: a percentage fills in the amount, an amount the percentage.
  await page.locator(".strip-chip", { hasText: "Quick sale" }).click();
  await page.getByRole("button", { name: "Takeaway" }).click();
  await espresso.click();
  await espresso.click();
  await page.getByRole("button", { name: "＋ Discount" }).click();
  const pct = page.getByLabel("Discount as a percentage");
  const amt = page.getByLabel("Discount as an amount in IQD");
  await pct.fill("10");
  check((await amt.inputValue()) === "500", "10% of 5,000 fills in 500");
  await amt.fill("750");
  check((await pct.inputValue()) === "15", "750 off 5,000 fills in 15%");
  check(
    (await page.locator(".order-total strong").textContent()) === "4,250 IQD",
    "and the total to pay is 4,250",
  );
  // The test business keeps the default step: a percentage comes to the nearest 500 IQD.
  await pct.fill("7");
  check((await amt.inputValue()) === "500", "7% of 5,000 is 350: rounded to 500");
  check(
    await page.getByText("A percentage is rounded to the nearest 500 IQD.").isVisible(),
    "and the till says so",
  );
  await pct.fill("47");
  check((await amt.inputValue()) === "2500", "47% of 5,000 is 2,350: rounded to 2,500");
  check(
    (await page.locator(".order-total strong").textContent()) === "2,500 IQD",
    "and 2,500 to pay",
  );
  // Every discount has its reason; over the cap a manager approves it (0028).
  const cash = page.getByRole("button", { name: /Cash/ });
  check(await cash.isDisabled(), "no discount is given without its reason");
  await page.getByLabel("Why?").selectOption("regular");
  await page.getByTestId("discount-needs-approval").waitFor({ timeout: 10000 });
  check(
    (await cash.isDisabled()) &&
      (await page.getByText("Over 10%: a manager approves it.").isVisible()),
    "47% is over the cap: not without a manager",
  );
  await page.getByRole("button", { name: /Ask a manager/ }).click();
  const approve = page.getByRole("dialog", { name: "A manager approves the discount" });
  check(
    ((await approve.textContent()) ?? "").includes("47% · −2,500 IQD · Regular customer"),
    "the manager sees what they are approving",
  );
  await approve.getByLabel("Manager", { exact: true }).selectOption({ label: "Demo Manager" });
  await approve.getByLabel("PIN").fill("1111");
  await approve.getByRole("button", { name: "Approve" }).click();
  await approve.getByText("That PIN is not right").waitFor({ timeout: 10000 });
  ok("a wrong PIN is refused");
  await approve.getByLabel("PIN").fill("2580");
  await approve.getByRole("button", { name: "Approve" }).click();
  await page.getByTestId("discount-approved").waitFor({ timeout: 10000 });
  check(
    ((await page.getByTestId("discount-approved").textContent()) ?? "").includes(
      "Approved by Demo Manager",
    ),
    "the manager's name and PIN approve it",
  );
  await cash.click();
  check(
    /47% · −2,500 IQD/.test((await page.locator(".pay-note").textContent()) ?? ""),
    "taking the money shows the discount",
  );
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    sql(
      "select gross_amount || '/' || discount_amount || '/' || net_amount from sales_order order by created_at desc limit 1",
    ) === "5000/2500/2500",
    "the sale records what the till showed: 5,000 less 2,500",
  );
  check(
    sql(
      "select o.discount_percent || ' ' || o.discount_reason || ' by ' || g.full_name || ', approved by ' || a.full_name from sales_order o join app_user g on g.id = o.discount_by join app_user a on a.id = o.discount_approved_by order by o.created_at desc limit 1",
    ) === "47 Regular customer by Demo Cashier, approved by Demo Manager",
    "and why, who gave it, and who approved it",
  );
  check(
    sql(
      "select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit else ' Cr ' || l.credit end, ' | ' order by a.code) from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account a on a.id = l.account_id where a.code in ('1000', '4000', '4100') and e.reference_id = (select id from sales_order order by created_at desc limit 1)",
    ) === "1000 Dr 2500 | 4000 Cr 5000 | 4100 Dr 2500",
    "revenue at full price, the discount in 4100, the cash as paid",
  );
  await ctx.close();
}

// ------------------------------------------------------------ cancelling
console.log("▸ manager cancels what is left of Table 2");
{
  const { ctx, page } = await till("manager");
  await open(page, "/pos");
  await page.locator(".table-tile", { hasText: "Table 2" }).click();
  await page.getByRole("button", { name: /Cancel bill/ }).click();
  check(
    await page.getByRole("button", { name: "Cancel the bill" }).isDisabled(),
    "a bill with items is cancelled with a reason from the list",
  );
  await page.getByLabel("Reason").selectOption("customer_left");
  await page.getByRole("button", { name: "Cancel the bill" }).click();
  await page.getByText("Table 2 — bill cancelled").waitFor({ timeout: 10000 });
  check(sql("select count(*) from pos_tab where status = 'open'") === "0", "no bill is left open");
  check(
    sql(
      "select count(*) from audit_log where action = 'bill.cancel' and reason = 'Customer left without ordering'",
    ) === "1" &&
      sql(
        "select cancel_reason_code from pos_tab where status = 'cancelled' order by closed_at desc limit 1",
      ) === "customer_left",
    "the cancellation is on the audit trail with its reason",
  );
  await ctx.close();
}
check(
  Number(sql("select count(*) from sales_order")) === salesBefore + 4,
  "three bills and one discounted sale: four sales",
);

// ------------------------------------------------------------ prices (0025)
console.log(
  "▸ a printed bill keeps its prices; a till with the old prices is stopped, then catches up",
);
{
  /** Wait for the database to say so (a message shown twice cannot be waited for). */
  const until = async (q, want) => {
    for (let i = 0; i < 50 && sql(q) !== want; i++) await new Promise((r) => setTimeout(r, 200));
    return sql(q) === want;
  };
  const { ctx, page } = await till("cashier");
  await open(page, "/pos");
  await page.locator(".table-tile", { hasText: "Table 3" }).click();
  const espresso = page.locator(".product-tile", { hasText: "Golden espresso" });
  await espresso.click();
  await espresso.click();
  await page.getByRole("button", { name: /Print bill/ }).click();
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  check(
    sql(
      "select string_agg(trim_scale(l.unit_price)::text, ',') from pos_tab_line l join pos_tab t on t.id = l.tab_id where t.status = 'open'",
    ) === "2500",
    "printing the bill freezes the price the customer is shown",
  );

  // Meanwhile the owner puts the espresso up to 3,000, from today.
  const owner = await signIn(browser, "owner");
  await open(owner.page, "/products");
  const card = owner.page.locator(".card", {
    has: owner.page.locator('input[value="Golden espresso"]'),
  });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Change a price…" }).click();
  const priceNow = (c) =>
    `select trim_scale(price_on('${ESPRESSO_SINGLE}', '${c}', null, business_local_date(business_id, now())))::text from product_variant where id = '${ESPRESSO_SINGLE}'`;
  for (const [c, label] of [
    ["dine_in", "Dine-in"],
    ["takeaway", "Takeaway"],
  ]) {
    await card
      .locator("label", { hasText: /^Channel/ })
      .locator("select")
      .selectOption(c);
    await card.locator("label", { hasText: "New price" }).locator("input").fill("3000");
    await card.getByRole("button", { name: "Set price" }).click();
    check(await until(priceNow(c), "3000"), `${label} is 3,000 from today`);
  }
  check(
    sql(
      `select count(*) from audit_log a join app_user u on u.id = a.app_user_id
        where a.action = 'price.set' and a.after_state ->> 'variant' = '${ESPRESSO_SINGLE}'
          and a.after_state ->> 'price' = '3000' and u.email = 'owner@example.com'`,
    ) === "2",
    "each price set is on the audit trail, with who set it",
  );
  await owner.ctx.close();

  // The customer pays what the bill in their hand says.
  await page.getByRole("button", { name: /Cash/ }).click();
  check(
    (await page.locator(".pay-modal .pay-total").textContent()) === "5,000 IQD",
    "the printed bill is still 5,000 on the till",
  );
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    sql("select net_amount from sales_order order by created_at desc limit 1") === "5000",
    "and is paid at its printed prices: 5,000, not 6,000",
  );

  // A quick sale on a till that loaded the menu before the change.
  const sales = Number(sql("select count(*) from sales_order"));
  await page.locator(".strip-chip", { hasText: "Quick sale" }).click();
  await page.getByRole("button", { name: "Takeaway" }).click();
  await espresso.click();
  check(
    (await page.locator(".order-total strong").textContent()) === "2,500 IQD",
    "a till left open still shows the old price",
  );
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText(/The total is 3000 now, not the 2500 shown/).waitFor({ timeout: 10000 });
  check(
    Number(sql("select count(*) from sales_order")) === sales,
    "taking 2,500 for a 3,000 espresso is refused: nothing is recorded",
  );
  await page.locator(".order-total strong", { hasText: "3,000 IQD" }).waitFor({ timeout: 10000 });
  check(
    (await page.locator(".pay-modal").count()) === 0,
    "the till fetches today's prices and shows the order as it now stands",
  );
  await page.getByRole("button", { name: /Cash/ }).click();
  check(
    (await page.locator(".pay-modal .pay-total").textContent()) === "3,000 IQD",
    "taking the money again asks for 3,000",
  );
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  check(
    sql("select net_amount from sales_order order by created_at desc limit 1") === "3000",
    "and the sale records what the customer was told",
  );
  await ctx.close();
}

// ------------------------------------------------------------ two copies (release I)
console.log("▸ an order prints twice: the customer's receipt and the barista's ticket, by number");
{
  const { ctx, page } = await till("cashier");
  await open(page, "/pos");
  const espresso = page.locator(".product-tile", { hasText: "Golden espresso" });
  const water = page.locator(".product-tile", { hasText: "Golden water" });
  const printed = (n) => page.waitForFunction((n) => window.__printed === n, n, { timeout: 10000 });
  const lastJob = () => page.evaluate(() => window.__slips[window.__slips.length - 1]);

  // A quick sale takes its number as it is paid; one press prints both copies.
  await page.locator(".strip-chip", { hasText: "Quick sale" }).click();
  await page.getByRole("button", { name: "Takeaway" }).click();
  await espresso.click();
  await espresso.click();
  await page.getByRole("button", { name: "Add a note" }).first().click();
  await page.getByPlaceholder("e.g. no sugar, extra shot").fill("oat milk");
  await page.getByPlaceholder("e.g. no sugar, extra shot").press("Enter");
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  const sold = sql("select turn_no from sales_order order by created_at desc limit 1");
  check(
    /^\d+$/.test(sold) && (await page.locator(".rc-turn strong").textContent()) === sold,
    "the sale takes the day's next number, shown for the customer",
  );
  await page.getByRole("button", { name: /Print receipt \+ barista ticket/ }).click();
  await printed(1);
  const both = await lastJob();
  check(
    both.length === 2 && !both[0].ticket && both[1].ticket,
    "one press prints two copies: the customer's receipt, then the barista's ticket",
  );
  check(
    both[0].no === sold && both[0].text.includes("Your number") && both[0].text.includes("6,000"),
    "the receipt has the number and every amount",
  );
  const [qty, , each, amount] = both[0].rows[0] ?? [];
  check(
    qty === "2" && each === "3,000" && amount === "6,000",
    "each line shows how many, the price of one and what they come to: 2 × 3,000 = 6,000",
  );
  check(
    both[1].no === sold &&
      both[1].text.includes("Golden espresso") &&
      both[1].text.includes("oat milk") &&
      !/IQD|3,000|6,000/.test(both[1].text),
    "the barista's ticket has the number, what to make and its note, and no prices",
  );
  await page.getByRole("button", { name: /Print receipt$/ }).click();
  await printed(2);
  check(
    (await lastJob()).length === 1,
    "printed again, the receipt comes alone: the bar has the order",
  );
  await page.getByRole("button", { name: /Barista ticket/ }).click();
  await printed(3);
  const again = await lastJob();
  check(
    again.length === 1 && again[0].ticket && again[0].text.includes("Copy: already sent"),
    "and the barista's ticket again is marked as a copy",
  );

  // A till that prints by itself: a table's order goes to the bar as it is saved.
  await page.getByRole("button", { name: "Printing" }).click();
  await page.getByLabel("Print by itself").check();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.getByRole("tab", { name: /Tables/ }).click();
  await page.locator(".table-tile", { hasText: "Table 1" }).click();
  await espresso.click();
  await page.getByRole("button", { name: /Save/ }).click();
  await page.getByText("Table 1 — saved").waitFor({ timeout: 10000 });
  await printed(4);
  const bill = sql("select turn_no from pos_tab where status = 'open'");
  check(Number(bill) === Number(sold) + 1, "a table's bill takes the next number as it is opened");
  const first = await lastJob();
  check(
    first.length === 1 &&
      first[0].ticket &&
      first[0].no === bill &&
      first[0].text.includes("Table 1") &&
      first[0].text.includes("Golden espresso") &&
      !first[0].text.includes("Added to the order"),
    "saving the table's order prints the bar its ticket, with the bill's number",
  );
  await page.locator(".table-tile", { hasText: "Table 1" }).click();
  await water.click();
  await page.getByRole("button", { name: /Save/ }).click();
  await page.getByText("Table 1 — saved").waitFor({ timeout: 10000 });
  await printed(5);
  const more = await lastJob();
  check(
    more[0].text.includes("Added to the order") &&
      more[0].text.includes("Golden water") &&
      !more[0].text.includes("Golden espresso"),
    "more for the table: only what was added goes to the bar",
  );
  await page.locator(".table-tile", { hasText: "Table 1" }).click();
  await page.getByRole("button", { name: /Barista ticket/ }).click();
  await printed(6);
  const copy = await lastJob();
  check(
    copy[0].text.includes("Copy: already sent") &&
      copy[0].text.includes("Golden espresso") &&
      copy[0].text.includes("Golden water"),
    "asked for by hand, the whole order comes out again, marked as a copy",
  );
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  await printed(7);
  const paid = await lastJob();
  check(
    paid.length === 1 && !paid[0].ticket && paid[0].no === bill,
    "paid, the table's receipt prints by itself with the bill's number, and no second ticket",
  );
  check(
    sql("select turn_no from sales_order order by created_at desc limit 1") === bill,
    "the sale keeps the bill's number",
  );
  await ctx.close();
}

await browser.close();
done("bills");
