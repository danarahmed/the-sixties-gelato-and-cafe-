import type { PhraseBook } from "./types";

/**
 * Round ten, the owner's answer on waste (0070): the day's plan learns from
 * what was thrown away and what sold out; What to buy looks at the days
 * ahead, today's plan and how long an item keeps; and a week's waste on
 * Reports → Waste.
 */
const phrases: PhraseBook = {
  // ------------------------------------------------- the day's plan learns
  "Sold out {n} of the last {weeks} weeks: makes {qty} more": {
    ar: "نفد في {n} من آخر {weeks} أسابيع: يُصنع {qty} أكثر",
    ckb: "لە {n} لە دوایین {weeks} هەفتەدا تەواو بوو: {qty} زیاتر دروست دەکرێت",
  },
  "Thrown away {n} of the last {weeks} weeks, about {avg} a time: makes {qty} less": {
    ar: "أُتلف منه في {n} من آخر {weeks} أسابيع، نحو {avg} كل مرة: يُصنع {qty} أقل",
    ckb: "لە {n} لە دوایین {weeks} هەفتەدا فڕێدرا، نزیکەی {avg} هەر جارێک: {qty} کەمتر دروست دەکرێت",
  },
  "It makes more of what sold out on half those days or more and was never thrown away, and less of what was thrown away on half of them or more and never sold out, never below one batch.":
    {
      ar: "ويصنع أكثر مما نفد في نصف تلك الأيام أو أكثر ولم يُتلف منه شيء، وأقل مما أُتلف منه في نصفها أو أكثر ولم ينفد قط، دون أن ينزل عن دفعة واحدة.",
      ckb: "زیاتر لەوە دروست دەکات کە لە نیوەی ئەو ڕۆژانە یان زیاتر تەواو بوو و هەرگیز فڕێ نەدرا، و کەمتر لەوەی لە نیوەیان یان زیاتر فڕێدرا و هەرگیز تەواو نەبوو، بەڵام هەرگیز لە یەک دەستە کەمتر نا.",
    },

  // ------------------------------------------------- What to buy looks ahead
  "With what today's plan needs beyond what its weekday's batches use: {qty}.": {
    ar: "مع ما تحتاجه خطة اليوم فوق ما تستهلكه دفعات هذا اليوم من الأسبوع عادةً: {qty}.",
    ckb: "لەگەڵ ئەوەی پلانی ئەمڕۆ پێویستیەتی زیاتر لەوەی دەستەکانی ئەم ڕۆژەی هەفتە بەکاری دەهێنن: {qty}.",
  },
  "Not used here yet, but today's plan needs {qty}: {level} is its reorder level.": {
    ar: "لم يُستعمل هنا بعد، لكن خطة اليوم تحتاج {qty}: {level} هو حدّ إعادة الطلب.",
    ckb: "هێشتا لێرە بەکار نەهاتووە، بەڵام پلانی ئەمڕۆ پێویستی بە {qty} هەیە: {level} ئاستی داواکردنەوەکەیەتی.",
  },
  "Each day judged by its weekday over the last 4 weeks: until a delivery comes, in {lead} day(s), and a day more, it uses about {use}: {level} is its reorder level.":
    {
      ar: "يُحكم على كل يوم بيومه من الأسبوع خلال آخر 4 أسابيع: حتى يصل التوريد، بعد {lead} يوم، ويومًا إضافيًا، يُستهلك نحو {use}: {level} هو حدّ إعادة الطلب.",
      ckb: "هەر ڕۆژێک بە ڕۆژی هەفتەکەی لە دوایین 4 هەفتەدا هەڵدەسەنگێنرێت: تا بار دەگات، لە ماوەی {lead} ڕۆژدا، و ڕۆژێکی زیاتر، نزیکەی {use} بەکار دێت: {level} ئاستی داواکردنەوەکەیەتی.",
    },
  "{qty} thrown away unsold in the last {days} days is not counted as use.": {
    ar: "{qty} أُتلفت دون بيع خلال آخر {days} يومًا لا تُحسب استهلاكًا.",
    ckb: "{qty} کە بێ فرۆشتن لە دوایین {days} ڕۆژدا فڕێدرا وەک بەکارهێنان ناژمێردرێت.",
  },
  "It keeps {n} day(s): ordered up to no more than they use, {target}.": {
    ar: "يبقى صالحًا {n} يوم: يُطلب حتى ما لا يزيد عمّا تستهلكه، {target}.",
    ckb: "{n} ڕۆژ دەمێنێتەوە: تا ئەوەندە داوا دەکرێت کە لەو ڕۆژانەدا بەکار دێت، نەک زیاتر، {target}.",
  },
  "It keeps {n} day(s), but must last until the next delivery: ordered up to its reorder level, {target}.":
    {
      ar: "يبقى صالحًا {n} يوم، لكن عليه أن يكفي حتى التوريد التالي: يُطلب حتى حدّ إعادة الطلب، {target}.",
      ckb: "{n} ڕۆژ دەمێنێتەوە، بەڵام دەبێت تا باری داهاتوو بەس بێت: تا ئاستی داواکردنەوەکەی داوا دەکرێت، {target}.",
    },
  "{packs} × {pack} ({qty}), in whole packs.": {
    ar: "{packs} × {pack} ({qty})، بعبوات كاملة.",
    ckb: "{packs} × {pack} ({qty})، بە پاکەتی تەواو.",
  },
  "Days it keeps once it comes": {
    ar: "كم يومًا يبقى صالحًا بعد وصوله",
    ckb: "چەند ڕۆژ دەمێنێتەوە دوای گەیشتنی",
  },
  "What was thrown away is not counted as use. With four weeks behind an item, each day until a delivery is judged by its weekday, and what today's plan needs is added. An item that keeps only a few days (say how many under How it was worked out) is ordered up to no more than those days use.":
    {
      ar: "ما أُتلف لا يُحسب استهلاكًا. ومع أربعة أسابيع من السجل، يُحكم على كل يوم حتى التوريد بيومه من الأسبوع، ويُضاف ما تحتاجه خطة اليوم. والمادة التي لا تبقى صالحة إلا أيامًا قليلة (اذكر عددها تحت «كيف حُسب ذلك») تُطلب حتى ما لا يزيد عمّا تستهلكه تلك الأيام.",
      ckb: "ئەوەی فڕێدرا وەک بەکارهێنان ناژمێردرێت. کاتێک چوار هەفتە مێژووی کاڵایەک هەبێت، هەر ڕۆژێک تا گەیشتنی بار بە ڕۆژی هەفتەکەی هەڵدەسەنگێنرێت، و ئەوەی پلانی ئەمڕۆ پێویستیەتی زیاد دەکرێت. کاڵایەک کە تەنها چەند ڕۆژێک دەمێنێتەوە (ژمارەکەی لە ژێر «چۆن هەژمار کرا» بنووسە) تا ئەوەندە داوا دەکرێت کە ئەو ڕۆژانە بەکاری دەهێنن، نەک زیاتر.",
    },
};

export default phrases;
