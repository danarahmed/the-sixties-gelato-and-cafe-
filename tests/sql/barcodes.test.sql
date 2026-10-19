-- =============================================================================
-- Barcodes (0078, round twenty): a size's barcode, once in the café, read
-- by the till; set by those who edit the menu, on the audit trail.
-- =============================================================================
select test.golden_catalogue();
select test.act_as('owner@example.com');
select set_variant_barcode('d1000000-0000-0000-0000-000000000002', ' 6 2 6 1 1 2 3 4 5 6 7 8 9 ',
  '78000000-0000-0000-0000-000000000001');
select set_variant_barcode('d1000000-0000-0000-0000-000000000002', ' 6 2 6 1 1 2 3 4 5 6 7 8 9 ',
  '78000000-0000-0000-0000-000000000001');
select test.eq((select barcode from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000002'),
  '6261123456789', 'the water carries its barcode, spaces taken out, and the till reads it');
select test.eq((select barcode from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000001'),
  null::text, 'a size with none has none');
select test.throws($$select set_variant_barcode('d1000000-0000-0000-0000-000000000001', '6261123456789')$$,
  '%is on Golden water (Bottle) already%', 'a barcode is on one size only');
select test.throws($$select set_variant_barcode('d1000000-0000-0000-0000-000000000001', '12')$$,
  '%4 to 32 letters and digits%', 'too short to be a barcode');
select test.throws($$select set_variant_barcode('d1000000-0000-0000-0000-000000000001', 'ab/cd')$$,
  '%4 to 32 letters and digits%', 'letters, digits, a dot or a dash only');
select set_variant_barcode('d1000000-0000-0000-0000-000000000001', '10001');
select test.eq((select barcode from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000001'),
  '10001', 'a short code, for a scale''s labels');
select set_variant_barcode('d1000000-0000-0000-0000-000000000001', '');
select test.eq((select barcode from pos_catalogue() where variant_id = 'd1000000-0000-0000-0000-000000000001'),
  null::text, 'taken off again');
select test.act_as('cashier@example.com');
select test.throws($$select set_variant_barcode('d1000000-0000-0000-0000-000000000001', '10002')$$, null,
  'a cashier does not set one');
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'variant.barcode'), 3::bigint,
  'each change audited once');
