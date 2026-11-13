import type { PhraseBook } from "./types";

/** Running many businesses (0109): support, paying, the console and the export. */
const phrases: PhraseBook = {
  "Only the owner exports the business's data": {
    ar: "المالك وحده يصدّر بيانات العمل",
    ckb: "تەنها خاوەنەکە داتاکانی کارەکە دەردەهێنێت",
  },
  "Only the owner gives the system's support access": {
    ar: "المالك وحده يعطي دعم النظام صلاحية الدخول",
    ckb: "تەنها خاوەنەکە ڕێگە بە پاڵپشتی سیستەمەکە دەدات",
  },
  "Support access is for 1 to 72 hours": {
    ar: "صلاحية الدعم من ساعة إلى 72 ساعة",
    ckb: "ڕێگەی پاڵپشتی لە ١ تا ٧٢ کاتژمێرە",
  },
  "Support has no access now": { ar: "لا صلاحية للدعم الآن", ckb: "پاڵپشتی ئێستا ڕێگەی نییە" },
  "That business has not given support access, or it has run out": {
    ar: "هذا العمل لم يعطِ الدعم صلاحية، أو انتهت",
    ckb: "ئەو کارە ڕێگەی بە پاڵپشتی نەداوە، یان بەسەرچووە",
  },
  "The payment is overdue: the system only shows what is kept until it is paid": {
    ar: "الدفع متأخر: النظام يعرض المحفوظ فقط حتى يُدفع",
    ckb: "پارەدان دواکەوتووە: سیستەمەکە تەنها ئەوەی هەڵگیراوە پیشان دەدات تا پارەکە دەدرێت",
  },
  "This business is closed. Its owner can still download its data": {
    ar: "هذا العمل مغلق. ما زال مالكه يستطيع تنزيل بياناته",
    ckb: "ئەم کارە داخراوە. خاوەنەکەی هێشتا دەتوانێت داتاکانی دابگرێت",
  },
  "Every business on the system: how it is doing, its plan and its paying. A plan changed here takes effect at once: its parts appear or are hidden, and nothing is lost. Support looks only while a business's owner allows it.":
    {
      ar: "كل عمل على النظام: كيف يسير، خطته ودفعه. الخطة التي تُغيَّر هنا تسري فورًا: تظهر أجزاؤها أو تُخفى، ولا يضيع شيء. الدعم يطّلع فقط ما دام مالك العمل يسمح.",
      ckb: "هەموو کارێک لەسەر سیستەمەکە: چۆن دەڕوات، پلانەکەی و پارەدانەکەی. پلانێک کە لێرە بگۆڕدرێت دەستبەجێ کار دەکات: بەشەکانی دەردەکەون یان دەشاردرێنەوە، و هیچ لەدەست ناچێت. پاڵپشتی تەنها کاتێک سەیر دەکات کە خاوەنی کارەکە ڕێگە بدات.",
    },
  "Problems sent to support": {
    ar: "المشاكل المرسلة إلى الدعم",
    ckb: "ئەو کێشانەی بۆ پاڵپشتی نێردران",
  },
  "Support and your data": { ar: "الدعم وبياناتك", ckb: "پاڵپشتی و داتاکانت" },
  "Support has no access": { ar: "لا صلاحية للدعم", ckb: "پاڵپشتی ڕێگەی نییە" },
  "Support may look now": {
    ar: "يمكن للدعم الاطلاع الآن",
    ckb: "پاڵپشتی ئێستا دەتوانێت سەیر بکات",
  },
  "Download all of the business's data": {
    ar: "نزّل كل بيانات العمل",
    ckb: "هەموو داتاکانی کارەکە دابگرە",
  },
  Leave: { ar: "اخرج", ckb: "دەرچوون" },
  SUPPORT: { ar: "الدعم", ckb: "پاڵپشتی" },
  "The payment is due: {n} days left before the system only shows what is kept.": {
    ar: "حان موعد الدفع: بقيت {n} أيام قبل أن يعرض النظام المحفوظ فقط.",
    ckb: "کاتی پارەدانە: {n} ڕۆژ ماوە پێش ئەوەی سیستەمەکە تەنها ئەوەی هەڵگیراوە پیشان بدات.",
  },
  "The payment is overdue: the system only shows what is kept until it is paid.": {
    ar: "الدفع متأخر: النظام يعرض المحفوظ فقط حتى يُدفع.",
    ckb: "پارەدان دواکەوتووە: سیستەمەکە تەنها ئەوەی هەڵگیراوە پیشان دەدات تا پارەکە دەدرێت.",
  },
  "This business is closed. Its owner can still download its data.": {
    ar: "هذا العمل مغلق. ما زال مالكه يستطيع تنزيل بياناته.",
    ckb: "ئەم کارە داخراوە. خاوەنەکەی هێشتا دەتوانێت داتاکانی دابگرێت.",
  },
  "You are looking at {business} as its support: nothing can be changed.": {
    ar: "أنت تطّلع على {business} بصفتك دعمه: لا يمكن تغيير شيء.",
    ckb: "تۆ وەک پاڵپشتی سەیری {business} دەکەیت: هیچ ناگۆڕدرێت.",
  },
  "Send it to the system's support too": {
    ar: "أرسلها إلى دعم النظام أيضًا",
    ckb: "بۆ پاڵپشتی سیستەمەکەش بینێرە",
  },
  Errors: { ar: "الأخطاء", ckb: "هەڵەکان" },
  "Last sale": { ar: "آخر بيع", ckb: "دوایین فرۆشتن" },
  "Look, read-only": { ar: "اطّلع، للقراءة فقط", ckb: "سەیر بکە، تەنها خوێندنەوە" },
  "Open it again": { ar: "افتحه مجددًا", ckb: "دووبارە بیکەرەوە" },
  "Paid until": { ar: "مدفوع حتى", ckb: "پارەدراوە تا" },
  Paying: { ar: "الدفع", ckb: "پارەدان" },
  "Pilot group": { ar: "مجموعة التجربة", ckb: "گرووپی تاقیکردنەوە" },
  Problems: { ar: "المشاكل", ckb: "کێشەکان" },
  "Sales today": { ar: "مبيعات اليوم", ckb: "فرۆشتنی ئەمڕۆ" },
  Support: { ar: "الدعم", ckb: "پاڵپشتی" },
  "Allow support": { ar: "اسمح للدعم", ckb: "ڕێگە بە پاڵپشتی بدە" },
  "For how many hours": { ar: "لكم ساعة", ckb: "بۆ چەند کاتژمێر" },
  "Support looked at:": { ar: "اطّلع الدعم في:", ckb: "پاڵپشتی سەیری کرد لە:" },
  "Support may look until {at}": {
    ar: "يمكن للدعم الاطلاع حتى {at}",
    ckb: "پاڵپشتی دەتوانێت تا {at} سەیر بکات",
  },
  "Take it back": { ar: "اسحبها", ckb: "بیگەڕێنەوە" },
  "The system's support sees this business only while you allow it, and changes nothing. Each visit is listed here and on the audit trail.":
    {
      ar: "دعم النظام يرى هذا العمل فقط ما دمت تسمح، ولا يغيّر شيئًا. كل زيارة مسجّلة هنا وفي سجل التدقيق.",
      ckb: "پاڵپشتی سیستەمەکە تەنها کاتێک ئەم کارە دەبینێت کە تۆ ڕێگە بدەیت، و هیچ ناگۆڕێت. هەر سەردانێک لێرە و لە تۆماری چاودێریدا نووسراوە.",
    },
  "Paid until must be a date": {
    ar: "«مدفوع حتى» يجب أن يكون تاريخًا",
    ckb: "«پارەدراوە تا» دەبێت بەروار بێت",
  },
  "Paid until changed": { ar: "تغيّر «مدفوع حتى»", ckb: "«پارەدراوە تا» گۆڕدرا" },
  "Pilot group changed": { ar: "تغيّرت مجموعة التجربة", ckb: "گرووپی تاقیکردنەوە گۆڕدرا" },
  "Business closed": { ar: "أُغلق العمل", ckb: "کارەکە داخرا" },
  "Business opened again": { ar: "فُتح العمل مجددًا", ckb: "کارەکە دووبارە کرایەوە" },
  "Support allowed": { ar: "سُمح للدعم", ckb: "ڕێگە بە پاڵپشتی درا" },
  "Support taken back": { ar: "سُحبت صلاحية الدعم", ckb: "ڕێگەی پاڵپشتی گەڕێنرایەوە" },
  "Support looked": { ar: "اطّلع الدعم", ckb: "پاڵپشتی سەیری کرد" },
  "Payment due": { ar: "الدفع مستحق", ckb: "کاتی پارەدانە" },
  "Read-only": { ar: "للقراءة فقط", ckb: "تەنها خوێندنەوە" },
  "Close it": { ar: "أغلقه", ckb: "دایبخە" },
  Open: { ar: "مفتوح", ckb: "کراوە" },
};

export default phrases;
