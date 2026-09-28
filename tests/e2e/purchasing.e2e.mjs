// Purchasing (0044, release S) through the real screens: a manager drafts a
// purchase order, approves it within the limit, marks it sent and opens it to
// print; receives against it, part of it and then more than ordered, which is
// asked about first; closes it. An order over the manager's limit waits for
// the owner, who approves it and cancels it. Goods go back to the supplier
// before the bill (off what it will clear) and after it (a credit, set
// against the bill); the owner records the supplier's notes and their own
// credits, and sets one against a bill. The statement between two dates,
// Reports → Purchasing and the audit trail say so; the new screens speak
// Arabic and Kurdish; and the books still tie.
import { BASE, TODAY, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const n = (q) => Number(last(q));
const B = "00000000-0000-0000-0000-0000000000b1";
const BEANS = "c0000000-0000-0000-0000-000000000001";
const CUP = "c0000000-0000-0000-0000-000000000002";
const today = last(`select ${TODAY}`);
const iqd = (v) => `${Math.round(v).toLocaleString("en-US")} IQD`;

/** Each check's difference from its account (earlier suites leave some, on purpose). */
const differences = () =>
  JSON.parse(
    last(`select test.act_as('owner@example.com');
          select json_object_agg(check_key, difference) from report_reconciliation(${TODAY})`),
  );
const differencesBefore = differences();

// A supplier of this suite's own.
const SUP = last(`select test.act_as('manager@example.com');
                  select create_supplier('E2E Roastery', 'Dana', '0750 555 0101')`);
const lastPo = () =>
  n(`select coalesce(max(po_no), 0) from purchase_order where business_id = '${B}'`);
const poId = (no) =>
  last(`select id from purchase_order where business_id = '${B}' and po_no = ${no}`);
const stageOf = (page, no) =>
  page.locator(`[data-testid="po-row"][data-po="${no}"]`).getByTestId("po-stage").textContent();
const receipts = () =>
  sql(`select id from goods_receipt where supplier_id = '${SUP}' order by received_at, id`)
    .split("\n")
    .filter(Boolean);
const receiptNo = (id) => last(`select receipt_no from goods_receipt where id = '${id}'`);
const confirmations = () =>
  n(`select count(*) from audit_log where action = 'purchase.quantity_confirmed'`);

/**
 * Receive what the form holds. A price far from what the item costs now
 * (earlier suites move the costs) is confirmed; a quantity asked about is
 * confirmed only when the suite expects the question.
 */
async function receive(page, form, answer, { quantity = false } = {}) {
  await form.getByRole("button", { name: "Receive goods" }).click();
  const ask = page.getByTestId("price-check");
  const said = form.getByText(answer);
  await ask.or(said).first().waitFor({ timeout: 15000 });
  let asked = "";
  if (await ask.isVisible()) {
    asked = await ask.textContent();
    await ask.locator("button.btn-primary").click();
    await said.waitFor({ timeout: 15000 });
  }
  if (quantity)
    check(asked.includes("Check the quantity") || asked.includes("the quantity:"), `asked first`);
  return asked;
}

// ------------------------------------------------------------ an order drafted
console.log("▸ a manager drafts a purchase order, approves it within the limit and sends it");
let po = 0;
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const panel = page.getByTestId("po-panel");
  check(
    (await panel.textContent()).includes("yours is 250,000 IQD"),
    "the panel says how an order goes, and the manager's own limit: 250,000",
  );
  await panel.getByRole("button", { name: "New order" }).click();
  const form = page.getByTestId("po-form");
  await form.getByLabel("Supplier", { exact: true }).selectOption({ label: "E2E Roastery" });
  await form.getByLabel("Expected", { exact: true }).fill(today);
  await form
    .getByLabel("Note for the supplier", { exact: true })
    .fill("Before the weekend, please");
  let line = form.getByTestId("po-line").nth(0);
  await line.getByLabel("Item", { exact: true }).selectOption(BEANS);
  await line.getByLabel("Quantity", { exact: true }).fill("2");
  await line.getByLabel("Unit", { exact: true }).selectOption("kg");
  await line.getByLabel("Price per unit", { exact: true }).fill("10000");
  await form.getByRole("button", { name: "Add a line" }).click();
  line = form.getByTestId("po-line").nth(1);
  await line.getByLabel("Item", { exact: true }).selectOption(CUP);
  await line.getByLabel("Quantity", { exact: true }).fill("1");
  await line.getByLabel("Unit", { exact: true }).selectOption("sleeve_50");
  await line.getByLabel("Price per unit", { exact: true }).fill("2500");
  check(
    (await form.getByTestId("po-total").textContent()) === "22,500 IQD",
    "the total as it is typed: 2 kg at 10,000 and a sleeve of cups at 2,500",
  );
  await form.getByRole("button", { name: "Save the draft" }).click();
  await panel.getByText(/Order \d+ saved as a draft: 22,500 IQD/).waitFor({ timeout: 15000 });
  po = lastPo();
  check((await stageOf(page, po)) === "Draft", `order ${po} is a draft, waiting for approval`);

  const row = page.locator(`[data-testid="po-row"][data-po="${po}"]`);
  await row.getByRole("button", { name: "Approve" }).click();
  await row.getByText(`Order ${po} approved.`).waitFor({ timeout: 15000 });
  await page.waitForFunction(
    (no) =>
      document.querySelector(`[data-testid="po-row"][data-po="${no}"] [data-testid="po-stage"]`)
        ?.textContent === "Approved",
    po,
    { timeout: 10000 },
  );
  check(
    (await row.textContent()).includes("Approved by Demo Manager"),
    "the manager approves it, and is named on it",
  );
  await row.getByRole("button", { name: "Mark as sent" }).click();
  await row.getByText(`Order ${po} marked as sent to the supplier.`).waitFor({ timeout: 15000 });
  await page.waitForFunction(
    (no) =>
      document.querySelector(`[data-testid="po-row"][data-po="${no}"] [data-testid="po-stage"]`)
        ?.textContent === "Sent",
    po,
    { timeout: 10000 },
  );
  check(true, "and marks it sent to the supplier");

  await open(page, `/purchasing/orders/${poId(po)}`);
  const text = await page.getByTestId("po-page").textContent();
  check(
    text.includes(`Purchase order ${po}`) &&
      text.includes("E2E Roastery") &&
      text.includes(`Expected by ${today}`) &&
      text.includes("Deliver to") &&
      text.includes("Approved by Demo Manager on") &&
      text.includes("Before the weekend, please"),
    "its own page: to whom, for when and where, the note, and who approved it",
  );
  check(
    await page.getByRole("button", { name: "Print the order" }).isVisible(),
    "and it can be printed for the supplier",
  );
  check(
    (await page.getByTestId("po-received").textContent()).includes(
      "Nothing has come against it yet.",
    ),
    "nothing has come yet",
  );
  await ctx.close();
}

// ------------------------------------------------------------ received against it
console.log("▸ the delivery comes against the order: part of it, then more than ordered");
let r1 = "";
let r2 = "";
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const form = page.getByTestId("receive");
  await form.getByTestId("receive-order").selectOption(poId(po));
  const lines = form.getByTestId("receive-line");
  const qty = (i) =>
    lines
      .nth(i)
      .locator("label", { hasText: /^Quantity/ })
      .locator("input");
  check(
    (await lines.count()) === 2 &&
      (await qty(0).inputValue()) === "2" &&
      (await qty(1).inputValue()) === "1",
    "choosing the order fills the delivery with what is still to come, at the order's prices",
  );
  await qty(0).fill("1");
  check(
    (await lines.nth(0).getByTestId("receive-diff").textContent()).includes(
      "2 kg still on order: 1 coming now",
    ),
    "a line short of the order says so",
  );
  await receive(
    page,
    form,
    new RegExp(`Receipt \\d+ — 12,500 IQD into stock against order ${po}, awaiting its bill\\.`),
  );
  r1 = receipts()[0] ?? "";
  check(r1 !== "", "a kilo of beans and the cups come in, against the order");
  await page.waitForFunction(
    (no) =>
      document.querySelector(`[data-testid="po-row"][data-po="${no}"] [data-testid="po-stage"]`)
        ?.textContent === "Partly received",
    po,
    { timeout: 10000 },
  );
  check(
    (await page.locator(`[data-testid="po-row"][data-po="${po}"]`).textContent()).includes(
      "1/2 kg",
    ),
    "the order is partly received: 1 of the 2 kg",
  );

  const before = confirmations();
  await form.getByTestId("receive-order").selectOption(poId(po));
  check(
    (await lines.count()) === 1 && (await qty(0).inputValue()) === "1",
    "chosen again, only the kilo still to come is filled in",
  );
  await qty(0).fill("3");
  check(
    (await lines.nth(0).getByTestId("receive-diff").textContent()).includes(
      "More than is still on order: 3 of 1 kg",
    ),
    "three kilos where one is still on order is shown before anything is sent",
  );
  const asked = await receive(
    page,
    form,
    new RegExp(`Receipt \\d+ — 30,000 IQD into stock against order ${po}, awaiting its bill\\.`),
    { quantity: true },
  );
  check(
    asked.includes("1 kg") || asked.includes("1000") || asked.includes("ordered"),
    `the database asks about the quantity (${asked.slice(0, 120)})`,
  );
  check(
    confirmations() === before + 1,
    "confirmed, it comes in, and the confirmation is on the trail",
  );
  r2 = receipts()[1] ?? "";
  await page.waitForFunction(
    (no) =>
      document.querySelector(`[data-testid="po-row"][data-po="${no}"] [data-testid="po-stage"]`)
        ?.textContent === "Received",
    po,
    { timeout: 10000 },
  );
  check(true, "everything on the order has come");

  const row = page.locator(`[data-testid="po-row"][data-po="${po}"]`);
  await row.getByRole("button", { name: "Close", exact: true }).click();
  check(
    (await row
      .getByLabel("Why is the rest not coming?", { exact: true })
      .getAttribute("placeholder")) === "A note (optional)",
    "all of it came: a note is optional",
  );
  await row.getByRole("button", { name: "Close the order" }).click();
  await row.getByText(`Order ${po} closed.`).waitFor({ timeout: 15000 });
  check(
    last(`select status from purchase_order where id = '${poId(po)}'`) === "closed",
    "the order is closed",
  );
  await ctx.close();
}

// ------------------------------------------------------------ over the manager's limit
console.log("▸ an order over the manager's limit waits for the owner, who approves and cancels it");
let big = 0;
{
  last(`select test.act_as('manager@example.com');
        select save_po(null, '${SUP}',
          '[{"item_id":"${BEANS}","qty":30,"unit_code":"kg","unit_price":10000}]'::jsonb)`);
  big = lastPo();
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const row = page.locator(`[data-testid="po-row"][data-po="${big}"]`);
  check(
    (await row.textContent()).includes(
      "Over your limit: the owner or the general manager approves it",
    ) && (await row.getByRole("button", { name: "Approve" }).count()) === 0,
    "300,000 is over the manager's 250,000: no Approve, and it says who approves it",
  );
  await ctx.close();

  const owner = await signIn(browser, "owner");
  await open(owner.page, "/purchasing");
  const theirs = owner.page.locator(`[data-testid="po-row"][data-po="${big}"]`);
  await theirs.getByRole("button", { name: "Approve" }).click();
  await theirs.getByText(`Order ${big} approved.`).waitFor({ timeout: 15000 });
  await theirs.getByRole("button", { name: "Cancel", exact: true }).click();
  await theirs
    .getByLabel("Why cancel it?", { exact: true })
    .fill("Too much at once: ordered again by the week");
  await theirs.getByRole("button", { name: "Cancel the order" }).click();
  await theirs.getByText(`Order ${big} cancelled.`).waitFor({ timeout: 15000 });
  check(
    last(`select status || ': ' || cancel_reason from purchase_order where id = '${poId(big)}'`) ===
      "cancelled: Too much at once: ordered again by the week",
    "the owner approves it, then cancels it with a reason",
  );
  await owner.ctx.close();
}

// ------------------------------------------------------------ returns
console.log("▸ goods go back: before the bill, off what it clears; after it, as a credit");
let returnCredit = 0;
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const box = page.getByTestId("return-goods");
  /** Half a kilo, or a kilo, of beans back against a delivery. */
  async function returnBeans(receipt, qty, why, answer) {
    await box.getByLabel("Supplier", { exact: true }).selectOption({ label: "E2E Roastery" });
    await box.getByLabel("The delivery they came in", { exact: true }).selectOption(receipt);
    const line = box.getByTestId("return-line").first();
    await line.getByLabel("Item", { exact: true }).selectOption(BEANS);
    await line.getByLabel("Quantity", { exact: true }).fill(qty);
    await line.getByLabel("Unit", { exact: true }).selectOption("kg");
    await box.getByLabel("Why they are going back", { exact: true }).fill(why);
    await box.getByRole("button", { name: "Return them" }).click();
    // Earlier suites may have sold the beans below zero: the return is asked about.
    const ask = box.getByTestId("return-check");
    const said = box.getByText(answer);
    await ask.or(said).first().waitFor({ timeout: 15000 });
    if (await ask.isVisible()) {
      await ask.getByRole("button", { name: "Return it all the same" }).click();
      await said.waitFor({ timeout: 15000 });
    }
  }
  await returnBeans(
    r1,
    "0.5",
    "Two bags split in delivery",
    /Return \d+: 5,000 IQD back to the supplier, off what the delivery's bill will clear\./,
  );
  check(true, "half a kilo from the delivery not yet billed: 5,000 off what its bill will clear");
  check(
    n(`select receipt_grni_value('${r1}')`) === 7500,
    "the delivery is now owed 7,500: 12,500 less the 5,000 that went back",
  );

  last(`select test.act_as('owner@example.com');
        select record_bill('${SUP}', 'E2E-RST-1', ${TODAY}, 30000, 30, '${r2}')`);
  await open(page, "/purchasing");
  await returnBeans(
    r2,
    "1",
    "Out of date on arrival",
    /Return \d+: 10,000 IQD owed back, as credit \d+ on the supplier's account; 10,000 IQD of it set against the delivery's bill\./,
  );
  returnCredit = n(
    `select max(credit_no) from supplier_credit where supplier_id = '${SUP}' and kind = 'goods_return'`,
  );
  check(
    returnCredit > 0,
    `a kilo from the billed delivery: credit ${returnCredit}, set against its bill`,
  );
  const list = page.getByTestId("returns-list");
  await list.getByText(`Credit ${returnCredit} on the account`).waitFor({ timeout: 15000 });
  check(
    (await list.textContent()).includes("Off the delivery's bill"),
    "Purchasing lists both returns, and how each is owed back",
  );
  await ctx.close();
}

// ------------------------------------------------------------ the supplier's credits
console.log("▸ the owner records the supplier's notes and credits, and sets one against a bill");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/vendors");
  await page.locator("button.vrow", { hasText: "E2E Roastery" }).click();
  await page.getByRole("button", { name: "Credit notes" }).click();
  const credits = page.getByTestId("supplier-credits");
  const creditRow = (no) => credits.locator(`[data-testid="credit-row"][data-credit="${no}"]`);
  const rc = creditRow(returnCredit);
  check(
    (await rc.textContent()).includes("Goods returned"),
    "the return's credit is there, for goods returned",
  );
  await rc.getByLabel("The number on their credit note", { exact: true }).fill("RST-CN-1");
  await rc.getByRole("button", { name: "Record it" }).click();
  await rc.getByText("RST-CN-1").waitFor({ timeout: 15000 });
  check(true, "their credit note's number is recorded against it");

  const form = page.getByTestId("record-credit");
  await form.getByText("Other: a service, an overcharge").click();
  await form.getByLabel("The number on their credit note", { exact: true }).fill("RST-CN-2");
  await form.getByLabel("Amount (IQD)", { exact: true }).fill("1000");
  await form.getByLabel("Taken off the account", { exact: true }).selectOption("6200");
  await form.getByLabel("What it is for", { exact: true }).fill("Pallet charge refunded");
  await form.getByRole("button", { name: "Record the credit" }).click();
  await form
    .getByText(/Credit \d+ recorded: set it against a bill when one is owed\./)
    .waitFor({ timeout: 15000 });
  const other = n(
    `select max(credit_no) from supplier_credit where supplier_id = '${SUP}' and kind = 'other'`,
  );
  check(other > 0, `a credit for other, left on the account (credit ${other})`);

  const allocate = creditRow(other).getByTestId("credit-allocate");
  await allocate.waitFor({ timeout: 15000 });
  check(
    (await allocate.getByLabel("Amount", { exact: true }).inputValue()) === "1000",
    "set against a bill, the whole of it is offered",
  );
  await allocate.getByRole("button", { name: "Set against it" }).click();
  await allocate
    .getByText("Set against the bill: 0 IQD of the credit left.")
    .waitFor({ timeout: 15000 });
  check(true, "and set against bill E2E-RST-1, nothing of it is left");

  await form.getByText("A lower price on a delivery that was billed").click();
  await form.getByLabel("The delivery", { exact: true }).selectOption(r2);
  await form.getByLabel("The number on their credit note", { exact: true }).fill("RST-CN-3");
  await form.getByLabel("Amount (IQD)", { exact: true }).fill("600");
  await form.getByLabel("What it is for", { exact: true }).fill("300 off a kilo, agreed");
  await form.getByRole("button", { name: "Record the credit" }).click();
  await form
    .getByText(/Credit \d+ recorded; 600 IQD of it set against the bill\./)
    .waitFor({ timeout: 15000 });
  check(true, "a lower price on the billed delivery: 600, set against its bill");
  check(
    last(
      `select amount_total - paid_amount from purchase_invoice where invoice_no = 'E2E-RST-1'`,
    ) === "18400",
    "the bill is owed 18,400: 30,000 less the return's 10,000, the 1,000 and the 600",
  );

  // The statement between two dates, from the supplier's statement.
  await page.getByRole("button", { name: "Statement" }).click();
  const link = page.getByTestId("statement-dates");
  check(
    (await link.getAttribute("href")) === `/vendors/${SUP}/statement`,
    "the statement links to one between two dates, to print",
  );
  await open(page, `/vendors/${SUP}/statement?from=${today}&to=${today}`);
  // The page shows the statement; a copy of it is kept out of sight, to print.
  const shown = page.getByTestId("statement-page");
  const st = await shown.getByTestId("supplier-statement").textContent();
  check(
    st.includes("Bill E2E-RST-1") &&
      st.includes("Credit — goods returned") &&
      st.includes("Credit — other") &&
      st.includes("Credit — a lower price") &&
      st.includes("RST-CN-1"),
    "the statement has the bill and each credit, with their note's number",
  );
  check(
    (await shown.getByTestId("statement-opening").textContent()) === iqd(0) &&
      (await shown.getByTestId("statement-closing").textContent()) === iqd(18400),
    "owed nothing before today, and 18,400 at the end of it",
  );
  check(
    (await shown.getByTestId("statement-open-bills").textContent()).includes("18,400 IQD"),
    "the bill still owed, with what is left of it",
  );
  check(
    await page.getByRole("button", { name: "Print the statement" }).isVisible(),
    "and it prints",
  );
  await ctx.close();
}

// ------------------------------------------------------------ the report and the trail
console.log("▸ Reports → Purchasing and the audit trail");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/reports?from=${today}&to=${today}`);
  const orders = await page.getByTestId("purchasing-orders").textContent();
  check(
    orders.includes("E2E Roastery") && orders.includes("Closed") && orders.includes("Cancelled"),
    "the orders of the day: one closed, one cancelled",
  );
  const returns = await page.getByTestId("purchasing-returns").textContent();
  check(
    returns.includes("Two bags split in delivery") && returns.includes("Out of date on arrival"),
    "the returns, with why",
  );
  const credits = await page.getByTestId("purchasing-credits").textContent();
  check(
    credits.includes("RST-CN-1") && credits.includes("RST-CN-2") && credits.includes("RST-CN-3"),
    "and the supplier's credits, by their note",
  );

  await open(page, "/audit?group=suppliers");
  const trail = await page.locator("main").textContent();
  check(
    [
      "Purchase order drafted",
      "Purchase order approved",
      "Purchase order sent",
      "Purchase order closed",
      "Purchase order cancelled",
      "More than ordered, confirmed",
      "Goods returned to a supplier",
      "Supplier's credit note recorded",
      "Supplier's note matched to a credit",
      "Credit set against a bill",
      `Purchase order ${po}`,
    ].every((w) => trail.includes(w)),
    "the trail names each step in words, and the order by its number",
  );
  await ctx.close();
}

// ------------------------------------------------------------ in Arabic and Kurdish
console.log("▸ the new screens in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of [
    "/purchasing",
    `/purchasing/orders/${poId(po)}`,
    `/vendors/${SUP}/statement?from=${today}&to=${today}`,
    `/reports?from=${today}&to=${today}`,
    "/audit?group=suppliers",
  ]) {
    await open(page, path);
    const words = await english(page, path.replace(/\?.*$/, ""));
    if (words.length) left.push(`${path}: ${words.slice(0, 12).join(" ")}`);
  }
  await open(page, "/vendors");
  await page.locator("button.vrow", { hasText: "E2E Roastery" }).click();
  await page.locator(".dtab").nth(2).click();
  await page.getByTestId("supplier-credits").waitFor({ timeout: 10000 });
  const words = await english(page, "/vendors");
  if (words.length) left.push(`/vendors (credit notes): ${words.slice(0, 12).join(" ")}`);
  check(
    left.length === 0,
    `in ${locale}, no English but the café's own names` +
      (left.length ? `\n      ${left.join("\n      ")}` : ""),
  );
  await ctx.close();
}

// ------------------------------------------------------------ the books
console.log("▸ the books still tie");
{
  const after = differences();
  const moved = Object.keys({ ...differencesBefore, ...after }).filter(
    (k) => Number(after[k] ?? 0) !== Number(differencesBefore[k] ?? 0),
  );
  check(
    moved.length === 0,
    `no subledger moved away from its account${moved.length ? `: ${moved.join(", ")}` : ""}`,
  );
  check(receiptNo(r1) !== "" && receiptNo(r2) !== "", "both deliveries are on record, numbered");
}

await browser.close();
done("purchasing");
