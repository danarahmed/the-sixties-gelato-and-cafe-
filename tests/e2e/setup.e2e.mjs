// Getting set up (round seven), through the real screens, on a café started
// fresh. The test café is cleared with supabase/remediation/start-fresh.sql,
// the script the live café is cleared with, so this also proves the script
// still clears every table the migrations make and keeps what it keeps. It
// empties the café, so it runs last.
//
// The owner's dashboard then lists the steps, the stock items first; each
// button opens the form its step is added in (the list to paste, the kitchen's
// recipe, the menu's product, the till's tables, someone new on the staff), and
// a step ticks itself once the café has one. A step the café does without is
// put aside on the device, and put back; the list goes once every step is done
// or put aside, and can be hidden. A branch manager sees the steps that are the
// owner's as the owner's. In Kurdish, the list is in Kurdish.
import { execFileSync } from "node:child_process";
import { BASE, chromium, check, done, open, signIn, sql, pickItem } from "./lib.mjs";

const DB = process.env.E2E_DB || "sixties_e2e";
const last = (q) => sql(q).split("\n").pop();

console.log("▸ the test café is cleared to start fresh, as the live one is");
{
  const before =
    sql("select count(*) from app_user") + "|" + sql("select count(*) from gl_account");
  execFileSync("psql", [
    "-X",
    "-q",
    "-v",
    "ON_ERROR_STOP=1",
    "-d",
    DB,
    "-c",
    "set sixties.fresh = 'clear everything'",
    "-f",
    "supabase/remediation/start-fresh.sql",
  ]);
  check(
    [
      "sales_order",
      "item",
      "product",
      "recipe",
      "supplier",
      "employee",
      "dining_table",
      "journal_entry",
    ].every((t) => sql(`select count(*) from ${t}`) === "0"),
    "every record, and the menu, stock items, suppliers, staff and tables, cleared",
  );
  check(
    sql("select count(*) from app_user") + "|" + sql("select count(*) from gl_account") ===
      before &&
      sql("select count(*) from audit_log where action = 'business.start_fresh'") ===
        sql("select count(*) from business") &&
      sql("select count(*) from audit_log") === sql("select count(*) from business"),
    "the logins and the chart of accounts kept; the audit trail starts with one line a business saying so",
  );
}

const browser = await chromium.launch();
const steps = (page) => page.getByTestId("setup-step");
const stateOf = async (page) =>
  (
    await steps(page).evaluateAll((els) => els.map((e) => `${e.dataset.step}:${e.dataset.state}`))
  ).join(" ");
const step = (page, key) => page.locator(`[data-testid="setup-step"][data-step="${key}"]`);
const progress = async (page) =>
  ((await page.getByTestId("setup-progress").textContent()) ?? "").trim();

console.log("▸ the owner of a café with nothing is shown what to add, in order");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  check(await page.getByTestId("setup").isVisible(), "Getting set up, on the dashboard");
  check(
    (await stateOf(page)) ===
      "items:next suppliers:todo recipes:todo products:todo tables:todo staff:todo sale:todo",
    `every step to do, the stock items next (${await stateOf(page)})`,
  );
  check((await progress(page)).startsWith("0 of 7 done"), "0 of 7 done");
  const hrefs = await page
    .getByTestId("setup-go")
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  check(
    hrefs.join(" ") ===
      "/inventory#paste-items /vendors /production#new-recipe /products#add-product /pos#tables /staff#add-person /pos",
    "each step's button opens the form it is added in",
  );

  console.log("▸ the stock items, pasted in");
  await step(page, "items").getByTestId("setup-go").click();
  await page.waitForURL(/\/inventory#paste-items$/);
  await page.getByTestId("paste-box").waitFor();
  check(await page.getByTestId("paste-items").isVisible(), "the list to paste, open");
  await page.getByTestId("paste-box").fill("Milk\tL\t10\t24\t1250\nSugar\tkg\t5\t50\t1000");
  await page.getByTestId("paste-add").click();
  await page.getByText("2 items added.").waitFor({ timeout: 20000 });
  await open(page, "/dashboard");
  check(
    (await step(page, "items").getAttribute("data-state")) === "done" &&
      ((await step(page, "items").textContent()) ?? "").includes("2 added") &&
      (await step(page, "suppliers").getAttribute("data-state")) === "next" &&
      (await progress(page)).startsWith("1 of 7 done"),
    "the stock items ticked, 2 added; the suppliers next",
  );

  console.log("▸ a step the café does without is put aside, and put back");
  await step(page, "suppliers").getByTestId("setup-skip").click();
  check(
    (await step(page, "suppliers").getAttribute("data-state")) === "skipped" &&
      (await step(page, "recipes").getAttribute("data-state")) === "next" &&
      (await progress(page)).startsWith("1 of 6 done"),
    "suppliers put aside: the recipes next, 1 of 6 done",
  );
  await open(page, "/dashboard");
  check(
    (await step(page, "suppliers").getAttribute("data-state")) === "skipped",
    "and still aside when the dashboard opens again",
  );
  await step(page, "suppliers").getByTestId("setup-unskip").click();
  check(
    (await step(page, "suppliers").getAttribute("data-state")) === "next" &&
      (await progress(page)).startsWith("1 of 7 done"),
    "put back: next again",
  );
  await step(page, "suppliers").getByTestId("setup-skip").click();

  console.log("▸ hidden on a device, it stays hidden there");
  {
    const other = await signIn(browser, "owner");
    await open(other.page, "/dashboard");
    check(
      (await step(other.page, "suppliers").getAttribute("data-state")) === "next",
      "another device keeps its own choices: the suppliers not put aside there",
    );
    await other.page.getByTestId("setup-hide").click();
    check((await other.page.getByTestId("setup").count()) === 0, "Hide this list: gone");
    await open(other.page, "/dashboard");
    check(
      (await other.page.getByTestId("setup").count()) === 0,
      "and gone when that device opens the dashboard again",
    );
    await other.ctx.close();
  }

  console.log("▸ a branch manager sees the owner's steps as the owner's");
  {
    const m = await signIn(browser, "manager");
    await open(m.page, "/dashboard");
    check(
      ((await step(m.page, "products").textContent()) ?? "").includes(
        "The owner or the general manager adds these.",
      ) && (await step(m.page, "products").getByTestId("setup-go").count()) === 0,
      "the menu: the owner's or the general manager's to add, with no button",
    );
    check(
      (await step(m.page, "items").getAttribute("data-state")) === "done" &&
        (await step(m.page, "suppliers").getByTestId("setup-go").count()) === 1,
      "the steps a branch manager may do keep their buttons",
    );
    await m.ctx.close();
  }

  console.log("▸ in Kurdish");
  {
    const k = await signIn(browser, "owner");
    await k.ctx.addCookies([{ name: "locale", value: "ckb", url: BASE }]);
    await open(k.page, "/dashboard");
    check(
      ((await k.page.getByTestId("setup").textContent()) ?? "").includes(
        "ئامادەکردن بۆ دەستپێکردن",
      ) && ((await step(k.page, "items").textContent()) ?? "").includes("کاڵاکانی کۆگا"),
      "Getting set up and its steps in Kurdish",
    );
    await k.ctx.close();
  }

  console.log("▸ each button opens its form");
  await step(page, "recipes").getByTestId("setup-go").click();
  await page.waitForURL(/\/production#new-recipe$/);
  await page.waitForLoadState("networkidle");
  check(
    await page.locator("#new-recipe").evaluate((d) => d.open === true),
    "Add recipes: Production's form to add what you make, open",
  );
  await open(page, "/dashboard");
  await step(page, "products").getByTestId("setup-go").click();
  await page.waitForURL(/\/products#add-product$/);
  const productName = page.getByLabel("Product name (English)");
  await productName.waitFor({ timeout: 10000 });
  check(await productName.isVisible(), "Add products: the menu product's form, open");
  await productName.fill("Milkshake");
  await pickItem(page, "Ingredient 1", "Milk");
  await page.getByLabel("Quantity 1").fill("250");
  await page.getByLabel("Dine-in price").fill("3000");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.getByText("Created “Milkshake”.").waitFor({ timeout: 15000 });
  check(
    sql("select count(*) from product where name = 'Milkshake'") === "1",
    "a product added from it",
  );

  await open(page, "/dashboard");
  check(
    (await step(page, "products").getAttribute("data-state")) === "done" &&
      (await step(page, "recipes").getAttribute("data-state")) === "next",
    "the menu ticked; the recipes still next, until made or put aside",
  );
  await step(page, "tables").getByTestId("setup-go").click();
  await page.waitForURL(/\/pos/);
  const editor = page.getByRole("dialog", { name: "Edit tables" });
  await editor.waitFor({ timeout: 10000 });
  check(await editor.isVisible(), "Add tables: the till's tables, open to set out");
  check(
    (await page.evaluate(() => window.location.hash)) === "",
    "and the address forgets it, so the till opens as usual next time",
  );

  await open(page, "/dashboard");
  await step(page, "staff").getByTestId("setup-go").click();
  await page.waitForURL(/\/staff#add-person$/);
  await page.getByTestId("person-form").waitFor({ timeout: 10000 });
  check(await page.getByTestId("person-form").isVisible(), "Add staff: someone new, open");

  console.log("▸ the list goes once every step is done or put aside");
  await open(page, "/dashboard");
  for (const key of ["recipes", "tables", "staff"])
    await step(page, key).getByTestId("setup-skip").click();
  check(
    (await step(page, "sale").getAttribute("data-state")) === "next" &&
      (await progress(page)).startsWith("2 of 3 done"),
    "the first sale is all that is left",
  );
  const variant = sql(
    "select v.id from product_variant v join product p on p.id = v.product_id where p.name = 'Milkshake'",
  );
  last(`select test.act_as('cashier@example.com');
        select record_sale(gen_random_uuid(), 'dine_in', 'card', '[{"variant_id": "${variant}", "qty": 1}]'::jsonb)`);
  await open(page, "/dashboard");
  check(
    (await page.getByTestId("setup").count()) === 0,
    "the first sale rung up: the list is gone",
  );
  await ctx.close();
}

await browser.close();
done("setup");
