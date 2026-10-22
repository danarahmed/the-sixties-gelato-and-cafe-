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
    sql: `select test.act_as('owner@example.com');
          select set_business_rule('negative_stock', 'item', (select id::text from item where name = 'Pistachio paste'),
                                   '"approve"'::jsonb, 'Pistachio paste is dear: a manager says first');`,
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
           where lot_code = 'B1143' and item_id = (select id from item where name = 'Vanilla gelato')`,
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
];

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
