import type { PhraseBook } from "./types";

/** Sale days (0106): "N% off, from this day to that day". */
const phrases: PhraseBook = {
  "Give the sale day a name": {
    ar: "أعطِ يوم التخفيضات اسمًا",
    ckb: "ناوێک بدە بە ڕۆژی داشکاندنەکە",
  },
  "A sale day takes from {1}% to {2}% off": {
    ar: "يوم التخفيضات يخصم من {1}% إلى {2}%",
    ckb: "ڕۆژی داشکاندن لە {1}% تا {2}% دادەشکێنێت",
  },
  "A sale day takes from 1% to 90% off": {
    ar: "يوم التخفيضات يخصم من 1% إلى 90%",
    ckb: "ڕۆژی داشکاندن لە ١% تا ٩٠% دادەشکێنێت",
  },
  "A sale day runs two months at most": {
    ar: "يوم التخفيضات يستمر شهرين على الأكثر",
    ckb: "ڕۆژی داشکاندن زۆرترین دوو مانگ دەخایەنێت",
  },
  "Choose the hours, from and to, on the same day": {
    ar: "اختر الساعات، من وإلى، في اليوم نفسه",
    ckb: "کاتژمێرەکان هەڵبژێرە، لە و تا، لە هەمان ڕۆژدا",
  },
  "That sale day is not one of the café's": {
    ar: "يوم التخفيضات هذا ليس من أيام المقهى",
    ckb: "ئەو ڕۆژی داشکاندنە هی کافێکە نییە",
  },
  "A sale day that has begun is not changed: stop it, and start another": {
    ar: "يوم التخفيضات الذي بدأ لا يُغيَّر: أوقفه وابدأ غيره",
    ckb: "ڕۆژی داشکاندنێک کە دەستی پێکردووە ناگۆڕدرێت: بیوەستێنە و یەکێکی تر دەست پێبکە",
  },
  "A sale day begins today or later": {
    ar: "يوم التخفيضات يبدأ اليوم أو بعده",
    ckb: "ڕۆژی داشکاندن ئەمڕۆ یان دواتر دەست پێدەکات",
  },
  "Another sale day is on then: {1}": {
    ar: "هناك يوم تخفيضات آخر في ذلك الوقت: {1}",
    ckb: "ڕۆژێکی داشکاندنی تر لەو کاتەدایە: {1}",
  },
  "That sale day is over already": {
    ar: "يوم التخفيضات هذا انتهى بالفعل",
    ckb: "ئەو ڕۆژی داشکاندنە پێشتر تەواو بووە",
  },
  "a sale day": { ar: "يوم تخفيضات", ckb: "ڕۆژێکی داشکاندن" },
  Nothing: { ar: "لا شيء", ckb: "هیچ" },
  "Choose a sale day": { ar: "اختر يوم تخفيضات", ckb: "ڕۆژێکی داشکاندن هەڵبژێرە" },
  "Sale days": { ar: "أيام التخفيضات", ckb: "ڕۆژەکانی داشکاندن" },
  "None on now": { ar: "لا شيء الآن", ckb: "ئێستا هیچ نییە" },
  "To come": { ar: "قادم", ckb: "دێت" },
  "On, outside its hours": { ar: "جارٍ، خارج ساعاته", ckb: "کارایە، لە دەرەوەی کاتژمێرەکانی" },
  Ended: { ar: "انتهى", ckb: "تەواو بوو" },
  "A percentage off, from one day to another, at every till. It is never added to another discount: the bigger one wins. It ends by itself.":
    {
      ar: "نسبة خصم، من يوم إلى آخر، على كل صندوق. لا تُضاف أبدًا إلى خصم آخر: الأكبر هو الذي يُطبَّق. وتنتهي وحدها.",
      ckb: "ڕێژەیەک داشکاندن، لە ڕۆژێکەوە بۆ ڕۆژێکی تر، لە هەموو سندوقەکان. هەرگیز لەسەر داشکاندنێکی تر زیاد ناکرێت: گەورەترەکە دەباتەوە. خۆی تەواو دەبێت.",
    },
  "Left out": { ar: "مستثنى", ckb: "دەرهێنراو" },
  Result: { ar: "النتيجة", ckb: "ئەنجام" },
  "Change the sale day": { ar: "غيّر يوم التخفيضات", ckb: "ڕۆژی داشکاندنەکە بگۆڕە" },
  "A new sale day": { ar: "يوم تخفيضات جديد", ckb: "ڕۆژێکی نوێی داشکاندن" },
  "Off (%)": { ar: "الخصم (%)", ckb: "داشکاندن (%)" },
  "Only some hours of each day": {
    ar: "بعض ساعات كل يوم فقط",
    ckb: "تەنها هەندێک کاتژمێری هەر ڕۆژێک",
  },
  "Leave these categories out": { ar: "استثنِ هذه الفئات", ckb: "ئەم پۆلانە دەربهێنە" },
  "Start the sale day": { ar: "ابدأ يوم التخفيضات", ckb: "ڕۆژی داشکاندنەکە دەست پێبکە" },
  "Sale day stopped": { ar: "أُوقف يوم التخفيضات", ckb: "ڕۆژی داشکاندن وەستێنرا" },
  "Sale day saved": { ar: "حُفظ يوم التخفيضات", ckb: "ڕۆژی داشکاندن پاشەکەوت کرا" },
  "At full price": { ar: "بالسعر الكامل", ckb: "بە نرخی تەواو" },
  "Of it, the sale day's": { ar: "منه، خصم يوم التخفيضات", ckb: "لەوە، هی ڕۆژی داشکاندن" },
  "What it cost": { ar: "ما كلّفه", ckb: "تێچووەکەی" },
  "Each sale day's result: what was sold while it was on, against the same days and hours of the weeks just before it. The discount it gave, and the profit gained or lost.":
    {
      ar: "نتيجة كل يوم تخفيضات: ما بيع أثناءه، مقارنة بالأيام والساعات نفسها من الأسابيع التي سبقته مباشرة. الخصم الذي أعطاه، والربح المكتسب أو المفقود.",
      ckb: "ئەنجامی هەر ڕۆژێکی داشکاندن: ئەوەی لە کاتیدا فرۆشرا، بەراورد بە هەمان ڕۆژ و کاتژمێرەکانی ئەو هەفتانەی ڕاستەوخۆ پێشی بوون. ئەو داشکاندنەی دای، و ئەو قازانجەی بەدەست هات یان لەدەست چوو.",
    },
  "No sale day has begun yet": {
    ar: "لم يبدأ أي يوم تخفيضات بعد",
    ckb: "هێشتا هیچ ڕۆژێکی داشکاندن دەستی پێنەکردووە",
  },
  "Profit {n} more than the weeks before": {
    ar: "الربح أكثر بـ {n} من الأسابيع السابقة",
    ckb: "قازانج {n} زیاترە لە هەفتەکانی پێشوو",
  },
  "Profit {n} less than the weeks before": {
    ar: "الربح أقل بـ {n} من الأسابيع السابقة",
    ckb: "قازانج {n} کەمترە لە هەفتەکانی پێشوو",
  },
  "Sales {n}": { ar: "المبيعات {n}", ckb: "فرۆشتن {n}" },
  "Bills {n}": { ar: "الفواتير {n}", ckb: "پسوولەکان {n}" },
  "While it was on": { ar: "أثناءه", ckb: "لە کاتیدا" },
  "The week before": { ar: "الأسبوع السابق", ckb: "هەفتەی پێشوو" },
  "{n} weeks before": { ar: "قبل {n} أسابيع", ckb: "{n} هەفتە پێشتر" },
  "Sale days: what each one sold and earned, against the weeks before →": {
    ar: "أيام التخفيضات: ما باعه كل منها وما ربحه، مقارنة بالأسابيع السابقة ←",
    ckb: "ڕۆژەکانی داشکاندن: هەر یەکەیان چی فرۆشت و چی قازانج کرد، بەراورد بە هەفتەکانی پێشوو ←",
  },
  "The sale day's discount is given by itself": {
    ar: "خصم يوم التخفيضات يُعطى وحده",
    ckb: "داشکاندنی ڕۆژی داشکاندن خۆی دەدرێت",
  },
  "{name}: {n}% off": { ar: "{name}: خصم {n}%", ckb: "{name}: {n}% داشکاندن" },
  "No reward is taken on a sale day: the sale day's discount is the bill's": {
    ar: "لا تُؤخذ مكافأة في يوم التخفيضات: خصم يوم التخفيضات هو خصم الفاتورة",
    ckb: "لە ڕۆژی داشکاندندا خەڵات وەرناگیرێت: داشکاندنی ڕۆژی داشکاندن هی پسوولەکەیە",
  },
};

export default phrases;
