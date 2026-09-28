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
  "Refund {1} of sale {2}: {3}": {
    ar: "الاسترداد {1} للبيع {2}: {3}",
    ckb: "گەڕاندنەوەی {1} ی فرۆشتنی {2}: {3}",
  },
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
  // The drawer in sessions (0036).
  "Cash over/short — session {1} opened": {
    ar: "زيادة/عجز النقد — فتح الوردية {1}",
    ckb: "زیادە/کەمی پارە — کردنەوەی شیفتی {1}",
  },
  "Cash over/short — session {1} closed": {
    ar: "زيادة/عجز النقد — إغلاق الوردية {1}",
    ckb: "زیادە/کەمی پارە — داخستنی شیفتی {1}",
  },
  "Cash over/short — the drawer counted as sessions began": {
    ar: "زيادة/عجز النقد — عدّ الدرج عند بدء الورديات",
    ckb: "زیادە/کەمی پارە — ژماردنی دەخیلە لە سەرەتای شیفتەکان",
  },
  "Takings to the {1} after session {2}": {
    ar: "المقبوضات إلى {1} بعد الوردية {2}",
    ckb: "داهات بۆ {1} دوای شیفتی {2}",
  },
  "Takings after session {1}": {
    ar: "المقبوضات بعد الوردية {1}",
    ckb: "داهات دوای شیفتی {1}",
  },
  "Float from the safe into the till, session {1}": {
    ar: "فكّة من الخزنة إلى الدرج، الوردية {1}",
    ckb: "پارەی ورد لە قاسەوە بۆ دەخیلە، شیفتی {1}",
  },
  "Float at the opening of session {1}": {
    ar: "فكّة عند فتح الوردية {1}",
    ckb: "پارەی ورد لە کردنەوەی شیفتی {1}",
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
  "Too many wrong PINs from this login: try again in 15 minutes": {
    ar: "رموز PIN خاطئة كثيرة من هذا الحساب: حاول مجددًا بعد 15 دقيقة",
    ckb: "PIN ی هەڵەی زۆر لەم هەژمارەوە: دوای 15 خولەک دووبارە هەوڵ بدەوە",
  },
  "Approvals by PIN are paused for {1} after too many wrong PINs today: {2} can set a new PIN on My account":
    {
      ar: "توقفت الموافقات برمز PIN لـ{1} بعد رموز خاطئة كثيرة اليوم: يستطيع {2} تعيين رمز PIN جديد من «حسابي»",
      ckb: "ڕەزامەندی بە PIN بۆ {1} ڕاگیراوە دوای PIN ی هەڵەی زۆر ئەمڕۆ: {2} دەتوانێت لە «هەژمارەکەم» PIN ێکی نوێ دابنێت",
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

  // The exceptions report (report_exceptions).
  "Rung by {1}": { ar: "سجّله {1}", ckb: "{1} تۆماری کرد" },
  "Rung by {1} (their own sale)": {
    ar: "سجّله {1} (بيعه هو)",
    ckb: "{1} تۆماری کرد (فرۆشتنی خۆی)",
  },
  someone: { ar: "شخص ما", ckb: "کەسێک" },
  "{1} line(s) on it": { ar: "عليها {1} من البنود", ckb: "{1} هێڵی لەسەرە" },
  "{1} item(s) taken off": { ar: "أُزيل {1} من الأصناف", ckb: "{1} کاڵا لابرا" },
  discount: { ar: "خصم", ckb: "داشکاندن" },
  ...discountDetail,

  // The month's checklist, checked account by account (0038).
  "Sales agree with net revenue (4000 less 4100 and 4200)": {
    ar: "المبيعات تطابق صافي الإيرادات (4000 مطروحًا منه 4100 و4200)",
    ckb: "فرۆشتن لەگەڵ داهاتی پوخت (4000 بە کەمکردنەوەی 4100 و 4200) یەکدەگرێتەوە",
  },
  "sales {1}, net revenue {2}, difference {3}": {
    ar: "المبيعات {1}، صافي الإيرادات {2}، الفرق {3}",
    ckb: "فرۆشتن {1}، داهاتی پوخت {2}، جیاوازی {3}",
  },
  "Card takings not yet settled agree with Card clearing (1010)": {
    ar: "مقبوضات البطاقات غير المسوّاة تطابق مقاصّة البطاقات (1010)",
    ckb: "داهاتی کارتی یەکلانەکراوە لەگەڵ پاکتاوی کارت (1010) یەکدەگرێتەوە",
  },
  "card takings {1}, account 1010 {2}, difference {3}": {
    ar: "مقبوضات البطاقات {1}، الحساب 1010 {2}، الفرق {3}",
    ckb: "داهاتی کارت {1}، هەژماری 1010 {2}، جیاوازی {3}",
  },
  "Orders the platforms owe agree with their receivable (1100)": {
    ar: "الطلبات المستحقة على المنصات تطابق ذممها (1100)",
    ckb: "ئەو داواکارییانەی پلاتفۆرمەکان قەرزارن لەگەڵ قەرزەکەیان (1100) یەکدەگرنەوە",
  },
  "orders owed {1}, account 1100 {2}, difference {3}": {
    ar: "الطلبات المستحقة {1}، الحساب 1100 {2}، الفرق {3}",
    ckb: "داواکارییە قەرزەکان {1}، هەژماری 1100 {2}، جیاوازی {3}",
  },
  "What the drawers should hold agrees with Cash in the till (1000)": {
    ar: "ما يجب أن تحويه الأدراج يطابق نقد درج الصندوق (1000)",
    ckb: "ئەوەی دەبێت لە دەخیلەکاندا بێت لەگەڵ پارەی نەختینەی ناو دەخیلە (1000) یەکدەگرێتەوە",
  },
  "the drawers {1}, account 1000 {2}, difference {3}": {
    ar: "الأدراج {1}، الحساب 1000 {2}، الفرق {3}",
    ckb: "دەخیلەکان {1}، هەژماری 1000 {2}، جیاوازی {3}",
  },
  "Cash moved through the safe agrees with the Safe (1005)": {
    ar: "النقد المنقول عبر الخزنة يطابق النقد في الخزنة (1005)",
    ckb: "پارەی گوازراوە بە قاسەدا لەگەڵ پارەی نەختینەی ناو قاسە (1005) یەکدەگرێتەوە",
  },
  "the safe's records {1}, account 1005 {2}, difference {3}": {
    ar: "سجلات الخزنة {1}، الحساب 1005 {2}، الفرق {3}",
    ckb: "بەڵگەکانی قاسە {1}، هەژماری 1005 {2}، جیاوازی {3}",
  },
  "records {1}, account {2}, difference {3}": {
    ar: "السجلات {1}، الحساب {2}، الفرق {3}",
    ckb: "بەڵگەکان {1}، هەژمار {2}، جیاوازی {3}",
  },
  "Every record has its one journal": {
    ar: "لكل سجل قيده الواحد",
    ckb: "هەر بەڵگەیەک یەک تۆماری هەیە",
  },
  "{1} record(s) to look into: see Reports, Do the books tie?": {
    ar: "{1} من السجلات تحتاج إلى مراجعة: انظر التقارير، هل تتطابق الدفاتر؟",
    ckb: "{1} بەڵگە پێویستی بە سەرنجدانە: سەیری ڕاپۆرتەکان، ئایا دەفتەرەکان یەکدەگرنەوە؟ بکە",
  },

  // US dollars (0043): their accounts, and the journals the database posts for them.
  "Cash in the till — USD": {
    ar: "نقد درج الصندوق — دولار",
    ckb: "پارەی نەختینەی ناو دەخیلە — دۆلار",
  },
  "Cash in the safe — USD": {
    ar: "النقد في الخزنة — دولار",
    ckb: "پارەی نەختینەی ناو قاسە — دۆلار",
  },
  "Exchange differences": { ar: "فروق الصرف", ckb: "جیاوازی ئاڵوگۆڕ" },
  "Dollars counted after session {1}, to the safe": {
    ar: "دولارات عُدّت بعد الوردية {1}، إلى الخزنة",
    ckb: "دۆلار دوای شیفتی {1} ژمێردرا، بۆ قاسە",
  },
  "Dollars exchanged: ${1} from the {2} for {3} into the {4}": {
    ar: "صرف دولارات: ${1} من {2} مقابل {3} إلى {4}",
    ckb: "گۆڕینەوەی دۆلار: ${1} لە {2}ەوە بە {3} بۆ {4}",
  },

  // Returns to a supplier and the suppliers' credit notes (0044).
  "Return {1} to {2}: {3}": { ar: "المرتجع {1} إلى {2}: {3}", ckb: "گەڕاندنەوەی {1} بۆ {2}: {3}" },
  "Return {1}: {2}": { ar: "المرتجع {1}: {2}", ckb: "گەڕاندنەوەی {1}: {2}" },
  "Credit {1} from {2} ({3}): {4}": {
    ar: "الإشعار الدائن {1} من {2} ({3}): {4}",
    ckb: "پسووڵەی گەڕاندنەوەی {1} لە {2} ({3}): {4}",
  },
  "Revalued: credit {1} on delivery {2}": {
    ar: "أُعيد تقييمه: الإشعار الدائن {1} على التوريد {2}",
    ckb: "دووبارە نرخێندرا: پسووڵەی گەڕاندنەوەی {1} لەسەر باری {2}",
  },
  // Losses by kind, giveaways at the till, and the loss report (0048).
  "Production and preparation loss": {
    ar: "خسائر الإنتاج والتحضير",
    ckb: "زیانی بەرهەمهێنان و ئامادەکردن",
  },
  "Staff meals": { ar: "وجبات الموظفين", ckb: "خواردنی کارمەندان" },
  "Complimentary items": { ar: "مواد الضيافة", ckb: "کاڵای میوانداری" },
  "Marketing samples": { ar: "عيّنات تسويقية", ckb: "نموونەی بازاڕکردن" },
  "Production Waste: {1}": { ar: "هدر الإنتاج: {1}", ckb: "بەفیڕۆچوونی بەرهەمهێنان: {1}" },
  "Preparation Waste: {1}": { ar: "هدر التحضير: {1}", ckb: "بەفیڕۆچوونی ئامادەکردن: {1}" },
  "Loss reversed: {1}: {2}": {
    ar: "عُكست الخسارة: {1}: {2}",
    ckb: "زیان هەڵگەڕێندرایەوە: {1}: {2}",
  },

  // Staff, their hours and their pay (0049): the accounts, the narrations, the checks and the month's close.
  "Employee advances": { ar: "سلف الموظفين", ckb: "پێشەکی کارمەندان" },
  "Salaries payable": { ar: "رواتب مستحقة الدفع", ckb: "مووچەی قەرز" },
  "Advance to {1}: {2}": { ar: "سلفة لـ{1}: {2}", ckb: "پێشەکی بۆ {1}: {2}" },
  "Advance cancelled: {1}": { ar: "أُلغيت السلفة: {1}", ckb: "پێشەکی هەڵوەشێنرایەوە: {1}" },
  "Payroll {1} ({2})": { ar: "كشف الرواتب {1} ({2})", ckb: "لیستی مووچەی {1} ({2})" },
  "Payroll reopened: {1}": {
    ar: "أُعيد فتح كشف الرواتب: {1}",
    ckb: "لیستی مووچە دووبارە کرایەوە: {1}",
  },
  "Salaries {1}: {2}": { ar: "رواتب {1}: {2}", ckb: "مووچەی {1}: {2}" },
  "Salary payment cancelled: {1}": {
    ar: "أُلغيت دفعة الراتب: {1}",
    ckb: "پارەدانی مووچە هەڵوەشێنرایەوە: {1}",
  },
  "Salaries owed vs Salaries payable (2100)": {
    ar: "الرواتب المستحقة مقابل رواتب مستحقة الدفع (2100)",
    ckb: "مووچەی قەرز بەرامبەر هەژماری مووچەی قەرز (2100)",
  },
  "Advances not yet taken back vs Employee advances (1300)": {
    ar: "السلف غير المستردة بعد مقابل سلف الموظفين (1300)",
    ckb: "پێشەکییە نەگەڕێندراوەکان بەرامبەر پێشەکی کارمەندان (1300)",
  },
  "Salaries owed agree with Salaries payable (2100)": {
    ar: "الرواتب المستحقة تطابق رواتب مستحقة الدفع (2100)",
    ckb: "مووچەی قەرز لەگەڵ هەژماری مووچەی قەرز (2100) یەکدەگرێتەوە",
  },
  "Advances not yet taken back agree with Employee advances (1300)": {
    ar: "السلف غير المستردة بعد تطابق سلف الموظفين (1300)",
    ckb: "پێشەکییە نەگەڕێندراوەکان لەگەڵ پێشەکی کارمەندان (1300) یەکدەگرنەوە",
  },
  "salaries owed {1}, account 2100 {2}, difference {3}": {
    ar: "الرواتب المستحقة {1}، الحساب 2100 {2}، الفرق {3}",
    ckb: "مووچەی قەرز {1}، هەژماری 2100 {2}، جیاوازی {3}",
  },
  "advances owed {1}, account 1300 {2}, difference {3}": {
    ar: "السلف المستحقة {1}، الحساب 1300 {2}، الفرق {3}",
    ckb: "پێشەکی قەرز {1}، هەژماری 1300 {2}، جیاوازی {3}",
  },
  "The month's payroll is approved": {
    ar: "كشف رواتب الشهر معتمد",
    ckb: "لیستی مووچەی مانگەکە پەسەند کراوە",
  },
  "The payroll for {1} is not approved: after the lock it cannot be posted into this month": {
    ar: "كشف رواتب {1} غير معتمد: بعد القفل لا يمكن ترحيله إلى هذا الشهر",
    ckb: "لیستی مووچەی {1} پەسەند نەکراوە: دوای قفڵکردن ناتوانرێت لەم مانگەدا تۆمار بکرێت",
  },
};

export default phrases;
