-- Entry point used by `supabase db reset` (see supabase/config.toml).
-- Loads demonstration master data and recipes: a business, its locations, the
-- four placeholder people, items, suppliers and a menu.
-- ALL PRICES AND COSTS ARE EXAMPLES, NOT REAL BUSINESS DATA.
--
-- There are deliberately no demonstration transactions. Every sale, receipt,
-- count and journal is posted by a database function that also writes its
-- journal, so the books only reconcile if activity goes through the app (or
-- those functions). Sign in and record some.
\ir seed/01_master.sql
\ir seed/02_recipes.sql
