-- =============================================================================
-- 02_recipes.sql — DEMO recipes (versioned) + variant links + channel prices.
--   *** EXAMPLE quantities and prices — not real business data. ***
--
-- Channel gating encodes the packaging rules:
--   disposables (cup/lid/straw) → takeaway + all delivery channels
--   delivery packaging (bag/napkin) → all delivery channels
--   platform-only (sticker/seal/carrier) → talabat/careem/toters
-- Dine-in deducts ingredients only (reusable glassware, no disposables).
-- =============================================================================

-- Convenience: business id + channel arrays as SQL locals via a temp settings row.
-- (Plain literals are used inline below to keep this runnable on any client.)

-- Create a recipe + version-1 and return nothing; lines added after.
-- We insert recipes by name, then versions, then lines, using subqueries.

-- ---- Recipe headers -------------------------------------------------------
insert into recipe (business_id, name, output_item_id, batch_yield_base, prep_instructions)
values
  ('00000000-0000-0000-0000-0000000000b1','Espresso Single',        null, null, 'Pull one double shot.'),
  ('00000000-0000-0000-0000-0000000000b1','Americano Regular',      null, null, 'Shot + hot water.'),
  ('00000000-0000-0000-0000-0000000000b1','Latte Regular',          null, null, 'Shot + steamed milk.'),
  ('00000000-0000-0000-0000-0000000000b1','Iced Latte Medium',      null, null, 'Shot + milk + syrup over ice.'),
  ('00000000-0000-0000-0000-0000000000b1','Vanilla Latte Regular',  null, null, 'Latte + vanilla syrup.'),
  ('00000000-0000-0000-0000-0000000000b1','Gelato Cup Pistachio',   null, null, 'One scoop pistachio in a cup.'),
  ('00000000-0000-0000-0000-0000000000b1','Gelato Cup Vanilla',     null, null, 'One scoop vanilla in a cup.'),
  ('00000000-0000-0000-0000-0000000000b1','Gelato Cup Chocolate',   null, null, 'One scoop chocolate in a cup.'),
  ('00000000-0000-0000-0000-0000000000b1','Gelato Cone Pistachio',  null, null, 'One scoop pistachio in a cone.'),
  ('00000000-0000-0000-0000-0000000000b1','Strawberry Slushy Regular', null, null, 'Concentrate + ice blended.'),
  ('00000000-0000-0000-0000-0000000000b1','Croissant Sale',         null, null, 'Serve one croissant.'),
  -- Production recipes (output finished goods)
  ('00000000-0000-0000-0000-0000000000b1','Pistachio Gelato Batch', (select id from item where sku='GEL_PIST'), 5000, 'Churn base with pistachio paste.'),
  ('00000000-0000-0000-0000-0000000000b1','Vanilla Gelato Batch',   (select id from item where sku='GEL_VAN'),  5000, 'Churn vanilla base.'),
  ('00000000-0000-0000-0000-0000000000b1','Chocolate Gelato Batch', (select id from item where sku='GEL_CHOC'), 5000, 'Churn chocolate base.'),
  ('00000000-0000-0000-0000-0000000000b1','Croissant Batch',        (select id from item where sku='CROISSANT'), 40, 'Bake a tray of croissants.');

-- ---- Version 1 for every recipe (effective from 2026-01-01) ---------------
insert into recipe_version (recipe_id, version_no, effective_from, note)
select id, 1, date '2026-01-01', 'Initial demo version'
from recipe where business_id = '00000000-0000-0000-0000-0000000000b1';

-- ---- Lines ----------------------------------------------------------------
-- Helper CTE-free approach: insert lines per recipe via subquery on version.
-- rv(name) returns the version id for a recipe name.

-- Espresso: coffee only; takeaway/delivery add cup+lid.
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from recipe_version rv
join recipe r on r.id = rv.recipe_id and r.name = 'Espresso Single'
cross join (values
  ('COFFEE', 18::numeric, 'g',   null::sales_channel[]),
  ('CUP_TA', 1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[]),
  ('LID',    1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[])
) as x(sku,qty,unit,ch);

-- Americano.
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from recipe_version rv
join recipe r on r.id = rv.recipe_id and r.name = 'Americano Regular'
cross join (values
  ('COFFEE', 18::numeric, 'g', null::sales_channel[]),
  ('CUP_TA', 1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[]),
  ('LID',    1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[])
) as x(sku,qty,unit,ch);

-- Latte.
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from recipe_version rv
join recipe r on r.id = rv.recipe_id and r.name = 'Latte Regular'
cross join (values
  ('COFFEE', 18::numeric, 'g', null::sales_channel[]),
  ('MILK', 200, 'ml', null::sales_channel[]),
  ('CUP_TA', 1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[]),
  ('LID',    1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[])
) as x(sku,qty,unit,ch);

-- Iced Latte Medium (the reference multi-channel recipe).
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from recipe_version rv
join recipe r on r.id = rv.recipe_id and r.name = 'Iced Latte Medium'
cross join (values
  ('COFFEE', 18::numeric, 'g',  null::sales_channel[]),
  ('MILK',   200, 'ml', null::sales_channel[]),
  ('VSYRUP', 30,  'ml', null::sales_channel[]),
  ('ICE',    150, 'g',  null::sales_channel[]),
  ('CUP_TA', 1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[]),
  ('LID',    1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[]),
  ('STRAW',  1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[]),
  ('DBAG',   1, 'each', array['direct_delivery','talabat']::sales_channel[]),
  ('NAPKIN', 2, 'each', array['direct_delivery','talabat']::sales_channel[]),
  ('STICKER',1, 'each', array['talabat']::sales_channel[]),
  ('TSEAL',  1, 'each', array['talabat']::sales_channel[]),
  ('CARRIER',1, 'each', array['talabat']::sales_channel[])
) as x(sku,qty,unit,ch);

-- Vanilla Latte.
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from recipe_version rv
join recipe r on r.id = rv.recipe_id and r.name = 'Vanilla Latte Regular'
cross join (values
  ('COFFEE', 18::numeric, 'g', null::sales_channel[]),
  ('MILK', 200, 'ml', null::sales_channel[]),
  ('VSYRUP', 20, 'ml', null::sales_channel[]),
  ('CUP_TA', 1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[]),
  ('LID',    1, 'each', array['takeaway','direct_delivery','talabat']::sales_channel[])
) as x(sku,qty,unit,ch);

-- Gelato cups (pistachio / vanilla / chocolate) — finished good + packaging.
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from (values
  ('Gelato Cup Pistachio','GEL_PIST', 90::numeric,'g',   null::sales_channel[]),
  ('Gelato Cup Pistachio','GEL_CUP',  1,'each', null::sales_channel[]),
  ('Gelato Cup Pistachio','GEL_SPOON',1,'each', null::sales_channel[]),
  ('Gelato Cup Pistachio','NAPKIN',   1,'each', null::sales_channel[]),
  ('Gelato Cup Pistachio','DBAG',     1,'each', array['direct_delivery','talabat']::sales_channel[]),
  ('Gelato Cup Vanilla','GEL_VAN',    90,'g',   null::sales_channel[]),
  ('Gelato Cup Vanilla','GEL_CUP',    1,'each', null::sales_channel[]),
  ('Gelato Cup Vanilla','GEL_SPOON',  1,'each', null::sales_channel[]),
  ('Gelato Cup Vanilla','NAPKIN',     1,'each', null::sales_channel[]),
  ('Gelato Cup Vanilla','DBAG',       1,'each', array['direct_delivery','talabat']::sales_channel[]),
  ('Gelato Cup Chocolate','GEL_CHOC', 90,'g',   null::sales_channel[]),
  ('Gelato Cup Chocolate','GEL_CUP',  1,'each', null::sales_channel[]),
  ('Gelato Cup Chocolate','GEL_SPOON',1,'each', null::sales_channel[]),
  ('Gelato Cup Chocolate','NAPKIN',   1,'each', null::sales_channel[]),
  ('Gelato Cup Chocolate','DBAG',     1,'each', array['direct_delivery','talabat']::sales_channel[])
) as x(rname,sku,qty,unit,ch)
join recipe r on r.business_id = '00000000-0000-0000-0000-0000000000b1' and r.name = x.rname
join recipe_version rv on rv.recipe_id = r.id and rv.version_no = 1;

-- Gelato cone pistachio.
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from recipe_version rv
join recipe r on r.id = rv.recipe_id and r.name = 'Gelato Cone Pistachio'
cross join (values
  ('GEL_PIST', 90::numeric,'g', null::sales_channel[]),
  ('CONE', 1,'each', null::sales_channel[]),
  ('CONE_SLEEVE', 1,'each', null::sales_channel[]),
  ('GEL_SPOON', 1,'each', null::sales_channel[]),
  ('NAPKIN', 1,'each', null::sales_channel[])
) as x(sku,qty,unit,ch);

-- Strawberry slushy.
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from recipe_version rv
join recipe r on r.id = rv.recipe_id and r.name = 'Strawberry Slushy Regular'
cross join (values
  ('STRAWBCONC', 60::numeric,'ml', null::sales_channel[]),
  ('ICE', 200,'g', null::sales_channel[]),
  ('SLUSH_CUP', 1,'each', null::sales_channel[]),
  ('LID', 1,'each', null::sales_channel[]),
  ('STRAW', 1,'each', null::sales_channel[])
) as x(sku,qty,unit,ch);

-- Croissant sale (finished good + delivery box).
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, x.ch
from recipe_version rv
join recipe r on r.id = rv.recipe_id and r.name = 'Croissant Sale'
cross join (values
  ('CROISSANT', 1::numeric,'each', null::sales_channel[]),
  ('NAPKIN', 1,'each', null::sales_channel[]),
  ('BAKERY_BOX', 1,'each', array['direct_delivery','talabat']::sales_channel[])
) as x(sku,qty,unit,ch);

-- Production recipe lines.
insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
select rv.id, 'item', (select id from item where sku=x.sku), x.qty, x.unit, null
from (values
  ('Pistachio Gelato Batch','MILK', 2500::numeric,'ml'),
  ('Pistachio Gelato Batch','CREAM',1500,'ml'),
  ('Pistachio Gelato Batch','SUGAR',800,'g'),
  ('Pistachio Gelato Batch','PISTPASTE',400,'g'),
  ('Vanilla Gelato Batch','MILK', 2800,'ml'),
  ('Vanilla Gelato Batch','CREAM',1500,'ml'),
  ('Vanilla Gelato Batch','SUGAR',700,'g'),
  ('Vanilla Gelato Batch','VSYRUP',100,'ml'),
  ('Chocolate Gelato Batch','MILK', 2700,'ml'),
  ('Chocolate Gelato Batch','CREAM',1500,'ml'),
  ('Chocolate Gelato Batch','SUGAR',800,'g'),
  ('Croissant Batch','FLOUR', 4000,'g'),
  ('Croissant Batch','BUTTER',2000,'g'),
  ('Croissant Batch','SUGAR', 400,'g'),
  ('Croissant Batch','MILK',  1000,'ml')
) as x(rname,sku,qty,unit)
join recipe r on r.business_id = '00000000-0000-0000-0000-0000000000b1' and r.name = x.rname
join recipe_version rv on rv.recipe_id = r.id and rv.version_no = 1;

-- ---- Link variants to their recipes --------------------------------------
insert into variant_recipe (product_variant_id, recipe_id)
select pv.id, r.id
from product_variant pv
join product p on p.id = pv.product_id
join (values
  ('Espresso','Single','Espresso Single'),
  ('Americano','Regular','Americano Regular'),
  ('Latte','Regular','Latte Regular'),
  ('Iced Latte','Medium','Iced Latte Medium'),
  ('Vanilla Latte','Regular','Vanilla Latte Regular'),
  ('Gelato Cup','Single / Pistachio','Gelato Cup Pistachio'),
  ('Gelato Cup','Single / Vanilla','Gelato Cup Vanilla'),
  ('Gelato Cup','Single / Chocolate','Gelato Cup Chocolate'),
  ('Gelato Cone','Single / Pistachio','Gelato Cone Pistachio'),
  ('Strawberry Slushy','Regular','Strawberry Slushy Regular'),
  ('Croissant','Plain','Croissant Sale')
) as m(pname,vname,rname) on p.name = m.pname and pv.name = m.vname
join recipe r on r.business_id = '00000000-0000-0000-0000-0000000000b1' and r.name = m.rname;

-- ---- Channel prices (store vs Talabat; Talabat priced higher) -------------
-- store price applies to dine_in + takeaway + direct_delivery; talabat separate.
insert into channel_price (business_id, product_variant_id, channel, price)
select '00000000-0000-0000-0000-0000000000b1', pv.id, ch.channel, ch.price
from product_variant pv
join product p on p.id = pv.product_id
join (values
  ('Espresso','Single', 2000, 2500),
  ('Americano','Regular', 2500, 3000),
  ('Latte','Regular', 3500, 4200),
  ('Iced Latte','Medium', 4000, 5000),
  ('Vanilla Latte','Regular', 4000, 5000),
  ('Gelato Cup','Single / Pistachio', 3500, 4500),
  ('Gelato Cup','Single / Vanilla', 3000, 4000),
  ('Gelato Cup','Single / Chocolate', 3000, 4000),
  ('Gelato Cone','Single / Pistachio', 3500, 4500),
  ('Strawberry Slushy','Regular', 3000, 3800),
  ('Croissant','Plain', 2000, 2800),
  ('Bottled Water','500 ml', 500, 1000)
) as pr(pname,vname,store_price,talabat_price) on p.name=pr.pname and pv.name=pr.vname
cross join lateral (values
  ('dine_in'::sales_channel, pr.store_price),
  ('takeaway'::sales_channel, pr.store_price),
  ('direct_delivery'::sales_channel, pr.store_price),
  ('talabat'::sales_channel, pr.talabat_price)
) as ch(channel, price);
