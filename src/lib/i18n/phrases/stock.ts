import type { PhraseBook } from "./types";

/**
 * Stock: Inventory, an item's stock card, receiving and returning stock, waste, the stock count, Purchasing, and their forms and messages.
 */
const phrases: PhraseBook = {
  // Inventory: the stock board.
  "Stock here is added up from everything recorded — deliveries, sales, counts, losses and transfers — so there is no figure to type over. Each change below is recorded, costed and booked in one step.":
    {
      ar: "المخزون هنا مجموع كل ما سُجِّل — التوريدات والمبيعات والجرد والخسائر والتحويلات — فلا رقم يُكتب فوقه. كل تغيير أدناه يُسجَّل ويُكلَّف ويُقيَّد في خطوة واحدة.",
      ckb: "کۆگای ئێرە کۆی هەموو ئەو شتانەیە کە تۆمارکراون — گەیاندن، فرۆشتن، ژماردن، زیان و گواستنەوە — بۆیە هیچ ژمارەیەک نییە بەسەریدا بنووسرێت. هەر گۆڕانکارییەک لە خوارەوە لە یەک هەنگاودا تۆمار دەکرێت، تێچووی بۆ دادەنرێت و لە دەفتەر دادەنرێت.",
    },
  "Items tracked": { ar: "المواد المتابَعة", ckb: "کاڵای بەدواداچوو" },
  "Stock value (ledger)": { ar: "قيمة المخزون (حسب السجل)", ckb: "بەهای کۆگا (بەپێی تۆمار)" },
  "Below reorder level": { ar: "دون حدّ إعادة الطلب", ckb: "لە خوار ئاستی داواکردنەوە" },
  "Negative stock": { ar: "المخزون السالب", ckb: "کۆگای ژێر سفر" },
  "No stock recorded yet": {
    ar: "لم يُسجَّل أي مخزون بعد",
    ckb: "هێشتا هیچ کۆگایەک تۆمار نەکراوە",
  },
  "No stock items yet": { ar: "لا توجد مواد مخزون بعد", ckb: "هێشتا هیچ کاڵایەکی کۆگا نییە" },
  "Give each item its opening stock above: what is on the shelf, at what it cost.": {
    ar: "سجّل في الأعلى المخزون الافتتاحي لكل مادة: ما على الرف، وبكم كلّف.",
    ckb: "لە سەرەوە کۆگای سەرەتای هەر کاڵایەک تۆمار بکە: ئەوەی لەسەر ڕەفەکەیە، و تێچووەکەی چەند بووە.",
  },
  "Add the first item above, with its opening stock.": {
    ar: "أضف أول مادة في الأعلى، مع مخزونها الافتتاحي.",
    ckb: "لە سەرەوە یەکەم کاڵا زیاد بکە، لەگەڵ کۆگای سەرەتاکەی.",
  },
  "Stock on hand": { ar: "المخزون المتوفّر", ckb: "کۆگای بەردەست" },
  "Open an item for its stock card: what it opened with, what came in and went out, and what is left.":
    {
      ar: "افتح أي مادة لترى بطاقة مخزونها: بماذا بدأت، وما دخل وما خرج، وما تبقّى.",
      ckb: "کاڵایەک بکەرەوە بۆ بینینی کارتی کۆگاکەی: بە چییەوە دەستی پێکرد، چی هات و چی ڕۆیشت، و چی ماوە.",
    },
  Type: { ar: "النوع", ckb: "جۆر" },
  "On hand": { ar: "المتوفّر", ckb: "بەردەست" },
  Reorder: { ar: "إعادة الطلب", ckb: "داواکردنەوە" },
  "Avg cost": { ar: "متوسط الكلفة", ckb: "ناوەندی تێچوو" },
  Value: { ar: "القيمة", ckb: "بەها" },
  "Its stock card": { ar: "بطاقة مخزونها", ckb: "کارتی کۆگاکەی" },
  negative: { ar: "سالب", ckb: "ژێر سفر" },
  low: { ar: "منخفض", ckb: "کەم" },
  ok: { ar: "جيد", ckb: "باش" },
  "Negative stock means more was sold or used than the ledger knows arrived — usually a receipt not yet entered. Sales from it are costed at the last purchase cost, never at zero; turn on “prevent negative stock” to refuse such sales instead.":
    {
      ar: "المخزون السالب يعني أن ما بيع أو استُخدم أكثر مما يعرف السجل أنه وصل — وغالبًا ما يكون السبب إيصال استلام لم يُدخَل بعد. تُحتسب كلفة مبيعاته بآخر كلفة شراء، وليس بصفر أبدًا؛ فعّل «منع المخزون السالب» لرفض مثل هذه المبيعات بدلًا من ذلك.",
      ckb: "کۆگای ژێر سفر واتە زیاتر فرۆشراوە یان بەکارهاتووە لەوەی تۆمارەکە دەزانێت هاتووە — زۆرجار وەسڵێکی وەرگرتنە کە هێشتا تۆمار نەکراوە. تێچووی فرۆشتنەکانی بە دوایین تێچووی کڕین هەژمار دەکرێت، هەرگیز بە سفر نا؛ «ڕێگری لە کۆگای ژێر سفر» چالاک بکە بۆ ئەوەی لەبری ئەوە ئەو جۆرە فرۆشتنانە ڕەت بکرێنەوە.",
    },
  "No stock yet:": { ar: "بلا مخزون بعد:", ckb: "هێشتا بێ کۆگا:" },
  "Out of use:": { ar: "خارج الاستخدام:", ckb: "لە بەکارهێنان لابراوە:" },
  "kept for their history; open one to bring it back into use": {
    ar: "محفوظة من أجل سجلّها؛ افتح إحداها لإعادتها إلى الاستخدام",
    ckb: "بۆ مێژووەکەیان هەڵگیراون؛ یەکێکیان بکەرەوە بۆ گەڕاندنەوەی بۆ بەکارهێنان",
  },
  "Ledger browser — last {n} movements": {
    ar: "مستعرض السجل — آخر الحركات: {n}",
    ckb: "بینەری تۆمار — دوایین جووڵەکان: {n}",
  },
  Qty: { ar: "الكمية", ckb: "بڕ" },

  // An item's stock card, and what each delivery of it cost.
  "Opening stock recorded": { ar: "المخزون الافتتاحي المسجَّل", ckb: "کۆگای سەرەتای تۆمارکراو" },
  "Received (less returns to suppliers)": {
    ar: "المستلَم (مطروحًا منه المرتجع إلى المورّدين)",
    ckb: "وەرگیراو (بە لابردنی گەڕاندنەوە بۆ دابینکەران)",
  },
  "Sold (less voids and refunds back on the shelf)": {
    ar: "المبيع (مطروحًا منه الملغى والمسترد العائد إلى الرف)",
    ckb: "فرۆشراو (بە لابردنی ئەو هەڵوەشاندنەوە و گەڕاندنەوانەی گەڕانەوە سەر ڕەف)",
  },
  "Used in batches": {
    ar: "المستخدَم في دفعات الإنتاج",
    ckb: "بەکارهاتوو لە دەستەکانی بەرهەمهێناندا",
  },
  // Also the production screen's column of when a batch was made: one word for both.
  Made: { ar: "صُنع", ckb: "دروستکرا" },
  "Wasted, spoiled, given away": {
    ar: "المهدور والتالف والمُعطى مجانًا",
    ckb: "بەفیڕۆچوو، خراپبوو، بەخشراو",
  },
  "Stock counts": { ar: "عمليات الجرد", ckb: "ژماردنەکانی کۆگا" },
  Corrections: { ar: "التصحيحات", ckb: "ڕاستکردنەوەکان" },
  "Moved between locations": { ar: "المنقول بين المواقع", ckb: "گوازراوە لە نێوان شوێنەکاندا" },
  "Stock card": { ar: "بطاقة المخزون", ckb: "کارتی کۆگا" },
  "Item not found": { ar: "لم يُعثر على المادة", ckb: "کاڵاکە نەدۆزرایەوە" },
  "Choose an item on Inventory.": {
    ar: "اختر مادة من شاشة المخزون.",
    ckb: "لە شاشەی کۆگا کاڵایەک هەڵبژێرە.",
  },
  "Back to Inventory": { ar: "العودة إلى المخزون", ckb: "گەڕانەوە بۆ کۆگا" },
  "Stock card: {name}": { ar: "بطاقة المخزون: {name}", ckb: "کارتی کۆگا: {name}" },
  "{type} · {from} to {to} · in {unit}": {
    ar: "{type} · من {from} إلى {to} · بوحدة {unit}",
    ckb: "{type} · لە {from} تا {to} · بە یەکەی {unit}",
  },
  "Out of use": { ar: "خارج الاستخدام", ckb: "لە بەکارهێنان لابراوە" },
  "Opening to closing": { ar: "من الافتتاح إلى الإقفال", ckb: "لە سەرەتاوە تا کۆتایی" },
  "Every movement of the stock ledger, at the value it was recorded with": {
    ar: "كل حركة في سجل المخزون، بالقيمة التي سُجّلت بها",
    ckb: "هەموو جووڵەیەکی تۆماری کۆگا، بەو بەهایەی پێی تۆمار کراوە",
  },
  "Quantity ({unit})": { ar: "الكمية ({unit})", ckb: "بڕ ({unit})" },
  "On hand when {from} began": { ar: "المتوفّر في بداية {from}", ckb: "بەردەست لە سەرەتای {from}" },
  "On hand at the end of {to}": { ar: "المتوفّر في نهاية {to}", ckb: "بەردەست لە کۆتایی {to}" },
  Movements: { ar: "الحركات", ckb: "جووڵەکان" },
  "{n} in these dates": { ar: "{n} في هذه الفترة", ckb: "{n} لەم ماوەیەدا" },
  "Nothing moved in these dates.": {
    ar: "لم تحدث أي حركة في هذه الفترة.",
    ckb: "لەم ماوەیەدا هیچ جووڵەیەک نەبووە.",
  },
  What: { ar: "ماذا", ckb: "چی" },
  Worth: { ar: "قيمة المتوفّر", ckb: "بەهای بەردەست" },
  "What it has cost": { ar: "ما كلّفته", ckb: "چەندی تێچووە" },
  "Each delivery, newest first: the price paid, and with freight shared out": {
    ar: "كل شحنة، الأحدث أولًا: السعر المدفوع، ثم مع توزيع كلفة الشحن",
    ckb: "هەر بارێک، نوێترینەکان سەرەتا: نرخی دراو، و لەگەڵ دابەشکردنی کرێی گواستنەوە",
  },
  "No deliveries of it yet.": { ar: "لم تصل منها أي شحنة بعد.", ckb: "هێشتا هیچ بارێکی نەهاتووە." },
  Received: { ar: "مستلَم", ckb: "وەرگیراو" },
  Receipt: { ar: "استلام", ckb: "وەرگرتن" },
  Paid: { ar: "المدفوع", ckb: "پارەی دراو" },
  "A {unit}": { ar: "لكل {unit}", ckb: "بۆ هەر {unit}" },
  "Landed, a {unit}": { ar: "الكلفة الواصلة لكل {unit}", ckb: "تێچووی گەیشتوو بۆ هەر {unit}" },

  // Why a movement happened, as the database writes it (shown through msg()).
  "Goods received": { ar: "بضاعة مستلمة", ckb: "کاڵای وەرگیراو" },
  "Count variance": { ar: "فرق الجرد", ckb: "جیاوازی ژماردن" },
  "Opening balance: {1}": { ar: "الرصيد الافتتاحي: {1}", ckb: "باڵانسی سەرەتا: {1}" },
  "Refund: {1}": { ar: "استرداد: {1}", ckb: "گەڕاندنەوەی پارە: {1}" },
  "Cancelled: {1}": { ar: "أُلغي: {1}", ckb: "هەڵوەشێنرایەوە: {1}" },

  // Adding an item, its opening stock, waste and corrections.
  "Added “{name}”.": { ar: "أُضيف «{name}».", ckb: "«{name}» زیاد کرا." },
  "Add stock item": { ar: "إضافة مادة مخزون", ckb: "زیادکردنی کاڵای کۆگا" },
  "Name (English)": { ar: "الاسم (بالإنجليزية)", ckb: "ناو (بە ئینگلیزی)" },
  "e.g. Milk": { ar: "مثلًا: حليب", ckb: "بۆ نموونە: شیر" },
  "الاسم (Arabic)": { ar: "الاسم (بالعربية)", ckb: "ناو (بە عەرەبی)" },
  "ناو (Kurdish)": { ar: "الاسم (بالكردية)", ckb: "ناو (بە کوردی)" },
  "Measured in": { ar: "طريقة القياس", ckb: "شێوازی پێوان" },
  "Count (each)": { ar: "العدد (each)", ckb: "ژمارە (each)" },
  "Mass (g)": { ar: "الوزن (g)", ckb: "کێش (g)" },
  "Volume (ml)": { ar: "الحجم (ml)", ckb: "قەبارە (ml)" },
  "Base unit": { ar: "الوحدة الأساسية", ckb: "یەکەی بنەڕەت" },
  "Reorder level ({unit})": { ar: "حدّ إعادة الطلب ({unit})", ckb: "ئاستی داواکردنەوە ({unit})" },
  "Opening stock ({unit})": { ar: "المخزون الافتتاحي ({unit})", ckb: "کۆگای سەرەتا ({unit})" },
  "Cost per {unit} (IQD)": { ar: "الكلفة لكل {unit} (IQD)", ckb: "تێچوو بۆ هەر {unit} (IQD)" },
  "Its stock comes in with a delivery. Opening stock, the owner's capital, is the owner's to record.":
    {
      ar: "يدخل مخزونها مع الشحنات. أما المخزون الافتتاحي، وهو رأس مال المالك، فيسجّله المالك وحده.",
      ckb: "کۆگاکەی لەگەڵ بار دێت. کۆگای سەرەتا، کە سەرمایەی خاوەنە، تەنها خاوەن تۆماری دەکات.",
    },
  "Where the opening stock came from": {
    ar: "مصدر المخزون الافتتاحي",
    ckb: "کۆگای سەرەتا لە کوێوە هاتووە",
  },
  "e.g. the opening count on the first day": {
    ar: "مثلًا: جرد الافتتاح في اليوم الأول",
    ckb: "بۆ نموونە: ژماردنی سەرەتا لە یەکەم ڕۆژدا",
  },
  "Goes back on the shelf when a sale is refunded (sealed goods only)": {
    ar: "تعود إلى الرف عند استرداد البيع (للبضائع المختومة فقط)",
    ckb: "کاتێک پارەی فرۆشتنێک دەگەڕێندرێتەوە، دەگەڕێتەوە سەر ڕەف (تەنها بۆ کاڵای داخراو)",
  },
  "No two items in use share a name, whatever the capitals, spaces or punctuation.": {
    ar: "لا تحمل مادتان مستخدمتان الاسم نفسه، مهما اختلفت الأحرف الكبيرة أو المسافات أو علامات الترقيم.",
    ckb: "هیچ دوو کاڵایەکی بەکارهاتوو هەمان ناویان نابێت، هەرچەندە پیتی گەورە و بۆشایی و خاڵبەندییان جیاواز بێت.",
  },
  "Opening stock is journaled: Dr 1200 Inventory / Cr 3000 Owner equity.": {
    ar: "يُقيَّد المخزون الافتتاحي: مدين 1200 المخزون / دائن 3000 حقوق المالك.",
    ckb: "کۆگای سەرەتا تۆمار دەکرێت: مەدین 1200 کۆگا / دائین 3000 سەرمایەی خاوەن.",
  },
  "Add item": { ar: "إضافة المادة", ckb: "زیادکردنی کاڵا" },
  "Opening stock of {name}: {qty} {unit}, worth {value} (journal {journal}).": {
    ar: "المخزون الافتتاحي من {name}: {qty} {unit}، بقيمة {value} (القيد {journal}).",
    ckb: "کۆگای سەرەتای {name}: {qty} {unit}، بە بەهای {value} (تۆماری {journal}).",
  },
  "Opening stock": { ar: "مخزون افتتاحي", ckb: "کۆگای سەرەتا" },
  "{n} item(s) have no stock recorded yet. Count what is on the shelf and enter it at what it cost, so every sale of it is costed.":
    {
      ar: "مواد لم يُسجَّل لها مخزون بعد: {n}. اعدد ما على الرف وأدخله بكلفته، لتُحتسب كلفة كل بيع منه.",
      ckb: "کاڵای هێشتا بێ کۆگای تۆمارکراو: {n}. ئەوەی لەسەر ڕەفەکەیە بیژمێرە و بە تێچووەکەی تۆماری بکە، بۆ ئەوەی تێچووی هەموو فرۆشتنێکی هەژمار بکرێت.",
    },
  "Item with no stock yet": { ar: "مادة بلا مخزون بعد", ckb: "کاڵای هێشتا بێ کۆگا" },
  "Quantity on the shelf": { ar: "الكمية على الرف", ckb: "بڕی سەر ڕەف" },
  "Where it came from": { ar: "من أين جاء", ckb: "لە کوێوە هاتووە" },
  "Worth {value}.": { ar: "القيمة: {value}.", ckb: "بەها: {value}." },
  "It is capital you put into the business: journaled Dr 1200 Inventory / Cr 3000 Owner equity, and on the audit trail with where it came from. Once an item has stock, it changes only by deliveries, sales, waste, counts and corrections.":
    {
      ar: "إنه رأس مال تضعه في العمل: يُقيَّد مدين 1200 المخزون / دائن 3000 حقوق المالك، ويُسجَّل في سجل التدقيق مع مصدره. وما إن يصبح للمادة مخزون، لا يتغيّر إلا بالشحنات والمبيعات والهدر والجرد والتصحيحات.",
      ckb: "ئەمە سەرمایەیەکە کە دەیخەیتە ناو کارەکەوە: وەک مەدین 1200 کۆگا / دائین 3000 سەرمایەی خاوەن تۆمار دەکرێت، و لەگەڵ سەرچاوەکەی لە تۆماری گۆڕانکارییەکاندا دەنووسرێت. کاتێک کاڵایەک کۆگای هەبوو، تەنها بە بار و فرۆشتن و بەفیڕۆچوون و ژماردن و ڕاستکردنەوە دەگۆڕێت.",
    },
  "Recording…": { ar: "جارٍ التسجيل…", ckb: "تۆمار دەکرێت…" },
  "Record opening stock": { ar: "تسجيل المخزون الافتتاحي", ckb: "تۆمارکردنی کۆگای سەرەتا" },
  "Recorded — {value} written off (journal {journal}).": {
    ar: "سُجّل — شُطب {value} (القيد {journal}).",
    ckb: "تۆمار کرا — {value} وەک زیان دانرا (تۆماری {journal}).",
  },
  "Recorded (journal {journal}).": {
    ar: "سُجّل (القيد {journal}).",
    ckb: "تۆمار کرا (تۆماری {journal}).",
  },
  "Record waste": { ar: "تسجيل هدر", ckb: "تۆمارکردنی بەفیڕۆچوون" },
  "What happened": { ar: "ما حدث", ckb: "ئەوەی ڕوویدا" },
  "Quantity lost": { ar: "الكمية المفقودة", ckb: "بڕی لەدەستچوو" },
  "Why (required)": { ar: "السبب (مطلوب)", ckb: "بۆچی (پێویستە)" },
  "Taken out at average cost: Dr 5300 Waste / Cr 1200 Inventory. Large write-offs need a manager.":
    {
      ar: "يُخرَج بمتوسط الكلفة: مدين 5300 الهدر / دائن 1200 المخزون. الشطب الكبير يحتاج إلى مدير.",
      ckb: "بە ناوەندی تێچوو دەردەهێنرێت: مەدین 5300 بەفیڕۆچوون / دائین 1200 کۆگا. زیانی گەورە پێویستی بە بەڕێوەبەرە.",
    },
  "Corrected — {value} (journal {journal}).": {
    ar: "صُحّح — {value} (القيد {journal}).",
    ckb: "ڕاست کرایەوە — {value} (تۆماری {journal}).",
  },
  "Correct stock (manager)": { ar: "تصحيح المخزون (للمدير)", ckb: "ڕاستکردنەوەی کۆگا (بەڕێوەبەر)" },
  "Change (− to reduce)": { ar: "التغيير (− للإنقاص)", ckb: "گۆڕانکاری (− بۆ کەمکردنەوە)" },
  "Cost per base unit (additions)": {
    ar: "الكلفة لكل وحدة أساسية (للإضافات)",
    ckb: "تێچوو بۆ هەر یەکەیەکی بنەڕەت (بۆ زیادکردن)",
  },
  average: { ar: "المتوسط", ckb: "ناوەندی" },
  "For corrections outside a count. Losses go out at average cost; posted against 5400 Inventory count variance and written to the audit trail. Counted stock is corrected by approving a count.":
    {
      ar: "للتصحيحات خارج الجرد. يخرج النقص بمتوسط الكلفة؛ ويُرحَّل على 5400 فروقات جرد المخزون ويُكتب في سجل التدقيق. أما المخزون المعدود فيُصحَّح بالموافقة على الجرد.",
      ckb: "بۆ ڕاستکردنەوەی دەرەوەی ژماردن. کەمبوونەکان بە ناوەندی تێچوو دەردەچن؛ لەسەر 5400 جیاوازی ژماردنی کۆگا تۆمار دەکرێن و لە تۆماری گۆڕانکارییەکاندا دەنووسرێن. کۆگای ژمێردراو بە پەسەندکردنی ژماردنەکە ڕاست دەکرێتەوە.",
    },
  "Posting…": { ar: "جارٍ الترحيل…", ckb: "تۆمار دەکرێت…" },
  "Post correction": { ar: "ترحيل التصحيح", ckb: "تۆمارکردنی ڕاستکردنەوە" },

  // An item corrected, and its units.
  "Saved, and on the audit trail.": {
    ar: "حُفظ، وسُجّل في سجل التدقيق.",
    ckb: "پاشەکەوت کرا، و لە تۆماری گۆڕانکارییەکاندا نووسرا.",
  },
  "Correct this item": { ar: "تصحيح هذه المادة", ckb: "ڕاستکردنەوەی ئەم کاڵایە" },
  "Every change goes on the audit trail, with its values before and after": {
    ar: "يُسجَّل كل تغيير في سجل التدقيق، مع قيمه قبل التغيير وبعده",
    ckb: "هەموو گۆڕانکارییەک لە تۆماری گۆڕانکارییەکاندا دەنووسرێت، لەگەڵ بەهاکانی پێش و دوای",
  },
  "Par level ({unit})": { ar: "المستوى المستهدف ({unit})", ckb: "ئاستی ئامانج ({unit})" },
  "In use: offered on deliveries, counts, recipes and the till": {
    ar: "مستخدمة: تظهر في الشحنات والجرد والوصفات ونقطة البيع",
    ckb: "بەکاردێت: لە بار و ژماردن و ڕەسەتەکان و خاڵی فرۆشتندا دەردەکەوێت",
  },
  "Why (on the audit trail)": {
    ar: "السبب (يُسجَّل في سجل التدقيق)",
    ckb: "بۆچی (لە تۆماری گۆڕانکارییەکاندا دەنووسرێت)",
  },
  "e.g. the supplier's name for it": {
    ar: "مثلًا: الاسم الذي يستخدمه المورّد لها",
    ckb: "بۆ نموونە: ئەو ناوەی دابینکەر پێی دەڵێت",
  },
  "e.g. we stopped using it": {
    ar: "مثلًا: توقّفنا عن استخدامها",
    ckb: "بۆ نموونە: ئیتر بەکاری ناهێنین",
  },
  "It stays counted in {unit}: its whole history is. No two items in use share a name, whatever the capitals, spaces or punctuation. An item is taken out of use only when it has no stock and no recipe, product or batch needs it.":
    {
      ar: "تبقى المادة تُعَدّ بوحدة {unit}: فكل سجلّها بها. لا تحمل مادتان مستخدمتان الاسم نفسه، مهما اختلفت الأحرف الكبيرة أو المسافات أو علامات الترقيم. ولا تُخرَج مادة من الاستخدام إلا إذا لم يكن لها مخزون، ولم تحتج إليها أي وصفة أو منتج أو دفعة إنتاج.",
      ckb: "هەر بە {unit} دەژمێردرێت: هەموو مێژووەکەی بەوە تۆمار کراوە. هیچ دوو کاڵایەکی بەکارهاتوو هەمان ناویان نابێت، هەرچەندە پیتی گەورە و بۆشایی و خاڵبەندییان جیاواز بێت. کاڵایەک تەنها کاتێک لە بەکارهێنان لادەبرێت کە هیچ کۆگای نەبێت و هیچ ڕەسەتە و بەرهەم و دەستەیەک پێویستی پێی نەبێت.",
    },
  "Save changes": { ar: "حفظ التغييرات", ckb: "پاشەکەوتکردنی گۆڕانکارییەکان" },
  "Added {name}.": { ar: "أُضيف {name}.", ckb: "{name} زیاد کرا." },
  Units: { ar: "الوحدات", ckb: "یەکەکان" },
  "What it is delivered and counted in": {
    ar: "الوحدات التي يُورَّد بها ويُعَدّ بها",
    ckb: "ئەو یەکانەی پێیان دەگات و پێیان دەژمێردرێت",
  },
  Label: { ar: "التسمية", ckb: "ناونیشان" },
  Holds: { ar: "السعة", ckb: "دەگرێت" },
  "base unit": { ar: "الوحدة الأساسية", ckb: "یەکەی بنەڕەت" },
  "New unit": { ar: "وحدة جديدة", ckb: "یەکەی نوێ" },
  "Case of 24": { ar: "كرتونة من 24", ckb: "کارتۆنی 24 دانەیی" },
  "Holds ({unit})": { ar: "السعة ({unit})", ckb: "دەگرێت ({unit})" },
  "A unit keeps its size for good: every delivery and count in it was taken at that size. A different size is a new unit (case_12, not case_24 changed).":
    {
      ar: "تحتفظ الوحدة بحجمها إلى الأبد: فكل شحنة وكل جرد بها أُخذ بذلك الحجم. والحجم المختلف وحدة جديدة (case_12، لا case_24 بعد تعديلها).",
      ckb: "یەکە قەبارەکەی بۆ هەمیشە دەپارێزێت: هەموو بارێک و ژماردنێک پێی، بەو قەبارەیە وەرگیراوە. قەبارەیەکی جیاواز یەکەیەکی نوێیە (case_12، نەک case_24 ی گۆڕدراو).",
    },
  "Adding…": { ar: "جارٍ الإضافة…", ckb: "زیاد دەکرێت…" },
  "Add unit": { ar: "إضافة الوحدة", ckb: "زیادکردنی یەکە" },

  // Receiving stock, and a new supplier.
  "Supplier added.": { ar: "تمت إضافة المورّد.", ckb: "دابینکەر زیاد کرا." },
  "Add supplier": { ar: "إضافة مورّد", ckb: "زیادکردنی دابینکەر" },
  "What they supply": { ar: "ما يورّدونه", ckb: "چی دابین دەکەن" },
  Phone: { ar: "الهاتف", ckb: "تەلەفۆن" },
  "Receipt {no} — {value} into stock, awaiting its bill.": {
    ar: "الإيصال {no} — دخل المخزون {value}، بانتظار فاتورته.",
    ckb: "وەسڵی {no} — {value} چووە ناو کۆگا، چاوەڕێی پسووڵەکەیەتی.",
  },
  "Receive stock": { ar: "استلام مخزون", ckb: "وەرگرتنی کۆگا" },
  "Add stock items on Inventory first.": {
    ar: "أضف مواد المخزون من شاشة المخزون أولًا.",
    ckb: "سەرەتا لە شاشەی کۆگا کاڵای کۆگا زیاد بکە.",
  },
  "Add the supplier first.": { ar: "أضف المورّد أولًا.", ckb: "سەرەتا دابینکەرەکە زیاد بکە." },
  "Receive stock (goods receipt)": {
    ar: "استلام مخزون (إيصال استلام)",
    ckb: "وەرگرتنی کۆگا (وەسڵی وەرگرتن)",
  },
  "Freight (IQD)": { ar: "الشحن (IQD)", ckb: "کرێی گواستنەوە (IQD)" },
  "Other landed costs": { ar: "تكاليف وصول أخرى", ckb: "تێچووەکانی تری گەیشتن" },
  "Rebate (−)": { ar: "خصم المورّد (−)", ckb: "داشکاندنی دابینکەر (−)" },
  "Price per {unit} (IQD)": { ar: "السعر لكل {unit} (IQD)", ckb: "نرخ بۆ هەر {unit} (IQD)" },
  "{cost} IQD a {unit}": { ar: "{cost} IQD لكل {unit}", ckb: "{cost} IQD بۆ هەر {unit}" },
  "it costs {cost} a {unit} now": {
    ar: "كلفتها الآن {cost} لكل {unit}",
    ckb: "ئێستا تێچووەکەی {cost} بۆ هەر {unit}",
  },
  "its first delivery: no cost to compare yet": {
    ar: "أول شحنة لها: لا توجد كلفة للمقارنة بعد",
    ckb: "یەکەم باری: هێشتا هیچ تێچوویەک نییە بۆ بەراوردکردن",
  },
  "{pct}% above: check it": { ar: "أعلى بـ {pct}%: تحقّق منه", ckb: "{pct}% زیاترە: بیپشکنە" },
  "{pct}% below: check it": { ar: "أدنى بـ {pct}%: تحقّق منه", ckb: "{pct}% کەمترە: بیپشکنە" },
  "Add line": { ar: "إضافة سطر", ckb: "زیادکردنی هێڵ" },
  "Note (delivery note number, etc.)": {
    ar: "ملاحظة (رقم وصل التسليم، إلخ)",
    ckb: "تێبینی (ژمارەی پسووڵەی گەیاندن، هتد)",
  },
  // The database's question about a price, without its closing words (the buttons ask them).
  "Check the price: {1}.": { ar: "تحقّق من السعر: {1}.", ckb: "نرخەکە بپشکنە: {1}." },
  "A price typed per gram instead of per kilogram, or a digit too many, would cost every sale of it wrongly. If the invoice says so, receive it as it is: your confirmation goes on the audit trail.":
    {
      ar: "السعر المكتوب لكل غرام بدلًا من كل كيلوغرام، أو الذي فيه رقم زائد، يجعل كلفة كل بيع منه خاطئة. إن كانت الفاتورة تقول ذلك فاستلمه كما هو: يُسجَّل تأكيدك في سجل التدقيق.",
      ckb: "نرخێک کە بۆ هەر گرامێک نووسرابێت لەبری هەر کیلۆگرامێک، یان ژمارەیەکی زیادەی تێدا بێت، تێچووی هەموو فرۆشتنێکی بە هەڵە هەژمار دەکات. ئەگەر پسووڵەکە وا دەڵێت، وەک خۆی وەریبگرە: پشتڕاستکردنەوەکەت لە تۆماری گۆڕانکارییەکاندا دەنووسرێت.",
    },
  "Receiving…": { ar: "جارٍ الاستلام…", ckb: "وەردەگیرێت…" },
  "The price is right: receive it": { ar: "السعر صحيح: استلمه", ckb: "نرخەکە ڕاستە: وەریبگرە" },
  "Let me correct it": { ar: "دعني أصحّحه", ckb: "با ڕاستی بکەمەوە" },
  "Receive goods": { ar: "استلام البضاعة", ckb: "وەرگرتنی کاڵا" },
  "Goods {value}": { ar: "البضاعة: {value}", ckb: "کاڵا: {value}" },

  // An item added on a receipt, and names that look alike (release H).
  "+ New item (not in Inventory yet)…": {
    ar: "+ مادة جديدة (ليست في المخزون بعد)…",
    ckb: "+ کاڵای نوێ (هێشتا لە کۆگادا نییە)…",
  },
  "A new stock item": { ar: "مادة مخزون جديدة", ckb: "کاڵایەکی نوێی کۆگا" },
  "It goes into Inventory with its name in each language, and its stock comes in with this delivery. Its price is entered on the line, as the invoice has it.":
    {
      ar: "تُضاف إلى المخزون باسمها في كل لغة، ويدخل مخزونها مع هذه الشحنة. ويُدخَل سعرها على السطر كما في الفاتورة.",
      ckb: "بە ناوەکەی بە هەموو زمانێک دەچێتە ناو کۆگاوە، و کۆگاکەی لەگەڵ ئەم بارەدا دێت. نرخەکەی لەسەر هێڵەکە تۆمار دەکرێت، وەک لە پسووڵەکەدا هاتووە.",
    },
  "Add the item": { ar: "أضف المادة", ckb: "کاڵاکە زیاد بکە" },
  "Price per unit (IQD)": { ar: "السعر لكل وحدة (IQD)", ckb: "نرخ بۆ هەر یەکەیەک (IQD)" },
  "Added “{name}” to Inventory: its stock comes in with this delivery.": {
    ar: "أُضيفت «{name}» إلى المخزون: يدخل مخزونها مع هذه الشحنة.",
    ckb: "«{name}» زیاد کرا بۆ کۆگا: کۆگاکەی لەگەڵ ئەم بارەدا دێت.",
  },
  "Add the new item first, or choose one from the list.": {
    ar: "أضف المادة الجديدة أولًا، أو اختر واحدة من القائمة.",
    ckb: "سەرەتا کاڵا نوێیەکە زیاد بکە، یان یەکێک لە لیستەکە هەڵبژێرە.",
  },
  "There is already an item called “{name}”.": {
    ar: "توجد مادة باسم «{name}» بالفعل.",
    ckb: "کاڵایەک بە ناوی «{name}» پێشتر هەیە.",
  },
  "Is it one of these? Its name looks like:": {
    ar: "هل هي إحدى هذه؟ اسمها يشبه:",
    ckb: "ئایا یەکێکە لەمانە؟ ناوەکەی لەمانە دەچێت:",
  },
  "Use it": { ar: "استخدمها", ckb: "بەکاری بهێنە" },
  "Open it": { ar: "افتحها", ckb: "بیکەرەوە" },
  "Check the name before adding it: two items for the same thing split its stock and its cost in two. If it is a different item, add it all the same.":
    {
      ar: "تحقّق من الاسم قبل إضافتها: مادتان للشيء نفسه تقسمان مخزونه وكلفته إلى قسمين. وإن كانت مادة مختلفة فأضفها على أي حال.",
      ckb: "پێش زیادکردنی ناوەکە بپشکنە: دوو کاڵا بۆ هەمان شت کۆگا و تێچووەکەی دەکەن بە دوو بەش. ئەگەر کاڵایەکی جیاوازە، هەر زیادی بکە.",
    },
  "It is a different item: add it": {
    ar: "إنها مادة مختلفة: أضفها",
    ckb: "کاڵایەکی جیاوازە: زیادی بکە",
  },
  "It looks like an item already on the list": {
    ar: "تبدو كمادة موجودة في القائمة بالفعل",
    ckb: "وەک کاڵایەکی ناو لیستەکە دەچێت",
  },
  "The pack it is bought in (optional)": {
    ar: "العبوة التي تُشترى بها (اختياري)",
    ckb: "ئەو پاکەتەی پێی دەکڕدرێت (ئارەزوومەندانە)",
  },
  "e.g. Carton of 24": { ar: "مثلًا: كرتونة من 24", ckb: "بۆ نموونە: کارتۆنی 24 دانەیی" },
  "Give the pack both its name and how many {unit} it holds.": {
    ar: "أعطِ العبوة اسمها وعدد ما تحويه من {unit} معًا.",
    ckb: "هەم ناوی پاکەتەکە و هەم ئەوەی چەند {unit} دەگرێت بنووسە.",
  },
  "The pack's name": { ar: "اسم العبوة", ckb: "ناوی پاکەتەکە" },

  // The stock count.
  "<b>Blind count.</b> Count what is on the shelf; the expected quantities are never shown to the person counting. Each item is compared with the stock at the moment it is counted, so the café can keep trading during a count. When the count is submitted, a manager — never the counter — reviews it and approves the variances into the books.":
    {
      ar: "<b>جرد أعمى.</b> اعدد ما على الرف؛ لا تُعرض الكميات المتوقعة أبدًا على من يقوم بالعدّ. تُقارَن كل مادة بالمخزون لحظة عدّها، فيستطيع المقهى مواصلة البيع أثناء الجرد. وعند تقديم الجرد، يراجعه مدير — لا العادّ أبدًا — ويوافق على ترحيل الفروقات إلى الدفاتر.",
      ckb: "<b>ژماردنی کوێر.</b> ئەوەی لەسەر ڕەفەکەیە بیژمێرە؛ بڕە چاوەڕوانکراوەکان هەرگیز بە کەسی ژمێرەر پیشان نادرێن. هەر کاڵایەک لە ساتی ژماردنیدا لەگەڵ کۆگاکە بەراورد دەکرێت، بۆیە کافێکە دەتوانێت لە کاتی ژماردندا بەردەوام بێت لە فرۆشتن. کاتێک ژماردنەکە پێشکەش کرا، بەڕێوەبەرێک — هەرگیز ژمێرەرەکە نا — پێیدا دەچێتەوە و جیاوازییەکان پەسەند دەکات بۆ ناو دەفتەرەکان.",
    },
  "your count": { ar: "جردك", ckb: "ژماردنەکەت" },
  someone: { ar: "شخص ما", ckb: "کەسێک" },
  "A count is open: started {when} by {who}. Only one count is open at a time; it is finished by its counter, or cancelled here.":
    {
      ar: "هناك جرد مفتوح: بدأه {who} في {when}. لا يُفتح إلا جرد واحد في كل مرة؛ ويُنهيه من يقوم بالعدّ، أو يُلغى من هنا.",
      ckb: "ژماردنێک کراوەیە: {who} لە {when} دەستی پێکرد. لە یەک کاتدا تەنها یەک ژماردن کراوە دەبێت؛ ژمێرەرەکەی تەواوی دەکات، یان لێرە هەڵدەوەشێنرێتەوە.",
    },
  "A count is open: started {when} by {who}. Only one count is open at a time; it is finished by its counter.":
    {
      ar: "هناك جرد مفتوح: بدأه {who} في {when}. لا يُفتح إلا جرد واحد في كل مرة؛ ويُنهيه من يقوم بالعدّ.",
      ckb: "ژماردنێک کراوەیە: {who} لە {when} دەستی پێکرد. لە یەک کاتدا تەنها یەک ژماردن کراوە دەبێت؛ ژمێرەرەکەی تەواوی دەکات.",
    },
  "the open count": { ar: "الجرد المفتوح", ckb: "ژماردنە کراوەکە" },
  "Review — count of {when} by {who}": {
    ar: "مراجعة — جرد {when} الذي أجراه {who}",
    ckb: "پێداچوونەوە — ژماردنی {when} لەلایەن {who}",
  },
  Expected: { ar: "المتوقَّع", ckb: "چاوەڕوانکراو" },
  Counted: { ar: "معدود", ckb: "ژمێردراو" },
  Variance: { ar: "الفرق", ckb: "جیاوازی" },
  "{n} item(s) differ; net value {value}. Expected is the stock at the moment each item was counted. Approving posts the differences against 5400 Inventory count variance, dated when the count was submitted.":
    {
      ar: "المواد المختلفة: {n}؛ صافي القيمة {value}. المتوقَّع هو المخزون لحظة عدّ كل مادة. الموافقة ترحّل الفروقات على 5400 فروقات جرد المخزون، بتاريخ تقديم الجرد.",
      ckb: "کاڵای جیاواز: {n}؛ بەهای پوختە {value}. چاوەڕوانکراو ئەو کۆگایەیە کە لە ساتی ژماردنی هەر کاڵایەکدا هەبوو. پەسەندکردن جیاوازییەکان لەسەر 5400 جیاوازی ژماردنی کۆگا تۆمار دەکات، بە بەرواری پێشکەشکردنی ژماردنەکە.",
    },
  Counts: { ar: "عمليات الجرد", ckb: "ژماردنەکان" },
  "No counts yet": { ar: "لا توجد عمليات جرد بعد", ckb: "هێشتا هیچ ژماردنێک نییە" },
  "Start the first count above.": {
    ar: "ابدأ أول جرد من الأعلى.",
    ckb: "لە سەرەوە یەکەم ژماردن دەست پێ بکە.",
  },
  Started: { ar: "البدء", ckb: "دەستپێکردن" },
  Counter: { ar: "العادّ", ckb: "ژمێرەر" },
  "Approved / rejected by": { ar: "وافق عليه / رفضه", ckb: "پەسەندکرا / ڕەتکرایەوە لەلایەن" },
  Review: { ar: "مراجعة", ckb: "پێداچوونەوە" },
  // A count's state, as the database names it (count_status).
  draft: { ar: "مسودة", ckb: "ڕەشنووس" },
  counting: { ar: "قيد العدّ", ckb: "لە ژماردندایە" },
  submitted: { ar: "مُقدَّم", ckb: "پێشکەشکراو" },
  approved: { ar: "مُعتمَد", ckb: "پەسەندکراو" },
  rejected: { ar: "مرفوض", ckb: "ڕەتکراوە" },
  "Start a full count": { ar: "بدء جرد كامل", ckb: "دەستپێکردنی ژماردنێکی تەواو" },
  "Every active item is listed. Count them in any order; your entries are saved as you go.": {
    ar: "تظهر كل المواد المستخدمة. اعددها بأي ترتيب؛ تُحفظ إدخالاتك أولًا بأول.",
    ckb: "هەموو کاڵا چالاکەکان لیست کراون. بە هەر ڕیزێک بیانژمێرە؛ نووسینەکانت یەکسەر پاشەکەوت دەکرێن.",
  },
  "Opening…": { ar: "جارٍ الفتح…", ckb: "دەکرێتەوە…" },
  "Start count": { ar: "بدء الجرد", ckb: "دەستپێکردنی ژماردن" },
  "Count submitted for a manager to review.": {
    ar: "قُدِّم الجرد ليراجعه مدير.",
    ckb: "ژماردنەکە پێشکەش کرا بۆ ئەوەی بەڕێوەبەرێک پێیدا بچێتەوە.",
  },
  "Your count": { ar: "جردك", ckb: "ژماردنەکەت" },
  "{done} of {total} counted": { ar: "عُدّ {done} من {total}", ckb: "{done} لە {total} ژمێردراوە" },
  "Counted {name}": { ar: "المعدود من {name}", ckb: "ژمێردراوی {name}" },
  "Submitting…": { ar: "جارٍ التقديم…", ckb: "پێشکەش دەکرێت…" },
  "Submit count": { ar: "تقديم الجرد", ckb: "پێشکەشکردنی ژماردن" },
  "Count every item before submitting — enter 0 for anything not there.": {
    ar: "اعدد كل مادة قبل التقديم — أدخل 0 لكل ما هو غير موجود.",
    ckb: "پێش پێشکەشکردن هەموو کاڵایەک بژمێرە — بۆ هەر شتێک کە نییە 0 بنووسە.",
  },
  "You counted this one, so someone else must approve it.": {
    ar: "أنت من أجرى هذا الجرد، لذا يجب أن يوافق عليه شخص آخر.",
    ckb: "تۆ ئەمەت ژماردووە، بۆیە دەبێت کەسێکی تر پەسەندی بکات.",
  },
  "Approved — loss {loss}, gain {gain} (journal {journal}).": {
    ar: "اعتُمد — النقص {loss}، الزيادة {gain} (القيد {journal}).",
    ckb: "پەسەند کرا — کەمبوون {loss}، زیادبوون {gain} (تۆماری {journal}).",
  },
  "Approved — loss {loss}, gain {gain}.": {
    ar: "اعتُمد — النقص {loss}، الزيادة {gain}.",
    ckb: "پەسەند کرا — کەمبوون {loss}، زیادبوون {gain}.",
  },
  "Approve and post variances": {
    ar: "الموافقة وترحيل الفروقات",
    ckb: "پەسەندکردن و تۆمارکردنی جیاوازییەکان",
  },
  "Reason to reject (recount)": {
    ar: "سبب الرفض (إعادة الجرد)",
    ckb: "هۆکاری ڕەتکردنەوە (دووبارە ژماردنەوە)",
  },
  "Rejected — nothing was posted.": {
    ar: "رُفض — لم يُرحَّل شيء.",
    ckb: "ڕەتکرایەوە — هیچ شتێک تۆمار نەکرا.",
  },
  Reject: { ar: "رفض", ckb: "ڕەتکردنەوە" },
  "Cancel {count}": { ar: "إلغاء {count}", ckb: "هەڵوەشاندنەوەی {count}" },
  "Cancel this count…": { ar: "إلغاء هذا الجرد…", ckb: "هەڵوەشاندنەوەی ئەم ژماردنە…" },
  "Why the count is cancelled": {
    ar: "سبب إلغاء الجرد",
    ckb: "هۆکاری هەڵوەشاندنەوەی ژماردنەکە",
  },
  "Why? e.g. started by mistake": {
    ar: "لماذا؟ مثلًا: بُدئ بالخطأ",
    ckb: "بۆچی؟ بۆ نموونە: بە هەڵە دەست پێکرا",
  },
  "Cancel the count": { ar: "إلغاء الجرد", ckb: "ژماردنەکە هەڵبوەشێنەوە" },
  "Keep it": { ar: "أبقِه", ckb: "بیهێڵەرەوە" },

  // Purchasing.
  "Receive what a supplier delivers, each line as the invoice gives it. Freight and other costs are shared over the lines, and a price more than 25% away from what the item costs now is asked about first. The supplier's bill goes on <vendors>Vendors</vendors>.":
    {
      ar: "استلم ما يسلّمه المورّد، كل سطر كما في الفاتورة. تُوزَّع أجور الشحن والتكاليف الأخرى على الأسطر، ويُسأل أولًا عن أي سعر يبعد أكثر من 25% عن كلفة الصنف الآن. تُسجَّل فاتورة المورّد في <vendors>المورّدون</vendors>.",
      ckb: "ئەوەی دابینکەرێک دەیگەیەنێت وەربگرە، هەر هێڵێک وەک لە پسووڵەکەدایە. کرێی گواستنەوە و تێچووەکانی تر بەسەر هێڵەکاندا دابەش دەکرێن، و پێش هەموو شتێک پرسیار لە نرخێک دەکرێت کە زیاتر لە 25% لە تێچووی ئێستای کاڵاکە دوور بێت. پسووڵەی دابینکەر لە <vendors>دابینکەران</vendors> تۆمار دەکرێت.",
    },
  "How it is booked": { ar: "كيف يُقيَّد في الدفاتر", ckb: "چۆن لە دەفتەرەکاندا تۆمار دەکرێت" },
  "Receiving brings the stock in at its landed cost — freight and other costs less rebates, spread over the lines by value — and posts <b>Dr 1200 Inventory / Cr 2050 Goods received not invoiced</b>. The supplier's bill, recorded on <vendors>Vendors</vendors>, clears 2050 and raises the payable, so the purchase is never counted twice. Each line is entered at its price per unit, as the invoice gives it; a price more than 25% away from what the item costs now is asked about before anything is received.":
    {
      ar: "يُدخل الاستلامُ المخزونَ بكلفته الواصلة — الشحن والتكاليف الأخرى مطروحًا منها خصم المورّد، موزّعةً على السطور حسب القيمة — ويرحّل <b>مدين 1200 المخزون / دائن 2050 بضاعة مستلمة غير مفوترة</b>. فاتورة المورّد، التي تُسجَّل في <vendors>المورّدين</vendors>، تُصفّي 2050 وتُثبت المستحق للمورّد، فلا تُحتسب المشتريات مرتين أبدًا. يُدخَل كل سطر بسعر الوحدة كما في الفاتورة؛ وأي سعر يبتعد أكثر من 25% عن كلفة المادة الآن يُسأل عنه قبل استلام أي شيء.",
      ckb: "وەرگرتن کۆگاکە بە تێچووی گەیشتووی دەهێنێتە ناوەوە — کرێی گواستنەوە و تێچووەکانی تر، دوای لابردنی داشکاندنی دابینکەر، بەپێی بەها بەسەر هێڵەکاندا دابەش دەکرێن — و <b>مەدین 1200 کۆگا / دائین 2050 کاڵای وەرگیراوی بێ پسووڵە</b> تۆمار دەکات. پسووڵەی دابینکەر، کە لە <vendors>دابینکەران</vendors> تۆمار دەکرێت، 2050 پاک دەکاتەوە و قەرزی دابینکەر تۆمار دەکات، بۆیە کڕینەکە هەرگیز دوو جار هەژمار ناکرێت. هەر هێڵێک بە نرخی یەکە تۆمار دەکرێت، وەک لە پسووڵەکەدا هاتووە؛ هەر نرخێک زیاتر لە 25% لە تێچووی ئێستای کاڵاکە دوور بێت، پێش وەرگرتنی هەر شتێک پرسیاری لەسەر دەکرێت.",
    },
  "Recent goods receipts": { ar: "آخر إيصالات الاستلام", ckb: "دوایین وەسڵەکانی وەرگرتن" },
  "No receipts yet.": { ar: "لا توجد إيصالات بعد.", ckb: "هێشتا هیچ وەسڵێک نییە." },
  "No.": { ar: "الرقم", ckb: "ژمارە" },
  Lines: { ar: "السطور", ckb: "هێڵەکان" },
  Goods: { ar: "البضاعة", ckb: "کاڵا" },
  "Landed extras": { ar: "تكاليف الوصول الإضافية", ckb: "تێچووی زیادەی گەیشتن" },
  "Into stock": { ar: "إلى المخزون", ckb: "بۆ کۆگا" },
  Bill: { ar: "فاتورة", ckb: "پسووڵە" },
  Billed: { ar: "مفوتَر", ckb: "پسووڵەی هەیە" },
  "Received before the controls, which posted its payable then; its bill is recorded against that payable":
    {
      ar: "استُلم قبل الضوابط، التي رحّلت المستحق للمورّد حينها؛ وتُسجَّل فاتورته مقابل ذلك المستحق",
      ckb: "پێش ڕێکارەکانی کۆنترۆڵ وەرگیرا، کە ئەو کاتە قەرزەکەی تۆمار کرد؛ پسووڵەکەی بەرامبەر بەو قەرزە تۆمار دەکرێت",
    },
  "Awaiting bill": { ar: "بانتظار الفاتورة", ckb: "چاوەڕێی پسووڵە" },
  "Received before the controls and never journaled. The owner posts its journal from Reports → Do the books tie?":
    {
      ar: "استُلم قبل الضوابط ولم يُقيَّد أبدًا. يرحّل المالك قيده من التقارير ← هل تتطابق الدفاتر؟",
      ckb: "پێش ڕێکارەکانی کۆنترۆڵ وەرگیرا و هەرگیز تۆمار نەکراوە. خاوەن تۆمارەکەی لە ڕاپۆرتەکان ← ئایا دەفتەرەکان یەک دەگرنەوە؟ تۆمار دەکات",
    },
  "Not journaled": { ar: "غير مُقيَّد", ckb: "تۆمار نەکراوە" },
  "Received before the controls; its journal has been reversed": {
    ar: "استُلم قبل الضوابط؛ وقد عُكس قيده",
    ckb: "پێش ڕێکارەکانی کۆنترۆڵ وەرگیرا؛ تۆمارەکەی هەڵگەڕێندراوەتەوە",
  },
  "Before controls": { ar: "قبل الضوابط", ckb: "پێش کۆنترۆڵ" },

  // What the stock actions answer (src/lib/actions/stock.ts), and the names
  // of the fields they check.
  "Choose a type": { ar: "اختر نوعًا", ckb: "جۆرێک هەڵبژێرە" },
  "Choose how it is measured": { ar: "اختر طريقة قياسها", ckb: "هەڵبژێرە بە چی دەپێورێت" },
  "Reorder level": { ar: "حدّ إعادة الطلب", ckb: "ئاستی داواکردنەوە" },
  "Opening quantity": { ar: "الكمية الافتتاحية", ckb: "بڕی سەرەتا" },
  "Opening cost": { ar: "الكلفة الافتتاحية", ckb: "تێچووی سەرەتا" },
  "Opening stock needs its cost per unit": {
    ar: "يحتاج المخزون الافتتاحي إلى كلفة الوحدة",
    ckb: "کۆگای سەرەتا پێویستی بە تێچووی هەر یەکەیەک هەیە",
  },
  "Say where this stock came from (the opening count, say)": {
    ar: "اذكر من أين جاء هذا المخزون (جرد الافتتاح مثلًا)",
    ckb: "بڵێ ئەم کۆگایە لە کوێوە هاتووە (بۆ نموونە ژماردنی سەرەتا)",
  },
  "an item": { ar: "مادة", ckb: "کاڵایەک" },
  "Choose what happened": { ar: "اختر ما حدث", ckb: "هەڵبژێرە چی ڕوویدا" },
  "The correction": { ar: "التصحيح", ckb: "ڕاستکردنەوەکە" },
  "A reason": { ar: "السبب", ckb: "هۆکار" },
  "Unit cost": { ar: "كلفة الوحدة", ckb: "تێچووی یەکە" },
  "Cost per unit": { ar: "الكلفة لكل وحدة", ckb: "تێچوو بۆ هەر یەکەیەک" },
  "Where this stock came from": { ar: "مصدر هذا المخزون", ckb: "سەرچاوەی ئەم کۆگایە" },
  "Par level": { ar: "المستوى المستهدف", ckb: "ئاستی ئامانج" },
  "Name the unit in letters, digits and _ (such as case_24)": {
    ar: "سمِّ الوحدة بحروف لاتينية وأرقام و _ (مثل case_24)",
    ckb: "ناوی یەکەکە بە پیتی لاتینی و ژمارە و _ بنووسە (وەک case_24)",
  },
  "How many it holds": { ar: "مقدار ما تحتويه", ckb: "بڕی ناوەوەی" },
  "a count": { ar: "جردًا", ckb: "ژماردنێک" },
  Count: { ar: "جرد", ckb: "ژماردن" },
  "Enter what you counted": { ar: "أدخل ما عددته", ckb: "ئەوەی ژماردووتە بینووسە" },

  // What the purchasing actions answer (src/lib/actions/purchasing.ts).
  "the supplier": { ar: "المورّد", ckb: "دابینکەرەکە" },
  "Days a delivery takes: a whole number": {
    ar: "أيام وصول الشحنة: عدد صحيح",
    ckb: "ڕۆژەکانی گەیاندن: ژمارەیەکی تەواو",
  },
  "A delivery takes 0 to 30 days": {
    ar: "تستغرق الشحنة من 0 إلى 30 يومًا",
    ckb: "گەیاندن لە 0 تا 30 ڕۆژ دەخایەنێت",
  },
  Freight: { ar: "الشحن", ckb: "کرێی گواستنەوە" },
  "Other costs": { ar: "مبلغ التكاليف الأخرى", ckb: "تێچووەکانی تر" },
  Rebate: { ar: "خصم المورّد", ckb: "داشکاندنی دابینکەر" },
  "Add at least one line": {
    ar: "أضف سطرًا واحدًا على الأقل",
    ckb: "لانیکەم یەک هێڵ زیاد بکە",
  },
  "Choose a unit": { ar: "اختر وحدة", ckb: "یەکەیەک هەڵبژێرە" },
  "Price per unit": { ar: "السعر لكل وحدة", ckb: "نرخ بۆ هەر یەکەیەک" },
  "the vendor": { ar: "المورّد", ckb: "دابینکەرەکە" },
  "The invoice date": { ar: "تاريخ الفاتورة", ckb: "بەرواری پسووڵەکە" },
  "The amount": { ar: "المبلغ", ckb: "بڕی پارە" },
  "A bill is either for a goods receipt or for an expense account — choose one": {
    ar: "الفاتورة إما لإيصال استلام بضاعة أو لحساب مصروفات — اختر أحدهما",
    ckb: "پسووڵە یان بۆ وەسڵی وەرگرتنی کاڵایە یان بۆ هەژماری خەرجی — یەکێکیان هەڵبژێرە",
  },
  "a bill": { ar: "فاتورة", ckb: "پسووڵەیەک" },
  "The date": { ar: "التاريخ", ckb: "بەروار" },

  // A delivery corrected or reversed on Purchasing (0038).
  "the quantity": { ar: "الكمية", ckb: "بڕەکە" },
  "the price": { ar: "السعر", ckb: "نرخەکە" },
  "the item": { ar: "المادة", ckb: "کاڵاکە" },
  "the date": { ar: "التاريخ", ckb: "بەروارەکە" },
  reversed: { ar: "معكوس", ckb: "هەڵگەڕێندراوەتەوە" },
  "A delivery entered wrong is corrected here until it is billed: its quantities, prices, items, supplier or date, or all of it reversed. What was entered first is kept, and each correction is a document of its own, with its journal.":
    {
      ar: "التوريد المُدخل خطأً يُصحَّح هنا ما دامت فاتورته لم تُسجَّل: كمياته أو أسعاره أو مواده أو مورّده أو تاريخه، أو يُعكس كله. يبقى ما أُدخل أولًا محفوظًا، وكل تصحيح مستند قائم بذاته، له قيده.",
      ckb: "بارێک کە بە هەڵە تۆمار کرابێت لێرە ڕاست دەکرێتەوە تا پسووڵەکەی تۆمار نەکرابێت: بڕەکان، نرخەکان، کاڵاکان، دابینکەر یان بەروارەکەی، یان هەمووی هەڵدەگەڕێندرێتەوە. ئەوەی سەرەتا تۆمار کرابوو دەمێنێتەوە، و هەر ڕاستکردنەوەیەک بەڵگەیەکی سەربەخۆیە، لەگەڵ تۆمارەکەی.",
    },
  "Entered {when}": { ar: "أُدخل {when}", ckb: "تۆمار کرا {when}" },
  Reversed: { ar: "معكوس", ckb: "هەڵگەڕێندراوە" },
  "Correction {no}": { ar: "التصحيح {no}", ckb: "ڕاستکردنەوەی {no}" },
  "stock {stock}, owed for it {grni}, price variance {variance} (journal {journal})": {
    ar: "المخزون {stock}، المستحق عنه {grni}، فرق السعر {variance} (القيد {journal})",
    ckb: "کۆگا {stock}، قەرزی ئەوە {grni}، جیاوازی نرخ {variance} (تۆماری {journal})",
  },
  "nothing to post": { ar: "لا شيء للترحيل", ckb: "هیچ شتێک بۆ تۆمارکردن نییە" },
  Correct: { ar: "صحّح", ckb: "ڕاستکردنەوە" },
  "{items} counted after this delivery, and the count set its stock: correct only its price": {
    ar: "جُرد {items} بعد هذا التوريد، والجرد حدّد مخزونه: صحّح سعره فقط",
    ckb: "{items} دوای ئەم بارە ژمێردراوە، و ژماردنەکە کۆگاکەی دیاری کرد: تەنها نرخەکەی ڕاست بکەرەوە",
  },
  "Reverse the delivery": { ar: "اعكس التوريد", ckb: "بارەکە هەڵبگەڕێنەوە" },
  "Correct the delivery": { ar: "صحّح التوريد", ckb: "بارەکە ڕاست بکەرەوە" },
  "Reverse delivery {no}": { ar: "عكس التوريد {no}", ckb: "هەڵگەڕاندنەوەی باری {no}" },
  "Correct delivery {no}": { ar: "تصحيح التوريد {no}", ckb: "ڕاستکردنەوەی باری {no}" },
  "Delivery {receipt} reversed (correction {no}).": {
    ar: "عُكس التوريد {receipt} (التصحيح {no}).",
    ckb: "باری {receipt} هەڵگەڕێندرایەوە (ڕاستکردنەوەی {no}).",
  },
  "Correction {no} of delivery {receipt}: {what}.": {
    ar: "التصحيح {no} للتوريد {receipt}: {what}.",
    ckb: "ڕاستکردنەوەی {no} بۆ باری {receipt}: {what}.",
  },
  "Stock {stock}, owed for it {grni}, price variance {variance} (journal {journal}).": {
    ar: "المخزون {stock}، المستحق عنه {grni}، فرق السعر {variance} (القيد {journal}).",
    ckb: "کۆگا {stock}، قەرزی ئەوە {grni}، جیاوازی نرخ {variance} (تۆماری {journal}).",
  },
  "Nothing to post.": { ar: "لا شيء للترحيل.", ckb: "هیچ شتێک بۆ تۆمارکردن نییە." },
  "Change what is wrong, as the invoice has it. A line left out is taken off. What was entered first is kept, and the correction is on the audit trail.":
    {
      ar: "غيّر ما هو خطأ كما تذكره الفاتورة. السطر المتروك يُحذف. يبقى ما أُدخل أولًا محفوظًا، والتصحيح مسجّل في سجل التدقيق.",
      ckb: "ئەوەی هەڵەیە بیگۆڕە، وەک لە پسووڵەکەدایە. هێڵێک کە لابرابێت دەسڕدرێتەوە. ئەوەی سەرەتا تۆمار کرابوو دەمێنێتەوە، و ڕاستکردنەوەکە لە تۆماری گۆڕانکارییەکاندایە.",
    },
  "The day it came": { ar: "يوم وصوله", ckb: "ئەو ڕۆژەی گەیشت" },
  "Quantity of {item}": { ar: "كمية {item}", ckb: "بڕی {item}" },
  "Price of {item}": { ar: "سعر {item}", ckb: "نرخی {item}" },
  "Take the line off": { ar: "احذف السطر", ckb: "هێڵەکە لابە" },
  "For a delivery that should never have been entered: its stock goes out and nothing is owed for it. What was entered is kept, marked reversed.":
    {
      ar: "لتوريد ما كان ينبغي إدخاله أصلًا: يخرج مخزونه ولا يُستحق عنه شيء. يبقى ما أُدخل محفوظًا، مُعلَّمًا بأنه معكوس.",
      ckb: "بۆ بارێک کە هەرگیز نەدەبوو تۆمار بکرێت: کۆگاکەی دەردەچێت و هیچ قەرزێکی لەسەر نامێنێت. ئەوەی تۆمار کرابوو دەمێنێتەوە، وەک هەڵگەڕێندراوە نیشانە دەکرێت.",
    },
  "On the delivery": { ar: "في التوريد", ckb: "لەسەر بارەکە" },
  "In stock": { ar: "في المخزون", ckb: "لە کۆگادا" },
  "Stock value": { ar: "قيمة المخزون", ckb: "بەهای کۆگا" },
  "Owed for it (2050)": { ar: "المستحق عنه (2050)", ckb: "قەرزی ئەوە (2050)" },
  "Price variance (5050)": { ar: "فرق السعر (5050)", ckb: "جیاوازی نرخ (5050)" },
  "Stock {stock} · owed for it {grni} · price variance {variance}": {
    ar: "المخزون {stock} · المستحق عنه {grni} · فرق السعر {variance}",
    ckb: "کۆگا {stock} · قەرزی ئەوە {grni} · جیاوازی نرخ {variance}",
  },
  "Part of its stock has been used already, at the price it came in at: that part of the difference goes to purchase price variance (5050).":
    {
      ar: "استُخدم جزء من مخزونه بالسعر الذي دخل به: وذلك الجزء من الفرق يذهب إلى فرق أسعار الشراء (5050).",
      ckb: "بەشێک لە کۆگاکەی پێشتر بەکارهاتووە، بەو نرخەی پێی هاتبوو: ئەو بەشەی جیاوازییەکە دەچێتە سەر جیاوازی نرخی کڕین (5050).",
    },
  "This leaves {items} below zero: correct it all the same": {
    ar: "هذا يترك {items} دون الصفر: صحّحه مع ذلك",
    ckb: "ئەمە {items} دەباتە ژێر سفر: هەر ڕاستی بکەرەوە",
  },
  "Why it is corrected": { ar: "سبب التصحيح", ckb: "هۆی ڕاستکردنەوە" },
  "Why it is reversed": { ar: "سبب العكس", ckb: "هۆی هەڵگەڕاندنەوە" },
  "Why it is reversed, in a few words": {
    ar: "سبب العكس، في كلمات قليلة",
    ckb: "هۆی هەڵگەڕاندنەوە، بە چەند وشەیەک",
  },
  "Why it is corrected, in a few words": {
    ar: "سبب التصحيح، في كلمات قليلة",
    ckb: "هۆی ڕاستکردنەوە، بە چەند وشەیەک",
  },
  "Show what it would do": { ar: "اعرض ما سيفعله", ckb: "پیشانی بدە چی دەکات" },
  "Confirm the correction": { ar: "أكّد التصحيح", ckb: "ڕاستکردنەوەکە پشتڕاست بکەرەوە" },
  "Revalued: a delivery's price corrected": {
    ar: "أُعيد تقييمه: صُحّح سعر توريد",
    ckb: "دووبارە نرخێندرا: نرخی بارێک ڕاست کرایەوە",
  },
  "a delivery": { ar: "توريدًا", ckb: "بارێک" },
  "The date it came": { ar: "تاريخ وصوله", ckb: "بەرواری گەیشتنی" },
  "Delivery reversed": { ar: "عكس توريد", ckb: "هەڵگەڕاندنەوەی بار" },
  "What was corrected": { ar: "ما صُحّح", ckb: "ئەوەی ڕاست کرایەوە" },
  "Stock value changed by": { ar: "تغيّرت قيمة المخزون بمقدار", ckb: "بەهای کۆگا گۆڕا بە" },
  "Owed for it (2050) changed by": {
    ar: "تغيّر المستحق عنه (2050) بمقدار",
    ckb: "قەرزی ئەوە (2050) گۆڕا بە",
  },

  // Usage against the recipes, between two counts (0039).
  "<usage>Usage</usage> sets what each item used between two counts against what its recipes say.":
    {
      ar: "<usage>الاستهلاك</usage> يقارن ما استهلكته كل مادة بين جردين بما تقوله وصفاتها.",
      ckb: "<usage>بەکارهێنان</usage> ئەوەی هەر کاڵایەک لە نێوان دوو ژماردندا بەکارهاتووە بەراورد دەکات لەگەڵ ئەوەی ڕەچەتەکانی دەڵێن.",
    },
  "{from} to {to} · between each item's counts": {
    ar: "من {from} إلى {to} · بين جردَي كل مادة",
    ckb: "لە {from} تا {to} · لە نێوان ژماردنەکانی هەر کاڵایەک",
  },
  "Between two approved counts of an item: what came in, what the recipes of what was sold and made say was used, and what was recorded as lost. <b>Used</b> is what the counts say went, less the losses recorded; the <b>difference</b> is what no recipe and no recorded loss explains. More used than the recipes is stock gone: bigger portions, waste not recorded, sales not rung up. Less is a smaller portion, or a delivery that was never entered. Count again on <count>Stock Count</count> to see the next stretch.":
    {
      ar: "بين جردين معتمدين لمادة: ما دخل، وما تقول وصفات ما بيع وصُنع إنه استُهلك، وما سُجّل هدرًا. <b>المستهلَك</b> هو ما يقول الجردان إنه خرج، مطروحًا منه الهدر المسجّل؛ و<b>الفرق</b> هو ما لا تفسّره وصفة ولا هدر مسجّل. استهلاك أكثر من الوصفات مخزون ضائع: حصص أكبر، أو هدر غير مسجّل، أو مبيعات لم تُسجَّل. والأقل حصة أصغر، أو توريد لم يُدخل قط. أعد الجرد من <count>جرد المخزون</count> لترى المدة التالية.",
      ckb: "لە نێوان دوو ژماردنی پەسەندکراوی کاڵایەکدا: ئەوەی هاتە ژوورەوە، ئەوەی ڕەچەتەی ئەوەی فرۆشرا و دروستکرا دەڵێن بەکارهاتووە، و ئەوەی وەک بەفیڕۆچوون تۆمار کرا. <b>بەکارهاتوو</b> ئەوەیە کە ژماردنەکان دەڵێن ڕۆیشتووە، بە لابردنی بەفیڕۆچوونی تۆمارکراو؛ <b>جیاوازی</b> ئەوەیە کە هیچ ڕەچەتە و هیچ بەفیڕۆچوونێکی تۆمارکراو ڕوونی ناکاتەوە. زیاتر لە ڕەچەتەکان بەکارهاتن کۆگای ونبووە: بەشی گەورەتر، بەفیڕۆچوونی تۆمارنەکراو، یان فرۆشتنی تۆمارنەکراو. کەمتر بەشی بچووکترە، یان بارێکە کە هەرگیز تۆمار نەکرا. لە <count>ژماردنی کۆگا</count> دووبارە بژمێرە بۆ بینینی ماوەی دواتر.",
    },
  "No item was counted twice in these dates": {
    ar: "لم تُجرد أي مادة مرتين في هذه التواريخ",
    ckb: "هیچ کاڵایەک لەم بەروارانەدا دوو جار نەژمێردراوە",
  },
  "Usage is worked out between two approved counts of an item. Count again, or choose wider dates.":
    {
      ar: "يُحسب الاستهلاك بين جردين معتمدين لمادة. أعد الجرد، أو اختر تواريخ أوسع.",
      ckb: "بەکارهێنان لە نێوان دوو ژماردنی پەسەندکراوی کاڵایەکدا هەژمار دەکرێت. دووبارە بژمێرە، یان بەرواری فراوانتر هەڵبژێرە.",
    },
  "Usage against the recipes": {
    ar: "الاستهلاك مقابل الوصفات",
    ckb: "بەکارهێنان بەرامبەر ڕەچەتەکان",
  },
  "Stock gone that nothing explains: {over} · less used than the recipes: {under}": {
    ar: "مخزون خرج دون تفسير: {over} · استهلاك أقل من الوصفات: {under}",
    ckb: "کۆگای ڕۆیشتوو کە هیچ شتێک ڕوونی ناکاتەوە: {over} · بەکارهێنانی کەمتر لە ڕەچەتەکان: {under}",
  },
  "Between the counts": { ar: "بين الجردين", ckb: "لە نێوان ژماردنەکاندا" },
  "First count": { ar: "الجرد الأول", ckb: "یەکەم ژماردن" },
  "Came in": { ar: "ما دخل", ckb: "هاتە ژوورەوە" },
  "Last count": { ar: "الجرد الأخير", ckb: "دوایین ژماردن" },
  Lost: { ar: "الهدر", ckb: "بەفیڕۆچوو" },
  Used: { ar: "المستهلَك", ckb: "بەکارهاتوو" },
  "The recipes say": { ar: "ما تقوله الوصفات", ckb: "ڕەچەتەکان دەڵێن" },
  "What it is made of": { ar: "مما يتكوّن", ckb: "لە چی پێکهاتووە" },
  "Came in: received {received}, made {made}, moved {moved}, opening stock {opening}, corrected by hand {corrected}":
    {
      ar: "ما دخل: مستلم {received}، مصنوع {made}، منقول {moved}، مخزون افتتاحي {opening}، مصحَّح يدويًا {corrected}",
      ckb: "هاتە ژوورەوە: وەرگیراو {received}، دروستکراو {made}، گوازراوە {moved}، کۆگای سەرەتا {opening}، بە دەست ڕاستکراوە {corrected}",
    },
  "The recipes: sold {sold}, in batches {batches}": {
    ar: "الوصفات: مبيع {sold}، في دفعات إنتاج {batches}",
    ckb: "ڕەچەتەکان: فرۆشراو {sold}، لە دەستەکانی بەرهەمهێناندا {batches}",
  },
  "Lost: {losses}": { ar: "الهدر: {losses}", ckb: "بەفیڕۆچوو: {losses}" },
  "{name}: {sold} sold, using {used}": {
    ar: "{name}: بيع {sold}، استهلك {used}",
    ckb: "{name}: {sold} فرۆشرا، {used} بەکارهات",
  },
  "{name}: {batches} batch(es), using {used}": {
    ar: "{name}: {batches} دفعة، استهلكت {used}",
    ckb: "{name}: {batches} دەستە، {used} بەکارهات",
  },
  "Counted once in these dates": {
    ar: "جُردت مرة واحدة في هذه التواريخ",
    ckb: "لەم بەروارانەدا یەک جار ژمێردراون",
  },
  "A second count gives what they used": {
    ar: "جرد ثانٍ يبيّن ما استهلكته",
    ckb: "ژماردنێکی دووەم ئەوە دەردەخات کە بەکارهاتووە",
  },
  "Last 90 days": { ar: "آخر 90 يومًا", ckb: "دوایین 90 ڕۆژ" },

  // Losses added up, approved or waiting, and reversed (0040).
  "a loss": { ar: "خسارة", ckb: "زیانێک" },
  "Saved. It waits for a manager's approval, under Needs you.": {
    ar: "حُفظت. تنتظر موافقة مدير، تحت «يحتاج إليك».",
    ckb: "پاشەکەوت کرا. لە ژێر «پێویستی بە تۆیە» چاوەڕێی ڕەزامەندی بەڕێوەبەرێکە.",
  },
  "Recorded, approved by {name} — {value} written off (journal {journal}).": {
    ar: "سُجّلت بموافقة {name} — شُطب {value} (القيد {journal}).",
    ckb: "تۆمارکرا بە ڕەزامەندیی {name} — {value} سڕایەوە (تۆماری {journal}).",
  },
  "Taken out at average cost: Dr 5300 Waste / Cr 1200 Inventory.": {
    ar: "تُخرج بمتوسط التكلفة: مدين 5300 الهدر / دائن 1200 المخزون.",
    ckb: "بە تێچووی ناوەند دەردەهێنرێت: قەرزار 5300 بەفیڕۆچوون / بەستانکار 1200 کۆگا.",
  },
  "A loss over {limit} needs a manager's approval.": {
    ar: "تحتاج الخسارة التي تتجاوز {limit} إلى موافقة مدير.",
    ckb: "زیانێک لە سەرووی {limit} پێویستی بە ڕەزامەندی بەڕێوەبەرێک هەیە.",
  },
  "A loss over {limit}, or that takes your losses today or the item's over it, needs a manager's approval.":
    {
      ar: "تحتاج إلى موافقة مدير الخسارةُ التي تتجاوز {limit}، أو التي تجعل خسائرك اليوم أو خسائر المادة تتجاوزه.",
      ckb: "زیانێک لە سەرووی {limit}، یان زیانێک کە زیانەکانی ئەمڕۆت یان هی کاڵاکە لەوە تێدەپەڕێنێت، پێویستی بە ڕەزامەندی بەڕێوەبەرێک هەیە.",
    },
  "A loss over {limit}, or that takes your losses this session (or today) or the item's today over it, needs a manager's approval.":
    {
      ar: "تحتاج إلى موافقة مدير الخسارةُ التي تتجاوز {limit}، أو التي تجعل خسائرك في هذه الجلسة (أو اليوم) أو خسائر المادة اليوم تتجاوزه.",
      ckb: "زیانێک لە سەرووی {limit}، یان زیانێک کە زیانەکانی ئەم شیفتەت (یان ئەمڕۆت) یان هی ئەمڕۆی کاڵاکە لەوە تێدەپەڕێنێت، پێویستی بە ڕەزامەندی بەڕێوەبەرێک هەیە.",
    },
  "A manager approves it now, with their PIN:": {
    ar: "يوافق عليها مدير الآن، برمز PIN الخاص به:",
    ckb: "بەڕێوەبەرێک ئێستا بە PIN ی خۆی ڕەزامەندی لەسەر دەدات:",
  },
  "A manager approves using more than the books hold, with their PIN:": {
    ar: "يوافق مدير، برمز PIN الخاص به، على استخدام أكثر مما تحتفظ به الدفاتر:",
    ckb: "بەڕێوەبەرێک بە PIN ی خۆی ڕەزامەندی لەسەر بەکارهێنانی زیاتر لەوەی لە دەفتەرەکاندایە دەدات:",
  },
  "Save it to wait for a manager's approval": {
    ar: "احفظها لتنتظر موافقة مدير",
    ckb: "پاشەکەوتی بکە بۆ ئەوەی چاوەڕێی ڕەزامەندی بەڕێوەبەرێک بکات",
  },
  "Approve each, or reverse one that did not happen": {
    ar: "وافق على كل واحدة، أو اعكس ما لم يحدث",
    ckb: "ڕەزامەندی لەسەر هەر یەکێک بدە، یان ئەوەی ڕووی نەداوە هەڵیبگەڕێنەوە",
  },
  "Recorded by": { ar: "سجّلها", ckb: "تۆمارکراوە لەلایەن" },
  Approve: { ar: "موافقة", ckb: "ڕەزامەندی" },
  "Reverse…": { ar: "عكس…", ckb: "هەڵگەڕاندنەوە…" },
  "Why is it reversed? (required)": {
    ar: "لماذا تُعكس؟ (مطلوب)",
    ckb: "بۆچی هەڵدەگەڕێندرێتەوە؟ (پێویستە)",
  },
  "Reverse the loss: the stock goes back": {
    ar: "اعكس الخسارة: يعود المخزون",
    ckb: "زیانەکە هەڵبگەڕێنەوە: کۆگاکە دەگەڕێتەوە",
  },
  "Loss approved": { ar: "وُوفق على خسارة", ckb: "ڕەزامەندی لەسەر زیانێک درا" },
  "Loss reversed": { ar: "عُكست خسارة", ckb: "زیانێک هەڵگەڕێندرایەوە" },
  "Stock used beyond the books, approved": {
    ar: "استُخدم مخزون يتجاوز الدفاتر، بموافقة",
    ckb: "کۆگای زیاتر لە دەفتەرەکان بەکارهات، بە ڕەزامەندی",
  },

  // Purchase orders, receiving against one, returns to a supplier and the
  // suppliers' credit notes (0044).
  "Purchase orders": { ar: "طلبيات الشراء", ckb: "داواکارییەکانی کڕین" },
  "New order": { ar: "طلبية جديدة", ckb: "داواکاری نوێ" },
  "A new order": { ar: "طلبية جديدة", ckb: "داواکارییەکی نوێ" },
  "No purchase orders yet.": {
    ar: "لا توجد طلبيات شراء بعد.",
    ckb: "هێشتا هیچ داواکارییەکی کڕین نییە.",
  },
  "An order is drafted, then approved by a manager whose limit covers its total, sent to the supplier, and received against below. It closes when all has come, or with a reason when the rest is not coming.":
    {
      ar: "تُكتب الطلبية مسودةً، ثم يعتمدها مدير يغطي حدُّه مجموعَها، وتُرسَل إلى المورّد، ويُستلَم مقابلها في الأسفل. وتُغلَق حين يصل كل ما فيها، أو بسببٍ يُذكر حين لا يأتي الباقي.",
      ckb: "داواکارییەک وەک ڕەشنووس دەنووسرێت، پاشان بەڕێوەبەرێک پەسەندی دەکات کە سنوورەکەی کۆی گشتییەکەی بگرێتەوە، بۆ دابینکەر دەنێردرێت، و لە خوارەوە بەرامبەری وەردەگیرێت. کاتێک هەمووی گەیشت دادەخرێت، یان بە هۆکارێک کاتێک ئەوەی ماوە نایەت.",
    },
  "An order is drafted, then approved by a manager whose limit covers its total — yours is {limit} — sent to the supplier, and received against below. It closes when all has come, or with a reason when the rest is not coming.":
    {
      ar: "تُكتب الطلبية مسودةً، ثم يعتمدها مدير يغطي حدُّه مجموعَها — وحدّك {limit} — وتُرسَل إلى المورّد، ويُستلَم مقابلها في الأسفل. وتُغلَق حين يصل كل ما فيها، أو بسببٍ يُذكر حين لا يأتي الباقي.",
      ckb: "داواکارییەک وەک ڕەشنووس دەنووسرێت، پاشان بەڕێوەبەرێک پەسەندی دەکات کە سنوورەکەی کۆی گشتییەکەی بگرێتەوە — سنووری تۆ: {limit} — بۆ دابینکەر دەنێردرێت، و لە خوارەوە بەرامبەری وەردەگیرێت. کاتێک هەمووی گەیشت دادەخرێت، یان بە هۆکارێک کاتێک ئەوەی ماوە نایەت.",
    },
  Stage: { ar: "المرحلة", ckb: "قۆناغ" },
  "What has come": { ar: "ما وصل", ckb: "ئەوەی گەیشتووە" },
  "Mark as sent": { ar: "علّمها مُرسَلة", ckb: "وەک نێردراو نیشانەی بکە" },
  "Over your limit: the owner or the general manager approves it": {
    ar: "فوق حدّك: يعتمدها المالك أو المدير العام",
    ckb: "سەرووی سنووری تۆیە: خاوەن یان بەڕێوەبەری گشتی پەسەندی دەکات",
  },
  "Order {no} approved.": { ar: "اعتُمدت الطلبية {no}.", ckb: "داواکاری {no} پەسەند کرا." },
  "Order {no} marked as sent to the supplier.": {
    ar: "عُلّمت الطلبية {no} مُرسَلةً إلى المورّد.",
    ckb: "داواکاری {no} وەک نێردراو بۆ دابینکەر نیشانە کرا.",
  },
  "Order {no} cancelled.": { ar: "أُلغيت الطلبية {no}.", ckb: "داواکاری {no} هەڵوەشێنرایەوە." },
  "Order {no} closed.": { ar: "أُغلقت الطلبية {no}.", ckb: "داواکاری {no} داخرا." },
  "Why cancel it?": { ar: "لماذا تُلغى؟", ckb: "بۆچی هەڵدەوەشێنرێتەوە؟" },
  "Why is the rest not coming?": { ar: "لماذا لن يأتي الباقي؟", ckb: "بۆچی ئەوەی ماوە نایەت؟" },
  "Cancel the order": { ar: "ألغِ الطلبية", ckb: "داواکارییەکە هەڵبوەشێنەوە" },
  "Close the order": { ar: "أغلق الطلبية", ckb: "داواکارییەکە دابخە" },
  "Order {no} saved as a draft: {total}. A manager approves it next.": {
    ar: "حُفظت الطلبية {no} مسودةً: {total}. ويعتمدها مدير بعد ذلك.",
    ckb: "داواکاری {no} وەک ڕەشنووس پاشەکەوت کرا: {total}. دواتر بەڕێوەبەرێک پەسەندی دەکات.",
  },
  "Order {no}: changed, it is a draft again and is approved again": {
    ar: "الطلبية {no}: إن غُيّرت عادت مسودةً وتُعتمد من جديد",
    ckb: "داواکاری {no}: ئەگەر بگۆڕدرێت دەبێتەوە ڕەشنووس و دووبارە پەسەند دەکرێتەوە",
  },
  "Order {no}": { ar: "الطلبية {no}", ckb: "داواکاری {no}" },
  "Note for the supplier": { ar: "ملاحظة للمورّد", ckb: "تێبینی بۆ دابینکەر" },
  "Remove the line": { ar: "احذف السطر", ckb: "هێڵەکە لابە" },
  "Add a line": { ar: "أضف سطرًا", ckb: "هێڵێک زیاد بکە" },
  "Save the draft": { ar: "احفظ المسودة", ckb: "ڕەشنووسەکە پاشەکەوت بکە" },
  "Purchase order {no}": { ar: "طلبية الشراء {no}", ckb: "داواکاری کڕینی {no}" },
  "Ordered on {day}": { ar: "طُلبت في {day}", ckb: "لە {day} داوا کرا" },
  "Expected by {day}": { ar: "متوقَّعة بحلول {day}", ckb: "چاوەڕوان دەکرێت تا {day}" },
  "Deliver to {place}": { ar: "التسليم إلى {place}", ckb: "گەیاندن بۆ {place}" },
  "Approved by {name} on {day}": {
    ar: "اعتمدها {name} في {day}",
    ckb: "{name} لە {day} پەسەندی کرد",
  },
  "Print the order": { ar: "اطبع الطلبية", ckb: "داواکارییەکە چاپ بکە" },
  "Back to Purchasing": { ar: "العودة إلى المشتريات", ckb: "گەڕانەوە بۆ کڕین" },
  "A draft is printed once a manager has approved it.": {
    ar: "تُطبع المسودة بعد أن يعتمدها مدير.",
    ckb: "ڕەشنووسەکە دوای ئەوەی بەڕێوەبەرێک پەسەندی کرد چاپ دەکرێت.",
  },
  "Drafted by {name}, {when}": {
    ar: "كتب مسودتها {name}، {when}",
    ckb: "{name} ڕەشنووسەکەی نووسی، {when}",
  },
  "Sent {when} by {name}": {
    ar: "أُرسلت {when} بواسطة {name}",
    ckb: "{when} لەلایەن {name} نێردرا",
  },
  "Closed {when} by {name}": {
    ar: "أُغلقت {when} بواسطة {name}",
    ckb: "{when} لەلایەن {name} داخرا",
  },
  "Cancelled {when} by {name}": {
    ar: "أُلغيت {when} بواسطة {name}",
    ckb: "{when} لەلایەن {name} هەڵوەشێنرایەوە",
  },
  Ordered: { ar: "المطلوب", ckb: "داواکراو" },
  Come: { ar: "الواصل", ckb: "گەیشتوو" },
  "Still to come": { ar: "المتبقي وصوله", ckb: "ماوە بگات" },
  "Not on the order": { ar: "ليست في الطلبية", ckb: "لە داواکارییەکەدا نییە" },
  "Nothing has come against it yet.": {
    ar: "لم يصل شيء مقابلها بعد.",
    ckb: "هێشتا هیچ شتێک بەرامبەری نەگەیشتووە.",
  },
  "Deliveries against it: {list}": {
    ar: "التوريدات مقابلها: {list}",
    ckb: "بارەکانی بەرامبەری: {list}",
  },
  "Against a purchase order": { ar: "مقابل طلبية شراء", ckb: "بەرامبەر داواکارییەکی کڕین" },
  "No order": { ar: "بلا طلبية", ckb: "بێ داواکاری" },
  "Order {no}: {supplier} ({stage})": {
    ar: "الطلبية {no}: {supplier} ({stage})",
    ckb: "داواکاری {no}: {supplier} ({stage})",
  },
  "It is right: receive it": { ar: "إنه صحيح: استلمه", ckb: "ڕاستە: وەریبگرە" },
  "Receipt {no} — {value} into stock against order {po}, awaiting its bill.": {
    ar: "الإيصال {no} — دخل المخزون {value} مقابل الطلبية {po}، بانتظار فاتورته.",
    ckb: "وەسڵی {no} — {value} بەرامبەر داواکاری {po} چووە ناو کۆگا، چاوەڕێی پسووڵەکەیەتی.",
  },
  "As ordered: {qty} {unit} still to come": {
    ar: "كما طُلب: يُنتظر بعدُ {qty} {unit}",
    ckb: "وەک داواکراوە: {qty} {unit} هێشتا ماوە بگات",
  },
  "More than is still on order: {coming} of {ordered} {unit}": {
    ar: "أكثر مما بقي في الطلبية: {coming} من {ordered} {unit}",
    ckb: "زیاتر لەوەی لە داواکارییەکەدا ماوە: {coming} لە {ordered} {unit}",
  },
  "{ordered} {unit} still on order: {coming} coming now": {
    ar: "لا يزال {ordered} {unit} في الطلبية: يصل الآن {coming}",
    ckb: "{ordered} {unit} هێشتا لە داواکارییەکەدا ماوە: ئێستا {coming} دێت",
  },
  "The order's price: {price}": { ar: "سعر الطلبية: {price}", ckb: "نرخی داواکارییەکە: {price}" },
  "More is coming than is still on the order. If the supplier sent it and it is being kept, receive it as it is: your confirmation goes on the audit trail.":
    {
      ar: "الوارد أكثر مما بقي في الطلبية. إن كان المورّد قد أرسله وسيُحتفظ به، فاستلمه كما هو: ويُسجَّل تأكيدك في سجل التدقيق.",
      ckb: "ئەوەی دێت زیاترە لەوەی لە داواکارییەکەدا ماوە. ئەگەر دابینکەر ناردوویەتی و هەڵدەگیرێت، وەک خۆی وەریبگرە: پشتڕاستکردنەوەکەت لە تۆماری گۆڕانکارییەکاندا دەنووسرێت.",
    },
  "Return goods to a supplier": {
    ar: "إرجاع بضاعة إلى مورّد",
    ckb: "گەڕاندنەوەی کاڵا بۆ دابینکەرێک",
  },
  "Named against the delivery they came in, the supplier owes back what it charged for them: before its bill, the bill is for what was kept; after it, a credit on their account is set against the bill. The stock leaves at what it costs now.":
    {
      ar: "إذا ذُكر التوريد الذي جاءت فيه، ردّ المورّد ما تقاضاه عنها: قبل فاتورته تكون الفاتورة لما احتُفظ به؛ وبعدها يُخصم من الفاتورة إشعارٌ دائن على حسابه. ويخرج المخزون بكلفته الحالية.",
      ckb: "ئەگەر ئەو بارەی تێیدا هاتوون دیاری بکرێت، دابینکەر ئەوەی بۆیانی وەرگرتووە دەیگەڕێنێتەوە: پێش پسووڵەکەی، پسووڵەکە بۆ ئەوەیە کە هەڵگیراوە؛ دوای ئەوە، پسووڵەیەکی گەڕاندنەوە لەسەر هەژمارەکەیان لە پسووڵەکە دەبڕدرێت. کۆگاکە بە تێچووی ئێستای دەردەچێت.",
    },
  "The delivery they came in": { ar: "التوريد الذي جاءت فيه", ckb: "ئەو بارەی تێیدا هاتوون" },
  "Not named: at what they cost now": {
    ar: "غير محدَّد: بكلفتها الحالية",
    ckb: "دیاری نەکراو: بە تێچووی ئێستایان",
  },
  "Delivery {no} ({day}), {billed}": {
    ar: "التوريد {no} ({day})، {billed}",
    ckb: "باری {no} ({day})، {billed}",
  },
  billed: { ar: "مفوتَر", ckb: "پسووڵەی هەیە" },
  "awaiting its bill": { ar: "بانتظار فاتورته", ckb: "چاوەڕێی پسووڵەکەیەتی" },
  "Why they are going back": { ar: "سبب إرجاعها", ckb: "هۆی گەڕاندنەوەیان" },
  "Damaged in delivery, out of date, the wrong size…": {
    ar: "تالفة عند التوريد، منتهية الصلاحية، بمقاس خاطئ…",
    ckb: "لە گەیاندندا تێکچووە، بەسەرچووە، قەبارەی هەڵە…",
  },
  "Return it all the same": { ar: "أرجعها مع ذلك", ckb: "هەر بیگەڕێنەوە" },
  "Return them": { ar: "أرجعها", ckb: "بیانگەڕێنەوە" },
  "Return {no}: {value} back to the supplier, off what the delivery's bill will clear.": {
    ar: "المرتجع {no}: {value} يعود إلى المورّد، ويُطرح مما ستصفّيه فاتورة التوريد.",
    ckb: "گەڕاندنەوەی {no}: {value} بۆ دابینکەر دەگەڕێتەوە، و لەوەی پسووڵەی بارەکە پاکی دەکاتەوە کەم دەکرێتەوە.",
  },
  "Return {no}: {value} owed back, as credit {credit} on the supplier's account.": {
    ar: "المرتجع {no}: {value} مستحق الردّ، بالإشعار الدائن {credit} على حساب المورّد.",
    ckb: "گەڕاندنەوەی {no}: {value} دەبێت بگەڕێندرێتەوە، وەک پسووڵەی گەڕاندنەوەی {credit} لەسەر هەژماری دابینکەر.",
  },
  "Return {no}: {value} owed back, as credit {credit} on the supplier's account; {set} of it set against the delivery's bill.":
    {
      ar: "المرتجع {no}: {value} مستحق الردّ، بالإشعار الدائن {credit} على حساب المورّد؛ وخُصم {set} منه من فاتورة التوريد.",
      ckb: "گەڕاندنەوەی {no}: {value} دەبێت بگەڕێندرێتەوە، وەک پسووڵەی گەڕاندنەوەی {credit} لەسەر هەژماری دابینکەر؛ بڕی {set} لە پسووڵەی بارەکە بڕدرا.",
    },
  "Recent returns to suppliers": {
    ar: "آخر المرتجعات إلى المورّدين",
    ckb: "دوایین گەڕاندنەوەکان بۆ دابینکەران",
  },
  "What went back": { ar: "ما أُرجع", ckb: "ئەوەی گەڕایەوە" },
  "Owed back": { ar: "المستحق ردّه", ckb: "ئەوەی دەگەڕێندرێتەوە" },
  How: { ar: "الطريقة", ckb: "چۆن" },
  "Off the delivery's bill": { ar: "من فاتورة التوريد", ckb: "لە پسووڵەی بارەکە" },
  "On the account": { ar: "على الحساب", ckb: "لەسەر هەژمارەکە" },
  "Credit {no} on the account": {
    ar: "الإشعار الدائن {no} على الحساب",
    ckb: "پسووڵەی گەڕاندنەوەی {no} لەسەر هەژمارەکە",
  },
  "Credit notes": { ar: "الإشعارات الدائنة", ckb: "پسووڵەکانی گەڕاندنەوە" },
  Credited: { ar: "المخصوم بإشعارات دائنة", ckb: "بڕدراو بە پسووڵەی گەڕاندنەوە" },
  "What this supplier owes back: goods returned after their bill, a lower price agreed on a delivery, or other. Each is set against their bills; what is left waits for the next one.":
    {
      ar: "ما على هذا المورّد ردّه: بضاعة أُرجعت بعد فاتورتها، أو سعر أقل اتُّفق عليه لتوريد، أو غير ذلك. يُخصم كلٌّ منها من فواتيره؛ وما يتبقّى ينتظر الفاتورة التالية.",
      ckb: "ئەوەی ئەم دابینکەرە دەبێت بیگەڕێنێتەوە: کاڵای گەڕێندراوە دوای پسووڵەکەی، نرخێکی کەمتر کە لەسەر بارێک ڕێککەوتوون، یان هی تر. هەریەکەیان لە پسووڵەکانی دەبڕدرێت؛ ئەوەی دەمێنێتەوە چاوەڕێی پسووڵەی داهاتوو دەکات.",
    },
  "No credits from this supplier.": {
    ar: "لا توجد إشعارات دائنة من هذا المورّد.",
    ckb: "هیچ پسووڵەیەکی گەڕاندنەوە لەم دابینکەرەوە نییە.",
  },
  For: { ar: "عن", ckb: "بۆ" },
  "Their note": { ar: "إشعارهم", ckb: "پسووڵەکەیان" },
  "return {no}": { ar: "المرتجع {no}", ckb: "گەڕاندنەوەی {no}" },
  "delivery {no}": { ar: "التوريد {no}", ckb: "باری {no}" },
  "Awaiting their note": { ar: "بانتظار إشعارهم", ckb: "چاوەڕێی پسووڵەکەیان" },
  "The number on their credit note": {
    ar: "الرقم على إشعارهم الدائن",
    ckb: "ژمارەی سەر پسووڵەی گەڕاندنەوەکەیان",
  },
  "Awaiting their note: its number": {
    ar: "بانتظار إشعارهم: رقمه",
    ckb: "چاوەڕێی پسووڵەکەیان: ژمارەکەی",
  },
  "Record it": { ar: "سجّله", ckb: "تۆماری بکە" },
  "Set against the bill: {left} of the credit left.": {
    ar: "خُصم من الفاتورة: وتبقّى {left} من الإشعار الدائن.",
    ckb: "لە پسووڵەکە بڕدرا: {left} لە پسووڵەی گەڕاندنەوەکە ماوە.",
  },
  "Set it against": { ar: "اخصمه من", ckb: "بیبڕە لە" },
  "Bill {no} ({owed} owed)": {
    ar: "الفاتورة {no} (المستحق {owed})",
    ckb: "پسووڵەی {no} ({owed} ماوە)",
  },
  "Set against it": { ar: "اخصمه منها", ckb: "لێی ببڕە" },
  "Credit {no} recorded; {set} of it set against the bill.": {
    ar: "سُجّل الإشعار الدائن {no}؛ وخُصم {set} منه من الفاتورة.",
    ckb: "پسووڵەی گەڕاندنەوەی {no} تۆمار کرا؛ بڕی {set} لە پسووڵەکە بڕدرا.",
  },
  "Credit {no} recorded: set it against a bill when one is owed.": {
    ar: "سُجّل الإشعار الدائن {no}: اخصمه من فاتورة حين تُستحق واحدة.",
    ckb: "پسووڵەی گەڕاندنەوەی {no} تۆمار کرا: کاتێک پسووڵەیەک قەرز بوو لێی ببڕە.",
  },
  "Record their credit note": {
    ar: "سجّل إشعارهم الدائن",
    ckb: "پسووڵەی گەڕاندنەوەکەیان تۆمار بکە",
  },
  "A lower price on a delivery that was billed": {
    ar: "سعر أقل لتوريد صدرت فاتورته",
    ckb: "نرخێکی کەمتر بۆ بارێک کە پسووڵەکەی هاتووە",
  },
  "Other: a service, an overcharge": {
    ar: "غير ذلك: خدمة، أو مبلغ زائد",
    ckb: "هی تر: خزمەتگوزارییەک، یان زیادە وەرگرتنێک",
  },
  "The delivery": { ar: "التوريد", ckb: "بارەکە" },
  "Delivery {no}": { ar: "التوريد {no}", ckb: "باری {no}" },
  "Against a bill": { ar: "مقابل فاتورة", ckb: "بەرامبەر پسووڵەیەک" },
  "None: left on the account": {
    ar: "لا شيء: يبقى على الحساب",
    ckb: "هیچ: لەسەر هەژمارەکە دەمێنێتەوە",
  },
  "Taken off the account": { ar: "يُطرح من الحساب", ckb: "لە هەژمار کەم دەکرێتەوە" },
  "The bill's own ({code})": {
    ar: "حساب الفاتورة نفسه ({code})",
    ckb: "هەژماری خودی پسووڵەکە ({code})",
  },
  "What it is for": { ar: "الغرض", ckb: "بۆ چییە" },
  "The stock of that delivery still on the shelf is revalued; what was used since goes to the price variance (5050). It is set against the delivery's bill.":
    {
      ar: "يُعاد تقييم ما بقي على الرف من مخزون ذلك التوريد؛ وما استُخدم منذئذٍ يذهب إلى فرق السعر (5050). ويُخصم من فاتورة التوريد.",
      ckb: "ئەوەی لە کۆگای ئەو بارە هێشتا لەسەر ڕەفەکەیە دووبارە نرخێندرێت؛ ئەوەی لەو کاتەوە بەکارهاتووە دەچێتە سەر جیاوازی نرخ (5050). لە پسووڵەی بارەکە دەبڕدرێت.",
    },
  "It comes off the account chosen, and is set against the bill chosen as far as it is owed.": {
    ar: "يُطرح من الحساب المختار، ويُخصم من الفاتورة المختارة بقدر ما بقي مستحقًّا عليها.",
    ckb: "لە هەژمارە هەڵبژێردراوەکە کەم دەکرێتەوە، و تا ئەو ئەندازەیەی قەرزە لە پسووڵە هەڵبژێردراوەکە دەبڕدرێت.",
  },
  "Record the credit": { ar: "سجّل الإشعار الدائن", ckb: "پسووڵەی گەڕاندنەوەکە تۆمار بکە" },
  "The day it is expected": { ar: "يوم وصولها المتوقَّع", ckb: "ئەو ڕۆژەی چاوەڕوان دەکرێت" },
  "an order": { ar: "طلبية", ckb: "داواکارییەک" },
  "The number on the supplier's credit note": {
    ar: "الرقم على إشعار المورّد الدائن",
    ckb: "ژمارەی سەر پسووڵەی گەڕاندنەوەی دابینکەر",
  },
  "a credit": { ar: "إشعارًا دائنًا", ckb: "پسووڵەیەکی گەڕاندنەوە" },
  Approved: { ar: "مُعتمَد", ckb: "پەسەندکراو" },
  Sent: { ar: "مُرسَل", ckb: "نێردراو" },
  "Partly received": { ar: "مُستلَم جزئيًا", ckb: "بەشێکی وەرگیراوە" },
  sent: { ar: "مُرسَل", ckb: "نێردراو" },
  "Goods returned": { ar: "بضاعة مُرجَعة", ckb: "کاڵای گەڕێندراوە" },
  "A lower price": { ar: "سعر أقل", ckb: "نرخێکی کەمتر" },
  Other: { ar: "غير ذلك", ckb: "هی تر" },
  // What to buy (0045): the buying list, and who an item is bought from.
  "What to buy": { ar: "ما يجب شراؤه", ckb: "چی بکڕدرێت" },
  "Open What to buy": { ar: "افتح «ما يجب شراؤه»", ckb: "«چی بکڕدرێت» بکەرەوە" },
  "{place} · {day} · use judged over the last {days} days": {
    ar: "{place} · {day} · يُحكم على الاستهلاك خلال آخر {days} يومًا",
    ckb: "{place} · {day} · بەکارهێنان بەپێی دوایین {days} ڕۆژ دەخەمڵێندرێت",
  },
  "An item is to order when what it has on hand, on order and in draft orders is below its reorder level: its own, set on the item, or its use a day over the last 28 days for the days a delivery takes, and a day more. It is ordered up to its par level, or the reorder level and a week of use, in whole packs, from its usual supplier or the one its last delivery came from. Tick what to order, change what needs changing, and create the orders: a draft for each supplier, for a manager to approve.":
    {
      ar: "تُطلب المادة حين يكون ما لديها — المتوفّر وما في الطلبيات وما في مسودات الطلبيات — دون حدّ إعادة الطلب: حدّها الخاص المحدَّد على المادة، أو استهلاكها اليومي خلال آخر 28 يومًا عن الأيام التي يستغرقها التوريد ويومًا إضافيًا. وتُطلب حتى مستواها المستهدف، أو حتى حدّ إعادة الطلب واستهلاك أسبوع، بعبوات كاملة، من مورّدها المعتاد أو من المورّد الذي جاء منه آخر توريد لها. أشِّر على ما تريد طلبه، وعدِّل ما يلزم، ثم أنشئ الطلبيات: مسودة لكل مورّد، يعتمدها مدير.",
      ckb: "کاڵایەک داوا دەکرێت کاتێک ئەوەی هەیەتی — بەردەست و ئەوەی لە داواکارییەکاندایە و ئەوەی لە ڕەشنووسی داواکارییەکاندایە — لە ئاستی داواکردنەوەکەی کەمتر بێت: ئاستی خۆی کە لەسەر کاڵاکە دانراوە، یان بەکارهێنانی ڕۆژانەی لە دوایین 28 ڕۆژدا بۆ ئەو ڕۆژانەی گەیاندنی بار دەیخایەنێت و ڕۆژێکی زیاتر. تا ئاستی ئامانجەکەی داوا دەکرێت، یان تا ئاستی داواکردنەوە و بەکارهێنانی هەفتەیەک، بە پاکەتی تەواو، لە دابینکەری هەمیشەیی خۆی یان لەو دابینکەرەی دوایین بارەکەی لێوە هات. ئەوەی دەتەوێت داوای بکەیت نیشانە بکە، ئەوەی پێویستە بیگۆڕە، و داواکارییەکان دروست بکە: ڕەشنووسێک بۆ هەر دابینکەرێک، بۆ ئەوەی بەڕێوەبەرێک پەسەندی بکات.",
    },
  "Each item's stock, use and orders, and so how much of it to order and from whom, with why: the lines chosen become a draft order for each supplier.":
    {
      ar: "مخزون كل مادة واستهلاكها وطلبياتها، ومن ثَمّ كم يُطلب منها ومن مَن، مع السبب: تصبح الأسطر المختارة مسودة طلبية لكل مورّد.",
      ckb: "کۆگا و بەکارهێنان و داواکارییەکانی هەر کاڵایەک، و بەم پێیە چەندی لێ داوا بکرێت و لە کێ، لەگەڵ هۆکارەکەی: هێڵە هەڵبژێردراوەکان دەبنە ڕەشنووسی داواکارییەک بۆ هەر دابینکەرێک.",
    },
  "1 draft order made, for a manager to approve:": {
    ar: "أُنشئت مسودة طلبية واحدة، يعتمدها مدير:",
    ckb: "ڕەشنووسی یەک داواکاری دروست کرا، بۆ ئەوەی بەڕێوەبەرێک پەسەندی بکات:",
  },
  "{n} draft orders made, for a manager to approve:": {
    ar: "أُنشئت {n} مسودات طلبيات، يعتمدها مدير:",
    ckb: "ڕەشنووسی {n} داواکاری دروست کرا، بۆ ئەوەی بەڕێوەبەرێک پەسەندیان بکات:",
  },
  "{supplier}: {n} line(s), {total}, expected {day}": {
    ar: "{supplier}: {n} سطر، {total}، متوقَّعة في {day}",
    ckb: "{supplier}: {n} هێڵ، {total}، چاوەڕوان دەکرێت لە {day}",
  },
  "Nothing to order now.": { ar: "لا شيء يُطلب الآن.", ckb: "ئێستا هیچ شتێک داوا ناکرێت." },
  "Every item has enough on hand and coming for its use. Any of them can still be added from the list below.":
    {
      ar: "لدى كل مادة ما يكفي استهلاكها من المتوفّر والقادم. ويمكن مع ذلك إضافة أيٍّ منها من القائمة أدناه.",
      ckb: "هەر کاڵایەک بەشی بەکارهێنانی خۆی لە بەردەست و ئەوەی دێت هەیە. هێشتا دەتوانرێت هەر کامێکیان لە لیستەکەی خوارەوە زیاد بکرێت.",
    },
  "No supplier yet": { ar: "لا مورّد بعد", ckb: "هێشتا دابینکەر نییە" },
  "Delivers in the café's {n} day(s)": {
    ar: "يُسلِّم خلال {n} يوم (المدة العامة للمقهى)",
    ckb: "لە {n} ڕۆژدا دەیگەیەنێت (ماوەی گشتیی کافێکە)",
  },
  "Delivers in {n} day(s)": { ar: "يُسلِّم خلال {n} يوم", ckb: "لە {n} ڕۆژدا دەیگەیەنێت" },
  "Choose a supplier for each line": {
    ar: "اختر مورّدًا لكل سطر",
    ckb: "بۆ هەر هێڵێک دابینکەرێک هەڵبژێرە",
  },
  "{n} ticked · {total}": { ar: "{n} مؤشَّر · {total}", ckb: "{n} نیشانەکراو · {total}" },
  Pack: { ar: "العبوة", ckb: "پاکەت" },
  "Price of a pack": { ar: "سعر العبوة", ckb: "نرخی پاکەتێک" },
  "Order {item}": { ar: "اطلب {item}", ckb: "{item} داوا بکە" },
  "Added by hand": { ar: "أُضيف يدويًا", ckb: "بە دەست زیاد کرا" },
  "The usual supplier": { ar: "المورّد المعتاد", ckb: "دابینکەری هەمیشەیی" },
  "Make it the usual one": { ar: "اجعله المورّد المعتاد", ckb: "بیکە بە دابینکەری هەمیشەیی" },
  "Tick what to order.": {
    ar: "أشِّر على ما تريد طلبه.",
    ckb: "ئەوەی دەتەوێت داوای بکەیت نیشانە بکە.",
  },
  "{lines} line(s) ticked: {orders} draft order(s), {total} in all.": {
    ar: "{lines} سطر مؤشَّر: {orders} مسودة طلبية، {total} إجمالًا.",
    ckb: "{lines} هێڵ نیشانە کراوە: {orders} ڕەشنووسی داواکاری، {total} بە گشتی.",
  },
  "Create the orders": { ar: "أنشئ الطلبيات", ckb: "داواکارییەکان دروست بکە" },
  "Choose a supplier for every line ticked.": {
    ar: "اختر مورّدًا لكل سطر مؤشَّر.",
    ckb: "بۆ هەر هێڵێکی نیشانەکراو دابینکەرێک هەڵبژێرە.",
  },
  "Not to order now ({n})": { ar: "لا يُطلب الآن ({n})", ckb: "ئێستا داوا ناکرێت ({n})" },
  "each with why; add any of them to an order": {
    ar: "كلٌّ مع سببه؛ أضف أيًّا منها إلى طلبية",
    ckb: "هەر یەکەیان لەگەڵ هۆکارەکەی؛ هەر کامێکیان زیاد بکە بۆ داواکارییەک",
  },
  "Every item bought is to order.": {
    ar: "كل مادة تُشترى مطلوبة الآن.",
    ckb: "هەموو ئەو کاڵایانەی دەکڕدرێن ئێستا داوا دەکرێن.",
  },
  "Add to an order": { ar: "أضِفها إلى طلبية", ckb: "زیادی بکە بۆ داواکارییەک" },
  "Bought from": { ar: "يُشترى من", ckb: "دەکڕدرێت لە" },
  "The pack each supplier sends it in and a pack's price; the usual one is suggested on What to buy":
    {
      ar: "العبوة التي يرسلها بها كل مورّد وسعر العبوة؛ ويُقترح المورّد المعتاد في «ما يجب شراؤه»",
      ckb: "ئەو پاکەتەی هەر دابینکەرێک پێی دەینێرێت و نرخی پاکەتێک؛ دابینکەری هەمیشەیی لە «چی بکڕدرێت» پێشنیار دەکرێت",
    },
  "No supplier set yet: What to buy suggests the one its last delivery came from.": {
    ar: "لم يُحدَّد مورّد بعد: تقترح «ما يجب شراؤه» المورّدَ الذي جاء منه آخر توريد.",
    ckb: "هێشتا دابینکەر دیاری نەکراوە: «چی بکڕدرێت» ئەو دابینکەرە پێشنیار دەکات کە دوایین بارەکەی لێوە هات.",
  },
  Agreed: { ar: "تاريخ الاتفاق", ckb: "بەرواری ڕێککەوتن" },
  "Removed, and on the audit trail.": {
    ar: "أُزيل، وسُجّل في سجل التدقيق.",
    ckb: "لابرا، و لە تۆماری گۆڕانکارییەکاندا نووسرا.",
  },
  "Save the supplier": { ar: "احفظ المورّد", ckb: "دابینکەرەکە پاشەکەوت بکە" },
  "as it was": { ar: "كما كان", ckb: "وەک خۆی" },
  "Never in stock here: there is no use to judge by.": {
    ar: "لم تكن في المخزون هنا قطّ: لا استهلاك يُحكم به.",
    ckb: "هەرگیز لێرە لە کۆگادا نەبووە: هیچ بەکارهێنانێک نییە بۆ خەمڵاندن.",
  },
  "Only {n} day(s) of history: 7 are needed to judge its use by.": {
    ar: "سجلّها {n} يوم فقط: يلزم 7 أيام للحكم على استهلاكها.",
    ckb: "تەنها {n} ڕۆژ مێژووی هەیە: 7 ڕۆژ پێویستە بۆ خەمڵاندنی بەکارهێنانەکەی.",
  },
  "Set a reorder level on the item, or add it to an order yourself.": {
    ar: "حدِّد حدّ إعادة الطلب على المادة، أو أضفها إلى طلبية بنفسك.",
    ckb: "ئاستی داواکردنەوە لەسەر کاڵاکە دابنێ، یان خۆت زیادی بکە بۆ داواکارییەک.",
  },
  "Not used in the last {n} days: nothing is needed.": {
    ar: "لم تُستخدم خلال آخر {n} يومًا: لا حاجة إلى شيء.",
    ckb: "لە دوایین {n} ڕۆژدا بەکارنەهاتووە: هیچ شتێک پێویست نییە.",
  },
  "{have} on hand.": { ar: "{have} متوفّر.", ckb: "{have} بەردەستە." },
  "{have} on hand, {ordered} on order and {draft} in draft orders: {all} in all.": {
    ar: "{have} متوفّر، و{ordered} في الطلبيات، و{draft} في مسودات الطلبيات: {all} إجمالًا.",
    ckb: "{have} بەردەستە، {ordered} لە داواکارییەکاندایە و {draft} لە ڕەشنووسی داواکارییەکاندا: {all} بە گشتی.",
  },
  "Below its reorder level, set on the item: {level}.": {
    ar: "دون حدّ إعادة الطلب المحدَّد على المادة: {level}.",
    ckb: "لە خوار ئاستی داواکردنەوەی سەر کاڵاکەیە: {level}.",
  },
  "At or above its reorder level, set on the item: {level}.": {
    ar: "عند حدّ إعادة الطلب المحدَّد على المادة أو فوقه: {level}.",
    ckb: "لە ئاستی داواکردنەوەی سەر کاڵاکە یان سەرووترە: {level}.",
  },
  "About {daily} a day over the last {days} days; a delivery takes {lead} day(s), and a day more: {level} is its reorder level.":
    {
      ar: "نحو {daily} يوميًا خلال آخر {days} يومًا؛ يستغرق التوريد {lead} يوم، ويومًا إضافيًا: {level} هو حدّ إعادة الطلب.",
      ckb: "نزیکەی {daily} لە ڕۆژێکدا لە دوایین {days} ڕۆژدا؛ گەیاندنی بار {lead} ڕۆژ دەخایەنێت، و ڕۆژێکی زیاتر: {level} ئاستی داواکردنەوەکەیەتی.",
    },
  "With a safety stock of {qty}.": {
    ar: "مع مخزون أمان قدره {qty}.",
    ckb: "لەگەڵ کۆگای یەدەگی {qty}.",
  },
  "Below it: to order.": { ar: "دونه: يُطلب.", ckb: "لە خوارییەوەیە: داوا دەکرێت." },
  "At or above it: nothing to order yet.": {
    ar: "عنده أو فوقه: لا شيء يُطلب بعد.",
    ckb: "لەو ئاستەیە یان سەرووترە: هێشتا هیچ داوا ناکرێت.",
  },
  "Ordered up to its par level, {target}.": {
    ar: "يُطلب حتى مستواه المستهدف، {target}.",
    ckb: "تا ئاستی ئامانجەکەی داوا دەکرێت، {target}.",
  },
  "Ordered up to the most it holds, {target}.": {
    ar: "يُطلب حتى أقصى ما يُحفظ منه، {target}.",
    ckb: "تا زۆرترین بڕی هەڵگرتنی داوا دەکرێت، {target}.",
  },
  "Ordered up to the reorder level and a week of use: {target}.": {
    ar: "يُطلب حتى حدّ إعادة الطلب واستهلاك أسبوع: {target}.",
    ckb: "تا ئاستی داواکردنەوە و بەکارهێنانی هەفتەیەک داوا دەکرێت: {target}.",
  },
  "Ordered up to its reorder level, {target}: a par level on the item orders more at once.": {
    ar: "يُطلب حتى حدّ إعادة الطلب، {target}: تحديد مستوى مستهدف على المادة يطلب أكثر في المرة الواحدة.",
    ckb: "تا ئاستی داواکردنەوەکەی داوا دەکرێت، {target}: ئاستی ئامانج لەسەر کاڵاکە لە یەک جاردا زیاتر داوا دەکات.",
  },
  "{qty} to order.": { ar: "{qty} للطلب.", ckb: "{qty} بۆ داواکردن." },
  "{packs} × {pack} ({qty}), rounded up to whole packs.": {
    ar: "{packs} × {pack} ({qty})، مقرَّبة صعودًا إلى عبوات كاملة.",
    ckb: "{packs} × {pack} ({qty})، بەرەو سەرەوە بۆ پاکەتی تەواو خڕ کراوەتەوە.",
  },
  "Its usual supplier.": { ar: "مورّدها المعتاد.", ckb: "دابینکەری هەمیشەیی خۆیەتی." },
  "The supplier of its last delivery.": {
    ar: "مورّد آخر توريد لها.",
    ckb: "دابینکەری دوایین بارەکەی.",
  },
  "The supplier it was last set with.": {
    ar: "المورّد الذي حُدِّد لها آخر مرة.",
    ckb: "ئەو دابینکەرەی دوایین جار بۆی دیاری کرا.",
  },
  "No supplier yet: choose one.": {
    ar: "لا مورّد بعد: اختر واحدًا.",
    ckb: "هێشتا دابینکەر نییە: یەکێک هەڵبژێرە.",
  },
  "{price} a pack, agreed {day}.": {
    ar: "{price} للعبوة، اتُّفق عليه في {day}.",
    ckb: "{price} بۆ پاکەتێک، لە {day} ڕێککەوتن کرا.",
  },
  "{price} a pack, as delivered {day}.": {
    ar: "{price} للعبوة، كما في توريد {day}.",
    ckb: "{price} بۆ پاکەتێک، وەک باری {day}.",
  },
  "{price} a pack, from what it costs now: check it with the supplier.": {
    ar: "{price} للعبوة، من كلفتها الحالية: تحقَّق منه مع المورّد.",
    ckb: "{price} بۆ پاکەتێک، لە تێچووی ئێستای: لەگەڵ دابینکەر پشتڕاستی بکەرەوە.",
  },
  "No price yet: enter one.": {
    ar: "لا سعر بعد: أدخِل سعرًا.",
    ckb: "هێشتا نرخ نییە: نرخێک بنووسە.",
  },
  "To order": { ar: "للطلب", ckb: "بۆ داواکردن" },
  Enough: { ar: "يكفي", ckb: "بەسە" },
  "Not enough history": { ar: "سجلّ غير كافٍ", ckb: "مێژووی پێویست نییە" },
  "Not used lately": { ar: "لم تُستخدم مؤخرًا", ckb: "لەم دواییانەدا بەکارنەهاتووە" },
  // Losses by kind, giveaways at the till, and the loss report (0048).
  "Record a loss": { ar: "تسجيل خسارة", ckb: "تۆمارکردنی زیان" },
  "Record the loss": { ar: "سجّل الخسارة", ckb: "زیانەکە تۆمار بکە" },
  "What kind of loss": { ar: "نوع الخسارة", ckb: "جۆری زیان" },
  "Charged to {code} {name}.": {
    ar: "تُحمَّل على {code} {name}.",
    ckb: "دەخرێتە سەر {code} {name}.",
  },
  "What was lost": { ar: "ما الذي فُقد", ckb: "چی لەدەستچوو" },
  "A product, as made": { ar: "منتج، كما يُحضَّر", ckb: "بەرهەمێک، وەک دروست دەکرێت" },
  "From batch": { ar: "من الدفعة", ckb: "لە دەستەی" },
  "As sales take it: the batch to be used first": {
    ar: "كما تأخذ المبيعات: الدفعة التي تُستعمل أولًا",
    ckb: "وەک فرۆشتن دەیبات: ئەو دەستەیەی پێش هەموو بەکاردێت",
  },
  "Batch {n}": { ar: "الدفعة {n}", ckb: "دەستەی {n}" },
  "How many": { ar: "كم", ckb: "چەند" },
  "What its recipe uses to eat in comes out, without add-ons.": {
    ar: "يخرج ما تستهلكه وصفته للأكل في المحل، من دون الإضافات.",
    ckb: "ئەوەی ڕەسەتەکەی بۆ خواردن لە شوێن بەکاری دەهێنێت دەردەهێنرێت، بەبێ زیادەکان.",
  },
  "Taken out at what it costs now, in one journal: Dr {code} / Cr 1200 Inventory.": {
    ar: "يُخرَج بكلفته الآن، في قيد واحد: مدين {code} / دائن 1200 المخزون.",
    ckb: "بە تێچووی ئێستای دەردەهێنرێت، لە یەک تۆماردا: قەرزار {code} / بەستانکار 1200 کۆگا.",
  },
  "Thrown away: made wrong, or not fit to sell.": {
    ar: "رُمي: صُنع خطأً، أو لا يصلح للبيع.",
    ckb: "فڕێدرا: بە هەڵە دروستکرا، یان شیاوی فرۆشتن نییە.",
  },
  "Gone off before its time: milk turned, fruit bruised.": {
    ar: "فسد قبل أوانه: حليب تخثّر، فاكهة تكدّمت.",
    ckb: "پێش کاتی خۆی خراپ بوو: شیر ترش بوو، میوە لێدرا.",
  },
  "Past its use-by: it is not to be sold.": {
    ar: "تجاوز تاريخ استعماله: لا يُباع.",
    ckb: "بەسەرچووە: نابێت بفرۆشرێت.",
  },
  "Broken, spilt or dropped.": { ar: "انكسر أو انسكب أو سقط.", ckb: "شکا، ڕژا یان کەوت." },
  "Melted in the display, or dried out.": {
    ar: "ذاب في الواجهة، أو جفّ.",
    ckb: "لە ڤیترینەکەدا توایەوە، یان وشک بوو.",
  },
  "Lost making a batch: a base spilt, a pan burnt.": {
    ar: "فُقد أثناء إعداد دفعة: قاعدة انسكبت، قِدر احترق.",
    ckb: "لە کاتی دروستکردنی دەستەیەکدا لەدەستچوو: بنەمایەک ڕژا، مەنجەڵێک سووتا.",
  },
  "Lost preparing to sell: fruit trimmed, milk left in the jug.": {
    ar: "فُقد أثناء التحضير للبيع: فاكهة قُشِّرت، حليب بقي في الإبريق.",
    ckb: "لە کاتی ئامادەکردن بۆ فرۆشتن لەدەستچوو: میوەی پاککراو، شیری ماوە لە جەگەکەدا.",
  },
  "Eaten or drunk by the staff.": {
    ar: "أكله أو شربه الموظفون.",
    ckb: "ستاف خواردی یان خواردییەوە.",
  },
  "Given to a customer free, on the house.": {
    ar: "قُدّم لزبون مجانًا، ضيافة من المحل.",
    ckb: "بە خۆڕایی درا بە کڕیارێک، میوانداری.",
  },
  "Given to taste, to sell more.": {
    ar: "قُدّم للتذوّق، لبيع المزيد.",
    ckb: "بۆ تامکردن درا، بۆ فرۆشتنی زیاتر.",
  },
};

export default phrases;
