import type { PhraseBook } from "./types";

/**
 * Money coming in and going out at the counter: Sales, counting the drawer, moving cash, card takings, and Vendors (suppliers, bills and paying them), with their forms and messages.
 */
const phrases: PhraseBook = {
  // Sales: the page's heading and its figures.
  "Last 30 trading days · {timezone}": {
    ar: "آخر 30 يوم عمل · {timezone}",
    ckb: "دوایین 30 ڕۆژی کارکردن · {timezone}",
  },
  "Open POS": { ar: "افتح نقطة البيع", ckb: "خاڵی فرۆشتن بکەرەوە" },
  "Net sales, after refunds": {
    ar: "صافي المبيعات، بعد المستردات",
    ckb: "فرۆشی پوخت، دوای گەڕاندنەوەی پارە",
  },
  "Across {days} trading day(s)": {
    ar: "عدد أيام العمل: {days}",
    ckb: "لە {days} ڕۆژی کارکردندا",
  },
  "Refunds made": { ar: "المبالغ المستردة", ckb: "پارەی گەڕێندراوە" },
  "On the day they were made, through 4200 Sales returns": {
    ar: "في يوم إجرائها، عبر 4200 مردودات المبيعات",
    ckb: "لە ڕۆژی خۆیاندا، لە ڕێگەی 4200 گەڕاوەی فرۆشتنەوە",
  },
  "Cost of what was sold": { ar: "كلفة ما بيع", ckb: "تێچووی ئەوەی فرۆشرا" },
  "Sales margin {margin}% · before waste and fees": {
    ar: "هامش المبيعات {margin}% · قبل الهدر والرسوم",
    ckb: "ڕێژەی قازانجی فرۆشتن {margin}% · پێش بەفیڕۆچوون و کرێکان",
  },
  "Days whose cash is not counted": {
    ar: "أيام لم يُعدّ نقدها",
    ckb: "ئەو ڕۆژانەی پارەی کاشیان نەژمێردراوە",
  },
  "Drawer last counted {when}": {
    ar: "آخر عدّ لدرج النقد: {when}",
    ckb: "دوایین ژماردنی دەخیلە: {when}",
  },
  "The drawer has not been counted yet": {
    ar: "لم يُعدّ درج النقد بعد",
    ckb: "دەخیلە هێشتا نەژمێردراوە",
  },
  "{n} before today": { ar: "{n} منها قبل اليوم", ckb: "{n} لەوانە پێش ئەمڕۆن" },

  // Sales: the day by day table.
  "Daily Sales Summaries": { ar: "ملخّصات المبيعات اليومية", ckb: "کورتەی فرۆشتنی ڕۆژانە" },
  "One line per day per channel · voided sales excluded · a refund on the day it was made": {
    ar: "سطر لكل يوم ولكل قناة · دون المبيعات الملغاة · والاسترداد في يوم إجرائه",
    ckb: "هێڵێک بۆ هەر ڕۆژێک و هەر کەناڵێک · بێ فرۆشتنە هەڵوەشێنراوەکان · گەڕاندنەوەی پارە لە ڕۆژی خۆیدا",
  },
  "No sales in the last 30 days": {
    ar: "لا مبيعات في آخر 30 يومًا",
    ckb: "لە 30 ڕۆژی ڕابردوودا هیچ فرۆشتنێک نییە",
  },
  "Sales rung up on the till appear here by day.": {
    ar: "تظهر هنا، يومًا بيوم، المبيعات المسجّلة على نقطة البيع.",
    ckb: "ئەو فرۆشتنانەی لەسەر خاڵی فرۆشتن تۆمار دەکرێن، ڕۆژ بە ڕۆژ لێرە دەردەکەون.",
  },
  Channel: { ar: "القناة", ckb: "کەناڵ" },
  Orders: { ar: "الطلبات", ckb: "داواکارییەکان" },
  Sales: { ar: "المبيعات", ckb: "فرۆشتن" },
  Refunds: { ar: "المستردات", ckb: "گەڕاندنەوەی پارە" },
  "Net sales": { ar: "صافي المبيعات", ckb: "فرۆشی پوخت" },
  "Not counted": { ar: "غير معدود", ckb: "نەژمێردراو" },
  Counted: { ar: "معدود", ckb: "ژمێردراو" },

  // Sales: the sections below the table.
  "Count the Drawer": { ar: "عدّ درج النقد", ckb: "ژماردنی دەخیلە" },
  "Everything since the last count, whatever the day": {
    ar: "كل ما جرى منذ آخر عدّ، أيًّا كان اليوم",
    ckb: "هەموو شتێک لە دوایین ژماردنەوە، هەر ڕۆژێک بێت",
  },
  "Move Cash": { ar: "نقل النقد", ckb: "گواستنەوەی پارە" },
  "Between the till, the safe, the bank and the owner": {
    ar: "بين درج النقد والخزنة والبنك والمالك",
    ckb: "لە نێوان دەخیلە و قاسە و بانک و خاوەندا",
  },
  "Card Takings": { ar: "مقبوضات البطاقات", ckb: "داهاتی کارت" },
  "Settled against the terminal's report and what reached the bank · the fee to 6500": {
    ar: "تُسوّى وفق تقرير جهاز البطاقات وما وصل إلى البنك · والرسوم إلى 6500",
    ckb: "بەپێی ڕاپۆرتی ئامێری کارت و ئەوەی گەیشتە بانک یەکلادەکرێتەوە · کرێکە بۆ 6500",
  },
  "Drawer Counts": { ar: "عمليات عدّ درج النقد", ckb: "ژماردنەکانی دەخیلە" },
  "Each covers the cash since the one before · over / short history": {
    ar: "كل عدّ يشمل النقد منذ العدّ الذي سبقه · سجلّ الزيادة / العجز",
    ckb: "هەر ژماردنێک پارەی کاشی دوای ژماردنی پێشوو دەگرێتەوە · مێژووی زیادە / کەم",
  },
  "Started with": { ar: "رصيد البداية", ckb: "بڕی سەرەتا" },
  "Should hold": { ar: "المتوقّع", ckb: "چاوەڕوانکراو" },
  "Over / short": { ar: "الزيادة / العجز", ckb: "زیادە / کەم" },
  Stayed: { ar: "ما بقي", ckb: "ئەوەی مایەوە" },
  "Taken out": { ar: "ما أُخرج", ckb: "ئەوەی دەرهێنرا" },
  "{day} (by day)": { ar: "{day} (عدّ يومي)", ckb: "{day} (ژماردنی ڕۆژانە)" },
  "since {when}": { ar: "منذ {when}", ckb: "لە {when} بەدواوە" },
  // Where a count's takings went, as the database names it.
  safe: { ar: "الخزنة", ckb: "قاسە" },
  bank: { ar: "البنك", ckb: "بانک" },

  // Counting the drawer.
  "Counted — the drawer agrees exactly.": {
    ar: "تمّ العدّ — درج النقد مطابق تمامًا.",
    ckb: "ژمێردرا — دەخیلەکە تەواو ڕێکە.",
  },
  "Counted — {amount} short, posted to 6300 Cash over / short (journal {journal}).": {
    ar: "تمّ العدّ — عجز قدره {amount}، سُجّل في 6300 زيادة / عجز النقد (القيد {journal}).",
    ckb: "ژمێردرا — {amount} کەمە، لە 6300 زیادە / کەمیی کاش تۆمار کرا (تۆماری {journal}).",
  },
  "Counted — {amount} over, posted to 6300 Cash over / short (journal {journal}).": {
    ar: "تمّ العدّ — زيادة قدرها {amount}، سُجّلت في 6300 زيادة / عجز النقد (القيد {journal}).",
    ckb: "ژمێردرا — {amount} زیادە، لە 6300 زیادە / کەمیی کاش تۆمار کرا (تۆماری {journal}).",
  },
  "{taken} to the {place}; {left} stays in the drawer.": {
    ar: "{taken} إلى {place}؛ ويبقى {left} في درج النقد.",
    ckb: "{taken} بۆ {place}؛ {left} لە دەخیلەدا دەمێنێتەوە.",
  },
  "{left} stays in the drawer.": {
    ar: "يبقى {left} في درج النقد.",
    ckb: "{left} لە دەخیلەدا دەمێنێتەوە.",
  },
  "Cash in the drawer when trading began after the last close": {
    ar: "المبلغ في درج النقد عند بدء العمل بعد آخر إغلاق",
    ckb: "پارەی ناو دەخیلە کاتێک کار دەستی پێکرد دوای دوایین داخستن",
  },
  "Cash when trading began": { ar: "النقد عند بدء العمل", ckb: "پارەی کاش لە سەرەتای کارکردن" },
  "Asked once: the days before were closed one at a time. From now on each count starts from what the last one left.":
    {
      ar: "يُسأل عنه مرة واحدة: كانت الأيام السابقة تُغلق يومًا يومًا. ومن الآن يبدأ كل عدّ مما تركه العدّ الذي قبله.",
      ckb: "تەنها یەک جار دەپرسرێت: ڕۆژەکانی پێشوو یەک بە یەک داخران. لە ئێستاوە هەر ژماردنێک لەوەوە دەست پێدەکات کە ژماردنی پێشوو بەجێی هێشت.",
    },
  "In the drawer after the count of {when}": {
    ar: "في درج النقد بعد عدّ {when}",
    ckb: "لە دەخیلەدا دوای ژماردنی {when}",
  },
  "In the drawer at the start": { ar: "في درج النقد عند البداية", ckb: "لە دەخیلەدا لە سەرەتادا" },
  "Cash sales": { ar: "المبيعات النقدية", ckb: "فرۆشتنی کاش" },
  "Cash refunds": { ar: "المستردات النقدية", ckb: "گەڕاندنەوەی پارەی کاش" },
  "Voided sales": { ar: "المبيعات الملغاة", ckb: "فرۆشتنە هەڵوەشێنراوەکان" },
  "Paid out of the till": { ar: "مدفوع من درج النقد", ckb: "لە دەخیلەوە دراوە" },
  "Put into the till": { ar: "مُضاف إلى درج النقد", ckb: "خراوەتە ناو دەخیلە" },
  "Taken out of the till": { ar: "مأخوذ من درج النقد", ckb: "لە دەخیلە دەرهێنراوە" },
  "The drawer should hold": { ar: "يجب أن يحوي درج النقد", ckb: "دەبێت لە دەخیلەدا هەبێت" },
  "Cash counted (IQD)": { ar: "النقد المعدود (IQD)", ckb: "پارەی ژمێردراو (IQD)" },
  "Cash counted": { ar: "النقد المعدود", ckb: "پارەی ژمێردراو" },
  "Stays in the drawer": { ar: "يبقى في درج النقد", ckb: "لە دەخیلەدا دەمێنێتەوە" },
  "all of it": { ar: "كلّه", ckb: "هەمووی" },
  "The other {amount} goes to": {
    ar: "الباقي ({amount}) يذهب إلى",
    ckb: "ماوەکە ({amount}) دەچێت بۆ",
  },
  "Takings go to": { ar: "وجهة المقبوضات", ckb: "پارە وەرگیراوەکە دەچێت بۆ" },
  "the safe (1005)": { ar: "الخزنة (1005)", ckb: "قاسەکە (1005)" },
  "the bank (1020)": { ar: "البنك (1020)", ckb: "بانکەکە (1020)" },
  "Counting…": { ar: "جارٍ العدّ…", ckb: "دەژمێردرێت…" },
  "Count the drawer": { ar: "عُدّ درج النقد", ckb: "دەخیلەکە بژمێرە" },
  "What stays in the drawer must be between 0 and the cash counted.": {
    ar: "يجب أن يكون ما يبقى في درج النقد بين 0 والنقد المعدود.",
    ckb: "ئەوەی لە دەخیلەدا دەمێنێتەوە دەبێت لە نێوان 0 و پارەی ژمێردراودا بێت.",
  },
  "{n} bill(s) from the till are still open. Take payment for them, or have a manager cancel them, on the <till>till</till> before counting the drawer.":
    {
      ar: "الفواتير التي ما زالت مفتوحة على نقطة البيع: {n}. استلم دفعها، أو اطلب من مدير إلغاءها، على <till>نقطة البيع</till> قبل عدّ درج النقد.",
      ckb: "{n} پسووڵەی خاڵی فرۆشتن هێشتا کراوەن. پارەیان وەربگرە، یان با بەڕێوەبەرێک هەڵیانبوەشێنێتەوە، لەسەر <till>خاڵی فرۆشتن</till> پێش ژماردنی دەخیلە.",
    },
  "{n} sale(s) since the last count. Card ({card}) and platform ({platform}) takings are not in the drawer — they clear through 1010 and 1100. A sale after this count is in the next one.":
    {
      ar: "المبيعات منذ آخر عدّ: {n}. مقبوضات البطاقات ({card}) والمنصات ({platform}) ليست في درج النقد — فهي تمرّ عبر 1010 و1100. والبيع بعد هذا العدّ يدخل في العدّ التالي.",
      ckb: "{n} فرۆشتن لە دوایین ژماردنەوە. پارەی کارت ({card}) و پلاتفۆرم ({platform}) لە دەخیلەدا نییە — لە ڕێگەی 1010 و 1100 تێدەپەڕن. فرۆشتنێک کە دوای ئەم ژماردنە بێت، دەچێتە ژماردنی داهاتوو.",
    },

  // Moving cash between the till, the safe, the bank and the owner.
  "the till": { ar: "درج النقد", ckb: "دەخیلەکە" },
  "the safe": { ar: "الخزنة", ckb: "قاسەکە" },
  "the bank": { ar: "البنك", ckb: "بانکەکە" },
  "the owner": { ar: "المالك", ckb: "خاوەنەکە" },
  "Moved {amount} from {from} to {to} (journal {journal}).": {
    ar: "نُقل {amount} من {from} إلى {to} (القيد {journal}).",
    ckb: "{amount} لە {from} گوازرایەوە بۆ {to} (تۆماری {journal}).",
  },
  "Cash from": { ar: "النقد من", ckb: "پارە لە" },
  "Cash to": { ar: "النقد إلى", ckb: "پارە بۆ" },
  "Amount (IQD)": { ar: "المبلغ (IQD)", ckb: "بڕی پارە (IQD)" },
  "Amount to move": { ar: "المبلغ المراد نقله", ckb: "بڕی پارەی گواستنەوە" },
  "What it is for (required)": { ar: "الغرض (مطلوب)", ckb: "بۆ چییە (پێویستە)" },
  "Note (optional)": { ar: "ملاحظة (اختياري)", ckb: "تێبینی (ئارەزوومەندانە)" },
  "What the cash is for": { ar: "الغرض من النقد", ckb: "پارەکە بۆ چییە" },
  "Float for the till": { ar: "فكّة لدرج النقد", ckb: "وردە پارە بۆ دەخیلە" },
  "Deposit at the bank": { ar: "إيداع في البنك", ckb: "دانانی پارە لە بانک" },
  "Moving…": { ar: "جارٍ النقل…", ckb: "دەگوازرێتەوە…" },
  "Move cash": { ar: "انقل النقد", ckb: "پارەکە بگوازەرەوە" },
  "The safe holds {amount} in the books. Neither the till nor the safe can pay out more than it holds.":
    {
      ar: "في الخزنة {amount} حسب الدفاتر. لا يمكن لدرج النقد ولا للخزنة دفع أكثر مما فيه.",
      ckb: "بەپێی دەفتەرەکان {amount} لە قاسەدایە. نە دەخیلە و نە قاسە ناتوانن زیاتر لەوەی تێیاندایە بدەن.",
    },

  // Card takings, settled against the terminal and the bank.
  "Settled (journal {journal}): {fee} card fee; the till and the terminal agree.": {
    ar: "تمّت التسوية (القيد {journal}): رسوم البطاقة {fee}؛ ونقطة البيع وجهاز البطاقات متطابقان.",
    ckb: "یەکلاکرایەوە (تۆماری {journal}): کرێی کارت {fee}؛ خاڵی فرۆشتن و ئامێری کارت یەک دەگرنەوە.",
  },
  "Settled (journal {journal}): {fee} card fee; {difference} more at the till than the terminal, to 6300.":
    {
      ar: "تمّت التسوية (القيد {journal}): رسوم البطاقة {fee}؛ وفي نقطة البيع {difference} أكثر من جهاز البطاقات، إلى 6300.",
      ckb: "یەکلاکرایەوە (تۆماری {journal}): کرێی کارت {fee}؛ خاڵی فرۆشتن {difference} زیاترە لە ئامێری کارت، بۆ 6300.",
    },
  "Settled (journal {journal}): {fee} card fee; {difference} more at the terminal than the till, to 6300.":
    {
      ar: "تمّت التسوية (القيد {journal}): رسوم البطاقة {fee}؛ وفي جهاز البطاقات {difference} أكثر من نقطة البيع، إلى 6300.",
      ckb: "یەکلاکرایەوە (تۆماری {journal}): کرێی کارت {fee}؛ ئامێری کارت {difference} زیاترە لە خاڵی فرۆشتن، بۆ 6300.",
    },
  "Cancelled: its journal is reversed, and its days wait again.": {
    ar: "أُلغيت التسوية: عُكس قيدها، وعادت أيامها بانتظار التسوية.",
    ckb: "هەڵوەشێنرایەوە: تۆمارەکەی هەڵگەڕێندرایەوە، و ڕۆژەکانی دووبارە چاوەڕێی یەکلاکردنەوەن.",
  },
  "Nothing taken by card is waiting to be settled: every day before {day} is.": {
    ar: "لا شيء مما قُبض بالبطاقة ينتظر التسوية: كل يوم قبل {day} مُسوّى.",
    ckb: "هیچ پارەیەکی کارت چاوەڕێی یەکلاکردنەوە نییە: هەموو ڕۆژێکی پێش {day} یەکلاکراوەتەوە.",
  },
  "Nothing taken by card is waiting to be settled.": {
    ar: "لا شيء مما قُبض بالبطاقة ينتظر التسوية.",
    ckb: "هیچ پارەیەکی کارت چاوەڕێی یەکلاکردنەوە نییە.",
  },
  "today: settled once the day is over": {
    ar: "اليوم: يُسوّى بعد انتهاء اليوم",
    ckb: "ئەمڕۆ: دوای کۆتاییهاتنی ڕۆژەکە یەکلادەکرێتەوە",
  },
  "not in this settlement": { ar: "ليس ضمن هذه التسوية", ckb: "لەم یەکلاکردنەوەیەدا نییە" },
  "Waiting to be settled": { ar: "بانتظار التسوية", ckb: "چاوەڕێی یەکلاکردنەوە" },
  "1010 Card clearing holds": {
    ar: "رصيد 1010 مقاصّة البطاقات",
    ckb: "باڵانسی 1010 پاکتاوی کارت",
  },
  "Today's card takings are settled once the day is over, from the terminal's report and the bank statement.":
    {
      ar: "تُسوّى مقبوضات البطاقات لهذا اليوم بعد انتهائه، من تقرير جهاز البطاقات وكشف البنك.",
      ckb: "داهاتی کارتی ئەمڕۆ دوای کۆتاییهاتنی ڕۆژەکە یەکلادەکرێتەوە، بەپێی ڕاپۆرتی ئامێری کارت و کەشفی بانک.",
    },
  "Settle the days up to": { ar: "تسوية الأيام حتى", ckb: "یەکلاکردنەوەی ڕۆژەکان تا" },
  "The till took by card": {
    ar: "ما قبضته نقطة البيع بالبطاقة",
    ckb: "ئەوەی خاڵی فرۆشتن بە کارت وەریگرت",
  },
  "The terminal's total (IQD)": {
    ar: "مجموع جهاز البطاقات (IQD)",
    ckb: "کۆی ئامێری کارتەکە (IQD)",
  },
  "The terminal's total": { ar: "مجموع جهاز البطاقات", ckb: "کۆی ئامێری کارتەکە" },
  "Same as the till": { ar: "مثل نقطة البيع", ckb: "وەک خاڵی فرۆشتن" },
  "Reached the bank (IQD)": { ar: "ما وصل إلى البنك (IQD)", ckb: "ئەوەی گەیشتە بانک (IQD)" },
  "Reached the bank": { ar: "ما وصل إلى البنك", ckb: "ئەوەی گەیشتە بانک" },
  "Arrived on": { ar: "تاريخ الوصول", ckb: "بەرواری گەیشتن" },
  "Bank reference (optional)": {
    ar: "مرجع البنك (اختياري)",
    ckb: "ژمارەی ئاماژەی بانک (ئارەزوومەندانە)",
  },
  "Bank reference": { ar: "مرجع البنك", ckb: "ژمارەی ئاماژەی بانک" },
  "Note: say why the till and the terminal differ": {
    ar: "ملاحظة: اذكر سبب اختلاف نقطة البيع عن جهاز البطاقات",
    ckb: "تێبینی: بڵێ بۆچی خاڵی فرۆشتن و ئامێری کارت جیاوازن",
  },
  "The bank cannot receive more than the terminal took: the difference is its fee.": {
    ar: "لا يمكن أن يستلم البنك أكثر مما قبضه جهاز البطاقات: الفرق هو رسومه.",
    ckb: "بانک ناتوانێت زیاتر لەوەی ئامێری کارت وەریگرتووە وەربگرێت: جیاوازییەکە کرێکەیەتی.",
  },
  // Debit and credit, as a journal's lines are marked.
  Dr: { ar: "مدين", ckb: "مەدین" },
  Cr: { ar: "دائن", ckb: "دائین" },
  "Card and bank fees": { ar: "رسوم البطاقات والبنك", ckb: "کرێی کارت و بانک" },
  "Card clearing": { ar: "مقاصّة البطاقات", ckb: "پاکتاوی کارت" },
  "Cash over / short: the till took more by card than the terminal": {
    ar: "زيادة / عجز النقد: قبضت نقطة البيع بالبطاقة أكثر من جهاز البطاقات",
    ckb: "زیادە / کەمیی کاش: خاڵی فرۆشتن بە کارت زیاتری وەرگرت لە ئامێری کارت",
  },
  "Cash over / short: the terminal took more than the till": {
    ar: "زيادة / عجز النقد: قبض جهاز البطاقات أكثر من نقطة البيع",
    ckb: "زیادە / کەمیی کاش: ئامێری کارت زیاتری وەرگرت لە خاڵی فرۆشتن",
  },
  "Record the settlement": { ar: "سجّل التسوية", ckb: "یەکلاکردنەوەکە تۆمار بکە" },
  Days: { ar: "الأيام", ckb: "ڕۆژەکان" },
  Till: { ar: "نقطة البيع", ckb: "خاڵی فرۆشتن" },
  Terminal: { ar: "جهاز البطاقات", ckb: "ئامێری کارت" },
  "To the bank": { ar: "إلى البنك", ckb: "بۆ بانک" },
  Fee: { ar: "الرسوم", ckb: "کرێ" },
  Difference: { ar: "الفرق", ckb: "جیاوازی" },
  Arrived: { ar: "تاريخ الوصول", ckb: "کاتی گەیشتن" },
  Cancelled: { ar: "ملغى", ckb: "هەڵوەشێنراوەتەوە" },
  "Why it is cancelled": { ar: "سبب الإلغاء", ckb: "هۆکاری هەڵوەشاندنەوە" },

  // Vendors: the page, and what is owed.
  "Suppliers the shop buys from": {
    ar: "المورّدون الذين يشتري منهم المحل",
    ckb: "ئەو دابینکەرانەی دوکانەکە لێیان دەکڕێت",
  },
  "{amount} payable": { ar: "{amount} مستحق الدفع", ckb: "{amount} دەبێت بدرێت" },
  "Not yet due": { ar: "لم يحن موعدها بعد", ckb: "هێشتا کاتی نەهاتووە" },
  "Within terms": { ar: "ضمن مدة السداد", ckb: "لە ماوەی دیاریکراودا" },
  "1 – 15 days over": { ar: "متأخرة 1 – 15 يومًا", ckb: "1 – 15 ڕۆژ دواکەوتوو" },
  "Chase this week": { ar: "تابِعها هذا الأسبوع", ckb: "ئەم هەفتەیە بەدوایدا بچۆ" },
  "16 – 30 days over": { ar: "متأخرة 16 – 30 يومًا", ckb: "16 – 30 ڕۆژ دواکەوتوو" },
  Late: { ar: "متأخرة", ckb: "دواکەوتوو" },
  "Over 30 days": { ar: "أكثر من 30 يومًا", ckb: "زیاتر لە 30 ڕۆژ" },
  "Relationship at risk": { ar: "العلاقة في خطر", ckb: "پەیوەندییەکە لە مەترسیدایە" },
  "A bill for goods is matched to the receipt that brought them in: it clears Goods received not invoiced (2050) for what the receipt recorded, puts any price difference to 5050, and raises Accounts payable (2000). A delivery received before the controls, whose payable the old app posted when the goods arrived, is billed against that payable: only a difference in price is posted. A bill for a service or an asset is charged straight to its account. A payment settles the payable from cash, card or the bank. The same invoice number from the same vendor can only be entered once.":
    {
      ar: "تُطابَق فاتورة البضائع مع إيصال الاستلام الذي أدخلها: فتُصفّي البضائع المستلمة غير المفوترة (2050) بقدر ما سجّله الإيصال، وتضع أي فرق في السعر في 5050، وتزيد الذمم الدائنة (2000). والتوريد المستلم قبل الضوابط، الذي سجّل التطبيق القديم مبلغه المستحق عند وصول البضاعة، يُفوتر مقابل ذلك المستحق: فلا يُسجَّل إلا فرق السعر. وفاتورة الخدمة أو الأصل تُحمَّل مباشرة على حسابها. والدفعة تسدّد المستحق من النقد أو البطاقة أو البنك. ولا يمكن إدخال رقم الفاتورة نفسه من المورّد نفسه إلا مرة واحدة.",
      ckb: "پسووڵەی کاڵا لەگەڵ ئەو وەسڵی وەرگرتنە بەراورد دەکرێت کە کاڵاکەی هێناوە: کاڵای وەرگیراوی بێ پسووڵە (2050) بە ئەندازەی ئەوەی وەسڵەکە تۆماری کردووە پاک دەکاتەوە، هەر جیاوازییەکی نرخ دەخاتە 5050، و قەرزە دانەوەکان (2000) زیاد دەکات. گەیاندنێک کە پێش کۆنتڕۆڵەکان وەرگیراوە، و ئەپە کۆنەکە قەرزەکەی لە کاتی گەیشتنی کاڵاکەدا تۆمار کردووە، بەرامبەر بەو قەرزە پسووڵەی بۆ دەکرێت: تەنها جیاوازیی نرخ تۆمار دەکرێت. پسووڵەی خزمەتگوزاری یان سامان ڕاستەوخۆ دەخرێتە سەر هەژمارەکەی خۆی. پارەدان قەرزەکە لە کاش، کارت یان بانکەوە دەداتەوە. هەمان ژمارەی پسووڵە لە هەمان دابینکەرەوە تەنها یەک جار دەتوانرێت تۆمار بکرێت.",
    },

  // Vendors: the list, and a vendor's statement.
  "No vendors yet.": { ar: "لا يوجد مورّدون بعد.", ckb: "هێشتا هیچ دابینکەرێک نییە." },
  Statement: { ar: "الكشف", ckb: "کەشف" },
  "Bills & payments": { ar: "الفواتير والدفعات", ckb: "پسووڵە و پارەدانەکان" },
  "Edit vendor": { ar: "تعديل المورّد", ckb: "دەستکاریکردنی دابینکەر" },
  "New vendor": { ar: "مورّد جديد", ckb: "دابینکەری نوێ" },
  "All Vendors": { ar: "كل المورّدين", ckb: "هەموو دابینکەران" },
  "Out of use": { ar: "خارج الاستخدام", ckb: "لە بەکارهێنان لابراوە" },
  "{amount} overdue": { ar: "{amount} متأخّر السداد", ckb: "{amount} دواکەوتووە" },
  "Nothing overdue": { ar: "لا شيء متأخّر", ckb: "هیچ شتێک دوانەکەوتووە" },
  "Statement of Account": { ar: "كشف حساب", ckb: "کەشفی هەژمار" },
  "All transactions to date · IQD": {
    ar: "كل المعاملات حتى اليوم · IQD",
    ckb: "هەموو مامەڵەکان تا ئەمڕۆ · IQD",
  },
  Particulars: { ar: "البيان", ckb: "وردەکاری" },
  Ref: { ar: "المرجع", ckb: "ئاماژە" },
  Charge: { ar: "المبلغ المفوتر", ckb: "بڕی پسووڵە" },
  Payment: { ar: "دفعة", ckb: "پارەدان" },
  Balance: { ar: "الرصيد", ckb: "باڵانس" },
  "No transactions with this vendor yet.": {
    ar: "لا توجد معاملات مع هذا المورّد بعد.",
    ckb: "هێشتا هیچ مامەڵەیەک لەگەڵ ئەم دابینکەرە نییە.",
  },
  "Account Summary": { ar: "ملخّص الحساب", ckb: "کورتەی هەژمار" },
  "Billed to date": { ar: "المفوتر حتى اليوم", ckb: "پسووڵەکراو تا ئەمڕۆ" },
  Paid: { ar: "المدفوع", ckb: "پارەی دراو" },
  "Balance due": { ar: "الرصيد المستحق", ckb: "باڵانسی ماوە" },
  // A statement's lines, as the vendor book writes them (src/lib/db/books.ts).
  "Bill {1} (before controls)": {
    ar: "الفاتورة {1} (قبل الضوابط)",
    ckb: "پسووڵەی {1} (پێش کۆنتڕۆڵەکان)",
  },
  "Bill {1} — cancelled: {2}": {
    ar: "الفاتورة {1} — أُلغيت: {2}",
    ckb: "پسووڵەی {1} — هەڵوەشێنرایەوە: {2}",
  },
  "Payment — {1}": { ar: "دفعة — {1}", ckb: "پارەدان — {1}" },
  "from the till": { ar: "من درج النقد", ckb: "لە دەخیلەوە" },
  cash: { ar: "نقدًا", ckb: "کاش" },
  "from the safe": { ar: "من الخزنة", ckb: "لە قاسەوە" },
  "by bank": { ar: "عبر البنك", ckb: "لە ڕێگەی بانکەوە" },
  "by card": { ar: "بالبطاقة", ckb: "بە کارت" },
  "paid by the owner": { ar: "دفعها المالك", ckb: "خاوەن دایە" },

  // Vendors: recording a bill.
  "Bill {bill} recorded (journal {journal}).": {
    ar: "سُجّلت الفاتورة {bill} (القيد {journal}).",
    ckb: "پسووڵەی {bill} تۆمار کرا (تۆماری {journal}).",
  },
  "Bill {bill} recorded (journal {journal}) — {amount} over the receipt, to 5050 Purchase price variance.":
    {
      ar: "سُجّلت الفاتورة {bill} (القيد {journal}) — تزيد {amount} على إيصال الاستلام، إلى 5050 فروقات أسعار الشراء.",
      ckb: "پسووڵەی {bill} تۆمار کرا (تۆماری {journal}) — {amount} زیاترە لە وەسڵی وەرگرتن، بۆ 5050 جیاوازیی نرخی کڕین.",
    },
  "Bill {bill} recorded (journal {journal}) — {amount} under the receipt, to 5050 Purchase price variance.":
    {
      ar: "سُجّلت الفاتورة {bill} (القيد {journal}) — تقلّ {amount} عن إيصال الاستلام، إلى 5050 فروقات أسعار الشراء.",
      ckb: "پسووڵەی {bill} تۆمار کرا (تۆماری {journal}) — {amount} کەمترە لە وەسڵی وەرگرتن، بۆ 5050 جیاوازیی نرخی کڕین.",
    },
  "Payment recorded (journal {journal}). {amount} still outstanding on that bill.": {
    ar: "سُجّلت الدفعة (القيد {journal}). ما زال {amount} مستحقًا على تلك الفاتورة.",
    ckb: "پارەدانەکە تۆمار کرا (تۆماری {journal}). هێشتا {amount} لەسەر ئەو پسووڵەیە ماوە.",
  },
  "Record a bill": { ar: "تسجيل فاتورة", ckb: "تۆمارکردنی پسووڵە" },
  "The supplier's invoice — raises what you owe": {
    ar: "فاتورة المورّد — تزيد ما عليك",
    ckb: "پسووڵەی دابینکەر — ئەو قەرزەی لەسەرتە زیاد دەکات",
  },
  "For goods received": { ar: "لبضائع مستلمة", ckb: "بۆ کاڵای وەرگیراو" },
  "(no unbilled receipts)": {
    ar: "(لا إيصالات استلام دون فاتورة)",
    ckb: "(هیچ وەسڵێکی بێ پسووڵە نییە)",
  },
  "For a service or asset (rent, repairs, equipment…)": {
    ar: "لخدمة أو أصل (إيجار، تصليحات، معدّات…)",
    ckb: "بۆ خزمەتگوزاری یان سامان (کرێ، چاککردنەوە، ئامێر…)",
  },
  "Goods receipt": { ar: "إيصال استلام البضاعة", ckb: "وەسڵی وەرگرتنی کاڵا" },
  "Before controls · {note}": { ar: "قبل الضوابط · {note}", ckb: "پێش کۆنتڕۆڵەکان · {note}" },
  "supplier not recorded": { ar: "المورّد غير مسجّل", ckb: "دابینکەر تۆمار نەکراوە" },
  "Receipt {no}": { ar: "الإيصال {no}", ckb: "وەسڵی {no}" },
  "Charge to account": { ar: "تحميل على الحساب", ckb: "خستنە سەر هەژمار" },
  "Invoice no.": { ar: "رقم الفاتورة", ckb: "ژمارەی پسووڵە" },
  "The supplier's invoice no.": { ar: "رقم فاتورة المورّد", ckb: "ژمارەی پسووڵەی دابینکەر" },
  "Invoice date": { ar: "تاريخ الفاتورة", ckb: "بەرواری پسووڵە" },
  Terms: { ar: "مدة السداد", ckb: "ماوەی پارەدان" },
  "Due now": { ar: "مستحقة الآن", ckb: "ئێستا دەبێت بدرێت" },
  "Net 7 days": { ar: "خلال 7 أيام", ckb: "لە ماوەی 7 ڕۆژدا" },
  "Net 15 days": { ar: "خلال 15 يومًا", ckb: "لە ماوەی 15 ڕۆژدا" },
  "Net 30 days": { ar: "خلال 30 يومًا", ckb: "لە ماوەی 30 ڕۆژدا" },
  "Record bill": { ar: "سجّل الفاتورة", ckb: "پسووڵەکە تۆمار بکە" },
  "{no} is the café's own number, given when the bill is recorded and never to another bill. If the supplier's invoice has its own number, type that instead.":
    {
      ar: "{no} رقم خاص بالمقهى، يُعطى عند تسجيل الفاتورة ولا يُعطى لفاتورة أخرى أبدًا. إن كان لفاتورة المورّد رقمها الخاص، فاكتبه بدلًا منه.",
      ckb: "{no} ژمارەی تایبەتی کافێکەیە، کاتی تۆمارکردنی پسووڵەکە دەدرێت و هەرگیز نادرێتە پسووڵەیەکی تر. ئەگەر پسووڵەی دابینکەر ژمارەی خۆی هەیە، ئەوە بنووسە.",
    },
  "Type the amount the supplier's invoice says. It is checked against the {amount} the receipt recorded.":
    {
      ar: "اكتب المبلغ الوارد في فاتورة المورّد. يُطابَق مع {amount} المسجّل في إيصال الاستلام.",
      ckb: "ئەو بڕە بنووسە کە پسووڵەی دابینکەر دەیڵێت. لەگەڵ بڕی تۆمارکراو لە وەسڵی وەرگرتندا ({amount}) بەراورد دەکرێت.",
    },
  "The bill is {amount} more than the receipt recorded; the difference goes to 5050 Purchase price variance.":
    {
      ar: "تزيد الفاتورة {amount} على ما سجّله إيصال الاستلام؛ ويذهب الفرق إلى 5050 فروقات أسعار الشراء.",
      ckb: "پسووڵەکە {amount} زیاترە لەوەی وەسڵی وەرگرتن تۆماری کردووە؛ جیاوازییەکە دەچێتە 5050 جیاوازیی نرخی کڕین.",
    },
  "The bill is {amount} less than the receipt recorded; the difference goes to 5050 Purchase price variance.":
    {
      ar: "تقلّ الفاتورة {amount} عمّا سجّله إيصال الاستلام؛ ويذهب الفرق إلى 5050 فروقات أسعار الشراء.",
      ckb: "پسووڵەکە {amount} کەمترە لەوەی وەسڵی وەرگرتن تۆماری کردووە؛ جیاوازییەکە دەچێتە 5050 جیاوازیی نرخی کڕین.",
    },

  // Vendors: the open bills, and paying one.
  "Open bills": { ar: "الفواتير المفتوحة", ckb: "پسووڵە کراوەکان" },
  "{n} unpaid": { ar: "غير المدفوعة: {n}", ckb: "{n} پارە نەدراو" },
  Invoice: { ar: "الفاتورة", ckb: "پسووڵە" },
  Dated: { ar: "بتاريخ", ckb: "بەروار" },
  Due: { ar: "تاريخ الاستحقاق", ckb: "بەرواری دانەوە" },
  Outstanding: { ar: "المتبقي", ckb: "ماوە" },
  "Nothing outstanding.": { ar: "لا شيء مستحق.", ckb: "هیچ قەرزێک نەماوە." },
  "{n}d overdue": { ar: "أيام التأخير: {n}", ckb: "{n} ڕۆژ دواکەوتووە" },
  Current: { ar: "في موعدها", ckb: "لە کاتی خۆیدایە" },
  "Pay bill": { ar: "دفع فاتورة", ckb: "پارەدانی پسووڵە" },
  "Choose an invoice…": { ar: "اختر فاتورة…", ckb: "پسووڵەیەک هەڵبژێرە…" },
  "{invoice} — {amount} outstanding": {
    ar: "{invoice} — متبقٍّ {amount}",
    ckb: "{invoice} — {amount} ماوە",
  },
  "Paid from": { ar: "دُفع من", ckb: "پارە درا لە" },
  "Choose…": { ar: "اختر…", ckb: "هەڵبژێرە…" },
  "The till (today's drawer)": {
    ar: "نقطة البيع (درج اليوم)",
    ckb: "خاڵی فرۆشتن (دەخیلەی ئەمڕۆ)",
  },
  "The safe": { ar: "الخزنة", ckb: "قاسەکە" },
  "The bank": { ar: "البنك", ckb: "بانکەکە" },
  "A card": { ar: "بطاقة", ckb: "کارتێک" },
  "The owner, personally": { ar: "المالك شخصيًا", ckb: "خاوەن خۆی" },
  "Paying…": { ar: "جارٍ الدفع…", ckb: "پارە دەدرێت…" },
  "Record payment": { ar: "سجّل الدفعة", ckb: "پارەدانەکە تۆمار بکە" },
  "Entered in error — a duplicate or the wrong amount": {
    ar: "أُدخلت خطأً — مكرّرة أو بمبلغ خاطئ",
    ckb: "بە هەڵە تۆمار کراوە — دووبارەیە یان بڕەکەی هەڵەیە",
  },
  "Why cancel {bill}?": { ar: "لماذا تُلغى {bill}؟", ckb: "بۆچی {bill} هەڵدەوەشێنرێتەوە؟" },
  "Why cancel this bill?": {
    ar: "لماذا تُلغى هذه الفاتورة؟",
    ckb: "بۆچی ئەم پسووڵەیە هەڵدەوەشێنرێتەوە؟",
  },
  "Date of the cancellation": { ar: "تاريخ الإلغاء", ckb: "بەرواری هەڵوەشاندنەوە" },
  Confirm: { ar: "تأكيد", ckb: "دڵنیاکردنەوە" },

  // Vendors: adding one, and correcting one.
  "Added {name}.": { ar: "أُضيف {name}.", ckb: "{name} زیاد کرا." },
  "No vendors yet": { ar: "لا يوجد مورّدون بعد", ckb: "هێشتا هیچ دابینکەرێک نییە" },
  "Add the suppliers the shop buys from": {
    ar: "أضف المورّدين الذين يشتري منهم المحل",
    ckb: "ئەو دابینکەرانە زیاد بکە کە دوکانەکە لێیان دەکڕێت",
  },
  "Vendor name": { ar: "اسم المورّد", ckb: "ناوی دابینکەر" },
  "Baghdad Dairy Co.": { ar: "شركة ألبان بغداد", ckb: "کۆمپانیای شیرەمەنیی بەغدا" },
  "What they supply": { ar: "ما يورّدونه", ckb: "چی دابین دەکەن" },
  "Dairy & cream": { ar: "ألبان وقشطة", ckb: "شیرەمەنی و قەیماغ" },
  Phone: { ar: "الهاتف", ckb: "تەلەفۆن" },
  "Add vendor": { ar: "أضف المورّد", ckb: "دابینکەرەکە زیاد بکە" },
  "Saved, and on the audit trail.": {
    ar: "حُفظ، وسُجّل في سجل التدقيق.",
    ckb: "پاشەکەوت کرا، و لە تۆماری گۆڕانکارییەکاندا نووسرا.",
  },
  "Days a delivery takes": { ar: "عدد أيام التوصيل", ckb: "ژمارەی ڕۆژەکانی گەیاندن" },
  "Café default": { ar: "الافتراضي للمقهى", ckb: "بنەڕەتی کافێ" },
  "In use: deliveries can be received from them": {
    ar: "قيد الاستخدام: يمكن استلام التوريدات منه",
    ckb: "بەکاردێت: دەتوانرێت کاڵایان لێ وەربگیرێت",
  },
  "Why (on the audit trail)": {
    ar: "السبب (يُسجَّل في سجل التدقيق)",
    ckb: "بۆچی (لە تۆماری گۆڕانکارییەکاندا دەنووسرێت)",
  },
  "e.g. their registered name": {
    ar: "مثلًا: اسمه المسجّل",
    ckb: "بۆ نموونە: ناوی تۆمارکراویان",
  },
  "e.g. no longer delivers": { ar: "مثلًا: لم يعد يورّد", ckb: "بۆ نموونە: چیتر کاڵا ناهێنێت" },
  "No two vendors in use share a name, whatever the capitals, spaces or punctuation — so the same invoice cannot be billed twice under two spellings. A vendor still owed money stays in use until their bills are paid or cancelled. The days a delivery takes tell the dashboard when an item they supply is running out (empty: the café's default, on Settings).":
    {
      ar: "لا يشترك مورّدان قيد الاستخدام في اسم واحد، مهما اختلفت الأحرف الكبيرة أو المسافات أو علامات الترقيم — حتى لا تُفوتر الفاتورة نفسها مرتين بتهجئتين مختلفتين. ويبقى المورّد الذي ما زال له مال قيد الاستخدام حتى تُدفع فواتيره أو تُلغى. وعدد أيام التوصيل يُخبر لوحة التحكم متى توشك مادة يورّدها على النفاد (فارغ: الافتراضي للمقهى، في الإعدادات).",
      ckb: "هیچ دوو دابینکەرێکی بەکارهاتوو هەمان ناویان نابێت، هەر پیتی گەورە و بۆشایی و خاڵبەندییەک هەبێت — بۆ ئەوەی هەمان پسووڵە دوو جار بە دوو ڕێنووسی جیاواز تۆمار نەکرێت. دابینکەرێک کە هێشتا پارەی لەسەرمانە لە بەکارهێناندا دەمێنێتەوە تا پسووڵەکانی دەدرێن یان هەڵدەوەشێنرێنەوە. ژمارەی ڕۆژەکانی گەیاندن بە داشبۆرد دەڵێت کەی کاڵایەک کە ئەوان دابینی دەکەن خەریکە تەواو دەبێت (بەتاڵ: بنەڕەتی کافێ، لە ڕێکخستنەکان).",
    },
  "Save changes": { ar: "حفظ التغييرات", ckb: "پاشەکەوتکردنی گۆڕانکارییەکان" },

  // What the till's and the drawer's actions say (src/lib/actions/sales.ts),
  // and the names of the fields they check.
  "This sale has no idempotency key": {
    ar: "لا يحمل هذا البيع مفتاح منع التكرار",
    ckb: "ئەم فرۆشتنە کلیلی ڕێگری لە دووبارەبوونەوەی نییە",
  },
  "Choose how it was paid": { ar: "اختر طريقة الدفع", ckb: "هەڵبژێرە چۆن پارە درا" },
  "a product": { ar: "منتجًا", ckb: "بەرهەمێک" },
  "The cart is empty": { ar: "السلة فارغة", ckb: "سەبەتەکە بەتاڵە" },
  "an approval": { ar: "موافقة", ckb: "ڕەزامەندییەک" },
  "The total shown": { ar: "المجموع المعروض", ckb: "کۆی پیشاندراو" },
  "Give the discount as a percentage or as an amount, not both": {
    ar: "أدخل الخصم كنسبة مئوية أو كمبلغ، لا الاثنين معًا",
    ckb: "داشکاندنەکە بە ڕێژەی سەدی یان بە بڕی پارە بنووسە، نەک هەردووکیان",
  },
  "a sale": { ar: "عملية بيع", ckb: "فرۆشتنێک" },
  "an item of the sale": { ar: "مادة من البيع", ckb: "کاڵایەک لە فرۆشتنەکە" },
  "Refund at least one": { ar: "استرد واحدًا على الأقل", ckb: "لانیکەم پارەی یەک دانە بگەڕێنەوە" },
  "A reason": { ar: "السبب", ckb: "هۆکار" },
  "What stays in the drawer": {
    ar: "ما يبقى في درج النقد",
    ckb: "ئەوەی لە دەخیلەدا دەمێنێتەوە",
  },
  "Choose where the cash comes from": {
    ar: "اختر من أين يأتي النقد",
    ckb: "هەڵبژێرە پارەکە لە کوێوە دێت",
  },
  "Choose where the cash goes": {
    ar: "اختر إلى أين يذهب النقد",
    ckb: "هەڵبژێرە پارەکە بۆ کوێ دەچێت",
  },
  // A vendor statement's notes (src/lib/db/books.ts).
  "Due {date}": { ar: "تستحق في {date}", ckb: "کاتی دانەوە {date}" },
  "was {amount}": { ar: "كانت {amount}", ckb: "پێشتر {amount} بوو" },
  // …and a supplier's credit on it (0044), shown through msg() and t().
  "Credit — goods returned": {
    ar: "إشعار دائن — بضاعة مُرجَعة",
    ckb: "پسووڵەی گەڕاندنەوە — کاڵای گەڕێندراوە",
  },
  "Credit — a lower price": {
    ar: "إشعار دائن — سعر أقل",
    ckb: "پسووڵەی گەڕاندنەوە — نرخێکی کەمتر",
  },
  "Credit — other": { ar: "إشعار دائن — غير ذلك", ckb: "پسووڵەی گەڕاندنەوە — هی تر" },
  "Credit {no}, their note {ref}": {
    ar: "الإشعار الدائن {no}، وإشعارهم {ref}",
    ckb: "پسووڵەی گەڕاندنەوەی {no}، پسووڵەکەیان {ref}",
  },
  // A supplier's statement between two dates (0044, supplier_statement).
  "A statement between two dates, to print": {
    ar: "كشف بين تاريخين، للطباعة",
    ckb: "کەشفێک لە نێوان دوو بەرواردا، بۆ چاپکردن",
  },
  "{from} to {to} · IQD": { ar: "من {from} إلى {to} · IQD", ckb: "لە {from} تا {to} · IQD" },
  "Owed before {day}": { ar: "المستحق قبل {day}", ckb: "قەرز پێش {day}" },
  "Owed on {day}": { ar: "المستحق في {day}", ckb: "قەرز لە {day}" },
  "Billed {billed} · cancelled {cancelled} · paid {paid} · credited {credited}": {
    ar: "المفوتَر {billed} · الملغى {cancelled} · المدفوع {paid} · المخصوم بإشعارات دائنة {credited}",
    ckb: "پسووڵەکراو {billed} · هەڵوەشێنراوە {cancelled} · دراو {paid} · بڕدراو بە پسووڵەی گەڕاندنەوە {credited}",
  },
  "Credits not yet set against a bill": {
    ar: "إشعارات دائنة لم تُخصم من فاتورة بعد",
    ckb: "پسووڵەی گەڕاندنەوە کە هێشتا لە پسووڵەیەک نەبڕدراون",
  },
  "Print the statement": { ar: "اطبع الكشف", ckb: "کەشفەکە چاپ بکە" },
  "Back to Vendors": { ar: "العودة إلى المورّدين", ckb: "گەڕانەوە بۆ دابینکەران" },
  // The drawer in sessions (0036): the till, Sales and the sessions' record.
  "The Drawer": {
    ar: "درج النقد",
    ckb: "دەخیلە",
  },
  "The drawer": {
    ar: "درج النقد",
    ckb: "دەخیلەکە",
  },
  "Opened and closed with a count · what it should hold is shown once the count is in": {
    ar: "يُفتح ويُغلق بعدّ · ما يجب أن يحويه يظهر بعد إدخال العدّ",
    ckb: "بە ژماردن دەکرێتەوە و دادەخرێت · ئەوەی دەبێت تێیدا بێت دوای تۆمارکردنی ژماردنەکە پیشان دەدرێت",
  },
  "Cash Sessions": {
    ar: "ورديات النقد",
    ckb: "شیفتەکانی پارە",
  },
  "Cash sessions": {
    ar: "ورديات النقد",
    ckb: "شیفتەکانی پارە",
  },
  "Each from its opening count to its closing count · over / short history": {
    ar: "كلّ وردية من عدّ افتتاحها إلى عدّ إغلاقها · سجلّ الزيادة والعجز",
    ckb: "هەر شیفتێک لە ژماردنی کردنەوەیەوە تا ژماردنی داخستنی · مێژووی زیادە و کەم",
  },
  "All sessions": {
    ar: "كلّ الورديات",
    ckb: "هەموو شیفتەکان",
  },
  Session: {
    ar: "الوردية",
    ckb: "شیفت",
  },
  "Session {no}": {
    ar: "الوردية {no}",
    ckb: "شیفتی {no}",
  },
  Opened: {
    ar: "فُتحت",
    ckb: "کرایەوە",
  },
  Closed: {
    ar: "أُغلقت",
    ckb: "داخرا",
  },
  "Opened with": {
    ar: "مبلغ الافتتاح",
    ckb: "بڕی کردنەوە",
  },
  "Day closed": {
    ar: "إغلاق يومي",
    ckb: "داخستنی ڕۆژانە",
  },
  "Closed by {name}: {reason}": {
    ar: "أغلقها {name}: {reason}",
    ckb: "{name} دایخست: {reason}",
  },
  "Handed over from session {no}": {
    ar: "مُسلَّمة من الوردية {no}",
    ckb: "لە شیفتی {no}ەوە ڕادەست کرا",
  },
  "Notes at the opening": {
    ar: "الأوراق النقدية عند الافتتاح",
    ckb: "پارە کاغەزییەکان لە کاتی کردنەوەدا",
  },
  "Notes at the close": {
    ar: "الأوراق النقدية عند الإغلاق",
    ckb: "پارە کاغەزییەکان لە کاتی داخستندا",
  },
  "Cash in and out": {
    ar: "النقد الداخل والخارج",
    ckb: "پارەی هاتوو و ڕۆیشتوو",
  },
  "Takings to the {place}": {
    ar: "المقبوضات إلى {place}",
    ckb: "داهات بۆ {place}",
  },
  "Cash sale": {
    ar: "بيع نقدي",
    ckb: "فرۆشتنی نەختینە",
  },
  "Paid out, reversed": {
    ar: "مدفوع أُلغي",
    ckb: "پارەدانێکی هەڵوەشێنراوە",
  },
  "Put in": {
    ar: "إيداع",
    ckb: "دانان",
  },
  "{n} session(s) · short {short} · over {over}": {
    ar: "{n} وردية · العجز {short} · الزيادة {over}",
    ckb: "{n} شیفت · کەم {short} · زیادە {over}",
  },
  "No cash sessions in these dates": {
    ar: "لا ورديات نقد في هذه التواريخ",
    ckb: "هیچ شیفتێکی پارە لەم ڕێکەوتانەدا نییە",
  },
  "A session begins when the drawer is opened on the till, counting the cash in it.": {
    ar: "تبدأ الوردية عند فتح درج النقد في نقطة البيع بعدّ النقد الذي فيه.",
    ckb: "شیفت دەست پێ دەکات کاتێک دەخیلەکە لە خاڵی فرۆشتن دەکرێتەوە و پارەی ناوی دەژمێردرێت.",
  },
  "The drawer is open: session {no}, {cashier}'s, since {when}": {
    ar: "درج النقد مفتوح: الوردية {no} لـ{cashier}، منذ {when}",
    ckb: "دەخیلەکە کراوەیە: شیفتی {no}ی {cashier}، لە {when}ەوە",
  },
  "The drawer is closed": {
    ar: "درج النقد مغلق",
    ckb: "دەخیلەکە داخراوە",
  },
  "Cash is taken only while it is open: open it by counting the cash in it.": {
    ar: "لا يُقبض النقد إلا وهو مفتوح: افتحه بعدّ النقد الذي فيه.",
    ckb: "پارە تەنها کاتێک وەردەگیرێت کە کراوە بێت: بە ژماردنی پارەی ناوی بیکەرەوە.",
  },
  "Open the drawer": {
    ar: "افتح درج النقد",
    ckb: "دەخیلەکە بکەرەوە",
  },
  "Close the drawer": {
    ar: "أغلق درج النقد",
    ckb: "دەخیلەکە دابخە",
  },
  "Hand over": {
    ar: "سلّم",
    ckb: "ڕادەست بکە",
  },
  "Close it for them": {
    ar: "أغلقها نيابةً عنه",
    ckb: "لە جیاتی ئەو دایبخە",
  },
  "Close session {no}": {
    ar: "أغلق الوردية {no}",
    ckb: "شیفتی {no} دابخە",
  },
  "Hand session {no} over": {
    ar: "سلّم الوردية {no}",
    ckb: "شیفتی {no} ڕادەست بکە",
  },
  "Close {cashier}'s session {no}": {
    ar: "أغلق وردية {cashier} رقم {no}",
    ckb: "شیفتی {no}ی {cashier} دابخە",
  },
  "Count what is in the drawer now, before putting anything in. Its difference from what the last session left is shown once the count is in.":
    {
      ar: "عُدّ ما في درج النقد الآن قبل وضع أيّ شيء فيه. يظهر فرقه عمّا تركته الوردية السابقة بعد إدخال العدّ.",
      ckb: "ئێستا ئەوەی لە دەخیلەکەدایە بژمێرە، پێش ئەوەی هیچی تێ بخەیت. جیاوازییەکەی لەگەڵ ئەوەی شیفتی پێشوو جێی هێشت دوای تۆمارکردنی ژماردنەکە پیشان دەدرێت.",
    },
  "Say why. Count the drawer if you can; left empty, it closes without a count and the next opening count finds what it held.":
    {
      ar: "اذكر السبب. عُدّ درج النقد إن استطعت؛ وإن تُرك فارغًا، تُغلق دون عدّ ويكشف عدّ الافتتاح التالي ما كان فيه.",
      ckb: "هۆکارەکە بڵێ. ئەگەر دەتوانیت دەخیلەکە بژمێرە؛ ئەگەر بە بەتاڵی جێبهێڵرێت، بێ ژماردن دادەخرێت و ژماردنی کردنەوەی داهاتوو دەردەخات چی تێدا بووە.",
    },
  "Count the cash in the drawer. What it should hold is shown once the count is in.": {
    ar: "عُدّ النقد في درج النقد. ما يجب أن يحويه يظهر بعد إدخال العدّ.",
    ckb: "پارەی ناو دەخیلەکە بژمێرە. ئەوەی دەبێت تێیدا بێت دوای تۆمارکردنی ژماردنەکە پیشان دەدرێت.",
  },
  "Why it is closed": {
    ar: "سبب الإغلاق",
    ckb: "هۆکاری داخستن",
  },
  "The cashier went home without closing it": {
    ar: "غادر أمين الصندوق دون إغلاقها",
    ckb: "کاشێرەکە ڕۆیشتەوە بێ ئەوەی دایبخات",
  },
  "Cash put in from the safe now (optional)": {
    ar: "نقد يوضع الآن من الخزنة (اختياري)",
    ckb: "پارەی ئێستا لە قاسەوە دادەنرێت (ئارەزوومەندانە)",
  },
  "Cash from the safe": {
    ar: "نقد من الخزنة",
    ckb: "پارە لە قاسەوە",
  },
  "Stays in the drawer for them": {
    ar: "يبقى في درج النقد لمن يستلم",
    ckb: "بۆ وەرگرەکە لە دەخیلەدا دەمێنێتەوە",
  },
  "Hand the drawer to": {
    ar: "سلّم درج النقد إلى",
    ckb: "دەخیلەکە ڕادەستی ئەم کەسە بکە",
  },
  "{n} bill(s) are still open: they are no cash yet, and are paid in the next session.": {
    ar: "لا تزال {n} فاتورة مفتوحة: ليست نقدًا بعد، وتُدفع في الوردية التالية.",
    ckb: "{n} پسووڵە هێشتا کراوەن: هێشتا پارە نین، و لە شیفتی داهاتوودا دەدرێن.",
  },
  "Close the session": {
    ar: "أغلق الوردية",
    ckb: "شیفتەکە دابخە",
  },
  "Close it without a count": {
    ar: "أغلقها دون عدّ",
    ckb: "بێ ژماردن دایبخە",
  },
  "It should hold {amount}": {
    ar: "يجب أن يحوي {amount}",
    ckb: "دەبێت {amount}ی تێدا بێت",
  },
  "cash sales {sales}, card {card}, {orders} order(s)": {
    ar: "مبيعات نقدية {sales}، بطاقة {card}، {orders} طلب",
    ckb: "فرۆشتنی نەختینە {sales}، کارت {card}، {orders} داواکاری",
  },
  "it agrees exactly": {
    ar: "مطابق تمامًا",
    ckb: "تەواو ڕێکە",
  },
  "{amount} short": {
    ar: "عجز {amount}",
    ckb: "{amount} کەم",
  },
  "{amount} over": {
    ar: "زيادة {amount}",
    ckb: "{amount} زیادە",
  },
  "(6300 Cash over / short, journal {no})": {
    ar: "(6300 زيادة / عجز النقد، القيد {no})",
    ckb: "(6300 زیادە / کەمی پارە، تۆماری {no})",
  },
  "Session {no} is open. The drawer counts before sessions end here: the books said the till held {expected}; counted {counted}: {difference}.":
    {
      ar: "الوردية {no} مفتوحة. تنتهي هنا عدّات درج النقد السابقة للورديات: كانت الدفاتر تقول إن الدرج يحوي {expected}؛ والمعدود {counted}: {difference}.",
      ckb: "شیفتی {no} کراوەیە. ژماردنەکانی دەخیلە پێش شیفتەکان لێرە کۆتایی دێن: دەفتەرەکان دەیانگوت دەخیلەکە {expected}ی تێدایە؛ ژمێردرا {counted}: {difference}.",
    },
  "Session {no} is open. Counted {counted}; the last session left {expected}: {difference}.": {
    ar: "الوردية {no} مفتوحة. المعدود {counted}؛ وتركت الوردية السابقة {expected}: {difference}.",
    ckb: "شیفتی {no} کراوەیە. ژمێردرا {counted}؛ شیفتی پێشوو {expected}ی جێهێشت: {difference}.",
  },
  "{amount} put in from the safe.": {
    ar: "وُضع {amount} من الخزنة.",
    ckb: "{amount} لە قاسەوە دانرا.",
  },
  "Session {no} is closed without a count: the {expected} it should hold stays in the drawer for the next opening count.":
    {
      ar: "أُغلقت الوردية {no} دون عدّ: المبلغ المتوقّع {expected} يبقى في درج النقد لعدّ الافتتاح التالي.",
      ckb: "شیفتی {no} بێ ژماردن داخرا: ئەو {expected}ـەی دەبێت تێیدا بێت بۆ ژماردنی کردنەوەی داهاتوو لە دەخیلەدا دەمێنێتەوە.",
    },
  "Session {no} is closed. It should have held {expected}; counted {counted}: {difference}.": {
    ar: "أُغلقت الوردية {no}. كان يجب أن تحوي {expected}؛ والمعدود {counted}: {difference}.",
    ckb: "شیفتی {no} داخرا. دەبوو {expected}ی تێدا بێت؛ ژمێردرا {counted}: {difference}.",
  },
  "Session {no} is open for {name}.": {
    ar: "الوردية {no} مفتوحة لـ{name}.",
    ckb: "شیفتی {no} بۆ {name} کراوەیە.",
  },
  "Cash sales {sales} · refunds {refunds} · voids {voids} · paid out {paidOut} · put in {cashIn} · taken out {cashOut} · card {card} · {orders} order(s)":
    {
      ar: "مبيعات نقدية {sales} · استردادات {refunds} · إلغاءات {voids} · مدفوعات {paidOut} · إيداعات {cashIn} · سحوبات {cashOut} · بطاقة {card} · {orders} طلب",
      ckb: "فرۆشتنی نەختینە {sales} · گەڕاندنەوە {refunds} · هەڵوەشاندنەوە {voids} · پارەدان {paidOut} · دانان {cashIn} · دەرهێنان {cashOut} · کارت {card} · {orders} داواکاری",
    },
  "Notes of {note}": {
    ar: "أوراق فئة {note}",
    ckb: "پارەی کاغەزی {note}",
  },
  "Cash counted (IQD), if counted": {
    ar: "النقد المعدود (IQD)، إن عُدّ",
    ckb: "پارەی ژمێردراو (IQD)، ئەگەر ژمێردرا",
  },
  "Type the total instead": {
    ar: "اكتب المجموع بدلًا من ذلك",
    ckb: "لە جیاتی ئەوە کۆی گشتی بنووسە",
  },
  "Count note by note": {
    ar: "عُدّ ورقةً ورقة",
    ckb: "کاغەز بە کاغەز بژمێرە",
  },
  "Count whole notes.": {
    ar: "عُدّ أوراقًا كاملة.",
    ckb: "کاغەزی تەواو بژمێرە.",
  },
  "Open the drawer first: count the cash in it. A card sale needs no drawer.": {
    ar: "افتح درج النقد أولًا: عُدّ النقد الذي فيه. البيع بالبطاقة لا يحتاج درجًا.",
    ckb: "سەرەتا دەخیلەکە بکەرەوە: پارەی ناوی بژمێرە. فرۆشتن بە کارت پێویستی بە دەخیلە نییە.",
  },
  "a session": {
    ar: "وردية",
    ckb: "شیفتێک",
  },
  "the person taking the drawer": {
    ar: "من يستلم درج النقد",
    ckb: "ئەو کەسەی دەخیلەکە وەردەگرێت",
  },

  // Refunds over the limit, and selling beyond the books (0040).
  "Over {limit}, a second person approves it: choose who, and they type their PIN.": {
    ar: "فوق {limit} يوافق عليه شخص ثانٍ: اختر من، ويكتب رمز PIN الخاص به.",
    ckb: "لە سەرووی {limit} کەسێکی دووەم ڕەزامەندی لەسەر دەدات: هەڵیبژێرە، و ئەو PIN ی خۆی دەنووسێت.",
  },
  "A manager approves selling more than the books hold": {
    ar: "يوافق مدير على بيع أكثر مما تحتفظ به الدفاتر",
    ckb: "بەڕێوەبەرێک ڕەزامەندی لەسەر فرۆشتنی زیاتر لەوەی لە دەفتەرەکاندایە دەدات",
  },

  // The till's sizes and add-ons (0041): the options sheet, and a line's add-ons.
  "Choose {n}": { ar: "اختر {n}", ckb: "{n} هەڵبژێرە" },
  "As many as you like": { ar: "بقدر ما تشاء", ckb: "هەرچەندێک بتەوێت" },
  "Up to {n}": { ar: "حتى {n}", ckb: "تا {n}" },
  "At least {n}": { ar: "{n} على الأقل", ckb: "لانیکەم {n}" },
  "{min} to {max}": { ar: "من {min} إلى {max}", ckb: "{min} تا {max}" },
  Size: { ar: "الحجم", ckb: "قەبارە" },
  free: { ar: "مجانًا", ckb: "بێبەرامبەر" },
  "Choose {group}": { ar: "اختر {group}", ckb: "{group} هەڵبژێرە" },
  "At most {n} from {group}": { ar: "{n} على الأكثر من {group}", ckb: "زۆرترین {n} لە {group}" },
  "an add-on": { ar: "إضافة", ckb: "زیادەیەک" },
  "A line takes at most 20 add-ons": {
    ar: "يأخذ السطر 20 إضافة على الأكثر",
    ckb: "هێڵێک زۆرترین 20 زیادە وەردەگرێت",
  },
  "Add an add-on 1 to 20 times": {
    ar: "أضف الإضافة من 1 إلى 20 مرة",
    ckb: "زیادەیەک 1 تا 20 جار زیاد بکە",
  },

  // Split payments at the till and in a refund (0042).
  "Cash received": { ar: "المبلغ المستلم نقدًا", ckb: "پارەی کاشی وەرگیراو" },
  Split: { ar: "تقسيم", ckb: "دابەشکردن" },
  "Add a payment": { ar: "أضف دفعة", ckb: "پارەدانێک زیاد بکە" },
  "Amount of payment {n}": { ar: "مبلغ الدفعة {n}", ckb: "بڕی پارەدانی {n}" },
  "How payment {n} is made": { ar: "طريقة الدفعة {n}", ckb: "شێوازی پارەدانی {n}" },
  "Take off payment {n}": { ar: "احذف الدفعة {n}", ckb: "پارەدانی {n} لاببە" },
  "Amounts are whole dinars": { ar: "المبالغ بالدينار الكامل", ckb: "بڕەکان بە دیناری تەواون" },
  "Type how much each payment is": { ar: "اكتب مبلغ كل دفعة", ckb: "بڕی هەر پارەدانێک بنووسە" },
  "The last payment takes what is left.": {
    ar: "الدفعة الأخيرة تدفع ما تبقّى.",
    ckb: "دوایین پارەدان ئەوەی ماوە دەدات.",
  },
  "The payments come to {amount} more than the total": {
    ar: "الدفعات تزيد على المجموع بمقدار {amount}",
    ckb: "پارەدانەکان {amount} لە کۆی گشتی زیاترن",
  },
  "Given back {way}": { ar: "المُعاد: {way}", ckb: "گەڕێندراو: {way}" },
  "{way}, at most {left}": { ar: "{way}، {left} على الأكثر", ckb: "{way}، لانیزۆر {left}" },

  // US dollars at the till, the drawer and on Sales (0043).
  Dollars: { ar: "الدولار", ckb: "دۆلار" },
  "Dollars handed over": { ar: "الدولارات المُسلَّمة", ckb: "ئەو دۆلارانەی دران" },
  "{rate} dinars a dollar": { ar: "{rate} دينار للدولار", ckb: "{rate} دینار بۆ هەر دۆلارێک" },
  "{usd} are {amount}": { ar: "{usd} تساوي {amount}", ckb: "{usd} دەکاتە {amount}" },
  "Change, in dinars": { ar: "الباقي، بالدينار", ckb: "باقی، بە دینار" },
  "The other {amount} is paid": {
    ar: "المتبقي ({amount}) يُدفع",
    ckb: "ئەوەی ماوە ({amount}) دەدرێت",
  },
  "The rest is paid": { ar: "طريقة دفع المتبقي", ckb: "شێوازی دانی ئەوەی ماوە" },
  "No dollars now: the rate was set {n} hours ago. A manager sets today's on Sales → Dollars.": {
    ar: "لا دولار الآن: حُدّد السعر قبل {n} ساعة. يحدد المدير سعر اليوم في شاشة «المبيعات»، قسم «الدولار».",
    ckb: "ئێستا دۆلار وەرناگیرێت: نرخەکە {n} کاتژمێر لەمەوبەر دانرا. بەڕێوەبەرێک نرخی ئەمڕۆ لە شاشەی «فرۆشتن»، بەشی «دۆلار» دادەنێت.",
  },
  "{usd} at {rate} = {amount}": {
    ar: "{usd} بسعر {rate} = {amount}",
    ckb: "{usd} بە نرخی {rate} = {amount}",
  },
  "Dollars {usd} at {rate}": { ar: "دولار {usd} بسعر {rate}", ckb: "دۆلار {usd} بە نرخی {rate}" },
  "Dollars in the till": { ar: "الدولارات في الدرج", ckb: "دۆلارەکانی ناو دەخیلە" },
  "The till took dollars: count them too. They all go to the safe; what it should hold is shown once the count is in.":
    {
      ar: "أخذ الدرج دولارات: عُدّها أيضًا. تذهب كلها إلى الخزنة؛ ويظهر ما يجب أن يحويه بعد إدخال العدّ.",
      ckb: "دەخیلەکە دۆلاری وەرگرتووە: ئەوانیش بژمێرە. هەموویان دەچنە قاسەکە؛ ئەوەی دەبێت تێیدا بێت دوای تۆمارکردنی ژماردنەکە پیشان دەدرێت.",
    },
  "Dollars: it should have held {expected}; counted {counted}: {difference}.": {
    ar: "الدولار: كان يجب أن يحوي {expected}؛ عُدّ {counted}: {difference}.",
    ckb: "دۆلار: دەبوو {expected} تێیدا بێت؛ {counted} ژمێردرا: {difference}.",
  },
  "{usd} short ({amount})": { ar: "عجز {usd} ({amount})", ckb: "{usd} کەمە ({amount})" },
  "{usd} over ({amount})": { ar: "زيادة {usd} ({amount})", ckb: "{usd} زیادە ({amount})" },
  "{usd} to the safe, at {amount}.": {
    ar: "{usd} إلى الخزنة، بقيمة {amount}.",
    ckb: "{usd} بۆ قاسەکە، بە بەهای {amount}.",
  },
  "The till's {usd} were not counted: they stay in it for the next count.": {
    ar: "لم تُعدّ دولارات الدرج ({usd}): تبقى فيه حتى العدّ التالي.",
    ckb: "{usd}ی ناو دەخیلەکە نەژمێردران: تێیدا دەمێننەوە بۆ ژماردنی داهاتوو.",
  },
  "Dollars counted ($), if counted": {
    ar: "الدولارات المعدودة ($)، إن عُدّت",
    ckb: "دۆلاری ژمێردراو ($)، ئەگەر ژمێردرا",
  },
  "Dollars counted ($)": { ar: "الدولارات المعدودة ($)", ckb: "دۆلاری ژمێردراو ($)" },
  "Dollars counted": { ar: "الدولارات المعدودة", ckb: "دۆلاری ژمێردراو" },
  "Taken at the rate a manager sets · counted at each close and kept in the safe": {
    ar: "تؤخذ بالسعر الذي يحدده المدير · تُعدّ عند كل إغلاق وتُحفظ في الخزنة",
    ckb: "بەو نرخە وەردەگیرێن کە بەڕێوەبەر دایدەنێت · لە هەر داخستنێکدا دەژمێردرێن و لە قاسەدا هەڵدەگیرێن",
  },
  "No dollar rate is set: dollars are not taken": {
    ar: "لم يُحدَّد سعر للدولار: لا تُؤخذ الدولارات",
    ckb: "هیچ نرخێکی دۆلار دانەنراوە: دۆلار وەرناگیرێت",
  },
  "too old: dollars are not taken": {
    ar: "قديم: لا تُؤخذ الدولارات",
    ckb: "کۆنە: دۆلار وەرناگیرێت",
  },
  "Set {when} by {who}: {reason}": {
    ar: "حدّده {who} في {when}: {reason}",
    ckb: "{who} لە {when} دایناوە: {reason}",
  },
  "A rate is used for {hours} hours; dollars are counted in dinars to the nearest {step}, and change is given in dinars.":
    {
      ar: "يُستخدم السعر لمدة {hours} ساعة؛ وتُحسب الدولارات بالدينار لأقرب {step}، ويُعطى الباقي بالدينار.",
      ckb: "نرخێک بۆ ماوەی {hours} کاتژمێر بەکاردێت؛ دۆلار بە دینار بۆ نزیکترین {step} هەژمار دەکرێت، و باقی بە دینار دەدرێتەوە.",
    },
  "Dollars held": { ar: "الدولارات المحتفظ بها", ckb: "دۆلاری هەڵگیراو" },
  "The safe: {usd} (taken at {amount})": {
    ar: "الخزنة: {usd} (أُخذت بقيمة {amount})",
    ckb: "قاسە: {usd} (بە بەهای {amount} وەرگیراون)",
  },
  "{place}'s till: {usd} (taken at {amount})": {
    ar: "درج {place}: {usd} (أُخذت بقيمة {amount})",
    ckb: "دەخیلەی {place}: {usd} (بە بەهای {amount} وەرگیراون)",
  },
  "Rates set before": { ar: "الأسعار المحددة سابقًا", ckb: "نرخە پێشووەکان" },
  "Dinars a dollar": { ar: "دينار للدولار", ckb: "دینار بۆ هەر دۆلارێک" },
  "The rate is {rate} dinars a dollar.": {
    ar: "السعر {rate} دينار للدولار.",
    ckb: "نرخەکە {rate} دینارە بۆ هەر دۆلارێک.",
  },
  "Today's rate: dinars a dollar": {
    ar: "سعر اليوم: دينار للدولار",
    ckb: "نرخی ئەمڕۆ: دینار بۆ هەر دۆلارێک",
  },
  "Where it comes from": { ar: "مصدره", ckb: "سەرچاوەکەی" },
  "The exchange office's rate this morning": {
    ar: "سعر مكتب الصرافة صباح اليوم",
    ckb: "نرخی نووسینگەی ئاڵوگۆڕ ئەمڕۆ بەیانی",
  },
  "Set the rate": { ar: "حدّد السعر", ckb: "نرخەکە دابنێ" },
  "{usd} exchanged for {received}: they were taken at {value}.": {
    ar: "صُرفت {usd} مقابل {received}: وكانت قد أُخذت بقيمة {value}.",
    ckb: "{usd} بە {received} گۆڕدرایەوە: بە بەهای {value} وەرگیرابوون.",
  },
  "A gain of {amount} (6950 Exchange differences, journal {journal}).": {
    ar: "ربح {amount} (6950 فروق الصرف، القيد {journal}).",
    ckb: "قازانجی {amount} (6950 جیاوازی ئاڵوگۆڕ، تۆماری {journal}).",
  },
  "A loss of {amount} (6950 Exchange differences, journal {journal}).": {
    ar: "خسارة {amount} (6950 فروق الصرف، القيد {journal}).",
    ckb: "زیانی {amount} (6950 جیاوازی ئاڵوگۆڕ، تۆماری {journal}).",
  },
  "Exchange dollars for dinars": { ar: "صرف الدولارات بالدينار", ckb: "گۆڕینەوەی دۆلار بە دینار" },
  "Dollars from": { ar: "الدولارات من", ckb: "دۆلار لە" },
  "Dollars exchanged": { ar: "الدولارات المصروفة", ckb: "دۆلاری گۆڕدراو" },
  "Dinars received": { ar: "الدنانير المستلمة", ckb: "دیناری وەرگیراو" },
  Into: { ar: "إلى", ckb: "بۆ" },
  "Dinars into": { ar: "الدنانير إلى", ckb: "دینار بۆ" },
  Exchange: { ar: "اصرف", ckb: "بیگۆڕەوە" },
  "Dollars in and out": { ar: "الدولارات الداخلة والخارجة", ckb: "دۆلاری هاتوو و ڕۆیشتوو" },
  "Not counted at the close: {usd} stayed in the till": {
    ar: "لم تُعدّ عند الإغلاق: بقيت {usd} في الدرج",
    ckb: "لە داخستندا نەژمێردران: {usd} لە دەخیلەکەدا مانەوە",
  },
  "Should have held {expected}; counted {counted}; {taken} to the safe": {
    ar: "كان يجب أن يحوي {expected}؛ عُدّ {counted}؛ {taken} إلى الخزنة",
    ckb: "دەبوو {expected} تێیدا بێت؛ {counted} ژمێردرا؛ {taken} بۆ قاسەکە",
  },
  "Taken at": { ar: "القيمة عند الأخذ", ckb: "بەهای وەرگرتن" },
  "Paid in dollars": { ar: "دُفع بالدولار", ckb: "بە دۆلار درا" },
  "Counted over or short": { ar: "عُدّ بزيادة أو عجز", ckb: "بە زیادە یان کەمی ژمێردرا" },
  "Taken to the safe": { ar: "نُقل إلى الخزنة", ckb: "برا بۆ قاسە" },
  "Exchanged for dinars": { ar: "صُرف بالدينار", ckb: "بە دینار گۆڕدرایەوە" },
  "and {usd} in dollars, taken at {amount}": {
    ar: "و{usd} بالدولار، أُخذت بقيمة {amount}",
    ckb: "و {usd} بە دۆلار، بە بەهای {amount} وەرگیراون",
  },
  // Losses by kind, giveaways at the till, and the loss report (0048).
  "Give away…": { ar: "إهداء…", ckb: "بەخشین…" },
  "Give away": { ar: "إهداء", ckb: "بەخشین" },
  "Give it away": { ar: "أهدِه", ckb: "بیبەخشە" },
  "What is it?": { ar: "ما هو؟", ckb: "چییە؟" },
  "Nothing is charged: it is not a sale. What it costs goes to its own account, and the bar makes it by its number.":
    {
      ar: "لا يُدفع شيء: ليس بيعًا. كلفته تُحمَّل على حسابها الخاص، والبار يحضّره برقمه.",
      ckb: "هیچ پارەیەک وەرناگیرێت: فرۆشتن نییە. تێچووەکەی دەچێتە سەر هەژماری خۆی، و بار بە ژمارەکەی ئامادەی دەکات.",
    },
  "Given away: {what}": { ar: "أُهدي: {what}", ckb: "بەخشرا: {what}" },
  "Given away: {what}, number {n}.": {
    ar: "أُهدي: {what}، رقم {n}.",
    ckb: "بەخشرا: {what}، ژمارە {n}.",
  },
  "Given away: {what}.": { ar: "أُهدي: {what}.", ckb: "بەخشرا: {what}." },
  Sample: { ar: "عيّنة", ckb: "نموونە" },
  "For the staff, eaten or drunk here.": {
    ar: "للموظفين، يؤكل أو يُشرب هنا.",
    ckb: "بۆ ستاف، لێرە دەخورێت یان دەخورێتەوە.",
  },
  "Free for a customer.": { ar: "مجانًا لزبون.", ckb: "بە خۆڕایی بۆ کڕیارێک." },
  "A taste, to sell more.": { ar: "للتذوّق، لبيع المزيد.", ckb: "بۆ تامکردن، بۆ فرۆشتنی زیاتر." },
  "This giveaway has no idempotency key": {
    ar: "لا يحمل هذا الإهداء مفتاح منع التكرار",
    ckb: "ئەم بەخشینە کلیلی ڕێگری لە دووبارەبوونەوەی نییە",
  },
  "Why it is given away": { ar: "سبب الإهداء", ckb: "هۆی بەخشین" },
};

export default phrases;
