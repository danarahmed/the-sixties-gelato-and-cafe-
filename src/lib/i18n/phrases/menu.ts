import type { PhraseBook } from "./types";

/**
 * The menu: Products & Recipes, categories, recipe changes, Production and its batch recipes, and their forms and messages.
 */
const phrases: PhraseBook = {
  // Words the menu's screens share.
  Category: { ar: "الفئة", ckb: "پۆل" },
  Channel: { ar: "القناة", ckb: "کەناڵ" },
  Products: { ar: "المنتجات", ckb: "بەرهەمەکان" },
  Margin: { ar: "هامش الربح", ckb: "پەراوێزی قازانج" },
  Qty: { ar: "الكمية", ckb: "بڕ" },
  qty: { ar: "الكمية", ckb: "بڕ" },
  "Why?": { ar: "لماذا؟", ckb: "بۆچی؟" },
  "Keep it": { ar: "أبقِه", ckb: "بیهێڵەرەوە" },
  "Choose…": { ar: "اختر…", ckb: "هەڵبژێرە…" },
  "Change…": { ar: "تغيير…", ckb: "گۆڕین…" },
  "On the till": { ar: "على نقطة البيع", ckb: "لەسەر خاڵی فرۆشتن" },
  "Why it uses no stock": {
    ar: "لماذا لا يستخدم شيئًا من المخزون",
    ckb: "بۆچی هیچ لە کۆگا بەکارناهێنێت",
  },
  "A service charge": { ar: "رسم خدمة", ckb: "کرێی خزمەتگوزاری" },

  // Products & Recipes: a product's card.
  "Recipe in force": { ar: "الوصفة السارية", ckb: "ڕەسەتەی بەرکار" },
  "Recipe in force (version {version}, from {from})": {
    ar: "الوصفة السارية (الإصدار {version}، من {from})",
    ckb: "ڕەسەتەی بەرکار (وەشانی {version}، لە {from} ـەوە)",
  },
  "No recipe — sold as bought, or not yet set up.": {
    ar: "لا وصفة — يُباع كما اشتُري، أو لم يُجهَّز بعد.",
    ckb: "ڕەسەتەی نییە — وەک کڕدراوە دەفرۆشرێتەوە، یان هێشتا ڕێک نەخراوە.",
  },
  Component: { ar: "المكوّن", ckb: "پێکهاتە" },
  "Applies to": { ar: "يُطبَّق على", ckb: "بەکاردێت بۆ" },
  "all channels": { ar: "كل القنوات", ckb: "هەموو کەناڵەکان" },
  "Price & margin by channel": {
    ar: "السعر وهامش الربح حسب القناة",
    ckb: "نرخ و پەراوێزی قازانج بەپێی کەناڵ",
  },
  "No price yet: the till cannot sell it until it has one.": {
    ar: "لا سعر بعد: لا تستطيع نقطة البيع بيعه حتى يصبح له سعر.",
    ckb: "هێشتا نرخی نییە: خاڵی فرۆشتن ناتوانێت بیفرۆشێت تا نرخێکی نەبێت.",
  },
  "No category": { ar: "بلا فئة", ckb: "بێ پۆل" },
  "Recipe, prices and margin": {
    ar: "الوصفة والأسعار وهامش الربح",
    ckb: "ڕەسەتە، نرخەکان و پەراوێزی قازانج",
  },
  "Recipe, prices and margin · {n} sizes or flavours": {
    ar: "الوصفة والأسعار وهامش الربح · الأحجام أو النكهات: {n}",
    ckb: "ڕەسەتە، نرخەکان و پەراوێزی قازانج · {n} قەبارە یان تام",
  },
  "One recipe serves every channel; lines tagged to a channel deduct only there — that is how the cup and lid are used for takeaway and delivery but not at a table. Prices and recipes change from a date, so every sale uses the price and recipe in force on its own day. Costs shown are today's, worked out exactly as a sale posts them. A photo, a category and a ★ make a product quick to find on the till.":
    {
      ar: "وصفة واحدة تخدم كل القنوات؛ والسطور المخصّصة لقناة تُخصم فيها فقط — هكذا يُستخدم الكوب والغطاء للسفري والتوصيل لا على الطاولة. تتغيّر الأسعار والوصفات ابتداءً من تاريخ، فيستخدم كل بيع السعر والوصفة الساريين في يومه. الكلف المعروضة هي كلف اليوم، محسوبة تمامًا كما يسجّلها البيع. الصورة والفئة و★ تجعل المنتج سريع الإيجاد على نقطة البيع.",
      ckb: "یەک ڕەسەتە بۆ هەموو کەناڵەکانە؛ ئەو هێڵانەی بۆ کەناڵێک دیاری کراون تەنها لەوێ کەم دەکرێنەوە — بەم شێوەیە کوپ و قەپاغ بۆ بردن و گەیاندن بەکاردێن، بەڵام لەسەر مێز نا. نرخ و ڕەسەتەکان لە بەروارێکەوە دەگۆڕێن، بۆیە هەر فرۆشتنێک ئەو نرخ و ڕەسەتەیە بەکاردەهێنێت کە لە ڕۆژی خۆیدا بەرکار بووە. ئەو تێچووانەی پیشان دەدرێن هی ئەمڕۆن، ڕێک وەک ئەوەی فرۆشتنێک تۆماریان دەکات هەژمار کراون. وێنەیەک، پۆلێک و ★ وا دەکەن بەرهەمێک بە خێرایی لەسەر خاڵی فرۆشتن بدۆزرێتەوە.",
    },
  "No products yet": { ar: "لا منتجات بعد", ckb: "هێشتا هیچ بەرهەمێک نییە" },
  "Add the first one above.": {
    ar: "أضف أول منتج في الأعلى.",
    ckb: "یەکەم بەرهەم لە سەرەوە زیاد بکە.",
  },
  "category hidden from the till": {
    ar: "الفئة مخفية عن نقطة البيع",
    ckb: "پۆلەکە لە خاڵی فرۆشتن شاراوەیە",
  },
  "Hidden from the till": { ar: "مخفية عن نقطة البيع", ckb: "لە خاڵی فرۆشتن شاراوە" },
  "Not offered on the till. Their recipes, prices and sales history are kept; tick “On the till” to sell one again.":
    {
      ar: "لا تُعرض على نقطة البيع. تُحفظ وصفاتها وأسعارها وسجل مبيعاتها؛ ضع علامة على «على نقطة البيع» لبيع أحدها مجددًا.",
      ckb: "لەسەر خاڵی فرۆشتن پیشان نادرێن. ڕەسەتە و نرخ و مێژووی فرۆشتنیان دەپارێزرێت؛ نیشانەی «لەسەر خاڵی فرۆشتن» دابنێ بۆ ئەوەی یەکێکیان دیسان بفرۆشیتەوە.",
    },

  // A new menu product.
  "Recipe line {n}: choose the ingredient and its quantity, or remove the line.": {
    ar: "سطر الوصفة {n}: اختر المكوّن وكميته، أو أزل السطر.",
    ckb: "هێڵی ڕەسەتە {n}: پێکهاتەکە و بڕەکەی هەڵبژێرە، یان هێڵەکە لاببە.",
  },
  "List what one serving uses, or say why it uses no stock (a service charge, say).": {
    ar: "اذكر ما تستخدمه الحصة الواحدة، أو قل لماذا لا يستخدم المنتج شيئًا من المخزون (رسم خدمة مثلًا).",
    ckb: "بنووسە یەک بەش چی بەکاردەهێنێت، یان بڵێ بۆچی هیچ لە کۆگا بەکارناهێنێت (بۆ نموونە کرێی خزمەتگوزاری).",
  },
  "Created “{name}”.": { ar: "أُنشئ «{name}».", ckb: "«{name}» دروست کرا." },
  "Add a menu product": { ar: "أضف منتجًا إلى القائمة", ckb: "بەرهەمێک بۆ مێنیو زیاد بکە" },
  "First add stock items on Inventory, so the recipe has ingredients to use.": {
    ar: "أضف أولًا مواد المخزون من شاشة المخزون، ليكون للوصفة مكوّنات تستخدمها.",
    ckb: "سەرەتا کاڵاکانی کۆگا لە شاشەی کۆگا زیاد بکە، بۆ ئەوەی ڕەسەتەکە پێکهاتەی هەبێت بۆ بەکارهێنان.",
  },
  "▾ Hide product form": { ar: "▾ إخفاء نموذج المنتج", ckb: "▾ شاردنەوەی فۆڕمی بەرهەم" },
  "➕ Add menu product": {
    ar: "➕ إضافة منتج إلى القائمة",
    ckb: "➕ زیادکردنی بەرهەم بۆ مێنیو",
  },
  "Name and category": { ar: "الاسم والفئة", ckb: "ناو و پۆل" },
  "Product name (English)": { ar: "اسم المنتج (بالإنجليزية)", ckb: "ناوی بەرهەم (بە ئینگلیزی)" },
  "e.g. Iced Latte": { ar: "مثلًا: Iced Latte", ckb: "بۆ نموونە: Iced Latte" },
  "Category on the till": { ar: "الفئة على نقطة البيع", ckb: "پۆل لەسەر خاڵی فرۆشتن" },
  "Recipe: what goes into one serving": {
    ar: "الوصفة: ما يدخل في الحصة الواحدة",
    ckb: "ڕەسەتە: ئەوەی دەچێتە ناو یەک بەشەوە",
  },
  "Costs are today's, from what the stock cost. Cups, lids and bags are used for takeaway and delivery only.":
    {
      ar: "الكلف هي كلف اليوم، بحسب كلفة المخزون. الأكواب والأغطية والأكياس تُستخدم للسفري والتوصيل فقط.",
      ckb: "تێچووەکان هی ئەمڕۆن، بەپێی تێچووی کۆگا. کوپ و قەپاغ و کیسە تەنها بۆ بردن و گەیاندن بەکاردێن.",
    },
  "No ingredients? Then it sells at no cost: say why it uses no stock.": {
    ar: "لا مكوّنات؟ إذن يُباع بلا كلفة: قل لماذا لا يستخدم شيئًا من المخزون.",
    ckb: "پێکهاتەی نییە؟ کەواتە بێ تێچوو دەفرۆشرێت: بڵێ بۆچی هیچ لە کۆگا بەکارناهێنێت.",
  },
  "Prices (IQD)": { ar: "الأسعار (IQD)", ckb: "نرخەکان (IQD)" },
  "Leave a channel empty if the product is not sold there. Suggested prices leave a margin of <target></target>% and are rounded up to {step}. A delivery platform's commission is not in the cost.":
    {
      ar: "اترك القناة فارغة إن كان المنتج لا يُباع فيها. الأسعار المقترحة تترك هامش ربح <target></target>% وتُقرَّب صعودًا إلى أقرب {step}. عمولة منصة التوصيل غير محسوبة ضمن الكلفة.",
      ckb: "کەناڵێک بەتاڵ بهێڵەرەوە ئەگەر بەرهەمەکە لەوێ نافرۆشرێت. نرخە پێشنیارکراوەکان پەراوێزی قازانجی <target></target>% دەهێڵنەوە و بەرەو سەرەوە بۆ نزیکترین {step} خڕ دەکرێنەوە. کۆمیسیۆنی پلاتفۆرمی گەیاندن لە تێچووەکەدا نییە.",
    },
  "Target margin %": { ar: "هامش الربح المستهدف %", ckb: "پەراوێزی قازانجی ئامانج %" },
  "cost {amount}": { ar: "الكلفة {amount}", ckb: "تێچوو {amount}" },
  "{channel} price": { ar: "سعر {channel}", ckb: "نرخی {channel}" },
  "loss {amount}": { ar: "خسارة {amount}", ckb: "زیان {amount}" },
  "margin {amount}": { ar: "الهامش {amount}", ckb: "پەراوێزی قازانج {amount}" },
  "Use {amount}": { ar: "استخدم {amount}", ckb: "{amount} بەکاربهێنە" },
  "Create product": { ar: "إنشاء المنتج", ckb: "دروستکردنی بەرهەم" },

  // A price changed from a date.
  "Change a price…": { ar: "تغيير سعر…", ckb: "گۆڕینی نرخێک…" },
  "New price": { ar: "السعر الجديد", ckb: "نرخی نوێ" },
  "Set price": { ar: "تحديد السعر", ckb: "دانانی نرخ" },
  "Price changed from today.": {
    ar: "تغيّر السعر ابتداءً من اليوم.",
    ckb: "نرخەکە لە ئەمڕۆوە گۆڕا.",
  },
  "New price takes effect on {date}.": {
    ar: "يسري السعر الجديد في {date}.",
    ckb: "نرخە نوێیەکە لە {date} بەرکار دەبێت.",
  },

  // A recipe's lines, as they are typed.
  "Every order": { ar: "كل الطلبات", ckb: "هەموو داواکارییەکان" },
  "Takeaway & delivery": { ar: "السفري والتوصيل", ckb: "بردن و گەیاندن" },
  "Dine-in only": { ar: "تناول في المكان فقط", ckb: "تەنها لە شوێن" },
  "Some channels…": { ar: "بعض القنوات…", ckb: "هەندێک کەناڵ…" },
  "Used for": { ar: "الاستخدام", ckb: "بەکارهێنان" },
  "Ingredient {n}": { ar: "المكوّن {n}", ckb: "پێکهاتەی {n}" },
  "Quantity {n}": { ar: "الكمية {n}", ckb: "بڕی {n}" },
  "Unit {n}": { ar: "الوحدة {n}", ckb: "یەکەی {n}" },
  "Used for {n}": { ar: "الاستخدام {n}", ckb: "بەکارهێنانی {n}" },
  "Remove line {n}": { ar: "إزالة السطر {n}", ckb: "لابردنی هێڵی {n}" },
  "Choose an ingredient…": { ar: "اختر مكوّنًا…", ckb: "پێکهاتەیەک هەڵبژێرە…" },
  "no cost yet": { ar: "لا كلفة بعد", ckb: "هێشتا بێ تێچوو" },
  "{qty} IQD per {unit}": { ar: "{qty} IQD لكل {unit}", ckb: "{qty} IQD بۆ هەر {unit}" },
  "none ticked: used on every order": {
    ar: "لم يُحدَّد شيء: يُستخدم في كل الطلبات",
    ckb: "هیچ نیشانە نەکراوە: لە هەموو داواکارییەکاندا بەکاردێت",
  },
  "+ Add ingredient": { ar: "+ إضافة مكوّن", ckb: "+ زیادکردنی پێکهاتە" },
  "Choose the ingredients and their quantities to see what one serving costs.": {
    ar: "اختر المكوّنات وكمياتها لترى كلفة الحصة الواحدة.",
    ckb: "پێکهاتەکان و بڕەکانیان هەڵبژێرە بۆ ئەوەی تێچووی یەک بەش ببینیت.",
  },
  "Cost of one serving": { ar: "كلفة الحصة الواحدة", ckb: "تێچووی یەک بەش" },
  "No cost yet for {names}: never bought or made, so counted as 0 here. Receive it on Purchasing, make a batch on Production, or give an opening cost on Inventory, for a true cost.":
    {
      ar: "لا كلفة بعد لـ {names}: لم يُشترَ ولم يُصنع قط، لذا يُحسب هنا 0. استلمه من المشتريات، أو اصنع منه دفعة من الإنتاج، أو أعطه كلفة افتتاحية من المخزون، لتكون الكلفة حقيقية.",
      ckb: "هێشتا تێچوو نییە بۆ {names}: هەرگیز نەکڕدراوە و دروست نەکراوە، بۆیە لێرە بە 0 هەژمار دەکرێت. لە کڕین وەری بگرە، لە بەرهەمهێنان دەستەیەکی لێ دروست بکە، یان لە کۆگا تێچوویەکی سەرەتایی بۆ دابنێ، بۆ ئەوەی تێچووەکە ڕاست بێت.",
    },
  "No cost yet for {names}: never bought or made, so counted as 0 here. Receive them on Purchasing, make a batch on Production, or give an opening cost on Inventory, for a true cost.":
    {
      ar: "لا كلفة بعد لـ {names}: لم تُشترَ ولم تُصنع قط، لذا تُحسب هنا 0. استلمها من المشتريات، أو اصنع منها دفعة من الإنتاج، أو أعطها كلفة افتتاحية من المخزون، لتكون الكلفة حقيقية.",
      ckb: "هێشتا تێچوو نییە بۆ {names}: هەرگیز نەکڕدراون و دروست نەکراون، بۆیە لێرە بە 0 هەژمار دەکرێن. لە کڕین وەریان بگرە، لە بەرهەمهێنان دەستەیەکیان لێ دروست بکە، یان لە کۆگا تێچوویەکی سەرەتاییان بۆ دابنێ، بۆ ئەوەی تێچووەکە ڕاست بێت.",
    },

  // A product's recipe, changed from a date.
  "Line {n}: choose the ingredient and its quantity, or remove the line.": {
    ar: "السطر {n}: اختر المكوّن وكميته، أو أزل السطر.",
    ckb: "هێڵی {n}: پێکهاتەکە و بڕەکەی هەڵبژێرە، یان هێڵەکە لاببە.",
  },
  "The new recipe is in force from today.": {
    ar: "الوصفة الجديدة سارية من اليوم.",
    ckb: "ڕەسەتە نوێیەکە لە ئەمڕۆوە بەرکارە.",
  },
  "The new recipe starts on {date}.": {
    ar: "تبدأ الوصفة الجديدة في {date}.",
    ckb: "ڕەسەتە نوێیەکە لە {date} دەست پێدەکات.",
  },
  "Change the recipe…": { ar: "تغيير الوصفة…", ckb: "گۆڕینی ڕەسەتەکە…" },
  "The recipe in force today, to change. Costs are today's. Sales before the new recipe starts keep the old one.":
    {
      ar: "الوصفة السارية اليوم، لتغييرها. الكلف هي كلف اليوم. المبيعات التي تسبق بدء الوصفة الجديدة تبقى على القديمة.",
      ckb: "ڕەسەتەی بەرکاری ئەمڕۆ، بۆ گۆڕین. تێچووەکان هی ئەمڕۆن. ئەو فرۆشتنانەی پێش دەستپێکردنی ڕەسەتە نوێیەکە کراون ڕەسەتە کۆنەکەیان بۆ دەمێنێتەوە.",
    },
  "In force from": { ar: "سارية من", ckb: "بەرکار لە" },
  "Save the new recipe": { ar: "حفظ الوصفة الجديدة", ckb: "پاشەکەوتکردنی ڕەسەتە نوێیەکە" },

  // Prices and recipes set for a later date, and a product costed at nothing.
  Scheduled: { ar: "مجدول", ckb: "دانراو بۆ داهاتوو" },
  "{channel} at {price}": { ar: "{channel} بسعر {price}", ckb: "{channel} بە نرخی {price}" },
  "a new recipe (version {version})": {
    ar: "وصفة جديدة (الإصدار {version})",
    ckb: "ڕەسەتەیەکی نوێ (وەشانی {version})",
  },
  "From <b>{date}</b>: {what}": {
    ar: "من <b>{date}</b>: {what}",
    ckb: "لە <b>{date}</b> ـەوە: {what}",
  },
  "Withdraw…": { ar: "سحب…", ckb: "کشاندنەوە…" },
  "Why the change is withdrawn": {
    ar: "سبب سحب التغيير",
    ckb: "هۆی کشاندنەوەی گۆڕانکارییەکە",
  },
  "Withdrawing…": { ar: "جارٍ السحب…", ckb: "دەکشێندرێتەوە…" },
  "Withdraw it": { ar: "اسحبه", ckb: "بیکشێنەوە" },
  "Uses no stock: {reason}.": {
    ar: "لا يستخدم شيئًا من المخزون: {reason}.",
    ckb: "هیچ لە کۆگا بەکارناهێنێت: {reason}.",
  },
  "It does use stock": { ar: "بل يستخدم المخزون", ckb: "بەڵام کۆگا بەکاردەهێنێت" },
  "Costed at nothing": { ar: "محسوب بلا كلفة", ckb: "بە بێ تێچوو هەژمارکراوە" },
  "No recipe: nothing is taken from stock, and every sale shows full profit. Give it its recipe, or say why it uses no stock.":
    {
      ar: "لا وصفة: لا يُخصم شيء من المخزون، ويُظهر كل بيع ربحًا كاملًا. أعطه وصفته، أو قل لماذا لا يستخدم شيئًا من المخزون.",
      ckb: "ڕەسەتەی نییە: هیچ لە کۆگا کەم ناکرێتەوە، و هەموو فرۆشتنێک قازانجی تەواو پیشان دەدات. ڕەسەتەکەی بۆ دابنێ، یان بڵێ بۆچی هیچ لە کۆگا بەکارناهێنێت.",
    },
  "No cost yet for {items}: its share of each sale is costed at nothing until it is received, or given its opening stock on Inventory.":
    {
      ar: "لا كلفة بعد لـ {items}: تُحسب حصته من كل بيع بلا كلفة حتى يُستلم، أو يُعطى رصيده الافتتاحي من المخزون.",
      ckb: "هێشتا تێچوو نییە بۆ {items}: بەشی لە هەر فرۆشتنێک بە بێ تێچوو هەژمار دەکرێت تا وەردەگیرێت، یان لە کۆگا باڵانسی سەرەتای بۆ دادەنرێت.",
    },
  "Uses no stock": { ar: "لا يستخدم المخزون", ckb: "کۆگا بەکارناهێنێت" },

  // Categories on the till.
  "Saved “{name}”.": { ar: "حُفظ «{name}».", ckb: "«{name}» پاشەکەوت کرا." },
  "Categories on the till": { ar: "الفئات على نقطة البيع", ckb: "پۆلەکان لەسەر خاڵی فرۆشتن" },
  "The till shows its products in these groups, in this order. Untick “On the till” to hide a whole category (a seasonal menu, say); its products and their history stay as they are.":
    {
      ar: "تعرض نقطة البيع المنتجات في هذه المجموعات، بهذا الترتيب. أزل العلامة عن «على نقطة البيع» لإخفاء فئة كاملة (قائمة موسمية مثلًا)؛ وتبقى منتجاتها وسجلها كما هي.",
      ckb: "خاڵی فرۆشتن بەرهەمەکان لەم گرووپانەدا و بەم ڕیزبەندییە پیشان دەدات. نیشانەی «لەسەر خاڵی فرۆشتن» لاببە بۆ شاردنەوەی پۆلێکی تەواو (بۆ نموونە مێنیویەکی وەرزی)؛ بەرهەمەکانی و مێژووەکەیان وەک خۆیان دەمێننەوە.",
    },
  "{name} on the till": { ar: "{name} على نقطة البيع", ckb: "{name} لەسەر خاڵی فرۆشتن" },
  "New category, e.g. Hot drinks": {
    ar: "فئة جديدة، مثلًا: مشروبات ساخنة",
    ckb: "پۆلی نوێ، بۆ نموونە: خواردنەوەی گەرم",
  },

  // How a product appears on the till, and its photo.
  "Photo saved: the till shows it now.": {
    ar: "حُفظت الصورة: تعرضها نقطة البيع الآن.",
    ckb: "وێنەکە پاشەکەوت کرا: خاڵی فرۆشتن ئێستا پیشانی دەدات.",
  },
  "The picture could not be prepared.": { ar: "تعذّر تجهيز الصورة.", ckb: "وێنەکە ئامادە نەکرا." },
  "Photo removed.": { ar: "أُزيلت الصورة.", ckb: "وێنەکە لابرا." },
  "Change photo": { ar: "تغيير الصورة", ckb: "گۆڕینی وێنە" },
  "Add photo": { ar: "إضافة صورة", ckb: "زیادکردنی وێنە" },
  "Remove photo": { ar: "إزالة الصورة", ckb: "لابردنی وێنە" },
  "Photo of {name}": { ar: "صورة {name}", ckb: "وێنەی {name}" },
  "{name} (hidden)": { ar: "{name} (مخفية)", ckb: "{name} (شاراوە)" },
  "★ Favourite (shown first)": {
    ar: "★ مفضّل (يظهر أولًا)",
    ckb: "★ دڵخواز (لە پێشەوە پیشان دەدرێت)",
  },
  "That file is not a picture this browser can open.": {
    ar: "هذا الملف ليس صورة يستطيع هذا المتصفح فتحها.",
    ckb: "ئەو فایلە وێنەیەک نییە کە ئەم وێبگەڕە بتوانێت بیکاتەوە.",
  },
  "This browser cannot prepare the picture.": {
    ar: "لا يستطيع هذا المتصفح تجهيز الصورة.",
    ckb: "ئەم وێبگەڕە ناتوانێت وێنەکە ئامادە بکات.",
  },
  "The picture is still too large; try a smaller one.": {
    ar: "ما زالت الصورة كبيرة جدًا؛ جرّب صورة أصغر.",
    ckb: "وێنەکە هێشتا زۆر گەورەیە؛ وێنەیەکی بچووکتر تاقی بکەرەوە.",
  },

  // Production: what the café makes, and each batch.
  "What you make in batches: gelato, a base, syrup, dough. Recording a batch takes its ingredients out of stock and puts what came out in, valued at what the ingredients cost. Made items are then used like any other: in another batch (a base, then its flavours) or in a product's recipe on Products & Recipes (a cup of gelato).":
    {
      ar: "ما تصنعه على دفعات: جيلاتو، قاعدة، شراب، عجين. تسجيل الدفعة يُخرج مكوّناتها من المخزون ويُدخل ما نتج عنها، بقيمة كلفة المكوّنات. ثم تُستخدم المواد المصنوعة كغيرها: في دفعة أخرى (قاعدة، ثم نكهاتها) أو في وصفة منتج من المنتجات والوصفات (كوب جيلاتو).",
      ckb: "ئەوەی بە دەستە دروستی دەکەیت: جیلاتۆ، بنچینە، شەربەت، هەویر. تۆمارکردنی دەستەیەک پێکهاتەکانی لە کۆگا دەردەکات و ئەوەی لێی دەرچووە دەخاتە کۆگاوە، بە نرخی تێچووی پێکهاتەکان. پاشان کاڵا دروستکراوەکان وەک هەر کاڵایەکی تر بەکاردێن: لە دەستەیەکی تردا (بنچینەیەک، پاشان تامەکانی) یان لە ڕەسەتەی بەرهەمێکدا لە بەرهەم و ڕەسەتەکان (کوپێک جیلاتۆ).",
    },
  "one batch makes <qty>{qty}</qty>": {
    ar: "الدفعة الواحدة تُنتج <qty>{qty}</qty>",
    ckb: "یەک دەستە <qty>{qty}</qty> بەرهەم دەهێنێت",
  },
  "one batch makes <qty>{qty}</qty> of {output}": {
    ar: "الدفعة الواحدة تُنتج <qty>{qty}</qty> من {output}",
    ckb: "یەک دەستە <qty>{qty}</qty> {output} بەرهەم دەهێنێت",
  },
  "costs <b>{amount}</b>": { ar: "كلفتها <b>{amount}</b>", ckb: "تێچووەکەی <b>{amount}</b>" },
  "{1} IQD per {2}": { ar: "{1} IQD لكل {2}", ckb: "{1} IQD بۆ هەر {2}" },
  "No cost yet for {names}: never bought or made": {
    ar: "لا كلفة بعد لـ {names}: لم يُشترَ ولم يُصنع قط",
    ckb: "هێشتا تێچوو نییە بۆ {names}: هەرگیز نەکڕدراوە و دروست نەکراوە",
  },
  "Record a batch": { ar: "تسجيل دفعة", ckb: "تۆمارکردنی دەستەیەک" },
  "What you make": { ar: "ما تصنعه", ckb: "ئەوەی دروستی دەکەیت" },
  "➕ Add something you make": {
    ar: "➕ إضافة شيء تصنعه",
    ckb: "➕ زیادکردنی شتێک کە دروستی دەکەیت",
  },
  "Nothing set up yet": { ar: "لم يُجهَّز شيء بعد", ckb: "هێشتا هیچ ڕێک نەخراوە" },
  "Add what you make above: its name, how much a batch makes, and what goes in.": {
    ar: "أضف ما تصنعه في الأعلى: اسمه، وكم تُنتج الدفعة، وما يدخل فيها.",
    ckb: "ئەوەی دروستی دەکەیت لە سەرەوە زیاد بکە: ناوەکەی، دەستەیەک چەندی لێ دەردەچێت، و چی دەچێتە ناوی.",
  },
  "A manager who edits recipes adds what you make.": {
    ar: "المدير الذي يعدّل الوصفات هو من يضيف ما تصنعه.",
    ckb: "بەڕێوەبەرێک کە ڕەسەتەکان دەستکاری دەکات ئەوەی دروستی دەکەیت زیاد دەکات.",
  },
  "Not made any more ({n})": { ar: "لم يعد يُصنع ({n})", ckb: "ئیتر دروست ناکرێت ({n})" },
  Batches: { ar: "الدفعات", ckb: "دەستەکان" },
  "No batches yet": { ar: "لا دفعات بعد", ckb: "هێشتا هیچ دەستەیەک نییە" },
  "Every batch recorded is listed here.": {
    ar: "كل دفعة تُسجَّل تظهر هنا.",
    ckb: "هەر دەستەیەک تۆمار بکرێت لێرە پیشان دەدرێت.",
  },
  Made: { ar: "صُنع", ckb: "دروستکرا" },
  What: { ar: "ماذا", ckb: "چی" },
  "Came out": { ar: "الناتج", ckb: "دەرچوو" },
  cancelled: { ar: "ملغى", ckb: "هەڵوەشێنراوە" },
  "{qty} on the recipe": { ar: "{qty} عن الوصفة", ckb: "{qty} بەراورد بە ڕەسەتەکە" },
  "{name} batch": { ar: "دفعة {name}", ckb: "دەستەی {name}" },

  // What the café makes: its batch recipe.
  "Weighed (g, kg)": { ar: "بالوزن (g, kg)", ckb: "بە کێش (g, kg)" },
  "Measured (ml, L)": { ar: "بالحجم (ml, L)", ckb: "بە قەبارە (ml, L)" },
  "Counted in pieces": { ar: "يُعدّ بالقطعة", ckb: "بە دانە دەژمێردرێت" },
  pieces: { ar: "قطعة", ckb: "دانە" },
  "Added “{name}”.": { ar: "أُضيف «{name}».", ckb: "«{name}» زیاد کرا." },
  "What it makes": { ar: "ما تُنتجه", ckb: "ئەوەی بەرهەمی دەهێنێت" },
  "Name of what it makes": { ar: "اسم ما تُنتجه", ckb: "ناوی ئەوەی بەرهەمی دەهێنێت" },
  "e.g. Pistachio gelato, White base, Croissants": {
    ar: "مثلًا: جيلاتو فستق، قاعدة بيضاء، كرواسون",
    ckb: "بۆ نموونە: جیلاتۆی فستق، بنچینەی سپی، کرواسان",
  },
  "It is": { ar: "إنه", ckb: "ئەمە" },
  "New or kept item": { ar: "مادة جديدة أم محفوظة", ckb: "کاڵای نوێ یان هەبوو" },
  "Something new to keep in stock": {
    ar: "شيء جديد يُحفظ في المخزون",
    ckb: "شتێکی نوێ بۆ هەڵگرتن لە کۆگادا",
  },
  "An item already kept": { ar: "مادة محفوظة أصلًا", ckb: "کاڵایەک کە پێشتر لە کۆگادا هەیە" },
  "Item it makes": { ar: "المادة التي تُنتجها", ckb: "ئەو کاڵایەی بەرهەمی دەهێنێت" },
  "How it is counted": { ar: "كيف يُحسب", ckb: "چۆن دەژمێردرێت" },
  "Kept in a container? (optional)": {
    ar: "يُحفظ في وعاء؟ (اختياري)",
    ckb: "لە قاپێکدا هەڵدەگیرێت؟ (ئارەزوومەندانە)",
  },
  Container: { ar: "الوعاء", ckb: "قاپ" },
  "pan, tray, tub": { ar: "صينية، قالب، علبة", ckb: "سینی، قاپ، قوتوو" },
  holds: { ar: "يسع", ckb: "دەگرێت" },
  "What a container holds": { ar: "ما يسعه الوعاء", ckb: "ئەوەی قاپێک دەیگرێت" },
  "Unit a container holds": { ar: "وحدة ما يسعه الوعاء", ckb: "یەکەی ئەوەی قاپێک دەیگرێت" },
  "One batch makes": { ar: "الدفعة الواحدة تُنتج", ckb: "یەک دەستە بەرهەم دەهێنێت" },
  "Unit one batch makes": {
    ar: "وحدة ما تُنتجه الدفعة الواحدة",
    ckb: "یەکەی ئەوەی یەک دەستە بەرهەمی دەهێنێت",
  },
  "— about right is fine: each batch records what really came out, if you weigh or count it.": {
    ar: "— التقريب يكفي: كل دفعة تسجّل ما نتج فعلًا، إن وزنته أو عددته.",
    ckb: "— نزیکەیی بەسە: هەر دەستەیەک ئەوەی بەڕاستی لێی دەرچووە تۆمار دەکات، ئەگەر بیکێشیت یان بیژمێریت.",
  },
  "What goes into one batch": {
    ar: "ما يدخل في الدفعة الواحدة",
    ckb: "ئەوەی دەچێتە ناو یەک دەستەوە",
  },
  "Anything kept in stock, bought or made here: a base made first, then flavoured, works the same as milk and sugar.":
    {
      ar: "أي شيء محفوظ في المخزون، مشترى أو مصنوع هنا: القاعدة التي تُصنع أولًا ثم تُنكَّه تُعامل مثل الحليب والسكر.",
      ckb: "هەر شتێک لە کۆگادا هەبێت، کڕدراو بێت یان لێرە دروستکرابێت: بنچینەیەک کە سەرەتا دروست دەکرێت و پاشان تامی پێ دەدرێت، وەک شیر و شەکر کار دەکات.",
    },
  "One batch costs": { ar: "كلفة الدفعة الواحدة", ckb: "تێچووی یەک دەستە" },
  "How to make it (optional)": {
    ar: "طريقة التحضير (اختياري)",
    ckb: "چۆنیەتی دروستکردن (ئارەزوومەندانە)",
  },
  "How to make it": { ar: "طريقة التحضير", ckb: "چۆنیەتی دروستکردن" },
  "Steps, temperatures, resting times — shown to whoever records a batch": {
    ar: "الخطوات ودرجات الحرارة وأوقات الراحة — تظهر لمن يسجّل الدفعة",
    ckb: "هەنگاوەکان، پلەی گەرمی، کاتی پشوودان — بۆ ئەو کەسە پیشان دەدرێت کە دەستەیەک تۆمار دەکات",
  },
  "Save changes": { ar: "حفظ التغييرات", ckb: "پاشەکەوتکردنی گۆڕانکارییەکان" },
  "Add it": { ar: "أضفه", ckb: "زیادی بکە" },

  // Recording a batch.
  "Nothing to record yet: first add what you make, below.": {
    ar: "لا شيء لتسجيله بعد: أضف أولًا ما تصنعه، في الأسفل.",
    ckb: "هێشتا هیچ نییە بۆ تۆمارکردن: سەرەتا ئەوەی دروستی دەکەیت زیاد بکە، لە خوارەوە.",
  },
  "Recorded: {made} of {output} into stock.": {
    ar: "سُجّل: أُدخل {made} من {output} إلى المخزون.",
    ckb: "تۆمار کرا: {made} لە {output} خرایە کۆگاوە.",
  },
  "Recorded: {made} of {output} into stock. The ingredients cost {amount}.": {
    ar: "سُجّل: أُدخل {made} من {output} إلى المخزون. كلفة المكوّنات {amount}.",
    ckb: "تۆمار کرا: {made} لە {output} خرایە کۆگاوە. تێچووی پێکهاتەکان {amount} بوو.",
  },
  "What did you make?": { ar: "ماذا صنعت؟", ckb: "چیت دروست کرد؟" },
  "What did you make": { ar: "ماذا صنعت", ckb: "چیت دروست کرد" },
  "What came out (optional)": { ar: "ما نتج (اختياري)", ckb: "ئەوەی دەرچوو (ئارەزوومەندانە)" },
  "What came out": { ar: "ما نتج", ckb: "ئەوەی دەرچوو" },
  "Unit of what came out": { ar: "وحدة ما نتج", ckb: "یەکەی ئەوەی دەرچوو" },
  "Note (optional)": { ar: "ملاحظة (اختياري)", ckb: "تێبینی (ئارەزوومەندانە)" },
  "e.g. a little thick, left to rest": {
    ar: "مثلًا: كثيف قليلًا، تُرك ليرتاح",
    ckb: "بۆ نموونە: کەمێک خەستە، دانرا بۆ پشوودان",
  },
  Uses: { ar: "يستخدم", ckb: "بەکاردەهێنێت" },
  "only {qty} in stock": { ar: "في المخزون {qty} فقط", ckb: "تەنها {qty} لە کۆگادا هەیە" },
  "{qty} in stock": { ar: "في المخزون {qty}", ckb: "{qty} لە کۆگادا هەیە" },
  Makes: { ar: "يُنتج", ckb: "بەرهەم دەهێنێت" },
  "<qty>{qty}</qty> of {output}": {
    ar: "<qty>{qty}</qty> من {output}",
    ckb: "<qty>{qty}</qty> لە {output}",
  },
  "— as the recipe says": { ar: "— كما في الوصفة", ckb: "— وەک ڕەسەتەکە دەڵێت" },
  "— {diff} less than the recipe's {planned}": {
    ar: "— أقل بـ {diff} من {planned} في الوصفة",
    ckb: "— {diff} کەمتر لە {planned} ـی ڕەسەتەکە",
  },
  "— {diff} more than the recipe's {planned}": {
    ar: "— أكثر بـ {diff} من {planned} في الوصفة",
    ckb: "— {diff} زیاتر لە {planned} ـی ڕەسەتەکە",
  },
  "Enter what came out as a number, or leave it empty.": {
    ar: "أدخل ما نتج رقمًا، أو اتركه فارغًا.",
    ckb: "ئەوەی دەرچوو بە ژمارە بنووسە، یان بەتاڵی بهێڵەرەوە.",
  },
  "Cost <b>{amount}</b>": { ar: "الكلفة <b>{amount}</b>", ckb: "تێچوو <b>{amount}</b>" },
  "Recording…": { ar: "جارٍ التسجيل…", ckb: "تۆمار دەکرێت…" },
  "Record batch": { ar: "تسجيل الدفعة", ckb: "تۆمارکردنی دەستە" },

  // Changing a batch recipe, stopping it, and cancelling a batch.
  "Stop making it": { ar: "أوقف صنعه", ckb: "چیتر دروستی مەکە" },
  "Make it again": { ar: "اصنعه مجددًا", ckb: "دووبارە دروستی بکەرەوە" },
  "Cancel {what}": { ar: "إلغاء {what}", ckb: "هەڵوەشاندنەوەی {what}" },
  "Why it is cancelled": { ar: "سبب الإلغاء", ckb: "هۆکاری هەڵوەشاندنەوە" },
  "Why? e.g. recorded twice": {
    ar: "لماذا؟ مثلًا: سُجّلت مرتين",
    ckb: "بۆچی؟ بۆ نموونە: دوو جار تۆمار کراوە",
  },
  "Cancel the batch": { ar: "ألغِ الدفعة", ckb: "دەستەکە هەڵبوەشێنەوە" },

  // What the menu's actions check and answer (src/lib/actions/menu.ts). A
  // field's name goes into the common checks: "{1} is required", "Choose {1}".
  "Product name": { ar: "اسم المنتج", ckb: "ناوی بەرهەم" },
  "a category": { ar: "فئة", ckb: "پۆلێک" },
  "an ingredient": { ar: "مكوّنًا", ckb: "پێکهاتەیەک" },
  "a change": { ar: "تغييرًا", ckb: "گۆڕانکارییەک" },
  "a product": { ar: "منتجًا", ckb: "بەرهەمێک" },
  "The start date": { ar: "تاريخ البدء", ckb: "بەرواری دەستپێکردن" },
  "The category's name": { ar: "اسم الفئة", ckb: "ناوی پۆلەکە" },
  "Give the product at least one price": {
    ar: "أعطِ المنتج سعرًا واحدًا على الأقل",
    ckb: "لانیکەم یەک نرخ بۆ بەرهەمەکە دابنێ",
  },
  "List what goes into one serving": {
    ar: "اذكر ما يدخل في الحصة الواحدة",
    ckb: "بنووسە چی دەچێتە ناو یەک بەشەوە",
  },
  "Use a PNG, JPEG or WebP picture": {
    ar: "استخدم صورة PNG أو JPEG أو WebP",
    ckb: "وێنەیەکی PNG، JPEG یان WebP بەکاربهێنە",
  },
  "Choose a picture": { ar: "اختر صورة", ckb: "وێنەیەک هەڵبژێرە" },
  "The picture must be smaller than 300 KB": {
    ar: "يجب أن تكون الصورة أصغر من 300 KB",
    ckb: "وێنەکە دەبێت لە 300 KB بچووکتر بێت",
  },
  "The picture could not be read": { ar: "تعذّرت قراءة الصورة", ckb: "وێنەکە نەخوێندرایەوە" },

  // What Production's actions check and answer (src/lib/actions/production.ts).
  "Choose a unit": { ar: "اختر وحدة", ckb: "یەکەیەک هەڵبژێرە" },
  "a batch recipe": { ar: "وصفة دفعة", ckb: "ڕەسەتەی دەستەیەک" },
  "The name": { ar: "الاسم", ckb: "ناو" },
  "the item it makes": { ar: "المادة التي تُنتجها", ckb: "ئەو کاڵایەی بەرهەمی دەهێنێت" },
  "Say whether it is weighed, measured or counted in pieces": {
    ar: "حدّد هل يُوزن أم يُقاس بالحجم أم يُعدّ بالقطعة",
    ckb: "بڵێ ئایا بە کێش، بە قەبارە یان بە دانە دەژمێردرێت",
  },
  "What one batch makes": {
    ar: "ما تُنتجه الدفعة الواحدة",
    ckb: "ئەوەی یەک دەستە بەرهەمی دەهێنێت",
  },
  "List what goes into a batch": {
    ar: "اذكر ما يدخل في الدفعة",
    ckb: "بنووسە چی دەچێتە ناو دەستەکەوە",
  },
  "Say what the batch makes": {
    ar: "حدّد ما تُنتجه الدفعة",
    ckb: "بڵێ دەستەکە چی بەرهەم دەهێنێت",
  },
  "Say how much one {1} holds": {
    ar: "حدّد كم يسع {1} الواحد",
    ckb: "بڵێ یەک {1} چەند دەگرێت",
  },
  "what was made": { ar: "ما صُنع", ckb: "ئەوەی دروستکرا" },
  "The number of batches": { ar: "عدد الدفعات", ckb: "ژمارەی دەستەکان" },
  "a batch": { ar: "دفعة", ckb: "دەستەیەک" },
  "The reason": { ar: "السبب", ckb: "هۆکار" },
};

export default phrases;
