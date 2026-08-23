# Deployment Guide

Two managed services: **Supabase** (database, auth, storage) and **Vercel**
(the app). Any Node host works for the app; any PostgreSQL 16 works for the DB.

## 1. Database (Supabase)

1. Create a project at https://supabase.com.
2. Install the Supabase CLI and link it:
   ```bash
   supabase link --project-ref <your-ref>
   ```
3. Apply the schema and (optionally) demo data:
   ```bash
   supabase db push          # applies supabase/migrations/*
   # To load demonstration data (replace with real data before go-live):
   psql "$DATABASE_URL" -f supabase/seed/01_master.sql
   psql "$DATABASE_URL" -f supabase/seed/02_recipes.sql
   psql "$DATABASE_URL" -f supabase/seed/03_transactions.sql
   ```
4. In **Auth → Providers**, enable Email; enable **MFA** for owner/manager.
5. Copy the Project URL, anon key, and service-role key.

## 2. App (Vercel)

1. Import this repository in Vercel (or `vercel` CLI).
2. Set environment variables from `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, business defaults, optional AI/Talabat keys).
3. Deploy. The build runs `next build`.

## 3. Post-deploy checks

- Open the site, install as a PWA, sign in.
- Confirm the online/offline indicator and that the service worker registered.
- Run `npm run verify` in CI on every change.

## Environments

- Use a separate Supabase project for staging vs production.
- Never commit real secrets. Rotate keys if exposed.
