import type { PhraseBook } from "./types";

/**
 * Customers and loyalty (0050, release X): the Customers screens, the
 * customer on the till, rewards at payment, Reports → Customers, the loyalty
 * rules on Settings, and what the database refuses with.
 */
const phrases: PhraseBook = {
  // Customers
  "Who buys from the café, found at the till by their phone number. Each earns points on what they pay, and takes a reward off a bill once they have enough (the rules are on Settings).":
    {
      ar: "مَن يشتري من المقهى، ويُعثر عليه على نقطة البيع برقم هاتفه. يكسب كلٌّ منهم نقاطًا على ما يدفعه، ويستبدل مكافأة من الفاتورة متى كفت نقاطه (القواعد في «الإعدادات»).",
      ckb: "ئەوانەی لە کافێکە دەکڕن، لەسەر خاڵی فرۆشتن بە ژمارەی تەلەفۆنەکەیان دەدۆزرێنەوە. هەر یەکەیان لەسەر ئەوەی دەیدات خاڵ وەردەگرێت، و کاتێک بەشی کرد خەڵاتێک لە پسووڵە دادەشکێنێت (یاساکان لە «ڕێکخستنەکان»ن).",
    },
  "+ Add a customer": { ar: "+ أضف زبونًا", ckb: "+ کڕیارێک زیاد بکە" },
  "A new customer": { ar: "زبون جديد", ckb: "کڕیارێکی نوێ" },
  "Search by name or number": { ar: "ابحث بالاسم أو الرقم", ckb: "بە ناو یان ژمارە بگەڕێ" },
  "No customers yet. They are added at the till, by their phone number, or here; each earns points on what they buy.":
    {
      ar: "لا زبائن بعد. يُضافون على نقطة البيع برقم هاتفهم، أو من هنا؛ ويكسب كلٌّ منهم نقاطًا على مشترياته.",
      ckb: "هێشتا کڕیار نییە. لەسەر خاڵی فرۆشتن بە ژمارەی تەلەفۆنەکەیان زیاد دەکرێن، یان لێرە؛ هەر یەکەیان لەسەر ئەوەی دەیکڕێت خاڵ وەردەگرێت.",
    },
  "Nobody matches that search.": {
    ar: "لا أحد يطابق هذا البحث.",
    ckb: "کەس لەگەڵ ئەو گەڕانە ناگونجێت.",
  },
  Points: { ar: "النقاط", ckb: "خاڵەکان" },
  points: { ar: "نقاط", ckb: "خاڵ" },
  "{n} points": { ar: "{n} نقطة", ckb: "{n} خاڵ" },
  Bought: { ar: "المشتريات", ckb: "کڕینەکان" },
  "Last bought": { ar: "آخر شراء", ckb: "دوایین کڕین" },
  "Put away": { ar: "مؤرشف", ckb: "ئەرشیفکراو" },
  "Put them away": { ar: "أرشفة الزبون", ckb: "ئەرشیفکردنی کڕیار" },
  "Put it away": { ar: "أرشفة العنوان", ckb: "ئەرشیفکردنی ناونیشان" },
  "Add the customer": { ar: "أضف الزبون", ckb: "کڕیارەکە زیاد بکە" },
  "Notes about them": { ar: "ملاحظات عنه", ckb: "تێبینی دەربارەی" },
  "What they like, what to leave out": {
    ar: "ما يحبه، وما يجب تجنبه",
    ckb: "ئەوەی حەزی لێیە، ئەوەی دەبێت نەیخرێتە ناوی",
  },
  "← All customers": { ar: "→ كل الزبائن", ckb: "→ هەموو کڕیاران" },
  "Added {at} by {name}.": {
    ar: "أُضيف في {at} بواسطة {name}.",
    ckb: "لە {at} لەلایەن {name} زیاد کرا.",
  },
  "Change their details": { ar: "تغيير بياناته", ckb: "زانیارییەکانی بگۆڕە" },
  Addresses: { ar: "العناوين", ckb: "ناونیشانەکان" },
  Address: { ar: "العنوان", ckb: "ناونیشان" },
  "Where the café's own driver takes their orders. An address put away stays on the orders delivered to it.":
    {
      ar: "حيث يوصل سائق المقهى طلباته. العنوان المؤرشف يبقى على الطلبات التي وُصّلت إليه.",
      ckb: "ئەو شوێنانەی شۆفێری کافێکە داواکارییەکانی بۆ دەبات. ناونیشانی ئەرشیفکراو لەسەر ئەو داواکارییانە دەمێنێتەوە کە بۆی گەیەندراون.",
    },
  "No address yet.": { ar: "لا عنوان بعد.", ckb: "هێشتا ناونیشان نییە." },
  "+ Add an address": { ar: "+ أضف عنوانًا", ckb: "+ ناونیشانێک زیاد بکە" },
  "Add the address": { ar: "أضف العنوان", ckb: "ناونیشانەکە زیاد بکە" },
  "Name for it": { ar: "اسم له", ckb: "ناوێک بۆی" },
  "Home, work": { ar: "المنزل، العمل", ckb: "ماڵ، کار" },
  "How to find it": { ar: "كيفية الوصول إليه", ckb: "چۆن بیدۆزیتەوە" },
  "Near the mosque, second floor": {
    ar: "قرب الجامع، الطابق الثاني",
    ckb: "نزیک مزگەوت، نهۆمی دووەم",
  },
  "Give or take points": { ar: "منح النقاط أو سحبها", ckb: "دان یان سەندنەوەی خاڵ" },
  "Give or take them": { ar: "امنحها أو اسحبها", ckb: "بیاندە یان بیانسەنەوە" },
  "For points a customer was owed, or given by mistake: a minus takes them. The reason is kept with them, on the audit trail.":
    {
      ar: "للنقاط المستحقة للزبون، أو الممنوحة خطأً: علامة الناقص تسحبها. يُحفظ السبب معها، في سجل التدقيق.",
      ckb: "بۆ ئەو خاڵانەی کڕیار شایەنیان بوو، یان بە هەڵە دران: نیشانەی کەم دەیانسەنێتەوە. هۆکارەکە لەگەڵیان دەپارێزرێت، لە تۆماری گۆڕانکارییەکاندا.",
    },
  "Done: they have {n} points.": { ar: "تم: لديه {n} نقطة.", ckb: "تەواو: {n} خاڵی هەیە." },
  "What they bought": { ar: "ما اشتراه", ckb: "ئەوەی کڕیویەتی" },
  "Nothing yet.": { ar: "لا شيء بعد.", ckb: "هێشتا هیچ نییە." },
  "Delivered to {address}": { ar: "وُصّل إلى {address}", ckb: "گەیەندرا بۆ {address}" },
  "How their points moved": { ar: "حركة نقاطه", ckb: "جووڵەی خاڵەکانی" },
  "No points yet.": { ar: "لا نقاط بعد.", ckb: "هێشتا خاڵ نییە." },
  "{amount} off": { ar: "خصم {amount}", ckb: "{amount} داشکاندن" },
  "Refund {no}": { ar: "استرداد {no}", ckb: "گەڕاندنەوەی پارە {no}" },
  "Earned on a sale": { ar: "مكتسبة من بيع", ckb: "لە فرۆشتنێک وەرگیراوە" },
  "A reward taken": { ar: "مكافأة مستبدلة", ckb: "خەڵاتێک بەکارهات" },
  "Taken back: sale voided or refunded": {
    ar: "سُحبت: أُلغي البيع أو استُرد",
    ckb: "سەندرایەوە: فرۆشتنەکە هەڵوەشێنرایەوە یان پارەکەی گەڕێندرایەوە",
  },
  "Given back: sale voided or refunded": {
    ar: "أُعيدت: أُلغي البيع أو استُرد",
    ckb: "گەڕێندرایەوە: فرۆشتنەکە هەڵوەشێنرایەوە یان پارەکەی گەڕێندرایەوە",
  },
  "Given or taken by hand": { ar: "مُنحت أو سُحبت يدويًا", ckb: "بە دەست دراوە یان سەندراوەتەوە" },

  // The till
  Customer: { ar: "الزبون", ckb: "کڕیار" },
  "Their phone number": { ar: "رقم هاتفه", ckb: "ژمارەی تەلەفۆنەکەی" },
  Find: { ar: "ابحث", ckb: "بدۆزەوە" },
  "Nobody has that number yet.": {
    ar: "لا أحد يملك هذا الرقم بعد.",
    ckb: "هێشتا کەس ئەو ژمارەیەی نییە.",
  },
  "Add them as a customer": { ar: "أضفه زبونًا", ckb: "وەک کڕیار زیادی بکە" },
  "{n} rewards to take": { ar: "{n} مكافأة متاحة", ckb: "{n} خەڵات بەردەستە" },
  "{name} is put away on Customers: bring them back there first.": {
    ar: "{name} مؤرشف في «الزبائن»: أعِده من هناك أولًا.",
    ckb: "{name} لە «کڕیاران» ئەرشیفکراوە: سەرەتا لەوێ بیگەڕێنەوە.",
  },
  "Deliver to": { ar: "التوصيل إلى", ckb: "گەیاندن بۆ" },
  "No address yet: add where it goes.": {
    ar: "لا عنوان بعد: أضف مكان التوصيل.",
    ckb: "هێشتا ناونیشان نییە: شوێنی گەیاندن زیاد بکە.",
  },
  "Put them on the order": { ar: "أضفه إلى الطلب", ckb: "بیخە سەر داواکارییەکە" },
  "Take {name} off the order": { ar: "أزل {name} من الطلب", ckb: "{name} لە داواکارییەکە لابە" },
  "{name} has {n} points.": { ar: "لدى {name} {n} نقطة.", ckb: "{name} {n} خاڵی هەیە." },
  "Not enough for a reward yet.": {
    ar: "لا تكفي لمكافأة بعد.",
    ckb: "هێشتا بەش ناکات بۆ خەڵاتێک.",
  },
  "A reward takes {amount} off, whole: the bill comes to less.": {
    ar: "المكافأة تخصم {amount} كاملة: الفاتورة أقل من ذلك.",
    ckb: "خەڵات {amount} بە تەواوی دادەشکێنێت: پسووڵەکە کەمترە.",
  },
  "rewards taken, {amount} off each": {
    ar: "مكافآت مستبدلة، بخصم {amount} لكل منها",
    ckb: "خەڵاتی بەکارهاتوو، هەر یەکەیان {amount} داشکاندن",
  },
  "{n} reward(s): {amount} off, {points} points": {
    ar: "{n, plural, one {مكافأة واحدة} two {مكافأتان} few {# مكافآت} other {# مكافأة}}: خصم {amount}، مقابل {points, plural, one {نقطة واحدة} two {نقطتين} few {# نقاط} other {# نقطة}}",
    ckb: "{n} خەڵات: {amount} داشکاندن، بە {points} خاڵ",
  },
  "Loyalty reward": { ar: "مكافأة الولاء", ckb: "خەڵاتی دڵسۆزی" },
  "Points earned: {n}": { ar: "النقاط المكتسبة: {n}", ckb: "خاڵی وەرگیراو: {n}" },
  "Points spent: {n}": { ar: "النقاط المستبدلة: {n}", ckb: "خاڵی بەکارهاتوو: {n}" },
  "{n} points now": { ar: "{n} نقطة الآن", ckb: "ئێستا {n} خاڵ" },
  "the customer": { ar: "الزبون", ckb: "کڕیارەکە" },
  "the address": { ar: "العنوان", ckb: "ناونیشانەکە" },

  // Reports → Customers
  "Customers and loyalty": { ar: "الزبائن والولاء", ckb: "کڕیاران و دڵسۆزی" },
  "Points earned and spent {from} to {to}, and who bought the most": {
    ar: "النقاط المكتسبة والمستبدلة من {from} إلى {to}، ومن اشترى أكثر",
    ckb: "خاڵی وەرگیراو و بەکارهاتوو لە {from} بۆ {to}، و کێ زۆرترینی کڕیوە",
  },
  "Rewards taken: {n}, {amount} off": {
    ar: "المكافآت المستبدلة: {n}، بخصم {amount}",
    ckb: "خەڵاتی بەکارهاتوو: {n}، {amount} داشکاندن",
  },
  "Taken back on voids and refunds: {n}; given back: {m}": {
    ar: "المسحوبة عند الإلغاء والاسترداد: {n}؛ والمعادة: {m}",
    ckb: "سەندراوە لە هەڵوەشاندنەوە و گەڕاندنەوەی پارە: {n}؛ گەڕێندراوە: {m}",
  },
  "By hand: {plus} given, {minus} taken": {
    ar: "يدويًا: {plus} مُنحت، {minus} سُحبت",
    ckb: "بە دەست: {plus} دراوە، {minus} سەندراوەتەوە",
  },
  "Customers hold {n} points now, worth {amount} in rewards": {
    ar: "يحمل الزبائن الآن {n} نقطة، تساوي {amount} مكافآت",
    ckb: "کڕیاران ئێستا {n} خاڵیان هەیە، بە بەهای {amount} خەڵات",
  },
  "{n} customers, {m} new in these dates": {
    ar: "{n} زبون، منهم {m} جدد في هذه التواريخ",
    ckb: "{n} کڕیار، {m} نوێ لەم بەروارانەدا",
  },
  "Their sales: {n}, {amount}": {
    ar: "مبيعاتهم: {n}، {amount}",
    ckb: "فرۆشتنەکانیان: {n}، {amount}",
  },
  "A reward is a discount on 4100, like any other: the points are no liability in the books, only what customers hold here.":
    {
      ar: "المكافأة خصم على 4100 مثل أي خصم آخر: النقاط ليست التزامًا في الدفاتر، بل ما يحمله الزبائن هنا فقط.",
      ckb: "خەڵات داشکاندنێکە لەسەر 4100 وەک هەر داشکاندنێکی تر: خاڵەکان قەرز نین لە دەفتەرەکاندا، تەنها ئەوەن کە کڕیاران لێرە هەیانە.",
    },

  // The loyalty rules on Settings
  "Customers earn points, and take rewards": {
    ar: "يكسب الزبائن النقاط ويستبدلون المكافآت",
    ckb: "کڕیاران خاڵ وەردەگرن و خەڵات بەکاردەهێنن",
  },
  "A customer earns a point for every": {
    ar: "يكسب الزبون نقطة عن كل",
    ckb: "کڕیار خاڵێک وەردەگرێت بۆ هەر",
  },
  "A reward takes": { ar: "المكافأة تحتاج", ckb: "خەڵات پێویستی بە" },
  "A reward is worth": { ar: "قيمة المكافأة", ckb: "بەهای خەڵات" },
  "A customer on a sale earns points on what it comes to, once paid, and takes a reward off a bill at the till. Off, customers are still kept, and their points too, but none are earned or taken.":
    {
      ar: "يكسب الزبون المسجّل على عملية البيع نقاطًا على مبلغها بعد دفعه، ويستبدل مكافأة من الفاتورة على نقطة البيع. عند الإيقاف يبقى الزبائن ونقاطهم محفوظين، لكن لا تُكسب نقاط ولا تُستبدل.",
      ckb: "کڕیارێک کە لەسەر فرۆشتنێکە، بە گوێرەی بڕەکەی دوای پارەدان خاڵ وەردەگرێت، و لەسەر خاڵی فرۆشتن خەڵاتێک لە پسووڵە دەبڕێت. کە کوژێنرایەوە، کڕیاران و خاڵەکانیان هەر دەمێننەوە، بەڵام هیچ خاڵێک نە وەردەگیرێت نە بەکاردەهێنرێت.",
    },
  "A point for every this many dinars a sale comes to, after its discount; a void takes them back, and a refund those of what it gives back.":
    {
      ar: "نقطة عن كل هذا العدد من الدنانير في مبلغ البيع بعد خصمه؛ والإلغاء يستردّ النقاط، والاسترداد يستردّ نقاط ما يُعيده.",
      ckb: "خاڵێک بۆ هەر ئەم بڕە دینارە لە کۆی فرۆشتنێک، دوای داشکاندنەکەی؛ هەڵوەشاندنەوە خاڵەکان دەگەڕێنێتەوە، و گەڕاندنەوەی پارە خاڵەکانی ئەوەی دەیگەڕێنێتەوە.",
    },
  "The points one reward takes. A customer takes as many rewards as their points come to, if the bill comes to at least what they take off.":
    {
      ar: "النقاط التي تحتاجها مكافأة واحدة. يستبدل الزبون من المكافآت بقدر ما تكفي نقاطه، إن كانت الفاتورة لا تقل عمّا تخصمه.",
      ckb: "ئەو خاڵانەی خەڵاتێک پێویستیەتی. کڕیار هێندە خەڵات وەردەگرێت کە خاڵەکانی بەشی بکەن، ئەگەر پسووڵەکە لەوەی دادەشکێنرێت کەمتر نەبێت.",
    },
  "What one reward takes off a bill: it is the bill's discount (4100), taken whole.": {
    ar: "ما تخصمه مكافأة واحدة من الفاتورة: هو خصم الفاتورة (4100)، ويؤخذ كاملًا.",
    ckb: "ئەوەی خەڵاتێک لە پسووڵە دادەشکێنێت: داشکاندنی پسووڵەکەیە (4100)، بە تەواوی.",
  },
  On: { ar: "مُفعّل", ckb: "هەڵکراو" },
  Off: { ar: "متوقف", ckb: "کوژاوە" },

  // The audit trail
  "Customers and points": { ar: "الزبائن والنقاط", ckb: "کڕیاران و خاڵەکان" },
  "Customer saved": { ar: "حُفظ الزبون", ckb: "کڕیار پاشەکەوت کرا" },
  "Customer's address saved": { ar: "حُفظ عنوان الزبون", ckb: "ناونیشانی کڕیار پاشەکەوت کرا" },
  "Points given or taken by hand": {
    ar: "نقاط مُنحت أو سُحبت يدويًا",
    ckb: "خاڵ بە دەست درا یان سەندرایەوە",
  },
  "Kept as a customer": { ar: "محفوظ كزبون", ckb: "وەک کڕیار ماوەتەوە" },
  "Change in points": { ar: "التغيّر في النقاط", ckb: "گۆڕانی خاڵ" },
  "A customer": { ar: "زبون", ckb: "کڕیارێک" },

  // What the database refuses with
  "Type the customer's name": { ar: "اكتب اسم الزبون", ckb: "ناوی کڕیارەکە بنووسە" },
  "Type the customer's phone number": {
    ar: "اكتب رقم هاتف الزبون",
    ckb: "ژمارەی تەلەفۆنی کڕیارەکە بنووسە",
  },
  "That is not a phone number: type it as 0770 123 4567": {
    ar: "هذا ليس رقم هاتف: اكتبه هكذا 0770 123 4567",
    ckb: "ئەمە ژمارەی تەلەفۆن نییە: بەم شێوەیە بینووسە 0770 123 4567",
  },
  "Notes are at most 500 letters": {
    ar: "الملاحظات 500 حرف على الأكثر",
    ckb: "تێبینی لە 500 پیت زیاتر نییە",
  },
  "That number is {1}'s already": {
    ar: "هذا الرقم لـ{1} بالفعل",
    ckb: "ئەو ژمارەیە پێشتر هی {1}یە",
  },
  "Customer not found": { ar: "الزبون غير موجود", ckb: "کڕیارەکە نەدۆزرایەوە" },
  "Type the address": { ar: "اكتب العنوان", ckb: "ناونیشانەکە بنووسە" },
  "An address is at most 300 letters": {
    ar: "العنوان 300 حرف على الأكثر",
    ckb: "ناونیشان لە 300 پیت زیاتر نییە",
  },
  "A name for the address is at most 40 letters": {
    ar: "اسم العنوان 40 حرفًا على الأكثر",
    ckb: "ناوی ناونیشان لە 40 پیت زیاتر نییە",
  },
  "Directions are at most 300 letters": {
    ar: "وصف الطريق 300 حرف على الأكثر",
    ckb: "ڕێنمایی لە 300 پیت زیاتر نییە",
  },
  "A customer keeps at most 10 addresses: put one away first": {
    ar: "للزبون 10 عناوين على الأكثر: أرشِف واحدًا منها أولًا",
    ckb: "کڕیار لە 10 ناونیشان زیاتری نابێت: سەرەتا یەکێکیان ئەرشیف بکە",
  },
  "Address not found": { ar: "العنوان غير موجود", ckb: "ناونیشانەکە نەدۆزرایەوە" },
  "A delivery platform's customers are its own: none is added at the till": {
    ar: "زبائن منصة التوصيل زبائنها هي: لا يُضاف أحد منهم على نقطة البيع",
    ckb: "کڕیارانی پلاتفۆرمی گەیاندن هی خۆیەتی: هیچ کەسێکیان لەسەر خاڵی فرۆشتن زیاد ناکرێت",
  },
  "A sale takes from 1 to 20 rewards": {
    ar: "يأخذ البيع من 1 إلى 20 مكافأة",
    ckb: "فرۆشتنێک لە 1 بۆ 20 خەڵات وەردەگرێت",
  },
  "{1} is no longer a customer here: bring them back on Customers first": {
    ar: "لم يعد {1} زبونًا هنا: أعِده أولًا من «الزبائن»",
    ckb: "{1} ئیتر کڕیاری ئێرە نییە: سەرەتا لە «کڕیاران» بیگەڕێنەوە",
  },
  "Choose one of the customer's addresses": {
    ar: "اختر أحد عناوين الزبون",
    ckb: "یەکێک لە ناونیشانەکانی کڕیارەکە هەڵبژێرە",
  },
  "Customers earn no points now: loyalty is off on Settings": {
    ar: "لا يكسب الزبائن نقاطًا الآن: برنامج الولاء متوقف في «الإعدادات»",
    ckb: "ئێستا کڕیاران خاڵ وەرناگرن: دڵسۆزی لە «ڕێکخستنەکان» کوژاوەتەوە",
  },
  "A reward is the bill's discount: take the other discount off first": {
    ar: "المكافأة هي خصم الفاتورة: احذف الخصم الآخر أولًا",
    ckb: "خەڵات داشکاندنی پسووڵەکەیە: سەرەتا داشکاندنەکەی تر لابە",
  },
  "Not enough points: {1} has {2}, and this takes {3}": {
    ar: "النقاط لا تكفي: لدى {1} {2}، وهذا يحتاج إلى {3}",
    ckb: "خاڵ بەش ناکات: {1} {2} خاڵی هەیە، و ئەمە {3} پێویستە",
  },
  "Choose the customer to take their reward": {
    ar: "اختر الزبون لاستبدال مكافأته",
    ckb: "کڕیارەکە هەڵبژێرە بۆ وەرگرتنی خەڵاتەکەی",
  },
  "A delivery by the café's own driver needs the customer and their address": {
    ar: "التوصيل بسائق المقهى يحتاج إلى الزبون وعنوانه",
    ckb: "گەیاندن بە شۆفێری کافێکە پێویستی بە کڕیار و ناونیشانەکەیەتی",
  },
  "The bill comes to less than the reward ({1}): add to it, or keep the points for later": {
    ar: "الفاتورة أقل من المكافأة ({1}): أضف إليها، أو احتفظ بالنقاط لوقت لاحق",
    ckb: "پسووڵەکە لە خەڵاتەکە کەمترە ({1}): شتی تری بخەرە سەر، یان خاڵەکان بۆ دواتر بهێڵەوە",
  },
  "Choose the customer again": { ar: "اختر الزبون مجددًا", ckb: "دووبارە کڕیارەکە هەڵبژێرە" },
  "Enter the points to give, or with a minus to take": {
    ar: "أدخل النقاط المراد منحها، أو بعلامة ناقص لسحبها",
    ckb: "ئەو خاڵانە بنووسە کە دەدرێن، یان بە نیشانەی کەم بۆ سەندنەوە",
  },
  "Points are given or taken 10,000 at most at a time": {
    ar: "تُمنح النقاط أو تُسحب بحد أقصى 10,000 في المرة",
    ckb: "خاڵ دەدرێت یان دەسەندرێتەوە بە زۆرترین 10,000 لە هەر جارێکدا",
  },
  "Say why the points change": { ar: "اذكر سبب تغيير النقاط", ckb: "بڵێ بۆچی خاڵەکان دەگۆڕێن" },
  "{1} has {2} points: no more can be taken": {
    ar: "لدى {1} {2} نقطة: لا يمكن سحب أكثر",
    ckb: "{1} {2} خاڵی هەیە: زیاتر ناسەندرێتەوە",
  },
  "Choose the dates, the first on or before the last": {
    ar: "اختر التاريخين، الأول في يوم الأخير أو قبله",
    ckb: "بەروارەکان هەڵبژێرە، یەکەمیان لە ڕۆژی کۆتایی یان پێش ئەو",
  },
};

export default phrases;
