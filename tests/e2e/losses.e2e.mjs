// Losses by kind, giveaways at the till and the loss report (0048, release V),
// through the real screens: a manager records a loss of a product as made,
// charged to 5310 as preparation waste, and one of a batch named; a cashier
// gives two cream shots away as a staff meal, printed for the bar with its
// number and no price; over the limit, a manager's PIN at the till lets one go
// on the house; the owner reads what was lost, and where it was charged, on
// Reports, in English, Arabic and Kurdish. The books still tie.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const CREAM = "c0000000-0000-0000-0000-0000000000d1";
const last = (q) => sql(q).split("\n").pop();

// Cream at 2 a millilitre, a shot of it sold on the till (50 ml, 100 IQD of
// cream), and a sorbet made from it in batches of a kilo: two batches.
sql(`insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock)
     values ('${CREAM}', '${B}', 'LOSS-CREAM', 'Loss cream', 'ingredient', 'ml', 'volume', false);
     select test.act_as('owner@example.com');
     select record_opening_stock('${CREAM}', 10000, 'ml', 2, 'Opening stock');
     select create_product('Loss cream shot', '{"dine_in": 1500, "takeaway": 1500}',
                           '[{"item_id": "${CREAM}", "qty": 50, "unit_code": "ml"}]');
     select save_batch_recipe(null, 'Loss sorbet', '{"measure": "weight"}', 1, 'kg',
                              '[{"item_id": "${CREAM}", "qty": 1000, "unit_code": "ml"}]', null, true, 72);
     select set_my_pin('13579');
     select test.act_as('manager@example.com'); select set_my_pin('24680');`);
const RECIPE = last(`select id from recipe where name = 'Loss sorbet'`);
sql(`select test.act_as('manager@example.com');
     select record_production('${RECIPE}', 1);
     select record_production('${RECIPE}', 1, p_use_by => now() + interval '24 hours');`);
const SORBET = last(`select output_item_id from recipe where id = '${RECIPE}'`);
const FIRST = last(
  `select batch_no from production_batch where recipe_id = '${RECIPE}' order by batch_no limit 1`,
);

/** How far each subledger is from its control account: losses must leave them as they were. */
const differences = () =>
  sql(`select test.act_as('owner@example.com');
       select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
         from report_reconciliation(${"test.today()"})`)
    .split("\n")
    .pop();
const before = differences();
const salesBefore = last(`select count(*) from sales_order`);

console.log("▸ a manager records a product lost in preparation, charged to 5310");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/inventory");
  const form = page.getByTestId("record-loss");
  check(
    (await form.getByTestId("loss-kind-explain").textContent()).includes(
      "Charged to 5300 Waste & spoilage.",
    ),
    "the kind comes first, saying what it means and where it is charged",
  );
  await form.getByLabel("What kind of loss").selectOption("preparation_waste");
  check(
    (await form.getByTestId("loss-kind-explain").textContent()).includes(
      "Charged to 5310 Production and preparation loss.",
    ),
    "preparation waste is charged to 5310",
  );
  await form.getByRole("button", { name: "A product, as made" }).click();
  // Anchored: the kinds of loss include "Production waste".
  await form.getByLabel(/^Product/).selectOption({ label: "Loss cream shot" });
  await form.getByLabel("How many").fill("2");
  await form.getByLabel("Why (required)").fill("Whipped the wrong ones");
  await form.getByRole("button", { name: "Record the loss" }).click();
  await form
    .getByText(
      /Recorded, approved by Demo Manager — 200 IQD written off|Recorded — 200 IQD written off/,
    )
    .waitFor({ timeout: 10000 });
  check(true, "two shots lost: their cream, 200 IQD, written off");
  await ctx.close();
}
check(
  last(`select s.kind || ' ' || trim_scale(s.value) || ' ' || count(l.id) || ' ' || bool_and(l.product_variant_id is not null)
          from stock_loss s join stock_loss_line l on l.stock_loss_id = s.id
         where s.reason = 'Whipped the wrong ones' group by s.id`) ===
    "preparation_waste 200 1 true",
  "kept as one loss of the product, as it was given",
);
check(
  last(`select string_agg(a.code || case when l.debit > 0 then ' Dr ' || trim_scale(l.debit) else ' Cr ' || trim_scale(l.credit) end,
                          ' | ' order by a.code)
          from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
         where e.reference_type = 'stock_loss'
           and e.reference_id = (select id from stock_loss where reason = 'Whipped the wrong ones')`) ===
    "1200 Cr 200 | 5310 Dr 200",
  "one journal: Dr 5310 Production and preparation loss, Cr 1200 Inventory",
);

console.log("▸ a loss from the batch named");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/inventory");
  const form = page.getByTestId("record-loss");
  await form.getByLabel("What kind of loss").selectOption("damaged");
  await form.getByLabel("Item").selectOption({ label: "Loss sorbet" });
  const from = form.getByLabel("From batch");
  const options = await from.locator("option").allTextContents();
  check(
    options[0] === "As sales take it: the batch to be used first" &&
      options.some((o) => o.startsWith(`Batch ${FIRST} — 1,000 g`)),
    "an item kept by batch offers its batches, the rules' choice first",
  );
  await from.selectOption({ index: options.findIndex((o) => o.startsWith(`Batch ${FIRST} —`)) });
  await form.getByLabel("Quantity lost").fill("200");
  await form.getByLabel("Why (required)").fill("A tub dropped");
  await form.getByRole("button", { name: "Record the loss" }).click();
  await form.getByText(/written off/).waitFor({ timeout: 10000 });
  check(true, "recorded");
  await ctx.close();
}
check(
  last(`select string_agg(b.batch_no || '=' || trim_scale(lm.base_qty), ',')
          from lot_movement lm join item_lot l on l.id = lm.lot_id join production_batch b on b.id = l.production_batch_id
          join inventory_movement m on m.id = lm.movement_id
         where m.reason = 'A tub dropped'`) === `${FIRST}=-200`,
  "the 200 g came off the batch named, though sales take the other first",
);

console.log("▸ a cashier gives two shots away as a staff meal, printed for the bar");
async function till() {
  const s = await signIn(browser, "cashier");
  await s.ctx.addInitScript(() => {
    window.__printed = 0;
    window.__slips = [];
    window.print = () => {
      window.__printed += 1;
      window.__slips.push(
        [...document.querySelectorAll(".print-slip > .slip")].map((slip) => ({
          ticket: slip.classList.contains("slip-ticket"),
          text: slip.textContent,
        })),
      );
    };
  });
  await open(s.page, "/pos");
  const quick = s.page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible()) await quick.click();
  await s.page.getByRole("button", { name: "Dine-in", exact: true }).click();
  return s;
}
let turn;
{
  const { ctx, page } = await till();
  const tile = page.locator(".product-tile", { hasText: "Loss cream shot" });
  await tile.click();
  await tile.click();
  await page.getByRole("button", { name: "Give away…" }).click();
  const dialog = page.getByTestId("giveaway-dialog");
  check(
    (await dialog.textContent()).includes("2 × Loss cream shot") &&
      (await dialog.getByRole("button", { name: "Give it away" }).isDisabled()),
    "the dialog says what is given, and waits for what it is and why",
  );
  await dialog.getByRole("radio", { name: /Staff meal/ }).click();
  await dialog.getByLabel("Why (required)").fill("Staff lunch");
  await dialog.getByRole("button", { name: "Give it away" }).click();
  await page.getByText(/Given away: Staff meal, number \d+\./).waitFor({ timeout: 10000 });
  turn = (await page.getByText(/Given away: Staff meal, number \d+\./).textContent()).match(
    /number (\d+)/,
  )[1];
  check(true, `given away: the bar makes it as number ${turn}`);
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 10000 });
  const [slip] = await page.evaluate(() => window.__slips[0]);
  check(
    slip.ticket &&
      slip.text.includes("Given away: Staff meal") &&
      slip.text.includes("Loss cream shot") &&
      slip.text.includes(turn) &&
      !/1,?500/.test(slip.text),
    "the barista's ticket: given away, what to make, its number, and no price",
  );
  check(
    (await page.getByRole("button", { name: "Give away…" }).count()) === 0,
    "and the cart is cleared for the next customer",
  );
  await ctx.close();
}
check(
  last(`select s.kind || ' ' || s.channel || ' ' || s.turn_no || ' ' || trim_scale(s.value) || ' ' || s.status
          from stock_loss s where s.reason = 'Staff lunch'`) ===
    `staff_consumption dine_in ${turn} 200 not_required`,
  "a staff meal at the till, eaten in, with its number: 200 IQD of cream",
);
check(
  last(`select string_agg(a.code || case when l.debit > 0 then ' Dr ' || trim_scale(l.debit) else ' Cr ' || trim_scale(l.credit) end,
                          ' | ' order by a.code)
          from journal_entry e join journal_line l on l.journal_entry_id = e.id join gl_account a on a.id = l.account_id
         where e.reference_type = 'stock_loss' and e.reference_id = (select id from stock_loss where reason = 'Staff lunch')`) ===
    "1200 Cr 200 | 6110 Dr 200",
  "charged to 6110 Staff meals",
);
check(
  last(`select count(*) from sales_order`) === salesBefore,
  "and no sale: no revenue, no payment",
);

console.log("▸ over the limit, a manager's PIN at the till lets one go on the house");
sql(`select test.act_as('owner@example.com');
     select set_business_rule('waste_approval_over', 'business', null, '1', 'Every giveaway asks');`);
{
  const { ctx, page } = await till();
  await page.locator(".product-tile", { hasText: "Loss cream shot" }).click();
  await page.getByRole("button", { name: "Give away…" }).click();
  const dialog = page.getByTestId("giveaway-dialog");
  await dialog.getByRole("radio", { name: /On the house/ }).click();
  await dialog.getByLabel("Why (required)").fill("A regular's birthday");
  await dialog.getByRole("button", { name: "Give it away" }).click();
  const approval = dialog.getByTestId("giveaway-approval");
  await approval.waitFor({ timeout: 10000 });
  check(
    (await dialog.textContent()).includes("This loss needs a manager's approval"),
    "over the limit, a manager approves it now: nothing waits at the till",
  );
  await approval.getByLabel("Manager").selectOption({ label: "Demo Manager" });
  await approval.getByLabel("Their PIN").fill("24680");
  await approval.getByRole("button", { name: "Approve" }).click();
  await page.getByText(/Given away: On the house, number \d+\./).waitFor({ timeout: 10000 });
  check(true, "with the manager's PIN, it is given away");
  await ctx.close();
}
sql(`select test.act_as('owner@example.com');
     select set_business_rule('waste_approval_over', 'business', null, null, 'As before');`);
check(
  last(`select s.kind || ' ' || (select full_name from app_user where id = s.approved_by)
          from stock_loss s where s.reason = 'A regular''s birthday'`) ===
    "complimentary Demo Manager",
  "on the house, approved by the manager",
);

console.log("▸ the owner reads what was lost, and where it was charged");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const report = page.getByTestId("loss-report");
  const byKind = await report.getByTestId("loss-by-kind").textContent();
  check(
    byKind.includes("Preparation waste") &&
      byKind.includes("5310") &&
      byKind.includes("6110") &&
      byKind.includes("6610"),
    "by kind, each with its account: preparation waste to 5310, the staff meal to 6110, on the house to 6610",
  );
  const giveaways = await report.getByTestId("loss-giveaways").textContent();
  check(
    giveaways.includes("Staff meal: 1, 200 IQD") && giveaways.includes("On the house: 1, 100 IQD"),
    "the giveaways at the till, by kind",
  );
  check(
    (await report.getByTestId("loss-list").textContent()).includes(`at the till, number ${turn}`),
    "each loss listed, a giveaway with its number",
  );
  await ctx.close();
}

console.log("▸ the screens in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of ["/inventory", "/reports"]) {
    await open(page, path);
    const words = await english(page, path);
    if (words.length) left.push(`${path}: ${words.slice(0, 12).join(" ")}`);
  }
  check(
    left.length === 0,
    `in ${locale}, no English but the café's own names` +
      (left.length ? `\n      ${left.join("\n      ")}` : ""),
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "cashier");
  await ctx.addCookies([{ name: "locale", value: "ckb", url: BASE }]);
  await open(page, "/pos");
  const quick = page.locator(".strip-chip", { hasText: "فرۆشتنی خێرا" });
  if (await quick.isVisible()) await quick.click();
  await page.getByRole("button", { name: "لە شوێن", exact: true }).click();
  await page.locator(".product-tile", { hasText: "Loss cream shot" }).click();
  await page.getByRole("button", { name: "بەخشین…" }).click();
  const dialog = page.getByTestId("giveaway-dialog");
  const text = await dialog.textContent();
  check(
    text.includes("خواردنی کارمەند") && text.includes("میوانداری") && text.includes("نموونە"),
    "the till's giveaway in Kurdish: a staff meal, on the house, a sample",
  );
  await ctx.close();
}

console.log("▸ a manager's correction says what it does, and a large one is asked again");
{
  sql(`select test.act_as('owner@example.com');
       select create_item('E2E Trays', 'packaging', 'each', 'count', null, null, null, '[]', 10, 100,
                          false, 'E2E opening')`);
  const TRAYS = last(`select id from item where business_id = '${B}' and name = 'E2E Trays'`);
  const moves = () =>
    Number(last(`select count(*) from inventory_movement where item_id = '${TRAYS}'`));
  const before = moves();
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/inventory");
  const form = page.getByTestId("correct-stock");
  await form.getByLabel("Item").selectOption({ label: "E2E Trays" });
  await form.getByLabel(/^Change/).fill("100");
  await form.getByLabel("Why (required)").fill("E2E recount");
  const effect = (await form.getByTestId("correct-effect").textContent()) ?? "";
  check(
    effect.includes("10 each → 110 each") && effect.includes("worth 10,000 IQD"),
    `before it is posted, what it does: ${effect}`,
  );
  await form.getByRole("button", { name: "Post correction" }).click();
  await form.getByTestId("correct-confirm").waitFor({ timeout: 10000 });
  check(moves() === before, "ten times what is there: asked again, nothing posted yet");
  await form.getByRole("button", { name: "Change it" }).click();
  check(
    !(await form.getByTestId("correct-confirm").isVisible()),
    "Change it takes the question away",
  );
  await form.getByLabel(/^Change/).fill("-2");
  await form.getByRole("button", { name: "Post correction" }).click();
  for (let i = 0; i < 40 && moves() === before; i++) await page.waitForTimeout(250);
  check(moves() === before + 1, "two fewer, a small change, is posted at once");
  await form.getByLabel(/^Change/).fill("50");
  await form.getByLabel("Why (required)").fill("E2E found a box");
  await form.getByRole("button", { name: "Post correction" }).click();
  await form.getByTestId("correct-confirm").waitFor({ timeout: 10000 });
  await form.getByRole("button", { name: "Yes, post it" }).click();
  for (let i = 0; i < 40 && moves() === before + 1; i++) await page.waitForTimeout(250);
  check(
    moves() === before + 2 &&
      last(
        `select trim_scale(sum(base_quantity_signed)) from inventory_movement where item_id = '${TRAYS}'`,
      ) === "58",
    "a large one is posted once it is confirmed: 10 − 2 + 50 = 58 trays",
  );
  await ctx.close();
}

console.log("▸ the books still tie");
check(differences() === before, `every subledger is where it was (${differences()})`);

await browser.close();
done("losses");
