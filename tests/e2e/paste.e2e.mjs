// Paste stock items in (round seven), through the real screens. The owner
// pastes a list copied from a spreadsheet into Inventory's Add stock item: each
// row is checked and shown as it will be added — the header passed over; a
// unit not known, a name in use, a name twice, a number that is not one, each
// held back with what to put right; a look-alike held back until said to be
// another item — then the rows ready are added in one press, each as the
// one-item form adds it: kept in its base unit, bought in kg or L too, its
// opening stock journaled at its cost. The rows not added stay in the box, and
// one put right is added next. A manager's list adds its items without what is
// on the shelf, which is the owner's. In Arabic, the checks are in Arabic.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
// Names of this run's own, so a run against servers kept up finds no earlier one.
const tag = `p${Date.now().toString(36).slice(-5)}`;
const rows = (page) => page.getByTestId("paste-row");
const box = (page) => page.getByTestId("paste-box");
const ready = async (page) =>
  (await rows(page).evaluateAll((els) => els.map((e) => e.dataset.ready))).join(",");
const lineText = async (page, i) => (await rows(page).nth(i).textContent()) ?? "";

console.log("▸ the owner pastes a list, and sees each row checked before anything is added");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/inventory#paste-items");
  check(
    (await page.getByTestId("paste-items").isVisible()) &&
      (await page.getByTestId("add-paste").getAttribute("aria-selected")) === "true",
    "a link to #paste-items opens Add stock item on its list to paste",
  );
  const list = [
    "Name\tUnit\tReorder at\tOn the shelf\tCost each\tArabic name\tKurdish name",
    `Pistachio paste ${tag}\tkg\t2\t1.5\t38,000\tمعجون فستق ${tag}\tمەعجوونی فستق ${tag}`,
    `Whole milk ${tag}\tL\t10\t24\t1,250`,
    `Paper straws ${tag}\tpcs\t500\t2000\t25`,
    `Vanilla syrup ${tag}\tml\t\t\t`,
    "Golden beans\tg",
    `Napkins ${tag}\tbox`,
    `Cocoa ${tag}\tkg\tten`,
    `Whole milk ${tag}\tL`,
    `Vanila syrup ${tag}\tml`,
  ].join("\n");
  await box(page).fill(list);
  check((await rows(page).count()) === 9, "nine rows read: the header passed over");
  check(
    (await ready(page)) === "yes,yes,yes,yes,no,no,no,no,no",
    `the four whole rows ready, the rest held back (${await ready(page)})`,
  );
  check(
    (await lineText(page, 4)).includes("There is already an item called “Golden beans”.") &&
      (await lineText(page, 5)).includes("“box” is not a unit here: use g, kg, ml, L or each") &&
      (await lineText(page, 6)).includes("“ten” is not a number") &&
      (await lineText(page, 7)).includes(`“Whole milk ${tag}” is in the list twice (line 3).`) &&
      (await lineText(page, 8)).includes(`Its name looks like “Vanilla syrup ${tag}”.`),
    "each row held back says what to put right",
  );
  check(
    (await lineText(page, 0)).includes("1.5") &&
      (await lineText(page, 0)).includes("38,000 IQD") &&
      (await lineText(page, 0)).includes(`معجون فستق ${tag}`),
    "a row as it will be added: its numbers in the unit it gives, its Arabic and Kurdish names",
  );
  check(
    (await page.getByTestId("paste-reason").inputValue()) === "The opening count",
    "where the stock on the shelf came from: the opening count, unless the owner says otherwise",
  );
  check(
    (await page.getByTestId("paste-add").textContent())?.trim() === "Add 4 items" &&
      (await page.getByTestId("paste-to-fix").textContent())?.trim() ===
        "5 rows to put right first",
    "Add 4 items, and 5 rows to put right first",
  );
  // The look-alike is another item: the owner says so.
  await rows(page).nth(8).getByTestId("paste-other").check();
  check(
    (await page.getByTestId("paste-add").textContent())?.trim() === "Add 5 items",
    "a look-alike said to be another item is added too",
  );

  console.log("▸ one press adds every row ready, as the one-item form would");
  await page.getByTestId("paste-add").click();
  await page.getByText("5 items added.").waitFor({ timeout: 30000 });
  check(
    (await page.locator('[role="alert"]').allTextContents())
      .join(" ")
      .includes("4 rows not added: each stays in the box, with what to put right."),
    "5 items added; the 4 rows not added are said",
  );
  const left = await box(page).inputValue();
  check(
    left.split("\n").length === 5 &&
      left.includes("Golden beans") &&
      left.includes(`Napkins ${tag}`) &&
      !left.includes(`Pistachio paste ${tag}`) &&
      !left.includes(`Vanila syrup ${tag}`),
    "what was added left the box; the header and the rows to put right stayed",
  );
  const item = (name) =>
    sql(
      `select base_unit_code || '|' || dimension || '|' || coalesce(min_level_base::text, '-') || '|' ||
              coalesce(name_ar, '-') || '|' || coalesce(name_ckb, '-')
         from item where name = '${name}' and is_active`,
    );
  check(
    item(`Pistachio paste ${tag}`) === `g|mass|2000|معجون فستق ${tag}|مەعجوونی فستق ${tag}`,
    `kg: kept in g, reordered at 2,000 g, with its Arabic and Kurdish names (${item(`Pistachio paste ${tag}`)})`,
  );
  check(
    item(`Whole milk ${tag}`) === "ml|volume|10000|-|-",
    "L: kept in ml, reordered at 10,000 ml",
  );
  check(
    item(`Paper straws ${tag}`) === "each|count|500|-|-",
    "pcs: counted each, reordered at 500",
  );
  check(
    sql(
      `select count(*) from item where name in ('Vanilla syrup ${tag}', 'Vanila syrup ${tag}')`,
    ) === "2",
    "the look-alike said to be another item is added beside it",
  );
  const units = (name) =>
    sql(
      `select coalesce(string_agg(u.code || '=' || u.factor_to_base::int, ',' order by u.code), '-')
         from item i left join item_unit u on u.item_id = i.id where i.name = '${name}'`,
    );
  check(
    units(`Pistachio paste ${tag}`) === "kg=1000" &&
      units(`Whole milk ${tag}`) === "l=1000" &&
      units(`Paper straws ${tag}`) === "-",
    "bought in kg and L as well; straws in nothing but each",
  );
  const opening = (name) =>
    sql(
      `select m.base_quantity_signed::numeric(12,2) || '@' || m.unit_cost::numeric(12,4) || '=' || m.value::numeric(12,0)
         from inventory_movement m join item i on i.id = m.item_id
        where i.name = '${name}' and m.type = 'opening_balance'`,
    );
  check(
    opening(`Pistachio paste ${tag}`) === "1500.00@38.0000=57000" &&
      opening(`Whole milk ${tag}`) === "24000.00@1.2500=30000" &&
      opening(`Paper straws ${tag}`) === "2000.00@25.0000=50000",
    "each opening stock in its base unit, at its cost a base unit, worth what the row said",
  );
  check(
    sql(
      `select string_agg(a.code || ' ' || l.debit::numeric(12,0) || '/' || l.credit::numeric(12,0), ', ' order by a.code)
         from journal_entry j join journal_line l on l.journal_entry_id = j.id join gl_account a on a.id = l.account_id
        where j.description = 'Opening stock: Pistachio paste ${tag}'`,
    ) === "1200 57000/0, 3000 0/57000",
    "and journaled: Dr 1200 Inventory / Cr 3000 Owner equity",
  );
  check(
    sql(`select count(*) from item where name in ('Napkins ${tag}', 'Cocoa ${tag}')`) === "0" &&
      sql(`select count(*) from item where name = 'Whole milk ${tag}'`) === "1" &&
      sql(
        `select count(*) from inventory_movement m join item i on i.id = m.item_id
          where i.name like '% ${tag}' and m.type = 'opening_balance'`,
      ) === "3",
    "nothing held back was added, nothing twice, and no stock where none was given",
  );

  console.log("▸ a row put right in the box is added next");
  await box(page).fill(left.replace(`Napkins ${tag}\tbox`, `Napkins ${tag}\teach\t50`));
  check(
    (await ready(page)) === "no,yes,no,no",
    `the row put right is ready; the rest still wait (${await ready(page)})`,
  );
  await page.getByTestId("paste-add").click();
  await page.getByText("1 item added.").waitFor({ timeout: 15000 });
  check(
    item(`Napkins ${tag}`) === "each|count|50|-|-" &&
      !(await box(page).inputValue()).includes("Napkins"),
    "added, and gone from the box",
  );

  console.log("▸ a café with no items opens on the list; one item at a time is a tab away");
  await page.getByTestId("add-one").click();
  check(
    (await page.getByTestId("new-item-form").isVisible()) &&
      (await page.evaluate(() => window.location.hash)) === "#add-item",
    "One item: the one-item form, as before",
  );
  await ctx.close();
}

console.log("▸ a manager's list: the items, without what is on the shelf");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/inventory#paste-items");
  await box(page).fill(`Oat milk ${tag}\tL\t5\t12\t1500`);
  check(
    (await page.getByTestId("paste-not-owner").isVisible()) &&
      (await page.getByTestId("paste-reason").count()) === 0 &&
      (await lineText(page, 0)).includes("—"),
    "what is on the shelf is the owner's to record: said, and left out of the row",
  );
  await page.getByTestId("paste-add").click();
  await page.getByText("1 item added.").waitFor({ timeout: 15000 });
  check(
    sql(`select min_level_base::int from item where name = 'Oat milk ${tag}'`) === "5000" &&
      sql(
        `select count(*) from inventory_movement m join item i on i.id = m.item_id where i.name = 'Oat milk ${tag}'`,
      ) === "0",
    "added with its reorder level, and no stock: the owner gives it its opening stock",
  );
  await ctx.close();
}

console.log("▸ in Arabic, the checks are in Arabic");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, "/inventory#paste-items");
  await box(page).fill(`Rose water ${tag}\tbottle\nحليب ${tag}\tلتر\t3`);
  check(
    (await lineText(page, 0)).includes("«bottle» ليست وحدة هنا") &&
      (await rows(page).nth(1).getAttribute("data-ready")) === "yes",
    "a unit not known said in Arabic; لتر read as L",
  );
  check(
    ((await page.getByTestId("paste-add").textContent()) ?? "").includes("أضف مادة واحدة"),
    "and the button counts in Arabic",
  );
  await ctx.close();
}

console.log("▸ a cashier adds no items");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await page.goto(`${BASE}/inventory#paste-items`);
  await page.waitForLoadState("networkidle");
  check((await page.getByTestId("paste-items").count()) === 0, "no list to paste");
  await ctx.close();
}

await browser.close();
done("paste");
