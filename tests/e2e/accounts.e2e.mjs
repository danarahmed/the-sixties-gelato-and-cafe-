// Wholesale customers on account (round nineteen, 0077), through the real
// screens: the manager puts a hotel on account with a limit and 20% off,
// makes an invoice for ten espressos, sees it on the customers' list, and
// receives part of it into the bank; the oldest invoice is paid first.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
sql(`insert into customer (business_id, full_name, phone)
     select '00000000-0000-0000-0000-0000000000b1', 'Hotel Ankawa', '+9647501112233'
      where not exists (select 1 from customer where phone = '+9647501112233')`);
const hotel = sql(`select id from customer where phone = '+9647501112233'`);

const { ctx, page } = await signIn(browser, "manager");
await open(page, `/customers/${hotel}`);
const card = page.getByTestId("customer-account");
await card.waitFor({ timeout: 10000 });

console.log("▸ put on account: a limit, 30 days, 20% off");
await card.getByRole("button", { name: "Credit settings" }).click();
await card.getByTestId("account-on").check();
await card.getByTestId("account-limit").fill("50000");
await card.getByTestId("account-percent").fill("20");
await card.getByTestId("account-save").click();
await card.getByTestId("account-done").waitFor({ timeout: 10000 });
check(
  sql(`select on_account || ' ' || trim_scale(credit_limit) || ' ' || trim_scale(wholesale_percent)
         from customer where id = '${hotel}'`) === "true 50000 20",
  "the hotel buys on account: 50,000 at most, 20% off",
);

console.log("▸ an invoice for ten espressos, at their price");
await page.reload();
await card.getByTestId("account-new-invoice").click();
const form = card.getByTestId("account-invoice");
const pick = form.getByTestId("invoice-product");
await pick.selectOption(
  (await pick.locator("option", { hasText: "Golden espresso" }).first().getAttribute("value")) ??
    "",
);
await form.getByTestId("invoice-qty").fill("10");
await form.getByTestId("invoice-make").click();
await card.getByTestId("account-done").waitFor({ timeout: 10000 });
check(
  ((await card.getByTestId("account-done").textContent()) ?? "").includes("20,000 IQD"),
  "ten at 2,000: an invoice of 20,000",
);
check(
  sql(
    `select trim_scale(amount) || ' ' || status from customer_invoice where customer_id = '${hotel}'`,
  ) === "20000 open",
  "recorded, open",
);

console.log("▸ on the customers' list, with what they owe");
await open(page, "/customers");
const list = page.getByTestId("accounts-list");
await list.waitFor({ timeout: 10000 });
check(
  ((await list.getByTestId("account-row").first().textContent()) ?? "").includes("20,000"),
  "the hotel owes 20,000",
);

console.log("▸ a payment into the bank pays the invoice");
await open(page, `/customers/${hotel}`);
await card.getByTestId("account-receive").click();
const pay = card.getByTestId("account-payment");
await pay.getByTestId("payment-amount").fill("15000");
await pay.getByRole("radio", { name: "The bank" }).click();
await pay.getByTestId("payment-receive").click();
await card.getByTestId("account-done").waitFor({ timeout: 10000 });
check(
  ((await card.getByTestId("account-done").textContent()) ?? "").includes("5,000 IQD"),
  "they owe 5,000 now",
);
await page.reload();
check(
  ((await card.getByTestId("account-balance").textContent()) ?? "").includes("5,000"),
  "and the account says so",
);

await ctx.close();
await browser.close();
done("accounts");
