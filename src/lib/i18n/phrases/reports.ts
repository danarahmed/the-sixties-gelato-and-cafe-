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
  "{n} of {total} checks do not tie": {
    ar: "{n} من {total} فحوص غير متطابقة",
    ckb: "{n} لە {total} پشکنین یەکناگرنەوە",
  },
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

  // -------------------------------------------------------------- Orders
  "A sale is never edited. A sale rung in error is <b>voided</b> until the drawer's session holding it closes — revenue, payment, cost and stock all come back exactly. After that, money goes back to the customer by a <b>refund</b> of some of its items or all of them, through Sales returns, the way it was paid; only goods that can go back on the shelf return to stock. Both take a reason from the list and are on the audit trail; one approved by a second person (their name and PIN) is marked so, and one without waits for the owner on the exceptions report.":
    {
      ar: "لا يُعدَّل البيع أبدًا. البيع المسجَّل خطأً <b>يُلغى</b> ما دامت وردية الدرج التي تحويه لم تُغلق بعد — فتعود الإيرادات والدفعة والكلفة والمخزون كما كانت تمامًا. بعد ذلك يعود المال إلى الزبون عبر <b>استرداد</b> بعض مواده أو كلها، من خلال مردودات المبيعات وبالطريقة التي دُفع بها؛ ولا يعود إلى المخزون إلا ما يمكن إرجاعه إلى الرف. كلاهما يأخذ سببًا من القائمة ويُسجَّل في سجل التدقيق؛ وما وافق عليه شخص ثانٍ (باسمه ورمز PIN الخاص به) يُعلَّم بذلك، وما لم يوافق عليه أحد ينتظر المالك في تقرير الاستثناءات.",
      ckb: "فرۆشتن هەرگیز دەستکاری ناکرێت. فرۆشتنێک کە بە هەڵە تۆمار کراوە <b>هەڵدەوەشێنرێتەوە</b> تا ئەو شیفتەی دەخیلەکە کە تێیدایە دانەخرێت — داهات، پارەدان، تێچوو و کۆگا هەموویان ڕێک وەک خۆیان دەگەڕێنەوە. دوای ئەوە، پارە بە <b>گەڕاندنەوەی پارەی</b> هەندێک یان هەموو کاڵاکانی دەدرێتەوە بە کڕیار، لە ڕێگەی گەڕاوەکانی فرۆشتن و بەو شێوەیەی پارەکەی پێدرابوو؛ تەنها ئەو کاڵایانە دەگەڕێنەوە کۆگا کە دەتوانرێت بخرێنەوە سەر ڕەفە. هەردووکیان هۆکارێک لە لیستەکە وەردەگرن و لە تۆماری گۆڕانکارییەکاندا دەنووسرێن؛ ئەوەی کەسێکی دووەم (بە ناو و PIN ی خۆی) ڕەزامەندی لەسەر دابێت ئەمەی لەسەر دەنووسرێت، و ئەوەی بێ ئەوە بێت لە ڕاپۆرتی ئاوارتەکاندا چاوەڕێی خاوەن دەکات.",
    },
  "Every channel": { ar: "كل القنوات", ckb: "هەموو کەناڵەکان" },
  "The latest sales": { ar: "آخر المبيعات", ckb: "دوایین فرۆشتنەکان" },
  "Show the latest 300": { ar: "اعرض آخر 300", ckb: "دوایین 300 پیشان بدە" },
  // Find a sale (P2-20).
  "Find a sale": { ar: "ابحث عن بيع", ckb: "فرۆشتنێک بدۆزەوە" },
  "Sale or journal number, platform order, customer": {
    ar: "رقم البيع أو القيد، طلب المنصة، الزبون",
    ckb: "ژمارەی فرۆشتن یان تۆمار، داواکاری پلاتفۆرم، کڕیار",
  },
  "Completed sales found for “{q}”": {
    ar: "المبيعات المكتملة التي وُجدت لـ «{q}»",
    ckb: "فرۆشتنە تەواوبووەکانی دۆزراوە بۆ «{q}»",
  },
  "No sale matches “{q}”": {
    ar: "لا يوجد بيع يطابق «{q}»",
    ckb: "هیچ فرۆشتنێک لەگەڵ «{q}» ناگونجێت",
  },
  "Type the sale number printed after “Sale” on the receipt, its journal number, a refund's number, the platform's order number, or the customer's name or phone.":
    {
      ar: "اكتب رقم البيع المطبوع بعد «بيع» على الإيصال، أو رقم قيده، أو رقم استرداد، أو رقم طلب المنصة، أو اسم الزبون أو هاتفه.",
      ckb: "ئەو ژمارەی فرۆشتنە بنووسە کە لە پسوولەکەدا دوای «فرۆشتن» چاپ کراوە، یان ژمارەی تۆمارەکەی، یان ژمارەی گەڕاندنەوەیەک، یان ژمارەی داواکاری پلاتفۆرم، یان ناو یان تەلەفۆنی کڕیار.",
    },
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

  // Refunds by the item (RefundDialog, 0037)
  "Refund {no}: {amount} for {items}": {
    ar: "الاسترداد {no}: {amount} عن {items}",
    ckb: "گەڕاندنەوەی {no}: {amount} بۆ {items}",
  },
  "Refund sale {sale}": { ar: "استرداد البيع {sale}", ckb: "گەڕاندنەوەی پارەی فرۆشتنی {sale}" },
  "On the sale": { ar: "في البيع", ckb: "لەسەر فرۆشتنەکە" },
  "Given back": { ar: "ما أُعيد", ckb: "گەڕێندراوە" },
  "Refund now": { ar: "يُسترد الآن", ckb: "ئێستا دەگەڕێندرێتەوە" },
  "Gives back": { ar: "يُعيد", ckb: "دەگەڕێنێتەوە" },
  "How many of {name} go back": { ar: "كم من {name} يُعاد", ckb: "چەند دانە لە {name} دەگەڕێتەوە" },
  "all given back": { ar: "أُعيد كله", ckb: "هەمووی گەڕێندراوەتەوە" },
  "Gives back {amount} {how}": { ar: "يُعيد {amount} {how}", ckb: "{amount} دەگەڕێنێتەوە {how}" },
  "in cash, from the drawer": { ar: "نقدًا، من الدرج", ckb: "بە نەختینە، لە دەخیلەکەوە" },
  "to the card it was paid with": {
    ar: "إلى البطاقة التي دُفع بها",
    ckb: "بۆ ئەو کارتەی پارەکەی پێدرابوو",
  },
  "off what the platform owes": {
    ar: "خصمًا مما تدين به المنصة",
    ckb: "لەوەی پلاتفۆرمەکە قەرزارە کەم دەکرێتەوە",
  },
  "Only {left} of {name} is left to refund": {
    ar: "لم يبقَ من {name} للاسترداد إلا {left}",
    ckb: "تەنها {left} لە {name} ماوە بۆ گەڕاندنەوە",
  },
  "Type how many of {name} go back": {
    ar: "اكتب كم من {name} يُعاد",
    ckb: "بنووسە چەند دانە لە {name} دەگەڕێتەوە",
  },
  "Refund {no}: {amount} given back {how} (journal {journal}).": {
    ar: "الاسترداد {no}: أُعيد {amount} {how} (القيد {journal}).",
    ckb: "گەڕاندنەوەی {no}: {amount} گەڕێندرایەوە {how} (تۆماری {journal}).",
  },
  "Nothing of the sale is left to refund.": {
    ar: "لم يبقَ من البيع شيء للاسترداد.",
    ckb: "هیچ شتێک لە فرۆشتنەکە بۆ گەڕاندنەوە نەماوە.",
  },
  "The rest of the sale can still be refunded.": {
    ar: "ما زال بالإمكان استرداد بقية البيع.",
    ckb: "هێشتا دەتوانرێت پارەی ئەوەی لە فرۆشتنەکە ماوە بگەڕێندرێتەوە.",
  },
  "Print the refund slip": { ar: "اطبع قسيمة الاسترداد", ckb: "پسووڵەی گەڕاندنەوەی پارە چاپ بکە" },
  "Refunded so far": { ar: "المسترد حتى الآن", ckb: "تا ئێستا گەڕێندراوە" },
  "Back on the shelf, at cost": {
    ar: "أُعيد إلى الرف، بالكلفة",
    ckb: "گەڕایەوە سەر ڕەفە، بە تێچوو",
  },

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
  "Stock count started": { ar: "بدء جرد", ckb: "دەستپێکردنی ژماردنی کۆگا" },
  "Stock count handed in": { ar: "تسليم جرد", ckb: "ڕادەستکردنی ژماردنی کۆگا" },
  "Stock count sent back": { ar: "إعادة جرد للعدّ", ckb: "گەڕاندنەوەی ژماردنی کۆگا" },
  "Loss recorded": { ar: "تسجيل خسارة مخزون", ckb: "تۆمارکردنی زیانی کۆگا" },
  "Batch recorded": { ar: "تسجيل دفعة إنتاج", ckb: "تۆمارکردنی دەفعەیەکی بەرهەمهێنان" },
  "Delivery received": { ar: "استلام توريد", ckb: "وەرگرتنی بار" },
  "Supplier bill recorded": { ar: "تسجيل فاتورة مورّد", ckb: "تۆمارکردنی پسووڵەی دابینکەر" },
  "Supplier bill paid": { ar: "دفع فاتورة مورّد", ckb: "پارەدانی پسووڵەی دابینکەر" },
  "Expense recorded": { ar: "تسجيل مصروف", ckb: "تۆمارکردنی خەرجی" },
  "Table saved": { ar: "حفظ طاولة", ckb: "پاشەکەوتکردنی مێز" },
  "Journal saved": { ar: "حفظ قيد", ckb: "پاشەکەوتکردنی تۆمار" },
  "Journal published": { ar: "نشر قيد", ckb: "بڵاوکردنەوەی تۆمار" },
  "Draft journal discarded": { ar: "حذف مسودة قيد", ckb: "فڕێدانی ڕەشنووسی تۆمار" },
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
  "Everything cleared to start fresh": {
    ar: "مسح كل شيء للبدء من جديد",
    ckb: "سڕینەوەی هەموو شتێک بۆ دەستپێکردنەوە لە سەرەتاوە",
  },
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
  "An expense": { ar: "مصروف", ckb: "خەرجییەک" },
  "A batch": { ar: "دفعة", ckb: "دەفعەیەک" },
  "A stock count": { ar: "جرد", ckb: "ژماردنێکی کۆگا" },
  "A table": { ar: "طاولة", ckb: "مێزێک" },
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
  "Batch recipe": { ar: "وصفة الدفعة", ckb: "ڕەسەتەی دەفعە" },
  Area: { ar: "المنطقة", ckb: "ناوچە" },
  Seats: { ar: "المقاعد", ckb: "کورسییەکان" },
  "Kind of loss": { ar: "نوع الخسارة", ckb: "جۆری زیان" },
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
  "These are the profit and loss's own figures for today. Gross profit is after waste, count differences, price differences on deliveries and platform fees. Open a figure to see what is behind it.":
    {
      ar: "هذه أرقام الأرباح والخسائر نفسها لليوم. إجمالي الربح بعد الهدر وفروق الجرد وفروق الأسعار في التوريدات ورسوم المنصات. افتح أي رقم لترى ما وراءه.",
      ckb: "ئەمانە هەمان ژمارەکانی قازانج و زیانن بۆ ئەمڕۆ. کۆی قازانج دوای بەفیڕۆچوون، جیاوازی ژماردن، جیاوازی نرخ لە گەیاندنەکان و کرێی پلاتفۆڕمەکانە. هەر ژمارەیەک بکەرەوە بۆ بینینی ئەوەی لە پشتیەتی.",
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
  // The audit trail of cash sessions (0036).
  "Drawer opened": {
    ar: "فتح درج النقد",
    ckb: "کردنەوەی دەخیلە",
  },
  "Drawer closed": {
    ar: "إغلاق درج النقد",
    ckb: "داخستنی دەخیلە",
  },
  "Drawer handed over": {
    ar: "تسليم درج النقد",
    ckb: "ڕادەستکردنی دەخیلە",
  },
  "Drawer closed by a manager": {
    ar: "إغلاق درج النقد من قِبل مدير",
    ckb: "داخستنی دەخیلە لەلایەن بەڕێوەبەرەوە",
  },
  "Took over from the drawer counts": {
    ar: "استلمت من عدّات الدرج السابقة",
    ckb: "لە ژماردنەکانی پێشووی دەخیلەوە وەرگیرا",
  },
  "Put in from the safe": {
    ar: "وُضع من الخزنة",
    ckb: "لە قاسەوە دانرا",
  },
  "Notes counted": {
    ar: "الأوراق النقدية المعدودة",
    ckb: "پارە کاغەزییە ژمێردراوەکان",
  },
  "Next session": {
    ar: "الوردية التالية",
    ckb: "شیفتی داهاتوو",
  },
  "Taken over by": {
    ar: "استلمها",
    ckb: "وەریگرت",
  },
  "A drawer count": {
    ar: "عدّ لدرج النقد",
    ckb: "ژماردنێکی دەخیلە",
  },

  // The books checked account by account, and the records to look into (0038).
  "Card takings not yet settled vs Card clearing (1010)": {
    ar: "مقبوضات البطاقات غير المسوّاة مقابل مقاصّة البطاقات (1010)",
    ckb: "داهاتی کارتی یەکلانەکراوە بەرامبەر پاکتاوی کارت (1010)",
  },
  "Orders the platforms owe vs Receivable from platforms (1100)": {
    ar: "الطلبات المستحقة على المنصات مقابل ذمم المنصات (1100)",
    ckb: "ئەو داواکارییانەی پلاتفۆرمەکان قەرزارن بەرامبەر قەرزی پلاتفۆرمەکان (1100)",
  },
  "What the drawers should hold vs Cash in the till (1000)": {
    ar: "ما يجب أن تحويه الأدراج مقابل نقد درج الصندوق (1000)",
    ckb: "ئەوەی دەبێت لە دەخیلەکاندا بێت بەرامبەر پارەی نەختینەی ناو دەخیلە (1000)",
  },
  "What the drawers should hold vs Cash in the till (1000): not yet counted, the first opening settles it":
    {
      ar: "ما يجب أن تحويه الأدراج مقابل نقد درج الصندوق (1000): لم يُعدّ بعد، وأول فتح يسوّي الفرق",
      ckb: "ئەوەی دەبێت لە دەخیلەکاندا بێت بەرامبەر پارەی نەختینەی ناو دەخیلە (1000): هێشتا نەژمێردراوە، یەکەم کردنەوە جیاوازییەکە یەکلا دەکاتەوە",
    },
  "Cash moved in and out of the safe vs Safe (1005)": {
    ar: "النقد المنقول إلى الخزنة ومنها مقابل النقد في الخزنة (1005)",
    ckb: "پارەی گوازراوە بۆ ناو قاسە و لێیەوە بەرامبەر پارەی نەختینەی ناو قاسە (1005)",
  },
  "Every record has its one journal, and every automatic journal its record": {
    ar: "لكل سجل قيده الواحد، ولكل قيد آلي سجله",
    ckb: "هەر بەڵگەیەک یەک تۆماری هەیە، و هەر تۆمارێکی خۆکار بەڵگەی خۆی هەیە",
  },
  "Delivery correction": { ar: "تصحيح توريد", ckb: "ڕاستکردنەوەی بار" },
  "Drawer session": { ar: "وردية الدرج", ckb: "شیفتی دەخیلە" },
  "Platform statement": { ar: "كشف المنصة", ckb: "کەشفی پلاتفۆرم" },
  "What is wrong": { ar: "ما الخطأ", ckb: "چی هەڵەیە" },
  none: { ar: "لا شيء", ckb: "هیچ" },
  "Records to look into": { ar: "سجلات تحتاج إلى مراجعة", ckb: "بەڵگەکان بۆ سەرنجدان" },

  // Sizes and add-ons (0041): the report, and their changes on the audit trail.
  "Sold {from} to {to}, at the prices and costs of each sale; voids left out": {
    ar: "المُباع من {from} إلى {to}، بأسعار كل بيع وكلفته؛ دون الملغاة",
    ckb: "فرۆشراو لە {from} تا {to}، بە نرخ و تێچووی هەر فرۆشتنێک؛ هەڵوەشێنراوەکان لابراون",
  },
  "No product was sold in more than one size, and no add-on was taken, in these dates.": {
    ar: "لم يُبع أي منتج بأكثر من حجم، ولم تؤخذ أي إضافة، في هذه التواريخ.",
    ckb: "لەم بەروارانەدا هیچ بەرهەمێک بە زیاتر لە یەک قەبارە نەفرۆشرا، و هیچ زیادەیەک وەرنەگیرا.",
  },
  Group: { ar: "المجموعة", ckb: "کۆمەڵە" },
  "Add-on": { ar: "الإضافة", ckb: "زیادە" },
  "On lines": { ar: "على السطور", ckb: "لەسەر هێڵەکان" },
  "Of the lines offered it": { ar: "من السطور التي عُرضت عليها", ckb: "لەو هێڵانەی پێشکەش کراوە" },
  "A size's figures leave out its add-ons, which are counted on their own, each with its share of the line's discount. Refunds are not taken off here: Sales by Channel has them. How often an add-on is taken is out of the lines of the products that offer it today.":
    {
      ar: "أرقام الحجم لا تشمل إضافاته، فهي تُحتسب وحدها، ولكل منها حصتها من خصم السطر. المرتجعات لا تُطرح هنا: تجدها في المبيعات حسب القناة. نسبة أخذ الإضافة هي من سطور المنتجات التي تقدّمها اليوم.",
      ckb: "ژمارەکانی قەبارەیەک زیادەکانی تێدا نییە، ئەوان بە جیا هەژمار دەکرێن، هەریەکە بە بەشی خۆی لە داشکاندنی هێڵەکە. گەڕاندنەوەکان لێرە کەم ناکرێنەوە: فرۆشتن بەپێی کەناڵ ئەوانی تێدایە. ڕێژەی وەرگرتنی زیادەیەک لە هێڵەکانی ئەو بەرهەمانەیە کە ئەمڕۆ پێشکەشی دەکەن.",
    },
  "Add-ons offered changed": { ar: "تغيير الإضافات المقدّمة", ckb: "گۆڕینی زیادە پێشکەشکراوەکان" },
  "Add-on price set": { ar: "تحديد سعر إضافة", ckb: "دانانی نرخی زیادەیەک" },
  "What an add-on uses changed": {
    ar: "تغيير ما تستخدمه إضافة",
    ckb: "گۆڕینی ئەوەی زیادەیەک بەکاری دەهێنێت",
  },
  "Group of add-ons added": { ar: "إنشاء مجموعة إضافات", ckb: "دروستکردنی کۆمەڵەیەکی زیادە" },
  "Group of add-ons changed": { ar: "تغيير مجموعة إضافات", ckb: "گۆڕینی کۆمەڵەیەکی زیادە" },
  "Group of add-ons deleted": { ar: "حذف مجموعة إضافات", ckb: "سڕینەوەی کۆمەڵەیەکی زیادە" },
  "Add-on added": { ar: "إدراج إضافة", ckb: "دانانی زیادەیەک" },
  "Add-on changed": { ar: "تغيير إضافة", ckb: "گۆڕینی زیادەیەک" },
  "Add-on deleted": { ar: "حذف إضافة", ckb: "سڕینەوەی زیادەیەک" },
  "Fewest to choose": { ar: "أقلّ عدد للاختيار", ckb: "کەمترین بۆ هەڵبژاردن" },
  "Most to choose": { ar: "أكبر عدد للاختيار", ckb: "زۆرترین بۆ هەڵبژاردن" },
  "Group of add-ons": { ar: "مجموعة الإضافات", ckb: "کۆمەڵەی زیادە" },
  "Groups of add-ons": { ar: "مجموعات الإضافات", ckb: "کۆمەڵەکانی زیادە" },
  "Copied from": { ar: "منسوخة من", ckb: "لەبەرگیراوە لە" },
  "An add-on": { ar: "إضافة", ckb: "زیادەیەک" },

  // Reports → Sales by payment method (0042).
  "Sales by payment method": { ar: "المبيعات حسب طريقة الدفع", ckb: "فرۆشتن بەپێی شێوازی پارەدان" },
  "Paid by": { ar: "مدفوع بـ", ckb: "پارەدراو بە" },
  Takings: { ar: "المقبوضات", ckb: "پارەی وەرگیراو" },
  "Change given": { ar: "الباقي المُعاد", ckb: "باقیی دراوە" },
  "All payments": { ar: "كل الدفعات", ckb: "هەموو پارەدانەکان" },
  "{n} paid two ways": { ar: "{n} دُفعت بطريقتين", ckb: "{n} بە دوو شێواز پارەیان دراوە" },
  "A sale paid part in cash and part by card counts under each, for the part it paid. Cash is what the sale kept: the change went back to the customer. The net matches the sales by channel.":
    {
      ar: "البيعة المدفوع جزء منها نقدًا وجزء بالبطاقة تُحسب تحت كل منهما، بقدر الجزء الذي دفعه. النقد هو ما احتفظت به البيعة: الباقي أُعيد إلى الزبون. الصافي يطابق المبيعات حسب القناة.",
      ckb: "فرۆشتنێک کە بەشێکی بە کاش و بەشێکی بە کارت پارەی دراوە، لە ژێر هەردووکیاندا دەژمێردرێت، بەپێی ئەو بەشەی دای. کاش ئەوەیە کە فرۆشتنەکە هێشتییەوە: باقییەکە بۆ کڕیار گەڕایەوە. پوختەکە لەگەڵ فرۆشتن بەپێی کەناڵ یەک دەگرێتەوە.",
    },
  // A refund of a sale paid more than one way (0042).
  "Gives back {amount}: {parts}": {
    ar: "يُعيد {amount}: {parts}",
    ckb: "{amount} دەگەڕێنێتەوە: {parts}",
  },
  "Refund {no}: {amount} given back: {parts} (journal {journal}).": {
    ar: "الاسترداد {no}: أُعيد {amount}: {parts} (القيد {journal}).",
    ckb: "گەڕاندنەوەی {no}: {amount} گەڕێندرایەوە: {parts} (تۆماری {journal}).",
  },

  // The dollars (0043): the report, the check against the books, the audit trail.
  "Taken, counted and exchanged {from} to {to}; held now": {
    ar: "المأخوذ والمعدود والمصروف من {from} إلى {to}؛ والمحتفظ به الآن",
    ckb: "وەرگیراو، ژمێردراو و گۆڕدراو لە {from} تا {to}؛ و ئەوەی ئێستا هەیە",
  },
  "No sale was paid in dollars in these dates.": {
    ar: "لم يُدفع أي بيع بالدولار في هذه التواريخ.",
    ckb: "لەم بەروارانەدا هیچ فرۆشتنێک بە دۆلار نەدرا.",
  },
  "{sales} sale(s) paid in dollars: {usd}, taken at {value}; they paid {paid}, and {change} went back as change in dinars.":
    {
      ar: "{sales, plural, one {بيع واحد دُفع} two {بيعان دُفعا} few {# بيوع دُفعت} many {# بيعًا دُفعت} other {# بيع دُفعت}} بالدولار: {usd}، أُخذت بقيمة {value}؛ دفعت {paid}، وأُعيد {change} باقيًا بالدينار.",
      ckb: "{sales} فرۆشتن بە دۆلار دران: {usd}، بە بەهای {value} وەرگیران؛ {paid}یان دا، و {change} وەک باقی بە دینار گەڕایەوە.",
    },
  "Should have held": { ar: "كان يجب أن يحوي", ckb: "دەبوو تێیدا بێت" },
  "Exchange differences {exchanges} (6950) · dollars counted over or short {counts} (6300) · held now: the safe {safe}":
    {
      ar: "فروق الصرف {exchanges} (6950) · زيادة/عجز الدولارات المعدودة {counts} (6300) · المحتفظ به الآن: الخزنة {safe}",
      ckb: "جیاوازی ئاڵوگۆڕ {exchanges} (6950) · زیادە/کەمی دۆلاری ژمێردراو {counts} (6300) · ئەوەی ئێستا هەیە: قاسە {safe}",
    },
  "Dollars held, at what they were taken at, vs Cash in dollars (1001 and 1006)": {
    ar: "الدولارات المحتفظ بها، بقيمة أخذها، مقابل النقد بالدولار (1001 و1006)",
    ckb: "دۆلاری هەڵگیراو، بە بەهای وەرگرتنیان، بەرامبەر پارەی نەختینەی دۆلار (1001 و 1006)",
  },
  "Dollar rate set": { ar: "تحديد سعر الدولار", ckb: "دانانی نرخی دۆلار" },
  "Dollars exchanged for dinars": { ar: "صرف دولارات بالدينار", ckb: "گۆڕینەوەی دۆلار بە دینار" },
  "The dollar rate": { ar: "سعر الدولار", ckb: "نرخی دۆلار" },
  "An exchange of dollars": { ar: "صرف دولارات", ckb: "گۆڕینەوەی دۆلار" },
  "Dollars it should hold": {
    ar: "الدولارات التي يجب أن يحويها",
    ckb: "ئەو دۆلارانەی دەبێت تێیدا بن",
  },
  "Dollars over / short": { ar: "زيادة / عجز الدولارات", ckb: "زیادە / کەمی دۆلار" },
  "Dollars left uncounted": { ar: "دولارات تُركت بلا عدّ", ckb: "دۆلاری نەژمێردراو کە جێهێڵدرا" },
  "Dollar notes counted": { ar: "أوراق الدولار المعدودة", ckb: "دراوە دۆلارییە ژمێردراوەکان" },

  // Purchasing (0044): the report, a record to look into, and the audit trail.
  "Orders, prices, returns and credits, {from} to {to}": {
    ar: "الطلبيات والأسعار والمرتجعات والإشعارات الدائنة، من {from} إلى {to}",
    ckb: "داواکارییەکان، نرخەکان، گەڕاندنەوەکان و پسووڵەکانی گەڕاندنەوە، لە {from} تا {to}",
  },
  "No purchase order was made in these dates.": {
    ar: "لم تُصدَر أي طلبية شراء في هذه التواريخ.",
    ckb: "لەم بەروارانەدا هیچ داواکارییەکی کڕین نەکرا.",
  },
  "{n} order(s) open, waiting for goods: {list}": {
    ar: "طلبيات مفتوحة بانتظار البضاعة ({n}): {list}",
    ckb: "داواکاری کراوە کە چاوەڕێی کاڵان ({n}): {list}",
  },
  "Prices that changed from the supplier's delivery before": {
    ar: "أسعار تغيّرت عن توريد المورّد السابق",
    ckb: "ئەو نرخانەی لە باری پێشووی دابینکەرەکەوە گۆڕاون",
  },
  Before: { ar: "السابق", ckb: "پێشتر" },
  Now: { ar: "الآن", ckb: "ئێستا" },
  "{cost} a {unit}": { ar: "{cost} لكل {unit}", ckb: "{cost} بۆ هەر {unit}" },
  "Returns to suppliers": { ar: "المرتجعات إلى المورّدين", ckb: "گەڕاندنەوەکان بۆ دابینکەران" },
  "Suppliers' credits": {
    ar: "الإشعارات الدائنة من المورّدين",
    ckb: "پسووڵەکانی گەڕاندنەوەی دابینکەران",
  },
  "Returned {returned} · credited {credited} · credits not yet set against a bill {left}": {
    ar: "المُرجَع {returned} · الإشعارات الدائنة {credited} · إشعارات لم تُخصم من فاتورة بعد {left}",
    ckb: "گەڕێندراوە {returned} · پسووڵەی گەڕاندنەوە {credited} · ئەوانەی هێشتا لە پسووڵەیەک نەبڕدراون {left}",
  },
  "Return to a supplier": { ar: "مرتجع إلى مورّد", ckb: "گەڕاندنەوە بۆ دابینکەرێک" },
  "Supplier's credit": { ar: "إشعار دائن من مورّد", ckb: "پسووڵەی گەڕاندنەوەی دابینکەر" },
  "Purchase order drafted": { ar: "كتابة مسودة طلبية شراء", ckb: "نووسینی ڕەشنووسی داواکاری کڕین" },
  "Purchase order changed": { ar: "تعديل طلبية شراء", ckb: "گۆڕینی داواکاری کڕین" },
  "Purchase order approved": { ar: "اعتماد طلبية شراء", ckb: "پەسەندکردنی داواکاری کڕین" },
  "Purchase order sent": { ar: "إرسال طلبية شراء", ckb: "ناردنی داواکاری کڕین" },
  "Purchase order closed": { ar: "إغلاق طلبية شراء", ckb: "داخستنی داواکاری کڕین" },
  "Purchase order cancelled": { ar: "إلغاء طلبية شراء", ckb: "هەڵوەشاندنەوەی داواکاری کڕین" },
  "More than ordered, confirmed": {
    ar: "تأكيد استلام أكثر من المطلوب",
    ckb: "پشتڕاستکردنەوەی وەرگرتنی زیاتر لە داواکراو",
  },
  "Goods returned to a supplier": {
    ar: "إرجاع بضاعة إلى مورّد",
    ckb: "گەڕاندنەوەی کاڵا بۆ دابینکەرێک",
  },
  "Supplier's credit note recorded": {
    ar: "تسجيل إشعار دائن من مورّد",
    ckb: "تۆمارکردنی پسووڵەی گەڕاندنەوەی دابینکەر",
  },
  "Supplier's note matched to a credit": {
    ar: "مطابقة إشعار المورّد مع إشعار دائن",
    ckb: "یەکخستنی پسووڵەی دابینکەر لەگەڵ پسووڵەیەکی گەڕاندنەوە",
  },
  "Credit set against a bill": {
    ar: "خصم إشعار دائن من فاتورة",
    ckb: "بڕینی پسووڵەی گەڕاندنەوە لە پسووڵەیەک",
  },
  "A purchase order": { ar: "طلبية شراء", ckb: "داواکارییەکی کڕین" },
  "A return to a supplier": { ar: "مرتجع إلى مورّد", ckb: "گەڕاندنەوەیەک بۆ دابینکەرێک" },
  "A supplier's credit": { ar: "إشعار دائن من مورّد", ckb: "پسووڵەیەکی گەڕاندنەوەی دابینکەر" },
  "Return {no}": { ar: "المرتجع {no}", ckb: "گەڕاندنەوەی {no}" },
  "Credit {no}": { ar: "الإشعار الدائن {no}", ckb: "پسووڵەی گەڕاندنەوەی {no}" },
  "Approves up to": { ar: "يعتمد حتى", ckb: "پەسەند دەکات تا" },
  Return: { ar: "المرتجع", ckb: "گەڕاندنەوە" },
  "Credit note": { ar: "الإشعار الدائن", ckb: "پسووڵەی گەڕاندنەوە" },
  "Set against the bill": { ar: "المخصوم من الفاتورة", ckb: "بڕدراو لە پسووڵەکە" },
  "Order lines": { ar: "سطور الطلبية", ckb: "هێڵەکانی داواکاری" },
  "Closed short of the order": {
    ar: "أُغلقت دون اكتمال الطلبية",
    ckb: "پێش تەواوبوونی داواکارییەکە داخرا",
  },
  Returned: { ar: "المُرجَع", ckb: "گەڕێندراوە" },
  // The audit trail: an item's suppliers (0045).
  "Item's supplier set": { ar: "تحديد مورّد لمادة", ckb: "دیاریکردنی دابینکەری کاڵا" },
  "Item's supplier removed": { ar: "إزالة مورّد مادة", ckb: "لابردنی دابینکەری کاڵا" },
  "In place of": { ar: "بدلًا من", ckb: "لە جیاتی" },
  // The audit trail: a language's writing and its words cleared (0032); a
  // refund paid back in more than one way (0042).
  "Writing direction": { ar: "اتجاه الكتابة", ckb: "ئاراستەی نووسین" },
  Cleared: { ar: "مُسحت", ckb: "سڕانەوە" },
  "Paid back": { ar: "المبالغ المُعادة", ckb: "بڕە گەڕێندراوەکان" },
  // Reports → Production (0046).
  Production: { ar: "الإنتاج", ckb: "بەرهەمهێنان" },
  "Batches made {from} to {to}: what came out, and what became of it": {
    ar: "الدفعات المصنوعة من {from} إلى {to}: ما نتج عنها وما آلت إليه",
    ckb: "دەستە دروستکراوەکان لە {from} تا {to}: چی لێ دەرچوو و چی بەسەرهات",
  },
  "No batch was made in these dates.": {
    ar: "لم تُصنع أي دفعة في هذه التواريخ.",
    ckb: "لەم بەروارانەدا هیچ دەستەیەک دروست نەکرا.",
  },
  "Of the recipe": { ar: "من الوصفة", ckb: "لە ڕەسەتەکە" },
  "Quantity sold": { ar: "الكمية المباعة", ckb: "بڕی فرۆشراو" },
  // Losses by kind, giveaways at the till, and the loss report (0048).
  Losses: { ar: "الخسائر", ckb: "زیانەکان" },
  "What was lost or given away {from} to {to}, and where it was charged": {
    ar: "ما فُقد أو أُهدي من {from} إلى {to}، وعلى أي حساب حُمِّل",
    ckb: "ئەوەی لەدەستچوو یان بەخشرا لە {from} تا {to}، و خرایە سەر کام هەژمار",
  },
  "Nothing was lost in these dates.": {
    ar: "لم يُفقد شيء في هذه التواريخ.",
    ckb: "لەم ڕێکەوتانەدا هیچ لەدەست نەچوو.",
  },
  "{n} loss(es), {value} in all.": {
    ar: "{n, plural, one {خسارة واحدة} two {خسارتان} few {# خسائر} other {# خسارة}}، بقيمة {value} إجمالًا.",
    ckb: "{n} زیان، بە کۆی {value}.",
  },
  "{n} of them wait for a manager ({value}).": {
    ar: "{n} منها بانتظار مدير ({value}).",
    ckb: "{n}یان چاوەڕێی بەڕێوەبەرێکن ({value}).",
  },
  "{n} reversed, as they did not happen ({value}): left out.": {
    ar: "{n} معكوسة لأنها لم تحدث ({value}): مستبعدة.",
    ckb: "{n} هەڵگەڕێندرانەوە چونکە ڕووینەدابوو ({value}): لەدەرەوە هێڵراون.",
  },
  Share: { ar: "النسبة", ckb: "بەش" },
  "Given away at the till": { ar: "أُهدي على نقطة البيع", ckb: "لەسەر خاڵی فرۆشتن بەخشرا" },
  "{what}: {n}, {value}": { ar: "{what}: {n}، {value}", ckb: "{what}: {n}، {value}" },
  "at the till, number {n}": { ar: "على نقطة البيع، رقم {n}", ckb: "لەسەر خاڵی فرۆشتن، ژمارە {n}" },
  "at the till": { ar: "على نقطة البيع", ckb: "لەسەر خاڵی فرۆشتن" },
  "waiting for a manager": { ar: "بانتظار مدير", ckb: "چاوەڕێی بەڕێوەبەرێک" },
  "approved by {name}": { ar: "وافق عليه {name}", ckb: "{name} پەسەندی کرد" },
  Number: { ar: "الرقم", ckb: "ژمارە" },

  // Staff, their hours and their pay (0049): the audit trail's words.
  "Staff, hours & payroll": {
    ar: "الموظفون والساعات والرواتب",
    ckb: "کارمەندان، کاتژمێرەکان و مووچە",
  },
  "Person who works here saved": {
    ar: "حفظ شخص يعمل هنا",
    ckb: "پاشەکەوتکردنی کەسێک کە لێرە کار دەکات",
  },
  "Pay set": { ar: "تحديد الأجر", ckb: "دانانی مووچە" },
  "Last day set": { ar: "تحديد آخر يوم عمل", ckb: "دانانی دوایین ڕۆژی کار" },
  "Clock-in PIN set": { ar: "تعيين رمز PIN لتسجيل الحضور", ckb: "دانانی PIN ی تۆمارکردنی هاتن" },
  "Schedule saved": { ar: "حفظ جدول الدوام", ckb: "پاشەکەوتکردنی خشتەی دەوام" },
  "Clock screen made": { ar: "إنشاء شاشة حضور", ckb: "دروستکردنی شاشەی هاتن و ڕۆیشتن" },
  "Clock screen taken out of use": {
    ar: "إيقاف شاشة حضور",
    ckb: "لەکارخستنی شاشەی هاتن و ڕۆیشتن",
  },
  "Phone linked for clocking in": {
    ar: "ربط هاتف لتسجيل الحضور",
    ckb: "بەستنەوەی مۆبایل بۆ تۆمارکردنی هاتن",
  },
  "Phone unlinked": { ar: "فكّ ربط هاتف", ckb: "لابردنی بەستنەوەی مۆبایل" },
  "Hours corrected": { ar: "تصحيح الساعات", ckb: "ڕاستکردنەوەی کاتژمێرەکان" },
  "Hours added": { ar: "إضافة ساعات", ckb: "زیادکردنی کاتژمێر" },
  "Hours cancelled": { ar: "إلغاء ساعات", ckb: "هەڵوەشاندنەوەی کاتژمێر" },
  "Payroll drafted": { ar: "إعداد كشف رواتب", ckb: "ئامادەکردنی لیستی مووچە" },
  "Payroll adjusted": { ar: "تعديل كشف رواتب", ckb: "ڕێکخستنی لیستی مووچە" },
  "Payroll approved": { ar: "اعتماد كشف رواتب", ckb: "پەسەندکردنی لیستی مووچە" },
  "Payroll reopened": { ar: "إعادة فتح كشف رواتب", ckb: "دووبارە کردنەوەی لیستی مووچە" },
  "Salary paid": { ar: "دفع راتب", ckb: "پێدانی مووچە" },
  "Advance given": { ar: "إعطاء سلفة", ckb: "پێدانی پێشەکی" },
  "Advance cancelled": { ar: "إلغاء سلفة", ckb: "هەڵوەشاندنەوەی پێشەکی" },
  "Salary payment cancelled": { ar: "إلغاء دفعة راتب", ckb: "هەڵوەشاندنەوەی پارەدانی مووچە" },
  Job: { ar: "العمل", ckb: "کار" },
  "Their login": { ar: "حسابه", ckb: "هەژمارەکەی" },
  "How they are paid": { ar: "طريقة احتساب الأجر", ckb: "شێوازی مووچە" },
  "Hours in a day": { ar: "ساعات اليوم", ckb: "کاتژمێرەکانی ڕۆژ" },
  "Overtime (% of an hour's pay)": {
    ar: "العمل الإضافي (% من أجر الساعة)",
    ckb: "کاتی زیادە (% ی مووچەی کاتژمێرێک)",
  },
  "Last day": { ar: "آخر يوم", ckb: "دوایین ڕۆژ" },
  "Shifts taken off": { ar: "الدوامات المحذوفة", ckb: "دەوامە لابراوەکان" },
  Shifts: { ar: "الدوامات", ckb: "دەوامەکان" },
  "Clocked in": { ar: "الحضور المسجَّل", ckb: "هاتنی تۆمارکراو" },
  "Clocked out": { ar: "الانصراف المسجَّل", ckb: "ڕۆیشتنی تۆمارکراو" },
  Payroll: { ar: "كشف الرواتب", ckb: "لیستی مووچە" },
  "Gross pay": { ar: "الأجر الإجمالي", ckb: "مووچەی گشتی" },
  "Advances taken back": { ar: "السلف المستردة", ckb: "پێشەکییە گەڕێندراوەکان" },
  "What was added for": { ar: "سبب الإضافة", ckb: "هۆکاری زیادکردن" },
  "What was deducted for": { ar: "سبب الخصم", ckb: "هۆکاری بڕین" },
  "Still owed": { ar: "ما زال مستحقًا", ckb: "هێشتا قەرزە" },
  "Someone who works here": { ar: "شخص يعمل هنا", ckb: "کەسێک کە لێرە کار دەکات" },
  "A record of hours": { ar: "سجل ساعات", ckb: "تۆمارێکی کاتژمێر" },
  "An advance": { ar: "سلفة", ckb: "پێشەکییەک" },
  "A payroll": { ar: "كشف رواتب", ckb: "لیستێکی مووچە" },
  "A salary payment": { ar: "دفعة راتب", ckb: "پارەدانێکی مووچە" },
  "Payroll {no}": { ar: "كشف الرواتب {no}", ckb: "لیستی مووچەی {no}" },
  // The chart of accounts on the audit trail (0058).
  "Account added": { ar: "أُضيف حساب", ckb: "هەژمارێک زیاد کرا" },
  "Account renamed": { ar: "غُيِّر اسم حساب", ckb: "ناوی هەژمارێک گۆڕدرا" },
  "Account taken out of use or brought back": {
    ar: "أُوقف استخدام حساب أو أُعيد إليه",
    ckb: "هەژمارێک لە بەکارهێنان لابرا یان گەڕێندرایەوە",
  },
  "An account": { ar: "حساب", ckb: "هەژمارێک" },
  "Account {code} {name}": { ar: "الحساب {code} {name}", ckb: "هەژماری {code} {name}" },
  "Account {code}": { ar: "الحساب {code}", ckb: "هەژماری {code}" },
  // The bank against its statement on the audit trail (0059).
  "Bank statement kept": { ar: "حُفظ كشف بنك", ckb: "کەشفی بانکێک هەڵگیرا" },
  "Bank statement undone": { ar: "أُلغي كشف بنك", ckb: "کەشفی بانکێک هەڵوەشێنرایەوە" },
  "A bank statement": { ar: "كشف بنك", ckb: "کەشفی بانکێک" },
  "Bank statement {no}": { ar: "كشف البنك {no}", ckb: "کەشفی بانکی {no}" },
  "Bank statement": { ar: "كشف البنك", ckb: "کەشفی بانک" },
  "Its last day": { ar: "آخر يوم فيه", ckb: "دوایین ڕۆژی" },
  "From the last statement": { ar: "من الكشف الأخير", ckb: "لە دوایین کەشفەوە" },
  "Lines ticked": { ar: "القيود المُعلَّمة", ckb: "تۆمارە نیشانەکراوەکان" },
  kept: { ar: "محفوظ", ckb: "هەڵگیراو" },
  undone: { ar: "مُلغى", ckb: "هەڵوەشێنراوە" },
  // Prepaid expenses on the audit trail (0060).
  "Prepaid expense recorded": {
    ar: "سُجّل مصروف مدفوع مقدمًا",
    ckb: "خەرجییەکی پێشەکی تۆمار کرا",
  },
  "Prepaid expenses' shares posted": {
    ar: "رُحِّلت حصص من المصروفات المدفوعة مقدمًا",
    ckb: "بەشەکانی خەرجییە پێشەکییەکان تۆمار کران",
  },
  "Prepaid expense cancelled": {
    ar: "أُلغي مصروف مدفوع مقدمًا",
    ckb: "خەرجییەکی پێشەکی هەڵوەشێنرایەوە",
  },
  "A prepaid expense": { ar: "مصروف مدفوع مقدمًا", ckb: "خەرجییەکی پێشەکی" },
  "Shares posted": { ar: "الحصص المُرحَّلة", ckb: "بەشە تۆمارکراوەکان" },
  "Shares reversed": { ar: "الحصص المعكوسة", ckb: "بەشە هەڵگەڕێنراوەکان" },

  // The week at a glance (round four).
  "The week at a glance": { ar: "الأسبوع في لمحة", ckb: "هەفتە بە یەک سەیرکردن" },
  "{from} to {to}, against {beforeFrom} to {beforeTo}": {
    ar: "من {from} إلى {to}، مقابل {beforeFrom} إلى {beforeTo}",
    ckb: "لە {from} بۆ {to}، بەرامبەر {beforeFrom} بۆ {beforeTo}",
  },
  Weeks: { ar: "الأسابيع", ckb: "هەفتەکان" },
  "The last 7 days": { ar: "الأيام السبعة الأخيرة", ckb: "حەوت ڕۆژی کۆتایی" },
  "This week": { ar: "هذا الأسبوع", ckb: "ئەم هەفتەیە" },
  "Gross margin": { ar: "هامش الربح الإجمالي", ckb: "پەراوێزی قازانجی گشتی" },
  "{amount} an order on average": {
    ar: "{amount} للطلب في المتوسط",
    ckb: "بە تێکڕا {amount} بۆ هەر داواکارییەک",
  },
  // What a figure is set against: the week before, the same days of the month before, or all of it.
  "the week before": { ar: "الأسبوع السابق", ckb: "هەفتەی پێشوو" },
  "the same days of {month}": { ar: "الأيام نفسها من {month}", ckb: "هەمان ڕۆژەکانی {month}" },
  "{amount} in {then}.": { ar: "{amount} في {then}.", ckb: "{amount} لە {then}دا." },
  "{pct}% more than {then}": { ar: "أكثر بـ{pct}% من {then}", ckb: "{pct}% زیاتر لە {then}" },
  "{pct}% less than {then}": { ar: "أقل بـ{pct}% من {then}", ckb: "{pct}% کەمتر لە {then}" },
  "About the same as {then}": { ar: "قريب من {then}", ckb: "نزیکەی وەک {then}" },
  "{n} point(s) more than {then}": {
    ar: "أعلى بـ{n, plural, one {نقطة واحدة} two {نقطتين} few {# نقاط} many {# نقطة} other {# نقطة}} من {then}",
    ckb: "{n} خاڵ زیاتر لە {then}",
  },
  "{n} point(s) less than {then}": {
    ar: "أقل بـ{n, plural, one {نقطة واحدة} two {نقطتين} few {# نقاط} many {# نقطة} other {# نقطة}} من {then}",
    ckb: "{n} خاڵ کەمتر لە {then}",
  },
  "What the week says": { ar: "ما يقوله الأسبوع", ckb: "هەفتەکە چی دەڵێت" },
  "Sales day by day": { ar: "المبيعات يومًا بيوم", ckb: "فرۆشتن ڕۆژ بە ڕۆژ" },
  "What sold the most": { ar: "الأكثر مبيعًا", ckb: "ئەوەی زۆرترین فرۆشرا" },
  "new this week": { ar: "جديد هذا الأسبوع", ckb: "ئەم هەفتەیە نوێیە" },
  "{n} loss(es)": {
    ar: "{n, plural, one {خسارة واحدة} two {خسارتان} few {# خسائر} many {# خسارة} other {# خسارة}}",
    ckb: "{n} زیان",
  },
  "The sales analysis of the week →": {
    ar: "تحليل مبيعات الأسبوع ←",
    ckb: "شیکاری فرۆشتنی هەفتەکە ←",
  },
  "The losses of the week →": { ar: "خسائر الأسبوع ←", ckb: "زیانەکانی هەفتەکە ←" },
  "Sales as paid, less what refunds gave back since, as the sales analysis has them; what was lost at what it cost.":
    {
      ar: "المبيعات كما دُفعت، مطروحًا منها ما ردّته المرتجعات منذئذ، كما في تحليل المبيعات؛ وما فُقد بتكلفته.",
      ckb: "فرۆشتن وەک پارەکەی درا، ئەوەی گەڕاندنەوەکان لەوەتەی گەڕاندیانەوە لێی دەرکراوە، وەک شیکاری فرۆشتن هەیەتی؛ ئەوەی لەدەستچوو بە تێچووەکەی.",
    },
  "No sales this week.": { ar: "لا مبيعات هذا الأسبوع.", ckb: "ئەم هەفتەیە هیچ فرۆشتنێک نییە." },
  "The best day: {day}, {amount}.": {
    ar: "أفضل يوم: {day}، {amount}.",
    ckb: "باشترین ڕۆژ: {day}، {amount}.",
  },
  "Net sales {amount}, and no sales in {then} to compare with.": {
    ar: "صافي المبيعات {amount}، ولا مبيعات في {then} للمقارنة.",
    ckb: "فرۆشتنی پوخت {amount}، و لە {then}دا هیچ فرۆشتنێک نییە بۆ بەراوردکردن.",
  },
  "Net sales rose {pct}% against {then}: {amount} more.": {
    ar: "ارتفع صافي المبيعات {pct}% عن {then}: {amount} أكثر.",
    ckb: "فرۆشتنی پوخت {pct}% زیادی کرد بەراورد بە {then}: {amount} زیاتر.",
  },
  "Net sales fell {pct}% against {then}: {amount} less.": {
    ar: "انخفض صافي المبيعات {pct}% عن {then}: {amount} أقل.",
    ckb: "فرۆشتنی پوخت {pct}% کەمی کرد بەراورد بە {then}: {amount} کەمتر.",
  },
  "Net sales held steady against {then}.": {
    ar: "بقي صافي المبيعات ثابتًا مقارنة مع {then}.",
    ckb: "فرۆشتنی پوخت بەراورد بە {then} وەک خۆی ماوەتەوە.",
  },
  "The margin fell {n} point(s), to {pct}%.": {
    ar: "انخفض الهامش {n, plural, one {نقطة واحدة} two {نقطتين} few {# نقاط} many {# نقطة} other {# نقطة}}، إلى {pct}%.",
    ckb: "پەراوێزەکە {n} خاڵ دابەزی، بۆ {pct}%.",
  },
  "The margin rose {n} point(s), to {pct}%.": {
    ar: "ارتفع الهامش {n, plural, one {نقطة واحدة} two {نقطتين} few {# نقاط} many {# نقطة} other {# نقطة}}، إلى {pct}%.",
    ckb: "پەراوێزەکە {n} خاڵ بەرز بووەوە، بۆ {pct}%.",
  },
  "The margin held at {pct}%.": {
    ar: "بقي الهامش عند {pct}%.",
    ckb: "پەراوێزەکە لە {pct}% ماوەتەوە.",
  },
  "What was sold cost {cost}% more, on {sales}% more sales: check the recipes' costs and the prices.":
    {
      ar: "كلّف ما بيع {cost}% أكثر، مقابل مبيعات أكثر بـ{sales}%: راجع تكاليف الوصفات والأسعار.",
      ckb: "ئەوەی فرۆشرا {cost}% تێچووی زیاتری بوو، بەرامبەر {sales}% فرۆشتنی زیاتر: تێچووی ڕەسەتەکان و نرخەکان بپشکنە.",
    },
  "Lost {amount} to waste, {pct}% of net sales.": {
    ar: "فُقد {amount} هدرًا، {pct}% من صافي المبيعات.",
    ckb: "{amount} بە بەفیڕۆچوون لەدەستچوو، {pct}%ی فرۆشتنی پوخت.",
  },
  "Most of it {item}: {amount}.": {
    ar: "معظمه {item}: {amount}.",
    ckb: "زۆربەی {item}: {amount}.",
  },
  "Nothing was lost this week.": {
    ar: "لم يُفقد شيء هذا الأسبوع.",
    ckb: "ئەم هەفتەیە هیچ لەدەست نەچوو.",
  },
  "{name} sold the most: {amount}.": {
    ar: "{name} الأكثر مبيعًا: {amount}.",
    ckb: "{name} زۆرترین فرۆشرا: {amount}.",
  },
  "{name} rose the most: {amount} more than {then}.": {
    ar: "{name} ارتفع أكثر من غيره: {amount} أكثر من {then}.",
    ckb: "{name} زۆرترین زیادبوونی هەبوو: {amount} زیاتر لە {then}.",
  },
  "{name} fell the most: {amount} less than {then}.": {
    ar: "{name} انخفض أكثر من غيره: {amount} أقل من {then}.",
    ckb: "{name} زۆرترین کەمبوونەوەی هەبوو: {amount} کەمتر لە {then}.",
  },
  // On Reports, beside the analysis and the statements.
  "The week at a glance →": { ar: "الأسبوع في لمحة ←", ckb: "هەفتە بە یەک سەیرکردن ←" },
  "The month at a glance →": { ar: "الشهر في لمحة ←", ckb: "مانگ بە یەک سەیرکردن ←" },

  // The price watch (round five): what came in dearer, and what it does to the margins.
  "Price watch": { ar: "مراقبة الأسعار", ckb: "چاودێری نرخەکان" },
  "Price watch: what came in dearer →": {
    ar: "مراقبة الأسعار: ما وصل بسعر أعلى ←",
    ckb: "چاودێری نرخەکان: ئەوەی گرانتر هات ←",
  },
  "Deliveries of the last {n} day(s), each against the one before": {
    ar: "توريدات {n, plural, one {اليوم الأخير} two {اليومين الأخيرين} few {الأيام الـ# الأخيرة} many {الـ# يومًا الأخيرة} other {الـ# يوم الأخيرة}}، كلٌّ مقابل الذي قبله",
    ckb: "گەیاندنەکانی {n} ڕۆژی کۆتایی، هەریەکە بەرامبەر ئەوەی پێشوو",
  },
  "Nothing came in dearer in the last {n} day(s).": {
    ar: "لم يصل شيء بسعر أعلى في {n, plural, one {اليوم الأخير} two {اليومين الأخيرين} few {الأيام الـ# الأخيرة} many {الـ# يومًا الأخيرة} other {الـ# يوم الأخيرة}}.",
    ckb: "لە {n} ڕۆژی کۆتاییدا هیچ شتێک گرانتر نەهات.",
  },
  "Each delivery is set against the one before it, item by item.": {
    ar: "كل توريد يُقارن بالذي قبله، صنفًا صنفًا.",
    ckb: "هەر گەیاندنێک بەرامبەر ئەوەی پێشووی دادەنرێت، کاڵا بە کاڵا.",
  },
  "Came in dearer": { ar: "وصل بسعر أعلى", ckb: "گرانتر هات" },
  "{n} item(s), by 5% or more": {
    ar: "{n, plural, one {صنف واحد} two {صنفان} few {# أصناف} many {# صنفًا} other {# صنف}}، بـ5% أو أكثر",
    ckb: "{n} کاڵا، بە 5% یان زیاتر",
  },
  "What it comes to a month": { ar: "ما يكلّفه في الشهر", ckb: "لە مانگێکدا چەندی تێدەچێت" },
  "At the last 30 days' sales": {
    ar: "بمبيعات آخر 30 يومًا",
    ckb: "بە فرۆشتنی 30 ڕۆژی کۆتایی",
  },
  "Sizes it touches": { ar: "الأحجام التي يمسّها", ckb: "ئەو قەبارانەی کاری تێدەکات" },
  "{n} price(s) would keep the margin": {
    ar: "{n, plural, zero {لا سعر يحفظ الهامش} one {سعر واحد يحفظ الهامش} two {سعران يحفظان الهامش} few {# أسعار تحفظ الهامش} many {# سعرًا تحفظ الهامش} other {# سعر يحفظ الهامش}}",
    ckb: "{n} نرخ پەراوێزەکە دەپارێزن",
  },
  "{was} → {now} a {unit}, delivered {when}": {
    ar: "{was} ← {now} لكل {unit}، وصل في {when}",
    ckb: "{was} ← {now} بۆ هەر {unit}، لە {when} گەیشت",
  },
  "At the last 30 days' sales, it comes to about {amount} a month.": {
    ar: "بمبيعات آخر 30 يومًا، يكلّف نحو {amount} في الشهر.",
    ckb: "بە فرۆشتنی 30 ڕۆژی کۆتایی، نزیکەی {amount} لە مانگێکدا تێدەچێت.",
  },
  "No product uses it on its recipe, nor through what is made from it.": {
    ar: "لا يستعمله أي منتج في وصفته، ولا عبر ما يُصنع منه.",
    ckb: "هیچ بەرهەمێک لە ڕەسەتەکەیدا بەکاری ناهێنێت، نە لە ڕێگەی ئەوەی لێی دروست دەکرێت.",
  },
  "What it touches": { ar: "ما يمسّه", ckb: "ئەوەی کاری تێدەکات" },
  "Margin, before → after": { ar: "الهامش، قبل ← بعد", ckb: "پەراوێز، پێش ← دوای" },
  "Adds a serving": { ar: "يزيد على الحصة", ckb: "بۆ هەر بەشێک زیاد دەکات" },
  "Sold in 30 days": { ar: "المباع في 30 يومًا", ckb: "فرۆشراو لە 30 ڕۆژدا" },
  "Keeps the margin": { ar: "يحفظ الهامش", ckb: "پەراوێزەکە دەپارێزێت" },
  "And {n} more, each adding less.": {
    ar: "و{n, plural, one {واحد آخر} two {اثنان آخران} few {# أخرى} many {# أخرى} other {# أخرى}}، كلٌّ يزيد أقل.",
    ckb: "و {n} ی تر، هەریەکە کەمتر زیاد دەکات.",
  },
  "Its deliveries and prices →": {
    ar: "توريداته وأسعاره ←",
    ckb: "گەیاندن و نرخەکانی ←",
  },
  "Each delivery against the one before it, a unit at a time, with freight shared out. A serving costs what a sale would post, with this item at its old price, then its new, once what was bought dearer is what is sold. The price that keeps the margin is rounded up to 250 IQD.":
    {
      ar: "كل توريد مقابل الذي قبله، وحدةً وحدة، مع توزيع أجور النقل. تكلّف الحصة ما يسجّله البيع، بهذا الصنف بسعره القديم ثم الجديد، حين يصير ما اشتُري أغلى هو ما يُباع. السعر الذي يحفظ الهامش مقرَّب صعودًا إلى 250 دينارًا.",
      ckb: "هەر گەیاندنێک بەرامبەر ئەوەی پێشوو، یەکە بە یەکە، لەگەڵ دابەشکردنی کرێی گواستنەوە. بەشێک ئەوەندە تێدەچێت کە فرۆشتن تۆماری دەکات، بەم کاڵایە بە نرخە کۆنەکەی، پاشان بە نوێکەی، کاتێک ئەوەی گرانتر کڕدرا ئەوەیە کە دەفرۆشرێت. ئەو نرخەی پەراوێزەکە دەپارێزێت بۆ 250 دینار بەرز دەکرێتەوە.",
    },

  // On the dashboard, when a delivery came in dearer.
  "{item} came in {pct}% dearer on {day}: see what it does to the margins.": {
    ar: "وصل {item} أغلى بـ{pct}% في {day}: انظر ما يفعله بالهوامش.",
    ckb: "{item} لە {day} بە {pct}% گرانتر هات: سەیر بکە چی لە پەراوێزەکان دەکات.",
  },
  "{n} items came in dearer over the last 14 days, {item} the most, by {pct}%: see what it does to the margins.":
    {
      ar: "وصلت {n, plural, two {صنفان} few {# أصناف} many {# صنفًا} other {# صنف}} أغلى خلال آخر 14 يومًا، أكثرها {item} بـ{pct}%: انظر ما يفعله بالهوامش.",
      ckb: "{n} کاڵا لە 14 ڕۆژی کۆتاییدا گرانتر هاتن، زۆرترینیان {item} بە {pct}%: سەیر بکە چی لە پەراوێزەکان دەکات.",
    },

  // The month at a glance (round five), and the choice between it and the week.
  "A week or a month": { ar: "أسبوع أو شهر", ckb: "هەفتەیەک یان مانگێک" },
  Week: { ar: "الأسبوع", ckb: "هەفتە" },
  "The month at a glance": { ar: "الشهر في لمحة", ckb: "مانگ بە یەک سەیرکردن" },
  "What the month says": { ar: "ما يقوله الشهر", ckb: "مانگەکە چی دەڵێت" },
  "No sales this month.": { ar: "لا مبيعات هذا الشهر.", ckb: "ئەم مانگە هیچ فرۆشتنێک نییە." },
  "Nothing was lost this month.": {
    ar: "لم يُفقد شيء هذا الشهر.",
    ckb: "ئەم مانگە هیچ لەدەست نەچوو.",
  },
  "new this month": { ar: "جديد هذا الشهر", ckb: "ئەم مانگە نوێیە" },
  "The sales analysis of the month →": {
    ar: "تحليل مبيعات الشهر ←",
    ckb: "شیکاری فرۆشتنی مانگەکە ←",
  },
  "The losses of the month →": { ar: "خسائر الشهر ←", ckb: "زیانەکانی مانگەکە ←" },
  "The month before": { ar: "الشهر السابق", ckb: "مانگی پێشوو" },
  "The month after": { ar: "الشهر التالي", ckb: "مانگی دواتر" },
  "Usual for the weekday in {month}": {
    ar: "المعتاد لليوم نفسه من الأسبوع في {month}",
    ckb: "ئاسایی بۆ هەمان ڕۆژی هەفتە لە {month}دا",
  },
  "At this pace, {month} closes near {amount}.": {
    ar: "بهذه الوتيرة، يُغلق {month} عند نحو {amount}.",
    ckb: "بەم ڕێڕەوە، {month} بە نزیکەی {amount} کۆتایی دێت.",
  },
  "From {n} full day(s) so far; {month} closed at {amount}.": {
    ar: "من {n, plural, one {يوم كامل واحد} two {يومين كاملين} few {# أيام كاملة} many {# يومًا كاملًا} other {# يوم كامل}} حتى الآن؛ وأُغلق {month} عند {amount}.",
    ckb: "لە {n} ڕۆژی تەواوی تا ئێستا؛ {month} بە {amount} کۆتایی هات.",
  },
  "The month's target: {amount}.": {
    ar: "هدف الشهر: {amount}.",
    ckb: "ئامانجی مانگەکە: {amount}.",
  },
  "On average, {best} sold the most: {amount} a day; {worst} the least: {low}.": {
    ar: "في المتوسط، كان يوم {best} الأكثر مبيعًا: {amount} في اليوم؛ ويوم {worst} الأقل: {low}.",
    ckb: "بە تێکڕا، {best} زۆرترین فرۆشتنی هەبوو: {amount} لە ڕۆژێکدا؛ {worst} کەمترین: {low}.",
  },

  // Staffed when busy? (round six): the orders of each hour against the people on the clock.
  "Staffed when busy?": {
    ar: "هل يكفي العاملون وقت الزحام؟",
    ckb: "ئایا کارمەند بەسە لە کاتی قەرەباڵغیدا؟",
  },
  "Staffed when busy? Orders an hour against who was on the clock →": {
    ar: "هل يكفي العاملون وقت الزحام؟ الطلبات في الساعة مقابل من كان على الدوام ←",
    ckb: "ئایا کارمەند بەسە لە کاتی قەرەباڵغیدا؟ داواکاری لە کاتژمێرێکدا بەرامبەر ئەوانەی لە دەوامدا بوون ←",
  },
  "{from} to {to}: four weeks, each hour of the week on average": {
    ar: "من {from} إلى {to}: أربعة أسابيع، كل ساعة من الأسبوع في المتوسط",
    ckb: "لە {from} تا {to}: چوار هەفتە، هەر کاتژمێرێکی هەفتە بە تێکڕا",
  },
  "Four weeks at a time": { ar: "أربعة أسابيع في كل مرة", ckb: "هەر جارە چوار هەفتە" },
  "The four weeks before": { ar: "الأسابيع الأربعة السابقة", ckb: "چوار هەفتەی پێشوو" },
  "The four weeks after": { ar: "الأسابيع الأربعة التالية", ckb: "چوار هەفتەی دواتر" },
  "The last four weeks": { ar: "آخر أربعة أسابيع", ckb: "دوایین چوار هەفتە" },
  "This page needs the hours on the clock.": {
    ar: "تحتاج هذه الصفحة إلى ساعات الدوام المسجّلة.",
    ckb: "ئەم پەڕەیە پێویستی بە کاتژمێرە تۆمارکراوەکانی دەوامە.",
  },
  "Those who keep the staff, their hours or their pay can see it.": {
    ar: "يراها من يدير الموظفين أو ساعاتهم أو رواتبهم.",
    ckb: "ئەوانەی کارمەندان، کاتژمێرەکانیان یان مووچەکەیان بەڕێوە دەبەن دەیبینن.",
  },
  "{day}, {from}–{to}": { ar: "{day}، {from}–{to}", ckb: "{day}، {from}–{to}" },
  "Short of hands": { ar: "نقص في الأيدي", ckb: "دەست کەمە" },
  Quiet: { ar: "هادئة", ckb: "ئارام" },
  "Nobody on the clock": { ar: "لا أحد على الدوام", ckb: "کەس لە دەوامدا نییە" },
  "No orders in these four weeks.": {
    ar: "لا طلبات في هذه الأسابيع الأربعة.",
    ckb: "لەم چوار هەفتەیەدا هیچ داواکارییەک نییە.",
  },
  "Nobody was on the clock in these four weeks.": {
    ar: "لم يكن أحد على الدوام في هذه الأسابيع الأربعة.",
    ckb: "لەم چوار هەفتەیەدا کەس لە دەوامدا نەبوو.",
  },
  "This page sets the orders of each hour against the hours on the clock: clock in and out at the till, or add the hours on Staff.":
    {
      ar: "تضع هذه الصفحة طلبات كل ساعة مقابل ساعات الدوام: سجّلوا الحضور والانصراف على نقطة البيع، أو أضيفوا الساعات في صفحة الموظفين.",
      ckb: "ئەم پەڕەیە داواکارییەکانی هەر کاتژمێرێک بەرامبەر کاتژمێرەکانی دەوام دادەنێت: لەسەر خاڵی فرۆشتن هاتن و ڕۆیشتن تۆمار بکەن، یان کاتژمێرەکان لە پەڕەی کارمەندان زیاد بکەن.",
    },
  "The busiest hour: {when}, about {orders} orders and {amount}.": {
    ar: "أكثر الساعات زحامًا: {when}، نحو {orders} طلب و{amount}.",
    ckb: "قەرەباڵغترین کاتژمێر: {when}، نزیکەی {orders} داواکاری و {amount}.",
  },
  "{people} on the clock, on average.": {
    ar: "{people} على الدوام في المتوسط.",
    ckb: "بە تێکڕا {people} کەس لە دەوامدا.",
  },
  "Short of hands: {when}.": { ar: "نقص في الأيدي: {when}.", ckb: "دەست کەمە: {when}." },
  "About {orders} orders an hour with {people} on the clock: {each} each, against {usual} usually. One more would bring it to {after} each.":
    {
      ar: "نحو {orders} طلب في الساعة و{people} على الدوام: {each} لكل واحد، مقابل {usual} عادةً. شخص آخر ينزل بها إلى {after} لكل واحد.",
      ckb: "نزیکەی {orders} داواکاری لە کاتژمێرێکدا بە {people} کەس لە دەوامدا: هەریەکە {each}، بەرامبەر {usual} بە ئاسایی. کەسێکی تر دەیگەیەنێتە {after} بۆ هەریەکە.",
    },
  "Quiet with {people} on the clock: {when}.": {
    ar: "هادئة و{people} على الدوام: {when}.",
    ckb: "ئارامە و {people} کەس لە دەوامدان: {when}.",
  },
  "About {orders} orders an hour: {each} each, against {usual} usually. Unless they were preparing, one fewer would still leave {left}.":
    {
      ar: "نحو {orders} طلب في الساعة: {each} لكل واحد، مقابل {usual} عادةً. ما لم يكونوا يحضّرون، فإن شخصًا أقل يُبقي {left}.",
      ckb: "نزیکەی {orders} داواکاری لە کاتژمێرێکدا: هەریەکە {each}، بەرامبەر {usual} بە ئاسایی. ئەگەر خەریکی ئامادەکاری نەبوون، بە کەسێک کەمتر هێشتا {left} دەمێنن.",
    },
  "Orders with nobody on the clock: {when}.": {
    ar: "طلبات ولا أحد على الدوام: {when}.",
    ckb: "داواکاری هەبوو و کەس لە دەوامدا نەبوو: {when}.",
  },
  "About {orders} an hour. Clock in at the till, so this page reads true.": {
    ar: "نحو {orders} في الساعة. سجّلوا الحضور على نقطة البيع لتصدق هذه الصفحة.",
    ckb: "نزیکەی {orders} لە کاتژمێرێکدا. لەسەر خاڵی فرۆشتن هاتن تۆمار بکەن، بۆ ئەوەی ئەم پەڕەیە ڕاست بێت.",
  },
  "No hour was short of hands, nor quiet with two or more on the clock.": {
    ar: "لم تنقص الأيدي في أي ساعة، ولم تهدأ أي ساعة واثنان أو أكثر على الدوام.",
    ckb: "هیچ کاتژمێرێک دەستی کەم نەبوو، و هیچ کاتژمێرێک بە دوو کەس یان زیاتر لە دەوامدا ئارام نەبوو.",
  },
  "{pct}% of the orders were rung up with nobody on the clock.": {
    ar: "{pct}% من الطلبات سُجّلت ولا أحد على الدوام.",
    ckb: "{pct}%ی داواکارییەکان تۆمارکران کاتێک کەس لە دەوامدا نەبوو.",
  },
  "This page counts only the hours on the clock: clock in and out at the till.": {
    ar: "لا تحسب هذه الصفحة إلا ساعات الدوام المسجّلة: سجّلوا الحضور والانصراف على نقطة البيع.",
    ckb: "ئەم پەڕەیە تەنها کاتژمێرە تۆمارکراوەکانی دەوام دەژمێرێت: لەسەر خاڵی فرۆشتن هاتن و ڕۆیشتن تۆمار بکەن.",
  },
  "Orders an hour, each on the clock": {
    ar: "الطلبات في الساعة لكل من على الدوام",
    ckb: "داواکاری لە کاتژمێرێکدا بۆ هەر کەسێکی دەوام",
  },
  "Over {n} hour(s) on the clock": {
    ar: "على مدى {n, plural, one {ساعة دوام واحدة} two {ساعتي دوام} few {# ساعات دوام} many {# ساعة دوام} other {# ساعة دوام}}",
    ckb: "لە ماوەی {n} کاتژمێری دەوامدا",
  },
  "The busiest hour": { ar: "أكثر الساعات زحامًا", ckb: "قەرەباڵغترین کاتژمێر" },
  "About {orders} orders, {people} on the clock": {
    ar: "نحو {orders} طلب، و{people} على الدوام",
    ckb: "نزیکەی {orders} داواکاری، {people} کەس لە دەوامدا",
  },
  "Hours short of hands": { ar: "ساعات بنقص في الأيدي", ckb: "کاتژمێرەکانی کەمیی دەست" },
  "A week: each served half as many again as usual, or more": {
    ar: "في الأسبوع: خدم كل واحد مرة ونصفًا من المعتاد أو أكثر",
    ckb: "لە هەفتەیەکدا: هەریەکە یەک و نیو هێندەی ئاسایی یان زیاتری خزمەت کرد",
  },
  "Hours quiet with two or more": {
    ar: "ساعات هادئة واثنان أو أكثر على الدوام",
    ckb: "کاتژمێرە ئارامەکان بە دوو کەس یان زیاتر",
  },
  "A week: each served half the usual, or less": {
    ar: "في الأسبوع: خدم كل واحد نصف المعتاد أو أقل",
    ckb: "لە هەفتەیەکدا: هەریەکە نیوەی ئاسایی یان کەمتری خزمەت کرد",
  },
  "{people} on the clock": { ar: "{people} على الدوام", ckb: "{people} کەس لە دەوامدا" },
  "What the hours say": { ar: "ما تقوله الساعات", ckb: "کاتژمێرەکان چی دەڵێن" },
  "A day of the week": { ar: "يوم من الأسبوع", ckb: "ڕۆژێکی هەفتە" },
  "Every day": { ar: "كل الأيام", ckb: "هەموو ڕۆژەکان" },
  "Orders hour by hour: a day on average": {
    ar: "الطلبات ساعة بساعة: يوم في المتوسط",
    ckb: "داواکارییەکان کاتژمێر بە کاتژمێر: ڕۆژێک بە تێکڕا",
  },
  "Orders hour by hour: {day}": {
    ar: "الطلبات ساعة بساعة: {day}",
    ckb: "داواکارییەکان کاتژمێر بە کاتژمێر: {day}",
  },
  "Orders an hour": { ar: "الطلبات في الساعة", ckb: "داواکاری لە کاتژمێرێکدا" },
  "What those on the clock usually serve": {
    ar: "ما يخدمه من على الدوام عادةً",
    ckb: "ئەوەی کەسانی دەوام بە ئاسایی خزمەتی دەکەن",
  },
  "Where a column stands above the line, each person on the clock served more than usual; where it falls well below with two or more on the clock, the hour was quiet.":
    {
      ar: "حيث يعلو العمود الخط، خدم كل من على الدوام أكثر من المعتاد؛ وحيث ينخفض عنه كثيرًا واثنان أو أكثر على الدوام، كانت الساعة هادئة.",
      ckb: "لەو شوێنەی ستوونێک لە سەرووی هێڵەکەوەیە، هەر کەسێکی دەوام زیاتر لە ئاسایی خزمەتی کرد؛ لەو شوێنەی زۆر لە خوارییەوەیە و دوو کەس یان زیاتر لە دەوامدان، کاتژمێرەکە ئارام بوو.",
    },
  "The week, hour by hour": { ar: "الأسبوع ساعة بساعة", ckb: "هەفتە کاتژمێر بە کاتژمێر" },
  "Orders an hour, a day on average, and the hours marked": {
    ar: "الطلبات في الساعة، يوم في المتوسط، والساعات المعلَّمة",
    ckb: "داواکاری لە کاتژمێرێکدا، ڕۆژێک بە تێکڕا، و کاتژمێرە نیشانکراوەکان",
  },
  "Fewer orders": { ar: "طلبات أقل", ckb: "داواکاریی کەمتر" },
  "More orders": { ar: "طلبات أكثر", ckb: "داواکاریی زیاتر" },
  "Orders as rung up, in the hour they were paid; hours on the clock as clocked in and out at the till or added on Staff, those cancelled left out; each a day on average over the four weeks. What a person usually serves is every order served with someone on the clock, over every hour on the clock.":
    {
      ar: "الطلبات كما سُجّلت، في الساعة التي دُفعت فيها؛ وساعات الدوام كما سُجّل الحضور والانصراف على نقطة البيع أو أُضيفت في صفحة الموظفين، دون الملغاة؛ وكلٌّ يوم في المتوسط على مدى الأسابيع الأربعة. وما يخدمه الشخص عادةً هو كل طلب خُدم وأحدٌ على الدوام، مقسومًا على كل ساعات الدوام.",
      ckb: "داواکارییەکان وەک تۆمارکران، لەو کاتژمێرەی پارەکەیان درا؛ کاتژمێرەکانی دەوام وەک لەسەر خاڵی فرۆشتن هاتن و ڕۆیشتن تۆمارکران یان لە پەڕەی کارمەندان زیادکران، بێ هەڵوەشێنراوەکان؛ هەریەکە ڕۆژێک بە تێکڕا لە ماوەی چوار هەفتەکەدا. ئەوەی کەسێک بە ئاسایی خزمەتی دەکات هەموو ئەو داواکارییانەیە کە کەسێک لە دەوامدا بووە، دابەش بەسەر هەموو کاتژمێرەکانی دەوامدا.",
    },
  "{n} time(s) clocked in and not out are left out.": {
    ar: "{n, plural, one {استُبعدت مرة واحدة سُجّل فيها حضور دون انصراف.} two {استُبعدت مرتان سُجّل فيهما حضور دون انصراف.} few {استُبعدت # مرات سُجّل فيها حضور دون انصراف.} many {استُبعدت # مرة سُجّل فيها حضور دون انصراف.} other {استُبعدت # مرة سُجّل فيها حضور دون انصراف.}}",
    ckb: "{n} جار هاتن تۆمارکرا بەبێ ڕۆیشتن، ئەوانە لاوەنران.",
  },

  // Waste by recipe (round six): what each recipe's batches came to.
  "Waste by recipe": { ar: "الهدر حسب الوصفة", ckb: "بەفیڕۆچوون بەپێی ڕەسەتە" },
  "Waste by recipe: made, sold and thrown away →": {
    ar: "الهدر حسب الوصفة: ما صُنع وما بيع وما رُمي ←",
    ckb: "بەفیڕۆچوون بەپێی ڕەسەتە: دروستکراو، فرۆشراو و فڕێدراو ←",
  },
  "Batches made {from} to {to}, each as it stands now": {
    ar: "الدفعات المصنوعة من {from} إلى {to}، كلٌّ كما هو الآن",
    ckb: "ئەو دەستانەی لە {from} تا {to} دروستکران، هەریەکە وەک ئێستا هەیە",
  },
  "No batches were made in these four weeks.": {
    ar: "لم تُصنع أي دفعة في هذه الأسابيع الأربعة.",
    ckb: "لەم چوار هەفتەیەدا هیچ دەستەیەک دروست نەکرا.",
  },
  "Each batch recorded on Production is followed here, to the last of it.": {
    ar: "كل دفعة تُسجَّل في الإنتاج تُتتبَّع هنا حتى آخرها.",
    ckb: "هەر دەستەیەک لە بەرهەمهێناندا تۆمار بکرێت لێرە تا کۆتایی بەدوای دەچین.",
  },
  "Thrown away": { ar: "ما رُمي", ckb: "فڕێدراو" },
  "{pct} of what was made and has gone": {
    ar: "{pct} مما صُنع ونفد",
    ckb: "{pct}ی ئەوەی دروستکرا و ڕۆیشت",
  },
  "Batches made": { ar: "الدفعات المصنوعة", ckb: "دەستە دروستکراوەکان" },
  "{n} recipe(s)": {
    ar: "{n, plural, one {وصفة واحدة} two {وصفتان} few {# وصفات} many {# وصفة} other {# وصفة}}",
    ckb: "{n} ڕەسەتە",
  },
  "Eaten or given away": { ar: "ما أُكل أو أُهدي", ckb: "خوراو یان بەخشراو" },
  "Staff meals, gifts and tastings": {
    ar: "وجبات الموظفين والهدايا والتذوق",
    ckb: "خواردنی کارمەندان، دیاری و تامکردن",
  },
  "The most thrown away": { ar: "الأكثر رميًا", ckb: "زۆرترین فڕێدراو" },
  "{pct} of what it made and has gone": {
    ar: "{pct} مما صنعته ونفد",
    ckb: "{pct}ی ئەوەی دروستی کرد و ڕۆیشت",
  },
  "What the batches say": { ar: "ما تقوله الدفعات", ckb: "دەستەکان چی دەڵێن" },
  "{recipe}: {pct} of what went was thrown away, {amount}.": {
    ar: "{recipe}: رُمي {pct} مما نفد، بقيمة {amount}.",
    ckb: "{recipe}: {pct}ی ئەوەی ڕۆیشت فڕێدرا، بە {amount}.",
  },
  "Batches of about {made}, of which about {taken} was sold, used or eaten; most of the rest went past its use-by. Batches of about {better} would have covered what went.":
    {
      ar: "دفعات بنحو {made}، بيع منها أو استُعمل أو أُكل نحو {taken}؛ وتجاوز معظم الباقي موعد استعماله. دفعات بنحو {better} كانت ستكفي ما نفد.",
      ckb: "دەستەکانی نزیکەی {made}، کە نزیکەی {taken}ی لێ فرۆشرا، بەکارهات یان خورا؛ زۆربەی ئەوەی مایەوە کاتی بەکارهێنانی بەسەرچوو. دەستەکانی نزیکەی {better} بەسی ئەوە دەبوون کە ڕۆیشت.",
    },
  "Most of it went past its use-by, unsold.": {
    ar: "تجاوز معظمه موعد استعماله دون أن يُباع.",
    ckb: "زۆربەی بێ فرۆشتن کاتی بەکارهێنانی بەسەرچوو.",
  },
  "Most of it was spilt, melted or spoilt in the making: a smaller batch would not help. Look at how it is made and kept.":
    {
      ar: "معظمه انسكب أو ذاب أو فسد أثناء الصنع: لن تفيد دفعة أصغر. انظروا في طريقة صنعه وحفظه.",
      ckb: "زۆربەی ڕژا، توایەوە یان لە کاتی دروستکردندا تێکچوو: دەستەی بچووکتر یارمەتی نادات. سەیری چۆنیەتی دروستکردن و هەڵگرتنی بکەن.",
    },
  "Nothing made in these four weeks was thrown away.": {
    ar: "لم يُرمَ شيء مما صُنع في هذه الأسابيع الأربعة.",
    ckb: "هیچ شتێک لەوەی لەم چوار هەفتەیەدا دروستکرا فڕێ نەدرا.",
  },
  "No recipe threw away a tenth of what went.": {
    ar: "لم ترمِ أي وصفة عُشر ما نفد منها.",
    ckb: "هیچ ڕەسەتەیەک دەیەکی ئەوەی ڕۆیشت فڕێ نەدا.",
  },
  "{amount} of it was eaten by the staff, given away or tasted.": {
    ar: "أكل الموظفون منه أو أُهدي أو تُذوِّق ما قيمته {amount}.",
    ckb: "{amount}ی لێ لەلایەن کارمەندانەوە خورا، بەخشرا یان تامکرا.",
  },
  "{n} batch(es) are still in stock: what becomes of them is not counted yet.": {
    ar: "{n, plural, one {دفعة واحدة ما زالت في المخزون} two {دفعتان ما زالتا في المخزون} few {# دفعات ما زالت في المخزون} many {# دفعة ما زالت في المخزون} other {# دفعة ما زالت في المخزون}}: لم يُحسب بعدُ ما سيصير إليه.",
    ckb: "{n} دەستە هێشتا لە کۆگادان: ئەوەی بەسەریان دێت هێشتا نەژمێردراوە.",
  },
  "What was thrown away, by recipe": {
    ar: "ما رُمي حسب الوصفة",
    ckb: "ئەوەی فڕێدرا بەپێی ڕەسەتە",
  },
  "{pct} of what went, {qty}": { ar: "{pct} مما نفد، {qty}", ckb: "{pct}ی ئەوەی ڕۆیشت، {qty}" },
  "Recipe by recipe": { ar: "وصفةً وصفة", ckb: "ڕەسەتە بە ڕەسەتە" },
  Recipe: { ar: "الوصفة", ckb: "ڕەسەتە" },
  "Sold or used": { ar: "بيع أو استُعمل", ckb: "فرۆشرا یان بەکارهات" },
  "{pct} of what went": { ar: "{pct} مما نفد", ckb: "{pct}ی ئەوەی ڕۆیشت" },
  "What it cost": { ar: "ما كلّفه", ckb: "تێچووەکەی" },
  "A better batch": { ar: "دفعة أنسب", ckb: "دەستەیەکی گونجاوتر" },
  "Each batch made in the four weeks, followed to now: what was sold and what went into other batches; what was thrown away — past its use-by, spoilt, spilt or melted, less any loss taken back on review; and what the staff ate, was given away or tasted. Its cost is the batch's own. A batch to cover what went is said only where most of what was thrown away went unsold, from two or more batches all gone: what each of them sold, used or gave, on average.":
    {
      ar: "كل دفعة صُنعت في الأسابيع الأربعة، مُتتبَّعة حتى الآن: ما بيع وما دخل في دفعات أخرى؛ وما رُمي — بتجاوز موعد استعماله أو فساده أو انسكابه أو ذوبانه، ناقصًا أي خسارة أُعيدت عند المراجعة؛ وما أكله الموظفون أو أُهدي أو تُذوِّق. وكلفته كلفة الدفعة نفسها. ولا تُذكر دفعة تكفي ما نفد إلا حيث بقي معظم المرمي دون بيع، ومن دفعتين أو أكثر نفدت كلها: متوسط ما باعته كلٌّ منها أو استعملته أو أعطته.",
      ckb: "هەر دەستەیەک لەم چوار هەفتەیەدا دروستکرا، تا ئێستا بەدوای دەچین: ئەوەی فرۆشرا و ئەوەی چووە ناو دەستەکانی ترەوە؛ ئەوەی فڕێدرا — بە بەسەرچوونی کاتی بەکارهێنان، تێکچوون، ڕژان یان توانەوە، کەمتر هەر زیانێک کە لە پێداچوونەوەدا گەڕێنرایەوە؛ و ئەوەی کارمەندان خواردیان، بەخشرا یان تامکرا. تێچووەکەی تێچووی خودی دەستەکەیە. دەستەیەک کە بەسی ئەوە بێت کە ڕۆیشت تەنها لەو شوێنانە دەوترێت کە زۆربەی فڕێدراو بێ فرۆشتن مایەوە، لە دوو دەستە یان زیاتر کە هەموویان ڕۆیشتن: تێکڕای ئەوەی هەریەکەیان فرۆشتی، بەکاری هێنا یان بەخشی.",
    },
};

export default phrases;
