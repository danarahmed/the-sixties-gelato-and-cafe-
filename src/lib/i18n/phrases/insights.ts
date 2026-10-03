import type { PhraseBook } from "./types";

/**
 * The reports at a glance: the period's figures against the days before,
 * what they say and what to do about it, where each 1,000 IQD went, the
 * parts of the page, and the charts' words.
 */
const phrases: PhraseBook = {
  "The period at a glance": { ar: "الفترة في لمحة", ckb: "ماوەکە بە یەک سەیرکردن" },
  "What the period says": { ar: "ما تقوله الفترة", ckb: "ماوەکە چی دەڵێت" },
  "Parts of the reports": { ar: "أقسام التقارير", ckb: "بەشەکانی ڕاپۆرتەکان" },

  // Each figure against the days just before, as many.
  "{pct}% more than the {n} day(s) before": {
    ar: "أكثر بـ{pct}% من الأيام الـ{n} السابقة",
    ckb: "{pct}% زیاتر لە {n} ڕۆژی پێشوو",
  },
  "{pct}% less than the {n} day(s) before": {
    ar: "أقل بـ{pct}% من الأيام الـ{n} السابقة",
    ckb: "{pct}% کەمتر لە {n} ڕۆژی پێشوو",
  },
  "About as the {n} day(s) before": {
    ar: "قريب من الأيام الـ{n} السابقة",
    ckb: "نزیکەی وەک {n} ڕۆژی پێشوو",
  },
  "{n} point(s) more than the {days} day(s) before": {
    ar: "أعلى بـ{n} نقطة من الأيام الـ{days} السابقة",
    ckb: "{n} خاڵ زیاتر لە {days} ڕۆژی پێشوو",
  },
  "{n} point(s) less than the {days} day(s) before": {
    ar: "أقل بـ{n} نقطة من الأيام الـ{days} السابقة",
    ckb: "{n} خاڵ کەمتر لە {days} ڕۆژی پێشوو",
  },
  "{pct}% of net revenue": { ar: "{pct}% من صافي الإيرادات", ckb: "{pct}%ی داهاتی پوخت" },

  // What the period says.
  "{n} reconciliation difference(s): look into them before trusting these figures.": {
    ar: "فروق المطابقة: {n}. راجعها قبل الاعتماد على هذه الأرقام.",
    ckb: "{n} جیاوازیی بەراوردکردن: پێش متمانەکردن بەم ژمارانە سەیریان بکە.",
  },
  "The books tie: every record agrees with its account.": {
    ar: "الدفاتر متطابقة: كل سجل يوافق حسابه.",
    ckb: "دەفتەرەکان یەکدەگرنەوە: هەموو تۆمارێک لەگەڵ هەژمارەکەی دەگونجێت.",
  },
  "Net revenue was {amount}; the {n} day(s) before had none to compare with.": {
    ar: "كان صافي الإيرادات {amount}؛ ولم يكن في الأيام الـ{n} السابقة ما يُقارن به.",
    ckb: "داهاتی پوخت {amount} بوو؛ لە {n} ڕۆژی پێشوودا هیچ نەبوو بۆ بەراوردکردن.",
  },
  "Net revenue was {pct}% more than in the {n} day(s) before.": {
    ar: "كان صافي الإيرادات أعلى بـ{pct}% منه في الأيام الـ{n} السابقة.",
    ckb: "داهاتی پوخت {pct}% زیاتر بوو لە {n} ڕۆژی پێشوو.",
  },
  "Net revenue was {pct}% less than in the {n} day(s) before.": {
    ar: "كان صافي الإيرادات أقل بـ{pct}% منه في الأيام الـ{n} السابقة.",
    ckb: "داهاتی پوخت {pct}% کەمتر بوو لە {n} ڕۆژی پێشوو.",
  },
  "Net revenue was about as in the {n} day(s) before.": {
    ar: "كان صافي الإيرادات قريبًا مما كان في الأيام الـ{n} السابقة.",
    ckb: "داهاتی پوخت نزیکەی وەک {n} ڕۆژی پێشوو بوو.",
  },
  "{now} against {before}.": { ar: "{now} مقابل {before}.", ckb: "{now} بەرامبەر {before}." },
  "You kept {pct}% of net revenue after the cost of sales.": {
    ar: "بقي لك {pct}% من صافي الإيرادات بعد تكلفة المبيعات.",
    ckb: "{pct}%ی داهاتی پوخت مایەوە دوای تێچووی فرۆشتن.",
  },
  "{pct}% in the {n} day(s) before.": {
    ar: "{pct}% في الأيام الـ{n} السابقة.",
    ckb: "{pct}% لە {n} ڕۆژی پێشوودا.",
  },
  "After every expense, the period made {amount}: {pct}% of net revenue.": {
    ar: "بعد كل المصروفات، ربحت الفترة {amount}: {pct}% من صافي الإيرادات.",
    ckb: "دوای هەموو خەرجییەک، ماوەکە {amount} قازانجی کرد: {pct}%ی داهاتی پوخت.",
  },
  "After every expense, the period lost {amount}.": {
    ar: "بعد كل المصروفات، خسرت الفترة {amount}.",
    ckb: "دوای هەموو خەرجییەک، ماوەکە {amount} زیانی کرد.",
  },
  "{account} was the largest expense: {amount}, {pct}% of net revenue.": {
    ar: "كان {account} أكبر المصروفات: {amount}، أي {pct}% من صافي الإيرادات.",
    ckb: "{account} گەورەترین خەرجی بوو: {amount}، {pct}%ی داهاتی پوخت.",
  },
  "The delivery platforms' commission and fees came to {amount}: {pct}% of net revenue.": {
    ar: "بلغت عمولات منصات التوصيل ورسومها {amount}: {pct}% من صافي الإيرادات.",
    ckb: "کۆمیسیۆن و کرێی پلاتفۆرمەکانی گەیاندن گەیشتە {amount}: {pct}%ی داهاتی پوخت.",
  },
  "Losses came to {amount}, {pct}% of net sales.": {
    ar: "بلغت الخسائر {amount}، أي {pct}% من صافي المبيعات.",
    ckb: "زیانەکان گەیشتنە {amount}، {pct}%ی فرۆشی پوخت.",
  },
  "Losses came to {amount}.": { ar: "بلغت الخسائر {amount}.", ckb: "زیانەکان گەیشتنە {amount}." },
  "The largest kind: {kind}, {amount}.": {
    ar: "أكبرها نوعًا: {kind}، {amount}.",
    ckb: "گەورەترین جۆر: {kind}، {amount}.",
  },
  "{amount} owed to suppliers is past due, {old} of it by more than 30 days.": {
    ar: "{amount} مستحقة للموردين تجاوزت موعدها، منها {old} بأكثر من 30 يومًا.",
    ckb: "{amount} قەرزی دابینکەران کاتەکەی تێپەڕیوە، {old}ی زیاتر لە 30 ڕۆژ.",
  },
  "{amount} owed to suppliers is past due.": {
    ar: "{amount} مستحقة للموردين تجاوزت موعدها.",
    ckb: "{amount} قەرزی دابینکەران کاتەکەی تێپەڕیوە.",
  },
  "Sales of {amount} were costed at nothing: their profit is overstated until what they use has a cost.":
    {
      ar: "مبيعات بقيمة {amount} حُسبت كلفتها صفرًا: ربحها مبالغ فيه إلى أن تُعطى مكوناتها كلفة.",
      ckb: "فرۆشتنی {amount} تێچووی سفر بۆ دانرا: قازانجەکەیان زیادە پیشان دەدرێت تا ئەوەی بەکاری دەهێنن تێچووی دەبێت.",
    },

  // Where each 1,000 IQD of net revenue went.
  "Where each 1,000 IQD of net revenue went": {
    ar: "أين ذهب كل 1,000 دينار من صافي الإيرادات",
    ckb: "هەر 1,000 دیناری داهاتی پوخت بۆ کوێ چوو",
  },
  "What was sold cost": { ar: "كلفة ما بيع", ckb: "تێچووی ئەوەی فرۆشرا" },
  "Delivery platforms": { ar: "منصات التوصيل", ckb: "پلاتفۆرمەکانی گەیاندن" },
  "Waste and stock differences": {
    ar: "الهدر وفروقات المخزون",
    ckb: "بەفیڕۆچوون و جیاوازییەکانی کۆگا",
  },
  "Rent and running costs": { ar: "الإيجار وتكاليف التشغيل", ckb: "کرێ و تێچووەکانی بەڕێوەبردن" },
  "Kept as profit": { ar: "بقي ربحًا", ckb: "وەک قازانج مایەوە" },
  "The period's loss": { ar: "خسارة الفترة", ckb: "زیانی ماوەکە" },
  "{amount} in all": { ar: "{amount} إجمالًا", ckb: "{amount} بە گشتی" },
  "From the P&L: what was sold cost is the recipes' cost of goods; waste and stock differences are waste, preparation loss, count differences and price differences on deliveries; the staff are their pay and their meals.":
    {
      ar: "من قائمة الأرباح والخسائر: كلفة ما بيع هي كلفة البضاعة حسب الوصفات؛ والهدر وفروقات المخزون هي الهدر وخسارة التحضير وفروقات الجرد وفروقات الأسعار عند الاستلام؛ والموظفون رواتبهم ووجباتهم.",
      ckb: "لە قازانج و زیانەوە: تێچووی ئەوەی فرۆشرا تێچووی کاڵاکانە بەپێی ڕەچەتەکان؛ بەفیڕۆچوون و جیاوازییەکانی کۆگا بریتین لە بەفیڕۆچوون و زیانی ئامادەکردن و جیاوازییەکانی ژماردن و جیاوازیی نرخ لە وەرگرتندا؛ کارمەندانیش مووچە و ژەمەکانیانن.",
    },

  // The parts of the page.
  Profit: { ar: "الربح", ckb: "قازانج" },
  "Buying and stock": { ar: "الشراء والمخزون", ckb: "کڕین و کۆگا" },
  Checks: { ar: "التحقق", ckb: "پشکنینەکان" },

  // The charts in the reports.
  "Net sales by channel": { ar: "صافي المبيعات حسب القناة", ckb: "فرۆشی پوخت بەپێی کەناڵ" },
  "{share}% of net sales · margin {kept}%": {
    ar: "{share}% من صافي المبيعات · الهامش {kept}%",
    ckb: "{share}%ی فرۆشی پوخت · پەراوێز {kept}%",
  },
  "Net sales by payment method": {
    ar: "صافي المبيعات حسب طريقة الدفع",
    ckb: "فرۆشی پوخت بەپێی شێوازی پارەدان",
  },
  "{share}% of net sales": { ar: "{share}% من صافي المبيعات", ckb: "{share}%ی فرۆشی پوخت" },
  "Losses by kind": { ar: "الخسائر حسب النوع", ckb: "زیانەکان بەپێی جۆر" },
  "What is owed, by how late it is": {
    ar: "المستحق، حسب مدة التأخر",
    ckb: "ئەوەی قەرزە، بەپێی ئەوەی چەند دواکەوتووە",
  },
  "1 to 15 days late": { ar: "متأخرة من 1 إلى 15 يومًا", ckb: "1 تا 15 ڕۆژ دواکەوتوو" },
  "16 to 30 days late": { ar: "متأخرة من 16 إلى 30 يومًا", ckb: "16 تا 30 ڕۆژ دواکەوتوو" },
  "More than 30 days late": { ar: "متأخرة أكثر من 30 يومًا", ckb: "زیاتر لە 30 ڕۆژ دواکەوتوو" },
  "{share}% of what is owed": { ar: "{share}% من المستحق", ckb: "{share}%ی ئەوەی قەرزە" },

  // A check's outcome, drawn, told to a screen reader in words.
  "All good": { ar: "كل شيء سليم", ckb: "هەموو شتێک باشە" },
  Ties: { ar: "متطابق", ckb: "یەکدەگرێتەوە" },
  "Does not tie": { ar: "غير متطابق", ckb: "یەکناگرێتەوە" },
  Warning: { ar: "تنبيه", ckb: "ئاگاداری" },
  "Stops the close": { ar: "يمنع الإقفال", ckb: "ڕێگری لە داخستن دەکات" },
  "A PDF": { ar: "ملف PDF", ckb: "فایلی PDF" },
  "A picture": { ar: "صورة", ckb: "وێنە" },

  // Production: the day's plan opens the batch form filled in.
  "Record these": { ar: "سجّل هذه الدفعات", ckb: "ئەم دەستانە تۆمار بکە" },

  // Products & Recipes: the whole menu, one tap from a photo.
  "Photos for the till": { ar: "صور لنقطة البيع", ckb: "وێنەکان بۆ خاڵی فرۆشتن" },
  "{n} of {total} have one": { ar: "{n} من {total} لها صورة", ckb: "{n} لە {total} وێنەیان هەیە" },
  "Tap a product to give it a photo, or a new one: a phone offers its camera or its pictures. One with no photo shows its colour and its initials.":
    {
      ar: "اضغط على منتج لتعطيه صورة أو صورة جديدة: يعرض الهاتف الكاميرا أو الصور. المنتج بلا صورة يظهر بلونه وحروفه الأولى.",
      ckb: "دەست لە بەرهەمێک بدە بۆ ئەوەی وێنەیەک یان وێنەیەکی نوێی بدەیتێ: مۆبایل کامێرا یان وێنەکانی پیشان دەدات. بەرهەمێک کە وێنەی نییە بە ڕەنگ و پیتە سەرەتاییەکانی دەردەکەوێت.",
    },
  "Photo for the till": { ar: "صورة لنقطة البيع", ckb: "وێنە بۆ خاڵی فرۆشتن" },

  // The sales analysis, drawn over time.
  "Average: {amount} an hour sold in": {
    ar: "المتوسط: {amount} في كل ساعة بيع فيها",
    ckb: "تێکڕا: {amount} لە هەر کاتژمێرێک کە تێیدا فرۆشرا",
  },
  "Average: {amount} a day sold in": {
    ar: "المتوسط: {amount} في كل يوم بيع فيه",
    ckb: "تێکڕا: {amount} لە هەر ڕۆژێک کە تێیدا فرۆشرا",
  },
};

export default phrases;
