import type { PhraseBook } from "./types";

/**
 * Settings → Languages (0032): the café's languages, a language added, and
 * its own words for phrases; what its actions and the database answer.
 */
const phrases: PhraseBook = {
  // The screen.
  Languages: { ar: "اللغات", ckb: "زمانەکان" },
  "Every screen is in English, Arabic and Kurdish. Add another language here, and give any phrase the café's own words: a whole new language, or a better word for the Arabic or Kurdish. A phrase with no words in a language shows its English.":
    {
      ar: "كل شاشة متاحة بالإنجليزية والعربية والكردية. أضف هنا لغة أخرى، وأعطِ أي عبارة كلمات المقهى الخاصة: لغة جديدة كاملة، أو كلمة أفضل للعربية أو الكردية. العبارة التي لا كلمات لها في لغة ما تظهر بالإنجليزية.",
      ckb: "هەموو شاشەیەک بە ئینگلیزی و عەرەبی و کوردییە. لێرە زمانێکی تر زیاد بکە، و بە هەر دەستەواژەیەک وشەی تایبەتی کافێکە بدە: زمانێکی نوێی تەواو، یان وشەیەکی باشتر بۆ عەرەبی یان کوردی. دەستەواژەیەک کە لە زمانێکدا وشەی نەبێت، بە ئینگلیزی پیشان دەدرێت.",
    },
  "The café's languages": { ar: "لغات المقهى", ckb: "زمانەکانی کافێکە" },
  Language: { ar: "اللغة", ckb: "زمان" },
  Code: { ar: "الرمز", ckb: "کۆد" },
  Written: { ar: "اتجاه الكتابة", ckb: "ئاراستەی نووسین" },
  "The café's own words": { ar: "كلمات المقهى الخاصة", ckb: "وشە تایبەتەکانی کافێکە" },
  "{language} is saved.": { ar: "حُفظت {language}.", ckb: "{language} پاشەکەوت کرا." },
  "{language} is out of use: it leaves the language menu, and its words are kept.": {
    ar: "أُوقف استخدام {language}: تخرج من قائمة اللغات، وتبقى كلماتها محفوظة.",
    ckb: "{language} لە بەکارهێنان لابرا: لە لیستی زمانەکان دەردەچێت، و وشەکانی دەمێننەوە.",
  },
  "Take out of use": { ar: "إيقاف الاستخدام", ckb: "لە بەکارهێنان لابردن" },
  "Bring back": { ar: "إعادة الاستخدام", ckb: "گەڕاندنەوە" },
  "Name, as its speakers write it": {
    ar: "الاسم كما يكتبه متحدثوها",
    ckb: "ناو، وەک قسەکەرانی دەینووسن",
  },
  "Left to right": { ar: "من اليسار إلى اليمين", ckb: "لە چەپەوە بۆ ڕاست" },
  "Right to left": { ar: "من اليمين إلى اليسار", ckb: "لە ڕاستەوە بۆ چەپ" },
  "Built in": { ar: "مضمّنة", ckb: "بنەڕەتی" },
  "In use": { ar: "قيد الاستخدام", ckb: "لە بەکارهێناندایە" },
  "Not in use": { ar: "غير مستخدمة", ckb: "بەکارنایەت" },
  "{language} is added: it is in the language menu now. Give its words below; a phrase with none shows in English.":
    {
      ar: "أُضيفت {language}: صارت في قائمة اللغات الآن. أعطِ كلماتها أدناه؛ والعبارة التي لا كلمات لها تظهر بالإنجليزية.",
      ckb: "{language} زیاد کرا: ئێستا لە لیستی زمانەکاندایە. وشەکانی لە خوارەوە بدە؛ دەستەواژەیەک کە وشەی نەبێت بە ئینگلیزی پیشان دەدرێت.",
    },
  "Add a language": { ar: "إضافة لغة", ckb: "زیادکردنی زمانێک" },
  "The code is the language's short international name: tr for Turkish, fa for Persian, kmr for Kurmanji Kurdish.":
    {
      ar: "الرمز هو الاسم الدولي المختصر للغة: tr للتركية، وfa للفارسية، وkmr للكردية الكرمانجية.",
      ckb: "کۆد ناوی نێودەوڵەتیی کورتی زمانەکەیە: tr بۆ تورکی، fa بۆ فارسی، kmr بۆ کوردیی کورمانجی.",
    },
  "Add the language": { ar: "أضف اللغة", ckb: "زمانەکە زیاد بکە" },
  "Saved: {set} phrase(s) with new words, {cleared} back to the built-in words.": {
    ar: "تم الحفظ: {set} من العبارات بكلمات جديدة، و{cleared} عادت إلى الكلمات المضمّنة.",
    ckb: "پاشەکەوت کرا: {set} دەستەواژە بە وشەی نوێ، {cleared} گەڕانەوە بۆ وشە بنەڕەتییەکان.",
  },
  "The file needs a key column and a words column, as the downloaded file has.": {
    ar: "يحتاج الملف إلى عمود key وعمود words، كما في الملف الذي نُزّل.",
    ckb: "فایلەکە پێویستی بە ستوونی key و ستوونی words هەیە، وەک ئەو فایلەی دابەزێنرا.",
  },
  "Read {n} phrase(s) with new words from the file. Check them, then save.": {
    ar: "قُرئت {n} من العبارات بكلمات جديدة من الملف. راجعها ثم احفظ.",
    ckb: "{n} دەستەواژە بە وشەی نوێ لە فایلەکە خوێنرانەوە. بیانپشکنە، پاشان پاشەکەوتیان بکە.",
  },
  "Words in {language}": { ar: "الكلمات في {language}", ckb: "وشەکان بە {language}" },
  "The English is each phrase itself; words given here are shown instead of it, to every reader in English.":
    {
      ar: "الإنجليزية هي العبارة نفسها؛ والكلمات التي تُعطى هنا تظهر بدلًا منها لكل قارئ بالإنجليزية.",
      ckb: "ئینگلیزییەکە خودی دەستەواژەکەیە؛ ئەو وشانەی لێرە دەدرێن لە جیاتی ئەو بۆ هەموو خوێنەرێکی ئینگلیزی پیشان دەدرێن.",
    },
  "{language} is built in: {own} phrase(s) have the café's own words instead of the built-in ones.":
    {
      ar: "{language} مضمّنة: {own} من العبارات لها كلمات المقهى الخاصة بدلًا من المضمّنة.",
      ckb: "{language} بنەڕەتییە: {own} دەستەواژە وشەی تایبەتی کافێکەیان هەیە لە جیاتی وشە بنەڕەتییەکان.",
    },
  "{done} of {total} phrases have words in {language}; the rest show in English.": {
    ar: "{done} من {total} عبارة لها كلمات في {language}؛ والباقي يظهر بالإنجليزية.",
    ckb: "{done} لە {total} دەستەواژە وشەیان بە {language} هەیە؛ ئەوانی تر بە ئینگلیزی پیشان دەدرێن.",
  },
  "The English, or the words": { ar: "الإنجليزية أو الكلمات", ckb: "ئینگلیزییەکە، یان وشەکان" },
  "Every phrase": { ar: "كل العبارات", ckb: "هەموو دەستەواژەکان" },
  "Phrases with no words yet": { ar: "عبارات بلا كلمات بعد", ckb: "دەستەواژەی هێشتا بێ وشە" },
  "Upload CSV": { ar: "رفع ملف CSV", ckb: "بارکردنی CSV" },
  "Save {n} change(s)": { ar: "حفظ التغييرات ({n})", ckb: "پاشەکەوتکردنی گۆڕانکارییەکان ({n})" },
  English: { ar: "الإنجليزية", ckb: "ئینگلیزی" },
  "The café's words": { ar: "كلمات المقهى", ckb: "وشەکانی کافێکە" },
  "Words for: {phrase}": { ar: "الكلمات لـ: {phrase}", ckb: "وشەکان بۆ: {phrase}" },
  Previous: { ar: "السابق", ckb: "پێشوو" },
  "Page {page} of {pages} · {n} phrase(s)": {
    ar: "الصفحة {page} من {pages} · العبارات: {n}",
    ckb: "لاپەڕەی {page} لە {pages} · {n} دەستەواژە",
  },
  Next: { ar: "التالي", ckb: "دواتر" },

  // What its actions answer.
  "A language's code is two or three small Latin letters (tr, fa, kmr)": {
    ar: "رمز اللغة حرفان أو ثلاثة أحرف لاتينية صغيرة (tr، fa، kmr)",
    ckb: "کۆدی زمان دوو یان سێ پیتی بچووکی لاتینییە (tr، fa، kmr)",
  },
  "The language's name": { ar: "اسم اللغة", ckb: "ناوی زمانەکە" },
  "Choose which way it is written": {
    ar: "اختر اتجاه كتابتها",
    ckb: "ئاراستەی نووسینەکەی هەڵبژێرە",
  },
  "Choose the language": { ar: "اختر اللغة", ckb: "زمانەکە هەڵبژێرە" },
  'The English of "{1}" has no {…}: leave them out of its words': {
    ar: 'ليس في إنجليزية "{1}" أي {…}: احذفها من كلماتها',
    ckb: 'ئینگلیزیی "{1}" هیچ {…}ـێکی نییە: لە وشەکانی لایان بدە',
  },
  'Keep the marks <…> of the English in the words for "{1}"': {
    ar: 'أبقِ علامات <…> الموجودة في الإنجليزية ضمن كلمات "{1}"',
    ckb: 'نیشانەکانی <…>ی ئینگلیزییەکە لە وشەکانی "{1}"دا بهێڵەرەوە',
  },

  // What the database answers (0032).
  "A language's code is two or three small Latin letters, as the world writes it (tr, fa, kmr), with a region after a dash if needed (pt-br)":
    {
      ar: "رمز اللغة حرفان أو ثلاثة أحرف لاتينية صغيرة كما يكتبه العالم (tr، fa، kmr)، مع المنطقة بعد شرطة عند الحاجة (pt-br)",
      ckb: "کۆدی زمان دوو یان سێ پیتی بچووکی لاتینییە وەک جیهان دەینووسێت (tr، fa، kmr)، ئەگەر پێویست بوو ناوچەیەک دوای هێڵێک (pt-br)",
    },
  "English, Arabic and Kurdish are built in: correct their words instead of adding them": {
    ar: "الإنجليزية والعربية والكردية مضمّنة: صحّح كلماتها بدلًا من إضافتها",
    ckb: "ئینگلیزی و عەرەبی و کوردی بنەڕەتین: لە جیاتی زیادکردنیان وشەکانیان ڕاست بکەرەوە",
  },
  "Name the language as its speakers write it, in up to 40 letters (Türkçe, فارسی)": {
    ar: "سمِّ اللغة كما يكتبها متحدثوها، في 40 حرفًا على الأكثر (Türkçe، فارسی)",
    ckb: "ناوی زمانەکە وەک قسەکەرانی دەینووسن بنووسە، تا 40 پیت (Türkçe، فارسی)",
  },
  "A language is written left to right (ltr) or right to left (rtl)": {
    ar: "تُكتب اللغة من اليسار إلى اليمين (ltr) أو من اليمين إلى اليسار (rtl)",
    ckb: "زمان لە چەپەوە بۆ ڕاست (ltr) یان لە ڕاستەوە بۆ چەپ (rtl) دەنووسرێت",
  },
  "Add the language on Settings → Languages first": {
    ar: "أضف اللغة أولًا من الإعدادات ← اللغات",
    ckb: "سەرەتا زمانەکە لە ڕێکخستنەکان ← زمانەکان زیاد بکە",
  },
  'Give the words as {"phrase": "words"}': {
    ar: 'أعطِ الكلمات بالشكل {"phrase": "words"}',
    ckb: 'وشەکان بەم شێوەیە بدە {"phrase": "words"}',
  },
  "Give at most 5000 phrases at a time": {
    ar: "أعطِ 5000 عبارة على الأكثر في المرة الواحدة",
    ckb: "لە یەک جاردا لانیزۆر 5000 دەستەواژە بدە",
  },
  "A phrase is 1 to 2000 letters": {
    ar: "العبارة من 1 إلى 2000 حرف",
    ckb: "دەستەواژە لە 1 تا 2000 پیتە",
  },
  'Give the words for "{1}" as text': {
    ar: 'أعطِ كلمات "{1}" نصًّا',
    ckb: 'وشەکانی "{1}" وەک دەق بدە',
  },
  'The words for "{1}" are too long: 4000 letters at most': {
    ar: 'كلمات "{1}" طويلة جدًا: 4000 حرف على الأكثر',
    ckb: 'وشەکانی "{1}" زۆر درێژن: لانیزۆر 4000 پیت',
  },
  'Keep {1} in the words for "{2}", as the English has them': {
    ar: 'أبقِ {1} في كلمات "{2}" كما في الإنجليزية',
    ckb: '{1} لە وشەکانی "{2}"دا بهێڵەرەوە، وەک ئینگلیزییەکە هەیەتی',
  },
};

export default phrases;
