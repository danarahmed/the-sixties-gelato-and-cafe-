// Correcting a delivery (0038, release M) on Purchasing, and the books checked
// account by account on Reports: fewer bottles than were entered, corrected
// with what it does shown first and its history kept under it; a delivery
// that should never have been entered, reversed; one billed, no longer
// corrected here; a journal whose record does not exist, found on Reports.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const n = (q) => Number(last(q));
const B = "00000000-0000-0000-0000-0000000000b1";
const WATER = "c0000000-0000-0000-0000-000000000003";
const CUP = "c0000000-0000-0000-0000-000000000002";
const supplier = () =>
  last(
    `select id from supplier where business_id = '${B}' and is_active order by name, id limit 1`,
  );
/** A delivery received as the tests' own shortcut: its id and its number. */
const receive = (item, qty, price) => {
  const id = last(`select test.act_as('manager@example.com');
    select receive_goods('${supplier()}', '[{"item_id":"${item}","qty":${qty},"unit_price":${price}}]',
                         p_confirm => true) ->> 'receipt_id'`);
  return { id, no: last(`select receipt_no from goods_receipt where id = '${id}'`) };
};
const onHand = (item) =>
  n(`select trim_scale((item_position('${B}', '${item}', default_location('${B}'))).qty)`);
const row = (page, no) => page.locator(`[data-testid="receipt-row"][data-receipt="${no}"]`);
/** Each check's difference from its account (earlier suites leave some, on purpose). */
const differences = () =>
  JSON.parse(
    last(`select test.act_as('owner@example.com');
          select json_object_agg(check_key, difference) from report_reconciliation(current_date)`),
  );
const differencesBefore = differences();
/** A delivery's latest correction's number: corrections are numbered across the business. */
const correctionNo = (receipt) =>
  last(`select max(correction_no) from receipt_correction where goods_receipt_id = '${receipt}'`);

// ------------------------------------------------------------ fewer than entered
console.log("▸ a manager corrects a delivery of 10 bottles to the 8 that came");
const water = receive(WATER, 10, 300);
const waterBefore = onHand(WATER);
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  await row(page, water.no).getByRole("button", { name: "Correct", exact: true }).click();
  const dialog = page.getByTestId("receipt-correction");
  await dialog.getByLabel("Quantity of Golden water").fill("8");
  await dialog.getByRole("button", { name: "Show what it would do" }).click();
  const plan = dialog.getByTestId("correction-plan");
  await plan.waitFor({ timeout: 10000 });
  check(
    (await plan.textContent()).includes("10 → 8"),
    "what it would do is shown first: 10 on the delivery become 8",
  );
  check(
    /Stock −600 IQD · owed for it −600 IQD · price variance 0 IQD/.test(
      await dialog.getByTestId("correction-totals").textContent(),
    ),
    "the two bottles go out at the 300 they came in at, and 600 less is owed for them",
  );
  check(
    n(`select count(*) from receipt_correction where goods_receipt_id = '${water.id}'`) === 0,
    "and nothing is done yet",
  );
  const confirm = dialog.getByRole("button", { name: "Confirm the correction" });
  check(await confirm.isDisabled(), "not without saying why");
  await dialog.getByLabel("Why it is corrected").fill("Two bottles short on the invoice");
  await confirm.click();
  const answer = dialog.getByTestId("correction-answer");
  await answer.waitFor({ timeout: 15000 });
  const said = await answer.textContent();
  check(
    new RegExp(
      `Correction ${correctionNo(water.id)} of delivery ${water.no}: the quantity\\.`,
    ).test(said),
    "the answer names the correction and what it changed",
  );
  check(
    /Stock −600 IQD, owed for it −600 IQD, price variance 0 IQD \(journal \d+\)/.test(said),
    "and what it posted",
  );
  check(onHand(WATER) === waterBefore - 2, "two bottles came off the shelf");
  const c = last(`select id from receipt_correction where goods_receipt_id = '${water.id}'`);
  check(
    last(`select test.lines_of('${c}')`) === "1200 Cr 600 | 2050 Dr 600",
    "Cr Inventory, Dr GRNI, 600",
  );
  check(
    n(`select receipt_grni_value('${water.id}')`) === 2400,
    "the delivery is owed for at 8 × 300",
  );
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.waitForLoadState("networkidle");
  check(
    (await row(page, water.no).textContent()).includes("2,400 IQD"),
    "the list shows the delivery as corrected",
  );
  const history = page.getByTestId("receipt-corrections").filter({ hasText: "Two bottles short" });
  check(
    new RegExp(
      `Correction ${correctionNo(water.id)} · .* · Demo Manager · the quantity · “Two bottles short on the invoice”`,
    ).test((await history.textContent()) ?? ""),
    "and under it, who corrected what, when and why",
  );
  await open(page, `/inventory/${WATER}`);
  check(
    (await page.textContent("body")).includes("Delivery corrected"),
    "the stock card names the movement",
  );
  await ctx.close();
}

// ------------------------------------------------------------ never delivered
console.log("▸ a delivery entered by mistake is reversed");
const cups = receive(CUP, 10, 50);
const cupsBefore = onHand(CUP);
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  await row(page, cups.no).getByRole("button", { name: "Reverse", exact: true }).click();
  const dialog = page.getByTestId("receipt-correction");
  await dialog.getByRole("button", { name: "Show what it would do" }).click();
  await dialog.getByTestId("correction-plan").waitFor({ timeout: 10000 });
  check(
    (await dialog.getByTestId("correction-plan").textContent()).includes("10 → 0"),
    "all ten come off the delivery",
  );
  await dialog.getByLabel("Why it is corrected").fill("Entered twice");
  await dialog.getByRole("button", { name: "Reverse the delivery" }).click();
  const answer = dialog.getByTestId("correction-answer");
  await answer.waitFor({ timeout: 15000 });
  check(
    new RegExp(`Delivery ${cups.no} reversed \\(correction ${correctionNo(cups.id)}\\)\\.`).test(
      await answer.textContent(),
    ),
    "the answer says it was reversed",
  );
  check(onHand(CUP) === cupsBefore - 10, "the ten cups went back out");
  check(n(`select receipt_grni_value('${cups.id}')`) === 0, "and nothing is owed for them");
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.waitForLoadState("networkidle");
  const r = row(page, cups.no);
  check(
    (await r.locator(".badge", { hasText: "Reversed" }).count()) === 1,
    "the list marks it reversed",
  );
  check(
    (await r.getByRole("button", { name: "Correct", exact: true }).count()) === 0,
    "and it is corrected no further",
  );
  await ctx.close();
}

// ------------------------------------------------------------ billed
console.log("▸ a billed delivery is corrected only after its bill is cancelled");
{
  sql(`select test.act_as('owner@example.com');
       select record_bill('${supplier()}', 'E2E-CORR-1', current_date, 2400, 0, '${water.id}', null)`);
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/purchasing");
  const r = row(page, water.no);
  check(
    (await r.locator(".badge", { hasText: "Billed" }).count()) === 1,
    "the corrected delivery is billed at 2,400",
  );
  check(
    (await r.getByRole("button", { name: "Correct", exact: true }).count()) === 0,
    "and offers no correction",
  );
  await ctx.close();
}

// ------------------------------------------------------------ the books
console.log(
  "▸ Reports checks every account with a subledger, and finds a journal without its record",
);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  for (const k of [
    "inventory",
    "payables",
    "grni",
    "sales",
    "card",
    "platform",
    "drawer",
    "safe",
    "documents",
  ])
    check((await page.getByTestId(`rec-${k}`).count()) === 1, `the ${k} check is shown`);
  check(
    (await page.getByTestId("rec-documents").textContent()).includes("none"),
    "every record has its journal",
  );
  const now = differences();
  check(
    now.inventory === differencesBefore.inventory && now.grni === differencesBefore.grni,
    "the corrections moved the stock ledger and GRNI with their accounts",
  );
  check(
    (await page.getByTestId("rec-grni").textContent()).startsWith(now.grni === 0 ? "✅" : "⛔"),
    "and Reports shows GRNI as the database has it",
  );
  // A journal that says it is an expense's, for an expense that does not exist.
  sql(`select post_journal('${B}', now(), 'An expense never recorded (e2e)', 'expense', gen_random_uuid(),
         '[{"code":"6900","debit":100},{"code":"1020","credit":100}]')`);
  await open(page, "/reports");
  check(
    (await page.getByTestId("rec-documents").textContent()).includes("1 record(s)"),
    "the records check counts it",
  );
  const list = page.getByTestId("document-problems");
  check(
    (await list.textContent()).includes("A journal whose expense does not exist"),
    "and names it among the records to look into",
  );
  check(
    (await list.getByRole("link", { name: "Journal" }).count()) === 1,
    "with a link to find it",
  );
  sql(`select test.act_as('owner@example.com');
       select reverse_journal((select id from journal_entry where description = 'An expense never recorded (e2e)'),
                              'No such expense')`);
  await open(page, "/reports");
  check(
    (await page.getByTestId("rec-documents").textContent()).includes("none"),
    "reversed, nothing is left to look into",
  );
  await ctx.close();
}

await browser.close();
done("corrections");
