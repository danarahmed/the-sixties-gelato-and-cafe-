// What writing the guide found, put right (0095), through the real screens:
// the owner changes the café's details on Settings; adds a branch, renames
// it, closes it and opens it again on Settings → Places; sets a daily target
// for one branch on Rules; and prints a sale's receipt again from Orders,
// marked COPY.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const VARIANT = "d1000000-0000-0000-0000-000000000001";

console.log("▸ the café's details");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#details");
  const form = page.getByTestId("details-form");
  await form.waitFor({ timeout: 10000 });
  await form.getByTestId("details-name").fill("The Sixty's — Erbil");
  await form.getByTestId("details-save").click();
  await page.getByText("Saved.").first().waitFor({ timeout: 10000 });
  check(
    last(`select name from business where id = '${B}'`) === "The Sixty's — Erbil",
    "the owner renames the café",
  );
  const fixed = last(`select business_has_records('${B}')`) === "t";
  check(
    (await form.getByTestId("details-currency").isDisabled()) === fixed,
    fixed
      ? "the currency is fixed once the café has sold"
      : "the currency may change before anything is sold",
  );
  await ctx.close();
}

console.log("▸ a manager sees them, and changes nothing");
{
  const { ctx, page } = await signIn(browser, "manager");
  const r = await page.goto(`${process.env.E2E_BASE || "http://127.0.0.1:3100"}/settings#details`);
  // A branch manager may not open Settings at all; one who may sees the form shut.
  if (r && new URL(page.url()).pathname === "/settings") {
    const form = page.getByTestId("details-form");
    check(await form.getByTestId("details-name").isDisabled(), "a manager's form is shut");
  } else check(true, "a manager does not open Settings");
  await ctx.close();
}

console.log("▸ a new branch");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#locations");
  const places = page.getByTestId("places-manager");
  await places.waitFor({ timeout: 10000 });
  const add = places.getByTestId("place-add");
  await add.getByTestId("place-kind").selectOption("branch");
  await add.getByTestId("place-name").fill("Garden Branch");
  await add.getByTestId("place-name-ckb").fill("لقی باخچە");
  await add.getByTestId("place-add-save").click();
  const row = places.locator('[data-testid="place-row"][data-place="Garden Branch"]');
  await row.waitFor({ timeout: 10000 });
  const id = last(`select id from location where name = 'Garden Branch'`);
  check(/^[0-9a-f-]{36}$/.test(id), "added");
  check(
    last(`select count(*) from cash_drawer where location_id = '${id}' and is_active`) === "1",
    "with its till drawer",
  );

  await row.getByTestId("place-rename").click();
  await row.getByTestId("place-name").fill("Ankawa Branch");
  await row.getByTestId("place-rename-save").click();
  const renamed = places.locator('[data-testid="place-row"][data-place="Ankawa Branch"]');
  await renamed.waitFor({ timeout: 10000 });
  check(last(`select name from location where id = '${id}'`) === "Ankawa Branch", "renamed");

  await renamed.getByTestId("place-close").click();
  await renamed.getByTestId("place-close-confirm").click();
  await page.getByRole("alert").first().waitFor({ timeout: 10000 });
  check(
    last(`select is_active from location where id = '${id}'`) === "t",
    "not closed without a reason",
  );
  await renamed.getByTestId("place-close-reason").fill("Opened too early");
  await renamed.getByTestId("place-close-confirm").click();
  await renamed.getByTestId("place-open").waitFor({ timeout: 10000 });
  check(
    last(`select is_active from location where id = '${id}'`) === "f" &&
      last(`select bool_or(is_active) from cash_drawer where location_id = '${id}'`) === "f",
    "closed with its reason, and its drawer with it",
  );
  await renamed.getByTestId("place-open").click();
  await renamed.getByTestId("place-close").waitFor({ timeout: 10000 });
  check(last(`select is_active from location where id = '${id}'`) === "t", "and open again");

  console.log("▸ a daily target for that branch");
  await open(page, "/settings/rules");
  const rule = page.locator('[data-testid="rule"][data-rule="daily_sales_target"]');
  await rule.getByTestId("rule-add").click();
  const target = rule.getByTestId("rule-target");
  check(
    (await target.locator("option", { hasText: "Ankawa Branch" }).count()) === 1,
    "the branch is offered on Rules",
  );
  await ctx.close();
}

console.log("▸ a receipt printed again, marked COPY");
{
  sql(`select test.act_as('cashier@example.com');
       select record_sale(gen_random_uuid(), 'dine_in', 'card',
         '[{"variant_id": "${VARIANT}", "qty": 2}]'::jsonb)`);
  const sale = last(
    `select left(id::text, 8) from sales_order where business_id = '${B}' and status = 'completed' order by placed_at desc limit 1`,
  );
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, `/orders?q=${sale}`);
  await page.evaluate(() => {
    window.__slip = null;
    window.print = () => {
      window.__slip = document.querySelector(".print-slip")?.textContent ?? "";
    };
  });
  await page.getByTestId("reprint-receipt").first().click();
  await page.waitForFunction(() => window.__slip !== null, null, { timeout: 10000 });
  const slip = await page.evaluate(() => window.__slip);
  check(/COPY/.test(slip), "the receipt says COPY");
  check(slip.includes(sale), "with the sale's number");
  await ctx.close();
}

await browser.close();
done("findings");
