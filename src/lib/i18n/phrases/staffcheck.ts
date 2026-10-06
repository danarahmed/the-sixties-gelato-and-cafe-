import type { PhraseBook } from "./types";

/**
 * Round ten, the owner's answer on staffing (0071): the week's schedule on
 * Staff checked against how busy each part of the day usually is, and the
 * labour cost against the target, planned on Staff and as it was on
 * Reports → Staffed when busy?.
 */
const phrases: PhraseBook = {
  // ------------------------------------------------- the parts of the day
  Morning: { ar: "الصباح", ckb: "بەیانی" },
  Afternoon: { ar: "بعد الظهر", ckb: "دوای نیوەڕۆ" },
  Evening: { ar: "المساء", ckb: "ئێوارە" },
  "{day} morning": { ar: "صباح {day}", ckb: "بەیانیی {day}" },
  "{day} afternoon": { ar: "{day} بعد الظهر", ckb: "دوای نیوەڕۆی {day}" },
  "{day} evening": { ar: "مساء {day}", ckb: "ئێوارەی {day}" },

  // ------------------------------------------------- the week checked, on Staff
  "Once the café has four weeks of sales with people clocked in, the week is checked here against how busy each part of the day usually is.":
    {
      ar: "حين يصير لدى المقهى أربعة أسابيع من المبيعات مع حضور مسجَّل، يُفحص الأسبوع هنا مقابل مدى انشغال كل فترة من اليوم عادةً.",
      ckb: "کاتێک کافێکە چوار هەفتە فرۆشتنی هەبێت لەگەڵ کارمەندانی تۆمارکراو، هەفتەکە لێرە بەرامبەر ئەوە دەپشکنرێت کە هەر بەشێکی ڕۆژ بە زۆری چەند قەرەباڵغە.",
    },
  "Is the week staffed for how busy it usually is?": {
    ar: "هل في الأسبوع ما يكفي من العاملين لمدى انشغاله المعتاد؟",
    ckb: "ئایا هەفتەکە بەپێی قەرەباڵغیی ئاسایی کارمەندی بەسی هەیە؟",
  },
  "From the four weeks to yesterday: what each part of the day usually brings on its weekday, and the {n} orders a person usually serves in an hour. Each cell: the people scheduled at a time, and about how many its orders need.":
    {
      ar: "من الأسابيع الأربعة حتى أمس: ما تأتي به كل فترة من اليوم عادةً في يومها من الأسبوع، و{n} طلبات يخدمها الشخص عادةً في الساعة. في كل خانة: عدد المجدولين في الوقت نفسه، ونحو ما تحتاجه طلباتها.",
      ckb: "لە چوار هەفتەی تا دوێنێ: ئەوەی هەر بەشێکی ڕۆژ بە زۆری لە ڕۆژی هەفتەکەیدا دەیهێنێت، و ئەو {n} داواکارییەی کەسێک بە زۆری لە کاتژمێرێکدا خزمەتی دەکات. لە هەر خانەیەکدا: ژمارەی ئەوانەی لە یەک کاتدا خشتەکراون، و نزیکەی ئەوەندەی داواکارییەکانی پێویستیانە.",
    },
  "{people} · needs {need}": { ar: "{people} · يحتاج {need}", ckb: "{people} · پێویستی بە {need}" },
  Labour: { ar: "أجور العمل", ckb: "کرێی کار" },
  "Too few: {list}.": { ar: "عدد قليل: {list}.", ckb: "کەمە: {list}." },
  "{part} ({people} scheduled, about {need} needed)": {
    ar: "{part} ({people} مجدوَلون، ويلزم نحو {need})",
    ckb: "{part} ({people} خشتەکراون، نزیکەی {need} پێویستە)",
  },
  "Nobody scheduled when orders usually come: {list}.": {
    ar: "لا أحد مجدوَل حين تأتي الطلبات عادةً: {list}.",
    ckb: "کەس خشتە نەکراوە لە کاتێکدا داواکاری بە زۆری دێت: {list}.",
  },
  "More than needed: {list}.": { ar: "أكثر من الحاجة: {list}.", ckb: "زیاتر لە پێویست: {list}." },
  "Every part of the week has about the people it usually needs.": {
    ar: "في كل فترة من الأسبوع نحو ما تحتاجه عادةً من العاملين.",
    ckb: "هەموو بەشێکی هەفتەکە نزیکەی ئەو کارمەندانەی هەیە کە بە زۆری پێویستیەتی.",
  },
  "The week's hours cost {cost}: {pct} of what a usual week sells, against a target of {target}.": {
    ar: "تكلفة ساعات الأسبوع {cost}: {pct} مما يبيعه أسبوع معتاد، مقابل هدف قدره {target}.",
    ckb: "تێچووی کاتژمێرەکانی هەفتەکە {cost}: {pct} لەوەی هەفتەیەکی ئاسایی دەیفرۆشێت، بەرامبەر ئامانجی {target}.",
  },
  "The week's hours cost {cost}: {pct} of what a usual week sells. No labour target is set (Settings → Rules).":
    {
      ar: "تكلفة ساعات الأسبوع {cost}: {pct} مما يبيعه أسبوع معتاد. لم يُحدَّد هدف لأجور العمل («الإعدادات» ← «القواعد»).",
      ckb: "تێچووی کاتژمێرەکانی هەفتەکە {cost}: {pct} لەوەی هەفتەیەکی ئاسایی دەیفرۆشێت. هیچ ئامانجێک بۆ کرێی کار دانەنراوە («ڕێکخستنەکان» ← «یاساکان»).",
    },
  "By part of the day: {list}.": { ar: "حسب فترة اليوم: {list}.", ckb: "بەپێی بەشی ڕۆژ: {list}." },
  "{n} hour(s) of people whose pay is not set are not counted.": {
    ar: "لا تُحسب {n, plural, one {ساعة واحدة} two {ساعتان} few {# ساعات} other {# ساعة}} لأشخاص لم تُحدَّد أجورهم.",
    ckb: "{n} کاتژمێری ئەو کەسانەی کرێیان دیاری نەکراوە ناژمێردرێن.",
  },

  // ------------------------------------------------- what the hours cost, on Reports
  "What the hours cost against sales": {
    ar: "تكلفة الساعات مقابل المبيعات",
    ckb: "تێچووی کاتژمێرەکان بەرامبەر فرۆشتن",
  },
  "The labour target: {pct} of net sales.": {
    ar: "هدف أجور العمل: {pct} من صافي المبيعات.",
    ckb: "ئامانجی کرێی کار: {pct} لە فرۆشتنی پاک.",
  },
  "No labour target is set: set one on Settings → Rules.": {
    ar: "لم يُحدَّد هدف لأجور العمل: حدِّده في «الإعدادات» ← «القواعد».",
    ckb: "هیچ ئامانجێک بۆ کرێی کار دانەنراوە: لە «ڕێکخستنەکان» ← «یاساکان» دایبنێ.",
  },
  "Hours on the clock": { ar: "ساعات الحضور", ckb: "کاتژمێرەکانی ئامادەبوون" },
  "What they cost": { ar: "تكلفتها", ckb: "تێچووەکەیان" },
  "Share of sales": { ar: "حصتها من المبيعات", ckb: "بەشی لە فرۆشتن" },
  "Part of the day": { ar: "فترة اليوم", ckb: "بەشی ڕۆژ" },
  "Each person's hours on the clock at an hour of their pay: an hourly rate as it is, a day's pay over its hours, a month's over 30 days of them; overtime is not added. Morning is from five to noon, afternoon to five, evening from five until five in the morning.":
    {
      ar: "ساعات حضور كل شخص بأجر ساعة من أجره: الأجر بالساعة كما هو، وأجر اليوم مقسومًا على ساعاته، وأجر الشهر على 30 يومًا منها؛ ولا يُضاف العمل الإضافي. الصباح من الخامسة إلى الظهر، وبعد الظهر حتى الخامسة، والمساء من الخامسة حتى الخامسة صباحًا.",
      ckb: "کاتژمێرەکانی ئامادەبوونی هەر کەسێک بە کرێی کاتژمێرێکی: کرێی کاتژمێر وەک خۆی، کرێی ڕۆژێک دابەشی کاتژمێرەکانی، کرێی مانگێک دابەشی 30 ڕۆژیان؛ کاتی زیادە ناخرێتە سەر. بەیانی لە پێنجەوە تا نیوەڕۆ، دوای نیوەڕۆ تا پێنج، ئێوارە لە پێنجەوە تا پێنجی بەیانی.",
    },

  // ------------------------------------------------- the rule, on Settings → Rules
  "Labour cost the café aims for (% of net sales)": {
    ar: "أجور العمل التي يستهدفها المقهى (% من صافي المبيعات)",
    ckb: "ئەو کرێی کارەی کافێکە بە ئامانجی دەگرێت (% ی فرۆشتنی پاک)",
  },
  "The share of net sales the café means to pay its people. Staff checks the week's schedule against it, and Reports → Staffed when busy? shows each week's and each part of the day's, from the hours on the clock at each person's pay. Only those who see pay see it. 0 is no target.":
    {
      ar: "حصة صافي المبيعات التي ينوي المقهى دفعها لعامليه. تفحص شاشة «الموظفون» جدول الأسبوع مقابلها، وتعرض «التقارير» ← «هل يكفي العاملون وقت الزحام؟» حصة كل أسبوع وكل فترة من اليوم، من ساعات الحضور بأجر كل شخص. لا يراها إلا من يرى الأجور. 0 يعني بلا هدف.",
      ckb: "ئەو بەشەی فرۆشتنی پاک کە کافێکە دەیەوێت بە کارمەندانی بدات. شاشەی «کارمەندان» خشتەی هەفتەکە بەرامبەری دەپشکنێت، و «ڕاپۆرتەکان» ← «ئایا کارمەند بەسە لە کاتی قەرەباڵغیدا؟» بەشی هەر هەفتەیەک و هەر بەشێکی ڕۆژ پیشان دەدات، لە کاتژمێرەکانی ئامادەبوون بە کرێی هەر کەسێک. تەنها ئەوانەی کرێ دەبینن دەیبینن. 0 واتە بێ ئامانج.",
    },
};

export default phrases;
