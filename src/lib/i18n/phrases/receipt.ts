import type { PhraseBook } from "./types";

/** The café's own receipt, and each person's reports first (0091): the database's words and the screens'. */
const phrases: PhraseBook = {
  // The database's.
  "A line of the receipt is at most {1} letters": {
    ar: "سطر الإيصال {1} حرفًا على الأكثر",
    ckb: "هەر دێڕێکی پسوولە لە {1} پیت زیاتر نابێت",
  },
  "A link starts with https:// and has no spaces": {
    ar: "يبدأ الرابط بـ https:// ولا مسافات فيه",
    ckb: "بەستەر بە https:// دەست پێدەکات و بۆشایی تێدا نییە",
  },
  "The QR code leads to the menu, to the reviews, or nowhere": {
    ar: "رمز QR يؤدي إلى قائمة الطعام أو إلى التقييمات أو لا شيء",
    ckb: "کۆدی QR دەچێتە سەر مینیو، یان هەڵسەنگاندنەکان، یان هیچ شوێنێک",
  },
  "Give the menu's link for the QR code to lead to": {
    ar: "أعطِ رابط قائمة الطعام ليؤدي إليه رمز QR",
    ckb: "بەستەری مینیوکە بنووسە تا کۆدی QR بچێتە سەری",
  },
  "Give the reviews' link for the QR code to lead to": {
    ar: "أعطِ رابط التقييمات ليؤدي إليه رمز QR",
    ckb: "بەستەری هەڵسەنگاندنەکان بنووسە تا کۆدی QR بچێتە سەری",
  },
  "The receipt's setup cannot be read": {
    ar: "لا يمكن قراءة إعداد الإيصال",
    ckb: "ڕێکخستنی پسوولەکە ناخوێندرێتەوە",
  },
  "The logo must be smaller than 60 KB": {
    ar: "يجب أن يكون الشعار أصغر من 60 كيلوبايت",
    ckb: "لۆگۆکە دەبێت لە 60 کیلۆبایت بچووکتر بێت",
  },
  "That is not one of the reports": {
    ar: "هذا ليس من التقارير",
    ckb: "ئەمە یەکێک لە ڕاپۆرتەکان نییە",
  },
  "Sign in again": { ar: "سجّل الدخول مرة أخرى", ckb: "دووبارە بچۆ ژوورەوە" },

  // The audit log.
  "The receipt set": { ar: "ضُبط الإيصال", ckb: "پسوولە ڕێکخرا" },
  "The receipt's logo set": { ar: "ضُبط شعار الإيصال", ckb: "لۆگۆی پسوولە دانرا" },

  // Settings.
  "The receipt": { ar: "الإيصال", ckb: "پسوولە" },
  "What the bill, the receipt and a refund's slip print besides the sale: your logo, your name and thanks in the three languages, your pages, the Wi-Fi, and a QR code to your menu or your reviews.":
    {
      ar: "ما تطبعه الفاتورة والإيصال وقسيمة الاسترجاع إلى جانب البيع: شعارك، واسمك وشكرك باللغات الثلاث، وصفحاتك، والواي فاي، ورمز QR إلى قائمة طعامك أو تقييماتك.",
      ckb: "ئەوەی پسوولەی پێش پارەدان، پسوولە و پسوولەی گەڕاندنەوە لە پاڵ فرۆشتنەکە چاپی دەکەن: لۆگۆکەت، ناو و سوپاسەکەت بە هەر سێ زمانەکە، پەڕەکانت، وای فای، و کۆدی QR بۆ مینیو یان هەڵسەنگاندنەکانت.",
    },
  "This needs the database update 0091, which has not been applied yet.": {
    ar: "يحتاج هذا إلى تحديث قاعدة البيانات 0091، ولم يُطبَّق بعد.",
    ckb: "ئەمە پێویستی بە نوێکردنەوەی 0091ی بنکەدراوە هەیە، کە هێشتا جێبەجێ نەکراوە.",
  },
  Logo: { ar: "الشعار", ckb: "لۆگۆ" },
  "Choose a logo": { ar: "اختر شعارًا", ckb: "لۆگۆیەک هەڵبژێرە" },
  "Choose another logo": { ar: "اختر شعارًا آخر", ckb: "لۆگۆیەکی تر هەڵبژێرە" },
  "Take the logo off": { ar: "إزالة الشعار", ckb: "لابردنی لۆگۆ" },
  "The café's emblem prints until a logo is given.": {
    ar: "يُطبع رمز المقهى إلى أن يُعطى شعار.",
    ckb: "تا لۆگۆیەک دانەنرێت، نیشانەی کافێکە چاپ دەکرێت.",
  },
  "It prints in black and white. A dark logo on a light background prints best.": {
    ar: "يُطبع بالأبيض والأسود. أفضل ما يُطبع شعار داكن على خلفية فاتحة.",
    ckb: "ڕەش و سپی چاپ دەکرێت. لۆگۆی تاریک لەسەر باکگراوەندی ڕووناک باشترین چاپ دەبێت.",
  },
  "The café's name": { ar: "اسم المقهى", ckb: "ناوی کافێکە" },
  "In English": { ar: "بالإنجليزية", ckb: "بە ئینگلیزی" },
  "In Arabic": { ar: "بالعربية", ckb: "بە عەرەبی" },
  "In Kurdish": { ar: "بالكردية", ckb: "بە کوردی" },
  "Thank-you line": { ar: "سطر الشكر", ckb: "دێڕی سوپاس" },
  "Your pages": { ar: "صفحاتك", ckb: "پەڕەکانت" },
  "Wi-Fi": { ar: "الواي فاي", ckb: "وای فای" },
  "The Wi-Fi's name": { ar: "اسم الواي فاي", ckb: "ناوی وای فای" },
  "Its password": { ar: "كلمة مروره", ckb: "وشەی نهێنییەکەی" },
  Password: { ar: "كلمة المرور", ckb: "وشەی نهێنی" },
  "QR code": { ar: "رمز QR", ckb: "کۆدی QR" },
  "No QR code": { ar: "بلا رمز QR", ckb: "بێ کۆدی QR" },
  "Our menu": { ar: "قائمة طعامنا", ckb: "مینیوی ئێمە" },
  "Tell us how we did": { ar: "أخبرنا برأيك فينا", ckb: "پێمان بڵێ چۆن بووین" },
  // A web address is written the same in every language.
  "https://…": { ar: "https://…", ckb: "https://…" },
  "The link to your menu": { ar: "رابط قائمة طعامك", ckb: "بەستەری مینیوکەت" },
  "The link to your reviews page": {
    ar: "رابط صفحة تقييماتك",
    ckb: "بەستەری پەڕەی هەڵسەنگاندنەکانت",
  },
  "A customer scans it with a phone's camera. The menu can be a page or a PDF you share; for reviews, the link Google Maps gives to write one.":
    {
      ar: "يمسحه الزبون بكاميرا الهاتف. يمكن أن تكون قائمة الطعام صفحة أو ملف PDF تشاركه؛ وللتقييمات، الرابط الذي يعطيه Google Maps لكتابة تقييم.",
      ckb: "کڕیار بە کامێرای مۆبایل دەیخوێنێتەوە. مینیوکە دەتوانێت پەڕەیەک بێت یان PDFێک کە بڵاوی دەکەیتەوە؛ بۆ هەڵسەنگاندن، ئەو بەستەرەی Google Maps بۆ نووسینی هەڵسەنگاندن دەیدات.",
    },
  "A line at the foot": { ar: "سطر في الأسفل", ckb: "دێڕێک لە خوارەوە" },
  "An address, a phone number, opening hours…": {
    ar: "عنوان، رقم هاتف، ساعات العمل…",
    ckb: "ناونیشان، ژمارەی تەلەفۆن، کاتەکانی کارکردن…",
  },
  "Save the receipt": { ar: "حفظ الإيصال", ckb: "پاشەکەوتکردنی پسوولە" },
  "Saved: every receipt prints it from now on.": {
    ar: "تم الحفظ: كل إيصال يطبعه من الآن.",
    ckb: "پاشەکەوت کرا: لە ئێستاوە هەموو پسوولەیەک چاپی دەکات.",
  },
  "As it prints": { ar: "كما يُطبع", ckb: "وەک چاپ دەکرێت" },

  // Reports.
  "The ones you open most, first:": {
    ar: "ما تفتحه أكثر، أولًا:",
    ckb: "ئەوانەی زیاتر دەیانکەیتەوە، یەکەم:",
  },
};

export default phrases;
