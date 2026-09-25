import type { PhraseBook } from "./types";

/**
 * Stock: Inventory, an item's stock card, receiving and returning stock, waste, the stock count, Purchasing, and their forms and messages.
 */
const phrases: PhraseBook = {
  // Inventory: the stock board.
  "Stock on hand is <b>derived from the movement ledger</b> — there is no stock figure to edit. Every change below adds a movement, valued at the item's average cost by the database and journaled in the same step.":
    {
      ar: "المخزون المتوفّر <b>مستخرَج من سجل الحركات</b> — فلا يوجد رقم للمخزون يمكن تعديله. كل تغيير أدناه يضيف حركة تقيّمها قاعدة البيانات بمتوسط كلفة المادة وتقيّدها في الخطوة نفسها.",
      ckb: "کۆگای بەردەست <b>لە تۆماری جووڵەکانەوە دەردەهێنرێت</b> — هیچ ژمارەیەکی کۆگا نییە کە دەستکاری بکرێت. هەر گۆڕانکارییەکی خوارەوە جووڵەیەک زیاد دەکات، کە بنکەدراوەکە بە ناوەندی تێچووی کاڵاکە بەهاکەی دیاری دەکات و لە هەمان هەنگاودا تۆماری دەکات.",
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
    ckb: "بەکارهاتوو لە وەجبەکانی بەرهەمهێناندا",
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
      ckb: "هەر بە {unit} دەژمێردرێت: هەموو مێژووەکەی بەوە تۆمار کراوە. هیچ دوو کاڵایەکی بەکارهاتوو هەمان ناویان نابێت، هەرچەندە پیتی گەورە و بۆشایی و خاڵبەندییان جیاواز بێت. کاڵایەک تەنها کاتێک لە بەکارهێنان لادەبرێت کە هیچ کۆگای نەبێت و هیچ ڕەسەتە و بەرهەم و وەجبەیەک پێویستی پێی نەبێت.",
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
};

export default phrases;
