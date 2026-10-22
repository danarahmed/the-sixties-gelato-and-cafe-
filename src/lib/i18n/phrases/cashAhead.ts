import type { PhraseBook } from "./types";

const DAYS = "{n, plural, one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}";

/** Cash ahead (0093): the database's words and the screens'. */
const phrases: PhraseBook = {
  // The database's.
  "Look 1 to 92 days ahead": {
    ar: "انظر من يوم إلى 92 يومًا مقدمًا",
    ckb: "1 تا 92 ڕۆژ بەرەوپێش ببینە",
  },
  "The bank would be {1} short on {2}": {
    ar: "سينقص البنك {1} في {2}",
    ckb: "بانک لە {2} بە بڕی {1} کەم دەبێت",
  },
  "The safe would be {1} short on {2}": {
    ar: "ستنقص الخزنة {1} في {2}",
    ckb: "قاسەکە لە {2} بە بڕی {1} کەم دەبێت",
  },
  "From what it holds now, the usual takings and what is due, as the café's own records have them.":
    {
      ar: "بحسب ما فيه الآن، والمبيعات المعتادة، وما يستحق، كما في سجلات المقهى نفسه.",
      ckb: "بەپێی ئەوەی ئێستا تێیدایە، فرۆشتنی ئاسایی و ئەوەی کاتی دانەوەیەتی، وەک تۆمارەکانی کافێکە خۆی.",
    },
  "Move {1} from the safe to the bank by {2}.": {
    ar: "انقل {1} من الخزنة إلى البنك قبل {2}.",
    ckb: "{1} لە قاسەکەوە بگوازەرەوە بۆ بانک تا {2}.",
  },
  "Ask {1} to take {2} later.": {
    ar: "اطلب من {1} أن يأخذ {2} لاحقًا.",
    ckb: "داوا لە {1} بکە {2} دواتر وەربگرێت.",
  },
  "Money short ahead": { ar: "نقص في المال قادم", ckb: "کەمیی پارە لە پێشە" },

  // Reports → Cash ahead.
  "Cash ahead": { ar: "النقد القادم", ckb: "پارەی داهاتوو" },
  "Cash ahead: the next 30 days of the bank and the safe →": {
    ar: "النقد القادم: الأيام الثلاثون القادمة للبنك والخزنة ←",
    ckb: "پارەی داهاتوو: 30 ڕۆژی داهاتووی بانک و قاسە ←",
  },
  "Cash ahead is not ready yet.": {
    ar: "النقد القادم ليس جاهزًا بعد.",
    ckb: "پارەی داهاتوو هێشتا ئامادە نییە.",
  },
  "It comes with migration 0093.": { ar: "يأتي مع الترحيل 0093.", ckb: "لەگەڵ کۆچی 0093 دێت." },
  "Bill {ref}": { ar: "الفاتورة {ref}", ckb: "پسوولەی {ref}" },
  "An order still to be billed": {
    ar: "طلبية لم تُفوتَر بعد",
    ckb: "داواکارییەک هێشتا پسوولەی بۆ نەکراوە",
  },
  "A delivery still to be billed": {
    ar: "توريد لم يُفوتَر بعد",
    ckb: "گەیاندنێک هێشتا پسوولەی بۆ نەکراوە",
  },
  "Invoice {ref}": { ar: "فاتورة الزبون {ref}", ckb: "پسوولەی کڕیار {ref}" },
  "Every week": { ar: "كل أسبوع", ckb: "هەموو هەفتەیەک" },
  "Every two weeks": { ar: "كل أسبوعين", ckb: "هەموو دوو هەفتە جارێک" },
  "Every three months": { ar: "كل ثلاثة أشهر", ckb: "هەموو سێ مانگ جارێک" },
  "Every month": { ar: "كل شهر", ckb: "هەموو مانگێک" },
  "The next {n} day(s) from {day}": {
    ar: `الـ${DAYS} القادمة من {day}`,
    ckb: "{n} ڕۆژی داهاتوو لە {day}ەوە",
  },
  "The café's money over the next days, from what it holds now, the usual takings of each weekday and what is due, as its own records have them. Nothing is moved or paid.":
    {
      ar: "مال المقهى في الأيام القادمة، بحسب ما فيه الآن، ومبيعات كل يوم من الأسبوع المعتادة، وما يستحق، كما في سجلاته نفسها. لا يُنقل شيء ولا يُدفع.",
      ckb: "پارەی کافێکە لە ڕۆژانی داهاتوودا، بەپێی ئەوەی ئێستا هەیەتی، فرۆشتنی ئاسایی هەر ڕۆژێکی هەفتە و ئەوەی کاتی دانەوەیەتی، وەک تۆمارەکانی خۆی. هیچ شتێک ناگوازرێتەوە و نادرێت.",
    },
  "Each weekday's takings are the last four weeks' same weekdays: the cash goes to the safe at each close, the card money reaches the bank on the weekdays it has before, less what the bank keeps; the safe is banked on the weekdays it has been. Bills are paid on their due dates, moved to the days and as late as the café has paid them lately. A payment made again and again under the same words — the rent, the electricity, the salaries, the owner's drawings — comes again when it has before, at what it was last. An overdue customer invoice is not counted.":
    {
      ar: "مبيعات كل يوم من الأسبوع هي مبيعات الأيام نفسها في الأسابيع الأربعة الأخيرة: يذهب النقد إلى الخزنة عند كل إغلاق، ويصل مال البطاقات إلى البنك في الأيام التي وصل فيها من قبل، ناقصًا ما يأخذه البنك؛ وتُودَع الخزنة في البنك في الأيام التي أُودعت فيها. تُدفع الفواتير في مواعيد استحقاقها، مُزاحةً إلى الأيام التي يدفع فيها المقهى عادةً وبالتأخير الذي دفع به مؤخرًا. والدفعة التي تتكرر بالكلمات نفسها — الإيجار والكهرباء والرواتب ومسحوبات المالك — تعود حين عادت من قبل، بآخر مبلغ لها. ولا تُحسب فاتورة زبون متأخرة.",
      ckb: "فرۆشتنی هەر ڕۆژێکی هەفتە هی هەمان ڕۆژەکانی چوار هەفتەی ڕابردووە: پارەی نەختینە لە هەر داخستنێکدا دەچێتە قاسە، پارەی کارت لەو ڕۆژانەدا دەگاتە بانک کە پێشتر گەیشتووە، جگە لەوەی بانک دەیبات؛ قاسەکە لەو ڕۆژانەدا دەخرێتە بانک کە پێشتر خراوە. پسوولەکان لە کاتی دانەوەیان دەدرێن، دەگوازرێنەوە بۆ ئەو ڕۆژانەی کافێکە زۆرجار تێیاندا دەدات و بەو دواکەوتنەی ئەم دواییە. پارەدانێک کە بە هەمان وشە دووبارە دەبێتەوە — کرێ، کارەبا، مووچە، ڕاکێشانی خاوەن — دووبارە دێتەوە کاتێک پێشتر هاتووە، بە دوایین بڕی. پسوولەی دواکەوتووی کڕیار ناژمێردرێت.",
    },
  "The bank would be {amount} short on {day}.": {
    ar: "سينقص البنك {amount} في {day}.",
    ckb: "بانک لە {day} بە بڕی {amount} کەم دەبێت.",
  },
  "The safe would be {amount} short on {day}.": {
    ar: "ستنقص الخزنة {amount} في {day}.",
    ckb: "قاسەکە لە {day} بە بڕی {amount} کەم دەبێت.",
  },
  "From {from}, in {n} day(s), until {until}.": {
    ar: `من {from}، بعد ${DAYS}، حتى {until}.`,
    ckb: "لە {from}ەوە، دوای {n} ڕۆژ، تا {until}.",
  },
  "From {from}, in {n} day(s), and still at the end of the days ahead.": {
    ar: `من {from}، بعد ${DAYS}، ولا يزال كذلك في آخر الأيام القادمة.`,
    ckb: "لە {from}ەوە، دوای {n} ڕۆژ، و هێشتا لە کۆتایی ڕۆژانی داهاتوودا وایە.",
  },
  "Due then: {what}.": { ar: "المستحق حينها: {what}.", ckb: "ئەوەی ئەوکات دەبێت بدرێت: {what}." },
  "Move {amount} from the safe to the bank by {day}.": {
    ar: "انقل {amount} من الخزنة إلى البنك قبل {day}.",
    ckb: "{amount} لە قاسەکەوە بگوازەرەوە بۆ بانک تا {day}.",
  },
  "Ask {supplier} to take {amount} later.": {
    ar: "اطلب من {supplier} أن يأخذ {amount} لاحقًا.",
    ckb: "داوا لە {supplier} بکە {amount} دواتر وەربگرێت.",
  },
  "Put money in, or pay something due later.": {
    ar: "أدخل مالًا، أو ادفع شيئًا مستحقًا لاحقًا.",
    ckb: "پارە دابنێ، یان شتێکی کاتی دانەوەی هاتوو دواتر بدە.",
  },
  "The bank and the safe cover what is due in the next {n} day(s).": {
    ar: `يكفي البنك والخزنة ما يستحق في الـ${DAYS} القادمة.`,
    ckb: "بانک و قاسە بەشی ئەوە دەکەن کە لە {n} ڕۆژی داهاتوودا دەبێت بدرێت.",
  },
  "The bank now": { ar: "البنك الآن", ckb: "بانک ئێستا" },
  "The safe {safe}, card money on its way {card}": {
    ar: "الخزنة {safe}، ومال البطاقات في الطريق {card}",
    ckb: "قاسە {safe}، پارەی کارت لە ڕێگادا {card}",
  },
  "Lowest the bank comes to": { ar: "أدنى ما يصل إليه البنك", ckb: "کەمترین بڕی بانک" },
  "Due in the next {n} day(s)": {
    ar: `المستحق في الـ${DAYS} القادمة`,
    ckb: "ئەوەی لە {n} ڕۆژی داهاتوودا دەبێت بدرێت",
  },
  "And {amount} from customers": { ar: "و{amount} من الزبائن", ckb: "و {amount} لە کڕیارانەوە" },
  "Bills, regular payments, salaries": {
    ar: "الفواتير والدفعات المتكررة والرواتب",
    ckb: "پسوولەکان، پارەدانە دووبارەکان، مووچە",
  },
  "The café in {n} day(s)": { ar: `المقهى بعد ${DAYS}`, ckb: "کافێکە دوای {n} ڕۆژ" },
  "The till, the safe, the card money and the bank": {
    ar: "الصندوق والخزنة ومال البطاقات والبنك",
    ckb: "سندوق، قاسە، پارەی کارت و بانک",
  },
  "The bank at each day's end (million IQD)": {
    ar: "البنك في نهاية كل يوم (مليون دينار)",
    ckb: "بانک لە کۆتایی هەر ڕۆژێکدا (ملیۆن دینار)",
  },
  short: { ar: "ناقص", ckb: "کەم" },
  "The days as a table": { ar: "الأيام في جدول", ckb: "ڕۆژەکان وەک خشتە" },
  "Day by day": { ar: "يومًا بيوم", ckb: "ڕۆژ بە ڕۆژ" },
  "The café": { ar: "المقهى", ckb: "کافێکە" },
  "What is due and expected": {
    ar: "ما يستحق وما يُنتظر",
    ckb: "ئەوەی دەبێت بدرێت و چاوەڕوان دەکرێت",
  },
  "Nothing due in the days ahead but the usual takings.": {
    ar: "لا شيء مستحق في الأيام القادمة سوى المبيعات المعتادة.",
    ckb: "لە ڕۆژانی داهاتوودا جگە لە فرۆشتنی ئاسایی هیچ نییە.",
  },
  "Why it is expected": { ar: "لماذا يُنتظر", ckb: "بۆچی چاوەڕوان دەکرێت" },
  "Overdue, not counted: {what}.": {
    ar: "متأخر، غير محسوب: {what}.",
    ckb: "دواکەوتوو، نەژمێردراو: {what}.",
  },
};

export default phrases;
