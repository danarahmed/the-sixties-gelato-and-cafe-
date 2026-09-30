import type { PhraseBook } from "./types";

/**
 * What the database refuses with, by its English, with {1}, {2}… where it puts
 * a value (scripts/db-messages.mjs lists them; tests/i18n.test.ts checks that
 * each is here). The two it shares with the forms ("A discount is more than 0%
 * and no more than 100%", "A discount must be more than zero") are in common.
 * At the end: the English words and phrases the database puts into a message
 * as a value, each translated where it stands.
 */
const phrases: PhraseBook = {
  // Selling and the till: a sale, its lines and prices, and how it is paid.
  "sales_order is append-only; use a void or refund, not DELETE": {
    ar: "جدول sales_order للإضافة فقط؛ استخدم الإلغاء أو الاسترداد، لا الحذف (DELETE)",
    ckb: "خشتەی sales_order تەنها بۆ زیادکردنە؛ هەڵوەشاندنەوە یان گەڕاندنەوەی پارە بەکاربهێنە، نەک سڕینەوە (DELETE)",
  },
  "A finalized sale is immutable; only its status may move to voided or refunded": {
    ar: "لا يُعدَّل البيع المكتمل؛ يمكن فقط أن تتغيّر حالته إلى «ملغى» أو «مسترد»",
    ckb: "فرۆشتنی تەواوبوو ناگۆڕدرێت؛ تەنها دۆخەکەی دەتوانێت ببێتە «هەڵوەشێنراوە» یان «پارەی گەڕێندراوەتەوە»",
  },
  "A sale cannot move from {1} to {2}": {
    ar: "لا يمكن أن تنتقل حالة البيع من «{1}» إلى «{2}»",
    ckb: "دۆخی فرۆشتن لە «{1}» بۆ «{2}» ناگۆڕدرێت",
  },
  "Sale not found": { ar: "لم يُعثر على البيع", ckb: "فرۆشتنەکە نەدۆزرایەوە" },
  // A retry with its key (0035).
  "This retry does not match what was first sent: reload the page and check before doing it again":
    {
      ar: "إعادة المحاولة هذه لا تطابق ما أُرسل أولًا: أعد تحميل الصفحة وتحقّق قبل تكرار العملية",
      ckb: "ئەم دووبارە هەوڵدانە لەگەڵ ئەوەی یەکەمجار نێردرا ناگونجێت: پەڕەکە نوێ بکەرەوە و پێش دووبارەکردنەوە بپشکنە",
    },
  "This was sent by someone else": { ar: "أرسل هذا شخصٌ آخر", ckb: "ئەمە کەسێکی تر ناردوویەتی" },
  "Only the owner can change the access of an owner or a general manager": {
    ar: "المالك وحده يستطيع تغيير صلاحية دخول مالكٍ أو مديرٍ عام",
    ckb: "تەنها خاوەن دەتوانێت دەستپێگەیشتنی خاوەنێک یان بەڕێوەبەرێکی گشتی بگۆڕێت",
  },
  "Some of what this batch made has already been used or sold: record a loss or a correction instead":
    {
      ar: "استُخدم بعض ما أنتجته هذه الدفعة أو بيع بالفعل: سجّل خسارة أو تصحيحًا بدلًا من ذلك",
      ckb: "هەندێک لەوەی ئەم دەفعەیە دروستی کرد بەکارهاتووە یان فرۆشراوە: لەبری ئەوە زیان یان ڕاستکردنەوەیەک تۆمار بکە",
    },
  "A sale needs its idempotency key": {
    ar: "يحتاج البيع إلى مفتاح منع التكرار الخاص به",
    ckb: "فرۆشتن پێویستی بە کلیلی ڕێگری لە دووبارەبوونەوە هەیە",
  },
  "The cart is empty": { ar: "السلة فارغة", ckb: "سەبەتەکە بەتاڵە" },
  "Tender {1} is not supported": {
    ar: "طريقة الدفع {1} غير مدعومة",
    ckb: "شێوازی پارەدانی {1} پشتگیری ناکرێت",
  },
  "Delivery-platform orders are platform-paid, and only they are": {
    ar: "طلبات منصات التوصيل وحدها تُدفع عبر المنصة، وتُدفع دائمًا عبرها",
    ckb: "تەنها داواکارییەکانی پلاتفۆرمی گەیاندن لە ڕێگەی پلاتفۆرمەوە پارەیان دەدرێت، و هەمیشە بەو شێوەیە",
  },
  "A delivery platform sets its own discounts; none is given at the till": {
    ar: "تحدّد منصة التوصيل خصوماتها بنفسها؛ فلا يُعطى أي خصم على نقطة البيع",
    ckb: "پلاتفۆرمی گەیاندن خۆی داشکاندنەکانی دیاری دەکات؛ هیچ داشکاندنێک لەسەر خاڵی فرۆشتن نادرێت",
  },
  "Delivery-platform orders are paid through the platform: ring them up as a sale, not a bill": {
    ar: "طلبات منصات التوصيل تُدفع عبر المنصة: سجّلها بيعًا، لا فاتورة",
    ckb: "پارەی داواکارییەکانی پلاتفۆرمی گەیاندن لە ڕێگەی پلاتفۆرمەوە دەدرێت: وەک فرۆشتن تۆماریان بکە، نەک وەک پسووڵە",
  },
  "Not enough {1} in stock to make this sale": {
    ar: "لا يكفي المخزون من {1} لإتمام هذا البيع",
    ckb: "بڕی {1} لە کۆگادا بەشی ئەم فرۆشتنە ناکات",
  },
  "Each line needs a positive quantity": {
    ar: "يحتاج كل سطر إلى كمية أكبر من الصفر",
    ckb: "هەر هێڵێک پێویستی بە بڕێکی لە سفر زیاتر هەیە",
  },
  "That product is not on sale": {
    ar: "هذا المنتج غير معروض للبيع",
    ckb: "ئەو بەرهەمە بۆ فرۆشتن نییە",
  },
  "A product on the bill is not on sale": {
    ar: "أحد المنتجات على الفاتورة غير معروض للبيع",
    ckb: "بەرهەمێکی سەر پسووڵەکە بۆ فرۆشتن نییە",
  },
  "No {1} price is set for this product": {
    ar: "لا يوجد سعر لقناة {1} لهذا المنتج",
    ckb: "هیچ نرخێک بۆ کەناڵی {1} لەسەر ئەم بەرهەمە دانەنراوە",
  },
  "No {1} price is set for {2}": {
    ar: "لا يوجد سعر لقناة {1} للمنتج {2}",
    ckb: "هیچ نرخێک بۆ کەناڵی {1} لەسەر {2} دانەنراوە",
  },
  "The total is {1} now, not the {2} shown: a price has changed. The till has the new prices; tell the customer, then take payment again":
    {
      ar: "المجموع الآن {1}، لا {2} كما ظهر: تغيّر أحد الأسعار. لدى نقطة البيع الأسعار الجديدة؛ أخبر الزبون ثم استلم الدفع مجددًا",
      ckb: "کۆی گشتی ئێستا {1}، نەک {2} وەک پیشان درا: نرخێک گۆڕاوە. نرخە نوێیەکان لەسەر خاڵی فرۆشتنن؛ بە کڕیارەکە بڵێ، پاشان دووبارە پارە وەربگرە",
    },
  "That payment was already used for another sale. Try again.": {
    ar: "استُخدمت هذه الدفعة لبيع آخر من قبل. حاول مرة أخرى.",
    ckb: "ئەم پارەدانە پێشتر بۆ فرۆشتنێکی تر بەکارهاتووە. دووبارە هەوڵ بدەوە.",
  },

  // Selling and the till: the bills kept open at a table or under a name.
  "Name the table": { ar: "اكتب اسم الطاولة", ckb: "ناوی مێزەکە بنووسە" },
  "Table not found": { ar: "لم يُعثر على الطاولة", ckb: "مێزەکە نەدۆزرایەوە" },
  "There is already a table called {1}": {
    ar: "توجد طاولة باسم {1} بالفعل",
    ckb: "مێزێک بە ناوی {1} پێشتر هەیە",
  },
  "This table has an open bill; take payment or cancel it first": {
    ar: "على هذه الطاولة فاتورة مفتوحة؛ استلم دفعها أو ألغِها أولًا",
    ckb: "پسووڵەیەکی کراوە لەسەر ئەم مێزەیە؛ سەرەتا پارەکەی وەربگرە یان هەڵیبوەشێنەوە",
  },
  "That table is not in use": { ar: "هذه الطاولة غير مستخدمة", ckb: "ئەو مێزە بەکارنایەت" },
  "A bill is never deleted; cancel it instead": {
    ar: "لا تُحذف الفاتورة أبدًا؛ ألغِها بدلًا من ذلك",
    ckb: "پسووڵە هەرگیز ناسڕدرێتەوە؛ لە جیاتی ئەوە هەڵیبوەشێنەوە",
  },
  "This bill is {1} and cannot change": {
    ar: "هذه الفاتورة {1} ولا يمكن تغييرها",
    ckb: "ئەم پسووڵەیە {1} و ناگۆڕدرێت",
  },
  "The lines of a {1} bill cannot change": {
    ar: "لا يمكن تغيير أسطر فاتورة {1}",
    ckb: "هێڵەکانی پسووڵەیەک کە {1} ناگۆڕدرێن",
  },
  "This bill is already {1}": { ar: "هذه الفاتورة {1} بالفعل", ckb: "ئەم پسووڵەیە پێشتر {1}" },
  "This bill was changed on another till. Open it again to see the latest.": {
    ar: "تغيّرت هذه الفاتورة من جهاز آخر. افتحها مجددًا لترى آخر ما فيها.",
    ckb: "ئەم پسووڵەیە لە ئامێرێکی ترەوە گۆڕدرا. دیسان بیکەرەوە بۆ ئەوەی دوایین شێوەی ببینیت.",
  },
  "The bill is empty": { ar: "الفاتورة فارغة", ckb: "پسووڵەکە بەتاڵە" },
  "The bill has no lines": { ar: "لا توجد أسطر في الفاتورة", ckb: "پسووڵەکە هیچ هێڵێکی تێدا نییە" },
  "Each line can be moved once": {
    ar: "يُنقل كل سطر مرة واحدة فقط",
    ckb: "هەر هێڵێک تەنها یەک جار دەگوازرێتەوە",
  },
  "That line is not on this bill": {
    ar: "هذا السطر ليس على هذه الفاتورة",
    ckb: "ئەو هێڵە لەسەر ئەم پسووڵەیە نییە",
  },
  "Move between 1 and {1} of {2}": {
    ar: "انقل من {2} ما بين 1 و{1}",
    ckb: "لە {2} لە نێوان 1 و {1} بگوازەرەوە",
  },
  "Add something to the bill before giving a discount": {
    ar: "أضف شيئًا إلى الفاتورة قبل منح الخصم",
    ckb: "پێش دانی داشکاندن شتێک بخەرە سەر پسووڵەکە",
  },
  "Only a manager can take items off a bill that has been printed": {
    ar: "وحده المدير يستطيع حذف أصناف من فاتورة طُبعت",
    ckb: "تەنها بەڕێوەبەر دەتوانێت کاڵا لە پسووڵەیەکی چاپکراو لاببات",
  },
  "Only a manager can cancel a bill with items on it": {
    ar: "إلغاء فاتورة عليها أصناف يحتاج إلى مدير",
    ckb: "تەنها بەڕێوەبەر دەتوانێت پسووڵەیەک هەڵبوەشێنێتەوە کە کاڵای لەسەرە",
  },

  // Selling and the till: discounts, and the reason given for one, a void or a refund.
  "You do not have permission to give discounts": {
    ar: "ليست لديك صلاحية منح الخصومات",
    ckb: "مۆڵەتی دانی داشکاندنت نییە",
  },
  "Only a manager can change the discount on a bill that has been printed": {
    ar: "وحده المدير يستطيع تغيير الخصم على فاتورة طُبعت",
    ckb: "تەنها بەڕێوەبەر دەتوانێت داشکاندنی پسووڵەیەکی چاپکراو بگۆڕێت",
  },
  "The {1} off would be {2}% of the bill, over the {3}% allowed: take the discount off first, or ask a manager":
    {
      ar: "خصم {1} سيعادل {2}% من الفاتورة، أي أكثر من الـ{3}% المسموح بها: أزل الخصم أولًا، أو اطلب موافقة المدير",
      ckb: "داشکاندنی {1} دەبێتە {2}% ی پسووڵەکە، کە لە {3}% ی ڕێگەپێدراو زیاترە: سەرەتا داشکاندنەکە لابەرە، یان داوا لە بەڕێوەبەر بکە",
    },
  "Choose a reason from the list": {
    ar: "اختر سببًا من القائمة",
    ckb: "هۆکارێک لە لیستەکە هەڵبژێرە",
  },
  "Say what happened, in a few words": {
    ar: "اذكر ما حدث بكلمات قليلة",
    ckb: "بە چەند وشەیەک بڵێ چی ڕوویدا",
  },

  // Selling and the till: voiding and refunding a sale (on Orders).
  "Only a completed sale can be voided; this one is {1}": {
    ar: "لا يمكن الإلغاء إلا لبيع مكتمل؛ وهذا البيع {1}",
    ckb: "تەنها فرۆشتنی تەواوبوو هەڵدەوەشێنرێتەوە؛ ئەم فرۆشتنە {1}",
  },
  "The drawer has been counted since this sale; refund it instead of voiding it": {
    ar: "جُرد درج النقد بعد هذا البيع؛ استردّه بدلًا من إلغائه",
    ckb: "لە دوای ئەم فرۆشتنەوە دەخیلەکە ژمێردراوە؛ لە جیاتی هەڵوەشاندنەوە، پارەکەی بگەڕێنەوە",
  },
  "This sale has no journal to reverse (it predates the controls); refund it instead": {
    ar: "ليس لهذا البيع قيد يُعكس (فهو أقدم من الضوابط)؛ استردّه بدلًا من ذلك",
    ckb: "ئەم فرۆشتنە هیچ تۆمارێکی نییە بۆ هەڵگەڕاندنەوە (لە پێش ڕێکارەکانی کۆنترۆڵەوەیە)؛ لە جیاتی ئەوە پارەکەی بگەڕێنەوە",
  },
  "That approval is for another sale": {
    ar: "هذه الموافقة لبيع آخر",
    ckb: "ئەو ڕەزامەندییە بۆ فرۆشتنێکی ترە",
  },
  "Only a completed sale can be refunded; this one is {1}": {
    ar: "لا يمكن الاسترداد إلا لبيع مكتمل؛ وهذا البيع {1}",
    ckb: "تەنها پارەی فرۆشتنی تەواوبوو دەگەڕێندرێتەوە؛ ئەم فرۆشتنە {1}",
  },
  // Refunds by the item (0037).
  "This sale has been refunded in full already": {
    ar: "استُرد هذا البيع بالكامل من قبل",
    ckb: "پارەی ئەم فرۆشتنە پێشتر بە تەواوی گەڕێندراوەتەوە",
  },
  "This sale was voided: there is nothing to refund": {
    ar: "أُلغي هذا البيع: لا شيء فيه للاسترداد",
    ckb: "ئەم فرۆشتنە هەڵوەشێنراوەتەوە: هیچ شتێک بۆ گەڕاندنەوە نییە",
  },
  "Choose what to refund": { ar: "اختر ما يُسترد", ckb: "ئەوە هەڵبژێرە کە پارەکەی دەگەڕێندرێتەوە" },
  "The items to refund cannot be read": {
    ar: "تعذّرت قراءة المواد المراد استردادها",
    ckb: "ئەو کاڵایانەی پارەکەیان دەگەڕێندرێتەوە ناخوێندرێنەوە",
  },
  "That item is not on this sale": {
    ar: "هذه المادة ليست في هذا البيع",
    ckb: "ئەم کاڵایە لەم فرۆشتنەدا نییە",
  },
  "An item is named twice": { ar: "ذُكرت مادة مرتين", ckb: "کاڵایەک دوو جار ناوی هاتووە" },
  "Only {1} of {2} is left to refund": {
    ar: "لم يبقَ من {2} للاسترداد إلا {1}",
    ckb: "تەنها {1} لە {2} ماوە بۆ گەڕاندنەوە",
  },
  "This sale was recorded before refunds by item: refund all of it": {
    ar: "سُجّل هذا البيع قبل الاسترداد بالمادة: استرد كامله",
    ckb: "ئەم فرۆشتنە پێش گەڕاندنەوەی پارە بە کاڵا تۆمار کراوە: پارەی هەمووی بگەڕێنەوە",
  },
  "The items chosen were sold for nothing: there is no money to give back": {
    ar: "بيعت المواد المختارة بلا مقابل: لا مال لإعادته",
    ckb: "کاڵا هەڵبژێردراوەکان بەخۆڕایی فرۆشراون: هیچ پارەیەک نییە بۆ گەڕاندنەوە",
  },
  "This refund is more than is left of what was paid ({1})": {
    ar: "هذا الاسترداد أكثر مما بقي من المبلغ المدفوع ({1})",
    ckb: "ئەم گەڕاندنەوەیە زیاترە لەوەی لە پارەی دراو ماوە ({1})",
  },
  "This sale's tender cannot be refunded here": {
    ar: "لا يمكن هنا الاسترداد بطريقة الدفع التي دُفع بها هذا البيع",
    ckb: "لێرە ناتوانرێت پارەی ئەم فرۆشتنە بەو شێوازەی پێی دراوە بگەڕێندرێتەوە",
  },

  // Bills and paying suppliers: the supplier's bill, what is paid on it, and expenses.
  "Bills are append-only; record a credit note instead": {
    ar: "الفواتير للإضافة فقط؛ سجّل إشعارًا دائنًا بدلًا من ذلك",
    ckb: "پسووڵەکان تەنها زیاد دەکرێن؛ لە جیاتی ئەوە پسووڵەی گەڕاندنەوە تۆمار بکە",
  },
  "A bill's supplier, number, date and amount cannot change": {
    ar: "لا يمكن تغيير مورّد الفاتورة ولا رقمها ولا تاريخها ولا مبلغها",
    ckb: "دابینکەر، ژمارە، بەروار و بڕی پارەی پسووڵە ناگۆڕدرێن",
  },
  "This bill is already cancelled": {
    ar: "هذه الفاتورة ملغاة بالفعل",
    ckb: "ئەم پسووڵەیە پێشتر هەڵوەشێنراوەتەوە",
  },
  "Cancelling a bill needs a date and a reason": {
    ar: "يحتاج إلغاء الفاتورة إلى تاريخ وسبب",
    ckb: "هەڵوەشاندنەوەی پسووڵە پێویستی بە بەروار و هۆکار هەیە",
  },
  "A bill with payments against it cannot be cancelled": {
    ar: "لا يمكن إلغاء فاتورة سُدّدت عليها دفعات",
    ckb: "پسووڵەیەک کە پارەی لەسەر دراوە هەڵناوەشێنرێتەوە",
  },
  "Payments of {1} would exceed the bill total of {2}": {
    ar: "مدفوعات قدرها {1} ستتجاوز مجموع الفاتورة البالغ {2}",
    ckb: "پارەدانی {1} لە کۆی گشتی پسووڵەکە ({2}) زیاتر دەبێت",
  },
  "Choose a supplier": { ar: "اختر مورّدًا", ckb: "دابینکەرێک هەڵبژێرە" },
  "Enter an amount greater than zero": {
    ar: "أدخل مبلغًا أكبر من الصفر",
    ckb: "بڕە پارەیەک لە سفر زیاتر بنووسە",
  },
  "Numbers like {1} are the café's own and are given automatically: leave the box as it is, or type the supplier's invoice number":
    {
      ar: "الأرقام مثل {1} خاصة بالمقهى وتُعطى تلقائيًا: اترك الخانة كما هي، أو اكتب رقم فاتورة المورّد",
      ckb: "ژمارەی وەک {1} هی خودی کافێکەن و خۆکارانە دەدرێن: خانەکە وەک خۆی بهێڵەرەوە، یان ژمارەی پسووڵەی دابینکەرەکە بنووسە",
    },
  "Invoice {1} from this supplier is already recorded": {
    ar: "الفاتورة {1} من هذا المورّد مسجّلة بالفعل",
    ckb: "پسووڵەی {1} لەم دابینکەرە پێشتر تۆمار کراوە",
  },
  "Receipt not found": { ar: "لم يُعثر على وصل الاستلام", ckb: "وەسڵی وەرگرتنەکە نەدۆزرایەوە" },
  "That receipt is from a different supplier": {
    ar: "وصل الاستلام هذا من مورّد آخر",
    ckb: "ئەو وەسڵی وەرگرتنە هی دابینکەرێکی ترە",
  },
  "That receipt has already been billed": {
    ar: "سُجّلت فاتورة لوصل الاستلام هذا بالفعل",
    ckb: "پێشتر پسووڵە بۆ ئەو وەسڵی وەرگرتنە تۆمار کراوە",
  },
  "That receipt has no payable to bill against: its journal was reversed or never written (see docs/REMEDIATION.md)":
    {
      ar: "لا يوجد على وصل الاستلام هذا مبلغ مستحق للمورّد تُسجَّل عليه فاتورة: فقيده عُكس أو لم يُكتب أصلًا (راجع docs/REMEDIATION.md)",
      ckb: "ئەو وەسڵی وەرگرتنە هیچ قەرزێکی دابینکەری لەسەر نییە بۆ ئەوەی پسووڵەی لەسەر تۆمار بکرێت: تۆمارەکەی هەڵگەڕێندراوەتەوە یان هەرگیز نەنووسراوە (سەیری docs/REMEDIATION.md بکە)",
    },
  "Account {1} cannot take a bill; stock is billed against its goods receipt": {
    ar: "لا تُسجَّل فاتورة على الحساب {1}؛ ففاتورة المخزون تُسجَّل على وصل استلام البضاعة",
    ckb: "هەژماری {1} پسووڵە وەرناگرێت؛ پسووڵەی کۆگا لەسەر وەسڵی وەرگرتنی کاڵاکە تۆمار دەکرێت",
  },
  "Bill not found": { ar: "لم يُعثر على الفاتورة", ckb: "پسووڵەکە نەدۆزرایەوە" },
  "That bill was cancelled; it is not owed": {
    ar: "أُلغيت هذه الفاتورة؛ فلا شيء مستحق عليها",
    ckb: "ئەو پسووڵەیە هەڵوەشێنراوەتەوە؛ هیچ قەرزێکی لەسەر نییە",
  },
  "Say where the money came from: the till, the safe, the bank, a card or the owner": {
    ar: "اذكر من أين جاء المال: درج النقد أو الخزنة أو البنك أو بطاقة أو المالك",
    ckb: "بڵێ پارەکە لە کوێوە هات: دەخیلە، قاسە، بانک، کارت یان خاوەن",
  },
  "That is more than the {1} outstanding on this bill": {
    ar: "هذا أكثر من المبلغ المتبقي على هذه الفاتورة ({1})",
    ckb: "ئەمە لە بڕی ماوەی سەر ئەم پسووڵەیە ({1}) زیاترە",
  },
  "Say why the bill is being cancelled": {
    ar: "اذكر سبب إلغاء الفاتورة",
    ckb: "بڵێ بۆچی پسووڵەکە هەڵدەوەشێنرێتەوە",
  },
  "This bill has payments against it, so it cannot be cancelled": {
    ar: "سُدّدت على هذه الفاتورة دفعات، لذا لا يمكن إلغاؤها",
    ckb: "پارە لەسەر ئەم پسووڵەیە دراوە، بۆیە هەڵناوەشێنرێتەوە",
  },
  "Choose a date that has happened": {
    ar: "اختر تاريخًا ليس في المستقبل",
    ckb: "بەروارێک هەڵبژێرە کە لە داهاتوودا نەبێت",
  },
  "A bill cannot be cancelled before its own date": {
    ar: "لا يمكن إلغاء فاتورة بتاريخ يسبق تاريخها",
    ckb: "پسووڵە بە بەروارێکی پێش بەرواری خۆی هەڵناوەشێنرێتەوە",
  },
  "Describe the expense": { ar: "صِف المصروف", ckb: "وەسفی خەرجییەکە بنووسە" },
  "Account {1} cannot take an expense (stock costs come from their own records)": {
    ar: "لا يُسجَّل مصروف على الحساب {1} (فكلفة المخزون تأتي من سجلاتها الخاصة)",
    ckb: "هەژماری {1} خەرجی وەرناگرێت (تێچووی کۆگا لە تۆمارەکانی خۆیەوە دێت)",
  },

  // Bills and paying suppliers: the suppliers (on Vendors).
  "Name the supplier": { ar: "اكتب اسم المورّد", ckb: "ناوی دابینکەرەکە بنووسە" },
  "There is already a supplier called {1}": {
    ar: "يوجد مورّد باسم {1} بالفعل",
    ckb: "دابینکەرێک بە ناوی {1} پێشتر هەیە",
  },
  "Unknown supplier": { ar: "مورّد غير معروف", ckb: "دابینکەری نەناسراو" },
  "{1} is still owed {2}: pay or cancel their bills before taking them out of use": {
    ar: "ما زال المقهى مدينًا لـ{1} بمبلغ {2}: سدّد فواتيره أو ألغِها قبل إيقاف التعامل معه",
    ckb: "هێشتا {2} قەرزی {1} لەسەر کافێکەیە: پێش لابردنی لە بەکارهێنان، پارەی پسووڵەکانی بدە یان هەڵیانبوەشێنەوە",
  },

  // Stock, counts and receiving: items, their units and levels, and opening stock.
  "Unknown item {1}": { ar: "المادة {1} غير معروفة", ckb: "کاڵای {1} نەناسراوە" },
  'Unit "{1}" is not defined for this item (base unit is {2})': {
    ar: "الوحدة «{1}» غير معرّفة لهذه المادة (وحدتها الأساسية: {2})",
    ckb: "یەکەی «{1}» بۆ ئەم کاڵایە پێناسە نەکراوە (یەکەی بنەڕەت: {2})",
  },
  "Unknown item": { ar: "مادة غير معروفة", ckb: "کاڵای نەناسراو" },
  "Item not found": { ar: "لم يُعثر على المادة", ckb: "کاڵاکە نەدۆزرایەوە" },
  "There is already an item called {1}": {
    ar: "توجد مادة باسم {1} بالفعل",
    ckb: "کاڵایەک بە ناوی {1} پێشتر هەیە",
  },
  "Name the item": { ar: "اكتب اسم المادة", ckb: "ناوی کاڵاکە بنووسە" },
  "Give the item a base unit": {
    ar: "حدّد للمادة وحدة أساسية",
    ckb: "یەکەیەکی بنەڕەت بۆ کاڵاکە دیاری بکە",
  },
  "Unit {1} needs a positive factor": {
    ar: "تحتاج الوحدة {1} إلى معامل تحويل أكبر من الصفر",
    ckb: "یەکەی {1} پێویستی بە ڕێژەی گۆڕینی لە سفر زیاتر هەیە",
  },
  "Levels cannot be negative": {
    ar: "لا يمكن أن تكون حدود المخزون سالبة",
    ckb: "ئاستەکانی کۆگا ناتوانن لە سفر کەمتر بن",
  },
  "Name the unit, such as case_24": {
    ar: "اكتب اسم الوحدة، مثل case_24",
    ckb: "ناوی یەکەکە بنووسە، وەک case_24",
  },
  "Say how many {1} one {2} holds": {
    ar: "اذكر كم {1} يحوي {2} الواحد",
    ckb: "بڵێ یەک {2} چەند {1} دەگرێت",
  },
  "{1} already has a unit called {2}: a unit in use keeps its size, so give a new size its own name":
    {
      ar: "لـ{1} وحدة باسم {2} بالفعل: الوحدة المستخدمة تحتفظ بحجمها، فأعطِ الحجم الجديد اسمًا خاصًا به",
      ckb: "{1} پێشتر یەکەیەکی بە ناوی {2} هەیە: یەکەی بەکارهاتوو قەبارەکەی ناگۆڕێت، بۆیە ناوێکی تایبەت بدە بە قەبارە نوێیەکە",
    },
  "One {1} is 1000 {2}": { ar: "{1} الواحد يساوي 1000 {2}", ckb: "یەک {1} دەکاتە 1000 {2}" },
  // Too few words of its own to be matched against a whole message, so the messages
  // add_item_unit() says with it are here as they are: the unit as it was typed.
  "One kg is 1000 g": { ar: "kg الواحد يساوي 1000 g", ckb: "یەک kg دەکاتە 1000 g" },
  "One Kg is 1000 g": { ar: "Kg الواحد يساوي 1000 g", ckb: "یەک Kg دەکاتە 1000 g" },
  "One KG is 1000 g": { ar: "KG الواحد يساوي 1000 g", ckb: "یەک KG دەکاتە 1000 g" },
  "One l is 1000 ml": { ar: "l الواحد يساوي 1000 ml", ckb: "یەک l دەکاتە 1000 ml" },
  "One L is 1000 ml": { ar: "L الواحد يساوي 1000 ml", ckb: "یەک L دەکاتە 1000 ml" },
  "{1} still has {2} {3} in stock: count it to nothing or write it off before taking it out of use":
    {
      ar: "ما زال في المخزون {2} {3} من {1}: سجّل له جردًا بصفر أو اشطبه قبل إيقاف استخدامه",
      ckb: "هێشتا {2} {3} لە {1} لە کۆگادا ماوە: پێش لابردنی لە بەکارهێنان، بە ژماردن بیگەیەنە سفر یان وەک بەفیڕۆچوو تۆماری بکە",
    },
  "{1} is in a recipe in force or to come: change the recipe first": {
    ar: "{1} داخل في وصفة سارية أو ستسري لاحقًا: غيّر الوصفة أولًا",
    ckb: "{1} لە ڕەسەتەیەکی بەرکار یان داهاتوودا هەیە: سەرەتا ڕەسەتەکە بگۆڕە",
  },
  "{1} is what a batch recipe makes: stop using that batch recipe first": {
    ar: "{1} هو ما تُنتجه وصفة إنتاج: أوقف استخدام تلك الوصفة أولًا",
    ckb: "{1} ئەوەیە کە ڕەسەتەیەکی بەرهەمهێنان دروستی دەکات: سەرەتا وازی لەو ڕەسەتەیە بهێنە",
  },
  "{1} is sold as bought on the till: hide that product first": {
    ar: "يُعاد بيع {1} كما اشتُري على نقطة البيع: أخفِ ذلك المنتج أولًا",
    ckb: "{1} وەک خۆی لەسەر خاڵی فرۆشتن دەفرۆشرێتەوە: سەرەتا ئەو بەرهەمە بشارەوە",
  },
  "Only the owner records opening stock: it is capital the owner puts in": {
    ar: "وحده المالك يسجّل المخزون الافتتاحي: فهو رأس مال يضعه المالك",
    ckb: "تەنها خاوەن کۆگای سەرەتا تۆمار دەکات: ئەوە سەرمایەیەکە کە خاوەن دایدەنێت",
  },
  "Enter the quantity on the shelf": {
    ar: "أدخل الكمية الموجودة على الرف",
    ckb: "ئەو بڕەی لەسەر ڕەفەکەیە بنووسە",
  },
  "Enter what one {1} of {2} cost": {
    ar: "أدخل كلفة {1} واحد من {2}",
    ckb: "تێچووی یەک {1} لە {2} بنووسە",
  },
  "{1} already has stock recorded here. Correct it with a count or a stock correction": {
    ar: "لـ{1} مخزون مسجّل هنا بالفعل. صحّحه بجرد أو بتصحيح مخزون",
    ckb: "کۆگای {1} پێشتر لێرە تۆمار کراوە. بە ژماردن یان ڕاستکردنەوەی کۆگا ڕاستی بکەرەوە",
  },
  "That stock is worth nothing at this cost: check the quantity and the cost": {
    ar: "قيمة هذا المخزون صفر بهذه الكلفة: تحقّق من الكمية والكلفة",
    ckb: "بەم تێچووە ئەم کۆگایە هیچ بەهایەکی نییە: بڕ و تێچووەکە بپشکنە",
  },
  "Opening stock needs a unit cost": {
    ar: "يحتاج المخزون الافتتاحي إلى كلفة للوحدة",
    ckb: "کۆگای سەرەتا پێویستی بە تێچووی یەکە هەیە",
  },

  // Stock, counts and receiving: waste and stock corrections.
  "Not a waste type: {1}": { ar: "ليس من أنواع الهدر: {1}", ckb: "جۆرێکی بەفیڕۆچوون نییە: {1}" },
  "Say why the stock was lost": {
    ar: "اذكر سبب فقدان المخزون",
    ckb: "بڵێ بۆچی کۆگاکە لەدەستچوو",
  },
  "Enter a quantity greater than zero": {
    ar: "أدخل كمية أكبر من الصفر",
    ckb: "بڕێک لە سفر زیاتر بنووسە",
  },
  "This much waste needs a manager to record it": {
    ar: "هدرٌ بهذا القدر يحتاج إلى مدير لتسجيله",
    ckb: "ئەم بڕە بەفیڕۆچوونە پێویستی بە بەڕێوەبەرە بۆ تۆمارکردنی",
  },
  "Say why the stock is being corrected": {
    ar: "اذكر سبب تصحيح المخزون",
    ckb: "بڵێ بۆچی کۆگاکە ڕاست دەکرێتەوە",
  },
  "The correction cannot be zero": {
    ar: "لا يمكن أن يكون التصحيح صفرًا",
    ckb: "ڕاستکردنەوەکە ناتوانێت سفر بێت",
  },
  "Unit cost cannot be negative": {
    ar: "لا يمكن أن تكون كلفة الوحدة سالبة",
    ckb: "تێچووی یەکە ناتوانێت لە سفر کەمتر بێت",
  },

  // Stock, counts and receiving: the stock count, counted blind and approved by someone else.
  "A submitted stock count cannot be deleted": {
    ar: "لا يمكن حذف جرد مُرسَل للمراجعة",
    ckb: "ژماردنی نێردراو ناسڕدرێتەوە",
  },
  "A stock count starts open; it is submitted and approved separately": {
    ar: "يبدأ جرد المخزون مفتوحًا؛ ثم يُرسَل للمراجعة ويُعتمد في خطوتين منفصلتين",
    ckb: "ژماردنی کۆگا بە کراوەیی دەست پێدەکات؛ ناردن و پەسەندکردنی دوو هەنگاوی جیاوازن",
  },
  "Stock count is {1} and cannot change": {
    ar: "الجرد {1} ولا يمكن تغييره",
    ckb: "ژماردنەکە {1} و ناگۆڕدرێت",
  },
  "A submitted count may only be approved or rejected": {
    ar: "الجرد المُرسَل للمراجعة لا يمكن إلا اعتماده أو رفضه",
    ckb: "ژماردنی نێردراو تەنها پەسەند دەکرێت یان ڕەت دەکرێتەوە",
  },
  "A stock count must be approved by someone other than the person who counted it": {
    ar: "يجب أن يعتمد جردَ المخزون شخصٌ غير الذي أجراه",
    ckb: "دەبێت کەسێکی جگە لەو کەسەی کۆگاکەی ژماردووە ژماردنەکە پەسەند بکات",
  },
  "The expected quantity is recorded by the system and cannot be edited": {
    ar: "الكمية المتوقعة يسجّلها النظام ولا يمكن تعديلها",
    ckb: "بڕی چاوەڕوانکراو سیستەمەکە تۆماری دەکات و دەستکاری ناکرێت",
  },
  "Lines of a {1} stock count cannot change": {
    ar: "لا يمكن تغيير أسطر جرد {1}",
    ckb: "هێڵەکانی ژماردنێک کە {1} ناگۆڕدرێن",
  },
  "A count is already {1} here (started {2} by {3}). Finish or cancel it first": {
    ar: "يوجد هنا جرد {1} بالفعل (بدأه {3} في {2}). أنهِه أو ألغِه أولًا",
    ckb: "لێرە ژماردنێک هەیە کە {1} ({3} لە {2} دەستی پێکردووە). سەرەتا تەواوی بکە یان هەڵیبوەشێنەوە",
  },
  "Count not found": { ar: "لم يُعثر على الجرد", ckb: "ژماردنەکە نەدۆزرایەوە" },
  "Only the person counting can enter counts": {
    ar: "وحده القائم بالجرد يستطيع إدخال الكميات المعدودة",
    ckb: "تەنها ئەو کەسەی دەژمێرێت دەتوانێت ژمارەکان بنووسێت",
  },
  "This count is already {1}": { ar: "هذا الجرد {1} بالفعل", ckb: "ئەم ژماردنە پێشتر {1}" },
  "That item is not in this count": {
    ar: "هذه المادة ليست ضمن هذا الجرد",
    ckb: "ئەو کاڵایە لەم ژماردنەدا نییە",
  },
  "Only the person counting can submit": {
    ar: "وحده القائم بالجرد يستطيع إرساله للمراجعة",
    ckb: "تەنها ئەو کەسەی دەژمێرێت دەتوانێت ژماردنەکە بنێرێت",
  },
  "Some items have not been counted yet": {
    ar: "بعض المواد لم تُعَدّ بعد",
    ckb: "هەندێک کاڵا هێشتا نەژمێردراون",
  },
  "Only a submitted count can be approved; this one is {1}": {
    ar: "لا يُعتمد إلا جرد مُرسَل للمراجعة؛ وهذا الجرد {1}",
    ckb: "تەنها ژماردنی نێردراو پەسەند دەکرێت؛ ئەم ژماردنە {1}",
  },
  "A count must be approved by someone other than the person who counted it": {
    ar: "يجب أن يعتمد الجردَ شخصٌ غير الذي أجراه",
    ckb: "دەبێت کەسێکی جگە لەو کەسەی ژماردنەکەی کردووە پەسەندی بکات",
  },
  "Only a submitted count can be rejected": {
    ar: "لا يُرفض إلا جرد مُرسَل للمراجعة",
    ckb: "تەنها ژماردنی نێردراو ڕەت دەکرێتەوە",
  },
  "Say why the count is rejected": {
    ar: "اذكر سبب رفض الجرد",
    ckb: "بڵێ بۆچی ژماردنەکە ڕەت دەکرێتەوە",
  },
  "Say why the count is cancelled": {
    ar: "اذكر سبب إلغاء الجرد",
    ckb: "بڵێ بۆچی ژماردنەکە هەڵدەوەشێنرێتەوە",
  },
  "Only a count still being counted can be cancelled; a submitted count is approved or rejected by its reviewer":
    {
      ar: "لا يُلغى إلا جرد ما زال قيد العدّ؛ أما الجرد المُرسَل للمراجعة فيعتمده مراجِعه أو يرفضه",
      ckb: "تەنها ئەو ژماردنە هەڵدەوەشێنرێتەوە کە هێشتا لە ژماردندایە؛ ژماردنی نێردراو ئەو کەسەی پێیدا دەچێتەوە پەسەندی دەکات یان ڕەتی دەکاتەوە",
    },
  "Only the person counting or a manager can cancel this count": {
    ar: "وحده القائم بالجرد أو المدير يستطيع إلغاء هذا الجرد",
    ckb: "تەنها ئەو کەسەی دەژمێرێت یان بەڕێوەبەر دەتوانێت ئەم ژماردنە هەڵبوەشێنێتەوە",
  },

  // Stock, counts and receiving: goods received from a supplier.
  "Choose an active supplier": { ar: "اختر مورّدًا نشطًا", ckb: "دابینکەرێکی چالاک هەڵبژێرە" },
  "Freight, other costs and rebates cannot be negative": {
    ar: "لا يمكن أن تكون أجور الشحن والكلف الأخرى وخصومات المورّد سالبة",
    ckb: "کرێی گواستنەوە، تێچووەکانی تر و داشکاندنەکانی دابینکەر ناتوانن لە سفر کەمتر بن",
  },
  "Unknown item on the receipt": {
    ar: "مادة غير معروفة في وصل الاستلام",
    ckb: "کاڵایەکی نەناسراو لە وەسڵی وەرگرتنەکەدا",
  },
  "{1} is out of use: bring it back into use first": {
    ar: "{1} خارج الاستخدام: أعِده إلى الاستخدام أولًا",
    ckb: "{1} لە بەکارهێنان لابراوە: سەرەتا بیگەڕێنەوە بۆ بەکارهێنان",
  },
  "Every received line needs a quantity": {
    ar: "يحتاج كل سطر مستلم إلى كمية",
    ckb: "هەموو هێڵێکی وەرگیراو پێویستی بە بڕ هەیە",
  },
  "Every received line needs a price": {
    ar: "يحتاج كل سطر مستلم إلى سعر",
    ckb: "هەموو هێڵێکی وەرگیراو پێویستی بە نرخ هەیە",
  },
  "Check the price: {1}. If it is right, confirm it and receive again": {
    ar: "تحقّق من السعر: {1}. إن كان صحيحًا فأكّده واستلم مرة أخرى",
    ckb: "نرخەکە بپشکنە: {1}. ئەگەر ڕاستە، دڵنیای بکەرەوە و دووبارە وەری بگرە",
  },
  "Goods value must be greater than zero to allocate landed costs": {
    ar: "يجب أن تكون قيمة البضاعة أكبر من الصفر لتوزيع كلف الشحن والمصاريف الأخرى",
    ckb: "بەهای کاڵاکان دەبێت لە سفر زیاتر بێت بۆ ئەوەی کرێی گواستنەوە و تێچووەکانی تر دابەش بکرێن",
  },
  "The rebate exceeds the value of a received line": {
    ar: "خصم المورّد أكبر من قيمة أحد الأسطر المستلمة",
    ckb: "داشکاندنی دابینکەر لە بەهای یەکێک لە هێڵە وەرگیراوەکان زیاترە",
  },

  // The menu: products, their categories, pictures and prices.
  "Name the product": { ar: "اكتب اسم المنتج", ckb: "ناوی بەرهەمەکە بنووسە" },
  "Product not found": { ar: "لم يُعثر على المنتج", ckb: "بەرهەمەکە نەدۆزرایەوە" },
  "Unknown product": { ar: "منتج غير معروف", ckb: "بەرهەمی نەناسراو" },
  "There is already a product called {1}": {
    ar: "يوجد منتج باسم {1} بالفعل",
    ckb: "بەرهەمێک بە ناوی {1} پێشتر هەیە",
  },
  "Name the category": { ar: "اكتب اسم الفئة", ckb: "ناوی پۆلەکە بنووسە" },
  "Category not found": { ar: "لم يُعثر على الفئة", ckb: "پۆلەکە نەدۆزرایەوە" },
  "Unknown category": { ar: "فئة غير معروفة", ckb: "پۆلی نەناسراو" },
  "There is already a category called {1}": {
    ar: "توجد فئة باسم {1} بالفعل",
    ckb: "پۆلێک بە ناوی {1} پێشتر هەیە",
  },
  "The picture could not be read": { ar: "تعذّرت قراءة الصورة", ckb: "وێنەکە نەخوێندرایەوە" },
  "That file is not a PNG, JPEG or WebP picture": {
    ar: "هذا الملف ليس صورة بصيغة PNG أو JPEG أو WebP",
    ckb: "ئەو فایلە وێنەی PNG، JPEG یان WebP نییە",
  },
  "Enter a price": { ar: "أدخل سعرًا", ckb: "نرخێک بنووسە" },
  "A price cannot start in the past: every sale keeps the price it was made at": {
    ar: "لا يمكن أن يبدأ سعر في الماضي: فكل بيع يحتفظ بالسعر الذي تم به",
    ckb: "نرخ ناتوانێت لە ڕابردوودا دەست پێبکات: هەر فرۆشتنێک بەو نرخە دەمێنێتەوە کە پێی کراوە",
  },
  "Price not found": { ar: "لم يُعثر على السعر", ckb: "نرخەکە نەدۆزرایەوە" },
  "That price is already in force: set a new price instead": {
    ar: "هذا السعر ساري بالفعل: حدّد سعرًا جديدًا بدلًا من ذلك",
    ckb: "ئەو نرخە پێشتر بەرکارە: لە جیاتی ئەوە نرخێکی نوێ دابنێ",
  },
  "Say why the change is cancelled": {
    ar: "اذكر سبب إلغاء التغيير",
    ckb: "بڵێ بۆچی گۆڕانکارییەکە هەڵدەوەشێنرێتەوە",
  },

  // The menu: what a product takes from stock, through its recipe or sold as bought.
  "Unknown recipe": { ar: "وصفة غير معروفة", ckb: "ڕەسەتەی نەناسراو" },
  "Recipe not found": { ar: "لم يُعثر على الوصفة", ckb: "ڕەسەتەکە نەدۆزرایەوە" },
  "Recipe nesting is too deep or cyclic (recipe {1})": {
    ar: "تداخل الوصفات عميق جدًا أو دائري (الوصفة {1})",
    ckb: "ڕەسەتەکان زۆر قووڵ یان بازنەیی تێکهەڵکێش کراون (ڕەسەتەی {1})",
  },
  "Recipe {1} has no version in force on {2}": {
    ar: "ليس للوصفة {1} نسخة سارية في {2}",
    ckb: "ڕەسەتەی {1} لە {2} هیچ وەشانێکی بەرکاری نییە",
  },
  "A new recipe version cannot start in the past": {
    ar: "لا يمكن أن تبدأ نسخة جديدة من الوصفة في الماضي",
    ckb: "وەشانی نوێی ڕەسەتە ناتوانێت لە ڕابردوودا دەست پێبکات",
  },
  "A recipe change cannot start in the past": {
    ar: "لا يمكن أن يبدأ تغيير الوصفة في الماضي",
    ckb: "گۆڕینی ڕەسەتە ناتوانێت لە ڕابردوودا دەست پێبکات",
  },
  "That recipe is already in force: change the recipe again instead": {
    ar: "هذه الوصفة سارية بالفعل: غيّر الوصفة مرة أخرى بدلًا من ذلك",
    ckb: "ئەو ڕەسەتەیە پێشتر بەرکارە: لە جیاتی ئەوە ڕەسەتەکە دووبارە بگۆڕە",
  },
  "List what goes into it": {
    ar: "اذكر ما يدخل في تركيبه",
    ckb: "ئەو شتانە بنووسە کە تێیدا بەکاردێن",
  },
  "Unknown item in the recipe": {
    ar: "مادة غير معروفة في الوصفة",
    ckb: "کاڵایەکی نەناسراو لە ڕەسەتەکەدا",
  },
  "Every recipe line needs a quantity": {
    ar: "يحتاج كل سطر في الوصفة إلى كمية",
    ckb: "هەموو هێڵێکی ڕەسەتە پێویستی بە بڕ هەیە",
  },
  "List what one serving uses, or say why it uses no stock": {
    ar: "اذكر ما تستهلكه الحصة الواحدة، أو اذكر لماذا لا تستهلك شيئًا من المخزون",
    ckb: "ئەوە بنووسە کە یەک بەش بەکاری دەهێنێت، یان بڵێ بۆچی هیچ لە کۆگا بەکارناهێنێت",
  },
  "This product is sold as bought: it has no recipe to change": {
    ar: "يُعاد بيع هذا المنتج كما اشتُري: فليس له وصفة تُغيَّر",
    ckb: "ئەم بەرهەمە وەک خۆی دەفرۆشرێتەوە: هیچ ڕەسەتەیەکی نییە بۆ گۆڕین",
  },
  "This product is sold as bought: it takes its item from stock": {
    ar: "يُعاد بيع هذا المنتج كما اشتُري: فهو يأخذ مادته من المخزون",
    ckb: "ئەم بەرهەمە وەک خۆی دەفرۆشرێتەوە: کاڵاکەی لە کۆگاوە وەردەگرێت",
  },
  "It has a recipe in force: it takes its stock through it": {
    ar: "له وصفة سارية: فهو يأخذ مخزونه من خلالها",
    ckb: "ڕەسەتەیەکی بەرکاری هەیە: کۆگاکەی لە ڕێگەی ئەوەوە وەردەگرێت",
  },

  // Production: batch recipes, and the batches made from them.
  "Name what the batch makes": {
    ar: "اكتب اسم ما تُنتجه دفعة الإنتاج",
    ckb: "ناوی ئەوە بنووسە کە دەستەکە بەرهەمی دەهێنێت",
  },
  "Batch recipe not found": {
    ar: "لم يُعثر على وصفة الإنتاج",
    ckb: "ڕەسەتەی بەرهەمهێنانەکە نەدۆزرایەوە",
  },
  "You already keep an item called {1}: choose it as what the batch makes": {
    ar: "لديك بالفعل مادة باسم {1}: اخترها على أنها ما تُنتجه دفعة الإنتاج",
    ckb: "پێشتر کاڵایەکت بە ناوی {1} هەیە: وەک ئەوەی دەستەکە بەرهەمی دەهێنێت هەڵیبژێرە",
  },
  '"{1}" is already a unit: name the container, such as pan or tray': {
    ar: "«{1}» وحدة قياس أصلًا: اكتب اسم الوعاء، مثل قالب أو صينية",
    ckb: "«{1}» خۆی یەکەیە: ناوی دەفرەکە بنووسە، وەک قاپ یان سینی",
  },
  "Say how much one batch makes": {
    ar: "اذكر كم تُنتج دفعة الإنتاج الواحدة",
    ckb: "بڵێ یەک دەستە چەند بەرهەم دەهێنێت",
  },
  "A batch cannot use what it makes": {
    ar: "لا يمكن لدفعة الإنتاج أن تستخدم ما تُنتجه",
    ckb: "دەستە ناتوانێت ئەوە بەکاربهێنێت کە خۆی بەرهەمی دەهێنێت",
  },
  "Choose what was made": { ar: "اختر ما تم إنتاجه", ckb: "ئەوە هەڵبژێرە کە بەرهەم هێنرا" },
  "{1} is not made any more: show it again to record a batch": {
    ar: "لم يعد {1} يُنتَج: أعِد إظهاره لتسجيل دفعة إنتاج",
    ckb: "{1} چیتر بەرهەم ناهێنرێت: دووبارە پیشانی بدەرەوە بۆ تۆمارکردنی دەستەیەک",
  },
  "Enter how many batches were made": {
    ar: "أدخل عدد دفعات الإنتاج",
    ckb: "بنووسە چەند دەستە بەرهەم هێنرا",
  },
  "{1} has no ingredients in force today": {
    ar: "ليس لـ{1} مكوّنات سارية اليوم",
    ckb: "{1} ئەمڕۆ هیچ پێکهاتەیەکی بەرکاری نییە",
  },
  "{1} has no ingredients": { ar: "ليس لـ{1} أي مكوّنات", ckb: "{1} هیچ پێکهاتەیەکی نییە" },
  "Enter what came out, or leave it empty if it came out as the recipe says": {
    ar: "أدخل الكمية الناتجة، أو اترك الخانة فارغة إن جاءت كما تقول الوصفة",
    ckb: "ئەوەی دەرچوو بنووسە، یان بە بەتاڵی بیهێڵەرەوە ئەگەر وەک ڕەسەتەکە دەرچوو",
  },
  "Say why the batch is cancelled": {
    ar: "اذكر سبب إلغاء دفعة الإنتاج",
    ckb: "بڵێ بۆچی دەستەکە هەڵدەوەشێنرێتەوە",
  },
  "Batch not found": { ar: "لم يُعثر على دفعة الإنتاج", ckb: "دەستەکە نەدۆزرایەوە" },
  "This batch is already cancelled": {
    ar: "دفعة الإنتاج هذه ملغاة بالفعل",
    ckb: "ئەم دەستەیە پێشتر هەڵوەشێنراوەتەوە",
  },
  "Only a recorded batch can be cancelled": {
    ar: "لا تُلغى إلا دفعة إنتاج مسجّلة",
    ckb: "تەنها دەستەی تۆمارکراو هەڵدەوەشێنرێتەوە",
  },

  // Journals, periods and the books: the chart of accounts.
  "Account {1} is in use and cannot be deleted; deactivate it instead": {
    ar: "الحساب {1} مستخدم ولا يمكن حذفه؛ عطّله بدلًا من ذلك",
    ckb: "هەژماری {1} بەکارهاتووە و ناسڕدرێتەوە؛ لە جیاتی ئەوە ناچالاکی بکە",
  },
  "System account {1} may be renamed but not re-coded or re-typed": {
    ar: "يمكن تغيير اسم حساب النظام {1}، لا رمزه ولا نوعه",
    ckb: "ناوی هەژماری سیستەمی {1} دەگۆڕدرێت، بەڵام کۆد و جۆرەکەی ناگۆڕدرێن",
  },
  "System account {1} cannot be deactivated": {
    ar: "لا يمكن تعطيل حساب النظام {1}",
    ckb: "هەژماری سیستەمی {1} ناچالاک ناکرێت",
  },
  "Account {1} is missing or inactive": {
    ar: "الحساب {1} غير موجود أو معطّل",
    ckb: "هەژماری {1} بوونی نییە یان ناچالاکە",
  },
  "Account {1} has a subledger and cannot take a manual journal; use a receipt, bill, count or payment":
    {
      ar: "للحساب {1} دفتر أستاذ مساعد، فلا يقبل قيدًا يدويًا؛ استخدم وصل استلام أو فاتورة أو جردًا أو دفعة",
      ckb: "هەژماری {1} دەفتەری یاریدەدەری هەیە و تۆماری دەستی وەرناگرێت؛ وەسڵی وەرگرتن، پسووڵە، ژماردن یان پارەدان بەکاربهێنە",
    },

  // Journals, periods and the books: a journal and its lines, published or draft.
  "Journal {1} is published and cannot be deleted; post a reversing entry instead": {
    ar: "القيد {1} مُرحَّل ولا يمكن حذفه؛ رحّل قيدًا عكسيًا بدلًا من ذلك",
    ckb: "تۆماری {1} بڵاوکراوەتەوە و ناسڕدرێتەوە؛ لە جیاتی ئەوە تۆمارێکی پێچەوانە تۆمار بکە",
  },
  "Journal {1} is published and cannot be changed; post a reversing entry instead": {
    ar: "القيد {1} مُرحَّل ولا يمكن تغييره؛ رحّل قيدًا عكسيًا بدلًا من ذلك",
    ckb: "تۆماری {1} بڵاوکراوەتەوە و ناگۆڕدرێت؛ لە جیاتی ئەوە تۆمارێکی پێچەوانە تۆمار بکە",
  },
  "A journal entry cannot change business or legacy status": {
    ar: "لا يمكن تغيير المقهى الذي يتبعه القيد ولا صفته كقيد قديم",
    ckb: "تۆمار ناتوانێت کافێکەی یان دۆخی کۆنبوونی بگۆڕێت",
  },
  "Journal entry {1} does not exist": { ar: "القيد {1} غير موجود", ckb: "تۆماری {1} بوونی نییە" },
  "Lines of a published journal cannot be added, changed or removed; post a reversing entry instead":
    {
      ar: "لا يمكن إضافة أسطر إلى قيد مُرحَّل ولا تغييرها ولا حذفها؛ رحّل قيدًا عكسيًا بدلًا من ذلك",
      ckb: "هێڵەکانی تۆمارێکی بڵاوکراوە زیاد ناکرێن، ناگۆڕدرێن و لانابرێن؛ لە جیاتی ئەوە تۆمارێکی پێچەوانە تۆمار بکە",
    },
  "A journal line cannot be moved to another entry": {
    ar: "لا يمكن نقل سطر قيد إلى قيد آخر",
    ckb: "هێڵی تۆمار ناگوازرێتەوە بۆ تۆمارێکی تر",
  },
  "Journal entry {1} cannot be published with {2} line(s); it needs at least two": {
    ar: "لا يمكن ترحيل القيد {1} وعدد أسطره {2}؛ يحتاج إلى سطرين على الأقل",
    ckb: "تۆماری {1} بە {2} هێڵەوە بڵاو ناکرێتەوە؛ لانیکەم پێویستی بە دوو هێڵ هەیە",
  },
  "Journal entry {1} is unbalanced: debit {2} <> credit {3}": {
    ar: "القيد {1} غير متوازن: المدين {2} لا يساوي الدائن {3}",
    ckb: "تۆماری {1} هاوسەنگ نییە: قەرزار {2} و خاوەن قەرز {3} یەکسان نین",
  },
  "Journal entry {1} moves no amount": {
    ar: "القيد {1} لا يحرّك أي مبلغ",
    ckb: "تۆماری {1} هیچ بڕە پارەیەک ناجوڵێنێت",
  },
  "Journal line amounts cannot be negative (account {1})": {
    ar: "لا يمكن أن تكون مبالغ أسطر القيد سالبة (الحساب {1})",
    ckb: "بڕی پارەی هێڵەکانی تۆمار ناتوانێت لە سفر کەمتر بێت (هەژماری {1})",
  },
  'Entry "{1}" does not balance: debits {2} <> credits {3}': {
    ar: "القيد «{1}» غير متوازن: مجموع المدين {2} لا يساوي مجموع الدائن {3}",
    ckb: "تۆماری «{1}» هاوسەنگ نییە: کۆی قەرزار {2} و کۆی خاوەن قەرز {3} یەکسان نین",
  },
  "Journal entry not found": { ar: "لم يُعثر على القيد", ckb: "تۆمارەکە نەدۆزرایەوە" },
  "Journal not found": { ar: "لم يُعثر على القيد", ckb: "تۆمارەکە نەدۆزرایەوە" },
  "Narrate the journal": { ar: "اكتب شرح القيد", ckb: "ڕوونکردنەوەی تۆمارەکە بنووسە" },
  "Add at least one line": { ar: "أضف سطرًا واحدًا على الأقل", ckb: "لانیکەم یەک هێڵ زیاد بکە" },
  "Cannot publish: debits {1} and credits {2} differ by {3}": {
    ar: "لا يمكن الترحيل: المدين {1} والدائن {2} يختلفان بمقدار {3}",
    ckb: "بڵاو ناکرێتەوە: قەرزار {1} و خاوەن قەرز {2} بە بڕی {3} جیاوازن",
  },
  "No draft journal with that id": {
    ar: "لا توجد مسودة قيد بهذا المعرّف",
    ckb: "هیچ ڕەشنووسێکی تۆمار بەو ناسنامەیە نییە",
  },
  "Only a draft can be discarded; a published journal is corrected by reversing it": {
    ar: "لا تُحذف إلا المسودة؛ أما القيد المُرحَّل فيُصحَّح بعكسه",
    ckb: "تەنها ڕەشنووس دەسڕدرێتەوە؛ تۆماری بڵاوکراوە بە هەڵگەڕاندنەوەی ڕاست دەکرێتەوە",
  },

  // Journals, periods and the books: reversing a journal, and corrections by hand.
  "Only a published entry can be reversed": {
    ar: "لا يُعكس إلا قيد مُرحَّل",
    ckb: "تەنها تۆماری بڵاوکراوە هەڵدەگەڕێندرێتەوە",
  },
  "Journal {1} has already been reversed": {
    ar: "القيد {1} عُكس بالفعل",
    ckb: "تۆماری {1} پێشتر هەڵگەڕێندراوەتەوە",
  },
  "The reversal date must be after the journal date": {
    ar: "يجب أن يكون تاريخ العكس بعد تاريخ القيد",
    ckb: "بەرواری هەڵگەڕاندنەوە دەبێت دوای بەرواری تۆمارەکە بێت",
  },
  "Say why the journal is being reversed": {
    ar: "اذكر سبب عكس القيد",
    ckb: "بڵێ بۆچی تۆمارەکە هەڵدەگەڕێندرێتەوە",
  },
  "A reversal cannot be dated before the entry it reverses ({1})": {
    ar: "لا يمكن أن يسبق تاريخُ العكس تاريخَ القيد الذي يعكسه ({1})",
    ckb: "بەرواری هەڵگەڕاندنەوە ناتوانێت پێش بەرواری ئەو تۆمارە بێت کە هەڵیدەگەڕێنێتەوە ({1})",
  },
  "Journal {1} was written by {2}; correct it there, not by reversing the journal": {
    ar: "القيد {1} ناتج عن {2}؛ صحّحه من هناك، لا بعكس القيد",
    ckb: "سەرچاوەی تۆماری {1}: {2}؛ لەوێ ڕاستی بکەرەوە، نەک بە هەڵگەڕاندنەوەی تۆمارەکە",
  },
  "Say why a control account is being corrected": {
    ar: "اذكر سبب تصحيح حساب رقابي",
    ckb: "بڵێ بۆچی هەژمارێکی کۆنترۆڵ ڕاست دەکرێتەوە",
  },
  "Narrate the correction": { ar: "اكتب شرح التصحيح", ckb: "ڕوونکردنەوەی ڕاستکردنەوەکە بنووسە" },
  "Say why these records are being posted": {
    ar: "اذكر سبب ترحيل هذه السجلات",
    ckb: "بڵێ بۆچی ئەم تۆمارانە دەخرێنە ناو دەفتەرەکانەوە",
  },
  "There is nothing left to post": {
    ar: "لم يبقَ شيء للترحيل",
    ckb: "هیچ شتێک نەماوە بۆ خستنە ناو دەفتەرەکان",
  },

  // Journals, periods and the books: accounting periods, locked and reopened.
  "Accounting periods cannot be deleted": {
    ar: "لا يمكن حذف الفترات المحاسبية",
    ckb: "ماوەکانی ژمێریاری ناسڕدرێنەوە",
  },
  "An accounting period's dates and name cannot change": {
    ar: "لا يمكن تغيير تواريخ الفترة المحاسبية ولا اسمها",
    ckb: "بەروار و ناوی ماوەی ژمێریاری ناگۆڕدرێن",
  },
  "Accounting period is locked; this draft cannot be discarded": {
    ar: "الفترة المحاسبية مقفلة؛ لا يمكن حذف هذه المسودة",
    ckb: "ماوەی ژمێریاری قوفڵ کراوە؛ ئەم ڕەشنووسە ناسڕدرێتەوە",
  },
  "Accounting period is locked; this draft cannot be changed": {
    ar: "الفترة المحاسبية مقفلة؛ لا يمكن تغيير هذه المسودة",
    ckb: "ماوەی ژمێریاری قوفڵ کراوە؛ ئەم ڕەشنووسە ناگۆڕدرێت",
  },
  "Accounting period is locked; journal lines cannot change": {
    ar: "الفترة المحاسبية مقفلة؛ لا يمكن تغيير أسطر القيد",
    ckb: "ماوەی ژمێریاری قوفڵ کراوە؛ هێڵەکانی تۆمار ناگۆڕدرێن",
  },
  "Accounting period {1} is locked; post into an open period or reverse in the current one": {
    ar: "الفترة المحاسبية {1} مقفلة؛ رحّل في فترة مفتوحة أو اعكس القيد في الفترة الحالية",
    ckb: "ماوەی ژمێریاری {1} قوفڵ کراوە؛ لە ماوەیەکی کراوەدا تۆماری بکە یان لە ماوەی ئێستادا هەڵیبگەڕێنەوە",
  },
  "Period not found": { ar: "لم يُعثر على الفترة", ckb: "ماوەکە نەدۆزرایەوە" },
  "Period {1} is already locked": {
    ar: "الفترة {1} مقفلة بالفعل",
    ckb: "ماوەی {1} پێشتر قوفڵ کراوە",
  },
  "Period {1} cannot be locked yet: {2}": {
    ar: "لا يمكن إقفال الفترة {1} بعد: {2}",
    ckb: "ماوەی {1} هێشتا قوفڵ ناکرێت: {2}",
  },
  "Say why the period is being reopened": {
    ar: "اذكر سبب إعادة فتح الفترة",
    ckb: "بڵێ بۆچی ماوەکە دووبارە دەکرێتەوە",
  },
  "Period {1} is not locked": { ar: "الفترة {1} غير مقفلة", ckb: "ماوەی {1} قوفڵ نەکراوە" },
  "Reopen the most recent locked period first": {
    ar: "أعِد فتح آخر فترة مقفلة أولًا",
    ckb: "سەرەتا دوایین ماوەی قوفڵکراو دووبارە بکەرەوە",
  },

  // The drawer and cash: the drawer count, and cash moved between till, safe, bank and owner.
  "A closed trading day cannot be deleted": {
    ar: "لا يمكن حذف يوم عمل مُغلق",
    ckb: "ڕۆژێکی کاری داخراو ناسڕدرێتەوە",
  },
  "This trading day is already closed and cannot change": {
    ar: "يوم العمل هذا مُغلق بالفعل ولا يمكن تغييره",
    ckb: "ئەم ڕۆژی کارە پێشتر داخراوە و ناگۆڕدرێت",
  },
  "The day close is now a drawer count. Refresh the page and count the drawer": {
    ar: "أصبح إغلاق اليوم الآن جردًا لدرج النقد. حدّث الصفحة واجرد درج النقد",
    ckb: "داخستنی ڕۆژ ئێستا ژماردنی دەخیلەیە. پەڕەکە نوێ بکەرەوە و دەخیلەکە بژمێرە",
  },
  "{1} bill(s) are still open. Take payment for them or cancel them before counting the drawer": {
    ar: "ما زالت هناك فواتير مفتوحة: {1}. استلم دفعها أو ألغِها قبل جرد درج النقد",
    ckb: "هێشتا {1} پسووڵە کراوەن. پێش ژماردنی دەخیلە پارەکەیان وەربگرە یان هەڵیانبوەشێنەوە",
  },
  "Enter the cash you counted": { ar: "أدخل النقد الذي عددته", ckb: "ئەو پارەیە بنووسە کە ژماردت" },
  "What stays in the drawer must be between 0 and the {1} counted": {
    ar: "يجب أن يكون ما يبقى في درج النقد بين 0 والمبلغ المعدود ({1})",
    ckb: "ئەوەی لە دەخیلەکەدا دەمێنێتەوە دەبێت لە نێوان 0 و بڕی ژمێردراو ({1}) بێت",
  },
  "Say where the rest of the cash goes: the safe or the bank": {
    ar: "اذكر إلى أين يذهب باقي النقد: الخزنة أم البنك",
    ckb: "بڵێ پارەی ماوە بۆ کوێ دەچێت: قاسە یان بانک",
  },
  "Enter the cash that was in the drawer when trading began after the last close": {
    ar: "أدخل النقد الذي كان في درج النقد عند بدء العمل بعد آخر إغلاق",
    ckb: "ئەو پارەیە بنووسە کە لە دەخیلەکەدا بوو کاتێک کار دوای دوایین داخستن دەستی پێکرد",
  },
  "Cash in and out of the drawer is never deleted": {
    ar: "لا يُحذف أبدًا ما يدخل درج النقد أو يخرج منه",
    ckb: "پارەی هاتوو و دەرچووی دەخیلە هەرگیز ناسڕدرێتەوە",
  },
  "Cash in and out of the drawer cannot change once recorded": {
    ar: "لا يمكن تغيير ما يدخل درج النقد أو يخرج منه بعد تسجيله",
    ckb: "پارەی هاتوو و دەرچووی دەخیلە دوای تۆمارکردن ناگۆڕدرێت",
  },
  "A movement of cash cannot change or be deleted; record the opposite movement": {
    ar: "لا يمكن تغيير حركة نقد ولا حذفها؛ سجّل حركة معاكسة",
    ckb: "گواستنەوەی پارە ناگۆڕدرێت و ناسڕدرێتەوە؛ گواستنەوەیەکی پێچەوانە تۆمار بکە",
  },
  "Move cash between two of: the till, the safe, the bank, the owner": {
    ar: "انقل النقد بين اثنين من: درج النقد، والخزنة، والبنك، والمالك",
    ckb: "پارە لە نێوان دوو لەمانە بگوازەرەوە: دەخیلە، قاسە، بانک، خاوەن",
  },
  "Only the owner takes money out for themselves": {
    ar: "وحده المالك يسحب المال لنفسه",
    ckb: "تەنها خاوەن پارە بۆ خۆی دەردەهێنێت",
  },
  "Say what the money is for": { ar: "اذكر الغرض من هذا المال", ckb: "بڵێ ئەم پارەیە بۆ چییە" },
  "The drawer should hold only {1} — not enough to pay {2}. Move cash into the till first, or pay from the safe, the bank or the owner":
    {
      ar: "يُفترض ألا يحوي درج النقد إلا {1} — وهذا لا يكفي لدفع {2}. انقل نقدًا إلى درج النقد أولًا، أو ادفع من الخزنة أو البنك أو المالك",
      ckb: "دەبێت تەنها {1} لە دەخیلەکەدا بێت — ئەمەش بەشی دانی {2} ناکات. سەرەتا پارە بگوازەرەوە بۆ دەخیلەکە، یان لە قاسە، بانک یان خاوەنەوە بیدە",
    },
  "The safe holds only {1} in the books — not enough to pay {2}. Put the takings in the safe first (Move cash), or say where the money came from":
    {
      ar: "لا تحوي الخزنة في الدفاتر إلا {1} — وهذا لا يكفي لدفع {2}. ضع المقبوضات في الخزنة أولًا (نقل النقد)، أو اذكر من أين جاء المال",
      ckb: "بەپێی دەفتەرەکان تەنها {1} لە قاسەکەدایە — ئەمەش بەشی دانی {2} ناکات. سەرەتا داهاتەکە بخەرە قاسەکەوە (گواستنەوەی پارە)، یان بڵێ پارەکە لە کوێوە هات",
    },

  // Cards and platforms: card takings, settled with what reached the bank.
  "Nothing has been taken by card yet": {
    ar: "لم يُقبض أي شيء بالبطاقة بعد",
    ckb: "هێشتا هیچ پارەیەک بە کارت وەرنەگیراوە",
  },
  "Card takings are settled once the day is over: today's wait until tomorrow": {
    ar: "تُسوّى مقبوضات البطاقات بعد انتهاء اليوم: مقبوضات اليوم تنتظر حتى الغد",
    ckb: "داهاتی کارت دوای تەواوبوونی ڕۆژ یەکلا دەکرێتەوە: هی ئەمڕۆ تا سبەی چاوەڕێ دەکات",
  },
  "Settle the card takings of days that are over: from {1} to {2}": {
    ar: "سوِّ مقبوضات البطاقات للأيام المنتهية: من {1} إلى {2}",
    ckb: "داهاتی کارتی ئەو ڕۆژانە یەکلا بکەرەوە کە تەواو بوون: لە {1} تا {2}",
  },
  "Enter the terminal's total for those days": {
    ar: "أدخل مجموع جهاز البطاقات لتلك الأيام",
    ckb: "کۆی گشتی ئامێری کارت بۆ ئەو ڕۆژانە بنووسە",
  },
  "Enter what reached the bank": { ar: "أدخل ما وصل إلى البنك", ckb: "ئەوەی گەیشتە بانک بنووسە" },
  "The bank cannot receive more than the terminal took: the difference is its fee": {
    ar: "لا يمكن أن يستلم البنك أكثر مما قبضه جهاز البطاقات: فالفرق هو رسومه",
    ckb: "بانک ناتوانێت زیاتر لەوەی ئامێری کارت وەریگرتووە وەربگرێت: جیاوازییەکە کرێیەکەیەتی",
  },
  "Nothing was taken by card on those days": {
    ar: "لم يُقبض أي شيء بالبطاقة في تلك الأيام",
    ckb: "لەو ڕۆژانەدا هیچ پارەیەک بە کارت وەرنەگیراوە",
  },
  "The till took {1} by card and the terminal {2}: say why they differ": {
    ar: "سجّلت نقطة البيع {1} بالبطاقة، وجهاز البطاقات {2}: اذكر سبب الاختلاف",
    ckb: "خاڵی فرۆشتن بە کارت {1} وەرگرتووە و ئامێری کارت {2}: بڵێ بۆچی جیاوازن",
  },
  "The money arrived on a day from {1} to today": {
    ar: "يجب أن يكون المال قد وصل في يوم من {1} حتى اليوم",
    ckb: "دەبێت پارەکە لە ڕۆژێکی نێوان {1} و ئەمڕۆدا گەیشتبێت",
  },
  "That settlement is not in force": {
    ar: "هذه التسوية غير سارية",
    ckb: "ئەو یەکلاکردنەوەیە بەرکار نییە",
  },
  "Cancel the latest settlement first: card takings are settled in order": {
    ar: "ألغِ آخر تسوية أولًا: فمقبوضات البطاقات تُسوّى بالترتيب",
    ckb: "سەرەتا دوایین یەکلاکردنەوە هەڵبوەشێنەوە: داهاتی کارت بە ڕیز یەکلا دەکرێتەوە",
  },
  "Say why it is cancelled": { ar: "اذكر سبب الإلغاء", ckb: "بڵێ بۆچی هەڵدەوەشێنرێتەوە" },

  // Cards and platforms: a delivery platform's orders at the till.
  "{1} is not one of the café's delivery platforms: add it on Delivery Platforms": {
    ar: "{1} ليست من منصات التوصيل لدى المقهى: أضفها من شاشة «منصات التوصيل»",
    ckb: "{1} یەکێک نییە لە پلاتفۆرمەکانی گەیاندنی کافێکە: لە شاشەی «پلاتفۆرمەکانی گەیاندن» زیادی بکە",
  },
  "{1} is no longer in use: bring it back on Delivery Platforms to sell through it": {
    ar: "لم تعد {1} مستخدمة: أعِدها من شاشة «منصات التوصيل» لتبيع من خلالها",
    ckb: "{1} چیتر بەکارنایەت: لە شاشەی «پلاتفۆرمەکانی گەیاندن» بیگەڕێنەوە بۆ ئەوەی لە ڕێگەیەوە بفرۆشیت",
  },
  "Enter the {1} order number": { ar: "أدخل رقم طلب {1}", ckb: "ژمارەی داواکاریی {1} بنووسە" },
  "An order number is letters and digits, as the {1} tablet shows it": {
    ar: "رقم الطلب حروف وأرقام، كما يظهر على جهاز {1} اللوحي",
    ckb: "ژمارەی داواکاری پیت و ژمارەیە، وەک تابلێتی {1} پیشانی دەدات",
  },
  "{1} order {2} is already recorded, on the sale of {3}": {
    ar: "طلب {1} رقم {2} مسجّل بالفعل، على البيع الذي تم في {3}",
    ckb: "داواکاریی {1} ژمارە {2} پێشتر تۆمار کراوە، لەسەر ئەو فرۆشتنەی لە {3} کراوە",
  },

  // Cards and platforms: a platform's statement, and the settlement it pays out.
  "Choose the platform the statement is from": {
    ar: "اختر المنصة التي صدر عنها الكشف",
    ckb: "ئەو پلاتفۆرمە هەڵبژێرە کە کەشفەکە هی ئەوە",
  },
  "The statement has no lines": {
    ar: "لا توجد أسطر في الكشف",
    ckb: "کەشفەکە هیچ هێڵێکی تێدا نییە",
  },
  "Line {1} has no order number": {
    ar: "السطر {1} ليس له رقم طلب",
    ckb: "هێڵی {1} ژمارەی داواکاری نییە",
  },
  "Line {1} (order {2}): the amounts must be numbers": {
    ar: "السطر {1} (الطلب {2}): يجب أن تكون المبالغ أرقامًا",
    ckb: "هێڵی {1} (داواکاریی {2}): بڕەکانی پارە دەبێت ژمارە بن",
  },
  "Line {1} (order {2}) has no payout": {
    ar: "السطر {1} (الطلب {2}) ليس له مبلغ مدفوع",
    ckb: "هێڵی {1} (داواکاریی {2}) بڕی پارەی دراوی نییە",
  },
  "Line {1} (order {2}): commission and fees are what the platform kept, never less than zero": {
    ar: "السطر {1} (الطلب {2}): العمولة والرسوم هي ما احتفظت به المنصة، ولا تكون أقل من الصفر أبدًا",
    ckb: "هێڵی {1} (داواکاریی {2}): کۆمیسیۆن و کرێکان ئەوەن کە پلاتفۆرمەکە هێشتوویەتییەوە، هەرگیز لە سفر کەمتر نین",
  },
  "Nothing on the statement matches a {1} order waiting to be paid out": {
    ar: "لا شيء في الكشف يطابق طلبًا من {1} بانتظار الدفع",
    ckb: "هیچ شتێک لە کەشفەکەدا لەگەڵ داواکارییەکی {1} کە چاوەڕێی پارەدانە یەک ناگرێتەوە",
  },
  "Enter the statement's number or date, as the platform gives it": {
    ar: "أدخل رقم الكشف أو تاريخه كما تعطيه المنصة",
    ckb: "ژمارە یان بەرواری کەشفەکە بنووسە، وەک پلاتفۆرمەکە دەیدات",
  },
  "{1} statement {2} is already recorded": {
    ar: "كشف {1} «{2}» مسجّل بالفعل",
    ckb: "کەشفی {1} «{2}» پێشتر تۆمار کراوە",
  },
  "{1} line(s) of the statement do not match: say what they are": {
    ar: "عدد أسطر الكشف غير المتطابقة: {1}. اذكر ما هي",
    ckb: "{1} هێڵی کەشفەکە یەک ناگرنەوە: بڵێ چین",
  },
  "The payout arrived on a day from {1} to today": {
    ar: "يجب أن تكون دفعة المنصة قد وصلت في يوم من {1} حتى اليوم",
    ckb: "دەبێت پارەی پلاتفۆرمەکە لە ڕۆژێکی نێوان {1} و ئەمڕۆدا گەیشتبێت",
  },

  // Cards and platforms: adding and changing the café's delivery platforms.
  "Give the platform's names by language": {
    ar: "اكتب أسماء المنصة حسب اللغة",
    ckb: "ناوەکانی پلاتفۆرمەکە بەپێی زمان بنووسە",
  },
  "Give each of the platform's names under its language's code (ar, ckb), in up to 60 letters": {
    ar: "اكتب كل اسم من أسماء المنصة تحت رمز لغته (ar, ckb)، في 60 حرفًا على الأكثر",
    ckb: "هەر ناوێکی پلاتفۆرمەکە لە ژێر کۆدی زمانەکەی بنووسە (ar, ckb)، لە 60 پیت زیاتر نەبێت",
  },
  "Name the platform as its customers know it, in up to 60 letters": {
    ar: "اكتب اسم المنصة كما يعرفها زبائنها، في 60 حرفًا على الأكثر",
    ckb: "ناوی پلاتفۆرمەکە وەک کڕیارەکانی دەیناسن بنووسە، لە 60 پیت زیاتر نەبێت",
  },
  "{1} is already a delivery platform here": {
    ar: "{1} منصة توصيل موجودة هنا بالفعل",
    ckb: "{1} پێشتر لێرە پلاتفۆرمێکی گەیاندنە",
  },
  "{1} is already a delivery platform here: bring it back into use instead of adding it again": {
    ar: "{1} منصة توصيل موجودة هنا بالفعل: أعِدها إلى الاستخدام بدلًا من إضافتها مجددًا",
    ckb: "{1} پێشتر لێرە پلاتفۆرمێکی گەیاندنە: لە جیاتی دووبارە زیادکردنی، بیگەڕێنەوە بۆ بەکارهێنان",
  },
  "A platform's short name is small Latin letters, digits and _, starting with a letter (lezzoo)": {
    ar: "الاسم المختصر للمنصة أحرف لاتينية صغيرة وأرقام و _، ويبدأ بحرف (lezzoo)",
    ckb: "ناوی کورتی پلاتفۆرم لە پیتی لاتینی بچووک، ژمارە و _ پێکدێت و بە پیتێک دەست پێدەکات (lezzoo)",
  },
  "{1} is one of the shop's own ways of selling, not a platform": {
    ar: "{1} إحدى طرق البيع الخاصة بالمقهى، وليست منصة",
    ckb: "{1} یەکێکە لە شێوازەکانی فرۆشتنی خودی کافێکە، نەک پلاتفۆرم",
  },
  "A platform here already has the short name {1}: bring it back into use, or choose another": {
    ar: "لدى منصة هنا الاسم المختصر {1} بالفعل: أعِدها إلى الاستخدام، أو اختر اسمًا آخر",
    ckb: "ناوی کورتی {1} پێشتر هی پلاتفۆرمێکی ئێرەیە: بیگەڕێنەوە بۆ بەکارهێنان، یان ناوێکی تر هەڵبژێرە",
  },
  "Choose one of the café's delivery platforms": {
    ar: "اختر إحدى منصات التوصيل لدى المقهى",
    ckb: "یەکێک لە پلاتفۆرمەکانی گەیاندنی کافێکە هەڵبژێرە",
  },
  "{1} is not in use: bring it back first": {
    ar: "{1} غير مستخدمة: أعِدها إلى الاستخدام أولًا",
    ckb: "{1} بەکارنایەت: سەرەتا بیگەڕێنەوە",
  },
  "Choose a channel {1} works like": {
    ar: "اختر قناة بيع تعمل {1} على غرارها",
    ckb: "کەناڵێکی فرۆشتن هەڵبژێرە کە {1} وەک ئەو کار بکات",
  },

  // People, roles, PINs and approvals: signing in, and who may do what.
  "Sign in to continue": { ar: "سجّل الدخول للمتابعة", ckb: "بۆ بەردەوامبوون بچۆ ژوورەوە" },
  "Sign in first": { ar: "سجّل الدخول أولًا", ckb: "سەرەتا بچۆ ژوورەوە" },
  // Who works where, and only a branch sells (0055).
  "You work at {1}, not at {2}": {
    ar: "أنت تعمل في {1}، لا في {2}",
    ckb: "تۆ لە {1} کار دەکەیت، نەک لە {2}",
  },
  "{1} does not sell: the till is at a branch": {
    ar: "{1} لا يبيع: نقطة البيع في فرع",
    ckb: "{1} نافرۆشێت: خاڵی فرۆشتن لە لقێکدایە",
  },
  "The owner and the general manager work everywhere": {
    ar: "المالك والمدير العام يعملان في كل مكان",
    ckb: "خاوەن و بەڕێوەبەری گشتی لە هەموو شوێنێک کار دەکەن",
  },
  "Choose one of the café's places": {
    ar: "اختر أحد أماكن المقهى",
    ckb: "یەکێک لە شوێنەکانی کافێکە هەڵبژێرە",
  },
  "Choose one of the café's branches": {
    ar: "اختر أحد فروع المقهى",
    ckb: "یەکێک لە لقەکانی کافێکە هەڵبژێرە",
  },
  "A person works everywhere or at one place: all their roles are at that place": {
    ar: "يعمل الشخص في كل مكان أو في مكان واحد: كل أدواره في ذلك المكان",
    ckb: "کەسێک لە هەموو شوێنێک یان لە یەک شوێن کار دەکات: هەموو ڕۆڵەکانی لەو شوێنەدان",
  },
  "You do not have permission to do this (needs {1})": {
    ar: "ليست لديك صلاحية للقيام بهذا (يتطلب {1})",
    ckb: "مۆڵەتی ئەم کارەت نییە (پێویستی بە {1} هەیە)",
  },
  "Give the person's name and email": {
    ar: "اكتب اسم الشخص وبريده الإلكتروني",
    ckb: "ناو و ئیمەیڵی کەسەکە بنووسە",
  },
  "Only the owner can appoint an owner or general manager": {
    ar: "وحده المالك يستطيع تعيين مالك أو مدير عام",
    ckb: "تەنها خاوەن دەتوانێت خاوەن یان بەڕێوەبەری گشتی دابنێت",
  },
  "Only the owner can give or take the owner and general manager roles": {
    ar: "وحده المالك يستطيع منح دورَي المالك والمدير العام أو سحبهما",
    ckb: "تەنها خاوەن دەتوانێت ڕۆڵی خاوەن و بەڕێوەبەری گشتی بدات یان بسەنێتەوە",
  },
  "Someone with that email is already a member": {
    ar: "يوجد عضو بهذا البريد الإلكتروني بالفعل",
    ckb: "کەسێک بەو ئیمەیڵە پێشتر ئەندامە",
  },
  "You cannot deactivate yourself": {
    ar: "لا يمكنك تعطيل حسابك بنفسك",
    ckb: "ناتوانیت خۆت ناچالاک بکەیت",
  },
  "The business must keep at least one active owner": {
    ar: "يجب أن يبقى للمقهى مالك نشط واحد على الأقل",
    ckb: "کافێکە دەبێت لانیکەم یەک خاوەنی چالاکی هەبێت",
  },
  "Member not found": { ar: "لم يُعثر على العضو", ckb: "ئەندامەکە نەدۆزرایەوە" },

  // People, roles, PINs and approvals: a manager's PIN, and the approvals given with it.
  "Only those who approve discounts, voids, refunds, losses or stock below zero have a PIN": {
    ar: "لا يملك رمز PIN إلا من يوافق على الخصومات أو الإلغاءات أو الاستردادات أو الخسائر أو المخزون دون الصفر",
    ckb: "PIN تەنها بۆ ئەوانەیە کە ڕەزامەندی لەسەر داشکاندن، هەڵوەشاندنەوە، گەڕاندنەوەی پارە، زیان یان کۆگای خوار سفر دەدەن",
  },
  "Choose a PIN that is harder to guess": {
    ar: "اختر رمز PIN أصعب في التخمين",
    ckb: "PIN هەڵبژێرە کە مەزەندەکردنی قورستر بێت",
  },
  "Choose someone who may approve this": {
    ar: "اختر شخصًا يحق له الموافقة على هذا",
    ckb: "کەسێک هەڵبژێرە کە بۆی هەیە ڕەزامەندی لەسەر ئەمە بدات",
  },
  "Someone else approves it: that is the point of asking": {
    ar: "يوافق عليه شخص آخر: فهذا هو الغرض من طلب الموافقة",
    ckb: "کەسێکی تر ڕەزامەندی لەسەر دەدات: مەبەست لە داواکردن ئەوەیە",
  },
  "That approval is not for this": {
    ar: "هذه الموافقة ليست لهذا الإجراء",
    ckb: "ئەو ڕەزامەندییە بۆ ئەم کارە نییە",
  },
  "That approval has been used: ask again": {
    ar: "استُخدمت هذه الموافقة: اطلبها مجددًا",
    ckb: "ئەو ڕەزامەندییە بەکارهاتووە: دووبارە داوا بکەرەوە",
  },
  "That approval has run out: ask again": {
    ar: "انتهت صلاحية هذه الموافقة: اطلبها مجددًا",
    ckb: "ماوەی ئەو ڕەزامەندییە بەسەرچووە: دووبارە داوا بکەرەوە",
  },
  "That approval was given to someone else": {
    ar: "مُنحت هذه الموافقة لشخص آخر",
    ckb: "ئەو ڕەزامەندییە بە کەسێکی تر دراوە",
  },
  "A discount over {1}% needs a manager's approval": {
    ar: "الخصم الذي يتجاوز {1}% يحتاج إلى موافقة المدير",
    ckb: "داشکاندنی سەرووی {1}% پێویستی بە ڕەزامەندیی بەڕێوەبەر هەیە",
  },
  "The manager approved up to {1}%: ask again for this one": {
    ar: "وافق المدير على خصم حتى {1}%: اطلب موافقته مجددًا لهذا الخصم",
    ckb: "بەڕێوەبەر تا {1}% ڕەزامەندی داوە: بۆ ئەمەیان دووبارە داوا بکەرەوە",
  },

  // Settings and alerts: answering an alert, and the thresholds that raise one.
  "That alert has cleared already": {
    ar: "لم يعد هذا التنبيه قائمًا",
    ckb: "ئەو ئاگادارکردنەوەیە پێشتر نەماوە",
  },
  "An alert about your own exceptions is for someone else to review": {
    ar: "التنبيه الخاص باستثناءاتك أنت يراجعه شخص آخر",
    ckb: "ئاگادارکردنەوەی تایبەت بە حاڵەتە نائاساییەکانی خۆت کەسێکی تر پێیدا دەچێتەوە",
  },
  "Say why it can wait": { ar: "اذكر لماذا يمكن أن ينتظر", ckb: "بڵێ بۆچی دەتوانێت چاوەڕێ بکات" },
  "Snooze it until a day in the next 30": {
    ar: "أجّله إلى يوم خلال الـ30 يومًا القادمة",
    ckb: "بۆ ڕۆژێک لە 30 ڕۆژی داهاتوودا دوای بخە",
  },
  "Choose a day that has happened": {
    ar: "اختر يومًا ليس في المستقبل",
    ckb: "ڕۆژێک هەڵبژێرە کە لە داهاتوودا نەبێت",
  },
  "No thresholds given": { ar: "لم تُحدَّد أي حدود", ckb: "هیچ سنوورێک دیاری نەکراوە" },
  "Unknown threshold: {1}": { ar: "حدّ غير معروف: {1}", ckb: "سنووری نەناسراو: {1}" },
  "{1}: enter a number": { ar: "{1}: أدخل رقمًا", ckb: "{1}: ژمارەیەک بنووسە" },
  "{1}: enter a {2} from {3} to {4}": {
    ar: "{1}: المطلوب {2} من {3} إلى {4}",
    ckb: "{1}: {2} بنووسە لە {3} تا {4}",
  },

  // Anything else: the database's own guards on its tables, which a screen should never meet.
  "Table {1} is append-only; {2} is not permitted": {
    ar: "الجدول {1} للإضافة فقط؛ العملية {2} غير مسموح بها",
    ckb: "خشتەی {1} تەنها بۆ زیادکردنە؛ کرداری {2} ڕێگەپێدراو نییە",
  },
  "{1}.{2}: cannot determine the business (no {3})": {
    ar: "{1}.{2}: تعذّر تحديد المقهى (لا يوجد {3})",
    ckb: "{1}.{2}: کافێکە دیاری ناکرێت ({3} نییە)",
  },
  "{1}: business_id does not match its parent {2}": {
    ar: "{1}: قيمة business_id لا تطابق قيمة السجل الأصلي في {2}",
    ckb: "{1}: business_id لەگەڵ تۆماری سەرەکی لە {2} یەک ناگرێتەوە",
  },
  "No active location for this business": {
    ar: "لا يوجد موقع نشط لهذا المقهى",
    ckb: "هیچ شوێنێکی چالاک بۆ ئەم کافێیە نییە",
  },
  "Business not found": { ar: "لم يُعثر على بيانات المقهى", ckb: "زانیاریی کافێکە نەدۆزرایەوە" },

  // Values the database puts into a message. A sale's state: "A sale cannot move from
  // {1} to {2}", "Only a completed sale can be voided; this one is {1}", "Only a completed
  // sale can be refunded; this one is {1}". "open" is also a count's, below.
  open: { ar: "مفتوح", ckb: "کراوە" },
  completed: { ar: "مكتمل", ckb: "تەواوبوو" },
  voided: { ar: "ملغى", ckb: "هەڵوەشێنراوە" },
  refunded: { ar: "مسترد", ckb: "پارەی گەڕێندراوەتەوە" },
  partially_refunded: { ar: "مسترد جزئيًا", ckb: "بەشێکی گەڕێندراوەتەوە" },

  // A stock count's state: "Stock count is {1} and cannot change", "Lines of a {1} stock
  // count cannot change", "This count is already {1}", "Only a submitted count can be
  // approved; this one is {1}"; and "A count is already {1} here (started {2} by {3}).
  // Finish or cancel it first", which says "open" or "waiting for review", and "someone"
  // when it does not know who started it.
  draft: { ar: "مسودة", ckb: "ڕەشنووس" },
  counting: { ar: "قيد العدّ", ckb: "لە ژماردندایە" },
  "waiting for review": { ar: "بانتظار المراجعة", ckb: "چاوەڕێی پێداچوونەوەیە" },
  someone: { ar: "شخص ما", ckb: "کەسێک" },

  // A bill's state at the till: "This bill is {1} and cannot change", "The lines of a {1}
  // bill cannot change", "This bill is already {1}".
  paid: { ar: "مدفوعة", ckb: "پارەی دراوە" },
  missing: { ar: "غير موجودة", ckb: "نەماوە" },

  // What wrote a journal (journal_source_hint): "Journal {1} was written by {2}; correct
  // it there, not by reversing the journal".
  "a sale (void or refund it on Orders)": {
    ar: "بيع (ألغِه أو استردّه من شاشة «الطلبات»)",
    ckb: "فرۆشتنێک (لە شاشەی «داواکارییەکان» هەڵیبوەشێنەوە یان پارەکەی بگەڕێنەوە)",
  },
  "a refund": { ar: "استرداد", ckb: "گەڕاندنەوەی پارە" },
  "a goods receipt": { ar: "وصل استلام بضاعة", ckb: "وەسڵی وەرگرتنی کاڵا" },
  "a bill (cancel it on Vendors)": {
    ar: "فاتورة (ألغِها من شاشة «المورّدون»)",
    ckb: "پسووڵەیەک (لە شاشەی «دابینکەران» هەڵیبوەشێنەوە)",
  },
  "a supplier payment": { ar: "دفعة لمورّد", ckb: "پارەدانێک بە دابینکەر" },
  "a stock record (correct stock with a count or a stock correction)": {
    ar: "حركة مخزون (صحّح المخزون بجرد أو بتصحيح مخزون)",
    ckb: "تۆمارێکی کۆگا (کۆگا بە ژماردن یان ڕاستکردنەوەی کۆگا ڕاست بکەرەوە)",
  },
  "a stock count (correct stock with a new count)": {
    ar: "جرد مخزون (صحّح المخزون بجرد جديد)",
    ckb: "ژماردنی کۆگا (کۆگا بە ژماردنێکی نوێ ڕاست بکەرەوە)",
  },
  "a drawer count": { ar: "جرد درج النقد", ckb: "ژماردنی دەخیلە" },
  "a movement of cash (move it back instead)": {
    ar: "نقل نقد (أعِده إلى مكانه بدلًا من ذلك)",
    ckb: "گواستنەوەی پارە (لە جیاتی ئەوە بیگەڕێنەوە)",
  },
  "a reversal (post the entry again instead)": {
    ar: "عكس قيد (رحّل القيد مرة أخرى بدلًا من ذلك)",
    ckb: "هەڵگەڕاندنەوەیەک (لە جیاتی ئەوە تۆمارەکە دووبارە تۆمار بکەرەوە)",
  },
  "a card settlement (cancel it on Sales)": {
    ar: "تسوية بطاقات (ألغِها من شاشة «المبيعات»)",
    ckb: "یەکلاکردنەوەی کارت (لە شاشەی «فرۆشتن» هەڵیبوەشێنەوە)",
  },
  "a platform settlement (cancel it on Delivery Platforms)": {
    ar: "تسوية منصة (ألغِها من شاشة «منصات التوصيل»)",
    ckb: "یەکلاکردنەوەی پلاتفۆرم (لە شاشەی «پلاتفۆرمەکانی گەیاندن» هەڵیبوەشێنەوە)",
  },
  "a record of type {1}": { ar: "سجل من النوع {1}", ckb: "تۆمارێک لە جۆری {1}" },

  // "Say how many {1} one {2} holds" says "items" for an item counted in pieces.
  items: { ar: "قطعة", ckb: "دانە" },

  // "{1}: enter a {2} from {3} to {4}" asks for a "whole number" or a "number".
  "whole number": { ar: "عدد صحيح", ckb: "ژمارەی تەواو" },
  number: { ar: "رقم", ckb: "ژمارە" },
  // The drawer in sessions (0036), and a key required through the API.
  "Open the drawer first: on the till, count the cash in it": {
    ar: "افتح درج النقد أولًا: في نقطة البيع، عُدّ النقد الذي فيه",
    ckb: "سەرەتا دەخیلەکە بکەرەوە: لە خاڵی فرۆشتن، پارەی ناوی بژمێرە",
  },
  "The drawer does not hold enough to pay {1}. Move cash into the till first, or pay from the safe, the bank or the owner":
    {
      ar: "لا يحوي درج النقد ما يكفي لدفع {1}. انقل نقدًا إلى درج النقد أولًا، أو ادفع من الخزنة أو البنك أو المالك",
      ckb: "دەخیلەکە پارەی پێویستی تێدا نییە بۆ دانی {1}. سەرەتا پارە بگوازەرەوە بۆ دەخیلەکە، یان لە قاسە، بانک یان خاوەنەوە بیدە",
    },
  "This screen sent no retry key: reload the page and try again": {
    ar: "لم ترسل هذه الشاشة مفتاح إعادة المحاولة: أعد تحميل الصفحة وحاول مجددًا",
    ckb: "ئەم شاشەیە کلیلی دووبارە هەوڵدانی نەنارد: پەڕەکە نوێ بکەرەوە و دووبارە هەوڵ بدەوە",
  },
  "The notes counted cannot be read": {
    ar: "لا يمكن قراءة الأوراق النقدية المعدودة",
    ckb: "پارە کاغەزییە ژمێردراوەکان ناخوێندرێنەوە",
  },
  "The notes counted come to {1}, not the {2} entered": {
    ar: "مجموع الأوراق المعدودة {1}، لا {2} كما أُدخل",
    ckb: "کۆی پارە کاغەزییە ژمێردراوەکان {1}ە، نەک ئەو {2}ـەی نووسرا",
  },
  "This branch has no drawer": {
    ar: "لا يوجد درج نقد لهذا الفرع",
    ckb: "ئەم لقە دەخیلەی نییە",
  },
  "The drawer is already open: session {1} since {2}, with {3}": {
    ar: "درج النقد مفتوح بالفعل: الوردية {1} منذ {2}، مع {3}",
    ckb: "دەخیلەکە پێشتر کراوەتەوە: شیفتی {1} لە {2}ەوە، لای {3}",
  },
  "Session not found": {
    ar: "لم يُعثر على الوردية",
    ckb: "شیفتەکە نەدۆزرایەوە",
  },
  "Session {1} is already closed": {
    ar: "الوردية {1} مغلقة بالفعل",
    ckb: "شیفتی {1} پێشتر داخراوە",
  },
  "Enter the cash put in from the safe, or leave it empty": {
    ar: "أدخل النقد الموضوع من الخزنة، أو اتركه فارغًا",
    ckb: "ئەو پارەیەی لە قاسەوە دادەنرێت بنووسە، یان بە بەتاڵی جێی بهێڵە",
  },
  "Only a manager puts cash in from the safe": {
    ar: "المدير وحده يضع نقدًا من الخزنة",
    ckb: "تەنها بەڕێوەبەر پارە لە قاسەوە دادەنێت",
  },
  "The drawer is not open": {
    ar: "درج النقد غير مفتوح",
    ckb: "دەخیلەکە کراوە نییە",
  },
  "Only {1} or a manager closes this session": {
    ar: "لا يغلق هذه الوردية إلا {1} أو مدير",
    ckb: "تەنها {1} یان بەڕێوەبەرێک ئەم شیفتە دادەخات",
  },
  "Choose someone who may take the drawer": {
    ar: "اختر شخصًا يحقّ له استلام درج النقد",
    ckb: "کەسێک هەڵبژێرە کە دەتوانێت دەخیلەکە وەربگرێت",
  },
  "Hand the drawer to someone else": {
    ar: "سلّم درج النقد لشخص آخر",
    ckb: "دەخیلەکە ڕادەستی کەسێکی تر بکە",
  },
  "Say why the session is being closed": {
    ar: "اذكر سبب إغلاق الوردية",
    ckb: "بڵێ بۆچی شیفتەکە دادەخرێت",
  },
  "What an open drawer should hold is shown once it is counted": {
    ar: "ما يجب أن يحويه درج نقد مفتوح يظهر بعد عدّه",
    ckb: "ئەوەی دەبێت لە دەخیلەیەکی کراوەدا بێت دوای ژماردنی پیشان دەدرێت",
  },
  "Open the drawer on the till first: counting it now closes its session": {
    ar: "افتح درج النقد في نقطة البيع أولًا: عدّه الآن يُغلق ورديته",
    ckb: "سەرەتا دەخیلەکە لە خاڵی فرۆشتن بکەرەوە: ژماردنی ئێستا شیفتەکەی دادەخات",
  },

  // A delivery corrected or reversed (0038).
  "A delivery keeps at least one line: to undo all of it, reverse it": {
    ar: "يبقى في التوريد سطر واحد على الأقل: لإلغائه كله، اعكسه",
    ckb: "بار لانیکەم یەک هێڵی تێدا دەمێنێتەوە: بۆ لابردنی هەمووی، هەڵیبگەڕێنەوە",
  },
  "A delivery cannot have arrived after today": {
    ar: "لا يمكن أن يكون التوريد قد وصل بعد اليوم",
    ckb: "بار ناتوانێت دوای ئەمڕۆ گەیشتبێت",
  },
  "A delivery's date is corrected within the month it was entered ({1}): one from another month is reversed and received again":
    {
      ar: "يُصحَّح تاريخ التوريد ضمن الشهر الذي أُدخل فيه ({1}): وتوريد شهر آخر يُعكس ويُستلم من جديد",
      ckb: "بەرواری بار لە ناو ئەو مانگەدا ڕاست دەکرێتەوە کە تێیدا تۆمار کرا ({1}): باری مانگێکی تر هەڵدەگەڕێندرێتەوە و دووبارە وەردەگیرێتەوە",
    },
  "The lines cannot be read": { ar: "تعذّرت قراءة السطور", ckb: "هێڵەکان ناخوێندرێنەوە" },
  "Unknown item on the delivery": {
    ar: "مادة غير معروفة في التوريد",
    ckb: "کاڵایەکی نەناسراو لەسەر بارەکە",
  },
  "That line is not on this delivery": {
    ar: "هذا السطر ليس في هذا التوريد",
    ckb: "ئەو هێڵە لەسەر ئەم بارە نییە",
  },
  "A line is named twice": { ar: "ذُكر سطر مرتين", ckb: "هێڵێک دوو جار ناوی هاتووە" },
  "Every line needs a quantity: to take a line off, leave it out": {
    ar: "كل سطر يحتاج إلى كمية: لحذف سطر، اتركه",
    ckb: "هەموو هێڵێک بڕێکی پێویستە: بۆ لابردنی هێڵێک، دەری بهێنە",
  },
  "Every line needs a price": { ar: "كل سطر يحتاج إلى سعر", ckb: "هەموو هێڵێک نرخێکی پێویستە" },
  "Say why the delivery is being corrected": {
    ar: "اذكر سبب تصحيح التوريد",
    ckb: "بڵێ بۆچی بارەکە ڕاست دەکرێتەوە",
  },
  "Delivery not found": { ar: "لم يُعثر على التوريد", ckb: "بارەکە نەدۆزرایەوە" },
  "Delivery {1} was received before the controls: the owner corrects it on Reports": {
    ar: "استُلم التوريد {1} قبل الضوابط: يصحّحه المالك من التقارير",
    ckb: "باری {1} پێش کۆنترۆڵەکان وەرگیراوە: خاوەن لە ڕاپۆرتەکان ڕاستی دەکاتەوە",
  },
  "Delivery {1} has been billed: cancel its bill on Vendors first, then correct the delivery": {
    ar: "سُجّلت فاتورة التوريد {1}: ألغِ فاتورته من شاشة «المورّدون» أولًا، ثم صحّح التوريد",
    ckb: "پسووڵەی باری {1} تۆمار کراوە: سەرەتا لە شاشەی «دابینکەران» پسووڵەکەی هەڵبوەشێنەوە، پاشان بارەکە ڕاست بکەرەوە",
  },
  "Delivery {1} is in {2}, a locked month: it is no longer corrected": {
    ar: "التوريد {1} في {2}، وهو شهر مقفل: لم يعد يُصحَّح",
    ckb: "باری {1} لە {2}دایە، مانگێکی داخراو: چیتر ڕاست ناکرێتەوە",
  },
  "Delivery {1} was reversed: receive it again instead": {
    ar: "عُكس التوريد {1}: استلمه من جديد بدلًا من ذلك",
    ckb: "باری {1} هەڵگەڕێندراوەتەوە: لە جیاتی ئەوە دووبارە وەری بگرەوە",
  },
  "Nothing was changed": { ar: "لم يتغيّر شيء", ckb: "هیچ شتێک نەگۆڕا" },
  "{1} counted after this delivery, and the count set its stock: correct only its price": {
    ar: "جُرد {1} بعد هذا التوريد، والجرد حدّد مخزونه: صحّح سعره فقط",
    ckb: "{1} دوای ئەم بارە ژمێردراوە، و ژماردنەکە کۆگاکەی دیاری کرد: تەنها نرخەکەی ڕاست بکەرەوە",
  },
  "This leaves {1} below zero: confirm to correct it all the same": {
    ar: "هذا يترك {1} دون الصفر: أكّد لتصحيحه مع ذلك",
    ckb: "ئەمە {1} دەباتە ژێر سفر: پشتڕاستی بکەرەوە بۆ ئەوەی هەر ڕاست بکرێتەوە",
  },
  "That delivery was reversed: there is nothing to bill": {
    ar: "عُكس ذلك التوريد: لا شيء فيه للفوترة",
    ckb: "ئەو بارە هەڵگەڕێندراوەتەوە: هیچ شتێک نییە بۆ پسووڵە",
  },
  "Received before the controls: the owner corrects it on Reports": {
    ar: "استُلم قبل الضوابط: يصحّحه المالك من التقارير",
    ckb: "پێش کۆنترۆڵەکان وەرگیراوە: خاوەن لە ڕاپۆرتەکان ڕاستی دەکاتەوە",
  },
  "Billed: cancel its bill on Vendors first, then correct the delivery": {
    ar: "مفوتَر: ألغِ فاتورته من شاشة «المورّدون» أولًا، ثم صحّح التوريد",
    ckb: "پسووڵەی بۆ تۆمار کراوە: سەرەتا لە شاشەی «دابینکەران» پسووڵەکەی هەڵبوەشێنەوە، پاشان بارەکە ڕاست بکەرەوە",
  },
  "Reversed: receive it again instead": {
    ar: "معكوس: استلمه من جديد بدلًا من ذلك",
    ckb: "هەڵگەڕێندراوەتەوە: لە جیاتی ئەوە دووبارە وەری بگرەوە",
  },
  "In a locked month: it is no longer corrected": {
    ar: "في شهر مقفل: لم يعد يُصحَّح",
    ckb: "لە مانگێکی داخراودایە: چیتر ڕاست ناکرێتەوە",
  },
  "a goods receipt (correct it on Purchasing)": {
    ar: "وصل استلام بضاعة (صحّحه من شاشة «المشتريات»)",
    ckb: "وەسڵی وەرگرتنی کاڵا (لە شاشەی «کڕین» ڕاستی بکەرەوە)",
  },
  "a delivery's correction (correct the delivery again on Purchasing)": {
    ar: "تصحيح توريد (صحّح التوريد مرة أخرى من شاشة «المشتريات»)",
    ckb: "ڕاستکردنەوەی بارێک (لە شاشەی «کڕین» بارەکە دووبارە ڕاست بکەرەوە)",
  },
  "A sale with no journal": { ar: "بيع بلا قيد", ckb: "فرۆشتنێک بێ تۆمار" },
  "A void whose sale's journal was not reversed": {
    ar: "إلغاء بيع لم يُعكس قيد بيعه",
    ckb: "هەڵوەشاندنەوەیەک کە تۆماری فرۆشتنەکەی هەڵنەگەڕێندراوەتەوە",
  },
  "A refund with no journal": { ar: "استرداد بلا قيد", ckb: "گەڕاندنەوەی پارەیەک بێ تۆمار" },
  "A delivery with no journal": { ar: "توريد بلا قيد", ckb: "بارێک بێ تۆمار" },
  "A delivery's correction with no journal": {
    ar: "تصحيح توريد بلا قيد",
    ckb: "ڕاستکردنەوەی بارێک بێ تۆمار",
  },
  "A bill with no journal": { ar: "فاتورة بلا قيد", ckb: "پسووڵەیەک بێ تۆمار" },
  "A payment with no journal": { ar: "دفعة بلا قيد", ckb: "پارەدانێک بێ تۆمار" },
  "An expense with no journal": { ar: "مصروف بلا قيد", ckb: "خەرجییەک بێ تۆمار" },
  "A loss, stock correction or opening stock with no journal": {
    ar: "هدر أو تصحيح مخزون أو مخزون افتتاحي بلا قيد",
    ckb: "بەفیڕۆچوون، ڕاستکردنەوەی کۆگا یان کۆگای سەرەتا بێ تۆمار",
  },
  "An approved count with no journal": {
    ar: "جرد معتمد بلا قيد",
    ckb: "ژماردنێکی پەسەندکراو بێ تۆمار",
  },
  "Cash moved with no journal": { ar: "نقل نقد بلا قيد", ckb: "گواستنەوەی پارە بێ تۆمار" },
  "A drawer counted over or short with no journal": {
    ar: "درج عُدّ بزيادة أو عجز بلا قيد",
    ckb: "دەخیلەیەک بە زیادە یان کەمی ژمێردرا بێ تۆمار",
  },
  "A drawer opened over or short with no journal": {
    ar: "درج فُتح بزيادة أو عجز بلا قيد",
    ckb: "دەخیلەیەک بە زیادە یان کەمی کرایەوە بێ تۆمار",
  },
  "A card settlement with no journal": {
    ar: "تسوية بطاقات بلا قيد",
    ckb: "یەکلاکردنەوەی کارت بێ تۆمار",
  },
  "A platform statement posted with no journal": {
    ar: "كشف منصة مُرحَّل بلا قيد",
    ckb: "کەشفی پلاتفۆرمێک تۆمار کرا بێ تۆمار",
  },
  "A journal whose {1} does not exist": {
    ar: "قيد لا يوجد سجله ({1})",
    ckb: "تۆمارێک کە بەڵگەکەی ({1}) بوونی نییە",
  },
  sale: { ar: "البيع", ckb: "فرۆشتن" },
  delivery: { ar: "التوريد", ckb: "بار" },
  "delivery correction": { ar: "تصحيح التوريد", ckb: "ڕاستکردنەوەی بار" },
  bill: { ar: "الفاتورة", ckb: "پسووڵە" },
  payment: { ar: "الدفعة", ckb: "پارەدان" },
  expense: { ar: "المصروف", ckb: "خەرجی" },
  "stock movement": { ar: "حركة المخزون", ckb: "جووڵەی کۆگا" },
  "stock count": { ar: "جرد المخزون", ckb: "ژماردنی کۆگا" },
  "cash movement": { ar: "نقل النقد", ckb: "گواستنەوەی پارە" },
  "drawer count": { ar: "جرد الدرج", ckb: "ژماردنی دەخیلە" },
  "drawer opening": { ar: "فتح الدرج", ckb: "کردنەوەی دەخیلە" },
  "card settlement": { ar: "تسوية البطاقات", ckb: "یەکلاکردنەوەی کارت" },
  "platform statement": { ar: "كشف المنصة", ckb: "کەشفی پلاتفۆرم" },

  // Usage against the recipes, and what may explain a difference (0039).
  "Choose the dates, the first before the last": {
    ar: "اختر التواريخ، الأول قبل الأخير",
    ckb: "بەروارەکان هەڵبژێرە، یەکەم پێش دوایین",
  },
  "More was used than the recipes say: bigger portions, waste not recorded, or sales not rung up": {
    ar: "استُهلك أكثر مما تقوله الوصفات: حصص أكبر، أو هدر غير مسجّل، أو مبيعات لم تُسجَّل",
    ckb: "زیاتر لەوەی ڕەچەتەکان دەڵێن بەکارهات: بەشی گەورەتر، بەفیڕۆچوونی تۆمارنەکراو، یان فرۆشتنی تۆمارنەکراو",
  },
  "Less was used than the recipes say: smaller portions, or a delivery that was not entered": {
    ar: "استُهلك أقل مما تقوله الوصفات: حصص أصغر، أو توريد لم يُدخل",
    ckb: "کەمتر لەوەی ڕەچەتەکان دەڵێن بەکارهات: بەشی بچووکتر، یان بارێک کە تۆمار نەکرا",
  },
  "No recipe used it in these days: what went is not explained by sales": {
    ar: "لم تستهلكه أي وصفة في هذه الأيام: ما خرج لا تفسّره المبيعات",
    ckb: "هیچ ڕەچەتەیەک لەم ڕۆژانەدا بەکاری نەهێنا: ئەوەی ڕۆیشت فرۆشتن ڕوونی ناکاتەوە",
  },
  "A recipe that uses it changed between the counts": {
    ar: "تغيّرت وصفة تستخدمه بين الجردين",
    ckb: "ڕەچەتەیەک کە بەکاری دەهێنێت لە نێوان ژماردنەکاندا گۆڕا",
  },
  "Sales that used it were voided: if they had been made, what they used is gone": {
    ar: "أُلغيت مبيعات استخدمته: إن كانت قد صُنعت، فما استهلكته قد خرج",
    ckb: "فرۆشتنگەلێک کە بەکاریان هێنا هەڵوەشێنرانەوە: ئەگەر دروستکرابن، ئەوەی بەکاریان هێنا ڕۆیشتووە",
  },
  "A delivery of it was corrected between the counts": {
    ar: "صُحّح توريد له بين الجردين",
    ckb: "بارێکی ئەو لە نێوان ژماردنەکاندا ڕاست کرایەوە",
  },
  "Its stock was corrected by hand between the counts": {
    ar: "صُحّح مخزونه يدويًا بين الجردين",
    ckb: "کۆگاکەی لە نێوان ژماردنەکاندا بە دەست ڕاست کرایەوە",
  },
  "The books had it below zero when it was counted: a delivery may not have been entered": {
    ar: "كانت الدفاتر تُظهره دون الصفر حين جُرد: ربما لم يُدخل توريد",
    ckb: "دەفتەرەکان کاتی ژماردن لە خوار سفرەوە پیشانیان دەدا: لەوانەیە بارێک تۆمار نەکرابێت",
  },

  // The rules on Settings, stock below zero, and losses added up (0040).
  "A rule is never deleted: set it back to its default": {
    ar: "لا تُحذف القاعدة أبدًا: أعدها إلى قيمتها الافتراضية",
    ckb: "یاسا هەرگیز ناسڕدرێتەوە: بیگەڕێنەوە بۆ بنەڕەتەکەی",
  },
  "A rule keeps what it is for: set another one instead": {
    ar: "تبقى القاعدة على ما وُضعت له: ضع قاعدة أخرى بدلًا من ذلك",
    ckb: "یاسا بۆ ئەوە دەمێنێتەوە کە بۆی دانراوە: لەبری ئەوە یاسایەکی تر دابنێ",
  },
  "Unknown rule": { ar: "قاعدة غير معروفة", ckb: "یاسای نەناسراو" },
  "Say why the rule is changing": { ar: "اذكر سبب تغيير القاعدة", ckb: "بڵێ بۆچی یاساکە دەگۆڕێت" },
  "This rule is not set that way": {
    ar: "لا تُضبط هذه القاعدة على هذا النحو",
    ckb: "ئەم یاسایە بەو شێوەیە دانانرێت",
  },
  "Unknown role": { ar: "دور غير معروف", ckb: "ڕۆڵی نەناسراو" },
  "Unknown kind of item": { ar: "نوع مادة غير معروف", ckb: "جۆری کاڵای نەناسراو" },
  "Unknown location": { ar: "موقع غير معروف", ckb: "شوێنی نەناسراو" },
  "That is not one of this rule's choices": {
    ar: "هذا ليس من خيارات هذه القاعدة",
    ckb: "ئەمە یەکێک نییە لە هەڵبژاردەکانی ئەم یاسایە",
  },
  "Using stock the books do not hold, with no alert, is for chosen items only": {
    ar: "استخدام مخزون لا تحتفظ به الدفاتر، دون تنبيه، هو لمواد مختارة فقط",
    ckb: "بەکارهێنانی کۆگایەک کە لە دەفتەرەکاندا نییە، بەبێ ئاگادارکردنەوە، تەنها بۆ کاڵا هەڵبژێردراوەکانە",
  },
  "Enter a number": { ar: "أدخل رقمًا", ckb: "ژمارەیەک بنووسە" },
  "Enter a number from {1} to {2}": {
    ar: "أدخل رقمًا من {1} إلى {2}",
    ckb: "ژمارەیەک لە {1} تا {2} بنووسە",
  },
  "Enter a whole number": { ar: "أدخل رقمًا صحيحًا", ckb: "ژمارەیەکی تەواو بنووسە" },
  "That is the rule already": { ar: "هذه هي القاعدة أصلًا", ckb: "یاساکە هەر ئەمەیە" },
  "Only {1} {2} of {3} is in stock: record the delivery or the batch first, or count it": {
    ar: "لا يوجد في المخزون سوى {1} {2} من {3}: سجّل التوريد أو الدفعة أولًا، أو اجرده",
    ckb: "تەنها {1} {2} لە {3} لە کۆگادایە: سەرەتا بارەکە یان دەفعەکە تۆمار بکە، یان بیژمێرە",
  },
  "Only {1} {2} of {3} is in stock: a manager approves using more than that": {
    ar: "لا يوجد في المخزون سوى {1} {2} من {3}: يوافق مدير على استخدام أكثر من ذلك",
    ckb: "تەنها {1} {2} لە {3} لە کۆگادایە: بەڕێوەبەرێک ڕەزامەندی لەسەر بەکارهێنانی زیاتر لەوە دەدات",
  },
  "This leaves {1} below zero, which its rule refuses: count it, or correct less": {
    ar: "هذا يترك {1} دون الصفر، وقاعدته ترفض ذلك: اجرده، أو صحّح بمقدار أقل",
    ckb: "ئەمە {1} لە خوار سفرەوە دەهێڵێتەوە، کە یاساکەی ڕەتی دەکاتەوە: بیژمێرە، یان کەمتر ڕاست بکەرەوە",
  },
  "A refund over {1} needs a second person to approve it": {
    ar: "يحتاج الاسترداد الذي يتجاوز {1} إلى موافقة شخص ثانٍ",
    ckb: "گەڕاندنەوەی پارە لە سەرووی {1} پێویستی بە ڕەزامەندی کەسێکی دووەم هەیە",
  },
  "This loss needs a manager's approval: ask one to approve it now, or save it to wait for their approval":
    {
      ar: "تحتاج هذه الخسارة إلى موافقة مدير: اطلب من أحدهم الموافقة عليها الآن، أو احفظها لتنتظر موافقته",
      ckb: "ئەم زیانە پێویستی بە ڕەزامەندی بەڕێوەبەرێک هەیە: داوا لە یەکێکیان بکە ئێستا ڕەزامەندی لەسەر بدات، یان پاشەکەوتی بکە بۆ ئەوەی چاوەڕێی ڕەزامەندییەکەی بکات",
    },
  "Approve the loss, or reverse it": {
    ar: "وافق على الخسارة، أو اعكسها",
    ckb: "ڕەزامەندی لەسەر زیانەکە بدە، یان هەڵیبگەڕێنەوە",
  },
  "Loss not found": { ar: "لم يُعثر على الخسارة", ckb: "زیانەکە نەدۆزرایەوە" },
  "This loss has been looked at already": {
    ar: "رُوجعت هذه الخسارة من قبل",
    ckb: "ئەم زیانە پێشتر سەیر کراوە",
  },
  "This loss is not waiting for approval": {
    ar: "هذه الخسارة لا تنتظر الموافقة",
    ckb: "ئەم زیانە چاوەڕێی ڕەزامەندی نییە",
  },
  "Someone else approves a loss you recorded": {
    ar: "يوافق شخص آخر على خسارة سجّلتها أنت",
    ckb: "کەسێکی تر ڕەزامەندی لەسەر زیانێک دەدات کە تۆ تۆمارت کردووە",
  },
  "Say why the loss is reversed": {
    ar: "اذكر سبب عكس الخسارة",
    ckb: "بڵێ بۆچی زیانەکە هەڵدەگەڕێنرێتەوە",
  },

  // Sizes and add-ons (0041).
  "The add-ons cannot be read": { ar: "تعذّرت قراءة الإضافات", ckb: "زیادەکان ناخوێنرێنەوە" },
  "Name the size": { ar: "سمِّ الحجم", ckb: "ناوێک بۆ قەبارەکە دابنێ" },
  "This product already has a size called {1}": {
    ar: "لهذا المنتج حجم اسمه {1} بالفعل",
    ckb: "ئەم بەرهەمە پێشتر قەبارەیەکی بە ناوی {1} هەیە",
  },
  "This product has a retired size called {1}: bring it back instead": {
    ar: "لهذا المنتج حجم موقوف اسمه {1}: أعِده بدلًا من ذلك",
    ckb: "ئەم بەرهەمە قەبارەیەکی وەستێنراوی بە ناوی {1} هەیە: لە جیاتی ئەوە بیگەڕێنەرەوە",
  },
  "{1} is sold as bought: add the other size as a product of its own": {
    ar: "{1} يُباع كما اشتُري: أضف الحجم الآخر منتجًا مستقلًا",
    ckb: "{1} وەک کڕدراوە دەفرۆشرێت: قەبارەکەی تر وەک بەرهەمێکی سەربەخۆ زیاد بکە",
  },
  "This product already has several sizes: rename each on its own": {
    ar: "لهذا المنتج عدة أحجام بالفعل: أعِد تسمية كلٍّ منها وحده",
    ckb: "ئەم بەرهەمە پێشتر چەند قەبارەیەکی هەیە: ناوی هەریەکەیان بە جیا بگۆڕە",
  },
  "List what one serving of the size uses, copy another size's recipe, or say why it uses no stock":
    {
      ar: "اذكر ما تستخدمه الحصة الواحدة من الحجم، أو انسخ وصفة حجم آخر، أو اذكر لماذا لا يستخدم شيئًا من المخزون",
      ckb: "ئەوە بنووسە کە یەک بەشی قەبارەکە بەکاری دەهێنێت، یان ڕەسەتەی قەبارەیەکی تر لەبەر بگرەوە، یان بڵێ بۆچی هیچ لە کۆگا بەکارناهێنێت",
    },
  "Copy the recipe of one of this product's sizes": {
    ar: "انسخ وصفة أحد أحجام هذا المنتج",
    ckb: "ڕەسەتەی یەکێک لە قەبارەکانی ئەم بەرهەمە لەبەر بگرەوە",
  },
  "{1} has no recipe in force to copy": {
    ar: "ليس لـ{1} وصفة سارية لنسخها",
    ckb: "{1} هیچ ڕەسەتەیەکی بەرکاری نییە بۆ لەبەرگرتنەوە",
  },
  "Size not found": { ar: "الحجم غير موجود", ckb: "قەبارەکە نەدۆزرایەوە" },
  "{1} is retired already": { ar: "{1} موقوف بالفعل", ckb: "{1} پێشتر وەستێنراوە" },
  "Say why the size is retired": {
    ar: "اذكر سبب إيقاف الحجم",
    ckb: "بڵێ بۆچی قەبارەکە وەستێنراوە",
  },
  "{1} is the product's only size on sale: hide the product instead": {
    ar: "{1} هو الحجم الوحيد المعروض للبيع من المنتج: أخفِ المنتج بدلًا من ذلك",
    ckb: "{1} تاکە قەبارەی بەرهەمەکەیە کە دەفرۆشرێت: لە جیاتی ئەوە بەرهەمەکە بشارەوە",
  },
  "{1} is on the open bill {2}: take it off, or settle the bill, first": {
    ar: "{1} على الفاتورة المفتوحة {2}: أزِله منها، أو سدّد الفاتورة، أولًا",
    ckb: "{1} لەسەر پسووڵەی کراوەی {2} ـە: سەرەتا لای ببە، یان پارەی پسووڵەکە وەربگرە",
  },
  "{1} is on sale already": { ar: "{1} معروض للبيع بالفعل", ckb: "{1} پێشتر دەفرۆشرێت" },
  "Unknown add-on": { ar: "إضافة غير معروفة", ckb: "زیادەیەکی نەناسراو" },
  "{1} is no longer offered": { ar: "{1} لم تعد تُقدَّم", ckb: "{1} چیتر پێشکەش ناکرێت" },
  "{1} is not offered with {2}": {
    ar: "{1} لا تُقدَّم مع {2}",
    ckb: "{1} لەگەڵ {2} پێشکەش ناکرێت",
  },
  "{1} is added twice: give it a quantity instead": {
    ar: "{1} مُضافة مرتين: حدّد لها كمية بدلًا من ذلك",
    ckb: "{1} دوو جار زیاد کراوە: لە جیاتی ئەوە بڕێکی بۆ دابنێ",
  },
  "Add {1} 1 to 20 times": { ar: "أضف {1} من 1 إلى 20 مرة", ckb: "{1} 1 تا 20 جار زیاد بکە" },
  "Choose {1} for {2}": { ar: "اختر {1} لـ{2}", ckb: "{1} بۆ {2} هەڵبژێرە" },
  "Choose at least {1} from {2} for {3}": {
    ar: "اختر {1} على الأقل من {2} لـ{3}",
    ckb: "لانیکەم {1} لە {2} بۆ {3} هەڵبژێرە",
  },
  "Choose at most {1} from {2} for {3}": {
    ar: "اختر {1} على الأكثر من {2} لـ{3}",
    ckb: "زۆرترین {1} لە {2} بۆ {3} هەڵبژێرە",
  },
  "Name the group of add-ons": {
    ar: "سمِّ مجموعة الإضافات",
    ckb: "ناوێک بۆ کۆمەڵەی زیادەکان دابنێ",
  },
  "The fewest to choose is a number from 0 to 20": {
    ar: "أقلّ عدد للاختيار رقم من 0 إلى 20",
    ckb: "کەمترین ژمارە بۆ هەڵبژاردن ژمارەیەکە لە 0 تا 20",
  },
  "The most to choose is a number from 1 to 20, and no fewer than the fewest": {
    ar: "أكبر عدد للاختيار رقم من 1 إلى 20، ولا يقلّ عن أقلّ عدد",
    ckb: "زۆرترین ژمارە بۆ هەڵبژاردن ژمارەیەکە لە 1 تا 20، و لە کەمترین ژمارە کەمتر نییە",
  },
  "Group of add-ons not found": {
    ar: "مجموعة الإضافات غير موجودة",
    ckb: "کۆمەڵەی زیادەکان نەدۆزرایەوە",
  },
  "There is already a group of add-ons called {1}": {
    ar: "توجد بالفعل مجموعة إضافات اسمها {1}",
    ckb: "پێشتر کۆمەڵەیەکی زیادە بە ناوی {1} هەیە",
  },
  "The recipe cannot be read": { ar: "تعذّرت قراءة الوصفة", ckb: "ڕەسەتەکە ناخوێنرێتەوە" },
  "Name the add-on": { ar: "سمِّ الإضافة", ckb: "ناوێک بۆ زیادەکە دابنێ" },
  "Add-on not found": { ar: "الإضافة غير موجودة", ckb: "زیادەکە نەدۆزرایەوە" },
  "An add-on stays in its group: add it to the other group instead": {
    ar: "تبقى الإضافة في مجموعتها: أضفها إلى المجموعة الأخرى بدلًا من ذلك",
    ckb: "زیادەیەک لە کۆمەڵەکەی خۆیدا دەمێنێتەوە: لە جیاتی ئەوە بۆ کۆمەڵەکەی تری زیاد بکە",
  },
  "Choose a group of add-ons in use": {
    ar: "اختر مجموعة إضافات مستخدمة",
    ckb: "کۆمەڵەیەکی زیادە هەڵبژێرە کە بەکاردێت",
  },
  "The group already has an add-on called {1}": {
    ar: "في المجموعة إضافة اسمها {1} بالفعل",
    ckb: "کۆمەڵەکە پێشتر زیادەیەکی بە ناوی {1} هەیە",
  },
  "The prices cannot be read": { ar: "تعذّرت قراءة الأسعار", ckb: "نرخەکان ناخوێنرێنەوە" },
  "Choose the channel": { ar: "اختر القناة", ckb: "کەناڵەکە هەڵبژێرە" },
  "The groups cannot be read": { ar: "تعذّرت قراءة المجموعات", ckb: "کۆمەڵەکان ناخوێنرێنەوە" },
  "Choose one of {1}'s sizes": {
    ar: "اختر أحد أحجام {1}",
    ckb: "یەکێک لە قەبارەکانی {1} هەڵبژێرە",
  },
  "{1} offers each group once: for all its sizes, or for some": {
    ar: "يقدّم {1} كل مجموعة مرة واحدة: لكل أحجامه، أو لبعضها",
    ckb: "{1} هەر کۆمەڵەیەک یەک جار پێشکەش دەکات: بۆ هەموو قەبارەکانی، یان بۆ هەندێکیان",
  },
  "{1}'s add-ons are on the open bill {2}: take them off, or settle the bill, first": {
    ar: "إضافات {1} على الفاتورة المفتوحة {2}: أزِلها منها، أو سدّد الفاتورة، أولًا",
    ckb: "زیادەکانی {1} لەسەر پسووڵەی کراوەی {2} ـن: سەرەتا لایان ببە، یان پارەی پسووڵەکە وەربگرە",
  },

  // Split payments (0042).
  "A delivery platform's order is paid once, by the platform": {
    ar: "يُدفع طلب منصة التوصيل مرة واحدة، عبر المنصة",
    ckb: "داواکاریی پلاتفۆرمی گەیاندن یەک جار پارەی دەدرێت، لە ڕێگەی پلاتفۆرمەکەوە",
  },
  "A payment is named twice": {
    ar: "ذُكرت طريقة دفع مرتين",
    ckb: "شێوازێکی پارەدان دوو جار ناوی هاتووە",
  },
  "A sale is paid in at most 10 payments": {
    ar: "تُدفع البيعة الواحدة على 10 دفعات على الأكثر",
    ckb: "فرۆشتنێک بە لانیزۆر 10 پارەدان دەدرێت",
  },
  "Each payment needs an amount more than 0": {
    ar: "تحتاج كل دفعة إلى مبلغ أكبر من 0",
    ckb: "هەر پارەدانێک پێویستی بە بڕێکی زیاتر لە 0 هەیە",
  },
  "Only {1} of the card payment is left to give back": {
    ar: "لم يبقَ من دفعة البطاقة للإعادة إلا {1}",
    ckb: "تەنها {1} لە پارەدانی کارت ماوە بۆ گەڕاندنەوە",
  },
  "Only {1} of the cash paid is left to give back": {
    ar: "لم يبقَ من المدفوع نقدًا للإعادة إلا {1}",
    ckb: "تەنها {1} لە پارەی کاشی دراو ماوە بۆ گەڕاندنەوە",
  },
  "Only {1} of the platform's payment is left to give back": {
    ar: "لم يبقَ من دفعة المنصة للإعادة إلا {1}",
    ckb: "تەنها {1} لە پارەدانی پلاتفۆرمەکە ماوە بۆ گەڕاندنەوە",
  },
  "Send the payments once: one tender, or the list of payments": {
    ar: "أرسل الدفعات مرة واحدة: طريقة دفع واحدة، أو قائمة الدفعات",
    ckb: "پارەدانەکان یەک جار بنێرە: یەک شێوازی پارەدان، یان لیستی پارەدانەکان",
  },
  "The cash handed over ({1}) is less than the {2} it pays": {
    ar: "النقد المُسلَّم ({1}) أقل من {2} الذي يدفعه",
    ckb: "کاشی دراو ({1}) لەو {2} کەمترە کە دەبێت بیدات",
  },
  "The payments cannot be read": { ar: "تعذّرت قراءة الدفعات", ckb: "پارەدانەکان ناخوێندرێنەوە" },
  "The payments come to {1}, not the {2} to pay": {
    ar: "مجموع الدفعات {1}، لا {2} المطلوب دفعه",
    ckb: "کۆی پارەدانەکان دەکاتە {1}، نەک ئەو {2} کە دەبێت بدرێت",
  },
  "The payments to give back cannot be read": {
    ar: "تعذّرت قراءة الدفعات المراد إعادتها",
    ckb: "ئەو پارەدانانەی دەگەڕێندرێنەوە ناخوێندرێنەوە",
  },
  "The refund is {1}, but the payments given back come to {2}": {
    ar: "الاسترداد {1}، لكن مجموع ما يُعاد من الدفعات {2}",
    ckb: "بڕی گەڕاندنەوەکە {1}، بەڵام کۆی پارەدانە گەڕێندراوەکان دەکاتە {2}",
  },

  // US dollars (0043): the rate, a payment in dollars, the count at a close, an exchange.
  "The drawer does not hold the {1} change in dinars: take the payment in dinars, or put cash in the till first":
    {
      ar: "لا يحوي الدرج الباقي {1} بالدينار: خذ المبلغ بالدينار، أو ضع نقدًا في الدرج أولًا",
      ckb: "دەخیلەکە {1} باقی بە دیناری تێدا نییە: پارەکە بە دینار وەربگرە، یان سەرەتا پارە بخەرە ناو دەخیلەکەوە",
    },
  "The till no longer holds the ${1} this sale was paid with: refund it instead": {
    ar: "لم يعد الدرج يحوي ${1} التي دُفع بها هذا البيع: استرده بدلًا من ذلك",
    ckb: "دەخیلەکە ئیتر ئەو ${1}ی تێدا نییە کە ئەم فرۆشتنەی پێ درا: لە جیاتی ئەوە پارەکەی بگەڕێنەوە",
  },
  "Dollars are taken in cash only": {
    ar: "تُؤخذ الدولارات نقدًا فقط",
    ckb: "دۆلار تەنها بە کاش وەردەگیرێت",
  },
  "Dollars are taken in whole dollars": {
    ar: "تُؤخذ الدولارات بالدولار الكامل",
    ckb: "دۆلار بە دۆلاری تەواو وەردەگیرێت",
  },
  "Payments are taken in dinars or dollars": {
    ar: "تُؤخذ الدفعات بالدينار أو بالدولار",
    ckb: "پارەدان بە دینار یان بە دۆلار وەردەگیرێت",
  },
  "No dollar rate is set: a manager sets today's on Sales → Dollars": {
    ar: "لم يُحدَّد سعر للدولار: يحدد المدير سعر اليوم في شاشة «المبيعات»، قسم «الدولار»",
    ckb: "هیچ نرخێکی دۆلار دانەنراوە: بەڕێوەبەرێک نرخی ئەمڕۆ لە شاشەی «فرۆشتن»، بەشی «دۆلار» دادەنێت",
  },
  "The dollar rate was set {1} hours ago: a manager sets today's before dollars are taken": {
    ar: "حُدّد سعر الدولار قبل {1} ساعة: يحدد المدير سعر اليوم قبل أخذ الدولارات",
    ckb: "نرخی دۆلار {1} کاتژمێر لەمەوبەر دانرا: بەڕێوەبەرێک پێش وەرگرتنی دۆلار نرخی ئەمڕۆ دادەنێت",
  },
  "Only the dollar's rate is kept": {
    ar: "يُحتفظ بسعر الدولار فقط",
    ckb: "تەنها نرخی دۆلار هەڵدەگیرێت",
  },
  "A dollar is a whole number of dinars, from 100 to 100,000": {
    ar: "الدولار عدد صحيح من الدنانير، من 100 إلى 100,000",
    ckb: "دۆلارێک ژمارەیەکی تەواوی دینارە، لە 100 تا 100,000",
  },
  "Say where the rate comes from": { ar: "اذكر مصدر السعر", ckb: "بڵێ نرخەکە لە کوێوە هاتووە" },
  "The dollar rate is now {1}, not the {2} shown: take the payment again": {
    ar: "سعر الدولار الآن {1}، لا {2} المعروض: خذ المبلغ من جديد",
    ckb: "نرخی دۆلار ئێستا {1}ە، نەک ئەو {2}ی پیشان درا: پارەکە دووبارە وەربگرە",
  },
  "${1} come to {2}, less than the {3} they pay": {
    ar: "${1} تساوي {2}، أقل من {3} التي تدفعها",
    ckb: "${1} دەکاتە {2}، کەمترە لەو {3}ی دەیدات",
  },
  "Enter the dollars you counted, in whole dollars": {
    ar: "أدخل الدولارات التي عددتها، بالدولار الكامل",
    ckb: "ئەو دۆلارانەی ژماردت بنووسە، بە دۆلاری تەواو",
  },
  "The dollar notes counted cannot be read": {
    ar: "تعذّرت قراءة أوراق الدولار المعدودة",
    ckb: "دراوە دۆلارییە ژمێردراوەکان ناخوێندرێنەوە",
  },
  "The dollar notes counted come to ${1}, not the ${2} entered": {
    ar: "أوراق الدولار المعدودة مجموعها ${1}، لا ${2} المُدخلة",
    ckb: "کۆی دراوە دۆلارییە ژمێردراوەکان ${1}ە، نەک ئەو ${2}ی نووسراوە",
  },
  "Say where the dollars come from: the till or the safe": {
    ar: "اذكر من أين تأتي الدولارات: الدرج أو الخزنة",
    ckb: "بڵێ دۆلارەکان لە کوێوە دێن: دەخیلە یان قاسە",
  },
  "Say where the dinars go: the till, the safe or the bank": {
    ar: "اذكر أين تذهب الدنانير: الدرج أو الخزنة أو البنك",
    ckb: "بڵێ دینارەکان بۆ کوێ دەچن: دەخیلە، قاسە یان بانک",
  },
  "Enter the dollars exchanged, in whole dollars": {
    ar: "أدخل الدولارات المصروفة، بالدولار الكامل",
    ckb: "دۆلارە گۆڕدراوەکان بنووسە، بە دۆلاری تەواو",
  },
  "Enter the dinars received for them": {
    ar: "أدخل الدنانير المستلمة مقابلها",
    ckb: "ئەو دینارانەی بەرامبەریان وەرگیران بنووسە",
  },
  "That is {1} dinars a dollar: check the dinars received": {
    ar: "هذا {1} دينار للدولار: تحقق من الدنانير المستلمة",
    ckb: "ئەمە {1} دینارە بۆ هەر دۆلارێک: دینارە وەرگیراوەکان بپشکنە",
  },
  "The safe holds only ${1} in the books": {
    ar: "لا تحوي الخزنة في الدفاتر إلا ${1}",
    ckb: "قاسەکە لە دەفتەرەکاندا تەنها ${1}ی تێدایە",
  },
  "The till holds only ${1} in the books": {
    ar: "لا يحوي الدرج في الدفاتر إلا ${1}",
    ckb: "دەخیلەکە لە دەفتەرەکاندا تەنها ${1}ی تێدایە",
  },
  "A drawer's dollars counted with no journal": {
    ar: "دولارات درج عُدّت بلا قيد",
    ckb: "دۆلاری دەخیلەیەک ژمێردرا بێ تۆمار",
  },
  "Dollars exchanged with no journal": {
    ar: "دولارات صُرفت بلا قيد",
    ckb: "دۆلار گۆڕدرایەوە بێ تۆمار",
  },
  "drawer's dollars count": { ar: "عدّ دولارات الدرج", ckb: "ژماردنی دۆلاری دەخیلە" },
  "exchange of dollars": { ar: "صرف الدولارات", ckb: "گۆڕینەوەی دۆلار" },
  "the dollars counted at a drawer's close": {
    ar: "الدولارات المعدودة عند إغلاق درج",
    ckb: "ئەو دۆلارانەی لە داخستنی دەخیلەیەکدا ژمێردران",
  },
  "an exchange of dollars": { ar: "صرف دولارات", ckb: "گۆڕینەوەی دۆلارێک" },
  // Purchasing (0044): purchase orders, receiving against them, returns to
  // suppliers, and the suppliers' credits.
  "A bill with credits set against it cannot be cancelled": {
    ar: "لا يمكن إلغاء فاتورة خُصمت منها إشعارات دائنة",
    ckb: "پسووڵەیەک کە پسووڵەی گەڕاندنەوەی لێ بڕدرابێت هەڵناوەشێنرێتەوە",
  },
  "Goods from delivery {1} have gone back to the supplier: it is no longer corrected": {
    ar: "أُرجعت بضاعة من التوريد {1} إلى المورّد: لم يعد يُصحَّح",
    ckb: "کاڵا لە باری {1} گەڕێندراوەتەوە بۆ دابینکەر: چیتر ڕاست ناکرێتەوە",
  },
  "Delivery {1} came against order {2}: its supplier is the order's": {
    ar: "جاء التوريد {1} على الطلبية {2}: مورّده هو مورّد الطلبية",
    ckb: "باری {1} لەسەر داواکاریی {2} هات: دابینکەرەکەی هی داواکارییەکەیە",
  },
  "Everything delivery {1} brought went back to the supplier: there is nothing to bill": {
    ar: "أُرجع كل ما جاء به التوريد {1} إلى المورّد: لا شيء للفوترة",
    ckb: "هەموو ئەوەی باری {1} هێنای گەڕێندرایەوە بۆ دابینکەر: هیچ شتێک نییە بۆ پسووڵە",
  },
  "An order's lines change only while it is a draft": {
    ar: "لا تتغيّر أسطر الطلبية إلا وهي مسودّة",
    ckb: "هێڵەکانی داواکاری تەنها کاتێک دەگۆڕێن کە ڕەشنووس بێت",
  },
  "An order has at most 100 lines": {
    ar: "للطلبية 100 سطر على الأكثر",
    ckb: "داواکاری زۆرترین 100 هێڵی هەیە",
  },
  "Unknown item on the order": {
    ar: "صنف غير معروف في الطلبية",
    ckb: "کاڵایەکی نەناسراو لە داواکارییەکەدا",
  },
  "{1} is on the order twice: one line for it": {
    ar: "{1} مذكور في الطلبية مرتين: سطر واحد له",
    ckb: "{1} دوو جار لە داواکارییەکەدایە: یەک هێڵ بۆی",
  },
  "Every line needs a quantity": {
    ar: "يحتاج كل سطر إلى كمية",
    ckb: "هەموو هێڵێک پێویستی بە بڕ هەیە",
  },
  "{1} is not bought in {2}": { ar: "لا يُشترى {1} بوحدة {2}", ckb: "{1} بە {2} ناکڕدرێت" },
  "Order not found": { ar: "لم يُعثر على الطلبية", ckb: "داواکارییەکە نەدۆزرایەوە" },
  "Order {1} has been sent: cancel it and make a new one, or close it": {
    ar: "أُرسلت الطلبية {1}: ألغِها وأنشئ طلبية جديدة، أو أغلقها",
    ckb: "داواکاریی {1} نێردراوە: هەڵیبوەشێنەوە و یەکێکی نوێ دروست بکە، یان دایبخە",
  },
  "Order {1} is not a draft waiting to be approved": {
    ar: "الطلبية {1} ليست مسودّة بانتظار الاعتماد",
    ckb: "داواکاریی {1} ڕەشنووسێک نییە کە چاوەڕێی پەسەندکردن بێت",
  },
  "Order {1} comes to nothing: give its lines their prices": {
    ar: "مجموع الطلبية {1} صفر: أعطِ أسطرها أسعارها",
    ckb: "کۆی داواکاریی {1} سفرە: نرخی هێڵەکانی دابنێ",
  },
  "You approve orders up to {1}; order {2} comes to {3}: someone whose limit covers it approves it":
    {
      ar: "تعتمد الطلبيات حتى {1}؛ ومجموع الطلبية {2} هو {3}: يعتمدها من يغطّيها حدّه",
      ckb: "تۆ داواکاری تا {1} پەسەند دەکەیت؛ کۆی داواکاریی {2} بریتییە لە {3}: کەسێک پەسەندی دەکات کە سنوورەکەی بیگرێتەوە",
    },
  "Order {1} is not approved yet": {
    ar: "لم تُعتمد الطلبية {1} بعد",
    ckb: "داواکاریی {1} هێشتا پەسەند نەکراوە",
  },
  "Order {1} is not waiting to be sent": {
    ar: "الطلبية {1} ليست بانتظار الإرسال",
    ckb: "داواکاریی {1} چاوەڕێی ناردن نییە",
  },
  "Order {1} is not open": { ar: "الطلبية {1} ليست مفتوحة", ckb: "داواکاریی {1} کراوە نییە" },
  "Nothing has come against order {1}: cancel it instead": {
    ar: "لم يصل شيء على الطلبية {1}: ألغِها بدلًا من ذلك",
    ckb: "هیچ شتێک لەسەر داواکاریی {1} نەهاتووە: لە جیاتی ئەوە هەڵیبوەشێنەوە",
  },
  "Order {1} has not all come: say why the rest is not coming": {
    ar: "لم تصل الطلبية {1} كلها: اذكر لماذا لن يصل الباقي",
    ckb: "هەموو داواکاریی {1} نەهاتووە: بڵێ بۆچی ئەوەی ماوە نایەت",
  },
  "Say why the order is being cancelled": {
    ar: "اذكر سبب إلغاء الطلبية",
    ckb: "بڵێ بۆچی داواکارییەکە هەڵدەوەشێنرێتەوە",
  },
  "Goods have come against order {1}: close it instead": {
    ar: "وصلت بضاعة على الطلبية {1}: أغلقها بدلًا من ذلك",
    ckb: "کاڵا لەسەر داواکاریی {1} هاتووە: لە جیاتی ئەوە دایبخە",
  },
  "Order {1} is not approved yet: approve it, or receive without it": {
    ar: "لم تُعتمد الطلبية {1} بعد: اعتمدها، أو استلم من دونها",
    ckb: "داواکاریی {1} هێشتا پەسەند نەکراوە: پەسەندی بکە، یان بەبێ ئەو وەری بگرە",
  },
  "Order {1} is closed: receive without it": {
    ar: "الطلبية {1} مغلقة: استلم من دونها",
    ckb: "داواکاریی {1} داخراوە: بەبێ ئەو وەری بگرە",
  },
  "Order {1} was cancelled: receive without it": {
    ar: "أُلغيت الطلبية {1}: استلم من دونها",
    ckb: "داواکاریی {1} هەڵوەشێنراوەتەوە: بەبێ ئەو وەری بگرە",
  },
  "Order {1} is from {2}: receive it from them": {
    ar: "الطلبية {1} من {2}: استلمها منه",
    ckb: "داواکاریی {1} لە {2}ەوەیە: لەوانەوە وەری بگرە",
  },
  "Order {1} is for {2}: receive it there": {
    ar: "الطلبية {1} لـ{2}: استلمها هناك",
    ckb: "داواکاریی {1} بۆ {2}ە: لەوێ وەری بگرە",
  },
  "That line is not on order {1}": {
    ar: "هذا السطر ليس في الطلبية {1}",
    ckb: "ئەو هێڵە لە داواکاریی {1}دا نییە",
  },
  "Check the price and the quantity: {1}. If it is right, confirm it and receive again": {
    ar: "تحقّق من السعر والكمية: {1}. إن كان صحيحًا فأكّده واستلم مرة أخرى",
    ckb: "نرخ و بڕەکە بپشکنە: {1}. ئەگەر ڕاستە، پشتڕاستی بکەرەوە و دووبارە وەری بگرە",
  },
  "Check the quantity: {1}. If it is right, confirm it and receive again": {
    ar: "تحقّق من الكمية: {1}. إن كانت صحيحة فأكّدها واستلم مرة أخرى",
    ckb: "بڕەکە بپشکنە: {1}. ئەگەر ڕاستە، پشتڕاستی بکەرەوە و دووبارە وەری بگرە",
  },
  "A supplier's credit is never deleted": {
    ar: "لا يُحذف الإشعار الدائن من المورّد أبدًا",
    ckb: "پسووڵەی گەڕاندنەوەی دابینکەر هەرگیز ناسڕدرێتەوە",
  },
  "A supplier's credit does not change": {
    ar: "لا يتغيّر الإشعار الدائن من المورّد",
    ckb: "پسووڵەی گەڕاندنەوەی دابینکەر ناگۆڕێت",
  },
  "More would be set against credit {1} than it is for": {
    ar: "سيُخصم من الإشعار الدائن {1} أكثر من قيمته",
    ckb: "زیاتر لە بڕەکەی خۆی لە پسووڵەی گەڕاندنەوەی {1} دەبڕدرێت",
  },
  "This bill has credits set against it, so it cannot be cancelled": {
    ar: "خُصمت من هذه الفاتورة إشعارات دائنة، لذا لا يمكن إلغاؤها",
    ckb: "پسووڵەی گەڕاندنەوە لەم پسووڵەیە بڕدراوە، بۆیە هەڵناوەشێنرێتەوە",
  },
  "Say why the goods are going back": {
    ar: "اذكر سبب إرجاع البضاعة",
    ckb: "بڵێ بۆچی کاڵاکە دەگەڕێندرێتەوە",
  },
  "Delivery {1} was received before the controls: return its goods without naming it": {
    ar: "استُلم التوريد {1} قبل الضوابط: أرجع بضاعته من دون ذكره",
    ckb: "باری {1} پێش کۆنترۆڵەکان وەرگیراوە: کاڵاکەی بگەڕێنەرەوە بەبێ ناوهێنانی",
  },
  "Delivery {1} was reversed: nothing of it is left to return": {
    ar: "عُكس التوريد {1}: لم يبقَ منه شيء للإرجاع",
    ckb: "باری {1} هەڵگەڕێندراوەتەوە: هیچی نەماوە بۆ گەڕاندنەوە",
  },
  "Delivery {1} came from another supplier": {
    ar: "جاء التوريد {1} من مورّد آخر",
    ckb: "باری {1} لە دابینکەرێکی ترەوە هات",
  },
  "Delivery {1} came into {2}: return its goods from there": {
    ar: "استُلم التوريد {1} في {2}: أرجع بضاعته من هناك",
    ckb: "باری {1} هاتە {2}: کاڵاکەی لەوێوە بگەڕێنەرەوە",
  },
  "Unknown item on the return": {
    ar: "صنف غير معروف في المرتجع",
    ckb: "کاڵایەکی نەناسراو لە گەڕاندنەوەکەدا",
  },
  "{1} is on the return twice: one line for it": {
    ar: "{1} مذكور في المرتجع مرتين: سطر واحد له",
    ckb: "{1} دوو جار لە گەڕاندنەوەکەدایە: یەک هێڵ بۆی",
  },
  "{1} did not come in delivery {2}": {
    ar: "لم يأتِ {1} في التوريد {2}",
    ckb: "{1} لە باری {2}دا نەهات",
  },
  "Only {1} {2} of {3} from delivery {4} is left to return": {
    ar: "لم يبقَ للإرجاع من {3} في التوريد {4} إلا {1} {2}",
    ckb: "تەنها {1} {2} لە {3}ی باری {4} ماوە بۆ گەڕاندنەوە",
  },
  "This leaves {1} below zero, which its rule refuses: count it, or return less": {
    ar: "هذا يترك {1} دون الصفر، وقاعدته ترفض ذلك: اجرده، أو أرجع كمية أقل",
    ckb: "ئەمە {1} دەباتە ژێر سفر، کە یاساکەی ڕێگەی پێ نادات: بیژمێرە، یان کەمتر بگەڕێنەرەوە",
  },
  "This leaves {1} below zero: confirm to return it all the same": {
    ar: "هذا يترك {1} دون الصفر: أكّد لإرجاعه مع ذلك",
    ckb: "ئەمە {1} دەباتە ژێر سفر: پشتڕاستی بکەرەوە بۆ ئەوەی هەر بگەڕێندرێتەوە",
  },
  "Credit not found": {
    ar: "لم يُعثر على الإشعار الدائن",
    ckb: "پسووڵەی گەڕاندنەوەکە نەدۆزرایەوە",
  },
  "That bill is from another supplier": {
    ar: "هذه الفاتورة من مورّد آخر",
    ckb: "ئەو پسووڵەیە هی دابینکەرێکی ترە",
  },
  "That is more than the {1} left of credit {2}": {
    ar: "هذا أكثر من المتبقي من الإشعار الدائن {2} ({1})",
    ckb: "ئەمە لەوەی لە پسووڵەی گەڕاندنەوەی {2} ماوە ({1}) زیاترە",
  },
  "That is more than the {1} outstanding on bill {2}": {
    ar: "هذا أكثر من المتبقي على الفاتورة {2} ({1})",
    ckb: "ئەمە لە بڕی ماوەی سەر پسووڵەی {2} ({1}) زیاترە",
  },
  "Say what the credit is for: a price, or other": {
    ar: "اذكر سبب الإشعار الدائن: سعر، أو غير ذلك",
    ckb: "بڵێ پسووڵەی گەڕاندنەوەکە بۆ چییە: نرخ، یان شتێکی تر",
  },
  "A return makes its own credit: record the supplier's note on it instead": {
    ar: "المرتجع يُنشئ إشعاره الدائن بنفسه: سجّل عليه إشعار المورّد بدلًا من ذلك",
    ckb: "گەڕاندنەوە پسووڵەی گەڕاندنەوەی خۆی دروست دەکات: لە جیاتی ئەوە پسووڵەکەی دابینکەر لەسەری تۆمار بکە",
  },
  "Type the number on the supplier's credit note": {
    ar: "اكتب الرقم المدوّن على الإشعار الدائن من المورّد",
    ckb: "ئەو ژمارەیە بنووسە کە لەسەر پسووڵەی گەڕاندنەوەی دابینکەرەکەیە",
  },
  "Credit note {1} from this supplier is already recorded": {
    ar: "الإشعار الدائن {1} من هذا المورّد مسجّل بالفعل",
    ckb: "پسووڵەی گەڕاندنەوەی {1} لەم دابینکەرە پێشتر تۆمار کراوە",
  },
  "Say what the credit is for": {
    ar: "اذكر سبب الإشعار الدائن",
    ckb: "بڵێ پسووڵەی گەڕاندنەوەکە بۆ چییە",
  },
  "Choose the delivery the price was for": {
    ar: "اختر التوريد الذي كان السعر له",
    ckb: "ئەو بارە هەڵبژێرە کە نرخەکە هی ئەو بوو",
  },
  "Delivery {1} was reversed: there is no price to reduce": {
    ar: "عُكس التوريد {1}: لا سعر فيه ليُخفَّض",
    ckb: "باری {1} هەڵگەڕێندراوەتەوە: هیچ نرخێک نییە بۆ کەمکردنەوە",
  },
  "Bill {1} is not for delivery {2}": {
    ar: "الفاتورة {1} ليست للتوريد {2}",
    ckb: "پسووڵەی {1} هی باری {2} نییە",
  },
  "Delivery {1} is not billed yet: correct its price on Purchasing instead": {
    ar: "لم تُسجَّل فاتورة التوريد {1} بعد: صحّح سعره من شاشة «المشتريات» بدلًا من ذلك",
    ckb: "هێشتا پسووڵەی باری {1} تۆمار نەکراوە: لە جیاتی ئەوە لە شاشەی «کڕین» نرخەکەی ڕاست بکەرەوە",
  },
  "That is more than delivery {1} is still worth ({2})": {
    ar: "هذا أكثر مما يساويه التوريد {1} الآن ({2})",
    ckb: "ئەمە لەوەی باری {1} ئێستا دەیهێنێت ({2}) زیاترە",
  },
  "Choose the account the credit is taken off": {
    ar: "اختر الحساب الذي يُخصم منه الإشعار الدائن",
    ckb: "ئەو هەژمارە هەڵبژێرە کە پسووڵەی گەڕاندنەوەکەی لێ دەبڕدرێت",
  },
  "Account {1} cannot take a supplier's credit": {
    ar: "لا يُسجَّل إشعار دائن من مورّد على الحساب {1}",
    ckb: "هەژماری {1} پسووڵەی گەڕاندنەوەی دابینکەر وەرناگرێت",
  },
  "Credit {1} already has the supplier's note {2}": {
    ar: "للإشعار الدائن {1} بالفعل إشعار المورّد {2}",
    ckb: "پسووڵەی گەڕاندنەوەی {1} پێشتر پسووڵەی {2}ی دابینکەری لەسەرە",
  },
  "Supplier not found": { ar: "لم يُعثر على المورّد", ckb: "دابینکەرەکە نەدۆزرایەوە" },
  // The buying list (0045).
  "Choose at least one item to order": {
    ar: "اختر مادة واحدة على الأقل لطلبها",
    ckb: "لانی کەم کاڵایەک هەڵبژێرە بۆ داواکردن",
  },
  "At most 300 lines at once": {
    ar: "300 سطر على الأكثر في المرة الواحدة",
    ckb: "لە یەک جاردا زۆرترین 300 هێڵ",
  },
  "Choose a supplier for {1}": { ar: "اختر مورّدًا لـ {1}", ckb: "دابینکەرێک بۆ {1} هەڵبژێرە" },
  "A price is zero or more": { ar: "السعر صفر أو أكثر", ckb: "نرخ سفرە یان زیاتر" },
  "That supplier is not one the item is bought from": {
    ar: "هذه المادة لا تُشترى من ذلك المورّد",
    ckb: "ئەم کاڵایە لەو دابینکەرە ناکڕدرێت",
  },
  // Batches, their use-by dates and lots (0046).
  "What it makes keeps for an hour to a year": {
    ar: "ما تُنتجه يبقى صالحًا من ساعة إلى سنة",
    ckb: "ئەوەی بەرهەمی دەهێنێت لە کاتژمێرێکەوە تا ساڵێک دەمێنێتەوە",
  },
  "A batch is recorded once it is made, not before": {
    ar: "تُسجَّل الدفعة بعد صنعها، لا قبل ذلك",
    ckb: "دەستە دوای دروستکردنی تۆمار دەکرێت، نەک پێشتر",
  },
  "A batch made earlier is recorded by a manager": {
    ar: "الدفعة المصنوعة في وقت سابق يسجّلها مدير",
    ckb: "دەستەیەک کە پێشتر دروستکراوە بەڕێوەبەرێک تۆماری دەکات",
  },
  "Say why the batch is recorded late": {
    ar: "اذكر سبب تسجيل الدفعة متأخرة",
    ckb: "بڵێ بۆچی دەستەکە بە دواکەوتوویی تۆمار دەکرێت",
  },
  "A batch is recorded late by a day at most: yesterday's, not before": {
    ar: "تُسجَّل الدفعة متأخرة بيوم واحد على الأكثر: دفعة الأمس، لا ما قبلها",
    ckb: "دەستە زۆرترین بە ڕۆژێک دواکەوتوو تۆمار دەکرێت: هی دوێنێ، نەک پێشتر",
  },
  "That day is in a locked month: nothing is recorded in it": {
    ar: "ذلك اليوم في شهر مُقفل: لا يُسجَّل فيه شيء",
    ckb: "ئەو ڕۆژە لە مانگێکی داخراودایە: هیچی تێدا تۆمار ناکرێت",
  },
  "{1} has no ingredients in force that day": {
    ar: "ليس لـ{1} مكوّنات سارية في ذلك اليوم",
    ckb: "{1} لەو ڕۆژەدا هیچ پێکهاتەیەکی بەرکاری نییە",
  },
  "The use-by is after the batch was made": {
    ar: "موعد الاستعمال يكون بعد صنع الدفعة",
    ckb: "کاتی بەکارهێنان دوای دروستکردنی دەستەکەیە",
  },
  "A count of its items was approved after that time: a batch made before the count is not recorded now":
    {
      ar: "اعتُمد جرد لموادها بعد ذلك الوقت: لا تُسجَّل الآن دفعة صُنعت قبل الجرد",
      ckb: "دوای ئەو کاتە ژماردنێکی کاڵاکانی پەسەندکرا: دەستەیەک کە پێش ژماردنەکە دروستکرابێت ئێستا تۆمار ناکرێت",
    },
  "Say why the use-by changes": {
    ar: "اذكر سبب تغيير موعد الاستعمال",
    ckb: "بڵێ بۆچی کاتی بەکارهێنان دەگۆڕێت",
  },
  "This batch is cancelled": { ar: "هذه الدفعة ملغاة", ckb: "ئەم دەستەیە هەڵوەشێنراوەتەوە" },
  "Made in batches: its stock is kept batch by batch from this batch on": {
    ar: "يُصنع على دفعات: يُحفظ مخزونه دفعةً دفعة ابتداءً من هذه الدفعة",
    ckb: "بە دەستە دروست دەکرێت: کۆگاکەی لەم دەستەیەوە دەستە بە دەستە هەڵدەگیرێت",
  },
  "Made in batches: its stock is kept batch by batch from its next batch on": {
    ar: "يُصنع على دفعات: يُحفظ مخزونه دفعةً دفعة ابتداءً من دفعته التالية",
    ckb: "بە دەستە دروست دەکرێت: کۆگاکەی لە دەستەی داهاتوویەوە دەستە بە دەستە هەڵدەگیرێت",
  },
  // Losses by kind, giveaways at the till, and the loss report (0048).
  "Choose what kind of loss it is": { ar: "اختر نوع الخسارة", ckb: "جۆری زیانەکە هەڵبژێرە" },
  "At the till, a staff meal, on the house or a sample is given away": {
    ar: "على نقطة البيع لا يُهدى إلا وجبة موظف أو ضيافة من المحل أو عيّنة",
    ckb: "لەسەر خاڵی فرۆشتن تەنها خواردنی کارمەند، میوانداری یان نموونە دەبەخشرێت",
  },
  "Say why it is given away": { ar: "اذكر سبب الإهداء", ckb: "بڵێ بۆچی دەبەخشرێت" },
  "Choose what was lost": { ar: "اختر ما فُقد", ckb: "ئەوەی لەدەستچووە هەڵبژێرە" },
  "At most 50 lines at once": {
    ar: "50 سطرًا على الأكثر في المرة الواحدة",
    ckb: "لە یەک جاردا زۆرترین 50 دێڕ",
  },
  "Choose an item or a product that was lost": {
    ar: "اختر مادة أو منتجًا فُقد",
    ckb: "کاڵایەک یان بەرهەمێکی لەدەستچوو هەڵبژێرە",
  },
  "At the till, products are given away": {
    ar: "على نقطة البيع تُهدى المنتجات",
    ckb: "لەسەر خاڵی فرۆشتن بەرهەمەکان دەبەخشرێن",
  },
  "That batch is not of this item, here": {
    ar: "هذه الدفعة ليست من هذه المادة، هنا",
    ckb: "ئەو دەستەیە هی ئەم کاڵایە نییە، لێرە",
  },
  "A batch is named for an item, not a product": {
    ar: "تُذكر الدفعة لمادة، لا لمنتج",
    ckb: "دەستە بۆ کاڵایەک دیاری دەکرێت، نەک بۆ بەرهەمێک",
  },
  "{1} uses no stock: nothing is lost with it": {
    ar: "{1} لا يستهلك مخزونًا: لا يُفقد معه شيء",
    ckb: "{1} هیچ کۆگایەک بەکارناهێنێت: هیچی لەگەڵدا لەدەست ناچێت",
  },
  "Nothing given uses any stock: there is nothing to record": {
    ar: "لا شيء مما قُدّم يستهلك مخزونًا: لا شيء يُسجَّل",
    ckb: "هیچ شتێکی دراو کۆگا بەکارناهێنێت: هیچ نییە تۆمار بکرێت",
  },
  "Only {1} {2} of batch {3} is left": {
    ar: "بقي {1} {2} فقط من الدفعة {3}",
    ckb: "تەنها {1} {2} لە دەستەی {3} ماوە",
  },
  "Give it away as a staff meal, on the house or a sample": {
    ar: "قدّمه وجبة موظف أو ضيافة من المحل أو عيّنة",
    ckb: "وەک خواردنی کارمەند، میوانداری یان نموونە بیبەخشە",
  },
  "What is given away is eaten in or taken away": {
    ar: "ما يُهدى يؤكل في المحل أو يؤخذ سفري",
    ckb: "ئەوەی دەبەخشرێت لە شوێن دەخورێت یان دەبرێت",
  },
  "a loss (correct stock with a count or a stock correction)": {
    ar: "خسارة (صحّح المخزون بجرد أو بتصحيح مخزون)",
    ckb: "زیانێک (کۆگا بە ژماردن یان ڕاستکردنەوەی کۆگا ڕاست بکەرەوە)",
  },
  "A loss with no journal": { ar: "خسارة بلا قيد", ckb: "زیانێک بێ تۆمار" },
  loss: { ar: "الخسارة", ckb: "زیان" },

  // Staff, their hours and their pay (0049): what the database refuses with, and answers at the till.
  "Choose someone who works here": {
    ar: "اختر شخصًا يعمل هنا",
    ckb: "کەسێک هەڵبژێرە کە لێرە کار دەکات",
  },
  "Type the person's name": { ar: "اكتب اسم الشخص", ckb: "ناوی کەسەکە بنووسە" },
  "A name is at most 80 letters": {
    ar: "لا يتجاوز الاسم 80 حرفًا",
    ckb: "ناو لە 80 پیت زیاتر نابێت",
  },
  "Say when they started": { ar: "اذكر متى بدأ العمل", ckb: "بڵێ کەی دەستی بە کار کرد" },
  "They start within a year": { ar: "يبدأ خلال سنة", ckb: "لە ماوەی ساڵێکدا دەست پێدەکات" },
  "Choose where they work": { ar: "اختر مكان عمله", ckb: "شوێنی کارەکەی هەڵبژێرە" },
  "Someone here is called {1} already: add a surname or a nickname": {
    ar: "يوجد هنا مَن اسمه {1} مسبقًا: أضف اسم العائلة أو لقبًا",
    ckb: "کەسێک لێرە پێشتر ناوی {1} ـە: پاشناو یان نازناوێک زیاد بکە",
  },
  "Choose a login of this café": {
    ar: "اختر حسابًا من حسابات هذا المقهى",
    ckb: "هەژمارێکی ئەم کافێیە هەڵبژێرە",
  },
  "{1} is the login of someone else already": {
    ar: "{1} هو حساب شخص آخر مسبقًا",
    ckb: "{1} پێشتر هەژماری کەسێکی ترە",
  },
  "There are hours recorded before {1}: correct them first": {
    ar: "توجد ساعات مسجلة قبل {1}: صحّحها أولًا",
    ckb: "کاتژمێر پێش {1} تۆمار کراوە: سەرەتا ڕاستیان بکەرەوە",
  },
  "They cannot start after their last day ({1})": {
    ar: "لا يمكن أن يبدأ بعد آخر يوم عمل له ({1})",
    ckb: "ناتوانێت دوای دوایین ڕۆژی کارەکەی دەست پێبکات ({1})",
  },
  "Choose how they are paid: by the month, the day or the hour": {
    ar: "اختر طريقة احتساب أجره: بالشهر أو باليوم أو بالساعة",
    ckb: "هەڵبژێرە چۆن مووچە وەردەگرێت: مانگانە، ڕۆژانە یان بە کاتژمێر",
  },
  "Enter the pay": { ar: "أدخل الأجر", ckb: "مووچەکە بنووسە" },
  "A day's hours are more than 0 and at most 16": {
    ar: "ساعات اليوم أكثر من 0 وبحد أقصى 16",
    ckb: "کاتژمێرەکانی ڕۆژێک لە 0 زیاترن و لە 16 زیاتر نین",
  },
  "Overtime is paid at 100% to 300% of an hour's pay": {
    ar: "يُدفع العمل الإضافي بنسبة من 100% إلى 300% من أجر الساعة",
    ckb: "کاتی زیادە بە 100% تا 300% ی مووچەی کاتژمێرێک دەدرێت",
  },
  "Say why they work here again": {
    ar: "اذكر لماذا يعود للعمل هنا",
    ckb: "بڵێ بۆچی دووبارە لێرە کار دەکات",
  },
  "Say why they leave": { ar: "اذكر سبب مغادرته", ckb: "بڵێ بۆچی دەڕوات" },
  "They cannot leave before they started ({1})": {
    ar: "لا يمكن أن يغادر قبل أن يبدأ ({1})",
    ckb: "ناتوانێت پێش دەستپێکردنی بڕوات ({1})",
  },
  "{1} is clocked in: clock them out first": {
    ar: "{1} مسجَّل الحضور: سجّل انصرافه أولًا",
    ckb: "هاتنی {1} تۆمار کراوە: سەرەتا ڕۆیشتنی تۆمار بکە",
  },
  "There are hours recorded after {1}: correct them first": {
    ar: "توجد ساعات مسجلة بعد {1}: صحّحها أولًا",
    ckb: "کاتژمێر دوای {1} تۆمار کراوە: سەرەتا ڕاستیان بکەرەوە",
  },
  "{1} works here already": { ar: "{1} يعمل هنا مسبقًا", ckb: "{1} پێشتر لێرە کار دەکات" },
  "Choose up to 31 days": { ar: "اختر 31 يومًا كحد أقصى", ckb: "هەتا 31 ڕۆژ هەڵبژێرە" },
  "Give the hours as a list": { ar: "اكتب الساعات كقائمة", ckb: "کاتژمێرەکان وەک لیستێک بنووسە" },
  "Each day of the hours is within the dates chosen": {
    ar: "كل يوم من الساعات يقع ضمن التواريخ المختارة",
    ckb: "هەر ڕۆژێکی کاتژمێرەکان لە ناو بەروارە هەڵبژێردراوەکاندایە",
  },
  "{1} does not work here on {2}": {
    ar: "{1} لا يعمل هنا في {2}",
    ckb: "{1} لە {2} لێرە کار ناکات",
  },
  "Give the hours as 08:00 to 16:00": {
    ar: "اكتب الساعات هكذا: 08:00 إلى 16:00",
    ckb: "کاتژمێرەکان بەم شێوەیە بنووسە: 08:00 تا 16:00",
  },
  "{1} has one stretch of hours on {2} at most": {
    ar: "لـ{1} فترة دوام واحدة يوم {2} كحد أقصى",
    ckb: "{1} لە ڕۆژی {2} زۆرترین یەک ماوەی دەوامی هەیە",
  },
  "A note is at most 200 letters": {
    ar: "لا تتجاوز الملاحظة 200 حرف",
    ckb: "تێبینی لە 200 پیت زیاتر نابێت",
  },
  "The pay for {1} is approved: its hours can no longer change": {
    ar: "أجر {1} معتمد: لم يعد ممكنًا تغيير ساعاته",
    ckb: "مووچەی {1} پەسەند کراوە: چیتر کاتژمێرەکانی ناگۆڕدرێن",
  },
  "{1} works at {2} on {3} already": {
    ar: "{1} يعمل في {2} يوم {3} مسبقًا",
    ckb: "{1} پێشتر لە ڕۆژی {3} لە {2} کار دەکات",
  },
  "{1}'s hours overlap on {2}": {
    ar: "تتداخل ساعات {1} يوم {2}",
    ckb: "کاتژمێرەکانی {1} لە ڕۆژی {2} تێکەڵ دەبن",
  },
  "Choose up to 62 days": { ar: "اختر 62 يومًا كحد أقصى", ckb: "هەتا 62 ڕۆژ هەڵبژێرە" },
  "A record of hours is cancelled, not deleted": {
    ar: "يُلغى سجل الساعات ولا يُحذف",
    ckb: "تۆماری کاتژمێر هەڵدەوەشێنرێتەوە، ناسڕدرێتەوە",
  },
  "That record was cancelled": { ar: "أُلغي ذلك السجل", ckb: "ئەو تۆمارە هەڵوەشێنرایەوە" },
  "A record of hours stays with its person": {
    ar: "يبقى سجل الساعات مع صاحبه",
    ckb: "تۆماری کاتژمێر لەگەڵ خاوەنەکەی دەمێنێتەوە",
  },
  "Say when they clocked in": { ar: "اذكر متى سجّل حضوره", ckb: "بڵێ کەی هاتنی تۆمار کرد" },
  "The hours cannot be in the future": {
    ar: "لا يمكن أن تكون الساعات في المستقبل",
    ckb: "کاتژمێرەکان ناتوانن لە داهاتوودا بن",
  },
  "They clock out after they clock in": {
    ar: "يُسجَّل الانصراف بعد الحضور",
    ckb: "ڕۆیشتن دوای هاتن تۆمار دەکرێت",
  },
  "One record is a day of hours at most": {
    ar: "السجل الواحد يوم عمل واحد كحد أقصى",
    ckb: "یەک تۆمار زۆرترین کاتژمێرەکانی ڕۆژێکە",
  },
  "{1} has other hours recorded then, from {2}": {
    ar: "لـ{1} ساعات أخرى مسجلة في ذلك الوقت، منذ {2}",
    ckb: "{1} لەو کاتەدا کاتژمێری تری تۆمار کراوە، لە {2}ەوە",
  },
  "Say why the hours are corrected": {
    ar: "اذكر سبب تصحيح الساعات",
    ckb: "بڵێ بۆچی کاتژمێرەکان ڕاست دەکرێنەوە",
  },
  "Record of hours not found": { ar: "سجل الساعات غير موجود", ckb: "تۆماری کاتژمێر نەدۆزرایەوە" },
  "Say why the hours are added": {
    ar: "اذكر سبب إضافة الساعات",
    ckb: "بڵێ بۆچی کاتژمێرەکان زیاد دەکرێن",
  },
  "Say why the record is cancelled": {
    ar: "اذكر سبب إلغاء السجل",
    ckb: "بڵێ بۆچی تۆمارەکە هەڵدەوەشێنرێتەوە",
  },
  "{1} has no PIN yet: a manager sets one on Staff": {
    ar: "ليس لـ{1} رمز PIN بعد: يعيّنه المدير في شاشة «الموظفون»",
    ckb: "{1} هێشتا PIN ی نییە: بەڕێوەبەرێک لە شاشەی «کارمەندان» دایدەنێت",
  },
  "Clocking by PIN is paused for {1} after too many wrong PINs today: a manager sets a new PIN on Staff":
    {
      ar: "أُوقف تسجيل الحضور برمز PIN لـ{1} بعد رموز خاطئة كثيرة اليوم: يعيّن المدير رمزًا جديدًا في شاشة «الموظفون»",
      ckb: "تۆمارکردن بە PIN بۆ {1} ڕاگیراوە دوای PIN ی هەڵەی زۆر ئەمڕۆ: بەڕێوەبەرێک لە شاشەی «کارمەندان» PIN ێکی نوێ دادەنێت",
    },
  "{1} is clocked in already, since {2}": {
    ar: "{1} مسجَّل الحضور مسبقًا، منذ {2}",
    ckb: "هاتنی {1} پێشتر تۆمار کراوە، لە {2}ەوە",
  },
  "{1} has hours recorded until later today: a manager corrects them on Staff": {
    ar: "لـ{1} ساعات مسجلة حتى وقت لاحق من اليوم: يصحّحها المدير في شاشة «الموظفون»",
    ckb: "{1} کاتژمێری تا دواتری ئەمڕۆ تۆمار کراوە: بەڕێوەبەرێک لە شاشەی «کارمەندان» ڕاستیان دەکاتەوە",
  },
  "{1} is not clocked in": { ar: "{1} غير مسجَّل الحضور", ckb: "هاتنی {1} تۆمار نەکراوە" },
  "{1} has been clocked in for more than a day: a manager corrects the hours on Staff": {
    ar: "{1} مسجَّل الحضور منذ أكثر من يوم: يصحّح المدير الساعات في شاشة «الموظفون»",
    ckb: "هاتنی {1} زیاتر لە ڕۆژێکە تۆمار کراوە: بەڕێوەبەرێک کاتژمێرەکان لە شاشەی «کارمەندان» ڕاست دەکاتەوە",
  },
  "An advance is cancelled, not deleted": {
    ar: "تُلغى السلفة ولا تُحذف",
    ckb: "پێشەکی هەڵدەوەشێنرێتەوە، ناسڕدرێتەوە",
  },
  "An advance is not changed: cancel it and give it again": {
    ar: "لا تُعدَّل السلفة: ألغِها وأعطِها مجددًا",
    ckb: "پێشەکی ناگۆڕدرێت: هەڵیبوەشێنەوە و دووبارە بیدە",
  },
  "Say where the money came from: the till, the safe, the bank or the owner": {
    ar: "اذكر من أين جاء المال: درج النقد أو الخزنة أو البنك أو المالك",
    ckb: "بڵێ پارەکە لە کوێوە هات: دەخیلە، قاسە، بانک یان خاوەن",
  },
  "Say what the advance is for": { ar: "اذكر الغرض من السلفة", ckb: "بڵێ پێشەکییەکە بۆ چییە" },
  "Say why the advance is cancelled": {
    ar: "اذكر سبب إلغاء السلفة",
    ckb: "بڵێ بۆچی پێشەکییەکە هەڵدەوەشێنرێتەوە",
  },
  "Advance not found": { ar: "السلفة غير موجودة", ckb: "پێشەکییەکە نەدۆزرایەوە" },
  "This advance was cancelled already": {
    ar: "أُلغيت هذه السلفة مسبقًا",
    ckb: "ئەم پێشەکییە پێشتر هەڵوەشێنراوەتەوە",
  },
  "Some of this advance was taken back from a salary already: it cannot be cancelled": {
    ar: "استُرد جزء من هذه السلفة من راتب مسبقًا: لا يمكن إلغاؤها",
    ckb: "بەشێک لەم پێشەکییە پێشتر لە مووچەیەک گەڕێندراوەتەوە: ناتوانرێت هەڵبوەشێنرێتەوە",
  },
  "A payroll's approval is reopened, not deleted": {
    ar: "يُعاد فتح اعتماد كشف الرواتب ولا يُحذف",
    ckb: "پەسەندکردنی لیستی مووچە دووبارە دەکرێتەوە، ناسڕدرێتەوە",
  },
  "A payroll's approval is not changed: reopen the payroll": {
    ar: "لا يُعدَّل اعتماد كشف الرواتب: أعِد فتح الكشف",
    ckb: "پەسەندکردنی لیستی مووچە ناگۆڕدرێت: لیستەکە دووبارە بکەرەوە",
  },
  "Only a draft payroll changes: this one is approved": {
    ar: "لا يتغير إلا كشف الرواتب المسودة: هذا الكشف معتمد",
    ckb: "تەنها ڕەشنووسی لیستی مووچە دەگۆڕدرێت: ئەمە پەسەند کراوە",
  },
  "Choose the month": { ar: "اختر الشهر", ckb: "مانگەکە هەڵبژێرە" },
  "Choose a month that has begun": {
    ar: "اختر شهرًا قد بدأ",
    ckb: "مانگێک هەڵبژێرە کە دەستی پێکردبێت",
  },
  "The pay for {1} is approved already": {
    ar: "أجر {1} معتمد مسبقًا",
    ckb: "مووچەی {1} پێشتر پەسەند کراوە",
  },
  "Payroll line not found": {
    ar: "سطر كشف الرواتب غير موجود",
    ckb: "هێڵی لیستی مووچە نەدۆزرایەوە",
  },
  "Enter amounts of zero or more": {
    ar: "أدخل مبالغ تساوي الصفر أو أكثر",
    ckb: "بڕی پارەی سفر یان زیاتر بنووسە",
  },
  "Say what the addition is for": { ar: "اذكر الغرض من الإضافة", ckb: "بڵێ زیادکراوەکە بۆ چییە" },
  "Say what the deduction is for": { ar: "اذكر الغرض من الخصم", ckb: "بڵێ بڕدراوەکە بۆ چییە" },
  "The deductions are more than {1} earned ({2})": {
    ar: "الخصومات أكثر مما استحقه {1} ({2})",
    ckb: "بڕدراوەکان زیاترن لەوەی {1} شایەنی بوو ({2})",
  },
  "{1} owes {2} of advances: take back no more than that": {
    ar: "على {1} سلف بمبلغ {2}: لا تسترد أكثر من ذلك",
    ckb: "{1} {2} پێشەکی قەرزارە: لەوە زیاتر مەگەڕێنەوە",
  },
  "Take back no more of the advances than the pay ({1})": {
    ar: "لا تسترد من السلف أكثر من الأجر ({1})",
    ckb: "لە پێشەکییەکان زیاتر لە مووچەکە مەگەڕێنەوە ({1})",
  },
  "Payroll not found": { ar: "كشف الرواتب غير موجود", ckb: "لیستی مووچە نەدۆزرایەوە" },
  "This payroll is approved already": {
    ar: "كشف الرواتب هذا معتمد مسبقًا",
    ckb: "ئەم لیستی مووچەیە پێشتر پەسەند کراوە",
  },
  "The pay for {1} is approved once the month is over": {
    ar: "يُعتمد أجر {1} بعد انتهاء الشهر",
    ckb: "مووچەی {1} دوای تەواوبوونی مانگەکە پەسەند دەکرێت",
  },
  "Nobody worked here in {1}: there is no pay to approve": {
    ar: "لم يعمل أحد هنا في {1}: لا أجر لاعتماده",
    ckb: "لە {1} کەس لێرە کاری نەکرد: هیچ مووچەیەک نییە بۆ پەسەندکردن",
  },
  "{1} is still clocked in since {2}: clock them out or correct the hours first": {
    ar: "ما زال {1} مسجَّل الحضور منذ {2}: سجّل انصرافه أو صحّح الساعات أولًا",
    ckb: "هاتنی {1} هێشتا لە {2}ەوە تۆمار کراوە: سەرەتا ڕۆیشتنی تۆمار بکە یان کاتژمێرەکان ڕاست بکەرەوە",
  },
  "Set {1}'s pay on Staff, then draft the payroll again": {
    ar: "حدّد أجر {1} في شاشة «الموظفون»، ثم أعدّ كشف الرواتب مجددًا",
    ckb: "مووچەی {1} لە شاشەی «کارمەندان» دابنێ، پاشان لیستی مووچە دووبارە ئامادە بکەرەوە",
  },
  "The hours or the pay changed since this draft: draft it again, check it, then approve it": {
    ar: "تغيّرت الساعات أو الأجور منذ هذه المسودة: أعدّها مجددًا وراجعها ثم اعتمدها",
    ckb: "لەم ڕەشنووسەوە کاتژمێرەکان یان مووچەکان گۆڕاون: دووبارە ئامادەی بکەرەوە، بیپشکنە، پاشان پەسەندی بکە",
  },
  "Say why the payroll is reopened": {
    ar: "اذكر سبب إعادة فتح كشف الرواتب",
    ckb: "بڵێ بۆچی لیستی مووچە دووبارە دەکرێتەوە",
  },
  "This payroll is a draft already": {
    ar: "كشف الرواتب هذا مسودة مسبقًا",
    ckb: "ئەم لیستی مووچەیە پێشتر ڕەشنووسە",
  },
  "Salaries were paid from this payroll: cancel the payments first": {
    ar: "دُفعت رواتب من هذا الكشف: ألغِ الدفعات أولًا",
    ckb: "مووچە لەم لیستە دراوە: سەرەتا پارەدانەکان هەڵبوەشێنەوە",
  },
  "A salary payment is cancelled, not deleted": {
    ar: "تُلغى دفعة الراتب ولا تُحذف",
    ckb: "پارەدانی مووچە هەڵدەوەشێنرێتەوە، ناسڕدرێتەوە",
  },
  "A salary payment is not changed: cancel it and pay again": {
    ar: "لا تُعدَّل دفعة الراتب: ألغِها وادفع مجددًا",
    ckb: "پارەدانی مووچە ناگۆڕدرێت: هەڵیبوەشێنەوە و دووبارە بیدە",
  },
  "Approve the payroll first": {
    ar: "اعتمد كشف الرواتب أولًا",
    ckb: "سەرەتا لیستی مووچە پەسەند بکە",
  },
  "{1} is paid in full already": {
    ar: "دُفع لـ{1} كامل المستحق مسبقًا",
    ckb: "مووچەی {1} پێشتر بە تەواوی دراوە",
  },
  "That is more than is owed to {1} ({2})": {
    ar: "هذا أكثر من المستحق لـ{1} ({2})",
    ckb: "ئەمە زیاترە لەوەی بە {1} قەرزارین ({2})",
  },
  "Everyone is paid in full already": {
    ar: "دُفع للجميع كامل المستحق مسبقًا",
    ckb: "مووچەی هەمووان پێشتر بە تەواوی دراوە",
  },
  "Say why the payment is cancelled": {
    ar: "اذكر سبب إلغاء الدفعة",
    ckb: "بڵێ بۆچی پارەدانەکە هەڵدەوەشێنرێتەوە",
  },
  "Salary payment not found": { ar: "دفعة الراتب غير موجودة", ckb: "پارەدانی مووچە نەدۆزرایەوە" },
  "This payment was cancelled already": {
    ar: "أُلغيت هذه الدفعة مسبقًا",
    ckb: "ئەم پارەدانە پێشتر هەڵوەشێنراوەتەوە",
  },
  "Choose up to a year": {
    ar: "اختر مدة لا تتجاوز سنة",
    ckb: "ماوەیەک هەڵبژێرە کە لە ساڵێک زیاتر نەبێت",
  },
  "An approved payroll with no journal": {
    ar: "كشف رواتب معتمد بلا قيد",
    ckb: "لیستێکی مووچەی پەسەندکراو بێ تۆمار",
  },
  "An advance with no journal": { ar: "سلفة بلا قيد", ckb: "پێشەکییەک بێ تۆمار" },
  "A salary payment with no journal": { ar: "دفعة راتب بلا قيد", ckb: "پارەدانێکی مووچە بێ تۆمار" },
  "A return to a supplier with no journal": {
    ar: "مرتجع إلى مورّد بلا قيد",
    ckb: "گەڕاندنەوەیەک بۆ دابینکەر بێ تۆمار",
  },
  "A supplier's credit with no journal": {
    ar: "إشعار دائن من مورّد بلا قيد",
    ckb: "پسووڵەی گەڕاندنەوەی دابینکەرێک بێ تۆمار",
  },
  "payroll's approval": { ar: "اعتماد كشف الرواتب", ckb: "پەسەندکردنی لیستی مووچە" },
  "salary payment": { ar: "دفعة الراتب", ckb: "پارەدانی مووچە" },
  // A journal whose transfer does not exist (0054).
  transfer: { ar: "التحويل", ckb: "گواستنەوەکە" },
  "return to a supplier": { ar: "المرتجع إلى المورّد", ckb: "گەڕاندنەوەکە بۆ دابینکەر" },
  "a payroll's approval (reopen the payroll on Payroll while nothing is paid from it)": {
    ar: "اعتماد كشف رواتب (أعِد فتح الكشف في شاشة «الرواتب» ما دام لم يُدفع منه شيء)",
    ckb: "پەسەندکردنی لیستێکی مووچە (لیستەکە لە شاشەی «مووچە» دووبارە بکەرەوە تا هیچی لێ نەدرابێت)",
  },
  "an advance to someone who works here (cancel it on Payroll)": {
    ar: "سلفة لشخص يعمل هنا (ألغِها في شاشة «الرواتب»)",
    ckb: "پێشەکییەک بۆ کەسێک کە لێرە کار دەکات (لە شاشەی «مووچە» هەڵیبوەشێنەوە)",
  },
  "a salary payment (cancel it on Payroll)": {
    ar: "دفعة راتب (ألغِها في شاشة «الرواتب»)",
    ckb: "پارەدانێکی مووچە (لە شاشەی «مووچە» هەڵیبوەشێنەوە)",
  },
  "a refund (refund the rest of the sale on Orders if more should go back)": {
    ar: "استرداد (استردّ باقي البيع من شاشة «الطلبات» إن وجب ردّ المزيد)",
    ckb: "گەڕاندنەوەی پارەیەک (ئەگەر دەبێت زیاتر بگەڕێنرێتەوە، باقی فرۆشتنەکە لە شاشەی «داواکارییەکان» بگەڕێنەوە)",
  },
  "the opening count of a cash session": {
    ar: "عدّ افتتاح وردية نقد",
    ckb: "ژماردنی کردنەوەی شیفتێکی پارە",
  },
  "a return to a supplier (record a credit on Vendors if more is owed back)": {
    ar: "مرتجع إلى مورّد (سجّل إشعارًا دائنًا من شاشة «المورّدون» إن كان يُستحق ردّ المزيد)",
    ckb: "گەڕاندنەوەیەک بۆ دابینکەر (ئەگەر زیاتر دەبێت بگەڕێنرێتەوە، لە شاشەی «دابینکەران» پسووڵەی گەڕاندنەوە تۆمار بکە)",
  },

  // Stock sent between the café's places (0054): refused, in words.
  "Stock in transit (1210) moves only with a transfer between places": {
    ar: "لا يتحرك المخزون في الطريق (1210) إلا بتحويل بين الأماكن",
    ckb: "کۆگای لە ڕێگادا (1210) تەنها بە گواستنەوە لە نێوان شوێنەکاندا دەجووڵێت",
  },
  "A transfer is not deleted: cancel it while it is on its way": {
    ar: "لا يُحذف التحويل: ألغِه ما دام في الطريق",
    ckb: "گواستنەوە ناسڕدرێتەوە: تا لە ڕێگادایە هەڵیبوەشێنەوە",
  },
  "Transfer {1} is settled: it does not change": {
    ar: "انتهى التحويل {1}: لا يتغير",
    ckb: "گواستنەوەی {1} کۆتایی هاتووە: ناگۆڕدرێت",
  },
  "What was sent does not change: cancel the transfer and send it again": {
    ar: "ما أُرسل لا يتغير: ألغِ التحويل وأرسله من جديد",
    ckb: "ئەوەی نێردرا ناگۆڕدرێت: گواستنەوەکە هەڵبوەشێنەوە و دووبارە بینێرە",
  },
  "What arrived does not change": { ar: "ما وصل لا يتغير", ckb: "ئەوەی گەیشت ناگۆڕدرێت" },
  "Choose where the stock goes": {
    ar: "اختر المكان الذي يذهب إليه المخزون",
    ckb: "هەڵبژێرە کۆگاکە بۆ کوێ دەچێت",
  },
  "The stock goes to another place": {
    ar: "يذهب المخزون إلى مكان آخر، لا إلى المكان نفسه",
    ckb: "کۆگاکە بۆ شوێنێکی تر دەچێت، نەک بۆ هەمان شوێن",
  },
  "Unknown item on the transfer": {
    ar: "صنف غير معروف في التحويل",
    ckb: "کاڵایەکی نەناسراو لە گواستنەوەکەدا",
  },
  "{1} is on the transfer twice: one line for it": {
    ar: "{1} مذكور في التحويل مرتين: سطر واحد له",
    ckb: "{1} دوو جار لە گواستنەوەکەدایە: یەک هێڵ بۆی",
  },
  "This leaves {1} below zero, which its rule refuses: count it, or send less": {
    ar: "هذا يترك {1} دون الصفر، وقاعدته ترفض ذلك: اجرده، أو أرسل كمية أقل",
    ckb: "ئەمە {1} دەباتە ژێر سفر، کە یاساکەی ڕێگەی پێ نادات: بیژمێرە، یان کەمتر بنێرە",
  },
  "This leaves {1} below zero: confirm to send it all the same": {
    ar: "هذا يترك {1} دون الصفر: أكّد لإرساله مع ذلك",
    ckb: "ئەمە {1} دەباتە ژێر سفر: پشتڕاستی بکەرەوە بۆ ئەوەی هەر بنێردرێت",
  },
  "Transfer not found": { ar: "لم يُعثر على التحويل", ckb: "گواستنەوەکە نەدۆزرایەوە" },
  "Transfer {1} was received already": {
    ar: "استُلم التحويل {1} مسبقًا",
    ckb: "گواستنەوەی {1} پێشتر وەرگیراوە",
  },
  "Transfer {1} was cancelled": { ar: "أُلغي التحويل {1}", ckb: "گواستنەوەی {1} هەڵوەشێنراوەتەوە" },
  "That line is not on this transfer": {
    ar: "هذا السطر ليس في هذا التحويل",
    ckb: "ئەو هێڵە لەم گواستنەوەیەدا نییە",
  },
  "What arrived of {1} cannot be less than nothing": {
    ar: "لا يمكن أن يكون ما وصل من {1} أقل من لا شيء",
    ckb: "ئەوەی لە {1} گەیشت ناتوانێت لە هیچ کەمتر بێت",
  },
  "More of {1} cannot arrive than was sent ({2} {3})": {
    ar: "لا يمكن أن يصل من {1} أكثر مما أُرسل ({2} {3})",
    ckb: "لە {1} ناتوانێت زیاتر لەوەی نێردرا بگات ({2} {3})",
  },
  "Say why the transfer is cancelled": {
    ar: "اذكر سبب إلغاء التحويل",
    ckb: "بڵێ بۆچی گواستنەوەکە هەڵدەوەشێنرێتەوە",
  },
  "Transfer {1} was received: it is not cancelled": {
    ar: "استُلم التحويل {1}: فلا يُلغى",
    ckb: "گواستنەوەی {1} وەرگیراوە: هەڵناوەشێنرێتەوە",
  },
  "Transfer {1} was cancelled already": {
    ar: "أُلغي التحويل {1} مسبقًا",
    ckb: "گواستنەوەی {1} پێشتر هەڵوەشێنراوەتەوە",
  },
  // Where a journal came from, and a transfer lacking its journal (0054).
  "stock sent to another place (cancel the transfer on Inventory while it is on its way)": {
    ar: "مخزون أُرسل إلى مكان آخر (ألغِ التحويل في «المخزون» ما دام في الطريق)",
    ckb: "کۆگایەک کە بۆ شوێنێکی تر نێردرا (تا لە ڕێگادایە، گواستنەوەکە لە «کۆگا» هەڵبوەشێنەوە)",
  },
  "stock received from another place": {
    ar: "مخزون استُلم من مكان آخر",
    ckb: "کۆگایەک کە لە شوێنێکی ترەوە وەرگیرا",
  },
  "a transfer cancelled on its way": {
    ar: "تحويل أُلغي وهو في الطريق",
    ckb: "گواستنەوەیەک کە لە ڕێگادا هەڵوەشێنرایەوە",
  },
  "Stock sent to another place with no journal": {
    ar: "مخزون أُرسل إلى مكان آخر بلا قيد",
    ckb: "کۆگایەک بۆ شوێنێکی تر نێردرا بێ تۆمار",
  },
  "Stock received from another place with no journal": {
    ar: "مخزون استُلم من مكان آخر بلا قيد",
    ckb: "کۆگایەک لە شوێنێکی ترەوە وەرگیرا بێ تۆمار",
  },
  "A transfer cancelled on its way with no journal": {
    ar: "تحويل أُلغي في الطريق بلا قيد",
    ckb: "گواستنەوەیەک لە ڕێگادا هەڵوەشێنرایەوە بێ تۆمار",
  },
  // Prepaid expenses (0060).
  "a prepaid expense (cancel it on Expenses)": {
    ar: "مصروف مدفوع مقدمًا (ألغِه في شاشة «المصروفات»)",
    ckb: "خەرجییەکی پێشەکی (لە شاشەی «خەرجییەکان» هەڵیبوەشێنەوە)",
  },
  "A prepaid expense is never deleted: cancel it instead": {
    ar: "لا يُحذف مصروف مدفوع مقدمًا أبدًا: ألغِه بدلًا من ذلك",
    ckb: "خەرجییەکی پێشەکی هەرگیز ناسڕدرێتەوە: لە جیاتی ئەوە هەڵیبوەشێنەوە",
  },
  "That prepaid expense was cancelled already": {
    ar: "أُلغي هذا المصروف المدفوع مقدمًا من قبل",
    ckb: "ئەم خەرجییە پێشەکییە پێشتر هەڵوەشێنراوەتەوە",
  },
  "A prepaid expense stays as it was recorded: cancel it and record it again": {
    ar: "يبقى المصروف المدفوع مقدمًا كما سُجّل: ألغِه وسجّله من جديد",
    ckb: "خەرجیی پێشەکی وەک تۆمارکراوە دەمێنێتەوە: هەڵیبوەشێنەوە و دووبارە تۆماری بکەرەوە",
  },
  "A month's share of a prepaid expense is not changed: cancel the prepaid expense instead": {
    ar: "لا تُغيَّر حصة شهر من مصروف مدفوع مقدمًا: ألغِ المصروف المدفوع مقدمًا بدلًا من ذلك",
    ckb: "بەشی مانگێک لە خەرجییەکی پێشەکی ناگۆڕدرێت: لە جیاتی ئەوە خەرجییە پێشەکییەکە هەڵبوەشێنەوە",
  },
  "Prepaid expenses (1400) move only with a prepaid expense: record one on Expenses": {
    ar: "لا تتحرك المصروفات المدفوعة مقدمًا (1400) إلا بمصروف مدفوع مقدمًا: سجّله في شاشة «المصروفات»",
    ckb: "خەرجییە پێشەکییەکان (1400) تەنها بە خەرجییەکی پێشەکی دەجووڵێن: یەکێک لە شاشەی «خەرجییەکان» تۆمار بکە",
  },
  "A prepaid expense covers 1 to 36 months": {
    ar: "يغطي المصروف المدفوع مقدمًا من شهر إلى 36 شهرًا",
    ckb: "خەرجیی پێشەکی لە 1 تا 36 مانگ دەگرێتەوە",
  },
  "For this month alone, record an expense": {
    ar: "لهذا الشهر وحده، سجّل مصروفًا",
    ckb: "بۆ تەنها ئەم مانگە، خەرجییەک تۆمار بکە",
  },
  "A prepaid expense starts this month or later: what it paid for before is an expense of those months":
    {
      ar: "يبدأ المصروف المدفوع مقدمًا هذا الشهر أو بعده: ما دُفع عن أشهر سابقة مصروفُ تلك الأشهر",
      ckb: "خەرجیی پێشەکی لەم مانگەوە یان دواتر دەست پێدەکات: ئەوەی بۆ پێشتر دراوە خەرجیی ئەو مانگانەیە",
    },
  "A prepaid expense starts within a year": {
    ar: "يبدأ المصروف المدفوع مقدمًا خلال سنة",
    ckb: "خەرجیی پێشەکی لە ماوەی ساڵێکدا دەست پێدەکات",
  },
  "Each month takes at least 1 of it: pay at least {1}, or cover fewer months": {
    ar: "يأخذ كل شهر 1 منه على الأقل: ادفع {1} على الأقل، أو غطِّ أشهرًا أقل",
    ckb: "هەر مانگێک لانیکەم 1ی لێ وەردەگرێت: لانیکەم {1} بدە، یان مانگی کەمتر بگرەوە",
  },
  "Say why the prepaid expense is cancelled": {
    ar: "اذكر سبب إلغاء المصروف المدفوع مقدمًا",
    ckb: "بڵێ بۆچی خەرجییە پێشەکییەکە هەڵدەوەشێنرێتەوە",
  },
  "Prepaid expense not found": {
    ar: "لم يُعثر على المصروف المدفوع مقدمًا",
    ckb: "خەرجییە پێشەکییەکە نەدۆزرایەوە",
  },
};

export default phrases;
