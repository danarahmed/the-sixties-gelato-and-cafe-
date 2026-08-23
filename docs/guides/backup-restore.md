# Backup & Restore Guide

Your data is yours. This describes automated backups, a **tested** restore
procedure, and export for an external accountant.

## Automated backups

- Supabase provides automated daily backups (and point-in-time recovery on paid
  plans). Verify the schedule in your project's **Database → Backups**.
- Additionally, take your own logical backup on a schedule you control:
  ```bash
  pg_dump "$DATABASE_URL" --no-owner --format=custom -f backup-$(date +%F).dump
  ```
  Store copies off-site (encrypted).

## Restore procedure (test this quarterly)

1. Create a fresh empty database (a scratch Supabase project or local
   `supabase start`).
2. Restore:
   ```bash
   pg_restore --no-owner --clean --if-exists -d "$TARGET_DATABASE_URL" backup-YYYY-MM-DD.dump
   ```
3. Point a staging copy of the app at it and confirm:
   - `current_stock` totals look right for a few items.
   - Recent sales and platform orders are present.
   - Journal entries balance.
4. Record the drill date and result. A backup you have never restored is not a
   backup.

## Data export (for an accountant)

- P&L, sales, inventory valuation, and journals export to CSV/Excel/PDF from the
  Accounting/Reports screens (Phase 2).
- Raw export any time:
  ```bash
  psql "$DATABASE_URL" -c "\copy (select * from sales_order) to 'sales.csv' csv header"
  ```

## Ownership

All schema, data, and code belong to the business. There is no vendor lock-in
beyond standard PostgreSQL; a `pg_dump` moves everything to any Postgres host.
