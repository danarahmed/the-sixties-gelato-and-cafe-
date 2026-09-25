import type { PhraseBook } from "./types";

/**
 * Words every screen shares: the frame around each page, what a failed page
 * says, the words of forms and tables, and the names the app gives payments,
 * roles, item types, stock movements and order states (src/lib/format.ts). An
 * area's own book never repeats one of these: it uses it from here.
 */
const phrases: PhraseBook = {
  // The frame, and a page that failed.
  Menu: { ar: "القائمة", ckb: "مێنیو" },
  "This screen could not be loaded": {
    ar: "تعذّر تحميل هذه الشاشة",
    ckb: "ئەم شاشەیە بار نەکرا",
  },
  "The information could not be read from the database, so nothing is shown rather than something incomplete. Nothing has been changed.":
    {
      ar: "تعذّرت قراءة المعلومات من قاعدة البيانات، فلا يُعرض شيء بدلًا من عرض شيء ناقص. لم يتغيّر أي شيء.",
      ckb: "زانیارییەکان لە بنکەدراوەکەوە نەخوێنرانەوە، بۆیە هیچ پیشان نادرێت لە جیاتی شتێکی ناتەواو. هیچ شتێک نەگۆڕدرا.",
    },
  "If it keeps happening, tell the owner.": {
    ar: "إن تكرّر ذلك، فأخبر المالك.",
    ckb: "ئەگەر دووبارە بووەوە، بە خاوەنەکە بڵێ.",
  },
  "If it keeps happening, tell the owner, and quote reference {ref}.": {
    ar: "إن تكرّر ذلك، فأخبر المالك واذكر المرجع {ref}.",
    ckb: "ئەگەر دووبارە بووەوە، بە خاوەنەکە بڵێ و ژمارەی {ref} بڵێ.",
  },
  "Try again": { ar: "حاول مرة أخرى", ckb: "دووبارە هەوڵ بدەوە" },

  // Forms and tables.
  Save: { ar: "حفظ", ckb: "پاشەکەوتکردن" },
  "Saving…": { ar: "جارٍ الحفظ…", ckb: "پاشەکەوت دەکرێت…" },
  "Saved.": { ar: "تم الحفظ.", ckb: "پاشەکەوت کرا." },
  Cancel: { ar: "إلغاء", ckb: "هەڵوەشاندنەوە" },
  "Cancel…": { ar: "إلغاء…", ckb: "هەڵوەشاندنەوە…" },
  "Cancel it": { ar: "ألغِه", ckb: "هەڵیبوەشێنەوە" },
  Keep: { ar: "أبقِه", ckb: "بیهێڵەرەوە" },
  Close: { ar: "إغلاق", ckb: "داخستن" },
  Back: { ar: "رجوع", ckb: "گەڕانەوە" },
  "Edit…": { ar: "تعديل…", ckb: "دەستکاری…" },
  Edit: { ar: "تعديل", ckb: "دەستکاری" },
  Add: { ar: "إضافة", ckb: "زیادکردن" },
  Remove: { ar: "إزالة", ckb: "لابردن" },
  Show: { ar: "عرض", ckb: "پیشاندان" },
  Search: { ar: "بحث", ckb: "گەڕان" },
  Print: { ar: "طباعة", ckb: "چاپکردن" },
  "Download CSV": { ar: "تنزيل CSV", ckb: "داگرتنی CSV" },
  Yes: { ar: "نعم", ckb: "بەڵێ" },
  No: { ar: "لا", ckb: "نەخێر" },
  yes: { ar: "نعم", ckb: "بەڵێ" },
  no: { ar: "لا", ckb: "نەخێر" },
  None: { ar: "لا شيء", ckb: "هیچ" },
  "— none —": { ar: "— لا شيء —", ckb: "— هیچ —" },
  Date: { ar: "التاريخ", ckb: "بەروار" },
  From: { ar: "من", ckb: "لە" },
  To: { ar: "إلى", ckb: "بۆ" },
  When: { ar: "متى", ckb: "کەی" },
  Who: { ar: "مَن", ckb: "کێ" },
  By: { ar: "بواسطة", ckb: "لەلایەن" },
  Name: { ar: "الاسم", ckb: "ناو" },
  "Arabic name": { ar: "الاسم بالعربية", ckb: "ناوی عەرەبی" },
  "Kurdish name": { ar: "الاسم بالكردية", ckb: "ناوی کوردی" },
  Note: { ar: "ملاحظة", ckb: "تێبینی" },
  Reason: { ar: "السبب", ckb: "هۆکار" },
  Status: { ar: "الحالة", ckb: "دۆخ" },
  Amount: { ar: "المبلغ", ckb: "بڕی پارە" },
  Total: { ar: "المجموع", ckb: "کۆی گشتی" },
  Quantity: { ar: "الكمية", ckb: "بڕ" },
  Unit: { ar: "الوحدة", ckb: "یەکە" },
  Price: { ar: "السعر", ckb: "نرخ" },
  Cost: { ar: "الكلفة", ckb: "تێچوو" },
  Item: { ar: "المادة", ckb: "کاڵا" },
  Product: { ar: "المنتج", ckb: "بەرهەم" },
  Supplier: { ar: "المورّد", ckb: "دابینکەر" },
  Account: { ar: "الحساب", ckb: "هەژمار" },
  Journal: { ar: "القيد", ckb: "تۆمار" },
  Location: { ar: "الموقع", ckb: "شوێن" },
  Today: { ar: "اليوم", ckb: "ئەمڕۆ" },
  Yesterday: { ar: "أمس", ckb: "دوێنێ" },
  "Nothing yet": { ar: "لا شيء بعد", ckb: "هێشتا هیچ" },
  unknown: { ar: "غير معروف", ckb: "نەزانراو" },

  // Days and months, as a date is written out.
  Monday: { ar: "الإثنين", ckb: "دووشەممە" },
  Tuesday: { ar: "الثلاثاء", ckb: "سێشەممە" },
  Wednesday: { ar: "الأربعاء", ckb: "چوارشەممە" },
  Thursday: { ar: "الخميس", ckb: "پێنجشەممە" },
  Friday: { ar: "الجمعة", ckb: "هەینی" },
  Saturday: { ar: "السبت", ckb: "شەممە" },
  Sunday: { ar: "الأحد", ckb: "یەکشەممە" },
  Jan: { ar: "كانون الثاني", ckb: "کانوونی دووەم" },
  Feb: { ar: "شباط", ckb: "شوبات" },
  Mar: { ar: "آذار", ckb: "ئازار" },
  Apr: { ar: "نيسان", ckb: "نیسان" },
  May: { ar: "أيار", ckb: "ئایار" },
  Jun: { ar: "حزيران", ckb: "حوزەیران" },
  Jul: { ar: "تموز", ckb: "تەممووز" },
  Aug: { ar: "آب", ckb: "ئاب" },
  Sep: { ar: "أيلول", ckb: "ئەیلوول" },
  Oct: { ar: "تشرين الأول", ckb: "تشرینی یەکەم" },
  Nov: { ar: "تشرين الثاني", ckb: "تشرینی دووەم" },
  Dec: { ar: "كانون الأول", ckb: "کانوونی یەکەم" },

  // How money is taken or paid (tenderLabel).
  Cash: { ar: "نقدًا", ckb: "کاش" },
  Card: { ar: "بطاقة", ckb: "کارت" },
  "Platform-paid": { ar: "مدفوع عبر المنصة", ckb: "لە ڕێگەی پلاتفۆرمەوە پارەدراو" },
  Bank: { ar: "البنك", ckb: "بانک" },
  "Bank transfer": { ar: "تحويل مصرفي", ckb: "گواستنەوەی بانکی" },

  // Roles (roleLabel).
  Owner: { ar: "المالك", ckb: "خاوەن" },
  "General manager": { ar: "المدير العام", ckb: "بەڕێوەبەری گشتی" },
  "Branch manager": { ar: "مدير الفرع", ckb: "بەڕێوەبەری لق" },
  Cashier: { ar: "أمين الصندوق", ckb: "کاشێر" },
  "Barista / production": { ar: "باريستا / إنتاج", ckb: "باریستا / بەرهەمهێنان" },
  "Inventory counter": { ar: "عادّ المخزون", ckb: "ژمێرەری کۆگا" },
  Purchasing: { ar: "المشتريات", ckb: "کڕین" },
  Accountant: { ar: "المحاسب", ckb: "ژمێریار" },
  "Read-only auditor": { ar: "مدقق (للقراءة فقط)", ckb: "وردبین (تەنها خوێندنەوە)" },

  // Item types (itemTypeLabel).
  Ingredient: { ar: "مكوّن", ckb: "پێکهاتە" },
  Packaging: { ar: "تغليف", ckb: "پێچانەوە" },
  Consumable: { ar: "مستهلك", ckb: "بەکاربراو" },
  "Finished good": { ar: "منتج نهائي", ckb: "بەرهەمی ئامادە" },
  Resale: { ar: "لإعادة البيع", ckb: "بۆ دووبارە فرۆشتنەوە" },
  "Sub-recipe": { ar: "وصفة فرعية", ckb: "ڕەسەتەی لاوەکی" },

  // Stock movements (movementLabel).
  "Opening balance": { ar: "الرصيد الافتتاحي", ckb: "باڵانسی سەرەتا" },
  "Purchase receipt": { ar: "استلام مشتريات", ckb: "وەرگرتنی کڕین" },
  "Supplier return": { ar: "إرجاع إلى المورّد", ckb: "گەڕاندنەوە بۆ دابینکەر" },
  Sale: { ar: "بيع", ckb: "فرۆشتن" },
  "Production use": { ar: "استخدام في الإنتاج", ckb: "بەکارهێنان لە بەرهەمهێناندا" },
  "Production output": { ar: "ناتج الإنتاج", ckb: "بەرهەمی بەرهەمهێنان" },
  "Count adjustment": { ar: "تسوية الجرد", ckb: "ڕاستکردنەوەی ژماردن" },
  "Manual correction": { ar: "تصحيح يدوي", ckb: "ڕاستکردنەوەی دەستی" },
  Waste: { ar: "هدر", ckb: "بەفیڕۆچوون" },
  Spoilage: { ar: "تلف", ckb: "خراپبوون" },
  Expired: { ar: "منتهي الصلاحية", ckb: "بەسەرچوو" },
  Damaged: { ar: "متضرر", ckb: "زیانلێکەوتوو" },
  "Melt / evaporation": { ar: "ذوبان / تبخّر", ckb: "توانەوە / هەڵمبوون" },
  "Staff consumption": { ar: "استهلاك الموظفين", ckb: "بەکارهێنانی ستاف" },
  Complimentary: { ar: "مجاني (ضيافة)", ckb: "بێبەرامبەر (میوانداری)" },
  Sampling: { ar: "تذوّق", ckb: "تامکردن" },
  "Transfer in": { ar: "تحويل وارد", ckb: "گواستنەوەی هاتوو" },
  "Transfer out": { ar: "تحويل صادر", ckb: "گواستنەوەی دەرچوو" },
  "Refund return": { ar: "إرجاع مع الاسترداد", ckb: "گەڕانەوە لەگەڵ پارەدانەوە" },
  Reversal: { ar: "عكس", ckb: "هەڵگەڕاندنەوە" },

  // What a form says when an entry is wrong (src/lib/validation.ts): {1} is
  // the field's own name ("The amount"), itself a phrase of its screen's book.
  "{1} must be a number greater than zero": {
    ar: "يجب أن يكون {1} رقمًا أكبر من الصفر",
    ckb: "{1} دەبێت ژمارەیەک بێت لە سفر زیاتر",
  },
  "{1} must be a number of zero or more": {
    ar: "يجب أن يكون {1} رقمًا يساوي الصفر أو أكثر",
    ckb: "{1} دەبێت ژمارەیەک بێت، سفر یان زیاتر",
  },
  "{1} must be a number other than zero": {
    ar: "يجب أن يكون {1} رقمًا غير الصفر",
    ckb: "{1} دەبێت ژمارەیەک بێت جگە لە سفر",
  },
  "Choose {1}": { ar: "اختر {1}", ckb: "{1} هەڵبژێرە" },
  "{1} must be a date": { ar: "يجب أن يكون {1} تاريخًا", ckb: "{1} دەبێت بەروار بێت" },
  "{1} is required": { ar: "{1} مطلوب", ckb: "{1} پێویستە" },
  "{1} is too long": { ar: "{1} طويل جدًا", ckb: "{1} زۆر درێژە" },
  "Too long": { ar: "طويل جدًا", ckb: "زۆر درێژە" },
  "A discount is more than 0% and no more than 100%": {
    ar: "الخصم أكثر من 0% ولا يزيد على 100%",
    ckb: "داشکاندن لە 0% زیاترە و لە 100% زیاتر نییە",
  },
  "A discount must be more than zero": {
    ar: "يجب أن يكون الخصم أكثر من الصفر",
    ckb: "داشکاندن دەبێت لە سفر زیاتر بێت",
  },
  "Choose where the money came from": {
    ar: "اختر من أين جاء المال",
    ckb: "هەڵبژێرە پارەکە لە کوێوە هات",
  },
  "Choose a channel": { ar: "اختر قناة البيع", ckb: "کەناڵێکی فرۆشتن هەڵبژێرە" },
  "An order number is letters and digits, as the platform's tablet shows it": {
    ar: "رقم الطلب حروف وأرقام، كما يظهر على جهاز المنصة اللوحي",
    ckb: "ژمارەی داواکاری پیت و ژمارەیە، وەک تابلێتی پلاتفۆرمەکە پیشانی دەدات",
  },

  // What the database's answer means (src/lib/db/rpc.ts, rpcOutcome.ts).
  "The database is missing an update this screen needs (a migration has not been applied yet).": {
    ar: "ينقص قاعدةَ البيانات تحديثٌ تحتاجه هذه الشاشة (لم يُطبَّق ترحيلٌ بعد).",
    ckb: "بنکەدراوەکە نوێکردنەوەیەکی کەمە کە ئەم شاشەیە پێویستیەتی (کۆچێک هێشتا جێبەجێ نەکراوە).",
  },
  "Your session has ended. Sign in again.": {
    ar: "انتهت جلستك. سجّل الدخول مرة أخرى.",
    ckb: "دانیشتنەکەت کۆتایی هات. دووبارە بچۆ ژوورەوە.",
  },
  "You do not have permission to do that.": {
    ar: "ليست لديك صلاحية للقيام بذلك.",
    ckb: "مۆڵەتی ئەو کارەت نییە.",
  },
  "That has already been recorded.": { ar: "سبق تسجيل ذلك.", ckb: "ئەوە پێشتر تۆمار کراوە." },
  "The database refused the change.": {
    ar: "رفضت قاعدة البيانات التغيير.",
    ckb: "بنکەدراوەکە گۆڕانکارییەکەی ڕەتکردەوە.",
  },
  "Could not start a database session.": {
    ar: "تعذّر بدء جلسة مع قاعدة البيانات.",
    ckb: "نەتوانرا دانیشتنێک لەگەڵ بنکەدراوەکە دەست پێ بکرێت.",
  },
  "Check the form and try again.": {
    ar: "راجع النموذج وحاول مرة أخرى.",
    ckb: "فۆڕمەکە بپشکنە و دووبارە هەوڵ بدەوە.",
  },
  "The database did not answer, so this may have been saved. Check before trying again.": {
    ar: "لم تُجب قاعدة البيانات، فربما حُفظ هذا. تحقّق قبل المحاولة مرة أخرى.",
    ckb: "بنکەدراوەکە وەڵامی نەدایەوە، بۆیە لەوانەیە ئەمە پاشەکەوت کرابێت. پێش دووبارە هەوڵدانەوە بپشکنە.",
  },
  "This deployment has no database configured.": {
    ar: "لا توجد قاعدة بيانات مُعدّة لهذا النشر.",
    ckb: "هیچ بنکەدراوەیەک بۆ ئەم دامەزراندنە ڕێکنەخراوە.",
  },

  // Order states (orderStatusLabel).
  Open: { ar: "مفتوح", ckb: "کراوە" },
  Completed: { ar: "مكتمل", ckb: "تەواوبوو" },
  Voided: { ar: "ملغى", ckb: "هەڵوەشێنراوە" },
  Refunded: { ar: "مسترد", ckb: "پارەی گەڕێندراوەتەوە" },
  "Part-refunded": { ar: "مسترد جزئيًا", ckb: "بەشێکی گەڕێندراوەتەوە" },
};

export default phrases;
