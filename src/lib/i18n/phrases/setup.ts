import type { PhraseBook } from "./types";

/**
 * Round seven: Getting set up, the dashboard's steps for a café starting from
 * nothing, and Paste stock items in, a list from a spreadsheet added in one go.
 */
const phrases: PhraseBook = {
  // ------------------------------------------------------------ Getting set up
  "Getting set up": { ar: "التجهيز للبدء", ckb: "ئامادەکردن بۆ دەستپێکردن" },
  "Add these in order, and the café is ready to sell.": {
    ar: "أضف هذه بالترتيب، ويصبح المقهى جاهزًا للبيع.",
    ckb: "ئەمانە بە ڕیز زیاد بکە، و کافێکە ئامادە دەبێت بۆ فرۆشتن.",
  },
  "{n} added": { ar: "أُضيف {n}", ckb: "{n} زیاد کراوە" },
  "Not needed": { ar: "غير مطلوب", ckb: "پێویست نییە" },
  "Not needed here": { ar: "غير مطلوب هنا", ckb: "لێرە پێویست نییە" },
  "Put back": { ar: "أعِده", ckb: "بیگەڕێنەوە" },
  "Hide this list": { ar: "أخفِ هذه القائمة", ckb: "ئەم لیستە بشارەوە" },
  "The owner or the general manager adds these.": {
    ar: "يضيفها المالك أو المدير العام.",
    ckb: "خاوەن یان بەڕێوەبەری گشتی ئەمانە زیاد دەکات.",
  },
  "{n} without a PIN yet": {
    ar: "{n, plural, one {شخص واحد بلا رمز PIN بعد} two {شخصان بلا رمز PIN بعد} few {# أشخاص بلا رمز PIN بعد} many {# شخصًا بلا رمز PIN بعد} other {# شخص بلا رمز PIN بعد}}",
    ckb: "{n} کەس هێشتا بێ PIN",
  },
  "Stock items": { ar: "مواد المخزون", ckb: "کاڵاکانی کۆگا" },
  "What you buy and keep, such as milk, sugar and cups, with what is on the shelf today. Paste the whole list from a spreadsheet.":
    {
      ar: "ما تشتريه وتحتفظ به، كالحليب والسكر والأكواب، مع ما على الرف اليوم. الصق القائمة كلها من جدول بيانات.",
      ckb: "ئەوەی دەیکڕیت و هەڵیدەگریت، وەک شیر و شەکر و کوپ، لەگەڵ ئەوەی ئەمڕۆ لەسەر ڕەفە. هەموو لیستەکە لە خشتەیەکەوە بلکێنە.",
    },
  "Add stock items": { ar: "أضف مواد المخزون", ckb: "کاڵاکانی کۆگا زیاد بکە" },
  Suppliers: { ar: "الموردون", ckb: "دابینکەران" },
  "Who you buy from, so each delivery and bill has its supplier.": {
    ar: "من تشتري منهم، ليكون لكل توريد وفاتورة مورّدها.",
    ckb: "ئەوانەی لێیان دەکڕیت، بۆ ئەوەی هەر گەیاندن و پسوولەیەک دابینکەری خۆی هەبێت.",
  },
  "Add suppliers": { ar: "أضف الموردين", ckb: "دابینکەران زیاد بکە" },
  Recipes: { ar: "الوصفات", ckb: "ڕەسەتەکان" },
  "What you make in the kitchen, such as a gelato base, and what goes into it.": {
    ar: "ما تصنعه في المطبخ، كقاعدة الجيلاتو، وما يدخل فيه.",
    ckb: "ئەوەی لە چێشتخانە دروستی دەکەیت، وەک بنەمای جیلاتۆ، و ئەوەی دەچێتە ناوی.",
  },
  "Add recipes": { ar: "أضف الوصفات", ckb: "ڕەسەتەکان زیاد بکە" },
  "Menu and prices": { ar: "القائمة والأسعار", ckb: "مێنیو و نرخەکان" },
  "What you sell, at what price, and what each one uses from stock.": {
    ar: "ما تبيعه، وبأي سعر، وما يستهلكه كلٌّ منها من المخزون.",
    ckb: "ئەوەی دەیفرۆشیت، بە چ نرخێک، و هەر یەکەیان چی لە کۆگا بەکاردەهێنێت.",
  },
  "Add products": { ar: "أضف المنتجات", ckb: "بەرهەمەکان زیاد بکە" },
  Tables: { ar: "الطاولات", ckb: "مێزەکان" },
  "The tables guests sit at, so a bill stays open while they eat.": {
    ar: "الطاولات التي يجلس إليها الضيوف، لتبقى الفاتورة مفتوحة وهم يأكلون.",
    ckb: "ئەو مێزانەی میوانەکان لێیان دادەنیشن، بۆ ئەوەی پسوولەکە کراوە بمێنێتەوە کاتێک دەخۆن.",
  },
  "Add tables": { ar: "أضف الطاولات", ckb: "مێزەکان زیاد بکە" },
  "Staff and their PINs": { ar: "الموظفون ورموز PIN الخاصة بهم", ckb: "کارمەندان و PINەکانیان" },
  "Who works here, then a PIN for each, to clock in and out at the till.": {
    ar: "من يعمل هنا، ثم رمز PIN لكلٍّ منهم، لتسجيل الحضور والانصراف عند نقطة البيع.",
    ckb: "ئەوانەی لێرە کار دەکەن، پاشان PINێک بۆ هەر یەکەیان، بۆ تۆمارکردنی هاتن و ڕۆیشتن لە خاڵی فرۆشتن.",
  },
  "Add staff": { ar: "أضف الموظفين", ckb: "کارمەندان زیاد بکە" },
  "The first sale": { ar: "أول عملية بيع", ckb: "یەکەم فرۆشتن" },
  "Open the drawer with the money it starts with, and ring up the first order.": {
    ar: "افتح الدرج بالمبلغ الذي يبدأ به، وسجّل أول طلب.",
    ckb: "دەخلەکە بەو پارەیەی پێی دەست پێدەکات بکەرەوە، و یەکەم داواکاری تۆمار بکە.",
  },

  // ------------------------------------------------------ Paste stock items in
  "Paste a list": { ar: "الصق قائمة", ckb: "لیستێک بلکێنە" },
  "Copy the rows from Excel or Google Sheets and paste them here, one item a line. Every row is checked before anything is added.":
    {
      ar: "انسخ الصفوف من Excel أو Google Sheets والصقها هنا، مادة في كل سطر. يُفحص كل صف قبل أن يُضاف أي شيء.",
      ckb: "ڕیزەکان لە Excel یان Google Sheets کۆپی بکە و لێرە بیانلکێنە، هەر هێڵێک یەک کاڵا. پێش زیادکردنی هەر شتێک هەموو ڕیزێک دەپشکنرێت.",
    },
  "The columns, in this order": { ar: "الأعمدة، بهذا الترتيب", ckb: "ستوونەکان، بەم ڕیزبەندییە" },
  "Reorder at": { ar: "حدّ إعادة الطلب", ckb: "ئاستی داواکردنەوە" },
  "On the shelf": { ar: "على الرف", ckb: "سەر ڕەف" },
  "Cost each": { ar: "الكلفة للوحدة", ckb: "تێچووی هەر یەکە" },
  "Only the name and the unit are needed. The unit is g, kg, ml, L or each, and the numbers are in it: 24 on the shelf of milk in L is 24 litres, at what one litre cost.":
    {
      ar: "يكفي الاسم والوحدة. الوحدة g أو kg أو ml أو L أو قطعة، والأرقام بها: 24 على الرف من الحليب بوحدة L تعني 24 لترًا، بكلفة اللتر الواحد.",
      ckb: "تەنها ناو و یەکە پێویستن. یەکە g، kg، ml، L یان دانەیە، و ژمارەکان بەو یەکەیەن: 24 لەسەر ڕەف بۆ شیر بە L واتە 24 لیتر، بە تێچووی یەک لیتر.",
    },
  "The list to add": { ar: "القائمة المراد إضافتها", ckb: "ئەو لیستەی زیاد دەکرێت" },
  "Type for all the rows": { ar: "النوع لكل الصفوف", ckb: "جۆر بۆ هەموو ڕیزەکان" },
  "Where the stock on the shelf came from": {
    ar: "من أين جاء المخزون الذي على الرف",
    ckb: "کۆگای سەر ڕەفەکە لە کوێوە هاتووە",
  },
  "Say where the stock on the shelf came from": {
    ar: "اذكر من أين جاء المخزون الذي على الرف",
    ckb: "بڵێ کۆگای سەر ڕەفەکە لە کوێوە هاتووە",
  },
  "The opening count": { ar: "الجرد الافتتاحي", ckb: "ژماردنی سەرەتا" },
  "What is on the shelf is the owner's to record: the items are added without it, and the owner gives each its opening stock.":
    {
      ar: "تسجيل ما على الرف للمالك: تُضاف المواد بدونه، ويسجّل المالك لكلٍّ منها مخزونه الافتتاحي.",
      ckb: "تۆمارکردنی ئەوەی لەسەر ڕەفە کاری خاوەنەکەیە: کاڵاکان بەبێ ئەو زیاد دەکرێن، و خاوەنەکە کۆگای سەرەتای هەر یەکەیان تۆمار دەکات.",
    },
  Ready: { ar: "جاهز", ckb: "ئامادەیە" },
  "Its name looks like “{name}”.": {
    ar: "اسمها يشبه «{name}».",
    ckb: "ناوەکەی لە «{name}» دەچێت.",
  },
  "Its name looks like “{name}”, already on the list.": {
    ar: "اسمها يشبه «{name}» الموجودة في القائمة.",
    ckb: "ناوەکەی لە «{name}» دەچێت کە پێشتر لە لیستەکەدایە.",
  },
  "Adding {done} of {of}…": { ar: "تُضاف {done} من {of}…", ckb: "زیادکردنی {done} لە {of}…" },
  "Add {n} item(s)": {
    ar: "أضف {n, plural, one {مادة واحدة} two {مادتين} few {# مواد} many {# مادة} other {# مادة}}",
    ckb: "{n} کاڵا زیاد بکە",
  },
  "{n} row(s) to put right first": {
    ar: "{n, plural, one {صف واحد يُصحَّح أولًا} two {صفّان يُصحَّحان أولًا} few {# صفوف تُصحَّح أولًا} many {# صفًّا يُصحَّح أولًا} other {# صف يُصحَّح أولًا}}",
    ckb: "{n} ڕیز سەرەتا ڕاست بکرێنەوە",
  },
  "{n} item(s) added.": {
    ar: "{n, plural, one {أُضيفت مادة واحدة.} two {أُضيفت مادتان.} few {أُضيفت # مواد.} many {أُضيفت # مادة.} other {أُضيفت # مادة.}}",
    ckb: "{n} کاڵا زیاد کرا.",
  },
  "{n} row(s) not added: each stays in the box, with what to put right.": {
    ar: "{n, plural, one {لم يُضَف صف واحد} two {لم يُضَف صفّان} few {لم تُضَف # صفوف} many {لم يُضَف # صفًّا} other {لم يُضَف # صف}}: يبقى كلٌّ منها في المربع مع ما يجب تصحيحه.",
    ckb: "{n} ڕیز زیاد نەکرا: هەر یەکەیان لە سندووقەکەدا دەمێنێتەوە، لەگەڵ ئەوەی دەبێت ڕاست بکرێتەوە.",
  },
  "Give it a name": { ar: "أعطها اسمًا", ckb: "ناوێکی لێ بنێ" },
  "“{name}” is in the list twice (line {line}).": {
    ar: "«{name}» مكررة في القائمة (السطر {line}).",
    ckb: "«{name}» دووجار لە لیستەکەدایە (هێڵی {line}).",
  },
  "Give its unit: g, kg, ml, L or each": {
    ar: "اذكر وحدتها: g أو kg أو ml أو L أو قطعة",
    ckb: "یەکەکەی بنووسە: g، kg، ml، L یان دانە",
  },
  "“{unit}” is not a unit here: use g, kg, ml, L or each": {
    ar: "«{unit}» ليست وحدة هنا: استخدم g أو kg أو ml أو L أو قطعة",
    ckb: "«{unit}» لێرە یەکە نییە: g، kg، ml، L یان دانە بەکاربهێنە",
  },
  "“{value}” is not a number": { ar: "«{value}» ليس رقمًا", ckb: "«{value}» ژمارە نییە" },
  "“{value}” is below zero": { ar: "«{value}» أقل من صفر", ckb: "«{value}» لە سفر کەمترە" },
  "Give what one {unit} cost": {
    ar: "اذكر كم كلّف {unit} واحد",
    ckb: "بنووسە یەک {unit} چەندی تێچووە",
  },
};

export default phrases;
