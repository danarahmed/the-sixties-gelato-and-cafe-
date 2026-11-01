// The guide's pictures of a screen in a particular state (a sheet open, a
// message shown, a form filled), named as the entries in docs/guide/src name
// them. Same shape as shot-list.mjs: { name, role, path, then(page), phone, sql }.
//
// Everything here runs on the copy of the simulated year (sixties_guide) only.
// Some pictures change records to reach their state (a sale rung up, a loss
// saved to wait…); they are written so that running them again still works.
import { createHmac } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { BASE, open, sql } from "../../tests/e2e/lib.mjs";

const CLOCK_AT = readFileSync(process.env.GUIDE_CLOCK_FILE || "/tmp/sixties-guide/clock", "utf8").trim();

const B = "00000000-0000-0000-0000-0000000000b1";
const TODAY = "(now() at time zone 'Asia/Baghdad')::date";
const MAIN = `(select id from location where name = 'Main Branch' limit 1)`;
const one = (q) => sql(q).split("\n").pop()?.trim();
const B2 = "00000000-0000-0000-0000-0000000000b2";
/** The ids a query finds, as a list for `in (…)`: never empty. */
const ids = (q) => sql(q).split("\n").map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/.test(x)).map((x) => `'${x}'`).join(",") || "null";
/** A change made for one picture only: `undo()` puts it back, even on the next run if this one stops. */
const RESTORE = "/tmp/sixties-guide/restore-after-picture.sql";
let meanwhileFor = null;
function meanwhile(key, change, back) {
  if (meanwhileFor === key && existsSync(RESTORE)) return; // a shot's sql is read more than once
  undo();
  writeFileSync(RESTORE, back);
  sql(change);
  meanwhileFor = key;
}
function undo() {
  meanwhileFor = null;
  if (!existsSync(RESTORE)) return;
  sql(readFileSync(RESTORE, "utf8"));
  unlinkSync(RESTORE);
}

/**
 * The people the pictures sign in as, besides the four fixture people: the
 * barista, an accountant (kitchenboss@example.com) and a helper whose role is
 * set for the picture (barista2@example.com: purchasing, auditor or general
 * manager). The auth stand-in signs in these addresses.
 */
const person = (email, auth, name, role, place = null) => `
  insert into auth.users (id, email) values ('${auth}', '${email}') on conflict do nothing;
  insert into app_user (business_id, full_name, email, auth_user_id)
    select '${B}', '${name}', '${email}', '${auth}'
     where not exists (select 1 from app_user where email = '${email}');
  update app_user set full_name = '${name}', is_active = true where email = '${email}';
  delete from user_role where app_user_id = (select id from app_user where email = '${email}');
  insert into user_role (app_user_id, role, location_id)
    select id, '${role}', ${place ?? "null"} from app_user where email = '${email}';`;
const BARISTA = person("barista@example.com", "a0000000-0000-0000-0000-00000000000e", "Demo Barista", "barista", MAIN);
const ACCOUNTANT = person("kitchenboss@example.com", "a0000000-0000-0000-0000-0000000000f7", "Demo Accountant", "accountant");
const HELPER = (role) => person("barista2@example.com", "a0000000-0000-0000-0000-0000000000f1", "Hana", role);
const PURCHASING = HELPER("purchasing");
const AUDITOR = HELPER("auditor");
const GM = HELPER("general_manager");
// Everyone made at the start, so they show in lists the same way in every picture.
undo(); // a picture's passing change left behind by a run that stopped half way
sql(BARISTA + ACCOUNTANT + PURCHASING);
// The managers' approval PINs (24680), for the approvals the pictures show.
sql(`update app_user set pin_hash = extensions.crypt('24680', extensions.gen_salt('bf', 8))
      where email in ('manager@example.com', 'owner@example.com') and pin_hash is null`);

/** Wait for some text to show, without failing the picture if it does not. */
const soft = async (locator, timeout = 8000) => {
  try {
    await locator.first().waitFor({ timeout });
    return true;
  } catch {
    return false;
  }
};
/** Scroll an element to the top of the window, under the menu bar. */
const toTop = async (locator, gap = 80) => {
  if (!(await soft(locator, 3000))) return;
  await locator.first().evaluate((el, g) => {
    const y = el.getBoundingClientRect().top + window.scrollY - g;
    window.scrollTo(0, y);
  }, gap);
};

/** A rule set as the owner, unless it is set so already. */
const rule = (key, scope, id, value, reason) => `select test.act_as('owner@example.com');
  select set_business_rule('${key}', '${scope}', ${id}, '${value}'::jsonb, '${reason.replace(/'/g, "''")}')
   where not exists (select 1 from business_rule where key = '${key}' and scope_type = '${scope}'
                        and scope_id = coalesce(${id}, '') and value = '${value}'::jsonb);`;

/** A day from today, as a date box wants it. */
const daysFromNow = (n) => one(`select (${TODAY} + ${n})::text`);

/** A product's panel on Products & Recipes, on a tab if one is named. */
async function openProduct(page, name, tab) {
  await page.locator(`[data-testid="product-card"][data-name="${name}"] > button`).click();
  const panel = page.getByTestId("product-panel");
  await panel.waitFor({ timeout: 10000 });
  if (tab) await panel.getByRole("tab", { name: tab, exact: true }).click();
  return panel;
}

/** A product's tile on the till, by its exact name. */
const tile = (page, name) =>
  page.locator(".product-tile").filter({ has: page.getByText(name, { exact: true }) }).first();

export const STATE_SHOTS = [
  // ───────────────────────── Getting around and setting up ─────────────────
  {
    name: "settings-overview",
    role: "owner",
    path: "/settings",
    sql: `delete from receipt_logo; delete from receipt_setup;
          do $$ begin delete from payment_method; exception when others then update payment_method set is_active = false; end $$;`,
  },
  {
    name: "settings-ways-to-pay",
    role: "owner",
    path: "/settings?at=ways#ways-to-pay",
    then: async (page) => {
      const card = page.getByTestId("settings-pay-methods");
      for (const m of ["fib", "fastpay"]) {
        const b = card.getByTestId(`pay-method-quick-${m}`);
        if (await b.count()) {
          await b.click();
          await soft(card.getByText(/added: the till offers it now/));
          await page.waitForTimeout(500);
        }
      }
      await toTop(card, 130);
    },
  },
  {
    name: "settings-receipt",
    role: "owner",
    path: "/settings?at=receipt#receipt",
    then: async (page) => {
      const card = page.getByTestId("settings-receipt");
      await card.getByTestId("receipt-nameAr").fill("الستينات");
      await card.getByTestId("receipt-nameCkb").fill("شەستەکان");
      await card.getByTestId("receipt-thanksEn").fill("Thank you, see you soon!");
      await card.getByTestId("receipt-thanksAr").fill("شكرًا، نراكم قريبًا");
      await card.getByTestId("receipt-thanksCkb").fill("سوپاس، بەم زووانە دەتانبینینەوە");
      await card.getByTestId("receipt-instagram").fill("@thesixties");
      await card.getByTestId("receipt-wifiName").fill("Sixties Guest");
      await card.getByTestId("receipt-wifiPassword").fill("gelato2026");
      await card.getByTestId("receipt-logo-file").setInputFiles({
        name: "logo.png",
        mimeType: "image/png",
        buffer: LOGO,
      });
      await soft(card.getByTestId("receipt-preview").getByTestId("slip-logo"));
      await toTop(card.getByTestId("receipt-preview"), 90);
    },
  },
  {
    name: "settings-alerts",
    role: "owner",
    path: "/settings?at=alerts#alerts",
    sql: `update business set alert_settings = alert_settings - 'session_open_hours' where id = '${B}'`,
    then: async (page) => {
      const form = page.getByTestId("alert-thresholds");
      await form.getByLabel("Hours a cash session may stay open").fill("12");
      await form.getByRole("button", { name: "Save thresholds" }).click();
      await soft(form.getByText("Saved, and on the audit trail."));
      await page.waitForTimeout(800);
      await toTop(page.locator("#alerts"));
    },
  },
  {
    name: "rules-refunds",
    role: "owner",
    path: "/settings/rules",
    then: async (page) => {
      const rule = page.locator('[data-rule="refund_approval_over"]');
      await rule.getByRole("button", { name: "Change" }).first().click();
      const form = rule.getByTestId("rule-form");
      await form.getByTestId("rule-input").fill("20000");
      await form.getByTestId("rule-reason").fill("Tighter refunds this month");
      await toTop(rule);
    },
  },
  {
    name: "rules-history",
    role: "owner",
    path: "/settings/rules",
    then: async (page) => {
      const rule = page.locator('[data-rule="refund_approval_over"]');
      await rule.getByRole("button", { name: "Change" }).first().click();
      let form = rule.getByTestId("rule-form");
      await form.getByTestId("rule-input").fill("20000");
      await form.getByTestId("rule-reason").fill("Tighter refunds this month");
      await form.getByRole("button", { name: "Save" }).click();
      await page.waitForTimeout(1500);
      await rule.getByRole("button", { name: "Back to default" }).first().click();
      form = rule.getByTestId("rule-form");
      await form.getByTestId("rule-reason").fill("As before");
      await form.getByRole("button", { name: "Set it back to the default" }).click();
      await page.waitForTimeout(1500);
      await toTop(page.getByTestId("rule-change"), 160);
    },
  },
  {
    name: "languages-words",
    role: "owner",
    path: "/settings/languages?lang=ckb#words",
    then: async (page) => {
      const words = page.locator("#words");
      await words.getByLabel("Search").fill("Sales");
      await words.getByLabel("Words for: Sales", { exact: true }).first().fill("فرۆشتنەکان");
      await toTop(words);
    },
  },
  {
    name: "settings-people",
    role: "owner",
    path: "/settings?at=people#people-list",
    sql: `delete from user_role where app_user_id in (select id from app_user where email in ('rawa@example.com', 'hezha@example.com'));
          delete from app_user where email in ('rawa@example.com', 'hezha@example.com') and auth_user_id is null;`,
    then: async (page) => {
      const sec = page.locator("#people-list");
      for (const [name, email] of [["Hezha", "hezha@example.com"], ["Rawa", "rawa@example.com"]]) {
        await sec.locator("label", { hasText: "Name" }).last().locator("input").fill(name);
        await sec.locator('input[type="email"]').fill(email);
        await sec.getByRole("button", { name: "Add person" }).click();
        await soft(sec.getByText(`Added. Ask them to create their login with ${email}.`));
        await page.waitForTimeout(800);
      }
      const row = sec.getByTestId("people-table").locator("tr", { hasText: "hezha@example.com" });
      await row.getByRole("button", { name: "Deactivate" }).click();
      await soft(sec.getByText("Hezha can no longer sign in to the books."));
      await page.waitForTimeout(800);
      await toTop(sec.getByTestId("people-table"), 120);
    },
  },
  {
    name: "start-of-day-steps",
    role: "manager",
    path: "/start-of-day",
    then: async (page) => {
      const drawer = page.getByTestId("sod-open-drawer").getByTestId("drawer-panel");
      await drawer.getByRole("button", { name: "Open the drawer" }).click();
      await page.waitForTimeout(400);
      await toTop(page.getByTestId("sod-progress"), 90);
    },
  },
  {
    name: "frame-menu-more",
    role: "owner",
    path: "/journals",
    then: async (page) => {
      await page.getByTestId("nav-more").evaluate((el) => el.scrollIntoView({ block: "center" }));
    },
  },
  {
    name: "frame-find",
    role: "manager",
    path: "/inventory",
    then: async (page) => {
      await page.keyboard.press("Control+k");
      await page.getByTestId("find-input").fill("milk");
      await soft(page.getByTestId("find-row"));
      await page.waitForTimeout(600);
    },
  },
  {
    name: "frame-offline",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await tile(page, "Latte").click();
      await page.context().setOffline(true);
      await page.waitForTimeout(800);
    },
    after: async (page) => {
      await page.context().setOffline(false);
      await page.waitForTimeout(500);
    },
  },

  // ───────────────────────── Kitchen and stock: Production ─────────────────
  {
    name: "production-record",
    role: "barista",
    path: "/production",
    then: async (page) => {
      const form = page.locator(".pr-record");
      await form.getByLabel("What did you make").selectOption({ label: "Vanilla Gelato Batch" });
      await form.getByLabel("Batches", { exact: true }).fill("2");
      await page.waitForTimeout(500);
      await toTop(form, 90);
    },
  },
  {
    name: "production-record-owner",
    role: "owner",
    path: "/production",
    then: async (page) => {
      const form = page.locator(".pr-record");
      await form.getByLabel("What did you make").selectOption({ label: "Pistachio Gelato Batch" });
      await form.getByLabel("What came out", { exact: true }).fill("4.6");
      await form.getByLabel("Unit of what came out").selectOption("kg");
      await form.getByLabel("Note").fill("a little short");
      await page.waitForTimeout(500);
      await toTop(form, 90);
    },
  },
  {
    name: "production-recorded-labels",
    role: "owner",
    path: "/production",
    sql: `insert into item_unit (item_id, code, label, dimension, factor_to_base, business_id)
          select id, 'pan', 'Pan (5 kg)', 'mass', 5000, business_id from item where name = 'Vanilla gelato'
          on conflict do nothing`,
    then: async (page) => {
      const form = page.locator(".pr-record");
      await form.getByLabel("What did you make").selectOption({ label: "Vanilla Gelato Batch" });
      await form.getByLabel("What came out", { exact: true }).fill("1");
      await form.getByLabel("Unit of what came out").selectOption("pan");
      await form.getByRole("button", { name: "Record batch" }).click();
      await soft(page.getByTestId("batch-labels"), 15000);
      await page.waitForTimeout(500);
      await toTop(form, 90);
    },
  },
  {
    name: "production-plan",
    role: "manager",
    path: "/production?at=plan#plan",
    then: async (page) => {
      await toTop(page.getByTestId("plan"), 80);
    },
  },
  {
    name: "production-plan-all",
    role: "barista",
    path: "/production?at=plan#plan",
    then: async (page) => {
      const all = page.getByTestId("plan-all");
      await all.locator("summary").click();
      const box = all.getByTestId("plan-all-row").last().locator('input[type="checkbox"]');
      if (await box.count()) await box.uncheck();
      await toTop(all, 90);
    },
  },
  {
    name: "production-approval",
    role: "barista",
    path: "/production",
    sql: rule("negative_stock", "item", "(select id::text from item where name = 'Pistachio paste')", '"approve"',
      "Pistachio paste is dear: a manager says first"),
    then: async (page) => {
      const form = page.locator(".pr-record");
      await form.getByLabel("What did you make").selectOption({ label: "Pistachio Gelato Batch" });
      await form.getByLabel("Batches", { exact: true }).fill("60");
      await form.getByRole("button", { name: "Record batch" }).click();
      await soft(page.getByTestId("batch-approval"), 15000);
      await toTop(page.getByTestId("batch-approval"), 300);
    },
  },
  {
    name: "production-lots",
    role: "manager",
    path: "/production?at=lots#lots",
    sql: `update item_lot set use_by = ((${TODAY} + time '22:00') at time zone 'Asia/Baghdad')
           where lot_code = 'B1143' and item_id = (select id from item where name = 'Vanilla gelato');
          update production_batch set use_by = ((${TODAY} + time '22:00') at time zone 'Asia/Baghdad') where batch_no = 1143;`,
    then: async (page) => {
      const row = page.locator('[data-testid="lot-row"][data-lot="B1143"]');
      await row.getByTestId("change-use-by").click();
      await toTop(page.getByTestId("lots-panel"), 80);
    },
  },
  {
    name: "production-markdowns",
    role: "barista",
    path: "/production",
    then: async (page) => {
      await soft(page.getByTestId("markdowns"));
      await toTop(page.getByTestId("markdowns"), 80);
    },
  },
  {
    name: "production-batches-cancel",
    role: "manager",
    path: "/production",
    then: async (page) => {
      const row = page.getByTestId("batch-row").first();
      await row.getByRole("button", { name: /^Cancel/ }).click();
      await row.getByLabel("Why it is cancelled").fill("Recorded twice by mistake");
      await toTop(page.locator("table.pr-batches"), 140);
    },
  },
  {
    name: "production-recipe-tiles",
    role: "owner",
    path: "/production",
    sql: `update recipe set shelf_life_hours = 72 where name = 'Vanilla Gelato Batch'`,
    then: async (page) => {
      await toTop(page.getByTestId("recipe-card"), 160);
    },
  },
  {
    name: "production-recipe-panel",
    role: "owner",
    path: "/production",
    then: async (page) => {
      await page.locator('[data-testid="recipe-card"][data-name="Vanilla Gelato Batch"] > button').click();
      await soft(page.getByTestId("recipe-panel"));
      await page.waitForTimeout(400);
    },
  },
  {
    name: "production-recipe-new",
    role: "owner",
    path: "/production",
    then: async (page) => {
      await page.getByText("Add something you make", { exact: true }).first().click();
      await page.getByLabel("Name of what it makes").fill("Mango gelato");
      await page.getByLabel("How it is counted").selectOption("weight");
      await page.getByLabel("Container", { exact: true }).fill("Pan");
      await page.getByLabel("What a container holds").fill("5");
      await page.getByLabel("Unit a container holds").selectOption("kg");
      await page.getByLabel("One batch makes", { exact: true }).fill("1");
      await page.getByLabel("Unit one batch makes").selectOption("pan");
      await line(page, 1, "Milk", "2", "L");
      await line(page, 2, "Sugar", "800", "g");
      await page.waitForTimeout(600);
    },
  },

  // ───────────────────────── Kitchen and stock: Inventory ──────────────────
  {
    name: "inventory-board",
    role: "owner",
    path: "/inventory",
    sql: `update item set min_level_base = 600 where name = 'Cone';
          update item set min_level_base = 2000 where name = 'Gelato spoon';
          update item set min_level_base = 20000 where name = 'Coffee beans';
          ${rule("negative_stock", "item", "(select id::text from item where name = 'Croissant')", '"allow"',
            "Croissants are sold before the batch is recorded")}
          select test.act_as('owner@example.com');
          select record_loss('waste', (select id from item where name = 'Croissant'), null, 3, 'each', 'Dropped before the batch was recorded')
           where not exists (select 1 from stock_board where item_id = (select id from item where name = 'Croissant') and is_negative);`,
    then: async (page) => {
      await toTop(page.getByTestId("stock-board").or(page.locator(".card.stat")).first(), 90);
    },
  },
  {
    name: "inventory-barista",
    role: "barista",
    path: "/inventory",
  },
  {
    name: "inventory-loss-form",
    role: "barista",
    path: "/inventory",
    then: async (page) => {
      const form = page.getByTestId("record-loss");
      await form.getByLabel("What kind of loss").selectOption("expired");
      await form.getByLabel("Item").selectOption({ label: "Chocolate gelato" });
      const batch = form.getByLabel("From batch");
      await batch.selectOption({ index: 1 });
      await form.getByLabel("Quantity lost").fill("300");
      await form.getByLabel("Why (required)").fill("Past its use-by, found at the back of the freezer");
      await toTop(form, 90);
    },
  },
  {
    name: "inventory-loss-approval",
    role: "barista",
    path: "/inventory",
    sql: rule("waste_approval_over", "role", "'barista'", "10000", "Baristas ask a manager for losses over 10,000"),
    then: async (page) => {
      const form = page.getByTestId("record-loss");
      await form.getByLabel("What kind of loss").selectOption("spoilage");
      await form.getByLabel("Item").selectOption({ label: "Milk" });
      await form.getByLabel("Quantity lost").fill("12");
      await form.getByLabel("Unit").selectOption("L");
      await form.getByLabel("Why (required)").fill("The fridge was left open overnight");
      await form.getByRole("button", { name: "Record the loss" }).click();
      await soft(form.getByTestId("loss-approval"), 15000);
      await toTop(form, 90);
    },
  },
  {
    name: "inventory-losses-waiting",
    role: "manager",
    path: "/inventory?at=losses#losses-waiting",
    get sql() {
      if (one(`select count(*) from stock_loss where reason = 'The fridge was left open overnight'`) !== "0") return "select 1";
      return `select test.act_as('barista@example.com');
          select record_loss('spoilage', (select id from item where name = 'Milk'), null, 12, 'L',
                             'The fridge was left open overnight', p_wait => true);`;
    },
    then: async (page) => {
      await soft(page.getByTestId("loss-waiting"));
      await toTop(page.getByTestId("losses-waiting"), 90);
    },
  },
  {
    name: "inventory-correct-confirm",
    role: "manager",
    path: "/inventory",
    then: async (page) => {
      const form = await openForm(page, "correct", "correct-stock");
      await form.getByLabel("Item").selectOption({ label: "Cone" });
      await form.getByLabel("Change (− to reduce)").fill("-4000");
      await form.getByLabel("Why (required)").fill("Counted the cones in the store room");
      await form.getByRole("button").filter({ hasText: /^(Post|Correct|Save)/ }).first().click();
      await soft(form.getByTestId("correct-confirm"));
      await toTop(form, 90);
    },
  },
  {
    name: "inventory-paste",
    role: "owner",
    path: "/inventory?at=paste#paste-items",
    then: async (page) => {
      const list = [
        "Name\tUnit\tReorder at\tOn the shelf\tCost each",
        "Mango puree\tkg\t2\t3\t9,500",
        "Paper napkins\tbox\t5\t10",
        "Vanila syrup\tml",
      ].join("\n");
      if (!(await page.getByTestId("paste-box").isVisible())) {
        if ((await page.getByTestId("add-paste").count()) === 0) await page.getByTestId("inv-open-add").click();
        await page.getByTestId("add-paste").click();
      }
      await page.getByTestId("paste-box").fill(list);
      await page.waitForTimeout(600);
      await toTop(page.getByTestId("paste-rows"), 260);
    },
  },
  {
    name: "inventory-add-one",
    role: "barista2",
    path: "/inventory",
    sql: PURCHASING,
    then: async (page) => {
      const add = page.getByTestId("inv-open-add");
      if ((await page.getByTestId("add-one").count()) === 0) await add.click();
      await page.getByTestId("add-one").click();
      const form = page.getByTestId("new-item-form");
      await form.getByLabel("Name (English)").fill("Vanila syrup");
      await page.waitForTimeout(800);
      await toTop(form, 90);
    },
  },
  {
    name: "stock-card",
    role: "owner",
    path: (ids) => `/inventory/${ids.item()}`,
    then: async (page) => {
      await toTop(page.getByTestId("stock-card"), 80);
    },
  },
  {
    name: "stock-card-edit",
    role: "barista2",
    path: (ids) => `/inventory/${ids.item()}`,
    sql: PURCHASING,
    then: async (page) => {
      await toTop(page.getByTestId("pack-units"), 80);
    },
  },
  {
    name: "transfers-send",
    role: "manager",
    path: "/inventory/transfers",
    then: async (page) => {
      const form = page.getByTestId("send-transfer");
      const lines = form.getByTestId("transfer-line");
      await lines.nth(0).getByLabel("Item").selectOption({ label: "Milk" });
      await lines.nth(0).getByLabel("Quantity").fill("6");
      await lines.nth(0).getByLabel("Unit").selectOption("L");
      await form.getByRole("button", { name: "+ Add line" }).click();
      await lines.nth(1).getByLabel("Item").selectOption({ label: "Sugar" });
      await lines.nth(1).getByLabel("Quantity").fill("2000");
      await form.getByTestId("transfer-note").fill("For tomorrow's gelato");
      await page.waitForTimeout(500);
      await toTop(form, 90);
    },
  },
  {
    name: "transfers-short",
    role: "manager",
    path: "/inventory/transfers",
    then: async (page) => {
      let card = page.locator('[data-testid="transfers-on-their-way"] [data-testid="transfer"]').first();
      if ((await card.count()) === 0) {
        const form = page.getByTestId("send-transfer");
        const lines = form.getByTestId("transfer-line");
        await lines.nth(0).getByLabel("Item").selectOption({ label: "Milk" });
        await lines.nth(0).getByLabel("Quantity").fill("6");
        await lines.nth(0).getByLabel("Unit").selectOption("L");
        await form.getByRole("button", { name: "+ Add line" }).click();
        await lines.nth(1).getByLabel("Item").selectOption({ label: "Sugar" });
        await lines.nth(1).getByLabel("Quantity").fill("2000");
        await form.getByTestId("transfer-note").fill("For tomorrow's gelato");
        await form.getByTestId("transfer-send").click();
        await soft(form.getByText(/is on its way to/), 15000);
        await page.waitForTimeout(800);
        card = page.locator('[data-testid="transfers-on-their-way"] [data-testid="transfer"]').first();
      }
      await card.getByTestId("transfer-receive-some").click();
      await card.getByLabel("What arrived of Milk").fill("5");
      await card.getByLabel("Note (optional)").fill("A bottle leaked on the way");
      await toTop(card, 90);
    },
  },
  {
    name: "usage-table",
    role: "owner",
    path: "/inventory/usage",
    get sql() {
      return usageCounts();
    },
    then: async (page) => {
      const row = page.getByTestId("usage-row").filter({ hasText: "Coffee beans" }).first();
      if (await row.count()) {
        const more = row.locator("summary, button").filter({ hasText: /made of/ }).first();
        if (await more.count()) await more.click();
        await toTop(row, 160);
      }
    },
  },
  {
    name: "count-sheet",
    role: "counter",
    path: "/count",
    then: async (page) => {
      if (await page.getByRole("button", { name: "Start count" }).count()) {
        await page.getByRole("button", { name: "Start count" }).click();
        await soft(page.getByText("Your count"), 15000);
      }
      const boxes = page.locator('input[aria-label^="Counted "]');
      const n = Math.min(6, await boxes.count());
      const values = ["80", "210", "16000", "7600", "33800", "480"];
      for (let i = 0; i < n; i++) {
        await boxes.nth(i).fill(values[i]);
        await boxes.nth(i).blur();
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(800);
    },
    after: async () => {
      sql(`select test.act_as('counter@example.com');
           select cancel_stock_count(id, 'Started for the guide') from stock_count where status = 'counting';
           reset role; set session_replication_role = replica;
           delete from stock_count where status = 'rejected';`);
    },
  },
  {
    name: "count-review",
    role: "manager",
    path: () => `/count?review=${one(`select id from stock_count where status = 'submitted' limit 1`)}`,
    get sql() {
      return submittedCount();
    },
    then: async (page) => {
      await page.waitForTimeout(500);
    },
  },

  // ───────────────────────── A batch's own page ────────────────────────────
  {
    name: "batch-story",
    role: "owner",
    path: () => `/production/batches/${one(`select id from production_batch where batch_no = 1143`)}`,
    sql: `select test.act_as('owner@example.com');
          select record_loss('expired', (select id from item where name = 'Vanilla gelato'), null, 400, 'g',
                             'Set too soft in the display', p_lot => (select output_lot_id from production_batch where batch_no = 1143))
           where not exists (select 1 from stock_loss where reason = 'Set too soft in the display');`,
  },
  {
    name: "batch-late",
    role: "manager",
    path: "/production",
    then: async (page) => {
      const form = page.locator(".pr-record");
      await form.getByLabel("What did you make").selectOption({ label: "Chocolate Gelato Batch" });
      await form.getByLabel("Made earlier: yesterday or today, recorded now").check();
      await form.getByLabel("When it was made").fill("2026-10-21T21:30");
      await form.getByLabel("Why it is recorded late").fill("Made before closing; the tablet was flat");
      await form.getByRole("button", { name: "Record batch" }).click();
      await soft(page.getByText(/Recorded as batch \d+/), 15000);
      const no = one(`select batch_no from production_batch where late_reason is not null order by created_at desc limit 1`);
      const id = one(`select id from production_batch where batch_no = ${no}`);
      await page.goto(page.url().replace(/\/production.*$/, `/production/batches/${id}`));
      await page.waitForLoadState("networkidle");
      const change = page.getByTestId("change-use-by").first();
      if (await change.count()) await change.click();
      await page.waitForTimeout(400);
    },
  },

  // ───────────────────────── Products & Recipes ────────────────────────────
  {
    name: "products-grid",
    role: "owner",
    path: "/products",
  },
  {
    name: "products-panel-basics",
    role: "owner",
    path: "/products",
    then: async (page) => {
      await openProduct(page, "Latte");
      await page.waitForTimeout(400);
    },
  },
  {
    name: "products-recipe-change",
    role: "owner",
    path: "/products",
    then: async (page) => {
      const card = await openProduct(page, "Latte", "Recipe");
      await card.getByRole("button", { name: "Change the recipe…" }).click();
      await card.getByLabel("Quantity 1").fill("20");
      await card.locator('input[type="date"]').fill(daysFromNow(7));
      await page.waitForTimeout(400);
    },
  },
  {
    name: "products-sizes",
    role: "owner",
    path: "/products",
    then: async (page) => {
      const card = await openProduct(page, "Latte", "Sizes & prices");
      if ((await card.locator('[data-testid="size-row"][data-size="Large"]').count()) === 0) {
        await card.getByTestId("size-add").click();
        const form = card.getByTestId("size-form");
        await form.getByLabel("New size (English)").fill("Large");
        await form.getByLabel("Price · Dine-in").fill("4500");
        await form.getByLabel("Price · Takeaway").fill("4500");
      }
      await page.waitForTimeout(400);
    },
    after: async (page) => {
      const save = page.getByTestId("size-save");
      if (await save.count()) {
        await save.click();
        await soft(page.locator('[data-testid="size-row"][data-size="Large"]'), 15000);
      }
    },
  },
  {
    name: "products-prices",
    role: "owner",
    path: "/products",
    then: async (page) => {
      const card = await openProduct(page, "Americano", "Sizes & prices");
      if ((await card.getByTestId("scheduled-changes").count()) === 0) {
        await card.getByRole("button", { name: "Change a price…" }).first().click();
        await card.locator("label", { hasText: "New price" }).locator("input").fill("3000");
        await card.locator("label", { hasText: /^From/ }).locator("input").fill(daysFromNow(7));
        await card.getByRole("button", { name: "Set price" }).click();
        await soft(card.getByTestId("scheduled-changes"), 15000);
      }
      await card.getByTestId("scheduled-changes").scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
    },
  },
  {
    name: "products-addons",
    role: "owner",
    path: "/products",
    then: async (page) => {
      const card = await openProduct(page, "Latte", "Add-ons");
      if ((await card.locator('[data-testid="addon-group-card"][data-group="Milk"]').count()) === 0) {
        await card.getByTestId("ready-milk").click();
        const group = card.getByTestId("group-form");
        const must = group.getByLabel("Must pick one");
        if (await must.count()) await must.check();
        const prices = group.locator('input[placeholder="+ IQD"]');
        for (let i = 0; i < (await prices.count()); i++)
          if (!(await prices.nth(i).inputValue())) await prices.nth(i).fill("750");
        await group.getByTestId("group-save").click();
        await soft(card.locator('[data-testid="addon-group-card"][data-group="Milk"]'), 15000);
      }
      await page.waitForTimeout(600);
    },
  },
  {
    name: "products-new",
    role: "owner",
    path: "/products",
    then: async (page) => {
      await page.getByRole("button", { name: "Add menu product", exact: true }).click();
      await page.getByLabel("Product name (English)").fill("Pistachio latte");
      await line(page, 1, "Coffee beans", "18", "g");
      await line(page, 2, "Milk", "200", "ml");
      await line(page, 3, "Pistachio paste", "15", "g");
      await page.getByLabel("Dine-in price").fill("5000");
      await page.getByLabel("Takeaway price").fill("5000");
      await page.waitForTimeout(500);
    },
  },
  {
    name: "products-deal",
    role: "owner",
    path: "/products",
    then: async (page) => {
      const deals = page.getByTestId("deals-card");
      await deals.locator("summary").click();
      await deals.getByTestId("deal-new").click();
      const form = deals.getByTestId("deal-form");
      await form.getByTestId("deal-name").fill("Morning coffee and croissant");
      const places = form.getByTestId("deal-place");
      const coffee = await places.nth(0).locator("option", { hasText: "Any Coffee" }).getAttribute("value");
      await places.nth(0).selectOption(coffee);
      const croissant = await places.nth(1).locator("option", { hasText: "Croissant" }).first().getAttribute("value");
      await places.nth(1).selectOption(croissant);
      for (const c of ["dine_in", "takeaway"]) {
        const box = form.getByTestId(`deal-price-${c}`);
        if (await box.count()) await box.fill("5000");
      }
      const from = form.getByTestId("hours-from");
      if (await from.count()) {
        await from.fill("07:00");
        await form.getByTestId("hours-until").fill("11:00");
      }
      await toTop(form, 90);
    },
  },
  {
    name: "products-time-price",
    role: "owner",
    path: "/products",
    then: async (page) => {
      const hours = page.getByTestId("time-prices-card");
      await hours.locator("summary").click();
      if ((await hours.getByTestId("time-price-row").count()) === 0) {
        await hours.getByTestId("time-price-new").click();
        const f = hours.getByTestId("time-price-form");
        const size = f.getByTestId("time-price-size");
        const espresso = await size.locator("option", { hasText: /^Espresso/ }).first().getAttribute("value");
        await size.selectOption(espresso);
        await f.getByTestId("time-price-price").fill("1500");
        await f.getByTestId("hours-from").fill("00:00");
        await f.getByTestId("hours-until").fill("23:59");
        await f.getByTestId("time-price-save").click();
        await soft(hours.getByTestId("time-price-row"), 15000);
      }
      await toTop(hours, 90);
    },
    after: async () => {
      // A price by the hour all day would change every later sale's espresso: ended at once.
      sql(`update time_price set stopped_at = now() where stopped_at is null`);
    },
  },
  {
    name: "labels-sheet",
    role: "owner",
    path: "/products/labels",
    sql: `update product_variant set barcode = '6260000000017' where name = '500 ml' and barcode is null;
          update product_variant set barcode = '6260000000024' where name = 'Plain' and barcode is null;`,
    then: async (page) => {
      const counts = page.getByTestId("label-count");
      if (await counts.count()) await counts.first().fill("3");
      await page.waitForTimeout(500);
    },
  },

  // ───────────────────────── Buying: Purchasing ────────────────────────────
  {
    name: "purchasing-orders",
    role: "manager",
    path: "/purchasing",
    get sql() {
      return buyingSetup();
    },
    then: async (page) => {
      await toTop(page.getByTestId("po-panel"), 80);
    },
  },
  {
    name: "purchasing-order-form",
    role: "barista2",
    path: "/purchasing",
    sql: PURCHASING,
    then: async (page) => {
      const panel = page.getByTestId("po-panel");
      await panel.getByRole("button", { name: "New order" }).click();
      const form = page.getByTestId("po-form");
      await form.getByLabel("Supplier", { exact: true }).selectOption({ label: "Kurdistan Coffee Imports" });
      await form.getByLabel("Expected", { exact: true }).fill(daysFromNow(3));
      await form.getByLabel("Note for the supplier", { exact: true }).fill("Please deliver before 9 in the morning");
      let line = form.getByTestId("po-line").nth(0);
      await line.getByLabel("Item", { exact: true }).selectOption({ label: "Coffee beans" });
      await line.getByLabel("Quantity", { exact: true }).fill("5");
      await line.getByLabel("Unit", { exact: true }).selectOption("kg");
      await line.getByLabel("Price per unit", { exact: true }).fill("37000");
      await form.getByRole("button", { name: "Add a line" }).click();
      line = form.getByTestId("po-line").nth(1);
      await line.getByLabel("Item", { exact: true }).selectOption({ label: "Sugar" });
      await line.getByLabel("Quantity", { exact: true }).fill("10000");
      await line.getByLabel("Price per unit", { exact: true }).fill("1.6");
      await page.waitForTimeout(400);
      await toTop(form, 90);
    },
  },
  {
    name: "purchasing-supplier-records",
    role: "owner",
    path: "/purchasing",
    then: async (page) => {
      const records = page.getByTestId("supplier-records");
      await records.locator("summary").first().click();
      await toTop(records, 90);
    },
  },
  {
    name: "purchasing-receive-order",
    role: "barista2",
    path: "/purchasing",
    sql: PURCHASING,
    then: async (page) => {
      const form = page.getByTestId("receive");
      const po = one(`select id from purchase_order where note = 'Milk and cream for the gelato' limit 1`);
      await form.locator("label", { hasText: /^Supplier/ }).locator("select").first()
        .selectOption({ label: "Sulaymaniyah Dairy Co." });
      await form.getByTestId("receive-order").selectOption(po);
      await page.waitForTimeout(600);
      const lines = form.getByTestId("receive-line");
      await lines.nth(0).locator("label", { hasText: /^Quantity/ }).locator("input").fill("10");
      if ((await lines.count()) > 1)
        await lines.nth(1).locator("label", { hasText: /^Price per/ }).locator("input").fill("7500");
      await page.waitForTimeout(500);
      await toTop(form, 90);
    },
  },
  {
    name: "purchasing-price-check",
    role: "manager",
    path: "/purchasing",
    then: async (page) => {
      const form = page.getByTestId("receive");
      await form.locator("label", { hasText: /^Supplier/ }).locator("select").first()
        .selectOption({ label: "Kurdistan Coffee Imports" });
      const line = form.getByTestId("receive-line").first();
      await line.locator("label", { hasText: /^Item/ }).locator("select").selectOption({ label: "Coffee beans" });
      await line.locator("label", { hasText: /^Quantity/ }).locator("input").fill("2");
      await line.locator("label", { hasText: /^Unit/ }).locator("select").selectOption("kg");
      await line.locator("label", { hasText: /^Price per/ }).locator("input").fill("76000");
      await form.getByRole("button", { name: "Receive goods" }).click();
      await soft(page.getByTestId("price-check"), 15000);
      await toTop(page.getByTestId("price-check"), 300);
    },
  },
  {
    name: "purchasing-new-item",
    role: "barista2",
    path: "/purchasing",
    sql: PURCHASING,
    then: async (page) => {
      const form = page.getByTestId("receive");
      await form.locator("label", { hasText: /^Supplier/ }).locator("select").first()
        .selectOption({ label: "Kurdistan Coffee Imports" });
      const line = form.getByTestId("receive-line").first();
      await line.locator("label", { hasText: /^Item/ }).locator("select").selectOption({ label: "+ New item (not in Inventory yet)…" });
      const ni = form.getByTestId("new-item");
      await soft(ni);
      const name = ni.getByLabel("Name (English)");
      if (await name.count()) await name.fill("Cardamom");
      await page.waitForTimeout(400);
      await toTop(form, 90);
    },
  },
  {
    name: "purchasing-return",
    role: "barista2",
    path: "/purchasing",
    sql: PURCHASING,
    then: async (page) => {
      const box = page.getByTestId("return-goods");
      const opener = box.locator("summary").first();
      if (await opener.count()) await opener.click().catch(() => {});
      await box.getByLabel("Supplier", { exact: true }).selectOption({ label: "Sulaymaniyah Dairy Co." });
      const delivery = box.getByLabel("The delivery they came in", { exact: true });
      await delivery.selectOption({ index: 1 });
      const line = box.getByTestId("return-line").first();
      await line.getByLabel("Item", { exact: true }).selectOption({ label: "Cream" });
      await line.getByLabel("Quantity", { exact: true }).fill("2");
      await line.getByLabel("Unit", { exact: true }).selectOption("L");
      await box.getByLabel("Why they are going back", { exact: true }).fill("Two bottles came past their date");
      await page.waitForTimeout(400);
      await toTop(box, 90);
    },
  },
  {
    name: "purchasing-correction",
    role: "manager",
    path: "/purchasing",
    then: async (page) => {
      const no = one(`select receipt_no from goods_receipt where note = 'Milk and cream for the gelato' order by received_at desc limit 1`);
      const row = page.locator(`[data-testid="receipt-row"][data-receipt="${no}"]`);
      await row.getByRole("button", { name: "Correct", exact: true }).click();
      const dialog = page.getByTestId("receipt-correction");
      const price = dialog.getByLabel(/^Price of Cream|^Unit price of Cream|^Cost of Cream/).first();
      if (await price.count()) await price.fill("6500");
      else await dialog.getByLabel("Quantity of Milk").fill("11");
      await dialog.getByRole("button", { name: "Show what it would do" }).click();
      await soft(dialog.getByTestId("correction-plan"), 10000);
      await page.waitForTimeout(400);
    },
  },
  {
    name: "purchasing-receipts",
    role: "owner",
    path: "/purchasing",
    then: async (page) => {
      await toTop(page.getByTestId("receipt-row").first(), 220);
    },
  },
  {
    name: "buying-list",
    role: "manager",
    path: "/purchasing/buying-list",
  },
  {
    name: "buying-why",
    role: "barista2",
    path: "/purchasing/buying-list",
    sql: PURCHASING,
    then: async (page) => {
      const line = page.getByTestId("buying-line").first();
      const why = line.getByTestId("buying-why");
      const sum = why.locator("summary");
      if (await sum.count()) await sum.click();
      else await why.click();
      await toTop(line, 160);
    },
  },
  {
    name: "buying-made",
    role: "barista2",
    path: "/purchasing/buying-list",
    sql: PURCHASING,
    then: async (page) => {
      await page.getByTestId("buying-create").first().click();
      await soft(page.getByTestId("buying-made"), 15000);
      await toTop(page.getByTestId("buying-made"), 90);
    },
    after: async () => {
      // The orders it drafted, cancelled, so the next pictures find the same list.
      sql(`select test.act_as('owner@example.com');
           select cancel_po(id, 'Drafted for the guide') from purchase_order
            where status = 'draft' and note is distinct from 'Beans for the weekend' and note is distinct from 'Cups and lids for takeaway';
           reset role; set session_replication_role = replica;
           delete from purchase_order_line where purchase_order_id in
             (select id from purchase_order where status = 'cancelled' and cancel_reason = 'Drafted for the guide');
           delete from purchase_order where status = 'cancelled' and cancel_reason = 'Drafted for the guide';`);
    },
  },
  {
    name: "purchasing-draft-now",
    role: "owner",
    path: "/purchasing",
    then: async (page) => {
      await page.getByRole("button", { name: "Draft the orders now" }).click();
      await soft(page.getByTestId("draft-now-made").or(page.getByTestId("draft-now-none")), 15000);
      await toTop(page.getByTestId("draft-now"), 90);
    },
    after: async () => {
      sql(`select test.act_as('owner@example.com');
           select cancel_po(id, 'Drafted for the guide') from purchase_order
            where status = 'draft' and note is distinct from 'Beans for the weekend' and note is distinct from 'Cups and lids for takeaway';
           reset role; set session_replication_role = replica;
           delete from purchase_order_line where purchase_order_id in
             (select id from purchase_order where status = 'cancelled' and cancel_reason = 'Drafted for the guide');
           delete from purchase_order where status = 'cancelled' and cancel_reason = 'Drafted for the guide';`);
    },
  },
  {
    name: "po-page",
    role: "manager",
    path: () => `/purchasing/orders/${one(`select id from purchase_order where note = 'Milk and cream for the gelato' limit 1`)}`,
  },

  // ───────────────────────── Buying: Vendors ───────────────────────────────
  {
    name: "vendors-statement",
    role: "kitchenboss",
    path: "/vendors",
    get sql() {
      return creditsSetup();
    },
    then: async (page) => {
      await vendor(page, "Sulaymaniyah Dairy Co.", "Statement");
      const rows = page.locator(".stmt tbody tr, table tbody tr");
      await rows.last().scrollIntoViewIfNeeded().catch(() => {});
      await page.evaluate(() => window.scrollBy(0, 200));
    },
  },
  {
    name: "vendors-edit",
    role: "manager",
    path: "/vendors",
    then: async (page) => {
      await vendor(page, "Sulaymaniyah Dairy Co.", "Edit vendor");
      const ev = page.getByTestId("edit-vendor");
      await ev.getByLabel("Days a delivery takes").fill("1");
      await ev.getByLabel("Delivers every (days)").fill("2");
      await ev.locator("label", { hasText: /^Why/ }).locator("input").fill("They come every other morning now");
      await toTop(ev, 200);
    },
  },
  {
    name: "vendors-record-bill",
    role: "kitchenboss",
    path: "/vendors",
    then: async (page) => {
      await vendor(page, "Sulaymaniyah Dairy Co.", "Bills & payments");
      const panel = page.locator(".panel", { has: page.getByRole("heading", { name: "Record a bill" }) });
      const no = one(`select receipt_no from goods_receipt where note = 'Milk and cream for the gelato' limit 1`);
      const sel = panel.locator("label", { hasText: "Goods receipt" }).locator("select");
      const opt = await sel.locator("option", { hasText: `Receipt ${no}` }).first().getAttribute("value");
      if (opt) await sel.selectOption(opt);
      await panel.getByLabel("Invoice no.").fill("SD-4471");
      await panel.locator("label", { hasText: "Amount (IQD)" }).locator("input").fill("91800");
      await page.waitForTimeout(400);
      await toTop(panel, 90);
    },
  },
  {
    name: "vendors-pay-bill",
    role: "kitchenboss",
    path: "/vendors",
    then: async (page) => {
      await vendor(page, "Sulaymaniyah Dairy Co.", "Bills & payments");
      const pay = page.locator("label", { hasText: "Pay bill" }).locator("select");
      await pay.selectOption({ index: 1 });
      await page.getByLabel("Paid from").selectOption("safe");
      await page.waitForTimeout(500);
      await toTop(pay, 160);
    },
  },
  {
    name: "vendors-cancel-bill",
    role: "owner",
    path: "/vendors",
    then: async (page) => {
      await vendor(page, "City Packaging Supplies", "Bills & payments");
      const row = page.locator('[data-testid="bill-row"][data-bill="SIM-272"]');
      await row.getByRole("button", { name: /^Cancel/ }).first().click();
      await page.waitForTimeout(400);
      await toTop(row, 200);
    },
  },
  {
    name: "vendors-credits",
    role: "kitchenboss",
    path: "/vendors",
    then: async (page) => {
      await vendor(page, "Sulaymaniyah Dairy Co.", "Credit notes");
      await soft(page.getByTestId("supplier-credits"));
      await toTop(page.getByTestId("supplier-credits"), 90);
    },
  },
  {
    name: "supplier-statement",
    role: "kitchenboss",
    path: (ids) => `/vendors/${one(`select id from supplier where name = 'Sulaymaniyah Dairy Co.'`)}/statement`,
  },

  // ───────────────────────── Buying: Expenses ──────────────────────────────
  {
    name: "expense-entry",
    role: "manager",
    path: "/expenses",
    then: async (page) => {
      await page.getByPlaceholder("September shop rent").fill("October shop rent");
      await page.locator("input.amt").first().fill("500000");
      await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
      await page.waitForTimeout(600);
      const acct = page.getByLabel("Account", { exact: true });
      if (!(await acct.inputValue())) await acct.selectOption("6000");
      await page.waitForTimeout(400);
    },
  },
  {
    name: "expense-prepaid",
    role: "kitchenboss",
    path: "/expenses",
    then: async (page) => {
      await page.getByPlaceholder("September shop rent").fill("Shop rent, a quarter");
      await page.locator("input.amt").first().fill("1500000");
      await page.getByLabel("Paid from", { exact: true }).selectOption("bank");
      await page.getByLabel("Account", { exact: true }).selectOption("6000");
      await page.getByTestId("expense-ahead").check();
      const first = page.getByLabel("First month", { exact: true });
      await first.selectOption({ index: 0 });
      await page.getByLabel("How many months", { exact: true }).fill("3");
      await page.waitForTimeout(500);
    },
  },
  {
    name: "expense-duplicate",
    role: "owner",
    path: "/expenses",
    sql: `select test.act_as('owner@example.com');
          select record_expense('Generator diesel', 85000, '6200', 'safe')
           where not exists (select 1 from expense where description = 'Generator diesel');`,
    then: async (page) => {
      await page.getByPlaceholder("September shop rent").fill("Diesel for the generator");
      await page.locator("input.amt").first().fill("85000");
      await page.getByLabel("Paid from", { exact: true }).selectOption("safe");
      await page.getByLabel("Account", { exact: true }).selectOption("6200");
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Post expense" }).click({ timeout: 5000 }).catch(() => {});
      await soft(page.getByTestId("same-payment"), 15000);
    },
  },
  {
    name: "expense-prepaid-list",
    role: "kitchenboss",
    path: "/expenses?at=prepaid#prepaid",
    get sql() {
      return prepaidSetup();
    },
    then: async (page) => {
      await soft(page.getByTestId("prepaid"));
      await toTop(page.getByTestId("prepaid"), 90);
    },
  },
  {
    name: "expense-register",
    role: "owner",
    path: "/expenses",
    sql: `select test.act_as('owner@example.com');
          select reverse_journal(e.journal_entry_id, 'Posted to the wrong month')
            from expense e
           where e.description = 'Electricity and generator' and e.journal_entry_id is not null
             and not exists (select 1 from journal_entry r where r.reverses_entry = e.journal_entry_id)
           order by e.created_at desc limit 1;`,
    then: async (page) => {
      await toTop(page.getByTestId("expense-register"), 90);
    },
  },

  // ───────────────────────── People and pay: Staff ─────────────────────────
  {
    name: "staff-people",
    role: "owner",
    path: "/staff",
    get sql() {
      return staffSetup();
    },
  },
  {
    name: "staff-add-people",
    role: "manager",
    path: "/staff",
    then: async (page) => {
      await page.getByTestId("add-person").click();
      const form = page.getByTestId("person-form");
      const rows = form.getByTestId("add-person-row");
      while ((await rows.count()) < 3) await form.getByTestId("add-person-another").click();
      const fill = async (i, name, job) => {
        if (name) await rows.nth(i).getByLabel("Name").fill(name);
        await rows.nth(i).getByLabel("What they do").fill(job);
      };
      await fill(0, "Hawre", "Barista");
      await fill(1, "Sozan", "Cashier");
      await fill(2, "", "Cleaner");
      await page.waitForTimeout(500);
    },
  },
  {
    name: "staff-person-panel",
    role: "owner",
    path: "/staff",
    then: async (page) => {
      await page.locator('[data-testid="person-row"][data-name="Avin"]').getByRole("button").first().click();
      await page.getByTestId("person-panel").getByTestId("set-pay").click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "staff-phone-link",
    role: "manager",
    path: "/staff",
    then: async (page) => {
      await page.locator('[data-testid="person-row"][data-name="Bana"]').getByRole("button").first().click();
      await page.getByTestId("person-panel").getByTestId("link-phone").click();
      await soft(page.getByText("Waiting for the phone…"), 10000);
    },
  },
  {
    name: "staff-schedule-week",
    role: "owner",
    path: "/staff?at=schedule#schedule",
    then: async (page) => {
      await soft(page.getByTestId("schedule-check"));
      await toTop(page.getByTestId("schedule"), 80);
    },
  },
  {
    name: "staff-schedule-undo",
    role: "manager",
    path: "/staff?at=schedule#schedule",
    then: async (page) => {
      const cell = page.locator('[data-testid="schedule-row"][data-name="Lana"] [data-testid="schedule-cell"][data-day="2026-10-22"]');
      await cell.fill("12:00-20:00");
      await page.getByTestId("save-schedule").click();
      await soft(page.getByTestId("undo-bar"), 10000);
      await toTop(page.getByTestId("schedule"), 80);
    },
    after: async (page) => {
      const undo = page.getByTestId("undo");
      if (await undo.count()) await undo.first().click();
      await page.waitForTimeout(1500);
    },
  },
  {
    name: "staff-hours",
    role: "manager",
    path: "/staff?week=2026-10-21&at=hours#attendance",
    then: async (page) => {
      await toTop(page.getByTestId("attendance-days").or(page.getByTestId("attendance-records")).first(), 80);
    },
  },
  {
    name: "staff-hours-correct",
    role: "manager",
    path: "/staff?week=2026-10-21&at=hours#attendance",
    then: async (page) => {
      const rec = page.locator('[data-testid="attendance-record"][data-name="Dara"]').first();
      await rec.getByTestId("correct-hours").click();
      await page.getByTestId("correct-form").getByLabel("Why").fill("Forgot to clock out at closing");
      await toTop(rec, 160);
    },
  },
  {
    name: "staff-shop-clock",
    role: "owner",
    path: "/staff",
    then: async (page) =>
      elsewhere(page, "owner", {}, async (p) => {
        await open(p, "/staff?at=clock#shop-clock");
        if ((await p.getByTestId("clock-screen-this").count()) === 0) {
          await p.getByTestId("clock-screen-make").click();
          await p.getByTestId("clock-screen-name").fill("The till");
          await p.getByTestId("clock-screen-save").click();
          await soft(p.getByTestId("clock-screen-this"), 10000);
        }
        CLOCK_SCREEN_COOKIES = await p.context().cookies();
        await toTop(p.getByTestId("shop-clock"), 80);
      }),
  },
  {
    name: "clock-screen",
    role: "owner",
    path: "/staff",
    then: async (page) =>
      elsewhere(page, "owner", {}, async (p) => {
        if (CLOCK_SCREEN_COOKIES) await p.context().addCookies(CLOCK_SCREEN_COOKIES.filter((c) => !/auth|sb-/.test(c.name)));
        await open(p, "/clock/screen");
        const out = p.getByTestId("clock-screen-sign-out");
        if (await out.count()) {
          await out.click();
          await soft(p.getByTestId("shop-code-digits"), 10000);
        }
        await p.waitForTimeout(500);
      }),
  },

  {
    name: "clock-link",
    role: "barista",
    phone: true,
    path: "/account",
    then: async (page) =>
      elsewhere(page, null, PHONE, async (p) => {
        await p.goto(`${BASE}/clock/link?k=${phoneLinkKey("Shno")}`);
        await p.waitForLoadState("networkidle");
      }),
  },
  {
    name: "pos-clock",
    role: "cashier",
    path: "/pos",
    get sql() {
      return removeScreens();
    },
    then: async (page) => {
      await page.getByTestId("clock-button").click();
      await soft(page.getByTestId("clock-dialog"));
      await page.waitForTimeout(500);
    },
  },
  {
    name: "account",
    role: "manager",
    path: "/account",
  },
  {
    name: "account-two-step",
    role: "owner",
    path: "/account",
    then: async (page) =>
      elsewhere(page, "owner", {}, async (p) => {
        await open(p, "/account");
        const card = p.getByTestId("two-step");
        await card.getByTestId("two-step-start").click();
        await soft(card.getByTestId("two-step-secret"), 10000);
        await card.getByTestId("two-step-code").fill("");
        await toTop(card, 90);
      }),
  },
  {
    name: "devices",
    role: "cashier",
    path: "/devices",
    then: async (page) => {
      await page.evaluate(() => {
        window.print = () => {};
      });
      await page.getByTestId("device-internet-test").click();
      await soft(page.locator('[data-testid="device-internet"][data-state="ok"]'), 15000);
      await page.getByTestId("device-printer-test").click();
      await soft(page.getByTestId("device-printer-no"), 5000);
      await page.getByTestId("device-printer-no").click();
      await soft(page.getByTestId("device-printer-fix"), 5000);
      await page.waitForTimeout(300);
    },
  },
  {
    name: "login",
    role: "cashier",
    phone: true,
    path: "/account",
    then: async (page) =>
      elsewhere(page, null, PHONE, async (p) => {
        await p.goto(`${BASE}/login`);
        await p.waitForLoadState("networkidle");
      }),
  },
  {
    name: "login-verify",
    role: "owner",
    path: "/account",
    sql: GM,
    then: async (page) => {
      // Two-step turned on for the helper's login, its sign-in asked for the code, then turned off again.
      const browser = page.context().browser();
      const on = await browser.newContext({ viewport: page.viewportSize() });
      try {
        const p = await on.newPage();
        await p.goto(`${BASE}/login`);
        await p.fill('input[name="email"]', "barista2@example.com");
        await p.fill('input[name="password"]', "password123");
        await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.click('button[type="submit"]')]);
        await open(p, "/account");
        const card = p.getByTestId("two-step");
        await card.getByTestId("two-step-start").click();
        const secret = ((await card.getByTestId("two-step-secret").textContent()) ?? "").replace(/\s+/g, "");
        await card.getByTestId("two-step-code").fill(totp(secret));
        await card.getByTestId("two-step-confirm").click();
        await card.getByTestId("two-step-on").waitFor({ timeout: 10000 });
        await elsewhere(page, null, {}, async (q) => {
          await q.goto(`${BASE}/login`);
          await q.fill('input[name="email"]', "barista2@example.com");
          await q.fill('input[name="password"]', "password123");
          await q.click('button[type="submit"]');
          await q.getByTestId("verify-code").waitFor({ timeout: 15000 });
          await q.getByTestId("verify-code").pressSequentially("481");
        });
        await card.getByTestId("two-step-off").click();
        await card.getByTestId("two-step-start").waitFor({ timeout: 10000 });
      } finally {
        await on.close();
        sql(PURCHASING);
      }
    },
  },

  // ───────────────────────── People and pay: Payroll ───────────────────────
  {
    name: "payroll-home",
    role: "owner",
    path: "/payroll",
    get sql() {
      return payrollSetup();
    },
  },
  {
    name: "payroll-advance-form",
    role: "kitchenboss",
    path: "/payroll",
    then: async (page) => {
      await page.getByTestId("give-advance").click();
      const form = page.getByTestId("advance-form");
      await form.getByLabel("To").selectOption({ label: "Karwan" });
      await form.getByLabel("Amount").fill("75000");
      await form.getByLabel("Paid from").selectOption("safe");
      await form.getByLabel("What it is for").fill("School fees");
      await page.waitForTimeout(500);
      await toTop(form, 120);
    },
  },
  {
    name: "payroll-run-draft",
    role: "owner",
    // September's, its payment cancelled and the payroll reopened: a draft that can be approved.
    path: () => `/payroll/${one(`select id from payroll_run where month = '2026-09-01'`)}`,
    sql: `select test.act_as('owner@example.com');
          select cancel_salary_payment(sp.id, 'Paid from the wrong account')
            from salary_payment sp join payroll_run r on r.id = sp.run_id
           where r.month = '2026-09-01' and sp.cancelled_at is null;
          select reopen_payroll(id, 'A bonus was left out') from payroll_run where month = '2026-09-01' and status = 'approved';
          select draft_payroll('2026-09-01') from payroll_run where month = '2026-09-01' and status = 'draft';`,
    then: async (page) => {
      const line = page.locator('[data-testid="payroll-line"]', { hasText: "Shno" }).first();
      if (!(await line.textContent()).includes("Eid bonus")) {
        await line.getByTestId("adjust-line").click();
        const form = page.getByTestId("adjust-form");
        await form.getByLabel("Added").fill("50000");
        await form.getByLabel("What it is for").first().fill("Eid bonus");
        await form.getByRole("button", { name: /^Save/ }).click();
        await page.waitForTimeout(1500);
      }
    },
  },
  {
    name: "payroll-run-approved",
    role: "kitchenboss",
    path: () => `/payroll/${one(`select id from payroll_run where month = '2026-09-01'`)}`,
    sql: `select test.act_as('owner@example.com');
          select draft_payroll('2026-09-01') from payroll_run where month = '2026-09-01' and status = 'draft';
          select approve_payroll(id) from payroll_run where month = '2026-09-01' and status = 'draft';`,
    then: async (page) => {
      const from = page.getByTestId("run-actions").getByLabel("Paid from");
      if (await from.count()) await from.first().selectOption("bank");
      await page.waitForTimeout(400);
    },
  },

  // ───────────────────────── The books ─────────────────────────────────────
  {
    name: "accounting-trial-balance",
    role: "kitchenboss",
    path: "/accounting",
  },
  {
    name: "accounting-equipment",
    role: "owner",
    path: "/accounting",
    then: async (page) => {
      const card = page.getByTestId("equipment");
      if ((await card.getByTestId("equipment-row").filter({ hasText: "Oven" }).count()) === 0) {
        await card.getByTestId("equipment-add").click();
        const form = card.getByTestId("equipment-form");
        await form.getByTestId("equipment-name").fill("Oven");
        await form.getByTestId("equipment-cost").fill("2400000");
        await form.getByTestId("equipment-life").fill("48");
        await form.locator('input[type="date"]').fill(one(`select (${TODAY} - interval '2 months')::date`));
        const paid = form.getByTestId("equipment-paid");
        if (await paid.count()) await paid.selectOption("bank").catch(() => {});
        await form.getByTestId("equipment-save").click();
        await soft(card.getByTestId("equipment-row").filter({ hasText: "Oven" }), 10000);
      }
      await toTop(card, 90);
    },
  },
  {
    name: "accounting-owner-money",
    role: "owner",
    path: "/accounting",
    then: async (page) => {
      await toTop(page.getByTestId("owner-money"), 90);
    },
  },
  {
    name: "accounting-chart-add",
    role: "kitchenboss",
    path: "/accounting",
    then: async (page) => {
      const add = page.getByTestId("chart-add");
      await add.getByLabel("Type").selectOption("expense");
      await add.getByLabel("Name (English)").fill("Repairs and upkeep");
      await toTop(add, 120);
    },
  },
  {
    name: "bank-statements",
    role: "owner",
    path: "/accounting/bank",
    then: async (page) => {
      for (const day of ["2025-10-31", "2025-11-30"]) {
        if ((await page.getByTestId("bank-statement").count()) >= (day === "2025-10-31" ? 1 : 2)) continue;
        await keepStatement(page, day);
      }
      await toTop(page.getByTestId("bank-statements"), 90);
    },
  },
  {
    name: "bank-ties",
    role: "owner",
    path: "/accounting/bank",
    then: async (page) => {
      await page.getByTestId("bank-date").fill("2025-12-15");
      await page.getByRole("button", { name: "Tick every line to this day" }).click();
      await page.getByTestId("bank-closing").fill(String(bankBalance("2025-12-15")));
      await soft(page.getByTestId("bank-difference").filter({ hasText: "It ties" }));
      await toTop(page.getByTestId("bank-difference"), 300);
    },
  },
  {
    name: "bank-read",
    role: "kitchenboss",
    path: "/accounting/bank",
    then: async (page) => {
      const rows = sql(`select to_char((e.occurred_at at time zone 'Asia/Baghdad')::date, 'DD/MM/YYYY') || E'\\t' ||
                               case when l.debit > 0 then 'Deposit' else 'Payment' end || E'\\t' ||
                               case when l.credit > 0 then trim_scale(l.credit)::text else '' end || E'\\t' ||
                               case when l.debit > 0 then trim_scale(l.debit)::text else '' end
                          from journal_line l join journal_entry e on e.id = l.journal_entry_id
                          join gl_account a on a.id = l.account_id
                         where a.code = '1020' and a.business_id = '${B}' and e.status = 'published'
                           and (e.occurred_at at time zone 'Asia/Baghdad')::date between date '2025-12-01' and date '2025-12-12'
                         order by e.occurred_at`).split("\n");
      rows.push("10/12/2025\tBank charge\t5,000\t");
      const text = ["Date\tDescription\tDebit\tCredit", ...rows].join("\n");
      await page.getByRole("button", { name: "or paste it" }).click();
      await page.getByTestId("bank-statement-text").fill(text);
      await soft(page.getByTestId("bank-read-summary"));
      await page.waitForTimeout(500);
      await toTop(page.getByTestId("bank-read"), 90);
    },
  },
  {
    name: "journals-new",
    role: "kitchenboss",
    path: "/journals",
    then: async (page) => {
      await page.getByRole("button", { name: "New Journal" }).click();
      await page.getByPlaceholder("Being the reason this entry is made").fill("Being the generator repaired");
      const lines = page.getByTestId("journal-line");
      const pick = async (i, code, dr, cr) => {
        const acct = lines.nth(i).getByLabel("Account");
        const v = await acct.locator("option", { hasText: new RegExp(`^${code}`) }).first().getAttribute("value");
        await acct.selectOption(v);
        await lines.nth(i).getByLabel("Description").fill(i === 0 ? "Generator repair" : "Paid by transfer");
        if (dr) await lines.nth(i).getByLabel("Debits").fill(dr);
        if (cr) await lines.nth(i).getByLabel("Credits").fill(cr);
      };
      await pick(0, "6900", "75000", "");
      await pick(1, "1020", "", "75000");
      await page.waitForTimeout(400);
    },
  },
  {
    name: "journals-register",
    role: "kitchenboss",
    path: "/journals",
    get sql() {
      return journalsSetup();
    },
    then: async (page) => {
      const manual = page.getByRole("button", { name: /Manual and reversals/ }).or(page.getByRole("link", { name: /Manual and reversals/ }));
      if (await manual.count()) await manual.first().click();
      await page.waitForTimeout(800);
      const no = one(`select journal_no from journal_entry where description = 'Being the generator repaired' and status = 'published' limit 1`);
      const row = page.locator(`[data-testid="journal-row"][data-no="${no}"]`);
      const link = row.getByRole("button", { name: `Journal ${no}` }).or(row.getByRole("link", { name: `Journal ${no}` }));
      if (await link.count()) await link.first().click();
      await page.waitForTimeout(500);
      await toTop(page.getByTestId("journal-row").first(), 160);
    },
  },
  {
    name: "journals-reverse",
    role: "owner",
    path: "/journals",
    get sql() {
      return journalsSetup();
    },
    then: async (page) => {
      const no = one(`select journal_no from journal_entry where description = 'Being the generator repaired' and status = 'published' limit 1`);
      const row = page.locator(`[data-testid="journal-row"][data-no="${no}"]`);
      await row.getByRole("button", { name: "Reverse" }).click();
      await page.getByLabel("Why is it being reversed?").fill("Charged to the wrong account");
      await toTop(row, 160);
    },
  },
  {
    name: "journals-ledger",
    role: "kitchenboss",
    path: "/journals?account=1020&from=2026-09-01&to=2026-09-30",
  },
  {
    name: "documents-list",
    role: "barista2",
    path: () => `/documents/goods_receipt/${one(`select id from goods_receipt where note = 'Delivery note 4471' limit 1`)}`,
    sql: PURCHASING,
    then: async (page) => {
      if ((await page.getByTestId("document-row").count()) < 2) {
        const pdf = async (title) => {
          const p = await page.context().newPage();
          await p.setContent(`<h1>${title}</h1><p>City Packaging Supplies — 100 cones at 150 = 15,000 IQD</p>`);
          const buf = await p.pdf({ format: "A4" });
          await p.close();
          return buf;
        };
        for (const [file, name] of [["invoice-4471.pdf", "Their invoice"], ["delivery-note.pdf", "Delivery note"]]) {
          await page.getByTestId("document-file").setInputFiles({ name: file, mimeType: "application/pdf", buffer: await pdf(name) });
          await page.getByTestId("document-name").fill(name);
          await page.getByTestId("document-attach").click();
          await soft(page.locator(`[data-testid="document-row"][data-name="${name}"]`), 15000);
        }
      }
      await page.getByTestId("document-note").fill("").catch(() => {});
    },
  },
  {
    name: "documents-readonly",
    role: "barista2",
    path: () => `/documents/goods_receipt/${one(`select id from goods_receipt where note = 'Delivery note 4471' limit 1`)}`,
    sql: AUDITOR,
    after: async () => sql(PURCHASING),
  },
  {
    name: "approvals-inbox",
    role: "owner",
    path: "/approvals",
  },
  {
    name: "approvals-send-back",
    role: "owner",
    path: "/approvals",
    then: async (page) => {
      const card = page.locator('[data-testid="approval"][data-kind="loss"]').first();
      await card.getByTestId("send-back").click();
      await card.getByTestId("send-back-why").fill("It was found in the other fridge");
      await toTop(card, 120);
    },
  },
  {
    name: "audit-books",
    role: "barista2",
    path: "/audit?group=books",
    sql: AUDITOR,
    then: async (page) => {
      const what = page.getByLabel("What");
      if (await what.count()) {
        const v = await what.locator("option", { hasText: /Books/ }).first().getAttribute("value");
        if (v && (await what.inputValue()) !== v) {
          await what.selectOption(v);
          await page.getByRole("button", { name: "Show" }).click();
          await page.waitForLoadState("networkidle");
        }
      }
    },
    after: async () => sql(PURCHASING),
  },
  {
    name: "problem-dialog",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await page.getByRole("button", { name: "Menu" }).click();
      await page.getByTestId("problem-button").click();
      await page.getByTestId("problem-dialog").getByTestId("problem-what").fill("The receipt printed twice for one sale");
      await page.waitForTimeout(300);
    },
    after: async (page) => {
      const dialog = page.getByTestId("problem-dialog");
      await dialog.getByTestId("problem-send").click();
      await soft(dialog.getByTestId("problem-sent"), 10000);
    },
  },
  {
    name: "problems-list",
    role: "owner",
    path: "/problems",
    get sql() {
      if (one(`select count(*) from problem_report where what like 'The card machine said declined%'`) !== "0") return "select 1";
      return `select test.act_as('cashier@example.com');
          select report_problem('/pos', 'The card machine said declined but the money went', '{}'::jsonb);
          select test.act_as('owner@example.com');
          select settle_problem(id, true, 'The bank refunded the customer')
            from (select id from problem_report where what like 'The card machine said declined%' and settled_at is null) x;`;
    },
  },

  // ───────────────────────── Reports ───────────────────────────────────────
  {
    name: "reports-top",
    role: "owner",
    path: "/reports",
  },
  {
    name: "reports-place",
    role: "owner",
    path: () => `/reports?place=${one(`select id from location where name = 'Main Branch'`)}`,
    then: async (page) => {
      await soft(page.getByTestId("reports-place-note"));
    },
  },
  {
    name: "reports-learned",
    role: "owner",
    path: "/reports/menu",
    then: async (page) => {
      for (let i = 0; i < 3; i++) {
        await open(page, "/reports/menu");
        await page.waitForTimeout(400);
      }
      await open(page, "/reports");
      const learned = page.getByTestId("reports-learned");
      await soft(learned);
      await toTop(page.getByTestId("report-pages"), 90);
    },
  },
  {
    name: "reports-pnl",
    role: "owner",
    path: "/reports?at=pnl#pnl",
    then: async (page) => toTop(page.locator("#pnl"), 80),
  },
  {
    name: "reports-pnl-places",
    role: "owner",
    path: "/reports?at=places#pnl-places",
    then: async (page) => toTop(page.locator("#pnl-places"), 80),
  },
  {
    name: "reports-channel",
    role: "owner",
    path: "/reports?at=channel#channel",
    then: async (page) => toTop(page.locator("#channel"), 80),
  },
  {
    name: "reports-losses",
    role: "owner",
    path: "/reports?at=losses#losses",
    get sql() {
      if (one(`select count(*) from stock_loss where reason = 'A box was crushed in the store room'`) !== "0") return "select 1";
      return `select test.act_as('barista@example.com');
          select record_loss('damaged', (select id from item where name = 'Cone'), null, 40, 'each',
                             'A box was crushed in the store room', p_wait => true);`;
    },
    then: async (page) => {
      const m = one(`select m.id from inventory_movement m join stock_loss l on l.id = m.reference_id
                      where l.reason = 'A box was crushed in the store room'
                        and not exists (select 1 from loss_review r where r.movement_id = m.id) limit 1`);
      if (m) {
        sql(`select test.act_as('owner@example.com');
             select review_loss('${m}', 'reverse', 'The box was fine: the cones were counted again');`);
        await open(page, "/reports?at=losses#losses");
      }
      await toTop(page.getByTestId("loss-list"), 80);
    },
  },
  {
    name: "reports-ageing",
    role: "kitchenboss",
    path: "/reports?at=ageing#ageing",
    then: async (page) => toTop(page.locator("#ageing"), 80),
  },
  {
    name: "reports-staff",
    role: "owner",
    path: "/reports?from=2026-09-01&to=2026-09-30#staff",
    then: async (page) => toTop(page.locator("#staff"), 80),
  },
  {
    name: "reports-rec-ok",
    role: "owner",
    path: "/reports?at=rec#reconciliation",
    then: async (page) => toTop(page.locator("#reconciliation"), 80),
  },
  {
    name: "reports-exceptions",
    role: "owner",
    path: "/reports?at=exceptions#exceptions",
    then: async (page) => toTop(page.locator("#exceptions"), 80),
  },
  {
    name: "analysis-hour",
    role: "owner",
    path: "/reports/sales?by=hour",
  },
  {
    name: "analysis-two",
    role: "owner",
    path: "/reports/sales?by=employee&then=payment",
  },
  {
    name: "week-glance",
    role: "owner",
    path: "/reports/week?end=2026-10-21",
  },
  {
    name: "month-glance",
    role: "owner",
    path: "/reports/month",
    sql: rule("daily_sales_target", "business", "null", "1500000", "What a good day brings"),
  },
  {
    name: "menu-matrix",
    role: "owner",
    path: "/reports/menu",
  },
  {
    name: "prices-rise",
    role: "owner",
    path: "/reports/prices",
    get sql() {
      if (one(`select count(*) from goods_receipt where note = 'Milk at the new price'`) !== "0") return "select 1";
      const milk = one(`select id from item where name = 'Milk'`);
      sql(`select test.act_as('manager@example.com');
           select receive_goods((select id from supplier where name = 'Sulaymaniyah Dairy Co.'),
             '[{"item_id":"${milk}","qty":24,"unit_code":"L","unit_price":1700}]'::jsonb,
             p_note => 'Milk at the new price', p_location => ${MAIN}, p_confirm => true);`);
      return "select 1";
    },
    then: async (page) => {
      const card = page.locator('[data-testid="price-rise"][data-item="Milk"]');
      if (await card.count()) await toTop(card, 90);
    },
  },
  {
    name: "dashboard-owner",
    role: "owner",
    path: "/dashboard",
    // The owner took money for the house and the car: the bank is below nothing.
    sql: `select test.act_as('owner@example.com');
          select move_cash('bank', 'owner', 10700000, 'Money for the house')
           where not exists (select 1 from cash_transfer where note = 'Money for the house');
          select move_cash('bank', 'owner', 2500000, 'Money for the car')
           where not exists (select 1 from cash_transfer where note = 'Money for the car');`,
  },
  {
    name: "dashboard-answer",
    role: "manager",
    path: "/dashboard",
    then: async (page) => {
      const red = page.getByTestId("needs-you").locator('[data-urgency="red"]').first();
      await red.getByRole("button", { name: "Answer" }).click();
      await red.getByLabel("What was done, or why it is fine").fill("Moved money in from the safe this morning");
      await toTop(red, 160);
    },
  },
  {
    name: "dashboard-books",
    role: "kitchenboss",
    path: "/dashboard",
  },
  {
    name: "dashboard-phone",
    role: "owner",
    phone: true,
    path: "/dashboard",
    then: async (page) => {
      const more = page.getByRole("button", { name: /Show the rest/ });
      if (await more.count()) await more.first().scrollIntoViewIfNeeded();
    },
  },
  {
    name: "stock-value",
    role: "owner",
    path: "/reports/stock?on=2026-09-30",
  },
  {
    name: "waste-by-recipe",
    role: "owner",
    path: "/reports/waste",
  },
  {
    name: "staffing-week",
    role: "owner",
    path: "/reports/staffing",
  },
  {
    name: "staffing-cost",
    role: "owner",
    path: "/reports/staffing",
    sql: rule("labour_target_percent", "business", "null", "25", "A quarter of sales at most"),
    then: async (page) => {
      const cost = page.getByText(/What the hours cost/).first();
      if (await cost.count()) await toTop(cost, 120);
    },
  },
  {
    name: "statements",
    role: "kitchenboss",
    path: "/reports/statements?from=2026-09-01&to=2026-09-30",
    then: async (page) => toTop(page.getByTestId("bs-balances"), 400),
  },
  {
    name: "cash-ahead-warning",
    role: "owner",
    path: "/reports/cash-ahead",
    // The espresso machine's yearly service, billed and due tomorrow.
    sql: `select test.act_as('owner@example.com');
          select record_bill((select id from supplier where name = 'Kurdistan Coffee Imports'), 'KCI-SV-2026', ${TODAY},
                             3000000, 1, null, '6900')
           where not exists (select 1 from purchase_invoice where invoice_no = 'KCI-SV-2026');`,
  },
  {
    name: "watch-finding",
    role: "owner",
    path: "/reports/watch",
    then: async (page) => {
      const card = page.getByText(/sales voided far more often/).first();
      if (await card.count()) await toTop(card, 120);
    },
  },

  // ───────────────────────── Selling: the till ─────────────────────────────
  {
    name: "pos-drawer-open",
    role: "cashier",
    path: "/pos",
    get sql() {
      return sellingSetup();
    },
    then: async (page) => {
      await page.getByTestId("drawer-button").click();
      const drawer = page.getByTestId("drawer-panel");
      await drawer.getByRole("button", { name: "Open the drawer" }).first().click();
      const notes = drawer.getByText("Count note by note");
      if (await notes.count()) await notes.first().click();
      await page.waitForTimeout(400);
      const boxes = drawer.locator('input[inputmode="numeric"], input[type="number"]');
      const n = await boxes.count();
      const counts = ["2", "3", "0", "1", "4"];
      for (let i = 0; i < Math.min(n - 1, counts.length); i++) await boxes.nth(i).fill(counts[i]).catch(() => {});
      await page.waitForTimeout(300);
    },
  },
  {
    name: "pos-menu",
    role: "cashier",
    path: "/pos",
    get sql() {
      return openDrawer("cashier");
    },
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await tile(page, "Americano").click();
      await tile(page, "Croissant").click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "pos-addons",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await tile(page, "Latte").click();
      const sheet = page.getByTestId("options-sheet");
      await soft(sheet);
      await sheet.locator(".variant-list button", { hasText: "Large" }).click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "pos-weight",
    role: "cashier",
    path: "/pos",
    sql: `update product_variant set sold_by_weight = true where name = 'Single / Chocolate'
            and product_id = (select id from product where name = 'Gelato Cup')`,
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await tile(page, "Gelato Cup").click();
      await chooseOptions(page, "Chocolate");
      const sheet = page.getByTestId("weight-sheet");
      await soft(sheet);
      await sheet.getByTestId("weight-input").fill("750");
      await page.waitForTimeout(300);
    },
    after: async (page) => {
      await page.keyboard.press("Escape");
      sql(`update product_variant set sold_by_weight = false where name = 'Single / Chocolate'
             and product_id = (select id from product where name = 'Gelato Cup')`);
    },
  },
  {
    name: "pos-discount-approval",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Dine-in");
      await tile(page, "Latte").click();
      await chooseOptions(page);
      await tile(page, "Croissant").click();
      await page.getByRole("button", { name: /Discount/ }).first().click();
      await page.getByLabel("Discount as a percentage").fill("20");
      const why = page.getByLabel("Why?");
      await why.selectOption({ index: 1 });
      await page.getByRole("button", { name: "Ask a manager" }).click();
      await page.waitForTimeout(600);
    },
  },
  {
    name: "pos-customer",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await page.getByRole("button", { name: "Customer", exact: true }).click();
      const dialog = page.getByTestId("customer-dialog");
      await dialog.getByTestId("customer-phone").fill("0750 412 3344");
      await dialog.getByTestId("customer-find").click();
      await soft(dialog.getByTestId("customer-found"), 10000);
    },
  },
  {
    name: "pos-giveaway",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await tile(page, "Espresso").click();
      await page.getByRole("button", { name: /Give away/ }).click();
      await soft(page.getByTestId("giveaway-dialog"));
      await page.waitForTimeout(300);
    },
  },
  {
    name: "pos-pay-cash",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await page.getByRole("button", { name: "Customer", exact: true }).click();
      const dialog = page.getByTestId("customer-dialog");
      await dialog.getByTestId("customer-phone").fill("0750 412 3344");
      await dialog.getByTestId("customer-find").click();
      await soft(dialog.getByTestId("customer-found"), 10000);
      await dialog.getByTestId("customer-choose").first().click();
      await tile(page, "Iced Latte").click();
      await chooseOptions(page);
      await tile(page, "Croissant").click();
      await tile(page, "Espresso").click();
      await page.getByRole("button", { name: /^Cash/ }).click();
      await page.locator(".cash-quick button", { hasText: "10,000" }).first().click();
      await page.waitForTimeout(300);
    },
    after: async (page) => paid(page),
  },
  {
    name: "pos-pay-split",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Dine-in");
      await tile(page, "Vanilla Latte").click();
      await chooseOptions(page);
      await tile(page, "Croissant").click();
      await page.getByRole("button", { name: /^Cash/ }).click();
      await page.getByTestId("pay-split").click();
      const box = page.getByTestId("split-box");
      await box.getByLabel("How payment 1 is made").selectOption("card");
      await box.getByLabel("Amount of payment 1").fill("4000");
      await page.waitForTimeout(300);
    },
    after: async (page) => paid(page),
  },
  {
    name: "pos-pay-dollars",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await tile(page, "Gelato Cone").click();
      await chooseOptions(page);
      await tile(page, "Vanilla Latte").click();
      await chooseOptions(page);
      await page.getByRole("button", { name: /^Cash/ }).click();
      await page.getByTestId("pay-usd").click();
      await page.locator("#usd-received").fill("20");
      await page.waitForTimeout(300);
    },
    after: async (page) => paid(page),
  },
  {
    name: "pos-pay-platform",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Talabat");
      await tile(page, "Latte").click();
      await chooseOptions(page);
      await page.locator(".pos-grid .order-actions button.btn-primary").last().click();
      await page.waitForTimeout(500);
    },
    // Two Talabat orders rung up, with their numbers: Delivery Platforms shows them owed.
    after: async (page) => {
      await page.locator("#platform-order-no").fill("TB-40871");
      await paid(page);
      await tile(page, "Americano").click();
      await chooseOptions(page);
      await page.locator(".pos-grid .order-actions button.btn-primary").last().click();
      await page.locator("#platform-order-no").fill("TB-40872");
      await paid(page);
    },
  },
  {
    name: "pos-receipt-card",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await page.getByRole("button", { name: "Customer", exact: true }).click();
      const dialog = page.getByTestId("customer-dialog");
      await dialog.getByTestId("customer-phone").fill("0750 412 3344");
      await dialog.getByTestId("customer-find").click();
      await soft(dialog.getByTestId("customer-found"), 10000);
      await dialog.getByTestId("customer-choose").first().click();
      await tile(page, "Latte").click();
      await chooseOptions(page);
      await tile(page, "Croissant").click();
      await page.getByRole("button", { name: /^Cash/ }).click();
      await page.locator(".cash-quick button", { hasText: "10,000" }).first().click();
      await page.locator(".pay-confirm").click();
      await soft(page.getByText("Sale recorded"), 15000);
      await page.waitForTimeout(400);
    },
  },
  {
    name: "pos-retry",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await page.getByRole("button", { name: "Customer", exact: true }).click();
      const dialog = page.getByTestId("customer-dialog");
      await dialog.getByTestId("customer-phone").fill("0750 412 3344");
      await dialog.getByTestId("customer-find").click();
      await soft(dialog.getByTestId("customer-found"), 10000);
      await dialog.getByTestId("customer-choose").first().click();
      await tile(page, "Americano").click();
      await page.getByRole("button", { name: /^Card/ }).click();
      await page.locator(".pay-confirm").waitFor({ timeout: 10000 });
      let dropped = false;
      await page.route("**/pos", async (route) => {
        if (route.request().method() === "POST" && !dropped) {
          dropped = true;
          return route.abort("failed");
        }
        return route.continue();
      });
      await page.locator(".pay-confirm").click();
      await page.waitForTimeout(1500);
      await page.unroute("**/pos");
    },
    after: async (page) => {
      // Discarded: nothing was recorded (the request never reached the server).
      const discard = page.getByRole("button", { name: /Discard/ });
      if (await discard.count()) await discard.first().click();
      await page.waitForTimeout(500);
    },
  },

  {
    name: "pos-edit-tables",
    role: "manager",
    path: "/pos",
    then: async (page) => {
      await page.getByRole("tab", { name: /Tables/ }).click().catch(() => {});
      await page.getByRole("button", { name: "Edit tables" }).click();
      if ((await page.locator(".table-tile").count()) === 0 && (await page.getByLabel("How many").count())) {
        await page.getByLabel("How many").fill("6");
        await page.locator(".bulk-add button").click();
        await soft(page.getByText(/tables added/), 15000);
      }
      await page.waitForTimeout(500);
    },
    after: async (page) => {
      const close = page.getByRole("button", { name: "Close", exact: true });
      if (await close.count()) await close.last().click();
    },
  },
  {
    name: "pos-floor",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      const tab = page.getByRole("tab", { name: /Tables/ });
      if (await tab.count()) await tab.click();
      const busy = await page.locator(".table-tile.busy").count();
      if (busy < 2) {
        for (const [table, items, print] of [["Table 2", ["Latte", "Croissant"], true], ["Table 4", ["Americano", "Gelato Cone", "Espresso"], false]]) {
          await page.locator(".table-tile", { hasText: table }).first().click();
          for (const it of items) {
            await tile(page, it).click();
            await chooseOptions(page);
          }
          if (print) {
            await page.getByRole("button", { name: /Print bill/ }).click();
            await page.waitForTimeout(1500);
          } else {
            await page.getByRole("button", { name: /Save/ }).first().click();
          }
          await soft(page.getByText(new RegExp(`${table} — saved`)), 10000);
          await page.waitForTimeout(800);
          if (await tab.count()) await tab.click();
        }
      }
      await page.waitForTimeout(500);
    },
  },
  {
    name: "pos-split",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      const tab = page.getByRole("tab", { name: /Tables/ });
      if (await tab.count()) await tab.click();
      await page.locator(".table-tile", { hasText: "Table 4" }).first().click();
      await page.getByRole("button", { name: /Split bill/ }).click();
      const line = page.locator(".split-line").first();
      await line.getByRole("button", { name: "+" }).click().catch(() => {});
      await page.waitForTimeout(400);
    },
    after: async (page) => page.keyboard.press("Escape"),
  },
  {
    name: "pos-cancel-bill",
    role: "manager",
    path: "/pos",
    then: async (page) => {
      const tab = page.getByRole("tab", { name: /Tables/ });
      if (await tab.count()) await tab.click();
      await page.locator(".table-tile", { hasText: "Table 4" }).first().click();
      await page.getByRole("button", { name: /Cancel bill/ }).click();
      const reason = page.getByLabel("Reason");
      if (await reason.count()) await reason.selectOption({ index: 1 });
      await page.waitForTimeout(200);
      const why = page.locator(".pos-modal textarea, .pos-modal input[type=text]").first();
      if (await why.count()) await why.fill("The customers left before ordering").catch(() => {});
      await page.waitForTimeout(400);
    },
    after: async (page) => page.keyboard.press("Escape"),
  },
  {
    name: "pos-preorder-new",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      const c = tile(page, "Croissant");
      for (let i = 0; i < 12; i++) await c.click();
      await page.getByTestId("preorders-button").click();
      const form = page.getByTestId("preorder-form");
      await soft(form);
      await form.getByTestId("preorder-name").fill("Shilan Omar");
      const phone = form.getByTestId("preorder-phone");
      if (await phone.count()) await phone.fill("0750 777 1122");
      await form.getByTestId("preorder-deposit").fill("10000");
      await page.waitForTimeout(300);
    },
    after: async (page) => {
      await page.keyboard.press("Escape");
      await freshSale(page, null);
    },
  },
  {
    name: "pos-preorder-list",
    role: "cashier",
    path: "/pos",
    get sql() {
      if (one(`select count(*) from pre_order where customer_name = 'Rawa Karim'`) !== "0") return "select 1";
      const v = one(`select v.id from product_variant v join product p on p.id = v.product_id where p.name = 'Croissant' limit 1`);
      const w = one(`select v.id from product_variant v join product p on p.id = v.product_id where p.name = 'Gelato Cup' and v.name = 'Single / Vanilla'`);
      sql(`select test.act_as('cashier@example.com');
           select take_pre_order('Rawa Karim', now() + interval '3 hours', '[{"variant_id":"${v}","qty":20}]'::jsonb, '0751 333 4455',
                                 'For the school party', 'takeaway', '{"type":"cash","amount":20000}'::jsonb);
           select take_pre_order('Dilan Aziz', now() + interval '1 day', '[{"variant_id":"${w}","qty":6}]'::jsonb, '0750 111 2233');`);
      sql(`set session_replication_role = replica;
           update pre_order set pickup_at = now() - interval '25 minutes' where customer_name = 'Rawa Karim';`);
      return "select 1";
    },
    then: async (page) => {
      await freshSale(page, null);
      await page.getByTestId("preorders-button").click();
      await soft(page.getByTestId("preorders-dialog"));
      await page.waitForTimeout(400);
    },
    after: async (page) => {
      const close = page.getByTestId("preorders-close");
      if (await close.count()) await close.click();
    },
  },
  {
    name: "pos-printing",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await page.getByRole("button", { name: /print/i }).filter({ has: page.locator("svg") }).first().click().catch(() => {});
      await page.waitForTimeout(500);
    },
    after: async (page) => page.keyboard.press("Escape"),
  },
  {
    name: "pos-offline",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await page.context().setOffline(true);
      await page.waitForTimeout(500);
      for (const name of ["Espresso", "Bottled Water"]) {
        await tile(page, name).click();
        await page.getByRole("button", { name: /^Card$/ }).click();
        await page.locator(".pay-confirm").click();
        await soft(page.getByTestId("receipt-offline"), 10000);
        await page.waitForTimeout(500);
      }
      await page.getByTestId("offline-strip").click().catch(() => {});
      await page.waitForTimeout(500);
    },
    after: async (page) => {
      await page.keyboard.press("Escape");
      await page.context().setOffline(false);
      await soft(page.getByTestId("offline-strip"), 1000);
      await page.getByTestId("offline-strip").waitFor({ state: "detached", timeout: 40000 }).catch(() => {});
    },
  },
  {
    name: "pos-offline-window",
    role: "manager",
    path: "/pos",
    then: async (page) => {
      await freshSale(page, "Takeaway");
      await page.context().setOffline(true);
      await page.waitForTimeout(500);
      await tile(page, "Bottled Water").click();
      await page.getByRole("button", { name: /^Card$/ }).click();
      await page.locator(".pay-confirm").click();
      await soft(page.getByTestId("receipt-offline"), 10000);
      // The water's price changes while the till is offline: the sale is refused when sent.
      const v = one(`select v.id from product_variant v join product p on p.id = v.product_id where p.name = 'Bottled Water' limit 1`);
      sql(`select test.act_as('owner@example.com');
           select set_price('${v}', 'takeaway', 750, null, null, gen_random_uuid());`);
      await page.context().setOffline(false);
      await soft(page.getByTestId("offline-error"), 30000);
      await page.waitForTimeout(3000);
      const strip = page.getByTestId("offline-strip");
      if (await strip.count()) await strip.click().catch(() => {});
      await soft(page.getByTestId("offline-error"), 10000);
      await page.waitForTimeout(400);
    },
    after: async (page) => {
      const v = one(`select v.id from product_variant v join product p on p.id = v.product_id where p.name = 'Bottled Water' limit 1`);
      sql(`select test.act_as('owner@example.com');
           select set_price('${v}', 'takeaway', 500, null, null, gen_random_uuid());`);
      await page.keyboard.press("Escape");
    },
  },

  {
    name: "pos-drawer-close",
    role: "cashier",
    path: "/pos",
    then: async (page) => {
      for (let i = 0; i < 5 && !(await soft(page.getByTestId("drawer-panel"), 1500)); i++) {
        await page.getByTestId("drawer-button").click({ timeout: 8000 }).catch(() => {});
      }

      const drawer = page.getByTestId("drawer-panel");
      await drawer.getByRole("button", { name: "Close the drawer" }).first().click({ timeout: 8000 });
      await page.waitForTimeout(300);
      const total = drawer.getByText("Type the total instead");
      if (await total.count()) await total.click();
      const counted = drawer.getByLabel("Cash counted", { exact: true });
      const expected = Number(one(`select d.carry + d.moved from location l cross join lateral drawer_position(l.business_id, l.id) d
                                    where l.business_id = '${B}' and l.name = 'Main Branch'`));
      if (await counted.count()) await counted.fill(String(expected - 1000));
      const usd = drawer.getByLabel(/Dollars counted/);
      if (await usd.count()) await usd.first().fill("20");
      const stays = drawer.getByLabel("Stays in the drawer");
      if (await stays.count()) await stays.fill("50000");
      await page.waitForTimeout(400);
    },
    after: async (page) => page.keyboard.press("Escape"),
  },

  // ───────────────────────── Selling: Orders, Sales, Platforms, Customers ──
  {
    name: "orders-refund",
    role: "manager",
    path: "/orders",
    then: async (page) => {
      const row = page.locator("tbody tr", { has: page.getByRole("button", { name: "Refund" }) })
        .filter({ hasText: "8,000" }).first();
      await row.getByRole("button", { name: "Refund" }).click();
      const dialog = page.getByTestId("refund-dialog");
      await soft(dialog);
      for (const name of ["Iced Latte", "Croissant"]) {
        const qty = dialog.getByLabel(new RegExp(`How many of ${name}`));
        if (await qty.count()) await qty.fill("0");
      }
      await dialog.getByLabel("Why refund it?").selectOption({ index: 1 });
      await page.waitForTimeout(400);
    },
    after: async (page) => {
      const dialog = page.getByTestId("refund-dialog");
      await dialog.getByRole("button", { name: "Confirm refund" }).click().catch(() => {});
      await soft(dialog.getByTestId("refund-answer"), 10000);
      await dialog.getByRole("button", { name: "Close", exact: true }).click().catch(() => {});
    },
  },
  {
    name: "orders-list",
    role: "manager",
    path: "/orders?at=list",
    // The split payment and the refund, one under the other.
    then: async (page) => toTop(page.locator("tbody tr").filter({ hasText: /Card [\d,]+ IQD \+ Cash/ }).first(), 120),
  },
  {
    name: "orders-void",
    role: "manager",
    path: "/orders?at=void",
    then: async (page) => {
      const done = page.locator("tbody tr").filter({ hasText: /approved by/ }).filter({ hasText: /Voided/ });
      if (!(await done.count())) {
        const row = page.locator("tbody tr", { has: page.getByRole("button", { name: "Void" }) })
          .filter({ hasText: /2026-10-22 01:0/ }).last();
        await row.getByRole("button", { name: "Void" }).click();
        const fix = page.getByTestId("order-correction");
        await fix.getByLabel("Why void it?").selectOption({ index: 1 });
        await fix.getByLabel("Approved by").selectOption({ index: 1 });
        await fix.getByLabel("Their PIN").fill("24680");
        await fix.getByRole("button", { name: "Confirm void" }).click();
        await soft(page.getByText(/Voided \(journal/), 15000);
        await page.reload();
      }
      await toTop(done, 200);
    },
  },
  {
    name: "sales-overview",
    role: "owner",
    path: "/sales",
  },
  {
    name: "sales-move-cash",
    role: "manager",
    path: "/sales",
    then: async (page) => {
      const from = page.getByLabel("Cash from");
      await from.selectOption({ label: "the safe" }).catch(() => from.selectOption({ index: 1 }));
      await page.getByLabel("Cash to").selectOption({ label: "the bank" }).catch(() => {});
      await page.getByLabel("Amount to move").fill("500000");
      await page.getByLabel("What the cash is for").fill("Deposit at the bank");
      await page.waitForTimeout(300);
      await toTop(page.getByRole("heading", { name: "Move Cash" }), 110);
    },
  },
  {
    name: "sales-dollars",
    role: "manager",
    path: "/sales",
    then: async (page) => toTop(page.getByTestId("dollars-panel"), 90),
  },
  {
    name: "sales-card",
    role: "kitchenboss",
    path: "/sales",
    then: async (page) => {
      const panel = page.getByTestId("card-takings");
      await panel.getByLabel("The terminal's total").first().fill("1,053,500").catch(() => {});
      await panel.getByLabel("Reached the bank").first().fill("1045600").catch(() => {});
      await page.waitForTimeout(400);
      await toTop(panel, 90);
    },
  },
  {
    name: "sales-sessions",
    role: "owner",
    path: "/sales/sessions",
  },
  {
    name: "sales-session",
    role: "owner",
    path: () => `/sales/sessions/${one(`select id from work_shift where kind = 'session' and closed_at is not null
                                          and counted_cash is not null order by closed_at desc limit 1`)}`,
  },
  {
    name: "platforms-owed",
    role: "owner",
    path: "/platforms",
    then: async (page) => {
      const ours = page.getByTestId("platform-owed").filter({ hasText: "TB-40871" });
      if (await ours.count()) await toTop(ours, 520);
      else await toTop(page.getByTestId("platform-owed").first(), 160);
    },
  },
  {
    name: "platforms-match",
    role: "kitchenboss",
    path: "/platforms",
    then: async (page) => {
      const m = page.getByTestId("statement-matcher");
      await m.getByLabel("Platform").selectOption("talabat");
      await m.getByLabel("The statement").fill(
        ["Order ID,Net Payout,Commission", "TB-40871,3570,630", "TB-40827,2550,450"].join("\n"),
      );
      await m.getByRole("button", { name: "Match to the orders waiting" }).click();
      await soft(m.getByTestId("match-result"), 10000);
      await toTop(m, 90);
    },
  },
  {
    name: "customers-list",
    role: "owner",
    path: "/customers",
    get sql() {
      return accountSetup();
    },
  },
  {
    name: "customer-page",
    role: "owner",
    path: () => `/customers/${one(`select id from customer where full_name = 'Sara Ahmed'`)}`,
    get sql() {
      if (one(`select count(*) from customer_address`) !== "0") return "select 1";
      return `select test.act_as('owner@example.com');
              select save_customer_address((select id from customer where full_name = 'Sara Ahmed'), null, 'Home',
                                           '100 Meter Street, Gulan Towers B, flat 12', 'Ring twice');`;
    },
  },
  {
    name: "customer-account",
    role: "kitchenboss",
    path: () => `/customers/${one(`select id from customer where full_name = 'Erbil Tech Office'`)}`,
    then: async (page) => {
      const acct = page.getByTestId("customer-account");
      if (await acct.count()) await toTop(acct, 90);
    },
  },

  // ───────────────────────── The day's end (after the selling above) ───────
  {
    name: "end-of-day-slip",
    role: "owner",
    path: "/end-of-day?at=slip",
    locator: ".guide-slip",
    // The slip as the printer gets it: kept when the till asks to print, shown as print shows it.
    then: async (page) => {
      await page.evaluate(() => {
        window.print = () => {
          const paper = document.querySelector(".print-slip");
          if (!paper || document.querySelector(".guide-slip")) return;
          const copy = paper.cloneNode(true);
          copy.classList.add("guide-slip");
          copy.removeAttribute("data-testid");
          document.body.appendChild(copy);
        };
      });
      await page.getByTestId("eod-slip").click();
      await soft(page.locator(".guide-slip"), 8000);
      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(400);
    },
    after: async (page) => {
      await page.emulateMedia({ media: "screen" });
      await page.evaluate(() => document.querySelector(".guide-slip")?.remove());
    },
  },
  {
    name: "accounting-close-failing",
    role: "owner",
    path: "/accounting",
    then: async (page) => {
      const close = page.getByRole("heading", { name: /^Close 2026-10/ });
      await toTop(close, 100);
    },
  },
  {
    name: "reports-payments",
    role: "owner",
    path: "/reports?at=payments#payments",
    then: async (page) => toTop(page.locator("#payments"), 80),
  },
  {
    name: "reports-rec-bad",
    role: "owner",
    path: "/reports?at=recbad#reconciliation",
    get sql() {
      // Today's 500 IQD water sale loses its journal for the picture, and gets it back after.
      const j = one(`select e.id from journal_entry e join sales_order o on o.id = e.reference_id
                      where e.reference_type = 'sales_order' and e.status = 'published' and e.reverses_entry is null
                        and o.net_amount = 500 and o.status = 'completed'
                        and o.placed_at >= (${TODAY})::timestamp at time zone 'Asia/Baghdad'
                      order by o.placed_at limit 1`);
      if (j) {
        meanwhile(
        "reports-rec-bad",
          `set session_replication_role = replica; update journal_entry set status = 'draft' where id = '${j}';`,
          `set session_replication_role = replica; update journal_entry set status = 'published' where id = '${j}';`,
        );
      }
      return "select 1";
    },
    then: async (page) => {
      await toTop(page.getByRole("heading", { name: "Records to look into" }), 420);
    },
    after: async () => undo(),
  },
  {
    name: "end-of-day-steps",
    role: "manager",
    path: "/end-of-day?at=steps",
    get sql() {
      // The bills and the drawer left; the rest done for the picture, and put back after.
      const losses = ids(`select id from stock_loss where status = 'pending'`);
      const dara = ids(`select a.id from attendance a join employee e on e.id = a.employee_id
                         where e.full_name = 'Dara' and a.clock_out is null`);
      const alerts = ids(`select id from alert where business_id = '${B}' and resolved_at is null
                            and acknowledged_at is null and (snoozed_until is null or snoozed_until < now())`);
      meanwhile(
        "end-of-day-steps",
        `set session_replication_role = replica;
         update stock_loss set status = 'approved' where id in (${losses});
         update attendance set clock_out = clock_in + interval '7 hours 26 minutes' where id in (${dara});
         update alert set acknowledged_at = now(), acknowledged_by = (select id from app_user where email = 'manager@example.com'),
                          ack_note = 'Seen to' where id in (${alerts});`,
        `set session_replication_role = replica;
         update stock_loss set status = 'pending' where id in (${losses});
         update attendance set clock_out = null where id in (${dara});
         update alert set acknowledged_at = null, acknowledged_by = null, ack_note = null where id in (${alerts});`,
      );
      return "select 1";
    },
    then: async (page) => {
      const drawer = page.getByTestId("eod-tills").getByTestId("drawer-panel");
      await drawer.getByRole("button", { name: "Close it for them" }).click();
      await drawer.getByLabel("Why it is closed").fill("Closing up for the night");
      await page.waitForTimeout(300);
      await toTop(page.getByTestId("eod-progress"), 80);
    },
    after: async () => undo(),
  },
  {
    name: "dashboard-all-clear",
    role: "owner",
    path: "/dashboard?at=clear",
    get sql() {
      const alerts = ids(`select id from alert where business_id = '${B}' and resolved_at is null
                            and acknowledged_at is null and (snoozed_until is null or snoozed_until < now())`);
      meanwhile(
        "dashboard-all-clear",
        `set session_replication_role = replica;
         update alert set acknowledged_at = now() - interval '20 minutes',
                          acknowledged_by = (select id from app_user where email = 'owner@example.com'),
                          ack_note = 'Seen to' where id in (${alerts});`,
        `set session_replication_role = replica;
         update alert set acknowledged_at = null, acknowledged_by = null, ack_note = null where id in (${alerts});`,
      );
      return "select 1";
    },
    after: async () => undo(),
  },
  {
    name: "dashboard-setup",
    role: "barista2",
    path: "/dashboard?at=setup",
    get sql() {
      // Hana, for the picture, owns the second, empty café; back to this one after.
      meanwhile(
        "dashboard-setup",
        `set session_replication_role = replica;
         update app_user set business_id = '${B2}' where email = 'barista2@example.com';
         delete from user_role where app_user_id = (select id from app_user where email = 'barista2@example.com');
         insert into user_role (app_user_id, role, business_id)
           select id, 'owner', '${B2}' from app_user where email = 'barista2@example.com';`,
        `set session_replication_role = replica;
         update app_user set business_id = '${B}' where email = 'barista2@example.com';
         delete from user_role where app_user_id = (select id from app_user where email = 'barista2@example.com');
         insert into user_role (app_user_id, role, business_id)
           select id, 'purchasing', '${B}' from app_user where email = 'barista2@example.com';`,
      );
      return "select 1";
    },
    after: async () => undo(),
  },
];

/**
 * The till's first sale of the day, from a clean order: the menu shown, no
 * bill or quick sale left on screen, the way of selling chosen.
 */
async function freshSale(page, channel) {
  await page.keyboard.press("Escape").catch(() => {});
  const menuTab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await menuTab.count()) await menuTab.click();
  const quick = page.locator(".strip-chip", { hasText: "Quick sale" });
  if (await quick.isVisible().catch(() => false)) await quick.click();
  const clear = page.getByRole("button", { name: "Clear", exact: true });
  if ((await clear.count()) && (await clear.isEnabled().catch(() => false))) {
    await clear.click();
    const yes = page.getByRole("button", { name: /^(Yes|Clear it)/ });
    if (await yes.count()) await yes.first().click();
  }
  if (channel) await page.getByRole("button", { name: channel, exact: true }).first().click();
  await page.waitForTimeout(200);
}

/** The size and add-ons sheet, if it opened: the size named (or the first), the first of each group, then added. */
async function chooseOptions(page, size) {
  const sheet = page.getByTestId("options-sheet");
  if (!(await soft(sheet, 1500))) return;
  const sizes = sheet.locator(".variant-list button");
  if (await sizes.count()) {
    const pick = size ? sizes.filter({ hasText: size }).first() : sizes.first();
    await pick.click();
    await page.waitForTimeout(300);
  }
  if (!(await sheet.isVisible().catch(() => false))) return;
  const groups = sheet.getByTestId("addon-group");
  for (let i = 0; i < (await groups.count()); i++) {
    const g = groups.nth(i);
    if ((await g.evaluate((el) => el.tagName)) === "DETAILS") continue;
    await g.locator("button").first().click().catch(() => {});
  }
  const add = sheet.getByRole("button", { name: /^Add/ }).last();
  if (await add.count()) await add.click();
  await page.waitForTimeout(250);
}

/**
 * The office's account: on account, 30 days, and an invoice for last week's
 * coffee that has gone past its day to be paid.
 */
function accountSetup() {
  if (one(`select count(*) from customer_invoice`) !== "0") return "select 1";
  const office = one(`select id from customer where full_name = 'Erbil Tech Office'`);
  const v = one(`select v.id from product_variant v join product p on p.id = v.product_id where p.name = 'Americano' limit 1`);
  sql(`select test.act_as('owner@example.com');
       select set_customer_account('${office}', true, 500000, 0);
       select invoice_customer('${office}', '[{"variant_id":"${v}","qty":24}]'::jsonb, gen_random_uuid(), 'Coffee for the meeting room');`);
  sql(`set session_replication_role = replica;
       update customer_invoice set due_on = due_on - 3, issued_on = issued_on - 3 where customer_id = '${office}';`);
  sql(`select test.act_as('owner@example.com'); select set_customer_account('${office}', true, 500000, 30);`);
  return "select 1";
}

/** The payment confirmed, and the sale recorded. */
async function paid(page) {
  await page.locator(".pay-confirm").click();
  await page.locator(".pay-confirm").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/** A drawer open at the till for the person, counted as it was left. */
function openDrawer(who) {
  const open = one(`select count(*) from work_shift w
                     where w.kind = 'session' and w.closed_at is null and w.business_id = '${B}'`);
  if (open !== "0") return "select 1";
  const holds = one(`select d.carry + d.moved from location l cross join lateral drawer_position(l.business_id, l.id) d
                      where l.business_id = '${B}' and l.name = 'Main Branch'`);
  return `select test.act_as('${who}@example.com'); select open_cash_session(${holds});`;
}

/** Customers the till finds, and a dollar rate set by a manager this morning. */
function sellingSetup() {
  if (one(`select count(*) from customer`) === "0") {
    sql(`select test.act_as('owner@example.com');
         select save_customer(null, 'Sara Ahmed', '0750 412 3344', 'Likes her latte with oat milk');
         select save_customer(null, 'Hemin Rashid', '0751 220 9087');
         select save_customer(null, 'Erbil Tech Office', '0770 300 1200', 'Coffee for the office, monthly bill');`);
  }
  if (one(`select count(*) from fx_rate`) === "0")
    sql(`select test.act_as('manager@example.com'); select set_fx_rate('USD', 1310, 'The exchange office this morning');`);
  return "select 1";
}

/** The bank's balance on the books at the end of a day: what a statement to that day says. */
const bankBalance = (day) =>
  Number(
    one(`select coalesce(sum(l.debit - l.credit), 0) from journal_line l join journal_entry e on e.id = l.journal_entry_id
          join gl_account a on a.id = l.account_id
         where a.code = '1020' and a.business_id = '${B}' and e.status = 'published'
           and (e.occurred_at at time zone 'Asia/Baghdad')::date <= date '${day}'`),
  );

/** A bank statement to a day kept: every line ticked to it, and the balance it ends with. */
async function keepStatement(page, day) {
  await page.getByTestId("bank-date").fill(day);
  await page.getByRole("button", { name: "Tick every line to this day" }).click();
  await page.getByTestId("bank-closing").fill(String(bankBalance(day)));
  await page.getByTestId("bank-keep").click();
  await soft(page.getByText(/Statement \d+ is kept/), 10000);
  await page.waitForTimeout(800);
}

/** A manual journal published (the generator's repair) and one saved as a draft. */
function journalsSetup() {
  if (one(`select count(*) from journal_entry where description = 'Being the generator repaired'`) !== "0") return "select 1";
  sql(`select test.act_as('owner@example.com');
       select save_journal(${TODAY}, 'Being the generator repaired',
         '[{"code":"6900","debit":75000,"credit":0,"memo":"Generator repair"},{"code":"1020","debit":0,"credit":75000,"memo":"Paid by transfer"}]'::jsonb,
         true, 'INV-311');
       select save_journal(${TODAY}, 'Being the deposit on the new freezer',
         '[{"code":"6900","debit":40000,"credit":0,"memo":"Freezer deposit"},{"code":"1020","debit":0,"credit":40000,"memo":"By transfer"}]'::jsonb,
         false);`);
  return "select 1";
}

/** A phone, as the pictures of one are taken. */
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

/** A link for a person's phone, as a manager makes it on Staff. */
const phoneLinkKey = (name) =>
  one(`select test.act_as('manager@example.com');
       select link_phone_start((select id from employee where full_name = '${name}')) ->> 'key'`);

/** Every clock screen taken out of use: a till shows its own clock again. */
function removeScreens() {
  const ids = sql(`select id from clock_screen where removed_at is null`).split("\n").filter(Boolean);
  for (const id of ids)
    sql(`select test.act_as('owner@example.com'); select remove_clock_screen('${id}', 'Made for the guide');`);
  return "select 1";
}

/** RFC 6238: the six digits of an authenticator app now (as tests/e2e/gateway.mjs checks them). */
function totp(secret) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "")) bits += A.indexOf(ch).toString(2).padStart(5, "0");
  const key = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) key.push(parseInt(bits.slice(i, i + 8), 2));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(key)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, "0");
}

/** The device cookies of the till made the shop's clock screen. */
let CLOCK_SCREEN_COOKIES = null;

/**
 * A picture taken in a context of its own (another device, signed in as
 * someone, or signed out), shown on the picture's page as it was seen there:
 * so a sign-out, a phone's link or a clock screen leaves the other pictures'
 * sessions as they were.
 */
async function elsewhere(page, who, options, fn) {
  const size = page.viewportSize();
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, ...options });
  try {
    await ctx.clock.install({ time: new Date(`${CLOCK_AT.replace(" ", "T")}Z`) });
    await ctx.addInitScript(() => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) {
        return String(k).startsWith("sixties.tour.") ? "no" : get.call(this, k);
      };
    });
    const p = await ctx.newPage();
    if (who) {
      await p.goto(`${BASE}/login`);
      await p.fill('input[name="email"]', `${who}@example.com`);
      await p.fill('input[name="password"]', "password123");
      await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.click('button[type="submit"]')]);
    }
    await fn(p);
    await p.waitForTimeout(250);
    const png = await p.screenshot({ type: "png" });
    await page.goto("about:blank");
    await page.setContent(
      `<html><body style="margin:0;background:#fff"><img style="display:block" src="data:image/png;base64,${png.toString("base64")}"></body></html>`,
    );
  } finally {
    await ctx.close();
  }
}

/**
 * The people's weeks: PINs (Lana has none yet), four weeks of shifts and of
 * hours on the clock, and this week planned with only Dara on Friday evening.
 * Yesterday Avin came 20 minutes late, Bana did not come, and Dara is still
 * clocked in.
 */
function staffSetup() {
  if (one(`select count(*) from shift_schedule`) !== "0") return "select 1";
  const pins = { Avin: "5820", Bana: "6731", Dara: "7942", Karwan: "8153", Shno: "9264", "Demo Manager": "3175" };
  sql(`select test.act_as('owner@example.com');
       ${Object.entries(pins)
         .map(([n, pin]) => `select set_clock_pin((select id from employee where full_name = '${n}'), '${pin}');`)
         .join("\n")}`);
  const owner = `(select id from app_user where email = 'owner@example.com')`;
  sql(`insert into shift_schedule (business_id, employee_id, location_id, day, starts_at, ends_at, created_by)
       select '${B}', e.id, e.location_id, d::date,
              (d::date + s.st) at time zone 'Asia/Baghdad', (d::date + s.en) at time zone 'Asia/Baghdad', ${owner}
         from generate_series(date '2026-09-24', date '2026-10-25', interval '1 day') d
         join (values ('Avin', time '08:00', time '16:00', 0), ('Bana', time '08:00', time '16:00', 1),
                      ('Dara', time '16:00', time '23:30', 2), ('Karwan', time '16:00', time '23:30', 3),
                      ('Shno', time '07:00', time '15:00', 4)) s(name, st, en, off)
           on extract(dow from d) <> s.off
         join employee e on e.full_name = s.name
        where not (d::date = date '2026-10-23' and s.name = 'Karwan');
       insert into shift_schedule (business_id, employee_id, location_id, day, starts_at, ends_at, created_by)
       select '${B}', e.id, e.location_id, d::date,
              (d::date + time '12:00') at time zone 'Asia/Baghdad', (d::date + time '20:00') at time zone 'Asia/Baghdad', ${owner}
         from generate_series(date '2026-09-24', date '2026-10-25', interval '1 day') d
         join employee e on e.full_name = 'Lana'
        where extract(dow from d) in (5, 6) and d::date <> date '2026-10-23';
       insert into attendance (business_id, employee_id, location_id, clock_in, clock_out, work_day, source, recorded_by, out_recorded_by)
       select s.business_id, s.employee_id, s.location_id,
              s.starts_at + case when e.full_name = 'Avin' and s.day = date '2026-10-21' then interval '20 minutes'
                                 else ((abs(hashtext(s.id::text)) % 9) - 4) * interval '1 minute' end,
              case when e.full_name = 'Dara' and s.day = date '2026-10-21' then null
                   else s.ends_at + ((abs(hashtext(s.id::text || 'out')) % 11) - 2) * interval '1 minute' end,
              s.day, 'till', ${owner}, ${owner}
         from shift_schedule s join employee e on e.id = s.employee_id
        where s.day < date '2026-10-22' and not (e.full_name = 'Bana' and s.day = date '2026-10-21');`);
  return "select 1";
}

/** Two advances given, and October's payroll drafted (it takes Avin's advance back). */
function payrollSetup() {
  if (one(`select count(*) from payroll_run where month = '2026-10-01'`) !== "0") return "select 1";
  sql(`select test.act_as('owner@example.com');
       select record_advance((select id from employee where full_name = 'Avin'), 100000, 'safe', 'Doctor''s bill');
       select record_advance((select id from employee where full_name = 'Dara'), 50000, 'bank', 'Rent help');
       select draft_payroll('2026-10-01');`);
  return "select 1";
}

/** A vendor chosen on Vendors, on one of its tabs. */
async function vendor(page, name, tab) {
  await page.locator("button.vrow", { hasText: name }).click();
  await page.locator(".dtab", { hasText: tab }).first().click();
  await page.waitForTimeout(500);
}

/**
 * The dairy's credit notes: a return of cream after its bill (a credit that
 * waits for their note) and a crate deposit refunded (a credit with something
 * left to set against a bill).
 */
function creditsSetup() {
  if (one(`select count(*) from supplier_credit where reason = 'Crate deposit refunded'`) !== "0") return "select 1";
  const dairy = `(select id from supplier where name = 'Sulaymaniyah Dairy Co.')`;
  const cream = one(`select id from item where name = 'Cream'`);
  const billed = one(`select r.id from goods_receipt r join purchase_invoice b on b.goods_receipt_id = r.id
                       where r.supplier_id = ${dairy} order by r.received_at desc limit 1`);
  sql(`select test.act_as('manager@example.com');
       select return_to_supplier(${dairy}, '[{"item_id":"${cream}","qty":1,"unit_code":"L"}]'::jsonb,
                                 'A bottle was leaking', '${billed}', ${MAIN}, true);
       select test.act_as('owner@example.com');
       select record_supplier_credit(${dairy}, 'other', 1500, 'SD-CN-77', 'Crate deposit refunded',
                                     p_account_code => '6900');`);
  return "select 1";
}

/** Two prepaid expenses: the insurance with a month due now, and a sign paid ahead and cancelled. */
function prepaidSetup() {
  if (one(`select count(*) from prepaid_expense where description = 'Insurance, a year'`) !== "0") return "select 1";
  const next = one(`select (date_trunc('month', ${TODAY}) + interval '1 month')::date`);
  const ins = one(`select test.act_as('owner@example.com');
    select record_prepaid_expense('Insurance, a year', 1200000, '6900', 'bank', '${next}', 12) ->> 'prepaid_id'`);
  sql(`alter table prepaid_expense disable trigger prepaid_expense_guard;
       update prepaid_expense set first_month = date_trunc('month', ${TODAY})::date where description = 'Insurance, a year';
       alter table prepaid_expense enable trigger prepaid_expense_guard;`);
  const sign = one(`select test.act_as('owner@example.com');
    select record_prepaid_expense('Shop sign, six months', 300000, '6900', 'bank', '${next}', 6) ->> 'prepaid_id'`);
  sql(`select test.act_as('owner@example.com');
       select cancel_prepaid_expense(id, 'Paid twice by mistake') from prepaid_expense where description = 'Shop sign, six months';`);
  return "select 1";
}

/**
 * The buying the pictures show, made once: two draft orders (the beans left
 * two hours), and an order of milk and cream approved, sent and half received;
 * the cones offered cheaper by a second supplier; milk, cones and spoons under
 * their levels; a delivery corrected and one reversed.
 */
function buyingSetup() {
  if (one(`select count(*) from purchase_order where note = 'Milk and cream for the gelato'`) !== "0") return "select 1";
  const sup = (n) => `(select id from supplier where name = '${n}')`;
  const item = (n) => one(`select id from item where name = '${n}'`);
  const [beans, cup, lid, milk, cream, cone] = ["Coffee beans", "Takeaway cup", "Cup lid", "Milk", "Cream", "Cone"].map(item);
  const as = (who) => `select test.act_as('${who}@example.com');`;
  sql(`${as("manager")}
    select save_po(null, ${sup("Kurdistan Coffee Imports")},
      '[{"item_id":"${beans}","qty":5,"unit_code":"kg","unit_price":37000}]'::jsonb,
      ${TODAY} + 3, 'Beans for the weekend', ${MAIN});
    select save_po(null, ${sup("City Packaging Supplies")},
      '[{"item_id":"${cup}","qty":500,"unit_code":"each","unit_price":132},{"item_id":"${lid}","qty":500,"unit_code":"each","unit_price":50}]'::jsonb,
      ${TODAY} + 2, 'Cups and lids for takeaway', ${MAIN});
    select save_po(null, ${sup("Sulaymaniyah Dairy Co.")},
      '[{"item_id":"${milk}","qty":24,"unit_code":"L","unit_price":1400},{"item_id":"${cream}","qty":10,"unit_code":"L","unit_price":7000}]'::jsonb,
      ${TODAY}, 'Milk and cream for the gelato', ${MAIN});`);
  sql(`update purchase_order set updated_at = now() - interval '2 hours' where note = 'Beans for the weekend';`);
  const po = one(`select id from purchase_order where note = 'Milk and cream for the gelato'`);
  const line = (i) => one(`select id from purchase_order_line where purchase_order_id = '${po}' and item_id = '${i}'`);
  sql(`${as("manager")} select approve_po('${po}'); select send_po('${po}');`);
  sql(`${as("manager")}
    select receive_goods(${sup("Sulaymaniyah Dairy Co.")},
      '[{"item_id":"${milk}","qty":12,"unit_code":"L","unit_price":1400,"po_line_id":"${line(milk)}"},
        {"item_id":"${cream}","qty":10,"unit_code":"L","unit_price":7000,"po_line_id":"${line(cream)}"}]'::jsonb,
      p_note => 'Milk and cream for the gelato', p_purchase_order => '${po}');`);
  // Two small deliveries of cones: one corrected, one entered twice and reversed.
  for (const note of ["Delivery note 4471", "Delivery note 4471, again"])
    sql(`${as("manager")}
      select receive_goods(${sup("City Packaging Supplies")},
        '[{"item_id":"${cone}","qty":100,"unit_code":"each","unit_price":150}]'::jsonb, p_note => '${note}', p_location => ${MAIN});`);
  const r1 = one(`select id from goods_receipt where note = 'Delivery note 4471'`);
  const r2 = one(`select id from goods_receipt where note = 'Delivery note 4471, again'`);
  sql(`${as("manager")}
    select correct_receipt('${r1}', '[{"item_id":"${cone}","qty":96,"unit_code":"each","unit_price":150}]'::jsonb,
                           p_reason => 'Four cones short on the invoice', p_confirm => true);
    select reverse_receipt('${r2}', 'Entered twice', true);`);
  // A cheaper second supplier for the cones, and levels to buy to.
  sql(`${as("owner")}
    select set_item_supplier('${cone}', ${sup("Kurdistan Coffee Imports")}, 'each', 120, false);
    reset role;
    update item set min_level_base = 150000 where name = 'Milk';
    update item set min_level_base = 1500 where name = 'Takeaway cup';`);
  return "select 1";
}

/** Inventory's form, opened from its button unless it is open already. */
async function openForm(page, key, testid) {
  const form = page.getByTestId(testid);
  if ((await form.count()) === 0) await page.getByTestId(`inv-open-${key}`).click();
  await form.waitFor({ timeout: 10000 });
  return form;
}

/** On hand of an item at the Main Branch at a moment (an SQL expression). */
const onHandAt = (item, at = "now()") => `(select coalesce(sum(m.base_quantity_signed), 0) from inventory_movement m
   where m.item_id = (select id from item where name = '${item}') and m.location_id = ${MAIN} and m.created_at <= ${at})`;

/**
 * Two counts of the coffee beans, a week apart, with a week's sales between:
 * the first counted as the ledger stood then, the second 600 g short now.
 */
function usageCounts() {
  const ITEM = "Coffee beans";
  sql(`select test.act_as('counter@example.com');
       select cancel_stock_count(id, 'Started by mistake') from stock_count where status = 'counting';
       select test.act_as('manager@example.com');
       select reject_stock_count(id, 'Count it again') from stock_count where status = 'submitted'`);
  const cup = one(`select id from item where name = '${ITEM}'`);
  const done = Number(one(`select count(*) from stock_count c join stock_count_line l on l.stock_count_id = c.id
                            where c.status = 'approved' and l.item_id = '${cup}'`));
  if (done >= 2) return "select 1";
  const week = `(now() - interval '7 days')`;
  if (done === 0) {
    const first = one(`select test.act_as('counter@example.com');
      select start_stock_count(array['${cup}'::uuid])`);
    sql(`select test.act_as('counter@example.com');
         select record_count('${first}', '${cup}', ${one(`select ${onHandAt(ITEM)}`)}, 'g');
         select submit_stock_count('${first}');
         select test.act_as('manager@example.com'); select approve_stock_count('${first}');`);
  }
  const then = one(`select ${onHandAt(ITEM, week)}`);
  sql(`set session_replication_role = replica;
       update stock_count_line l set counted_at = ${week}, counted_base = ${then}, expected_at_count = ${then}
         from stock_count c where c.id = l.stock_count_id and c.status = 'approved' and l.item_id = '${cup}';
       update stock_count c set started_at = ${week}, submitted_at = ${week}, approved_at = ${week}
        where c.status = 'approved' and exists (select 1 from stock_count_line l where l.stock_count_id = c.id and l.item_id = '${cup}');`);
  const second = one(`select test.act_as('counter@example.com');
    select start_stock_count(array['${cup}'::uuid])`);
  const now = Number(one(`select ${onHandAt(ITEM)}`));
  sql(`select test.act_as('counter@example.com');
    select record_count('${second}', '${cup}', ${now - 600}, 'g');
    select submit_stock_count('${second}');
    select test.act_as('manager@example.com'); select approve_stock_count('${second}');`);
  return "select 1";
}

/** A count of three things handed in by the counter, a little off, for a manager to review. */
function submittedCount() {
  if (Number(one(`select count(*) from stock_count where status = 'submitted'`)) > 0) return "select 1";
  const names = ["Cone", "Napkin", "Straw"];
  const ids = names.map((n) => one(`select id from item where name = '${n}'`));
  const has = names.map((n) => Number(one(`select ${onHandAt(n)}`)));
  let c = one(`select id from stock_count where status = 'counting' limit 1`);
  if (!c)
    c = one(`select test.act_as('counter@example.com');
      select start_stock_count(array[${ids.map((i) => `'${i}'::uuid`).join(",")}])`);
  sql(`select test.act_as('counter@example.com');
    select record_count('${c}', '${ids[0]}', ${has[0] - 12}, 'each');
    select record_count('${c}', '${ids[1]}', ${has[1] + 30}, 'each');
    select record_count('${c}', '${ids[2]}', ${Math.max(0, has[2] - 55)}, 'each');
    select submit_stock_count('${c}');`);
  return "select 1";
}


/** Fill one line of a recipe editor (as tests/e2e/production.e2e.mjs does). */
async function line(page, n, item, qty, unit) {
  if (n > 1) await page.getByRole("button", { name: "+ Add ingredient" }).last().click();
  const box = page.getByLabel(`Ingredient ${n}`, { exact: true }).last();
  await box.fill(item);
  await page.locator(`[role="option"][data-name="${item}"]`).first().click();
  await page.getByLabel(`Quantity ${n}`).last().fill(qty);
  if (unit) await page.getByLabel(`Unit ${n}`).last().selectOption(unit);
}

// A small logo for the receipt: a gelato on a red circle, 96×96 PNG.
const LOGO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAABt0lEQVR4nO3TwU3DYBBE4dRCDVRDiRypJ0XkzAUugKLIimxs78zuvJH+u/d9yeXCGGOMMfa4j5fXr6Oe+pYWOzI4IBtWGR6InymjR2OoI8dCqKNGQ6hDxiKo40VDqINFI6hDxSKo40RDqINEI6hDRCOoAzg84hs8ANIA1Ac7vvHxP2/X1W8sgnt4B4gxAHvCKyGIPxGhc3gVBABTACbFb4kwLX4lQov4kwF2I0yN3+ZfAIAQYHp8ewQAhAAVH5UEsBkBAAAAAEAEUPVBaQCrEQAAAAAAAAAgAaH6VgAA8EFQ3AkAAB4IqhutAaoQlPcBAMDyu76/lT8AAPABqEZQ3QgAAADYAlQhKO8DoAPAZIQW8QEIBzgLQX0TAJ0ApiGob9kcHwADgCkI6hv+HR8AAADojqD+9t3xATAA6Iqg/ubD4gNgANANQf2th8d3QOgCcFp8NcBaBPU3ngqgRnAHOD2+GsEZoCy+M0JMfAAMANwQ4uIrEVwA1O3/pkaIjv+7JAB166erRiD8wiYCqJtuXuUvk/hPpo4XG/5+6pDR8e+njhob/nHqyLHhl0Z0kxHebARnjDE2ed+A2V2DUlIykAAAAABJRU5ErkJggg==",
  "base64",
);
