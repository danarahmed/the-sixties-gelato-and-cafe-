// Stock sent between the café's places (0054, release AB), through the real
// screens: a manager sends milk and cones from the branch to the central
// kitchen, and the kitchen receives what arrived, half a litre lost on the
// way; the device then works at the kitchen, whose stock the stock screens
// show and where a loss is recorded; cones sent back are cancelled on their
// way; sending more than the kitchen holds is asked about first. A manager
// who works at the kitchen alone sends from it to the branch, receives what
// comes to it and cancels what it sent (0063). A cashier is sent away. The books tie, 1210 against what is on its way; the journals and
// the audit trail name each transfer. The screens in Arabic and Kurdish.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const branch = last(`select id from location where business_id = '${B}' and name = 'Main Branch'`);
const kitchen = last(
  `select id from location where business_id = '${B}' and name = 'Central Kitchen'`,
);

// The suite's own items, at the branch: milk by the litre, cones by the box.
const milk = last(`select test.act_as('owner@example.com');
  select create_item('Transfer milk', 'ingredient', 'ml', 'volume',
    p_units => '[{"code":"L","label":"Litre","factor":1000}]', p_opening_qty => 20000,
    p_opening_unit_cost => 2, p_opening_reason => 'the opening count') ->> 'item_id'`);
const cones = last(`select test.act_as('owner@example.com');
  select create_item('Transfer cones', 'packaging', 'each', 'count',
    p_units => '[{"code":"box_40","label":"Box of 40","factor":40}]', p_opening_qty => 200,
    p_opening_unit_cost => 100, p_opening_reason => 'the opening count') ->> 'item_id'`);
const at = (item, place) =>
  last(`select trim_scale(p.qty) || ' @ ' || trim_scale(p.value)
          from item_position('${B}', '${item}', '${place}') p`);
const bal = (code) =>
  Number(last(`select gl_balance_at('${B}', '${code}', now() + interval '1 second')`));
const transfers = () => Number(last(`select count(*) from stock_transfer`));
const transit0 = bal("1210");
const lost0 = bal("5300");

console.log("▸ the branch sends milk and cones to the kitchen");
let no;
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/inventory");
  const places = await page.getByTestId("place-choice").locator("option").allTextContents();
  check(
    places.join("|") === "Main Branch|Central Kitchen" &&
      (await page.getByTestId("place-choice").inputValue()) === branch,
    "Inventory offers the café's two places, the branch first and chosen",
  );
  await Promise.all([
    page.waitForURL("**/inventory/transfers"),
    page.getByTestId("to-transfers").click(),
  ]);
  const form = page.getByTestId("send-transfer");
  check(
    (await form.getByTestId("transfer-from").inputValue()) === branch &&
      (await form.getByTestId("transfer-to").inputValue()) === kitchen,
    "from this device's place, to the other",
  );
  const lines = form.getByTestId("transfer-line");
  await lines.nth(0).getByLabel("Item").selectOption({ label: "Transfer milk" });
  await lines.nth(0).getByLabel("Quantity").fill("5");
  await lines.nth(0).getByLabel("Unit").selectOption("L");
  check(
    (await lines.nth(0).textContent()).includes("20,000 ml"),
    "each line shows what the place it leaves holds",
  );
  await form.getByRole("button", { name: "+ Add line" }).click();
  await lines.nth(1).getByLabel("Item").selectOption({ label: "Transfer cones" });
  await lines.nth(1).getByLabel("Quantity").fill("1");
  await lines.nth(1).getByLabel("Unit").selectOption("box_40");
  await form.getByTestId("transfer-note").fill("For tomorrow's gelato");
  await form.getByTestId("transfer-send").click();
  await form.getByText(/is on its way to Central Kitchen/).waitFor({ timeout: 10000 });
  no = Number(last(`select max(transfer_no) from stock_transfer`));
  check(
    last(`select status || ' ' || trim_scale(value_sent) || ' ' || note from stock_transfer
           where transfer_no = ${no}`) === "sent 14000 For tomorrow's gelato",
    "sent: 5 L of milk at 2 a ml and a box of cones at 100 each, 14,000, with its note",
  );
  check(
    at(milk, branch) === "15000 @ 30000" && at(milk, kitchen) === "0 @ 0",
    "the milk has left the branch, and is not yet at the kitchen",
  );
  check(bal("1210") - transit0 === 14000, "1210 holds what is on its way");

  console.log("▸ the kitchen receives it: half a litre leaked on the way");
  const card = page.locator(`[data-testid="transfer"][data-no="${no}"]`);
  await card.waitFor();
  check(
    (await card.textContent()).includes("5 Litre") &&
      (await card.textContent()).includes("1 Box of 40"),
    "on its way, each line as it was sent",
  );
  await card.getByTestId("transfer-receive-some").click();
  const milkIn = card.getByLabel("What arrived of Transfer milk");
  const conesIn = card.getByLabel("What arrived of Transfer cones");
  check(
    (await milkIn.inputValue()) === "5" && (await conesIn.inputValue()) === "1",
    "what arrived starts as what was sent",
  );
  await milkIn.fill("4.5");
  await card.getByLabel("Note (optional)").fill("A bottle leaked");
  await card.getByTestId("transfer-receive-what").click();
  await page.getByText(/received: .* arrived, .* lost on the way/).waitFor({ timeout: 10000 });
  check(
    at(milk, kitchen) === "4500 @ 9000" && at(cones, kitchen) === "40 @ 4000",
    "the kitchen has 4.5 L of milk and the box of cones, at what they left at",
  );
  check(
    bal("1210") === transit0 && bal("5300") - lost0 === 1000,
    "nothing is on its way; the half litre lost, 1,000, is in 5300",
  );
  const settled = page.locator(
    `[data-testid="transfers-settled"] [data-testid="transfer"][data-no="${no}"]`,
  );
  await settled.waitFor();
  check(
    (await settled.getAttribute("data-status")) === "received" &&
      (await settled.textContent()).includes("4.5 Litre") &&
      (await settled.textContent()).includes("lost on the way") &&
      (await settled.textContent()).includes("A bottle leaked"),
    "received, with what arrived, what was lost, and why",
  );

  console.log("▸ the device works at the kitchen");
  await open(page, "/inventory");
  await page.getByTestId("place-choice").selectOption(kitchen);
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="stock-board"]')?.textContent?.includes("Golden"),
    null,
    { timeout: 10000 },
  );
  const board = await page.getByTestId("stock-board").textContent();
  check(
    board.includes("Transfer milk") && board.includes("4,500") && !board.includes("Golden beans"),
    "the stock board shows the kitchen's stock, and not the branch's",
  );
  const loss = page.getByTestId("record-loss");
  await loss.getByLabel("What kind of loss").selectOption("damaged");
  await loss.getByLabel("Item").selectOption({ label: "Transfer milk" });
  await loss.getByLabel("Quantity lost").fill("500");
  await loss.getByLabel("Why (required)").fill("Spilt at the kitchen");
  await loss.getByRole("button", { name: "Record the loss" }).click();
  await loss.getByText(/written off/).waitFor({ timeout: 10000 });
  check(
    last(`select location_id from inventory_movement where reason = 'Spilt at the kitchen'`) ===
      kitchen && at(milk, kitchen) === "4000 @ 8000",
    "a loss recorded there comes off the kitchen's milk",
  );

  console.log("▸ cones sent back, and cancelled on their way");
  await open(page, "/inventory/transfers");
  const back = page.getByTestId("send-transfer");
  check(
    (await back.getByTestId("transfer-from").inputValue()) === kitchen &&
      (await back.getByTestId("transfer-to").inputValue()) === branch,
    "from the kitchen now, to the branch",
  );
  const line = back.getByTestId("transfer-line").nth(0);
  await line.getByLabel("Item").selectOption({ label: "Transfer cones" });
  await line.getByLabel("Quantity").fill("1");
  await line.getByLabel("Unit").selectOption("box_40");
  await back.getByTestId("transfer-send").click();
  await back.getByText(/is on its way to Main Branch/).waitFor({ timeout: 10000 });
  const again = Number(last(`select max(transfer_no) from stock_transfer`));
  check(at(cones, kitchen) === "0 @ 0", "the cones have left the kitchen");
  const onWay = page.locator(`[data-testid="transfer"][data-no="${again}"]`);
  await onWay.getByTestId("transfer-cancel").click();
  await onWay.getByTestId("transfer-cancel-reason").fill("Sent by mistake");
  await onWay.getByTestId("transfer-cancel-confirm").click();
  await page.getByText(/cancelled: back at Central Kitchen/).waitFor({ timeout: 10000 });
  check(
    at(cones, kitchen) === "40 @ 4000" &&
      last(
        `select status || ' ' || cancel_reason from stock_transfer where transfer_no = ${again}`,
      ) === "cancelled Sent by mistake" &&
      bal("1210") === transit0,
    "cancelled: the cones are back at the kitchen, as they were, and nothing is on its way",
  );

  console.log("▸ more than the kitchen holds is asked about first");
  const before = transfers();
  const more = page.getByTestId("send-transfer");
  const l2 = more.getByTestId("transfer-line").nth(0);
  await l2.getByLabel("Item").selectOption({ label: "Transfer milk" });
  await l2.getByLabel("Quantity").fill("10");
  await l2.getByLabel("Unit").selectOption("L");
  await more.getByTestId("transfer-send").click();
  const ask = more.getByTestId("transfer-check");
  await ask.waitFor({ timeout: 10000 });
  check(
    (await ask.textContent()).includes(
      "This leaves Transfer milk (-6000 ml) below zero: confirm to send it all the same",
    ),
    "the manager is asked, in words, before the milk goes below zero",
  );
  await ask.getByRole("button", { name: "Let me correct it" }).click();
  check(transfers() === before, "and nothing is sent until they say so");
  await ctx.close();
}

console.log(
  "▸ a manager who works at the kitchen alone sends from it to the café's other places (0063)",
);
{
  sql(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000f7', 'kitchenboss@example.com')
         on conflict do nothing;
       insert into app_user (business_id, full_name, email, auth_user_id)
       values ('${B}', 'Kitchen Boss', 'kitchenboss@example.com', 'a0000000-0000-0000-0000-0000000000f7');
       insert into user_role (app_user_id, role, location_id)
       select id, 'branch_manager', '${kitchen}' from app_user where email = 'kitchenboss@example.com';`);
  // A litre of milk on its way from the branch to the kitchen.
  const coming = last(`select test.act_as('owner@example.com');
    select send_stock_transfer('${branch}', '${kitchen}',
      '[{"item_id": "${milk}", "qty": 1, "unit_code": "L"}]', 'For tomorrow''s gelato',
      p_idempotency_key => gen_random_uuid()) ->> 'transfer_no'`);
  const { ctx, page } = await signIn(browser, "kitchenboss");
  await open(page, "/inventory/transfers");
  const form = page.getByTestId("send-transfer");
  const from = await form.getByTestId("transfer-from").locator("option").allTextContents();
  const to = await form.getByTestId("transfer-to").locator("option").allTextContents();
  check(
    from.join("|") === "Central Kitchen" && to.join("|") === "Main Branch",
    "their place is the only one they send from, and the café's others are where it goes",
  );
  const toThem = page.locator(`[data-testid="transfer"][data-no="${coming}"]`);
  check(
    (await toThem.getByTestId("transfer-receive").count()) === 1 &&
      (await toThem.getByTestId("transfer-cancel").count()) === 0,
    "what comes to the kitchen is theirs to receive, not to cancel",
  );
  await toThem.getByTestId("transfer-receive").click();
  await page
    .getByText(new RegExp(`Transfer ${coming} received: all of it`))
    .waitFor({ timeout: 10000 });
  check(at(milk, kitchen) === "5000 @ 10000", "received, the litre is at the kitchen");
  const line = form.getByTestId("transfer-line").nth(0);
  await line.getByLabel("Item").selectOption({ label: "Transfer cones" });
  await line.getByLabel("Quantity").fill("1");
  await line.getByLabel("Unit").selectOption("box_40");
  await form.getByTestId("transfer-send").click();
  await form.getByText(/is on its way to Main Branch/).waitFor({ timeout: 10000 });
  const sent = Number(last(`select max(transfer_no) from stock_transfer`));
  const fromThem = page.locator(`[data-testid="transfer"][data-no="${sent}"]`);
  // The list is drawn again after the message: wait for the transfer in it.
  await fromThem.waitFor({ timeout: 10000 });
  check(
    (await fromThem.getByTestId("transfer-cancel").count()) === 1 &&
      (await fromThem.getByTestId("transfer-receive").count()) === 0,
    "what they sent is theirs to cancel, and the branch's to receive",
  );
  await fromThem.getByTestId("transfer-cancel").click();
  await fromThem.getByTestId("transfer-cancel-reason").fill("Sent by mistake");
  await fromThem.getByTestId("transfer-cancel-confirm").click();
  await page.getByText(/cancelled: back at Central Kitchen/).waitFor({ timeout: 10000 });
  check(at(cones, kitchen) === "40 @ 4000", "cancelled, the cones are back at the kitchen");
  await ctx.close();
}

console.log("▸ a cashier is sent away");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/inventory/transfers");
  check(
    !new URL(page.url()).pathname.startsWith("/inventory/transfers") &&
      (await page.locator('nav a[href="/inventory/transfers"]').count()) === 0,
    "the transfers are not the cashier's: sent elsewhere, and not in the menu",
  );
  await ctx.close();
}

console.log("▸ the books, the journals and the audit trail");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  const transit = page.getByTestId("rec-transit");
  check(
    (await transit.textContent()).includes(
      "Stock on its way between places vs Stock in transit (1210)",
    ) && (await transit.getAttribute("data-ok")) === "true",
    "the books tie: what is on its way against 1210",
  );
  await open(page, "/journals");
  const register = await page.locator("main").textContent();
  check(
    register.includes("Transfer sent") &&
      register.includes("Transfer received") &&
      register.includes("Transfer cancelled"),
    "the journals say where each came from",
  );
  await open(page, "/audit?group=stock");
  const trail = await page.getByTestId("audit-trail").textContent();
  check(
    (await page.locator('tr[data-action="stock.transfer_send"]').count()) >= 2 &&
      (await page.locator('tr[data-action="stock.transfer_receive"]').count()) >= 1 &&
      (await page.locator('tr[data-action="stock.transfer_cancel"]').count()) >= 1 &&
      trail.includes(`Transfer ${no}`) &&
      trail.includes("Sent by mistake"),
    "the trail names each transfer by its number, sent, received and cancelled, with why",
  );
  await ctx.close();
}

console.log("▸ in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const words = [];
  for (const path of ["/inventory/transfers", "/inventory", "/audit?group=stock"]) {
    await open(page, path);
    words.push(...(await english(page, path)));
  }
  check(
    words.length === 0 && (await page.evaluate(() => document.documentElement.dir)) === "rtl",
    `in ${locale}, right to left, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("transfers");
