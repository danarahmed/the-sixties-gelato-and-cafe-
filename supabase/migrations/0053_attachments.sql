-- =============================================================================
-- 0053 — Documents kept with the records (release AA)
--
-- A delivery note, a supplier's bill, a credit note, a return slip or the
-- receipt for an expense lived on paper, apart from the record the books keep
-- of it (docs/COMPLETION_PLAN.md, B21 and D18). Now a photo or a PDF of it is
-- kept with the record:
--   * the files in a private Storage bucket, `documents`, each under the
--     café, the kind of record and the record: <business>/<kind>/<record>/…;
--     put there only by someone of the café who may keep that kind of record,
--     read only by someone of the café who may see it;
--   * document_attachment: which file goes with which record, its name, kind
--     and size, who attached it and when; taken off with a reason, never
--     changed or deleted;
--   * attach_document and detach_document (keyed, on the audit trail, which
--     names the record by its number), documents_for, document_counts and
--     document_record, what a record's page shows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The records that keep documents, and who keeps and sees them
-- ---------------------------------------------------------------------------
-- Whoever may record a kind of record attaches its documents; whoever sees
-- costs, or may attach them, sees them.
create or replace function document_permissions(p_kind text) returns text[]
language sql immutable set search_path = public as $$
  select case p_kind
    when 'goods_receipt' then array['purchase.receive']
    when 'supplier_return' then array['purchase.receive', 'purchase.create']
    when 'purchase_invoice' then array['purchase.create', 'accounting.post']
    when 'supplier_credit' then array['purchase.create', 'accounting.post']
    when 'expense' then array['expense.record']
  end
$$;

create or replace function document_may_attach(p_kind text) returns boolean
language sql stable set search_path = public as $$
  select coalesce((select bool_or(current_has_permission(p)) from unnest(document_permissions(p_kind)) p), false)
$$;

create or replace function document_may_see(p_kind text) returns boolean
language sql stable set search_path = public as $$
  select document_permissions(p_kind) is not null
         and (current_has_permission('cost.view') or document_may_attach(p_kind))
$$;

-- The record a document goes with, in the café.
create or replace function document_record_exists(p_business uuid, p_kind text, p_record uuid) returns boolean
language sql stable set search_path = public as $$
  select case p_kind
    when 'goods_receipt' then exists (select 1 from goods_receipt where id = p_record and business_id = p_business)
    when 'supplier_return' then exists (select 1 from supplier_return where id = p_record and business_id = p_business)
    when 'purchase_invoice' then exists (select 1 from purchase_invoice where id = p_record and business_id = p_business)
    when 'supplier_credit' then exists (select 1 from supplier_credit where id = p_record and business_id = p_business)
    when 'expense' then exists (select 1 from expense where id = p_record and business_id = p_business)
    else false
  end
$$;

-- The record's own number (an expense's, what it was for), by which the audit
-- trail names it.
create or replace function document_record_ref(p_business uuid, p_kind text, p_record uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(case p_kind
    when 'goods_receipt' then (select jsonb_build_object('receipt_no', receipt_no) from goods_receipt
                                where id = p_record and business_id = p_business)
    when 'supplier_return' then (select jsonb_build_object('return_no', return_no) from supplier_return
                                  where id = p_record and business_id = p_business)
    when 'purchase_invoice' then (select jsonb_build_object('invoice_no', invoice_no) from purchase_invoice
                                   where id = p_record and business_id = p_business)
    when 'supplier_credit' then (select jsonb_build_object('credit_no', credit_no) from supplier_credit
                                  where id = p_record and business_id = p_business)
    when 'expense' then (select jsonb_build_object('description', description) from expense
                          where id = p_record and business_id = p_business)
  end, '{}'::jsonb)
$$;

-- ---------------------------------------------------------------------------
-- 2. The bucket, and who may put and read files in it
-- ---------------------------------------------------------------------------
-- Pictures and PDFs, 10 MB at most, never public: a file is read through a
-- link that lasts a minute, made for someone who may see it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documents_put on storage.objects;
create policy documents_put on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and (storage.foldername(name))[1] = (select current_business_id())::text
              and document_may_attach((storage.foldername(name))[2]));

drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and (storage.foldername(name))[1] = (select current_business_id())::text
         and document_may_see((storage.foldername(name))[2]));

-- ---------------------------------------------------------------------------
-- 3. Which file goes with which record
-- ---------------------------------------------------------------------------
create table if not exists document_attachment (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references business(id),
  kind           text not null check (document_permissions(kind) is not null),
  record_id      uuid not null,
  storage_path   text not null unique,
  file_name      text not null check (length(trim(file_name)) between 1 and 200),
  content_type   text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes     bigint not null check (size_bytes between 1 and 10485760),
  note           text check (note is null or length(note) <= 500),
  attached_by    uuid not null references app_user(id),
  attached_at    timestamptz not null default now(),
  removed_at     timestamptz,
  removed_by     uuid references app_user(id),
  removed_reason text,
  check ((removed_at is null) = (removed_by is null) and (removed_at is null) = (removed_reason is null))
);
create index if not exists document_attachment_record on document_attachment (business_id, kind, record_id);

alter table document_attachment enable row level security;
alter table document_attachment force row level security;
drop policy if exists document_attachment_read on document_attachment;
create policy document_attachment_read on document_attachment for select to authenticated
  using (business_id = (select current_business_id()) and document_may_see(kind));
revoke all on document_attachment from anon, authenticated;
grant select on document_attachment to authenticated;

-- Kept as attached: only taken off, once, with a reason; never deleted.
create or replace function trg_document_attachment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A document is not deleted: take it off, saying why';
  end if;
  if old.removed_at is not null then
    raise exception 'This document was taken off already';
  end if;
  if (new.business_id, new.kind, new.record_id, new.storage_path, new.file_name, new.content_type, new.size_bytes,
      new.note, new.attached_by, new.attached_at)
     is distinct from (old.business_id, old.kind, old.record_id, old.storage_path, old.file_name, old.content_type,
                       old.size_bytes, old.note, old.attached_by, old.attached_at) then
    raise exception 'A document is not changed: take it off and attach it again';
  end if;
  return new;
end $$;
drop trigger if exists document_attachment_guard on document_attachment;
create trigger document_attachment_guard before update or delete on document_attachment
  for each row execute function trg_document_attachment_guard();

-- ---------------------------------------------------------------------------
-- 4. Attaching, taking off, and listing
-- ---------------------------------------------------------------------------
-- A file already put in the bucket, under the record, attached to it: its
-- kind and size as Storage keeps them.
create or replace function attach_document__run(p_kind text, p_record uuid, p_path text, p_file_name text,
                                                 p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid;
  v_me uuid := (current_member()).id;
  v_name text := nullif(trim(p_file_name), ''); v_note text := nullif(trim(p_note), '');
  v_type text; v_size bigint; v_id uuid;
begin
  if document_permissions(p_kind) is null then raise exception 'Choose what the document goes with'; end if;
  v_business := require_permission(variadic document_permissions(p_kind));
  if p_record is null or not document_record_exists(v_business, p_kind, p_record) then
    raise exception 'The record was not found';
  end if;
  if v_name is null then raise exception 'Give the document a name'; end if;
  if length(v_name) > 200 then raise exception 'A document''s name is at most 200 letters'; end if;
  if length(coalesce(v_note, '')) > 500 then raise exception 'A note is at most 500 letters'; end if;
  if p_path is null or not starts_with(p_path, v_business || '/' || p_kind || '/' || p_record || '/')
     or length(p_path) <= length(v_business || '/' || p_kind || '/' || p_record || '/') or position('..' in p_path) > 0 then
    raise exception 'The file is not kept with this record';
  end if;
  select coalesce(o.metadata ->> 'mimetype', ''), coalesce((o.metadata ->> 'size')::bigint, 0)
    into v_type, v_size
    from storage.objects o where o.bucket_id = 'documents' and o.name = p_path;
  if not found then raise exception 'Upload the file first'; end if;
  if v_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'A document is a picture (JPEG, PNG or WebP) or a PDF';
  end if;
  if v_size < 1 or v_size > 10485760 then raise exception 'A document is at most 10 MB'; end if;
  if exists (select 1 from document_attachment where storage_path = p_path) then
    raise exception 'That file is attached already';
  end if;
  if (select count(*) from document_attachment
       where business_id = v_business and kind = p_kind and record_id = p_record and removed_at is null) >= 20 then
    raise exception 'A record keeps at most 20 documents: take one off first';
  end if;
  insert into document_attachment (business_id, kind, record_id, storage_path, file_name, content_type, size_bytes,
                                   note, attached_by)
  values (v_business, p_kind, p_record, p_path, v_name, v_type, v_size, v_note, v_me)
  returning id into v_id;
  return jsonb_build_object('document_id', v_id, 'kind', p_kind, 'record_id', p_record, 'file_name', v_name,
                            'content_type', v_type, 'size', v_size);
end $$;

create or replace function attach_document(p_kind text, p_record uuid, p_path text, p_file_name text,
                                           p_note text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_kind', p_kind, 'p_record', p_record, 'p_path', p_path,
                                    'p_file_name', p_file_name, 'p_note', p_note);
  v jsonb; v_ref jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'attach_document', v_req);
  if v is not null then return v; end if;
  v := attach_document__run(p_kind => p_kind, p_record => p_record, p_path => p_path, p_file_name => p_file_name,
                            p_note => p_note);
  -- The record by its number, before and after; what changed is the document.
  v_ref := document_record_ref(v_business, p_kind, p_record);
  perform audit_event(v_business, 'document.attach', p_kind, p_record::text, null, nullif(v_ref, '{}'::jsonb),
                      v_ref || jsonb_build_object('document', v ->> 'file_name'));
  perform idem_finish(v_business, p_idempotency_key, 'attach_document', v_req, v);
  return v;
end $$;

-- Taken off with a reason: no longer listed with the record; the file stays.
create or replace function detach_document__run(p_document uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_me uuid := (current_member()).id;
  d document_attachment; v_reason text := nullif(trim(p_reason), '');
begin
  select * into d from document_attachment where id = p_document and business_id = v_business for update;
  if d.id is null then raise exception 'Document not found'; end if;
  perform require_permission(variadic document_permissions(d.kind));
  if v_reason is null then raise exception 'Say why the document is taken off'; end if;
  if d.removed_at is not null then raise exception 'This document was taken off already'; end if;
  update document_attachment set removed_at = now(), removed_by = v_me, removed_reason = v_reason
   where id = d.id;
  return jsonb_build_object('document_id', d.id, 'kind', d.kind, 'record_id', d.record_id, 'file_name', d.file_name);
end $$;

create or replace function detach_document(p_document uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_document', p_document, 'p_reason', p_reason);
  v jsonb; v_ref jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'detach_document', v_req);
  if v is not null then return v; end if;
  v := detach_document__run(p_document => p_document, p_reason => p_reason);
  v_ref := document_record_ref(v_business, v ->> 'kind', (v ->> 'record_id')::uuid);
  perform audit_event(v_business, 'document.detach', v ->> 'kind', v ->> 'record_id', nullif(trim(p_reason), ''),
                      v_ref || jsonb_build_object('document', v ->> 'file_name'), nullif(v_ref, '{}'::jsonb));
  perform idem_finish(v_business, p_idempotency_key, 'detach_document', v_req, v);
  return v;
end $$;

-- The documents kept with a record, the latest first, with who attached them.
create or replace function documents_for(p_kind text, p_record uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid;
begin
  if document_permissions(p_kind) is null then raise exception 'Choose what the document goes with'; end if;
  v_business := require_permission(variadic (document_permissions(p_kind) || array['cost.view']));
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'path', d.storage_path, 'file_name', d.file_name, 'content_type', d.content_type,
             'size', d.size_bytes, 'note', d.note, 'attached_at', d.attached_at,
             'attached_by', (select u.full_name from app_user u where u.id = d.attached_by))
           order by d.attached_at desc, d.id)
      from document_attachment d
     where d.business_id = v_business and d.kind = p_kind and d.record_id = p_record and d.removed_at is null),
    '[]'::jsonb);
end $$;

-- How many documents each of a list of records keeps: { record id: count }.
create or replace function document_counts(p_kind text, p_records uuid[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid;
begin
  if document_permissions(p_kind) is null then raise exception 'Choose what the document goes with'; end if;
  v_business := require_permission(variadic (document_permissions(p_kind) || array['cost.view']));
  return coalesce((
    select jsonb_object_agg(d.record_id, d.n)
      from (select record_id, count(*) as n from document_attachment
             where business_id = v_business and kind = p_kind and record_id = any (p_records) and removed_at is null
             group by record_id) d),
    '{}'::jsonb);
end $$;

-- What a record is, for the page its documents are kept on: its number, the
-- supplier, the day and the amount; its documents, and those taken off, with
-- why.
create or replace function document_record(p_kind text, p_record uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid; r jsonb;
begin
  if document_permissions(p_kind) is null then raise exception 'Choose what the document goes with'; end if;
  v_business := require_permission(variadic (document_permissions(p_kind) || array['cost.view']));
  r := case p_kind
    when 'goods_receipt' then (
      select jsonb_build_object('no', g.receipt_no, 'supplier', s.name,
                                'date', business_local_date(v_business, g.received_at), 'text', g.note)
        from goods_receipt g left join supplier s on s.id = g.supplier_id
       where g.id = p_record and g.business_id = v_business)
    when 'supplier_return' then (
      select jsonb_build_object('no', x.return_no, 'supplier', s.name,
                                'date', business_local_date(v_business, x.created_at), 'amount', x.value,
                                'text', x.reason)
        from supplier_return x left join supplier s on s.id = x.supplier_id
       where x.id = p_record and x.business_id = v_business)
    when 'purchase_invoice' then (
      select jsonb_build_object('no', i.invoice_no, 'supplier', s.name, 'date', i.invoice_date,
                                'amount', i.amount_total)
        from purchase_invoice i left join supplier s on s.id = i.supplier_id
       where i.id = p_record and i.business_id = v_business)
    when 'supplier_credit' then (
      select jsonb_build_object('no', c.credit_no, 'supplier', s.name, 'date', c.credit_date, 'amount', c.amount,
                                'text', coalesce(c.supplier_ref, c.reason))
        from supplier_credit c left join supplier s on s.id = c.supplier_id
       where c.id = p_record and c.business_id = v_business)
    when 'expense' then (
      select jsonb_build_object('date', e.incurred_on, 'amount', e.amount, 'text', e.description)
        from expense e where e.id = p_record and e.business_id = v_business)
  end;
  if r is null then raise exception 'The record was not found'; end if;
  return jsonb_strip_nulls(r) || jsonb_build_object(
    'kind', p_kind, 'record_id', p_record, 'may_attach', document_may_attach(p_kind),
    'documents', documents_for(p_kind, p_record),
    'removed', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'file_name', d.file_name, 'content_type', d.content_type, 'size', d.size_bytes,
               'note', d.note, 'attached_at', d.attached_at,
               'attached_by', (select u.full_name from app_user u where u.id = d.attached_by),
               'removed_at', d.removed_at, 'removed_reason', d.removed_reason,
               'removed_by', (select u.full_name from app_user u where u.id = d.removed_by))
             order by d.removed_at desc, d.id)
        from document_attachment d
       where d.business_id = v_business and d.kind = p_kind and d.record_id = p_record and d.removed_at is not null),
      '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 5. Who may call what
-- ---------------------------------------------------------------------------
-- The rules on the bucket and the table call the three helpers as the person.
revoke execute on function document_record_exists(uuid, text, uuid), document_record_ref(uuid, text, uuid),
  attach_document__run(text, uuid, text, text, text),
  detach_document__run(uuid, text), trg_document_attachment_guard() from public, anon, authenticated;
revoke execute on function document_permissions(text), document_may_attach(text), document_may_see(text)
  from public, anon;
grant execute on function document_permissions(text), document_may_attach(text), document_may_see(text)
  to authenticated;
revoke execute on function attach_document(text, uuid, text, text, text, uuid), detach_document(uuid, text, uuid),
  documents_for(text, uuid), document_counts(text, uuid[]), document_record(text, uuid) from public, anon;
grant execute on function attach_document(text, uuid, text, text, text, uuid), detach_document(uuid, text, uuid),
  documents_for(text, uuid), document_counts(text, uuid[]), document_record(text, uuid) to authenticated;
