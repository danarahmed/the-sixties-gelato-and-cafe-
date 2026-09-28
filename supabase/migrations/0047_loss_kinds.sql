-- =============================================================================
-- 0047 — The kinds of loss that production and preparation add (release V)
--
-- What is lost in making a batch (a base spilt, a pan burnt) and in preparing
-- to sell (fruit trimmed, milk left in a jug) is its own kind of loss, with an
-- account of its own (5310, in 0048).
--
-- A value added to an enum cannot be used in the transaction that adds it
-- (docs/COMPLETION_PLAN.md, D14): the values are added here, alone, and 0048
-- uses them.
-- =============================================================================
alter type movement_type add value if not exists 'production_waste';
alter type movement_type add value if not exists 'preparation_waste';
