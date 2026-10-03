import type { PhraseBook } from "./types";

/**
 * The end of the day, step by step: the bills, the people clocked in, the
 * drawers, the losses waiting, the card and platform money and the red
 * alerts, and the day in numbers.
 */
const phrases: PhraseBook = {
  "Everything is done: the day can close.": {
    ar: "كل شيء منجز: يمكن إغلاق اليوم.",
    ckb: "هەموو شتێک تەواو بووە: ڕۆژەکە دەتوانرێت دابخرێت.",
  },
  "{done} of {total} done": { ar: "{done} من {total} منجزة", ckb: "{done} لە {total} تەواو بوون" },
  "Print the day below to keep it, or save it as a PDF.": {
    ar: "اطبع اليوم أدناه للاحتفاظ به، أو احفظه ملف PDF.",
    ckb: "ڕۆژەکەی خوارەوە چاپ بکە بۆ هەڵگرتنی، یان وەک PDF پاشەکەوتی بکە.",
  },
  "Work down the list: each step opens where it is done, and is ticked here once it is.": {
    ar: "اتبع القائمة من أعلاها: كل خطوة تفتح حيث تُنجز، وتُعلَّم هنا حين تُنجز.",
    ckb: "لیستەکە لە سەرەوە بۆ خوارەوە تەواو بکە: هەر هەنگاوێک ئەو شوێنە دەکاتەوە کە تێیدا ئەنجام دەدرێت، و کاتێک تەواو بوو لێرە نیشانە دەکرێت.",
  },
  "The steps": { ar: "الخطوات", ckb: "هەنگاوەکان" },
  // On the dashboard, from the late afternoon.
  "Closing up? The end of the day, step by step": {
    ar: "حان وقت الإغلاق؟ نهاية اليوم خطوة بخطوة",
    ckb: "کاتی داخستنە؟ کۆتایی ڕۆژ هەنگاو بە هەنگاو",
  },
  Done: { ar: "منجز", ckb: "تەواو" },
  "Still to do": { ar: "لم يُنجز بعد", ckb: "هێشتا ماوە" },

  // The bills.
  "Bills paid": { ar: "الفواتير مدفوعة", ckb: "پسووڵەکان دراون" },
  "{n} bill(s) still open, {amount} in all.": {
    ar: "{n} فاتورة ما زالت مفتوحة، بمجموع {amount}.",
    ckb: "{n} پسووڵە هێشتا کراوەن، کۆی گشتی {amount}.",
  },
  "No bill is open.": { ar: "لا توجد فاتورة مفتوحة.", ckb: "هیچ پسووڵەیەک کراوە نییە." },
  "A bill left open is paid in the next session; one that will not be paid is cancelled by a manager, with the reason.":
    {
      ar: "الفاتورة التي تبقى مفتوحة تُدفع في الوردية التالية؛ والتي لن تُدفع يلغيها مدير مع ذكر السبب.",
      ckb: "پسووڵەیەک کە کراوە بمێنێتەوە لە شیفتی داهاتوودا دەدرێت؛ ئەوەی نادرێت بەڕێوەبەرێک بە هۆکارەکەیەوە هەڵیدەوەشێنێتەوە.",
    },
  "Open the till": { ar: "افتح نقطة البيع", ckb: "خاڵی فرۆشتن بکەرەوە" },

  // The people.
  "Everyone clocked out": { ar: "سجّل الجميع انصرافهم", ckb: "هەمووان ڕۆیشتنیان تۆمار کردووە" },
  "{n} still clocked in.": {
    ar: "{n} ما زالوا مسجَّلي الحضور.",
    ckb: "{n} کەس هێشتا هاتنیان تۆمار کراوە.",
  },
  "Each clocks out on the till as they leave; a manager corrects forgotten hours on Staff.": {
    ar: "يسجّل كلٌّ انصرافه على نقطة البيع عند مغادرته؛ ويصحّح المدير الساعات المنسية في صفحة الموظفين.",
    ckb: "هەر کەسێک لە کاتی ڕۆیشتندا لە خاڵی فرۆشتن ڕۆیشتنی تۆمار دەکات؛ بەڕێوەبەر کاتژمێرە لەبیرکراوەکان لە کارمەندان ڕاست دەکاتەوە.",
  },
  "Open the hours": { ar: "افتح الساعات", ckb: "کاتژمێرەکان بکەرەوە" },

  // The drawers.
  "Drawers closed and counted": {
    ar: "أدراج النقد مغلقة ومعدودة",
    ckb: "دەخیلەکان داخراون و ژمێردراون",
  },
  "{n} drawer(s) still open.": {
    ar: "{n} درج نقد ما زال مفتوحًا.",
    ckb: "{n} دەخیلە هێشتا کراوەیە.",
  },
  "Every drawer is closed.": { ar: "كل أدراج النقد مغلقة.", ckb: "هەموو دەخیلەکان داخراون." },
  "Counted today: {n}, and they agreed.": {
    ar: "عُدّ اليوم: {n}، وكانت مطابقة.",
    ckb: "ئەمڕۆ ژمێردرا: {n}، و ڕێک بوون.",
  },
  "Counted today: {n}, {amount} short in all.": {
    ar: "عُدّ اليوم: {n}، بنقص {amount} في المجموع.",
    ckb: "ئەمڕۆ ژمێردرا: {n}، کۆی گشتی {amount} کەم.",
  },
  "Counted today: {n}, {amount} over in all.": {
    ar: "عُدّ اليوم: {n}، بزيادة {amount} في المجموع.",
    ckb: "ئەمڕۆ ژمێردرا: {n}، کۆی گشتی {amount} زیاد.",
  },
  "{n} closed without a count: the next opening count finds what it held.": {
    ar: "{n} أُغلق دون عدّ: عدّ الفتح التالي يجد ما كان فيه.",
    ckb: "{n} بێ ژماردن داخرا: ژماردنی کردنەوەی داهاتوو ئەوەی تێیدا بوو دەدۆزێتەوە.",
  },
  "Count each drawer as it closes: what it should hold is shown once the count is in.": {
    ar: "عُدّ كل درج نقد عند إغلاقه: ما يجب أن يحويه يظهر بعد إدخال العدّ.",
    ckb: "هەر دەخیلەیەک لە کاتی داخستنیدا بژمێرە: ئەوەی دەبێت تێیدا بێت دوای تۆمارکردنی ژماردنەکە پیشان دەدرێت.",
  },

  // The losses.
  "Losses approved": { ar: "الخسائر موافَق عليها", ckb: "زیانەکان ڕەزامەندییان لەسەر دراوە" },
  "{n} loss(es) wait for a manager, {amount} in all.": {
    ar: "{n} خسارة تنتظر مديرًا، بمجموع {amount}.",
    ckb: "{n} زیان چاوەڕێی بەڕێوەبەرێکن، کۆی گشتی {amount}.",
  },
  "{n} loss(es) wait for a manager.": {
    ar: "{n} خسارة تنتظر مديرًا.",
    ckb: "{n} زیان چاوەڕێی بەڕێوەبەرێکن.",
  },
  "No loss waits for approval.": {
    ar: "لا توجد خسارة تنتظر الموافقة.",
    ckb: "هیچ زیانێک چاوەڕێی ڕەزامەندی نییە.",
  },
  "A manager other than the one who recorded it approves each, or reverses it.": {
    ar: "يوافق على كل خسارة مدير غير الذي سجّلها، أو يعكسها.",
    ckb: "بەڕێوەبەرێک جگە لەوەی تۆماری کردووە ڕەزامەندی لەسەر هەر یەکێکیان دەدات، یان هەڵیدەگەڕێنێتەوە.",
  },
  "Approve them": { ar: "وافق عليها", ckb: "ڕەزامەندییان لەسەر بدە" },

  // The money still to come.
  "Card and platform money": { ar: "أموال البطاقات والمنصات", ckb: "پارەی کارت و پلاتفۆرمەکان" },
  "Card today: {amount}. Check it against the terminal's own total for the day.": {
    ar: "البطاقات اليوم: {amount}. طابقها مع مجموع جهاز البطاقات لهذا اليوم.",
    ckb: "کارت ئەمڕۆ: {amount}. لەگەڵ کۆی ئەمڕۆی ئامێری کارتەکە بەراوردی بکە.",
  },
  "No card payments today.": {
    ar: "لا مدفوعات بالبطاقة اليوم.",
    ckb: "ئەمڕۆ هیچ پارەدانێک بە کارت نەبووە.",
  },
  "Card takings still to reach the bank: {amount} over {n} day(s).": {
    ar: "مقبوضات البطاقات التي لم تصل إلى البنك بعد: {amount} عن {n} يوم.",
    ckb: "داهاتی کارت کە هێشتا نەگەیشتووەتە بانک: {amount} بۆ {n} ڕۆژ.",
  },
  "Delivery platforms still owe {amount} for {n} order(s).": {
    ar: "ما زالت منصات التوصيل مدينة بـ{amount} عن {n} طلب.",
    ckb: "پلاتفۆرمەکانی گەیاندن هێشتا {amount} قەرزارن بۆ {n} داواکاری.",
  },
  "Late: settle it on Sales, or record what the platform paid on Delivery Platforms.": {
    ar: "متأخرة: سوّها في المبيعات، أو سجّل ما دفعته المنصة في منصات التوصيل.",
    ckb: "دواکەوتووە: لە فرۆشتن یەکلایی بکەرەوە، یان ئەوەی پلاتفۆرمەکە دای لە پلاتفۆرمەکانی گەیاندن تۆمار بکە.",
  },
  "Nothing is late.": { ar: "لا شيء متأخر.", ckb: "هیچ شتێک دوا نەکەوتووە." },

  // The alerts.
  "Red alerts answered": {
    ar: "التنبيهات الحمراء مُجاب عنها",
    ckb: "ئاگادارکردنەوە سوورەکان وەڵام دراونەتەوە",
  },
  "{n} red alert(s) wait for an answer.": {
    ar: "{n} تنبيه أحمر ينتظر ردًّا.",
    ckb: "{n} ئاگادارکردنەوەی سوور چاوەڕێی وەڵامن.",
  },
  "No red alert waits.": {
    ar: "لا يوجد تنبيه أحمر ينتظر.",
    ckb: "هیچ ئاگادارکردنەوەیەکی سوور چاوەڕێ نییە.",
  },
  "{n} orange alert(s) can wait for a quiet moment.": {
    ar: "{n} تنبيه برتقالي يمكنه انتظار وقت فراغ.",
    ckb: "{n} ئاگادارکردنەوەی پرتەقاڵی دەتوانن چاوەڕێی کاتێکی هێمن بکەن.",
  },
  "Answer them": { ar: "أجب عنها", ckb: "وەڵامیان بدەرەوە" },

  // The day in numbers.
  "The day in numbers": { ar: "اليوم بالأرقام", ckb: "ڕۆژەکە بە ژمارە" },
  "Today so far, as the books have it": {
    ar: "اليوم حتى الآن، كما في الدفاتر",
    ckb: "ئەمڕۆ تا ئێستا، وەک لە دەفتەرەکاندایە",
  },
  "Today's reports": { ar: "تقارير اليوم", ckb: "ڕاپۆرتەکانی ئەمڕۆ" },
  "after waste and every other cost of sales": {
    ar: "بعد الهدر وكل تكاليف المبيعات الأخرى",
    ckb: "دوای بەفیڕۆچوون و هەموو تێچووەکانی تری فرۆشتن",
  },
  "Voids and refunds": { ar: "الإلغاءات والمستردات", ckb: "هەڵوەشاندنەوە و گەڕاندنەوەی پارە" },
  "{voids} void(s), {refunds} refund(s)": {
    ar: "{voids} إلغاء، {refunds} استرداد",
    ckb: "{voids} هەڵوەشاندنەوە، {refunds} گەڕاندنەوەی پارە",
  },
  "at what it cost": { ar: "بتكلفته", ckb: "بە تێچووەکەی" },
  "How it was paid": { ar: "كيف دُفع", ckb: "چۆن پارەکەی درا" },
};

export default phrases;
