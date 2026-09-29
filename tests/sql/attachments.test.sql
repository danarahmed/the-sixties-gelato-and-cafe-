-- =============================================================================
-- Documents kept with the records (0053, release AA). A delivery of beans
-- (R), its bill (B) and an expense (E). A file is put in Storage's bucket
-- under <business>/<kind>/<record>/ by someone who may keep that kind of
-- record, then attached; listed and counted; refused in words when it is not
-- where it should be, not uploaded, not a picture or a PDF, too big, or
-- attached twice; seen by whoever sees costs; taken off with a reason, never
-- changed or deleted; on the audit trail; at most 20 to a record.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;
create function pg_temp.biz() returns text language sql as $$ select '00000000-0000-0000-0000-0000000000b1' $$;
-- A file put in the bucket as whoever acts: its row, as Storage writes it.
create function pg_temp.upload(p_path text, p_type text default 'image/jpeg', p_size bigint default 150000)
returns void language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('documents', p_path, auth.uid(), jsonb_build_object('size', p_size, 'mimetype', p_type))
$$;
create function pg_temp.path(p_kind text, p_record uuid, p_file text) returns text language sql as $$
  select pg_temp.biz() || '/' || p_kind || '/' || p_record || '/' || p_file
$$;
create function pg_temp.docs(p_kind text, p_record uuid) returns text language sql as $$
  select coalesce(string_agg((d ->> 'file_name') || ' (' || (d ->> 'content_type') || ', ' || (d ->> 'size') || ', '
                             || (d ->> 'attached_by') || ')', '; ' order by d ->> 'file_name'), 'none')
    from jsonb_array_elements(documents_for(p_kind, p_record)) d
$$;
-- An accountant, an auditor and a buyer, who sign in.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000e1', 'accountant@example.com'),
  ('a0000000-0000-0000-0000-0000000000e2', 'auditor@example.com'),
  ('a0000000-0000-0000-0000-0000000000e3', 'buyer@example.com');
insert into app_user (business_id, full_name, email, auth_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Accountant', 'accountant@example.com', 'a0000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Auditor', 'auditor@example.com', 'a0000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Buyer', 'buyer@example.com', 'a0000000-0000-0000-0000-0000000000e3');
insert into user_role (app_user_id, role) select id, 'accountant' from app_user where email = 'accountant@example.com';
insert into user_role (app_user_id, role) select id, 'auditor' from app_user where email = 'auditor@example.com';
insert into user_role (app_user_id, role) select id, 'purchasing' from app_user where email = 'buyer@example.com';

-- ------------------------------------------------------------------ the records
select test.act_as('owner@example.com');
insert into res select 'R', receive_goods((select id from supplier where name = 'Kurdistan Coffee Imports'),
  jsonb_build_array(jsonb_build_object('item_id', 'c0000000-0000-0000-0000-000000000001', 'qty', 2, 'unit_code', 'kg',
                                       'unit_price', 9000)),
  p_idempotency_key => gen_random_uuid());
insert into res select 'B', record_bill((select id from supplier where name = 'Kurdistan Coffee Imports'), 'KC-7',
  test.today(), 18000, 0, pg_temp.id('R', 'receipt_id'), null, gen_random_uuid());
insert into res select 'E', record_expense('Cleaning cloths', 1000, '6900', 'bank', null, gen_random_uuid());
select test.eq(pg_temp.r('E') ? 'expense_id' and pg_temp.r('B') ? 'bill_id' and pg_temp.r('R') ? 'receipt_id', true,
  'a delivery, its bill and an expense');

-- ------------------------------------------------------------------ a delivery note, attached
select test.act_as('manager@example.com');
select pg_temp.upload(pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'note-1.jpg'));
insert into res select 'D1', attach_document('goods_receipt', pg_temp.id('R', 'receipt_id'),
  pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'note-1.jpg'), ' Delivery note.jpg ',
  'signed by the driver', 'd0c00000-0000-0000-0000-000000000001');
select test.eq((attach_document('goods_receipt', pg_temp.id('R', 'receipt_id'),
                  pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'note-1.jpg'), ' Delivery note.jpg ',
                  'signed by the driver', 'd0c00000-0000-0000-0000-000000000001') ->> 'document_id')::uuid,
  pg_temp.id('D1', 'document_id'), 'sent twice, attached once');
select test.eq(pg_temp.docs('goods_receipt', pg_temp.id('R', 'receipt_id')),
  'Delivery note.jpg (image/jpeg, 150000, Demo Manager)', 'listed with the delivery: its name, kind, size and who');
select test.eq((document_counts('goods_receipt', array[pg_temp.id('R', 'receipt_id')]) ->> pg_temp.id('R', 'receipt_id')::text),
  '1', 'and counted');
select test.eq((select (d ->> 'no') || ' ' || (d ->> 'supplier') || ' ' || (d ->> 'date') || ' ' || (d ->> 'may_attach')
                       || ' ' || jsonb_array_length(d -> 'documents')
                  from (select document_record('goods_receipt', pg_temp.id('R', 'receipt_id')) as d) x),
  (select receipt_no from goods_receipt where id = pg_temp.id('R', 'receipt_id'))::text
  || ' Kurdistan Coffee Imports ' || test.today() || ' true 1', 'the delivery''s page: its number, supplier and day');

-- ------------------------------------------------------------------ refused, in words
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id'),
                          pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'never.jpg'), 'x.jpg'),
  'Upload the file first', 'a file never uploaded');
select pg_temp.upload(pg_temp.path('goods_receipt', gen_random_uuid(), 'elsewhere.jpg'));
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id'),
                          (select name from storage.objects where name like '%elsewhere.jpg'), 'x.jpg'),
  'The file is not kept with this record', 'a file kept under another record');
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id'),
                          pg_temp.biz() || '/goods_receipt/' || pg_temp.id('R', 'receipt_id') || '/../x.jpg', 'x.jpg'),
  'The file is not kept with this record', 'nor a path that climbs out');
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'stock_count', pg_temp.id('R', 'receipt_id'), 'x', 'x'),
  'Choose what the document goes with', 'a kind of record that keeps none');
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', gen_random_uuid(), 'x', 'x'),
  'The record was not found', 'a record that is not there');
select pg_temp.upload(pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'note-2.jpg'));
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id'),
                          pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'note-2.jpg'), '  '),
  'Give the document a name', 'a document has a name');
select pg_temp.upload(pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'notes.txt'), 'text/plain', 20);
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id'),
                          pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'notes.txt'), 'notes.txt'),
  'A document is a picture (JPEG, PNG or WebP) or a PDF', 'text is not a document');
select pg_temp.upload(pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'huge.pdf'), 'application/pdf',
                      11000000);
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id'),
                          pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'huge.pdf'), 'huge.pdf'),
  'A document is at most 10 MB', 'nor one over 10 MB');
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id'),
                          pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'note-1.jpg'), 'again.jpg'),
  'That file is attached already', 'the same file twice');
select test.throws(format('select pg_temp.upload(%L)', '00000000-0000-0000-0000-0000000000b2/goods_receipt/'
                          || pg_temp.id('R', 'receipt_id') || '/theirs.jpg'),
  '%row-level security%', 'nothing is put in another café''s folder');

-- ------------------------------------------------------------------ who may
select test.act_as('cashier@example.com');
select test.throws(format('select pg_temp.upload(%L)', pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'c.jpg')),
  '%row-level security%', 'the cashier puts no file in the bucket');
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id'),
                          pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'note-2.jpg'), 'x.jpg'),
  '%needs purchase.receive%', 'nor attaches one');
select test.throws(format('select documents_for(%L, %L)', 'goods_receipt', pg_temp.id('R', 'receipt_id')),
  '%needs purchase.receive or cost.view%', 'nor reads them');
select test.eq((select count(*) from storage.objects where bucket_id = 'documents')::int, 0,
  'and sees no file in the bucket');
select test.eq((select count(*) from document_attachment)::int, 0, 'nor which goes with what');

select test.act_as('accountant@example.com');
select pg_temp.upload(pg_temp.path('purchase_invoice', pg_temp.id('B', 'bill_id'), 'bill.pdf'), 'application/pdf', 80000);
insert into res select 'D2', attach_document('purchase_invoice', pg_temp.id('B', 'bill_id'),
  pg_temp.path('purchase_invoice', pg_temp.id('B', 'bill_id'), 'bill.pdf'), 'KC-7.pdf', null, gen_random_uuid());
select pg_temp.upload(pg_temp.path('expense', pg_temp.id('E', 'expense_id'), 'receipt.png'), 'image/png', 40000);
insert into res select 'D3', attach_document('expense', pg_temp.id('E', 'expense_id'),
  pg_temp.path('expense', pg_temp.id('E', 'expense_id'), 'receipt.png'), 'Receipt.png', null, gen_random_uuid());
select test.eq(pg_temp.docs('purchase_invoice', pg_temp.id('B', 'bill_id')) || ' | '
               || pg_temp.docs('expense', pg_temp.id('E', 'expense_id')),
  'KC-7.pdf (application/pdf, 80000, Demo Accountant) | Receipt.png (image/png, 40000, Demo Accountant)',
  'the accountant attaches the bill and the expense''s receipt');
select test.throws(format('select pg_temp.upload(%L)', pg_temp.path('goods_receipt', pg_temp.id('R', 'receipt_id'), 'a.jpg')),
  '%row-level security%', 'but puts nothing with a delivery, which is not theirs to receive');
select test.eq(pg_temp.docs('goods_receipt', pg_temp.id('R', 'receipt_id')),
  'Delivery note.jpg (image/jpeg, 150000, Demo Manager)', 'yet sees its note: the accountant sees costs');
select test.eq((select (d ->> 'no') || ' ' || (d ->> 'amount') || ' ' || (d ->> 'may_attach')
                  from (select document_record('purchase_invoice', pg_temp.id('B', 'bill_id')) as d) x),
  'KC-7 18000 true', 'the bill''s page');
select test.eq((document_record('goods_receipt', pg_temp.id('R', 'receipt_id')) ->> 'may_attach'), 'false',
  'and the delivery''s says the accountant may not add to it');

select test.act_as('auditor@example.com');
select test.eq((select count(*) from storage.objects where bucket_id = 'documents')::int >= 3, true,
  'the auditor reads the files');
select test.throws(format('select detach_document(%L, %L)', pg_temp.id('D2', 'document_id'), 'x'),
  '%needs purchase.create or accounting.post%', 'and takes none off');

-- ------------------------------------------------------------------ taken off, never changed or deleted
select test.act_as('manager@example.com');
select test.throws(format('select detach_document(%L, %L)', pg_temp.id('D1', 'document_id'), '  '),
  'Say why the document is taken off', 'with a reason');
insert into res select 'X1', detach_document(pg_temp.id('D1', 'document_id'), 'The wrong delivery''s note', gen_random_uuid());
select test.eq(pg_temp.docs('goods_receipt', pg_temp.id('R', 'receipt_id')), 'none', 'no longer listed');
select test.eq(document_counts('goods_receipt', array[pg_temp.id('R', 'receipt_id')]), '{}'::jsonb, 'nor counted');
select test.throws(format('select detach_document(%L, %L)', pg_temp.id('D1', 'document_id'), 'again'),
  'This document was taken off already', 'taken off once');
select test.as_admin();
select test.throws(format('update document_attachment set file_name = %L where id = %L', 'x', pg_temp.id('D2', 'document_id')),
  'A document is not changed: take it off and attach it again', 'a document is not changed');
select test.throws(format('delete from document_attachment where id = %L', pg_temp.id('D2', 'document_id')),
  'A document is not deleted: take it off, saying why', 'nor deleted');
select test.eq((select string_agg(action || ' ' || entity_type || coalesce(' (' || reason || ')', ''), '; ' order by id)
                  from audit_log where action like 'document.%'),
  'document.attach goods_receipt; document.attach purchase_invoice; document.attach expense; '
  || 'document.detach goods_receipt (The wrong delivery''s note)',
  'on the audit trail: each attached, and the one taken off with why');
select test.eq((select string_agg(coalesce(before_state::text, '-') || ' > ' || coalesce(after_state::text, '-'), '; '
                                  order by id)
                  from audit_log where action like 'document.%'),
  format('{"receipt_no": %s} > {"document": "Delivery note.jpg", "receipt_no": %s}; ',
         (select receipt_no from goods_receipt where id = pg_temp.id('R', 'receipt_id')),
         (select receipt_no from goods_receipt where id = pg_temp.id('R', 'receipt_id')))
  || '{"invoice_no": "KC-7"} > {"document": "KC-7.pdf", "invoice_no": "KC-7"}; '
  || '{"description": "Cleaning cloths"} > {"document": "Receipt.png", "description": "Cleaning cloths"}; '
  || format('{"document": "Delivery note.jpg", "receipt_no": %s} > {"receipt_no": %s}',
            (select receipt_no from goods_receipt where id = pg_temp.id('R', 'receipt_id')),
            (select receipt_no from goods_receipt where id = pg_temp.id('R', 'receipt_id'))),
  'each names its record by its number, or what it was for; what changed is the document');
select test.act_as('manager@example.com');
select test.eq((select string_agg((d ->> 'file_name') || ', ' || (d ->> 'removed_by') || ': ' || (d ->> 'removed_reason'),
                                  '; ')
                  from jsonb_array_elements(document_record('goods_receipt', pg_temp.id('R', 'receipt_id')) -> 'removed') d),
  'Delivery note.jpg, Demo Manager: The wrong delivery''s note',
  'the delivery''s page keeps the one taken off, who took it off and why');
select test.eq(jsonb_array_length(document_record('goods_receipt', pg_temp.id('R', 'receipt_id')) -> 'documents'), 0,
  'apart from those kept with it');

-- ------------------------------------------------------------------ at most 20 to a record
select test.act_as('accountant@example.com');
do $$
begin
  for i in 2 .. 20 loop
    perform pg_temp.upload(pg_temp.path('expense', pg_temp.id('E', 'expense_id'), 'page-' || i || '.jpg'));
    perform attach_document('expense', pg_temp.id('E', 'expense_id'),
                            pg_temp.path('expense', pg_temp.id('E', 'expense_id'), 'page-' || i || '.jpg'),
                            'Page ' || i || '.jpg');
  end loop;
end $$;
select pg_temp.upload(pg_temp.path('expense', pg_temp.id('E', 'expense_id'), 'page-21.jpg'));
select test.throws(format('select attach_document(%L, %L, %L, %L)', 'expense', pg_temp.id('E', 'expense_id'),
                          pg_temp.path('expense', pg_temp.id('E', 'expense_id'), 'page-21.jpg'), 'Page 21.jpg'),
  'A record keeps at most 20 documents: take one off first', 'twenty to a record');
