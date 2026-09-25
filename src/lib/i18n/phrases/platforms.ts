import type { PhraseBook } from "./types";

/**
 * Delivery platforms: the Delivery Platforms screen, statement matching, platform settlements, and their messages.
 */
const phrases: PhraseBook = {
  // The Delivery Platforms screen (src/app/platforms/page.tsx).
  "A delivery-platform order is platform-paid: the customer pays the platform, and the sale sits in <b>1100 Platform receivable</b> until the platform pays out. Each sale carries the order number from the platform's tablet, and the platform's statement is matched to the sales by it. Direct delivery is not a platform sale — it is taken as cash or card.":
    {
      ar: "طلب منصة التوصيل مدفوع عبر المنصة: يدفع الزبون للمنصة، ويبقى البيع في <b>1100 ذمم المنصات المدينة</b> حتى تدفع المنصة. يحمل كل بيع رقم الطلب من جهاز المنصة اللوحي، ويُطابَق كشف المنصة مع المبيعات بهذا الرقم. التوصيل المباشر ليس بيعًا عبر منصة — يُستلم نقدًا أو بالبطاقة.",
      ckb: "داواکاریی پلاتفۆرمی گەیاندن لە ڕێگەی پلاتفۆرمەوە پارەی دەدرێت: کڕیار پارە دەداتە پلاتفۆرمەکە، و فرۆشتنەکە لە <b>1100 قەرزی سەر پلاتفۆرمەکان</b> دەمێنێتەوە تا پلاتفۆرمەکە پارەکە دەدات. هەر فرۆشتنێک ژمارەی داواکاریی تابلێتی پلاتفۆرمەکەی لەسەرە، و کەشفی پلاتفۆرمەکە بەو ژمارەیە لەگەڵ فرۆشتنەکان بەراورد دەکرێت. گەیاندنی ڕاستەوخۆ فرۆشتنی پلاتفۆرم نییە — بە کاش یان کارت وەردەگیرێت.",
    },
  "Owed by the Platforms": { ar: "ما تدين به المنصات", ckb: "ئەوەی پلاتفۆرمەکان قەرزارن" },
  "Each order sold and not yet paid out, by its number": {
    ar: "كل طلب بِيع ولم تُدفع قيمته بعد، برقمه",
    ckb: "هەر داواکارییەک کە فرۆشراوە و هێشتا پارەکەی نەدراوە، بە ژمارەکەی",
  },
  "Waiting to be paid out": { ar: "بانتظار دفع المنصة", ckb: "چاوەڕێی پارەدانی پلاتفۆرم" },
  "{n} order(s), at their price on the till": {
    ar: "الطلبات: {n}، بأسعارها على نقطة البيع",
    ckb: "{n} داواکاری، بە نرخەکەیان لەسەر خاڵی فرۆشتن",
  },
  "1100 Platform receivable": {
    ar: "1100 ذمم المنصات المدينة",
    ckb: "1100 قەرزی سەر پلاتفۆرمەکان",
  },
  "what the books say the platforms owe": {
    ar: "ما تقول الدفاتر إن المنصات مدينة به",
    ckb: "ئەوەی دەفتەرەکان دەڵێن پلاتفۆرمەکان قەرزارن",
  },
  "Not explained by any order": {
    ar: "لا يفسّره أي طلب",
    ckb: "هیچ داواکارییەک ڕوونی ناکاتەوە",
  },
  "the receivable is exactly the orders waiting": {
    ar: "الذمم تساوي تمامًا الطلبات المنتظرة",
    ckb: "قەرزەکە ڕێک یەکسانە بە داواکارییە چاوەڕوانەکان",
  },
  "in the receivable with no order number: sales from before order numbers, or a hand journal": {
    ar: "في الذمم بلا رقم طلب: مبيعات سبقت أرقام الطلبات، أو قيد يدوي",
    ckb: "لە قەرزەکەدایە بێ ژمارەی داواکاری: فرۆشتنی پێش هاتنی ژمارەی داواکاری، یان تۆمارێکی دەستی",
  },
  "paid out by hand, matched to no order: a journal to 1100 outside this screen": {
    ar: "دُفع يدويًا دون مطابقة أي طلب: قيد على 1100 من خارج هذه الشاشة",
    ckb: "بە دەست پارەی دراوە و لەگەڵ هیچ داواکارییەک بەراورد نەکراوە: تۆمارێک بۆ 1100 لە دەرەوەی ئەم شاشەیە",
  },
  "{n} order(s)": { ar: "الطلبات: {n}", ckb: "{n} داواکاری" },
  "the oldest {when}, {n} day(s) ago": {
    ar: "أقدمها في {when}، الأيام المنقضية: {n}",
    ckb: "کۆنترینیان {when}، {n} ڕۆژ لەمەوبەر",
  },
  "No platform order is waiting to be paid out": {
    ar: "لا يوجد طلب منصة بانتظار الدفع",
    ckb: "هیچ داواکارییەکی پلاتفۆرم چاوەڕێی پارەدان نییە",
  },
  "A delivery-platform sale rung up on the till waits here, by its order number, until a statement pays it.":
    {
      ar: "بيع منصة التوصيل المسجّل على نقطة البيع ينتظر هنا برقم طلبه، حتى يُدفع في أحد الكشوفات.",
      ckb: "فرۆشتنی پلاتفۆرمی گەیاندن کە لەسەر خاڵی فرۆشتن تۆمار کراوە لێرە بە ژمارەی داواکارییەکەی چاوەڕێ دەکات، تا لە کەشفێکدا پارەکەی دەدرێت.",
    },
  Platform: { ar: "المنصة", ckb: "پلاتفۆرم" },
  Order: { ar: "الطلب", ckb: "داواکاری" },
  Sold: { ar: "وقت البيع", ckb: "کاتی فرۆشتن" },
  "Days waiting": { ar: "أيام الانتظار", ckb: "ڕۆژانی چاوەڕوانی" },
  "Sold for": { ar: "سعر البيع", ckb: "نرخی فرۆشتن" },
  "Match a Statement": { ar: "مطابقة كشف", ckb: "بەراوردکردنی کەشف" },
  "The platform's statement against the orders waiting · nothing is posted until you say so": {
    ar: "كشف المنصة مقابل الطلبات المنتظرة · لا يُسجَّل شيء في الدفاتر حتى تطلب ذلك",
    ckb: "کەشفی پلاتفۆرمەکە بەرامبەر داواکارییە چاوەڕوانەکان · هیچ شتێک تۆمار ناکرێت تا خۆت نەیڵێیت",
  },
  "Statements Posted": { ar: "الكشوفات المسجّلة", ckb: "کەشفە تۆمارکراوەکان" },
  "Newest first · a cancelled one is kept, marked": {
    ar: "الأحدث أولًا · يبقى الكشف الملغى ظاهرًا مع علامة",
    ckb: "نوێترین سەرەتا · هەڵوەشێنراوەکە دەمێنێتەوە، بە نیشانەوە",
  },
  "Platform Sales": { ar: "مبيعات المنصات", ckb: "فرۆشتنی پلاتفۆرمەکان" },
  "Among the last 500 sales · margin before the platform's commission": {
    ar: "من بين آخر 500 عملية بيع · هامش الربح قبل عمولة المنصة",
    ckb: "لەناو دوایین 500 فرۆشتن · پەراوێزی قازانج پێش کۆمیسیۆنی پلاتفۆرمەکە",
  },
  "Platform sales shown": { ar: "مبيعات المنصات المعروضة", ckb: "فرۆشتنی پلاتفۆرمی پیشاندراو" },
  "Their net sales": { ar: "صافي مبيعاتها", ckb: "فرۆشتنی پوختیان" },
  "Before commission": { ar: "قبل العمولة", ckb: "پێش کۆمیسیۆن" },
  "No delivery-platform sales yet": {
    ar: "لا توجد مبيعات عبر منصات التوصيل بعد",
    ckb: "هێشتا هیچ فرۆشتنێک لە ڕێگەی پلاتفۆرمەکانی گەیاندنەوە نییە",
  },
  "Delivery-platform orders rung up on the till appear here.": {
    ar: "تظهر هنا طلبات منصات التوصيل المسجّلة على نقطة البيع.",
    ckb: "داواکارییەکانی پلاتفۆرمی گەیاندن کە لەسەر خاڵی فرۆشتن تۆمار دەکرێن لێرە دەردەکەون.",
  },
  Items: { ar: "الأصناف", ckb: "کاڵاکان" },
  Net: { ar: "الصافي", ckb: "پوخت" },
  COGS: { ar: "تكلفة المبيعات", ckb: "تێچووی کاڵای فرۆشراو" },

  // Matching a statement (src/components/platforms/StatementMatcher.tsx).
  Matched: { ar: "مطابَق", ckb: "هاوتایە" },
  "No sale has this order number": {
    ar: "لا يوجد بيع بهذا الرقم",
    ckb: "هیچ فرۆشتنێک ئەم ژمارەی داواکارییەی نییە",
  },
  "Already paid out": { ar: "دُفع سابقًا", ckb: "پێشتر پارەکەی دراوە" },
  "The sale was voided or refunded": {
    ar: "أُلغي البيع أو استُرد مبلغه",
    ckb: "فرۆشتنەکە هەڵوەشێنرایەوە یان پارەکەی گەڕێندرایەوە",
  },
  "On the statement twice": { ar: "مكرر في الكشف", ckb: "دوو جار لە کەشفەکەدایە" },
  "1020 Bank": { ar: "1020 البنك", ckb: "1020 بانک" },
  "5100 Platform commission": {
    ar: "5100 عمولة المنصات",
    ckb: "5100 کۆمیسیۆنی پلاتفۆرمەکان",
  },
  "5200 Platform fees": { ar: "5200 رسوم المنصات", ckb: "5200 کرێی پلاتفۆرمەکان" },
  "Posted (journal {journal}): {n} {platform} order(s) paid out.": {
    ar: "سُجّل (القيد رقم {journal}): دُفعت طلبات {platform}، وعددها {n}.",
    ckb: "تۆمار کرا (تۆماری ژمارە {journal}): پارەی {n} داواکاریی {platform} درا.",
  },
  "Posted (journal {journal}): {n} {platform} order(s) paid out; {issues} line(s) not a clean match, kept with the statement to follow up.":
    {
      ar: "سُجّل (القيد رقم {journal}): دُفعت طلبات {platform}، وعددها {n}؛ وأسطر غير مطابقة تمامًا عددها {issues}، حُفظت مع الكشف للمتابعة.",
      ckb: "تۆمار کرا (تۆماری ژمارە {journal}): پارەی {n} داواکاریی {platform} درا؛ {issues} هێڵ بە تەواوی هاوتا نین، لەگەڵ کەشفەکە هەڵگیران بۆ بەدواداچوون.",
    },
  "Copy the statement's rows from the platform's report (a spreadsheet or CSV) with their column names: <b>Order</b>, <b>Payout</b>, and <b>Commission</b> and <b>Fees</b> if it gives them. Without the names, the columns are read in that order.":
    {
      ar: "انسخ صفوف الكشف من تقرير المنصة (جدول بيانات أو CSV) مع أسماء أعمدتها: <b>Order</b> و<b>Payout</b>، و<b>Commission</b> و<b>Fees</b> إن وُجدت. من دون الأسماء، تُقرأ الأعمدة بهذا الترتيب.",
      ckb: "ڕیزەکانی کەشفەکە لە ڕاپۆرتی پلاتفۆرمەکەوە کۆپی بکە (خشتەیەک یان CSV) لەگەڵ ناوی ستوونەکانیان: <b>Order</b>، <b>Payout</b>، و <b>Commission</b> و <b>Fees</b> ئەگەر هەبن. بەبێ ناوەکان، ستوونەکان بەو ڕیزبەندییە دەخوێندرێنەوە.",
    },
  "The statement": { ar: "الكشف", ckb: "کەشفەکە" },
  "{n} line(s) read": { ar: "الأسطر المقروءة: {n}", ckb: "{n} هێڵ خوێندرایەوە" },
  "columns: {columns}": { ar: "الأعمدة: {columns}", ckb: "ستوونەکان: {columns}" },
  "{n} total row(s) left out": {
    ar: "صفوف المجاميع المستبعدة: {n}",
    ckb: "{n} ڕیزی کۆی گشتی لابرا",
  },
  "…and {n} more": { ar: "…و{n} أخرى", ckb: "…و {n}ی تر" },
  "Match to the orders waiting": {
    ar: "طابِق مع الطلبات المنتظرة",
    ckb: "لەگەڵ داواکارییە چاوەڕوانەکان بەراوردی بکە",
  },
  "Orders matched": { ar: "الطلبات المطابَقة", ckb: "داواکاریی هاوتا" },
  "worth {amount} at the till": {
    ar: "قيمتها {amount} على نقطة البيع",
    ckb: "بە نرخی {amount} لەسەر خاڵی فرۆشتن",
  },
  "Paid for them": { ar: "المدفوع عنها", ckb: "پارەی دراو بۆیان" },
  "commission {commission} · fees {fees}": {
    ar: "العمولة {commission} · الرسوم {fees}",
    ckb: "کۆمیسیۆن {commission} · کرێ {fees}",
  },
  "Not explained": { ar: "غير مفسَّر", ckb: "ڕوون نەکراوە" },
  "the orders' value less what was paid, kept and charged": {
    ar: "قيمة الطلبات مطروحًا منها ما دُفع وما اقتطعته المنصة من عمولة ورسوم",
    ckb: "بەهای داواکارییەکان، کەم ئەوەی دراوە و ئەوەی پلاتفۆرمەکە وەک کۆمیسیۆن و کرێ بردوویەتی",
  },
  "On lines not posted": { ar: "في أسطر لن تُسجَّل", ckb: "لەسەر هێڵە تۆمارنەکراوەکان" },
  "{n} line(s) need a word in the note": {
    ar: "أسطر تحتاج إلى توضيح في الملاحظة: {n}",
    ckb: "{n} هێڵ پێویستیان بە ڕوونکردنەوەیە لە تێبینییەکەدا",
  },
  Line: { ar: "السطر", ckb: "هێڵ" },
  "What it is": { ar: "ما هو", ckb: "چییە" },
  Paid: { ar: "المدفوع", ckb: "دراو" },
  Commission: { ar: "العمولة", ckb: "کۆمیسیۆن" },
  Fees: { ar: "الرسوم", ckb: "کرێ" },
  "by statement {ref}": { ar: "بالكشف {ref}", ckb: "بە کەشفی {ref}" },
  "sold {when}": { ar: "بِيع في {when}", ckb: "فرۆشرا لە {when}" },
  "{n} {platform} order(s) waiting, from between those it pays, are not on this statement.": {
    ar: "{n} من طلبات {platform} المنتظرة، الواقعة بين الطلبات التي يدفعها، ليست في هذا الكشف.",
    ckb: "{n} داواکاریی چاوەڕوانی {platform}، لە نێوان ئەوانەی پارەیان دەدات، لەم کەشفەدا نین.",
  },
  "Ask {platform} about them; they stay waiting until a statement pays them.": {
    ar: "اسأل {platform} عنها؛ تبقى منتظرة حتى تُدفع في أحد الكشوفات.",
    ckb: "دەربارەیان پرسیار لە {platform} بکە؛ چاوەڕوان دەمێننەوە تا لە کەشفێکدا پارەیان دەدرێت.",
  },
  "The journal it would post": { ar: "القيد الذي سيُسجَّل", ckb: "ئەو تۆمارەی دەکرێت" },
  Dr: { ar: "مدين", ckb: "قەرزدار" },
  Cr: { ar: "دائن", ckb: "خاوەن قەرز" },
  "Statement number or date": { ar: "رقم الكشف أو تاريخه", ckb: "ژمارە یان بەرواری کەشف" },
  "The payout arrived on": { ar: "تاريخ وصول الدفعة", ckb: "بەرواری گەیشتنی پارەکە" },
  "Note: say what the lines that do not match are": {
    ar: "ملاحظة: اذكر ما هي الأسطر غير المطابقة",
    ckb: "تێبینی: بڵێ ئەو هێڵانەی هاوتا نین چین",
  },
  "Note (optional)": { ar: "ملاحظة (اختيارية)", ckb: "تێبینی (ئارەزوومەندانە)" },
  "Post the payout": { ar: "سجّل الدفعة", ckb: "پارەدانەکە تۆمار بکە" },
  "The owner or the accountant posts the payout.": {
    ar: "المالك أو المحاسب هو من يسجّل الدفعة.",
    ckb: "خاوەن یان ژمێریار پارەدانەکە تۆمار دەکات.",
  },

  // What a pasted statement could not be read as (src/lib/settlements.ts, parseStatement).
  "Line {1}: the columns were not recognised. Name them Order, Payout, and Commission and Fees if the statement has them.":
    {
      ar: "السطر {1}: لم تُعرَف الأعمدة. سمِّها Order وPayout، وCommission وFees إن كانت في الكشف.",
      ckb: "هێڵی {1}: ستوونەکان نەناسرانەوە. ناویان بنێ Order، Payout، و Commission و Fees ئەگەر لە کەشفەکەدا هەبن.",
    },
  "Line {1} has a payout but no order number.": {
    ar: "في السطر {1} مبلغ مدفوع دون رقم طلب.",
    ckb: "هێڵی {1} پارەی تێدایە بەڵام ژمارەی داواکاری نییە.",
  },
  'Line {1}: "{2}" is not an order number.': {
    ar: "السطر {1}: «{2}» ليس رقم طلب.",
    ckb: "هێڵی {1}: «{2}» ژمارەی داواکاری نییە.",
  },
  "Line {1} (order {2}) has no payout.": {
    ar: "السطر {1} (الطلب {2}) بلا مبلغ مدفوع.",
    ckb: "هێڵی {1} (داواکاری {2}) پارەی تێدا نییە.",
  },
  'Line {1} (order {2}): the payout "{3}" is not an amount.': {
    ar: "السطر {1} (الطلب {2}): المبلغ المدفوع «{3}» ليس مبلغًا صالحًا.",
    ckb: "هێڵی {1} (داواکاری {2}): پارەدانی «{3}» بڕە پارەیەکی دروست نییە.",
  },
  'Line {1} (order {2}): the commission "{3}" is not an amount.': {
    ar: "السطر {1} (الطلب {2}): العمولة «{3}» ليست مبلغًا صالحًا.",
    ckb: "هێڵی {1} (داواکاری {2}): کۆمیسیۆنی «{3}» بڕە پارەیەکی دروست نییە.",
  },
  'Line {1} (order {2}): the fees "{3}" is not an amount.': {
    ar: "السطر {1} (الطلب {2}): الرسوم «{3}» ليست مبلغًا صالحًا.",
    ckb: "هێڵی {1} (داواکاری {2}): کرێی «{3}» بڕە پارەیەکی دروست نییە.",
  },
  "A statement is matched {1} lines at a time.": {
    ar: "يُطابَق من الكشف {1} سطر كحدٍّ أقصى في كل مرة.",
    ckb: "لە هەر جارێکدا زۆرترین {1} هێڵی کەشف بەراورد دەکرێت.",
  },

  // Why a settlement line does not reconcile (src/domain/platform/settlement.ts).
  "{1} settlement lines reference the same order": {
    ar: "{1} من أسطر التسوية تشير إلى الطلب نفسه",
    ckb: "{1} هێڵی یەکلاکردنەوە ئاماژە بە هەمان داواکاری دەکەن",
  },
  "Settlement line has no matching order in our records": {
    ar: "سطر التسوية لا يقابله أي طلب في سجلاتنا",
    ckb: "هێڵی یەکلاکردنەوەکە هیچ داواکارییەکی هاوتای لە تۆمارەکانماندا نییە",
  },
  "Order was cancelled but the settlement still moved money": {
    ar: "أُلغي الطلب لكن التسوية حرّكت مالًا رغم ذلك",
    ckb: "داواکارییەکە هەڵوەشێنرایەوە بەڵام یەکلاکردنەوەکە هێشتا پارەی جوڵاند",
  },
  "Reported payout {1} vs expected {2}": {
    ar: "الدفعة المُبلَّغ عنها {1} مقابل المتوقعة {2}",
    ckb: "پارەی ڕاگەیەندراو {1} بەرامبەر چاوەڕوانکراو {2}",
  },
  "Reported commission {1} vs expected {2}": {
    ar: "العمولة المُبلَّغ عنها {1} مقابل المتوقعة {2}",
    ckb: "کۆمیسیۆنی ڕاگەیەندراو {1} بەرامبەر چاوەڕوانکراو {2}",
  },
  'Adjustment "{1}" with payout delta': {
    ar: "تعديل «{1}» مع فرق في الدفعة",
    ckb: "ڕاستکردنەوەی «{1}» لەگەڵ جیاوازی لە پارەدان",
  },
  "Completed order is absent from the settlement statement": {
    ar: "الطلب المكتمل غير موجود في كشف التسوية",
    ckb: "داواکارییە تەواوبووەکە لە کەشفی یەکلاکردنەوەکەدا نییە",
  },

  // The statements posted (src/components/platforms/PlatformSettlements.tsx).
  "Cancelled: its journal is reversed, and its orders wait again.": {
    ar: "أُلغي: عُكس قيده، وعادت طلباته إلى الانتظار.",
    ckb: "هەڵوەشێنرایەوە: تۆمارەکەی هەڵگەڕێندرایەوە، و داواکارییەکانی دووبارە چاوەڕێ دەکەن.",
  },
  Statement: { ar: "الكشف", ckb: "کەشف" },
  Arrived: { ar: "تاريخ الوصول", ckb: "کاتی گەیشتن" },
  "Orders paid": { ar: "الطلبات المدفوعة", ckb: "داواکاریی پارەدراو" },
  "orders of {period}": { ar: "طلبات بتاريخ {period}", ckb: "داواکارییەکانی {period}" },
  "of {n} lines": { ar: "من أصل {n} في الكشف", ckb: "لە {n} هێڵ" },
  Cancelled: { ar: "ملغى", ckb: "هەڵوەشێنراوەتەوە" },
  "Why it is cancelled": { ar: "سبب الإلغاء", ckb: "هۆکاری هەڵوەشاندنەوە" },

  // What the settlement actions answer (src/lib/actions/settlements.ts): the
  // names of the fields checked, and the checks.
  "The last day": { ar: "اليوم الأخير", ckb: "دوایین ڕۆژ" },
  "The terminal's total": { ar: "مجموع جهاز البطاقات", ckb: "کۆی ئامێری کارتەکە" },
  "What reached the bank": { ar: "ما وصل إلى البنك", ckb: "ئەوەی گەیشتە بانک" },
  "The day it arrived": { ar: "يوم الوصول", ckb: "ڕۆژی گەیشتن" },
  "a settlement": { ar: "تسوية", ckb: "یەکلاکردنەوەیەک" },
  "An amount on the statement is not a number": {
    ar: "أحد المبالغ في الكشف ليس رقمًا",
    ckb: "بڕێکی پارە لە کەشفەکەدا ژمارە نییە",
  },
  "The statement has no lines": {
    ar: "لا توجد أسطر في الكشف",
    ckb: "کەشفەکە هیچ هێڵێکی تێدا نییە",
  },
  "A statement is matched 2,000 lines at a time": {
    ar: "يُطابَق من الكشف 2,000 سطر كحدٍّ أقصى في كل مرة",
    ckb: "لە هەر جارێکدا زۆرترین 2,000 هێڵی کەشف بەراورد دەکرێت",
  },
  "Choose the platform": { ar: "اختر المنصة", ckb: "پلاتفۆرمەکە هەڵبژێرە" },
  "The statement's number or date": {
    ar: "رقم الكشف أو تاريخه",
    ckb: "ژمارە یان بەرواری کەشفەکە",
  },

  // What the platform actions answer (src/lib/actions/platforms.ts).
  "Name the platform as its customers know it": {
    ar: "سمِّ المنصة كما يعرفها زبائنها",
    ckb: "ناوی پلاتفۆرمەکە بنووسە وەک کڕیارەکانی دەیناسن",
  },
  "Name the platform in up to 60 letters": {
    ar: "اكتب اسم المنصة في 60 حرفًا على الأكثر",
    ckb: "ناوی پلاتفۆرمەکە لە 60 پیت زیاتر نەبێت",
  },
  "A language code (ar, ckb)": { ar: "رمز لغة (ar, ckb)", ckb: "کۆدی زمان (ar, ckb)" },
  "A name in another language is up to 60 letters": {
    ar: "الاسم بلغة أخرى 60 حرفًا على الأكثر",
    ckb: "ناو بە زمانێکی تر لە 60 پیت زیاتر نابێت",
  },
  "A short name is small Latin letters, digits and _, starting with a letter (lezzoo)": {
    ar: "الاسم المختصر أحرف لاتينية صغيرة وأرقام و _، ويبدأ بحرف (lezzoo)",
    ckb: "ناوی کورت لە پیتی لاتینی بچووک، ژمارە و _ پێکدێت و بە پیتێک دەست پێدەکات (lezzoo)",
  },
};

export default phrases;
