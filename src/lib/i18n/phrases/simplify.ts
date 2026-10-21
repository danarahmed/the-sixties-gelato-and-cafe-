import type { PhraseBook } from "./types";

/** The simplification round: Settings in groups, and what each has turned on. */
const phrases: PhraseBook = {
  "Each heading says what is turned on inside it. Open one to change it.": {
    ar: "كل عنوان يقول ما هو مفعّل بداخله. افتحه لتغييره.",
    ckb: "هەر سەردێڕێک دەڵێت چی لە ناویدا داگیرساوە. بیکەرەوە بۆ گۆڕینی.",
  },
  "Not set up yet": { ar: "لم يُعدّ بعد", ckb: "هێشتا ڕێکنەخراوە" },
  Selling: { ar: "البيع", ckb: "فرۆشتن" },
  "People and roles": { ar: "الأشخاص والأدوار", ckb: "کەسەکان و ڕۆڵەکان" },
  "Rules and warnings": { ar: "القواعد والتنبيهات", ckb: "یاساکان و ئاگادارکردنەوەکان" },
  Places: { ar: "الأماكن", ckb: "شوێنەکان" },
  "English, Arabic and Kurdish": {
    ar: "الإنجليزية والعربية والكردية",
    ckb: "ئینگلیزی، عەرەبی و کوردی",
  },
  "The café's details": { ar: "بيانات المقهى", ckb: "زانیارییەکانی کافێکە" },

  // The Dashboard, for anyone who helps set the café up but is not its owner.
  "Getting set up: {done} of {n} done": {
    ar: "التجهيز: {done} من {n} مكتملة",
    ckb: "ئامادەکردن: {done} لە {n} تەواو بووە",
  },

  // What each group has turned on.
  "No service charge": { ar: "بلا رسوم خدمة", ckb: "بێ کرێی خزمەتگوزاری" },
  "Service charge on {ways}": {
    ar: "رسوم الخدمة على {ways}",
    ckb: "کرێی خزمەتگوزاری لەسەر {ways}",
  },
  "Cash and card only": { ar: "النقد والبطاقة فقط", ckb: "تەنها پارەی نەقد و کارت" },
  "{n} way(s) to pay besides cash and card": {
    ar: "{n, plural, one {طريقة دفع واحدة} two {طريقتا دفع} few {# طرق دفع} many {# طريقة دفع} other {# طريقة دفع}} غير النقد والبطاقة",
    ckb: "{n} شێوازی پارەدان جگە لە نەقد و کارت",
  },
  "Your own receipt": { ar: "إيصالك الخاص", ckb: "پسوولەی خۆت" },
  "The app's own receipt": { ar: "إيصال التطبيق", ckb: "پسوولەی بەرنامەکە" },
  "Phone warnings on": { ar: "تنبيهات الهاتف مفعّلة", ckb: "ئاگادارکردنەوەی مۆبایل داگیرساوە" },
  "Phone warnings off": { ar: "تنبيهات الهاتف متوقفة", ckb: "ئاگادارکردنەوەی مۆبایل کوژاوەتەوە" },
  "People: {n}": { ar: "الأشخاص: {n}", ckb: "کەسەکان: {n}" },
  "{n} branch(es)": {
    ar: "{n, plural, one {فرع واحد} two {فرعان} few {# فروع} many {# فرعًا} other {# فرع}}",
    ckb: "{n} لق",
  },
  "{n} other place(s)": {
    ar: "{n, plural, one {مكان آخر واحد} two {مكانان آخران} few {# أماكن أخرى} many {# مكانًا آخر} other {# مكان آخر}}",
    ckb: "{n} شوێنی تر",
  },

  // What is not set up yet, and what each gives the café.
  "Your logo, your name and thanks in three languages, the Wi-Fi and a QR code on every receipt.": {
    ar: "شعارك واسمك وشكرك بثلاث لغات والواي فاي ورمز QR على كل إيصال.",
    ckb: "لۆگۆکەت، ناو و سوپاسەکەت بە سێ زمان، وای فای و کۆدی QR لەسەر هەموو پسوولەیەک.",
  },
  "The apps and banks you are paid through, each with its own account, so their money is counted apart.":
    {
      ar: "التطبيقات والبنوك التي تُدفع لك عبرها، لكل منها حسابه، فيُحسب مالها على حدة.",
      ckb: "ئەو ئەپ و بانکانەی پارەت پێدەدرێت، هەر یەکە بە حسابی خۆی، بۆ ئەوەی پارەکەیان جیا بژمێردرێت.",
    },
  "The Dashboard's warnings sent to your phone within minutes, wherever you are.": {
    ar: "تنبيهات لوحة المتابعة تصل إلى هاتفك خلال دقائق أينما كنت.",
    ckb: "ئاگادارکردنەوەکانی داشبۆرد لە چەند خولەکێکدا دەگەنە مۆبایلەکەت، لە هەر کوێیەک بیت.",
  },
  "A percentage added at the table or wherever you choose, kept apart from the sales.": {
    ar: "نسبة تُضاف على الطاولة أو حيث تختار، وتُحفظ بعيدًا عن المبيعات.",
    ckb: "ڕێژەیەک کە لەسەر مێز یان هەر شوێنێک هەڵیدەبژێریت زیاد دەکرێت، جیا لە فرۆشتن.",
  },
};

export default phrases;
