-- =============================================================================
-- The café's own receipt, and each person's reports first (0091).
-- =============================================================================
select test.as_admin();
-- A 1×1 PNG, and the same bytes named as a JPEG.
\set PNG '''iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='''

-- ------------------------------------------------------------ the receipt
select test.act_as('cashier@example.com');
select test.eq(receipt_setup() ->> 'qr', 'none', 'none set: no QR code, and anyone of the café may read it');
select test.throws($$select set_receipt_setup('{"thanks_en":"Thanks"}')$$, '%settings.manage%',
  'a cashier sets nothing of it');
select test.act_as('owner@example.com');
select test.throws($$select set_receipt_setup('{"qr":"menu"}')$$, 'Give the menu''s link for the QR code to lead to',
  'a QR code to the menu needs its link');
select test.throws($$select set_receipt_setup('{"qr":"review","review_url":"http://x.example"}')$$,
  'A link starts with https:// and has no spaces', 'a link is https');
select test.throws($$select set_receipt_setup('{"qr":"elsewhere"}')$$,
  'The QR code leads to the menu, to the reviews, or nowhere', 'the QR leads to one of three');
select test.throws($$select set_receipt_setup(jsonb_build_object('footer', repeat('x', 201)))$$,
  'A line of the receipt is at most 200 letters', 'a footer of at most 200 letters');
select set_receipt_setup('{"name_ar":"الستينات","name_ckb":"شەستەکان","thanks_en":"  Thank you  ",
  "thanks_ar":"شكرًا","thanks_ckb":"سوپاس","instagram":"@thesixties","wifi_name":"Sixties","wifi_password":"gelato123",
  "qr":"review","menu_url":"https://example.com/menu","review_url":"https://g.page/r/sixties","footer":"Erbil",
  "tiktok":""}');
select test.eq((select string_agg(k || '=' || coalesce(receipt_setup() ->> k, '-'), ' ' order by k)
                  from unnest(array['instagram', 'qr', 'review_url', 'thanks_en', 'tiktok']) k),
  'instagram=thesixties qr=review review_url=https://g.page/r/sixties thanks_en=Thank you tiktok=-',
  'kept as given: trimmed, the @ left off, an empty line none');
select test.ok(exists (select 1 from audit_log where action = 'settings.receipt'), 'the audit log keeps the change');

-- The logo.
select test.throws($$select set_receipt_logo('image/gif', 'AAAA')$$, 'Use a PNG, JPEG or WebP picture', 'a picture only');
select test.throws($$select set_receipt_logo('image/jpeg', $$ || quote_literal(:PNG) || $$)$$,
  'That file is not a PNG, JPEG or WebP picture', 'named as it is');
select test.throws($$select set_receipt_logo('image/png', encode(repeat('x', 60001)::bytea, 'base64'))$$,
  'The logo must be smaller than 60 KB', 'small');
select set_receipt_logo('image/png', :PNG);
select test.ok(receipt_setup() ->> 'logo' like 'data:image/png;base64,iVBOR%',
  'read as a data address, so a till prints it with no connection');
select test.act_as('cashier@example.com');
select test.ok(receipt_setup() ->> 'logo' is not null, 'the cashier''s till prints it too');
select test.act_as('owner@example.com');
select clear_receipt_logo();
select test.ok(receipt_setup() ->> 'logo' is null, 'taken off again');

-- ------------------------------------------------------------ the reports each person opens
select test.act_as('cashier@example.com');
select note_report_visit('/reports/sales');
select test.throws($$select note_report_visit('/settings')$$, 'That is not one of the reports', 'reports only');
select test.act_as('owner@example.com');
select note_report_visit('/reports/waste');
select note_report_visit('/reports/sales');
select note_report_visit('/reports/waste');
select test.eq((select string_agg((x ->> 'path') || ':' || (x ->> 'visits'), ',' order by o)
                  from jsonb_array_elements(my_report_visits()) with ordinality e(x, o)),
  '/reports/waste:2,/reports/sales:1', 'each person''s own, the most opened first');
select test.act_as('cashier@example.com');
select test.eq(jsonb_array_length(my_report_visits()), 1, 'and no one else''s');
select test.eq((select count(*)::int from report_visit), 1, 'nor read from the table');
