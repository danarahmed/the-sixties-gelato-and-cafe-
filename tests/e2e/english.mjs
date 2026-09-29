// The English words a screen shows that are not the café's own names (release
// G): what the languages suite looks for on every screen in Arabic and in
// Kurdish, and a suite looks for on its own screens once it has made records.
import { sql } from "./lib.mjs";

// What stays in Latin letters in every language: what the café typed itself
// (its products, items, suppliers, people, places, tables, platforms), codes,
// units and the currency.
const typed = () =>
  sql(`
  select string_agg(n, E'\\n') from (
    select name as n from product union select name from product_variant
    union select name from item union select name from supplier
    union select full_name from app_user union select email from app_user
    union select name from location union select name from dining_table
    union select name from product_category union select name from delivery_platform
    union select name from business union select code from item_unit union select label from item_unit
    union select coalesce(prep_instructions, '') from recipe union select coalesce(note, '') from recipe_version
    union select external_order_id from platform_order union select coalesce(settlement_reference, '') from platform_order
    union select coalesce(contact, '') from supplier union select unnest(allergens) from product
    union select coalesce(sku, '') from item
    union select description from journal_entry where description like '%(fixture)%'
    union select description from expense union select coalesce(memo, '') from journal_line
    union select regexp_replace(description, '^Correction: ', '') from journal_entry where reference_type = 'correction'
    union select coalesce(no_stock_reason, '') from product_variant
    union select coalesce(quality_note, '') from production_batch union select coalesce(cancel_reason, '') from production_batch
    union select coalesce(reason, '') from inventory_movement union select coalesce(reason, '') from sale_adjustment
    union select coalesce(note, '') from sales_order union select coalesce(discount_reason, '') from sales_order
    union select coalesce(cancel_reason, '') from pos_tab union select coalesce(label, '') from pos_tab
    union select coalesce(cancel_reason, '') from purchase_invoice union select coalesce(rejected_reason, '') from stock_count
    union select coalesce(note, '') from cash_transfer union select coalesce(note, '') from card_settlement
    union select coalesce(cancel_reason, '') from card_settlement union select coalesce(note, '') from platform_settlement
    union select coalesce(cancel_reason, '') from platform_settlement union select coalesce(ack_note, '') from alert
    union select coalesce(snooze_reason, '') from alert
    -- Names as they were before a change, on the audit trail.
    union select e.v from audit_log a, jsonb_each_text(
      case when jsonb_typeof(a.before_state) = 'object' then a.before_state else '{}' end
      || case when jsonb_typeof(a.after_state) = 'object' then a.after_state else '{}' end) e(k, v)
    union select name from recipe union select invoice_no from purchase_invoice
    union select coalesce(note, '') from goods_receipt union select description from journal_entry where reference_type = 'manual'
    union select coalesce(reason, '') from audit_log
    union select coalesce(note, '') from purchase_order union select coalesce(close_reason, '') from purchase_order
    union select coalesce(cancel_reason, '') from purchase_order union select reason from supplier_return
    union select reason from supplier_credit union select coalesce(supplier_ref, '') from supplier_credit
    -- Staff, their hours and their pay (0049): the names, jobs and reasons typed.
    union select full_name from employee union select coalesce(title, '') from employee
    union select coalesce(note, '') from shift_schedule
    union select coalesce(edit_reason, '') from attendance union select coalesce(cancel_reason, '') from attendance
    union select reason from employee_advance union select coalesce(cancel_reason, '') from employee_advance
    union select coalesce(additions_note, '') from payroll_line union select coalesce(deductions_note, '') from payroll_line
    union select coalesce(reopen_reason, '') from payroll_approval
    union select coalesce(cancel_reason, '') from salary_payment
    -- Customers and their points (0050): the names, notes, addresses and reasons typed.
    union select full_name from customer union select coalesce(notes, '') from customer
    union select coalesce(label, '') from customer_address union select address from customer_address
    union select coalesce(directions, '') from customer_address union select coalesce(reason, '') from loyalty_ledger
    union select coalesce(delivery_address, '') from sales_order union select coalesce(delivery_address, '') from pos_tab
  ) x where n is not null`);
const own = () =>
  new Set(
    typed()
      .split("\n")
      .flatMap((n) => n.match(/[A-Za-z][A-Za-z'’-]+/g) ?? [])
      .map((w) => w.toLowerCase()),
  );
const SAME = new Set(
  [
    "IQD",
    "CSV",
    "PIN",
    "SGC",
    "ml",
    "kg",
    "pcs",
    "each",
    "Talabat",
    "Lezzoo",
    "Careem",
    "Toters",
    // Language codes, as the Languages screen gives them for examples.
    "tr",
    "fa",
    "kmr",
    "ltr",
    "rtl",
    // A language's name is written in itself in the language menu; a platform's
    // names on the audit trail are kept under their language's code.
    "English",
    "ar",
    "ckb",
    // A file named in a sentence (docs/REMEDIATION.md).
    "docs",
    "REMEDIATION",
    "md",
    // The test fixtures' own records (an opening stock typed "fixture").
    "fixture",
  ].map((w) => w.toLowerCase()),
);
// On Delivery Platforms, the column names of a platform's own report, which
// the statement reader looks for as the platform writes them.
const SAME_ON = { "/platforms": ["order", "payout", "commission", "fees", "id"] };

/**
 * The English words a screen shows that are not the café's own names, nor the
 * words kept as they are on that screen (path).
 */
export async function english(page, path = "") {
  const OWN = own();
  const text = await page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === Node.TEXT_NODE) out.push(n.textContent);
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n;
      if (["SCRIPT", "STYLE", "CODE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) return;
      // Written in English on purpose: the Languages screen's English column,
      // and its table of phrases, whose boxes show the English until given words.
      if (el.getAttribute("lang") === "en") return;
      // Codes, marked as such (a permission's code).
      if (el.getAttribute("translate") === "no") return;
      if (el.tagName === "TABLE" && el.closest("#words")) return;
      if (el.hidden || getComputedStyle(el).display === "none") return;
      for (const attr of ["placeholder", "title", "aria-label"])
        if (el.getAttribute(attr)) out.push(el.getAttribute(attr));
      el.childNodes.forEach(walk);
    };
    walk(document.body);
    return out.join("\n");
  });
  // A word is English when it is all Latin letters: "Türkçe" or "Kaydet" is not
  // taken for it.
  const words = (text.match(/[\p{L}'’-]+/gu) ?? []).filter(
    (w) =>
      /^[A-Za-z]['’A-Za-z-]*[A-Za-z]$/.test(w) &&
      // Not a piece of an id ("3fa9c2e1…") nor initials or a code (GC, TLB).
      !/^[a-f]{1,8}$/.test(w) &&
      !/^[a-f](-[a-f])+$/.test(w) &&
      !/^[A-Z]{2,3}(-[A-Z])?$/.test(w),
  );
  return [
    ...new Set(
      words.filter(
        (w) =>
          !OWN.has(w.toLowerCase()) &&
          !SAME.has(w.toLowerCase()) &&
          !(SAME_ON[path] ?? []).includes(w.toLowerCase()),
      ),
    ),
  ];
}
