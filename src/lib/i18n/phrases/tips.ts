import type { PhraseBook } from "./types";

/** Tips and the service charge (0090): the database's words and the screens'. */
const phrases: PhraseBook = {
  // The database's.
  "A tip is a whole amount of 0 or more": {
    ar: "الإكرامية مبلغ صحيح، صفر أو أكثر",
    ckb: "تیپ بڕێکی تەواوە، سفر یان زیاتر",
  },
  "A delivery platform's order takes no tip at the till": {
    ar: "طلب منصة التوصيل لا تُضاف إليه إكرامية عند نقطة البيع",
    ckb: "داواکاری پلاتفۆرمی گەیاندن لە کاشێر تیپی بۆ زیاد ناکرێت",
  },
  "You do not have permission to take the service charge off": {
    ar: "ليست لديك صلاحية إزالة رسوم الخدمة",
    ckb: "دەسەڵاتی لابردنی کرێی خزمەتگوزاریت نییە",
  },
  "Choose the way of selling": { ar: "اختر طريقة البيع", ckb: "شێوازی فرۆشتن هەڵبژێرە" },
  "A delivery platform sets what its customers pay: no service charge is added to it": {
    ar: "منصة التوصيل تحدد ما يدفعه زبائنها: لا تُضاف إليها رسوم خدمة",
    ckb: "پلاتفۆرمی گەیاندن خۆی دیاری دەکات کڕیارەکانی چەند دەدەن: کرێی خزمەتگوزاری بۆی زیاد ناکرێت",
  },
  "A service charge is between 0 and 50%": {
    ar: "رسوم الخدمة بين 0 و50%",
    ckb: "کرێی خزمەتگوزاری لە نێوان 0 و 50%دایە",
  },
  "That person is not on Staff": {
    ar: "هذا الشخص ليس بين الموظفين",
    ckb: "ئەو کەسە لە لیستی کارمەنداندا نییە",
  },
  "Someone who has left does not share the tips": {
    ar: "من ترك العمل لا يتقاسم الإكراميات",
    ckb: "ئەوەی کارەکەی جێهێشتووە لە تیپ بەشی نییە",
  },

  // The accounts.
  "Tips owed to staff": { ar: "إكراميات مستحقة للموظفين", ckb: "تیپی قەرزاری کارمەندان" },
  "Service charge": { ar: "رسوم الخدمة", ckb: "کرێی خزمەتگوزاری" },

  // The till, the bill and the receipt.
  "Service charge {percent}%": { ar: "رسوم الخدمة {percent}%", ckb: "کرێی خزمەتگوزاری {percent}%" },
  "taken off": { ar: "أُزيلت", ckb: "لابرا" },
  "Add it back": { ar: "أعدها", ckb: "بیگەڕێنەوە" },
  Tip: { ar: "إكرامية", ckb: "تیپ" },
  Tips: { ar: "الإكراميات", ckb: "تیپەکان" },
  "Keep the change as a tip": { ar: "أبقِ الباقي إكرامية", ckb: "باقییەکە وەک تیپ بهێڵەوە" },

  // Settings.
  "A percentage added to what the products come to, on each way of selling you choose — or on none. The till adds it when a sale or a table's bill is paid, and the receipt shows it. It is the café's own money, kept apart from the sales.":
    {
      ar: "نسبة تُضاف إلى ما تبلغه المنتجات، على كل طريقة بيع تختارها — أو على لا شيء. تضيفها نقطة البيع عند دفع البيع أو فاتورة الطاولة، ويُظهرها الإيصال. وهي مال المقهى نفسه، تُحفظ منفصلة عن المبيعات.",
      ckb: "ڕێژەیەک کە دەخرێتە سەر نرخی بەرهەمەکان، لەسەر هەر شێوازێکی فرۆشتن کە هەڵیدەبژێریت — یان لەسەر هیچیان. کاشێر کاتی پارەدانی فرۆشتنێک یان حیسابی مێزێک زیادی دەکات، و پسوولەکە نیشانی دەدات. پارەی خودی کافێیە و جیا لە فرۆشتنەکان هەڵدەگیرێت.",
    },
  "This needs the database update 0090, which has not been applied yet.": {
    ar: "يحتاج هذا إلى تحديث قاعدة البيانات 0090، ولم يُطبَّق بعد.",
    ckb: "ئەمە پێویستی بە نوێکردنەوەی 0090ی بنکەی زانیارییە، کە هێشتا جێبەجێ نەکراوە.",
  },
  "Service charge on {way} (%)": {
    ar: "رسوم الخدمة على {way} (%)",
    ckb: "کرێی خزمەتگوزاری لەسەر {way} (%)",
  },
  "Turn off": { ar: "إيقاف", ckb: "کوژاندنەوە" },

  // Payroll.
  "Each day's tips are shared at the end of that day, equally, between the people ticked here who clocked in that day (all of them, when nobody did). Each one's share is added to their pay for the month.":
    {
      ar: "تُقسَم إكراميات كل يوم في نهاية ذلك اليوم بالتساوي بين المؤشَّر عليهم هنا ممن سجّلوا حضورهم ذلك اليوم (وبينهم جميعًا إن لم يسجّل أحد). وتُضاف حصة كل واحد إلى راتبه عن الشهر.",
      ckb: "تیپی هەر ڕۆژێک لە کۆتایی ئەو ڕۆژەدا بە یەکسانی دابەش دەکرێت لە نێوان ئەوانەی لێرە نیشانەیان لێدراوە و ئەو ڕۆژە هاتنیان تۆمار کردووە (یان لە نێوان هەموویان، ئەگەر کەس تۆماری نەکردبێت). بەشی هەر کەسێک دەخرێتە سەر مووچەی مانگەکەی.",
    },
  "Saved: from today, the tips are shared between them.": {
    ar: "حُفظ: من اليوم تُقسَم الإكراميات بينهم.",
    ckb: "پاشەکەوت کرا: لە ئەمڕۆوە تیپەکان لە نێوانیاندا دابەش دەکرێن.",
  },
  "Who shares the tips": { ar: "من يتقاسم الإكراميات", ckb: "کێ لە تیپەکان بەشی هەیە" },
  "Add the people who work here on Staff first.": {
    ar: "أضف أولًا من يعملون هنا في صفحة الموظفين.",
    ckb: "سەرەتا ئەو کەسانەی لێرە کار دەکەن لە پەڕەی کارمەندان زیاد بکە.",
  },
  "Save who shares the tips": {
    ar: "احفظ من يتقاسم الإكراميات",
    ckb: "ئەوانەی لە تیپ بەشیان هەیە پاشەکەوت بکە",
  },
  "Tips this month": { ar: "إكراميات هذا الشهر", ckb: "تیپی ئەم مانگە" },
  "{amount} had nobody ticked to share it": {
    ar: "{amount} لم يكن هناك من يتقاسمه",
    ckb: "{amount} کەسی نیشانەکراوی نەبوو بۆ دابەشکردنی",
  },
  "Their tips this month": { ar: "إكرامياته هذا الشهر", ckb: "تیپی ئەم مانگەی" },
  "Each day's tips, and how they were shared": {
    ar: "إكراميات كل يوم، وكيف قُسِمت",
    ckb: "تیپی هەر ڕۆژێک، و چۆن دابەش کرا",
  },
  "so far today": { ar: "حتى الآن اليوم", ckb: "تا ئێستای ئەمڕۆ" },
  "nobody to share it": { ar: "لا أحد ليتقاسمها", ckb: "کەس نییە دابەشی بکات" },

  // Reports and the end of the day.
  "Service charge and tips": { ar: "رسوم الخدمة والإكراميات", ckb: "کرێی خزمەتگوزاری و تیپ" },
  "Taken with the sales, on top of them: the service charge is the café's own, the tips the staff's.":
    {
      ar: "تُؤخذ مع المبيعات وفوقها: رسوم الخدمة للمقهى، والإكراميات للموظفين.",
      ckb: "لەگەڵ فرۆشتنەکان و لە سەرووی ئەوانەوە وەردەگیرێن: کرێی خزمەتگوزاری هی کافێیە، تیپەکان هی کارمەندان.",
    },
  "{n} sale(s)": {
    ar: "{n, plural, one {عملية بيع واحدة} two {عمليتا بيع} few {# عمليات بيع} other {# عملية بيع}}",
    ckb: "{n} فرۆشتن",
  },
  "Tips, for the staff": { ar: "الإكراميات، للموظفين", ckb: "تیپ، بۆ کارمەندان" },

  // The audit log.
  "Service charge taken off a sale": {
    ar: "أُزيلت رسوم الخدمة عن عملية بيع",
    ckb: "کرێی خزمەتگوزاری لە فرۆشتنێک لابرا",
  },
  "Service charge set": { ar: "ضُبطت رسوم الخدمة", ckb: "کرێی خزمەتگوزاری دانرا" },
  "Who shares the tips set": {
    ar: "حُدِّد من يتقاسم الإكراميات",
    ckb: "دیاری کرا کێ لە تیپەکان بەشی هەیە",
  },
};

export default phrases;
