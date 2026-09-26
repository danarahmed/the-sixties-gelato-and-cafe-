import type { PhraseBook } from "./types";

/**
 * Oversight: Reports, Orders and their voids and refunds, the audit trail, the dashboard and what needs the owner, and their messages.
 */
const phrases: PhraseBook = {
  // ------------------------------------------------ words these screens share
  Channel: { ar: "القناة", ckb: "کەناڵ" },
  Orders: { ar: "الطلبات", ckb: "داواکارییەکان" },
  Sales: { ar: "المبيعات", ckb: "فرۆشتن" },
  "Net sales": { ar: "صافي المبيعات", ckb: "فرۆشی پوخت" },
  Net: { ar: "الصافي", ckb: "پوخت" },
  Margin: { ar: "هامش الربح", ckb: "پەراوێزی قازانج" },
  Products: { ar: "المنتجات", ckb: "بەرهەمەکان" },
  Items: { ar: "الأصناف", ckb: "کاڵاکان" },
  What: { ar: "ماذا", ckb: "چی" },
  Why: { ar: "السبب", ckb: "بۆچی" },
  About: { ar: "بخصوص", ckb: "دەربارە" },
  "Approved by": { ar: "بموافقة", ckb: "بە ڕەزامەندیی" },
  "Approved by {name}": { ar: "بموافقة {name}", ckb: "بە ڕەزامەندیی {name}" },
  Difference: { ar: "الفرق", ckb: "جیاوازی" },
  "{from} to {to}": { ar: "من {from} إلى {to}", ckb: "لە {from} تا {to}" },
  "No one signed in": { ar: "دون تسجيل دخول", ckb: "بێ چوونەژوورەوە" },
  Until: { ar: "تاريخ الانتهاء", ckb: "بەرواری کۆتایی" },
  // en-GB writes September "Sept" (common.ts has the other months).
  Sept: { ar: "أيلول", ckb: "ئەیلوول" },

  // ------------------------------------------------------------- Reports
  "{from} to {to} · from the ledger · <csv>every journal line (CSV)</csv>": {
    ar: "من {from} إلى {to} · من دفتر الأستاذ · <csv>كل سطور القيود (CSV)</csv>",
    ckb: "لە {from} تا {to} · لە دەفتەری گشتییەوە · <csv>هەموو هێڵەکانی تۆمار (CSV)</csv>",
  },
  "This month": { ar: "هذا الشهر", ckb: "ئەم مانگە" },
  "Last month": { ar: "الشهر الماضي", ckb: "مانگی ڕابردوو" },
  "This year": { ar: "هذه السنة", ckb: "ئەمساڵ" },

  // Do the books tie?
  "Do the books tie?": { ar: "هل تتطابق الدفاتر؟", ckb: "ئایا دەفتەرەکان یەکدەگرنەوە؟" },
  "Each subledger against its control account, as at the end of {to} · <csv>CSV</csv>": {
    ar: "كل دفتر فرعي مقابل حساب المراقبة الخاص به، كما في نهاية {to} · <csv>CSV</csv>",
    ckb: "هەر دەفتەرێکی لاوەکی بەرامبەر هەژماری کۆنترۆڵی خۆی، وەک لە کۆتایی {to} · <csv>CSV</csv>",
  },
  Check: { ar: "الفحص", ckb: "پشکنین" },
  Subledger: { ar: "الدفتر الفرعي", ckb: "دەفتەری لاوەکی" },
  Ledger: { ar: "دفتر الأستاذ", ckb: "دەفتەری گشتی" },
  "Every subledger agrees with its control account.": {
    ar: "كل دفتر فرعي يطابق حساب المراقبة الخاص به.",
    ckb: "هەموو دەفتەرە لاوەکییەکان لەگەڵ هەژماری کۆنترۆڵی خۆیان یەکدەگرنەوە.",
  },
  "{n} difference(s). A period cannot be locked while its checks fail. Differences that predate the controls are explained in docs/REMEDIATION.md and are corrected by new, dated entries — reversals, cancelled bills, the owner's corrections — never by editing history.":
    {
      ar: "عدد الفروق: {n}. لا يمكن إقفال فترة ما دامت فحوصها تفشل. الفروق التي تسبق الضوابط مشروحة في docs/REMEDIATION.md، وتُصحَّح بقيود جديدة مؤرَّخة — عكوس، وفواتير ملغاة، وتصحيحات المالك — ولا تُصحَّح أبدًا بتعديل ما مضى.",
      ckb: "جیاوازییەکان: {n}. تا پشکنینەکانی ماوەیەک سەرنەکەون، ئەو ماوەیە داناخرێت. ئەو جیاوازییانەی لە پێش کۆنترۆڵەکانەوە هەن لە docs/REMEDIATION.md ڕوونکراونەتەوە، و بە تۆماری نوێی بەروارداری ڕاست دەکرێنەوە — هەڵگەڕاندنەوە، پسووڵەی هەڵوەشێنراوە، ڕاستکردنەوەکانی خاوەن — هەرگیز بە دەستکاریکردنی ڕابردوو نا.",
    },
  // The database's checks (report_reconciliation), shown through msg().
  "Stock ledger vs Inventory (1200)": {
    ar: "دفتر المخزون مقابل المخزون (1200)",
    ckb: "دەفتەری کۆگا بەرامبەر کۆگا (1200)",
  },
  "Unpaid bills vs Accounts payable (2000)": {
    ar: "الفواتير غير المسدّدة مقابل الذمم الدائنة (2000)",
    ckb: "پسووڵە نەدراوەکان بەرامبەر قەرزی دابینکەران (2000)",
  },
  "Unbilled receipts vs Goods received not invoiced (2050)": {
    ar: "الاستلامات غير المفوترة مقابل البضائع المستلمة غير المفوترة (2050)",
    ckb: "بارە وەرگیراوە بێ پسووڵەکان بەرامبەر کاڵای وەرگیراوی بێ پسووڵە (2050)",
  },
  "Sales recorded vs net revenue in the ledger (4000 less 4100 and 4200)": {
    ar: "المبيعات المسجلة مقابل صافي الإيرادات في دفتر الأستاذ (4000 مطروحًا منه 4100 و4200)",
    ckb: "فرۆشتنی تۆمارکراو بەرامبەر داهاتی پوخت لە دەفتەری گشتیدا (4000 بە کەمکردنەوەی 4100 و 4200)",
  },

  // Profit & Loss
  "Profit & Loss": { ar: "الأرباح والخسائر", ckb: "قازانج و زیان" },
  "Published journal lines, {from} to {to} · <csv>CSV</csv>": {
    ar: "سطور القيود المنشورة، من {from} إلى {to} · <csv>CSV</csv>",
    ckb: "هێڵەکانی تۆماری بڵاوکراوە، لە {from} تا {to} · <csv>CSV</csv>",
  },
  "Net revenue": { ar: "صافي الإيرادات", ckb: "داهاتی پوخت" },
  "Cost of sales": { ar: "تكلفة المبيعات", ckb: "تێچووی فرۆشتن" },
  "Operating expenses": { ar: "المصروفات التشغيلية", ckb: "خەرجییەکانی کارکردن" },
  "Net loss": { ar: "صافي الخسارة", ckb: "زیانی پوخت" },
  "Net profit": { ar: "صافي الربح", ckb: "قازانجی پوخت" },

  // Sales by channel
  "Sales by Channel": { ar: "المبيعات حسب القناة", ckb: "فرۆشتن بەپێی کەناڵ" },
  "Sales {from} to {to}, voids excluded; refunds on the day they were made": {
    ar: "المبيعات من {from} إلى {to}، دون المبيعات الملغاة؛ والاستردادات في يوم إجرائها",
    ckb: "فرۆشتن لە {from} تا {to}، بێ فرۆشتنە هەڵوەشێنراوەکان؛ گەڕاندنەوەی پارە لەو ڕۆژەی کراوە",
  },
  "No sales in these dates.": {
    ar: "لا مبيعات في هذه التواريخ.",
    ckb: "لەم بەروارانەدا هیچ فرۆشتنێک نییە.",
  },
  "Sales margin": { ar: "هامش ربح المبيعات", ckb: "پەراوێزی قازانجی فرۆشتن" },
  "All channels": { ar: "كل القنوات", ckb: "هەموو کەناڵەکان" },
  "Net sales are what the P&L shows as net revenue for the same dates (4000 less 4100 and 4200). The sales margin is net sales less the recipe cost of what was sold; the P&L's gross profit also takes off waste, count differences, purchase price differences and platform fees.":
    {
      ar: "صافي المبيعات هو ما يُظهره كشف الأرباح والخسائر صافيًا للإيرادات في التواريخ نفسها (4000 مطروحًا منه 4100 و4200). وهامش ربح المبيعات هو صافي المبيعات مطروحًا منه كلفة وصفات ما بيع؛ أما إجمالي الربح في كشف الأرباح والخسائر فيطرح أيضًا الهدر وفروق الجرد وفروق أسعار الشراء ورسوم المنصات.",
      ckb: "فرۆشی پوخت ئەوەیە کە ڕاپۆرتی قازانج و زیان وەک داهاتی پوخت بۆ هەمان بەروارەکان پیشانی دەدات (4000 بە کەمکردنەوەی 4100 و 4200). پەراوێزی قازانجی فرۆشتن فرۆشی پوختە بە کەمکردنەوەی تێچووی ڕەسەتەی ئەوەی فرۆشراوە؛ قازانجی گشتی لە ڕاپۆرتی قازانج و زیاندا بەفیڕۆچوون، جیاوازییەکانی ژماردن، جیاوازییەکانی نرخی کڕین و کرێی پلاتفۆرمەکانیش کەم دەکاتەوە.",
    },

  // Sales costed at nothing
  "Uncosted Sales": { ar: "مبيعات بلا كلفة", ckb: "فرۆشتنی بێ تێچوو" },
  "Sales {from} to {to} with no cost, or part of it missing": {
    ar: "المبيعات من {from} إلى {to} التي بلا كلفة، أو ينقصها جزء من كلفتها",
    ckb: "فرۆشتنەکان لە {from} تا {to} کە تێچوویان نییە، یان بەشێکی تێچووەکەیان کەمە",
  },
  "Every sale in these dates carries its cost.": {
    ar: "كل بيع في هذه التواريخ يحمل كلفته.",
    ckb: "هەموو فرۆشتنێک لەم بەروارانەدا تێچووی خۆی لەگەڵە.",
  },
  "Cost recorded": { ar: "الكلفة المسجلة", ckb: "تێچووی تۆمارکراو" },
  "{n} sale(s), {amount} of sales: their profit is overstated by what went into them uncosted. A sale keeps the cost it was recorded with. To cost the next ones, give the product its recipe on <products>Products</products> (or say why it uses no stock), and give an item with no cost its opening stock or its first delivery on <inventory>Inventory</inventory>.":
    {
      ar: "عدد المبيعات: {n}، بقيمة {amount}: ربحها مُبالغ فيه بقدر ما دخل فيها بلا كلفة. يحتفظ البيع بالكلفة التي سُجّل بها. لتُحسب كلفة المبيعات القادمة، أعطِ المنتج وصفته في <products>المنتجات</products> (أو اذكر لماذا لا يستخدم مخزونًا)، وأعطِ المادة التي لا كلفة لها رصيدها الافتتاحي أو أول توريد لها في <inventory>المخزون</inventory>.",
      ckb: "{n} فرۆشتن، بە بەهای {amount}: قازانجەکەیان بەقەد ئەوەی بێ تێچوو چووەتە ناویانەوە زیاتر لە ڕاستی پیشان دراوە. فرۆشتن ئەو تێچووەی دەمێنێت کە پێی تۆمار کراوە. بۆ ئەوەی فرۆشتنەکانی داهاتوو تێچوویان هەبێت، ڕەسەتەی بەرهەمەکە لە <products>بەرهەمەکان</products> دابنێ (یان بڵێ بۆچی کۆگا بەکارناهێنێت)، و بۆ ئەو کاڵایەی تێچووی نییە باڵانسی سەرەتا یان یەکەم بارەکەی لە <inventory>کۆگا</inventory> تۆمار بکە.",
    },
  // Why a sale is costed at nothing (report_uncosted_sales), shown through msg().
  "Costed at nothing: {1}": { ar: "كلفته صفر: {1}", ckb: "تێچووی سفرە: {1}" },
  "Used before it had a cost: {1}": {
    ar: "استُخدم قبل أن تكون له كلفة: {1}",
    ckb: "پێش ئەوەی تێچووی هەبێت بەکارهاتووە: {1}",
  },
  "Costed at nothing: {1}; Used before it had a cost: {2}": {
    ar: "كلفته صفر: {1}؛ استُخدم قبل أن تكون له كلفة: {2}",
    ckb: "تێچووی سفرە: {1}؛ پێش ئەوەی تێچووی هەبێت بەکارهاتووە: {2}",
  },

  // Exceptions, by person
  Exceptions: { ar: "الاستثناءات", ckb: "ئاوارتەکان" },
  "Voids, refunds, discounts, cancelled bills, items taken off bills and wrong PINs, {from} to {to} · <csv>CSV</csv>":
    {
      ar: "إلغاءات البيع والاستردادات والخصومات والفواتير الملغاة والأصناف المُزالة من الفواتير ورموز PIN الخاطئة، من {from} إلى {to} · <csv>CSV</csv>",
      ckb: "هەڵوەشاندنەوەی فرۆشتن، گەڕاندنەوەی پارە، داشکاندن، پسووڵەی هەڵوەشێنراوە، کاڵای لابراو لە پسووڵە و PIN ی هەڵە، لە {from} تا {to} · <csv>CSV</csv>",
    },
  "Nothing was voided, refunded, discounted, cancelled or taken off a bill in these dates.": {
    ar: "لا إلغاء بيع ولا استرداد ولا خصم ولا فاتورة ملغاة ولا صنف أُزيل من فاتورة في هذه التواريخ.",
    ckb: "لەم بەروارانەدا هیچ فرۆشتنێک هەڵنەوەشێنراوەتەوە، هیچ پارەیەک نەگەڕێندراوەتەوە، هیچ داشکاندنێک نەکراوە، هیچ پسووڵەیەک هەڵنەوەشێنراوەتەوە و هیچ شتێک لە پسووڵەیەک لانەبراوە.",
  },
  Person: { ar: "الشخص", ckb: "کەس" },
  "Money involved": { ar: "المبلغ المعني", ckb: "بڕی پارەی پەیوەندیدار" },
  "For review": { ar: "للمراجعة", ckb: "بۆ پێداچوونەوە" },
  review: { ar: "للمراجعة", ckb: "بۆ پێداچوونەوە" },
  "{n} wait for your review: a void or refund nobody else approved, a wrong PIN, or a discount over the cap given before discounts were checked. Discounts over the cap need a manager's approval on the till; a void or refund may be approved there by a second person with their name and PIN.":
    {
      ar: "بانتظار مراجعتك: {n} — إلغاء بيع أو استرداد لم يوافق عليه شخص آخر، أو رمز PIN خاطئ، أو خصم فوق الحد أُعطي قبل أن تُفحص الخصومات. الخصم فوق الحد يحتاج إلى موافقة مدير على نقطة البيع؛ ويمكن أن يوافق على إلغاء البيع أو الاسترداد هناك شخص ثانٍ باسمه ورمز PIN الخاص به.",
      ckb: "{n} چاوەڕێی پێداچوونەوەی تۆن: هەڵوەشاندنەوەی فرۆشتن یان گەڕاندنەوەی پارە کە کەسێکی تر ڕەزامەندی لەسەر نەداوە، PIN ی هەڵە، یان داشکاندنی سەرووی سنوور کە پێش پشکنینی داشکاندنەکان دراوە. داشکاندنی سەرووی سنوور پێویستی بە ڕەزامەندی بەڕێوەبەر هەیە لەسەر خاڵی فرۆشتن؛ هەڵوەشاندنەوەی فرۆشتن یان گەڕاندنەوەی پارە دەکرێت لەوێ کەسێکی دووەم بە ناو و PIN ی خۆی ڕەزامەندی لەسەر بدات.",
    },
  "a void or refund nobody else approved, a wrong PIN, or a discount over the cap given before discounts were checked. Discounts over the cap need a manager's approval on the till; a void or refund may be approved there by a second person with their name and PIN.":
    {
      ar: "ما ينتظر المراجعة: إلغاء بيع أو استرداد لم يوافق عليه شخص آخر، أو رمز PIN خاطئ، أو خصم فوق الحد أُعطي قبل أن تُفحص الخصومات. الخصم فوق الحد يحتاج إلى موافقة مدير على نقطة البيع؛ ويمكن أن يوافق على إلغاء البيع أو الاسترداد هناك شخص ثانٍ باسمه ورمز PIN الخاص به.",
      ckb: "ئەوەی چاوەڕێی پێداچوونەوە دەکات: هەڵوەشاندنەوەی فرۆشتن یان گەڕاندنەوەی پارە کە کەسێکی تر ڕەزامەندی لەسەر نەداوە، PIN ی هەڵە، یان داشکاندنی سەرووی سنوور کە پێش پشکنینی داشکاندنەکان دراوە. داشکاندنی سەرووی سنوور پێویستی بە ڕەزامەندی بەڕێوەبەر هەیە لەسەر خاڵی فرۆشتن؛ هەڵوەشاندنەوەی فرۆشتن یان گەڕاندنەوەی پارە دەکرێت لەوێ کەسێکی دووەم بە ناو و PIN ی خۆی ڕەزامەندی لەسەر بدات.",
    },
  // What an exception was (EXCEPTION_LABEL, src/lib/exceptions.ts).
  Void: { ar: "إلغاء البيع", ckb: "هەڵوەشاندنەوەی فرۆشتن" },
  Discount: { ar: "خصم", ckb: "داشکاندن" },
  "Bill cancelled": { ar: "فاتورة ملغاة", ckb: "پسووڵەی هەڵوەشێنراوە" },
  "Printed bill reduced": { ar: "تخفيض فاتورة مطبوعة", ckb: "کەمکردنەوەی پسووڵەی چاپکراو" },
  "Items taken off a bill": { ar: "أصناف أُزيلت من فاتورة", ckb: "کاڵای لابراو لە پسووڵە" },
  "Wrong PIN": { ar: "رمز PIN خاطئ", ckb: "PIN ی هەڵە" },
  // What approval a wrong PIN was for (report_exceptions), and a sale's state.
  void: { ar: "إلغاء البيع", ckb: "هەڵوەشاندنەوەی فرۆشتن" },
  refund: { ar: "استرداد", ckb: "گەڕاندنەوەی پارە" },
  discount: { ar: "خصم", ckb: "داشکاندن" },
  open: { ar: "مفتوح", ckb: "کراوە" },
  completed: { ar: "مكتمل", ckb: "تەواوبوو" },
  voided: { ar: "ملغى", ckb: "هەڵوەشێنراوە" },
  refunded: { ar: "مسترد", ckb: "پارەی گەڕێندراوەتەوە" },
  partially_refunded: { ar: "مسترد جزئيًا", ckb: "بەشێکی گەڕێندراوەتەوە" },
  // What each exception was about (report_exceptions), shown through msg().
  "Sale {1} · Rung by {2}": {
    ar: "البيع {1} · سجّله {2}",
    ckb: "فرۆشتنی {1} · تۆمارکراوە لەلایەن {2}",
  },
  "Sale {1} · Rung by {2} (their own sale)": {
    ar: "البيع {1} · سجّله {2} (بيعه هو)",
    ckb: "فرۆشتنی {1} · تۆمارکراوە لەلایەن {2} (فرۆشتنی خۆی)",
  },
  "Bill {1} · {2} line(s) on it": {
    ar: "الفاتورة {1} · عدد السطور عليها: {2}",
    ckb: "پسووڵەی {1} · {2} هێڵی لەسەر بوو",
  },
  "Bill {1} · {2} item(s) taken off": {
    ar: "الفاتورة {1} · عدد الأصناف المُزالة: {2}",
    ckb: "پسووڵەی {1} · {2} کاڵا لابرا",
  },
  "Approval by {1}": { ar: "موافقة {1}", ckb: "ڕەزامەندیی {1}" },
  "Approval by {1} · {2}": { ar: "موافقة {1} · {2}", ckb: "ڕەزامەندیی {1} · {2}" },
  "Sale {1} · {2}% of {3}": { ar: "البيع {1} · {2}% من {3}", ckb: "فرۆشتنی {1} · {2}% ی {3}" },
  "Sale {1} · {2}% of {3}, later voided": {
    ar: "البيع {1} · {2}% من {3}، وأُلغي البيع لاحقًا",
    ckb: "فرۆشتنی {1} · {2}% ی {3}، دواتر هەڵوەشێنرایەوە",
  },
  "Sale {1} · {2}% of {3}, later refunded": {
    ar: "البيع {1} · {2}% من {3}، واستُرجع لاحقًا",
    ckb: "فرۆشتنی {1} · {2}% ی {3}، دواتر پارەکەی گەڕێندرایەوە",
  },
  "Sale {1} · {2}% of {3}, given before who gave it was kept": {
    ar: "البيع {1} · {2}% من {3}، أُعطي قبل أن يُحفظ من أعطاه",
    ckb: "فرۆشتنی {1} · {2}% ی {3}، پێش ئەوەی ناوی بەخشەر هەڵبگیرێت دراوە",
  },
  "Sale {1} · {2}% of {3}, given before who gave it was kept, later voided": {
    ar: "البيع {1} · {2}% من {3}، أُعطي قبل أن يُحفظ من أعطاه، وأُلغي البيع لاحقًا",
    ckb: "فرۆشتنی {1} · {2}% ی {3}، پێش ئەوەی ناوی بەخشەر هەڵبگیرێت دراوە، دواتر هەڵوەشێنرایەوە",
  },
  "Sale {1} · {2}% of {3}, given before who gave it was kept, later refunded": {
    ar: "البيع {1} · {2}% من {3}، أُعطي قبل أن يُحفظ من أعطاه، واستُرجع لاحقًا",
    ckb: "فرۆشتنی {1} · {2}% ی {3}، پێش ئەوەی ناوی بەخشەر هەڵبگیرێت دراوە، دواتر پارەکەی گەڕێندرایەوە",
  },
  "Sale {1} · {2}% asked, {3}% of {4}": {
    ar: "البيع {1} · طُلب {2}%، و{3}% من {4}",
    ckb: "فرۆشتنی {1} · {2}% داواکرا، {3}% ی {4}",
  },
  "Sale {1} · {2}% asked, {3}% of {4}, later voided": {
    ar: "البيع {1} · طُلب {2}%، و{3}% من {4}، وأُلغي البيع لاحقًا",
    ckb: "فرۆشتنی {1} · {2}% داواکرا، {3}% ی {4}، دواتر هەڵوەشێنرایەوە",
  },
  "Sale {1} · {2}% asked, {3}% of {4}, later refunded": {
    ar: "البيع {1} · طُلب {2}%، و{3}% من {4}، واستُرجع لاحقًا",
    ckb: "فرۆشتنی {1} · {2}% داواکرا، {3}% ی {4}، دواتر پارەکەی گەڕێندرایەوە",
  },
  "Sale {1} · {2}% asked, {3}% of {4}, given before who gave it was kept": {
    ar: "البيع {1} · طُلب {2}%، و{3}% من {4}، أُعطي قبل أن يُحفظ من أعطاه",
    ckb: "فرۆشتنی {1} · {2}% داواکرا، {3}% ی {4}، پێش ئەوەی ناوی بەخشەر هەڵبگیرێت دراوە",
  },
  "Sale {1} · {2}% asked, {3}% of {4}, given before who gave it was kept, later voided": {
    ar: "البيع {1} · طُلب {2}%، و{3}% من {4}، أُعطي قبل أن يُحفظ من أعطاه، وأُلغي البيع لاحقًا",
    ckb: "فرۆشتنی {1} · {2}% داواکرا، {3}% ی {4}، پێش ئەوەی ناوی بەخشەر هەڵبگیرێت دراوە، دواتر هەڵوەشێنرایەوە",
  },
  "Sale {1} · {2}% asked, {3}% of {4}, given before who gave it was kept, later refunded": {
    ar: "البيع {1} · طُلب {2}%، و{3}% من {4}، أُعطي قبل أن يُحفظ من أعطاه، واستُرجع لاحقًا",
    ckb: "فرۆشتنی {1} · {2}% داواکرا، {3}% ی {4}، پێش ئەوەی ناوی بەخشەر هەڵبگیرێت دراوە، دواتر پارەکەی گەڕێندرایەوە",
  },
  // A reason as the database keeps it (reason_code's label, and a note after
  // it), shown through msg(); the same words as the till's reason.* keys.
  "Rang the wrong item": { ar: "أُدخل صنف خاطئ", ckb: "کاڵای هەڵە تۆمار کرا" },
  "Rang the wrong item: {1}": { ar: "أُدخل صنف خاطئ: {1}", ckb: "کاڵای هەڵە تۆمار کرا: {1}" },
  "Rang twice": { ar: "أُدخل مرتين", ckb: "دوو جار تۆمار کرا" },
  "Rang twice: {1}": { ar: "أُدخل مرتين: {1}", ckb: "دوو جار تۆمار کرا: {1}" },
  "Wrong channel or table": { ar: "قناة أو طاولة خاطئة", ckb: "کەناڵ یان مێزی هەڵە" },
  "Wrong channel or table: {1}": {
    ar: "قناة أو طاولة خاطئة: {1}",
    ckb: "کەناڵ یان مێزی هەڵە: {1}",
  },
  "Customer left before it was made": {
    ar: "غادر الزبون قبل تحضيره",
    ckb: "کڕیار پێش ئامادەکردنی ڕۆیشت",
  },
  "Customer left before it was made: {1}": {
    ar: "غادر الزبون قبل تحضيره: {1}",
    ckb: "کڕیار پێش ئامادەکردنی ڕۆیشت: {1}",
  },
  "Customer changed their mind": { ar: "غيّر الزبون رأيه", ckb: "کڕیار پەشیمان بووەوە" },
  "Customer changed their mind: {1}": {
    ar: "غيّر الزبون رأيه: {1}",
    ckb: "کڕیار پەشیمان بووەوە: {1}",
  },
  "Something was wrong with it": { ar: "كان فيه عيب", ckb: "کێشەیەکی تێدا بوو" },
  "Something was wrong with it: {1}": { ar: "كان فيه عيب: {1}", ckb: "کێشەیەکی تێدا بوو: {1}" },
  "Wrong order made": { ar: "حُضّر طلب خاطئ", ckb: "داواکاری هەڵە ئامادە کرا" },
  "Wrong order made: {1}": { ar: "حُضّر طلب خاطئ: {1}", ckb: "داواکاری هەڵە ئامادە کرا: {1}" },
  "Charged too much": { ar: "أُخذ مبلغ أكثر من اللازم", ckb: "پارەی زیاتر وەرگیرا" },
  "Charged too much: {1}": {
    ar: "أُخذ مبلغ أكثر من اللازم: {1}",
    ckb: "پارەی زیاتر وەرگیرا: {1}",
  },
  "Staff meal": { ar: "وجبة موظف", ckb: "خواردنی کارمەند" },
  "Staff meal: {1}": { ar: "وجبة موظف: {1}", ckb: "خواردنی کارمەند: {1}" },
  "On the house": { ar: "ضيافة من المحل", ckb: "میوانداری" },
  "On the house: {1}": { ar: "ضيافة من المحل: {1}", ckb: "میوانداری: {1}" },
  "Regular customer": { ar: "زبون دائم", ckb: "کڕیاری هەمیشەیی" },
  "Regular customer: {1}": { ar: "زبون دائم: {1}", ckb: "کڕیاری هەمیشەیی: {1}" },
  "To make up for a complaint": { ar: "تعويضًا عن شكوى", ckb: "بۆ قەرەبووی سکاڵایەک" },
  "To make up for a complaint: {1}": {
    ar: "تعويضًا عن شكوى: {1}",
    ckb: "بۆ قەرەبووی سکاڵایەک: {1}",
  },
  Promotion: { ar: "عرض ترويجي", ckb: "ئۆفەر" },
  "Promotion: {1}": { ar: "عرض ترويجي: {1}", ckb: "ئۆفەر: {1}" },
  "Customer left without ordering": {
    ar: "غادر الزبون دون أن يطلب",
    ckb: "کڕیار بێ داواکردن ڕۆیشت",
  },
  "Customer left without ordering: {1}": {
    ar: "غادر الزبون دون أن يطلب: {1}",
    ckb: "کڕیار بێ داواکردن ڕۆیشت: {1}",
  },
  "Opened by mistake": { ar: "فُتحت بالخطأ", ckb: "بە هەڵە کرایەوە" },
  "Opened by mistake: {1}": { ar: "فُتحت بالخطأ: {1}", ckb: "بە هەڵە کرایەوە: {1}" },
  "Moved to another bill": { ar: "نُقلت إلى فاتورة أخرى", ckb: "گوازرایەوە بۆ پسووڵەیەکی تر" },
  "Moved to another bill: {1}": {
    ar: "نُقلت إلى فاتورة أخرى: {1}",
    ckb: "گوازرایەوە بۆ پسووڵەیەکی تر: {1}",
  },
  "No reason kept (given before reasons were asked)": {
    ar: "لم يُحفظ سبب (أُعطي قبل أن تُطلب الأسباب)",
    ckb: "هیچ هۆکارێک هەڵنەگیراوە (پێش ئەوەی هۆکار داوا بکرێت دراوە)",
  },
  "wrong PIN": { ar: "رمز PIN خاطئ", ckb: "PIN ی هەڵە" },

  // Payable ageing
  "Payable Ageing": { ar: "أعمار الذمم الدائنة", ckb: "تەمەنی قەرزی دابینکەران" },
  "Today · what to pay first": { ar: "اليوم · ما يُدفع أولًا", ckb: "ئەمڕۆ · چی یەکەم جار بدرێت" },
  Vendor: { ar: "المورّد", ckb: "دابینکەر" },
  Invoice: { ar: "الفاتورة", ckb: "پسووڵە" },
  Due: { ar: "تاريخ الاستحقاق", ckb: "بەرواری دانەوە" },
  Outstanding: { ar: "المتبقي", ckb: "ماوە" },
  Age: { ar: "العمر", ckb: "تەمەن" },
  "Nothing outstanding — every bill is settled.": {
    ar: "لا شيء مستحق — كل الفواتير مسدّدة.",
    ckb: "هیچ قەرزێک نەماوە — هەموو پسووڵەکان دراون.",
  },
  "{n}d over": { ar: "أيام التأخير: {n}", ckb: "{n} ڕۆژ دواکەوتووە" },
  Current: { ar: "في موعدها", ckb: "لە کاتی خۆیدایە" },
  "Total payable": { ar: "إجمالي المستحق للمورّدين", ckb: "کۆی قەرزی دابینکەران" },

  // Product margin
  "Product Margin by Channel": {
    ar: "هامش ربح المنتجات حسب القناة",
    ckb: "پەراوێزی قازانجی بەرهەمەکان بەپێی کەناڵ",
  },
  "Today's prices and today's costs, costed exactly as a sale posts them": {
    ar: "أسعار اليوم وكلف اليوم، محسوبة تمامًا كما يرحّلها البيع",
    ckb: "نرخەکانی ئەمڕۆ و تێچووەکانی ئەمڕۆ، ڕێک وەک فرۆشتن تۆماریان دەکات",
  },
  "Add products with recipes and prices to see their margins.": {
    ar: "أضف منتجات بوصفاتها وأسعارها لترى هوامش ربحها.",
    ckb: "بەرهەم لەگەڵ ڕەسەتە و نرخەکانیان زیاد بکە بۆ ئەوەی پەراوێزی قازانجیان ببینیت.",
  },

  // The other reports
  "Also:": { ar: "وأيضًا:", ckb: "هەروەها:" },
  "Trial balance": { ar: "ميزان المراجعة", ckb: "تەرازووی پێداچوونەوە" },
  "Journal register": { ar: "سجل القيود", ckb: "لیستی تۆمارەکان" },
  "Daily sales & cash over/short": {
    ar: "المبيعات اليومية وزيادة النقد ونقصه",
    ckb: "فرۆشتنی ڕۆژانە و زیادی و کەمیی پارەی کاش",
  },
  "Vendor statements": { ar: "كشوفات المورّدين", ckb: "کەشفی حسابی دابینکەران" },
  "Stock valuation": { ar: "تقييم المخزون", ckb: "نرخاندنی کۆگا" },
  "Count variances": { ar: "فروق الجرد", ckb: "جیاوازییەکانی ژماردن" },
  "Not built yet: balance sheet, cash-flow statement, sales by hour.": {
    ar: "لم تُبنَ بعد: الميزانية العمومية، وقائمة التدفقات النقدية، والمبيعات حسب الساعة.",
    ckb: "هێشتا دروست نەکراون: لیستی باری دارایی، لیستی ڕەوتی پارە، فرۆشتن بەپێی کاتژمێر.",
  },

  // -------------------------------------------------------------- Orders
  "A sale is never edited. A sale rung in error is <b>voided</b> until the drawer holding it is counted — revenue, payment, cost and stock all come back exactly. After that, money goes back to the customer by a <b>refund</b>, through Sales returns (4200); only goods that can go back on the shelf return to stock. Both take a reason from the list and are on the audit trail; one approved by a second person (their name and PIN) is marked so, and one without waits for the owner on the exceptions report.":
    {
      ar: "لا يُعدَّل البيع أبدًا. البيع المسجَّل خطأً <b>يُلغى</b> ما دام درج النقد الذي يحويه لم يُعدّ بعد — فتعود الإيرادات والدفعة والكلفة والمخزون كما كانت تمامًا. بعد ذلك يعود المال إلى الزبون عبر <b>الاسترداد</b>، من خلال مردودات المبيعات (4200)؛ ولا يعود إلى المخزون إلا ما يمكن إرجاعه إلى الرف. كلاهما يأخذ سببًا من القائمة ويُسجَّل في سجل التدقيق؛ وما وافق عليه شخص ثانٍ (باسمه ورمز PIN الخاص به) يُعلَّم بذلك، وما لم يوافق عليه أحد ينتظر المالك في تقرير الاستثناءات.",
      ckb: "فرۆشتن هەرگیز دەستکاری ناکرێت. فرۆشتنێک کە بە هەڵە تۆمار کراوە <b>هەڵدەوەشێنرێتەوە</b> تا ئەو دەخیلەیەی تێیدایە نەژمێردرێت — داهات، پارەدان، تێچوو و کۆگا هەموویان ڕێک وەک خۆیان دەگەڕێنەوە. دوای ئەوە، پارە بە <b>گەڕاندنەوەی پارە</b> دەدرێتەوە بە کڕیار، لە ڕێگەی گەڕاوەکانی فرۆشتن (4200)؛ تەنها ئەو کاڵایانە دەگەڕێنەوە کۆگا کە دەتوانرێت بخرێنەوە سەر ڕەفە. هەردووکیان هۆکارێک لە لیستەکە وەردەگرن و لە تۆماری گۆڕانکارییەکاندا دەنووسرێن؛ ئەوەی کەسێکی دووەم (بە ناو و PIN ی خۆی) ڕەزامەندی لەسەر دابێت ئەمەی لەسەر دەنووسرێت، و ئەوەی بێ ئەوە بێت لە ڕاپۆرتی ئاوارتەکاندا چاوەڕێی خاوەن دەکات.",
    },
  "Every channel": { ar: "كل القنوات", ckb: "هەموو کەناڵەکان" },
  "The latest 300": { ar: "آخر 300", ckb: "دوایین 300" },
  "Completed sales on {day}": {
    ar: "المبيعات المكتملة في {day}",
    ckb: "فرۆشتنە تەواوبووەکان لە {day}",
  },
  "Completed sales on {day}, {channel}": {
    ar: "المبيعات المكتملة في {day}، {channel}",
    ckb: "فرۆشتنە تەواوبووەکان لە {day}، {channel}",
  },
  "Completed sales {from} to {to}": {
    ar: "المبيعات المكتملة من {from} إلى {to}",
    ckb: "فرۆشتنە تەواوبووەکان لە {from} تا {to}",
  },
  "Completed sales {from} to {to}, {channel}": {
    ar: "المبيعات المكتملة من {from} إلى {to}، {channel}",
    ckb: "فرۆشتنە تەواوبووەکان لە {from} تا {to}، {channel}",
  },
  "Completed sales shown": {
    ar: "المبيعات المكتملة المعروضة",
    ckb: "فرۆشتنە تەواوبووە پیشاندراوەکان",
  },
  "Their sales margin (price less recipe cost)": {
    ar: "هامش ربح مبيعاتها (السعر مطروحًا منه كلفة الوصفة)",
    ckb: "پەراوێزی قازانجی فرۆشتنیان (نرخ بە کەمکردنەوەی تێچووی ڕەسەتە)",
  },
  "No sales yet": { ar: "لا مبيعات بعد", ckb: "هێشتا هیچ فرۆشتنێک نییە" },
  "Sales rung up on the till appear here.": {
    ar: "تظهر هنا المبيعات المسجّلة على نقطة البيع.",
    ckb: "ئەو فرۆشتنانەی لەسەر خاڵی فرۆشتن تۆمار دەکرێن لێرە دەردەکەون.",
  },
  "{reason} · {by}, approved by {approver}": {
    ar: "{reason} · {by}، بموافقة {approver}",
    ckb: "{reason} · {by}، بە ڕەزامەندیی {approver}",
  },
  "{reason} · {by}, no second person": {
    ar: "{reason} · {by}، دون شخص ثانٍ",
    ckb: "{reason} · {by}، بێ کەسی دووەم",
  },

  // A void or a refund (OrderActions)
  "Voided (journal {no}).": {
    ar: "أُلغي البيع (القيد {no}).",
    ckb: "فرۆشتنەکە هەڵوەشێنرایەوە (تۆماری {no}).",
  },
  "Refunded {amount} (journal {no}).": {
    ar: "استُرجع {amount} (القيد {no}).",
    ckb: "{amount} گەڕێندرایەوە (تۆماری {no}).",
  },
  "Why void it?": { ar: "لماذا يُلغى البيع؟", ckb: "بۆچی فرۆشتنەکە هەڵدەوەشێنرێتەوە؟" },
  "Why refund it?": { ar: "لماذا يُسترجع المبلغ؟", ckb: "بۆچی پارەکە دەگەڕێندرێتەوە؟" },
  "What happened, in a few words": {
    ar: "ما الذي حدث، بكلمات قليلة",
    ckb: "چی ڕوویدا، بە چەند وشەیەک",
  },
  "A note (optional)": { ar: "ملاحظة (اختيارية)", ckb: "تێبینی (ئارەزوومەندانە)" },
  "No second person (the owner reviews it)": {
    ar: "دون شخص ثانٍ (يراجعه المالك)",
    ckb: "بێ کەسی دووەم (خاوەن پێیدا دەچێتەوە)",
  },
  "Their PIN": { ar: "رمز PIN الخاص به", ckb: "PIN ی ئەو" },
  "Confirm void": { ar: "تأكيد إلغاء البيع", ckb: "دڵنیاکردنەوەی هەڵوەشاندنەوە" },
  "Confirm refund": { ar: "تأكيد الاسترداد", ckb: "دڵنیاکردنەوەی گەڕاندنەوەی پارە" },

  // ------------------------------------------------------- The audit trail
  "Who changed what, with the values before and after": {
    ar: "من غيّر ماذا، مع القيم قبل التغيير وبعده",
    ckb: "کێ چی گۆڕی، لەگەڵ بەهاکانی پێش و دوای گۆڕان",
  },
  "Every change": { ar: "كل التغييرات", ckb: "هەموو گۆڕانکارییەکان" },
  Anyone: { ar: "أي شخص", ckb: "هەر کەسێک" },
  "No one signed in (changed in the database)": {
    ar: "دون تسجيل دخول (تغيير في قاعدة البيانات)",
    ckb: "بێ چوونەژوورەوە (لە بنکەدراوەکەدا گۆڕدراوە)",
  },
  "The latest {n} changes are shown; the CSV has them all": {
    ar: "تُعرض آخر {n} من التغييرات؛ وملف CSV يحويها كلها",
    ckb: "دوایین {n} گۆڕانکاری پیشان دراون؛ فایلی CSV هەموویانی تێدایە",
  },
  "{n} change(s)": { ar: "عدد التغييرات: {n}", ckb: "{n} گۆڕانکاری" },
  "Nothing recorded in these dates for this choice.": {
    ar: "لم يُسجَّل شيء في هذه التواريخ لهذا الاختيار.",
    ckb: "لەم بەروارانەدا هیچ شتێک بۆ ئەم هەڵبژاردنە تۆمار نەکراوە.",
  },
  "Nothing recorded in these dates.": {
    ar: "لم يُسجَّل شيء في هذه التواريخ.",
    ckb: "لەم بەروارانەدا هیچ شتێک تۆمار نەکراوە.",
  },
  "Before → after": { ar: "قبل ← بعد", ckb: "پێش ← دوای" },
  "Written by the database in the same step as the change, and never edited or deleted. Prices, products, stock items and their units, opening stock, suppliers, recipes, business settings and places are recorded however they are changed — on a screen, or in the database, where no one is signed in. Sales, refunds, discounts, counts, cash and the books are recorded by the steps that make them. See also the <journals>journal register</journals> for every posting.":
    {
      ar: "تكتبه قاعدة البيانات في الخطوة نفسها التي يحدث فيها التغيير، ولا يُعدَّل ولا يُحذف أبدًا. تُسجَّل الأسعار والمنتجات ومواد المخزون ووحداتها والرصيد الافتتاحي والمورّدون والوصفات وإعدادات العمل والأماكن كيفما تغيّرت — على شاشة، أو في قاعدة البيانات حيث لا يكون أحد مسجّلًا الدخول. أما المبيعات والاستردادات والخصومات والجرد والنقد والدفاتر فتسجّلها الخطوات التي تُجريها. وانظر أيضًا <journals>سجل القيود</journals> لكل ترحيل.",
      ckb: "بنکەدراوەکە لە هەمان هەنگاوی گۆڕانکارییەکەدا دەینووسێت، و هەرگیز دەستکاری ناکرێت و ناسڕدرێتەوە. نرخ، بەرهەم، کاڵاکانی کۆگا و یەکەکانیان، باڵانسی سەرەتا، دابینکەران، ڕەسەتەکان، ڕێکخستنەکانی کار و شوێنەکان تۆمار دەکرێن هەر چۆنێک گۆڕدرابن — لەسەر شاشەیەک، یان لە بنکەدراوەکەدا کە کەس تێیدا نەچووەتە ژوورەوە. فرۆشتن، گەڕاندنەوەی پارە، داشکاندن، ژماردن، پارەی کاش و دەفتەرەکان بەو هەنگاوانە تۆمار دەکرێن کە ئەنجامیان دەدەن. هەروەها بڕوانە <journals>لیستی تۆمارەکان</journals> بۆ هەموو تۆمارکردنێک.",
    },
  // What the trail can be narrowed to (AUDIT_GROUPS, src/lib/audit.ts).
  Prices: { ar: "الأسعار", ckb: "نرخەکان" },
  "Products & recipes": { ar: "المنتجات والوصفات", ckb: "بەرهەم و ڕەسەتەکان" },
  "Stock items & opening stock": {
    ar: "مواد المخزون والرصيد الافتتاحي",
    ckb: "کاڵاکانی کۆگا و باڵانسی سەرەتا",
  },
  "Suppliers & deliveries": { ar: "المورّدون والتوريدات", ckb: "دابینکەران و بارەکان" },
  "Counts, corrections & batches": {
    ar: "الجرد والتصحيحات ودفعات الإنتاج",
    ckb: "ژماردن، ڕاستکردنەوە و دەفعەکانی بەرهەمهێنان",
  },
  "Sales, bills, discounts & approvals": {
    ar: "المبيعات والفواتير والخصومات والموافقات",
    ckb: "فرۆشتن، پسووڵە، داشکاندن و ڕەزامەندییەکان",
  },
  "Cash & the drawer": { ar: "النقد ودرج النقد", ckb: "پارەی کاش و دەخیلە" },
  "Card & platform settlements": {
    ar: "تسويات البطاقات والمنصات",
    ckb: "یەکلاکردنەوەی کارت و پلاتفۆرمەکان",
  },
  "Books & periods": { ar: "الدفاتر والفترات", ckb: "دەفتەرەکان و ماوەکان" },
  "Alerts answered": { ar: "التنبيهات المُجاب عنها", ckb: "ئاگادارییە وەڵامدراوەکان" },
  "Settings, places, platforms & people": {
    ar: "الإعدادات والأماكن والمنصات والأشخاص",
    ckb: "ڕێکخستنەکان، شوێنەکان، پلاتفۆرمەکان و کەسەکان",
  },
  // What happened (actionLabel): an action by its name…
  "Price set": { ar: "تحديد سعر", ckb: "دانانی نرخ" },
  "Price changed in the database": {
    ar: "تعديل سعر في قاعدة البيانات",
    ckb: "گۆڕینی نرخ لە بنکەدراوەکەدا",
  },
  "Scheduled price withdrawn": { ar: "سحب سعر مجدول", ckb: "کشاندنەوەی نرخێکی خشتەکراو" },
  "Marked as using no stock": {
    ar: "وُسم بأنه لا يستخدم مخزونًا",
    ckb: "وەک بێ بەکارهێنانی کۆگا دیاری کرا",
  },
  "Recipe changed": { ar: "تعديل وصفة", ckb: "گۆڕینی ڕەسەتە" },
  "Scheduled recipe withdrawn": { ar: "سحب وصفة مجدولة", ckb: "کشاندنەوەی ڕەسەتەیەکی خشتەکراو" },
  "Batch recipe added": { ar: "إضافة وصفة دفعة", ckb: "زیادکردنی ڕەسەتەی دەفعە" },
  "Batch recipe changed": { ar: "تعديل وصفة دفعة", ckb: "گۆڕینی ڕەسەتەی دەفعە" },
  "Stock corrected": { ar: "تصحيح المخزون", ckb: "ڕاستکردنەوەی کۆگا" },
  "Stock count approved": { ar: "اعتماد الجرد", ckb: "پەسەندکردنی ژماردنی کۆگا" },
  "Stock count cancelled": { ar: "إلغاء الجرد", ckb: "هەڵوەشاندنەوەی ژماردنی کۆگا" },
  "Batch cancelled": { ar: "إلغاء دفعة إنتاج", ckb: "هەڵوەشاندنەوەی دەفعەیەکی بەرهەمهێنان" },
  "Sale voided": { ar: "إلغاء بيع", ckb: "هەڵوەشاندنەوەی فرۆشتن" },
  "Sale refunded": { ar: "استرداد بيع", ckb: "گەڕاندنەوەی پارەی فرۆشتن" },
  "Discount given": { ar: "منح خصم", ckb: "دانی داشکاندن" },
  "Open bill cancelled": { ar: "إلغاء فاتورة مفتوحة", ckb: "هەڵوەشاندنەوەی پسووڵەی کراوە" },
  "Discount on an open bill": { ar: "خصم على فاتورة مفتوحة", ckb: "داشکاندن لەسەر پسووڵەی کراوە" },
  "Items taken off an open bill": {
    ar: "إزالة أصناف من فاتورة مفتوحة",
    ckb: "لابردنی کاڵا لە پسووڵەی کراوە",
  },
  "Open bill split": { ar: "تقسيم فاتورة مفتوحة", ckb: "دابەشکردنی پسووڵەی کراوە" },
  "Approved with a manager's PIN": {
    ar: "موافقة برمز PIN لمدير",
    ckb: "ڕەزامەندی بە PIN ی بەڕێوەبەر",
  },
  "Wrong PIN for an approval": { ar: "رمز PIN خاطئ لموافقة", ckb: "PIN ی هەڵە بۆ ڕەزامەندی" },
  "Drawer counted": { ar: "عدّ درج النقد", ckb: "ژماردنی دەخیلە" },
  "Card takings settled": { ar: "تسوية مقبوضات البطاقات", ckb: "یەکلاکردنەوەی داهاتی کارت" },
  "Card settlement cancelled": {
    ar: "إلغاء تسوية بطاقات",
    ckb: "هەڵوەشاندنەوەی یەکلاکردنەوەی کارت",
  },
  "Platform payout recorded": { ar: "تسجيل دفعة منصة", ckb: "تۆمارکردنی پارەی پلاتفۆرم" },
  "Platform payout cancelled": { ar: "إلغاء دفعة منصة", ckb: "هەڵوەشاندنەوەی پارەی پلاتفۆرم" },
  "Delivery platform added": { ar: "إضافة منصة توصيل", ckb: "زیادکردنی پلاتفۆرمی گەیاندن" },
  "Delivery platform's packaging and prices copied": {
    ar: "نسخ تغليف منصة التوصيل وأسعارها",
    ckb: "لەبەرگرتنەوەی پێچانەوە و نرخەکانی پلاتفۆرمی گەیاندن",
  },
  "Delivery platform changed": { ar: "تعديل منصة توصيل", ckb: "گۆڕینی پلاتفۆرمی گەیاندن" },
  "Journal reversed": { ar: "عكس قيد", ckb: "هەڵگەڕاندنەوەی تۆمار" },
  "Owner's correction posted": { ar: "ترحيل تصحيح المالك", ckb: "تۆمارکردنی ڕاستکردنەوەی خاوەن" },
  "Old record posted": { ar: "ترحيل سجل قديم", ckb: "تۆمارکردنی تۆمارێکی کۆن" },
  "Period locked": { ar: "إقفال فترة", ckb: "داخستنی ماوە" },
  "Period reopened": { ar: "إعادة فتح فترة", ckb: "کردنەوەی ماوە" },
  "Person invited": { ar: "دعوة شخص", ckb: "بانگهێشتکردنی کەسێک" },
  "Roles changed": { ar: "تغيير الأدوار", ckb: "گۆڕینی ڕۆڵەکان" },
  "Person given access again": {
    ar: "إعادة صلاحية الدخول لشخص",
    ckb: "گەڕاندنەوەی دەستپێگەیشتن بۆ کەسێک",
  },
  "Person's access removed": {
    ar: "سحب صلاحية الدخول من شخص",
    ckb: "لابردنی دەستپێگەیشتنی کەسێک",
  },
  "Approval PIN set": { ar: "تعيين رمز PIN للموافقة", ckb: "دانانی PIN ی ڕەزامەندی" },
  "Alert answered": { ar: "الرد على تنبيه", ckb: "وەڵامدانەوەی ئاگاداری" },
  "Alert snoozed": { ar: "تأجيل تنبيه", ckb: "دواخستنی ئاگاداری" },
  "Trial records cleared (clean start)": {
    ar: "مسح السجلات التجريبية (بداية نظيفة)",
    ckb: "سڕینەوەی تۆمارە تاقیکارییەکان (دەستپێکی پاک)",
  },
  "Test records cleared": { ar: "مسح سجلات الاختبار", ckb: "سڕینەوەی تۆمارەکانی تاقیکردنەوە" },
  // …and a change the database records itself: "{table} {verb}", in full.
  "Product added": { ar: "إضافة منتج", ckb: "زیادکردنی بەرهەم" },
  "Product changed": { ar: "تعديل منتج", ckb: "گۆڕینی بەرهەم" },
  "Product deleted": { ar: "حذف منتج", ckb: "سڕینەوەی بەرهەم" },
  "What the till sells added": { ar: "إضافة صنف بيع", ckb: "زیادکردنی جۆرێکی بەرهەم" },
  "What the till sells changed": { ar: "تعديل صنف بيع", ckb: "گۆڕینی جۆرێکی بەرهەم" },
  "What the till sells deleted": { ar: "حذف صنف بيع", ckb: "سڕینەوەی جۆرێکی بەرهەم" },
  "Category added": { ar: "إضافة فئة", ckb: "زیادکردنی پۆل" },
  "Category changed": { ar: "تعديل فئة", ckb: "گۆڕینی پۆل" },
  "Category deleted": { ar: "حذف فئة", ckb: "سڕینەوەی پۆل" },
  "Stock item added": { ar: "إضافة مادة مخزون", ckb: "زیادکردنی کاڵای کۆگا" },
  "Stock item changed": { ar: "تعديل مادة مخزون", ckb: "گۆڕینی کاڵای کۆگا" },
  "Stock item deleted": { ar: "حذف مادة مخزون", ckb: "سڕینەوەی کاڵای کۆگا" },
  "Pack unit added": { ar: "إضافة وحدة تعبئة", ckb: "زیادکردنی یەکەی پاکەت" },
  "Pack unit changed": { ar: "تعديل وحدة تعبئة", ckb: "گۆڕینی یەکەی پاکەت" },
  "Pack unit deleted": { ar: "حذف وحدة تعبئة", ckb: "سڕینەوەی یەکەی پاکەت" },
  "Supplier added": { ar: "إضافة مورّد", ckb: "زیادکردنی دابینکەر" },
  "Supplier changed": { ar: "تعديل مورّد", ckb: "گۆڕینی دابینکەر" },
  "Supplier deleted": { ar: "حذف مورّد", ckb: "سڕینەوەی دابینکەر" },
  "Business settings added": { ar: "إضافة إعدادات العمل", ckb: "زیادکردنی ڕێکخستنەکانی کار" },
  "Business settings changed": { ar: "تعديل إعدادات العمل", ckb: "گۆڕینی ڕێکخستنەکانی کار" },
  "Business settings deleted": { ar: "حذف إعدادات العمل", ckb: "سڕینەوەی ڕێکخستنەکانی کار" },
  "Location added": { ar: "إضافة موقع", ckb: "زیادکردنی شوێن" },
  "Location changed": { ar: "تعديل موقع", ckb: "گۆڕینی شوێن" },
  "Location deleted": { ar: "حذف موقع", ckb: "سڕینەوەی شوێن" },
  // What it was about (subjectIn): where subjectOf has no name…
  "A price": { ar: "سعر", ckb: "نرخێک" },
  "An item": { ar: "مادة", ckb: "کاڵایەک" },
  "a unit": { ar: "وحدة", ckb: "یەکەیەک" },
  "Business settings": { ar: "إعدادات العمل", ckb: "ڕێکخستنەکانی کار" },
  "A delivery": { ar: "توريد", ckb: "بارێک" },
  "A recipe": { ar: "وصفة", ckb: "ڕەسەتەیەک" },
  "An alert": { ar: "تنبيه", ckb: "ئاگادارییەک" },
  "Card takings": { ar: "مقبوضات البطاقات", ckb: "داهاتی کارت" },
  "A platform statement": { ar: "كشف منصة", ckb: "کەشفی پلاتفۆرمێک" },
  // …a record by its number…
  "Sale {id}": { ar: "البيع {id}", ckb: "فرۆشتنی {id}" },
  "Open bill {id}": { ar: "الفاتورة المفتوحة {id}", ckb: "پسووڵەی کراوەی {id}" },
  "Receipt {no}": { ar: "الإيصال {no}", ckb: "وەسڵی {no}" },
  "Supplier bill {no}": { ar: "فاتورة المورّد {no}", ckb: "پسووڵەی دابینکەر {no}" },
  "Journal {no}": { ar: "القيد {no}", ckb: "تۆماری {no}" },
  "Card takings {from} to {to}": {
    ar: "مقبوضات البطاقات من {from} إلى {to}",
    ckb: "داهاتی کارت لە {from} تا {to}",
  },
  "{platform} statement {reference}": {
    ar: "كشف {platform} رقم {reference}",
    ckb: "کەشفی {platform} ژمارە {reference}",
  },
  // …and a record with no name: what it is, before its id.
  Approval: { ar: "موافقة", ckb: "ڕەزامەندی" },
  "Cash transfer": { ar: "نقل نقد", ckb: "گواستنەوەی پارەی کاش" },
  "Work shift": { ar: "وردية عمل", ckb: "شەفتی کار" },
  "Stock count": { ar: "جرد المخزون", ckb: "ژماردنی کۆگا" },
  "Production batch": { ar: "دفعة إنتاج", ckb: "دەفعەیەکی بەرهەمهێنان" },
  // Each field changed (fieldLabel)…
  "In use": { ar: "قيد الاستخدام", ckb: "بەکاردێت" },
  Favourite: { ar: "مفضّل", ckb: "دڵخواز" },
  Type: { ar: "النوع", ckb: "جۆر" },
  "Base unit": { ar: "الوحدة الأساسية", ckb: "یەکەی بنەڕەت" },
  "Measured by": { ar: "نوع القياس", ckb: "جۆری پێوانە" },
  "Most to hold": { ar: "أقصى ما يُحفظ", ckb: "زۆرترین بڕی هەڵگرتن" },
  "Safety stock": { ar: "مخزون الأمان", ckb: "کۆگای یەدەگ" },
  "Back on the shelf when refunded": {
    ar: "يعود إلى الرف عند الاسترداد",
    ckb: "لە کاتی گەڕاندنەوەی پارە دەگەڕێتەوە سەر ڕەفە",
  },
  Phone: { ar: "الهاتف", ckb: "تەلەفۆن" },
  Label: { ar: "التسمية", ckb: "ناونیشان" },
  "Holds (base units)": { ar: "يحوي (بالوحدات الأساسية)", ckb: "دەگرێت (بە یەکەی بنەڕەت)" },
  Category: { ar: "الفئة", ckb: "پۆل" },
  "Order on the till": { ar: "الترتيب على نقطة البيع", ckb: "ڕیزبەندی لەسەر خاڵی فرۆشتن" },
  Photo: { ar: "الصورة", ckb: "وێنە" },
  Description: { ar: "الوصف", ckb: "وەسف" },
  "Sold as bought": { ar: "يُباع كما اشتُري", ckb: "وەک کڕدراوە دەفرۆشرێت" },
  "Uses no stock because": { ar: "لا يستخدم مخزونًا لأن", ckb: "کۆگا بەکارناهێنێت چونکە" },
  Ingredients: { ar: "المكوّنات", ckb: "پێکهاتەکان" },
  Value: { ar: "القيمة", ckb: "بەها" },
  "Round % discounts to": { ar: "تقريب الخصومات المئوية إلى", ckb: "خڕکردنەوەی داشکاندنی سەدی بۆ" },
  "Discounts a manager approves, over (%)": {
    ar: "الخصومات التي يوافق عليها المدير، فوق (%)",
    ckb: "ئەو داشکاندنانەی بەڕێوەبەر ڕەزامەندی لەسەر دەدات، سەرووی (%)",
  },
  "Bill numbers start": { ar: "بداية أرقام الفواتير", ckb: "سەرەتای ژمارەی پسووڵەکان" },
  "Waste needs approval over": {
    ar: "الهدر يحتاج إلى موافقة إذا تجاوز",
    ckb: "بەفیڕۆچوون پێویستی بە ڕەزامەندییە لە سەرووی",
  },
  "Refuse sales below zero stock": {
    ar: "رفض البيع حين ينزل المخزون دون الصفر",
    ckb: "ڕەتکردنەوەی فرۆشتن کاتێک کۆگا دەچێتە خوار سفر",
  },
  "Time zone": { ar: "المنطقة الزمنية", ckb: "ناوچەی کات" },
  Currency: { ar: "العملة", ckb: "دراو" },
  Language: { ar: "اللغة", ckb: "زمان" },
  Kind: { ar: "النوع", ckb: "جۆر" },
  Roles: { ar: "الأدوار", ckb: "ڕۆڵەکان" },
  "Alert thresholds": { ar: "حدود التنبيهات", ckb: "سنوورەکانی ئاگاداری" },
  Alert: { ar: "التنبيه", ckb: "ئاگاداری" },
  "What it said": { ar: "ما قاله", ckb: "ئەوەی وتی" },
  "Taken by card at the till": {
    ar: "المقبوض بالبطاقة على نقطة البيع",
    ckb: "وەرگیراو بە کارت لەسەر خاڵی فرۆشتن",
  },
  "Card fee": { ar: "رسوم البطاقة", ckb: "کرێی کارت" },
  Platform: { ar: "المنصة", ckb: "پلاتفۆرم" },
  Statement: { ar: "الكشف", ckb: "کەشف" },
  "Orders paid out": { ar: "الطلبات المدفوعة", ckb: "داواکارییە پارەدراوەکان" },
  "Their value": { ar: "قيمتها", ckb: "بەهاکەیان" },
  "Paid out": { ar: "المدفوع", ckb: "پارەدراو" },
  Commission: { ar: "العمولة", ckb: "کۆمیسیۆن" },
  "Short name": { ar: "الاسم المختصر", ckb: "ناوی کورت" },
  "In other languages": { ar: "بلغات أخرى", ckb: "بە زمانەکانی تر" },
  "Set up like": { ar: "مُعدّة مثل", ckb: "ڕێکخراوە وەک" },
  "Recipe lines given its packaging": {
    ar: "سطور الوصفة التي أُعطيت تغليفها",
    ckb: "هێڵەکانی ڕەسەتە کە پێچانەوەکەیان وەرگرت",
  },
  "Prices copied": { ar: "الأسعار المنسوخة", ckb: "نرخە لەبەرگیراوەکان" },
  // …including the fields the trail records that fieldLabel names from the key itself.
  "New tab": { ar: "الفاتورة الجديدة", ckb: "پسووڵە نوێیەکە" },
  Moved: { ar: "نُقل", ckb: "گوازرایەوە" },
  Percent: { ar: "النسبة", ckb: "ڕێژە" },
  Gross: { ar: "الإجمالي", ckb: "بڕی گشتی" },
  "Table id": { ar: "الطاولة", ckb: "مێز" },
  "Returned to stock": { ar: "أُعيد إلى المخزون", ckb: "گەڕایەوە کۆگا" },
  "Requested by": { ar: "بطلب من", ckb: "بە داوای" },
  Loss: { ar: "الخسارة", ckb: "زیان" },
  Approver: { ar: "الموافِق", ckb: "ڕەزامەندیدەر" },
  Variance: { ar: "الفرق", ckb: "جیاوازی" },
  "Taken to": { ar: "نُقل إلى", ckb: "برا بۆ" },
  Taken: { ar: "المأخوذ", ckb: "بردراو" },
  Start: { ar: "رصيد البداية", ckb: "پارەی سەرەتا" },
  Scope: { ar: "النطاق", ckb: "مەودا" },
  Records: { ar: "السجلات", ckb: "تۆمارەکان" },
  Legacy: { ar: "قديم", ckb: "کۆن" },
  Left: { ar: "المتروك", ckb: "بەجێهێڵراو" },
  "Invoice no": { ar: "رقم الفاتورة", ckb: "ژمارەی پسووڵە" },
  "Given by": { ar: "أعطاه", ckb: "دراوە لەلایەن" },
  Email: { ar: "البريد الإلكتروني", ckb: "ئیمەیڵ" },
  Delta: { ar: "التغيّر", ckb: "گۆڕان" },
  Gain: { ar: "الزيادة", ckb: "زیادە" },
  Allergens: { ar: "مسبّبات الحساسية", ckb: "هۆکارەکانی هەستیاری" },
  Sku: { ar: "رمز SKU", ckb: "کۆدی SKU" },
  Barcode: { ar: "الباركود", ckb: "بارکۆد" },
  "Track expiry": { ar: "تتبّع انتهاء الصلاحية", ckb: "بەدواداچوونی بەسەرچوون" },
  "Track lot": { ar: "تتبّع رقم التشغيلة", ckb: "بەدواداچوونی ژمارەی دەفعە" },
  "Currency decimals": { ar: "المنازل العشرية للعملة", ckb: "ژمارە دەیەکییەکانی دراو" },
  "Currency symbol": { ar: "رمز العملة", ckb: "هێمای دراو" },
  "Promotion id": { ar: "العرض الترويجي", ckb: "ئۆفەر" },
  // …and the values it gives them (valueIn).
  "the defaults": { ar: "القيم الافتراضية", ckb: "بەها بنەڕەتییەکان" },

  // ------------------------------------------------------------ Dashboard
  "Inventory (1200)": { ar: "المخزون (1200)", ckb: "کۆگا (1200)" },
  "{n} reconciliation difference(s)": {
    ar: "فروق المطابقة: {n}",
    ckb: "{n} جیاوازیی بەراوردکردن",
  },
  "Books reconcile": { ar: "الدفاتر متطابقة", ckb: "دەفتەرەکان یەکدەگرنەوە" },
  "Revenue and cost of sales are read from today's published journal lines — the same figures the profit and loss will show. Gross profit here is after everything in cost of sales: waste, count differences, purchase price differences and platform fees. Open a figure to see what is behind it.":
    {
      ar: "تُقرأ الإيرادات وتكلفة المبيعات من سطور القيود المنشورة اليوم — وهي الأرقام نفسها التي سيُظهرها كشف الأرباح والخسائر. وإجمالي الربح هنا بعد كل ما في تكلفة المبيعات: الهدر، وفروق الجرد، وفروق أسعار الشراء، ورسوم المنصات. افتح أي رقم لترى ما وراءه.",
      ckb: "داهات و تێچووی فرۆشتن لە هێڵەکانی تۆماری بڵاوکراوەی ئەمڕۆ دەخوێنرێنەوە — هەمان ئەو ژمارانەی ڕاپۆرتی قازانج و زیان پیشانیان دەدات. قازانجی گشتی لێرەدا دوای هەموو ئەو شتانەیە کە لە تێچووی فرۆشتندان: بەفیڕۆچوون، جیاوازییەکانی ژماردن، جیاوازییەکانی نرخی کڕین و کرێی پلاتفۆرمەکان. ژمارەیەک بکەرەوە بۆ ئەوەی ببینیت چی لە پشتیەتی.",
    },
  "No items yet.": { ar: "لا مواد بعد.", ckb: "هێشتا هیچ کاڵایەک نییە." },
  "All above reorder level": {
    ar: "الكل فوق حد إعادة الطلب",
    ckb: "هەمووی لە سەرووی ئاستی داواکردنەوەیە",
  },
  "Recent sales": { ar: "آخر المبيعات", ckb: "دوایین فرۆشتنەکان" },
  "No sales yet.": { ar: "لا مبيعات بعد.", ckb: "هێشتا هیچ فرۆشتنێک نییە." },

  // What needs you
  "{n} answered or snoozed, below: each stays until it clears.": {
    ar: "المُجاب عنها أو المؤجلة: {n}، في الأسفل: يبقى كلٌّ منها حتى يزول سببه.",
    ckb: "{n} وەڵامدراوە یان دواخراوە، لە خوارەوە: هەریەکەیان دەمێنێتەوە تا هۆکارەکەی نامێنێت.",
  },
  "Every rule has been checked against the books just now.": {
    ar: "فُحصت كل القواعد مقابل الدفاتر للتو.",
    ckb: "هەموو ڕێساکان ئێستا لەگەڵ دەفتەرەکان پشکنران.",
  },
  "How sure the rule is": { ar: "مدى يقين القاعدة", ckb: "ڕێساکە تا چەند دڵنیایە" },
  "Answered by {name} ({when}): “{note}”": {
    ar: "أجاب {name} ({when}): «{note}»",
    ckb: "{name} وەڵامی دایەوە ({when}): «{note}»",
  },
  "Snoozed until {day} by {name}: “{reason}”": {
    ar: "أجّله {name} حتى {day}: «{reason}»",
    ckb: "{name} تا {day} دوای خست: «{reason}»",
  },
  Answer: { ar: "أجب", ckb: "وەڵام بدەوە" },
  "Answer again": { ar: "أجب مرة أخرى", ckb: "دووبارە وەڵام بدەوە" },
  Snooze: { ar: "تأجيل", ckb: "دواخستن" },
  until: { ar: "حتى", ckb: "تا" },
  "Snooze until": { ar: "التأجيل حتى", ckb: "دواخستن تا" },
  "What was done, or why it is fine": {
    ar: "ما الذي فُعل، أو لماذا لا مشكلة",
    ckb: "چی کرا، یان بۆچی کێشە نییە",
  },
  "Why it can wait": { ar: "لماذا يمكن أن ينتظر", ckb: "بۆچی دەتوانێت چاوەڕێ بکات" },
  "Save the answer": { ar: "احفظ الإجابة", ckb: "وەڵامەکە پاشەکەوت بکە" },
  "Snooze it": { ar: "أجّله", ckb: "دوای بخە" },

  // Yesterday's brief
  "Open now: 🔴 {red} · 🟠 {orange} — each above, with what to do.": {
    ar: "المفتوح الآن: 🔴 {red} · 🟠 {orange} — كلٌّ منها في الأعلى، مع ما يجب فعله.",
    ckb: "ئێستا کراوە: 🔴 {red} · 🟠 {orange} — هەریەکەیان لە سەرەوەیە، لەگەڵ ئەوەی دەبێت بکرێت.",
  },

  // ------------------------------------- Messages (src/lib/actions/alerts.ts)
  "the alert": { ar: "التنبيه", ckb: "ئاگادارییەکە" },
  "Say what was done about it, or why it is fine": {
    ar: "اذكر ما فُعل بشأنه، أو لماذا لا مشكلة فيه",
    ckb: "بڵێ چی بۆ کرا، یان بۆچی کێشەی نییە",
  },
  "Keep the note under 300 characters": {
    ar: "اجعل الملاحظة أقل من 300 حرف",
    ckb: "با تێبینییەکە لە 300 پیت کەمتر بێت",
  },
  "Say why it can wait": { ar: "اذكر لماذا يمكن أن ينتظر", ckb: "بڵێ بۆچی دەتوانێت چاوەڕێ بکات" },
  "Keep the reason under 300 characters": {
    ar: "اجعل السبب أقل من 300 حرف",
    ckb: "با هۆکارەکە لە 300 پیت کەمتر بێت",
  },
  // How an item is measured, as the audit trail gives it (Measured by: mass).
  mass: { ar: "بالوزن", ckb: "بە کێش" },
  volume: { ar: "بالحجم", ckb: "بە قەبارە" },
  count: { ar: "بالعدد", ckb: "بە ژمارە" },
};

export default phrases;
