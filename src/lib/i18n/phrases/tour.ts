import type { PhraseBook } from "./types";

/**
 * Show me around (round six): the tours of the till, Production and the
 * dashboard, their offer and their buttons.
 */
const phrases: PhraseBook = {
  "Show me around": { ar: "عرّفني بالشاشة", ckb: "بە شاشەکەم بناسێنە" },
  "Show me around this screen": { ar: "جولة في هذه الشاشة", ckb: "گەشتێک بە ناو ئەم شاشەیەدا" },
  "New here? Let us show you around this screen.": {
    ar: "جديد هنا؟ دعنا نعرّفك بهذه الشاشة.",
    ckb: "نوێیت لێرە؟ با ئەم شاشەیەت پێ بناسێنین.",
  },
  "No thanks": { ar: "لا، شكرًا", ckb: "نا، سوپاس" },
  "Step {n} of {total}": { ar: "الخطوة {n} من {total}", ckb: "هەنگاوی {n} لە {total}" },
  Finish: { ar: "إنهاء", ckb: "تەواوکردن" },
  "End the tour": { ar: "إنهاء الجولة", ckb: "کۆتایی بە گەشتەکە بهێنە" },

  // The till.
  "Find it fast": { ar: "اعثر عليه بسرعة", ckb: "خێرا بیدۆزەرەوە" },
  "Type a name to find a product: Enter adds the one lit, and a number typed first adds that many. ? lists every key.":
    {
      ar: "اكتب اسمًا لتجد المنتج: Enter يضيف المضاء منها، ورقم يُكتب أولًا يضيف ذلك العدد. ? يعرض كل المفاتيح.",
      ckb: "ناوێک بنووسە بۆ دۆزینەوەی بەرهەمێک: Enter ئەوەی ڕووناکە زیاد دەکات، و ژمارەیەک کە یەکەم بنووسرێت ئەو ژمارەیە زیاد دەکات. ? هەموو کلیلەکان پیشان دەدات.",
    },
  "Tap to add": { ar: "المس لتضيف", ckb: "دەست لێبدە بۆ زیادکردن" },
  "Tap a product to add it to the order. One with sizes or add-ons asks which, then adds it. On Tables, tap a table to open its bill.":
    {
      ar: "المس منتجًا لتضيفه إلى الطلب. ما له أحجام أو إضافات يسأل عنها ثم يضيفه. وفي الطاولات، المس طاولة لتفتح فاتورتها.",
      ckb: "دەست لە بەرهەمێک بدە بۆ زیادکردنی بۆ داواکارییەکە. ئەوەی قەبارە یان زیادکراوی هەیە دەپرسێت کامە، پاشان زیادی دەکات. لە مێزەکاندا، دەست لە مێزێک بدە بۆ کردنەوەی پسوولەکەی.",
    },
  "The orders in hand": { ar: "الطلبات الجارية", ckb: "داواکارییە بەردەستەکان" },
  "A quick sale, and every bill still open: tap one to carry on with it.": {
    ar: "بيع سريع، وكل فاتورة ما زالت مفتوحة: المس واحدة لتكمل عليها.",
    ckb: "فرۆشتنێکی خێرا، و هەموو پسوولەیەکی هێشتا کراوە: دەست لە یەکێکیان بدە بۆ بەردەوامبوون لەسەری.",
  },
  "Where it goes": { ar: "إلى أين يذهب", ckb: "بۆ کوێ دەچێت" },
  "To eat in, to take away, or through a delivery platform: the prices follow the choice.": {
    ar: "للأكل في المحل، أو سفري، أو عبر منصة توصيل: الأسعار تتبع الاختيار.",
    ckb: "بۆ خواردن لێرە، بۆ بردن، یان لە ڕێگەی پلاتفۆرمی گەیاندنەوە: نرخەکان شوێن هەڵبژاردنەکە دەکەون.",
  },
  "Take the money": { ar: "استلم المبلغ", ckb: "پارەکە وەربگرە" },
  "Change a quantity, add a note, or give a discount with its reason; then cash or card. The receipt prints itself if the till is set to.":
    {
      ar: "غيّر كمية، أو أضف ملاحظة، أو امنح خصمًا مع سببه؛ ثم نقدًا أو بالبطاقة. يُطبع الإيصال وحده إن ضُبطت نقطة البيع لذلك.",
      ckb: "بڕێک بگۆڕە، تێبینییەک زیاد بکە، یان داشکاندنێک بە هۆکارەکەیەوە بدە؛ پاشان نەختینە یان کارت. پسوولەکە خۆی چاپ دەبێت ئەگەر خاڵی فرۆشتن بۆی ڕێکخرابێت.",
    },
  "Open it with the money it starts with, and count it when it closes: the till says what it should hold.":
    {
      ar: "افتحه بالمبلغ الذي يبدأ به، وعُدّه عند إغلاقه: تقول نقطة البيع ما يجب أن يحويه.",
      ckb: "بە ئەو پارەیەی پێی دەست پێدەکات بیکەرەوە، و کاتێک دادەخرێت بیژمێرە: خاڵی فرۆشتن دەڵێت دەبێت چەندی تێدا بێت.",
    },
  "Clock in and out": { ar: "سجّل الحضور والانصراف", ckb: "هاتن و ڕۆیشتن تۆمار بکە" },
  "Each person clocks in and out here, with their name and PIN.": {
    ar: "يسجّل كل شخص حضوره وانصرافه هنا، باسمه ورقمه السري.",
    ckb: "هەر کەسێک لێرە هاتن و ڕۆیشتنی تۆمار دەکات، بە ناو و ژمارە نهێنییەکەی.",
  },

  // Production.
  "What to make today": { ar: "ما يُصنع اليوم", ckb: "ئەمڕۆ چی دروست بکرێت" },
  "The day's plan: what sells on this weekday, what is in stock, and so how many batches of each to make.":
    {
      ar: "خطة اليوم: ما يُباع في هذا اليوم من الأسبوع، وما في المخزون، ومنهما كم دفعة تُصنع من كلٍّ.",
      ckb: "پلانی ڕۆژ: ئەوەی لەم ڕۆژەی هەفتەدا دەفرۆشرێت، ئەوەی لە کۆگادایە، و بەمە چەند دەستە لە هەریەکە دروست بکرێت.",
    },
  "The plan in one go": { ar: "الخطة دفعة واحدة", ckb: "پلانەکە بە یەکجار" },
  "Record every batch the plan says in one press, changing what came out where it differs; then print every label.":
    {
      ar: "سجّل كل دفعة تقولها الخطة بضغطة واحدة، مغيّرًا ما خرج حيث يختلف؛ ثم اطبع كل الملصقات.",
      ckb: "هەموو ئەو دەستانەی پلانەکە دەیڵێت بە یەک پەنجەلێدان تۆمار بکە، و ئەوەی دەرچوو لەو شوێنانەی جیاوازە بگۆڕە؛ پاشان هەموو لەیبڵەکان چاپ بکە.",
    },
  "Choose what you made and how many batches: its ingredients come out of stock, and what came out goes in, with its use-by.":
    {
      ar: "اختر ما صنعته وعدد الدفعات: تخرج مكوناته من المخزون، ويدخل ما خرج منه، مع موعد استعماله.",
      ckb: "ئەوەی دروستت کرد و چەند دەستە هەڵبژێرە: پێکهاتەکانی لە کۆگا دەردەچن، و ئەوەی دەرچوو دەچێتە ناوەوە، لەگەڵ کاتی بەکارهێنانی.",
    },
  "What is in stock": { ar: "ما في المخزون", ckb: "ئەوەی لە کۆگادایە" },
  "Each batch still in stock, the one to use first at the top, with its use-by.": {
    ar: "كل دفعة ما زالت في المخزون، والتي تُستعمل أولًا في الأعلى، مع موعد استعمالها.",
    ckb: "هەر دەستەیەک کە هێشتا لە کۆگادایە، ئەوەی یەکەم بەکار دێت لە سەرەوە، لەگەڵ کاتی بەکارهێنانی.",
  },
  "Its recipes": { ar: "وصفاته", ckb: "ڕەسەتەکانی" },
  "What you make and what goes into it: change a recipe when the way it is made changes.": {
    ar: "ما تصنعه وما يدخل فيه: غيّر الوصفة حين تتغير طريقة صنعه.",
    ckb: "ئەوەی دروستی دەکەیت و ئەوەی دەچێتە ناوی: ڕەسەتەیەک بگۆڕە کاتێک شێوازی دروستکردنەکەی دەگۆڕێت.",
  },

  // The dashboard.
  "Today at a glance": { ar: "اليوم في لمحة", ckb: "ئەمڕۆ بە یەک سەیرکردن" },
  "Today's figures, each against a usual day: open one to see what is behind it.": {
    ar: "أرقام اليوم، كلٌّ مقابل يوم معتاد: افتح أحدها لترى ما وراءه.",
    ckb: "ژمارەکانی ئەمڕۆ، هەریەکە بەرامبەر ڕۆژێکی ئاسایی: یەکێکیان بکەرەوە بۆ بینینی ئەوەی لە پشتییەتی.",
  },
  "What needs you": { ar: "ما يحتاجك", ckb: "ئەوەی پێویستی پێتە" },
  "What waits for an answer: the red ones first.": {
    ar: "ما ينتظر جوابًا: الحمراء أولًا.",
    ckb: "ئەوەی چاوەڕێی وەڵامە: سوورەکان یەکەم.",
  },
  "The day in words, each with where to act on it.": {
    ar: "اليوم بالكلمات، وكلٌّ مع مكان التصرف فيه.",
    ckb: "ڕۆژەکە بە وشە، هەریەکە لەگەڵ ئەو شوێنەی کاری لەسەر دەکرێت.",
  },
  "The days behind it": { ar: "الأيام التي وراءه", ckb: "ئەو ڕۆژانەی لە پشتییەوەن" },
  "The last two weeks of sales, and what sells.": {
    ar: "مبيعات الأسبوعين الأخيرين، وما يُباع.",
    ckb: "فرۆشتنی دوو هەفتەی کۆتایی، و ئەوەی دەفرۆشرێت.",
  },
  "Everything else": { ar: "كل ما عدا ذلك", ckb: "هەموو شتەکانی تر" },
  "Every other screen is in the menu: the till, the stock, the reports.": {
    ar: "كل شاشة أخرى في القائمة: نقطة البيع، والمخزون، والتقارير.",
    ckb: "هەموو شاشەکانی تر لە لیستەکەدان: خاڵی فرۆشتن، کۆگا، ڕاپۆرتەکان.",
  },
};

export default phrases;
