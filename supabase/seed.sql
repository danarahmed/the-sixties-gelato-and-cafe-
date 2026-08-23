-- Entry point used by `supabase db reset` (see supabase/config.toml).
-- Loads demo master data, recipes, and example transactions in order.
-- ALL PRICES AND COSTS ARE EXAMPLES, NOT REAL BUSINESS DATA.
\ir seed/01_master.sql
\ir seed/02_recipes.sql
\ir seed/03_transactions.sql
