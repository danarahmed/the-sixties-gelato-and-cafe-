import type { PhraseBook } from "./types";

/**
 * What the café is told without asking: the alerts on the dashboard (their
 * titles, why they matter and what to do, as the database writes them, with
 * {1}, {2}… where it puts a value), the words inside them, the daily brief,
 * and the names src/lib/alerts.ts gives the rules and their limits.
 */
const phrases: PhraseBook = {
  // The rules (RULE_LABEL), and how sure each is (CONFIDENCE_LABEL).
  "Cash below zero": { ar: "النقد تحت الصفر", ckb: "پارەی نەختینە لە ژێر سفر" },
  "Drawer not counted": { ar: "درج النقد غير معدود", ckb: "دەخیلە نەژمێردراوە" },
  "Stock count left open": { ar: "جرد مخزون بقي مفتوحًا", ckb: "ژماردنی کۆگا بە کراوەیی ماوەتەوە" },
  "Running out": { ar: "على وشك النفاد", ckb: "خەریکە تەواو دەبێت" },
  "Below its reorder level": { ar: "دون حدّ إعادة الطلب", ckb: "لە خوار ئاستی داواکردنەوە" },
  "Delivery price confirmed": { ar: "تأكيد سعر توريد", ckb: "نرخی گەیاندن پشتڕاست کرایەوە" },
  "Sold with no recipe": { ar: "يُباع بلا وصفة", ckb: "بێ ڕەسەتە دەفرۆشرێت" },
  "No cost yet": { ar: "لا كلفة بعد", ckb: "هێشتا تێچووی نییە" },
  Margin: { ar: "هامش الربح", ckb: "پەراوێزی قازانج" },
  "Waste above its usual": { ar: "هدر فوق المعتاد", ckb: "بەفیڕۆچوون لە ئاسایی زیاترە" },
  "Exceptions by one person": {
    ar: "حالات استثنائية من شخص واحد",
    ckb: "حاڵەتی نائاسایی لەلایەن یەک کەسەوە",
  },
  "Card money not banked": {
    ar: "أموال بطاقات لم تصل إلى البنك",
    ckb: "پارەی کارت نەگەیشتۆتە بانک",
  },
  "Platform money not received": {
    ar: "أموال منصات لم تُستلم",
    ckb: "پارەی پلاتفۆرم وەرنەگیراوە",
  },
  "Supplier bill due": { ar: "فاتورة مورّد مستحقة", ckb: "پسووڵەی دابینکەر کاتی هاتووە" },
  "Possible price typo": {
    ar: "خطأ محتمل في كتابة السعر",
    ckb: "هەڵەیەکی گومانلێکراو لە نووسینی نرخ",
  },
  "Possible duplicate payment": {
    ar: "دفعة مكررة محتملة",
    ckb: "پارەدانێکی دووبارەی گومانلێکراو",
  },
  Sure: { ar: "مؤكد", ckb: "دڵنیا" },
  "Fairly sure": { ar: "مرجّح", ckb: "تا ڕادەیەک دڵنیا" },
  "Early sign": { ar: "إشارة مبكرة", ckb: "نیشانەیەکی زوو" },

  // The limits the owner sets (THRESHOLD_LABEL, and the database's own labels).
  "Margin target (%)": { ar: "هامش الربح المستهدف (%)", ckb: "ئامانجی پەراوێزی قازانج (%)" },
  "Waste spike: at least (IQD)": {
    ar: "ارتفاع الهدر: على الأقل (IQD)",
    ckb: "بەرزبوونەوەی بەفیڕۆچوون: لانیکەم (IQD)",
  },
  "{1}: enter a number": { ar: "{1}: أدخل رقمًا", ckb: "{1}: ژمارەیەک بنووسە" },

  // Cash below zero.
  "{1} is {2} IQD: below zero": {
    ar: "رصيد {1} هو {2} IQD: تحت الصفر",
    ckb: "باڵانسی {1} {2} IQD یە: لە ژێر سفر",
  },
  "Money cannot leave a place before it is there: a payment was recorded from the wrong place, or takings are missing.":
    {
      ar: "لا يمكن أن يخرج المال من مكان قبل أن يدخله: إمّا أن دفعة سُجّلت من المكان الخطأ، أو أن هناك مقبوضات ناقصة.",
      ckb: "پارە ناتوانێت لە شوێنێک دەربچێت پێش ئەوەی تێیدا بێت: یان پارەدانێک لە شوێنی هەڵەوە تۆمار کراوە، یان داهاتێک ون بووە.",
    },
  "Open the account's journal lines and record where the money really came from.": {
    ar: "افتح بنود القيود لهذا الحساب وسجّل من أين جاء المال فعلًا.",
    ckb: "هێڵەکانی تۆماری ئەم هەژمارە بکەرەوە و تۆمار بکە کە پارەکە بەڕاستی لە کوێوە هات.",
  },

  // The drawer not counted.
  "The drawer at {1} has not been counted for {2}": {
    ar: "لم يُعَدّ درج النقد في {1} عن يوم {2}",
    ckb: "دەخیلەی {1} بۆ ڕۆژی {2} نەژمێردراوە",
  },
  "The drawer at {1} has not been counted for {2} days, since {3}": {
    ar: "لم يُعَدّ درج النقد في {1} عن {2} أيام، ابتداءً من {3}",
    ckb: "دەخیلەی {1} بۆ {2} ڕۆژ نەژمێردراوە، لە {3}ەوە",
  },
  "Until the drawer is counted, nobody knows whether the cash is all there.": {
    ar: "ما لم يُعَدّ الدرج، لا أحد يعرف إن كان النقد كاملًا.",
    ckb: "تا دەخیلەکە نەژمێردرێت، کەس نازانێت ئایا هەموو پارەکە لەوێیە.",
  },
  "Count the drawer on Sales.": {
    ar: "اعدد درج النقد في المبيعات.",
    ckb: "دەخیلەکە لە فرۆشتن بژمێرە.",
  },

  // A stock count left open.
  "A stock count has been open since {1}": {
    ar: "جرد مخزون مفتوح منذ {1}",
    ckb: "ژماردنێکی کۆگا لە {1}ەوە کراوەیە",
  },
  "An open count is not in the books yet, and the longer it stays open the harder it is to finish honestly.":
    {
      ar: "الجرد المفتوح لم يدخل الدفاتر بعد، وكلما طال بقاؤه مفتوحًا صعُب إنهاؤه بأمانة.",
      ckb: "ژماردنی کراوە هێشتا نەچووەتە ناو دەفتەرەکان، و تا زیاتر کراوە بمێنێتەوە، تەواوکردنی بە ڕاستگۆیی قورستر دەبێت.",
    },
  "Finish it, or cancel it, on Stock Count.": {
    ar: "أنهِه أو ألغِه من جرد المخزون.",
    ckb: "لە ژماردنی کۆگا تەواوی بکە یان هەڵیبوەشێنەوە.",
  },

  // Running out, and below the reorder level.
  "{1} runs out in {2}: {3} {4} left, using about {5} a day": {
    ar: "{1} ينفد خلال {2}: بقي {3} {4}، والاستهلاك نحو {5} يوميًا",
    ckb: "{1} لە ماوەی {2}دا تەواو دەبێت: {3} {4} ماوە، ڕۆژانە نزیکەی {5} بەکاردێت",
  },
  "no time": { ar: "لحظات", ckb: "چەند ساتێک" },
  "under a day": { ar: "أقل من يوم", ckb: "کەمتر لە ڕۆژێک" },
  "{1} days": { ar: "{1} أيام", ckb: "{1} ڕۆژ" },
  each: { ar: "قطعة", ckb: "دانە" },
  "What is sold without stock is costed wrongly, and customers are turned away.": {
    ar: "ما يُباع بلا مخزون تُحسب كلفته خطأً، ويُردّ الزبائن خائبين.",
    ckb: "ئەوەی بەبێ کۆگا دەفرۆشرێت تێچووەکەی بە هەڵە هەژمار دەکرێت، و کڕیاران بێ بەش دەگەڕێنەوە.",
  },
  "Make a batch on Production.": {
    ar: "حضّر دفعة في الإنتاج.",
    ckb: "لە بەرهەمهێنان دەستەیەک دروست بکە.",
  },
  "Order about {1} {2} (a week of use).": {
    ar: "اطلب نحو {1} {2} (استهلاك أسبوع).",
    ckb: "نزیکەی {1} {2} داوا بکە (بەکارهێنانی هەفتەیەک).",
  },
  "{1}: {2} {3} on hand, below its reorder level of {4}": {
    ar: "{1}: المتوفر {2} {3}، دون حدّ إعادة الطلب البالغ {4}",
    ckb: "{1}: {2} {3} لە کۆگادایە، لە خوار ئاستی داواکردنەوەی {4}",
  },
  "Below the reorder level there may not be enough until the next delivery.": {
    ar: "تحت حدّ إعادة الطلب قد لا تكفي الكمية حتى التوريد القادم.",
    ckb: "لە خوار ئاستی داواکردنەوە لەوانەیە تا گەیاندنی داهاتوو بەش نەکات.",
  },
  "Order it.": { ar: "اطلبه.", ckb: "داوای بکە." },

  // A delivery price confirmed: the price check of receiving (receive_goods).
  "{1} — confirmed by {2}": { ar: "{1} — أكّده {2}", ckb: "{1} — {2} پشتڕاستی کردەوە" },
  "A delivery price was confirmed": {
    ar: "تم تأكيد سعر توريد",
    ckb: "نرخی گەیاندنێک پشتڕاست کرایەوە",
  },
  "{1} at {2} each is {3}% above its cost now ({4} each)": {
    ar: "{1} بسعر {2} للقطعة أعلى بنسبة {3}% من كلفته الحالية ({4} للقطعة)",
    ckb: "{1} بە {2} بۆ هەر دانەیەک {3}% لە تێچووی ئێستای زیاترە ({4} بۆ هەر دانەیەک)",
  },
  "{1} at {2} each is {3}% below its cost now ({4} each)": {
    ar: "{1} بسعر {2} للقطعة أقل بنسبة {3}% من كلفته الحالية ({4} للقطعة)",
    ckb: "{1} بە {2} بۆ هەر دانەیەک {3}% لە تێچووی ئێستای کەمترە ({4} بۆ هەر دانەیەک)",
  },
  "{1} at {2} a {3} is {4}% above its cost now ({5} a {6})": {
    ar: "{1} بسعر {2} لكل {3} أعلى بنسبة {4}% من كلفته الحالية ({5} لكل {6})",
    ckb: "{1} بە {2} بۆ هەر {3}، {4}% لە تێچووی ئێستای زیاترە ({5} بۆ هەر {6})",
  },
  "{1} at {2} a {3} is {4}% below its cost now ({5} a {6})": {
    ar: "{1} بسعر {2} لكل {3} أقل بنسبة {4}% من كلفته الحالية ({5} لكل {6})",
    ckb: "{1} بە {2} بۆ هەر {3}، {4}% لە تێچووی ئێستای کەمترە ({5} بۆ هەر {6})",
  },
  "A price typed wrongly changes the cost of everything made from the item until it is corrected.":
    {
      ar: "السعر المكتوب خطأً يغيّر كلفة كل ما يُصنع من المادة حتى يُصحَّح.",
      ckb: "نرخێکی بە هەڵە نووسراو تێچووی هەموو ئەو شتانە دەگۆڕێت کە لەو کاڵایە دروست دەکرێن، تا ڕاست دەکرێتەوە.",
    },
  "Check it against the supplier's invoice.": {
    ar: "طابقه مع فاتورة المورّد.",
    ckb: "لەگەڵ پسووڵەی دابینکەر بەراوردی بکە.",
  },

  // Sold with no recipe, margins, and ingredients with no cost.
  "{1} cannot be sold: its recipe has no version in force today": {
    ar: "لا يمكن بيع {1}: ليس لوصفته إصدار ساري المفعول اليوم",
    ckb: "{1} ناتوانرێت بفرۆشرێت: ڕەسەتەکەی هیچ وەشانێکی بەرکاری ئەمڕۆی نییە",
  },
  "{1} is sold with no recipe: its sales are costed at nothing": {
    ar: "{1} يُباع بلا وصفة: تُحسب كلفة مبيعاته صفرًا",
    ckb: "{1} بێ ڕەسەتە دەفرۆشرێت: تێچووی فرۆشتنەکانی بە سفر هەژمار دەکرێت",
  },
  "A sale costed at nothing overstates the profit, and its stock is never taken off the shelf.": {
    ar: "البيع المحسوبة كلفته صفرًا يضخّم الربح، ولا يُخصم مخزونه من الرف أبدًا.",
    ckb: "فرۆشتنێک کە تێچووەکەی بە سفر هەژمار کرابێت قازانج زیاتر لە ڕاستی پیشان دەدات، و کۆگاکەی هەرگیز لە ڕەفەکە کەم ناکرێتەوە.",
  },
  "Give it its recipe on Products, or say why it uses no stock.": {
    ar: "أعطه وصفته في المنتجات والوصفات، أو اذكر لماذا لا يستهلك مخزونًا.",
    ckb: "لە بەرهەم و ڕەسەتەکان ڕەسەتەکەی بۆ دابنێ، یان بڵێ بۆچی هیچ کۆگایەک بەکارناهێنێت.",
  },
  "{1} ({2}): {3} at {4} IQD, costing {5}": {
    ar: "{1} ({2}): {3} بسعر {4} IQD، وكلفته {5}",
    ckb: "{1} ({2}): {3} بە نرخی {4} IQD، تێچووەکەی {5}",
  },
  "sold below cost": { ar: "يُباع بأقل من كلفته", ckb: "بە کەمتر لە تێچوو دەفرۆشرێت" },
  "{1}% margin": { ar: "هامش {1}%", ckb: "پەراوێزی {1}%" },
  "Every one sold loses money.": {
    ar: "كل قطعة تُباع تخسر مالًا.",
    ckb: "هەر دانەیەک بفرۆشرێت پارە لەدەست دەدات.",
  },
  "Under the {1}% target, the price no longer covers what the recipe costs now.": {
    ar: "تحت الهدف البالغ {1}%، لم يعد السعر يغطي ما تكلّفه الوصفة الآن.",
    ckb: "لە خوار ئامانجی {1}%، نرخەکە ئیتر تێچووی ئێستای ڕەسەتەکە داناپۆشێت.",
  },
  "Review the price, or the recipe, on Products.": {
    ar: "راجع السعر أو الوصفة في المنتجات والوصفات.",
    ckb: "نرخەکە یان ڕەسەتەکە لە بەرهەم و ڕەسەتەکان بپشکنەوە.",
  },
  "{1} has no cost yet, and 1 product uses it: {2}": {
    ar: "{1} لا كلفة له بعد، ويستخدمه منتج واحد: {2}",
    ckb: "{1} هێشتا تێچووی نییە، و یەک بەرهەم بەکاری دەهێنێت: {2}",
  },
  "{1} has no cost yet, and {2} products use it: {3}": {
    ar: "{1} لا كلفة له بعد، وتستخدمه {2} منتجات: {3}",
    ckb: "{1} هێشتا تێچووی نییە، و {2} بەرهەم بەکاری دەهێنن: {3}",
  },
  "{1} and {2} more": { ar: "{1} و{2} غيرها", ckb: "{1} و {2}ی تر" },
  "Every sale that uses it is costed at nothing for it, so its profit is overstated.": {
    ar: "كل بيع يستخدمه تُحسب كلفته منه صفرًا، فيُضخَّم ربحه.",
    ckb: "هەر فرۆشتنێک کە بەکاری بهێنێت تێچووی ئەمەی بە سفر بۆ هەژمار دەکرێت، بۆیە قازانجەکەی زیاتر لە ڕاستی دەردەکەوێت.",
  },
  "Make a batch on Production: its cost comes from its ingredients.": {
    ar: "حضّر دفعة في الإنتاج: كلفته تأتي من مكوّناته.",
    ckb: "لە بەرهەمهێنان دەستەیەک دروست بکە: تێچووەکەی لە پێکهاتەکانییەوە دێت.",
  },
  "Receive it with its cost, or give it its opening stock, on Inventory.": {
    ar: "استلمه بكلفته، أو أدخل رصيده الافتتاحي، في المخزون.",
    ckb: "لە کۆگا بە تێچووەکەیەوە وەریبگرە، یان باڵانسی سەرەتای بۆ دابنێ.",
  },

  // Waste above its usual.
  "Waste of {1} IQD in the last 7 days, against about {2} in a usual week": {
    ar: "هدر بقيمة {1} IQD في آخر 7 أيام، مقابل نحو {2} في أسبوع معتاد",
    ckb: "بەفیڕۆچوونی {1} IQD لە 7 ڕۆژی ڕابردوودا، بەرامبەر بە نزیکەی {2} لە هەفتەیەکی ئاساییدا",
  },
  "Waste well above its usual is money leaving through the bin: a delivery gone off, a recipe, or a habit.":
    {
      ar: "الهدر الذي يفوق المعتاد بكثير مالٌ يذهب إلى سلة المهملات: توريد فسد، أو وصفة، أو عادة.",
      ckb: "بەفیڕۆچوونی زۆر لە ئاسایی زیاتر پارەیە کە بۆ ناو زبڵدان دەڕوات: گەیاندنێکی تێکچوو، ڕەسەتەیەک، یان خوویەک.",
    },
  "Look at the waste on Inventory: which items, and who recorded them.": {
    ar: "انظر إلى الهدر في المخزون: أيّ المواد، ومن سجّلها.",
    ckb: "سەیری بەفیڕۆچوون لە کۆگا بکە: کام کاڵا، و کێ تۆماری کردوون.",
  },

  // One person's voids, refunds, discounts and cancelled bills.
  "{1}: {2} void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, {3} IQD": {
    ar: "{1}: {2} من الإلغاءات أو المرتجعات أو الخصومات أو الفواتير الملغاة خلال 7 أيام، بقيمة {3} IQD",
    ckb: "{1}: {2} هەڵوەشاندنەوە، گەڕاندنەوەی پارە، داشکاندن یان پسووڵەی هەڵوەشێنراوە لە 7 ڕۆژدا، {3} IQD",
  },
  "{1}: {2} void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, {3} IQD ({4}% of their sales)":
    {
      ar: "{1}: {2} من الإلغاءات أو المرتجعات أو الخصومات أو الفواتير الملغاة خلال 7 أيام، بقيمة {3} IQD ({4}% من مبيعاته)",
      ckb: "{1}: {2} هەڵوەشاندنەوە، گەڕاندنەوەی پارە، داشکاندن یان پسووڵەی هەڵوەشێنراوە لە 7 ڕۆژدا، {3} IQD ({4}%ی فرۆشتنەکانی)",
    },
  "Most exceptions have good reasons; a pattern is worth a look. This is evidence, not an accusation.":
    {
      ar: "لمعظم الحالات الاستثنائية أسباب وجيهة؛ لكن النمط يستحق نظرة. هذا دليل، لا اتهام.",
      ckb: "زۆربەی حاڵەتە نائاساییەکان هۆکاری باشیان هەیە؛ بەڵام شێوازێکی دووبارەبوو شایەنی سەیرکردنە. ئەمە بەڵگەیە، نەک تۆمەت.",
    },
  "Review them on Reports → Exceptions.": {
    ar: "راجعها في التقارير ← الحالات الاستثنائية.",
    ckb: "لە ڕاپۆرتەکان ← حاڵەتە نائاساییەکان بیانپشکنە.",
  },

  // Card money not banked.
  "{1} IQD of card money is more than {2} days old and not yet recorded as settled": {
    ar: "{1} IQD من أموال البطاقات مضى عليها أكثر من {2} أيام ولم تُسجَّل تسويتها بعد",
    ckb: "{1} IQD لە پارەی کارت زیاتر لە {2} ڕۆژی بەسەردا تێپەڕیوە و هێشتا وەک یەکلاکراوە تۆمار نەکراوە",
  },
  "Card takings should reach the bank within a few days; money that does not may never have been taken.":
    {
      ar: "يجب أن تصل مقبوضات البطاقات إلى البنك خلال أيام قليلة؛ والمال الذي لا يصل ربما لم يُقبض أصلًا.",
      ckb: "داهاتی کارت دەبێت لە ماوەی چەند ڕۆژێکدا بگاتە بانک؛ ئەو پارەیەی نەگات لەوانەیە هەرگیز وەرنەگیرابێت.",
    },
  "Record the card settlement on Sales, from the terminal's report and the bank statement.": {
    ar: "سجّل تسوية البطاقات في المبيعات، من تقرير الجهاز وكشف حساب البنك.",
    ckb: "یەکلاکردنەوەی کارت لە فرۆشتن تۆمار بکە، لە ڕاپۆرتی ئامێرەکە و کەشفی حسابی بانکەوە.",
  },

  // Platform money not received.
  "{1} {2} order, {3} IQD, is more than {4} days old and not yet paid out; the oldest from {5}": {
    ar: "{1} طلب {2}، بقيمة {3} IQD، مضى عليه أكثر من {4} أيام ولم يُدفع بعد؛ الأقدم من {5}",
    ckb: "{1} داواکاری {2}، {3} IQD، زیاتر لە {4} ڕۆژی بەسەردا تێپەڕیوە و هێشتا پارەکەی نەدراوە؛ کۆنترینیان لە {5}",
  },
  "{1} {2} orders, {3} IQD, are more than {4} days old and not yet paid out; the oldest from {5}": {
    ar: "{1} طلبات {2}، بقيمة {3} IQD، مضى عليها أكثر من {4} أيام ولم تُدفع بعد؛ أقدمها من {5}",
    ckb: "{1} داواکاری {2}، {3} IQD، زیاتر لە {4} ڕۆژیان بەسەردا تێپەڕیوە و هێشتا پارەکەیان نەدراوە؛ کۆنترینیان لە {5}",
  },
  "Platform payouts come on a cycle; an order past it may be missing from a statement.": {
    ar: "تأتي مدفوعات المنصات على دورات؛ والطلب الذي تجاوز دورته قد يكون ناقصًا من كشف الحساب.",
    ckb: "پارەدانی پلاتفۆرمەکان بە خول دێت؛ داواکارییەک کە خولەکەی تێپەڕاندبێت لەوانەیە لە کەشفێکدا ون بووبێت.",
  },
  "Match the platform's statement on Delivery Platforms, and raise any order it left out.": {
    ar: "طابق كشف حساب المنصة في منصات التوصيل، واسأل عن أي طلب أغفله.",
    ckb: "کەشفی پلاتفۆرمەکە لە پلاتفۆرمەکانی گەیاندن بەراورد بکە، و بەدوای هەر داواکارییەکدا بچۆ کە لێی بەجێماوە.",
  },
  "{1} IQD in platform receivable is matched to no order": {
    ar: "{1} IQD في ذمم المنصات لا يقابلها أي طلب",
    ckb: "{1} IQD لە قەرزی پلاتفۆرمەکان بە هیچ داواکارییەک نەبەستراوەتەوە",
  },
  "Platform receivable is {1} IQD short of the orders waiting to be paid out": {
    ar: "ذمم المنصات أقل بـ{1} IQD من الطلبات التي تنتظر الدفع",
    ckb: "قەرزی پلاتفۆرمەکان {1} IQD کەمترە لەو داواکارییانەی چاوەڕێی پارەدانن",
  },
  "Sales from before order numbers, or a payout recorded by hand, leave platform receivable unexplained by any order.":
    {
      ar: "المبيعات السابقة لأرقام الطلبات، أو دفعة سُجّلت يدويًا، تترك في ذمم المنصات مبلغًا لا يفسّره أي طلب.",
      ckb: "فرۆشتنەکانی پێش ژمارەی داواکاری، یان پارەدانێک کە بە دەست تۆمار کرابێت، قەرزی پلاتفۆرمەکان بەبێ ڕوونکردنەوەی هیچ داواکارییەک دەهێڵنەوە.",
    },
  "Find the statement it belongs to; correct it with a journal on Journals if it was recorded by hand.":
    {
      ar: "ابحث عن كشف الحساب الذي يخصّه؛ وصحّحه بقيد في القيود إن كان مسجّلًا يدويًا.",
      ckb: "ئەو کەشفە بدۆزەرەوە کە سەر بەوە؛ ئەگەر بە دەست تۆمار کرابوو، بە تۆمارێک لە تۆمارەکان ڕاستی بکەرەوە.",
    },

  // A supplier bill due.
  "{1}: {2} IQD overdue by {3} day(s)": {
    ar: "{1}: {2} IQD متأخرة عن الاستحقاق (الأيام: {3})",
    ckb: "{1}: {2} IQD، {3} ڕۆژ لە کاتی خۆی دواکەوتووە",
  },
  "{1}: {2} IQD due today": {
    ar: "{1}: {2} IQD مستحقة اليوم",
    ckb: "{1}: {2} IQD ئەمڕۆ کاتی دانەوەیەتی",
  },
  "{1}: {2} IQD due on {3}": {
    ar: "{1}: {2} IQD مستحقة في {3}",
    ckb: "{1}: {2} IQD لە {3} کاتی دانەوەیەتی",
  },
  "A supplier": { ar: "مورّد", ckb: "دابینکەرێک" },
  "Bills paid late cost goodwill, and sometimes a late fee.": {
    ar: "الفواتير المدفوعة متأخرة تكلّف حسن العلاقة، وأحيانًا غرامة تأخير.",
    ckb: "پسووڵەی دواکەوتوو پەیوەندی باش لەدەست دەدات، و هەندێک جار سزای دواکەوتنیشی هەیە.",
  },
  "Pay it, or agree a date with the supplier, on Vendors.": {
    ar: "ادفعها، أو اتفق على موعد مع المورّد، في المورّدين.",
    ckb: "لە دابینکەران پارەکەی بدە، یان لەگەڵ دابینکەر لەسەر بەروارێک ڕێک بکەوە.",
  },

  // A price that looks typed wrongly.
  "{1} is {2} IQD on {3} but {4} on {5}": {
    ar: "سعر {1} هو {2} IQD على {3} لكنه {4} على {5}",
    ckb: "نرخی {1} {2} IQD یە لە {3} بەڵام {4} یە لە {5}",
  },
  "A price more than three times another channel's is usually a missing or extra zero.": {
    ar: "السعر الذي يزيد على ثلاثة أضعاف سعر قناة أخرى يكون عادةً صفرًا ناقصًا أو زائدًا.",
    ckb: "نرخێک کە زیاتر لە سێ ئەوەندەی نرخی کەناڵێکی تر بێت، زۆرجار سفرێکی کەم یان زیادە.",
  },
  "Confirm it on Products.": {
    ar: "تحقّق منه في المنتجات والوصفات.",
    ckb: "لە بەرهەم و ڕەسەتەکان پشتڕاستی بکەرەوە.",
  },

  // A payment that may have been recorded twice.
  "Possible duplicate: {1} {2} IQD in journal {3} ({4}) and journal {5} ({6})": {
    ar: "تكرار محتمل: {1} {2} IQD في القيد {3} ({4}) والقيد {5} ({6})",
    ckb: "دووبارەی گومانلێکراو: {1} {2} IQD لە تۆماری {3} ({4}) و تۆماری {5} ({6})",
  },
  "The same amount to the same account twice in a few days is sometimes paid twice.": {
    ar: "المبلغ نفسه للحساب نفسه مرتين خلال أيام قليلة قد يكون دُفع مرتين.",
    ckb: "هەمان بڕ بۆ هەمان هەژمار دوو جار لە چەند ڕۆژێکدا، هەندێک جار دوو جار دراوە.",
  },
  "Confirm both are right, or reverse one on Journals.": {
    ar: "تأكّد من صحة الاثنين، أو اعكس أحدهما في القيود.",
    ckb: "دڵنیابە هەردووکیان ڕاستن، یان یەکێکیان لە تۆمارەکان هەڵبگەڕێنەوە.",
  },

  // Between messages the database joins into a list.
  "; ": { ar: "؛ ", ckb: "؛ " },

  // The shop's own ways of selling, as the database names them in a message.
  "Dine-in": { ar: "تناول في المكان", ckb: "لە شوێن" },
  Takeaway: { ar: "سفري", ckb: "بردن" },
  "Direct delivery": { ar: "توصيل مباشر", ckb: "گەیاندنی ڕاستەوخۆ" },
  "Direct Delivery": { ar: "توصيل مباشر", ckb: "گەیاندنی ڕاستەوخۆ" },

  // The daily brief (src/lib/alerts.ts).
  "No sales.": { ar: "لا مبيعات.", ckb: "هیچ فرۆشتنێک نەبوو." },
  "Waste {amount}.": { ar: "الهدر {amount}.", ckb: "بەفیڕۆچوون {amount}." },
  "The drawer was counted, and was right.": {
    ar: "عُدّ درج النقد وكان مضبوطًا.",
    ckb: "دەخیلەکە ژمێردرا و ڕاست بوو.",
  },
  "The drawer was counted {amount} short.": {
    ar: "عُدّ درج النقد وكان ناقصًا {amount}.",
    ckb: "دەخیلەکە ژمێردرا و {amount} کەم بوو.",
  },
  "The drawer was counted {amount} over.": {
    ar: "عُدّ درج النقد وكان زائدًا {amount}.",
    ckb: "دەخیلەکە ژمێردرا و {amount} زیاد بوو.",
  },
  "Net sales {amount} over 1 sale.": {
    ar: "صافي المبيعات {amount} من عملية بيع واحدة.",
    ckb: "فرۆشی پوخت {amount} لە یەک فرۆشتندا.",
  },
  "Net sales {amount} over {n} sales.": {
    ar: "صافي المبيعات {amount} من {n} عمليات بيع.",
    ckb: "فرۆشی پوخت {amount} لە {n} فرۆشتندا.",
  },
  "1 void ({amount}).": { ar: "إلغاء واحد ({amount}).", ckb: "یەک هەڵوەشاندنەوە ({amount})." },
  "{n} voids ({amount}).": { ar: "{n} إلغاءات ({amount}).", ckb: "{n} هەڵوەشاندنەوە ({amount})." },
  "1 refund ({amount}).": {
    ar: "استرداد واحد ({amount}).",
    ckb: "یەک گەڕاندنەوەی پارە ({amount}).",
  },
  "{n} refunds ({amount}).": {
    ar: "{n} استردادات ({amount}).",
    ckb: "{n} گەڕاندنەوەی پارە ({amount}).",
  },
  "1 discount ({amount}).": { ar: "خصم واحد ({amount}).", ckb: "یەک داشکاندن ({amount})." },
  "{n} discounts ({amount}).": { ar: "{n} خصومات ({amount}).", ckb: "{n} داشکاندن ({amount})." },
  "The drawer was not counted.": { ar: "لم يُعَدّ درج النقد.", ckb: "دەخیلەکە نەژمێردرا." },
  "1 sale with something costed at nothing (Reports → Uncosted sales).": {
    ar: "بيع واحد فيه شيء محسوبة كلفته صفرًا (التقارير ← مبيعات بلا كلفة).",
    ckb: "یەک فرۆشتن کە شتێکی تێدایە تێچووەکەی سفرە (ڕاپۆرتەکان ← فرۆشتنی بێ تێچوو).",
  },
  "{n} sales with something costed at nothing (Reports → Uncosted sales).": {
    ar: "{n} عمليات بيع فيها شيء محسوبة كلفته صفرًا (التقارير ← مبيعات بلا كلفة).",
    ckb: "{n} فرۆشتن کە شتێکیان تێدایە تێچووەکەی سفرە (ڕاپۆرتەکان ← فرۆشتنی بێ تێچوو).",
  },
  "Cost of goods {amount}.": { ar: "كلفة البضاعة {amount}.", ckb: "تێچووی کاڵا {amount}." },
  "Cost of goods {amount}, {pct} of sales.": {
    ar: "كلفة البضاعة {amount}، أي {pct} من المبيعات.",
    ckb: "تێچووی کاڵا {amount}، {pct}ی فرۆشتن.",
  },
  "Gross profit {amount}, after waste and every other cost of sales.": {
    ar: "إجمالي الربح {amount}، بعد الهدر وكل تكاليف المبيعات الأخرى.",
    ckb: "قازانجی گشتی {amount}، دوای بەفیڕۆچوون و هەموو تێچووەکانی تری فرۆشتن.",
  },
  "Gross profit {amount} ({pct}), after waste and every other cost of sales.": {
    ar: "إجمالي الربح {amount} ({pct})، بعد الهدر وكل تكاليف المبيعات الأخرى.",
    ckb: "قازانجی گشتی {amount} ({pct})، دوای بەفیڕۆچوون و هەموو تێچووەکانی تری فرۆشتن.",
  },
  "Last {weekday}: {amount}.": {
    ar: "{weekday} الماضي: {amount}.",
    ckb: "{weekday}ی ڕابردوو: {amount}.",
  },
  "Last {weekday}: {amount} ({change} since).": {
    ar: "{weekday} الماضي: {amount} ({change} منذ ذلك الحين).",
    ckb: "{weekday}ی ڕابردوو: {amount} ({change} لەو کاتەوە).",
  },
  "A usual {weekday} (the four before): {amount}.": {
    ar: "{weekday} معتاد (الأربعة السابقة): {amount}.",
    ckb: "{weekday}یەکی ئاسایی (چوار هەفتەی پێشوو): {amount}.",
  },
  "Nothing to calculate: there were no sales.": {
    ar: "لا شيء لحسابه: لم تكن هناك مبيعات.",
    ckb: "هیچ شتێک نییە بۆ هەژمارکردن: هیچ فرۆشتنێک نەبوو.",
  },
  "Nothing urgent. 1 orange alert waits for a quiet moment.": {
    ar: "لا شيء عاجل. تنبيه برتقالي واحد ينتظر وقت فراغ.",
    ckb: "هیچ شتێکی بەپەلە نییە. یەک ئاگادارکردنەوەی پرتەقاڵی چاوەڕێی کاتێکی هێمنە.",
  },
  "Nothing urgent. {n} orange alerts wait for a quiet moment.": {
    ar: "لا شيء عاجل. {n} تنبيهات برتقالية تنتظر وقت فراغ.",
    ckb: "هیچ شتێکی بەپەلە نییە. {n} ئاگادارکردنەوەی پرتەقاڵی چاوەڕێی کاتێکی هێمنن.",
  },
  "Nothing to do.": { ar: "لا شيء لفعله.", ckb: "هیچ کارێک نییە." },
  // Cash sessions (0036): left open, short, closed by a manager; and the drawer not counted, as it now reads.
  "Cash session left open": {
    ar: "وردية نقد بقيت مفتوحة",
    ckb: "شیفتێکی پارە بە کراوەیی ماوەتەوە",
  },
  "Cash session short": {
    ar: "عجز في وردية نقد",
    ckb: "کەمی لە شیفتێکی پارەدا",
  },
  "Cash session closed by a manager": {
    ar: "وردية نقد أغلقها مدير",
    ckb: "شیفتێکی پارە کە بەڕێوەبەرێک دایخست",
  },
  "Hours a cash session may stay open": {
    ar: "الساعات التي يجوز أن تبقى فيها وردية النقد مفتوحة",
    ckb: "ئەو کاتژمێرانەی شیفتێکی پارە دەتوانێت کراوە بمێنێتەوە",
  },
  "A cash session short by at least (IQD)": {
    ar: "عجز وردية النقد بما لا يقلّ عن (IQD)",
    ckb: "کەمی شیفتی پارە بە لانیکەم (IQD)",
  },
  "Session {1} at {2} has been open since {3}": {
    ar: "الوردية {1} في {2} مفتوحة منذ {3}",
    ckb: "شیفتی {1} لە {2} لە {3}ەوە کراوەیە",
  },
  "The cash in an open session has not been counted: the longer it stays open, the more passes through it unchecked.":
    {
      ar: "النقد في وردية مفتوحة لم يُعدّ بعد: كلما طال بقاؤها مفتوحة، مرّ فيها مزيد من النقد دون تحقّق.",
      ckb: "پارەی ناو شیفتێکی کراوە نەژمێردراوە: تا زیاتر کراوە بمێنێتەوە، پارەی زیاتر بێ پشکنین پێیدا تێدەپەڕێت.",
    },
  "Close it on the till, counting the cash; a manager can close it on Cash sessions.": {
    ar: "أغلقها في نقطة البيع بعدّ النقد؛ ويمكن للمدير إغلاقها من ورديات النقد.",
    ckb: "لە خاڵی فرۆشتن بە ژماردنی پارەکە دایبخە؛ بەڕێوەبەر دەتوانێت لە شیفتەکانی پارە دایبخات.",
  },
  "Session {1} at {2} opened {3} IQD short of what the last session left": {
    ar: "الوردية {1} في {2} افتُتحت بعجز {3} IQD عمّا تركته الوردية السابقة",
    ckb: "شیفتی {1} لە {2} بە {3} IQD کەمتر لەوەی شیفتی پێشوو جێی هێشت کرایەوە",
  },
  "Session {1} at {2} closed {3} IQD short": {
    ar: "الوردية {1} في {2} أُغلقت بعجز {3} IQD",
    ckb: "شیفتی {1} لە {2} بە {3} IQD کەمی داخرا",
  },
  "Cash that should be in the drawer is not: change miscounted, a sale not rung up, or money taken.":
    {
      ar: "نقد يجب أن يكون في الدرج ليس فيه: فكّة عُدّت خطأ، أو بيع لم يُسجَّل، أو مال أُخذ.",
      ckb: "پارەیەک کە دەبێت لە دەخیلەکەدا بێت تێیدا نییە: وردە پارە بە هەڵە ژمێردراوە، فرۆشتنێک تۆمار نەکراوە، یان پارە بردراوە.",
    },
  "Look at the session's statement on Cash sessions, and ask whoever had the drawer.": {
    ar: "راجع كشف الوردية في ورديات النقد، واسأل من كان مسؤولًا عن الدرج.",
    ckb: "سەیری کەشفی شیفتەکە بکە لە شیفتەکانی پارە، و پرسیار لەو کەسە بکە کە دەخیلەکەی لا بوو.",
  },
  "Session {1} at {2} was closed by {3}: {4}": {
    ar: "الوردية {1} في {2} أغلقها {3}: {4}",
    ckb: "شیفتی {1} لە {2} لەلایەن {3}ەوە داخرا: {4}",
  },
  "It was closed without a count: what it held is counted when the drawer next opens.": {
    ar: "أُغلقت دون عدّ: ما كان فيها يُعدّ عند فتح الدرج التالي.",
    ckb: "بێ ژماردن داخرا: ئەوەی تێیدا بوو کاتی کردنەوەی داهاتووی دەخیلەکە دەژمێردرێت.",
  },
  "Its cashier did not close it: the count was not theirs.": {
    ar: "لم يغلقها أمين الصندوق: العدّ لم يكن عدّه.",
    ckb: "کاشێرەکەی دایینەخست: ژماردنەکە هی ئەو نەبوو.",
  },
  "Check it with the cashier on Cash sessions.": {
    ar: "راجعها مع أمين الصندوق في ورديات النقد.",
    ckb: "لە شیفتەکانی پارەدا لەگەڵ کاشێرەکە بیپشکنە.",
  },
  "Close its session on the till, counting the cash; a manager can close one left open on Cash sessions.":
    {
      ar: "أغلق ورديته في نقطة البيع بعدّ النقد؛ ويمكن للمدير إغلاق وردية بقيت مفتوحة من ورديات النقد.",
      ckb: "شیفتەکەی لە خاڵی فرۆشتن بە ژماردنی پارەکە دابخە؛ بەڕێوەبەر دەتوانێت شیفتێکی کراوەماو لە شیفتەکانی پارە دابخات.",
    },

  // Usage unlike the recipes (0039).
  "Usage unlike the recipes": {
    ar: "استهلاك يخالف الوصفات",
    ckb: "بەکارهێنانی جیاواز لە ڕەچەتەکان",
  },
  "Usage unlike the recipes by at least (%)": {
    ar: "استهلاك يخالف الوصفات بما لا يقلّ عن (%)",
    ckb: "بەکارهێنانی جیاواز لە ڕەچەتەکان بە لانیکەم (%)",
  },
  "Usage unlike the recipes by at least (IQD)": {
    ar: "استهلاك يخالف الوصفات بما لا يقلّ عن (IQD)",
    ckb: "بەکارهێنانی جیاواز لە ڕەچەتەکان بە لانیکەم (IQD)",
  },
  "{1}: {2} {3} more used than the recipes say between the counts of {4} and {5} ({6}%, {7} IQD)": {
    ar: "{1}: استُهلك {2} {3} أكثر مما تقوله الوصفات بين جردَي {4} و{5} ({6}%، {7} IQD)",
    ckb: "{1}: {2} {3} زیاتر لەوەی ڕەچەتەکان دەڵێن بەکارهات لە نێوان ژماردنەکانی {4} و {5} ({6}%، {7} IQD)",
  },
  "{1}: {2} {3} less used than the recipes say between the counts of {4} and {5} ({6}%, {7} IQD)": {
    ar: "{1}: استُهلك {2} {3} أقل مما تقوله الوصفات بين جردَي {4} و{5} ({6}%، {7} IQD)",
    ckb: "{1}: {2} {3} کەمتر لەوەی ڕەچەتەکان دەڵێن بەکارهات لە نێوان ژماردنەکانی {4} و {5} ({6}%، {7} IQD)",
  },
  "What the counts say went, less the losses recorded, is more than the recipes of what was sold and made.":
    {
      ar: "ما يقول الجردان إنه خرج، مطروحًا منه الهدر المسجّل، أكثر مما تقوله وصفات ما بيع وصُنع.",
      ckb: "ئەوەی ژماردنەکان دەڵێن ڕۆیشتووە، بە لابردنی بەفیڕۆچوونی تۆمارکراو، زیاترە لە ڕەچەتەکانی ئەوەی فرۆشرا و دروستکرا.",
    },
  "What the counts say went, less the losses recorded, is less than the recipes of what was sold and made.":
    {
      ar: "ما يقول الجردان إنه خرج، مطروحًا منه الهدر المسجّل، أقل مما تقوله وصفات ما بيع وصُنع.",
      ckb: "ئەوەی ژماردنەکان دەڵێن ڕۆیشتووە، بە لابردنی بەفیڕۆچوونی تۆمارکراو، کەمترە لە ڕەچەتەکانی ئەوەی فرۆشرا و دروستکرا.",
    },
  "Open Usage on Inventory: it shows what came in, what was sold, made and lost between the counts, and what may explain it.":
    {
      ar: "افتح «الاستهلاك» من المخزون: يبيّن ما دخل، وما بيع وصُنع وهُدر بين الجردين، وما قد يفسّر الفرق.",
      ckb: "«بەکارهێنان» لە کۆگا بکەرەوە: ئەوە پیشان دەدات کە چی هاتە ژوورەوە، چی فرۆشرا، دروستکرا و بەفیڕۆچوو لە نێوان ژماردنەکاندا، و چی لەوانەیە ڕوونی بکاتەوە.",
    },

  // Stock below zero, and losses waiting for a manager (0040).
  "Stock below zero": { ar: "مخزون دون الصفر", ckb: "کۆگای خوار سفر" },
  "Losses waiting for approval": { ar: "خسائر تنتظر الموافقة", ckb: "زیانەکان چاوەڕێی ڕەزامەندین" },
  "{1} is below zero in the books: {2} {3}": {
    ar: "{1} دون الصفر في الدفاتر: {2} {3}",
    ckb: "{1} لە دەفتەرەکاندا لە خوار سفرەوەیە: {2} {3}",
  },
  "Stock cannot be less than nothing: a delivery or a batch was not entered, or more was used than was recorded.":
    {
      ar: "لا يمكن أن يكون المخزون أقل من لا شيء: لم يُدخل توريد أو دفعة، أو استُهلك أكثر مما سُجّل.",
      ckb: "کۆگا ناتوانێت لە هیچ کەمتر بێت: بارێک یان دەفعەیەک تۆمار نەکراوە، یان زیاتر لەوەی تۆمارکرا بەکارهاتووە.",
    },
  "Enter the delivery or the batch that is missing, or count the item on Stock Count.": {
    ar: "أدخل التوريد أو الدفعة الناقصة، أو اجرد المادة من «جرد المخزون».",
    ckb: "ئەو بار یان دەفعەیەی کەمە تۆمار بکە، یان کاڵاکە لە «ژماردنی کۆگا» بژمێرە.",
  },
  "{1} loss(es) waiting for a manager's approval ({2} IQD)": {
    ar: "{1} خسارة (خسائر) تنتظر موافقة مدير ({2} IQD)",
    ckb: "{1} زیان چاوەڕێی ڕەزامەندی بەڕێوەبەرێکن ({2} IQD)",
  },
  "A loss over the limit was saved to wait for a manager: until one approves it, or reverses it, nobody has looked at it.":
    {
      ar: "حُفظت خسارة تتجاوز الحد لتنتظر مديرًا: وإلى أن يوافق عليها أحدهم أو يعكسها، لم ينظر فيها أحد.",
      ckb: "زیانێک لە سەرووی سنوورەوە پاشەکەوت کرا بۆ ئەوەی چاوەڕێی بەڕێوەبەرێک بکات: تا یەکێکیان ڕەزامەندی لەسەر نەدات یان هەڵینەگەڕێنێتەوە، کەس سەیری نەکردووە.",
    },
  "Open Inventory: approve each loss, or reverse one that did not happen.": {
    ar: "افتح «المخزون»: وافق على كل خسارة، أو اعكس ما لم يحدث منها.",
    ckb: "«کۆگا» بکەرەوە: ڕەزامەندی لەسەر هەر زیانێک بدە، یان ئەوەی ڕووی نەداوە هەڵیبگەڕێنەوە.",
  },
  // Batches past or near their use-by (0046).
  "Use-by date": { ar: "موعد الاستعمال", ckb: "کاتی بەکارهێنان" },
  "{1}, batch {2}, is past its use-by: {3} {4} left": {
    ar: "{1}، الدفعة {2}، تجاوزت موعد استعمالها: بقي {3} {4}",
    ckb: "{1}، دەستەی {2}، کاتی بەکارهێنانی بەسەرچووە: {3} {4} ماوە",
  },
  "{1}, batch {2}, is to be used by {3}: {4} {5} left": {
    ar: "{1}، الدفعة {2}، تُستعمل قبل {3}: بقي {4} {5}",
    ckb: "{1}، دەستەی {2}، دەبێت پێش {3} بەکاربهێنرێت: {4} {5} ماوە",
  },
  "Past its use-by it is not to be sold: what is left is a loss.": {
    ar: "بعد تجاوز موعد الاستعمال لا يُباع: ما بقي منه هدر.",
    ckb: "دوای بەسەرچوونی کاتی بەکارهێنان نافرۆشرێت: ئەوەی ماوە بەفیڕۆچووە.",
  },
  "What is not used by then is lost.": {
    ar: "ما لا يُستعمل قبل ذلك يُهدر.",
    ckb: "ئەوەی تا ئەو کاتە بەکارنەهێنرێت بەفیڕۆ دەچێت.",
  },
  "Record what is left as expired on Inventory, or change its use-by if it was set wrong.": {
    ar: "سجّل ما بقي كمنتهي الصلاحية في «المخزون»، أو غيّر موعد استعماله إن حُدّد خطأً.",
    ckb: "ئەوەی ماوە وەک بەسەرچوو لە «کۆگا» تۆمار بکە، یان کاتی بەکارهێنانەکەی بگۆڕە ئەگەر بە هەڵە دانرابوو.",
  },
  "Put it out before newer batches: sales take it first.": {
    ar: "اعرضها قبل الدفعات الأحدث: البيع يأخذ منها أولًا.",
    ckb: "پێش دەستە نوێیەکان دایبنێ: فرۆشتن سەرەتا لەوە دەبات.",
  },
};

export default phrases;
