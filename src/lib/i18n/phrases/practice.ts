import type { PhraseBook } from "./types";

/**
 * Practice (0096): the same app with pretend money and stock, in a practice
 * café of the person's own, with their role's tasks ticked as they do them.
 */
const phrases: PhraseBook = {
  // The banner on every screen.
  PRACTICE: { ar: "تدريب", ckb: "ڕاهێنان" },
  "Nothing here is real: no money, no stock, nothing in the books.": {
    ar: "لا شيء هنا حقيقي: لا مال ولا مخزون ولا شيء في الدفاتر.",
    ckb: "هیچ شتێک لێرە ڕاستەقینە نییە: نە پارە، نە کۆگا، نە هیچ لە دەفتەرەکان.",
  },
  "Your practice tasks": { ar: "مهام تدريبك", ckb: "ئەرکەکانی ڕاهێنانت" },
  "Stop practising": { ar: "أوقف التدريب", ckb: "ڕاهێنان ڕابگرە" },

  // The page.
  Practice: { ar: "التدريب", ckb: "ڕاهێنان" },
  "Carry on practising": { ar: "تابع التدريب", ckb: "بەردەوام بە لە ڕاهێنان" },
  "Start practising": { ar: "ابدأ التدريب", ckb: "دەست بە ڕاهێنان بکە" },
  "Start again with a fresh practice café? What you ticked stays ticked.": {
    ar: "هل تبدأ من جديد بمقهى تدريب جديد؟ ما أنجزته يبقى منجزًا.",
    ckb: "دووبارە بە کافێیەکی ڕاهێنانی نوێ دەست پێدەکەیتەوە؟ ئەوەی تەواوت کردووە وەک خۆی دەمێنێتەوە.",
  },
  "Start again from the first day": {
    ar: "ابدأ من جديد من اليوم الأول",
    ckb: "لە ڕۆژی یەکەمەوە دەست پێبکەرەوە",
  },
  "Practice has ended": { ar: "انتهى التدريب", ckb: "ڕاهێنان کۆتایی هات" },
  "This practice café is no more. Go back to the café, and start practice again when you want.": {
    ar: "مقهى التدريب هذا لم يعد موجودًا. عُد إلى المقهى، وابدأ التدريب من جديد متى شئت.",
    ckb: "ئەم کافێیەی ڕاهێنان چیتر نەماوە. بگەڕێوە بۆ کافێکە، و هەر کاتێک ویستت دووبارە دەست بە ڕاهێنان بکەرەوە.",
  },
  "Back to the café": { ar: "العودة إلى المقهى", ckb: "گەڕانەوە بۆ کافێ" },
  "This needs the database update 0096, which has not been applied yet.": {
    ar: "يحتاج هذا إلى تحديث قاعدة البيانات 0096، ولم يُطبَّق بعد.",
    ckb: "ئەمە پێویستی بە نوێکردنەوەی بنکەدراوەی 0096 هەیە، کە هێشتا جێبەجێ نەکراوە.",
  },
  "Practise your work in a practice café of your own: the same screens, a small menu, pretend money and stock. Nothing you do there reaches the café's books, so try everything, and make mistakes.":
    {
      ar: "تدرّب على عملك في مقهى تدريب خاص بك: الشاشات نفسها، وقائمة صغيرة، ومال ومخزون غير حقيقيين. لا شيء تفعله هناك يصل إلى دفاتر المقهى، فجرّب كل شيء، ولا تخشَ الخطأ.",
      ckb: "کارەکەت لە کافێیەکی ڕاهێنانی تایبەت بە خۆت ڕاهێنان پێبکە: هەمان شاشەکان، مینیوێکی بچووک، پارە و کۆگای ساختە. هیچ شتێک لەوێ ناگاتە دەفتەرەکانی کافێ، بۆیە هەموو شتێک تاقی بکەرەوە، و لە هەڵە مەترسە.",
    },
  "You are practising now. Every screen shows the practice banner.": {
    ar: "أنت تتدرّب الآن. كل شاشة تُظهر شريط التدريب.",
    ckb: "ئێستا ڕاهێنان دەکەیت. هەموو شاشەیەک شریتی ڕاهێنان پیشان دەدات.",
  },
  "Your tasks": { ar: "مهامك", ckb: "ئەرکەکانت" },
  "{done} of {n} done": { ar: "{done} من {n} منجزة", ckb: "{done} لە {n} تەواو کراون" },
  "You are ready: every task of your role is done.": {
    ar: "أنت جاهز: كل مهام دورك منجزة.",
    ckb: "ئامادەیت: هەموو ئەرکەکانی ڕۆڵەکەت تەواو کراون.",
  },
  "Done {when}": { ar: "أُنجزت {when}", ckb: "تەواو کرا {when}" },
  Go: { ar: "اذهب", ckb: "بڕۆ" },
  "Watch how": { ar: "شاهد كيف", ckb: "سەیر بکە چۆن" },
  "Your team's practice": { ar: "تدريب فريقك", ckb: "ڕاهێنانی تیمەکەت" },
  "Each person's tasks done in practice. Ready: every task of their role done.": {
    ar: "مهام كل شخص المنجزة في التدريب. جاهز: كل مهام دوره منجزة.",
    ckb: "ئەرکە تەواوکراوەکانی هەر کەسێک لە ڕاهێناندا. ئامادەیە: هەموو ئەرکەکانی ڕۆڵەکەی تەواو کراون.",
  },
  Role: { ar: "الدور", ckb: "ڕۆڵ" },
  "Last practised": { ar: "آخر تدريب", ckb: "دوایین ڕاهێنان" },
  "{done} of {n}": { ar: "{done} من {n}", ckb: "{done} لە {n}" },
  "Not started": { ar: "لم يبدأ", ckb: "دەستی پێنەکردووە" },
  "Practise first": { ar: "تدرّب أولًا", ckb: "سەرەتا ڕاهێنان بکە" },
  "New here? Practise your work in a practice café first: nothing you do there is real.": {
    ar: "جديد هنا؟ تدرّب على عملك في مقهى تدريب أولًا: لا شيء تفعله هناك حقيقي.",
    ckb: "نوێیت لێرە؟ سەرەتا لە کافێیەکی ڕاهێناندا ڕاهێنان بە کارەکەت بکە: هیچ شتێک لەوێ ڕاستەقینە نییە.",
  },

  "Practice is for the café's own people": {
    ar: "التدريب لأفراد المقهى أنفسهم",
    ckb: "ڕاهێنان بۆ خەڵکی خودی کافێیە",
  },

  "New here? Practise first": {
    ar: "جديد هنا؟ تدرّب أولًا",
    ckb: "نوێیت لێرە؟ سەرەتا ڕاهێنان بکە",
  },
  "{n} practice tasks left for your role. Nothing you do in practice is real.": {
    ar: "بقيت {n} من مهام التدريب لدورك. لا شيء تفعله في التدريب حقيقي.",
    ckb: "{n} ئەرکی ڕاهێنان بۆ ڕۆڵەکەت ماوە. هیچ شتێک لە ڕاهێناندا ڕاستەقینە نییە.",
  },
  "Try your work in a practice café of your own: nothing you do there is real.": {
    ar: "جرّب عملك في مقهى تدريب خاص بك: لا شيء تفعله هناك حقيقي.",
    ckb: "کارەکەت لە کافێیەکی ڕاهێنانی تایبەت بە خۆت تاقی بکەرەوە: هیچ شتێک لەوێ ڕاستەقینە نییە.",
  },

  // The tasks.
  "Open the drawer and count it": { ar: "افتح الدرج وعدّه", ckb: "دەخیلەکە بکەرەوە و بیژمێرە" },
  "On the till, press the drawer button, count the cash in it and open it.": {
    ar: "على شاشة البيع، اضغط زر الدرج، وعدّ النقود فيه وافتحه.",
    ckb: "لەسەر شاشەی فرۆشتن، دوگمەی دەخیلە دابگرە، پارەکەی ناوی بژمێرە و بیکەرەوە.",
  },
  "Sell 2 small lattes, paid by card": {
    ar: "بِع كوبين صغيرين من اللاتيه، الدفع بالبطاقة",
    ckb: "2 لاتێی بچووک بفرۆشە، بە کارت",
  },
  "On the till, press Menu, tap Latte and choose Small, twice, then Card.": {
    ar: "على شاشة البيع، اضغط القائمة، ثم لاتيه واختر صغير، مرتين، ثم بطاقة.",
    ckb: "لەسەر شاشەی فرۆشتن، مینیو دابگرە، لاتێ دابگرە و بچووک هەڵبژێرە، دوو جار، پاشان کارت.",
  },
  "Sell for cash and give change": {
    ar: "بِع نقدًا وأعطِ الباقي",
    ckb: "بە پارەی نەختینە بفرۆشە و باقی بدەرەوە",
  },
  "Sell an espresso, choose Cash and type 5000 as what the customer gave: the till says the change.":
    {
      ar: "بِع إسبريسو، واختر نقدًا واكتب 5000 على أنه ما دفعه الزبون: تُظهر الشاشة الباقي.",
      ckb: "ئێسپرێسۆیەک بفرۆشە، نەختینە هەڵبژێرە و 5000 بنووسە وەک ئەوەی کڕیار دای: شاشەکە باقییەکە دەڵێت.",
    },
  "Give a 10% discount": { ar: "أعطِ خصمًا بنسبة 10%", ckb: "داشکاندنی 10% بدە" },
  "Before paying, press Discount, choose 10% and a reason.": {
    ar: "قبل الدفع، اضغط خصم، واختر 10% وسببًا.",
    ckb: "پێش پارەدان، داشکاندن دابگرە، 10% و هۆکارێک هەڵبژێرە.",
  },
  "Serve a table: open its bill, add to it, then take payment": {
    ar: "خدمة طاولة: افتح فاتورتها، وأضف إليها، ثم استلم الدفع",
    ckb: "خزمەتی مێزێک بکە: پسوولەکەی بکەرەوە، شتی بۆ زیاد بکە، پاشان پارە وەربگرە",
  },
  "On Tables, tap Table 1, add two items, keep the bill, open it again and take payment.": {
    ar: "في الطاولات، اضغط الطاولة 1، وأضف مادتين، واحفظ الفاتورة، وافتحها مجددًا واستلم الدفع.",
    ckb: "لە مێزەکان، مێزی 1 دابگرە، دوو شت زیاد بکە، پسوولەکە هەڵبگرە، دووبارە بیکەرەوە و پارە وەربگرە.",
  },
  "Refund one item of a sale": {
    ar: "استرجع مادة واحدة من عملية بيع",
    ckb: "یەک شتی فرۆشتنێک بگەڕێنەوە",
  },
  "On Orders, find the sale, press Refund, choose the item and why.": {
    ar: "في الطلبات، ابحث عن البيع، واضغط استرجاع، واختر المادة والسبب.",
    ckb: "لە داواکارییەکان، فرۆشتنەکە بدۆزەوە، گەڕاندنەوە دابگرە، شتەکە و هۆکارەکە هەڵبژێرە.",
  },
  "Void a sale rung by mistake": {
    ar: "ألغِ بيعًا سُجّل خطأً",
    ckb: "فرۆشتنێک هەڵبوەشێنەوە کە بە هەڵە تۆمار کرا",
  },
  "On Orders, find the sale, press Void and say why.": {
    ar: "في الطلبات، ابحث عن البيع، واضغط إلغاء واذكر السبب.",
    ckb: "لە داواکارییەکان، فرۆشتنەکە بدۆزەوە، هەڵوەشاندنەوە دابگرە و هۆکارەکە بڵێ.",
  },
  "Count and close the drawer": { ar: "عدّ الدرج وأغلقه", ckb: "دەخیلەکە بژمێرە و دایبخە" },
  "At the end of the shift, press the drawer button, count the cash and close it.": {
    ar: "في نهاية الوردية، اضغط زر الدرج، وعدّ النقود وأغلقه.",
    ckb: "لە کۆتایی شەفتدا، دوگمەی دەخیلە دابگرە، پارەکە بژمێرە و دایبخە.",
  },
  "Record a batch you made": { ar: "سجّل دفعة صنعتها", ckb: "بەرهەمێک تۆمار بکە کە دروستت کرد" },
  "On Production, record a batch of the vanilla base: 5 L from milk and sugar.": {
    ar: "في الإنتاج، سجّل دفعة من قاعدة الفانيلا: 5 لترات من الحليب والسكر.",
    ckb: "لە بەرهەمهێنان، بەرهەمێکی بنکەی ڤانیلا تۆمار بکە: 5 لیتر لە شیر و شەکر.",
  },
  "Record something thrown away": { ar: "سجّل شيئًا رُمي", ckb: "شتێک تۆمار بکە کە فڕێدرا" },
  "On Stock, press Record a loss, choose the item, how much and why.": {
    ar: "في المخزون، اضغط تسجيل خسارة، واختر المادة والكمية والسبب.",
    ckb: "لە کۆگا، تۆمارکردنی زیان دابگرە، شتەکە، بڕەکەی و هۆکارەکەی هەڵبژێرە.",
  },
  "Count the stock and send the count": {
    ar: "اجرد المخزون وأرسل الجرد",
    ckb: "کۆگاکە بژمێرە و ژماردنەکە بنێرە",
  },
  "On Stock Count, start a count, type what is on the shelf, and send it.": {
    ar: "في جرد المخزون، ابدأ جردًا، واكتب ما على الرف، وأرسله.",
    ckb: "لە ژماردنی کۆگا، ژماردنێک دەست پێبکە، ئەوەی لەسەر ڕەفەکەیە بنووسە، و بینێرە.",
  },
  "Review Omar's count and approve it": {
    ar: "راجع جرد عمر ووافق عليه",
    ckb: "ژماردنەکەی عومەر بپشکنە و پەسەندی بکە",
  },
  "On Stock Count, at the practice kitchen, open the count Omar sent, look at what is short, and approve it.":
    {
      ar: "في جرد المخزون، في مطبخ التدريب، افتح الجرد الذي أرسله عمر، وانظر إلى الناقص، ووافق عليه.",
      ckb: "لە ژماردنی کۆگا، لە چێشتخانەی ڕاهێنان، ئەو ژماردنە بکەرەوە کە عومەر ناردی، سەیری کەمییەکان بکە، و پەسەندی بکە.",
    },
  "Order from the supplier": { ar: "اطلب من المورّد", ckb: "لە دابینکەر داوا بکە" },
  "On Purchasing, make an order to the practice supplier, approve it and send it.": {
    ar: "في المشتريات، أنشئ طلبية إلى مورّد التدريب، ووافق عليها وأرسلها.",
    ckb: "لە کڕین، داواکارییەک بۆ دابینکەری ڕاهێنان دروست بکە، پەسەندی بکە و بینێرە.",
  },
  "Receive a delivery": { ar: "استلم توريدًا", ckb: "بارێک وەربگرە" },
  "On Purchasing, receive what the supplier brought, with its prices.": {
    ar: "في المشتريات، استلم ما أحضره المورّد، مع أسعاره.",
    ckb: "لە کڕین، ئەوەی دابینکەر هێنای وەربگرە، لەگەڵ نرخەکانی.",
  },
  "Send stock from the kitchen to the branch": {
    ar: "أرسل مخزونًا من المطبخ إلى الفرع",
    ckb: "کۆگا لە چێشتخانەوە بنێرە بۆ لق",
  },
  "On Transfers, send coffee beans from the practice kitchen to the practice branch.": {
    ar: "في التحويلات، أرسل حبوب القهوة من مطبخ التدريب إلى فرع التدريب.",
    ckb: "لە گواستنەوەکان، دانەوێڵەی قاوە لە چێشتخانەی ڕاهێنانەوە بنێرە بۆ لقی ڕاهێنان.",
  },
  "Record an expense": { ar: "سجّل مصروفًا", ckb: "خەرجییەک تۆمار بکە" },
  "On Expenses, record what was paid, for what, and from where.": {
    ar: "في المصروفات، سجّل ما دُفع، ولماذا، ومن أين.",
    ckb: "لە خەرجییەکان، ئەوەی دراوە، بۆ چی، و لە کوێوە تۆمار بکە.",
  },
  "Change a price": { ar: "غيّر سعرًا", ckb: "نرخێک بگۆڕە" },
  "On Products, open Espresso and give it a new price.": {
    ar: "في المنتجات، افتح إسبريسو وأعطه سعرًا جديدًا.",
    ckb: "لە بەرهەمەکان، ئێسپرێسۆ بکەرەوە و نرخێکی نوێی بدەرێ.",
  },
  "Open three reports": { ar: "افتح ثلاثة تقارير", ckb: "سێ ڕاپۆرت بکەرەوە" },
  "On Reports, open any three, and read what each says.": {
    ar: "في التقارير، افتح أي ثلاثة، واقرأ ما يقوله كل منها.",
    ckb: "لە ڕاپۆرتەکان، هەر سێیەک بکەرەوە، و بیخوێنەرەوە هەر یەکەیان چی دەڵێت.",
  },
};

export default phrases;
