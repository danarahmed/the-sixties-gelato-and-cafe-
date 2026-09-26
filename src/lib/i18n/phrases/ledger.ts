import type { PhraseBook } from "./types";

/**
 * The words the database writes into the books itself, shown through msg():
 * the chart of accounts it sets up (an account the owner adds or renames
 * keeps the name typed), the narrations of the journals and stock records it
 * posts, the period-close checks, the reconciliation, the exceptions report,
 * and what it notes on a platform's statement. {1}, {2}… are the values it
 * puts in: names, numbers, dates, or the café's own words.
 */

// A discount on the exceptions report: "10% asked, 9.1% of 11000", then
// whether who gave it was kept, then whether the sale was later voided or refunded.
const discountDetail: PhraseBook = {};
for (const [asked, askedAr, askedCkb] of [
  ["{1}% asked, {2}% of {3}", "طُلب {1}%، أي {2}% من {3}", "{1}% داواکرا، واتە {2}%ی {3}"],
  ["{1}% of {2}", "{1}% من {2}", "{1}%ی {2}"],
] as const)
  for (const [who, whoAr, whoCkb] of [
    ["", "", ""],
    [
      ", given before who gave it was kept",
      "، أُعطي قبل أن يُحفظ اسم من أعطاه",
      "، پێش ئەوەی ناوی بەخشەرەکەی بپارێزرێت درا",
    ],
  ] as const)
    for (const [later, laterAr, laterCkb] of [
      ["", "", ""],
      [", later voided", "، ثم أُلغي", "، دواتر هەڵوەشێنرایەوە"],
      [", later refunded", "، ثم استُرد", "، دواتر پارەکەی گەڕێندرایەوە"],
    ] as const)
      discountDetail[`${asked}${who}${later}`] = {
        ar: `${askedAr}${whoAr}${laterAr}`,
        ckb: `${askedCkb}${whoCkb}${laterCkb}`,
      };

const phrases: PhraseBook = {
  // The chart of accounts the database sets up (provision_chart_of_accounts).
  "Cash in the till": { ar: "نقد درج الصندوق", ckb: "پارەی نەختینەی ناو دەخیلە" },
  "Cash in the safe": { ar: "النقد في الخزنة", ckb: "پارەی نەختینەی ناو قاسە" },
  "Platform receivable": { ar: "ذمم المنصات", ckb: "قەرزی پلاتفۆرمەکان" },
  Inventory: { ar: "المخزون", ckb: "کۆگا" },
  Equipment: { ar: "المعدات", ckb: "ئامێرەکان" },
  "Accumulated depreciation": { ar: "مجمع الاستهلاك", ckb: "داخورانی کەڵەکەبوو" },
  "Accounts payable": { ar: "الذمم الدائنة", ckb: "قەرزی دابینکەران" },
  "Goods received not invoiced": {
    ar: "بضاعة مستلمة غير مفوترة",
    ckb: "کاڵای وەرگیراوی بێ پسووڵە",
  },
  "Owner equity": { ar: "حقوق المالك", ckb: "مافی خاوەن" },
  "Retained earnings": { ar: "الأرباح المحتجزة", ckb: "قازانجی هەڵگیراو" },
  "Owner drawings": { ar: "مسحوبات المالك", ckb: "پارە ڕاکێشانی خاوەن" },
  "Sales revenue": { ar: "إيرادات المبيعات", ckb: "داهاتی فرۆشتن" },
  "Merchant-funded discount": { ar: "خصم يتحمله المحل", ckb: "داشکاندنی سەر بە دوکان" },
  "Sales returns & refunds": {
    ar: "مرتجعات المبيعات والمبالغ المستردة",
    ckb: "گەڕاوەی فرۆشتن و پارە گەڕاندنەوە",
  },
  "Cost of goods sold": { ar: "كلفة البضاعة المباعة", ckb: "تێچووی کاڵای فرۆشراو" },
  "Purchase price variance": { ar: "فرق أسعار الشراء", ckb: "جیاوازی نرخی کڕین" },
  "Platform commission": { ar: "عمولة المنصات", ckb: "کۆمیسیۆنی پلاتفۆرم" },
  "Platform fees": { ar: "رسوم المنصات", ckb: "کرێی پلاتفۆرم" },
  "Waste & spoilage": { ar: "الهدر والتلف", ckb: "بەفیڕۆچوون و خراپبوون" },
  "Inventory count variance": { ar: "فروقات جرد المخزون", ckb: "جیاوازی ژماردنی کۆگا" },
  Rent: { ar: "الإيجار", ckb: "کرێی شوێن" },
  Salaries: { ar: "الرواتب", ckb: "مووچە" },
  Utilities: { ar: "الخدمات (الكهرباء والماء)", ckb: "خزمەتگوزارییەکان (کارەبا و ئاو)" },
  "Cash over / short": { ar: "زيادة / عجز النقد", ckb: "زیادە / کەمی پارەی نەختینە" },
  Depreciation: { ar: "الاستهلاك", ckb: "داخوران" },
  "Card and bank fees": { ar: "رسوم البطاقات والبنك", ckb: "کرێی کارت و بانک" },
  "Other expenses": { ar: "مصروفات أخرى", ckb: "خەرجی تر" },

  // Where cash is kept, as a narration names it ("Cash from the till to the safe").
  till: { ar: "درج النقد", ckb: "دەخیلە" },
  safe: { ar: "الخزنة", ckb: "قاسە" },
  bank: { ar: "البنك", ckb: "بانک" },
  owner: { ar: "المالك", ckb: "خاوەن" },
  card: { ar: "البطاقة", ckb: "کارت" },

  // The narrations of the journals and stock records the database posts.
  "Sale {1}": { ar: "بيع {1}", ckb: "فرۆشتنی {1}" },
  "Void of sale {1}: {2}": { ar: "إلغاء البيع {1}: {2}", ckb: "هەڵوەشاندنەوەی فرۆشتنی {1}: {2}" },
  "Refund of sale {1}: {2}": {
    ar: "استرداد البيع {1}: {2}",
    ckb: "گەڕاندنەوەی پارەی فرۆشتنی {1}: {2}",
  },
  "Void: {1}": { ar: "إلغاء: {1}", ckb: "هەڵوەشاندنەوە: {1}" },
  "Refund: {1}": { ar: "استرداد: {1}", ckb: "گەڕاندنەوەی پارە: {1}" },
  "Bill {1}": { ar: "فاتورة {1}", ckb: "پسووڵەی {1}" },
  "Payment — bill {1}": { ar: "دفعة — فاتورة {1}", ckb: "پارەدان — پسووڵەی {1}" },
  "Cancelled bill {1}: {2}": { ar: "فاتورة ملغاة {1}: {2}", ckb: "پسووڵەی هەڵوەشێنراوە {1}: {2}" },
  "Expense: {1}": { ar: "مصروف: {1}", ckb: "خەرجی: {1}" },
  "Waste: {1}": { ar: "هدر: {1}", ckb: "بەفیڕۆچوون: {1}" },
  "Spoilage: {1}": { ar: "تلف: {1}", ckb: "خراپبوون: {1}" },
  "Expired: {1}": { ar: "منتهي الصلاحية: {1}", ckb: "بەسەرچوو: {1}" },
  "Damaged: {1}": { ar: "متضرر: {1}", ckb: "زیانلێکەوتوو: {1}" },
  "Melt Evaporation: {1}": { ar: "ذوبان / تبخّر: {1}", ckb: "توانەوە / هەڵمبوون: {1}" },
  "Staff Consumption: {1}": { ar: "استهلاك الموظفين: {1}", ckb: "بەکارهێنانی ستاف: {1}" },
  "Complimentary: {1}": { ar: "مجاني (ضيافة): {1}", ckb: "بێبەرامبەر (میوانداری): {1}" },
  "Sampling: {1}": { ar: "تذوّق: {1}", ckb: "تامکردن: {1}" },
  "Stock correction: {1}": { ar: "تصحيح مخزون: {1}", ckb: "ڕاستکردنەوەی کۆگا: {1}" },
  "Stock count variance": { ar: "فرق جرد المخزون", ckb: "جیاوازی ژماردنی کۆگا" },
  "Count variance": { ar: "فرق الجرد", ckb: "جیاوازی ژماردن" },
  "Opening stock: {1}": { ar: "مخزون افتتاحي: {1}", ckb: "کۆگای سەرەتا: {1}" },
  "Goods received": { ar: "بضاعة مستلمة", ckb: "کاڵای وەرگیراو" },
  "Goods received — {1}": { ar: "بضاعة مستلمة — {1}", ckb: "کاڵای وەرگیراو — {1}" },
  "Goods received — receipt {1}": {
    ar: "بضاعة مستلمة — إيصال {1}",
    ckb: "کاڵای وەرگیراو — وەسڵی {1}",
  },
  receipt: { ar: "إيصال", ckb: "وەسڵ" },
  "Scheduled reversal of: {1}": { ar: "عكس مجدول لـ: {1}", ckb: "هەڵگەڕاندنەوەی خشتەکراو بۆ: {1}" },
  "Reversal: {1}": { ar: "عكس: {1}", ckb: "هەڵگەڕاندنەوە: {1}" },
  "Correction: {1}": { ar: "تصحيح: {1}", ckb: "ڕاستکردنەوە: {1}" },
  "{1} (the old app never journaled it)": {
    ar: "{1} (لم يسجّل التطبيق القديم قيده قط)",
    ckb: "{1} (بەرنامە کۆنەکە هەرگیز تۆماری نەکرد)",
  },
  "Year-end close {1}": { ar: "إقفال نهاية السنة {1}", ckb: "داخستنی کۆتایی ساڵی {1}" },
  "Cash over/short — drawer count": {
    ar: "زيادة/عجز النقد — عدّ الدرج",
    ckb: "زیادە/کەمی پارە — ژماردنی دەخیلە",
  },
  "Takings to the {1} after the drawer count": {
    ar: "المقبوضات إلى {1} بعد عدّ الدرج",
    ckb: "داهات بۆ {1} دوای ژماردنی دەخیلە",
  },
  "Takings after the drawer count": {
    ar: "المقبوضات بعد عدّ الدرج",
    ckb: "داهات دوای ژماردنی دەخیلە",
  },
  "Cash from the {1} to the {2}": { ar: "نقد من {1} إلى {2}", ckb: "پارە لە {1}ەوە بۆ {2}" },
  "Cash from the {1} to the {2}: {3}": {
    ar: "نقد من {1} إلى {2}: {3}",
    ckb: "پارە لە {1}ەوە بۆ {2}: {3}",
  },
  "Card takings {1} to {2} settled": {
    ar: "تسوية مقبوضات البطاقات من {1} إلى {2}",
    ckb: "یەکلاکردنەوەی داهاتی کارت لە {1} تا {2}",
  },
  "Reversal: card settlement cancelled: {1}": {
    ar: "عكس: أُلغيت تسوية البطاقات: {1}",
    ckb: "هەڵگەڕاندنەوە: یەکلاکردنەوەی کارت هەڵوەشێنرایەوە: {1}",
  },
  "Reversal: platform settlement cancelled: {1}": {
    ar: "عكس: أُلغيت تسوية المنصة: {1}",
    ckb: "هەڵگەڕاندنەوە: یەکلاکردنەوەی پلاتفۆرم هەڵوەشێنرایەوە: {1}",
  },
  "{1} payout, statement {2} ({3} orders)": {
    ar: "دفعة {1}، الكشف {2} ({3} طلبات)",
    ckb: "پارەدانی {1}، کەشفی {2} ({3} داواکاری)",
  },
  "Priced as on {1} when {2} was added": {
    ar: "سُعّر كما في {1} عند إضافة {2}",
    ckb: "وەک {1} نرخ دانرا کاتێک {2} زیاد کرا",
  },

  // What the database notes on a platform's statement (post_platform_settlement).
  "Already paid out by statement {1}": {
    ar: "دُفع سابقًا بالكشف {1}",
    ckb: "پێشتر بە کەشفی {1} پارەکەی دراوە",
  },
  "Expected {1}; paid {2}, commission {3}, fees {4}": {
    ar: "المتوقع {1}؛ المدفوع {2}، العمولة {3}، الرسوم {4}",
    ckb: "چاوەڕوانکراو {1}؛ دراو {2}، کۆمیسیۆن {3}، کرێ {4}",
  },
  "Not posted: {1}": { ar: "لم يُرحَّل: {1}", ckb: "تۆمار نەکرا: {1}" },
  not_found: { ar: "لا يوجد بيع بهذا الرقم", ckb: "هیچ فرۆشتنێک بەم ژمارەیە نییە" },
  duplicate: { ar: "مكرر في الكشف", ckb: "دووبارە لە کەشفەکەدا" },
  already_paid: { ar: "مدفوع سابقًا", ckb: "پێشتر دراوە" },

  // A manager's PIN, as the database answers a request for approval.
  "That PIN is not right": { ar: "رمز PIN هذا غير صحيح", ckb: "ئەم PIN ـە ڕاست نییە" },
  "Too many wrong PINs for {1}: try again in 15 minutes": {
    ar: "رموز PIN خاطئة كثيرة لـ{1}: حاول مجددًا بعد 15 دقيقة",
    ckb: "PIN ی هەڵەی زۆر بۆ {1}: دوای 15 خولەک دووبارە هەوڵ بدەوە",
  },
  "{1} has not set a PIN yet (My account)": {
    ar: "لم يضع {1} رمز PIN بعد (حسابي)",
    ckb: "{1} هێشتا PIN ی دانەناوە (هەژمارەکەم)",
  },

  // A check and what it found, as lock_period() lists them when a period
  // cannot be locked yet ("No draft journals — 2 draft journal(s) …").
  "{1} — {2}": { ar: "{1} — {2}", ckb: "{1} — {2}" },

  // The price check of receiving, when it lists more than one price.
  "Check the price: {1}": { ar: "تحقّق من السعر: {1}", ckb: "نرخەکە بپشکنە: {1}" },
  "{1}. If it is right, confirm it and receive again": {
    ar: "{1}. إن كان صحيحًا فأكّده واستلم مرة أخرى",
    ckb: "{1}. ئەگەر ڕاستە، دڵنیای بکەرەوە و دووبارە وەری بگرە",
  },

  // The period-close checks (period_close_checklist).
  "Earlier periods are locked": { ar: "الفترات السابقة مقفلة", ckb: "ماوەکانی پێشوو داخراون" },
  "{1} earlier period(s) still open": {
    ar: "ما زالت {1} من الفترات السابقة مفتوحة",
    ckb: "{1} ماوەی پێشوو هێشتا کراوەن",
  },
  "No draft journals": { ar: "لا قيود مسودّة", ckb: "هیچ تۆمارێکی ڕەشنووس نییە" },
  "{1} draft journal(s) must be published or discarded": {
    ar: "يجب ترحيل {1} من القيود المسودّة أو حذفها",
    ckb: "{1} تۆماری ڕەشنووس دەبێت پەسەند بکرێن یان فڕێ بدرێن",
  },
  "Every trading day's cash is counted": {
    ar: "عُدّ نقد كل يوم عمل",
    ckb: "پارەی هەموو ڕۆژێکی کار ژمێردراوە",
  },
  "Not counted: {1}": { ar: "غير معدود: {1}", ckb: "نەژمێردراو: {1}" },
  "No stock count awaiting approval": {
    ar: "لا جرد مخزون بانتظار الموافقة",
    ckb: "هیچ ژماردنێکی کۆگا چاوەڕێی پەسەندکردن نییە",
  },
  "{1} count(s) submitted and not yet approved or rejected": {
    ar: "{1} من عمليات الجرد قُدّمت ولم تُقبل أو تُرفض بعد",
    ckb: "{1} ژماردن نێردراون و هێشتا پەسەند یان ڕەت نەکراونەتەوە",
  },
  "Stock ledger agrees with Inventory (1200)": {
    ar: "سجل المخزون يطابق حساب المخزون (1200)",
    ckb: "تۆماری کۆگا لەگەڵ هەژماری کۆگا (1200) یەکدەگرێتەوە",
  },
  "stock ledger {1}, account 1200 {2}, difference {3}": {
    ar: "سجل المخزون {1}، الحساب 1200 {2}، الفرق {3}",
    ckb: "تۆماری کۆگا {1}، هەژماری 1200 {2}، جیاوازی {3}",
  },
  "Unpaid bills agree with Accounts payable (2000)": {
    ar: "الفواتير غير المدفوعة تطابق الذمم الدائنة (2000)",
    ckb: "پسووڵە نەدراوەکان لەگەڵ قەرزی دابینکەران (2000) یەکدەگرنەوە",
  },
  "unpaid bills {1}, account 2000 {2}, difference {3}": {
    ar: "الفواتير غير المدفوعة {1}، الحساب 2000 {2}، الفرق {3}",
    ckb: "پسووڵە نەدراوەکان {1}، هەژماری 2000 {2}، جیاوازی {3}",
  },
  "Unbilled receipts agree with GRNI (2050)": {
    ar: "الاستلامات غير المفوترة تطابق حساب البضاعة المستلمة غير المفوترة (2050)",
    ckb: "وەرگرتنە بێ پسووڵەکان لەگەڵ هەژماری کاڵای وەرگیراوی بێ پسووڵە (2050) یەکدەگرنەوە",
  },
  "unbilled receipts {1}, account 2050 {2}, difference {3}": {
    ar: "الاستلامات غير المفوترة {1}، الحساب 2050 {2}، الفرق {3}",
    ckb: "وەرگرتنە بێ پسووڵەکان {1}، هەژماری 2050 {2}، جیاوازی {3}",
  },
  "The period's journals balance": {
    ar: "قيود الفترة متوازنة",
    ckb: "تۆمارەکانی ماوەکە هاوسەنگن",
  },
  "out by {1}": { ar: "بفارق {1}", ckb: "بە جیاوازی {1}" },
  "No sale costed at nothing": {
    ar: "لا بيع محسوبة كلفته صفرًا",
    ckb: "هیچ فرۆشتنێک تێچووەکەی بە سفر هەژمار نەکراوە",
  },
  "{1} sale(s) costed at nothing or in part at nothing: see Reports, Uncosted sales. Their profit is overstated. The month can still be locked":
    {
      ar: "{1} من المبيعات حُسبت كلفتها صفرًا كليًا أو جزئيًا: انظر التقارير، مبيعات بلا كلفة. ربحها مضخّم. ويبقى إقفال الشهر ممكنًا",
      ckb: "{1} فرۆشتن تێچووەکەیان بە تەواوی یان بەشێکی بە سفر هەژمار کراوە: سەیری ڕاپۆرتەکان، فرۆشتنی بێ تێچوو بکە. قازانجەکەیان زیاتر لە ڕاستی دەردەکەوێت. هێشتا دەتوانرێت مانگەکە دابخرێت",
    },

  // The reconciliation (report_reconciliation), and sales costed at nothing.
  "Stock ledger vs Inventory (1200)": {
    ar: "سجل المخزون مقابل حساب المخزون (1200)",
    ckb: "تۆماری کۆگا بەرامبەر هەژماری کۆگا (1200)",
  },
  "Unpaid bills vs Accounts payable (2000)": {
    ar: "الفواتير غير المدفوعة مقابل الذمم الدائنة (2000)",
    ckb: "پسووڵە نەدراوەکان بەرامبەر قەرزی دابینکەران (2000)",
  },
  "Unbilled receipts vs Goods received not invoiced (2050)": {
    ar: "الاستلامات غير المفوترة مقابل البضاعة المستلمة غير المفوترة (2050)",
    ckb: "وەرگرتنە بێ پسووڵەکان بەرامبەر کاڵای وەرگیراوی بێ پسووڵە (2050)",
  },
  "Sales recorded vs net revenue in the ledger (4000 less 4100 and 4200)": {
    ar: "المبيعات المسجّلة مقابل صافي الإيراد في الدفاتر (4000 ناقص 4100 و4200)",
    ckb: "فرۆشتنی تۆمارکراو بەرامبەر داهاتی پوخت لە دەفتەردا (4000 کەم 4100 و 4200)",
  },
  "Costed at nothing: {1}": { ar: "كلفته صفر: {1}", ckb: "تێچووی سفر: {1}" },
  "Used before it had a cost: {1}": {
    ar: "استُخدم قبل أن تكون له كلفة: {1}",
    ckb: "پێش ئەوەی تێچووی هەبێت بەکارهات: {1}",
  },

  // The exceptions report (report_exceptions).
  "Rung by {1}": { ar: "سجّله {1}", ckb: "{1} تۆماری کرد" },
  "Rung by {1} (their own sale)": {
    ar: "سجّله {1} (بيعه هو)",
    ckb: "{1} تۆماری کرد (فرۆشتنی خۆی)",
  },
  someone: { ar: "شخص ما", ckb: "کەسێک" },
  "No reason kept (given before reasons were asked)": {
    ar: "لم يُحفظ سبب (أُعطي قبل أن تُطلب الأسباب)",
    ckb: "هیچ هۆکارێک نەپارێزراوە (پێش داواکردنی هۆکار درا)",
  },
  "Approval by {1}": { ar: "موافقة من {1}", ckb: "پەسەندکردن لەلایەن {1}" },
  "{1} line(s) on it": { ar: "عليها {1} من البنود", ckb: "{1} هێڵی لەسەرە" },
  "{1} item(s) taken off": { ar: "أُزيل {1} من الأصناف", ckb: "{1} کاڵا لابرا" },
  discount: { ar: "خصم", ckb: "داشکاندن" },
  void: { ar: "إلغاء", ckb: "هەڵوەشاندنەوە" },
  refund: { ar: "استرداد", ckb: "گەڕاندنەوەی پارە" },
  ...discountDetail,
};

export default phrases;
