import type { PhraseBook } from "./types";

/** The watch list (0094): the database's words and the screens'. */
const phrases: PhraseBook = {
  // The database's.
  "Mark it explained or looked into": {
    ar: "علّمه مُفسَّرًا أو مُتحقَّقًا منه",
    ckb: "وەک ڕوونکراوە یان لێکۆڵراوە نیشانەی بکە",
  },
  "Only the owner says who reads the watch list": {
    ar: "المالك وحده يحدد من يقرأ قائمة المراقبة",
    ckb: "تەنها خاوەن دیاری دەکات کێ لیستی چاودێری دەخوێنێتەوە",
  },
  "That finding is not on the watch list": {
    ar: "هذه الملاحظة ليست في قائمة المراقبة",
    ckb: "ئەو تێبینییە لە لیستی چاودێریدا نییە",
  },
  "That finding is settled already": {
    ar: "هذه الملاحظة سُوّيت من قبل",
    ckb: "ئەو تێبینییە پێشتر یەکلا کراوەتەوە",
  },
  "The watch list is for the owner": {
    ar: "قائمة المراقبة للمالك",
    ckb: "لیستی چاودێری بۆ خاوەنە",
  },
  "{1} thing(s) on the watch list worth a look": {
    ar: "{1, plural, one {أمر واحد} two {أمران} few {# أمور} many {# أمرًا} other {# أمر}} في قائمة المراقبة يستحق النظر",
    ckb: "{1} شت لە لیستی چاودێریدا شایەنی سەیرکردنە",
  },
  "A pattern far from what the others do at the same hours, by more than luck would give.": {
    ar: "نمط بعيد عمّا يفعله الآخرون في الساعات نفسها، بأكثر مما تعطيه الصدفة.",
    ckb: "شێوازێک دوور لەوەی ئەوانی تر لە هەمان کاتژمێرەکاندا دەیکەن، زیاتر لەوەی ڕێکەوت دەیدات.",
  },
  "Open the watch list (the owner).": {
    ar: "افتح قائمة المراقبة (المالك).",
    ckb: "لیستی چاودێری بکەرەوە (خاوەن).",
  },
  "Worth a look": { ar: "يستحق النظر", ckb: "شایەنی سەیرکردنە" },

  // The screens'.
  "a finding": { ar: "ملاحظة", ckb: "تێبینییەک" },
  "Watch list": { ar: "قائمة المراقبة", ckb: "لیستی چاودێری" },
  "Open the watch list": { ar: "افتح قائمة المراقبة", ckb: "لیستی چاودێری بکەرەوە" },
  "{n} thing(s) worth a look": {
    ar: "{n, plural, one {أمر واحد يستحق} two {أمران يستحقان} few {# أمور تستحق} many {# أمرًا يستحق} other {# أمر يستحق}} النظر",
    ckb: "{n} شت شایەنی سەیرکردنە",
  },
  "Watch list: patterns worth a look →": {
    ar: "قائمة المراقبة: أنماط تستحق النظر ←",
    ckb: "لیستی چاودێری: شێوازگەلێک شایەنی سەیرکردن ←",
  },
  "Last looked {day}": { ar: "آخر نظر {day}", ckb: "دوایین سەیرکردن {day}" },
  "Not looked yet": { ar: "لم يُنظر بعد", ckb: "هێشتا سەیر نەکراوە" },
  "Nothing stands out.": { ar: "لا شيء لافت.", ckb: "هیچ شتێک جیا نابێتەوە." },
  "Nobody's voids, discounts or drawers are far from the others' at the same hours.": {
    ar: "لا إلغاءات أحد ولا خصوماته ولا أدراجه بعيدة عمّا للآخرين في الساعات نفسها.",
    ckb: "هەڵوەشاندنەوە، داشکاندن یان دەرخانەی هیچ کەسێک دوور نییە لەهی ئەوانی تر لە هەمان کاتژمێرەکاندا.",
  },
  "Patterns that stand out from what the others do at the same hours, by more than luck would give. Each is worth a look, not proof: mark it explained or looked into.":
    {
      ar: "أنماط تبرز عمّا يفعله الآخرون في الساعات نفسها، بأكثر مما تعطيه الصدفة. كل منها يستحق النظر، وليس دليلًا: علّمه مُفسَّرًا أو مُتحقَّقًا منه.",
      ckb: "ئەو شێوازانەی لەوەی ئەوانی تر لە هەمان کاتژمێرەکاندا دەیکەن جیا دەبنەوە، زیاتر لەوەی ڕێکەوت دەیدات. هەریەکەیان شایەنی سەیرکردنە، بەڵگە نییە: وەک ڕوونکراوە یان لێکۆڵراوە نیشانەی بکە.",
    },
  "Once a day, over the four weeks to yesterday: sales voided, discounts within two points of the limit a cashier may give alone (each reason apart, so a promotion everyone gives is nobody's), and drawers short by 5,000 IQD or more. Each person is set against the others who sold at the same hours. Someone new is not judged in their first three weeks. A finding settled is not raised again for two weeks.":
    {
      ar: "مرة في اليوم، على الأسابيع الأربعة حتى الأمس: المبيعات الملغاة، والخصومات التي تقل بنقطتين أو أقل عن الحد الذي يعطيه أمين الصندوق وحده (كل سبب على حدة، فالعرض الذي يعطيه الجميع ليس لأحد)، والأدراج الناقصة 5,000 دينار أو أكثر. يُقارن كل شخص بالآخرين الذين باعوا في الساعات نفسها. لا يُحكم على الجديد في أسابيعه الثلاثة الأولى. والملاحظة التي سُوّيت لا تُثار ثانية لأسبوعين.",
      ckb: "ڕۆژی جارێک، لەسەر چوار هەفتەی تا دوێنێ: فرۆشتنە هەڵوەشێنراوەکان، ئەو داشکاندنانەی دوو خاڵ یان کەمتر لە سنووری ئەوەی کاشێر بە تەنها دەیدات کەمترن (هەر هۆکارێک جیا، بۆیە ئۆفەرێک کە هەمووان دەیدەن هی کەس نییە)، و ئەو دەرخانانەی 5,000 دینار یان زیاتر کەمن. هەر کەسێک بەراورد دەکرێت بەوانی تر کە لە هەمان کاتژمێرەکاندا فرۆشتوویانە. کەسی نوێ لە سێ هەفتەی یەکەمیدا هەڵناسەنگێنرێت. تێبینییەکی یەکلاکراوە بۆ دوو هەفتە دووبارە ناکرێتەوە.",
    },
  "Settled in the last 30 days ({n})": {
    ar: "سُوّيت في آخر 30 يومًا ({n})",
    ckb: "لە 30 ڕۆژی ڕابردوودا یەکلا کراونەتەوە ({n})",
  },
  "Strong: less than 1 in a million by luck": {
    ar: "قوي: أقل من 1 في المليون بالصدفة",
    ckb: "بەهێز: کەمتر لە 1 لە ملیۆنێک بە ڕێکەوت",
  },
  "Worth a look: less than 1 in 100,000 by luck": {
    ar: "يستحق النظر: أقل من 1 في 100,000 بالصدفة",
    ckb: "شایەنی سەیرکردنە: کەمتر لە 1 لە 100,000 بە ڕێکەوت",
  },
  "Worth a look: less than 1 in 10,000 by luck": {
    ar: "يستحق النظر: أقل من 1 في 10,000 بالصدفة",
    ckb: "شایەنی سەیرکردنە: کەمتر لە 1 لە 10,000 بە ڕێکەوت",
  },
  "The others gave none like it at the same hours.": {
    ar: "لم يعطِ الآخرون مثله في الساعات نفسها.",
    ckb: "ئەوانی تر لە هەمان کاتژمێرەکاندا هیچ وایان نەداوە.",
  },
  "The others voided none at the same hours.": {
    ar: "لم يُلغِ الآخرون شيئًا في الساعات نفسها.",
    ckb: "ئەوانی تر لە هەمان کاتژمێرەکاندا هیچیان هەڵنەوەشاندووەتەوە.",
  },
  "The others' rate at the same hours would give {expected}: {times} times as often.": {
    ar: "معدّل الآخرين في الساعات نفسها يعطي {expected}: أي {times} أضعاف.",
    ckb: "ڕێژەی ئەوانی تر لە هەمان کاتژمێرەکاندا {expected} دەدات: {times} هێندە زیاتر.",
  },
  "The sales of those days": { ar: "مبيعات تلك الأيام", ckb: "فرۆشتنەکانی ئەو ڕۆژانە" },
  explained: { ar: "مُفسَّر", ckb: "ڕوونکراوە" },
  "looked into": { ar: "مُتحقَّق منه", ckb: "لێکۆڵراوە" },
  "first seen {first}, last {last}": {
    ar: "أول مرة {first}، وآخر مرة {last}",
    ckb: "یەکەم جار {first}، دوایین جار {last}",
  },
  "{n} discounts of {low}–{high}% ({reason}) in {sales} sales, {from} to {to}.": {
    ar: "{n} خصمًا بين {low} و{high}% ({reason}) في {sales} عملية بيع، من {from} إلى {to}.",
    ckb: "{n} داشکاندنی {low}–{high}% ({reason}) لە {sales} فرۆشتندا، لە {from} تا {to}.",
  },
  "{n} of them on a {weekday}, on the same shift.": {
    ar: "{n} منها في يوم {weekday}، في الوردية نفسها.",
    ckb: "{n} لەوانە لە ڕۆژی {weekday}، لە هەمان شەفتدا.",
  },
  "{person}: discounts just under the limit, again and again": {
    ar: "{person}: خصومات تحت الحد بقليل، مرة بعد مرة",
    ckb: "{person}: داشکاندنی کەمێک خوار سنوورەکە، جار لە دوای جار",
  },
  "{person}: sales voided far more often than the others' at the same hours": {
    ar: "{person}: مبيعات ملغاة أكثر بكثير من مبيعات الآخرين في الساعات نفسها",
    ckb: "{person}: فرۆشتنی هەڵوەشێنراوە زۆر زیاتر لەهی ئەوانی تر لە هەمان کاتژمێرەکاندا",
  },
  "{person}: the drawer short again and again": {
    ar: "{person}: الدرج ناقص مرة بعد مرة",
    ckb: "{person}: دەرخانەکە جار لە دوای جار کەمە",
  },
  "{short} of {shifts} drawers short by 5,000 IQD or more, {amount} in all, {from} to {to}.": {
    ar: "{short} من {shifts} أدراج ناقصة 5,000 دينار أو أكثر، {amount} في المجموع، من {from} إلى {to}.",
    ckb: "{short} لە {shifts} دەرخانە بە 5,000 دینار یان زیاتر کەم بوون، کۆی {amount}، لە {from} تا {to}.",
  },
  "{voids} of {sales} sales voided, {from} to {to}.": {
    ar: "أُلغيت {voids} من {sales} عملية بيع، من {from} إلى {to}.",
    ckb: "{voids} لە {sales} فرۆشتن هەڵوەشێنرایەوە، لە {from} تا {to}.",
  },
  "A note (on the audit trail)": {
    ar: "ملاحظة (في سجل التدقيق)",
    ckb: "تێبینییەک (لە تۆماری چاودێری)",
  },
  Explained: { ar: "مُفسَّر", ckb: "ڕوونکراوە" },
  "Looked into": { ar: "مُتحقَّق منه", ckb: "لێکۆڵراوە" },
  "e.g. the regulars' discount, agreed": {
    ar: "مثلًا: خصم الزبائن الدائمين، متفق عليه",
    ckb: "بۆ نموونە: داشکاندنی کڕیارە هەمیشەییەکان، ڕێککەوتوو",
  },
  "The general manager reads the watch list too": {
    ar: "المدير العام يقرأ قائمة المراقبة أيضًا",
    ckb: "بەڕێوەبەری گشتیش لیستی چاودێری دەخوێنێتەوە",
  },
};

export default phrases;
