// The guide's pictures of a screen in a particular state (a sheet open, a
// message shown, a form filled), named as the entries in docs/guide/src name
// them. Same shape as shot-list.mjs: { name, role, path, then(page), phone, sql }.
//
// Everything here runs on the copy of the simulated year (sixties_guide) only.
// Some pictures change records to reach their state (a sale rung up, a loss
// saved to wait…); they are written so that running them again still works.
import { sql } from "../../tests/e2e/lib.mjs";

const B = "00000000-0000-0000-0000-0000000000b1";
const TODAY = "(now() at time zone 'Asia/Baghdad')::date";
const MAIN = `(select id from location where name = 'Main Branch' limit 1)`;
const one = (q) => sql(q).split("\n").pop()?.trim();

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
const HELPER = (role, name) => person("barista2@example.com", "a0000000-0000-0000-0000-0000000000f1", name, role);
const PURCHASING = HELPER("purchasing", "Demo Buyer");
const AUDITOR = HELPER("auditor", "Demo Auditor");
const GM = HELPER("general_manager", "Demo General Manager");
// Everyone made at the start, so they show in lists the same way in every picture.
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
    sql: `select test.act_as('barista@example.com');
          select record_loss('spoilage', (select id from item where name = 'Milk'), null, 12, 'L',
                             'The fridge was left open overnight', p_wait => true)
           where not exists (select 1 from stock_loss where status = 'pending');`,
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
];

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
