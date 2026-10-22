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
    path: "/settings#ways-to-pay",
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
    path: "/settings#receipt",
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
    path: "/settings#alerts",
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
    path: "/settings#people-list",
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
    path: "/production#plan",
    then: async (page) => {
      await toTop(page.getByTestId("plan"), 80);
    },
  },
  {
    name: "production-plan-all",
    role: "barista",
    path: "/production#plan",
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
    path: "/production#lots",
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
    path: "/inventory#losses-waiting",
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
    path: "/inventory#paste-items",
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
    path: (ids) => `/inventory/${ids.item()}?from=2026-09-01&to=2026-09-30`,
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
      const row = page.getByTestId("usage-row").filter({ hasText: "Takeaway cup" }).first();
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
           select cancel_stock_count(id, 'Started for the guide') from stock_count where status = 'counting'`);
    },
  },
  {
    name: "count-review",
    role: "manager",
    path: "/count",
    get sql() {
      return submittedCount();
    },
    then: async (page) => {
      const review = page.getByRole("button", { name: /Review/ }).first();
      if (await review.count()) await review.click();
      await page.waitForTimeout(800);
    },
  },
];

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
 * Two counts of the takeaway cups, a week apart, with a week's sales between:
 * the first counted as the ledger stood then, the second 40 cups short now.
 */
function usageCounts() {
  const cup = one(`select id from item where name = 'Takeaway cup'`);
  const done = Number(one(`select count(*) from stock_count c join stock_count_line l on l.stock_count_id = c.id
                            where c.status = 'approved' and l.item_id = '${cup}'`));
  if (done >= 2) return "select 1";
  const week = `(now() - interval '7 days')`;
  if (done === 0) {
    const first = one(`select test.act_as('counter@example.com');
      select start_stock_count(array['${cup}'::uuid])`);
    sql(`select test.act_as('counter@example.com');
         select record_count('${first}', '${cup}', ${one(`select ${onHandAt("Takeaway cup")}`)}, 'each');
         select submit_stock_count('${first}');
         select test.act_as('manager@example.com'); select approve_stock_count('${first}');`);
  }
  const then = one(`select ${onHandAt("Takeaway cup", week)}`);
  sql(`set session_replication_role = replica;
       update stock_count_line l set counted_at = ${week}, counted_base = ${then}, expected_at_count = ${then}
         from stock_count c where c.id = l.stock_count_id and c.status = 'approved' and l.item_id = '${cup}';
       update stock_count c set started_at = ${week}, submitted_at = ${week}, approved_at = ${week}
        where c.status = 'approved' and exists (select 1 from stock_count_line l where l.stock_count_id = c.id and l.item_id = '${cup}');`);
  const second = one(`select test.act_as('counter@example.com');
    select start_stock_count(array['${cup}'::uuid])`);
  const now = Number(one(`select ${onHandAt("Takeaway cup")}`));
  return `select test.act_as('counter@example.com');
    select record_count('${second}', '${cup}', ${now - 40}, 'each');
    select submit_stock_count('${second}');
    select test.act_as('manager@example.com'); select approve_stock_count('${second}');`;
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
  return `select test.act_as('counter@example.com');
    select record_count('${c}', '${ids[0]}', ${has[0] - 12}, 'each');
    select record_count('${c}', '${ids[1]}', ${has[1] + 30}, 'each');
    select record_count('${c}', '${ids[2]}', ${Math.max(0, has[2] - 55)}, 'each');
    select submit_stock_count('${c}');`;
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
