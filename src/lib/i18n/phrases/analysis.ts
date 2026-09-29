import type { PhraseBook } from "./types";

/**
 * The sales analysis, the stock's value on a day, and what was bought (0051,
 * release Y): Reports → Sales analysis, Reports → Stock value on a day, and
 * the Purchasing section's suppliers and items.
 */
const phrases: PhraseBook = {
  // Reports: the pages
  "Sales analysis: by hour, day, product, person, payment… →": {
    ar: "تحليل المبيعات: حسب الساعة واليوم والمنتج والشخص والدفع… ←",
    ckb: "شیکاری فرۆشتن: بەپێی کاتژمێر، ڕۆژ، بەرهەم، کەس، پارەدان… ←",
  },
  "Stock value on a day →": { ar: "قيمة المخزون في يوم ←", ckb: "بەهای کۆگا لە ڕۆژێکدا ←" },
  "← Reports": { ar: "→ التقارير", ckb: "→ ڕاپۆرتەکان" },
  CSV: { ar: "CSV", ckb: "CSV" },

  // Reports → Purchasing: what came in
  "What came in, by supplier": {
    ar: "ما دخل، حسب المورّد",
    ckb: "ئەوەی هاتە ژوورەوە، بەپێی دابینکەر",
  },
  "What came in, by item": { ar: "ما دخل، حسب الصنف", ckb: "ئەوەی هاتە ژوورەوە، بەپێی کاڵا" },
  Deliveries: { ar: "التوريدات", ckb: "گەیاندنەکان" },
  "Sent back": { ar: "ما أُرجع للمورّد", ckb: "نێردراوەتەوە" },
  "Credited for price": { ar: "إشعار دائن للسعر", ckb: "پسووڵەی گەڕاندنەوە بۆ نرخ" },
  "Cost of one": { ar: "كلفة الواحدة", ckb: "تێچووی یەک دانە" },
  "The deliveries received in the dates, as their corrections left them, their landed costs shared in; what went back to the suppliers in the dates, at what they owe back; the credits suppliers gave for price; and the bills dated in the dates.":
    {
      ar: "التوريدات المستلمة في هذه التواريخ كما تركتها تصحيحاتها، موزّعةً عليها تكاليف الشحن؛ وما أُرجع للموردين في التواريخ بما يدينون به للمقهى؛ والإشعارات الدائنة التي أعطاها الموردون للسعر؛ والفواتير المؤرخة في التواريخ.",
      ckb: "ئەو گەیاندنانەی لەم بەروارانەدا وەرگیران، وەک ڕاستکردنەوەکانیان هێشتیانەوە، تێچووی گەیاندنیان بەسەردا دابەشکراوە؛ ئەوەی لەم بەروارانەدا بۆ دابینکەران نێردرایەوە، بەو بڕەی قەرزاری کافێکەن؛ ئەو پسووڵانەی گەڕاندنەوە کە دابینکەران بۆ نرخ دایان؛ و ئەو پسووڵانەی بەرواریان لەم بەروارانەدایە.",
    },

  // Reports → Sales analysis
  "Sales analysis": { ar: "تحليل المبيعات", ckb: "شیکاری فرۆشتن" },
  "The sales of the dates, seen one way and, if you like, a second. Each sale counts as it was paid; what its refunds gave back since is taken off it, whenever they were made. Voided sales are left out.":
    {
      ar: "مبيعات التواريخ، معروضةً بطريقة واحدة، وبثانية إن شئت. يُحسب كل بيع كما دُفع؛ وما أعادته مستردّاته منذ ذلك يُطرح منه، متى ما جرت. المبيعات الملغاة لا تدخل.",
      ckb: "فرۆشتنی بەروارەکان، بە یەک ڕێگا دەبینرێن و، ئەگەر بتەوێت، بە ڕێگایەکی دووەم. هەر فرۆشتنێک وەک پارەی درا دەژمێردرێت؛ ئەوەی گەڕاندنەوەکانی لەوەتەی گەڕاندیانەوە لێی دەردەکرێت، هەر کاتێک کرابن. فرۆشتنە هەڵوەشێنراوەکان تێیدا نین.",
    },
  "See the sales by": { ar: "اعرض المبيعات حسب", ckb: "فرۆشتن ببینە بەپێی" },
  "Then by": { ar: "ثم حسب", ckb: "پاشان بەپێی" },
  "Nothing more": { ar: "لا شيء آخر", ckb: "هیچی تر" },
  "Every branch": { ar: "كل الفروع", ckb: "هەموو لقەکان" },
  "Every category": { ar: "كل الفئات", ckb: "هەموو پۆلەکان" },
  "Who took the money": { ar: "من استلم المال", ckb: "کێ پارەکەی وەرگرت" },
  Everyone: { ar: "الجميع", ckb: "هەمووان" },
  "By {first}, then by {second}": {
    ar: "حسب {first}، ثم حسب {second}",
    ckb: "بەپێی {first}، پاشان بەپێی {second}",
  },
  "By {first}": { ar: "حسب {first}", ckb: "بەپێی {first}" },
  "Sold for": { ar: "سعر البيع", ckb: "نرخی فرۆشتن" },
  "Times taken": { ar: "مرات الأخذ", ckb: "جارەکانی وەرگرتن" },
  Kept: { ar: "المتبقي", ckb: "ماوە" },
  "Margin kept": { ar: "هامش الربح المتبقي", ckb: "پەراوێزی قازانجی ماوە" },
  "The first {n} rows of {m}: narrow the dates or the choice to see the rest.": {
    ar: "أول {n} صفاً من {m}: ضيّق التواريخ أو الاختيار لترى الباقي.",
    ckb: "یەکەم {n} ڕیز لە {m}: بەروارەکان یان هەڵبژاردنەکە تەسک بکەرەوە بۆ بینینی ئەوانی تر.",
  },
  "Left out: {n} voided sale(s), {amount}; {m} bill(s) cancelled.": {
    ar: "خارج التحليل: {n} بيع ملغى، {amount}؛ {m} فاتورة ملغاة.",
    ckb: "لەدەرەوە: {n} فرۆشتنی هەڵوەشێنراوە، {amount}؛ {m} پسووڵەی هەڵوەشێنراوە.",
  },
  "Each add-on as it was sold on its line, its share of the discount taken off. Refunds are not taken off here.":
    {
      ar: "كل إضافة كما بيعت على سطرها، بعد طرح حصتها من الخصم. لا تُطرح المستردات هنا.",
      ckb: "هەر زیادەیەک وەک لەسەر هێڵەکەی فرۆشرا، بەشی خۆی لە داشکاندن لێ دەرکراوە. گەڕاندنەوەی پارە لێرەدا لێ دەرناکرێت.",
    },
  "What each way of paying took of the sales, and what their refunds gave back that way. A payment pays for a whole sale, so payments go with the hour, the day, the person, the channel and the branch.":
    {
      ar: "ما أخذته كل طريقة دفع من المبيعات، وما أعادته مستردّاتها بالطريقة نفسها. الدفعة تدفع ثمن البيع كله، لذلك تُعرض الدفعات حسب الساعة واليوم والشخص والقناة والفرع.",
      ckb: "ئەوەی هەر ڕێگایەکی پارەدان لە فرۆشتنەکان وەریگرت، و ئەوەی گەڕاندنەوەکانیان بەو ڕێگایە گەڕاندیانەوە. پارەدانێک پارەی هەموو فرۆشتنێک دەدات، بۆیە پارەدانەکان بەپێی کاتژمێر، ڕۆژ، کەس، کەناڵ و لق دەبینرێن.",
    },
  "Each line as it was sold, its add-ons with it, so the products, the categories and the sizes add up to the sales. The margin is what they came to less the cost of what they used; kept, less what refunds gave back and the cost they put back.":
    {
      ar: "كل سطر كما بيع، مع إضافاته، فتجتمع المنتجات والفئات والأحجام إلى المبيعات. هامش الربح هو ما بلغته ناقص كلفة ما استهلكته؛ والمتبقي بعد طرح ما أعادته المستردات والكلفة التي أرجعتها.",
      ckb: "هەر هێڵێک وەک فرۆشرا، لەگەڵ زیادەکانی، بۆیە بەرهەم و پۆل و قەبارەکان کۆی فرۆشتنەکان دەدەنەوە. پەراوێزی قازانج ئەوەیە کە گەیشتنە پێی کەمتر لە تێچووی ئەوەی بەکاریان هێنا؛ ماوەکەش، دوای لابردنی ئەوەی گەڕاندنەوەکان گەڕاندیانەوە و ئەو تێچووەی گەڕاندیانەوە.",
    },
  Hour: { ar: "الساعة", ckb: "کاتژمێر" },
  "Day of the week": { ar: "يوم الأسبوع", ckb: "ڕۆژی هەفتە" },
  Mixed: { ar: "مختلط", ckb: "تێکەڵ" },
  "No one": { ar: "لا أحد", ckb: "هیچ کەس" },
  "Last 7 days": { ar: "آخر 7 أيام", ckb: "دوایین 7 ڕۆژ" },

  // Reports → Stock value on a day
  "Stock value on a day": { ar: "قيمة المخزون في يوم", ckb: "بەهای کۆگا لە ڕۆژێکدا" },
  "What every item in stock was worth when the day ended, from the stock ledger, beside what 1200 Inventory held then. The two agree when the books tie.":
    {
      ar: "قيمة كل صنف في المخزون عند انتهاء اليوم، من سجل المخزون، بجانب ما كان في حساب المخزون 1200 حينها. يتطابقان حين تتطابق الدفاتر.",
      ckb: "بەهای هەر کاڵایەک لە کۆگادا کاتێک ڕۆژەکە کۆتایی هات، لە تۆماری کۆگاوە، لە تەنیشت ئەوەی هەژماری کۆگا 1200 ئەو کاتە تێیدا بوو. هەردووکیان یەکدەگرنەوە کاتێک دەفتەرەکان یەکدەگرنەوە.",
    },
  "The stock ledger": { ar: "سجل المخزون", ckb: "تۆماری کۆگا" },
  "1200 Inventory": { ar: "حساب المخزون 1200", ckb: "هەژماری کۆگا 1200" },
  "They agree": { ar: "متطابقان", ckb: "یەکدەگرنەوە" },
  "Difference: {amount}": { ar: "الفرق: {amount}", ckb: "جیاوازی: {amount}" },
  "Item by item": { ar: "صنفاً صنفاً", ckb: "کاڵا بە کاڵا" },
  "Nothing was in stock then.": {
    ar: "لم يكن في المخزون شيء حينها.",
    ckb: "ئەو کاتە هیچ لە کۆگادا نەبوو.",
  },

  // What the database refuses with (0051)
  "Choose at most a year of dates": {
    ar: "اختر سنة من التواريخ على الأكثر",
    ckb: "لانی زۆر ساڵێک بەروار هەڵبژێرە",
  },
  "Choose what to see the sales by": {
    ar: "اختر ما تُعرض المبيعات حسبه",
    ckb: "هەڵبژێرە فرۆشتن بەپێی چی ببینرێت",
  },
  "Choose something else to see them by next": {
    ar: "اختر شيئاً آخر لعرضها حسبه بعد ذلك",
    ckb: "شتێکی تر هەڵبژێرە بۆ ئەوەی پاشان بەپێی ئەو ببینرێن",
  },
  "A payment pays for a whole sale: see the payments by the hour, the day, the person, the channel or the branch":
    {
      ar: "الدفعة تدفع ثمن البيع كله: اعرض الدفعات حسب الساعة أو اليوم أو الشخص أو القناة أو الفرع",
      ckb: "پارەدانێک پارەی هەموو فرۆشتنێک دەدات: پارەدانەکان بەپێی کاتژمێر، ڕۆژ، کەس، کەناڵ یان لق ببینە",
    },
  "Choose the day": { ar: "اختر اليوم", ckb: "ڕۆژەکە هەڵبژێرە" },
  "Choose today or a day before it": {
    ar: "اختر اليوم أو يوماً قبله",
    ckb: "ئەمڕۆ یان ڕۆژێک پێش ئەمڕۆ هەڵبژێرە",
  },
  "Location not found": { ar: "المكان غير موجود", ckb: "شوێنەکە نەدۆزرایەوە" },
};

export default phrases;
