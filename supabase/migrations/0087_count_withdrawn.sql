-- =============================================================================
-- 0087 — A count withdrawn by the person who counted it
-- =============================================================================
-- A submitted count was approved or rejected only by someone other than its
-- counter (0014). Rejecting posts nothing, and a café run by its owner alone
-- had no one else: a wrong count stayed waiting for ever (found on the live
-- site, 21 October). Whoever counted it, and may review counts, can now
-- withdraw it for a recount — Stock Count → Review → "Withdraw for a recount".
-- Approving one's own count, which posts the differences, is still refused.
--
-- Nothing recorded changes.
-- =============================================================================

-- 0014's guard: only approving is kept from the counter; with full
-- visibility, as every guard since.
create or replace function trg_stock_count_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.status in ('draft', 'counting') then return OLD; end if;
    raise exception 'A submitted stock count cannot be deleted' using errcode = 'check_violation';
  end if;
  if TG_OP = 'INSERT' then
    NEW.legacy := false;
    if NEW.status not in ('draft', 'counting') then
      raise exception 'A stock count starts open; it is submitted and approved separately' using errcode = 'check_violation';
    end if;
    return NEW;
  end if;
  if OLD.status in ('approved', 'rejected') then
    raise exception 'Stock count is % and cannot change', OLD.status using errcode = 'check_violation';
  end if;
  if OLD.status = 'submitted' then
    if (to_jsonb(NEW) - 'status' - 'approved_by' - 'approved_at' - 'rejected_reason')
         is distinct from (to_jsonb(OLD) - 'status' - 'approved_by' - 'approved_at' - 'rejected_reason')
       or NEW.status not in ('approved', 'rejected') then
      raise exception 'A submitted count may only be approved or rejected' using errcode = 'check_violation';
    end if;
    -- Approving posts the differences: never by the person who counted.
    -- Rejecting posts nothing: the counter may withdraw their own for a recount.
    if NEW.approved_by is null or (NEW.status = 'approved' and NEW.approved_by = OLD.counted_by) then
      raise exception 'A stock count must be approved by someone other than the person who counted it'
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end $$;
revoke execute on function trg_stock_count_guard() from public, anon, authenticated;
