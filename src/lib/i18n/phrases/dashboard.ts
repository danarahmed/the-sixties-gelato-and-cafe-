import type { PhraseBook } from "./types";

/**
 * The dashboard: the greeting, each figure against a usual day of its kind,
 * what the figures say and what to do about it, and the charts' words.
 */
const phrases: PhraseBook = {
  "Good morning, {name}": { ar: "صباح الخير، {name}", ckb: "بەیانیت باش، {name}" },
  "Good afternoon, {name}": { ar: "طاب يومك، {name}", ckb: "ڕۆژت باش، {name}" },
  "Good evening, {name}": { ar: "مساء الخير، {name}", ckb: "ئێوارەت باش، {name}" },

  // Needs you: red alerts of one rule past the first two, under one row.
  "{rule}: {n} more": { ar: "{rule}: {n} أخرى", ckb: "{rule}: {n}ی تر" },

  // Under each figure: today against a usual day of its kind by this time.
  "{pct}% above usual by {time}": {
    ar: "أعلى من المعتاد بـ{pct}% حتى {time}",
    ckb: "{pct}% زیاتر لە ئاسایی تا {time}",
  },
  "{pct}% below usual by {time}": {
    ar: "أقل من المعتاد بـ{pct}% حتى {time}",
    ckb: "{pct}% کەمتر لە ئاسایی تا {time}",
  },
  "As usual by {time}": { ar: "كالمعتاد حتى {time}", ckb: "وەک ئاسایی تا {time}" },
  "{pct}% of net sales": { ar: "{pct}% من صافي المبيعات", ckb: "{pct}%ی فرۆشی پوخت" },

  // What the figures say.
  "What the figures say": { ar: "ما تقوله الأرقام", ckb: "ژمارەکان چی دەڵێن" },
  "No sales yet today.": { ar: "لا مبيعات بعد اليوم.", ckb: "ئەمڕۆ هێشتا هیچ نەفرۆشراوە." },
  "No {weekday} before today to compare with yet.": {
    ar: "لا يوجد يوم {weekday} سابق للمقارنة به بعد.",
    ckb: "هێشتا هیچ ڕۆژێکی {weekday}ی پێشوو نییە بۆ بەراوردکردن.",
  },
  "Sales are {pct}% above a usual {weekday} by {time}.": {
    ar: "المبيعات أعلى بـ{pct}% من يوم {weekday} المعتاد حتى {time}.",
    ckb: "فرۆشتن {pct}% زیاترە لە ڕۆژی {weekday}ی ئاسایی تا {time}.",
  },
  "Sales are {pct}% below a usual {weekday} by {time}.": {
    ar: "المبيعات أقل بـ{pct}% من يوم {weekday} المعتاد حتى {time}.",
    ckb: "فرۆشتن {pct}% کەمترە لە ڕۆژی {weekday}ی ئاسایی تا {time}.",
  },
  "Sales are about as on a usual {weekday} by {time}.": {
    ar: "المبيعات قريبة من يوم {weekday} المعتاد حتى {time}.",
    ckb: "فرۆشتن نزیکەی وەک ڕۆژی {weekday}ی ئاساییە تا {time}.",
  },
  "{today} so far; {usual} by then on average, over the {n} before.": {
    ar: "{today} حتى الآن؛ و{usual} حتى ذلك الوقت في المتوسط، خلال الأيام الـ{n} السابقة.",
    ckb: "{today} تا ئێستا؛ {usual} تا ئەو کاتە بە تێکڕا، لە {n} ڕۆژی پێشوودا.",
  },
  "A usual {weekday} is busiest from {from} to {to}: have the most hands on then.": {
    ar: "يكون يوم {weekday} المعتاد في أشد ازدحامه من {from} إلى {to}: ليكن أكثر العاملين حاضرين حينها.",
    ckb: "ڕۆژی {weekday}ی ئاسایی لە {from} تا {to} قەرەباڵغترینە: ئەو کاتە زۆرترین کارمەند ئامادە بکە.",
  },
  "{product} brought in the most over the last 7 days: {net}.": {
    ar: "{product} جلب أكبر دخل خلال آخر 7 أيام: {net}.",
    ckb: "{product} لە 7 ڕۆژی ڕابردوودا زۆرترین داهاتی هێنا: {net}.",
  },
  "{product} brought in the most over the last 7 days: {net}, keeping {kept}% after what it uses.":
    {
      ar: "{product} جلب أكبر دخل خلال آخر 7 أيام: {net}، ويبقى منه {kept}% بعد كلفة ما يستخدمه.",
      ckb: "{product} لە 7 ڕۆژی ڕابردوودا زۆرترین داهاتی هێنا: {net}، و {kept}%ی دەمێنێتەوە دوای تێچووی ئەوەی بەکاری دەهێنێت.",
    },
  "{product} keeps only {kept}% of what it sells for: look at its recipe's cost, or its price.": {
    ar: "{product} لا يُبقي إلا {kept}% مما يُباع به: راجع كلفة وصفته أو سعره.",
    ckb: "{product} تەنها {kept}%ی ئەوەی پێی دەفرۆشرێت دەمێنێتەوە: سەیری تێچووی ڕەسەتەکەی یان نرخەکەی بکە.",
  },
  "{n} item(s) at or below their reorder level: see what to buy.": {
    ar: "{n} من المواد عند حدّ إعادة الطلب أو دونه: انظر ما يجب شراؤه.",
    ckb: "{n} کاڵا لە ئاستی داواکردنەوە یان لە خوارییەوەن: سەیری ئەوە بکە کە دەبێت بکڕدرێت.",
  },
  "Every item is above its reorder level.": {
    ar: "كل المواد فوق حدّ إعادة الطلب.",
    ckb: "هەموو کاڵاکان لە سەرووی ئاستی داواکردنەوەن.",
  },

  // The charts.
  "Sales, the last 14 days": { ar: "المبيعات، آخر 14 يومًا", ckb: "فرۆشتن، 14 ڕۆژی ڕابردوو" },
  "Average: {amount} a day": {
    ar: "المتوسط: {amount} في اليوم",
    ckb: "تێکڕا: {amount} لە ڕۆژێکدا",
  },
  "Today, hour by hour": { ar: "اليوم، ساعة بساعة", ckb: "ئەمڕۆ، کاتژمێر بە کاتژمێر" },
  "A usual {weekday}": { ar: "يوم {weekday} المعتاد", ckb: "ڕۆژی {weekday}ی ئاسایی" },
  "What sells, the last 7 days": {
    ar: "ما يُباع، آخر 7 أيام",
    ckb: "ئەوەی دەفرۆشرێت، 7 ڕۆژی ڕابردوو",
  },
  "{n} sold · not costed yet": {
    ar: "بيع {n} · بلا كلفة بعد",
    ckb: "{n} فرۆشرا · هێشتا تێچووی نییە",
  },
  "{n} sold · {kept}% kept": {
    ar: "بيع {n} · يبقى {kept}%",
    ckb: "{n} فرۆشرا · {kept}% دەمێنێتەوە",
  },
  "Show as a table": { ar: "اعرضه جدولًا", ckb: "وەک خشتە پیشانی بدە" },
};

export default phrases;
