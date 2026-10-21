import type { PhraseBook } from "./types";

/** Meal deals and prices by the time of day (0089): the database's words and the screens'. */
const phrases: PhraseBook = {
  "A deal on the bill has no key": {
    ar: "عرض في الفاتورة بلا مفتاح",
    ckb: "ئۆفەرێک لە پسوولەکەدا کلیلی نییە",
  },
  "A deal on the bill is mixed with another": {
    ar: "عرض في الفاتورة مختلط بعرض آخر",
    ckb: "ئۆفەرێک لە پسوولەکەدا تێکەڵی یەکێکی تر بووە",
  },
  "That deal is not on now": {
    ar: "هذا العرض غير متاح الآن",
    ckb: "ئەو ئۆفەرە ئێستا بەردەست نییە",
  },
  "That deal is not sold on this channel": {
    ar: "هذا العرض لا يُباع بهذه الطريقة",
    ckb: "ئەو ئۆفەرە بەم شێوەیە نافرۆشرێت",
  },
  "A deal is one of each of the things in it": {
    ar: "العرض واحد من كل شيء فيه",
    ckb: "ئۆفەر یەکێکە لە هەر شتێکی ناوی",
  },
  "Give the hours it runs, from and until": {
    ar: "حدّد الساعات التي يسري فيها، من وإلى",
    ckb: "ئەو کاتژمێرانەی کار دەکات بنووسە، لە و تا",
  },
  "Choose the days it runs": {
    ar: "اختر الأيام التي يسري فيها",
    ckb: "ئەو ڕۆژانەی کار دەکات هەڵبژێرە",
  },
  "A delivery platform sets its own prices": {
    ar: "منصة التوصيل تحدد أسعارها بنفسها",
    ckb: "پلاتفۆرمی گەیاندن نرخەکانی خۆی دادەنێت",
  },
  "That price is not running": { ar: "هذا السعر غير سارٍ", ckb: "ئەو نرخە کار ناکات" },
  "Give the hours it is shown, from and until, or neither": {
    ar: "حدّد ساعات ظهوره، من وإلى، أو لا شيء منهما",
    ckb: "کاتژمێرەکانی پیشاندانی بنووسە، لە و تا، یان هیچیان",
  },
  "Choose the days it is shown": { ar: "اختر أيام ظهوره", ckb: "ڕۆژەکانی پیشاندانی هەڵبژێرە" },
  "A deal sold is kept as it was sold": {
    ar: "العرض المباع يبقى كما بيع",
    ckb: "ئۆفەری فرۆشراو وەک خۆی دەمێنێتەوە",
  },
  "Name the deal": { ar: "سمِّ العرض", ckb: "ناوێک بۆ ئۆفەرەکە دابنێ" },
  "A deal's name is at most 60 letters": {
    ar: "اسم العرض 60 حرفًا على الأكثر",
    ckb: "ناوی ئۆفەر لە 60 پیت زیاتر نییە",
  },
  "There is already a deal called {1}": {
    ar: "يوجد عرض باسم {1} مسبقًا",
    ckb: "ئۆفەرێک بە ناوی {1} هەیە",
  },
  "Give the deal a price": { ar: "ضع سعرًا للعرض", ckb: "نرخێک بۆ ئۆفەرەکە دابنێ" },
  "A deal has at least two things in it": {
    ar: "العرض فيه شيئان على الأقل",
    ckb: "ئۆفەر لانیکەم دوو شتی تێدایە",
  },
  "A deal has at most eight things in it": {
    ar: "العرض فيه ثمانية أشياء على الأكثر",
    ckb: "ئۆفەر زۆرترین هەشت شتی تێدایە",
  },
  "Give the hours it is on, from and until, or neither": {
    ar: "حدّد ساعات سريانه، من وإلى، أو لا شيء منهما",
    ckb: "کاتژمێرەکانی بەردەستبوونی بنووسە، لە و تا، یان هیچیان",
  },
  "Choose the days it is on": { ar: "اختر أيام سريانه", ckb: "ڕۆژەکانی بەردەستبوونی هەڵبژێرە" },
  "Deal not found": { ar: "العرض غير موجود", ckb: "ئۆفەرەکە نەدۆزرایەوە" },
  "Unknown channel {1}": { ar: "طريقة بيع غير معروفة {1}", ckb: "شێوازی فرۆشتنی نەناسراو {1}" },
  "A delivery platform sets its own offers": {
    ar: "منصة التوصيل تحدد عروضها بنفسها",
    ckb: "پلاتفۆرمی گەیاندن ئۆفەرەکانی خۆی دادەنێت",
  },
  "Each thing in a deal is a product or a category with products on sale": {
    ar: "كل شيء في العرض منتج أو فئة فيها منتجات معروضة للبيع",
    ckb: "هەر شتێک لە ئۆفەردا بەرهەمێکە یان پۆلێکە کە بەرهەمی بۆ فرۆشتن تێدایە",
  },
  // The screens (0089).
  "At their own prices": { ar: "بأسعارها المعتادة", ckb: "بە نرخی خۆیان" },
  Deal: { ar: "العرض", ckb: "ئۆفەر" },
  "Each deal's things at their own prices, what was paid for them, and what the deal gave away": {
    ar: "أشياء كل عرض بأسعارها المعتادة، وما دُفع عنها، وما وهبه العرض",
    ckb: "شتەکانی هەر ئۆفەرێک بە نرخی خۆیان، ئەوەی بۆیان درا، و ئەوەی ئۆفەرەکە بەخشیی",
  },
  "Given away": { ar: "الموهوب", ckb: "بەخشراو" },
  "Meal deals sold": { ar: "العروض المباعة", ckb: "ئۆفەرە فرۆشراوەکان" },
  "A deal is two things or more at one price: at the till it is one tap, each thing sold as itself, what the deal gives away kept apart as its discount.":
    {
      ar: "العرض شيئان أو أكثر بسعر واحد: في الصندوق بلمسة واحدة، يُباع كل شيء كما هو، وما يهبه العرض يُحفظ جانبًا كخصم له.",
      ckb: "ئۆفەر دوو شت یان زیاترە بە یەک نرخ: لە سندوق بە یەک دەستلێدانە، هەر شتێک وەک خۆی دەفرۆشرێت، و ئەوەی ئۆفەرەکە دەیبەخشێت وەک داشکاندنی جیا دەهێڵرێتەوە.",
    },
  "A product": { ar: "منتج", ckb: "بەرهەمێک" },
  "Any of a category": { ar: "أي شيء من فئة", ckb: "هەر شتێک لە پۆلێک" },
  "Any {category}": { ar: "أي {category}", ckb: "هەر {category}ێک" },
  "Its price": { ar: "سعره", ckb: "نرخەکەی" },
  "Leave the hours empty for all day.": {
    ar: "اترك الساعات فارغة ليسري طوال اليوم.",
    ckb: "کاتژمێرەکان بەتاڵ بهێڵەوە بۆ هەموو ڕۆژ.",
  },
  "Meal deals": { ar: "عروض الوجبات", ckb: "ئۆفەرەکانی خواردن" },
  "New deal": { ar: "عرض جديد", ckb: "ئۆفەری نوێ" },
  "Not now": { ar: "ليس الآن", ckb: "ئێستا نا" },
  "Not sold this way": { ar: "لا يُباع بهذه الطريقة", ckb: "بەم شێوەیە نافرۆشرێت" },
  "On now": { ar: "سارٍ الآن", ckb: "ئێستا بەردەستە" },
  "On sale": { ar: "معروض للبيع", ckb: "بۆ فرۆشتن" },
  "One more thing": { ar: "شيء آخر", ckb: "شتێکی تر" },
  "Shown as (optional)": {
    ar: "يظهر باسم (اختياري)",
    ckb: "بەم ناوە پیشان دەدرێت (ئارەزوومەندانە)",
  },
  "Thing {n}": { ar: "الشيء {n}", ckb: "شتی {n}" },
  "What is in it": { ar: "ما فيه", ckb: "چی تێدایە" },
  Always: { ar: "دائمًا", ckb: "هەمیشە" },
  "Shown from": { ar: "يظهر من", ckb: "پیشان دەدرێت لە" },
  "Shown until": { ar: "يظهر حتى", ckb: "پیشان دەدرێت تا" },
  "A price at set hours, on set days — gelato after 21:00, breakfast from 08:00 to 11:00 — in place of the usual one while it runs. The till changes by itself at the hour; a bill keeps the price it was rung at.":
    {
      ar: "سعر في ساعات وأيام محددة — الجيلاتو بعد 21:00، والفطور من 08:00 إلى 11:00 — بدل السعر المعتاد ما دام ساريًا. يتغير الصندوق وحده عند الساعة، وتحتفظ الفاتورة بالسعر الذي سُجّلت به.",
      ckb: "نرخێک لە کاتژمێر و ڕۆژە دیاریکراوەکاندا — جێلاتۆ دوای 21:00، نانی بەیانی لە 08:00 تا 11:00 — لە جیاتی نرخی ئاسایی تا کار دەکات. سندوق خۆی لە کاتژمێرەکەدا دەگۆڕێت؛ پسوولە ئەو نرخە دەهێڵێتەوە کە پێی تۆمار کرا.",
    },
  "Dine-in and take-away": { ar: "داخل المقهى والسفري", ckb: "لە ناو کافێ و بردنەوە" },
  "New price by the hour": { ar: "سعر جديد بالساعة", ckb: "نرخی نوێ بەپێی کاتژمێر" },
  "Prices by the time of day": { ar: "الأسعار حسب وقت اليوم", ckb: "نرخ بەپێی کاتی ڕۆژ" },
  "usually {price}": { ar: "عادةً {price}", ckb: "بە ئاسایی {price}" },
  "Something in this deal is not on sale here now.": {
    ar: "شيء في هذا العرض غير معروض للبيع هنا الآن.",
    ckb: "شتێک لەم ئۆفەرەدا ئێستا لێرە بۆ فرۆشتن نییە.",
  },
  "A deal is sold at the counter: pay for it now, not on a bill.": {
    ar: "العرض يُباع عند الكاونتر: ادفعه الآن، لا على فاتورة.",
    ckb: "ئۆفەر لە کاونتەر دەفرۆشرێت: ئێستا پارەکەی بدە، نەک لەسەر پسوولە.",
  },
  Deals: { ar: "العروض", ckb: "ئۆفەرەکان" },
  "Choose the days": { ar: "اختر الأيام", ckb: "ڕۆژەکان هەڵبژێرە" },
  "Give the hours as 08:00": { ar: "اكتب الساعات هكذا 08:00", ckb: "کاتژمێرەکان وەک 08:00 بنووسە" },
  "a deal": { ar: "عرضًا", ckb: "ئۆفەرێک" },
  "a price": { ar: "سعرًا", ckb: "نرخێک" },
};

export default phrases;
