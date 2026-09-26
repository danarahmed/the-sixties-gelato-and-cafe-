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
    ckb: "فرۆشی ڕەسەن، دوای گەڕاندنەوەی پارە",
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
  "Net sales": { ar: "صافي المبيعات", ckb: "فرۆشی ڕەسەن" },
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
};

export default phrases;
