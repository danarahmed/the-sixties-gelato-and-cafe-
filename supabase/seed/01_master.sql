-- =============================================================================
-- 01_master.sql — DEMONSTRATION master data for The Sixty's Gelato & Café.
--
--   *** ALL PRICES AND COSTS BELOW ARE EXAMPLES, NOT REAL BUSINESS DATA. ***
--
-- Master data only (no transactions). Uses natural keys (sku/code/name) via
-- subqueries so it is readable and re-runnable after a truncate. Idempotent-ish:
-- run against a fresh database (supabase db reset) for a clean demo.
-- Currency: IQD (0 decimals). Timezone: Asia/Baghdad. Languages: en / ar / ckb.
-- =============================================================================

-- Single demo business with a fixed id so app config can point at it.
insert into business (id, name, currency_code, currency_symbol, currency_decimals, timezone, default_locale, prevent_negative_stock)
values ('00000000-0000-0000-0000-0000000000b1', 'The Sixty''s Gelato & Café (DEMO)', 'IQD', 'IQD', 0, 'Asia/Baghdad', 'en', false);

-- Locations: one branch + a central kitchen (multi-branch ready).
insert into location (business_id, kind, name, name_ar, name_ckb) values
  ('00000000-0000-0000-0000-0000000000b1', 'branch',          'Main Branch',      'الفرع الرئيسي', 'لقی سەرەکی'),
  ('00000000-0000-0000-0000-0000000000b1', 'central_kitchen', 'Central Kitchen',  'المطبخ المركزي', 'چێشتخانەی ناوەندی');

-- Demo users (auth_user_id is linked when real accounts are created in Supabase).
insert into app_user (business_id, full_name, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Owner',    'owner@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Manager',  'manager@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Cashier',  'cashier@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Counter',  'counter@example.com');

insert into user_role (app_user_id, role)
select id, 'owner'             from app_user where email = 'owner@example.com';
insert into user_role (app_user_id, role)
select id, 'branch_manager'    from app_user where email = 'manager@example.com';
insert into user_role (app_user_id, role)
select id, 'cashier'           from app_user where email = 'cashier@example.com';
insert into user_role (app_user_id, role)
select id, 'inventory_counter' from app_user where email = 'counter@example.com';

-- ---------------------------------------------------------------------------
-- Items (every consumable counted — straws, lids, spoons, napkins, seals...)
-- item_type: ingredient | packaging | consumable | finished_good | resale
-- ---------------------------------------------------------------------------
insert into item (business_id, sku, name, name_ar, name_ckb, item_type, base_unit_code, dimension, returnable_to_stock, track_expiry) values
  -- Ingredients
  ('00000000-0000-0000-0000-0000000000b1','COFFEE',          'Coffee beans',    'حبوب البن',      'دەنکی قاوە',        'ingredient','g','mass', false, false),
  ('00000000-0000-0000-0000-0000000000b1','MILK',            'Milk',            'حليب',           'شیر',               'ingredient','ml','volume', false, true),
  ('00000000-0000-0000-0000-0000000000b1','CREAM',           'Cream',           'قشطة',           'کرێم',              'ingredient','ml','volume', false, true),
  ('00000000-0000-0000-0000-0000000000b1','SUGAR',           'Sugar',           'سكر',            'شەکر',              'ingredient','g','mass', false, false),
  ('00000000-0000-0000-0000-0000000000b1','VSYRUP',          'Vanilla syrup',   'شراب الفانيلا',  'شەربەتی ڤانیلا',    'ingredient','ml','volume', false, false),
  ('00000000-0000-0000-0000-0000000000b1','PISTPASTE',       'Pistachio paste', 'معجون الفستق',   'مەعجوونی فستق',     'ingredient','g','mass', false, false),
  ('00000000-0000-0000-0000-0000000000b1','ICE',             'Ice',             'ثلج',            'سەهۆڵ',             'ingredient','g','mass', false, false),
  ('00000000-0000-0000-0000-0000000000b1','STRAWBCONC',      'Strawberry slushy concentrate','مركز سلاش الفراولة','کۆنسانتری سلاشی فڕاولە','ingredient','ml','volume', false, false),
  ('00000000-0000-0000-0000-0000000000b1','FLOUR',           'Flour',           'طحين',           'ئارد',              'ingredient','g','mass', false, false),
  ('00000000-0000-0000-0000-0000000000b1','BUTTER',          'Butter',          'زبدة',           'کەرە',              'ingredient','g','mass', false, true),
  -- Finished goods (produced in the kitchen)
  ('00000000-0000-0000-0000-0000000000b1','GEL_PIST',        'Pistachio gelato','جيلاتو الفستق',  'جیلاتۆی فستق',      'finished_good','g','mass', false, true),
  ('00000000-0000-0000-0000-0000000000b1','GEL_VAN',         'Vanilla gelato',  'جيلاتو الفانيلا','جیلاتۆی ڤانیلا',    'finished_good','g','mass', false, true),
  ('00000000-0000-0000-0000-0000000000b1','GEL_CHOC',        'Chocolate gelato','جيلاتو الشوكولاتة','جیلاتۆی شۆکولات',  'finished_good','g','mass', false, true),
  ('00000000-0000-0000-0000-0000000000b1','CROISSANT',       'Croissant',       'كرواسون',        'کرواسان',           'finished_good','each','count', false, true),
  -- Packaging & consumables (each counted individually)
  ('00000000-0000-0000-0000-0000000000b1','CUP_TA',          'Takeaway cup',    'كوب سفري',       'گڵاسی بردن',        'packaging','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','LID',             'Cup lid',         'غطاء الكوب',     'سەرپۆشی گڵاس',      'packaging','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','STRAW',           'Straw',           'شفاطة',          'لوولە',             'consumable','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','GEL_CUP',         'Gelato cup',      'كوب جيلاتو',     'گڵاسی جیلاتۆ',      'packaging','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','GEL_SPOON',       'Gelato spoon',    'ملعقة جيلاتو',   'کەفچکی جیلاتۆ',     'consumable','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','NAPKIN',          'Napkin',          'منديل',          'دەستەمۆ',           'consumable','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','CONE',            'Cone',            'بسكويت الآيس',   'قوونی بەفرینی',     'packaging','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','CONE_SLEEVE',     'Cone sleeve',     'غلاف البسكويت',  'بەرگی قوون',        'packaging','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','DBAG',            'Delivery bag',    'كيس التوصيل',    'کیسەی گەیاندن',     'packaging','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','STICKER',         'Sticker',         'ملصق',           'ستیکەر',            'consumable','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','TSEAL',           'Tamper seal',     'ختم الأمان',     'مۆری پاراستن',      'consumable','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','CARRIER',         'Drink carrier',   'حامل المشروبات', 'هەڵگری خواردنەوە',  'packaging','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','SLUSH_CUP',       'Slushy cup',      'كوب سلاش',       'گڵاسی سلاشی',       'packaging','each','count', false, false),
  ('00000000-0000-0000-0000-0000000000b1','BAKERY_BOX',      'Bakery box',      'علبة المخبوزات', 'سندووقی نانەوا',    'packaging','each','count', false, false),
  -- Resale (returnable to stock on refund)
  ('00000000-0000-0000-0000-0000000000b1','WATER',           'Bottled water',   'ماء معبأ',       'ئاوی بۆتڵ',         'resale','each','count', true, false);

-- Alternate purchase/consumption units (purchase in one, consume in another).
insert into item_unit (item_id, code, label, dimension, factor_to_base)
select id, 'kg', 'Kilogram', 'mass', 1000 from item where sku in ('COFFEE','SUGAR','FLOUR','BUTTER','PISTPASTE');
insert into item_unit (item_id, code, label, dimension, factor_to_base)
select id, 'L', 'Litre', 'volume', 1000 from item where sku in ('MILK','CREAM','VSYRUP','STRAWBCONC');
insert into item_unit (item_id, code, label, dimension, factor_to_base)
select id, 'case_12x1L', 'Case (12 × 1 L)', 'volume', 12000 from item where sku = 'MILK';
insert into item_unit (item_id, code, label, dimension, factor_to_base)
select id, 'bottle_700', 'Bottle (700 ml)', 'volume', 700 from item where sku = 'VSYRUP';
insert into item_unit (item_id, code, label, dimension, factor_to_base)
select id, 'carton_1000', 'Carton (1,000)', 'count', 1000 from item where sku in ('STRAW','LID','CUP_TA','GEL_SPOON','NAPKIN','TSEAL','STICKER');
insert into item_unit (item_id, code, label, dimension, factor_to_base)
select id, 'kg', 'Kilogram (finished)', 'mass', 1000 from item where sku in ('GEL_PIST','GEL_VAN','GEL_CHOC');

-- ---------------------------------------------------------------------------
-- Product catalog
-- ---------------------------------------------------------------------------
insert into product_category (business_id, name, name_ar, name_ckb, sort_order) values
  ('00000000-0000-0000-0000-0000000000b1','Coffee',   'قهوة',   'قاوە',     1),
  ('00000000-0000-0000-0000-0000000000b1','Gelato',   'جيلاتو', 'جیلاتۆ',   2),
  ('00000000-0000-0000-0000-0000000000b1','Slushy',   'سلاش',   'سلاشی',    3),
  ('00000000-0000-0000-0000-0000000000b1','Bakery',   'مخبوزات','نانەوا',   4),
  ('00000000-0000-0000-0000-0000000000b1','Other',    'أخرى',   'ئەوانیتر', 5);

-- helper: category id by name
-- Products
insert into product (business_id, category_id, name, name_ar, name_ckb, allergens, is_favourite)
select '00000000-0000-0000-0000-0000000000b1', c.id, v.name, v.name_ar, v.name_ckb, v.allergens, v.fav
from (values
  ('Coffee','Espresso',        'إسبريسو',       'ئێسپرێسۆ',       array[]::text[],              true),
  ('Coffee','Americano',       'أمريكانو',      'ئەمریکانۆ',      array[]::text[],              false),
  ('Coffee','Latte',           'لاتيه',         'لاتێ',           array['milk'],                true),
  ('Coffee','Iced Latte',      'لاتيه مثلج',    'لاتێی سارد',     array['milk'],                true),
  ('Coffee','Vanilla Latte',   'لاتيه فانيلا',  'لاتێی ڤانیلا',   array['milk'],                false),
  ('Gelato','Gelato Cup',      'كوب جيلاتو',    'گڵاسی جیلاتۆ',   array['milk','nuts'],         true),
  ('Gelato','Gelato Cone',     'كون جيلاتو',    'قوونی جیلاتۆ',   array['milk','nuts','gluten'],false),
  ('Slushy','Strawberry Slushy','سلاش فراولة',  'سلاشی فڕاولە',   array[]::text[],              false),
  ('Bakery','Croissant',       'كرواسون',       'کرواسان',        array['gluten','milk'],       false),
  ('Other','Bottled Water',    'ماء',           'ئاو',            array[]::text[],              false)
) as v(cat,name,name_ar,name_ckb,allergens,fav)
join product_category c on c.name = v.cat and c.business_id = '00000000-0000-0000-0000-0000000000b1';

-- Variants (the actually-priced sold unit).
insert into product_variant (product_id, name, name_ar, name_ckb, resale_item_id)
select p.id, v.vname, v.vname_ar, v.vname_ckb,
       case when v.resale_sku is null then null else (select id from item where sku = v.resale_sku) end
from (values
  ('Espresso',        'Single',            'مفرد',          'تاک',            null),
  ('Americano',       'Regular',           'عادي',          'ئاسایی',         null),
  ('Latte',           'Regular',           'عادي',          'ئاسایی',         null),
  ('Iced Latte',      'Medium',            'وسط',           'مامناوەند',      null),
  ('Vanilla Latte',   'Regular',           'عادي',          'ئاسایی',         null),
  ('Gelato Cup',      'Single / Pistachio','مفرد / فستق',   'تاک / فستق',     null),
  ('Gelato Cup',      'Single / Vanilla',  'مفرد / فانيلا', 'تاک / ڤانیلا',   null),
  ('Gelato Cup',      'Single / Chocolate','مفرد / شوكولاتة','تاک / شۆکولات', null),
  ('Gelato Cone',     'Single / Pistachio','مفرد / فستق',   'تاک / فستق',     null),
  ('Strawberry Slushy','Regular',          'عادي',          'ئاسایی',         null),
  ('Croissant',       'Plain',             'سادة',          'ساده',           null),
  ('Bottled Water',   '500 ml',            '500 مل',        '٥٠٠ مل',         'WATER')
) as v(pname,vname,vname_ar,vname_ckb,resale_sku)
join product p on p.name = v.pname and p.business_id = '00000000-0000-0000-0000-0000000000b1';

-- ---------------------------------------------------------------------------
-- Suppliers, delivery platforms, chart of accounts
-- ---------------------------------------------------------------------------
insert into supplier (business_id, name, contact, phone) values
  ('00000000-0000-0000-0000-0000000000b1','Sulaymaniyah Dairy Co.', 'Sales', '+964-770-000-0001'),
  ('00000000-0000-0000-0000-0000000000b1','Kurdistan Coffee Imports','Sales', '+964-770-000-0002'),
  ('00000000-0000-0000-0000-0000000000b1','City Packaging Supplies', 'Sales', '+964-770-000-0003');

insert into delivery_platform (business_id, code, name) values
  ('00000000-0000-0000-0000-0000000000b1','talabat','Talabat'),
  ('00000000-0000-0000-0000-0000000000b1','web','Direct Web');

insert into gl_account (business_id, code, name, account_type, normal_balance) values
  ('00000000-0000-0000-0000-0000000000b1','1000','Cash on hand',            'asset','debit'),
  ('00000000-0000-0000-0000-0000000000b1','1010','Card clearing',           'asset','debit'),
  ('00000000-0000-0000-0000-0000000000b1','1100','Platform receivable',     'asset','debit'),
  ('00000000-0000-0000-0000-0000000000b1','1200','Inventory',               'asset','debit'),
  ('00000000-0000-0000-0000-0000000000b1','2000','Accounts payable',        'liability','credit'),
  ('00000000-0000-0000-0000-0000000000b1','3000','Owner equity',            'equity','credit'),
  ('00000000-0000-0000-0000-0000000000b1','4000','Sales revenue',           'revenue','credit'),
  ('00000000-0000-0000-0000-0000000000b1','4100','Merchant-funded discount','revenue','debit'),
  ('00000000-0000-0000-0000-0000000000b1','5000','Cost of goods sold',      'expense','debit'),
  ('00000000-0000-0000-0000-0000000000b1','5100','Platform commission',     'expense','debit'),
  ('00000000-0000-0000-0000-0000000000b1','5200','Platform fees',           'expense','debit'),
  ('00000000-0000-0000-0000-0000000000b1','5300','Waste & spoilage',        'expense','debit'),
  ('00000000-0000-0000-0000-0000000000b1','6000','Rent',                    'expense','debit'),
  ('00000000-0000-0000-0000-0000000000b1','6100','Salaries',                'expense','debit'),
  ('00000000-0000-0000-0000-0000000000b1','6200','Utilities',               'expense','debit');
