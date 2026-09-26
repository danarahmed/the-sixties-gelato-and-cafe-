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
  "Only those who approve discounts, voids or refunds have a PIN": {
    ar: "لا يملك رمز PIN إلا من يوافق على الخصومات أو الإلغاءات أو الاستردادات",
    ckb: "PIN تەنها بۆ ئەوانەیە کە ڕەزامەندی لەسەر داشکاندن، هەڵوەشاندنەوە یان گەڕاندنەوەی پارە دەدەن",
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
  "Say what was done about it, or why it is fine": {
    ar: "اذكر ما الذي فُعل بشأنه، أو لماذا لا مشكلة فيه",
    ckb: "بڵێ چی بۆ کرا، یان بۆچی کێشە نییە",
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
};

export default phrases;
