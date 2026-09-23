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
3. Point a staging copy of the app at it (its own Vercel Preview, never the
   live one), sign in as the owner and confirm:
   - **Reports → Do the books tie?** shows ✅ on every line, as it did before;
   - recent sales, bills and journals are present;
   - a locked month is still locked.

   A dump of the database carries the books and the people, but not their
   logins: those live in Supabase Auth. For a full project restore, use
   Supabase's own backups; people can also simply create their logins again.

4. Record the drill date and result. A backup you have never restored is not a
   backup.

## Data export (for an accountant)

- **CSV from the app:** the trial balance (Chart of Accounts), the P&L and the
  reconciliation (Reports), each for the dates chosen. Only people who may see
  costs can download them. PDF export is not built yet.
- Raw export any time:
  ```bash
  psql "$DATABASE_URL" -c "\copy (select * from sales_order) to 'sales.csv' csv header"
  ```

## Ownership

All schema, data, and code belong to the business. There is no vendor lock-in
beyond standard PostgreSQL; a `pg_dump` moves everything to any Postgres host.
