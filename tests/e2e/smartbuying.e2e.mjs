// Smarter buying (0092, SMART_PLAN part 3) through the real screens: a manager
// says on Vendors how often a new dairy delivers; it has three orders behind
// it, two days each but once four, so Purchasing says it usually delivers in
// two days, once later; What to buy orders the cream to last until it comes,
// late as it has been, and up to the next delivery after it, saying why; the
// owner drafts the orders in one press and approves and sends the dairy's in
// one tap; the screens speak Arabic and Kurdish.
import { BASE, TODAY, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";

// The suite's own dairy and cream: 200 ml used a day for four weeks, 300 left.
const DAIRY = last(`select test.act_as('manager@example.com');
                    select create_supplier('E2E Fresh Dairy', 'Hemin', '0750 555 0109')`);
sql(`select test.act_as('owner@example.com');
     select create_item('E2E Smart cream', 'ingredient', 'ml', 'volume', null, null, null,
                        '[{"code": "carton_1l", "label": "Carton of 1 L", "factor": 1000}]')`);
const CREAM = last(`select id from item where business_id = '${B}' and name = 'E2E Smart cream'`);
const LOC = last(`select default_location('${B}')`);
sql(`insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost,
                                     value, reason, occurred_at)
     select '${B}'::uuid, '${CREAM}'::uuid, '${LOC}'::uuid, 'opening_balance'::movement_type, 5900, 6, 35400, 'E2E',
            ((${TODAY} - 30)::timestamp + time '09:00') at time zone 'Asia/Baghdad'
     union all
     select '${B}', '${CREAM}', '${LOC}', 'sale_consumption', -200, 6, 1200, 'E2E',
            ((${TODAY} - d)::timestamp + time '12:00') at time zone 'Asia/Baghdad'
       from generate_series(1, 28) d`);
sql(`select test.act_as('manager@example.com');
     select set_item_supplier('${CREAM}', '${DAIRY}', 'carton_1l', 6000, true, gen_random_uuid())`);
// Three orders sent to it, 30, 20 and 10 days ago, that came in two, two and four days.
for (const [sent, took] of [
  [30, 2],
  [20, 2],
  [10, 4],
]) {
  sql(`with o as (
         insert into purchase_order (business_id, supplier_id, location_id, status, po_no, total, approved_at,
                                     sent_at, closed_at, close_reason, expected_on)
         values ('${B}', '${DAIRY}', '${LOC}', 'closed', next_document_no('${B}', 'purchase_order', 1), 6000,
                 ((${TODAY} - ${sent})::timestamp + time '10:00') at time zone 'Asia/Baghdad',
                 ((${TODAY} - ${sent})::timestamp + time '10:00') at time zone 'Asia/Baghdad',
                 ((${TODAY} - ${sent - took})::timestamp + time '15:00') at time zone 'Asia/Baghdad', 'E2E',
                 ${TODAY} - ${sent - 2})
         returning id)
       insert into goods_receipt (business_id, purchase_order_id, location_id, received_at, supplier_id)
       select '${B}'::uuid, id, '${LOC}'::uuid, ((${TODAY} - ${sent - took})::timestamp + time '11:00') at time zone 'Asia/Baghdad',
              '${DAIRY}'::uuid from o`);
}

console.log("▸ on Vendors: the dairy delivers every three days");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/vendors");
  await page.locator("button.vrow", { hasText: "E2E Fresh Dairy" }).click();
  await page.getByRole("button", { name: "Edit vendor" }).click();
  const ev = page.getByTestId("edit-vendor");
  await ev.getByLabel("Delivers every (days)").fill("3");
  await ev
    .locator("label", { hasText: /^Why/ })
    .locator("input")
    .fill("they come every three days");
  await ev.getByRole("button", { name: "Save changes" }).click();
  await ev.getByText("Saved, and on the audit trail.").waitFor({ timeout: 10000 });
  check(
    last(`select delivers_every_days from supplier where id = '${DAIRY}'`) === "3",
    "kept on the supplier: it delivers every 3 days",
  );
  await ctx.close();
}

console.log("▸ Purchasing: how each supplier delivers, as its orders have shown");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/purchasing");
  const records = page.getByTestId("supplier-records");
  await records.locator("summary").click();
  const dairy = records.locator('[data-testid="supplier-record"][data-supplier="E2E Fresh Dairy"]');
  const said = (await dairy.textContent()) ?? "";
  check(
    said.includes("usually 2 days, later 1 time in 3 orders") &&
      said.includes("delivers every 3 days"),
    `the dairy: ${said}`,
  );
  await ctx.close();
}

console.log("▸ What to buy: the cream, to last until the dairy comes, late as it has been");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/purchasing/buying-list");
  await page.getByTestId("buying-page").waitFor({ timeout: 15000 });
  const row = page.locator('[data-testid="buying-line"][data-item="E2E Smart cream"]');
  const why = (await row.getByTestId("buying-why").textContent()) ?? "";
  check(
    why.includes("Its supplier usually delivers in 2 days, as its orders have shown.") &&
      why.includes("It has come up to 2 days late lately") &&
      why.includes(
        "It delivers every 3 days: ordered up to what lasts until the delivery after this one",
      ),
    "why: the dairy's usual two days, two days late at worst lately, and every three days",
  );
  await ctx.close();
}

console.log("▸ the drafts in one press, and the dairy's approved and sent in one tap");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/purchasing");
  await page.getByRole("button", { name: "Draft the orders now" }).click();
  const made = page.getByTestId("draft-now-made");
  await made.waitFor({ timeout: 20000 });
  check(
    (await made.textContent()).includes("E2E Fresh Dairy"),
    "a draft for the dairy, among those made",
  );
  const po = last(
    `select po_no from purchase_order where supplier_id = '${DAIRY}' and status = 'draft'`,
  );
  check(
    last(`select string_agg(i.name || ' ' || trim_scale(l.order_qty) || ' ' || l.order_unit_code, ', ')
            from purchase_order_line l join purchase_order o on o.id = l.purchase_order_id
            join item i on i.id = l.item_id where o.supplier_id = '${DAIRY}' and o.status = 'draft'`) ===
      "E2E Smart cream 2 carton_1l",
    "the cream in it: two cartons, from 300 ml up to what lasts until the delivery after this one",
  );
  await page.reload();
  const send = page
    .locator("tr", { hasText: `${po}` })
    .filter({ hasText: "E2E Fresh Dairy" })
    .getByTestId("po-approve-send");
  await send.click();
  await page
    .getByText(`Order ${po} approved and marked as sent to the supplier.`)
    .waitFor({ timeout: 15000 });
  check(
    last(`select status || ' ' || (approved_at is not null) from purchase_order
           where supplier_id = '${DAIRY}' and po_no = ${po}`) === "sent true",
    `order ${po}: approved and sent in one tap`,
  );
  await ctx.close();
}

console.log("▸ Purchasing in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/purchasing");
  await page.getByTestId("supplier-records").locator("summary").click();
  const words = await english(page, "/purchasing");
  check(
    words.length === 0,
    `in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("smartbuying");
