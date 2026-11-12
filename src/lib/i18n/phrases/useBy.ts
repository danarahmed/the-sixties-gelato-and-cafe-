import type { PhraseBook } from "./types";

/**
 * Use-by for everything that goes off (0098): how an item keeps, the use-by
 * on each delivery, recipes that keep or don't go off, the lists on Today
 * and Inventory, the till's marks, the café's rules, and what the database
 * says about them.
 */
const phrases: PhraseBook = {
  // How an item keeps.
  "How it keeps": { ar: "كيف يُحفظ", ckb: "چۆن دەمێنێتەوە" },
  "It doesn't go off": { ar: "لا تنتهي صلاحيته", ckb: "بەسەرناچێت" },
  "Cups, sugar, bottles: no use-by.": {
    ar: "الأكواب والسكر والقناني: بلا موعد استعمال.",
    ckb: "کوپ و شەکر و بوتڵ: کاتی بەکارهێنانیان نییە.",
  },
  "It keeps some days from delivery": {
    ar: "يُحفظ أيامًا من يوم التوريد",
    ckb: "چەند ڕۆژێک لە ڕۆژی گەیاندنەوە دەمێنێتەوە",
  },
  "Each delivery is used by that many days after it comes.": {
    ar: "كل توريد يُستعمل خلال هذا العدد من الأيام بعد وصوله.",
    ckb: "هەر بارێک تا ئەو ژمارە ڕۆژەی دوای گەیشتنی بەکاردەهێنرێت.",
  },
  "Each delivery has its own date": {
    ar: "لكل توريد تاريخه الخاص",
    ckb: "هەر بارێک ڕێکەوتی خۆی هەیە",
  },
  "Whoever receives it types the date printed on the pack.": {
    ar: "من يستلمه يكتب التاريخ المطبوع على العبوة.",
    ckb: "ئەوەی وەریدەگرێت ئەو ڕێکەوتە دەنووسێت کە لەسەر پاکەتەکە چاپکراوە.",
  },
  "Made here in batches: each batch's use-by comes from its recipe.": {
    ar: "يُصنع هنا على دفعات: موعد استعمال كل دفعة من وصفتها.",
    ckb: "لێرە بە دەستە دروست دەکرێت: کاتی بەکارهێنانی هەر دەستەیەک لە ڕەچەتەکەیەوە دێت.",
  },
  "Not chosen yet: choose how it keeps, so its deliveries carry a use-by.": {
    ar: "لم يُختر بعد: اختر كيف يُحفظ، لتحمل توريداته موعد استعمال.",
    ckb: "هێشتا هەڵنەبژێردراوە: هەڵبژێرە چۆن دەمێنێتەوە، تا بارەکانی کاتی بەکارهێنانیان هەبێت.",
  },
  "Say how many days it keeps from delivery: 1 to 365": {
    ar: "قل كم يومًا يُحفظ من يوم التوريد: من 1 إلى 365",
    ckb: "بڵێ چەند ڕۆژ لە ڕۆژی گەیاندنەوە دەمێنێتەوە: ١ تا ٣٦٥",
  },
  "Choose how it keeps: it doesn't go off, it keeps some days from delivery, or each delivery has its date":
    {
      ar: "اختر كيف يُحفظ: لا تنتهي صلاحيته، أو يُحفظ أيامًا من التوريد، أو لكل توريد تاريخه",
      ckb: "هەڵبژێرە چۆن دەمێنێتەوە: بەسەرناچێت، یان چەند ڕۆژێک لە گەیاندنەوە دەمێنێتەوە، یان هەر بارێک ڕێکەوتی خۆی هەیە",
    },
  "Choose how it keeps": { ar: "اختر كيف يُحفظ", ckb: "هەڵبژێرە چۆن دەمێنێتەوە" },

  // A recipe keeps a while, or doesn't go off.
  "Say how long what it makes keeps, or that it doesn't go off": {
    ar: "قل كم يُحفظ ما تصنعه، أو أنه لا تنتهي صلاحيته",
    ckb: "بڵێ ئەوەی دروستی دەکات چەند دەمێنێتەوە، یان کە بەسەرناچێت",
  },
  "Say how long what it makes keeps, or tick “It doesn't go off”.": {
    ar: "قل كم يُحفظ ما تصنعه، أو أشِّر على «لا تنتهي صلاحيته».",
    ckb: "بڵێ ئەوەی دروستی دەکات چەند دەمێنێتەوە، یان «بەسەرناچێت» نیشانە بکە.",
  },
  "— each batch is to be used by then, from when it is made. One or the other.": {
    ar: "— تُستعمل كل دفعة قبل ذلك، من وقت صنعها. أحدهما لا غير.",
    ckb: "— هەر دەستەیەک تا ئەو کاتە لە کاتی دروستکردنییەوە بەکاردەهێنرێت. یەکێکیان.",
  },

  // A delivery's use-by.
  "Type the use-by printed on the pack of {name}": {
    ar: "اكتب موعد الاستعمال المطبوع على عبوة {name}",
    ckb: "کاتی بەکارهێنانی چاپکراو لەسەر پاکەتی {name} بنووسە",
  },
  "Type the use-by printed on the pack of {1}": {
    ar: "اكتب موعد الاستعمال المطبوع على عبوة {1}",
    ckb: "کاتی بەکارهێنانی چاپکراو لەسەر پاکەتی {1} بنووسە",
  },
  "{name} is already past its use-by: send it back rather than receive it": {
    ar: "{name} تجاوز موعد استعماله: أعِده بدل أن تستلمه",
    ckb: "کاتی بەکارهێنانی {name} بەسەرچووە: بیگەڕێنەوە لە جیاتی وەرگرتنی",
  },
  "{1} is already past its use-by ({2}): send it back rather than receive it": {
    ar: "{1} تجاوز موعد استعماله ({2}): أعِده بدل أن تستلمه",
    ckb: "کاتی بەکارهێنانی {1} بەسەرچووە ({2}): بیگەڕێنەوە لە جیاتی وەرگرتنی",
  },
  "Use by (on the pack)": { ar: "يُستعمل قبل (على العبوة)", ckb: "بەکاربهێنرێت پێش (لەسەر پاکەت)" },
  "Use by (from its {n} days)": {
    ar: "يُستعمل قبل (من أيامه الـ{n})",
    ckb: "بەکاربهێنرێت پێش (لە {n} ڕۆژەکەیەوە)",
  },
  "Give the use-by as a date": {
    ar: "أعطِ موعد الاستعمال تاريخًا",
    ckb: "کاتی بەکارهێنان وەک ڕێکەوتێک بنووسە",
  },
  "Kept delivery by delivery from now, each with its use-by": {
    ar: "يُحفظ من الآن توريدًا توريدًا، كلٌّ بموعد استعماله",
    ckb: "لە ئێستاوە بار بە بار هەڵدەگیرێت، هەریەکەیان بە کاتی بەکارهێنانی خۆی",
  },

  // A lot's use-by changed.
  "Use-by": { ar: "موعد الاستعمال", ckb: "کاتی بەکارهێنان" },
  "What is here with a use-by, the nearest first: sales take it in this order.": {
    ar: "ما هنا وله موعد استعمال، الأقرب أولًا: البيع يأخذ منه بهذا الترتيب.",
    ckb: "ئەوەی لێرەیە و کاتی بەکارهێنانی هەیە، نزیکترین یەکەم: فرۆشتن بەم ڕیزبەندییە لێی دەبات.",
  },
  "Nothing here has a use-by yet.": {
    ar: "لا شيء هنا له موعد استعمال بعد.",
    ckb: "هێشتا هیچ شتێک لێرە کاتی بەکارهێنانی نییە.",
  },
  "Past its use-by": { ar: "تجاوز موعد استعماله", ckb: "کاتی بەکارهێنانی بەسەرچووە" },
  "Goes off today": { ar: "تنتهي صلاحيته اليوم", ckb: "ئەمڕۆ بەسەردەچێت" },
  "Goes off soon": { ar: "تنتهي صلاحيته قريبًا", ckb: "بەم زووانە بەسەردەچێت" },
  State: { ar: "الحالة", ckb: "دۆخ" },
  "Batch {no}": { ar: "الدفعة {no}", ckb: "دەستەی {no}" },
  "Delivered {day}": { ar: "وصل في {day}", ckb: "گەیشت لە {day}" },
  "Why it changes": { ar: "لماذا يتغيّر", ckb: "بۆچی دەگۆڕێت" },
  "Choose the lot": { ar: "اختر الدفعة", ckb: "بەشەکە هەڵبژێرە" },
  "the lot": { ar: "الدفعة", ckb: "بەشەکە" },
  "Give the new use-by": { ar: "أعطِ موعد الاستعمال الجديد", ckb: "کاتی بەکارهێنانی نوێ بنووسە" },
  "Lot not found": { ar: "الدفعة غير موجودة", ckb: "ئەو بەشە نەدۆزرایەوە" },
  "The use-by is not before the day it came": {
    ar: "موعد الاستعمال ليس قبل يوم وصوله",
    ckb: "کاتی بەکارهێنان ناکەوێتە پێش ڕۆژی گەیشتنی",
  },
  "That is its use-by already": {
    ar: "هذا موعد استعماله أصلًا",
    ckb: "ئەمە پێشتر کاتی بەکارهێنانییەتی",
  },

  // Today.
  "{item}: {qty} {unit}, use by {day}": {
    ar: "{item}: {qty} {unit}، يُستعمل قبل {day}",
    ckb: "{item}: {qty} {unit}، بەکاربهێنرێت پێش {day}",
  },
  "Take these off the shelf: past their use-by": {
    ar: "ارفع هذه عن الرف: تجاوزت موعد استعمالها",
    ckb: "ئەمانە لە ڕەفەکە لابە: کاتی بەکارهێنانیان بەسەرچووە",
  },
  "These go off tonight: sell or use them first": {
    ar: "تنتهي صلاحية هذه الليلة: بِعها أو استعملها أولًا",
    ckb: "ئەمانە ئەمشەو بەسەردەچن: یەکەم جار بیانفرۆشە یان بەکاریان بهێنە",
  },
  "Going off soon": { ar: "تنتهي صلاحيتها قريبًا", ckb: "بەم زووانە بەسەردەچن" },
  "Say how these keep, so their deliveries carry a use-by": {
    ar: "قل كيف تُحفظ هذه، لتحمل توريداتها موعد استعمال",
    ckb: "بڵێ ئەمانە چۆن دەمێننەوە، تا بارەکانیان کاتی بەکارهێنانیان هەبێت",
  },
  "Say how long these recipes keep, or that they don't go off": {
    ar: "قل كم تُحفظ هذه الوصفات، أو أنها لا تنتهي صلاحيتها",
    ckb: "بڵێ ئەم ڕەچەتانە چەند دەمێننەوە، یان کە بەسەرناچن",
  },
  "Open the use-by list": {
    ar: "افتح قائمة مواعيد الاستعمال",
    ckb: "لیستی کاتی بەکارهێنان بکەرەوە",
  },

  // The till.
  "Past use-by": { ar: "منتهي", ckb: "بەسەرچوو" },
  "Sell first": { ar: "بِعه أولًا", ckb: "یەکەم بیفرۆشە" },
  "A manager approves selling what is past its use-by": {
    ar: "يوافق مدير على بيع ما تجاوز موعد استعماله",
    ckb: "بەڕێوەبەرێک ڕەزامەندی لەسەر فرۆشتنی ئەوەی کاتی بەکارهێنانی بەسەرچووە دەدات",
  },
  "{1} is past its use-by: a manager approves selling it": {
    ar: "{1} تجاوز موعد استعماله: يوافق مدير على بيعه",
    ckb: "کاتی بەکارهێنانی {1} بەسەرچووە: بەڕێوەبەرێک ڕەزامەندی لەسەر فرۆشتنی دەدات",
  },

  // The café's rules.
  "Selling stock past its use-by": {
    ar: "بيع المخزون الذي تجاوز موعد استعماله",
    ckb: "فرۆشتنی کۆگای کاتی بەکارهێنان بەسەرچوو",
  },
  "Warn of a use-by this many hours ahead": {
    ar: "التنبيه إلى موعد الاستعمال قبل هذا العدد من الساعات",
    ckb: "ئاگادارکردنەوە لە کاتی بەکارهێنان ئەوەندە کاتژمێر پێشتر",
  },
  "The till marks what is near or past its use-by before anyone chooses it, and Today lists what to take off the shelf. If stock past its use-by is sold all the same: warned of and kept on the audit trail, or refused unless a manager approves with their PIN. Set for a branch, it is that branch's.":
    {
      ar: "تُعلِّم شاشة البيع ما قارب موعد استعماله أو تجاوزه قبل أن يختاره أحد، وتسرد «اليوم» ما يُرفع عن الرف. وإن بيع مخزون تجاوز موعده مع ذلك: يُنبَّه إليه ويبقى في سجل التدقيق، أو يُرفض ما لم يوافق مدير برمزه. وإن حُدِّد لفرع فهو لذلك الفرع.",
      ckb: "کاشێر پێش ئەوەی کەس هەڵیبژێرێت ئەوەی نزیکە یان کاتی بەکارهێنانی بەسەرچووە نیشانە دەکات، و «ئەمڕۆ» لیستی ئەوەی دەبێت لە ڕەفەکە لاببرێت پیشان دەدات. ئەگەر کۆگای بەسەرچوو هەر فرۆشرا: ئاگادار دەکرێتەوە و لە تۆماری چاودێریدا دەمێنێتەوە، یان ڕێگەی پێنادرێت مەگەر بەڕێوەبەرێک بە PINەکەی ڕەزامەندی بدات. ئەگەر بۆ لقێک دانرا، هی ئەو لقەیە.",
    },
  "How long before its use-by a batch or a delivery is warned of: on the dashboard, the phone, Today and the till. 24 is a day ahead.":
    {
      ar: "كم قبل موعد استعمالها يُنبَّه إلى دفعة أو توريد: في لوحة المتابعة والهاتف و«اليوم» وشاشة البيع. 24 تعني قبل يوم.",
      ckb: "چەند پێش کاتی بەکارهێنانی ئاگاداری دەستەیەک یان بارێک دەکرێتەوە: لە داشبۆرد، مۆبایل، «ئەمڕۆ» و کاشێر. ٢٤ واتە یەک ڕۆژ پێشتر.",
    },
  "Sold, with a warning": { ar: "يُباع، مع تنبيه", ckb: "دەفرۆشرێت، لەگەڵ ئاگادارکردنەوە" },
  "Refused, unless a manager approves": {
    ar: "يُرفض، ما لم يوافق مدير",
    ckb: "ڕێگەی پێنادرێت، مەگەر بەڕێوەبەرێک ڕەزامەندی بدات",
  },

  // The alerts, as the database writes them.
  "{1}, delivered {2}, is past its use-by: {3} {4} left": {
    ar: "{1}، الوارد في {2}، تجاوز موعد استعماله: بقي {3} {4}",
    ckb: "{1}، گەیشتوو لە {2}، کاتی بەکارهێنانی بەسەرچووە: {3} {4} ماوە",
  },
  "{1}, delivered {2}, is to be used by {3}: {4} {5} left": {
    ar: "{1}، الوارد في {2}، يُستعمل قبل {3}: بقي {4} {5}",
    ckb: "{1}، گەیشتوو لە {2}، دەبێت پێش {3} بەکاربهێنرێت: {4} {5} ماوە",
  },
  "Sell or use it first: sales take it before newer deliveries.": {
    ar: "بِعه أو استعمله أولًا: البيع يأخذ منه قبل التوريدات الأحدث.",
    ckb: "یەکەم بیفرۆشە یان بەکاری بهێنە: فرۆشتن پێش بارە نوێترەکان لەوە دەبات.",
  },

  // The audit trail.
  "Batch or delivery": { ar: "الدفعة أو التوريد", ckb: "دەستە یان بار" },
  "Keeps (days)": { ar: "مدة الحفظ (أيام)", ckb: "ماوەی مانەوە (ڕۆژ)" },
  "How an item keeps, chosen": {
    ar: "اختيار طريقة حفظ صنف",
    ckb: "هەڵبژاردنی چۆنیەتی مانەوەی کاڵایەک",
  },
  "A delivery's use-by changed": {
    ar: "تغيير موعد استعمال توريد",
    ckb: "گۆڕینی کاتی بەکارهێنانی بارێک",
  },
  "Stock past its use-by sold": {
    ar: "بيع مخزون تجاوز موعد استعماله",
    ckb: "فرۆشتنی کۆگای کاتی بەکارهێنان بەسەرچوو",
  },
};

export default phrases;
